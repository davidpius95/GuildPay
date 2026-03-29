# GuildPay — Full MVP Implementation Plan

## Overview

Build all 35 screens from the design spec as a mobile-first web app (390x844px), integrated with the existing Express API and Nium/Flutterwave sandbox. The web app simulates Android/iOS behavior for testing before building the React Native mobile app.

**Approach**: Single `public/index.html` file. No build tools. Mobile viewport simulation with device frame, touch interactions, native-like transitions, bottom nav, and pull-to-refresh patterns.

**Test URL**: `http://localhost:3001`

---

## Current State (Step 1 Complete)

### Already Built (10 of 35 screens — 29%)
| Screen | ID | Status |
|---|---|---|
| Login | B1 | Done |
| Home (active user) | C2 | Done |
| Multi-Currency Wallet | D1 | Done |
| Currency Detail | D2 | Partial (no chart) |
| Transaction History | H1 | Basic (no filters) |
| Transaction Detail | H2 | Done |
| Notifications | K1 | Done |
| Profile Overview | J1 | Basic |
| Send (bottom sheet) | E3-E6 | Partial (single sheet, no corridor/recipient selection) |
| Top-Up (bottom sheet) | — | Done |

### API Endpoints Available
All routes are under `/api/v1/` and require auth (JWT Bearer) unless noted.

| Route | Endpoints | Provider |
|---|---|---|
| `/auth` | POST login, POST register, POST refresh | Local |
| `/users` | GET me, PUT profile, POST pin/set, POST pin/change, POST kyc | Nium KYC |
| `/wallets` | GET /, POST add-currency, GET history | Local |
| `/transfers` | POST send, POST topup, POST withdraw, POST exchange, GET fx-quote, GET corridors, POST verify-account, GET track/:id, POST payment-link | Nium + Flutterwave |
| `/recipients` | GET /, POST /, PUT /:id, PUT /:id/favorite, DELETE /:id | Local |
| `/cards` | GET /, POST create, POST fund, POST /:id/freeze, POST /:id/unfreeze, GET /:id | Nium + Flutterwave |
| `/bills` | POST pay, POST airtime, GET categories, POST validate, GET providers | Flutterwave |
| `/notifications` | GET /, PUT /:id/read, PUT /read-all | Local |
| `/webhooks` | POST /nium, POST /flutterwave | Both |

---

## Phase 1: Core Send Money Flow (7 screens)
**Goal**: Complete the end-to-end send money experience — the core product.

### Screens
| ID | Screen | Description |
|---|---|---|
| E1 | Select Corridor | Country grid + search, saved recipients preview |
| E2 | Select/Add Recipient | Saved recipients list, add new recipient form |
| E3 | Enter Amount + FX | Send/receive amounts, live FX rate, fee breakdown |
| E4 | Payment Method | Wallet balance (primary), card, bank transfer options |
| E5 | Review & Confirm | Full transfer summary with all details |
| E6 | PIN Confirm | 6-digit PIN entry with custom numpad |
| K3 | Success State | Checkmark animation, transaction summary, "View Receipt" |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Load corridors | `GET /transfers/corridors` | Returns supported country pairs |
| Load recipients | `GET /recipients` | Filtered by country after corridor selection |
| Add recipient | `POST /recipients` | Save new with bank/mobile money details |
| Verify account | `POST /transfers/verify-account` | Pre-check before saving (Nium Verify / Flutterwave resolve) |
| FX quote | `GET /transfers/fx-quote?from=USD&to=NGN&amount=100` | Live rate with fee breakdown |
| Send transfer | `POST /transfers/send` | Requires PIN, deducts wallet, dispatches to provider |
| Track transfer | `GET /transfers/track/:id` | Status timeline after send |

### New API Work
- None — all endpoints exist.

### UI Components to Build
- Country grid with flags and search
- Recipient list with bank/mobile money details
- Amount input with currency swap
- FX rate card with fee itemization
- Transfer summary card
- PIN pad (6-digit, custom numpad, dots)
- Success screen with animation

### Acceptance Criteria
- [ ] User can select Nigeria as destination from corridor screen
- [ ] User can pick saved recipient or add new one
- [ ] FX quote shows live rate (USD → NGN)
- [ ] Fee breakdown visible before confirming
- [ ] PIN entry works, wrong PIN shows error
- [ ] Transfer completes (sandbox simulation) and shows success
- [ ] Transaction appears in history immediately

