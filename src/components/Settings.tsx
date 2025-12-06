import { useRef } from 'react';
import { 
  Download, 
  Upload, 
  Database,
  AlertTriangle,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { exportDatabase, importDatabase } from '@/services/dbService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = () => {
    const data = exportDatabase();
    if (!data) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'exporter la base de données"
      });
      return;
    }

    const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grosafe_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Sauvegarde réussie",
      description: "La base de données a été exportée avec succès"
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      await importDatabase(data);
      
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
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearData = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer toutes les données? Cette action est irréversible!')) {
      localStorage.removeItem('grosafe_inventory_db');
      toast({
        title: "Données supprimées",
        description: "La base de données a été réinitialisée. La page va se recharger."
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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
                <Button onClick={handleExport} className="mt-4 bg-success hover:bg-success/90">
                  <Download className="w-4 h-4 mr-2" />
                  Exporter Base de Données
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
                  accept=".sqlite"
                  className="hidden"
                  onChange={handleImport}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  variant="outline"
                  className="mt-4"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importer Fichier
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
            <HardDrive className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Stockage Local</h3>
            <p className="text-sm text-muted-foreground">Informations sur le stockage des données</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Base de données SQLite stockée localement dans votre navigateur</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Fonctionne hors-ligne - aucune connexion internet requise</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-muted-foreground">Données persistantes entre les sessions</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card rounded-xl border border-destructive/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-destructive/10">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive">Zone Danger</h3>
            <p className="text-sm text-muted-foreground">Actions irréversibles</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <p className="text-sm text-muted-foreground mb-4">
            Cette action supprimera définitivement toutes les données de l'application. Assurez-vous d'avoir une sauvegarde avant de continuer.
          </p>
          <Button variant="destructive" onClick={handleClearData}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Réinitialiser Toutes les Données
          </Button>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">À Propos</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Application:</strong> Grosafe Gestion</p>
          <p><strong className="text-foreground">Version:</strong> 1.0.0</p>
          <p><strong className="text-foreground">Technologies:</strong> React, TypeScript, SQLite (sql.js), Tailwind CSS</p>
          <p><strong className="text-foreground">Mode:</strong> Application Web Hors-Ligne (PWA-ready)</p>
        </div>
      </div>
    </div>
  );
};
