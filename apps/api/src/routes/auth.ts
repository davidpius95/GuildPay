import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../config/db";
import { generateTokens, AuthRequest, authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error";

export const authRouter = Router();

// ─── Schemas ───

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const otpVerifySchema = z.object({
  code: z.string().length(6),
});

// ─── POST /signup ───
authRouter.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, referralCode } = signupSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate referral code for new user
    const userReferralCode = nanoid(8).toUpperCase();

    // Find referrer if code provided
    let referredBy: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (referrer) referredBy = referrer.id;
    }

    // Create user + wallet in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          referralCode: userReferralCode,
          referredBy,
        },
      });

      // Create wallet with default USD + NGN balances
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balances: {
            create: [
              { currency: "USD", balance: 0 },
              { currency: "NGN", balance: 0 },
            ],
          },
        },
      });

      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await tx.otpCode.create({
        data: {
          userId: newUser.id,
          code: otpCode,
          type: "EMAIL_VERIFY",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        },
      });

      // Create referral record if applicable
      if (referredBy) {
        await tx.referral.create({
          data: {
            referrerId: referredBy,
            refereeId: newUser.id,
          },
        });
      }

      // TODO: Send OTP email via BullMQ job
      console.log(`[OTP] Email verification code for ${email}: ${otpCode}`);

      return newUser;
    });

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: false,
        referralCode: userReferralCode,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /verify-otp ───
authRouter.post(
  "/verify-otp",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { code } = otpVerifySchema.parse(req.body);
      const userId = req.user!.id;

      const otp = await prisma.otpCode.findFirst({
        where: {
          userId,
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!otp) {
        throw new AppError("Invalid or expired OTP code", 400, "INVALID_OTP");
      }

      await prisma.$transaction([
        prisma.otpCode.update({
          where: { id: otp.id },
          data: { used: true },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            emailVerified: otp.type === "EMAIL_VERIFY" ? true : undefined,
            phoneVerified: otp.type === "PHONE_VERIFY" ? true : undefined,
            status: "ACTIVE",
          },
        }),
      ]);

      res.json({ verified: true, type: otp.type });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /login ───
authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    if (user.status === "SUSPENDED") {
      throw new AppError("Account suspended", 403, "ACCOUNT_SUSPENDED");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ip: req.ip,
        device: req.headers["user-agent"],
      },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /forgot-password ───
authRouter.post("/forgot-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: "If the email exists, a reset link has been sent" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otpCode,
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // TODO: Send reset email via BullMQ
    console.log(`[OTP] Password reset code for ${email}: ${otpCode}`);

    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    next(err);
  }
});

// ─── POST /refresh-token ───
authRouter.post("/refresh-token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);

    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, status: true } } },
    });

    if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
      throw new AppError("Invalid refresh token", 401, "INVALID_TOKEN");
    }

    const tokens = generateTokens({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    // Rotate refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});
