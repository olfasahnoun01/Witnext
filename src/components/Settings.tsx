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
import { UserManagement } from './UserManagement';
import { APP_VERSION, BUILD_DATE_FORMATTED } from '@/lib/version';

export const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
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
    if (!file) return;

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
      {/* User Management - Admin Only */}
      {isAdmin && <UserManagement />}

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
          {/* Export */}
          <div className="p-6 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <Download className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Exporter (Sauvegarde)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Téléchargez une copie de toutes vos données pour les conserver en sécurité.
                </p>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className="mt-4 bg-success hover:bg-success/90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? 'Exportation...' : 'Exporter Base de Données'}
                </Button>
              </div>
            </div>
          </div>

          {/* Import */}
          <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Importer (Restaurer)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Restaurez vos données à partir d'un fichier de sauvegarde.
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
                  disabled={isImporting}
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

      {/* Storage Info */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-muted">
            <Cloud className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Base de Données PostgreSQL</h3>
            <p className="text-sm text-muted-foreground">Vos données sont stockées dans le cloud</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Base de données PostgreSQL hébergée sur serveur</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Données synchronisées en temps réel</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Accessible depuis n'importe quel appareil</span>
          </div>
        </div>
      </div>


      {/* App Info */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">À Propos</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Application:</strong> Grosafe Gestion</p>
          <p><strong className="text-foreground">Version:</strong> {APP_VERSION}</p>
          <p><strong className="text-foreground">Dernière mise à jour:</strong> {BUILD_DATE_FORMATTED}</p>
          <p><strong className="text-foreground">Technologies:</strong> React, TypeScript, PostgreSQL, Tailwind CSS</p>
          <p><strong className="text-foreground">Mode:</strong> Application Web avec Base de Données Cloud</p>
        </div>
      </div>
    </div>
  );
};
