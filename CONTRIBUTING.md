# Contributing to Witnext

Witnext is a web-first ERP (Vite + React + TypeScript + Supabase). This document defines how we structure code and ship changes safely.

## Prerequisites

```sh
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## Before opening a PR

```sh
npm run lint
npm test
npm run build:web
```

Optional locally:

```sh
npm run test:e2e:install   # first time only — downloads Chromium
npm run test:e2e           # requires dev server + optional E2E credentials
```

## Module structure

New domain code should follow the pattern used in `src/modules/finance/` and `src/modules/flux/`:

```text
src/modules/{domain}/
  types/           # Domain types
  lib/             # Pure functions (unit-tested, no React/Supabase)
  services/        # Supabase / API access
  hooks/           # React hooks (data loading, mutations)
  components/      # UI only
```

Reference modules:

- `src/modules/finance/` — multi-company finance, treasury, VAT
- `src/modules/flux/` — commercial dossier tracking

## Rules

1. **File size** — Target ≤ 500 lines per file. Split before growing past that.
2. **No Supabase in components** — Use `services/` or `hooks/`; components render UI.
3. **Security** — RLS enforces permissions. `isAdmin` / `isModerator` in the client are UI-only.
4. **Multi-company** — Every new table needs `company_id` and RLS policies scoped by company.
5. **Migrations** — Add SQL in `supabase/migrations/`. Never edit old migrations. Regenerate types after schema changes:

   ```sh
   npm run types:supabase
   ```

6. **Validation** — Validate write payloads with Zod in services before Supabase calls.
7. **Tests** — Pure logic in `lib/` must have Vitest tests. No behavior change without tests for extracted logic.

## Legacy code

These files are being split (do not add features to them; extract instead):

- `src/services/dbService.ts`
- `src/services/documentService.ts`
- `src/components/devis/DevisForm.tsx`
- `src/components/GestionDevis.tsx`

## Database migrations checklist

- [ ] `company_id` column where applicable
- [ ] RLS enabled on new tables
- [ ] Policies for SELECT / INSERT / UPDATE / DELETE
- [ ] RPC functions use `SECURITY DEFINER` only when justified
- [ ] Run `npm run types:supabase` and commit updated types if needed

## Deployment

- **Web (primary):** Vercel — `npm run build:web`
- Electron scripts remain in the repo but are not actively maintained.
