-- Fix security: Ensure unauthenticated users cannot access any tables
-- The issue is that current policies don't explicitly block anonymous access
-- Solution: Recreate SELECT policies with explicit 'TO authenticated' clause

-- ============================================
-- FIX PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create new policies with explicit authentication requirement
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- FIX FOURNISSEURS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins and moderators can read fournisseurs" ON public.fournisseurs;

CREATE POLICY "Admins and moderators can read fournisseurs"
ON public.fournisseurs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- ============================================
-- FIX PRODUCTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins and moderators can read products" ON public.products;

CREATE POLICY "Admins and moderators can read products"
ON public.products
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));