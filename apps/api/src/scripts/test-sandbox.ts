/**
 * Sandbox connectivity test — verifies both Nium and Flutterwave APIs are reachable.
 *
 * Run: cd apps/api && npx tsx src/scripts/test-sandbox.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load .env from project root — resolve relative to this file, not cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Now providers will pick up env vars
const niumConfig = {
  baseUrl: process.env.NIUM_API_BASE_URL || "",
  clientHashId: process.env.NIUM_CLIENT_HASH_ID || "",
  apiKey: process.env.NIUM_API_KEY || "",
  webhookSecret: process.env.NIUM_WEBHOOK_SECRET || "",
};

const flutterwaveConfig = {
  baseUrl: process.env.FLUTTERWAVE_API_BASE_URL || "",
  publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
  webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH || "",
};

async function testNium() {
  console.log("─── Testing Nium Sandbox ───");
  console.log(`  Base URL: ${niumConfig.baseUrl}`);
  console.log(`  Client Hash: ${niumConfig.clientHashId.slice(0, 8)}...`);

  try {
    // Test: Get client details
    const url = `${niumConfig.baseUrl}/api/v1/client/${niumConfig.clientHashId}`;
    const res = await fetch(url, {
      headers: {
        "x-api-key": niumConfig.apiKey,
        "x-client-name": "GuildPay",
        "x-request-id": crypto.randomUUID(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ Connected! Client name: ${data.name || data.clientName || "OK"}`);
      console.log(`  ✓ Status: ${res.status}`);
    } else {
      const err = await res.text();
      console.log(`  ✗ HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Connection failed: ${e.message}`);
  }

  // Test: Get supported corridors / FX rate
  try {
    const url = `${niumConfig.baseUrl}/api/v1/client/${niumConfig.clientHashId}/exchangeRate?sourceCurrencyCode=USD&destinationCurrencyCode=NGN&sourceAmount=100`;
    const res = await fetch(url, {
      headers: {
        "x-api-key": niumConfig.apiKey,
        "x-client-name": "GuildPay",
        "x-request-id": crypto.randomUUID(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ FX API working — USD→NGN sample rate available`);
    } else {
      console.log(`  ○ FX API returned ${res.status} (may need customer context)`);
    }
  } catch (e: any) {
    console.log(`  ○ FX test skipped: ${e.message}`);
  }

  console.log("");
}

async function testFlutterwave() {
  console.log("─── Testing Flutterwave Sandbox ───");
  console.log(`  Base URL: ${flutterwaveConfig.baseUrl}`);
  console.log(`  Public Key: ${flutterwaveConfig.publicKey.slice(0, 20)}...`);

  // Test: Get banks (NG) — simple read-only endpoint
  try {
    const url = `${flutterwaveConfig.baseUrl}/banks/NG`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${flutterwaveConfig.secretKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      const bankCount = data.data?.length || 0;
      console.log(`  ✓ Connected! Nigerian banks loaded: ${bankCount}`);
    } else {
      const err = await res.text();
      console.log(`  ✗ HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Connection failed: ${e.message}`);
  }

  // Test: Get FX rate
  try {
    const url = `${flutterwaveConfig.baseUrl}/rates?from=USD&to=NGN&amount=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${flutterwaveConfig.secretKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✓ FX API working — USD→NGN rate: ${data.data?.rate || "available"}`);
    } else {
      console.log(`  ○ FX API returned ${res.status}`);
    }
  } catch (e: any) {
    console.log(`  ○ FX test skipped: ${e.message}`);
  }

  // Test: Get bill categories
  try {
    const url = `${flutterwaveConfig.baseUrl}/bill-categories`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${flutterwaveConfig.secretKey}` },
    });

    if (res.ok) {
      const data = await res.json();
      const catCount = data.data?.length || 0;
      console.log(`  ✓ Bills API working — ${catCount} bill categories available`);
    } else {
      console.log(`  ○ Bills API returned ${res.status}`);
    }
  } catch (e: any) {
    console.log(`  ○ Bills test skipped: ${e.message}`);
  }

  console.log("");
}

async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   GuildPay Sandbox Connectivity Test      ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log("");

  await testNium();
  await testFlutterwave();

  console.log("─── Environment Summary ───");
  console.log(`  NODE_ENV:     ${process.env.NODE_ENV}`);
  console.log(`  DB:           ${process.env.DATABASE_URL ? "configured" : "MISSING"}`);
  console.log(`  Redis:        ${process.env.REDIS_URL ? "configured" : "MISSING"}`);
  console.log(`  Nium:         ${niumConfig.apiKey ? "configured" : "MISSING"}`);
  console.log(`  Flutterwave:  ${flutterwaveConfig.secretKey ? "configured" : "MISSING"}`);
  console.log(`  Webhook (FLW): ${flutterwaveConfig.webhookHash ? "set" : "NOT SET"}`);
  console.log(`  Webhook (Nium): ${niumConfig.webhookSecret ? "set" : "NOT SET"}`);
  console.log("");
}

main().catch(console.error);
