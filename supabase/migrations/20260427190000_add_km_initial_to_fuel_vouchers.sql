-- Migration to add km_initial to fuel_vouchers
ALTER TABLE public.fuel_vouchers ADD COLUMN IF NOT EXISTS km_initial NUMERIC;
