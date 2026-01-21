-- Fix PUBLIC_DATA_EXPOSURE on orders table
-- Restrict access to admin and moderator roles for security

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated read on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated delete on orders" ON public.orders;

-- Create secure policies restricted to admin and moderator roles
CREATE POLICY "Admins and moderators can read orders"
ON public.orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can insert orders"
ON public.orders FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins and moderators can update orders"
ON public.orders FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));