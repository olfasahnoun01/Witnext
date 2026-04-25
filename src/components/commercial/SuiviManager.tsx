import { useState, useMemo, useCallback } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  FileText,
  History,
  MoreHorizontal,
  ChevronRight,
  UserCheck,
  Building2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SuiviEntry {
  id: string;
  date: string;
  numOffre: string;
  entityName: string; // Client or Fournisseur name
  charge: string;
  visAVis: string;
  notes: string;
}

interface SuiviManagerProps {
  type: 'client' | 'fournisseur';
}

export const SuiviManager = ({ type }: SuiviManagerProps) => {
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  
  // Dummy data
  const [entries, setEntries] = useState<SuiviEntry[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<SuiviEntry>>({
    date: new Date().toISOString().split('T')[0]
  });

  const handleAddSuivi = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: SuiviEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: formData.date || new Date().toISOString().split('T')[0],
      numOffre: formData.numOffre || '',
      entityName: formData.entityName || '',
      charge: user?.email || 'Unknown',
      visAVis: formData.visAVis || '',
      notes: formData.notes || ''
    };

    setEntries([newEntry, ...entries]);
    setDialogOpen(false);
    setFormData({ date: new Date().toISOString().split('T')[0] });
    toast.success('Suivi ajouté avec succès');
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => 
      Object.values(entry).some(val => 
        val.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [entries, searchQuery]);

  // Group by entity for admin view
  const groupedByEntity = useMemo(() => {
    const groups: Record<string, SuiviEntry[]> = {};
    entries.forEach(entry => {
      if (!groups[entry.entityName]) groups[entry.entityName] = [];
      groups[entry.entityName].push(entry);
    });
    return groups;
  }, [entries]);

  const entityList = Object.keys(groupedByEntity);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Suivi {type === 'client' ? 'Clients' : 'Fournisseurs'}
          </h1>
          <p className="text-muted-foreground">
            Historique des interactions et suivi des offres {type === 'client' ? 'commerciales' : 'fournisseurs'}.
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg transition-all duration-300">
              <Plus className="w-4 h-4" />
              Nouveau Suivi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Ajouter un Suivi</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSuivi} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entityName">{type === 'client' ? 'Client' : 'Fournisseur'}</Label>
                <Input 
                  id="entityName" 
                  placeholder={type === 'client' ? "Nom du client" : "Nom du fournisseur"} 
                  value={formData.entityName || ''}
                  onChange={e => setFormData({...formData, entityName: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={formData.date || ''}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numOffre">N° Offre</Label>
                  <Input 
                    id="numOffre" 
                    placeholder="Ex: OFF-001" 
                    value={formData.numOffre || ''}
                    onChange={e => setFormData({...formData, numOffre: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visAVis">Vis à vis</Label>
                <Input 
                  id="visAVis" 
                  placeholder="Personne contactée" 
                  value={formData.visAVis || ''}
                  onChange={e => setFormData({...formData, visAVis: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Actions</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Détails de l'échange..." 
                  className="min-h-[100px]"
                  value={formData.notes || ''}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button type="submit">Enregistrer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar for Admin Selection */}
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4" />
                Séléction {type === 'client' ? 'Client' : 'Fournisseur'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {entityList.map(entity => (
                <button
                  key={entity}
                  onClick={() => setSelectedEntity(entity === selectedEntity ? null : entity)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                    selectedEntity === entity 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "hover:bg-muted"
                  )}
                >
                  <span className="truncate">{entity}</span>
                  <Badge variant={selectedEntity === entity ? "secondary" : "outline"} className="ml-2">
                    {groupedByEntity[entity].length}
                  </Badge>
                </button>
              ))}
              {entityList.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 italic">Aucune donnée</p>
              )}
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <Card className="md:col-span-3 overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {selectedEntity ? (
                    <>
                      <UserCheck className="w-5 h-5 text-primary" />
                      Historique : {selectedEntity}
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 text-primary" />
                      Tous les Suivis
                    </>
                  )}
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrer..." 
                    className="pl-9 h-8 text-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">N° Offre</TableHead>
                      {!selectedEntity && <TableHead className="font-bold">{type === 'client' ? 'Client' : 'Fournisseur'}</TableHead>}
                      <TableHead className="font-bold">Chargé</TableHead>
                      <TableHead className="font-bold">Vis à vis</TableHead>
                      <TableHead className="font-bold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedEntity ? groupedByEntity[selectedEntity] : filteredEntries).map((entry) => (
                      <TableRow key={entry.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="text-xs whitespace-nowrap">{entry.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">{entry.numOffre}</Badge>
                        </TableCell>
                        {!selectedEntity && (
                          <TableCell className="font-medium">{entry.entityName}</TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">{entry.charge}</TableCell>
                        <TableCell className="text-xs font-semibold">{entry.visAVis}</TableCell>
                        <TableCell className="text-xs italic text-muted-foreground max-w-[250px] truncate" title={entry.notes}>
                          {entry.notes}
                        </TableCell>

                      </TableRow>
                    ))}
                    {(!selectedEntity && filteredEntries.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                          Aucun suivi trouvé.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Mes Suivis Récents
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher..." 
                  className="pl-9 h-8 text-xs"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">N° Offre</TableHead>
                    <TableHead className="font-bold">{type === 'client' ? 'Client' : 'Fournisseur'}</TableHead>
                    <TableHead className="font-bold">Chargé</TableHead>
                    <TableHead className="font-bold">Vis à vis</TableHead>
                    <TableHead className="font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs">{entry.date}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.numOffre}</TableCell>
                      <TableCell className="font-medium">{entry.entityName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.charge}</TableCell>
                      <TableCell className="text-xs">{entry.visAVis}</TableCell>
                      <TableCell className="text-xs text-muted-foreground italic">{entry.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
