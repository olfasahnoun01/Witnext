-- Drop existing public policies for update and delete on transactions
DROP POLICY IF EXISTS "Allow public update on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public delete on transactions" ON public.transactions;

-- Create admin-only policies for update and delete
CREATE POLICY "Admins can update transactions"
ON public.transactions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete transactions"
ON public.transactions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));