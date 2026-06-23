import { useEffect, useState } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { userDisplayName, userInitials } from '@/lib/userDisplay';
import { MyProfileDialog } from '@/components/layout/MyProfileDialog';

interface UserAccountMenuProps {
  onNavigateTab?: (tabId: string) => void;
}

export const UserAccountMenu = ({ onNavigateTab }: UserAccountMenuProps) => {
  const { user, signOut, isAdmin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const email = user?.email ?? '';
  const position =
    typeof user?.user_metadata?.position === 'string' ? user.user_metadata.position : undefined;

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setFullName((data?.full_name ?? '').trim());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) return null;

  const displayName = userDisplayName(fullName, email);
  const initials = userInitials(fullName, email);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu compte utilisateur"
          >
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground hidden lg:block max-w-[140px] truncate">
              {displayName}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">{email}</span>
              {position ? (
                <span className="text-xs text-muted-foreground truncate">{position}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <User className="w-4 h-4 mr-2" />
            Mon profil
          </DropdownMenuItem>
          {isAdmin && onNavigateTab ? (
            <DropdownMenuItem onClick={() => onNavigateTab('settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Paramètres système
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void signOut()}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        userId={user.id}
        email={email}
        initialFullName={fullName}
        position={position}
        onProfileSaved={setFullName}
      />
    </>
  );
};
