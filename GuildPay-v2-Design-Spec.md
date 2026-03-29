# GuildPay v2 — Complete Design Specification
## Based on competitive analysis of Greep, Hizo, Onboard + remittance UX best practices

---

## Design System

**Brand Colors**
- Primary: #5C0A2A (Dark Maroon)
- Primary Light: #8B1A3A
- Primary Dark: #4A0821
- Background: #F5F5F5
- White: #FFFFFF

**Typography**: DM Sans (400, 500, 600, 700)
**Border Radius**: 28px (buttons/inputs), 16px (cards), 12px (tags), 50% (avatars)
**Frame Size**: 390×844px (iPhone 14 standard)

---

## COMPLETE SCREEN MAP (35 screens across 11 flows)

### A. ONBOARDING FLOW (7 screens)

**A1. Welcome Carousel** (3 slides within one screen)
- Slide 1: "Send money globally" — globe icon with connecting dots
- Slide 2: "Pay in your currency" — NGN/USD/GBP currency pills
- Slide 3: "Earn rewards" — XP badge with sparkle
- Pagination dots, "Get Started" + "Sign in" CTAs
- *Competitor insight*: Onboard uses 3-slide carousel; Greep uses single hero

**A2. Sign Up — Email/Phone**
- Toggle: Email / Phone number tab
- Google OAuth button
- Email + Password + Confirm password
- T&C checkbox with links
- "Sign Up" primary CTA
- "Have an account? Login" footer

**A3. OTP Verification**
- 6-digit code input boxes
- "Check your email/phone" instruction
- Masked email display (d***d@guild.com)
- Resend timer (45s countdown)
- Verify button
- *Competitor insight*: All 3 competitors have this — it's table stakes

**A4. Profile Setup**
- Profile photo upload (camera overlay)
- First name, Last name
- Country dropdown (with flag icons)
- Phone number (if signed up with email)
- Continue button

**A5. Set Passcode**
- 6-digit PIN entry with dots
- Confirm PIN entry
- Custom numpad
- Info card: "Prevent unauthorized access"
- *Competitor insight*: Onboard uses biometric + PIN; Hizo uses 4-digit

