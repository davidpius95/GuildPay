# GuildPay Mobile App — Technical PRD

**Version:** 1.0
**Date:** 2026-03-29
**Platform:** iOS + Android (Expo / React Native)
**Status:** Foundation built, screens incomplete

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Current State Audit](#2-current-state-audit)
3. [Architecture](#3-architecture)
4. [Screen-by-Screen Specification](#4-screen-by-screen-specification)
5. [API Contract Reference](#5-api-contract-reference)
6. [Data Layer & State Management](#6-data-layer--state-management)
7. [Design System](#7-design-system)
8. [Security Requirements](#8-security-requirements)
9. [Build & Release Pipeline](#9-build--release-pipeline)
10. [Implementation Phases](#10-implementation-phases)
11. [Testing Strategy](#11-testing-strategy)
12. [Production Checklist](#12-production-checklist)

---

## 1. Product Overview

### What is GuildPay?
A cross-border remittance and financial services app for the **Africa-Gulf corridor**. Users (diaspora workers, freelancers, SMEs) send money between African and Gulf countries, pay bills, hold multi-currency wallets, and use virtual cards.

### Payment Infrastructure
| Provider | Role | Coverage |
|----------|------|----------|
| **Nium** | FX, KYC, payouts, virtual cards, SWIFT | Gulf states, global |
| **Flutterwave** | Collections, mobile money, bills, local payouts, cards | Nigeria, Ghana, Kenya, South Africa |

### Supported Currencies (12)
USD, NGN, GBP, EUR, AED, SAR, QAR, GHS, KES, ZAR, USDT, USDC

### Supported Countries (16)
**Africa:** Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Cameroon, Egypt, Senegal, Ethiopia, Cote d'Ivoire
**Gulf:** UAE, Saudi Arabia, Qatar, Kuwait

### KYC Tiers & Limits
| Tier | Daily Limit | Monthly Limit | Requirements |
|------|------------|---------------|--------------|
| TIER_0 | $50 | $200 | Email verified |
| TIER_1 | $500 | $5,000 | Basic KYC (name, DOB, ID) |
| TIER_2 | $5,000 | $50,000 | Full KYC (Nium verified) |
| TIER_3 | $50,000 | $500,000 | Enhanced due diligence |

---

## 2. Current State Audit

### What Is Already Built

| Component | Status | Detail |
|-----------|--------|--------|
| **Expo project** | Done | Expo 52, React Native 0.76.5, Expo Router 4 |
| **Navigation structure** | Done | Root stack (auth → tabs → modals), 4-tab layout |
| **Home screen** | Done | Balance card, quick actions, recent transactions, KYC banner |
| **UI component library** | Done | Button, Input, Card, BalanceCard, TransactionItem, QuickAction |
| **Auth store (Zustand)** | Done | signup, login, OTP, logout, refresh, PIN, KYC — all methods |
| **Wallet store (Zustand)** | Done | balances, transactions, FX, send, topup, withdraw, cards, bills |
| **API service layer** | Done | Typed client with auto-refresh, all 8 endpoint groups covered |
| **Theme / constants** | Done | Colors, spacing, typography, currencies, countries, corridors |
| **app.json** | Done | Bundle ID, splash, icons configured |

### What Is Missing (Must Build)

| Component | Status | Priority |
|-----------|--------|----------|
| **Auth screens** (welcome, login, signup, OTP) | Files don't exist | P0 — app cannot launch without these |
| **Card tab** | Placeholder ("card") | P1 |
| **Explore tab** (bills/services) | Placeholder ("explore") | P1 |
| **History tab** | Placeholder ("history") | P1 |
| **Send money flow** (modal) | Not created | P0 |
| **Receive / payment link** (modal) | Not created | P1 |
| **Top-up flow** | Not created | P0 |
| **Withdraw flow** | Not created | P1 |
| **Exchange flow** | Not created | P1 |
| **KYC submission screen** | Not created | P0 |
| **Profile / settings screen** | Not created | P1 |
| **Notifications screen** | Not created | P2 |
| **Recipient management** | Not created | P1 |
| **Transaction detail** | Not created | P1 |
| **Biometric auth** | Library installed, not wired | P1 |
| **Push notifications** | Not configured | P2 |
| **Deep linking** | Not configured | P2 |

### What Does NOT Need to Be Built
- Backend API — **all 47 endpoints are live and tested**
- Database schema — **24 models, fully migrated**
- Provider integrations — **Nium + Flutterwave wired with demo fallbacks**
- Webhook handlers — **Flutterwave + Nium events processed**

---

## 3. Architecture

### Monorepo Structure

```
guildpay/
├── apps/
│   ├── api/              # Express backend (TypeScript) — COMPLETE
│   ├── mobile/           # Expo/React Native app — THIS PRD
│   └── payment-svc/      # Go gRPC microservice
├── packages/
│   ├── db/               # Prisma schema + migrations
│   └── shared/           # Types, constants, enums (consumed by mobile + api)
├── turbo.json            # Build orchestration
└── package.json          # npm workspaces root
```

### Mobile App Structure (Target)

```
apps/mobile/
├── app/
│   ├── _layout.tsx                 # Root: QueryClient, auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx             # Auth stack layout
│   │   ├── welcome.tsx             # Onboarding / splash
│   │   ├── login.tsx               # Email + password
│   │   ├── signup.tsx              # Registration
│   │   └── otp.tsx                 # Email verification
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Tab bar layout
│   │   ├── home/index.tsx          # Dashboard (BUILT)
│   │   ├── card/index.tsx          # Virtual cards
│   │   ├── explore/index.tsx       # Bills & services
│   │   └── history/index.tsx       # Transaction history
│   ├── send.tsx                    # Send money flow (modal)
│   ├── receive.tsx                 # Payment link (modal)
│   ├── topup.tsx                   # Fund wallet (modal)
│   ├── withdraw.tsx                # Cash out (modal)
│   ├── exchange.tsx                # Currency swap (modal)
│   ├── wallet.tsx                  # Wallet detail (modal)
│   ├── kyc.tsx                     # KYC submission (modal)
│   ├── profile.tsx                 # Settings & profile (modal)
│   ├── notifications.tsx           # Notification center (modal)
│   ├── transaction/[id].tsx        # Transaction detail (modal)
│   └── recipients.tsx              # Manage recipients (modal)
├── components/
│   ├── ui/index.tsx                # Base components (BUILT)
│   ├── PinInput.tsx                # 6-digit PIN pad
│   ├── RecipientPicker.tsx         # Select/search recipients
│   ├── CurrencyPicker.tsx          # Currency selection modal
│   ├── FxQuoteCard.tsx             # Exchange rate preview
│   ├── TransactionTimeline.tsx     # Transfer tracking steps
│   ├── KycBanner.tsx               # Upgrade prompt
│   ├── BiometricPrompt.tsx         # Face ID / fingerprint
│   └── LoadingSkeleton.tsx         # Shimmer placeholder
├── services/
│   └── api.ts                      # API client (BUILT)
├── store/
│   ├── auth.ts                     # Auth state (BUILT)
│   └── wallet.ts                   # Wallet state (BUILT)
├── constants/
│   └── theme.ts                    # Design tokens (BUILT)
├── hooks/
│   ├── useAuth.ts                  # Auth convenience hook
│   ├── useBiometric.ts             # Biometric unlock
│   └── useNotifications.ts         # Push notification setup
└── utils/
    ├── format.ts                   # Currency/date formatting
    └── validation.ts               # Input validators
```

### Data Flow

```
User Action → Screen Component → Zustand Store → API Service → Express API → Provider (Nium/Flutterwave)
                                       ↑                            ↓
                                  React Query Cache          Webhook → DB → Push Notification
```

### Key Design Decisions

1. **Expo Router (file-based routing)** — already configured, matches Next.js mental model
2. **Zustand over Redux** — already implemented, simpler for this app size
3. **React Query for server state** — already in deps, handles caching + revalidation
4. **No shared UI package** — mobile has its own component library (different from web)
5. **SecureStore for tokens** — already implemented in auth store
6. **Shared types package** — `@guildpay/shared` provides Currency, TransactionType, KycTier enums

---

## 4. Screen-by-Screen Specification

### 4.1 Auth Screens

#### 4.1.1 Welcome Screen (`app/(auth)/welcome.tsx`)
**Purpose:** First screen for new users. Brand introduction + entry point.

**UI Elements:**
- App logo + brand name
- Tagline: "Send money across Africa & the Gulf, instantly"
- Illustration or carousel (2-3 slides): Send Money, Pay Bills, Virtual Cards
- "Get Started" button → signup
- "I already have an account" link → login

**Logic:** Check `SecureStore` for existing session. If valid token exists → skip to tabs.

**API:** None (client-side only)

---

#### 4.1.2 Sign Up Screen (`app/(auth)/signup.tsx`)
**Purpose:** Create a new account.

**UI Elements:**
- Email input (keyboard: email-address)
- Password input (secure, 8+ chars, show/hide toggle)
- Referral code input (optional, collapsible)
- "Create Account" button
- "Already have an account? Log in" link
- Terms & Privacy links at bottom

**API:** `POST /api/v1/auth/signup`
```
Request:  { email, password, referralCode? }
Response: { user: { id, email, referralCode }, accessToken, refreshToken }
```

**Store:** `useAuthStore.signup(email, password, referralCode)`

**On Success:** Store tokens in SecureStore → navigate to OTP screen

**Validation:**
- Email: valid format, required
- Password: min 8 chars, 1 uppercase, 1 number
- Show inline errors below each field

---

#### 4.1.3 Login Screen (`app/(auth)/login.tsx`)
**Purpose:** Authenticate returning users.

**UI Elements:**
- Email input
- Password input (show/hide toggle)
- "Log In" button
- "Forgot Password?" link
- "Create Account" link
- Biometric login button (if previously enabled)

**API:** `POST /api/v1/auth/login`
```
Request:  { email, password }
Response: { user: { id, email, emailVerified }, accessToken, refreshToken }
```

**Store:** `useAuthStore.login(email, password)`

**On Success:**
- If `emailVerified === false` → navigate to OTP
- If `emailVerified === true` → navigate to (tabs)/home

**Biometric Flow:** If biometric is enabled in settings, show Face ID / Fingerprint option. On success, retrieve stored credentials from SecureStore and auto-login.

---

#### 4.1.4 OTP Verification Screen (`app/(auth)/otp.tsx`)
**Purpose:** Verify email ownership after signup or login.

**UI Elements:**
- "Enter the 6-digit code sent to {email}" message
- 6-digit code input (auto-focus, auto-advance between digits)
- "Resend Code" button (disabled for 60s countdown)
- "Back" button

**API:**
- Verify: `POST /api/v1/auth/verify-otp` → `{ code }`
- Resend: `POST /api/v1/auth/resend-otp`

**Store:** `useAuthStore.verifyOtp(code)`

**On Success:** Navigate to (tabs)/home

---

### 4.2 Tab Screens

#### 4.2.1 Home Screen (`app/(tabs)/home/index.tsx`) — ALREADY BUILT
**Status:** Functional. Shows balance, quick actions, recent transactions, KYC banner.

**Enhancements needed for production:**
- Pull-to-refresh on wallet data
- Skeleton loading states (shimmer, not spinner)
- Currency selector should show all user currencies with balances
- "See All" on transactions → navigate to History tab
- Quick action routing: Top-Up → `/topup`, Send → `/send`, Receive → `/receive`, More → expand to show Exchange, Withdraw, Bills

---

#### 4.2.2 Card Screen (`app/(tabs)/card/index.tsx`) — MUST BUILD
**Purpose:** Manage virtual debit cards.

**UI Elements:**

*Empty State (no cards):*
- Illustration + "Get your virtual card"
- "Create Card" button
- Feature list: Online payments, Apple/Google Pay, Instant funding

*Card List State:*
- Horizontal scrollable card carousel (visual card with last 4, expiry, balance, provider badge)
- Active card detail:
  - "Fund Card" button
  - "Freeze / Unfreeze" toggle
  - "Show Details" button (reveal PAN + CVV with 30s auto-hide)
  - Recent card transactions list
- "Add New Card" button at end of carousel
- Card balance displayed on card face

**Flows:**

*Create Card:*
1. User taps "Create Card"
2. Select currency (USD, NGN, AED, GBP, EUR)
3. Optional: set spending limit
4. Confirm → API call
5. Show new card with success animation

*Fund Card:*
1. Tap "Fund Card"
2. Enter amount (show available wallet balance for that currency)
3. Confirm with PIN
4. Balance updates on card and wallet

*Freeze Card:*
1. Toggle freeze switch
2. Confirm dialog ("Freeze this card?")
3. Card visual changes to greyed-out state

*Reveal Details:*
1. Tap "Show Details"
2. Biometric or PIN verification
3. Show full card number, CVV, expiry for 30 seconds
4. Auto-hide with countdown timer

**API Endpoints:**
| Action | Method | Endpoint |
|--------|--------|----------|
| Create | POST | `/api/v1/cards/create` |
| List | GET | `/api/v1/cards` |
| Fund | POST | `/api/v1/cards/fund` |
| Freeze | PUT | `/api/v1/cards/freeze` |
| Details | GET | `/api/v1/cards/:id/details` |

**KYC Gate:** Card creation requires TIER_1. If user is TIER_0, show KYC upgrade prompt instead of create button.

---

#### 4.2.3 Explore Screen (`app/(tabs)/explore/index.tsx`) — MUST BUILD
**Purpose:** Bill payments, airtime, and utility services.

**UI Elements:**

*Service Grid (2 columns):*
- Airtime (phone icon)
- Data Bundle (wifi icon)
- Electricity (bolt icon)
- TV / Cable (tv icon)
- Internet (globe icon)
- Education (book icon)

*Quick Airtime Section:*
- "Buy Airtime" shortcut
- Recent airtime purchases (1-tap rebuy)

*Each Service Flow:*

**Airtime Flow:**
1. Select provider (MTN, Airtel, Glo, 9mobile, Safaricom) — from `GET /api/v1/bills/providers`
2. Enter phone number (with country flag picker: NG, GH, KE)
3. Enter amount (quick amounts: 100, 200, 500, 1000 NGN)
4. Review: provider, phone, amount, wallet balance
5. Confirm → `POST /api/v1/bills/airtime`
6. Success screen with receipt

**General Bill Flow (electricity, TV, data, internet):**
1. Select category → `GET /api/v1/bills/categories` (filtered by type)
2. Select biller (e.g., Eko Electric, DSTV)
3. Enter customer ID (meter number, smartcard number, phone number)
4. Validate customer → `POST /api/v1/bills/validate`
   - Show validated name + address for confirmation
   - If invalid, show error and allow retry
5. Enter amount (some billers have fixed amounts/packages)
6. Select recurrence: Once / Weekly / Monthly
7. Review screen with fee breakdown
8. Confirm → `POST /api/v1/bills/pay`
9. Success receipt

**API Endpoints:**
| Action | Method | Endpoint |
|--------|--------|----------|
| Categories | GET | `/api/v1/bills/categories` |
| Providers | GET | `/api/v1/bills/providers` |
| Validate | POST | `/api/v1/bills/validate` |
| Pay Bill | POST | `/api/v1/bills/pay` |
| Airtime | POST | `/api/v1/bills/airtime` |

---

#### 4.2.4 History Screen (`app/(tabs)/history/index.tsx`) — MUST BUILD
**Purpose:** Full transaction history with filtering and search.

**UI Elements:**
- Filter tabs: All | Sent | Received | Bills | Cards | Exchange
- Date range picker (from/to)
- Currency filter dropdown
- Transaction list (infinite scroll, 20 per page)
  - Each row: icon (by type), title, subtitle (date + provider), amount (color-coded), status badge
- Pull-to-refresh
- Empty state per filter

**Transaction Row Display:**
| Type | Icon | Title Format | Amount Color |
|------|------|-------------|--------------|
| SEND | arrow-up | "Sent to {recipient}" | Red (negative) |
| RECEIVE | arrow-down | "Received from {sender}" | Green (positive) |
| TOPUP | plus-circle | "Top-up via {method}" | Green (positive) |
| WITHDRAW | minus-circle | "Withdrawal to {bank}" | Red (negative) |
| EXCHANGE | swap-horizontal | "Exchange {from} → {to}" | Neutral |
| BILL_PAYMENT | receipt | "{type} — {customer}" | Red (negative) |
| CARD_FUND | card | "Card funding" | Red (negative) |

**Status Badges:**
| Status | Color | Label |
|--------|-------|-------|
| COMPLETED | Green | Completed |
| PROCESSING | Yellow | Processing |
| IN_TRANSIT | Blue | In Transit |
| INITIATED | Gray | Initiated |
| FAILED | Red | Failed |
| CANCELLED | Gray | Cancelled |

**Tap → Transaction Detail** (navigate to `/transaction/{id}`)

**API:** `GET /api/v1/wallets/statement`
```
Query: { currency?, type?, from?, to?, page, limit: 20 }
Response: { transactions: [...], pagination: { page, limit, total, totalPages } }
```

**Pagination:** Load first 20 on mount. "Load More" button or infinite scroll triggers next page. Show total count in header.

---

### 4.3 Modal Screens

#### 4.3.1 Send Money Flow (`app/send.tsx`) — MUST BUILD
**Purpose:** Core remittance flow. Send money to a saved recipient.

**Step 1 — Select Recipient:**
- Search bar (filter by name)
- Favorite recipients at top
- Full recipient list (grouped by country)
- "Add New Recipient" button → inline form or navigate to `/recipients`
- Each row: name, bank/mobile, country flag, last used date

**Step 2 — Enter Amount:**
- "You Send" input with currency picker (from wallet currencies with balance)
- "They Receive" display with recipient's currency
- Live FX quote card between the two amounts:
  - Exchange rate (e.g., "1 USD = 1,580.50 NGN")
  - Fee amount
  - Total deducted from wallet
  - Estimated delivery time
  - Provider badge (Nium or Flutterwave)
  - Quote refreshes every 30 seconds (auto or manual)
- "Insufficient balance" warning if amount > available balance
- KYC limit warning if amount exceeds tier limit

**Step 3 — Review & Confirm:**
- Summary card:
  - Recipient name, bank, account number (masked: ****1234)
  - Send amount + currency
  - Receive amount + currency
  - Exchange rate
  - Fee
  - Total charge
  - Estimated arrival
- "Send Money" button
- PIN input modal (6 digits)

**Step 4 — Processing / Success:**
- Loading animation while API processes
- Success screen:
  - Checkmark animation
  - Transaction ID
  - Amount sent + received
  - "Track Transfer" button → `/transaction/{id}`
  - "Share Receipt" button
  - "Done" button → back to home

**API Sequence:**
1. `GET /api/v1/transfers/fx/quote?from={}&to={}&amount={}` — get rate
2. `POST /api/v1/transfers/send` — execute transfer
3. `GET /api/v1/transfers/{id}/track` — optional, for tracking

**Request:**
```json
{
  "recipientId": "uuid",
  "amount": 100,
  "currency": "USD",
  "toCurrency": "NGN",
  "note": "Rent for March",
  "pin": "123456",
  "preferredProvider": "nium"
}
```

**Response:**
```json
{
  "transactionId": "uuid",
  "status": "PROCESSING",
  "provider": "nium",
  "amount": 100,
  "currency": "USD",
  "fee": 1.50,
  "toAmount": 157050,
  "toCurrency": "NGN",
  "exchangeRate": 1580.50,
  "estimatedTime": "1-2 business days",
  "recipient": { "name": "Ade Johnson", "country": "NG" }
}
```

**Error Handling:**
- `INSUFFICIENT_FUNDS` → show balance, suggest top-up
- `KYC_REQUIRED` → navigate to KYC screen
- `RECIPIENT_INVALID` → show error, suggest re-verifying
- `PROVIDER_ERROR` → "Service temporarily unavailable, try again"

---

#### 4.3.2 Top-Up Flow (`app/topup.tsx`) — MUST BUILD
**Purpose:** Fund the wallet.

**UI Elements:**
- Select currency to fund (from wallet currencies)
- Enter amount
- Select payment method:
  - **Card** — Flutterwave hosted checkout (opens WebView)
  - **Bank Transfer** — Show bank details to transfer to
  - **Mobile Money** — Select provider (M-Pesa, MTN MoMo, etc.), enter phone
- Review: amount, fee (1.5%), total charge
- Confirm

**API:** `POST /api/v1/transfers/topup`
```json
{
  "amount": 50000,
  "currency": "NGN",
  "paymentMethod": "card"
}
```

**For card payments:** API returns `paymentLink`. Open in WebView. Listen for callback URL redirect to confirm success.

**For mobile money:** API returns instructions. Show "Approve the USSD prompt on your phone" waiting screen.

---

#### 4.3.3 Withdraw Flow (`app/withdraw.tsx`) — MUST BUILD
**Purpose:** Cash out to bank or mobile money.

**UI Elements:**
- Select source currency + amount
- Select destination:
  - Bank Transfer: country → bank (from `GET /recipients/banks/:country`) → account number
  - Mobile Money: country → provider → phone number
- Beneficiary name input
- Review: amount, fee (1%), receive amount, estimated arrival
- PIN verification
- Confirm

**API:** `POST /api/v1/transfers/withdraw`

**KYC Gate:** Requires TIER_1

---

#### 4.3.4 Exchange Flow (`app/exchange.tsx`) — MUST BUILD
**Purpose:** Swap between currencies in the wallet.

**UI Elements:**
- "From" currency picker + amount input (show balance)
- Swap direction button (↕)
- "To" currency picker + calculated amount
- FX rate display (auto-refreshes)
- Fee display
- PIN entry
- Confirm

**API Sequence:**
1. `GET /api/v1/transfers/fx/quote` — live rate
2. `POST /api/v1/transfers/exchange` — execute swap

---

#### 4.3.5 Receive / Payment Link (`app/receive.tsx`) — MUST BUILD
**Purpose:** Generate a payment link to receive money.

**UI Elements:**
- Amount input (optional — leave blank for open amount)
- Currency selector
- Note field (optional)
- "Generate Link" button
- Result screen:
  - Payment link URL with copy button
  - QR code (using `react-native-qrcode-svg`)
  - Share button (native share sheet)
  - Expiry date display

**API:** `POST /api/v1/transfers/receive/link`
```json
{
  "amount": 5000,
  "currency": "NGN",
  "note": "Payment for design work"
}
```

---

#### 4.3.6 KYC Submission (`app/kyc.tsx`) — MUST BUILD
**Purpose:** Submit identity verification to unlock higher limits.

**Step 1 — Personal Info:**
- First name, last name
- Date of birth (date picker)
- Nationality (country picker)
- Mobile number (with country code)

**Step 2 — Address:**
- Address line 1
- City
- State/Province
- Postcode
- Country

**Step 3 — Identity Document:**
- Document type: Passport / National ID / Driver's License
- Document number
- Issuing country
- Expiry date
- Front photo (camera or gallery — uses `expo-image-picker`)
- Back photo (if applicable)
- Selfie photo

**Step 4 — Review & Submit:**
- Summary of all entered data
- Submit button

**API:** `POST /api/v1/users/me/kyc`

**Post-Submit:**
- Show "Verification in progress" screen
- Poll `GET /api/v1/users/me/kyc/status` every 10 seconds (Nium sandbox auto-approves)
- On approval → show success, update store, navigate to home

---

#### 4.3.7 Transaction Detail (`app/transaction/[id].tsx`) — MUST BUILD
**Purpose:** Detailed view of a single transaction with tracking.

**UI Elements:**
- Status badge (large, color-coded)
- Amount + currency (large text)
- Transaction timeline (vertical steps):
  - Initiated → Processing → In Transit → Completed (or Failed)
  - Each step shows timestamp
- Detail rows:
  - Type, Provider, Reference ID
  - Recipient name + account (for sends)
  - Exchange rate + receive amount (for FX transactions)
  - Fee amount
  - Total charged
  - Date created, date completed
- "Share Receipt" button
- "Refund" button (only for COMPLETED Flutterwave transactions)

**API:** `GET /api/v1/transfers/{id}/track`

**Refund Flow:**
1. Tap "Refund"
2. Confirm dialog
3. PIN entry
4. `POST /api/v1/transfers/refund` → `{ transactionId, pin }`
5. Show refund confirmation

---

#### 4.3.8 Profile & Settings (`app/profile.tsx`) — MUST BUILD
**Purpose:** Account management.

**Sections:**

*Account:*
- Avatar (tap to change — `expo-image-picker`)
- Name, email, phone
- "Edit Profile" → `PUT /api/v1/users/me`

*Security:*
- Change PIN → `POST /api/v1/users/me/pin`
- Biometric login toggle (enable Face ID / Fingerprint)
- Change password (future)

*Verification:*
- Current KYC tier badge
- Tier limits display (daily / monthly)
- Usage bar (spent / limit)
- "Upgrade" button → navigate to `/kyc`

*Referral:*
- Referral code (copy button)
- Referral count + reward balance

*App:*
- Notification preferences
- Currency display preference
- Help & Support
- Terms of Service / Privacy Policy links
- App version
- Logout button

---

#### 4.3.9 Notifications (`app/notifications.tsx`) — MUST BUILD
**Purpose:** View and manage notifications.

**UI Elements:**
- List of notifications (grouped by date)
- Each row: icon (by type), title, body, timestamp, read/unread indicator
- Swipe to mark as read
- "Mark All Read" button in header

**Notification Types:**
| Type | Icon | Example |
|------|------|---------|
| TRANSACTION | cash | "Transfer of $100 completed" |
| SECURITY | shield | "New login from iPhone" |
| PROMOTION | gift | "Refer a friend, earn $5" |
| SYSTEM | info | "Scheduled maintenance tonight" |
| KYC | document | "KYC verification approved" |

**API:**
- `GET /api/v1/notifications`
- `PUT /api/v1/notifications/:id/read`
- `PUT /api/v1/notifications/read-all`

---

#### 4.3.10 Recipients Management (`app/recipients.tsx`) — MUST BUILD
**Purpose:** Manage saved beneficiaries.

**UI Elements:**
- Search bar
- Favorites section (starred recipients)
- All recipients list (grouped by country)
- Each row: name, account details (masked), country flag, favorite star
- Swipe actions: favorite, delete
- "Add Recipient" FAB button

**Add Recipient Flow:**
1. Enter name
2. Select country
3. Based on country, show relevant fields:
   - **NG/GH**: Bank selector (from `GET /recipients/banks/:country`) + account number
   - **KE**: Mobile money provider (M-Pesa, Airtel Money) + phone number
   - **AE/SA/QA**: IBAN or bank + account
4. Verify account → `POST /api/v1/transfers/verify-account`
   - Show resolved name for confirmation
5. Save → `POST /api/v1/recipients`

**API:**
- `GET /api/v1/recipients`
- `POST /api/v1/recipients`
- `PUT /api/v1/recipients/:id`
- `PUT /api/v1/recipients/:id/favorite`
- `DELETE /api/v1/recipients/:id`
- `GET /api/v1/recipients/banks/:country`

---

## 5. API Contract Reference

### Base URL
- Development: `http://{LOCAL_IP}:3001/api/v1`
- Production: `https://api.guildpay.com/api/v1`

### Authentication
All protected endpoints require: `Authorization: Bearer {accessToken}`

Token refresh: `POST /api/v1/auth/refresh-token` with `{ refreshToken }`

The API service layer (`services/api.ts`) already handles automatic 401 → refresh → retry.

### Complete Endpoint Map

#### Auth (Public)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/signup` | Register |
| POST | `/auth/login` | Authenticate |
| POST | `/auth/verify-otp` | Verify OTP (requires token) |
| POST | `/auth/resend-otp` | Resend OTP (requires token) |
| POST | `/auth/forgot-password` | Password reset |
| POST | `/auth/refresh-token` | Refresh JWT |

#### Users (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Get profile |
| PUT | `/users/me` | Update profile |
| POST | `/users/me/pin` | Set/change PIN |
| POST | `/users/me/kyc` | Submit KYC |
| GET | `/users/me/kyc/status` | Get KYC status |

#### Wallets (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/wallets` | List balances |
| POST | `/wallets/currencies` | Add currency |
| GET | `/wallets/statement` | Transaction history |

#### Transfers (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/transfers/send` | Send money |
| POST | `/transfers/topup` | Fund wallet |
| POST | `/transfers/withdraw` | Cash out |
| POST | `/transfers/exchange` | FX swap |
| GET | `/transfers/fx/quote` | Get FX rate |
| GET | `/transfers/corridors` | List corridors |
| GET | `/transfers/corridors/:from/:to` | Corridor routes |
| POST | `/transfers/verify-account` | Verify bank account |
| GET | `/transfers/:id/track` | Track transfer |
| POST | `/transfers/receive/link` | Generate payment link |
| POST | `/transfers/refund` | Refund transaction |
| POST | `/transfers/sub-accounts` | Create sub-account |

#### Cards (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/cards/create` | Issue card |
| GET | `/cards` | List cards |
| POST | `/cards/fund` | Fund card |
| PUT | `/cards/freeze` | Freeze/unfreeze |
| GET | `/cards/:id/details` | Reveal PAN/CVV |

#### Bills (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/bills/pay` | Pay bill |
| POST | `/bills/airtime` | Buy airtime |
| GET | `/bills/categories` | List categories |
| POST | `/bills/validate` | Validate customer |
| GET | `/bills/providers` | List providers |

#### Recipients (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/recipients` | List recipients |
| POST | `/recipients` | Add recipient |
| PUT | `/recipients/:id` | Update recipient |
| PUT | `/recipients/:id/favorite` | Toggle favorite |
| DELETE | `/recipients/:id` | Delete recipient |
| GET | `/recipients/banks/:country` | List banks |

#### Notifications (Protected)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/:id/read` | Mark read |
| PUT | `/notifications/read-all` | Mark all read |

### Error Format
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE",
  "statusCode": 400
}
```

### Common Error Codes
| Code | HTTP | Meaning |
|------|------|---------|
| `INSUFFICIENT_FUNDS` | 400 | Wallet balance too low |
| `KYC_REQUIRED` | 403 | Need higher KYC tier |
| `INVALID_PIN` | 401 | Wrong transaction PIN |
| `PIN_NOT_SET` | 400 | User hasn't set PIN yet |
| `INVALID_OTP` | 400 | Wrong or expired OTP |
| `RATE_LIMIT` | 429 | Too many requests |
| `PROVIDER_ERROR` | 502 | Nium/Flutterwave unavailable |

---

## 6. Data Layer & State Management

### Zustand Stores (Already Implemented)

#### Auth Store (`store/auth.ts`)
```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions (all implemented)
  signup(email, password, referralCode?): Promise<void>
  login(email, password): Promise<void>
  verifyOtp(code): Promise<void>
  logout(): Promise<void>
  refreshToken(): Promise<void>
  loadSession(): Promise<void>     // restore from SecureStore
  updateProfile(data): Promise<void>
  setPin(pin, currentPin?): Promise<void>
  submitKyc(data): Promise<void>
  getKycStatus(): Promise<KycStatus>
}
```

#### Wallet Store (`store/wallet.ts`)
```typescript
interface WalletState {
  walletId: string | null;
  totalBalanceUsd: number;
  balances: Balance[];
  transactions: Transaction[];
  corridors: Corridor[];
  isLoading: boolean;

  // Actions (all implemented)
  fetchWallet(): Promise<void>
  fetchTransactions(page?, currency?): Promise<void>
  fetchCorridors(): Promise<void>
  addCurrency(currency): Promise<void>
  getFxQuote(from, to, amount): Promise<Quote>
  verifyAccount(data): Promise<VerifyResult>
  sendMoney(data): Promise<SendResult>
  topUp(data): Promise<TopUpResult>
  withdraw(data): Promise<WithdrawResult>
  exchange(data): Promise<ExchangeResult>
  trackTransfer(id): Promise<TrackResult>
  generatePaymentLink(data): Promise<LinkResult>
  createCard(currency): Promise<Card>
  fundCard(cardId, amount): Promise<void>
  buyAirtime(data): Promise<void>
}
```

### React Query Integration

Use React Query for server-state that needs caching and background revalidation:

```typescript
// Suggested query keys
['wallet']                          // wallet balances
['transactions', { page, filter }]  // paginated history
['cards']                           // card list
['recipients']                      // recipient list
['notifications']                   // notification list
['fx-quote', from, to, amount]     // FX rates (staleTime: 30s)
['banks', country]                  // bank lists (staleTime: 24h)
['bill-categories']                 // bill categories (staleTime: 1h)
['bill-providers']                  // bill providers (staleTime: 24h)
['kyc-status']                      // KYC tier (staleTime: 60s)
```

**Invalidation rules:**
- After send/topup/withdraw/exchange → invalidate `['wallet']` + `['transactions']`
- After card create/fund/freeze → invalidate `['cards']` + `['wallet']`
- After bill payment → invalidate `['wallet']` + `['transactions']`
- After KYC submit → start polling `['kyc-status']` every 10s

---

## 7. Design System

### Already Defined in `constants/theme.ts`

**Colors:**
| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#5C0A2A` | Buttons, headers, active states |
| `primaryLight` | `#7A1E42` | Hover/pressed states |
| `primaryDark` | `#3E0018` | Dark mode primary |
| `success` | `#10B981` | Positive amounts, completed status |
| `error` | `#EF4444` | Errors, negative amounts, failed status |
| `warning` | `#F59E0B` | Processing status, warnings |
| `info` | `#3B82F6` | In-transit status, links |
| `background` | `#F9FAFB` | Screen backgrounds |
| `surface` | `#FFFFFF` | Cards, modals |
| `text` | `#111827` | Primary text |
| `textSecondary` | `#6B7280` | Secondary text |

**Typography:**
| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| `h1` | 28 | 700 | Screen titles |
| `h2` | 22 | 600 | Section headers |
| `h3` | 18 | 600 | Card titles |
| `body` | 16 | 400 | Body text |
| `caption` | 14 | 400 | Labels, secondary |
| `small` | 12 | 400 | Badges, timestamps |
| `tiny` | 10 | 500 | Legal text |

**Spacing:** 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32

**Border Radius:** 8 / 12 / 16 / 9999 (pill)

### Existing Components (`components/ui/index.tsx`)
| Component | Variants | Props |
|-----------|----------|-------|
| `Button` | primary, secondary, danger, ghost | size, loading, disabled, onPress |
| `Input` | — | label, error, keyboardType, secureTextEntry, rightIcon |
| `Card` | pressable, static | onPress, children |
| `BalanceCard` | — | label, amount, currency, onCurrencyPress |
| `TransactionItem` | — | icon, title, subtitle, amount, currency, positive |
| `QuickAction` | primary, default | icon, label, onPress |

### New Components to Build
| Component | Purpose |
|-----------|---------|
| `PinInput` | 6-digit PIN pad with haptic feedback |
| `CurrencyPicker` | Bottom sheet with currency list + flags |
| `RecipientPicker` | Searchable recipient list with favorites |
| `FxQuoteCard` | Rate display with refresh timer |
| `TransactionTimeline` | Vertical step tracker |
| `LoadingSkeleton` | Shimmer placeholder for loading states |
| `BiometricPrompt` | Face ID / Fingerprint verification wrapper |
| `StatusBadge` | Color-coded transaction status pill |
| `EmptyState` | Illustration + message + action button |

---

## 8. Security Requirements

### Authentication
- JWT access tokens stored in `expo-secure-store` (hardware-backed keychain)
- Refresh token rotation on every use
- Auto-logout on refresh failure
- Session timeout: 15 minutes idle → re-authenticate

### Transaction Security
- All money-movement operations require 6-digit PIN
- PIN attempts limited (5 tries → lockout)
- Biometric can substitute for PIN (if enabled)
- Amount > $500 requires explicit confirmation step

### Sensitive Data
- Card PAN/CVV shown for max 30 seconds, then auto-hidden
- Account numbers masked in UI (show last 4 only)
- No sensitive data in React Query cache keys
- No PII in logs or error messages

### Network
- TLS/HTTPS only in production
- Certificate pinning (optional, for high-security release)
- API rate limiting: 100 requests / 15 minutes

### Device
- Jailbreak/root detection (optional)
- Screen capture prevention on sensitive screens (card details, PIN entry)
- App backgrounding: blur screen content

---

## 9. Build & Release Pipeline

### Development Setup

```bash
# 1. Clone and install
git clone <repo>
cd guildpay
npm install                          # installs all workspaces

# 2. Start backend (required for mobile to work)
cp .env.example .env                 # set DEMO_MODE=true
docker compose up -d                 # postgres + redis
npm run db:migrate && npm run db:seed
npm run dev --filter=api             # starts on :3001

# 3. Start mobile
cd apps/mobile
npx expo start                       # scan QR with Expo Go
```

### Environment Configuration

**`apps/mobile/services/api.ts`** — update `BASE_URL`:
```typescript
// Development: use your machine's local IP (not localhost)
const BASE_URL = __DEV__
  ? 'http://192.168.x.x:3001/api/v1'
  : 'https://api.guildpay.com/api/v1';
```

### Build Commands

| Target | Command | Output |
|--------|---------|--------|
| Expo Go (dev) | `npx expo start` | QR code → phone |
| iOS Simulator | `npx expo run:ios` | Xcode simulator |
| Android Emulator | `npx expo run:android` | Android emulator |
| iOS Production | `eas build --platform ios` | .ipa (TestFlight) |
| Android Production | `eas build --platform android` | .aab (Play Store) |
| Both Platforms | `eas build --platform all` | Both artifacts |

### EAS Build Configuration

Create `apps/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "env": { "API_URL": "https://staging-api.guildpay.com/api/v1" }
    },
    "production": {
      "env": { "API_URL": "https://api.guildpay.com/api/v1" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@email.com", "ascAppId": "your-app-id" },
      "android": { "serviceAccountKeyPath": "./google-service-account.json" }
    }
  }
}
```

### App Store Requirements
| Requirement | iOS | Android |
|-------------|-----|---------|
| Developer Account | Apple Developer ($99/yr) | Google Play ($25 one-time) |
| App Review | 1-3 days | 1-7 days |
| Privacy Policy | Required (URL) | Required (URL) |
| Age Rating | 4+ (financial) | Everyone |
| Financial App Compliance | May need additional review | May need additional review |
| Bundle ID | `com.guildpay.app` | `com.guildpay.app` |

---

## 10. Implementation Phases

### Phase 1: Auth + Core Navigation (Week 1)
**Goal:** Users can sign up, log in, and land on home screen.

| Task | Screen/File | Depends On |
|------|------------|------------|
| Welcome screen | `app/(auth)/welcome.tsx` | — |
| Login screen | `app/(auth)/login.tsx` | — |
| Signup screen | `app/(auth)/signup.tsx` | — |
| OTP screen | `app/(auth)/otp.tsx` | — |
| Auth gate in root layout | `app/_layout.tsx` | Auth store |
| PinInput component | `components/PinInput.tsx` | — |
| LoadingSkeleton component | `components/LoadingSkeleton.tsx` | — |

**Test:** Sign up → receive OTP → verify → land on home. Log out → log back in.

---

### Phase 2: Money Movement (Week 2)
**Goal:** Users can send, receive, top up, exchange.

| Task | Screen/File | Depends On |
|------|------------|------------|
| Send money flow | `app/send.tsx` | RecipientPicker, FxQuoteCard, PinInput |
| Top-up flow | `app/topup.tsx` | CurrencyPicker |
| Receive / payment link | `app/receive.tsx` | QR code lib |
| Exchange flow | `app/exchange.tsx` | FxQuoteCard, PinInput |
| Withdraw flow | `app/withdraw.tsx` | PinInput |
| RecipientPicker component | `components/RecipientPicker.tsx` | — |
| CurrencyPicker component | `components/CurrencyPicker.tsx` | — |
| FxQuoteCard component | `components/FxQuoteCard.tsx` | — |

**Test:** Send $10 USD → NGN to a saved recipient. Top up via card. Exchange USD→GBP. Generate payment link.

---

### Phase 3: History + Transaction Detail (Week 3)
**Goal:** Full transaction visibility and tracking.

| Task | Screen/File | Depends On |
|------|------------|------------|
| History tab | `app/(tabs)/history/index.tsx` | TransactionTimeline |
| Transaction detail | `app/transaction/[id].tsx` | TransactionTimeline, StatusBadge |
| TransactionTimeline component | `components/TransactionTimeline.tsx` | — |
| StatusBadge component | `components/StatusBadge.tsx` | — |
| Refund flow (in transaction detail) | Part of `transaction/[id].tsx` | PinInput |

**Test:** View history, filter by type. Tap transaction → see timeline. Refund a completed transaction.

---

### Phase 4: Cards (Week 3-4)
**Goal:** Create and manage virtual cards.

| Task | Screen/File | Depends On |
|------|------------|------------|
| Card tab (full implementation) | `app/(tabs)/card/index.tsx` | PinInput |
| Card creation flow | Part of card tab | KYC gate |
| Card funding | Part of card tab | PinInput |
| Card freeze toggle | Part of card tab | — |
| Card detail reveal | Part of card tab | Biometric/PIN |

**Test:** Create USD card. Fund it from wallet. Freeze/unfreeze. Reveal full PAN.

---

### Phase 5: Bills & Services (Week 4)
**Goal:** Pay bills and buy airtime.

| Task | Screen/File | Depends On |
|------|------------|------------|
| Explore tab (service grid) | `app/(tabs)/explore/index.tsx` | — |
| Airtime flow | Part of explore tab | — |
| General bill flow | Part of explore tab | — |
| Customer validation step | Part of bill flow | — |

**Test:** Buy airtime for a phone number. Pay electricity bill with meter validation. Set up monthly recurring.

---

### Phase 6: KYC + Profile + Recipients (Week 5)
**Goal:** Account management and compliance.

| Task | Screen/File | Depends On |
|------|------------|------------|
| KYC submission screen | `app/kyc.tsx` | Camera/image picker |
| Profile & settings | `app/profile.tsx` | — |
| Biometric setup | `hooks/useBiometric.ts` | expo-local-authentication |
| Recipients management | `app/recipients.tsx` | — |
| Bank list integration | Part of recipients | — |

**Test:** Submit KYC → auto-approve (sandbox). Enable biometrics. Add/edit/delete recipients.

---

### Phase 7: Notifications + Polish (Week 5-6)
**Goal:** Production readiness.

| Task | Screen/File | Depends On |
|------|------------|------------|
| Notifications screen | `app/notifications.tsx` | — |
| Push notification setup | `hooks/useNotifications.ts` | EAS, APNs/FCM |
| Home screen enhancements | `app/(tabs)/home/index.tsx` | LoadingSkeleton |
| Pull-to-refresh everywhere | All screens | — |
| Empty states everywhere | All screens | EmptyState component |
| Error boundary | Root layout | — |
| Deep linking | `app.json` + routes | — |
| Offline handling | API service | — |

**Test:** Receive push notification on transfer completion. Pull-to-refresh wallet. Offline → show cached data + banner.

---

## 11. Testing Strategy

### Unit Tests
- **Store logic:** Test Zustand actions with mocked API
- **Formatters:** Currency formatting, date formatting
- **Validators:** Email, phone, PIN, amount inputs

### Integration Tests
- **Auth flow:** signup → OTP → login → refresh → logout
- **Send flow:** select recipient → quote → PIN → confirm → track
- **Top-up flow:** select method → pay → verify callback → balance update

### E2E Tests (Detox or Maestro)
| Test Case | Steps |
|-----------|-------|
| Onboarding | Launch → Welcome → Signup → OTP → Home |
| Send Money | Home → Send → Pick recipient → Amount → PIN → Success |
| Buy Airtime | Explore → Airtime → Provider → Phone → Amount → Confirm |
| Card Management | Card → Create → Fund → Freeze → Reveal |

### Device Testing Matrix
| Device | OS Version | Priority |
|--------|-----------|----------|
| iPhone 15 | iOS 17+ | P0 |
| iPhone SE | iOS 16+ | P1 |
| Samsung Galaxy S24 | Android 14 | P0 |
| Pixel 8 | Android 14 | P0 |
| Low-end Android (2GB RAM) | Android 12 | P1 |

---

## 12. Production Checklist

### Before App Store Submission

**Code:**
- [ ] All auth screens built and tested
- [ ] All 4 tabs fully implemented
- [ ] All modal flows (send, topup, withdraw, exchange, receive) complete
- [ ] KYC flow working end-to-end
- [ ] Card management complete
- [ ] Bill payments complete
- [ ] Error handling on every screen (no unhandled crashes)
- [ ] Loading states on every data fetch
- [ ] Empty states on every list
- [ ] Offline banner + cached data fallback

**Security:**
- [ ] PIN pad working with lockout
- [ ] Biometric auth integrated
- [ ] Secure token storage verified
- [ ] Card PAN auto-hide after 30s
- [ ] No secrets in client code
- [ ] HTTPS-only API calls in production build

**Performance:**
- [ ] App launch < 2 seconds
- [ ] Screen transitions < 300ms
- [ ] List scroll at 60fps (FlatList with proper keys)
- [ ] Images optimized (avatar, ID documents)
- [ ] Bundle size < 50MB

**UX:**
- [ ] Haptic feedback on PIN entry, success, error
- [ ] Pull-to-refresh on all data screens
- [ ] Keyboard avoidance on all form screens
- [ ] Safe area handling (notch, home indicator)
- [ ] Dark mode support (optional for v1)
- [ ] RTL text support (for Arabic in Gulf markets)

**Compliance:**
- [ ] Privacy policy URL in app.json
- [ ] Terms of service URL
- [ ] Data deletion request mechanism
- [ ] Transaction receipts downloadable/shareable
- [ ] KYC data encryption in transit

**Build:**
- [ ] `eas.json` configured for preview + production
- [ ] App icons (1024x1024) for both platforms
- [ ] Splash screen configured
- [ ] Bundle IDs registered (Apple + Google)
- [ ] Push notification certificates (APNs + FCM)
- [ ] App Store Connect listing created
- [ ] Google Play Console listing created
- [ ] Screenshots for all required device sizes

**Backend:**
- [ ] Production `.env` with real Nium + Flutterwave keys
- [ ] `DEMO_MODE=false`
- [ ] Webhook endpoints publicly reachable (Nium + Flutterwave)
- [ ] Database backups configured
- [ ] Rate limiting tuned for production traffic
- [ ] Monitoring/alerting on provider errors

---

## Appendix A: File Creation Checklist

Files that need to be created (checked = exists):

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   ├── welcome.tsx              ☐ create
│   │   ├── login.tsx                ☐ create
│   │   ├── signup.tsx               ☐ create
│   │   └── otp.tsx                  ☐ create
│   ├── (tabs)/
│   │   ├── card/index.tsx           ☐ rebuild (currently placeholder)
│   │   ├── explore/index.tsx        ☐ rebuild (currently placeholder)
│   │   └── history/index.tsx        ☐ rebuild (currently placeholder)
│   ├── send.tsx                     ☐ create
│   ├── receive.tsx                  ☐ create
│   ├── topup.tsx                    ☐ create
│   ├── withdraw.tsx                 ☐ create
│   ├── exchange.tsx                 ☐ create
│   ├── wallet.tsx                   ☐ create
│   ├── kyc.tsx                      ☐ create
│   ├── profile.tsx                  ☐ create
│   ├── notifications.tsx            ☐ create
│   ├── transaction/[id].tsx         ☐ create
│   └── recipients.tsx               ☐ create
├── components/
│   ├── PinInput.tsx                 ☐ create
│   ├── RecipientPicker.tsx          ☐ create
│   ├── CurrencyPicker.tsx           ☐ create
│   ├── FxQuoteCard.tsx              ☐ create
│   ├── TransactionTimeline.tsx      ☐ create
│   ├── StatusBadge.tsx              ☐ create
│   ├── LoadingSkeleton.tsx          ☐ create
│   ├── BiometricPrompt.tsx          ☐ create
│   └── EmptyState.tsx               ☐ create
├── hooks/
│   ├── useAuth.ts                   ☐ create
│   ├── useBiometric.ts             ☐ create
│   └── useNotifications.ts         ☐ create
├── utils/
│   ├── format.ts                    ☐ create
│   └── validation.ts               ☐ create
└── eas.json                         ☐ create
```

**Total: 4 files exist and are complete. 30 files need to be created.**

---

## Appendix B: Dependency Check

All required npm packages are already installed:

| Package | Version | Purpose | Installed |
|---------|---------|---------|-----------|
| expo | ~52.0.0 | Framework | Yes |
| expo-router | ~4.0.0 | Navigation | Yes |
| react-native | 0.76.5 | Core | Yes |
| zustand | 5.0.0 | State management | Yes |
| @tanstack/react-query | 5.62.0 | Server state | Yes |
| expo-secure-store | ~14.0.0 | Token storage | Yes |
| expo-local-authentication | ~15.0.0 | Biometrics | Yes |
| expo-camera | ~16.0.0 | KYC document capture | Yes |
| expo-image-picker | ~16.0.0 | Photo selection | Yes |
| expo-haptics | ~14.0.0 | Haptic feedback | Yes |
| react-native-reanimated | ~3.16.0 | Animations | Yes |
| react-native-qrcode-svg | 6.3.2 | QR codes | Yes |
| @react-navigation/native | 7.0.0 | Navigation core | Yes |

**No new packages need to be installed.**
