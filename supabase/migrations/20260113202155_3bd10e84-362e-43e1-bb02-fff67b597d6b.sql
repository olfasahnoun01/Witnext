-- Create orders table for mobile app
CREATE TABLE IF NOT EXISTS public.orders (
  id SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  items JSONB NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'En attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admin/moderator)
CREATE POLICY "Allow authenticated insert on orders" 
ON public.orders FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated read on orders" 
ON public.orders FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated update on orders" 
ON public.orders FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete on orders" 
ON public.orders FOR DELETE 
TO authenticated
USING (true);

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;