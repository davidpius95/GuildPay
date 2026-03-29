/**
 * Nium Service — Global infrastructure layer
 *
 * Handles: KYC onboarding, FX quotes/conversions, cross-border payouts,
 * virtual card issuance, and account verification (Nium Verify).
 *
 * API docs: https://docs.nium.com/
 * Entity model: Client → Customer → Wallet → Cards/Transactions
 */

import { niumConfig } from "../config/providers";
import crypto from "crypto";

// ─── Types ───

export interface NiumCustomer {
  customerHashId: string;
  walletHashId: string;
  email: string;
  status: string;
}

export interface NiumFxQuote {
  quoteId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  lockPeriod: string;
  expiresAt: string;
}

export interface NiumPayout {
  systemReferenceNumber: string;
  status: string;
  provider: string;
}

export interface NiumCard {
  cardHashId: string;
  maskedCardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  status: string;
  cardType: string;
}

export interface NiumAccountVerification {
  status: "valid" | "invalid";
  accountName?: string;
  bankName?: string;
}

// ─── HTTP Helper ───

async function niumRequest<T>(
  method: string,
  url: string,
  body?: Record<string, any>,
  requestId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...niumConfig.headers,
    "x-request-id": requestId || crypto.randomUUID(),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new NiumError(
      error.message || `Nium API error: ${res.status}`,
      res.status,
      error.code
    );
  }

  return res.json() as Promise<T>;
}

