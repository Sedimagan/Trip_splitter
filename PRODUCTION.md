# Going to production

This is the runbook for taking Trip Splitter from "runs on my laptop" to a
real, deployed app on the App Store and Google Play. It covers what's
already been built into the codebase, and the steps that need your own
accounts/credentials and can't be automated from here.

Read it top to bottom once, then use it as a checklist.

---

## 1. What changed to make this production-ready

Already done in this repo (see `backend/` and `mobile/`):

- **Database**: switched from SQLite to PostgreSQL (SQLite is a single file —
  it doesn't survive redeploys on most hosts and can't handle concurrent
  writes safely). `docker-compose.yml` gives you a local Postgres for dev.
- **Receipt storage**: uploads now go through an abstraction
  (`backend/src/lib/storage.ts`) that uses S3-compatible object storage
  (AWS S3, Cloudflare R2, Backblaze B2, ...) when configured, and falls back
  to local disk only when it isn't. **You must configure object storage for
  production** — local disk is wiped on every redeploy on almost every
  hosting platform.
- **Security middleware**: `helmet` (HTTP security headers), `express-rate-limit`
  (global + a stricter limit on `/api/auth/login` and `/api/auth/signup` to
  slow brute-forcing), `compression`, a CORS allowlist driven by
  `CORS_ORIGIN`, and a request body size cap.
- **Fail-fast config validation** (`backend/src/lib/env.ts`): the server
  refuses to start in production with a missing/weak `JWT_SECRET` or a
  wildcard CORS origin, instead of silently running insecurely.
- **Error handling**: stack traces and internal error messages are no longer
  sent to clients when `NODE_ENV=production`.
- **Containerization**: `backend/Dockerfile` for a portable, reproducible
  deploy (works on Render, Railway, Fly.io, AWS ECS/App Runner, etc.).
- **CI** (`.github/workflows/ci.yml`): typechecks and builds both the backend
  and mobile app, and applies migrations against a throwaway Postgres, on
  every push/PR.
- **EAS build config** (`mobile/eas.json`): development/preview/production
  build profiles for the mobile app, plus a submit config skeleton.

Everything below this line requires accounts, credentials, or decisions only
you can make.

---

## 2. Backend: deploy the API

### 2.1 Pick a host

Any host that runs a Node.js container/process works. Two easy, cheap paths:

- **Render / Railway / Fly.io** (recommended to start): point them at this
  repo's `backend/` directory (or its `Dockerfile`), add a managed Postgres
  add-on, set environment variables (below), and deploy. All three
  auto-provision HTTPS certificates.
- **AWS/GCP/Azure**: use the `Dockerfile` with ECS/Cloud Run/Container Apps
  once you outgrow a PaaS. More setup, more control.

### 2.2 Required environment variables

Set these in your host's dashboard/secret manager — never commit them:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Your managed Postgres connection string |
| `JWT_SECRET` | **Generate fresh, don't reuse the dev one.** `openssl rand -base64 48` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Comma-separated allowed origins. For a mobile-only app this is mostly for your admin/web tooling if you add any — but leave it set to something explicit, never `*` |
| `PORT` | Usually set by the host automatically |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Object storage for receipts (2.3) |
| `S3_ENDPOINT` | Only for non-AWS S3-compatible storage (R2, B2, MinIO) |
| `S3_PUBLIC_URL_BASE` | The public/CDN URL your bucket is served from |

### 2.3 Object storage for receipts

Pick one:
- **Cloudflare R2** — cheapest, no egress fees, S3-compatible. Create a
  bucket, an API token scoped to that bucket only, and a public bucket
  domain (or put a Cloudflare custom domain in front of it) for
  `S3_PUBLIC_URL_BASE`.
- **AWS S3** — create a bucket, block all public ACLs, put CloudFront in
  front of it for `S3_PUBLIC_URL_BASE`, and create an IAM user with a policy
  scoped to `s3:PutObject` on that one bucket only (least privilege — never
  use root/admin credentials here).

### 2.4 Database

1. Provision managed Postgres (Render/Railway/Fly Postgres, AWS RDS, Neon,
   Supabase — any of these work; Prisma just needs a connection string).
2. Run migrations against it: `npx prisma migrate deploy` (the Dockerfile's
   `CMD` already does this on every container start, which is the standard
   pattern — safe to run repeatedly, it only applies pending migrations).
