import * as SecureStore from "expo-secure-store";

const BASE_URL = __DEV__
  ? "http://localhost:3001/api/v1"
  : "https://api.guildpay.com/api/v1";

interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = await SecureStore.getItemAsync("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.getHeaders();

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await this.refreshAndRetry(method, path, body);
          if (refreshed) return refreshed;
        }

        throw new ApiError(
          data.error || "Request failed",
          response.status,
          data.code || "UNKNOWN"
        );
      }

      return { data, status: response.status, ok: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Network error", 0, "NETWORK_ERROR");
    }
  }

  private async refreshAndRetry<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<ApiResponse<T> | null> {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return null;

      const res = await fetch(`${this.baseUrl}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const tokens = await res.json();
      await SecureStore.setItemAsync("accessToken", tokens.accessToken);
      await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);

      return this.request<T>(method, path, body);
    } catch {
      return null;
    }
  }

  async get<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path);
  }

  async post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body);
  }

  async put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path);
  }
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

export const api = new ApiClient(BASE_URL);

// ─── Typed API methods for all endpoints ───

export const authApi = {
  signup: (email: string, password: string, referralCode?: string) =>
    api.post("/auth/signup", { email, password, referralCode }),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  verifyOtp: (code: string) =>
    api.post("/auth/verify-otp", { code }),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  refreshToken: (refreshToken: string) =>
    api.post("/auth/refresh-token", { refreshToken }),
};

export const userApi = {
  getMe: () => api.get("/users/me"),
  updateProfile: (data: any) => api.put("/users/me", data),
  setPin: (pin: string, currentPin?: string) =>
    api.post("/users/me/pin", { pin, currentPin }),
  submitKyc: (data: any) => api.post("/users/me/kyc", data),
  getKycStatus: () => api.get("/users/me/kyc/status"),
};

export const walletApi = {
  getWallets: () => api.get("/wallets"),
  addCurrency: (currency: string) =>
    api.post("/wallets/currencies", { currency }),
  getStatement: (params?: { page?: number; limit?: number; currency?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.currency) qs.set("currency", params.currency);
    return api.get(`/wallets/statement?${qs}`);
  },
};

export const transferApi = {
  send: (data: {
    recipientId: string;
    amount: number;
    currency: string;
    toCurrency?: string;
    note?: string;
    pin: string;
    preferredProvider?: "nium" | "flutterwave";
  }) => api.post("/transfers/send", data),

  topup: (data: {
    amount: number;
    currency: string;
    paymentMethod?: "card" | "bank_transfer" | "mobile_money";
    mobileCountry?: string;
  }) => api.post("/transfers/topup", data),

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
  }) => api.post("/transfers/withdraw", data),

  exchange: (data: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    pin: string;
  }) => api.post("/transfers/exchange", data),

  getFxQuote: (from: string, to: string, amount: number) =>
    api.get(`/transfers/fx/quote?from=${from}&to=${to}&amount=${amount}`),

  getCorridors: () => api.get("/transfers/corridors"),

  getCorridorRoutes: (from: string, to: string) =>
    api.get(`/transfers/corridors/${from}/${to}`),

  verifyAccount: (data: {
    accountNumber: string;
    bankCode: string;
    countryCode: string;
    provider?: "nium" | "flutterwave";
  }) => api.post("/transfers/verify-account", data),

  track: (id: string) => api.get(`/transfers/${id}/track`),

  generatePaymentLink: (data?: { amount?: number; currency?: string; note?: string }) =>
    api.post("/transfers/receive/link", data),
};

export const recipientApi = {
  getAll: () => api.get("/recipients"),
  create: (data: {
    name: string;
    country: string;
    countryCode: string;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    mobileNumber?: string;
    mobileProvider?: string;
    walletAddress?: string;
    email?: string;
  }) => api.post("/recipients", data),
  delete: (id: string) => api.delete(`/recipients/${id}`),
};

export const cardApi = {
  getAll: () => api.get("/cards"),
  create: (data: { currency?: string; spendingLimit?: number }) =>
    api.post("/cards/create", data),
  fund: (cardId: string, amount: number) =>
    api.post("/cards/fund", { cardId, amount }),
  freeze: (cardId: string, frozen: boolean) =>
    api.put("/cards/freeze", { cardId, frozen }),
  getDetails: (id: string) => api.get(`/cards/${id}/details`),
};

export const billApi = {
  pay: (data: {
    type: string;
    billerCode: string;
    customer: string;
    amount: number;
    currency?: string;
    country?: string;
  }) => api.post("/bills/pay", data),
  buyAirtime: (data: {
    provider: string;
    phoneNumber: string;
    amount: number;
    currency?: string;
    country?: string;
  }) => api.post("/bills/airtime", data),
  getCategories: () => api.get("/bills/categories"),
  validateCustomer: (data: { itemCode: string; customer: string; billerCode: string }) =>
    api.post("/bills/validate", data),
  getProviders: () => api.get("/bills/providers"),
};

export const notificationApi = {
  getAll: () => api.get("/notifications"),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};
