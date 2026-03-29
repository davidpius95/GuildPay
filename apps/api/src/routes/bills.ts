import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as flw from "../services/flutterwave";

export const billRouter = Router();

// ─── POST /pay — Pay a bill (airtime, data, electricity, TV, internet) ───
billRouter.post("/pay", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      type: z.enum(["AIRTIME", "DATA", "ELECTRICITY", "TV_CABLE", "INTERNET", "EDUCATION"]),
      billerCode: z.string(),
      customer: z.string(), // phone number, meter number, smartcard ID
      amount: z.number().positive(),
      currency: z.string().default("NGN"),
      country: z.string().default("NG"),
      itemCode: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.id;

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { balances: { where: { currency: data.currency } } },
    });
    if (!wallet?.balances[0] || Number(wallet.balances[0].balance) < data.amount) {
      throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
    }

    // Create bill record
    const bill = await prisma.billPayment.create({
      data: {
        userId,
        type: data.type,
        provider: data.billerCode,
        recipientId: data.customer,
        amount: data.amount,
        currency: data.currency,
        status: "pending",
      },
    });

    // Pay via Flutterwave
    const payment = await flw.payBill({
      country: data.country,
      customer: data.customer,
      amount: data.amount,
      type: data.billerCode,
      reference: bill.id,
      recurrence: "ONCE",
    });

    // Deduct from wallet and update bill status
    await prisma.$transaction([
      prisma.walletBalance.update({
        where: { walletId_currency: { walletId: wallet.id, currency: data.currency } },
        data: { balance: { decrement: data.amount } },
      }),
      prisma.billPayment.update({
        where: { id: bill.id },
        data: {
          status: "completed",
          providerRef: payment.data.flw_ref || payment.data.reference,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: "BILL_PAYMENT",
          status: "COMPLETED",
          amount: data.amount,
          currency: data.currency,
          provider: "flutterwave",
          providerRef: payment.data.flw_ref || payment.data.reference,
          rail: "INTERNAL",
          completedAt: new Date(),
          note: `${data.type} payment to ${data.customer}`,
        },
      }),
    ]);

    res.status(201).json({
      billId: bill.id,
      status: "completed",
      type: data.type,
      customer: data.customer,
      amount: data.amount,
      currency: data.currency,
      providerRef: payment.data.flw_ref || payment.data.reference,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /airtime — Quick airtime purchase ───
billRouter.post("/airtime", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      provider: z.string(), // MTN, AIRTEL, GLO, 9MOBILE
      phoneNumber: z.string(),
      amount: z.number().positive(),
      currency: z.string().default("NGN"),
      country: z.string().default("NG"),
    });
    const data = schema.parse(req.body);
    const userId = req.user!.id;

    // Check balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { balances: { where: { currency: data.currency } } },
    });
    if (!wallet?.balances[0] || Number(wallet.balances[0].balance) < data.amount) {
      throw new AppError("Insufficient balance", 400, "INSUFFICIENT_FUNDS");
    }

    // Pay via Flutterwave
    const payment = await flw.payBill({
      country: data.country,
      customer: data.phoneNumber,
      amount: data.amount,
      type: "AIRTIME",
      reference: `airtime_${Date.now()}`,
      biller_name: data.provider,
    });

    // Deduct and record
    const bill = await prisma.$transaction(async (tx) => {
      await tx.walletBalance.update({
        where: { walletId_currency: { walletId: wallet.id, currency: data.currency } },
        data: { balance: { decrement: data.amount } },
      });

      const b = await tx.billPayment.create({
        data: {
          userId,
          type: "AIRTIME",
          provider: data.provider,
          recipientId: data.phoneNumber,
          amount: data.amount,
          currency: data.currency,
          status: "completed",
          providerRef: payment.data.flw_ref || payment.data.reference,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "BILL_PAYMENT",
          status: "COMPLETED",
          amount: data.amount,
          currency: data.currency,
          provider: "flutterwave",
          providerRef: payment.data.flw_ref,
          rail: "INTERNAL",
          completedAt: new Date(),
          note: `Airtime ${data.provider} to ${data.phoneNumber}`,
        },
      });

      return b;
    });

    res.status(201).json({
      billId: bill.id,
      status: "completed",
      provider: data.provider,
      phoneNumber: data.phoneNumber,
      amount: data.amount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /categories — Get available bill categories ───
billRouter.get("/categories", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await flw.getBillCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// ─── POST /validate — Validate a bill customer ───
billRouter.post("/validate", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { itemCode, customer, billerCode } = z.object({
      itemCode: z.string(),
      customer: z.string(),
      billerCode: z.string(),
    }).parse(req.body);

    const result = await flw.validateBillCustomer({
      item_code: itemCode,
      customer,
      code: billerCode,
    });

    res.json({
      valid: result.data.response_code === "00",
      name: result.data.name,
      address: result.data.address,
      message: result.data.response_message,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /providers — List bill payment providers ───
billRouter.get("/providers", async (_req: AuthRequest, res: Response) => {
  res.json({
    airtime: [
      { id: "MTN", name: "MTN", countries: ["NG", "GH", "UG", "RW", "CM"] },
      { id: "AIRTEL", name: "Airtel", countries: ["NG", "KE", "UG", "TZ"] },
      { id: "GLO", name: "Glo", countries: ["NG", "GH"] },
      { id: "9MOBILE", name: "9mobile", countries: ["NG"] },
      { id: "SAFARICOM", name: "Safaricom", countries: ["KE"] },
    ],
    data: [
      { id: "MTN_DATA", name: "MTN Data", countries: ["NG", "GH"] },
      { id: "AIRTEL_DATA", name: "Airtel Data", countries: ["NG", "KE"] },
    ],
    electricity: [
      { id: "EKO-ELECTRIC", name: "Eko Electric (EKEDP)", countries: ["NG"] },
      { id: "IKEJA-ELECTRIC", name: "Ikeja Electric", countries: ["NG"] },
    ],
    cable: [
      { id: "DSTV", name: "DSTV", countries: ["NG", "GH", "KE"] },
      { id: "GOTV", name: "GoTV", countries: ["NG", "GH", "KE"] },
      { id: "STARTIMES", name: "StarTimes", countries: ["NG"] },
    ],
  });
});
