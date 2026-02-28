
CREATE TABLE public.category_settings (
  id SERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  color TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read category settings"
  ON public.category_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only moderators/admins can insert/update/delete
CREATE POLICY "Moderators can manage category settings"
  ON public.category_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_settings;
