/**
 * Flutterwave Service — African last-mile specialist
 *
 * Handles: Payment collection (cards, bank transfers, mobile money),
 * payouts to African bank accounts & mobile wallets, bill payments,
 * virtual cards (USD/NGN), and FX rates.
 *
 * API docs: https://developer.flutterwave.com/
 * v3 (stable): Bearer token auth, JSON payloads
 */

import { flutterwaveConfig } from "../config/providers";
import crypto from "crypto";

// ─── Types ───

export interface FlwPaymentInitiation {
  status: string;
  message: string;
  data: {
    link: string;
    tx_ref: string;
  };
}

export interface FlwTransfer {
  status: string;
  message: string;
  data: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    bank_name?: string;
    account_number?: string;
    narration: string;
    complete_message: string;
    created_at: string;
  };
}

export interface FlwBillPayment {
  status: string;
  message: string;
  data: {
    phone_number?: string;
    amount: number;
    network?: string;
    flw_ref: string;
    tx_ref: string;
    reference: string;
  };
}

export interface FlwVirtualCard {
  status: string;
  data: {
    id: string;
    account_id: number;
    amount: string;
    currency: string;
    card_pan: string;
    masked_pan: string;
    city: string;
    state: string;
    address_1: string;
    cvv: string;
    expiration: string;
    is_active: boolean;
  };
}

export interface FlwExchangeRate {
  status: string;
  data: {
    rate: number;
    source: { currency: string; amount: number };
    destination: { currency: string; amount: number };
  };
}

// ─── HTTP Helper ───

