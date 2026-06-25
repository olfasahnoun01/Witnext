import { UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuiviManager } from './SuiviManager';

export const SuiviPartiesHub = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-rose-500/10">
          <UserCheck className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Suivi client / fournisseur</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivis regroupés par société. Un suivi est créé automatiquement à chaque nouveau devis.
          </p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-11 p-1 bg-muted/60">
          <TabsTrigger
            value="clients"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Suivi clients
          </TabsTrigger>
          <TabsTrigger
            value="fournisseurs"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            Suivi fournisseurs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-4">
          <SuiviManager type="client" />
        </TabsContent>
        <TabsContent value="fournisseurs" className="mt-4">
          <SuiviManager type="fournisseur" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
