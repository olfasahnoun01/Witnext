# Alpha — Grosafe Inventory Hub

ERP for Grosafe: inventory, sales, purchases, finance, HR, and fleet management. Available as a **web app** (Vercel, internal staff) and a **Windows desktop app** (Electron).

## Stack

- Vite + React + TypeScript
- Supabase (auth, database, storage, edge functions)
- Vercel (web hosting) + Electron (Windows desktop build)
- Tailwind CSS + shadcn/ui

## Local development

```sh
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                    # web mode — http://localhost:5173
npm run electron:dev           # Electron shell + Vite (HashRouter)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (web target, BrowserRouter) |
| `npm run build:web` | Production build for Vercel (`base: /`, BrowserRouter) |
| `npm run build:electron` | Production build for Electron installer (`base: ./`, HashRouter) |
| `npm run build` | Alias for `build:web` |
| `npm run preview` | Preview web build locally |
| `npm run electron:dev` | Electron + Vite (dev) |
| `npm run electron:build` | Windows NSIS installer |
| `npm test` | Vitest unit tests |

## Web deployment (Vercel)

1. Import this repo in [Vercel](https://vercel.com) and use:
   - **Build command:** `npm run build:web`
   - **Output directory:** `dist`
2. Set environment variables (Production and Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_APP_TARGET=web`
3. Enable **Deployment Protection** (password or SSO) on Production for internal staff access.
4. `[vercel.json](vercel.json)` rewrites all routes to `index.html` for SPA routing.

After the first deploy, note your production URL (e.g. `https://your-app.vercel.app`) for Supabase configuration below.

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

Browser calls to edge functions from Vercel require allowed origins. Set a Supabase secret with your web URL(s):

```sh
supabase secrets set WEB_APP_ORIGINS=https://your-app.vercel.app
supabase functions deploy manage-users
supabase functions deploy sync-woocommerce-gallery
```

Add preview deployment URLs to `WEB_APP_ORIGINS` (comma-separated) when needed.

Migrations live in `supabase/migrations/`. After changing edge functions, redeploy:

```sh
supabase functions deploy manage-users
supabase functions deploy sync-woocommerce-gallery
```

### Storage and RLS

Document buckets (`client-documents`, `product-documents`, `fiches-techniques`) require authenticated users (see `supabase/migrations/`). Authorization for data operations is enforced by Row-Level Security policies — client-side role flags are UI-only.

## Environment

Required variables (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional:

- `VITE_APP_TARGET` — set automatically by build scripts (`web` or `electron`)
- `VITE_DEBUG_INGEST=true` — local debug ingest only (dev mode)

## Rollout checklist (web)

1. Deploy to Vercel with Deployment Protection enabled.
2. Configure Supabase Auth URLs and `WEB_APP_ORIGINS` secret; redeploy edge functions.
3. Smoke-test in Chrome/Edge: login, dashboard, inventory, PDF viewer, document upload, user management, finance module.
4. Share URL with staff; keep Electron installer available during transition.
5. Monitor Supabase logs for RLS denials and edge function errors during the first week.

## Electron releases

Desktop builds use `npm run electron:build` or `npm run electron:build:release` (GitHub publish). Trigger on release tags, not on every web deploy.
