# Witnext

ERP for inventory, sales, purchases, finance, HR, and fleet management. Available as a **web app** (Vercel) with a **public marketing site** and **protected ERP**. Legacy Electron scripts remain in `package.json` but are **not actively maintained** — web is the primary platform.

## Public marketing site

Anonymous visitors can browse:

| Route | Purpose |
|-------|---------|
| `/` | Landing — discover Witnext modules |
| `/pricing` | Licence plans (Essentiel, Pro, Entreprise) |
| `/trial` | Free trial request form |
| `/buy` | Licence purchase inquiry form |
| `/auth` | Staff login |
| `/signup` | Self-serve trial signup (creates tenant + admin) |

Trial and licence forms submit to Supabase via the `submit-marketing-lead` edge function. Admins triage requests at **`/admin/leads`** (link also on the Users page).

### Deploy checklist (marketing)

1. Apply migration: `npx supabase db push` (includes `marketing_leads` table).
2. Set secrets: `TURNSTILE_SECRET_KEY`, `WEB_APP_ORIGINS` (your Vercel URL).
3. Deploy functions: `npm run supabase:deploy-functions`
4. **Vercel Deployment Protection:** if enabled, it blocks anonymous visitors from `/`, `/pricing`, `/trial`, and `/buy`. Either disable protection for production or configure exceptions so the marketing pages stay public while the ERP remains staff-only after login.

## Stack

- Vite + React + TypeScript
- Supabase (auth, database, storage, edge functions)
- Vercel (web hosting)
- Tailwind CSS + shadcn/ui

## Local development

```sh
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_TURNSTILE_SITE_KEY
npm run dev                  # http://localhost:5173
```

If login captcha fails with **110200**, add `localhost` (and your production domain) under Cloudflare Turnstile → **Hostname Management**, then reload.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build:web` | Production build for Vercel |
| `npm run build` | Alias for `build:web` |
| `npm run preview` | Preview web build locally |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests (starts dev server if needed) |
| `npm run test:e2e:install` | One-time: download Playwright Chromium browser |
| `npm run lint` | ESLint |
| `npm run types:supabase` | Regenerate Supabase TypeScript types |

See [CONTRIBUTING.md](CONTRIBUTING.md) for module structure and PR checklist.

Legacy Electron scripts (`electron:dev`, `electron:build`) remain in `package.json` but are **not actively maintained** — web is the primary platform.

## Web deployment (Vercel)

1. Import this repo in [Vercel](https://vercel.com) and use:
   - **Build command:** `npm run build:web`
   - **Output directory:** `dist`
2. Set environment variables (Production and Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_TURNSTILE_SITE_KEY` (Cloudflare Turnstile **site** key — same as in `.env.local`)
   - `VITE_APP_TARGET=web`
   
   Vite embeds `VITE_*` at **build** time. After adding or changing env vars, trigger a new deployment.
3. **Vercel Deployment Protection** (optional): use password/SSO if you want to restrict who can reach the app URL before login. Note: full-site protection also blocks the public marketing pages — see [Public marketing site](#public-marketing-site).
4. `[vercel.json](vercel.json)` rewrites all routes to `index.html` for SPA routing.

After the first deploy, note your production URL (e.g. `https://witnext.vercel.app`) for Supabase configuration below.

## Supabase configuration

### Auth redirect URLs

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** your Vercel production URL
- **Redirect URLs:** add production URL, preview URL(s), and dev URLs:
  - `https://your-app.vercel.app`
  - `https://your-app.vercel.app/auth`
  - `http://localhost:5173`
  - `http://localhost:5173/auth`

### Edge function CORS (web origins)

Browser calls to edge functions from Vercel require allowed origins. From the project root (Supabase CLI is installed as a dev dependency — use `npm run`, not bare `supabase`):

```sh
npm run supabase:login
npm run supabase:link
npm run supabase:secrets:web
npm run supabase:deploy-functions
```

Or with npx: `npx supabase login`, etc.

To use a different URL, run `npx supabase secrets set WEB_APP_ORIGINS=https://your-url.vercel.app` before deploy.

Migrations live in `supabase/migrations/`. Apply new migrations to production:

```sh
npx supabase db push
```

After changing edge functions, redeploy:

```sh
npm run supabase:deploy-functions
# or individually:
supabase functions deploy manage-users
supabase functions deploy setup-admin
supabase functions deploy sync-woocommerce-gallery
```

### First admin bootstrap (`setup-admin`)

The `setup-admin` edge function is **disabled by default**. To create the first admin only:

```sh
npx supabase secrets set SETUP_ADMIN_ENABLED=true SETUP_ADMIN_TOKEN=<long-random-token>
supabase functions deploy setup-admin
# POST once with header X-Setup-Token: <token>, then immediately:
npx supabase secrets set SETUP_ADMIN_ENABLED=false
```

### Storage and RLS

Document buckets (`client-documents`, `product-documents`, `fiches-techniques`) require authenticated users (see `supabase/migrations/`). Authorization for data operations is enforced by Row-Level Security policies — client-side role flags are UI-only.

## Environment

Required variables (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional:

- `VITE_APP_TARGET` — set automatically by build scripts (`web` by default)
- `VITE_DEBUG_INGEST=true` — local debug ingest only (dev mode)
- `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` — Playwright authenticated smoke tests

## CI

GitHub Actions runs on every push/PR to `main`/`master`:

- `npm run lint`
- `npm test`
- `npm run build:web`
- Playwright smoke (unauthenticated always; authenticated when repo secrets are set)

## Rollout checklist (web)

1. Deploy to Vercel with Deployment Protection enabled.
2. Configure Supabase Auth URLs and `WEB_APP_ORIGINS` secret; redeploy edge functions.
3. Smoke-test in Chrome/Edge: login, dashboard, inventory, PDF viewer, document upload, user management, finance module.
4. Share URL with staff.
5. Monitor Supabase logs for RLS denials and edge function errors during the first week.