---

## Phase 2: Recipient Management + Receive Money (5 screens)
**Goal**: Complete recipient CRUD and add receive money flows.

### Screens
| ID | Screen | Description |
|---|---|---|
| J2 | Saved Recipients | List with country flags, masked details, swipe to delete |
| E2+ | Add/Edit Recipient | Full form with bank name dropdown, account number, mobile money |
| F1 | Receive Money Hub | Three options: payment link, QR code, account details |
| F2 | Payment Link | Amount input, generate shareable link, copy/share buttons |
| F3 | QR Code Display | QR code (generated client-side), amount, download/share |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| List recipients | `GET /recipients` | Sorted by favorite, last used |
| Create recipient | `POST /recipients` | Bank or mobile money destination |
| Update recipient | `PUT /recipients/:id` | Edit details |
| Toggle favorite | `PUT /recipients/:id/favorite` | Toggle star |
| Delete recipient | `DELETE /recipients/:id` | Remove |
| Generate payment link | `POST /transfers/payment-link` | Returns shareable URL |

### New API Work
- None — all endpoints exist. QR code generated client-side using a lightweight JS QR library (inline).

### UI Components to Build
- Recipient list with swipe-to-delete gesture
- Recipient form with country-aware fields (NG shows bank dropdown, KE shows mobile money)
- Receive hub with 3 option cards
- Payment link generator with copy/share buttons
- QR code renderer (canvas-based, no external lib needed)

### Acceptance Criteria
- [ ] Recipients screen accessible from Profile
- [ ] Can add new recipient with bank details (Nigeria) or mobile money (Kenya)
- [ ] Favorite toggle works
- [ ] Swipe to delete works
- [ ] Payment link generates and copies to clipboard
- [ ] QR code renders with amount embedded

---

## Phase 3: Wallet Enhancements + Withdraw + Exchange (4 screens)
**Goal**: Full wallet management — withdraw to bank/mobile money, currency exchange, improved currency detail.

### Screens
| ID | Screen | Description |
|---|---|---|
| D2 | Currency Detail (enhanced) | Balance, line chart (7d/30d/90d), fund/withdraw/convert actions, filtered transactions |
| D3 | Withdraw / Cashout | Amount input, method selection (bank/mobile money), fee breakdown, confirm |
| D4 | Currency Exchange (enhanced) | From/to currency pickers, swap button, live rate, chart, convert CTA |
| K4 | Error State | Error illustration, message, "Try Again" + "Contact Support" |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Withdraw | `POST /transfers/withdraw` | Requires PIN, bank/mobile money destination |
| Exchange | `POST /transfers/exchange` | Between wallet currencies |
| FX quote | `GET /transfers/fx-quote` | For exchange preview |
| Wallet history | `GET /wallets/history?currency=NGN` | Filtered by currency |

### New API Work
- **Optional**: Add `GET /wallets/history` query param for currency filtering (minor enhancement to existing route).

### UI Components to Build
- Simple line chart (SVG-based, no external library)
- Withdrawal method selector (bank accounts, mobile money)
- Currency picker dropdowns with flags
- Swap animation for exchange
- Error state template (reusable)

### Acceptance Criteria
- [ ] Currency detail shows balance with action buttons
- [ ] Withdraw flow works: amount → method → confirm → PIN → success
- [ ] Exchange flow: select currencies → see rate → convert → wallet updated
- [ ] Error state shows on failed operations with retry option

---

## Phase 4: Virtual Card Management (3 screens)
**Goal**: Full virtual card lifecycle — create, fund, freeze, view details, transactions.

### Screens
| ID | Screen | Description |
|---|---|---|
| G1 | Card Overview | Premium card design, masked details, balance, quick actions, transactions |
| G2 | Fund Card | Source selector (wallet), amount input, fee display, fund CTA |
| G3 | Card Settings | Reveal card number, freeze toggle, spending limits, notifications |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| List cards | `GET /cards` | All user's virtual cards |
| Create card | `POST /cards/create` | Nium (USD) or Flutterwave (NGN) based on currency |
| Fund card | `POST /cards/fund` | From wallet balance |
| Freeze card | `POST /cards/:id/freeze` | Toggle freeze |
| Unfreeze card | `POST /cards/:id/unfreeze` | Toggle unfreeze |
| Card details | `GET /cards/:id` | Full details including PAN |

