import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { BIG_SECTIONS, isSubsectionVisibleForCompany } from '@/config/navigation';
import { getPathForSubsection, getSubsectionFromPath } from '@/config/routes';
import { getSectionTheme } from '@/config/sectionThemes';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { NavLink } from '@/components/NavLink';

function collapsedSectionsState(): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  BIG_SECTIONS.forEach((s) => {
    initial[s.id] = false;
  });
  return initial;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const activeSubsectionId = getSubsectionFromPath(location.pathname);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(collapsedSectionsState);

  useEffect(() => {
    setExpandedSections(collapsedSectionsState());
  }, [user?.id]);

  useEffect(() => {
    if (!activeSubsectionId) return;
    const section = BIG_SECTIONS.find((s) =>
      s.subsections.some((sub) => sub.id === activeSubsectionId)
    );
    if (section) {
      setExpandedSections((prev) => ({ ...prev, [section.id]: true }));
    }
  }, [activeSubsectionId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const { canAccessSubsection, visibleSections, loading: permissionsLoading } = usePermissions();
  const { currentCompany } = useAppCompany();

  const isSubsectionVisible = (subsectionId: string): boolean =>
    canAccessSubsection(subsectionId) &&
    isSubsectionVisibleForCompany(subsectionId, currentCompany?.code);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/60 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'w-72'
        )}
        style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-sidebar-border/50 px-4 py-4">
            <div className="flex min-w-0 flex-1 items-center justify-center lg:justify-start">
              <WitnextLogoBanner variant="app" />
            </div>
            <button
              onClick={onToggle}
              className="rounded-lg p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto p-4">
            {permissionsLoading ? (
              <div className="space-y-2 px-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-2xl bg-sidebar-accent/25"
                  />
                ))}
              </div>
            ) : visibleSections.length === 0 ? (
              <p className="px-3 py-2 text-xs leading-relaxed text-sidebar-foreground/70">
                Aucun module accessible. Contactez l&apos;administrateur si le menu reste vide après
                connexion.
              </p>
            ) : (
              visibleSections.map((section) => {
                const isExpanded = expandedSections[section.id];
                const visibleSubsections = section.subsections.filter((sub) =>
                  isSubsectionVisible(sub.id)
                );

                if (visibleSubsections.length === 0) return null;

                const theme = getSectionTheme(section.id);

                return (
                  <div key={section.id} className="space-y-1">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className={cn(
                        'group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all',
                        isExpanded
                          ? cn(theme.headerExpanded, 'mb-2')
                          : cn(theme.headerCollapsed, 'border-transparent')
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'rounded-xl p-2 transition-colors',
                            isExpanded ? theme.iconExpanded : theme.iconCollapsed
                          )}
                        >
                          <section.icon className="h-4 w-4" />
                        </div>
                        {section.label}
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-300',
                          isExpanded ? 'rotate-0' : '-rotate-90 opacity-40'
                        )}
                      />
                    </button>

                    <div
                      className={cn(
                        'ml-4 grid border-l-2 pl-3 transition-all duration-300 ease-in-out',
                        theme.treeBorder,
                        isExpanded ? 'mt-1 mb-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      )}
                    >
                      <div className="space-y-1.5 overflow-hidden">
                        {visibleSubsections.map((item) => {
                          const to = item.path ?? getPathForSubsection(item.id);
                          return (
                            <NavLink
                              key={item.id}
                              to={to}
                              end
                              onClick={() => {
                                if (window.innerWidth < 1024) onToggle();
                              }}
                              className={({ isActive }) =>
                                cn(
                                  'group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                                  isActive ? theme.subActive : theme.subInactive
                                )
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <item.icon
                                    className={cn(
                                      'h-4 w-4 transition-transform duration-200',
                                      !isActive && 'group-hover:scale-110'
                                    )}
                                  />
                                  <span className="flex-1 text-left">{item.label}</span>
                                  {isActive && <ChevronRight className="h-4 w-4" />}
                                </>
                              )}
                            </NavLink>
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

      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-30 rounded-xl border border-border bg-card p-2.5 shadow-lg transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>
    </>
  );
};
