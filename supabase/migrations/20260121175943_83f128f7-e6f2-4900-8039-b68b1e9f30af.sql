-- Update team_chat_messages policies to allow all authenticated users

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Team members can view messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS "Team members can send messages" ON public.team_chat_messages;

-- Create new policies for all authenticated users
CREATE POLICY "Authenticated users can view messages"
ON public.team_chat_messages FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send messages"
ON public.team_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);