### New API Work
- None — all endpoints exist.

### UI Components to Build
- Premium card visual (gradient, masked PAN, tap to reveal)
- Card creation flow (select currency → create)
- Fund card sheet with wallet balance display
- Freeze/unfreeze toggle with visual state change
- Card transaction list (filtered)

### Acceptance Criteria
- [ ] Can create USD virtual card (Nium sandbox)
- [ ] Card displays with masked number, expiry
- [ ] Tap reveals full card number + CVV
- [ ] Fund card from wallet works
- [ ] Freeze/unfreeze toggles correctly
- [ ] Card appears in Card tab (bottom nav)

---

## Phase 5: Bill Payments + Explore Hub (3 screens)
**Goal**: Full bill payment experience — airtime, data, electricity, TV, internet.

### Screens
| ID | Screen | Description |
|---|---|---|
| I1 | Explore Hub | Search, bill categories grid, promotions, rate alerts, referral card |
| I2 | Bill Payment Flow | Provider selector, customer input, amount presets, confirm + PIN |
| I2b | Bill Payment Expanded | Electricity (meter number validation), TV (smartcard), data bundles |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Bill categories | `GET /bills/categories` | Available categories |
| Providers | `GET /bills/providers?category=airtime&country=NG` | Per-category providers |
| Validate customer | `POST /bills/validate` | Meter number, smartcard ID, etc. |
| Pay bill | `POST /bills/pay` | Generic bill payment |
| Buy airtime | `POST /bills/airtime` | Shortcut for airtime |

### New API Work
- None — all endpoints exist via Flutterwave.

### UI Components to Build
- Category grid with icons (Airtime, Data, Electricity, TV, Internet, Education)
- Provider selector (MTN, Airtel, Glo, 9mobile for Nigeria)
- Amount preset buttons (₦200, ₦500, ₦1000, ₦2000)
- Customer validation (meter number → name confirmation)
- Promotions card (static for now)

### Acceptance Criteria
- [ ] Explore tab shows bill categories
- [ ] Airtime purchase works: provider → number → amount → PIN → success
- [ ] Customer validation works for electricity/TV
- [ ] Amount presets work, custom amount works
- [ ] Transaction appears in history after bill payment

---

## Phase 6: KYC + Profile + Security (5 screens)
**Goal**: Full KYC onboarding, PIN management, profile editing, payment methods.

### Screens
| ID | Screen | Description |
|---|---|---|
| A6 | KYC Multi-Step | 3-step: ID upload → selfie → proof of address, processing state |
| J1 | Profile (enhanced) | Full menu: personal info, recipients, payment methods, security, referral |
| J3 | Payment Methods | Saved cards, linked banks, crypto wallets, add new |
| A5 | Set/Change Passcode | 6-digit PIN with custom numpad, confirm PIN |
| J4 | Referral Program | Referral code, share link, stats (invited count, earned amount) |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Submit KYC | `POST /users/kyc` | Sends to Nium sandbox (auto-approves) |
| Get KYC status | `GET /users/me` | `kycStatus` field on user |
| Set PIN | `POST /users/pin/set` | First time PIN setup |
| Change PIN | `POST /users/pin/change` | Requires old PIN |
| Update profile | `PUT /users/profile` | Name, email, phone |

### New API Work
- **`GET /users/kyc-status`** — Dedicated endpoint returning tier, limits, required documents (optional, can derive from `/users/me`).
- **`POST /users/referral`** — Generate/get referral code (low priority, can be static for MVP).

### UI Components to Build
- Multi-step form with progress indicator (1/3, 2/3, 3/3)
- File upload UI (camera icon, drag area — simulated for web)
- Selfie capture frame (camera API or file upload fallback)
- KYC processing animation (spinner with status text)
- PIN setup/change with confirm step
- Referral code card with copy + share buttons
- KYC tier badge with limit bars

### Acceptance Criteria
- [ ] KYC flow walks through 3 steps
- [ ] KYC submission hits Nium sandbox (auto-approves)
- [ ] Profile shows KYC tier and verification badge
- [ ] PIN change works (old PIN → new PIN → confirm)
- [ ] Referral code displays and copies
- [ ] Profile menu items all navigate to correct screens

