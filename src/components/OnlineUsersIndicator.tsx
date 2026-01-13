import { memo, useState, useEffect } from 'react';
import { Users, Circle, Wifi } from 'lucide-react';
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
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Update timestamp when onlineUsers changes
  useEffect(() => {
    setIsUpdating(true);
    setLastUpdate(new Date());
    const timer = setTimeout(() => setIsUpdating(false), 500);
    return () => clearTimeout(timer);
  }, [onlineUsers]);

  const otherUsers = onlineUsers.filter(u => u.user_id !== currentUserId);
  const moderatorsOnline = otherUsers.filter(u => u.role === 'moderator');
  const adminsOnline = otherUsers.filter(u => u.role === 'admin');
  const usersOnline = otherUsers.filter(u => u.role === 'user');

  // Calculate time since last seen for each user
  const getTimeSince = (lastSeen: string) => {
    const seconds = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
    if (seconds < 60) return 'À l\'instant';
    if (seconds < 120) return 'Il y a 1 min';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    return 'Inactif';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={`relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-all ${
            isUpdating ? 'bg-primary/10' : ''
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
              otherUsers.length > 0 ? 'bg-green-500' : 'bg-muted-foreground'
            }`} />
          </div>
          <span className="text-sm font-medium text-foreground">
            {otherUsers.length}
          </span>
          {otherUsers.length > 0 && (
            <Wifi className={`w-3 h-3 text-green-500 ${isUpdating ? 'animate-pulse' : ''}`} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
              Utilisateurs connectés
            </h4>
            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
              {onlineUsers.length} en ligne
            </Badge>
          </div>
          
          {/* Summary stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {adminsOnline.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {adminsOnline.length} admin{adminsOnline.length > 1 ? 's' : ''}
              </span>
            )}
            {moderatorsOnline.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {moderatorsOnline.length} modérateur{moderatorsOnline.length > 1 ? 's' : ''}
              </span>
            )}
            {usersOnline.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                {usersOnline.length} utilisateur{usersOnline.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun utilisateur connecté
              </p>
            ) : (
              onlineUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    user.user_id === currentUserId 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {(user.email || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <Circle className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 fill-green-500 text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-foreground truncate block">
                        {user.email || 'Utilisateur'}
                        {user.user_id === currentUserId && (
                          <span className="text-muted-foreground ml-1">(vous)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {getTimeSince(user.last_seen)}
                      </span>
                    </div>
                  </div>
                  <Badge 
                    className={`${roleColors[user.role || 'user']} border-0 text-xs flex-shrink-0`}
                  >
                    {roleLabels[user.role || 'user']}
                  </Badge>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Synchronisation temps réel
            </span>
            <span>
              {lastUpdate.toLocaleTimeString('fr-FR')}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

OnlineUsersIndicator.displayName = 'OnlineUsersIndicator';
