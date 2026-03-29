/**
 * Smart Payment Router — Selects optimal provider per corridor
 *
 * Routing logic:
 * - Gulf → Africa: Nium (Ecobank partnership, real-time settlement)
 * - Africa → Africa: Flutterwave (local rails, mobile money)
 * - UK/US → Africa: Compare Nium vs Flutterwave rates
 * - In-wallet exchange: Nium FX (lockable rates, 5min refresh)
 * - Bill payments: Flutterwave (Nigeria primary)
 * - Virtual cards: Nium (30+ markets) or Flutterwave (USD/NGN)
 * - Mobile money collection: Flutterwave (M-Pesa, MTN MoMo)
 */

export type Provider = "nium" | "flutterwave" | "blockchain" | "internal";
export type Rail = "BANK_TRANSFER" | "MOBILE_MONEY" | "CARD" | "CRYPTO" | "INTERNAL" | "VISA_DIRECT" | "SWIFT";

export interface PaymentRoute {
  provider: Provider;
  rail: Rail;
  feePercent: number;
  flatFee: number;
  estimatedTime: string;
  priority: number;
  corridor: string;
}

// Gulf countries (Nium territory)
const GULF_CURRENCIES = new Set(["AED", "SAR", "QAR", "BHD", "OMR", "KWD"]);

// Qatar: Nium has Doha Bank partnership but no direct QAR collection.
// QAR collection via card acquiring; QAR payout via Nium Visa Direct (real-time) or SWIFT.
// Nigeria→Qatar: Flutterwave collects NGN, Nium pays QAR via Visa Direct.

// African countries with Flutterwave local rails
const FLW_AFRICAN_CURRENCIES = new Set(["NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "RWF", "XAF", "XOF"]);

// African countries where Nium has Ecobank real-time
const NIUM_ECOBANK_CURRENCIES = new Set(["NGN", "GHS", "KES", "ZAR", "UGX", "RWF", "XAF", "XOF"]);

// ─── Corridor definitions ───

const CORRIDORS: PaymentRoute[] = [
  // Gulf → Nigeria
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "AED_NGN" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "SAR_NGN" },
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.015, flatFee: 0, estimatedTime: "10-30 min", priority: 2, corridor: "AED_NGN" },

  // Gulf → Kenya
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "AED_KES" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "SAR_KES" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "1-5 min", priority: 2, corridor: "AED_KES" },

  // Gulf → Ghana
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "AED_GHS" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "5-15 min", priority: 2, corridor: "AED_GHS" },

  // Gulf → South Africa
  { provider: "nium", rail: "SWIFT", feePercent: 0.012, flatFee: 5, estimatedTime: "1-2 days", priority: 1, corridor: "AED_ZAR" },

  // Qatar → Nigeria (QAR collection via card, payout via Nium/Ecobank + Flutterwave)
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.012, flatFee: 0, estimatedTime: "5-30 min", priority: 1, corridor: "QAR_NGN" },
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.018, flatFee: 0, estimatedTime: "10-30 min", priority: 2, corridor: "QAR_NGN" },

  // Nigeria → Qatar (Flutterwave collects NGN, Nium pays QAR via Visa Direct)
  { provider: "nium", rail: "VISA_DIRECT", feePercent: 0.012, flatFee: 0, estimatedTime: "Real-time", priority: 1, corridor: "NGN_QAR" },
  { provider: "nium", rail: "SWIFT", feePercent: 0.015, flatFee: 10, estimatedTime: "1-2 days", priority: 2, corridor: "NGN_QAR" },

  // Qatar → Kenya/Ghana
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.012, flatFee: 0, estimatedTime: "5-30 min", priority: 1, corridor: "QAR_KES" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.012, flatFee: 0, estimatedTime: "5-30 min", priority: 1, corridor: "QAR_GHS" },

  // USD → Africa (Nium preferred for Gulf-originated, Flutterwave for direct)
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "USD_NGN" },
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.015, flatFee: 0, estimatedTime: "10-30 min", priority: 2, corridor: "USD_NGN" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "USD_KES" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "1-5 min", priority: 2, corridor: "USD_KES" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "USD_GHS" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "5-15 min", priority: 2, corridor: "USD_GHS" },
  { provider: "nium", rail: "SWIFT", feePercent: 0.012, flatFee: 5, estimatedTime: "1-2 days", priority: 1, corridor: "USD_ZAR" },

  // GBP → Africa
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "GBP_NGN" },
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.015, flatFee: 0, estimatedTime: "10-30 min", priority: 2, corridor: "GBP_NGN" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "GBP_KES" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "GBP_GHS" },

  // EUR → Africa
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "EUR_NGN" },
  { provider: "nium", rail: "BANK_TRANSFER", feePercent: 0.01, flatFee: 0, estimatedTime: "5-15 min", priority: 1, corridor: "EUR_KES" },

  // Africa → Africa (Flutterwave local rails)
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.015, flatFee: 0, estimatedTime: "5-30 min", priority: 1, corridor: "NGN_GHS" },
  { provider: "flutterwave", rail: "BANK_TRANSFER", feePercent: 0.015, flatFee: 0, estimatedTime: "5-30 min", priority: 1, corridor: "NGN_KES" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "1-5 min", priority: 1, corridor: "GHS_KES" },
  { provider: "flutterwave", rail: "MOBILE_MONEY", feePercent: 0.02, flatFee: 0, estimatedTime: "1-5 min", priority: 1, corridor: "KES_GHS" },

  // Crypto corridors
  { provider: "blockchain", rail: "CRYPTO", feePercent: 0.005, flatFee: 0, estimatedTime: "2-5 min", priority: 3, corridor: "USDT_USD" },
  { provider: "blockchain", rail: "CRYPTO", feePercent: 0.005, flatFee: 0, estimatedTime: "2-5 min", priority: 3, corridor: "USD_USDT" },
  { provider: "blockchain", rail: "CRYPTO", feePercent: 0.003, flatFee: 0, estimatedTime: "1-2 min", priority: 3, corridor: "USDC_USD" },
  { provider: "blockchain", rail: "CRYPTO", feePercent: 0.003, flatFee: 0, estimatedTime: "1-2 min", priority: 3, corridor: "USD_USDC" },

  // Internal (same-currency wallet transfers)
  { provider: "internal", rail: "INTERNAL", feePercent: 0, flatFee: 0, estimatedTime: "instant", priority: 0, corridor: "INTERNAL" },
];

