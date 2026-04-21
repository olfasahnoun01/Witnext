
## Goal
Fix the "Could not find the table public.user_section_permissions in the schema cache" error by realigning this remixed project with its own backend (`zfnhihbttwmrldcbaige`) instead of the inherited old one (`rnujsdxbkndvppjqjkdu`).

## Root cause
This project is a remix. The remix carried over hardcoded references to the **previous** project's backend, while the new Lovable Cloud backend attached to this remix is `zfnhihbttwmrldcbaige` (where `user_section_permissions` actually exists with proper RLS). Result:
- `src/integrations/supabase/client.ts` points to `https://rnujsdxbkndvppjqjkdu.supabase.co` (old).
- `.env` correctly points to `zfnhihbttwmrldcbaige` (new).
- `supabase/.temp/linked-project.json` still says `ref: rnujsdxbkndvppjqjkdu` (old).
- `mem://architecture/mobile-connection-config-fr` references yet another old URL (`lptoakdzyu...`).

The frontend uses `client.ts`, so every query hits the old project — which has no `user_section_permissions` table → 404 / schema cache error, and the Permissions panel stays empty.

## Plan

### 1. Realign the Supabase client to the correct backend
Force-regenerate `src/integrations/supabase/client.ts` so it consumes the values already present in `.env`:
- URL: `https://zfnhihbttwmrldcbaige.supabase.co`
- Anon key: the `VITE_SUPABASE_PUBLISHABLE_KEY` already in `.env`
- Project ID: `zfnhihbttwmrldcbaige`

This is the single change that resolves the schema-cache error for `user_section_permissions` and unblocks the Permissions Manager UI.

### 2. Refresh local Supabase link metadata
Update `supabase/.temp/linked-project.json` to reference `zfnhihbttwmrldcbaige` so future migrations and CLI operations target the right project.

### 3. Verify the permissions table is healthy on the correct backend
Run a SQL check (via `supabase--read_query`) on `zfnhihbttwmrldcbaige` to confirm:
- `public.user_section_permissions` exists with the expected columns (`user_id`, `section_key`, `subsection_key`).
- RLS policies for admin CRUD + user self-read are in place (already shown in schema dump — just confirming live).
- If anything is missing, emit a corrective migration.

### 4. Update memory to reflect the active backend
Replace `mem://architecture/mobile-connection-config-fr` content so the documented Supabase URL matches `zfnhihbttwmrldcbaige.supabase.co` (and add the publishable key from `.env`). Prevents future confusion / wrong-project regressions.

### 5. Smoke test in preview
After client regeneration:
- Reload the app, open **Paramètres → Gestion des Permissions & Utilisateurs**.
- Confirm the user list loads (non-admin profiles), checkboxes render per `BIG_SECTIONS`, and Save persists rows into `user_section_permissions` without the schema-cache error.
- Confirm existing data (devis, products, clients, gallery, etc.) still loads — since `.env` already pointed to the new project, the user's day-to-day data should already be on `zfnhihbttwmrldcbaige`. If the user reports missing historical data after the switch, that data lives on the old project and we'll plan a one-shot data migration as a separate step.

## Out of scope (will only do if you ask)
- Migrating historical rows from the old project (`rnujsdx...`) into the new one.
- Storage bucket file copy between the two projects.
- Re-running the security scan (already addressed previously).

## Files touched
- `src/integrations/supabase/client.ts` — regenerated to point to `zfnhihbttwmrldcbaige`.
- `supabase/.temp/linked-project.json` — updated `ref`.
- `mem://architecture/mobile-connection-config-fr` — corrected URL/key.
- (Conditional) one new migration under `supabase/migrations/` if the live schema check reveals drift.
