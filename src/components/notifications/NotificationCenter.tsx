import { Bell, CheckCheck, FileSignature, Loader2, Truck, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSubsectionNavigate } from '@/hooks/useSubsectionNavigate';

function iconForType(type: string): LucideIcon {
  if (type.startsWith('demande_achat')) return FileSignature;
  if (type === 'vehicle_reminder') return Truck;
  return Bell;
}

export function NotificationCenter() {
  const { items, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const { navigateToSubsection } = useSubsectionNavigate();

  const handleOpenItem = async (n: AppNotification) => {
    if (!n.read_at) await markRead(n.id);
    if (n.link_tab) navigateToSubsection(n.link_tab);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold text-sm">Notifications</p>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => markAllRead()}>
              <CheckCheck className="w-3.5 h-3.5" />
              Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[min(420px,70vh)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Aucune notification.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = iconForType(n.type);
                const unread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenItem(n)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                        unread && 'bg-primary/5'
                      )}
                    >
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            'mt-0.5 p-1.5 rounded-lg shrink-0',
                            unread ? 'bg-primary/15' : 'bg-muted'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4',
                              unread ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
