import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  FileText, 
  Bot, 
  Settings,
  Menu,
  X,
  GitCompare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import grosafeLogo from '@/assets/grosafe-logo.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventaire', icon: Package },
  { id: 'comparison', label: 'Comparaison Prix', icon: GitCompare },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'reports', label: 'Rapports & Documents', icon: FileText },
  { id: 'ai', label: 'Assistant IA', icon: Bot },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export const Sidebar = ({ activeTab, onTabChange, isOpen, onToggle }: SidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full sidebar-gradient transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-72 lg:w-72"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <div className="flex items-center">
              <img 
                src={grosafeLogo} 
                alt="Grosafe Équipement" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <button 
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={cn(
                  "nav-item w-full",
                  activeTab === item.id && "nav-item-active"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="p-4 rounded-xl bg-sidebar-accent">
              <p className="text-sm text-sidebar-foreground/80">
                Grosafe Équipement
              </p>
              <p className="text-xs text-sidebar-foreground/50 mt-1">
                Système hors-ligne v1.0
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-30 lg:hidden p-2 rounded-lg bg-card shadow-lg border border-border"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>
    </>
  );
};
