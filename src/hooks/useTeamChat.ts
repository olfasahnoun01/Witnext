import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  content: string;
  created_at: string;
}

export function useTeamChat(isPageOpen: boolean) {
  const { user, isAdmin, isModerator } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const lastReadRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPageOpenRef = useRef(isPageOpen);

  useEffect(() => {
    isPageOpenRef.current = isPageOpen;
  }, [isPageOpen]);

  const canAccess = !!user;
  const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : 'user';

  useEffect(() => {
    const stored = localStorage.getItem('team_chat_last_read');
    if (stored) {
      lastReadRef.current = stored;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!canAccess) return;

    setIsFetching(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase
        .from('team_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);

      if (!isPageOpenRef.current && data && data.length > 0) {
        if (lastReadRef.current) {
          const unread = data.filter((m) => m.created_at > lastReadRef.current!).length;
          setUnreadCount(unread);
        } else {
          setUnreadCount(data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setFetchError('Impossible de charger les messages. Vérifiez votre connexion.');
    } finally {
      setIsFetching(false);
    }
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;

    void fetchMessages();

    const channel = supabase
      .channel('team-chat')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_chat_messages',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              if (!isPageOpenRef.current && newMsg.user_id !== user?.id) {
                setUnreadCount((count) => count + 1);
                playNotificationSound();
                const preview =
                  newMsg.content.length > 50 ? `${newMsg.content.slice(0, 50)}…` : newMsg.content;
                toast.info(`${newMsg.user_email}: ${preview}`, {
                  duration: 3000,
                });
              }

              return [...prev, newMsg];
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, fetchMessages, user?.id, playNotificationSound]);

  useEffect(() => {
    if (isPageOpen && canAccess) {
      void fetchMessages();
    }
  }, [isPageOpen, canAccess, fetchMessages]);

  const scrollToLatest = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (!isPageOpen) return;
    scrollToLatest();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToLatest);
    });
    return () => cancelAnimationFrame(id);
  }, [isPageOpen, messages, scrollToLatest]);

  useEffect(() => {
    if (isPageOpen && messages.length > 0) {
      const lastMsgTime = messages[messages.length - 1].created_at;
      lastReadRef.current = lastMsgTime;
      localStorage.setItem('team_chat_last_read', lastMsgTime);
      setUnreadCount(0);
    }
  }, [isPageOpen, messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('team_chat_messages').insert({
        user_id: user.id,
        user_email: user.email || 'Utilisateur',
        user_role: userRole,
        content: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from('team_chat_messages').delete().eq('id', messageId);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    user,
    canAccess,
    messages,
    newMessage,
    setNewMessage,
    isLoading,
    isFetching,
    fetchError,
    retryFetch: fetchMessages,
    unreadCount,
    messagesEndRef,
    messagesViewportRef,
    handleSendMessage,
    handleDeleteMessage,
  };
}
