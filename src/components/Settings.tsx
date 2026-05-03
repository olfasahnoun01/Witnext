import { useRef, useState } from 'react';
import { 
  Download, 
  Upload, 
  Database,
  CheckCircle2,
  Cloud
} from 'lucide-react';
import { exportDatabase, importDatabase } from '@/services/dbService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { APP_VERSION, BUILD_DATE_FORMATTED } from '@/lib/version';
import { supabase } from '@/integrations/supabase/client';


export const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);


  const handleExport = async () => {
    if (!isAdmin) return;
    setIsExporting(true);
    try {
      const blob = await exportDatabase((msg) => {
        console.log('Export:', msg);
      });
      if (!blob) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'exporter la base de données"
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
        title: "Sauvegarde réussie",
        description: "La base de données a été exportée avec succès (ZIP)"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setIsImporting(true);
    try {
      await importDatabase(file, (msg) => {
        console.log('Import:', msg);
      });
      
      toast({
        title: "Restauration réussie",
        description: "La base de données a été restaurée. La page va se recharger."
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'importer la base de données"
      });
    } finally {
      setIsImporting(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Gestion Base de Données</h2>
            <p className="text-sm text-muted-foreground">Sauvegardez et restaurez vos données</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export — admin only (RLS still applies; UI must not suggest any user can snapshot the org). */}
          <div className="p-6 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Download className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Exporter (Sauvegarde)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Téléchargez une copie de toutes vos données pour les conserver en sécurité.
                  {!isAdmin && (
                    <span className="block mt-2 text-amber-700 dark:text-amber-400">
                      Réservé aux administrateurs.
                    </span>
                  )}
                </p>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting || !isAdmin}
                  className="mt-4 bg-success hover:bg-success/90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? 'Exportation...' : 'Exporter Base de Données'}
                </Button>
              </div>
            </div>
          </div>

          {/* Import — admin only */}
          <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Importer (Restaurer)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Restaurez vos données à partir d'un fichier de sauvegarde.
                  {!isAdmin && (
                    <span className="block mt-2 text-amber-700 dark:text-amber-400">
                      Réservé aux administrateurs.
                    </span>
                  )}
                </p>
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
                  className="mt-4"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isImporting ? 'Importation...' : 'Importer Fichier'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>




      {/* App Info */}
      <div className="bg-card rounded-xl border border-border p-6 bg-gradient-to-br from-card to-primary/5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          À Propos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2 text-muted-foreground">
            <p><strong className="text-foreground">Application:</strong> Alpha</p>
            <p><strong className="text-foreground">Version:</strong> {APP_VERSION}</p>
            <p><strong className="text-foreground">Dernière mise à jour:</strong> {BUILD_DATE_FORMATTED}</p>
          </div>
          <div className="space-y-2 text-muted-foreground">
            <p><strong className="text-foreground">Technologies:</strong> React, TypeScript, PostgreSQL</p>
            <p><strong className="text-foreground">Mode:</strong> Application Cloud Haute Disponibilité</p>
            <p>© 2026 Grosafe Équipement</p>
          </div>
        </div>
      </div>
    </div>
  );
};
