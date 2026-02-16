import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  FileText, 
  ClipboardList,
  Settings,
  Menu,
  X,
  GitCompare,
  ChevronRight,
  Building2,
  Phone,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import grosafeLogo from '@/assets/grosafe-logo-new.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventaire', icon: Package },
  { id: 'fournisseurs', label: 'Fournisseurs', icon: Building2 },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'comparison', label: 'Comparaison Prix', icon: GitCompare },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'reports', label: 'Rapports & Documents', icon: FileText },
  { id: 'devis', label: 'Gestion Devis', icon: ClipboardList },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export const Sidebar = ({ activeTab, onTabChange, isOpen, onToggle }: SidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-72 lg:w-72"
        )}
        style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-5 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2">
                <img 
                  src={grosafeLogo} 
                  alt="Grosafe Équipement" 
                  className="h-16 w-auto object-contain"
                />
              </div>
            </div>
            <button 
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Menu Principal
            </p>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border/50">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-sidebar-foreground">
                Grosafe Équipement
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-sidebar-foreground/80">
                <Phone className="w-3.5 h-3.5" />
                <span>Contactez l'administrateur</span>
              </div>
              <a 
                href="tel:56244009" 
                className="text-sm font-semibold text-primary hover:underline mt-1 block"
              >
                56 244 009
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-30 lg:hidden p-2.5 rounded-xl bg-card shadow-lg border border-border hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>
    </>
  );
};