// ─── Router Logic ───

/**
 * Select the optimal route for a transfer.
 *
 * Strategy:
 * 1. Look up direct corridor routes
 * 2. If no direct route, try USD as intermediary
 * 3. If Gulf currency → always prefer Nium
 * 4. Sort by total cost (feePercent * amount + flatFee), then priority
 * 5. Filter by preferred rail if specified
 */
export function selectRoute(params: {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  preferredRail?: string;
  preferredProvider?: Provider;
}): PaymentRoute {
  const { fromCurrency, toCurrency, amount, preferredRail, preferredProvider } = params;

  // Same currency = internal
  if (fromCurrency === toCurrency) {
    return CORRIDORS.find((r) => r.corridor === "INTERNAL")!;
  }

  const corridor = `${fromCurrency}_${toCurrency}`;

  // Find matching routes
  let routes = CORRIDORS.filter((r) => r.corridor === corridor);

  // No direct route — try via USD intermediary
  if (routes.length === 0) {
    const toUsd = CORRIDORS.filter((r) => r.corridor === `${fromCurrency}_USD`);
    const fromUsd = CORRIDORS.filter((r) => r.corridor === `USD_${toCurrency}`);

    if (toUsd.length > 0 && fromUsd.length > 0) {
      // Use the best route from USD leg
      routes = fromUsd;
    }
  }

  // Still nothing — fallback based on currency type
  if (routes.length === 0) {
    if (GULF_CURRENCIES.has(fromCurrency)) {
      return {
        provider: "nium",
        rail: "SWIFT",
        feePercent: 0.015,
        flatFee: 10,
        estimatedTime: "1-3 days",
        priority: 99,
        corridor,
      };
    }
    if (FLW_AFRICAN_CURRENCIES.has(fromCurrency)) {
      return {
        provider: "flutterwave",
        rail: "BANK_TRANSFER",
        feePercent: 0.02,
        flatFee: 0,
        estimatedTime: "10-60 min",
        priority: 99,
        corridor,
      };
    }
    // Ultimate fallback
    return {
      provider: "nium",
      rail: "SWIFT",
      feePercent: 0.02,
      flatFee: 15,
      estimatedTime: "1-3 days",
      priority: 99,
      corridor,
    };
  }

  // Apply filters
  let filtered = routes;

  if (preferredProvider) {
    const providerFiltered = filtered.filter((r) => r.provider === preferredProvider);
    if (providerFiltered.length > 0) filtered = providerFiltered;
  }

  if (preferredRail) {
    const railFiltered = filtered.filter((r) => r.rail === preferredRail);
    if (railFiltered.length > 0) filtered = railFiltered;
  }

  // Sort by total cost, then priority
  filtered.sort((a, b) => {
    const costA = a.feePercent * amount + a.flatFee;
    const costB = b.feePercent * amount + b.flatFee;
    if (costA !== costB) return costA - costB;
    return a.priority - b.priority;
  });

  return filtered[0];
}

/**
 * Calculate the total fee for a route.
 */
export function calculateFee(route: PaymentRoute, amount: number): number {
  return Math.round((route.feePercent * amount + route.flatFee) * 100) / 100;
}

/**
 * Get all available corridors.
 */
export function getAvailableCorridors(): string[] {
  const corridors = new Set(CORRIDORS.map((r) => r.corridor));
  corridors.delete("INTERNAL");
  return Array.from(corridors).sort();
}

/**
 * Get all routes for a specific corridor (for showing user options).
 */
export function getCorridorRoutes(fromCurrency: string, toCurrency: string): PaymentRoute[] {
  const corridor = `${fromCurrency}_${toCurrency}`;
  return CORRIDORS.filter((r) => r.corridor === corridor);
}

/**
 * Determine which provider to use for FX quotes.
 * Nium: real-time (5min refresh), lockable. Flutterwave: 3-4x daily, no lock.
 */
export function selectFxProvider(fromCurrency: string, toCurrency: string): Provider {
  // Gulf currencies → always Nium (they have local AED/SAR rails)
  if (GULF_CURRENCIES.has(fromCurrency) || GULF_CURRENCIES.has(toCurrency)) {
    return "nium";
  }
  // If both are African, Flutterwave may have better rates
  if (FLW_AFRICAN_CURRENCIES.has(fromCurrency) && FLW_AFRICAN_CURRENCIES.has(toCurrency)) {
    return "flutterwave";
  }
  // Default to Nium (better rate refresh frequency)
  return "nium";
}

/**
 * Determine which provider to use for card issuance.
 * Nium: 30+ markets, multi-currency. Flutterwave: USD/NGN only.
 */
export function selectCardProvider(currency: string): Provider {
  if (currency === "NGN") return "flutterwave"; // Flutterwave cheaper for NGN cards
  return "nium"; // Nium for everything else (USD, AED, GBP, EUR, etc.)
}