async function flwRequest<T>(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<T> {
  const url = flutterwaveConfig.url(path);
  const res = await fetch(url, {
    method,
    headers: flutterwaveConfig.headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || data.status === "error") {
    throw new FlutterwaveError(
      data.message || `Flutterwave API error: ${res.status}`,
      res.status,
      data.data
    );
  }

  return data as T;
}

export class FlutterwaveError extends Error {
  statusCode: number;
  details?: any;
  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = "FlutterwaveError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ─── Payment Collection (Accept payments from users) ───

/**
 * Initialize a payment (card, bank transfer, mobile money, USSD).
 * Maps to: POST /v3/payments
 *
 * Returns a hosted checkout link. User completes payment there.
 * Webhook fires on completion.
 */
export async function initiatePayment(params: {
  tx_ref: string; // your unique reference
  amount: number;
  currency: string; // NGN, GHS, KES, ZAR, USD
  customer: {
    email: string;
    name: string;
    phonenumber?: string;
  };
  redirect_url: string;
  payment_options?: string; // "card,banktransfer,mobilemoney,ussd"
  meta?: Record<string, any>;
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
}): Promise<FlwPaymentInitiation> {
  return flwRequest("POST", "/payments", {
    ...params,
    customizations: params.customizations || {
      title: "GuildPay",
      description: "Fund your GuildPay wallet",
      logo: "https://pay.guildpay.com/logo.png",
    },
  });
}

/**
 * Verify a transaction after payment.
 * Maps to: GET /v3/transactions/{id}/verify
 *
 * ALWAYS verify server-side after webhook — never trust client-side callbacks alone.
 */
export async function verifyTransaction(transactionId: string): Promise<{
  status: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer: { email: string; name: string };
    created_at: string;
  };
}> {
  return flwRequest("GET", `/transactions/${transactionId}/verify`);
}

// ─── Transfers / Payouts (Send money to bank accounts & mobile money) ───

/**
 * Create a bank transfer payout.
 * Maps to: POST /v3/transfers
 *
 * Supports: Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda
 */
export async function createBankTransfer(params: {
  account_bank: string; // bank code (e.g., "044" for Access Bank NG)
  account_number: string;
  amount: number;
  currency: string; // NGN, GHS, KES, ZAR, UGX, TZS
  narration: string;
  reference: string; // your unique reference (idempotency key)
  beneficiary_name?: string;
  debit_currency?: string; // currency to debit from Flutterwave balance
  meta?: Array<{ sender: string; sender_country: string }>;
}): Promise<FlwTransfer> {
  return flwRequest("POST", "/transfers", params);
}

/**
 * Create a mobile money payout.
 * Maps to: POST /v3/transfers
 *
 * account_bank codes: "MPS" (M-Pesa KE), "MTN" (MTN GH), "VODAFONE" (Vodafone GH)
 */
export async function createMobileMoneyTransfer(params: {
  account_bank: string; // "MPS" for M-Pesa, "MTN" for MTN MoMo
  account_number: string; // phone with country code, e.g., "+254712345678"
  amount: number;
  currency: string; // KES, GHS, UGX, TZS
  narration: string;
  reference: string;
  beneficiary_name?: string;
}): Promise<FlwTransfer> {
  return flwRequest("POST", "/transfers", {
    ...params,
    type: "mobile_money",
  });
}

/**
 * Get transfer status.
 * Maps to: GET /v3/transfers/{id}
 */
export async function getTransferStatus(transferId: number): Promise<FlwTransfer> {
  return flwRequest("GET", `/transfers/${transferId}`);
}

/**
 * Get supported banks for a country.
 * Maps to: GET /v3/banks/{country}
 */
export async function getBanks(countryCode: string): Promise<{
  status: string;
  data: Array<{ id: number; code: string; name: string }>;
}> {
  return flwRequest("GET", `/banks/${countryCode}`);
}

/**
 * Resolve/verify a bank account before sending.
 * Maps to: POST /v3/accounts/resolve
 */
export async function resolveAccount(params: {
  account_number: string;
  account_bank: string; // bank code
}): Promise<{
  status: string;
  data: {
    account_number: string;
    account_name: string;
  };
}> {
  return flwRequest("POST", "/accounts/resolve", params);
}

// ─── Mobile Money Collection ───

/**
 * Charge mobile money (M-Pesa, MTN MoMo, Vodafone Cash).
 * Maps to: POST /v3/charges?type=mobile_money_{country}
 *
 * User receives an STK push or authorization prompt on their phone.
 */
export async function chargeMobileMoney(params: {
  tx_ref: string;
  amount: number;
  currency: string; // KES, GHS, UGX, TZS
  phone_number: string;
  email: string;
  network?: string; // "MTN", "VODAFONE", "TIGO" (for Ghana)
  country: string; // "KE", "GH", "UG", "TZ"
}): Promise<{
  status: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    status: string;
    auth_model: string;
  };
}> {
  const countryMap: Record<string, string> = {
    KE: "mpesa",
    GH: "mobile_money_ghana",
    UG: "mobile_money_uganda",
    TZ: "mobile_money_tanzania",
    RW: "mobile_money_rwanda",
  };

  const type = countryMap[params.country] || "mobile_money";

  return flwRequest("POST", `/charges?type=${type}`, {
    tx_ref: params.tx_ref,
    amount: params.amount,
    currency: params.currency,
    phone_number: params.phone_number,
    email: params.email,
    network: params.network,
  });
}

// ─── Bill Payments (Nigeria primarily) ───

/**
 * Pay a bill (airtime, data, electricity, TV, internet).
 * Maps to: POST /v3/bills
 *
 * Supported categories: airtime, data, power, cable, internet, education
 * Full biller coverage: Nigeria only. Kenya/Ghana: airtime only.
 */
export async function payBill(params: {
  country: string; // "NG", "GH", "KE", "US"
  customer: string; // phone number, meter number, smartcard ID
  amount: number;
  recurrence?: "ONCE" | "WEEKLY" | "MONTHLY";
  type: string; // biller slug (e.g., "AIRTIME", "DSTV", "EKO-ELECTRIC")
  reference: string;
  biller_name?: string;
}): Promise<FlwBillPayment> {
  return flwRequest("POST", "/bills", params);
}

/**
 * Get available bill categories.
 * Maps to: GET /v3/bill-categories
 */
export async function getBillCategories(): Promise<{
  status: string;
  data: Array<{
    id: number;
    biller_code: string;
    name: string;
    country: string;
    is_airtime: boolean;
    biller_name: string;
    item_code: string;
    amount: number;
    label_name: string;
  }>;
}> {
  return flwRequest("GET", "/bill-categories");
}

/**
 * Validate a bill customer (e.g., check meter number, smartcard ID).
 * Maps to: GET /v3/bill-items/{item_code}/validate?customer={customer}
 */
export async function validateBillCustomer(params: {
  item_code: string;
  customer: string;
  code: string; // biller code
}): Promise<{
  status: string;
  data: {
    response_code: string;
    address: string;
    response_message: string;
    name: string;
  };
}> {
  return flwRequest(
    "GET",
    `/bill-items/${params.item_code}/validate?customer=${params.customer}&code=${params.code}`
  );
}

// ─── Virtual Cards (USD / NGN only) ───

/**
 * Create a virtual card.
 * Maps to: POST /v3/virtual-cards
 */
export async function createVirtualCard(params: {
  currency: "USD" | "NGN";
  amount: number; // initial funding amount
  billing_name: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
  billing_country: string;
  callback_url?: string;
}): Promise<FlwVirtualCard> {
  return flwRequest("POST", "/virtual-cards", params);
}

/**
 * Fund a virtual card.
 * Maps to: POST /v3/virtual-cards/{id}/fund
 */
export async function fundVirtualCard(
  cardId: string,
  amount: number,
  debitCurrency: string
): Promise<{ status: string; message: string }> {
  return flwRequest("POST", `/virtual-cards/${cardId}/fund`, {
    amount,
    debit_currency: debitCurrency,
  });
}

/**
 * Block/unblock a virtual card.
 * Maps to: PUT /v3/virtual-cards/{id}/status/{action}
 */
export async function toggleVirtualCard(
  cardId: string,
  action: "block" | "unblock"
): Promise<{ status: string; message: string }> {
  return flwRequest("PUT", `/virtual-cards/${cardId}/status/${action}`);
}

// ─── FX Exchange Rates ───

/**
 * Get exchange rate for a currency pair.
 * Maps to: GET /v3/rates?from={from}&to={to}&amount={amount}
 *
 * Rates update 3-4 times daily.
 * Rates are estimates; actual rate may differ at execution.
 */
export async function getExchangeRate(params: {
  from: string;
  to: string;
  amount: number;
}): Promise<FlwExchangeRate> {
  return flwRequest(
    "GET",
    `/rates?from=${params.from}&to=${params.to}&amount=${params.amount}`
  );
}

// ─── Sub-Accounts ───

/**
 * Create a sub-account for agent/partner commissions.
 * Maps to: POST /v3/subaccounts
 */
export async function createSubAccount(params: {
  account_bank: string;
  account_number: string;
  business_name: string;
  split_type: "flat" | "percentage";
  split_value: number;
  business_email: string;
  country: string;
}): Promise<{ status: string; data: { id: number; subaccount_id: string } }> {
  return flwRequest("POST", "/subaccounts", params);
}

// ─── Webhook Verification ───

/**
 * Verify Flutterwave webhook signature.
 * Compare the `verif-hash` header against your FLUTTERWAVE_WEBHOOK_HASH.
 */
export function verifyWebhookSignature(verifHash: string): boolean {
  if (!flutterwaveConfig.webhookHash) return false;
  return verifHash === flutterwaveConfig.webhookHash;
}

/**
 * Always verify a transaction after receiving a webhook.
 * Webhooks can be spoofed — server-side verification is mandatory.
 */
export async function verifyWebhookTransaction(transactionId: number) {
  const result = await verifyTransaction(String(transactionId));
  return result.data.status === "successful";
}