---

## Phase 7: Onboarding + Auth Flow (6 screens)
**Goal**: New user experience — welcome carousel, sign up, OTP, profile setup, biometric prompt.

### Screens
| ID | Screen | Description |
|---|---|---|
| A1 | Welcome Carousel | 3 slides with pagination dots, "Get Started" + "Sign In" |
| A2 | Sign Up | Email/phone toggle, Google OAuth button, password fields, T&C |
| A3 | OTP Verification | 6-digit code input, masked email, resend timer (45s) |
| A4 | Profile Setup | Photo upload, first/last name, country dropdown, phone |
| A7 | Onboarding Walkthrough | 3-panel feature tour overlay highlighting key features |
| B2 | Forgot Password | Email input, "Send Reset Link", back to login |
| B3 | Biometric Setup | Fingerprint illustration, enable/skip options |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Register | `POST /auth/register` | Creates account |
| Login | `POST /auth/login` | Returns JWT |
| Verify OTP | `POST /auth/verify-otp` | Validates code |
| Resend OTP | `POST /auth/resend-otp` | Triggers new code |
| Forgot password | `POST /auth/forgot-password` | Sends reset email |
| Update profile | `PUT /users/profile` | After profile setup |

### New API Work
- **`POST /auth/register`** — Needs: email/phone, password, returns OTP flow. (May already exist — verify.)
- **`POST /auth/verify-otp`** — OTP verification endpoint.
- **`POST /auth/resend-otp`** — Resend OTP.
- **`POST /auth/forgot-password`** — Password reset trigger.

### UI Components to Build
- Carousel with swipe gestures and dots
- Email/phone toggle input
- OTP input (6 separate boxes, auto-advance)
- Countdown timer for resend
- Profile photo upload (circular with camera overlay)
- Country dropdown with flag icons
- Feature tour overlay (semi-transparent with spotlight)
- Biometric prompt screen

### Acceptance Criteria
- [ ] New users see carousel → sign up → OTP → profile → PIN → walkthrough
- [ ] OTP auto-advances between digits
- [ ] Resend timer counts down from 45s
- [ ] Profile setup saves correctly
- [ ] Walkthrough highlights wallet, quick actions, card tab
- [ ] Forgot password sends reset link
- [ ] "Sign In" from carousel goes to login screen

---

## Phase 8: History + Tracking + Polish (5 screens)
**Goal**: Enhanced transaction history, real-time tracking, loading skeletons, help & support.

### Screens
| ID | Screen | Description |
|---|---|---|
| H1 | Transaction History (enhanced) | Filter tabs (All/Sent/Received/Bills/Card), date range, download statement |
| H2 | Transaction Detail (enhanced) | Share receipt, download PDF, full fee breakdown |
| H3 | Transaction Tracker | Real-time progress bar (4 stages), estimated arrival, notifications |
| K2 | Help & Support | Search, FAQ categories, live chat button, email support |
| K5 | Loading Skeletons | Shimmer animations for all data-loading states |

### API Integration
| Action | Endpoint | Notes |
|---|---|---|
| Transaction history | `GET /wallets/history` | Add filter params: type, dateFrom, dateTo |
| Transaction detail | `GET /transfers/track/:id` | Full detail with timeline |
| Track transfer | `GET /transfers/track/:id` | Polling for status updates |

### New API Work
- **Enhance `GET /wallets/history`** — Add query params: `type` (SEND/RECEIVE/BILL/CARD), `from` (date), `to` (date), `currency`.
- **`GET /wallets/statement`** — Generate downloadable statement (CSV/PDF). (Low priority — can be client-side CSV for MVP.)

### UI Components to Build
- Filter tabs with active state
- Date range picker (native date inputs)
- Transaction tracker with 4-stage progress bar and animation
- Receipt share (Web Share API) and PDF download (client-side)
- Shimmer/skeleton loading animations (CSS-only)
- Help & support with FAQ accordion
- Search within help topics

### Acceptance Criteria
- [ ] History filters by type (Sent, Received, Bills, Card)
- [ ] Date range filtering works
- [ ] Transaction tracker shows real-time progress for pending transfers
- [ ] Skeleton loading shows on all screens during data fetch
- [ ] Help & support has searchable FAQ
- [ ] Receipt can be shared or downloaded

---

