import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatError } from '@/lib/formatError';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_LENGTH_HINT,
  validatePasswordLength,
} from '@/lib/passwordPolicy';

interface MyProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
  initialFullName: string;
  position?: string;
  onProfileSaved?: (fullName: string) => void;
}

export const MyProfileDialog = ({
  open,
  onOpenChange,
  userId,
  email,
  initialFullName,
  position,
  onProfileSaved,
}: MyProfileDialogProps) => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(initialFullName);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(initialFullName);
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, initialFullName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Les mots de passe ne correspondent pas',
        });
        return;
      }
      if (!validatePasswordLength(newPassword)) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: PASSWORD_LENGTH_HINT,
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { data: existingAuth, error: getUserErr } = await supabase.auth.getUser();
      if (getUserErr || !existingAuth.user) {
        throw getUserErr ?? new Error('Session expirée');
      }

      const prevMeta = { ...(existingAuth.user.user_metadata || {}) };
      prevMeta.full_name = trimmedName;
      if (position) prevMeta.position = position;

      const authUpdate: { data?: { user_metadata: Record<string, unknown> }; password?: string } = {
        data: { user_metadata: prevMeta },
      };
      if (newPassword) authUpdate.password = newPassword;

      const { error: authErr } = await supabase.auth.updateUser(authUpdate);
      if (authErr) throw authErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: trimmedName || null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (profileErr) throw profileErr;

      toast({
        title: 'Profil mis à jour',
        description: newPassword
          ? 'Nom et mot de passe enregistrés'
          : 'Vos informations ont été enregistrées',
      });
      onProfileSaved?.(trimmedName);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: formatError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
          <DialogDescription>Modifiez vos informations personnelles</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" value={email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-full-name">Nom complet</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>

          {position ? (
            <div className="space-y-2">
              <Label htmlFor="profile-position">Poste</Label>
              <Input id="profile-position" value={position} disabled />
              <p className="text-xs text-muted-foreground">
                Le poste est modifié par un administrateur dans Gestion des Comptes.
              </p>
            </div>
          ) : null}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Changer le mot de passe</p>
            <div className="space-y-2">
              <Label htmlFor="profile-password">Nouveau mot de passe</Label>
              <Input
                id="profile-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                placeholder="Laisser vide pour ne pas changer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-password-confirm">Confirmer le mot de passe</Label>
              <Input
                id="profile-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">{PASSWORD_LENGTH_HINT}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
