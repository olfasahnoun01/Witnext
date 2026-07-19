import { useCallback, useEffect, useState } from 'react';
import { Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatError } from '@/lib/formatError';
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_LENGTH_HINT,
  validatePasswordLength,
} from '@/lib/passwordPolicy';
import { MfaSettingsCard } from '@/components/auth/MfaSettingsCard';
import { AvatarUploadField } from '@/components/profile/AvatarUploadField';
import { fetchProfileAvatarUrl } from '@/lib/userAvatarService';

export default function MyProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const email = user?.email ?? '';
  const position =
    typeof user?.user_metadata?.position === 'string' ? user.user_metadata.position : undefined;
  const userId = user?.id;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      const row = data as { full_name?: string | null; avatar_url?: string | null } | null;
      setFullName((row?.full_name ?? '').trim());
      setAvatarUrl(row?.avatar_url ?? (await fetchProfileAvatarUrl(userId)));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: formatError(err) });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
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
      setNewPassword('');
      setConfirmPassword('');
      window.dispatchEvent(new CustomEvent('erp:profile-updated'));
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: formatError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!user || !userId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Connectez-vous pour accéder à votre profil.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in p-1">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mon profil</h1>
          <p className="text-sm text-muted-foreground">
            Personnalisez votre compte, photo et sécurité
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            Votre avatar s’affiche dans le menu compte. L’image est compressée et stockée hors base
            de données.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUploadField
            userId={userId}
            fullName={fullName}
            email={email}
            avatarUrl={avatarUrl}
            onAvatarChange={(url) => {
              setAvatarUrl(url);
              window.dispatchEvent(new CustomEvent('erp:profile-updated'));
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Nom affiché et identifiants de connexion</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
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

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
          <CardDescription>Authentification à deux facteurs</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSettingsCard />
        </CardContent>
      </Card>
    </div>
  );
}
