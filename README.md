# GuildPay — Cross-Border Remittance Platform

> Send and receive money globally with your African or Gulf currency. Dual-provider infrastructure (Nium + Flutterwave) for the Africa-Gulf corridor and beyond.

## Architecture

```
Mobile App (React Native/Expo)
        |  REST / HTTPS
        v
API Gateway (Node.js/TypeScript)
  |              |              |
  v              v              v
Nium API     Flutterwave    Blockchain
(Gulf/Global)  (Africa)     (Base/USDC)
  |              |              |
  +------+-------+------+------+
         |              |
     PostgreSQL       Redis
         |
   Double-Entry Ledger
```

**Dual-provider model**: Nium handles Gulf collection (AED/SAR), global FX, virtual cards (30+ markets), and KYC. Flutterwave handles African collections (M-Pesa, MTN MoMo, bank transfers), bill payments, and local payouts.

## Quick Start

### Prerequisites
- Node.js 20+
- Go 1.22+
- Docker + Docker Compose
- Expo CLI (`npm install -g expo-cli`)

### 1. Clone & Install

```bash
git clone https://github.com/guildpay/guildpay.git
cd guildpay
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your Nium and Flutterwave API keys (see .env.example for details)
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL + Redis
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed with demo data
npm run db:seed
```

### 4. Start Services

```bash
# Terminal 1: API Gateway (Node.js)
cd apps/api && npm run dev

# Terminal 2: Payment Service (Go)
cd apps/payment-svc && go run ./cmd/server

# Terminal 3: Mobile App
cd apps/mobile && npx expo start
```

### 5. Open the App
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
guildpay/
├── apps/
│   ├── api/                  # Node.js TypeScript API Gateway
│   │   ├── src/
│   │   │   ├── config/       # DB, provider config (Nium/Flutterwave)
│   │   │   ├── middleware/    # Auth, error handling, KYC enforcement
│   │   │   ├── routes/        # REST endpoints
│   │   │   ├── services/      # Nium, Flutterwave, payment router
│   │   │   └── index.ts
│   │   └── Dockerfile
│   ├── payment-svc/           # Go Payment Microservice
│   │   ├── cmd/server/        # Entry point (gRPC + HTTP)
│   │   └── internal/
│   │       ├── ledger/        # Double-entry accounting
│   │       └── router/        # Smart corridor routing
│   └── mobile/                # React Native (Expo) Mobile App
│       ├── app/               # Expo Router file-based routing
│       ├── components/        # Shared UI components
│       ├── store/             # Zustand state (auth, wallet)
│       └── services/          # API client
├── packages/
│   ├── db/                    # Prisma Schema + Migrations
│   └── shared/                # Shared types, constants, currencies
├── proto/                     # gRPC Protobuf definitions
└── infra/                     # Docker, deployment
```

## Payment Providers

### Nium (Global Infrastructure)
- **Gulf collection**: AED via UAE ACH/Wire, SAR via SARIE
- **Cross-border payouts**: 190+ countries, 35 African markets via Ecobank (real-time)
- **FX engine**: Interbank rates refreshed every 5 min, lockable for 5min to 24hrs
- **Virtual cards**: Visa/Mastercard in 30+ markets, issued in ~200ms
- **KYC/KYB**: Automated eKYC + document-based verification
- **Account verification**: Pre-validate beneficiary accounts (Nium Verify)
- **Licensing**: 35+ markets covered

### Flutterwave (African Last-Mile)
- **African collection**: Cards, bank transfers, M-Pesa, MTN MoMo, USSD, QR codes
- **Mobile money**: Kenya (M-Pesa), Ghana (MTN/Vodafone/AirtelTigo), Uganda, Tanzania
- **Bill payments**: Airtime, data, electricity, TV, internet (Nigeria primary)
- **Payouts**: Bank transfers + mobile money across 34 African countries
- **Virtual cards**: USD and NGN denominations
- **Licensing**: CBN Switching License (Nigeria), 34 state MTLs (US)

### Smart Payment Router

The router automatically selects the cheapest/fastest provider per corridor:

| Corridor | Primary Provider | Rail | Speed |
|----------|-----------------|------|-------|
| AED/SAR → NGN | Nium | Bank Transfer (Ecobank) | 5-15 min |
| QAR → NGN | Nium | Bank Transfer (Doha Bank) | 5-30 min |
| NGN → QAR | Nium | Visa Direct | Real-time |
| AED/SAR → KES | Nium | Bank Transfer | 5-15 min |
| USD/GBP → NGN | Nium or Flutterwave | Bank / Mobile Money | 5-30 min |
| USD → KES | Flutterwave | M-Pesa | 1-5 min |
| NGN → GHS | Flutterwave | Bank Transfer | 5-30 min |
| Any → USDC | Blockchain | Crypto | 1-2 min |

## Key Features

- [x] Multi-currency wallet (USD, NGN, GBP, EUR, AED, SAR, QAR, GHS, KES, ZAR, USDT, USDC)
- [x] Send money to 17+ countries (Africa + Gulf + UK + US)
- [x] Gulf-to-Africa corridor (AED/SAR/QAR → NGN/KES/GHS/ZAR)
- [x] Qatar-Nigeria bidirectional corridor (QAR→NGN via Nium/Ecobank, NGN→QAR via Visa Direct)
- [x] Receive via payment link + QR code
- [x] Top-up via Flutterwave (card, bank, mobile money)
- [x] Withdraw to bank + mobile money (Nium or Flutterwave)
- [x] Currency exchange with live FX rates (Nium: 5min refresh, lockable)
- [x] Stablecoin on/off-ramp (Base/USDC)
- [x] Virtual cards (Nium: 30+ markets, Flutterwave: USD/NGN)
- [x] Bill payments via Flutterwave (airtime, data, electricity, TV)
- [x] Real-time transaction tracking with provider status
- [x] KYC via Nium API (eKYC + document-based)
- [x] Account verification before payouts (Nium Verify)
- [x] PIN verification with bcrypt
- [x] KYC daily/monthly transaction limits enforced
- [x] Webhook handlers with signature verification (both providers)
- [x] Smart payment routing (cheapest rail per corridor)
- [x] Double-entry ledger accounting
- [x] Referral program

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo SDK 52 |
| State | Zustand + React Query |
| API | Node.js + Express + TypeScript |
| ORM | Prisma + PostgreSQL 16 |
| Payments (Go) | Go 1.22 + Fiber + gRPC |
| Cache/Queue | Redis 7 + BullMQ |
| Auth | JWT + bcrypt + OTP |
| Global Rails | Nium (190+ countries, cards, FX, KYC) |
| African Rails | Flutterwave (34 countries, mobile money, bills) |
| Crypto Rails | Base (USDC), Ethers.js |
| Deploy | Docker + AWS ECS + Proxmox |
| Monorepo | Turborepo |

## API Documentation

Base URL: `http://localhost:3001/api/v1`

