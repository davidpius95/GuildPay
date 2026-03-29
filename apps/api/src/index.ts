// Load .env FIRST — before any imports that read process.env
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
// Also try local .env as fallback
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";

import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/users";
import { walletRouter } from "./routes/wallets";
import { transferRouter } from "./routes/transfers";
import { recipientRouter } from "./routes/recipients";
import { cardRouter } from "./routes/cards";
import { billRouter } from "./routes/bills";
import { notificationRouter } from "./routes/notifications";
import { webhookRouter } from "./routes/webhooks";
import { errorHandler } from "./middleware/error";
import { authenticate } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ───
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for dev dashboard (inline scripts)
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("short"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// ─── Serve Web Dashboard ───
const publicPath = path.resolve(process.cwd(), "public");
console.log(`📂 Serving dashboard from: ${publicPath}`);
app.use(express.static(publicPath));

// ─── Health Check ───
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "guildpay-api", version: "0.1.0" });
});

// ─── Public Routes ───
app.use("/api/v1/auth", authRouter);

// ─── Webhook Routes (no auth — verified by signature) ───
app.use("/webhooks", webhookRouter);

// ─── Payment Callback (Flutterwave redirects here after checkout) ───
app.get("/topup/callback", async (req, res) => {
  const { tx_ref, transaction_id, status } = req.query;

  if (status === "successful" && transaction_id) {
    // Verify with Flutterwave and credit wallet
    try {
      const { prisma } = await import("./config/db");
      const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
        headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      });
      const flwData = await flwRes.json() as any;

      if (flwData.data?.status === "successful") {
        const txn = await prisma.transaction.findFirst({ where: { id: tx_ref as string } });
        if (txn && txn.status !== "COMPLETED") {
          const wallet = await prisma.wallet.findUnique({
            where: { userId: txn.userId },
            include: { balances: { where: { currency: txn.currency } } },
          });

          if (wallet?.balances[0]) {
            await prisma.$transaction([
              prisma.walletBalance.update({
                where: { walletId_currency: { walletId: wallet.id, currency: txn.currency } },
                data: { balance: { increment: Number(txn.amount) } },
              }),
              prisma.transaction.update({
                where: { id: txn.id },
                data: { status: "COMPLETED", providerRef: String(transaction_id), completedAt: new Date() },
              }),
              prisma.notification.create({
                data: {
                  userId: txn.userId,
                  type: "TRANSACTION",
                  title: "Top-up Successful",
                  body: `${txn.currency} ${Number(txn.amount).toFixed(2)} has been added to your wallet.`,
                  data: { transactionId: txn.id },
                },
              }),
            ]);
            console.log(`[CALLBACK] Top-up completed: ${txn.id} — ${txn.currency} ${txn.amount}`);
          }
        }
      }
    } catch (err) {
      console.error("[CALLBACK] Verification error:", err);
    }
  }

  // Show success page to user
  res.send(`
    <html>
      <head><title>GuildPay - Payment ${status === "successful" ? "Complete" : "Failed"}</title></head>
      <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
        <div style="text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px;">
          <div style="font-size: 48px; margin-bottom: 16px;">${status === "successful" ? "✅" : "❌"}</div>
          <h1 style="color: #5C0A2A; margin: 0 0 8px 0;">${status === "successful" ? "Payment Successful!" : "Payment Failed"}</h1>
          <p style="color: #666; margin: 0 0 24px 0;">
            ${status === "successful" ? "Your wallet has been topped up." : "Something went wrong. Please try again."}
          </p>
          <p style="color: #999; font-size: 14px;">Transaction: ${tx_ref || "N/A"}</p>
          <p style="color: #999; font-size: 14px; margin-top: 24px;">You can close this tab and return to the app.</p>
        </div>
      </body>
    </html>
  `);
});

// ─── Protected Routes ───
app.use("/api/v1/users", authenticate, userRouter);
app.use("/api/v1/wallets", authenticate, walletRouter);
app.use("/api/v1/transfers", authenticate, transferRouter);
app.use("/api/v1/recipients", authenticate, recipientRouter);
app.use("/api/v1/cards", authenticate, cardRouter);
app.use("/api/v1/bills", authenticate, billRouter);
app.use("/api/v1/notifications", authenticate, notificationRouter);

// ─── Error Handler ───
app.use(errorHandler);

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`🚀 GuildPay API running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
});

export default app;
