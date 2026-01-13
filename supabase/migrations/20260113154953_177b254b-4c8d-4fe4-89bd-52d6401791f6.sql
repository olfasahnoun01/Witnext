-- Drop existing restrictive policies on user_presence
DROP POLICY IF EXISTS "Admins can read all presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can delete their own presence" ON public.user_presence;

-- Recreate policies as PERMISSIVE (default)
-- Admins and moderators can read all presence
CREATE POLICY "Admins and moderators can read all presence" 
ON public.user_presence 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Users can insert their own presence
CREATE POLICY "Users can insert their own presence" 
ON public.user_presence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own presence
CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own presence
CREATE POLICY "Users can delete their own presence" 
ON public.user_presence 
FOR DELETE 
USING (auth.uid() = user_id);