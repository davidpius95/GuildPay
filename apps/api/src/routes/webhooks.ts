import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import * as nium from "../services/nium";
import * as flw from "../services/flutterwave";

export const webhookRouter = Router();

// ─── GET / — Health check for webhook URL verification (Nium pings this) ───
webhookRouter.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "guildpay-webhooks" });
});
webhookRouter.get("/nium", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "guildpay-nium-webhook" });
});
webhookRouter.get("/flutterwave", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "guildpay-flutterwave-webhook" });
});

// ─── POST /flutterwave — Flutterwave webhook handler ───
webhookRouter.post("/flutterwave", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Verify webhook signature
    const verifHash = req.headers["verif-hash"] as string;
    if (!verifHash || !flw.verifyWebhookSignature(verifHash)) {
      console.warn("[WEBHOOK] Invalid Flutterwave signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    console.log(`[WEBHOOK] Flutterwave event: ${event.event}`, event.data?.id);

    // 2. Handle event types
    if (event.event === "charge.completed") {
      await handleFlutterwaveChargeCompleted(event.data);
    } else if (event.event === "transfer.completed") {
      await handleFlutterwaveTransferCompleted(event.data);
    } else if (event.event === "transfer.failed") {
      await handleFlutterwaveTransferFailed(event.data);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[WEBHOOK] Flutterwave error:", err);
    // Always return 200 to prevent retries on our errors
    res.status(200).json({ received: true });
  }
});

async function handleFlutterwaveChargeCompleted(data: any) {
  // Verify the transaction server-side (never trust webhook data alone)
  const isValid = await flw.verifyWebhookTransaction(data.id);
  if (!isValid) {
    console.warn(`[WEBHOOK] Flutterwave charge ${data.id} failed verification`);
    return;
  }

  const txRef = data.tx_ref;
  const transaction = await prisma.transaction.findFirst({
    where: { id: txRef },
    include: { tracking: true },
  });

  if (!transaction) {
    console.warn(`[WEBHOOK] Transaction not found: ${txRef}`);
    return;
  }

  if (transaction.status === "COMPLETED") return; // Already processed

  // Top-up: credit user wallet
  if (transaction.type === "TOPUP") {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: transaction.userId },
      include: { balances: { where: { currency: transaction.currency } } },
    });

    if (!wallet?.balances[0]) return;

    await prisma.$transaction([
      prisma.walletBalance.update({
        where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
        data: { balance: { increment: Number(transaction.amount) } },
      }),
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          providerRef: String(data.flw_ref),
          completedAt: new Date(),
        },
      }),
      prisma.transferTracking.create({
        data: {
          transactionId: transaction.id,
          status: "completed",
          message: `Top-up completed. ${transaction.currency} ${transaction.amount} credited to wallet.`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: transaction.userId,
          type: "TRANSACTION",
          title: "Top-up Successful",
          body: `${transaction.currency} ${Number(transaction.amount).toFixed(2)} has been added to your wallet.`,
          data: { transactionId: transaction.id },
        },
      }),
    ]);

    console.log(`[WEBHOOK] Top-up completed: ${transaction.id}`);
  }
}

async function handleFlutterwaveTransferCompleted(data: any) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      OR: [
        { providerRef: String(data.id) },
        { id: data.reference },
      ],
    },
  });

  if (!transaction) return;
  if (transaction.status === "COMPLETED") return;

  const wallet = await prisma.wallet.findUnique({
    where: { userId: transaction.userId },
    include: { balances: { where: { currency: transaction.currency } } },
  });

  await prisma.$transaction([
    // Release locked funds (for sends) or mark completed (for withdrawals)
    ...(transaction.type === "SEND" && wallet?.balances[0]
      ? [
          prisma.walletBalance.update({
            where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
            data: {
              balance: { decrement: Number(transaction.amount) + Number(transaction.fee) },
              locked: { decrement: Number(transaction.amount) + Number(transaction.fee) },
            },
          }),
        ]
      : []),
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.transferTracking.create({
      data: {
        transactionId: transaction.id,
        status: "completed",
        message: "Transfer delivered successfully",
      },
    }),
    prisma.notification.create({
      data: {
        userId: transaction.userId,
        type: "TRANSACTION",
        title: "Transfer Complete",
        body: `Your ${transaction.type.toLowerCase()} of ${transaction.currency} ${Number(transaction.amount).toFixed(2)} is complete.`,
        data: { transactionId: transaction.id },
      },
    }),
  ]);

  console.log(`[WEBHOOK] Transfer completed: ${transaction.id}`);
}

