import { useState, useCallback, useEffect, useRef } from 'react';
import { UserPlus, Users, Trash2, Phone, CreditCard, Shield, Mail, Lock, Loader2, Edit2, IdCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Employee {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  phone?: string;
  role?: string;
  user_id?: string;
  cin?: string;
}

export const EmployeeList = () => {
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    prenom: '', 
    nom: '', 
    phone: '', 
    cin: '',
    poste: 'Ouvrier',
    email: '',
    password: ''
  });

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      toast.error('Erreur lors du chargement des employés');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;

    const timeoutId = window.setTimeout(() => {
      firstInputRef.current?.focus();
      firstInputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [isDialogOpen]);

  const handleSubmit = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error('Le prénom et le nom sont obligatoires');
      return;
    }

    const isChauffeur = form.poste === 'Chauffeur' || form.poste === 'Operateur';
    if (isChauffeur && (!form.email || !form.password)) {
      toast.error('L\'email et le mot de passe sont requis pour un Chauffeur');
      return;
    }

    setIsSubmitting(true);
    try {
      let userId = null;

      // 1. Create Auth User if Chauffeur/Operateur
      if (isChauffeur) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create',
            email: form.email,
            password: form.password,
            full_name: `${form.prenom} ${form.nom}`,
            role: 'user' // Default to user role, permissions managed in account tab
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (response.error || response.data?.error) {
          throw new Error(response.error?.message || response.data?.error);
        }

        userId = response.data.user?.id || response.data.user_id;
      }

      // 2. Create or Update Employee Record
      if (isEditing && editingId) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({
            prenom: form.prenom.trim(),
            nom: form.nom.trim(),
            phone: form.phone.trim() || null,
            cin: form.cin.trim() || null,
            role: form.poste
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
        toast.success(`${form.prenom} ${form.nom} mis à jour`);
      } else {
        const { error: insertError } = await supabase
          .from('employees')
          .insert([{
            prenom: form.prenom.trim(),
            nom: form.nom.trim(),
            phone: form.phone.trim() || null,
            cin: form.cin.trim() || null,
            email: isChauffeur ? form.email.trim() : null,
            role: form.poste,
            user_id: userId
          }]);

        if (insertError) throw insertError;
        toast.success(`${form.prenom} ${form.nom} ajouté(e)`);
      }

      setForm({ prenom: '', nom: '', phone: '', cin: '', poste: 'Ouvrier', email: '', password: '' });
      setIsDialogOpen(false);
      setIsEditing(false);
      setEditingId(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde de l\'employé');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (emp: Employee) => {
    setForm({
      prenom: emp.prenom,
      nom: emp.nom,
      phone: emp.phone || '',
      cin: emp.cin || '',
      poste: emp.role || 'Ouvrier',
      email: emp.email || '',
      password: ''
    });
    setEditingId(emp.id);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEmployees(employees.filter((e) => e.id !== id));
      toast.success('Employé supprimé');
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Liste des Employés</h2>
            <p className="text-sm text-muted-foreground">
              {employees.length} employé{employees.length !== 1 ? 's' : ''} enregistré{employees.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setIsEditing(false);
            setEditingId(null);
            setForm({ prenom: '', nom: '', phone: '', cin: '', poste: 'Ouvrier', email: '', password: '' });
            setIsDialogOpen(true);
          }}
          className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter Employé
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
          <div className="p-5 rounded-2xl bg-primary/10 mb-4">
            <Users className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucun employé</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            Cliquez sur « Ajouter Employé » pour commencer à enregistrer les membres de l'équipe.
          </p>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="gap-2 rounded-xl">
            <UserPlus className="w-4 h-4" />
            Ajouter un employé
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {employees.map((emp, idx) => (
            <div
              key={emp.id}
              className="group flex items-center gap-4 p-4 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow">
                {emp.prenom.charAt(0).toUpperCase()}
                {emp.nom.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">
                    {emp.prenom} {emp.nom}
                  </p>
                  {emp.role && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      {emp.role}
                    </span>
                  )}
                  {emp.user_id && (
                    <span className="p-1 rounded-full bg-emerald-100 text-emerald-600" title="Compte mobile actif">
                      <Shield className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                  {emp.cin && (
                    <span className="flex items-center gap-1">
                      <IdCard className="w-3 h-3" />
                      CIN: {emp.cin}
                    </span>
                  )}
                  {emp.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {emp.phone}
                    </span>
                  )}
                  {emp.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {emp.email}
                    </span>
                  )}
                </div>
              </div>

              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                <button
                  onClick={() => handleEdit(emp)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {isEditing ? 'Modifier Employé' : 'Ajouter un Employé'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="emp-prenom">Prénom *</Label>
                <Input
                  id="emp-prenom"
                  ref={firstInputRef}
                  placeholder="Prénom"
                  value={form.prenom}
                  onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-nom">Nom *</Label>
                <Input
                  id="emp-nom"
                  placeholder="Nom"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="emp-poste">Poste / Fonction *</Label>
              <Select value={form.poste} onValueChange={(v) => setForm(f => ({ ...f, poste: v }))}>
                <SelectTrigger id="emp-poste">
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ouvrier">Ouvrier</SelectItem>
                  <SelectItem value="Chauffeur">Chauffeur (Accès Mobile)</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="RH">Ressources Humaines (RH)</SelectItem>
                  <SelectItem value="Magasin">Magasin</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Informatique">Informatique</SelectItem>
                  <SelectItem value="Direction">Direction</SelectItem>
                  <SelectItem value="Achat">Achat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isEditing && (form.poste === 'Chauffeur' || form.poste === 'Operateur') && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  Accès Mobile App
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-email" className="flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Email de connexion *
                  </Label>
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="email@grosafe.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emp-password" className="flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Mot de passe *
                  </Label>
                  <Input
                    id="emp-password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="emp-phone">Téléphone</Label>
                <Input
                  id="emp-phone"
                  placeholder="55 123 456"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-cin">CIN</Label>
                <Input
                  id="emp-cin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Numéro CIN (8 chiffres)"
                  value={form.cin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setForm((f) => ({ ...f, cin: val }));
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl" disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="gap-2 rounded-xl" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {isEditing ? 'Enregistrer' : 'Ajouter'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
