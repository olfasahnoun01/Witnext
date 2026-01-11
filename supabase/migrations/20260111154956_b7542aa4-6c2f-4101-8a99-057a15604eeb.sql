-- Drop the incorrect policy that uses 'id' instead of 'user_id'
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- The correct policy "Users can view their own profile" with (auth.uid() = user_id) already exists