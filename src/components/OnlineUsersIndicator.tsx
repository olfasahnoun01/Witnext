import { memo } from 'react';
import { Users, Circle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface OnlineUser {
  user_id: string;
  email: string | null;
  role: string | null;
  last_seen: string;
  is_online: boolean;
}

interface OnlineUsersIndicatorProps {
  onlineUsers: OnlineUser[];
  currentUserId?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Modérateur',
  user: 'Utilisateur'
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  user: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
};

export const OnlineUsersIndicator = memo(({ onlineUsers, currentUserId }: OnlineUsersIndicatorProps) => {
  if (onlineUsers.length === 0) return null;

  const otherUsers = onlineUsers.filter(u => u.user_id !== currentUserId);
  const moderatorsOnline = otherUsers.filter(u => u.role === 'moderator' || u.role === 'admin');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {onlineUsers.length}
          </span>
          <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Utilisateurs en ligne</h4>
            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
              {onlineUsers.length} en ligne
            </Badge>
          </div>
          
          {moderatorsOnline.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {moderatorsOnline.length} modérateur{moderatorsOnline.length > 1 ? 's' : ''} actif{moderatorsOnline.length > 1 ? 's' : ''}
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {onlineUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">
                    {user.email || 'Utilisateur'}
                    {user.user_id === currentUserId && (
                      <span className="text-muted-foreground ml-1">(vous)</span>
                    )}
                  </span>
                </div>
                <Badge 
                  className={`${roleColors[user.role || 'user']} border-0 text-xs flex-shrink-0`}
                >
                  {roleLabels[user.role || 'user']}
                </Badge>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

OnlineUsersIndicator.displayName = 'OnlineUsersIndicator';
