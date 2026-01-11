-- Fix transactions table: Restrict read access to admin and moderator roles only
-- This prevents regular employees from seeing all business transaction history

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read transactions" ON public.transactions;

-- Create role-based read policy (admins and moderators only)
CREATE POLICY "Admins and moderators can read transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'moderator')
);

-- Also restrict INSERT to admin/moderator to maintain data integrity
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;

CREATE POLICY "Admins and moderators can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'moderator')
);