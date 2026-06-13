import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  content: string;
  created_at: string;
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Mod',
  user: 'User',
};

export const TeamChat = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastReadRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

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

  useEffect(() => {
    const stored = localStorage.getItem('team_chat_last_read');
    if (stored) {
      lastReadRef.current = stored;
    }
  }, []);

  const canAccess = !!user;
  const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : 'user';

  const fetchMessages = useCallback(async () => {
    if (!canAccess) return;

    try {
      const { data, error } = await supabase
        .from('team_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);

      if (!isOpenRef.current && data && data.length > 0) {
        if (lastReadRef.current) {
          const unread = data.filter((m) => m.created_at > lastReadRef.current!).length;
          setUnreadCount(unread);
        } else {
          setUnreadCount(data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;

    fetchMessages();

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
            setMessages((prev) => [...prev, newMsg]);

            if (!isOpenRef.current && newMsg.user_id !== user?.id) {
              setUnreadCount((prev) => prev + 1);
              playNotificationSound();
              const preview = newMsg.content.length > 50 ? `${newMsg.content.slice(0, 50)}…` : newMsg.content;
              toast.info(`${newMsg.user_email}: ${preview}`, {
                duration: 3000,
              });
            }
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
    if (isOpen && canAccess) {
      void fetchMessages();
    }
  }, [isOpen, canAccess, fetchMessages]);

  const scrollToLatest = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || isMinimized) return;
    scrollToLatest();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToLatest);
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, isMinimized, messages, scrollToLatest]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const lastMsgTime = messages[messages.length - 1].created_at;
      lastReadRef.current = lastMsgTime;
      localStorage.setItem('team_chat_last_read', lastMsgTime);
      setUnreadCount(0);
    }
  }, [isOpen, messages]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setIsMinimized(false);
    }
  };

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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!canAccess) return null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Chat équipe"
          title="Chat équipe"
        >
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-96 p-0', isMinimized ? 'h-auto' : 'h-[min(500px,70vh)] flex flex-col')}
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3 rounded-t-md">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-5 h-5 shrink-0 text-primary" />
            <span className="font-semibold text-sm text-foreground truncate">Chat Équipe</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {messages.length} msg
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
            aria-label={isMinimized ? 'Agrandir le chat' : 'Réduire le chat'}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Minimize2 className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {!isMinimized && (
          <>
            <ScrollArea className="flex-1 min-h-0 p-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-12">
                  Aucun message. Commencez la conversation !
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isOwn = msg.user_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          {!isOwn && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium truncate max-w-32">
                                {msg.user_email.split('@')[0]}
                              </span>
                              <Badge className={`${roleColors[msg.user_role]} text-[10px] px-1 py-0 h-4`}>
                                {roleLabels[msg.user_role]}
                              </Badge>
                            </div>
                          )}
                          <p className={`text-sm break-words ${isOwn ? '' : 'text-foreground'}`}>
                            {msg.content}
                          </p>
                          <div
                            className={`flex items-center justify-between gap-2 mt-1 ${
                              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}
                          >
                            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="opacity-50 hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
                </div>
              )}
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrire un message..."
                  className="flex-1"
                  disabled={isLoading}
                  maxLength={500}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || isLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
