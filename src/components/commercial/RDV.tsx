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
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  FileCheck,
  FileX,
  MoreHorizontal,
  Download,
  Filter
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface RDV {
  id: string;
  numero: string;
  dateCreation: string;
  societe: string;
  activite: string;
  adresse: string;
  telephone: string;
  email: string;
  personneContactee: string;
  dateRDV: string;
  notes: string;
  besoin: string;
  pieceJointe: 'envoyé' | 'non envoyé';
  charge: string;
}

export const RDV = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [rdvs, setRdvs] = useState<RDV[]>([
    {
      id: '1',
      numero: 'RDV-001',
      dateCreation: '2024-03-20',
      societe: 'TechPro Solutions',
      activite: 'Informatique',
      adresse: 'Zone Industrielle, Tunis',
      telephone: '+216 71 000 000',
      email: 'contact@techpro.tn',
      personneContactee: 'M. Ahmed Ben Ali',
      dateRDV: '2024-03-25',
      notes: 'Premier contact pour renouvellement parc auto',
      besoin: '5 utilitaires légers',
      pieceJointe: 'envoyé',
      charge: 'commercial@grosafe.tn'
    },
    {
      id: '2',
      numero: 'RDV-002',
      dateCreation: '2024-03-21',
      societe: 'Global Logistics',
      activite: 'Transport',
      adresse: 'Port de Radès',
      telephone: '+216 71 111 111',
      email: 'info@globallog.com',
      personneContactee: 'Mme. Sarah Mansour',
      dateRDV: '2024-03-27',
      notes: 'Nouveau client potentiel',
      besoin: 'Maintenance flotte complète',
      pieceJointe: 'non envoyé',
      charge: 'commercial@grosafe.tn'
    }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<RDV>>({
    pieceJointe: 'non envoyé',
    dateCreation: new Date().toISOString().split('T')[0]
  });

  const handleAddRDV = (e: React.FormEvent) => {
    e.preventDefault();
    const newRDV: RDV = {
      id: Math.random().toString(36).substr(2, 9),
      numero: `RDV-${(rdvs.length + 1).toString().padStart(3, '0')}`,
      dateCreation: formData.dateCreation || new Date().toISOString().split('T')[0],
      societe: formData.societe || '',
      activite: formData.activite || '',
      adresse: formData.adresse || '',
      telephone: formData.telephone || '',
      email: formData.email || '',
      personneContactee: formData.personneContactee || '',
      dateRDV: formData.dateRDV || '',
      notes: formData.notes || '',
      besoin: formData.besoin || '',
      pieceJointe: formData.pieceJointe as 'envoyé' | 'non envoyé',
      charge: user?.email || 'Unknown'
    };

    setRdvs([newRDV, ...rdvs]);
    setDialogOpen(false);
    setFormData({ pieceJointe: 'non envoyé', dateCreation: new Date().toISOString().split('T')[0] });
    toast.success('Rendez-vous ajouté avec succès');
  };

  const filteredRdvs = useMemo(() => {
    return rdvs.filter(rdv => 
      Object.values(rdv).some(val => 
        val.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [rdvs, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rendez-vous Commerciaux</h1>
          <p className="text-muted-foreground">Gérez et suivez vos rendez-vous clients dans un format structuré.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-lg transition-all duration-300">
              <Plus className="w-4 h-4" />
              Nouveau RDV
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Ajouter un Rendez-vous</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddRDV} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="societe">Nom de la société</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="societe" 
                    placeholder="Ex: Grosafe" 
                    className="pl-10"
                    value={formData.societe || ''}
                    onChange={e => setFormData({...formData, societe: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activite">Activité</Label>
                <Input 
                  id="activite" 
                  placeholder="Secteur d'activité" 
                  value={formData.activite || ''}
                  onChange={e => setFormData({...formData, activite: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personne">Personne contactée</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="personne" 
                    placeholder="Nom du contact" 
                    className="pl-10"
                    value={formData.personneContactee || ''}
                    onChange={e => setFormData({...formData, personneContactee: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateRDV">Date RDV</Label>
                <Input 
                  id="dateRDV" 
                  type="date" 
                  value={formData.dateRDV || ''}
                  onChange={e => setFormData({...formData, dateRDV: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="telephone" 
                    placeholder="XX XXX XXX" 
                    className="pl-10"
                    value={formData.telephone || ''}
                    onChange={e => setFormData({...formData, telephone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="contact@societe.com" 
                    className="pl-10"
                    value={formData.email || ''}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="col-span-full space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea 
                    id="adresse" 
                    placeholder="Adresse complète" 
                    className="pl-10 min-h-[80px]" 
                    value={formData.adresse || ''}
                    onChange={e => setFormData({...formData, adresse: e.target.value})}
                  />
                </div>
              </div>

              <div className="col-span-full space-y-2">
                <Label htmlFor="besoin">Besoin</Label>
                <Textarea 
                  id="besoin" 
                  placeholder="Détails du besoin client..." 
                  className="min-h-[80px]"
                  value={formData.besoin || ''}
                  onChange={e => setFormData({...formData, besoin: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Pièce jointe</Label>
                <Select 
                  value={formData.pieceJointe} 
                  onValueChange={val => setFormData({...formData, pieceJointe: val as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="envoyé">Envoyé</SelectItem>
                    <SelectItem value="non envoyé">Non envoyé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-full space-y-2">
                <Label htmlFor="notes">Notes supplémentaires</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Remarques, observations..." 
                  value={formData.notes || ''}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="col-span-full flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button type="submit">Enregistrer le RDV</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Répertoire des Rendez-vous
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher un RDV..." 
                  className="pl-10 bg-background/50 border-muted"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="shrink-0">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px] font-bold">N° RDV</TableHead>
                  <TableHead className="font-bold">Date Création</TableHead>
                  <TableHead className="font-bold min-w-[150px]">Société</TableHead>
                  <TableHead className="font-bold">Activité</TableHead>
                  <TableHead className="font-bold min-w-[200px]">Adresse</TableHead>
                  <TableHead className="font-bold">Téléphone</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Contact</TableHead>
                  <TableHead className="font-bold">Date RDV</TableHead>
                  <TableHead className="font-bold min-w-[200px]">Besoin</TableHead>
                  <TableHead className="font-bold">P. Jointe</TableHead>
                  <TableHead className="font-bold">Chargé</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRdvs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-32 text-center text-muted-foreground italic">
                      Aucun rendez-vous trouvé. Cliquez sur "Nouveau RDV" pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRdvs.map((rdv) => (
                    <TableRow key={rdv.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-primary">{rdv.numero}</TableCell>
                      <TableCell className="text-xs">{rdv.dateCreation}</TableCell>
                      <TableCell className="font-medium">{rdv.societe}</TableCell>
                      <TableCell className="text-xs">{rdv.activite}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]" title={rdv.adresse}>{rdv.adresse}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{rdv.telephone}</TableCell>
                      <TableCell className="text-xs">{rdv.email}</TableCell>
                      <TableCell className="text-xs">{rdv.personneContactee}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {rdv.dateRDV}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs italic text-muted-foreground truncate max-w-[200px]" title={rdv.besoin}>
                        {rdv.besoin}
                      </TableCell>
                      <TableCell>
                        {rdv.pieceJointe === 'envoyé' ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1">
                            <FileCheck className="w-3 h-3" />
                            Envoyé
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1">
                            <FileX className="w-3 h-3" />
                            Non envoyé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{rdv.charge}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
