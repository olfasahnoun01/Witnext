-- Fix profiles table: users can only view their own profile, admins can view all
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (separate policy for admin functions)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix fournisseurs table: restrict to admins and moderators only
DROP POLICY IF EXISTS "Authenticated users can read fournisseurs" ON public.fournisseurs;

-- Only admins and moderators can read fournisseurs
CREATE POLICY "Admins and moderators can read fournisseurs" 
ON public.fournisseurs 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role)
);