export class NiumError extends Error {
  statusCode: number;
  code?: string;
  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "NiumError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ─── KYC / Customer Onboarding ───

/**
 * Create a Nium customer (individual) with KYC.
 * Maps to: POST /api/v4/client/{clientHashId}/customer (Unified Add Customer)
 *
 * For Gulf-based users: eKYC may be available
 * For Africa-based users: document-based manual KYC
 */
export async function onboardCustomer(params: {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  countryCode: string; // ISO 3166-1 alpha-2 (e.g., "AE", "NG")
  nationality: string;
  mobile: string;
  address: {
    line1: string;
    city: string;
    state?: string;
    postcode: string;
    country: string; // ISO 2-letter
  };
  identityDocument?: {
    type: string; // PASSPORT, NATIONAL_ID
    number: string;
    issuingCountry: string;
    expiryDate: string;
  };
}): Promise<NiumCustomer> {
  const url = niumConfig.clientUrl("/customer", "v4");

  const body: Record<string, any> = {
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    dateOfBirth: params.dateOfBirth,
    countryCode: params.countryCode,
    nationality: params.nationality,
    mobile: params.mobile,
    kycMode: "MANUAL_KYC",
    billingAddress1: params.address.line1,
    billingCity: params.address.city,
    billingState: params.address.state,
    billingZipCode: params.address.postcode,
    billingCountry: params.address.country,
  };

  if (params.identityDocument) {
    body.identificationDoc = [
      {
        identificationType: params.identityDocument.type,
        identificationValue: params.identityDocument.number,
        identificationDocIssuanceCountry: params.identityDocument.issuingCountry,
        identificationDocExpiry: params.identityDocument.expiryDate,
      },
    ];
  }

  return niumRequest<NiumCustomer>("POST", url, body);
}

/**
 * Get customer KYC/compliance status.
 * Maps to: GET /api/v1/client/{clientHashId}/customer/{customerHashId}
 */
export async function getCustomerStatus(customerHashId: string) {
  const url = niumConfig.clientUrl(`/customer/${customerHashId}`);
  return niumRequest<{
    customerHashId: string;
    complianceStatus: string;
    kycStatus: string;
    walletHashId: string;
  }>("GET", url);
}

// ─── FX (Foreign Exchange) ───

/**
 * Get an FX quote with optional rate lock.
 * Maps to: POST /api/v1/client/{clientHashId}/fx/quote
 *
 * Rates refresh every 5 minutes (Reuters source).
 * Lock periods: 5min, 15min, 1hr, 4hr, 8hr, 24hr
 */
export async function getFxQuote(params: {
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount?: number;
  destinationAmount?: number;
  lockPeriod?: string; // "5_MIN" | "15_MIN" | "1_HOUR" | "4_HOURS" | "8_HOURS" | "24_HOURS"
}): Promise<NiumFxQuote> {
  const url = niumConfig.clientUrl("/fx/quote");

  const body: Record<string, any> = {
    sourceCurrencyCode: params.sourceCurrency,
    destinationCurrencyCode: params.destinationCurrency,
  };

  if (params.sourceAmount) body.sourceAmount = params.sourceAmount;
  if (params.destinationAmount) body.destinationAmount = params.destinationAmount;
  if (params.lockPeriod) body.lockPeriod = params.lockPeriod;

  const res = await niumRequest<any>("POST", url, body);

  return {
    quoteId: res.quoteId || res.conversionId,
    sourceCurrency: params.sourceCurrency,
    destinationCurrency: params.destinationCurrency,
    sourceAmount: parseFloat(res.sourceAmount),
    destinationAmount: parseFloat(res.destinationAmount),
    exchangeRate: parseFloat(res.exchangeRate),
    lockPeriod: params.lockPeriod || "5_MIN",
    expiresAt: res.expiryTime || "",
  };
}

/**
 * Execute an FX conversion (locked or immediate).
 * Maps to: POST /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/fx/conversion
 */
export async function executeFxConversion(params: {
  customerHashId: string;
  walletHashId: string;
  quoteId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceAmount: number;
}): Promise<{ conversionId: string; status: string; exchangeRate: number }> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/fx/conversion`
  );

  return niumRequest("POST", url, {
    quoteId: params.quoteId,
    sourceCurrencyCode: params.sourceCurrency,
    destinationCurrencyCode: params.destinationCurrency,
    sourceAmount: params.sourceAmount,
  });
}

// ─── Payouts / Remittance ───

/**
 * Send a cross-border payout.
 * Maps to: POST /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/remittance
 *
 * Supports: bank transfer (local ACH, SWIFT), mobile wallet, Visa Direct, cash pickup
 * Gulf→Africa via Ecobank partnership (35 markets, 80%+ settle within 15 min)
 */
export async function createPayout(params: {
  customerHashId: string;
  walletHashId: string;
  amount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationCountry: string; // ISO 2-letter
  payoutMethod: "LOCAL" | "SWIFT" | "VISA_DIRECT" | "WALLET" | "CASH_PICKUP";
  beneficiary: {
    name: string;
    accountNumber?: string;
    bankCode?: string;
    bankName?: string;
    mobileNumber?: string;
    email?: string;
    address?: { line1: string; city: string; country: string };
  };
  purposeOfTransfer?: string;
  quoteId?: string;
  idempotencyKey?: string;
}): Promise<NiumPayout> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/remittance`
  );

  const body: Record<string, any> = {
    sourceAmount: params.amount,
    sourceCurrencyCode: params.sourceCurrency,
    destinationCurrencyCode: params.destinationCurrency,
    destinationCountry: params.destinationCountry,
    payoutMethod: params.payoutMethod,
    beneficiaryName: params.beneficiary.name,
    purposeOfTransfer: params.purposeOfTransfer || "FAMILY_MAINTENANCE",
  };

  if (params.quoteId) body.quoteId = params.quoteId;
  if (params.beneficiary.accountNumber) body.beneficiaryAccountNumber = params.beneficiary.accountNumber;
  if (params.beneficiary.bankCode) body.beneficiaryBankCode = params.beneficiary.bankCode;
  if (params.beneficiary.mobileNumber) body.beneficiaryMobileNumber = params.beneficiary.mobileNumber;
  if (params.beneficiary.email) body.beneficiaryEmail = params.beneficiary.email;

  return niumRequest<NiumPayout>(
    "POST",
    url,
    body,
    params.idempotencyKey
  );
}

