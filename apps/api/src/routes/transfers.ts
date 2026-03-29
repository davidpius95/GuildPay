import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db";
import { AuthRequest, requireKyc } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as nium from "../services/nium";
import * as flw from "../services/flutterwave";
import { selectRoute, calculateFee, selectFxProvider, getAvailableCorridors, getCorridorRoutes } from "../services/payment-router";
import { isDemoMode } from "../config/providers";
import { KYC_LIMITS } from "@guildpay/shared";

export const transferRouter = Router();

// ─── Resilient FX: tries provider → fallback provider → database rates ───
async function getRate(from: string, to: string, amount: number): Promise<{ exchangeRate: number; toAmount: number; provider: string; quoteId?: string }> {
  const fxProvider = selectFxProvider(from, to);

  // Try primary provider
  try {
    if (fxProvider === "nium") {
      const quote = await nium.getFxQuote({ sourceCurrency: from, destinationCurrency: to, sourceAmount: amount });
      return { exchangeRate: quote.exchangeRate, toAmount: quote.destinationAmount, provider: "nium", quoteId: quote.quoteId };
    } else {
      const rate = await flw.getExchangeRate({ from, to, amount });
      return { exchangeRate: rate.data.rate, toAmount: rate.data.destination.amount, provider: "flutterwave" };
    }
  } catch (e) {
    console.warn(`[FX] ${fxProvider} failed for ${from}→${to}, trying fallback...`);
  }

  // Try fallback provider
  try {
    if (fxProvider === "nium") {
      const rate = await flw.getExchangeRate({ from, to, amount });
      return { exchangeRate: rate.data.rate, toAmount: rate.data.destination.amount, provider: "flutterwave" };
    } else {
      const quote = await nium.getFxQuote({ sourceCurrency: from, destinationCurrency: to, sourceAmount: amount });
      return { exchangeRate: quote.exchangeRate, toAmount: quote.destinationAmount, provider: "nium", quoteId: quote.quoteId };
    }
  } catch (e) {
    console.warn(`[FX] Both providers failed for ${from}→${to}, using database rates`);
  }

  // Final fallback: seeded database rates
  const dbRate = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
  });
  if (dbRate) {
    const rate = Number(dbRate.rate);
    return { exchangeRate: rate, toAmount: Math.round(amount * rate * 100) / 100, provider: "database" };
  }

  throw new AppError(`No exchange rate available for ${from}→${to}`, 400, "NO_FX_RATE");
}

