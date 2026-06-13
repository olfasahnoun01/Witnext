# Alpha — Grosafe Inventory Hub

Desktop ERP for Grosafe: inventory, sales, purchases, finance, HR, and fleet management.

## Stack

- Vite + React + TypeScript
- Supabase (auth, database, storage, edge functions)
- Electron (Windows desktop build)
- Tailwind CSS + shadcn/ui

## Local development

```sh
npm install
cp .env.example .env.local   # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                    # http://localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production web build (`dist/`) |
| `npm run electron:dev` | Electron + Vite (dev) |
| `npm run electron:build` | Windows installer |
| `npm test` | Vitest unit tests |

## Supabase

Migrations live in `supabase/migrations/`. After changing edge functions (e.g. CORS), redeploy:

```sh
supabase functions deploy manage-users
supabase functions deploy sync-woocommerce-gallery
```

## Environment

Required variables (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
