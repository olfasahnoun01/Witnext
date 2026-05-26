-- Improve Realtime payloads for fuel_vouchers (insert/update/delete)
ALTER TABLE public.fuel_vouchers REPLICA IDENTITY FULL;
