-- Enable Realtime for fuel vouchers (mobile driver app listens via postgres changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'fuel_vouchers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_vouchers;
  END IF;
END $$;
