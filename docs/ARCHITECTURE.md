# GuildPay — Architecture & Implementation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE APP                            │
│               React Native (Expo)                        │
│         iOS + Android + Web Preview                      │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTPS / REST + WebSocket
                   v
┌─────────────────────────────────────────────────────────┐
│               API GATEWAY (Node.js/TS)                   │
│   Express + Prisma + JWT + Rate Limiting                 │
│                                                          │
│   Routes:                                                │
│   /auth       – signup, login, OTP, refresh              │
│   /users      – profile, PIN, KYC (via Nium)            │
│   /wallets    – balances (12 currencies), statements     │
│   /transfers  – send, topup, withdraw, exchange, FX      │
│   /cards      – virtual cards (Nium/Flutterwave)         │
│   /bills      – airtime, data, utilities (Flutterwave)   │
│   /webhooks   – Nium + Flutterwave event handlers        │
│                                                          │
│   Services Layer:                                        │
│   ├── nium.ts        – KYC, FX, payouts, cards, verify   │
│   ├── flutterwave.ts – collections, MoMo, bills, payouts │
│   └── payment-router.ts – smart corridor routing         │
│                                                          │
│   Delegates payment ops to Go service via gRPC ─────────┐│
└──────────────────┬──────────────────────────────────────┘│
                   │ gRPC                                   │
                   v                                        │
┌─────────────────────────────────────────────────────────┐│
│           PAYMENT SERVICE (Go)                           ││
│   Fiber + Double-entry Ledger + Smart Router             ││
│                                                          ││
│   /transfer  – send money via selected provider          ││
│   /topup     – fund wallet (Nium/Flutterwave)            ││
│   /withdraw  – cashout to bank/mobile money              ││
│   /exchange  – FX conversion                             ││
│   /rates     – live FX rates                             ││
│                                                          ││
│   Smart Router: 30+ corridors, picks cheapest rail       ││
│   Ledger: double-entry debit/credit for every txn        ││
└──────────────────┬──────────────────────────────────────┘│
                   │                                        │
    ┌──────────────┼──────────────┐                        │
    v              v              v                         │
┌────────┐  ┌──────────┐  ┌────────────────┐              │
│  Nium  │  │Flutterwave│  │  Blockchain   │              │
│        │  │           │  │  (Base/USDC)  │              │
│ Gulf   │  │  Africa   │  │              │              │
│ Global │  │  Local    │  │              │              │
└────────┘  └──────────┘  └────────────────┘              │
                                                           │
┌─────────────────────────────────────────────────────────┐│
│                   DATABASE LAYER                         ││
│                                                          ││
│   PostgreSQL (primary)                                   ││
│   ├── users, profiles, kyc_documents                     ││
│   ├── wallets (with niumCustomerHashId/niumWalletHashId) ││
│   ├── wallet_balances (12 currencies incl AED/SAR/QAR)   ││
│   ├── ledger_entries (double-entry bookkeeping)          ││
│   ├── transactions (with provider + providerRef)         ││
│   ├── transfer_tracking (status progression)             ││
│   ├── recipients, payment_methods                        ││
│   ├── virtual_cards (Nium or Flutterwave)                ││
│   ├── bill_payments (Flutterwave)                        ││
│   └── notifications, referrals                           ││
│                                                          ││
│   Redis (caching + sessions + rate limiting)              ││
│   BullMQ (job queues: notifications, KYC processing)     ││
└─────────────────────────────────────────────────────────┘│
```

## Provider Responsibilities

### Nium (Global Infrastructure)

| Capability | API Endpoint | Details |
|-----------|-------------|---------|
| KYC Onboarding | `POST /customer` | eKYC (US) + document-based (other) |
| FX Quotes | `POST /fx/quote` | 5-min refresh, lockable 5min-24hr |
| Cross-border Payouts | `POST /remittance` | 190+ countries, Ecobank (35 Africa) |
| Account Verification | `POST /accountVerification` | Pre-validate before payout |
| Virtual Cards | `POST /card` | Visa/Mastercard, 30+ markets, ~200ms |
| Card Management | `POST /card/{id}/block` | Block/unblock, spending limits |
| Wallet Balances | `GET /balance` | Multi-currency wallet balances |

### Flutterwave (African Last-Mile)

| Capability | API Endpoint | Details |
|-----------|-------------|---------|
| Payment Collection | `POST /payments` | Cards, bank, mobile money, USSD |
| Bank Payouts | `POST /transfers` | 34 African countries |
| Mobile Money Payouts | `POST /transfers` | M-Pesa, MTN MoMo |
| Mobile Money Collection | `POST /charges?type=mpesa` | STK push |
| Bill Payments | `POST /bills` | Airtime, data, utilities (NG primary) |
| Bill Validation | `GET /bill-items/{id}/validate` | Meter/smartcard verification |
| Bank Resolution | `POST /accounts/resolve` | Verify account before sending |
| Virtual Cards | `POST /virtual-cards` | USD/NGN only |
| FX Rates | `GET /rates` | 3-4x daily updates |
| Sub-Accounts | `POST /subaccounts` | Agent/partner commissions |

## Smart Payment Router

The router selects the optimal provider for each transfer based on corridor, cost, and speed:

### Routing Rules

1. **Gulf currencies (AED, SAR, QAR, BHD, OMR, KWD)** → Always Nium (local rails)
2. **African → African** → Flutterwave (local rails, mobile money)
3. **USD/GBP/EUR → Africa** → Compare Nium vs Flutterwave (cost-based)
4. **No direct corridor** → Route via USD intermediary
5. **Crypto** → Blockchain (USDT/USDC)

### Corridor Map (30+ routes)

```
Gulf → Africa:    AED/SAR → NGN, KES, GHS, ZAR (Nium via Ecobank)
Qatar ↔ Nigeria:  QAR → NGN (Nium/Doha Bank + Flutterwave)
                  NGN → QAR (Flutterwave collect + Nium Visa Direct, real-time)
