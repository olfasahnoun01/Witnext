import { useEffect, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Loader2,
  Save,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BIG_SECTIONS } from '@/config/navigation';

type Role = 'admin' | 'moderator' | 'user';

interface ManagedUser {
  id: string;            // auth user id
  email: string;
  full_name: string;
  position?: string;
  created_at: string;
  role: Role;
}

interface Perm {
  user_id: string;
  section_key: string;
  subsection_key: string;
}

const keyOf = (section: string, sub: string) => (sub ? `${section}:${sub}` : section);

const buildAllPermissionKeys = (): string[] => {
  // "Accès total" = full-section grant for every big section
  return BIG_SECTIONS.map((s) => s.id);
};

const POSITION_OPTIONS = [
  'Responsable achat',
  'Responsable commerciale',
  'Responsable magazin',
  'Responsable informatique',
  'Responsable ressources humaines',
  'Responsable administrative',
  'Operateur',
] as const;

export const PermissionsManager = () => {
  const { toast } = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingPermsFor, setSavingPermsFor] = useState<string | null>(null);

  // User CRUD modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState<string>('Operateur');
  const [role, setRole] = useState<Role>('user');
  // Permissions chosen inline in the create/edit modal
  const [modalPerms, setModalPerms] = useState<Set<string>>(new Set());

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');

      const [usersRes, permsRes] = await Promise.all([
        supabase.functions.invoke('manage-users', {
          body: { action: 'list' },
          headers: { Authorization: `Bearer ${token}` },
        }),
        (supabase as any)
          .from('user_section_permissions')
          .select('user_id, section_key, subsection_key'),
      ]);

      if (usersRes.error) throw new Error(usersRes.error.message);
      if (permsRes.error) throw permsRes.error;

      setUsers(usersRes.data?.users ?? []);

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

  // ---------- Permission toggling (inline per user card) ----------
  const toggleFullSection = (userId: string, sectionId: string) => {
    setPerms((prev) => {
      const userSet = new Set(prev[userId] ?? []);
      if (userSet.has(sectionId)) {
        userSet.delete(sectionId);
      } else {
        userSet.add(sectionId);
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
        userSet.delete(sectionId);
      }
      return { ...prev, [userId]: userSet };
    });
  };

  const grantAll = (userId: string) => {
    setPerms((prev) => ({ ...prev, [userId]: new Set(buildAllPermissionKeys()) }));
  };

  const revokeAll = (userId: string) => {
    setPerms((prev) => ({ ...prev, [userId]: new Set() }));
  };

  const persistPermissions = async (userId: string, set: Set<string>) => {
    const { error: delErr } = await (supabase as any)
      .from('user_section_permissions')
      .delete()
      .eq('user_id', userId);
    if (delErr) throw delErr;

    const rows = Array.from(set).map((k) => {
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
  };

  const savePermissions = async (userId: string) => {
    setSavingPermsFor(userId);
    try {
      await persistPermissions(userId, perms[userId] ?? new Set());
      toast({ title: 'Permissions enregistrées' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setSavingPermsFor(null);
    }
  };

  // ---------- User CRUD ----------
  const openModal = (user?: ManagedUser) => {
    if (user) {
      setEditingUser(user);
      setEmail(user.email);
      setFullName(user.full_name ?? '');
      setPosition(user.position || 'Operateur');
      setRole(user.role);
      setPassword('');
      setModalPerms(new Set(perms[user.id] ?? []));
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setFullName('');
      setPosition('Operateur');
      setRole('user');
      setModalPerms(new Set()); // start empty; admin picks
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setPosition('Operateur');
    setRole('user');
    setModalPerms(new Set());
  };

  const toggleExpandedUser = (userId: string) => {
    setExpandedUsers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const toggleModalFullSection = (sectionId: string) => {
    setModalPerms((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else {
        next.add(sectionId);
        BIG_SECTIONS.find((s) => s.id === sectionId)?.subsections.forEach((sub) =>
          next.delete(`${sectionId}:${sub.id}`)
        );
      }
      return next;
    });
  };

  const toggleModalSubsection = (sectionId: string, subId: string) => {
    setModalPerms((prev) => {
      const next = new Set(prev);
      const k = `${sectionId}:${subId}`;
      if (next.has(k)) next.delete(k);
      else {
        next.add(k);
        next.delete(sectionId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await getAuthToken();

      let targetUserId = editingUser?.id ?? null;

      if (editingUser) {
        const response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update',
            user_id: editingUser.id,
            full_name: fullName,
            position,
            role,
            ...(password ? { password } : {}),
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);
      } else {
        if (!password) {
          toast({ variant: 'destructive', title: 'Erreur', description: 'Le mot de passe est requis' });
          setSubmitting(false);
          return;
        }
        const response = await supabase.functions.invoke('manage-users', {
          body: { action: 'create', email, password, full_name: fullName, position, role },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);
        targetUserId = response.data?.user?.id ?? response.data?.user_id ?? null;
      }

      // Persist permissions for non-admin users (admins bypass anyway)
      if (targetUserId && role !== 'admin') {
        await persistPermissions(targetUserId, modalPerms);
      }

      toast({
        title: editingUser ? 'Utilisateur modifié' : 'Utilisateur créé',
        description: editingUser
          ? 'Informations et permissions mises à jour'
          : `Le compte ${email} a été créé avec ses permissions`,
      });

      closeModal();
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (!window.confirm(`Supprimer l'utilisateur "${user.email}" ?`)) return;
    try {
      const token = await getAuthToken();
      const response = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: user.id },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast({ title: 'Utilisateur supprimé' });
      load();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    }
  };

  const getRoleBadge = (r: Role) => {
    if (r === 'admin')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <ShieldCheck className="w-3 h-3" /> Admin
        </span>
      );
    if (r === 'moderator')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
          <Shield className="w-3 h-3" /> Modérateur
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        Utilisateur
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Gestion des Permissions & Utilisateurs
              </h2>
              <p className="text-sm text-muted-foreground">
                Gérez les utilisateurs, leurs rôles, puis définissez les sections et sous-sections accessibles.
                Les administrateurs ont accès à tout par défaut.
              </p>
            </div>
          </div>
          <Button onClick={() => openModal()}>
            <UserPlus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((u) => {
              const isAdminUser = u.role === 'admin';
              const userSet = perms[u.id] ?? new Set<string>();
              const isExpanded = !!expandedUsers[u.id];
              return (
                <div key={u.id} className="border border-border rounded-xl p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{u.email}</p>
                        {getRoleBadge(u.role)}
                      </div>
                      {u.full_name && (
                        <p className="text-sm text-muted-foreground mt-1">{u.full_name}</p>
                      )}
                      {u.position && (
                        <p className="text-xs text-muted-foreground mt-0.5">{u.position}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Créé le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleExpandedUser(u.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                        {isExpanded ? 'Masquer permissions' : 'Afficher permissions'}
                      </Button>
                      {!isAdminUser && (
                        isExpanded && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => grantAll(u.id)}>
                            Tout accorder
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => revokeAll(u.id)}>
                            Tout retirer
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => savePermissions(u.id)}
                            disabled={savingPermsFor === u.id}
                          >
                            {savingPermsFor === u.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Enregistrer
                          </Button>
                        </>
                        )
                      )}
                      <button
                        onClick={() => openModal(u)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Permissions grid */}
                  {isExpanded && (isAdminUser ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
                      Cet administrateur a accès à toutes les sections et sous-sections par défaut.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {BIG_SECTIONS.map((section) => {
                        const fullGranted = userSet.has(section.id);
                        return (
                          <div key={section.id} className="bg-muted/40 rounded-lg p-3">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <Checkbox
                                checked={fullGranted}
                                onCheckedChange={() => toggleFullSection(u.id, section.id)}
                              />
                              <section.icon className="w-4 h-4 text-primary" />
                              <span className="font-medium text-sm text-foreground">{section.label}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {fullGranted ? 'Accès total' : 'Granulaire'}
                              </span>
                            </label>

                            {section.subsections.length > 0 ? (
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
                                        onCheckedChange={() => toggleSubsection(u.id, section.id, sub.id)}
                                      />
                                      <sub.icon className="w-3.5 h-3.5" />
                                      <span>{sub.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="pl-6 text-[11px] text-muted-foreground italic">
                                Aucune sous-section pour le moment
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-xl font-semibold text-foreground">
                {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!!editingUser}
                    placeholder="utilisateur@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Prénom Nom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Mot de passe {editingUser ? '(laisser vide pour ne pas changer)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                    minLength={6}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Poste</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="moderator">Modérateur</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Permissions block — hidden for admin (they bypass) */}
              {role !== 'admin' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Permissions d'accès</Label>
                      <p className="text-xs text-muted-foreground">
                        Choisissez les grandes sections et sous-sections accessibles dès la création.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setModalPerms(new Set(buildAllPermissionKeys()))}
                      >
                        Tout accorder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setModalPerms(new Set())}
                      >
                        Tout retirer
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {BIG_SECTIONS.map((section) => {
                      const fullGranted = modalPerms.has(section.id);
                      return (
                        <div key={section.id} className="bg-muted/40 rounded-lg p-3">
                          <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <Checkbox
                              checked={fullGranted}
                              onCheckedChange={() => toggleModalFullSection(section.id)}
                            />
                            <section.icon className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm text-foreground">{section.label}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {fullGranted ? 'Accès total' : 'Granulaire'}
                            </span>
                          </label>

                          {section.subsections.length > 0 ? (
                            <div className={`pl-6 space-y-1.5 ${fullGranted ? 'opacity-50 pointer-events-none' : ''}`}>
                              {section.subsections.map((sub) => {
                                const k = `${section.id}:${sub.id}`;
                                const checked = fullGranted || modalPerms.has(k);
                                return (
                                  <label
                                    key={sub.id}
                                    className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={fullGranted}
                                      onCheckedChange={() => toggleModalSubsection(section.id, sub.id)}
                                    />
                                    <sub.icon className="w-3.5 h-3.5" />
                                    <span>{sub.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="pl-6 text-[11px] text-muted-foreground italic">
                              Aucune sous-section pour le moment
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : editingUser ? (
                    'Enregistrer'
                  ) : (
                    'Créer'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
