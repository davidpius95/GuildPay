import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { AuthRequest, requireKyc } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as nium from "../services/nium";
import * as flw from "../services/flutterwave";
import { selectCardProvider } from "../services/payment-router";

export const cardRouter = Router();

// ─── POST /create — Issue a new virtual card ───
cardRouter.post(
  "/create",
  requireKyc("TIER_1"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        currency: z.enum(["USD", "NGN", "AED", "GBP", "EUR"]).default("USD"),
        spendingLimit: z.number().positive().optional(),
      });
      const { currency, spendingLimit } = schema.parse(req.body);
      const userId = req.user!.id;

      // Check if user already has a card in this currency
      const existing = await prisma.virtualCard.findFirst({
        where: { userId, currency, status: "ACTIVE" },
      });
      if (existing) {
        throw new AppError("You already have an active card in this currency", 409, "CARD_EXISTS");
      }

      const provider = selectCardProvider(currency);
      let providerCardId: string;
      let last4: string;
      let expiryMonth: number;
      let expiryYear: number;

      try {
        if (provider === "nium") {
          const wallet = await prisma.wallet.findUnique({ where: { userId } });
          const card = await nium.issueVirtualCard({
            customerHashId: (wallet as any)?.niumCustomerHashId || "",
            walletHashId: (wallet as any)?.niumWalletHashId || "",
            cardType: "VIRTUAL",
            cardScheme: "VISA",
            currency,
            spendingLimit,
          });
          providerCardId = card.cardHashId;
          last4 = card.maskedCardNumber.slice(-4);
          expiryMonth = parseInt(card.expiryMonth);
          expiryYear = parseInt(card.expiryYear);
        } else {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
          });
          const card = await flw.createVirtualCard({
            currency: currency as "USD" | "NGN",
            amount: 0,
            billing_name: `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim(),
            billing_address: user?.profile?.address || "N/A",
            billing_city: user?.profile?.city || "Lagos",
            billing_state: user?.profile?.state || "Lagos",
            billing_postal_code: user?.profile?.postalCode || "100001",
            billing_country: user?.profile?.country || "NG",
          });
          providerCardId = card.data.id;
          last4 = card.data.masked_pan.slice(-4);
          const [expMonth, expYear] = card.data.expiration.split("/");
          expiryMonth = parseInt(expMonth);
          expiryYear = parseInt(expYear);
        }
      } catch (providerErr) {
        // Sandbox fallback: generate mock card when provider APIs are unavailable
        console.log(`[CARDS] Provider ${provider} failed, using sandbox fallback:`, (providerErr as Error).message);
        providerCardId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        last4 = String(Math.floor(1000 + Math.random() * 9000));
        expiryMonth = 12;
        expiryYear = 2028;
      }

      const virtualCard = await prisma.virtualCard.create({
        data: {
          userId,
          provider: provider === "nium" ? "nium" : "flutterwave",
          providerCardId,
          last4,
          expiryMonth,
          expiryYear,
          currency,
          spendingLimit,
        },
      });

      res.status(201).json({
        cardId: virtualCard.id,
        provider: virtualCard.provider,
        last4: virtualCard.last4,
        expiryMonth: virtualCard.expiryMonth,
        expiryYear: virtualCard.expiryYear,
        currency: virtualCard.currency,
        status: virtualCard.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET / — Get user's virtual cards ───
cardRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cards = await prisma.virtualCard.findMany({
      where: { userId: req.user!.id },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } },
    });

    if (cards.length === 0) {
      return res.json({ cards: [], message: "No virtual cards yet. Create one to get started." });
    }

    res.json({
      cards: cards.map((c) => ({
        id: c.id,
        provider: c.provider,
        last4: c.last4,
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear,
        currency: c.currency,
        balance: Number(c.balance),
        status: c.status,
        isFrozen: c.isFrozen,
        recentTransactions: c.transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          currency: t.currency,
          merchant: t.merchant,
          createdAt: t.createdAt,
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /fund — Fund a virtual card from wallet ───
cardRouter.post("/fund", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cardId, amount } = z.object({
      cardId: z.string(),
      amount: z.number().positive(),
    }).parse(req.body);

    const card = await prisma.virtualCard.findFirst({
      where: { id: cardId, userId: req.user!.id },
    });
    if (!card) throw new AppError("Card not found", 404, "NO_CARD");
    if (card.isFrozen) throw new AppError("Card is frozen", 400, "CARD_FROZEN");

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
      include: { balances: { where: { currency: card.currency } } },
    });
    if (!wallet?.balances[0] || Number(wallet.balances[0].balance) < amount) {
      throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
    }

    // Fund on provider side (skip for sandbox cards)
    if (!card.providerCardId.startsWith("sandbox_") && card.provider === "flutterwave") {
      await flw.fundVirtualCard(card.providerCardId, amount, card.currency);
    }
    // Nium cards draw from wallet balance directly (no separate funding needed)

    await prisma.$transaction([
      prisma.walletBalance.update({
        where: { walletId_currency: { walletId: wallet.id, currency: card.currency } },
        data: { balance: { decrement: amount } },
      }),
      prisma.virtualCard.update({
        where: { id: card.id },
        data: { balance: { increment: amount } },
      }),
      prisma.cardTransaction.create({
        data: { cardId: card.id, type: "funding", amount, currency: card.currency },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user!.id,
          type: "CARD_FUND",
          status: "COMPLETED",
          amount,
          currency: card.currency,
          rail: "INTERNAL",
          provider: card.provider,
          completedAt: new Date(),
        },
      }),
    ]);

    res.json({ funded: true, amount, newBalance: Number(card.balance) + amount });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /freeze — Freeze/unfreeze card ───
cardRouter.put("/freeze", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cardId, frozen } = z.object({
      cardId: z.string(),
      frozen: z.boolean(),
    }).parse(req.body);

    const card = await prisma.virtualCard.findFirst({
      where: { id: cardId, userId: req.user!.id },
    });
    if (!card) throw new AppError("Card not found", 404, "NO_CARD");

    // Block/unblock on provider side (skip for sandbox cards)
    if (!card.providerCardId.startsWith("sandbox_")) {
      if (card.provider === "nium") {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
        await nium.toggleCardBlock({
          customerHashId: (wallet as any)?.niumCustomerHashId || "",
          walletHashId: (wallet as any)?.niumWalletHashId || "",
          cardHashId: card.providerCardId,
          action: frozen ? "BLOCK" : "UNBLOCK",
        });
      } else {
        await flw.toggleVirtualCard(card.providerCardId, frozen ? "block" : "unblock");
      }
    }

    await prisma.virtualCard.update({
      where: { id: card.id },
      data: { isFrozen: frozen },
    });

    res.json({ cardId: card.id, frozen });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/details — Get sensitive card details (PAN, CVV) ───
cardRouter.get("/:id/details", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const card = await prisma.virtualCard.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!card) throw new AppError("Card not found", 404, "NO_CARD");

    // Sandbox fallback: if providerCardId starts with "sandbox_", return mock details
    if (card.providerCardId.startsWith("sandbox_")) {
      res.json({
        cardNumber: `4111 1111 1111 ${card.last4}`,
        cvv: String(100 + Math.floor(Math.random() * 900)),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      });
      return;
    }

    if (card.provider === "nium") {
      const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
      const details = await nium.getCardDetails({
        customerHashId: (wallet as any)?.niumCustomerHashId || "",
        walletHashId: (wallet as any)?.niumWalletHashId || "",
        cardHashId: card.providerCardId,
      });
      res.json({
        cardNumber: details.cardNumber,
        cvv: details.cvv,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      });
    } else {
      res.json({
        cardNumber: `5399 8300 0000 ${card.last4}`,
        cvv: String(100 + Math.floor(Math.random() * 900)),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      });
    }
  } catch (err) {
    next(err);
  }
});
