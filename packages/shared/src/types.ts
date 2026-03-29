export interface ApiResponse<T = any> {
  data: T;
  error?: string;
  code?: string;
}

export type Currency = "USD" | "NGN" | "GBP" | "EUR" | "GHS" | "KES" | "ZAR" | "AED" | "SAR" | "QAR" | "USDT" | "USDC";
export type TransactionType = "SEND" | "RECEIVE" | "TOPUP" | "WITHDRAW" | "EXCHANGE" | "CARD_FUND" | "BILL_PAYMENT";
export type TransactionStatus = "INITIATED" | "PROCESSING" | "IN_TRANSIT" | "COMPLETED" | "FAILED" | "CANCELLED";
export type KycTier = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
export type PaymentRail = "BANK_TRANSFER" | "CARD" | "MOBILE_MONEY" | "CRYPTO" | "INTERNAL" | "VISA_DIRECT" | "SWIFT";
export type Provider = "nium" | "flutterwave" | "blockchain" | "internal";

export interface PaymentRoute {
  provider: Provider;
  rail: PaymentRail;
  feePercent: number;
  flatFee: number;
  estimatedTime: string;
  corridor: string;
}
