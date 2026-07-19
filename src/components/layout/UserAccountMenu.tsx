import { useCallback, useEffect, useState } from 'react';
import { LogOut, Settings, Shield, User, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { getPathForSubsection } from '@/config/routes';
import { SUBSECTION_LABELS } from '@/config/navigation';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';

export const UserAccountMenu = () => {
  const { user, signOut, isAdmin, isPlatformAdmin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const profilePath = getPathForSubsection('profile');
  const accountsPath = getPathForSubsection('accounts');
  const settingsPath = getPathForSubsection('settings');
  const platformPath = getPathForSubsection('platform-console');

  const email = user?.email ?? '';
  const position =
    typeof user?.user_metadata?.position === 'string' ? user.user_metadata.position : undefined;

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    const row = data as { full_name?: string | null; avatar_url?: string | null } | null;
    setFullName((row?.full_name ?? '').trim());
    setAvatarUrl(row?.avatar_url ?? null);
  }, [user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const onUpdated = () => {
      void loadProfile();
    };
    window.addEventListener('erp:profile-updated', onUpdated);
    return () => window.removeEventListener('erp:profile-updated', onUpdated);
  }, [loadProfile]);

  if (!user) return null;

  const displayName = userDisplayName(fullName, email);
  const initials = userInitials(fullName, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menu compte utilisateur"
        >
          <Avatar className="h-9 w-9 border border-border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
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
        <DropdownMenuItem asChild>
          <NavLink
            to={profilePath}
            className={({ isActive }) => cn('flex items-center', isActive && 'bg-accent')}
          >
            <User className="w-4 h-4 mr-2" />
            Mon profil
          </NavLink>
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
                className={({ isActive }) => cn('flex items-center', isActive && 'bg-accent')}
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
                className={({ isActive }) => cn('flex items-center', isActive && 'bg-accent')}
              >
                <Users className="w-4 h-4 mr-2" />
                {SUBSECTION_LABELS.accounts}
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink
                to={settingsPath}
                className={({ isActive }) => cn('flex items-center', isActive && 'bg-accent')}
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
  );
};
