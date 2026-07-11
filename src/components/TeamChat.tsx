import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useTeamChat } from '@/hooks/useTeamChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatAppDateTime } from '@/lib/formatAppDate';

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

type TeamChatContextValue = ReturnType<typeof useTeamChat> & {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const TeamChatContext = createContext<TeamChatContextValue | null>(null);

function useTeamChatContext() {
  const ctx = useContext(TeamChatContext);
  if (!ctx) {
    throw new Error('TeamChat components must be used within TeamChatProvider');
  }
  return ctx;
}

export function TeamChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const chat = useTeamChat(isOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <TeamChatContext.Provider value={{ ...chat, isOpen, open, close, toggle }}>
      {children}
      <TeamChatFloatingWidget />
    </TeamChatContext.Provider>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return formatAppDateTime(dateStr);
}

interface TeamChatTriggerProps {
  onOpen?: () => void;
  isActive?: boolean;
}

/** Header / toolbar control — opens the floating chat. */
export function TeamChatTrigger({ onOpen, isActive }: TeamChatTriggerProps) {
  const { canAccess, unreadCount, isOpen, toggle } = useTeamChatContext();

  if (!canAccess) return null;

  const handleClick = () => {
    if (onOpen) onOpen();
    else toggle();
  };

  const active = isActive ?? isOpen;

  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="relative shrink-0"
      aria-label={isOpen ? 'Fermer le chat équipe' : 'Ouvrir le chat équipe'}
      title="Chat équipe"
      aria-expanded={isOpen}
      onClick={handleClick}
    >
      <MessageCircle className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
      {unreadCount > 0 && !isOpen && (
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
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted-foreground">
        <MessageCircle className="mb-3 h-9 w-9 opacity-40" />
        <p className="text-sm">Aucun message. Commencez la conversation !</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-1">
      {messages.map((msg) => {
        const isOwn = msg.user_id === user?.id;
        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm',
                isOwn
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-muted'
              )}
            >
              {!isOwn && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="max-w-36 truncate text-xs font-semibold">
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
                  'mt-1 flex items-center justify-between gap-2',
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

function TeamChatFloatingWidget() {
  const {
    canAccess,
    isOpen,
    close,
    toggle,
    unreadCount,
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

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!canAccess) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* Panel */}
      <div
        id="team-chat-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Chat équipe"
        aria-hidden={!isOpen}
        className={cn(
          'pointer-events-auto flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/10',
          'origin-bottom-right transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          'h-[min(70vh,32rem)]',
          isOpen
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none invisible translate-y-3 scale-95 opacity-0'
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">Chat Équipe</h2>
              <p className="text-[11px] text-muted-foreground">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              En direct
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={close}
              aria-label="Fermer le chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isFetching && messages.length === 0 && !fetchError ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mb-3 h-7 w-7 animate-spin" />
              <p className="text-sm">Chargement…</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-2 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="max-w-xs text-sm text-muted-foreground">{fetchError}</p>
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
          className="shrink-0 border-t border-border bg-background/90 p-3 backdrop-blur-sm"
        >
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrire un message…"
              className="h-10 flex-1"
              disabled={isLoading || Boolean(fetchError)}
              maxLength={500}
              autoFocus={isOpen}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={!newMessage.trim() || isLoading || Boolean(fetchError)}
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* FAB */}
      <Button
        type="button"
        size="icon"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls="team-chat-panel"
        aria-label={isOpen ? 'Fermer le chat équipe' : 'Ouvrir le chat équipe'}
        className={cn(
          'pointer-events-auto relative h-14 w-14 rounded-full shadow-lg transition-all duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          'hover:scale-105 active:scale-95',
          isOpen
            ? 'bg-muted text-foreground hover:bg-muted/80'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300',
            isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </span>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-300',
            isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          )}
        >
          <X className="h-6 w-6" />
        </span>
        {!isOpen && unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>
    </div>
  );
}

/** Legacy /messages route — opens the floating widget and returns to the ERP. */
export function TeamChatPage() {
  const { open, canAccess } = useTeamChatContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!canAccess) {
      navigate('/dashboard', { replace: true });
      return;
    }
    open();
    navigate('/dashboard', { replace: true });
  }, [canAccess, open, navigate]);

  return (
    <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
