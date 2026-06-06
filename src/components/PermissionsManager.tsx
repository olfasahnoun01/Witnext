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
  Mail,
  Lock,
  Building2,
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
import { posteHasAllFinanceCompanies } from '@/lib/userPositions';

function allCompanyIdSet(list: CompanyRow[]): Set<string> {
  return new Set(list.map((c) => c.id));
}

function resolveCompanySetForUser(
  poste: string,
  selected: Set<string>,
  allCompanies: CompanyRow[]
): Set<string> {
  if (isChauffeurPoste(poste)) return new Set();
  if (posteHasAllFinanceCompanies(poste)) return allCompanyIdSet(allCompanies);
  return selected;
}

type Role = 'admin' | 'moderator' | 'user';

interface CompanyRow {
  id: string;
  code: string;
  name: string;
}

const FINANCE_SECTION_ID = 'finance';
const FINANCE_SUBSECTION_ID = 'finance-hub';

/** True when the user has full Finance section or finance-hub subsection access. */
function userHasFinanceAccess(userSet: Set<string>): boolean {
  return (
    userSet.has(FINANCE_SECTION_ID) ||
    userSet.has(`${FINANCE_SECTION_ID}:${FINANCE_SUBSECTION_ID}`)
  );
}

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
  return BIG_SECTIONS.map((s) => s.id);
};

const POSITION_OPTIONS = [
  'Responsable achat',
  'Responsable commerciale',
  'Responsable magazin',
  'Responsable informatique',
  'Responsable ressources humaines',
  'Responsable administrative',
  'Responsable financier',
  'Directeur Generale',
  'Operateur',
  'Chauffeur',
] as const;

type AccountTab = 'admins' | 'users' | 'drivers';

function isKnownPosition(value: string): boolean {
  return (POSITION_OPTIONS as readonly string[]).includes(value);
}

function normalizePosition(pos: string | undefined): string {
  return (pos || '').trim().toLowerCase();
}

function isDriverPosition(pos: string | undefined): boolean {
  const p = normalizePosition(pos);
  return p === 'chauffeur' || p === 'operateur' || p === 'chauffer';
}

/** Chauffeur accounts are mobile-app only — no ERP module access. */
function isChauffeurPoste(pos: string | undefined): boolean {
  const p = normalizePosition(pos);
  return p === 'chauffeur' || p === 'chauffer';
}

function tabForUser(u: Pick<ManagedUser, 'role' | 'position'>): AccountTab {
  if (u.role === 'admin' || u.role === 'moderator') return 'admins';
  if (isDriverPosition(u.position)) return 'drivers';
  return 'users';
}

function splitFullName(full: string): { prenom: string; nom: string } {
  const trimmed = full.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) {
    return { prenom: trimmed || 'Employé', nom: trimmed || 'Alpha' };
  }
  return { prenom: trimmed.slice(0, space), nom: trimmed.slice(space + 1).trim() || trimmed };
}

const ROLE_RANK: Record<Role, number> = { admin: 3, moderator: 2, user: 1 };

function pickHigherRole(current: Role | undefined, next: Role): Role {
  if (!current) return next;
  return ROLE_RANK[next] > ROLE_RANK[current] ? next : current;
}

/** Liste utilisateurs sans Edge Function (ex. CORS Electron sur 127.0.0.1). */
async function loadUsersFromDbFallback(): Promise<ManagedUser[]> {
  const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
    supabase.from('profiles').select('user_id, email, full_name, created_at').order('created_at', { ascending: true }),
    supabase.from('user_roles').select('user_id, role'),
  ]);
  if (pe) throw pe;
  if (re) throw re;

  const roleByUser = new Map<string, Role>();
  for (const row of roles ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const r = (row as { role: string }).role as Role;
    roleByUser.set(uid, pickHigherRole(roleByUser.get(uid), r));
  }

  return (profiles ?? []).map((p: { user_id: string; email: string | null; full_name: string | null; created_at: string }) => ({
    id: p.user_id,
    email: p.email ?? '',
    full_name: p.full_name ?? '',
    position: undefined,
    created_at: p.created_at,
    role: roleByUser.get(p.user_id) ?? 'user',
  }));
}

