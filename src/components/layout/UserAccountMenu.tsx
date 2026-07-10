import { useEffect, useState } from 'react';
import { LogOut, Settings, Shield, User, Users } from 'lucide-react';
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
import { getPathForSubsection } from '@/config/routes';
import { SUBSECTION_LABELS } from '@/config/navigation';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

export const UserAccountMenu = () => {
  const { user, signOut, isAdmin, isPlatformAdmin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const accountsPath = getPathForSubsection('accounts');
  const settingsPath = getPathForSubsection('settings');
  const platformPath = getPathForSubsection('platform-console');

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

        <DropdownMenuContent align="end" className="w-64">
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
          {isPlatformAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Plateforme
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <NavLink
                  to={platformPath}
                  className={({ isActive }) =>
                    cn('flex items-center', isActive && 'bg-accent')
                  }
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Console plateforme
                </NavLink>
              </DropdownMenuItem>
            </>
          ) : null}
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Administration
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <NavLink
                  to={accountsPath}
                  className={({ isActive }) =>
                    cn('flex items-center', isActive && 'bg-accent')
                  }
                >
                  <Users className="w-4 h-4 mr-2" />
                  {SUBSECTION_LABELS.accounts}
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink
                  to={settingsPath}
                  className={({ isActive }) =>
                    cn('flex items-center', isActive && 'bg-accent')
                  }
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {SUBSECTION_LABELS.settings}
                </NavLink>
              </DropdownMenuItem>
            </>
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
