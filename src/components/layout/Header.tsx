import { Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { OnlineUsersIndicator } from '@/components/OnlineUsersIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { UserAccountMenu } from '@/components/layout/UserAccountMenu';
import { TeamChatTrigger } from '@/components/TeamChat';
import { getPathForSubsection, normalizePathname } from '@/config/routes';

interface HeaderProps {
  title: string;
  onToggle?: () => void;
  sidebarOpen?: boolean;
}

export const Header = ({ title, onToggle, sidebarOpen }: HeaderProps) => {
  const { user, isAdmin } = useAuth();
  const { onlineUsers } = usePresence();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePathname(location.pathname);
  const messagesPath = getPathForSubsection('team-chat');
  const isMessagesActive = pathname === messagesPath;

  const handleCloseChat = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="hidden hover:bg-muted lg:flex"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('fr-TN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <CompanySwitcher />

          {isAdmin && (
            <OnlineUsersIndicator onlineUsers={onlineUsers} currentUserId={user?.id} />
          )}

          {isMessagesActive ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              onClick={handleCloseChat}
              aria-label="Fermer le chat"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Fermer</span>
            </Button>
          ) : (
            <TeamChatTrigger
              isActive={isMessagesActive}
              onOpen={() => navigate(messagesPath)}
            />
          )}

          <NotificationCenter />

          <ThemeToggle />

          {user && <UserAccountMenu />}
        </div>
      </div>
    </header>
  );
};