### Auth
- `POST /auth/signup` — Create account
- `POST /auth/verify-otp` — Verify email
- `POST /auth/login` — Login
- `POST /auth/forgot-password` — Request reset
- `POST /auth/refresh-token` — Refresh JWT

### Users
- `GET /users/me` — Get profile
- `PUT /users/me` — Update profile
- `POST /users/me/pin` — Set/change transaction PIN
- `POST /users/me/kyc` — Submit KYC via Nium
- `GET /users/me/kyc/status` — KYC status

### Wallets
- `GET /wallets` — List balances (11 currencies)
- `POST /wallets/currencies` — Add currency
- `GET /wallets/statement` — Transaction history (filterable)

### Transfers
- `POST /transfers/send` — Send money (auto-routes via Nium or Flutterwave)
- `POST /transfers/topup` — Fund wallet (Flutterwave checkout or M-Pesa)
- `POST /transfers/withdraw` — Cash out to bank/mobile money
- `POST /transfers/exchange` — Convert currency (live FX from provider)
- `GET /transfers/fx/quote` — Get FX quote
- `GET /transfers/corridors` — List available corridors
- `GET /transfers/corridors/:from/:to` — Get routes for corridor
- `POST /transfers/verify-account` — Pre-validate recipient account
- `GET /transfers/:id/track` — Track transfer status
- `POST /transfers/receive/link` — Generate payment link

### Cards
- `POST /cards/create` — Issue virtual card (Nium or Flutterwave)
- `GET /cards` — List user's cards
- `POST /cards/fund` — Fund card from wallet
- `PUT /cards/freeze` — Freeze/unfreeze (syncs with provider)
- `GET /cards/:id/details` — Get sensitive card details

### Bills
- `POST /bills/pay` — Pay any bill (Flutterwave)
- `POST /bills/airtime` — Quick airtime purchase
- `GET /bills/categories` — Get available categories (from Flutterwave API)
- `POST /bills/validate` — Validate customer (meter, smartcard)
- `GET /bills/providers` — List providers by country

### Webhooks (public, no auth)
- `POST /webhooks/flutterwave` — Flutterwave event handler (signature verified)
- `POST /webhooks/nium` — Nium event handler (HMAC-SHA256 verified)

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required:
- `NIUM_CLIENT_HASH_ID` + `NIUM_API_KEY` — Get from [Nium Portal](https://app.nium.com) (includes Doha Bank Qatar corridor)
- `FLUTTERWAVE_SECRET_KEY` — Get from [Flutterwave Dashboard](https://dashboard.flutterwave.com)
- `FLUTTERWAVE_WEBHOOK_HASH` — Set in Flutterwave webhook settings
- `NIUM_WEBHOOK_SECRET` — Set in Nium webhook settings

## Supported Countries (18)

### Africa (Flutterwave + Nium/Ecobank)
Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Cameroon, Senegal, Rwanda

### Gulf (Nium)
UAE, Saudi Arabia, **Qatar** (Doha Bank partnership — bidirectional with Nigeria), Bahrain, Oman, Kuwait

### Other (Nium)
United Kingdom, United States

## Qatar-Nigeria Corridor Details

The QAR↔NGN corridor is a launch priority. This corridor is **severely underserved** digitally — most existing options are cash-based exchange houses or limited (WorldRemit only offers airtime top-up from Qatar).

| Direction | Collection | FX | Payout | Speed |
|-----------|-----------|-----|--------|-------|
| **QAR → NGN** | Card (Visa/MC) or Doha Bank transfer | Nium (QAR→NGN) | Flutterwave bank transfer | 5-30 min |
| **NGN → QAR** | Flutterwave (card/bank/USSD) | Nium (NGN→QAR via USD) | Nium Visa Direct (QAR) | Real-time |

**Key facts:**
- ~15,000-40,000 Nigerians in Qatar (construction, hospitality, professional services)
- Qatar outward remittances: ~$1.44B/year, growing to $10.9B by 2029
- Average corridor cost: 5-7% (exchange houses). GuildPay target: under 2%
- Nium Doha Bank partnership (Oct 2024) enables Qatar-side bank integration
- Qatar has 58%+ cashless adoption — card collection is viable
- Nigeria→Qatar payout via Nium Visa Direct is real-time to QAR Visa cards

## License

Proprietary — Guild Technology Limited 2024-2026
