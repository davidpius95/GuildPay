// Provider configuration — centralizes all Nium + Flutterwave settings
// All values are lazy getters so they read process.env AFTER dotenv loads.

export const niumConfig = {
  get baseUrl() { return process.env.NIUM_API_BASE_URL || "https://gateway.nium.com"; },
  get clientHashId() { return process.env.NIUM_CLIENT_HASH_ID || ""; },
  get apiKey() { return process.env.NIUM_API_KEY || ""; },
  get webhookSecret() { return process.env.NIUM_WEBHOOK_SECRET || ""; },

  get headers() {
    return {
      "x-api-key": this.apiKey,
      "x-client-name": "GuildPay",
      "Content-Type": "application/json",
    };
  },

  clientUrl(path: string) {
    return `${this.baseUrl}/api/v1/client/${this.clientHashId}${path}`;
  },
};

export const flutterwaveConfig = {
  get baseUrl() { return process.env.FLUTTERWAVE_API_BASE_URL || "https://api.flutterwave.com/v3"; },
  get publicKey() { return process.env.FLUTTERWAVE_PUBLIC_KEY || ""; },
  get secretKey() { return process.env.FLUTTERWAVE_SECRET_KEY || ""; },
  get encryptionKey() { return process.env.FLUTTERWAVE_ENCRYPTION_KEY || ""; },
  get webhookHash() { return process.env.FLUTTERWAVE_WEBHOOK_HASH || ""; },

  get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
  },

  url(path: string) {
    return `${this.baseUrl}${path}`;
  },
};
