
-- Allow all authenticated users to read profiles (for displaying creator names)
CREATE POLICY "All authenticated users can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
