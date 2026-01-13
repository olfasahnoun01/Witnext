-- Create team chat messages table
CREATE TABLE public.team_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and moderators can view all messages
CREATE POLICY "Team members can view messages"
ON public.team_chat_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'moderator')
);

-- Policy: Admins and moderators can send messages
CREATE POLICY "Team members can send messages"
ON public.team_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.team_chat_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;

-- Create index for faster queries
CREATE INDEX idx_team_chat_created_at ON public.team_chat_messages(created_at DESC);