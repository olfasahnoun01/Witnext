import { useState, useCallback } from 'react';
import { UserPlus, Users, Trash2, Phone, CreditCard } from 'lucide-react';
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

interface Employee {
  id: string;
  prenom: string;
  nom: string;
  tel: string;
  cin: string;
}

export const EmployeeList = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ prenom: '', nom: '', tel: '', cin: '' });

  const handleSubmit = useCallback(() => {
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error('Le prénom et le nom sont obligatoires');
      return;
    }
    const newEmployee: Employee = {
      id: crypto.randomUUID(),
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      tel: form.tel.trim(),
      cin: form.cin.trim(),
    };
    setEmployees((prev) => [...prev, newEmployee]);
    setForm({ prenom: '', nom: '', tel: '', cin: '' });
    setIsDialogOpen(false);
    toast.success(`${newEmployee.prenom} ${newEmployee.nom} ajouté(e)`);
  }, [form]);

  const handleDelete = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    toast.success('Employé supprimé');
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
          onClick={() => setIsDialogOpen(true)}
          className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter Employé
        </Button>
      </div>

      {/* List */}
      {employees.length === 0 ? (
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
              {/* Avatar */}
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow">
                {emp.prenom.charAt(0).toUpperCase()}
                {emp.nom.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {emp.prenom} {emp.nom}
                </p>
                <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                  {emp.tel && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {emp.tel}
                    </span>
                  )}
                  {emp.cin && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {emp.cin}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(emp.id)}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Ajouter un Employé
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="emp-prenom">Prénom *</Label>
              <Input
                id="emp-prenom"
                placeholder="Prénom de l'employé"
                value={form.prenom}
                onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-nom">Nom *</Label>
              <Input
                id="emp-nom"
                placeholder="Nom de l'employé"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-tel">Numéro de Téléphone</Label>
              <Input
                id="emp-tel"
                placeholder="Ex: 55 123 456"
                value={form.tel}
                onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-cin">Numéro CIN</Label>
              <Input
                id="emp-cin"
                placeholder="Ex: 12345678"
                value={form.cin}
                onChange={(e) => setForm((f) => ({ ...f, cin: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="gap-2 rounded-xl">
              <UserPlus className="w-4 h-4" />
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