## Phase 9: Home States + Final Polish
**Goal**: Empty states, KYC banner, device simulation frame, final QA.

### Screens
| ID | Screen | Description |
|---|---|---|
| C1 | Home — Empty State | New user view with KYC banner, $0 balance, empty transactions |
| C2 | Home (enhanced) | Multi-currency pill selector, verified badge, real data |

### Tasks
1. **Empty states** — Illustrations and CTAs for: no transactions, no recipients, no cards, no notifications
2. **KYC banner** — Yellow warning banner on home when KYC incomplete, links to KYC flow
3. **Device simulation frame** — Optional: wrap app in phone frame (iPhone/Android toggle) for realistic testing
4. **Bottom nav update** — 4 tabs: Home, Card, Explore, History (matching design spec)
5. **Pull-to-refresh** — Touch gesture to refresh data on all list screens
6. **Haptic-style feedback** — CSS animations on button press, sheet transitions
7. **iOS/Android toggle** — Switch between iOS (rounded, centered titles) and Android (material, left-aligned) styling
8. **Dark mode** — Optional CSS custom properties toggle
9. **Offline state** — Banner when network unavailable
10. **Session timeout** — Auto-refresh JWT, show re-login prompt when expired

### Acceptance Criteria
- [ ] New user sees empty state with helpful CTAs
- [ ] KYC banner appears until verification complete
- [ ] All 35 screens accessible and functional
- [ ] No dead ends — every screen has back navigation
- [ ] All API calls handle loading, success, and error states
- [ ] App feels native-like with smooth transitions

---

## Cross-Cutting Concerns (Apply Throughout)

### Mobile Simulation
- **Viewport**: 390x844px centered on desktop, full-screen on mobile
- **Touch targets**: Minimum 44px tap areas
- **Gestures**: Swipe-to-delete, pull-to-refresh, bottom sheet drag
- **Transitions**: Slide-in from right (push), slide-up (sheet), fade (modal)
- **Safe areas**: Status bar padding (top), home indicator padding (bottom)
- **Font scaling**: Respect system font size (rem units)

### Navigation
- **Bottom nav**: Home | Card | Explore | History (4 tabs)
- **Stack navigation**: Push/pop with back button
- **Bottom sheets**: Send, Top-up, Exchange, PIN entry
- **Modals**: Confirmations, errors, success states

### Design System Tokens
```
--gp-primary: #5C0A2A
--gp-primary-light: #8B1A3A
--gp-primary-dark: #4A0821
--gp-bg: #F5F5F5
--gp-white: #FFFFFF
--gp-text: #1A1A1A
--gp-text-secondary: #888888
--gp-border: #DDDDDD
--gp-success: #27AE60
--gp-error: #E74C3C
--gp-warning: #F2A623
--gp-radius-btn: 28px
--gp-radius-card: 16px
--gp-font: 'DM Sans'
```

### Data Flow
- All state in a single JS object (`window.APP`)
- JWT stored in memory (not localStorage for security simulation)
- API calls through centralized `api()` helper with auth headers
- Polling for pending transactions (every 10s)
- Optimistic UI updates with rollback on error

---

## Screen-to-API Mapping (Complete)