3. Turn on your provider's automated backups (daily, with a retention
   window) — this is usually a checkbox, not a build step.
4. If you outgrow a single small instance: add PgBouncer or your provider's
   built-in connection pooler in front of Postgres before you add more
   backend instances, since each Node process holds its own Prisma
   connection pool.

### 2.5 Scaling past one instance

The current Socket.io setup broadcasts to rooms **in-process only**. That's
correct and sufficient for a single backend instance. The moment you run
more than one instance behind a load balancer, you need the
[`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) (plus
a small Redis instance) so a message emitted from instance A also reaches a
client connected to instance B — otherwise some users stop getting live
updates depending on which instance they land on. Don't add this until you
actually need more than one instance; it's real infra to run and monitor.

### 2.6 Observability

- **Error tracking**: add [Sentry](https://sentry.io) (`@sentry/node` on the
  backend, `sentry-expo` on mobile) — free tier is enough to start. Without
  this, a production bug shows up only as a support message from a user.
- **Uptime monitoring**: point something like UptimeRobot or Better Stack at
  `GET /health` on an interval, alert on failure.
- **Logs**: your host's log stream is fine to start; if you outgrow it,
  ship to a log service (Axiom, Better Stack, Datadog).

---

## 3. Mobile: build and publish to the stores

### 3.1 Accounts you need

- **Apple Developer Program** — $99/year, enrolled at
  [developer.apple.com](https://developer.apple.com). Required for App Store
  distribution (TestFlight and public release both).
- **Google Play Console** — $25 one-time, at
  [play.google.com/console](https://play.google.com/console).
- **Expo/EAS account** — free tier is enough for occasional builds
  ([expo.dev](https://expo.dev)). Run `npx eas login`, then `npx eas init`
  inside `mobile/` to create a project and fill in the real
  `extra.eas.projectId` in `app.json` (currently a placeholder).

### 3.2 Before your first real build

- Replace the placeholder icons/splash in `mobile/assets/` with real
  branding (App Store and Play Store both reject template assets on review
  in some cases, and it just looks unfinished).
- Fill in the placeholders in `mobile/eas.json`: your staging/production API
  URLs, Apple ID email, App Store Connect app ID, Apple team ID, and point
  `serviceAccountKeyPath` at a real Google Play service account JSON key
  (never commit that file — it's already gitignored).
- Decide your final `bundleIdentifier`/`package` in `app.json` (currently
  `com.tripsplitter.app`) — **this cannot be changed after your first store
  submission** without publishing as a new app.

### 3.3 Build

```bash
cd mobile
npx eas build --profile production --platform ios
npx eas build --profile production --platform android
```

Use `--profile preview` first to get an installable internal build (an APK
for Android, an ad-hoc/simulator build for iOS) to test on real devices
before you spend a store review cycle on it.

### 3.4 Submit

```bash
npx eas submit --profile production --platform ios
npx eas submit --profile production --platform android
```

- **iOS**: lands in App Store Connect. Fill out the **App Privacy**
  questionnaire accurately (this app collects: name, email or phone number,
  and financial data — the expense amounts users enter) — get this wrong
  and Apple rejects or your published "privacy label" is misleading.
  Provide screenshots (6.7" and 5.5" iPhone at minimum), an app description,
  support URL, and a **Privacy Policy URL** (required — see §4). Submit for
  review, or push to TestFlight for internal/external beta testing first
  (recommended).
- **Android**: lands in Play Console. Complete the **Data safety** section
  (same accuracy requirement as Apple's privacy label), a content rating
  questionnaire, and add a **Privacy Policy URL**. Roll out to an Internal
  testing track first, then Production.

### 3.5 Over-the-air updates (optional but recommended)

`expo-updates` lets you push JS-only bug fixes to users without a full store
review cycle. Native changes (new permissions, new native modules) still
need a store build. Worth adding once you're past initial launch.

---

## 4. Required before you can actually submit: account deletion + privacy policy

Two things are **hard requirements**, not nice-to-haves, and aren't built
yet:

1. **In-app account deletion.** Apple's App Store Review Guideline 5.1.1(v)
   requires any app with account creation to let users delete their account
   from inside the app, not just via a web form. The clean way to do this
   here without corrupting other people's trip history is a **soft
   delete/anonymize**: mark the user inactive, clear their name to
   "Deleted user", clear email/phone/password so they can't log in — but
   keep their historical expense and split records intact (other trip
   members' balances still need to add up correctly). I didn't build this
   yet since it's a real feature decision, not a config change — say the
   word and I'll add the endpoint + a "Delete account" screen.
2. **A hosted Privacy Policy** (and ideally Terms of Service) at a public
   URL, describing what you collect (name, email/phone, trip and expense
   data, receipt photos) and how it's used/stored. Both stores require the
   URL at submission. This can be a simple static page — happy to draft one
   if useful.

---

## 5. Security & safety checklist

**Already in place:**
- [x] Passwords hashed with bcrypt, never stored/logged in plaintext
- [x] JWT auth, verified on every request; tokens stored in `expo-secure-store`
  (iOS Keychain / Android Keystore) on the client, not `AsyncStorage`
- [x] Generic "Invalid credentials" on login failure (doesn't reveal whether
  an email/phone is registered)
- [x] Rate limiting: global + a strict limit on login/signup
- [x] Input validation on every endpoint (`zod`)
- [x] File upload validation: image MIME allowlist, 10 MB size cap
- [x] `helmet` security headers, gzip/deflate via `compression`
- [x] CORS allowlist (no wildcard in production — enforced at startup)
- [x] No stack traces / internal errors leaked to clients in production
- [x] Secrets kept out of git (`.env` gitignored everywhere, `.env.example`
  committed instead)
- [x] Object storage credentials scoped to one bucket (once you follow §2.3)

**Do before/shortly after launch:**
- [ ] Generate a fresh, unique `JWT_SECRET` for production (never reuse the
  dev placeholder — the server will actually refuse to boot on it)
- [ ] Turn on your database host's automated backups
- [ ] Add Sentry (or similar) for both backend and mobile crash/error
  reporting
- [ ] Add uptime monitoring on `/health`
- [ ] Put the repo's `npm audit` / Dependabot (GitHub → Settings → Security)
  on autopilot so dependency CVEs surface automatically
- [ ] Write and host a Privacy Policy + Terms of Service (§4)
- [ ] Build account deletion (§4)
- [ ] Consider shortening JWT expiry (currently 30 days) with a refresh-token
  flow if you want tighter session control — a reasonable v2 hardening step,
  not a launch blocker
- [ ] If you ever serve any web surface (admin panel, marketing site) from
  this backend, add HSTS explicitly and confirm it via
  [securityheaders.com](https://securityheaders.com) once deployed
- [ ] Consider Cloudflare (or your host's equivalent) in front of the API
  for network-layer DDoS protection — app-level rate limiting alone won't
  stop a volumetric attack

**Ongoing:**
- [ ] Rotate `JWT_SECRET` and object storage credentials if you ever suspect
  a leak (rotating the JWT secret immediately invalidates every logged-in
  session — expected and fine)
- [ ] Keep dependencies patched (`npm audit`, Dependabot PRs)
- [ ] Review Apple/Google's privacy-label requirements periodically — they
  change, and a stale/inaccurate label is a real rejection risk in re-review

---

## 6. Rough cost picture

Not a quote, just so nothing surprises you:

| Item | Cost |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| Backend hosting (small) | $0–25/month (Render/Railway free-to-starter tiers) |
| Managed Postgres (small) | $0–15/month |
| Object storage (R2/S3) | Pennies at low volume — R2 has no egress fee |
| Domain name | ~$10–15/year |
| Sentry | Free tier covers early-stage volume |
| EAS builds | Free tier covers occasional builds; paid if you build often |

---

## 7. Suggested order of operations

1. Stand up managed Postgres + object storage; deploy the backend; verify
   `/health` and a real signup/login/create-trip/add-expense flow against it.
2. Point `mobile/eas.json`'s `production` profile at that live backend URL.
3. Build a `preview` mobile build, install it on a real device, and use the
   app for real against the live backend for a few days.
4. Build account deletion + privacy policy (§4) — required for submission.
5. Add Sentry + uptime monitoring.
6. `eas build --profile production` → TestFlight / Play Internal testing.
7. Submit for store review on both platforms.
