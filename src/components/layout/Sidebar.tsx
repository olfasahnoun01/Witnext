import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import {
  BIG_SECTIONS,
  isSubsectionVisibleForCompany,
  type SubSection,
} from '@/config/navigation';
import { getPathForSubsection, getSubsectionFromPath } from '@/config/routes';
import { getSectionTheme } from '@/config/sectionThemes';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { NavLink } from '@/components/NavLink';
import { Input } from '@/components/ui/input';

const SIDEBAR_EXPANDED_KEY = 'erp-sidebar-expanded';

function collapsedSectionsState(): Record<string, boolean> {
  const initial: Record<string, boolean> = {};
  BIG_SECTIONS.forEach((s) => {
    initial[s.id] = false;
  });
  return initial;
}

function loadExpandedSections(userId: string | undefined): Record<string, boolean> {
  const base = collapsedSectionsState();
  if (!userId) return base;
  try {
    const raw = localStorage.getItem(`${SIDEBAR_EXPANDED_KEY}:${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return { ...base, ...parsed };
    }
  } catch {
    // ignore corrupt storage
  }
  return base;
}

function expandOnly(sectionId: string): Record<string, boolean> {
  const next = collapsedSectionsState();
  next[sectionId] = true;
  return next;
}

function groupSubsections(
  items: SubSection[]
): Array<{ group: string | null; items: SubSection[] }> {
  const groups: Array<{ group: string | null; items: SubSection[] }> = [];
  for (const item of items) {
    const groupLabel = item.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.group === groupLabel) {
      last.items.push(item);
    } else {
      groups.push({ group: groupLabel, items: [item] });
    }
  }
  return groups;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

/** True for a normal left-click navigation (not new-tab / new-window gestures). */
function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const activeSubsectionId = getSubsectionFromPath(location.pathname);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    loadExpandedSections(user?.id)
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setExpandedSections(loadExpandedSections(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`${SIDEBAR_EXPANDED_KEY}:${user.id}`, JSON.stringify(expandedSections));
    } catch {
      // ignore quota errors
    }
  }, [expandedSections, user?.id]);

  useEffect(() => {
    if (!activeSubsectionId) return;
    const section = BIG_SECTIONS.find((s) =>
      s.subsections.some((sub) => sub.id === activeSubsectionId)
    );
    if (section) {
      setExpandedSections(expandOnly(section.id));
    }
  }, [activeSubsectionId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      if (prev[sectionId]) {
        return { ...prev, [sectionId]: false };
      }
      return expandOnly(sectionId);
    });
  };

  const { canAccessSubsection, visibleSections, loading: permissionsLoading } = usePermissions();
  const { currentCompany } = useAppCompany();

  const isSubsectionVisible = (subsectionId: string): boolean =>
    canAccessSubsection(subsectionId) &&
    isSubsectionVisibleForCompany(subsectionId, currentCompany?.code);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return visibleSections;

    return visibleSections
      .map((section) => {
        const sectionLabelMatch = section.label.toLowerCase().includes(normalizedSearch);
        const matchingSubsections = section.subsections.filter(
          (sub) =>
            isSubsectionVisible(sub.id) &&
            (sectionLabelMatch || sub.label.toLowerCase().includes(normalizedSearch))
        );
        if (matchingSubsections.length === 0) return null;
        return { ...section, subsections: matchingSubsections };
      })
      .filter((s): s is (typeof visibleSections)[number] => s !== null);
  }, [visibleSections, normalizedSearch, canAccessSubsection, currentCompany?.code]);

  useEffect(() => {
    if (!normalizedSearch || filteredSections.length === 0) return;
    const firstMatch = filteredSections[0];
    if (firstMatch) {
      setExpandedSections(expandOnly(firstMatch.id));
    }
  }, [normalizedSearch, filteredSections]);

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
          'fixed top-0 left-0 z-50 h-full w-80 border-r border-sidebar-border bg-sidebar transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-sidebar-border/50 px-4 py-3">
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

          {!permissionsLoading && visibleSections.length > 0 && (
            <div className="border-b border-sidebar-border/50 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher un module…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-sidebar-border bg-sidebar-accent/30 pl-9 text-sm"
                  aria-label="Rechercher dans le menu"
                />
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-2.5 overflow-y-auto p-3 scrollbar-thin">
            {permissionsLoading ? (
              <div className="space-y-2 px-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-xl bg-sidebar-accent/25"
                  />
                ))}
              </div>
            ) : visibleSections.length === 0 ? (
              <p className="px-3 py-2 text-xs leading-relaxed text-sidebar-foreground/70">
                Aucun module accessible. Contactez l&apos;administrateur si le menu reste vide après
                connexion.
              </p>
            ) : filteredSections.length === 0 ? (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/70">
                Aucun résultat pour &laquo;&nbsp;{searchQuery}&nbsp;&raquo;.
              </p>
            ) : (
              filteredSections.map((section) => {
                const isExpanded = expandedSections[section.id] || !!normalizedSearch;
                const visibleSubsections = section.subsections.filter((sub) =>
                  isSubsectionVisible(sub.id)
                );

                if (visibleSubsections.length === 0) return null;

                const theme = getSectionTheme(section.id);
                const subsectionGroups = groupSubsections(visibleSubsections);
                const hasGroupLabels = subsectionGroups.some((g) => g.group !== null);

                return (
                  <div key={section.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isExpanded}
                      title={section.label}
                      className={cn(
                        'flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                        isExpanded
                          ? cn(theme.headerExpanded, 'mb-1')
                          : cn(theme.headerCollapsed, 'border-transparent')
                      )}
                    >
                      <div
                        className={cn(
                          'shrink-0 rounded-lg p-1.5 transition-colors',
                          isExpanded ? theme.iconExpanded : theme.iconCollapsed
                        )}
                      >
                        <section.icon className="h-4 w-4" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 transition-transform duration-300',
                          isExpanded ? 'rotate-0' : '-rotate-90 opacity-50'
                        )}
                      />
                    </button>

                    <div
                      className={cn(
                        'ml-3 grid border-l-2 pl-2.5 transition-all duration-300 ease-in-out',
                        theme.treeBorder,
                        isExpanded ? 'mb-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      )}
                    >
                      <div className="space-y-1 overflow-hidden">
                        {subsectionGroups.map((group) => (
                          <div key={group.group ?? '_ungrouped'} className="space-y-0.5">
                            {hasGroupLabels && group.group && (
                              <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                                {group.group}
                              </p>
                            )}
                            {group.items.map((item) => {
                              const to = item.path ?? getPathForSubsection(item.id);
                              return (
                                <NavLink
                                  key={item.id}
                                  to={to}
                                  end
                                  title={item.label}
                                  onClick={(event) => {
                                    if (!isPlainLeftClick(event)) return;
                                    if (window.innerWidth < 1024) onToggle();
                                  }}
                                  className={({ isActive }) =>
                                    cn(
                                      'group flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                                      isActive ? theme.subActive : theme.subInactive
                                    )
                                  }
                                >
                                  <item.icon
                                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105"
                                  />
                                  <span className="flex-1 text-left leading-snug">{item.label}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        ))}
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
