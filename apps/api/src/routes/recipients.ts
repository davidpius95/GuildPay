import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/error";

export const recipientRouter = Router();

// GET / — List all recipients
recipientRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const recipients = await prisma.recipient.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isFavorite: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
    });
    res.json(recipients);
  } catch (err) { next(err); }
});

// POST / — Add new recipient
recipientRouter.post("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      country: z.string(),
      countryCode: z.string().length(2),
      bankName: z.string().optional(),
      bankCode: z.string().optional(),
      accountNumber: z.string().optional(),
      mobileNumber: z.string().optional(),
      mobileProvider: z.string().optional(),
      walletAddress: z.string().optional(),
      email: z.string().email().optional(),
    });
    const data = schema.parse(req.body);

    // Must have at least one destination
    if (!data.accountNumber && !data.mobileNumber && !data.walletAddress) {
      throw new AppError("Recipient must have a bank account, mobile number, or wallet address", 400, "MISSING_DESTINATION");
    }

    const recipient = await prisma.recipient.create({
      data: { userId: req.user!.id, ...data },
    });
    res.status(201).json(recipient);
  } catch (err) { next(err); }
});

// PUT /:id — Update recipient
recipientRouter.put("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      bankName: z.string().optional(),
      bankCode: z.string().optional(),
      accountNumber: z.string().optional(),
      mobileNumber: z.string().optional(),
      mobileProvider: z.string().optional(),
      walletAddress: z.string().optional(),
      email: z.string().email().optional(),
      isFavorite: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await prisma.recipient.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError("Recipient not found", 404, "RECIPIENT_NOT_FOUND");
    }

    const updated = await prisma.recipient.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// PUT /:id/favorite — Toggle favorite
recipientRouter.put("/:id/favorite", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.recipient.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError("Recipient not found", 404, "RECIPIENT_NOT_FOUND");
    }

    await prisma.recipient.update({
      where: { id: req.params.id },
      data: { isFavorite: !existing.isFavorite },
    });
    res.json({ isFavorite: !existing.isFavorite });
  } catch (err) { next(err); }
});

// DELETE /:id — Delete recipient
recipientRouter.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.recipient.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) {
      throw new AppError("Recipient not found", 404, "RECIPIENT_NOT_FOUND");
    }
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
