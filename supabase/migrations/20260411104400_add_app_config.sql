
-- 1. Create the app_config table
CREATE TABLE IF NOT EXISTS public.app_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Everyone can read config
CREATE POLICY "Public read access for app_config" ON public.app_config
FOR SELECT TO authenticated USING (true);

-- Only admins can update config
CREATE POLICY "Admin update access for app_config" ON public.app_config
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Initial seed
INSERT INTO public.app_config (key, value)
VALUES ('update_alert_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;