| # | Screen | API Endpoints Used |
|---|---|---|
| A1 | Welcome Carousel | None (static) |
| A2 | Sign Up | `POST /auth/register` |
| A3 | OTP Verification | `POST /auth/verify-otp`, `POST /auth/resend-otp` |
| A4 | Profile Setup | `PUT /users/profile` |
| A5 | Set Passcode | `POST /users/pin/set` |
| A6 | KYC Multi-Step | `POST /users/kyc` |
| A7 | Onboarding Walkthrough | None (static overlay) |
| B1 | Login | `POST /auth/login` |
| B2 | Forgot Password | `POST /auth/forgot-password` |
| B3 | Biometric Setup | None (device API — simulated) |
| C1 | Home (empty) | `GET /wallets`, `GET /users/me` |
| C2 | Home (active) | `GET /wallets`, `GET /wallets/history`, `GET /notifications` (count) |
| D1 | Multi-Currency Wallet | `GET /wallets` |
| D2 | Currency Detail | `GET /wallets`, `GET /wallets/history?currency=X` |
| D3 | Withdraw | `POST /transfers/withdraw` |
| D4 | Currency Exchange | `GET /transfers/fx-quote`, `POST /transfers/exchange` |
| E1 | Select Corridor | `GET /transfers/corridors`, `GET /recipients` |
| E2 | Select Recipient | `GET /recipients`, `POST /recipients`, `POST /transfers/verify-account` |
| E3 | Enter Amount | `GET /transfers/fx-quote` |
| E4 | Payment Method | `GET /wallets` (balance check) |
| E5 | Review & Confirm | None (uses cached data from E3) |
| E6 | PIN Confirm | `POST /transfers/send` (includes PIN) |
| F1 | Receive Hub | None (static options) |
| F2 | Payment Link | `POST /transfers/payment-link` |
| F3 | QR Code | None (client-side QR generation) |
| G1 | Card Overview | `GET /cards`, `GET /cards/:id` |
| G2 | Fund Card | `POST /cards/fund`, `GET /wallets` |
| G3 | Card Settings | `POST /cards/:id/freeze`, `POST /cards/:id/unfreeze` |
| H1 | Transaction History | `GET /wallets/history` |
| H2 | Transaction Detail | `GET /transfers/track/:id` |
| H3 | Transaction Tracker | `GET /transfers/track/:id` (polling) |
| I1 | Explore Hub | `GET /bills/categories` |
| I2 | Bill Payment | `GET /bills/providers`, `POST /bills/validate`, `POST /bills/pay` |
| J1 | Profile | `GET /users/me` |
| J2 | Saved Recipients | `GET /recipients`, `DELETE /recipients/:id` |
| J3 | Payment Methods | `GET /cards` (for now — no separate payment methods table) |
| J4 | Referral Program | `GET /users/me` (referral code field) |
| K1 | Notifications | `GET /notifications`, `PUT /notifications/:id/read` |
| K2 | Help & Support | None (static content) |
| K3 | Success State | None (static, receives data from previous screen) |
| K4 | Error State | None (static, receives error from failed API call) |
| K5 | Loading Skeletons | None (CSS-only shimmer animations) |

---

## New API Endpoints Needed

| Endpoint | Phase | Priority | Description |
|---|---|---|---|
| `POST /auth/register` | 7 | P0 | User registration with email/phone + password |
| `POST /auth/verify-otp` | 7 | P0 | OTP code verification |
| `POST /auth/resend-otp` | 7 | P1 | Resend OTP code |
| `POST /auth/forgot-password` | 7 | P1 | Trigger password reset email |
| `GET /wallets/history` (enhanced) | 8 | P1 | Add type/date/currency filters |

**Total new endpoints: 4-5** (everything else already exists)

---

## Delivery Timeline (Suggested)

| Phase | Screens | Est. Effort | Dependency |
|---|---|---|---|
| 1. Send Flow | 7 | Large | None |
| 2. Recipients + Receive | 5 | Medium | Phase 1 (recipients used in send) |
| 3. Wallet + Withdraw + Exchange | 4 | Medium | None |
| 4. Virtual Cards | 3 | Medium | None |
| 5. Bill Payments + Explore | 3 | Medium | None |
| 6. KYC + Profile + Security | 5 | Large | None |
| 7. Onboarding + Auth | 7 | Large | Phase 6 (KYC flow) |
| 8. History + Tracking + Polish | 5 | Medium | All previous |
| 9. Final Polish | 2 + tasks | Small | All previous |

**Phases 3, 4, 5 can be done in any order.** Phase 7 depends on Phase 6 (KYC). Phase 8 and 9 should be last.

---

## Testing Checklist (Per Phase)

1. Open `http://localhost:3001`
2. Login with `test@guildpay.com` / `Test1234!`
3. Test the specific flow added in that phase
4. Verify data persists (wallet balance changes, transactions appear)
5. Check API terminal for provider logs (Nium/Flutterwave calls)
6. Test error states (wrong PIN, insufficient balance, network error)
7. Test on mobile viewport (Chrome DevTools → 390x844)
8. Test touch interactions (swipe, long press, pull to refresh)

---

## File Modified
- `apps/api/public/index.html` — The entire web dashboard (rebuilt incrementally per phase)
- `apps/api/src/routes/auth.ts` — New registration/OTP endpoints (Phase 7)
- `apps/api/src/routes/wallets.ts` — Enhanced history filtering (Phase 8)
