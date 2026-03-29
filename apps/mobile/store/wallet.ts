import { create } from "zustand";
import { walletApi, transferApi, cardApi, billApi } from "../services/api";

interface WalletBalance {
  currency: string;
  balance: number;
  locked: number;
  available: number;
  usdValue: number;
}

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  fee: number;
  toAmount: number | null;
  toCurrency: string | null;
  note: string | null;
  provider: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface FxQuote {
  provider: string;
  from: { currency: string; amount: number };
  to: { currency: string; amount: number };
  exchangeRate: number;
  expiresAt?: string;
}

interface WalletState {
  walletId: string | null;
  totalBalanceUsd: number;
  balances: WalletBalance[];
  transactions: Transaction[];
  corridors: string[];
  isLoading: boolean;

  fetchWallet: () => Promise<void>;
  fetchTransactions: (page?: number, currency?: string) => Promise<void>;
  fetchCorridors: () => Promise<void>;
  addCurrency: (currency: string) => Promise<void>;
  getFxQuote: (from: string, to: string, amount: number) => Promise<FxQuote>;
  verifyAccount: (data: { accountNumber: string; bankCode: string; countryCode: string }) => Promise<any>;
  sendMoney: (data: {
    recipientId: string;
    amount: number;
    currency: string;
    toCurrency?: string;
    note?: string;
    pin: string;
    preferredProvider?: "nium" | "flutterwave";
  }) => Promise<{ transactionId: string }>;
  topUp: (data: {
    amount: number;
    currency: string;
    paymentMethod?: "card" | "bank_transfer" | "mobile_money";
    mobileCountry?: string;
  }) => Promise<{ paymentLink?: string; providerRef?: string }>;
  withdraw: (data: {
    amount: number;
    currency: string;
    toCurrency: string;
    rail: "BANK_TRANSFER" | "MOBILE_MONEY";
    bankCode?: string;
    accountNumber?: string;
    mobileNumber?: string;
    mobileProvider?: string;
    beneficiaryName: string;
    countryCode: string;
    pin: string;
  }) => Promise<{ transactionId: string }>;
  exchange: (data: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    pin: string;
  }) => Promise<{ transactionId: string }>;
  trackTransfer: (id: string) => Promise<any>;
  generatePaymentLink: (data?: { amount?: number; currency?: string; note?: string }) => Promise<any>;
  createCard: (currency?: string) => Promise<any>;
  fundCard: (cardId: string, amount: number) => Promise<any>;
  buyAirtime: (data: {
    provider: string;
    phoneNumber: string;
    amount: number;
    currency?: string;
  }) => Promise<any>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  walletId: null,
  totalBalanceUsd: 0,
  balances: [],
  transactions: [],
  corridors: [],
  isLoading: false,

  fetchWallet: async () => {
    set({ isLoading: true });
    try {
      const res = await walletApi.getWallets();
      set({
        walletId: res.data.walletId,
        totalBalanceUsd: res.data.totalBalanceUsd,
        balances: res.data.balances,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  fetchTransactions: async (page = 1, currency) => {
    const res = await walletApi.getStatement({ page, currency });
    set({ transactions: res.data.transactions });
  },

  fetchCorridors: async () => {
    const res = await transferApi.getCorridors();
    set({ corridors: res.data.corridors });
  },

  addCurrency: async (currency) => {
    await walletApi.addCurrency(currency);
    await get().fetchWallet();
  },

  getFxQuote: async (from, to, amount) => {
    const res = await transferApi.getFxQuote(from, to, amount);
    return res.data;
  },

  verifyAccount: async (data) => {
    const res = await transferApi.verifyAccount(data);
    return res.data;
  },

  sendMoney: async (data) => {
    const res = await transferApi.send(data);
    await get().fetchWallet();
    return { transactionId: res.data.transactionId };
  },

  topUp: async (data) => {
    const res = await transferApi.topup(data);
    return {
      paymentLink: res.data.paymentLink,
      providerRef: res.data.providerRef,
    };
  },

  withdraw: async (data) => {
    const res = await transferApi.withdraw(data);
    await get().fetchWallet();
    return { transactionId: res.data.transactionId };
  },

  exchange: async (data) => {
    const res = await transferApi.exchange(data);
    await get().fetchWallet();
    return { transactionId: res.data.transactionId };
  },

  trackTransfer: async (id) => {
    const res = await transferApi.track(id);
    return res.data;
  },

  generatePaymentLink: async (data) => {
    const res = await transferApi.generatePaymentLink(data);
    return res.data;
  },

  createCard: async (currency = "USD") => {
    const res = await cardApi.create({ currency });
    return res.data;
  },

  fundCard: async (cardId, amount) => {
    const res = await cardApi.fund(cardId, amount);
    await get().fetchWallet();
    return res.data;
  },

  buyAirtime: async (data) => {
    const res = await billApi.buyAirtime(data);
    await get().fetchWallet();
    return res.data;
  },
}));
