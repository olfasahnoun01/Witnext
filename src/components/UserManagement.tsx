import { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  X,
  Loader2,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: 'admin' | 'moderator' | 'user';
}

export const UserManagement = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'moderator' | 'user'>('user');

  useEffect(() => {
    loadUsers();
  }, []);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('DEBUG: User token project ref:', payload.ref);
        } catch (e) {
          console.log('DEBUG: Could not decode token');
        }
      }

      console.log('Attempting to call manage-users function...', { hasToken: !!token });
      
      if (!token) {
        throw new Error('Aucune session active trouvée. Veuillez vous reconnecter.');
      }

      const response = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setUsers(response.data.users || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de charger les utilisateurs'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (user?: ManagedUser) => {
    if (user) {
      setEditingUser(user);
      setEmail(user.email);
      setFullName(user.full_name);
      setRole(user.role);
      setPassword('');
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('user');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = await getAuthToken();

      if (editingUser) {
        // Update user
        const response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update',
            user_id: editingUser.id,
            full_name: fullName,
            role,
            ...(password ? { password } : {})
          },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        toast({
          title: 'Utilisateur modifié',
          description: 'Les informations ont été mises à jour'
        });
      } else {
        // Create user
        if (!password) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Le mot de passe est requis'
          });
          return;
        }

        const response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create',
            email,
            password,
            full_name: fullName,
            role
          },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        if (response.data.error) {
          throw new Error(response.data.error);
        }

        toast({
          title: 'Utilisateur créé',
          description: `Le compte pour ${email} a été créé`
        });
      }

      closeModal();
      loadUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.email}" ?`)) {
      return;
    }

    try {
      const token = await getAuthToken();
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          user_id: user.id
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Utilisateur supprimé',
        description: `Le compte de ${user.email} a été supprimé`
      });

      loadUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer l\'utilisateur'
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        );
      case 'moderator':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
            <Shield className="w-3 h-3" />
            Modérateur
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Utilisateur
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
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
              <h2 className="text-xl font-semibold text-foreground">Utilisateurs & rôles</h2>
              <p className="text-sm text-muted-foreground">Ajouter, modifier ou supprimer des utilisateurs depuis la gestion des permissions</p>
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
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-foreground">{user.email}</p>
                    {getRoleBadge(user.role)}
                  </div>
                  {user.full_name && (
                    <p className="text-sm text-muted-foreground mt-1">{user.full_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(user)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
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
                <Label htmlFor="role">Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
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

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    editingUser ? 'Enregistrer' : 'Créer'
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