// ─── POST /send — Send money to recipient ───
transferRouter.post(
  "/send",
  requireKyc("TIER_1"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        recipientId: z.string(),
        amount: z.number().positive(),
        currency: z.string(),
        toCurrency: z.string().optional(),
        note: z.string().max(200).optional(),
        pin: z.string().length(6),
        preferredProvider: z.enum(["nium", "flutterwave"]).optional(),
      });

      const { recipientId, amount, currency, toCurrency, note, pin, preferredProvider } = schema.parse(req.body);
      const userId = req.user!.id;

      // ── Verify PIN ──
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pin: true },
      });
      if (!user?.pin) {
        throw new AppError("PIN not set. Please set your transaction PIN first.", 400, "PIN_NOT_SET");
      }
      const pinValid = await bcrypt.compare(pin, user.pin);
      if (!pinValid) {
        throw new AppError("Invalid PIN", 401, "INVALID_PIN");
      }

      // ── Enforce KYC daily/monthly limits ──
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { kycTier: true },
      });
      const tier = profile?.kycTier || "TIER_0";
      const limits = KYC_LIMITS[tier];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

      const [dailyTotal, monthlyTotal] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: "SEND", createdAt: { gte: todayStart }, status: { not: "FAILED" } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "SEND", createdAt: { gte: monthStart }, status: { not: "FAILED" } },
          _sum: { amount: true },
        }),
      ]);

      if (Number(dailyTotal._sum.amount || 0) + amount > limits.daily) {
        throw new AppError(`Daily limit of $${limits.daily} exceeded for ${tier}`, 400, "DAILY_LIMIT_EXCEEDED");
      }
      if (Number(monthlyTotal._sum.amount || 0) + amount > limits.monthly) {
        throw new AppError(`Monthly limit of $${limits.monthly} exceeded for ${tier}`, 400, "MONTHLY_LIMIT_EXCEEDED");
      }

      // ── Verify recipient ──
      const recipient = await prisma.recipient.findFirst({
        where: { id: recipientId, userId },
      });
      if (!recipient) {
        throw new AppError("Recipient not found", 404, "RECIPIENT_NOT_FOUND");
      }

      // ── Pre-validate recipient account (Nium Verify / Flutterwave Resolve) ──
      try {
        if (recipient.accountNumber && recipient.bankCode) {
          const useFlw = recipient.countryCode === "NG" || recipient.countryCode === "GH" || recipient.countryCode === "KE";
          if (useFlw) {
            await flw.resolveAccount({ account_number: recipient.accountNumber, account_bank: recipient.bankCode });
          } else {
            const walletForVerify = await prisma.wallet.findUnique({ where: { userId } });
            await nium.verifyAccount({
              customerHashId: (walletForVerify as any)?.niumCustomerHashId || "",
              destinationCountry: recipient.countryCode,
              payoutMethod: "LOCAL",
              bankCode: recipient.bankCode,
              accountNumber: recipient.accountNumber,
            });
          }
          console.log(`[SEND] Account pre-validated for recipient ${recipient.name}`);
        }
      } catch (verifyErr: any) {
        console.warn(`[SEND] Account verification failed: ${verifyErr.message}`);
        // Non-blocking in demo mode, blocking in production
        if (!isDemoMode()) {
          throw new AppError("Recipient account validation failed. Please verify the account details.", 400, "ACCOUNT_VALIDATION_FAILED");
        }
      }

      // ── Check wallet balance ──
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: { balances: { where: { currency } } },
      });
      if (!wallet || !wallet.balances[0]) {
        throw new AppError("Wallet balance not found", 404, "BALANCE_NOT_FOUND");
      }
      const available = Number(wallet.balances[0].balance) - Number(wallet.balances[0].locked);

      // ── Select payment route ──
      const targetCurrency = toCurrency || currency;
      const route = selectRoute({
        fromCurrency: currency,
        toCurrency: targetCurrency,
        amount,
        preferredRail: recipient.walletAddress ? "CRYPTO" : recipient.mobileNumber ? "MOBILE_MONEY" : "BANK_TRANSFER",
        preferredProvider: preferredProvider as any,
      });

      const fee = calculateFee(route, amount);

      if (available < amount + fee) {
        throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
      }

      // ── Get FX rate (resilient: provider → fallback → database) ──
      let exchangeRate: number | null = null;
      let toAmount = amount;

      let fxQuoteId: string | undefined;
      if (targetCurrency !== currency) {
        const fx = await getRate(currency, targetCurrency, amount);
        exchangeRate = fx.exchangeRate;
        toAmount = fx.toAmount;
        fxQuoteId = fx.quoteId;
      }

      // ── Create transaction + lock funds ──
      const transaction = await prisma.$transaction(async (tx) => {
        await tx.walletBalance.update({
          where: { walletId_currency: { walletId: wallet.id, currency } },
          data: { locked: { increment: amount + fee } },
        });

        const txn = await tx.transaction.create({
          data: {
            userId,
            type: "SEND",
            status: "INITIATED",
            amount,
            currency,
            fee,
            feeCurrency: currency,
            recipientId,
            toAmount,
            toCurrency: targetCurrency,
            exchangeRate,
            note,
            provider: route.provider,
            rail: recipient.walletAddress ? "CRYPTO" : recipient.mobileNumber ? "MOBILE_MONEY" : "BANK_TRANSFER",
            metadata: { routeProvider: route.provider, routeRail: route.rail, estimatedTime: route.estimatedTime },
          },
        });

        await tx.transferTracking.create({
          data: {
            transactionId: txn.id,
            status: "initiated",
            message: `Transfer initiated via ${route.provider}`,
          },
        });

        return txn;
      });

      // ── Dispatch to provider ──
      try {
        if (route.provider === "nium") {
          // Nium payout — Gulf/global corridor
          const payout = await nium.createPayout({
            customerHashId: (wallet as any).niumCustomerHashId || "",
            walletHashId: (wallet as any).niumWalletHashId || "",
            amount,
            sourceCurrency: currency,
            destinationCurrency: targetCurrency,
            destinationCountry: recipient.countryCode,
            payoutMethod: route.rail === "SWIFT" ? "SWIFT" : "LOCAL",
            beneficiary: {
              name: recipient.name,
              accountNumber: recipient.accountNumber || undefined,
              bankCode: recipient.bankCode || undefined,
              mobileNumber: recipient.mobileNumber || undefined,
              email: recipient.email || undefined,
            },
            quoteId: fxQuoteId,
            idempotencyKey: transaction.id,
          });

          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "PROCESSING", providerRef: payout.systemReferenceNumber, processedAt: new Date() },
            }),
            prisma.transferTracking.create({
              data: {
                transactionId: transaction.id,
                status: "processing",
                message: `Payment processing via Nium (ref: ${payout.systemReferenceNumber})`,
              },
            }),
          ]);
        } else if (route.provider === "flutterwave") {
          // Flutterwave payout — African corridor
          let transfer: flw.FlwTransfer;

          if (recipient.mobileNumber && route.rail === "MOBILE_MONEY") {
            transfer = await flw.createMobileMoneyTransfer({
              account_bank: recipient.mobileProvider === "M-Pesa" ? "MPS" : recipient.mobileProvider === "MTN" ? "MTN" : "MPS",
              account_number: recipient.mobileNumber,
              amount: toAmount,
              currency: targetCurrency,
              narration: note || `GuildPay transfer to ${recipient.name}`,
              reference: transaction.id,
              beneficiary_name: recipient.name,
            });
          } else {
            transfer = await flw.createBankTransfer({
              account_bank: recipient.bankCode || "",
              account_number: recipient.accountNumber || "",
              amount: toAmount,
              currency: targetCurrency,
              narration: note || `GuildPay transfer to ${recipient.name}`,
              reference: transaction.id,
              beneficiary_name: recipient.name,
            });
          }

          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "PROCESSING", providerRef: String(transfer.data.id), processedAt: new Date() },
            }),
            prisma.transferTracking.create({
              data: {
                transactionId: transaction.id,
                status: "processing",
                message: `Payment processing via Flutterwave (ref: ${transfer.data.reference})`,
              },
            }),
          ]);
        }
      } catch (providerErr: any) {
        console.warn(`[SEND] Provider dispatch failed: ${providerErr.message}`);
        if (!isDemoMode()) {
          // In production, fail the transaction and release locked funds
          await prisma.$transaction([
            prisma.walletBalance.update({
              where: { walletId_currency: { walletId: wallet.id, currency } },
              data: { locked: { decrement: amount + fee } },
            }),
            prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "FAILED", failedReason: providerErr.message, failedAt: new Date() },
            }),
            prisma.transferTracking.create({
              data: { transactionId: transaction.id, status: "failed", message: `Provider error: ${providerErr.message}` },
            }),
          ]);
          return res.status(502).json({ error: "Payment provider unavailable", transactionId: transaction.id, status: "FAILED" });
        }
        // Demo mode: simulate completion
        console.log(`[SEND] Demo mode — simulating sandbox completion.`);

        await prisma.$transaction([
          // Deduct balance (release lock and deduct actual amount)
          prisma.walletBalance.update({
            where: { walletId_currency: { walletId: wallet.id, currency } },
            data: {
              balance: { decrement: amount + fee },
              locked: { decrement: amount + fee },
            },
          }),
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: "COMPLETED",
              providerRef: `sandbox_${Date.now()}`,
              provider: "sandbox",
              processedAt: new Date(),
              completedAt: new Date(),
            },
          }),
          prisma.transferTracking.create({
            data: {
              transactionId: transaction.id,
              status: "processing",
              message: `Payment routed via ${route.provider} (sandbox simulation)`,
            },
          }),
          prisma.transferTracking.create({
            data: {
              transactionId: transaction.id,
              status: "completed",
              message: `Transfer completed (sandbox mode — providers unavailable, simulated locally)`,
            },
          }),
          prisma.notification.create({
            data: {
              userId,
              type: "TRANSACTION",
              title: "Transfer Complete",
              body: `${currency} ${amount} sent to ${recipient.name}. ${targetCurrency} ${toAmount.toFixed(2)} delivered.`,
              data: { transactionId: transaction.id },
            },
          }),
        ]);
      }

      res.status(201).json({
        transactionId: transaction.id,
        status: "PROCESSING",
        provider: route.provider,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        fee,
        toAmount,
        toCurrency: targetCurrency,
        exchangeRate,
        estimatedTime: route.estimatedTime,
        recipient: { name: recipient.name, country: recipient.country },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /topup — Fund wallet ───
transferRouter.post("/topup", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      amount: z.number().positive().min(1).max(10000),
      currency: z.string(),
      paymentMethod: z.enum(["card", "bank_transfer", "mobile_money"]).default("card"),
      mobileCountry: z.string().optional(), // for mobile money: "KE", "GH"
    });

    const { amount, currency, paymentMethod, mobileCountry } = schema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { firstName: true, lastName: true } } },
    });

    const feeRate = 0.015;
    const fee = Math.round(amount * feeRate * 100) / 100;

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: "TOPUP",
        status: "INITIATED",
        amount,
        currency,
        fee,
        feeCurrency: currency,
        provider: paymentMethod === "mobile_money" ? "flutterwave" : "flutterwave",
        rail: paymentMethod === "mobile_money" ? "MOBILE_MONEY" : paymentMethod === "card" ? "CARD" : "BANK_TRANSFER",
      },
    });

    if (paymentMethod === "mobile_money" && mobileCountry) {
      // Direct mobile money charge (M-Pesa, MTN MoMo)
      const charge = await flw.chargeMobileMoney({
        tx_ref: transaction.id,
        amount: amount + fee,
        currency,
        phone_number: user?.email || "", // should be phone from request
        email: user?.email || "",
        country: mobileCountry,
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { providerRef: String(charge.data.id), status: "PROCESSING" },
      });

      res.status(201).json({
        transactionId: transaction.id,
        status: "PROCESSING",
        message: "Check your phone to authorize the payment",
        providerRef: charge.data.flw_ref,
      });
    } else {
      // Hosted checkout (card / bank transfer)
      const redirectUrl = `${process.env.APP_URL}/topup/callback?tx_ref=${transaction.id}`;

      const payment = await flw.initiatePayment({
        tx_ref: transaction.id,
        amount: amount + fee,
        currency,
        customer: {
          email: user?.email || "",
          name: `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim(),
        },
        redirect_url: redirectUrl,
        payment_options: paymentMethod === "card" ? "card" : "banktransfer",
      });

      res.status(201).json({
        transactionId: transaction.id,
        status: "INITIATED",
        amount,
        fee,
        paymentLink: payment.data.link,
      });
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /withdraw — Cash out to bank/mobile money ───
transferRouter.post(
  "/withdraw",
  requireKyc("TIER_1"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        amount: z.number().positive(),
        currency: z.string(),
        toCurrency: z.string(),
        rail: z.enum(["BANK_TRANSFER", "MOBILE_MONEY"]),
        bankCode: z.string().optional(),
        accountNumber: z.string().optional(),
        mobileNumber: z.string().optional(),
        mobileProvider: z.string().optional(),
        beneficiaryName: z.string(),
        countryCode: z.string(),
        pin: z.string().length(6),
      });

      const data = schema.parse(req.body);
      const userId = req.user!.id;

      // Verify PIN
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { pin: true } });
      if (!user?.pin || !(await bcrypt.compare(data.pin, user.pin))) {
        throw new AppError("Invalid PIN", 401, "INVALID_PIN");
      }

      // Check balance
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: { balances: { where: { currency: data.currency } } },
      });
      if (!wallet?.balances[0] || Number(wallet.balances[0].balance) < data.amount) {
        throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
      }

      // Select route
      const route = selectRoute({
        fromCurrency: data.currency,
        toCurrency: data.toCurrency,
        amount: data.amount,
        preferredRail: data.rail,
      });
      const fee = calculateFee(route, data.amount);

      // Get FX rate (resilient)
      let exchangeRate = 1;
      let toAmount = data.amount;
      if (data.currency !== data.toCurrency) {
        const fx = await getRate(data.currency, data.toCurrency, data.amount);
        exchangeRate = fx.exchangeRate;
        toAmount = fx.toAmount;
      }

      // Deduct and create transaction
      const transaction = await prisma.$transaction(async (tx) => {
        await tx.walletBalance.update({
          where: { walletId_currency: { walletId: wallet.id, currency: data.currency } },
          data: { balance: { decrement: data.amount + fee } },
        });

        return tx.transaction.create({
          data: {
            userId,
            type: "WITHDRAW",
            status: "PROCESSING",
            amount: data.amount,
            currency: data.currency,
            fee,
            feeCurrency: data.currency,
            toAmount,
            toCurrency: data.toCurrency,
            exchangeRate,
            rail: data.rail,
            provider: route.provider,
          },
        });
      });

      // Dispatch to provider
      if (route.provider === "nium") {
        const payout = await nium.createPayout({
          customerHashId: (wallet as any).niumCustomerHashId || "",
          walletHashId: (wallet as any).niumWalletHashId || "",
          amount: data.amount,
          sourceCurrency: data.currency,
          destinationCurrency: data.toCurrency,
          destinationCountry: data.countryCode,
          payoutMethod: "LOCAL",
          beneficiary: {
            name: data.beneficiaryName,
            accountNumber: data.accountNumber,
            bankCode: data.bankCode,
            mobileNumber: data.mobileNumber,
          },
          idempotencyKey: transaction.id,
        });
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { providerRef: payout.systemReferenceNumber },
        });
      } else if (route.provider === "flutterwave") {
        if (data.rail === "MOBILE_MONEY" && data.mobileNumber) {
          const transfer = await flw.createMobileMoneyTransfer({
            account_bank: data.mobileProvider === "M-Pesa" ? "MPS" : "MTN",
            account_number: data.mobileNumber,
            amount: toAmount,
            currency: data.toCurrency,
            narration: `GuildPay withdrawal`,
            reference: transaction.id,
            beneficiary_name: data.beneficiaryName,
          });
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { providerRef: String(transfer.data.id) },
          });
        } else {
          const transfer = await flw.createBankTransfer({
            account_bank: data.bankCode || "",
            account_number: data.accountNumber || "",
            amount: toAmount,
            currency: data.toCurrency,
            narration: `GuildPay withdrawal`,
            reference: transaction.id,
            beneficiary_name: data.beneficiaryName,
          });
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { providerRef: String(transfer.data.id) },
          });
        }
      }

      res.status(201).json({
        transactionId: transaction.id,
        status: "PROCESSING",
        provider: route.provider,
        amount: Number(transaction.amount),
        fee,
        toAmount,
        toCurrency: data.toCurrency,
        estimatedArrival: route.estimatedTime,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /exchange — Convert between currencies ───
transferRouter.post("/exchange", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      fromCurrency: z.string(),
      toCurrency: z.string(),
      amount: z.number().positive(),
      pin: z.string().length(6),
    });

    const { fromCurrency, toCurrency, amount, pin } = schema.parse(req.body);
    const userId = req.user!.id;

    if (fromCurrency === toCurrency) {
      throw new AppError("Cannot convert to same currency", 400, "SAME_CURRENCY");
    }

    // Verify PIN
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pin: true } });
    if (!user?.pin || !(await bcrypt.compare(pin, user.pin))) {
      throw new AppError("Invalid PIN", 401, "INVALID_PIN");
    }

    // Get FX rate (resilient) with locked quoteId
    const fx = await getRate(fromCurrency, toCurrency, amount);
    const exchangeRate = fx.exchangeRate;
    const toAmount = fx.toAmount;

    // Execute FX conversion on Nium if quoteId available (locks the rate)
    if (fx.quoteId && fx.provider === "nium") {
      try {
        const walletForFx = await prisma.wallet.findUnique({ where: { userId } });
        await nium.executeFxConversion({
          customerHashId: (walletForFx as any)?.niumCustomerHashId || "",
          walletHashId: (walletForFx as any)?.niumWalletHashId || "",
          quoteId: fx.quoteId,
          sourceCurrency: fromCurrency,
          destinationCurrency: toCurrency,
          sourceAmount: amount,
        });
        console.log(`[EXCHANGE] Nium FX conversion executed with quoteId: ${fx.quoteId}`);
      } catch (fxErr: any) {
        console.warn(`[EXCHANGE] Nium FX conversion failed: ${fxErr.message}, proceeding with quoted rate`);
      }
    }

    const fee = Math.round(amount * 0.005 * 100) / 100;

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { balances: true },
    });
    if (!wallet) throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");

    const fromBalance = wallet.balances.find((b) => b.currency === fromCurrency);
    if (!fromBalance || Number(fromBalance.balance) < amount + fee) {
      throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
    }

    let toBalance = wallet.balances.find((b) => b.currency === toCurrency);

    const transaction = await prisma.$transaction(async (tx) => {
      await tx.walletBalance.update({
        where: { walletId_currency: { walletId: wallet.id, currency: fromCurrency } },
        data: { balance: { decrement: amount + fee } },
      });

      if (toBalance) {
        await tx.walletBalance.update({
          where: { walletId_currency: { walletId: wallet.id, currency: toCurrency } },
          data: { balance: { increment: toAmount } },
        });
      } else {
        await tx.walletBalance.create({
          data: { walletId: wallet.id, currency: toCurrency, balance: toAmount },
        });
      }

      return tx.transaction.create({
        data: {
          userId,
          type: "EXCHANGE",
          status: "COMPLETED",
          amount,
          currency: fromCurrency,
          fee,
          feeCurrency: fromCurrency,
          toAmount,
          toCurrency,
          exchangeRate,
          rail: "INTERNAL",
          provider: fx.provider,
          completedAt: new Date(),
        },
      });
    });

    res.status(201).json({
      transactionId: transaction.id,
      status: "COMPLETED",
      provider: fx.provider,
      from: { amount, currency: fromCurrency },
      to: { amount: toAmount, currency: toCurrency },
      exchangeRate,
      fee,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /corridors — List available payment corridors ───
transferRouter.get("/corridors", (_req: AuthRequest, res: Response) => {
  const corridors = getAvailableCorridors();
  res.json({ corridors });
});

// ─── GET /corridors/:from/:to — Get routes for a corridor ───
transferRouter.get("/corridors/:from/:to", (req: AuthRequest, res: Response) => {
  const routes = getCorridorRoutes(req.params.from, req.params.to);
  res.json({ routes });
});

// ─── GET /fx/quote — Get FX quote ───
transferRouter.get("/fx/quote", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { from, to, amount } = z.object({
      from: z.string(),
      to: z.string(),
      amount: z.coerce.number().positive(),
    }).parse(req.query);

    const fx = await getRate(from, to, amount);

    res.json({
      provider: fx.provider,
      from: { currency: from, amount },
      to: { currency: to, amount: fx.toAmount },
      exchangeRate: fx.exchangeRate,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/track — Track transfer status ───
transferRouter.get("/:id/track", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { tracking: { orderBy: { timestamp: "asc" } } },
    });

    if (!transaction) {
      throw new AppError("Transaction not found", 404, "TXN_NOT_FOUND");
    }

    res.json({
      transactionId: transaction.id,
      type: transaction.type,
      status: transaction.status,
      provider: transaction.provider,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      fee: Number(transaction.fee),
      toAmount: transaction.toAmount ? Number(transaction.toAmount) : null,
      toCurrency: transaction.toCurrency,
      exchangeRate: transaction.exchangeRate ? Number(transaction.exchangeRate) : null,
      tracking: transaction.tracking.map((t) => ({
        status: t.status,
        message: t.message,
        timestamp: t.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /receive/link — Generate payment link ───
transferRouter.post("/receive/link", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      amount: z.number().positive().optional(),
      currency: z.string().optional(),
      note: z.string().max(200).optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.id;

    const { nanoid } = await import("nanoid");
    const slug = nanoid(10);

    const link = await prisma.paymentLink.create({
      data: {
        userId,
        slug,
        amount: data.amount,
        currency: data.currency,
        note: data.note,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.APP_URL || "https://pay.guildpay.com";

    res.status(201).json({
      linkId: link.id,
      slug: link.slug,
      url: `${baseUrl}/${slug}`,
      amount: link.amount ? Number(link.amount) : null,
      currency: link.currency,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /refund — Refund a completed transaction ───
transferRouter.post(
  "/refund",
  requireKyc("TIER_1"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        transactionId: z.string(),
        amount: z.number().positive().optional(), // partial refund
        reason: z.string().max(200).optional(),
        pin: z.string().length(6),
      });

      const { transactionId, amount: refundAmount, reason, pin } = schema.parse(req.body);
      const userId = req.user!.id;

      // Verify PIN
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { pin: true } });
      if (!user?.pin || !(await bcrypt.compare(pin, user.pin))) {
        throw new AppError("Invalid PIN", 401, "INVALID_PIN");
      }

      // Find the transaction
      const transaction = await prisma.transaction.findFirst({
        where: { id: transactionId, userId },
      });
      if (!transaction) {
        throw new AppError("Transaction not found", 404, "TXN_NOT_FOUND");
      }
      if (transaction.status !== "COMPLETED") {
        throw new AppError("Only completed transactions can be refunded", 400, "NOT_REFUNDABLE");
      }
      if (!["TOPUP", "BILL_PAYMENT"].includes(transaction.type)) {
        throw new AppError("This transaction type cannot be refunded", 400, "NOT_REFUNDABLE_TYPE");
      }

      const amountToRefund = refundAmount || Number(transaction.amount);

      // Attempt refund via provider
      let providerRefundRef: string | null = null;
      if (transaction.provider === "flutterwave" && transaction.providerRef) {
        try {
          const refund = await flw.refundTransaction(
            parseInt(transaction.providerRef),
            refundAmount
          );
          providerRefundRef = refund.data.flw_ref;
        } catch (providerErr: any) {
          if (!isDemoMode()) {
            throw new AppError(`Refund failed: ${providerErr.message}`, 502, "REFUND_PROVIDER_ERROR");
          }
          console.log(`[REFUND] Demo mode — provider refund failed: ${providerErr.message}`);
          providerRefundRef = `sandbox_refund_${Date.now()}`;
        }
      } else {
        if (!isDemoMode()) {
          throw new AppError("Refunds are only available for Flutterwave transactions", 400, "REFUND_NOT_SUPPORTED");
        }
        providerRefundRef = `sandbox_refund_${Date.now()}`;
      }

      // Credit wallet and record refund transaction
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: { balances: { where: { currency: transaction.currency } } },
      });

      if (!wallet?.balances[0]) {
        throw new AppError("Wallet balance not found", 404, "BALANCE_NOT_FOUND");
      }

      const refundTxn = await prisma.$transaction(async (tx) => {
        await tx.walletBalance.update({
          where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
          data: { balance: { increment: amountToRefund } },
        });

        return tx.transaction.create({
          data: {
            userId,
            type: "TOPUP", // Refund credited as top-up
            status: "COMPLETED",
            amount: amountToRefund,
            currency: transaction.currency,
            provider: transaction.provider,
            providerRef: providerRefundRef,
            rail: "INTERNAL",
            completedAt: new Date(),
            note: `Refund for ${transaction.id}${reason ? ': ' + reason : ''}`,
          },
        });
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: "TRANSACTION",
          title: "Refund Processed",
          body: `${transaction.currency} ${amountToRefund.toFixed(2)} has been refunded to your wallet.`,
          data: { transactionId: refundTxn.id },
        },
      });

      res.status(201).json({
        refundId: refundTxn.id,
        originalTransactionId: transactionId,
        amount: amountToRefund,
        currency: transaction.currency,
        status: "COMPLETED",
        providerRef: providerRefundRef,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /sub-accounts — Create agent/partner sub-account for commission splits ───
transferRouter.post(
  "/sub-accounts",
  requireKyc("TIER_1"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        accountBank: z.string(),
        accountNumber: z.string(),
        businessName: z.string(),
        businessEmail: z.string().email(),
        country: z.string().length(2),
        splitType: z.enum(["flat", "percentage"]).default("percentage"),
        splitValue: z.number().positive(),
      });

      const data = schema.parse(req.body);

      let subAccount;
      try {
        subAccount = await flw.createSubAccount({
          account_bank: data.accountBank,
          account_number: data.accountNumber,
          business_name: data.businessName,
          split_type: data.splitType,
          split_value: data.splitValue,
          business_email: data.businessEmail,
          country: data.country,
        });
      } catch (providerErr: any) {
        if (!isDemoMode()) {
          throw new AppError(`Sub-account creation failed: ${providerErr.message}`, 502, "SUBACCOUNT_PROVIDER_ERROR");
        }
        console.log(`[SUBACCOUNT] Demo mode — creation failed: ${providerErr.message}`);
        subAccount = { data: { id: Date.now(), subaccount_id: `sandbox_sub_${Date.now()}` } };
      }

      res.status(201).json({
        subAccountId: subAccount.data.subaccount_id,
        providerId: subAccount.data.id,
        businessName: data.businessName,
        splitType: data.splitType,
        splitValue: data.splitValue,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /verify-account — Pre-validate recipient bank account ───
transferRouter.post("/verify-account", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      accountNumber: z.string(),
      bankCode: z.string(),
      countryCode: z.string(),
      provider: z.enum(["nium", "flutterwave"]).optional(),
    });

    const { accountNumber, bankCode, countryCode, provider } = schema.parse(req.body);

    // Use Flutterwave for Nigerian accounts (better coverage), Nium for others
    const useFlw = provider === "flutterwave" || countryCode === "NG";

    if (useFlw) {
      const result = await flw.resolveAccount({ account_number: accountNumber, account_bank: bankCode });
      res.json({
        provider: "flutterwave",
        valid: true,
        accountName: result.data.account_name,
        accountNumber: result.data.account_number,
      });
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
      const result = await nium.verifyAccount({
        customerHashId: (wallet as any)?.niumCustomerHashId || "",
        destinationCountry: countryCode,
        payoutMethod: "LOCAL",
        bankCode,
        accountNumber,
      });
      res.json({
        provider: "nium",
        valid: result.status === "valid",
        accountName: result.accountName,
        bankName: result.bankName,
      });
    }
  } catch (err) {
    next(err);
  }
});
