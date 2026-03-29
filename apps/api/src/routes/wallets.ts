import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as nium from "../services/nium";

export const walletRouter = Router();

// ─── GET / — List wallet balances ───
walletRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
      include: {
        balances: {
          orderBy: { currency: "asc" },
        },
      },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    // Sync balances from Nium if customer is onboarded (non-sandbox)
    if ((wallet as any).niumCustomerHashId && !(wallet as any).niumCustomerHashId?.startsWith("sandbox_")) {
      try {
        const niumBalances = await nium.getWalletBalances({
          customerHashId: (wallet as any).niumCustomerHashId,
          walletHashId: (wallet as any).niumWalletHashId,
        });
        console.log(`[WALLET] Synced ${niumBalances.length} balances from Nium`);
      } catch (e) {
        // Non-blocking — proceed with DB balances
        console.warn(`[WALLET] Nium balance sync failed: ${(e as Error).message}`);
      }
    }

    // Calculate total balance in USD
    const rates = await prisma.exchangeRate.findMany({
      where: { toCurrency: "USD" },
    });
    const rateMap = new Map(rates.map((r) => [r.fromCurrency, Number(r.rate)]));
    rateMap.set("USD", 1);
    rateMap.set("USDT", 1);
    rateMap.set("USDC", 1);

    let totalUsd = 0;
    const balances = wallet.balances.map((b) => {
      const usdRate = rateMap.get(b.currency) || 0;
      const usdValue = Number(b.balance) * usdRate;
      totalUsd += usdValue;
      return {
        currency: b.currency,
        balance: Number(b.balance),
        locked: Number(b.locked),
        available: Number(b.balance) - Number(b.locked),
        usdValue,
      };
    });

    res.json({
      walletId: wallet.id,
      status: wallet.status,
      totalBalanceUsd: Math.round(totalUsd * 100) / 100,
      balances,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /currencies — Add a new currency ───
walletRouter.post("/currencies", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currency } = z.object({
      currency: z.enum(["USD", "NGN", "GBP", "EUR", "KES", "GHS", "ZAR", "AED", "SAR", "QAR", "USDT", "USDC"]),
    }).parse(req.body);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.id },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    // Check if currency already exists
    const existing = await prisma.walletBalance.findUnique({
      where: { walletId_currency: { walletId: wallet.id, currency } },
    });

    if (existing) {
      throw new AppError("Currency already added", 409, "CURRENCY_EXISTS");
    }

    const balance = await prisma.walletBalance.create({
      data: {
        walletId: wallet.id,
        currency,
        balance: 0,
      },
    });

    res.status(201).json({
      currency: balance.currency,
      balance: Number(balance.balance),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /statement — Transaction history for wallet ───
walletRouter.get("/statement", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currency, type, from, to, page, limit } = z.object({
      currency: z.string().optional(),
      type: z.string().optional(), // SEND, TOPUP, RECEIVE, WITHDRAW, EXCHANGE, BILL_PAYMENT, CARD_FUND
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    }).parse(req.query);

    const where: any = { userId: req.user!.id };
    if (currency) where.currency = currency;
    if (type) {
      // Support comma-separated types for grouped filters
      const types = type.split(",").map((t: string) => t.trim());
      where.type = types.length === 1 ? types[0] : { in: types };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          fee: true,
          toAmount: true,
          toCurrency: true,
          note: true,
          provider: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        fee: Number(t.fee),
        toAmount: t.toAmount ? Number(t.toAmount) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});