/**
 * Track payout status.
 * Maps to: GET /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/remittance/{systemReferenceNumber}
 */
export async function getPayoutStatus(params: {
  customerHashId: string;
  walletHashId: string;
  systemReferenceNumber: string;
}): Promise<{
  systemReferenceNumber: string;
  status: string;
  subStatus?: string;
  failureReason?: string;
}> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/remittance/${params.systemReferenceNumber}`
  );
  return niumRequest("GET", url);
}

// ─── Account Verification (Nium Verify) ───

/**
 * Pre-validate a beneficiary bank account before payout.
 * Maps to: POST /api/v1/client/{clientHashId}/customer/{customerHashId}/accountVerification
 *
 * Reduces payout failure rates from ~10-15% to near zero.
 */
export async function verifyAccount(params: {
  customerHashId: string;
  destinationCountry: string;
  payoutMethod: "LOCAL" | "PROXY";
  bankCode?: string;
  accountNumber?: string;
  proxyType?: string;
  proxyValue?: string;
}): Promise<NiumAccountVerification> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/accountVerification`
  );

  const body: Record<string, any> = {
    destinationCountry: params.destinationCountry,
    payoutMethod: params.payoutMethod,
  };

  if (params.bankCode) body.bankCode = params.bankCode;
  if (params.accountNumber) body.accountNumber = params.accountNumber;
  if (params.proxyType) body.proxyType = params.proxyType;
  if (params.proxyValue) body.proxyValue = params.proxyValue;

  return niumRequest("POST", url, body);
}

// ─── Virtual Cards ───

/**
 * Issue a virtual card (~200ms).
 * Maps to: POST /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/card
 *
 * Supported in 30+ markets. Visa/Mastercard. Apple Pay / Google Pay tokenization.
 */
export async function issueVirtualCard(params: {
  customerHashId: string;
  walletHashId: string;
  cardType: "VIRTUAL";
  cardScheme: "VISA" | "MASTERCARD";
  currency: string;
  spendingLimit?: number;
}): Promise<NiumCard> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/card`
  );

  return niumRequest("POST", url, {
    cardIssuanceAction: "NEW",
    cardType: params.cardType,
    cardScheme: params.cardScheme,
    cardCurrency: params.currency,
    ...(params.spendingLimit && { cardTransactionLimit: params.spendingLimit }),
  });
}

/**
 * Get card details.
 * Maps to: GET /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/card/{cardHashId}
 */
export async function getCardDetails(params: {
  customerHashId: string;
  walletHashId: string;
  cardHashId: string;
}): Promise<NiumCard & { cardNumber: string; cvv: string }> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/card/${params.cardHashId}`
  );
  return niumRequest("GET", url);
}

/**
 * Block/unblock a card.
 * Maps to: POST /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/card/{cardHashId}/block
 */
export async function toggleCardBlock(params: {
  customerHashId: string;
  walletHashId: string;
  cardHashId: string;
  action: "BLOCK" | "UNBLOCK";
  reason?: string;
}): Promise<{ status: string }> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/card/${params.cardHashId}/${params.action.toLowerCase()}`
  );
  return niumRequest("POST", url, { reason: params.reason || "User request" });
}

// ─── Wallet ───

/**
 * Get wallet balances for a customer.
 * Maps to: GET /api/v1/client/{clientHashId}/customer/{customerHashId}/wallet/{walletHashId}/balance
 */
export async function getWalletBalances(params: {
  customerHashId: string;
  walletHashId: string;
}): Promise<Array<{ currency: string; balance: number; available: number }>> {
  const url = niumConfig.clientUrl(
    `/customer/${params.customerHashId}/wallet/${params.walletHashId}/balance`
  );
  return niumRequest("GET", url);
}

// ─── Webhook Verification ───

/**
 * Verify Nium webhook signature.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!niumConfig.webhookSecret) return false;
  const computed = crypto
    .createHmac("sha256", niumConfig.webhookSecret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
