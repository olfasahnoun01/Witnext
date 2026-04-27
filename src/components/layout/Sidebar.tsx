import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import grosafeLogo from '@/assets/grosafe-logo-new.png';
import { BIG_SECTIONS, SUBSECTION_TO_SECTION } from '@/config/navigation';
import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, isOpen, onToggle }: SidebarProps) => {
  // Initialize with the section of the active tab expanded, and others optionally true or false
  // For better UX, let's have the active one expanded and others collapsed, or all expanded initially.
  // We'll initialize all to true for discoverability.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    BIG_SECTIONS.forEach(s => {
      initial[s.id] = true;
    });
    return initial;
  });

  // Make sure the active section is always expanded when navigating (optional but good)
  useEffect(() => {
    const activeSectionId = SUBSECTION_TO_SECTION[activeTab];
    if (activeSectionId && !expandedSections[activeSectionId]) {
      setExpandedSections(prev => ({ ...prev, [activeSectionId]: true }));
    }
  }, [activeTab]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const { canAccessSection, canAccessSubsection, visibleSections } = usePermissions();

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
          <div className="flex items-center justify-between p-5 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2">
                <img 
                  src={grosafeLogo} 
                  alt="Alpha" 
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

          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            {visibleSections.map((section) => {
              const isExpanded = expandedSections[section.id];
              const visibleSubsections = section.subsections.filter(sub => canAccessSubsection(sub.id));
              
              if (visibleSubsections.length === 0) return null;

              return (
                <div key={section.id} className="space-y-1">
                  <button 
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl group",
                      isExpanded 
                        ? "bg-primary/10 text-primary border border-primary/20 mb-2" 
                        : "text-slate-950 dark:text-sidebar-foreground/60 hover:bg-sidebar-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isExpanded ? "bg-primary text-white" : "bg-sidebar-accent/50 group-hover:bg-sidebar-accent"
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
                      "grid transition-all duration-300 ease-in-out pl-3 ml-4 border-l-2 border-sidebar-border/30",
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
                          isActive 
                            ? "bg-primary text-primary-foreground shadow-md" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
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
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border/50">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-sidebar-foreground">
                Alpha
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
