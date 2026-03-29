export const colors = {
  primary: "#5C0A2A",
  primaryLight: "#8B1A3A",
  primaryDark: "#4A0821",

  background: "#F5F5F5",
  white: "#FFFFFF",

  text: "#1A1A1A",
  textSecondary: "#888888",
  textTertiary: "#BBBBBB",

  border: "#DDDDDD",
  borderLight: "#EEEEEE",

  success: "#27AE60",
  successLight: "#E8F8EF",
  error: "#E74C3C",
  errorLight: "#FDE8E6",
  warning: "#F2A623",
  warningLight: "#FEF5E0",
  info: "#3B8BD4",
  infoLight: "#E6F1FB",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 28,
  full: 9999,
};

export const typography = {
  fontFamily: "DM Sans",
  h1: { fontSize: 32, fontWeight: "700" as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: "700" as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: "600" as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  bodyBold: { fontSize: 16, fontWeight: "600" as const, lineHeight: 24 },
  caption: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: "400" as const, lineHeight: 16 },
  tiny: { fontSize: 11, fontWeight: "400" as const, lineHeight: 14 },
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", flag: "🇶🇦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "USDT", name: "Tether", symbol: "₮", flag: "₮" },
  { code: "USDC", name: "USD Coin", symbol: "$", flag: "◉" },
];

export const COUNTRIES = [
  // Africa
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", region: "africa", mobileMoneyProviders: ["MTN", "Airtel"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", region: "africa", mobileMoneyProviders: ["MTN MoMo", "Vodafone Cash", "AirtelTigo"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", region: "africa", mobileMoneyProviders: ["M-Pesa", "Airtel"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", region: "africa", mobileMoneyProviders: [] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", region: "africa", mobileMoneyProviders: ["MTN MoMo", "Airtel Money"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", region: "africa", mobileMoneyProviders: ["M-Pesa", "Tigo Pesa"] },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", currency: "XAF", region: "africa", mobileMoneyProviders: ["MTN MoMo", "Orange Money"] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", currency: "XOF", region: "africa", mobileMoneyProviders: ["Orange Money", "Wave"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", currency: "RWF", region: "africa", mobileMoneyProviders: ["MTN", "Airtel"] },
  // Gulf
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", region: "gulf", mobileMoneyProviders: [] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR", region: "gulf", mobileMoneyProviders: [] },
  { code: "QA", name: "Qatar", flag: "🇶🇦", currency: "QAR", region: "gulf", mobileMoneyProviders: ["Ooredoo Money"] },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", currency: "BHD", region: "gulf", mobileMoneyProviders: [] },
  { code: "OM", name: "Oman", flag: "🇴🇲", currency: "OMR", region: "gulf", mobileMoneyProviders: [] },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", currency: "KWD", region: "gulf", mobileMoneyProviders: [] },
  // Other
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", region: "europe", mobileMoneyProviders: [] },
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", region: "americas", mobileMoneyProviders: [] },
];

// Currency symbol lookup helper
export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

// Country flag lookup helper
export function getCountryFlag(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag || "";
}
