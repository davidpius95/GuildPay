import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/error";
import * as nium from "../services/nium";
import { isDemoMode } from "../config/providers";

export const userRouter = Router();

// GET /me - Get current user profile
userRouter.get("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        emailVerified: true, phoneVerified: true, referralCode: true, createdAt: true,
        profile: true,
      },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// PUT /me - Update profile
userRouter.put("/me", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      country: z.string().optional(),
      state: z.string().optional(),
      avatarUrl: z.string().url().optional(),
    });
    const data = schema.parse(req.body);
    const profile = await prisma.userProfile.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, firstName: data.firstName || "", lastName: data.lastName || "", country: data.country || "", ...data },
    });
    res.json(profile);
  } catch (err) { next(err); }
});

// POST /me/pin — Set or update transaction PIN
userRouter.post("/me/pin", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pin, currentPin } = z.object({
      pin: z.string().length(6).regex(/^\d+$/, "PIN must be 6 digits"),
      currentPin: z.string().length(6).optional(),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { pin: true },
    });

    // If PIN already set, require current PIN to change
    if (user?.pin) {
      if (!currentPin) {
        throw new AppError("Current PIN required to change PIN", 400, "CURRENT_PIN_REQUIRED");
      }
      const valid = await bcrypt.compare(currentPin, user.pin);
      if (!valid) {
        throw new AppError("Current PIN is incorrect", 401, "INVALID_PIN");
      }
    }

    const hashedPin = await bcrypt.hash(pin, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pin: hashedPin },
    });

    res.json({ message: "PIN set successfully" });
  } catch (err) { next(err); }
});

// POST /me/kyc — Submit KYC via Nium
userRouter.post("/me/kyc", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string(), // YYYY-MM-DD
      nationality: z.string(), // ISO 2-letter
      mobile: z.string(),
      address: z.object({
        line1: z.string(),
        city: z.string(),
        state: z.string().optional(),
        postcode: z.string(),
        country: z.string(),
      }),
      identityDocument: z.object({
        type: z.enum(["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]),
        number: z.string(),
        issuingCountry: z.string(),
        expiryDate: z.string(),
      }).optional(),
      // Legacy: direct document upload (stored locally, not via Nium)
      frontUrl: z.string().url().optional(),
      backUrl: z.string().url().optional(),
      selfieUrl: z.string().url().optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Onboard customer with Nium (sandbox fallback)
    let customer: any;
    try {
      customer = await nium.onboardCustomer({
        email: user!.email,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        countryCode: data.address.country,
        nationality: data.nationality,
        mobile: data.mobile,
        address: data.address,
        identityDocument: data.identityDocument ? {
          type: data.identityDocument.type,
          number: data.identityDocument.number,
          issuingCountry: data.identityDocument.issuingCountry,
          expiryDate: data.identityDocument.expiryDate,
        } : undefined,
      });
    } catch (providerErr) {
      if (!isDemoMode()) {
        throw new AppError("KYC provider unavailable. Please try again later.", 502, "KYC_PROVIDER_ERROR");
      }
      console.log(`[KYC] Nium onboarding failed, using demo fallback:`, (providerErr as Error).message);
      customer = { customerHashId: `sandbox_cust_${Date.now()}`, walletHashId: `sandbox_wallet_${Date.now()}` };
    }

    // Update profile with Nium customer/wallet IDs
    await prisma.userProfile.upsert({
      where: { userId },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        country: data.address.country,
        address: data.address.line1,
        city: data.address.city,
        postalCode: data.address.postcode,
        kycTier: "TIER_1", // Pending full verification
      },
      create: {
        userId,
        firstName: data.firstName,
        lastName: data.lastName,
        country: data.address.country,
        address: data.address.line1,
        city: data.address.city,
        postalCode: data.address.postcode,
        kycTier: "TIER_1",
      },
    });

    // Store document record if provided
    if (data.identityDocument) {
      await prisma.kycDocument.create({
        data: {
          userId,
          type: data.identityDocument.type as any,
          frontUrl: data.frontUrl || `nium://doc/${customer.customerHashId}`,
          backUrl: data.backUrl,
          selfieUrl: data.selfieUrl,
          status: "UNDER_REVIEW",
        },
      });
    }

    res.status(201).json({
      status: "submitted",
      niumCustomerId: customer.customerHashId,
      niumWalletId: customer.walletHashId,
      message: "KYC submitted for verification. You will be notified when approved.",
    });
  } catch (err) {
    next(err);
  }
});

// GET /me/kyc/status
userRouter.get("/me/kyc/status", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [profile, docs] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: req.user!.id } }),
      prisma.kycDocument.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } }),
    ]);

    let niumStatus = null;

    // Poll Nium for live KYC status if customer was onboarded
    if ((profile as any)?.niumCustomerHashId && !(profile as any).niumCustomerHashId.startsWith("sandbox_")) {
      try {
        const status = await nium.getCustomerStatus((profile as any).niumCustomerHashId);
        niumStatus = { complianceStatus: status.complianceStatus, kycStatus: status.kycStatus };

        // Auto-upgrade tier based on Nium compliance status
        if (status.complianceStatus === "COMPLETED" && profile?.kycTier !== "TIER_2") {
          await prisma.userProfile.update({
            where: { userId: req.user!.id },
            data: { kycTier: "TIER_2" },
          });
          if (profile) profile.kycTier = "TIER_2";
        }
      } catch (e) {
        console.warn(`[KYC] Nium status poll failed: ${(e as Error).message}`);
      }
    }

    res.json({ tier: profile?.kycTier || "TIER_0", documents: docs, niumStatus });
  } catch (err) { next(err); }
});
