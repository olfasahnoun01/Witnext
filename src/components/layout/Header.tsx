import { LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OnlineUsersIndicator } from '@/components/OnlineUsersIndicator';
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const [userName, setUserName] = useState<string | null>(null);
  const { user, signOut, isAdmin, isModerator } = useAuth();
  const { onlineUsers } = usePresence();

  // Fetch user's full name from profiles
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      
      if (data?.full_name) {
        setUserName(data.full_name);
      }
    };
    
    fetchUserName();
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('fr-TN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Online Users (Admin and Moderator) */}
          {(isAdmin || isModerator) && (
            <OnlineUsersIndicator 
              onlineUsers={onlineUsers} 
              currentUserId={user?.id}
            />
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User info & Sign out */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden md:block">
                {userName || user.email?.split('@')[0]}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Déconnexion</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
