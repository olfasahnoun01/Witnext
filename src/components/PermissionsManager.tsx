import { useEffect, useState } from 'react';
import { Shield, Loader2, Check, X, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { BIG_SECTIONS } from '@/config/navigation';
import { UserManagement } from './UserManagement';

interface ManagedUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

interface Perm {
  user_id: string;
  section_key: string;
  subsection_key: string;
}

export const PermissionsManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [perms, setPerms] = useState<Record<string, Set<string>>>({}); // userId -> Set("section" | "section:sub")
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());

  const keyOf = (section: string, sub: string) => (sub ? `${section}:${sub}` : section);

  const load = async () => {
    setLoading(true);
    try {
      const [profilesRes, permsRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, email, full_name'),
        (supabase as any).from('user_section_permissions').select('user_id, section_key, subsection_key'),
        supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (permsRes.error) throw permsRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const adminIds = new Set<string>((rolesRes.data ?? []).map((r: any) => r.user_id));
      setAdminUserIds(adminIds);

      // Hide admins (they bypass) from the management list
      setUsers((profilesRes.data ?? []).filter((p: any) => !adminIds.has(p.user_id)));

      const map: Record<string, Set<string>> = {};
      (permsRes.data as Perm[] ?? []).forEach((p) => {
        if (!map[p.user_id]) map[p.user_id] = new Set();
        map[p.user_id].add(keyOf(p.section_key, p.subsection_key));
      });
      setPerms(map);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFullSection = (userId: string, sectionId: string) => {
    setPerms((prev) => {
      const userSet = new Set(prev[userId] ?? []);
      if (userSet.has(sectionId)) {
        userSet.delete(sectionId);
      } else {
        userSet.add(sectionId);
        // Clear individual sub-section grants since full-section covers them
        const section = BIG_SECTIONS.find((s) => s.id === sectionId);
        section?.subsections.forEach((sub) => userSet.delete(`${sectionId}:${sub.id}`));
      }
      return { ...prev, [userId]: userSet };
    });
  };

  const toggleSubsection = (userId: string, sectionId: string, subId: string) => {
    setPerms((prev) => {
      const userSet = new Set(prev[userId] ?? []);
      const k = `${sectionId}:${subId}`;
      if (userSet.has(k)) userSet.delete(k);
      else {
        userSet.add(k);
        userSet.delete(sectionId); // remove full-section if user is granting granularly
      }
      return { ...prev, [userId]: userSet };
    });
  };

  const saveUser = async (userId: string) => {
    setSaving(userId);
    try {
      // Wipe + re-insert (simple, atomic-enough for low-volume admin op)
      const { error: delErr } = await (supabase as any)
        .from('user_section_permissions')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw delErr;

      const userSet = perms[userId] ?? new Set<string>();
      const rows = Array.from(userSet).map((k) => {
        const [section_key, subsection_key] = k.split(':');
        return {
          user_id: userId,
          section_key,
          subsection_key: subsection_key ?? '',
        };
      });

      if (rows.length > 0) {
        const { error: insErr } = await (supabase as any)
          .from('user_section_permissions')
          .insert(rows);
        if (insErr) throw insErr;
      }

      toast({ title: 'Permissions enregistrées', description: 'Les accès ont été mis à jour.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UserManagement />

    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Gestion des Permissions & Utilisateurs</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les utilisateurs, leurs rôles, puis définissez les sections et sous-sections accessibles. Les administrateurs ont accès à tout par défaut.
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun utilisateur non-administrateur à gérer.
        </div>
      ) : (
        <div className="space-y-6">
          {users.map((u) => {
            const userSet = perms[u.user_id] ?? new Set<string>();
            return (
              <div key={u.user_id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-foreground">{u.email ?? '—'}</p>
                    {u.full_name && (
                      <p className="text-xs text-muted-foreground">{u.full_name}</p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => saveUser(u.user_id)} disabled={saving === u.user_id}>
                    {saving === u.user_id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BIG_SECTIONS.map((section) => {
                    const fullGranted = userSet.has(section.id);
                    return (
                      <div key={section.id} className="bg-muted/40 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <Checkbox
                            checked={fullGranted}
                            onCheckedChange={() => toggleFullSection(u.user_id, section.id)}
                          />
                          <section.icon className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm text-foreground">{section.label}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {fullGranted ? 'Accès total' : 'Granulaire'}
                          </span>
                        </label>

                        {section.subsections.length > 0 && (
                          <div className={`pl-6 space-y-1.5 ${fullGranted ? 'opacity-50 pointer-events-none' : ''}`}>
                            {section.subsections.map((sub) => {
                              const k = `${section.id}:${sub.id}`;
                              const checked = fullGranted || userSet.has(k);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={fullGranted}
                                    onCheckedChange={() => toggleSubsection(u.user_id, section.id, sub.id)}
                                  />
                                  <sub.icon className="w-3.5 h-3.5" />
                                  <span>{sub.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {section.subsections.length === 0 && (
                          <div className="pl-6 text-[11px] text-muted-foreground italic">
                            Aucune sous-section pour le moment
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
};
