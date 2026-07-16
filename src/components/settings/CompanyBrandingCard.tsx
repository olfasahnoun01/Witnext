import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  removeCompanyLogo,
  updateCompanyBranding,
  uploadCompanyLogo,
} from '@/lib/companyBrandingService';
import { getFinanceCompanyLogo } from '@/modules/finance/lib/companyLogos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CompanyBrandingCard() {
  const { isAdmin } = useAuth();
  const { currentCompany, reload } = useAppCompany();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [telFax, setTelFax] = useState('');
  const [rib, setRib] = useState('');
  const [codeTva, setCodeTva] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e2124');
  const [headerColor, setHeaderColor] = useState('#e6e6e6');
  const [tableColor, setTableColor] = useState('#ebebeb');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const syncFromCompany = useCallback(() => {
    if (!currentCompany) return;
    setLegalName(currentCompany.legal_name ?? '');
    setAddress(currentCompany.address ?? '');
    setTelFax(currentCompany.tel_fax ?? '');
    setRib(currentCompany.rib ?? '');
    setCodeTva(currentCompany.code_tva ?? '');
    setPrimaryColor(currentCompany.brand_primary_color ?? '#1e2124');
    setHeaderColor(currentCompany.brand_header_color ?? '#e6e6e6');
    setTableColor(currentCompany.brand_table_color ?? '#ebebeb');
    setLogoUrl(
      currentCompany.logo_url ??
        getFinanceCompanyLogo(currentCompany.code) ??
        null
    );
  }, [currentCompany]);

  useEffect(() => {
    syncFromCompany();
  }, [syncFromCompany]);

  if (!currentCompany) return null;

  const previewLogo =
    logoUrl ?? getFinanceCompanyLogo(currentCompany.code) ?? null;

  const handleSave = async () => {
    if (!isAdmin || !currentCompany) return;
    setSaving(true);
    try {
      await updateCompanyBranding(currentCompany.id, {
        legal_name: legalName,
        address,
        tel_fax: telFax,
        rib,
        code_tva: codeTva,
        brand_primary_color: primaryColor,
        brand_header_color: headerColor,
        brand_table_color: tableColor,
        logo_url: logoUrl,
      });
      await reload();
      toast({
        title: 'Identité enregistrée',
        description: 'Vos factures utiliseront cette identité visuelle.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Enregistrement impossible',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin || !currentCompany) return;
    setUploading(true);
    try {
      const url = await uploadCompanyLogo(currentCompany.id, file);
      setLogoUrl(url);
      await reload();
      toast({ title: 'Logo mis à jour' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload impossible',
        description: err instanceof Error ? err.message : 'Réessayez avec un autre fichier',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!isAdmin || !currentCompany) return;
    if (!window.confirm('Supprimer le logo de cette société ?')) return;
    setUploading(true);
    try {
      await removeCompanyLogo(currentCompany.id);
      setLogoUrl(null);
      await reload();
      toast({ title: 'Logo supprimé' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Suppression impossible',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Identité sur les factures</CardTitle>
            <CardDescription>
              Logo et coordonnées imprimés sur vos factures — société active :{' '}
              <span className="font-medium text-foreground">{currentCompany.name}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAdmin ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Réservé aux administrateurs.
          </p>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-28 w-40 shrink-0 items-center justify-center rounded-xl border bg-white p-3 shadow-sm">
            {previewLogo ? (
              <img
                src={previewLogo}
                alt={`Logo ${currentCompany.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              PNG, JPEG, WebP ou SVG — max. 2 Mo. Recommandé : fond transparent, format paysage.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoPick}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isAdmin || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Envoi…' : 'Choisir un logo'}
              </Button>
              {logoUrl && currentCompany.logo_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!isAdmin || uploading}
                  onClick={() => void handleRemoveLogo()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branding-legal-name">Raison sociale (factures)</Label>
            <Input
              id="branding-legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={currentCompany.name}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branding-address">Adresse</Label>
            <Textarea
              id="branding-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-tel">Tél / Fax</Label>
            <Input
              id="branding-tel"
              value={telFax}
              onChange={(e) => setTelFax(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-tva">Code TVA</Label>
            <Input
              id="branding-tva"
              value={codeTva}
              onChange={(e) => setCodeTva(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="branding-rib">RIB</Label>
            <Input
              id="branding-rib"
              value={rib}
              onChange={(e) => setRib(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-primary">Couleur accent</Label>
            <div className="flex gap-2">
              <Input
                id="branding-primary"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 cursor-pointer p-1"
                disabled={!isAdmin}
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="font-mono text-sm"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="branding-header">Couleur en-tête</Label>
            <div className="flex gap-2">
              <Input
                id="branding-header"
                type="color"
                value={headerColor}
                onChange={(e) => setHeaderColor(e.target.value)}
                className="h-10 w-14 cursor-pointer p-1"
                disabled={!isAdmin}
              />
              <Input
                value={headerColor}
                onChange={(e) => setHeaderColor(e.target.value)}
                className="font-mono text-sm"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </div>

        <Button onClick={() => void handleSave()} disabled={!isAdmin || saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            'Enregistrer l\'identité'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