async function handleFlutterwaveTransferFailed(data: any) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      OR: [
        { providerRef: String(data.id) },
        { id: data.reference },
      ],
    },
  });

  if (!transaction) return;
  if (transaction.status === "FAILED" || transaction.status === "COMPLETED") return;

  const wallet = await prisma.wallet.findUnique({
    where: { userId: transaction.userId },
    include: { balances: { where: { currency: transaction.currency } } },
  });

  await prisma.$transaction([
    // Refund locked funds for failed sends
    ...(transaction.type === "SEND" && wallet?.balances[0]
      ? [
          prisma.walletBalance.update({
            where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
            data: { locked: { decrement: Number(transaction.amount) + Number(transaction.fee) } },
          }),
        ]
      : []),
    // Refund wallet for failed withdrawals
    ...(transaction.type === "WITHDRAW" && wallet?.balances[0]
      ? [
          prisma.walletBalance.update({
            where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
            data: { balance: { increment: Number(transaction.amount) + Number(transaction.fee) } },
          }),
        ]
      : []),
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "FAILED",
        failedReason: data.complete_message || "Transfer failed",
        failedAt: new Date(),
      },
    }),
    prisma.transferTracking.create({
      data: {
        transactionId: transaction.id,
        status: "failed",
        message: `Transfer failed: ${data.complete_message || "Unknown error"}`,
      },
    }),
    prisma.notification.create({
      data: {
        userId: transaction.userId,
        type: "TRANSACTION",
        title: "Transfer Failed",
        body: `Your transfer of ${transaction.currency} ${Number(transaction.amount).toFixed(2)} failed. Funds have been refunded.`,
        data: { transactionId: transaction.id },
      },
    }),
  ]);

  console.log(`[WEBHOOK] Transfer failed: ${transaction.id}`);
}

// ─── POST /nium — Nium webhook handler ───
webhookRouter.post("/nium", async (req: Request, res: Response) => {
  try {
    // 1. Verify webhook signature
    const signature = req.headers["x-nium-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !nium.verifyWebhookSignature(rawBody, signature)) {
      console.warn("[WEBHOOK] Invalid Nium signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    console.log(`[WEBHOOK] Nium event: ${event.type}`, event.systemReferenceNumber);

    const status = event.status?.toUpperCase();
    const sysRef = event.systemReferenceNumber;

    if (!sysRef) return res.status(200).json({ received: true });

    const transaction = await prisma.transaction.findFirst({
      where: { providerRef: sysRef },
    });

    if (!transaction) {
      console.warn(`[WEBHOOK] Nium: transaction not found for ref ${sysRef}`);
      return res.status(200).json({ received: true });
    }

    if (status === "PAID" || status === "COMPLETED" || status === "DEEMED_PAID") {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: transaction.userId },
        include: { balances: { where: { currency: transaction.currency } } },
      });

      await prisma.$transaction([
        ...(transaction.type === "SEND" && wallet?.balances[0]
          ? [
              prisma.walletBalance.update({
                where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
                data: {
                  balance: { decrement: Number(transaction.amount) + Number(transaction.fee) },
                  locked: { decrement: Number(transaction.amount) + Number(transaction.fee) },
                },
              }),
            ]
          : []),
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        }),
        prisma.transferTracking.create({
          data: {
            transactionId: transaction.id,
            status: "completed",
            message: `Payout delivered via Nium (${event.subStatus || status})`,
          },
        }),
        prisma.notification.create({
          data: {
            userId: transaction.userId,
            type: "TRANSACTION",
            title: "Transfer Complete",
            body: `Your transfer of ${transaction.currency} ${Number(transaction.amount).toFixed(2)} has been delivered.`,
            data: { transactionId: transaction.id },
          },
        }),
      ]);
    } else if (status === "REJECTED" || status === "RETURNED" || status === "CANCELLED") {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: transaction.userId },
        include: { balances: { where: { currency: transaction.currency } } },
      });

      await prisma.$transaction([
        ...(wallet?.balances[0]
          ? [
              prisma.walletBalance.update({
                where: { walletId_currency: { walletId: wallet.id, currency: transaction.currency } },
                data: {
                  ...(transaction.type === "SEND" ? { locked: { decrement: Number(transaction.amount) + Number(transaction.fee) } } : {}),
                  ...(transaction.type === "WITHDRAW" ? { balance: { increment: Number(transaction.amount) + Number(transaction.fee) } } : {}),
                },
              }),
            ]
          : []),
        prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "FAILED",
            failedReason: event.failureReason || `Nium: ${status}`,
            failedAt: new Date(),
          },
        }),
        prisma.transferTracking.create({
          data: {
            transactionId: transaction.id,
            status: "failed",
            message: `Payout ${status.toLowerCase()}: ${event.failureReason || "Unknown reason"}. Funds refunded.`,
          },
        }),
        prisma.notification.create({
          data: {
            userId: transaction.userId,
            type: "TRANSACTION",
            title: "Transfer Failed",
            body: `Your transfer failed. ${transaction.currency} ${Number(transaction.amount).toFixed(2)} has been refunded.`,
            data: { transactionId: transaction.id },
          },
        }),
      ]);
    } else if (status === "IN_PROGRESS" || status === "SENT_TO_BANK") {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "IN_TRANSIT" },
        }),
        prisma.transferTracking.create({
          data: {
            transactionId: transaction.id,
            status: "in_transit",
            message: `Payout in transit (${event.subStatus || status})`,
          },
        }),
      ]);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[WEBHOOK] Nium error:", err);
    res.status(200).json({ received: true });
  }
});
