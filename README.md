# Trip Splitter

Split trip costs with friends — for iOS and Android, from one codebase.

## What's here

- **`backend/`** — Node.js + TypeScript + Express API, PostgreSQL via Prisma, real-time
  updates over Socket.io, receipt image uploads (local disk in dev, S3-compatible object
  storage in production).
- **`mobile/`** — Expo (React Native + TypeScript) app that runs on iOS, Android, and web
  from a single codebase.

Ready to deploy this for real, on real app stores? See **[PRODUCTION.md](./PRODUCTION.md)**
for the full deployment, app-store-submission, and security-hardening runbook.

## Features (current scope)

- Sign up / log in with email or phone
- Home screen listing your trips with total spend and your balance
- Create a trip: name it, set a currency, invite members by phone number or email
  (invited people show up in the trip immediately, even before they've signed up —
  their account is claimed automatically when they do)
- Add an expense: title, description, amount, currency, receipt photo, and how it's split:
  - **Just me** — a personal cost, not shared with the group
  - **Split equally** — divided evenly across every trip member
  - **Split with select people** — divided evenly across whichever members you pick
- Every submission is visible to the whole group immediately (Socket.io pushes live
  updates to everyone viewing that trip — no refresh needed)
- Edit any previously entered expense
- Running trip summary after every change: total spent, how much each person paid vs.
  their share, each person's net balance, and simplified "who should pay whom" settle-up
  suggestions

## Prerequisites

- Node.js 18+
- PostgreSQL — either install it locally, or run `docker compose up -d` from `backend/`
  to start one in a container (see `backend/docker-compose.yml`)
- For running on a device/simulator: [Expo Go](https://expo.dev/go) app (easiest), or
  Xcode (iOS) / Android Studio (Android) for a native build

## 1. Run the backend

```bash
cd backend
npm install
cp .env.example .env      # edit DATABASE_URL if your local Postgres differs
npm run prisma:migrate    # applies migrations to your local Postgres database
npm run dev                # starts the API on http://localhost:4000
```

The API serves REST endpoints under `/api/*`, real-time updates over Socket.io, and
uploaded receipt images under `/uploads/*`.

## 2. Run the mobile app

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `mobile/.env` so `EXPO_PUBLIC_API_URL` points at your backend:

- Android emulator: `http://10.0.2.2:4000`
- iOS simulator: `http://localhost:4000`
- Physical device via Expo Go: `http://<your-computer's-LAN-IP>:4000` (phone and
  computer must be on the same network)

Then start the app:

```bash
npm run start      # opens Expo dev tools — scan the QR code with Expo Go, or...
npm run ios        # opens the iOS simulator (macOS only)
npm run android    # opens an Android emulator
```

## How data flows

- The mobile app talks to the backend over REST for reads/writes and joins a
  Socket.io room per trip (`trip:<id>`) to receive live `expense-created`,
  `expense-updated`, and `member-added` events, so everyone in a trip sees new
  expenses the instant they're submitted.
- Expense splits are computed server-side and stored per member, so balance and
  settle-up math is always consistent regardless of who's viewing.

## What's next

This is the first milestone — auth, trips, invites, expenses, live sync, and balances.
Further scope (e.g. push notifications, real SMS invites, multi-currency conversion,
settlement tracking) can be layered on from here.
