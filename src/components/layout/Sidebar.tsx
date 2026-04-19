import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Menu, X, Phone, ChevronRight } from 'lucide-react';
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
  const { visibleSections, canAccessSubsection, firstAllowedSubsection, isAdmin } = usePermissions();

  // Determine the active big section from the active sub-section, or default
  const inferSectionFromTab = (tab: string): string | null => {
    if (tab === 'settings') return null;
    if (tab.startsWith('section:')) return tab.replace('section:', '');
    return SUBSECTION_TO_SECTION[tab] ?? null;
  };

  const [activeBigSection, setActiveBigSection] = useState<string | null>(
    () => inferSectionFromTab(activeTab) ?? visibleSections[0]?.id ?? null
  );

  useEffect(() => {
    const inferred = inferSectionFromTab(activeTab);
    if (inferred) setActiveBigSection(inferred);
  }, [activeTab]);

  // Ensure active big section is visible
  useEffect(() => {
    if (activeBigSection && !visibleSections.find((s) => s.id === activeBigSection)) {
      setActiveBigSection(visibleSections[0]?.id ?? null);
    }
  }, [visibleSections, activeBigSection]);

  const handleSelectBigSection = (sectionId: string) => {
    setActiveBigSection(sectionId);
    const section = BIG_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    if (section.subsections.length === 0) {
      onTabChange(`section:${sectionId}`);
    } else {
      const firstSub = firstAllowedSubsection(sectionId);
      if (firstSub) {
        onTabChange(firstSub);
      } else {
        onTabChange(`section:${sectionId}`);
      }
    }
  };

  const handleSelectSubsection = (subId: string) => {
    onTabChange(subId);
    if (window.innerWidth < 1024) onToggle();
  };

  const currentBigSection = BIG_SECTIONS.find((s) => s.id === activeBigSection);
  const settingsActive = activeTab === 'settings';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Big section rail */}
        <div
          className="w-20 h-full flex flex-col items-center py-4 border-r border-sidebar-border"
          style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
        >
          <div className="rounded-xl mb-4">
            <img src={grosafeLogo} alt="Grosafe" className="h-12 w-auto object-contain" />
          </div>

          <nav className="flex-1 flex flex-col gap-2 w-full px-2">
            {visibleSections.map((section) => {
              const isActive = activeBigSection === section.id && !settingsActive;
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSelectBigSection(section.id)}
                  title={section.label}
                  className={cn(
                    'group flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/30'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] leading-tight text-center font-medium line-clamp-2">
                    {section.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Settings always visible */}
          <button
            onClick={() => {
              onTabChange('settings');
              if (window.innerWidth < 1024) onToggle();
            }}
            title="Paramètres"
            className={cn(
              'mt-2 flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all w-[calc(100%-1rem)]',
              settingsActive
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/30'
            )}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Paramètres</span>
          </button>
        </div>

        {/* Sub-sections panel */}
        <div
          className="w-60 h-full flex flex-col border-r border-sidebar-border"
          style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
        >
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border/50">
            <div>
              <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Section
              </p>
              <h2 className="text-base font-semibold text-sidebar-foreground">
                {settingsActive ? 'Paramètres' : currentBigSection?.label ?? '—'}
              </h2>
            </div>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {settingsActive ? (
              <div className="px-3 py-2 text-sm text-sidebar-foreground/70">
                Configuration de l'application.
              </div>
            ) : currentBigSection && currentBigSection.subsections.length > 0 ? (
              currentBigSection.subsections
                .filter((sub) => canAccessSubsection(sub.id))
                .map((sub) => {
                  const isActive = activeTab === sub.id;
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleSelectSubsection(sub.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/30'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left truncate">{sub.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </button>
                  );
                })
            ) : (
              <div className="px-3 py-6 text-sm text-sidebar-foreground/60 text-center">
                Bientôt disponible
              </div>
            )}
          </nav>

          <div className="p-3 border-t border-sidebar-border/50">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs font-medium text-sidebar-foreground">Grosafe Équipement</p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-sidebar-foreground/80">
                <Phone className="w-3 h-3" />
                <span>Contact admin</span>
              </div>
              <a href="tel:56244009" className="text-xs font-semibold text-primary hover:underline mt-0.5 block">
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
