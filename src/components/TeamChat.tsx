import { createContext, useContext, type ReactNode } from 'react';
import { AlertCircle, Loader2, MessageCircle, RefreshCw, Send, Trash2, Users } from 'lucide-react';
import { useTeamChat } from '@/hooks/useTeamChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

type TeamChatContextValue = ReturnType<typeof useTeamChat>;

const TeamChatContext = createContext<TeamChatContextValue | null>(null);

function useTeamChatContext() {
  const ctx = useContext(TeamChatContext);
  if (!ctx) {
    throw new Error('TeamChat components must be used within TeamChatProvider');
  }
  return ctx;
}

export function TeamChatProvider({
  children,
  isPageOpen,
}: {
  children: ReactNode;
  isPageOpen: boolean;
}) {
  const chat = useTeamChat(isPageOpen);
  return <TeamChatContext.Provider value={chat}>{children}</TeamChatContext.Provider>;
}

function formatTime(dateStr: string) {
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
}

interface TeamChatTriggerProps {
  onOpen: () => void;
  isActive?: boolean;
}

export function TeamChatTrigger({ onOpen, isActive }: TeamChatTriggerProps) {
  const { canAccess, unreadCount } = useTeamChatContext();

  if (!canAccess) return null;

  return (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      size="icon"
      className="relative shrink-0"
      aria-label="Chat équipe"
      title="Chat équipe"
      onClick={onOpen}
    >
      <MessageCircle className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
      {unreadCount > 0 && !isActive && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}

function MessageList() {
  const { user, messages, messagesEndRef, handleDeleteMessage } = useTeamChatContext();

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <MessageCircle className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Aucun message. Commencez la conversation !</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1">
      {messages.map((msg) => {
        const isOwn = msg.user_id === user?.id;
        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={cn(
                'max-w-[min(75%,42rem)] rounded-2xl px-4 py-2.5 shadow-sm',
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              )}
            >
              {!isOwn && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="max-w-48 truncate text-xs font-semibold">
                    {msg.user_email.split('@')[0]}
                  </span>
                  <Badge className={`${roleColors[msg.user_role]} h-4 px-1 py-0 text-[10px]`}>
                    {roleLabels[msg.user_role]}
                  </Badge>
                </div>
              )}
              <p className={cn('whitespace-pre-wrap break-words text-sm', !isOwn && 'text-foreground')}>
                {msg.content}
              </p>
              <div
                className={cn(
                  'mt-1.5 flex items-center justify-between gap-2',
                  isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}
              >
                <span className="text-[11px]">{formatTime(msg.created_at)}</span>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-50 transition-opacity hover:opacity-100"
                    aria-label="Supprimer le message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
}

export function TeamChatPage() {
  const {
    canAccess,
    messages,
    newMessage,
    setNewMessage,
    isLoading,
    isFetching,
    fetchError,
    retryFetch,
    messagesViewportRef,
    handleSendMessage,
  } = useTeamChatContext();

  if (!canAccess) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">Chat Équipe</h2>
              <p className="text-xs text-muted-foreground">
                Messagerie interne · {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            En direct
          </Badge>
        </div>

        <div
          ref={messagesViewportRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {isFetching && messages.length === 0 && !fetchError ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mb-3 h-8 w-8 animate-spin" />
              <p className="text-sm">Chargement des messages…</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="max-w-sm text-sm text-muted-foreground">{fetchError}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void retryFetch()}>
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          ) : (
            <MessageList />
          )}
        </div>

        <form
          onSubmit={handleSendMessage}
          className="shrink-0 border-t border-border bg-background/80 p-4 backdrop-blur-sm sm:px-6"
        >
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrire un message à l'équipe..."
              className="h-11 flex-1 text-base"
              disabled={isLoading || Boolean(fetchError)}
              maxLength={500}
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              className="h-11 px-5"
              disabled={!newMessage.trim() || isLoading || Boolean(fetchError)}
            >
              <Send className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Envoyer</span>
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {newMessage.length}/500 caractères
          </p>
        </form>
      </div>
    </div>
  );
}
