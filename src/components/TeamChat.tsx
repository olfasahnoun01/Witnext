import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, X, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

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
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Mod',
};

export const TeamChat = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastReadRef = useRef<string | null>(null);

  // Initialize lastReadRef from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('team_chat_last_read');
    if (stored) {
      lastReadRef.current = stored;
    }
  }, []);

  const canAccess = isAdmin || isModerator;
  const userRole = isAdmin ? 'admin' : 'moderator';

  // Fetch messages
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

      // Update unread count if chat is closed
      if (!isOpen && data && data.length > 0) {
        if (lastReadRef.current) {
          const unread = data.filter(m => m.created_at > lastReadRef.current!).length;
          setUnreadCount(unread);
        } else {
          // First time: mark all as unread
          setUnreadCount(data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [canAccess, isOpen]);

  // Subscribe to realtime updates
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
          table: 'team_chat_messages'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setMessages(prev => [...prev, newMsg]);
            
            // Show notification if chat is closed and message is from someone else
            if (!isOpen && newMsg.user_id !== user?.id) {
              setUnreadCount(prev => prev + 1);
              toast.info(`${newMsg.user_email}: ${newMsg.content.substring(0, 50)}...`, {
                duration: 3000,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, fetchMessages, isOpen, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Mark as read when opening chat
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const lastMsgTime = messages[messages.length - 1].created_at;
      lastReadRef.current = lastMsgTime;
      localStorage.setItem('team_chat_last_read', lastMsgTime);
      setUnreadCount(0);
    }
  }, [isOpen, messages]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('team_chat_messages')
        .insert({
          user_id: user.id,
          user_email: user.email || 'Utilisateur',
          user_role: userRole,
          content: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('team_chat_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Format time
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
      minute: '2-digit' 
    });
  };

  if (!canAccess) return null;

  return (
    <>
      {/* Chat Toggle Button - only show when chat is closed */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg bg-primary text-primary-foreground animate-scale-in hover:scale-110 transition-transform duration-200"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-24 right-6 z-50 bg-card border border-border rounded-xl shadow-2xl animate-scale-in origin-bottom-right transition-all duration-300 ease-out ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[500px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Chat Équipe</span>
              <Badge variant="outline" className="text-xs">
                {messages.length} msg
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="h-[380px] p-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-12">
                    Aucun message. Commencez la conversation !
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOwn = msg.user_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
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
                            <div className={`flex items-center justify-between gap-2 mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <span className="text-[10px]">
                                {formatTime(msg.created_at)}
                              </span>
                              {isOwn && (
                                <button
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
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
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
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!newMessage.trim() || isLoading}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
