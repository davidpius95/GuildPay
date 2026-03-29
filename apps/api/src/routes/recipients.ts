import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as flw from "../services/flutterwave";
import { isDemoMode } from "../config/providers";

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

// GET /banks/:country — List supported banks for a country
recipientRouter.get("/banks/:country", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const country = (req.params.country as string).toUpperCase();
    let banks;
    try {
      const result = await flw.getBanks(country);
      banks = result.data.map((b: any) => ({ code: b.code, name: b.name }));
    } catch (e) {
      if (!isDemoMode()) {
        throw new AppError("Bank list unavailable. Please try again later.", 502, "BANKS_PROVIDER_ERROR");
      }
      console.log(`[RECIPIENTS] Demo mode — bank list fallback for ${country}`);
      // Fallback bank list for common countries
      const fallbacks: Record<string, Array<{code:string,name:string}>> = {
        NG: [{code:"044",name:"Access Bank"},{code:"023",name:"Citibank Nigeria"},{code:"063",name:"Diamond Bank"},{code:"050",name:"Ecobank"},{code:"084",name:"Enterprise Bank"},{code:"070",name:"Fidelity Bank"},{code:"011",name:"First Bank"},{code:"214",name:"FCMB"},{code:"058",name:"GTBank"},{code:"030",name:"Heritage Bank"},{code:"301",name:"Jaiz Bank"},{code:"082",name:"Keystone Bank"},{code:"076",name:"Polaris Bank"},{code:"039",name:"Stanbic IBTC"},{code:"232",name:"Sterling Bank"},{code:"032",name:"Union Bank"},{code:"033",name:"UBA"},{code:"215",name:"Unity Bank"},{code:"035",name:"Wema Bank"},{code:"057",name:"Zenith Bank"}],
        GH: [{code:"GCB",name:"GCB Bank"},{code:"ABSA",name:"Absa Bank Ghana"},{code:"ECO",name:"Ecobank Ghana"},{code:"FBN",name:"FBN Bank Ghana"},{code:"SCB",name:"Standard Chartered"},{code:"SBG",name:"Stanbic Bank Ghana"}],
        KE: [{code:"01",name:"Kenya Commercial Bank"},{code:"02",name:"Standard Chartered"},{code:"03",name:"Barclays Bank"},{code:"10",name:"Prime Bank"},{code:"11",name:"Co-operative Bank"},{code:"12",name:"National Bank of Kenya"},{code:"68",name:"Equity Bank"}],
      };
      banks = fallbacks[country] || [];
    }
    res.json({ country, banks });
  } catch (err) { next(err); }
});