export const PermissionsManager = () => {
  const { toast } = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [userCompanies, setUserCompanies] = useState<Record<string, Set<string>>>({});
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
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
  const [modalCompanies, setModalCompanies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<AccountTab>('admins');
  const [mobilePhone, setMobilePhone] = useState('');
  const [mobileCin, setMobileCin] = useState('');

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Session expirée. Veuillez vous reconnecter.');

      const [usersRes, permsRes, companiesRes, userCompaniesRes] = await Promise.all([
        supabase.functions.invoke('manage-users', {
          body: { action: 'list' },
          headers: { Authorization: `Bearer ${token}` },
        }),
        (supabase as any)
          .from('user_section_permissions')
          .select('user_id, section_key, subsection_key'),
        supabase.from('companies').select('id, code, name').order('name'),
        supabase.from('user_companies').select('user_id, company_id'),
      ]);

      if (permsRes.error) throw permsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (userCompaniesRes.error) throw userCompaniesRes.error;

      setCompanies((companiesRes.data ?? []) as CompanyRow[]);

      if (usersRes.error) {
        const msg = usersRes.error.message || '';
        console.warn('[PermissionsManager] manage-users list failed:', msg);
        try {
          const fallbackUsers = await loadUsersFromDbFallback();
          setUsers(fallbackUsers);
          if (fallbackUsers.length > 0) {
            toast({
              title: 'Mode restreint',
              description:
                'La fonction Edge « manage-users » est injoignable (souvent CORS avec Electron sur 127.0.0.1). ' +
                'Liste chargee depuis la base. Redeployez la fonction avec les origines 127.0.0.1 pour le plein acces (creation / suppression comptes).',
            });
          } else {
            throw new Error(msg);
          }
        } catch (inner) {
          throw new Error(
            `${msg || 'Edge function indisponible'}. ` +
              "Depuis Electron, redeployez la fonction « manage-users » avec CORS pour http://127.0.0.1:8080, ou ouvrez l'app sur http://localhost:8080."
          );
        }
      } else {
        setUsers(usersRes.data?.users ?? []);
      }

      const map: Record<string, Set<string>> = {};
      (permsRes.data as Perm[] ?? []).forEach((p) => {
        if (!map[p.user_id]) map[p.user_id] = new Set();
        map[p.user_id].add(keyOf(p.section_key, p.subsection_key));
      });
      setPerms(map);

      const companyMap: Record<string, Set<string>> = {};
      (userCompaniesRes.data ?? []).forEach((row: { user_id: string; company_id: string }) => {
        if (!companyMap[row.user_id]) companyMap[row.user_id] = new Set();
        companyMap[row.user_id].add(row.company_id);
      });
      setUserCompanies(companyMap);
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

  const persistUserCompanies = async (userId: string, companyIds: Set<string>) => {
    const { error: delErr } = await supabase.from('user_companies').delete().eq('user_id', userId);
    if (delErr) throw delErr;

    if (companyIds.size > 0) {
      const rows = [...companyIds].map((company_id) => ({ user_id: userId, company_id }));
      const { error: insErr } = await supabase.from('user_companies').insert(rows);
      if (insErr) throw insErr;
    }
  };

  const toggleUserCompany = (userId: string, companyId: string) => {
    setUserCompanies((prev) => {
      const userSet = new Set(prev[userId] ?? []);
      if (userSet.has(companyId)) userSet.delete(companyId);
      else userSet.add(companyId);
      return { ...prev, [userId]: userSet };
    });
  };

  const toggleModalCompany = (companyId: string) => {
    setModalCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const savePermissions = async (userId: string) => {
    setSavingPermsFor(userId);
    try {
      const userSet = perms[userId] ?? new Set();
      await persistPermissions(userId, userSet);
      const companySet = resolveCompanySetForUser(
        users.find((u) => u.id === userId)?.position ?? '',
        userCompanies[userId] ?? new Set(),
        companies
      );
      await persistUserCompanies(userId, companySet);
      if (userHasFinanceAccess(userSet) && (userCompanies[userId]?.size ?? 0) === 0) {
        toast({
          title: 'Permissions enregistrées',
          description:
            'Attention : cet utilisateur a accès Finance mais aucune société assignée. Il ne pourra pas ouvrir le module Finance.',
        });
      } else {
        toast({ title: 'Permissions et sociétés enregistrées' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setSavingPermsFor(null);
    }
  };

  const openModal = (user?: ManagedUser) => {
    if (user) {
      setEditingUser(user);
      setEmail(user.email);
      setFullName(user.full_name ?? '');
      setPosition(user.position || 'Operateur');
      setRole(user.role);
      setPassword('');
      setMobilePhone('');
      setMobileCin('');
      setModalPerms(new Set(perms[user.id] ?? []));
      setModalCompanies(new Set(userCompanies[user.id] ?? []));
      if (isChauffeurPoste(user.position)) {
        setModalPerms(new Set());
        setModalCompanies(new Set());
      } else if (posteHasAllFinanceCompanies(user.position)) {
        setModalCompanies(allCompanyIdSet(companies));
      }
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setFullName('');
      setMobilePhone('');
      setMobileCin('');
      setModalPerms(new Set());
      setModalCompanies(new Set());
      if (activeTab === 'admins') {
        setRole('admin');
        setPosition('Responsable administrative');
      } else if (activeTab === 'drivers') {
        setRole('user');
        setPosition('Chauffeur');
      } else {
        setRole('user');
        setPosition('Responsable commerciale');
      }
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
    setMobilePhone('');
    setMobileCin('');
    setModalPerms(new Set());
    setModalCompanies(new Set());
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
        if (isDriverPosition(position) && !email.trim()) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: "L'email de connexion mobile est requis pour un chauffeur / opérateur",
          });
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

        if (targetUserId && isDriverPosition(position)) {
          const { prenom, nom } = splitFullName(fullName);
          const { error: empErr } = await supabase.from('employees').insert({
            prenom,
            nom,
            email: email.trim(),
            phone: mobilePhone.trim() || null,
            cin: mobileCin.trim() || null,
            role: position,
            user_id: targetUserId,
          } as never);
          if (empErr) {
            console.warn('[PermissionsManager] employees insert:', empErr.message);
            toast({
              title: 'Compte créé',
              description:
                "Le compte a été créé mais l'enregistrement employé RH n'a pas pu être ajouté. Vérifiez la liste employés.",
            });
          }
        }
      }

      if (targetUserId && role !== 'admin') {
        const permSet = isChauffeurPoste(position) ? new Set<string>() : modalPerms;
        const companySet = resolveCompanySetForUser(position, modalCompanies, companies);
        await persistPermissions(targetUserId, permSet);
        await persistUserCompanies(targetUserId, companySet);
      }

      const createdOrUpdated: ManagedUser = editingUser
        ? { ...editingUser, full_name: fullName, position, role }
        : {
            id: targetUserId!,
            email,
            full_name: fullName,
            position,
            role,
            created_at: new Date().toISOString(),
          };

      if (!editingUser && targetUserId) {
        setUsers((prev) => {
          if (prev.some((u) => u.id === targetUserId)) return prev;
          return [...prev, createdOrUpdated];
        });
        setActiveTab(tabForUser(createdOrUpdated));
      }

      toast({
        title: editingUser ? 'Utilisateur modifié' : 'Utilisateur créé',
        description: editingUser
          ? isChauffeurPoste(position)
            ? 'Compte chauffeur mis à jour (application mobile uniquement).'
            : 'Informations et permissions mises à jour'
          : isChauffeurPoste(position)
            ? `Compte mobile ${email} créé — aucun accès ERP.`
            : `Le compte ${email} a été créé — visible dans l'onglet ${
                tabForUser(createdOrUpdated) === 'admins'
                  ? 'Administrateurs'
                  : tabForUser(createdOrUpdated) === 'drivers'
                    ? 'Chauffeurs'
                    : 'Utilisateurs'
              }`,
      });

      closeModal();
      await load();
      if (!editingUser && targetUserId) {
        setActiveTab(tabForUser(createdOrUpdated));
      }
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
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <Shield className="w-3 h-3" /> Modérateur
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        Utilisateur
      </span>
    );
  };

  const filteredUsers = users.filter((u) => tabForUser(u) === activeTab);

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
              </p>
            </div>
          </div>
          <Button onClick={() => openModal()}>
            <UserPlus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Règles d&apos;accès multi-sociétés
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Toutes les données</strong> (clients, fournisseurs, stock, véhicules, employés, documents,
              finance) sont <strong>isolées par société</strong>. Assignez à chaque utilisateur la ou les sociétés
              auxquelles il doit accéder — c&apos;est <strong>obligatoire</strong> pour qu&apos;il voie des données.
            </li>
            <li>
              Les utilisateurs sans société assignée reçoivent <strong>Grosafe Equipements</strong> par défaut.
              Directeur Général, Responsable financier et Responsable administrative reçoivent{' '}
              <strong>toutes les sociétés</strong> automatiquement.
            </li>
            <li>
              Un utilisateur avec <strong>plusieurs sociétés</strong> voit un sélecteur de société dans l&apos;en-tête
              et bascule de l&apos;une à l&apos;autre à tout moment.
            </li>
          </ul>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'admins' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Administrateurs ({users.filter((u) => tabForUser(u) === 'admins').length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Utilisateurs ({users.filter((u) => tabForUser(u) === 'users').length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'drivers' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chauffeurs ({users.filter((u) => tabForUser(u) === 'drivers').length})
          </button>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun utilisateur trouvé dans cette section</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((u) => {
              const isAdminUser = u.role === 'admin';
              const userSet = perms[u.id] ?? new Set<string>();
              const isExpanded = !!expandedUsers[u.id];
              return (
                <div key={u.id} className="border border-border rounded-xl p-4">
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
                      {!isChauffeurPoste(u.position) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleExpandedUser(u.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                        {isExpanded ? 'Masquer permissions' : 'Afficher permissions'}
                      </Button>
                      )}
                      {!isAdminUser && !isChauffeurPoste(u.position) && isExpanded && (
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
                      )}
                      <button
                        onClick={() => openModal(u)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isChauffeurPoste(u.position) && (
                    <p className="mt-3 text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
                      Compte application mobile uniquement — aucun accès aux modules ERP.
                    </p>
                  )}

                  {isExpanded && !isChauffeurPoste(u.position) && (isAdminUser ? (
                    <div className="mt-4 space-y-3">
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
                        Cet administrateur a accès à toutes les sections et sous-sections par défaut.
                      </div>
                      <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-primary" />
                          Sociétés
                        </p>
                        Accès à toutes les sociétés (Grosafe, Granisafe, Safe-Team) — géré automatiquement pour les administrateurs.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                          onCheckedChange={() => toggleSubsection(u.id, section.id, sub.id)}
                                        />
                                        <span>{sub.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                        <div>
                          <p className="font-medium text-sm text-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            Sociétés accessibles
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Détermine quelles sociétés l&apos;utilisateur peut consulter dans <strong>tout l&apos;ERP</strong>
                            {' '}(clients, fournisseurs, stock, véhicules, employés, documents, finance).
                          </p>
                        </div>
                        {companies.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Aucune société disponible.</p>
                        ) : posteHasAllFinanceCompanies(u.position) ? (
                          <p className="text-sm text-foreground">
                            Toutes les sociétés ({companies.map((c) => c.name).join(', ')}) — assignation
                            automatique pour ce poste.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {companies.map((c) => {
                              const companySet = userCompanies[u.id] ?? new Set<string>();
                              const checked = companySet.has(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border bg-background px-3 py-2 hover:bg-muted/50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleUserCompany(u.id, c.id)}
                                  />
                                  <span>{c.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {userHasFinanceAccess(userSet) &&
                          !posteHasAllFinanceCompanies(u.position) &&
                          (userCompanies[u.id]?.size ?? 0) === 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Cet utilisateur a accès Finance mais aucune société n&apos;est assignée — il ne pourra pas ouvrir le module.
                          </p>
                        )}
                      </div>
                    </>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe {editingUser ? '(laisser vide)' : '*'}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Poste</Label>
                  <Select value={isKnownPosition(position) ? position : position ? `__legacy__${position}` : 'Operateur'} onValueChange={(v) => {
                    const next = v.startsWith('__legacy__') ? v.slice('__legacy__'.length) : v;
                    setPosition(next);
                    if (isChauffeurPoste(next)) {
                      setModalPerms(new Set());
                      setModalCompanies(new Set());
                    } else if (posteHasAllFinanceCompanies(next)) {
                      setModalCompanies(allCompanyIdSet(companies));
                    }
                  }}>
                    <SelectTrigger id="position"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {position && !isKnownPosition(position) && (
                        <SelectItem value={`__legacy__${position}`}>
                          {position} (valeur actuelle)
                        </SelectItem>
                      )}
                      {POSITION_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="moderator">Modérateur</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!editingUser && isDriverPosition(position) && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Shield className="w-4 h-4" />
                    Accès Mobile App
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Identifiants pour l&apos;application mobile Flutter (chauffeur / opérateur). L&apos;email ci-dessus sert de connexion.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3" /> Email de connexion *
                      </Label>
                      <p className="text-sm text-foreground font-medium truncate">
                        {email || "— renseignez l'email du compte ci-dessus —"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Utilisez le mot de passe du formulaire ci-dessus pour l&apos;app mobile.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile-phone">Téléphone</Label>
                      <Input
                        id="mobile-phone"
                        placeholder="55 123 456"
                        value={mobilePhone}
                        onChange={(e) => setMobilePhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile-cin">CIN</Label>
                      <Input
                        id="mobile-cin"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="8 chiffres"
                        value={mobileCin}
                        onChange={(e) => setMobileCin(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {role !== 'admin' && !isChauffeurPoste(position) && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Permissions d'accès</Label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setModalPerms(new Set(buildAllPermissionKeys()))}>
                        Tout accorder
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setModalPerms(new Set())}>
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
                            <span className="font-medium text-sm">{section.label}</span>
                          </label>
                          {section.subsections.length > 0 && (
                            <div className={`pl-6 space-y-1.5 ${fullGranted ? 'opacity-50 pointer-events-none' : ''}`}>
                              {section.subsections.map((sub) => {
                                const k = `${section.id}:${sub.id}`;
                                const checked = fullGranted || modalPerms.has(k);
                                return (
                                  <label key={sub.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox
                                      checked={checked}
                                      disabled={fullGranted}
                                      onCheckedChange={() => toggleModalSubsection(section.id, sub.id)}
                                    />
                                    <span>{sub.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {role !== 'admin' && !isChauffeurPoste(position) && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <div>
                    <Label className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Sociétés Finance
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Obligatoire si le module Finance est accordé. Ventes / Achats / Magasin = Grosafe uniquement.
                    </p>
                  </div>
                  {companies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune société disponible.</p>
                  ) : posteHasAllFinanceCompanies(position) ? (
                    <p className="text-sm text-foreground">
                      Toutes les sociétés ({companies.map((c) => c.name).join(', ')}) — ce poste reçoit un accès
                      multi-sociétés automatique à l&apos;enregistrement.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {companies.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <Checkbox
                            checked={modalCompanies.has(c.id)}
                            onCheckedChange={() => toggleModalCompany(c.id)}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {userHasFinanceAccess(modalPerms) &&
                    !posteHasAllFinanceCompanies(position) &&
                    modalCompanies.size === 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Accès Finance activé sans société — l&apos;utilisateur ne pourra pas ouvrir le module Finance.
                    </p>
                  )}
                </div>
              )}

              {isChauffeurPoste(position) && role !== 'admin' && (
                <div className="pt-4 border-t border-border rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Ce compte est réservé à l&apos;application mobile Flutter. Aucune permission ERP ni société Finance
                  n&apos;est assignée.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={closeModal}>Annuler</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : editingUser ? 'Enregistrer' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
