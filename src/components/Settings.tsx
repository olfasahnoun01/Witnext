import { useRef, useState } from 'react';
import { Download, Upload, Database, Cloud, Info } from 'lucide-react';
import { exportDatabase, importDatabase } from '@/modules/inventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { APP_VERSION, BUILD_DATE_FORMATTED } from '@/lib/version';

export const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async (includeStorage: boolean) => {
    if (!isAdmin) return;

    if (includeStorage) {
      const confirmed = window.confirm(
        'Export COMPLET avec fichiers stockés (fiches techniques, etc.) ?\n\n' +
          'Cela télécharge tous les fichiers depuis Supabase Storage et consomme beaucoup de bande passante (egress).\n\n' +
          'Préférez « Exporter données (JSON) » pour une sauvegarde légère sans fichiers.'
      );
      if (!confirmed) return;
    }

    setIsExporting(true);
    try {
      const blob = await exportDatabase(
        (msg) => {
          console.log('Export:', msg);
        },
        { includeStorage }
      );
      if (!blob) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "Impossible d'exporter la base de données",
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grosafe_backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: includeStorage ? 'Sauvegarde complète réussie' : 'Sauvegarde données réussie',
        description: includeStorage
          ? 'Export ZIP avec fichiers stockés'
          : 'Export JSON uniquement (sans fichiers Storage — faible egress)',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    const confirmed = window.confirm(
      'Cette action remplace les données existantes par celles du fichier de sauvegarde. Continuer ?'
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    try {
      await importDatabase(file, (msg) => {
        console.log('Import:', msg);
      });

      toast({
        title: 'Restauration réussie',
        description: 'La base de données a été restaurée. La page va se recharger.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'importer la base de données",
      });
    } finally {
      setIsImporting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Paramètres</h2>
          <p className="text-sm text-muted-foreground">
            Sauvegarde, restauration et informations de l&apos;application
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-2.5">
                <Download className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Exporter (Sauvegarde)</CardTitle>
                <CardDescription className="mt-1">
                  Export ZIP avec métadonnées JSON. Sans fichiers Storage par défaut.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Inclut inventaire, galerie, finance, RH, commercial et flotte. L&apos;export avec
              fichiers télécharge tout le bucket fiches-techniques (forte consommation egress).
            </p>
            {!isAdmin ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Réservé aux administrateurs.
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => void handleExport(false)}
                disabled={isExporting || !isAdmin}
                className="w-full bg-success hover:bg-success/90"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exportation…' : 'Exporter données (JSON)'}
              </Button>
              <Button
                onClick={() => void handleExport(true)}
                disabled={isExporting || !isAdmin}
                variant="outline"
                className="w-full border-amber-500/50 text-amber-800 dark:text-amber-300"
              >
                <Cloud className="mr-2 h-4 w-4" />
                Export + fichiers Storage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Importer (Restaurer)</CardTitle>
                <CardDescription className="mt-1">
                  Restaurez vos données à partir d&apos;un fichier de sauvegarde.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Formats acceptés : ZIP ou JSON. Cette action remplace les données existantes.
            </p>
            {!isAdmin ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Réservé aux administrateurs.
              </p>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isImporting || !isAdmin}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? 'Importation…' : 'Importer un fichier'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2.5">
              <Info className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">À propos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Application</dt>
              <dd className="font-medium text-foreground">Witnext</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium text-foreground">{APP_VERSION}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dernière mise à jour</dt>
              <dd className="font-medium text-foreground">{BUILD_DATE_FORMATTED}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="font-medium text-foreground">Application Cloud Haute Disponibilité</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Technologies</dt>
              <dd className="font-medium text-foreground">React, TypeScript, PostgreSQL</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">©</dt>
              <dd className="font-medium text-foreground">2026 Witnext</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
};
