-- Allow all authenticated users to insert transactions (needed for variant creation from devis)
CREATE POLICY "All users can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (true);