Qatar → Africa:   QAR → KES, GHS (Nium via Ecobank)
USD → Africa:     USD → NGN, KES, GHS, ZAR (Nium or Flutterwave)
GBP → Africa:     GBP → NGN, KES, GHS (Nium)
EUR → Africa:     EUR → NGN, KES (Nium)
Africa → Africa:  NGN ↔ GHS, KES (Flutterwave)
Crypto:           USDT/USDC ↔ USD (Blockchain)
Internal:         Same currency → instant, free
```

## Provider Integration Status

### DEMO_MODE

All provider API calls have **gated sandbox fallbacks** controlled by the `DEMO_MODE` environment variable:

- `DEMO_MODE=true` — When a provider API fails, the system falls back to sandbox simulation (fake IDs, local-only state changes). Safe for development and demos.
- `DEMO_MODE=false` (or unset) — Provider failures are surfaced as errors. Required for production.

Sandbox-generated resources use identifiable prefixes: `sandbox_cust_*`, `sandbox_wallet_*`, `sandbox_bill_*`, `sandbox_*` (cards).

### Endpoint Wiring Summary

| Feature | Provider | Service Function | Route | Status |
|---------|----------|-----------------|-------|--------|
| KYC Onboarding | Nium | `onboardCustomer()` | `POST /users/me/kyc` | Wired (demo fallback) |
| KYC Status Polling | Nium | `getCustomerStatus()` | `GET /users/me/kyc/status` | Wired (auto tier upgrade) |
| Account Verification | Nium/Flw | `verifyAccount()` / `resolveAccount()` | Pre-send validation | Wired (non-blocking in demo) |
| FX Quotes | Nium/Flw | `getFxQuote()` / `getExchangeRate()` | `GET /transfers/fx/quote` | Wired (3-tier fallback) |
| FX Conversion | Nium | `executeFxConversion()` | `POST /transfers/exchange` | Wired (quoteId locked) |
| Payouts | Nium/Flw | `createPayout()` / `createBankTransfer()` | `POST /transfers/send` | Wired (demo fallback) |
| Payout Tracking | Nium/Flw | `getPayoutStatus()` / `getTransferStatus()` | Webhook-driven | Wired |
| Card Issuance | Nium/Flw | `issueVirtualCard()` / `createVirtualCard()` | `POST /cards/create` | Wired (demo fallback) |
| Card Details | Nium | `getCardDetails()` | `GET /cards/:id/details` | Wired (real cards only) |
| Card Freeze | Nium/Flw | `toggleCardBlock()` / `toggleVirtualCard()` | `PUT /cards/freeze` | Wired (real cards only) |
| Card Funding | Flw | `fundVirtualCard()` | `POST /cards/fund` | Wired (real cards only) |
| Bill Payments | Flw | `payBill()` | `POST /bills/pay` | Wired (demo fallback) |
| Bill Validation | Flw | `validateBillCustomer()` | `POST /bills/validate` | Wired (demo fallback) |
| Bill Categories | Flw | `getBillCategories()` | `GET /bills/categories` | Wired (demo fallback) |
| Bank List | Flw | `getBanks()` | `GET /recipients/banks/:country` | Wired (demo fallback) |
| Account Resolution | Flw | `resolveAccount()` | `POST /transfers/verify-account` | Wired |
| Payment Collection | Flw | `initiatePayment()` | `POST /transfers/topup` | Wired |
| Mobile Money Charge | Flw | `chargeMobileMoney()` | `POST /transfers/topup` (mobile) | Wired |
| Wallet Balances | Nium | `getWalletBalances()` | `GET /wallets` (sync) | Wired (non-sandbox only) |
| Sub-Accounts | Flw | `createSubAccount()` | `POST /transfers/sub-accounts` | Wired |
| Bill Recurrence | Flw | `payBill({recurrence})` | `POST /bills/pay` | Wired (ONCE/WEEKLY/MONTHLY) |
| Transaction Refunds | Flw | `refundTransaction()` | `POST /transfers/refund` | Wired (PIN-verified) |

### Pre-Send Account Verification

Before dispatching a transfer, the system pre-validates the recipient's bank account:
- **African countries (NG, GH, KE)** → Flutterwave `resolveAccount()`
- **All others** → Nium `verifyAccount()`
- In **production mode**, validation failure blocks the transfer
- In **demo mode**, validation failure is logged but non-blocking

## Webhook Architecture

Both providers send webhooks on transaction state changes:

### Flutterwave Webhooks (`POST /webhooks/flutterwave`)
1. Verify `verif-hash` header against `FLUTTERWAVE_WEBHOOK_HASH`
2. Verify transaction server-side via `GET /transactions/{id}/verify`
3. Handle: `charge.completed`, `transfer.completed`, `transfer.failed`
4. On completion: credit wallet, update transaction, notify user
5. On failure: unlock/refund funds, update transaction, notify user

### Nium Webhooks (`POST /webhooks/nium`)
1. Verify HMAC-SHA256 signature via `x-nium-signature` header
2. Handle payout statuses: `PAID`, `COMPLETED`, `DEEMED_PAID`, `IN_PROGRESS`, `SENT_TO_BANK`, `REJECTED`, `RETURNED`, `CANCELLED`
3. Handle KYC events: `CUSTOMER_KYC_STATUS`, `CUSTOMER_COMPLIANCE_STATUS`
4. On payout completion: finalize wallet deduction, update transaction, notify user
5. On payout failure: unlock/refund locked funds, update transaction, notify user
6. On KYC approval: auto-upgrade user to TIER_2, send notification

## Monorepo Structure

```
guildpay/
├── apps/
│   ├── api/                       # Node.js TypeScript API Gateway
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── db.ts          # Prisma client singleton
│   │   │   │   └── providers.ts   # Nium + Flutterwave config
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # JWT auth + KYC tier enforcement
│   │   │   │   └── error.ts       # Error handler (AppError, Zod, Prisma)
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # Signup, login, OTP, refresh
│   │   │   │   ├── users.ts       # Profile, PIN, KYC (Nium)
│   │   │   │   ├── wallets.ts     # Balances, currencies, statements
│   │   │   │   ├── transfers.ts   # Send, topup, withdraw, exchange, FX
│   │   │   │   ├── cards.ts       # Virtual cards (Nium/Flutterwave)
│   │   │   │   ├── bills.ts       # Bill payments (Flutterwave)
│   │   │   │   ├── recipients.ts  # Saved beneficiaries
│   │   │   │   ├── notifications.ts
│   │   │   │   └── webhooks.ts    # Nium + Flutterwave webhook handlers
│   │   │   ├── services/
│   │   │   │   ├── nium.ts        # Nium API client
│   │   │   │   ├── flutterwave.ts # Flutterwave API client
│   │   │   │   └── payment-router.ts # Smart corridor routing
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── payment-svc/               # Go Payment Microservice
│   │   ├── cmd/server/main.go     # gRPC + HTTP servers
│   │   ├── internal/
│   │   │   ├── ledger/ledger.go   # Double-entry accounting
│   │   │   ├── router/router.go   # Smart routing (30+ corridors)
│   │   │   └── grpc/server/       # gRPC service implementation
│   │   ├── proto/                 # Protobuf definitions
│   │   ├── Dockerfile
│   │   └── go.mod
│   │
│   └── mobile/                    # React Native (Expo)
│       ├── app/                   # Expo Router (file-based routing)
│       │   ├── (auth)/            # Auth screens
│       │   ├── (tabs)/            # Main tab navigation
│       │   │   ├── home/
│       │   │   ├── card/
│       │   │   ├── explore/
│       │   │   └── history/
│       │   ├── send/
│       │   ├── receive/
│       │   ├── wallet/
│       │   └── _layout.tsx
│       ├── components/            # Shared UI components
│       ├── store/                 # Zustand (auth, wallet)
│       ├── services/api.ts        # API client with token refresh
│       ├── constants/theme.ts     # Design system
│       └── package.json
│
├── packages/
│   ├── db/
│   │   └── prisma/schema.prisma   # 14+ tables, 12 currencies
│   └── shared/
│       └── src/
│           ├── types.ts           # Currency, Provider, PaymentRoute types
│           └── constants.ts       # KYC limits, fees, countries, corridors
│
├── proto/payment.proto            # Shared gRPC definitions
├── infra/docker-compose.yml       # PostgreSQL + Redis
├── .env.example                   # Nium + Flutterwave config template
├── turbo.json
└── package.json
```

## Database Schema

### Key Tables (14+)

**Auth & Users**: `users`, `user_profiles`, `kyc_documents`, `sessions`, `otp_codes`

**Financial**:
- `wallets` — One per user, with `niumCustomerHashId` and `niumWalletHashId`
- `wallet_balances` — Multi-currency (USD, NGN, GBP, EUR, AED, SAR, GHS, KES, ZAR, USDT, USDC)
- `ledger_entries` — Double-entry debit/credit pairs
- `transactions` — All types, with `provider` and `providerRef` for tracking
- `transfer_tracking` — Status progression timeline

**Features**:
- `recipients` — Saved beneficiaries (bank, mobile money, crypto)
- `payment_methods` — Cards, bank accounts, mobile money, crypto wallets
- `virtual_cards` — Nium or Flutterwave issued, with `providerCardId`
- `bill_payments` — Flutterwave bill API
- `notifications`, `referrals`, `exchange_rates`, `payment_links`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 52 |
| Navigation | Expo Router (file-based) |
| State | Zustand + React Query |
| API Gateway | Node.js + Express + TypeScript |
| ORM | Prisma |
| Payment Service | Go 1.22 + Fiber + gRPC |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 + BullMQ |
| Auth | JWT + bcrypt + OTP |
| Global Rails | Nium (190+ countries, FX, cards, KYC) |
| African Rails | Flutterwave (34 countries, mobile money, bills) |
| Crypto Rails | Base (USDC), Ethers.js |
| Deployment | Docker + AWS ECS + Proxmox |
| Monorepo | Turborepo |

## Qatar-Nigeria Corridor Architecture

The QAR↔NGN corridor is a launch priority — digitally underserved with most competition being cash-based exchange houses.

### Qatar → Nigeria (QAR → NGN)
```
Sender in Qatar
  → Card payment (Visa/MC) or Doha Bank transfer (via Nium partnership)
  → Nium FX: QAR → NGN (or QAR → USD → NGN)
  → Nium payout via Ecobank (35 African markets, 80%+ real-time)
  → OR Flutterwave bank transfer to Nigerian bank
  → Recipient receives NGN in 5-30 min
