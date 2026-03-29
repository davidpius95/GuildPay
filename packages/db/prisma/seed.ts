/**
 * Database seed script — populates FX rates, test user, and initial data for MVP.
 *
 * Run: cd packages/db && npx tsx prisma/seed.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root (../../.env relative to packages/db/)
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding GuildPay database...\n");

  // ─── 1. Exchange Rates (sandbox approximations) ───
  console.log("Seeding exchange rates...");

  const rates = [
    // Gulf → NGN
    { fromCurrency: "AED", toCurrency: "NGN", rate: 395.50, source: "nium_sandbox" },
    { fromCurrency: "SAR", toCurrency: "NGN", rate: 387.20, source: "nium_sandbox" },
    { fromCurrency: "QAR", toCurrency: "NGN", rate: 398.90, source: "nium_sandbox" },

    // Gulf → USD
    { fromCurrency: "AED", toCurrency: "USD", rate: 0.2723, source: "nium_sandbox" },
    { fromCurrency: "SAR", toCurrency: "USD", rate: 0.2667, source: "nium_sandbox" },
    { fromCurrency: "QAR", toCurrency: "USD", rate: 0.2747, source: "nium_sandbox" },

    // USD → various
    { fromCurrency: "USD", toCurrency: "NGN", rate: 1452.00, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "GBP", rate: 0.79, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "EUR", rate: 0.92, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "GHS", rate: 15.80, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "KES", rate: 129.50, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "ZAR", rate: 18.20, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "AED", rate: 3.673, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "SAR", rate: 3.75, source: "nium_sandbox" },
    { fromCurrency: "USD", toCurrency: "QAR", rate: 3.64, source: "nium_sandbox" },

    // Reverse (to USD)
    { fromCurrency: "NGN", toCurrency: "USD", rate: 0.000689, source: "flutterwave_sandbox" },
    { fromCurrency: "GBP", toCurrency: "USD", rate: 1.266, source: "nium_sandbox" },
    { fromCurrency: "EUR", toCurrency: "USD", rate: 1.087, source: "nium_sandbox" },
    { fromCurrency: "GHS", toCurrency: "USD", rate: 0.0633, source: "flutterwave_sandbox" },
    { fromCurrency: "KES", toCurrency: "USD", rate: 0.00772, source: "flutterwave_sandbox" },
    { fromCurrency: "ZAR", toCurrency: "USD", rate: 0.0549, source: "nium_sandbox" },

    // NGN → Gulf (reverse)
    { fromCurrency: "NGN", toCurrency: "AED", rate: 0.00253, source: "nium_sandbox" },
    { fromCurrency: "NGN", toCurrency: "SAR", rate: 0.00258, source: "nium_sandbox" },
    { fromCurrency: "NGN", toCurrency: "QAR", rate: 0.00251, source: "nium_sandbox" },

    // Stablecoins
    { fromCurrency: "USDT", toCurrency: "USD", rate: 1.0, source: "internal" },
    { fromCurrency: "USD", toCurrency: "USDT", rate: 1.0, source: "internal" },
    { fromCurrency: "USDC", toCurrency: "USD", rate: 1.0, source: "internal" },
    { fromCurrency: "USD", toCurrency: "USDC", rate: 1.0, source: "internal" },

    // Cross Africa
    { fromCurrency: "NGN", toCurrency: "GHS", rate: 0.01088, source: "flutterwave_sandbox" },
    { fromCurrency: "NGN", toCurrency: "KES", rate: 0.0892, source: "flutterwave_sandbox" },
    { fromCurrency: "GHS", toCurrency: "NGN", rate: 91.90, source: "flutterwave_sandbox" },
    { fromCurrency: "KES", toCurrency: "NGN", rate: 11.21, source: "flutterwave_sandbox" },

    // GBP → NGN
    { fromCurrency: "GBP", toCurrency: "NGN", rate: 1838.00, source: "nium_sandbox" },
    { fromCurrency: "EUR", toCurrency: "NGN", rate: 1578.00, source: "nium_sandbox" },

    // QAR ↔ KES/GHS
    { fromCurrency: "QAR", toCurrency: "KES", rate: 35.58, source: "nium_sandbox" },
    { fromCurrency: "QAR", toCurrency: "GHS", rate: 4.34, source: "nium_sandbox" },
  ];

  for (const rate of rates) {
    await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
        },
      },
      update: { rate: rate.rate, source: rate.source },
      create: rate,
    });
  }
  console.log(`  ✓ ${rates.length} exchange rates seeded\n`);

  // ─── 2. Test User ───
  console.log("Seeding test user...");

  const passwordHash = await bcrypt.hash("Test1234!", 12);
  const pinHash = await bcrypt.hash("123456", 10);

  const testUser = await prisma.user.upsert({
    where: { email: "test@guildpay.com" },
    update: {},
    create: {
      email: "test@guildpay.com",
      passwordHash,
      pin: pinHash,
      role: "USER",
      status: "ACTIVE",
      emailVerified: true,
      referralCode: "TESTUSER",
    },
  });

  // Profile
  await prisma.userProfile.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      firstName: "Test",
      lastName: "User",
      country: "QA",
      city: "Doha",
      postalCode: "00000",
      kycTier: "TIER_2",
    },
  });

  // Wallet with multiple currencies (pre-funded for sandbox testing)
  const wallet = await prisma.wallet.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      status: "ACTIVE",
      niumCustomerHashId: null, // Will be set after Nium onboarding
      niumWalletHashId: null,
    },
  });

  const currencies = [
    { currency: "USD", balance: 1000 },
    { currency: "NGN", balance: 500000 },
    { currency: "QAR", balance: 5000 },
    { currency: "AED", balance: 3000 },
    { currency: "GBP", balance: 500 },
    { currency: "KES", balance: 50000 },
    { currency: "GHS", balance: 2000 },
  ];

  for (const { currency, balance } of currencies) {
    await prisma.walletBalance.upsert({
      where: { walletId_currency: { walletId: wallet.id, currency } },
      update: { balance },
      create: { walletId: wallet.id, currency, balance },
    });
  }
  console.log(`  ✓ Test user created: test@guildpay.com / Test1234! / PIN: 123456`);
  console.log(`  ✓ Wallet funded: $1000 USD, ₦500K NGN, ر.ق5000 QAR, د.إ3000 AED, £500 GBP\n`);

  // ─── 3. Test Recipients ───
  console.log("Seeding test recipients...");

  const recipients = [
    {
      userId: testUser.id,
      name: "Adebayo Ogunlesi",
      country: "Nigeria",
      countryCode: "NG",
      bankName: "Access Bank",
      bankCode: "044",
      accountNumber: "0690000032",
      isFavorite: true,
    },
    {
      userId: testUser.id,
      name: "Amina Ibrahim",
      country: "Nigeria",
      countryCode: "NG",
      bankName: "GTBank",
      bankCode: "058",
      accountNumber: "0123456789",
    },
    {
      userId: testUser.id,
      name: "Kwame Asante",
      country: "Ghana",
      countryCode: "GH",
      mobileNumber: "+233241234567",
      mobileProvider: "MTN",
    },
    {
      userId: testUser.id,
      name: "Wanjiku Kamau",
      country: "Kenya",
      countryCode: "KE",
      mobileNumber: "+254712345678",
      mobileProvider: "M-Pesa",
    },
    {
      userId: testUser.id,
      name: "Mohammed Al-Thani",
      country: "Qatar",
      countryCode: "QA",
      bankName: "Doha Bank",
      bankCode: "DOHBQAQA",
      accountNumber: "QA58DOHB00001234567890ABCDEF",
    },
  ];

  for (const r of recipients) {
    const existing = await prisma.recipient.findFirst({
      where: { userId: r.userId, name: r.name, countryCode: r.countryCode },
    });
    if (!existing) {
      await prisma.recipient.create({ data: r });
    }
  }
  console.log(`  ✓ ${recipients.length} test recipients seeded\n`);

  // ─── 4. Test Notification ───
  await prisma.notification.upsert({
    where: { id: "seed-welcome-notif" },
    update: {},
    create: {
      id: "seed-welcome-notif",
      userId: testUser.id,
      type: "SYSTEM",
      title: "Welcome to GuildPay!",
      body: "Your account is ready. Send money to Nigeria, Kenya, Ghana, or Qatar instantly.",
    },
  });
  console.log("  ✓ Welcome notification created\n");

  console.log("═══════════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log("  Test credentials:");
  console.log("    Email:    test@guildpay.com");
  console.log("    Password: Test1234!");
  console.log("    PIN:      123456");
  console.log("");
  console.log("  Test recipients:");
  console.log("    NG: Adebayo Ogunlesi (Access Bank 0690000032)");
  console.log("    NG: Amina Ibrahim (GTBank 0123456789)");
  console.log("    GH: Kwame Asante (MTN +233241234567)");
  console.log("    KE: Wanjiku Kamau (M-Pesa +254712345678)");
  console.log("    QA: Mohammed Al-Thani (Doha Bank)");
  console.log("");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
