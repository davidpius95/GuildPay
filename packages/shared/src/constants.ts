export const KYC_LIMITS: Record<string, { daily: number; monthly: number }> = {
  TIER_0: { daily: 50, monthly: 200 },
  TIER_1: { daily: 500, monthly: 5000 },
  TIER_2: { daily: 5000, monthly: 50000 },
  TIER_3: { daily: 50000, monthly: 500000 },
};

export const FEE_RATES = {
  SEND_DOMESTIC: 0.005,     // 0.5%
  SEND_CROSS_BORDER: 0.015, // 1.5%
  TOPUP: 0.015,             // 1.5%
  WITHDRAW: 0.01,           // 1.0%
  EXCHANGE: 0.005,          // 0.5%
  CARD_FUND: 0,             // Free from wallet
  CRYPTO_ONRAMP: 0.005,     // 0.5%
  CRYPTO_OFFRAMP: 0.003,    // 0.3%
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", type: "fiat" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", type: "fiat" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", type: "fiat" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", type: "fiat" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", flag: "🇬🇭", type: "fiat" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", type: "fiat" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦", type: "fiat" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪", type: "fiat" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦", type: "fiat" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", flag: "🇶🇦", type: "fiat" },
  { code: "USDT", name: "Tether", symbol: "₮", flag: "💎", type: "crypto" },
  { code: "USDC", name: "USD Coin", symbol: "$", flag: "💎", type: "crypto" },
] as const;

export const SUPPORTED_COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", region: "africa", mobileMoney: ["MTN", "Airtel"] },
  { code: "GH", name: "Ghana", currency: "GHS", flag: "🇬🇭", region: "africa", mobileMoney: ["MTN", "Vodafone", "AirtelTigo"] },
  { code: "KE", name: "Kenya", currency: "KES", flag: "🇰🇪", region: "africa", mobileMoney: ["M-Pesa", "Airtel"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", flag: "🇿🇦", region: "africa", mobileMoney: [] },
  { code: "UG", name: "Uganda", currency: "UGX", flag: "🇺🇬", region: "africa", mobileMoney: ["MTN", "Airtel"] },
  { code: "TZ", name: "Tanzania", currency: "TZS", flag: "🇹🇿", region: "africa", mobileMoney: ["M-Pesa", "Airtel"] },
  { code: "CM", name: "Cameroon", currency: "XAF", flag: "🇨🇲", region: "africa", mobileMoney: ["MTN", "Orange"] },
  { code: "SN", name: "Senegal", currency: "XOF", flag: "🇸🇳", region: "africa", mobileMoney: ["Orange", "Wave"] },
  { code: "RW", name: "Rwanda", currency: "RWF", flag: "🇷🇼", region: "africa", mobileMoney: ["MTN", "Airtel"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", flag: "🇦🇪", region: "gulf", mobileMoney: [] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", flag: "🇸🇦", region: "gulf", mobileMoney: [] },
  { code: "QA", name: "Qatar", currency: "QAR", flag: "🇶🇦", region: "gulf", mobileMoney: ["Ooredoo Money"], payoutRails: ["VISA_DIRECT", "SWIFT"], collectionNote: "Card payments (Visa/MC); Nium Doha Bank partnership for bank transfers" },
  { code: "BH", name: "Bahrain", currency: "BHD", flag: "🇧🇭", region: "gulf", mobileMoney: [] },
  { code: "OM", name: "Oman", currency: "OMR", flag: "🇴🇲", region: "gulf", mobileMoney: [] },
  { code: "KW", name: "Kuwait", currency: "KWD", flag: "🇰🇼", region: "gulf", mobileMoney: [] },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧", region: "europe", mobileMoney: [] },
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", region: "americas", mobileMoney: [] },
] as const;

export const CORRIDORS = {
  // Gulf → Africa (Nium primary)
  "AED_NGN": { name: "UAE → Nigeria", provider: "nium", estimatedTime: "5-15 min" },
  "AED_KES": { name: "UAE → Kenya", provider: "nium", estimatedTime: "5-15 min" },
  "AED_GHS": { name: "UAE → Ghana", provider: "nium", estimatedTime: "5-15 min" },
  "AED_ZAR": { name: "UAE → South Africa", provider: "nium", estimatedTime: "1-2 days" },
  "SAR_NGN": { name: "Saudi → Nigeria", provider: "nium", estimatedTime: "5-15 min" },
  "SAR_KES": { name: "Saudi → Kenya", provider: "nium", estimatedTime: "5-15 min" },

  // Qatar ↔ Nigeria (Nium Doha Bank + Visa Direct)
  "QAR_NGN": { name: "Qatar → Nigeria", provider: "nium", estimatedTime: "5-30 min" },
  "NGN_QAR": { name: "Nigeria → Qatar", provider: "nium", estimatedTime: "Real-time (Visa Direct)" },
  "QAR_KES": { name: "Qatar → Kenya", provider: "nium", estimatedTime: "5-30 min" },
  "QAR_GHS": { name: "Qatar → Ghana", provider: "nium", estimatedTime: "5-30 min" },

  // USD/GBP → Africa (both providers)
  "USD_NGN": { name: "US → Nigeria", provider: "both", estimatedTime: "5-30 min" },
  "USD_KES": { name: "US → Kenya", provider: "both", estimatedTime: "1-30 min" },
  "USD_GHS": { name: "US → Ghana", provider: "both", estimatedTime: "5-30 min" },
  "GBP_NGN": { name: "UK → Nigeria", provider: "both", estimatedTime: "5-30 min" },
  "GBP_KES": { name: "UK → Kenya", provider: "nium", estimatedTime: "5-15 min" },

  // Africa → Africa (Flutterwave primary)
  "NGN_GHS": { name: "Nigeria → Ghana", provider: "flutterwave", estimatedTime: "5-30 min" },
  "NGN_KES": { name: "Nigeria → Kenya", provider: "flutterwave", estimatedTime: "5-30 min" },
  "GHS_KES": { name: "Ghana → Kenya", provider: "flutterwave", estimatedTime: "1-5 min" },
} as const;
