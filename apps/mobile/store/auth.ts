import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api, authApi, userApi } from "../services/api";

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  referralCode?: string;
  profile?: {
    firstName: string;
    lastName: string;
    country: string;
    kycTier: string;
    avatarUrl?: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  signup: (email: string, password: string, referralCode?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateProfile: (data: Partial<User["profile"]>) => Promise<void>;
  setPin: (pin: string, currentPin?: string) => Promise<void>;
  submitKyc: (data: any) => Promise<any>;
  getKycStatus: () => Promise<any>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  signup: async (email, password, referralCode) => {
    const res = await authApi.signup(email, password, referralCode);
    const { user, accessToken, refreshToken } = res.data;

    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);

    set({ user, accessToken, isAuthenticated: true });
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    const { user, accessToken, refreshToken } = res.data;

    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);

    set({ user, accessToken, isAuthenticated: true });
  },

  verifyOtp: async (code) => {
    await authApi.verifyOtp(code);
    set((state) => ({
      user: state.user ? { ...state.user, emailVerified: true } : null,
    }));
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) throw new Error("No refresh token");

      const res = await authApi.refreshToken(refreshToken);
      const { accessToken, refreshToken: newRefreshToken } = res.data;

      await SecureStore.setItemAsync("accessToken", accessToken);
      await SecureStore.setItemAsync("refreshToken", newRefreshToken);

      set({ accessToken });
    } catch {
      get().logout();
    }
  },

  loadSession: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (!accessToken) {
        set({ isLoading: false });
        return;
      }

      set({ accessToken });
      const res = await userApi.getMe();
      set({ user: res.data, isAuthenticated: true, isLoading: false });
    } catch {
      await get().refreshToken();
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const res = await userApi.updateProfile(data);
    set((state) => ({
      user: state.user ? { ...state.user, profile: { ...state.user.profile, ...res.data } as any } : null,
    }));
  },

  setPin: async (pin, currentPin) => {
    await userApi.setPin(pin, currentPin);
  },

  submitKyc: async (data) => {
    const res = await userApi.submitKyc(data);
    return res.data;
  },

  getKycStatus: async () => {
    const res = await userApi.getKycStatus();
    return res.data;
  },
}));
