import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      role: string;
    };

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireKyc(minTier: "TIER_1" | "TIER_2" | "TIER_3") {
  const tierOrder = { TIER_0: 0, TIER_1: 1, TIER_2: 2, TIER_3: 3 };

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user!.id },
      select: { kycTier: true },
    });

    if (!profile || tierOrder[profile.kycTier] < tierOrder[minTier]) {
      return res.status(403).json({
        error: "KYC verification required",
        requiredTier: minTier,
        currentTier: profile?.kycTier || "TIER_0",
      });
    }

    next();
  };
}

export function generateTokens(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    refreshSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}
