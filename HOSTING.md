# Hosting Tableaux

This guide takes you from a fresh repo to a live, HTTPS-secured deployment of Tableaux. It is written for the app's **actual** stack:

- **Frontend:** React + Vite, built to static files in `client/dist`.
- **Backend:** Node + Express (`server/index.js`), which **also serves the built client** in production (single artifact — see the [`Dockerfile`](Dockerfile)).
- **Database + Auth:** **Supabase** (Postgres + GoTrue auth + Row-Level Security). The app cannot run in production without it (`server/index.js` fails fast if Supabase isn't configured).

**Recommended stack: Supabase (data/auth) + Fly.io (the app).** Rationale and free-tier limits are in §2.

---

## 1. Pre-Deployment Checklist

Tick every box before going live:

- [ ] All secrets come from environment variables — **none committed in source** (verified: only Supabase *public demo* keys appear in local `.env`, which is gitignored).
- [ ] `.env` is in `.gitignore` (it is — root `.gitignore`).
- [ ] `NODE_ENV=production` is set on the server (the Dockerfile sets it; Fly inherits it).
- [ ] Debug logging is off — the 500-handler logs message+stack only, never request bodies ([`server/middleware/errorHandler.js`](server/middleware/errorHandler.js)).
- [ ] HTTPS is enforced and **HSTS** is active (Fly terminates TLS; helmet sends `Strict-Transport-Security` — verify in §3.6).
- [ ] **Email verification is ON** in the hosted Supabase project (Auth → Providers → Email → "Confirm email"). The server 403s unverified users.
- [ ] Email sending works end-to-end — sign up a test account and confirm you receive the verification mail (see §3.4 about the default-email rate limit).
- [ ] GDPR pages are reachable and linked: `/privacy-policy.html`, `/terms-of-service.html` (linked from the sign-in screen, the Account & data menu, and the public pages).
- [ ] **Placeholders filled in** the legal pages — replace `[YOUR FULL NAME]`, `[CONTACT EMAIL]`, `[POSTAL ADDRESS]`, `[DATE]` in `client/public/privacy-policy.html` and `client/public/terms-of-service.html`.
- [ ] Database backups configured (Supabase auto-backups on free tier; see §4.3).
- [ ] Dependency audit clean: `npm audit --omit=dev --audit-level=high` reports **0 vulnerabilities** (it does — the remaining advisories are dev-only vitest/vite/esbuild and never ship).
- [ ] Uptime monitoring set up (§4.4) — also keeps the Supabase project from pausing on inactivity.

---

## 2. Recommended Free Hosting Stack

### Fly.io — runs the app (Express + built client)

**Free forever?** Fly.io no longer advertises a blanket free allowance, but small apps within the **"pay-as-you-go" free usage** (one `shared-cpu-1x` 256 MB VM, ~3 GB persistent volume, 160 GB outbound transfer/mo) typically incur **no charge**. You must add a payment card to deploy; you will not be billed unless you exceed the free usage. Flag this honestly: it is "free for small usage," not a guaranteed-free tier.

- **No forced sleep** — unlike Render's free web service, Fly VMs don't cold-sleep after inactivity (you can optionally enable auto-stop to save resources).
- **RAM/CPU:** 256 MB / shared CPU is enough for this Express app (it's I/O-bound; heavy work is in the browser).
- **Custom domain:** ✅ supported on free usage, with free auto-provisioned TLS certificates.
- **Build minutes:** builds run remotely or locally via `fly deploy`; no separate quota to worry about for this size.

### Supabase — Postgres + Auth (already integrated)

**Free forever?** Yes, there is a genuine free tier.

- **Database:** 500 MB Postgres, up to ~2 GB egress/mo.
- **Auth:** 50,000 monthly active users.
- **⚠️ Inactivity pause:** free projects **pause after 7 days of no activity** and must be resumed from the dashboard. The UptimeRobot monitor in §4.4 keeps the app — and therefore the DB — active.
- **Custom SMTP:** the built-in email service is rate-limited (a few per hour — see §3.4). For real volume, attach your own SMTP later; not required to launch.

### Alternatives considered

| Option | Verdict |
|---|---|
| **Render** | Easiest dashboard, free Postgres + web service, but the free web service **sleeps after ~15 min** (slow first request) and free Postgres expires after 90 days. Fine for a demo; Fly is better for a real launch. |
| **Railway** | Not free forever — free trial then **$5/mo** minimum. Skip if you want $0. |
| **Vercel/Cloudflare + Supabase** | Great for a static client, but this Express server isn't serverless-shaped (it serves the SPA and proxies uploads). Splitting it adds complexity for no benefit here. Revisit only if you later make the backend stateless functions. |

---

## 3. Step-by-Step Deployment (Supabase + Fly.io)

### 3.1 Create and configure the Supabase project

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL** and, from Project Settings → API, the **anon key** and the **service_role key**.
2. **Apply the database schema.** The migrations live in [`supabase/migrations/`](supabase/migrations/). Either:
   - **CLI (recommended):** `npx supabase link --project-ref <ref>` then `npx supabase db push`, **or**
   - **Manually:** open each migration in the SQL Editor in order and run it (`20260615000001_init.sql`, then `20260616000001_shares.sql`).
3. **Enable email confirmation:** Auth → Providers → Email → turn **"Confirm email" ON**. This mirrors `enable_confirmations = true` in `supabase/config.toml` and is required — the server rejects unverified users.
4. **Set the Site URL & redirects:** Auth → URL Configuration → set **Site URL** to your final domain (e.g. `https://tableaux.example.com`) so confirmation/magic links point at production.

### 3.2 Install Fly and launch

```bash
# one-time
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth signup            # or: fly auth login

# from the repo root — generates fly.toml, detects the Dockerfile, DOES NOT deploy yet
fly launch --no-deploy
```

When prompted, pick a region near your users (e.g. `lhr` London) and accept the Dockerfile.

### 3.3 Set build args and runtime secrets

The client's `VITE_*` values are **baked in at build time** (Vite inlines them), so they must be passed as **Docker build args**; the server's values are **runtime secrets**.

**Build args** (client, public — baked into the browser bundle). Set these in `fly.toml` under `[build.args]`:

```toml
[build.args]
  VITE_SUPABASE_URL = "https://<ref>.supabase.co"
  VITE_SUPABASE_ANON_KEY = "<anon key>"     # public by design (gated by RLS)
  VITE_PUBLIC_URL = "https://tableaux.example.com"   # your final URL, no trailing slash
```

> `VITE_PUBLIC_URL` also drives the canonical/OG tags and the generated `sitemap.xml`. Set it to the real domain or social previews and the sitemap will be wrong/absent.

**Runtime secrets** (server — never in the bundle). Set with `fly secrets set`:

```bash
fly secrets set \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service_role key>" \
  CLIENT_ORIGIN="https://tableaux.example.com" \
  NODE_ENV="production"
```

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | build arg | Supabase URL for the browser client |
| `VITE_SUPABASE_ANON_KEY` | build arg | Public anon key (RLS-gated) |
| `VITE_PUBLIC_URL` | build arg | Canonical/OG/sitemap origin |
| `SUPABASE_URL` | secret | Supabase URL for the server |
| `SUPABASE_ANON_KEY` | secret | Used to validate user JWTs |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | **Server-only.** Account deletion / health check. Never exposed. |
| `CLIENT_ORIGIN` | secret | CORS allowlist (comma-separated for multiple origins) |
| `NODE_ENV` | secret/Dockerfile | Must be `production` |
| `PORT` | optional | Defaults to 3001 (matches `EXPOSE`/healthcheck) — leave unset |

> Set `CLIENT_ORIGIN` to the **same** origin you serve from. Because the server serves the client from its own origin, browser API calls are same-origin and CORS is effectively a backstop — but keep it accurate so any future separate-origin client is allowlisted explicitly.

### 3.4 Email note (default Supabase email)

You opted not to run custom email infrastructure. Supabase's **built-in** email sends verification links out of the box, but its default service is **rate-limited (~2–4 emails/hour)** — fine for a soft launch, but it will throttle a burst of sign-ups. When you need more, attach an SMTP provider (Brevo/Resend free tiers) under Auth → SMTP Settings; no app code changes are required.

### 3.5 Deploy

```bash
fly deploy
```

This builds the Docker image (running `npm run build` for the client inside the build stage), pushes it, and starts the VM. Watch for the healthcheck on `/api/health` to go green.

### 3.6 Custom domain + verify HTTPS/HSTS

```bash
fly certs add tableaux.example.com      # then add the shown A/AAAA/CNAME records at your DNS host
fly certs show tableaux.example.com     # wait until it reports "issued"
```

Verify TLS and security headers:

```bash
curl -sI https://tableaux.example.com | grep -iE \
  'strict-transport-security|x-frame-options|referrer-policy|permissions-policy|x-content-type-options'
```

You should see:

```
strict-transport-security: max-age=31536000; includeSubDomains
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
x-content-type-options: nosniff
```

Then do one full manual pass: sign up → receive verification email → click link → confirm you can use the app; and confirm an **unverified** account is held on the "Verify your email" screen.

---

## 4. Ongoing Maintenance

### 4.1 Redeploy after changes
```bash
git push                 # CI runs lint + tests + build + docker build
fly deploy               # ship it
```
If you changed any `VITE_*` value, update `[build.args]` in `fly.toml` first — they're compiled in, so a redeploy is required for them to take effect.

### 4.2 View production logs
```bash
fly logs                 # live tail
fly logs -n              # recent, no follow
```

### 4.3 Database backups & restore
- **Backups:** Supabase free tier takes automatic daily backups (retained ~7 days). View under Database → Backups.
- **Manual snapshot:** `npx supabase db dump --db-url "<connection string>" > backup.sql`.
- **Restore:** from the dashboard's backup list, or `psql "<connection string>" < backup.sql` for a manual dump.
- Encourage users to self-backup via **Account & data → Export my data (JSON)** — the app already provides this (GDPR Art. 20).

### 4.4 Uptime monitoring (free)
Create an [UptimeRobot](https://uptimerobot.com) HTTP(s) monitor on `https://tableaux.example.com/api/health` at a 5-minute interval. This alerts you to downtime **and** keeps the free Supabase project from pausing after 7 days of inactivity.

### 4.5 Dependency audit routine
Run monthly and before any release:
```bash
npm audit --omit=dev --audit-level=high     # production deps — must be clean
npm audit                                   # full picture (dev advisories are non-shipping)
```
Patch promptly if a **production** High/Critical ever appears. Dev-only advisories (vitest/vite/esbuild) can be upgraded opportunistically with `npm audit fix`.

---

## 5. Data Retention (operational note)

The privacy policy commits to deleting accounts inactive for 2 years with 30 days' notice. This is **not yet automated** (it needs a scheduled job + email, which is out of scope while there's no custom email infrastructure). Until automated, treat it as a manual periodic task, or implement a Supabase scheduled function + SMTP when email volume justifies it.
