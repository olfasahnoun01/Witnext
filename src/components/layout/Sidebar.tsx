import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { BIG_SECTIONS, isSubsectionVisibleForCompany } from '@/config/navigation';
import { getSectionTheme } from '@/config/sectionThemes';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';

function collapsedSectionsState(): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  BIG_SECTIONS.forEach((s) => {
    initial[s.id] = false;
  });
  return initial;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, isOpen, onToggle }: SidebarProps) => {
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(collapsedSectionsState);

  // Keep all modules collapsed on sign-in / user change until the user opens a section
  useEffect(() => {
    setExpandedSections(collapsedSectionsState());
  }, [user?.id]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const { canAccessSection, canAccessSubsection, visibleSections, loading: permissionsLoading } = usePermissions();
  const { currentCompany } = useAppCompany();

  const isSubsectionVisible = (subsectionId: string): boolean =>
    canAccessSubsection(subsectionId) &&
    isSubsectionVisibleForCompany(subsectionId, currentCompany?.code);

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
          "fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-72"
        )}
        style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <WitnextLogoBanner variant="app" showWordmark />
            </div>
            <button 
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            {permissionsLoading ? (
              <div className="space-y-2 px-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-11 rounded-2xl bg-sidebar-accent/25 animate-pulse"
                  />
                ))}
              </div>
            ) : visibleSections.length === 0 ? (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/70 leading-relaxed">
                Aucun module accessible. Contactez l&apos;administrateur si le menu reste vide après connexion.
              </p>
            ) : (
            visibleSections.map((section) => {
              const isExpanded = expandedSections[section.id];
              const visibleSubsections = section.subsections.filter((sub) => isSubsectionVisible(sub.id));
              
              if (visibleSubsections.length === 0) return null;

              const theme = getSectionTheme(section.id);

              return (
                <div key={section.id} className="space-y-1">
                  <button 
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl group border",
                      isExpanded 
                        ? cn(theme.headerExpanded, "mb-2") 
                        : cn(theme.headerCollapsed, "border-transparent")
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isExpanded ? theme.iconExpanded : theme.iconCollapsed
                      )}>
                        <section.icon className="w-4 h-4" />
                      </div>
                      {section.label}
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform duration-300", 
                      isExpanded ? "rotate-0" : "-rotate-90 opacity-40"
                    )} />
                  </button>
                  
                  <div 
                    className={cn(
                      "grid transition-all duration-300 ease-in-out pl-3 ml-4 border-l-2",
                      theme.treeBorder,
                      isExpanded ? "grid-rows-[1fr] opacity-100 mt-1 mb-4" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden space-y-1.5">
                      {visibleSubsections.map((item) => {
                        const isActive = activeTab === item.id;
                        const content = (
                          <>
                            <item.icon className={cn(
                              "w-4 h-4 transition-transform duration-200",
                              !isActive && "group-hover:scale-110"
                            )} />
                            <span className="flex-1 text-left">{item.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4" />}
                          </>
                        );

                        const baseStyles = cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                          isActive ? theme.subActive : theme.subInactive
                        );

                        if (item.path) {
                          return (
                            <Link 
                              key={item.id} 
                              to={item.path}
                              onClick={() => {
                                if (window.innerWidth < 1024) onToggle();
                              }}
                              className={baseStyles}
                            >
                              {content}
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onTabChange(item.id);
                              if (window.innerWidth < 1024) onToggle();
                            }}
                            className={baseStyles}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </nav>
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
