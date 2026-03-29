# GuildPay MVP — Sandbox Setup Guide

## Prerequisites

```bash
node --version    # Need 20+   ✓
docker --version  # Need 20+   ✓
```

Go 1.22+ is optional (only for Go payment service — the Node.js API works standalone for MVP).

---

## Step-by-Step Setup

**Open Docker Desktop first** — it must be running before you continue.

Then run each step one at a time in your terminal:

### Step 1: Go to the project
```bash
cd /Users/user/Downloads/GuildPay4/guildpay
```

### Step 2: Start PostgreSQL + Redis
```bash
npm run docker:up
```
Wait a few seconds, then verify:
```bash
docker ps
```
You should see `guildpay-db` and `guildpay-redis` running.

### Step 3: Install all dependencies
```bash
npm install
```

### Step 4: Generate Prisma client
```bash
cd packages/db
npx prisma generate
```

### Step 5: Run database migrations
```bash
npx prisma migrate dev --name init
```

### Step 6: Seed test data
```bash
npx tsx prisma/seed.ts
```

### Step 7: Test sandbox connectivity
```bash
cd ../../apps/api
npx tsx src/scripts/test-sandbox.ts
```

### Step 8: Start the API server
```bash
npm run dev
```

Server runs on http://localhost:3001

---

## Test the MVP

### Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@guildpay.com","password":"Test1234!"}'
```

Copy the `accessToken` from the response. Use it as `YOUR_TOKEN` below.

### Check Wallet Balances
```bash
curl http://localhost:3001/api/v1/wallets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get FX Quote (QAR to NGN)
```bash
curl "http://localhost:3001/api/v1/transfers/fx/quote?from=QAR&to=NGN&amount=1000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### List Recipients
```bash
curl http://localhost:3001/api/v1/recipients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Money (QAR to NGN)
```bash
curl -X POST http://localhost:3001/api/v1/transfers/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "PASTE_RECIPIENT_ID_HERE",
    "amount": 100,
    "currency": "QAR",
    "toCurrency": "NGN",
    "pin": "123456"
  }'
```

### Top Up Wallet (Flutterwave test card)
```bash
curl -X POST http://localhost:3001/api/v1/transfers/topup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "currency": "USD", "paymentMethod": "card"}'
```
Use test card `5531886652142950`, any future expiry, any CVV, OTP: `12345`.

### Buy Airtime
```bash
curl -X POST http://localhost:3001/api/v1/bills/airtime \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"MTN","phoneNumber":"08012345678","amount":500,"currency":"NGN"}'
```

### List Corridors
```bash
curl http://localhost:3001/api/v1/transfers/corridors \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Test Credentials

| What | Value |
|------|-------|
| Email | `test@guildpay.com` |
| Password | `Test1234!` |
| PIN | `123456` |
| KYC Tier | TIER_2 ($5000/day limit) |

### Pre-funded Wallet
| Currency | Balance |
|----------|---------|
| USD | $1,000 |
| NGN | N500,000 |
| QAR | 5,000 |
| AED | 3,000 |
| GBP | 500 |
| KES | KSh50,000 |
| GHS | 2,000 |

### Flutterwave Test Cards
| Card | Type | Notes |
|------|------|-------|
| `5531886652142950` | Mastercard | OTP: `12345` |
| `4187427415564246` | Visa | PIN: `3310`, OTP: `12345` |

### Test Recipients (pre-seeded)
| Name | Country | Details |
|------|---------|---------|
| Adebayo Ogunlesi | Nigeria | Access Bank `0690000032` |
| Amina Ibrahim | Nigeria | GTBank `0123456789` |
| Kwame Asante | Ghana | MTN `+233241234567` |
| Wanjiku Kamau | Kenya | M-Pesa `+254712345678` |
| Mohammed Al-Thani | Qatar | Doha Bank IBAN |

---

## Webhooks (Optional)

Install ngrok and expose your local API:
```bash
brew install ngrok
ngrok http 3001
```

Set in Flutterwave Dashboard (Settings > Webhooks):
- URL: `https://YOUR_NGROK.ngrok.io/webhooks/flutterwave`
- Secret Hash: `ca6f0b741cadbc1f19e960ebd020af2e`

---

## Troubleshooting

**"Cannot connect to Docker daemon"** - Open Docker Desktop app first

**"EUNSUPPORTEDPROTOCOL workspace:*"** - Fixed. Run `npm install` again

**"DATABASE_URL not found"** - Make sure `.env` exists in the `guildpay/` root

**"Cannot find module"** - Run `npm install` from the `guildpay/` root first

**Port 5432 already in use** - Another PostgreSQL is running. Stop it or change the port in docker-compose.yml