**A6. KYC — Multi-step** (CRITICAL — missing entirely)
- Step indicator (1 of 3)
- Step 1: Select ID type (Passport / National ID / Driver's License) → Upload front + back
- Step 2: Selfie verification (camera frame with face outline)
- Step 3: Proof of address (utility bill upload)
- Processing state (spinning animation, "Verifying your identity...")
- "Skip for now" option (limits functionality)
- *Competitor insight*: Hizo requires BVN; Onboard requires KYC for all fiat services; Greep verifies merchants

**A7. Onboarding Walkthrough** (NEW — Onboard has this)
- 3-panel feature tour overlay:
  1. "Your wallet" — highlighting balance card
  2. "Quick actions" — highlighting Top-Up/Send/Receive
  3. "Virtual card" — highlighting card tab
- Skip + Next navigation
- Dots pagination

### B. AUTH FLOW (3 screens)

**B1. Login**
- Google OAuth
- Email + Password fields
- "Forgot Password?" link
- Biometric option (fingerprint icon)
- Login button
- "Don't have an account? Sign Up"

**B2. Forgot Password**
- Illustration (lock icon)
- "Enter email to receive reset link"
- Email input
- "Send Reset Link" CTA
- "Back to Login"

**B3. Biometric Setup** (NEW)
- Fingerprint illustration
- "Enable biometric login?"
- "Use your fingerprint or Face ID for faster access"
- "Enable" primary CTA + "Not now" secondary

### C. DASHBOARD / HOME (2 states)

**C1. Home — New User (empty state)**
- Header: "Home" + help/bell/user icons
- KYC banner: "Complete verification" (warning yellow)
- Wallet balance card: $0.00 with currency selector (USD/NGN/EUR)
- Quick actions: Top-Up, Send, Receive, Scan (4 circular icons)
- Card + Rewards balance cards (side-by-side)
- "Recent Transactions" — empty state with illustration
- Bottom nav: Home, Card, Explore, History
- *Key change*: Added "Receive" quick action (ALL competitors have this)

**C2. Home — Active User (with data)**
- Same layout but:
- Balance: $1,245.50
- Multi-currency pill selector (USD/NGN/EUR tabs)
- Real transactions list with status indicators
- "Complete verification" banner replaced with "Tier 2 verified" badge

### D. WALLET FLOW (4 screens) — ENTIRELY NEW

**D1. Multi-Currency Wallet**
- Currency list with balances:
  - USD: $1,245.50 (🇺🇸)
  - NGN: ₦458,000 (🇳🇬)
  - GBP: £0.00 (🇬🇧)
  - USDT: 500.00 (₮)
- Each tappable → currency detail
- "Add currency" button
- *Competitor insight*: Greep shows USD/EUR/GBP/TRY; Onboard shows USD + stablecoins

**D2. Currency Detail (e.g., USD)**
- Large balance: $1,245.50
- Line chart (7d/30d/90d toggle)
- Actions: Fund, Withdraw, Convert
- Transaction list filtered to this currency

**D3. Withdraw / Cashout** (CRITICAL — missing entirely)
- Amount input
- Withdrawal method:
  - Bank account (saved accounts list)
  - Mobile money (M-Pesa, MTN MoMo)
- Fee breakdown card
- "You will receive: ₦1,808,226"
- Confirm withdrawal CTA
- *Competitor insight*: Onboard withdraws to bank in NGN/KES/IDR; Hizo supports mobile money

**D4. Currency Convert / Exchange**
- From currency picker + amount
- Swap button (↕)
- To currency picker + converted amount
- Live rate display + rate chart
- "Convert" CTA
- *Competitor insight*: Hizo's core feature is live FX conversion

### E. SEND MONEY FLOW (6 screens) — EXPANDED

**E1. Select Corridor / Country**
- "Where are you sending to?"
- Popular countries: Nigeria, Ghana, Kenya, South Africa, UK, US
- Search bar for all countries
- Saved recipients list with country flags
- *Competitor insight*: All competitors start with corridor selection

**E2. Select / Add Recipient** (NEW)
- Saved recipients list
- "Add new recipient" button
- Recipient form:
  - Full name
  - Country (pre-filled from E1)
  - Bank name dropdown
  - Account number
  - Mobile money number (alternative)
  - Save recipient checkbox
- *Competitor insight*: Hizo supports both bank + mobile money per country

**E3. Enter Amount + FX Rate**
- "You send" with from-currency
- Live FX rate card: "$1 = ₦1,452.00"
- "They receive" with to-currency
- Fee breakdown:
  - Transfer fee: $1.50
  - FX markup: 0.5%
  - Total cost: $1.50
- "Amount they receive: ₦72,600"
- *Competitor insight*: Greep shows fees clearly; Onboard shows no hidden fees

**E4. Choose Payment Method** (NEW)
- Saved methods list:
  - Debit card (Visa ****4829)
  - Bank transfer
  - Wallet balance ($1,245.50 available)
  - Stablecoin (USDT balance)
- "Add new method" option
- *Competitor insight*: Onboard supports bank/card/crypto funding

**E5. Review & Confirm**
- Full transfer summary card:
  - Recipient name + country
  - Send amount
  - Exchange rate
  - Fees (itemized)
  - Total debit
  - Receive amount + currency
  - Delivery method
  - Estimated arrival time
- "Confirm & Send" CTA

**E6. PIN Confirm**
- 6-dot PIN entry
- Custom numpad
- "Confirm this transaction" subtitle

### F. RECEIVE MONEY FLOW (3 screens) — ENTIRELY NEW

**F1. Receive Money Hub**
- Three options:
  1. "Share payment link" — generate link to share
  2. "Show QR code" — display QR for in-person
  3. "Account details" — show bank/wallet details
- *Competitor insight*: Onboard has USD account details; Greep uses QR codes

**F2. Payment Link / Request**
- Amount input (optional)
- Note/description field
- "Generate link" button
- Shareable link card with copy button
- Share via: WhatsApp, SMS, Email, Copy
- *Competitor insight*: This is standard in modern P2P apps

**F3. QR Code Display**
- Large QR code centered
- Amount display (if set)
- "Scan to pay me" instruction
- Download/Share QR button
- *Competitor insight*: Core flow for Greep's merchant payments

### G. CARD FLOW (3 screens) — EXPANDED

**G1. Virtual Card Overview**
- Premium card design (dark gradient with GuildPay branding)
- Card number (masked), expiry, CVV
- Balance: $0.00
- Quick actions: Fund, Freeze, Details
- Card transactions list
- Apple Pay / Google Pay setup prompt
- *Competitor insight*: Onboard's USD card with Apple Pay is their killer feature

**G2. Fund Card**
- Source selector: Wallet balance / Bank / Crypto
- Amount input
- "Available: $1,245.50 in wallet"
- Fee: $0 (from wallet)
- "Fund Card" CTA

**G3. Card Settings**
- Card number (tap to reveal)
- Freeze/unfreeze toggle
- Set spending limits
- Transaction notifications toggle
- Replace card option

### H. HISTORY + TRACKING (3 screens) — EXPANDED

**H1. Transaction History**
- Filter tabs: All, Sent, Received, Bills, Card
- Date range picker
- Transaction list with:
  - Status indicators (green dot = complete, yellow = pending, red = failed)
  - Amount + direction (+ or -)
  - Recipient/sender name
  - Timestamp
- "Download statement" button at bottom
- *Competitor insight*: All competitors have robust filtering

**H2. Transaction Detail**
- Status badge (Completed / Pending / Failed)
- Full details:
  - Transaction ID
  - Type (Send / Receive / Top-Up / Card)
  - Amount sent + received
  - Exchange rate used
  - Fees paid
  - Date + time
  - Delivery method
  - Recipient details
- "Share receipt" + "Download PDF" buttons
- For pending: progress tracker (Initiated → Processing → Delivered)
- *Competitor insight*: Real-time tracking is standard in Remitly/WorldRemit

**H3. Transaction Tracker** (NEW — for pending transactions)
- Progress bar: Initiated → Processing → In transit → Delivered
- Estimated arrival time
- "We'll notify you when complete"
- Transaction details below

### I. EXPLORE / SERVICES (2 screens)

**I1. Explore Hub**
- Search bar
- "Pay Bills" grid: Airtime, Data, Electricity, TV Cable, Internet, Education
- "Promotions" card: first top-up bonus
- "Rate Alerts" card: set FX rate notifications
- "Referral" card: invite friends, earn $5 each

**I2. Bill Payment Flow** (e.g., Airtime)
- Provider selector (MTN, Airtel, Glo, 9mobile)
- Phone number input
- Amount presets: ₦200, ₦500, ₦1000, ₦2000
- Custom amount option
- Confirm + PIN

### J. PROFILE & SETTINGS (4 screens)

**J1. Profile Overview**
- Avatar + name + email
- Verification status badge
- Menu items:
  - Personal Information
  - Saved Recipients (NEW)
  - Payment Methods (NEW)
  - Bank Accounts
  - Security & PIN
  - Notification Settings
  - Referral Program (NEW)
  - Help & Support
  - About GuildPay
- Logout

**J2. Saved Recipients** (NEW)
- List of saved beneficiaries with:
  - Name, country flag
  - Bank/mobile money details (masked)
  - Last sent date
- Swipe to delete
- "Add recipient" FAB

**J3. Payment Methods** (NEW)
- Saved cards (Visa ****4829)
- Linked bank accounts
- Crypto wallets
- "Add payment method" option

**J4. Referral Program** (NEW)
- "Invite friends, earn $5 each"
- Unique referral code
- Share link via WhatsApp/SMS/Email
- Referral stats: 3 invited, $15 earned
- *Competitor insight*: Greep has token rewards; Onboard has referral program

### K. UTILITY SCREENS (5 screens)

**K1. Notifications**
- Grouped by date
- Types: transaction updates, security alerts, promotions, system
- Read/unread indicators

**K2. Help & Support**
- Search help topics
- FAQ categories
- Live chat button
- Email support

**K3. Success State**
- Large checkmark animation
- Transaction summary
- "Back to Home" + "View Receipt"

**K4. Error State**
- Error illustration
- Error message + code
- "Try Again" + "Contact Support"

**K5. Loading / Skeleton States**
- Shimmer animations for:
  - Dashboard balance
  - Transaction list items
  - Card details
  - Profile info

---

## FLOW PRIORITIES FOR MVP

### P0 (Launch blockers)
1. Send money complete flow (corridor → recipient → amount → review → PIN → success)
2. Receive money (payment link + QR)
3. Withdraw to local bank
4. Multi-currency wallet
5. KYC multi-step
6. Transaction tracking
7. Fee transparency

### P1 (Week 2-3 post-launch)
8. Virtual USD card
9. Stablecoin on/off-ramp
10. Saved recipients management
11. Payment methods management
12. Bill payments

### P2 (Month 2)
13. Referral program
14. Rate alerts
15. Scheduled transfers
16. Account statements

---

## DESIGN TOKENS REFERENCE

```
--gp-primary: #5C0A2A
--gp-primary-light: #8B1A3A
--gp-primary-dark: #4A0821
--gp-bg: #F5F5F5
--gp-white: #FFFFFF
--gp-text: #1A1A1A
--gp-text-secondary: #888888
--gp-text-tertiary: #BBBBBB
--gp-border: #DDDDDD
--gp-success: #27AE60
--gp-error: #E74C3C
--gp-warning: #F2A623
--gp-info: #3B8BD4
--gp-radius-btn: 28px
--gp-radius-card: 16px
--gp-radius-tag: 12px
--gp-font: 'DM Sans'
--gp-frame-w: 390px
--gp-frame-h: 844px
```
