import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OnlineUsersIndicator } from '@/components/OnlineUsersIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu';
import { TeamChatTrigger } from '@/components/TeamChat';

interface HeaderProps {
  title: string;
  onToggle?: () => void;
  sidebarOpen?: boolean;
  onNavigateTab?: (tabId: string) => void;
  activeTab?: string;
}

export const Header = ({ title, onToggle, sidebarOpen, onNavigateTab, activeTab }: HeaderProps) => {
  const { user, isAdmin } = useAuth();
  const { onlineUsers } = usePresence();

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggle}
            className="hidden lg:flex hover:bg-muted"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </Button>
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
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <CompanySwitcher />

          {isAdmin && (
            <OnlineUsersIndicator onlineUsers={onlineUsers} currentUserId={user?.id} />
          )}

          <TeamChatTrigger
            isActive={activeTab === 'team-chat'}
            onOpen={() => onNavigateTab?.('team-chat')}
          />

          <NotificationCenter onNavigate={onNavigateTab} />

          <ThemeToggle />

          {user && <UserAccountMenu onNavigateTab={onNavigateTab} />}
        </div>
      </div>
    </header>
  );
};
