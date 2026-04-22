import { useState, useEffect } from 'react';
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
          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            {BIG_SECTIONS.map((section) => {
              const isExpanded = expandedSections[section.id];
              return (
                <div key={section.id} className="space-y-1">
                  <button 
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground uppercase tracking-wider hover:bg-sidebar-accent/30 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="w-4 h-4" />
                      {section.label}
                    </div>
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 transition-transform duration-200", 
                      isExpanded ? "" : "-rotate-90"
                    )} />
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-1 mt-1">
                      {section.subsections.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onTabChange(item.id);
                              if (window.innerWidth < 1024) onToggle();
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                              isActive 
                                ? "bg-primary text-primary-foreground shadow-md" 
                                : "text-sidebar-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                            )}
                          >
                            <item.icon className={cn(
                              "w-4 h-4 transition-transform duration-200",
                              !isActive && "group-hover:scale-110"
                            )} />
                            <span className="flex-1 text-left">{item.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