```

### Nigeria → Qatar (NGN → QAR)
```
Sender in Nigeria
  → Flutterwave collection (card, bank transfer, USSD, mobile money)
  → Nium FX: NGN → QAR (via USD intermediary)
  → Nium payout via Visa Direct (QAR to Visa cards, real-time)
  → OR Nium SWIFT (foreign currency wire, 1-2 days)
  → Recipient receives QAR instantly (Visa Direct) or 1-2 days (SWIFT)
```

### Qatar Market Notes
- Nium Doha Bank partnership (Oct 2024) — first Qatar bank integration
- No direct QAR collection via Nium yet — card acquiring fills the gap
- Visa Direct supports QAR payouts up to $50K/txn (B2B/B2P), $2.5K (P2P)
- Qatar: 58%+ cashless, ~3M population, 85-90% foreign nationals
- ~15K-40K Nigerians in Qatar; corridor currently 5-7% cost via exchange houses
- Mobile wallets available: Ooredoo Money (has own IBAN, MoneyGram integration)

## Supported Currencies (12)

| Currency | Code | Type | Region |
|----------|------|------|--------|
| US Dollar | USD | Fiat | Global |
| Nigerian Naira | NGN | Fiat | Africa |
| British Pound | GBP | Fiat | Europe |
| Euro | EUR | Fiat | Europe |
| UAE Dirham | AED | Fiat | Gulf |
| Saudi Riyal | SAR | Fiat | Gulf |
| Ghanaian Cedi | GHS | Fiat | Africa |
| Kenyan Shilling | KES | Fiat | Africa |
| South African Rand | ZAR | Fiat | Africa |
| Qatari Riyal | QAR | Fiat | Gulf |
| Tether | USDT | Crypto | Global |
| USD Coin | USDC | Crypto | Global |

## Supported Countries (18)

**Africa**: Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Cameroon, Senegal, Rwanda

**Gulf**: UAE, Saudi Arabia, **Qatar** (bidirectional with Nigeria — launch corridor), Bahrain, Oman, Kuwait

**Other**: United Kingdom, United States
