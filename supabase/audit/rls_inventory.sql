-- =============================================================================
-- READ-ONLY RLS / security introspection (audit support).
-- Run this in the Supabase SQL editor and share the output. It changes nothing.
-- It exists so RLS remediation can be authored against the ACTUAL live policy
-- state instead of guessing (which risks data exposure or locking out staff).
-- =============================================================================

-- 1. Tables in `public` and whether RLS is enabled / forced.
SELECT
  c.relname            AS table_name,
  c.relrowsecurity     AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;

-- 2. Every policy on public tables: which roles, which command, and the
--    USING / WITH CHECK expressions. Look for `true` quals and `{public}` roles
--    (those allow anon / unauthenticated access).
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual          AS using_expr,
  with_check    AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 3. Storage bucket policies (same lens for object access).
SELECT
  policyname,
  roles,
  cmd,
  qual       AS using_expr,
  with_check AS check_expr
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 4. Tables that have RLS ENABLED but NO policies at all (these deny everything
--    to non-owners — often a silent breakage) vs ones with permissive `true`.
SELECT
  c.relname AS table_name,
  count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
GROUP BY c.relname
ORDER BY policy_count ASC, c.relname;

-- 5. Confirm the security-helper functions referenced by policies exist.
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('has_role', 'user_has_app_section', 'is_inventory_admin')
ORDER BY proname;
