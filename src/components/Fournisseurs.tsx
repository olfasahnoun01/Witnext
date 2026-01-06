import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, Building2, Phone, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Fournisseur {
  id: number;
  nom: string;
  matricule_fiscale: string | null;
  specialite: string;
  phone: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

const SPECIALITES = [
  'Chaussures',
  'Vêtements',
  'Matériels',
  'Équipements de sécurité',
  'Outillage',
  'Électronique',
  'Fournitures de bureau',
  'Autre'
];

// Tunisian governorates and major cities
const TUNISIA_LOCATIONS = [
  { governorate: 'Tunis', cities: ['Tunis', 'Le Bardo', 'La Marsa', 'Carthage', 'Sidi Bou Saïd', 'Le Kram'] },
  { governorate: 'Ariana', cities: ['Ariana', 'La Soukra', 'Raoued', 'Kalâat el-Andalous', 'Sidi Thabet', 'Mnihla'] },
  { governorate: 'Ben Arous', cities: ['Ben Arous', 'Radès', 'Hammam Lif', 'Hammam Chott', 'Ezzahra', 'Mégrine', 'Mohamedia', 'Fouchana'] },
  { governorate: 'Manouba', cities: ['Manouba', 'Den Den', 'Douar Hicher', 'Oued Ellil', 'Tebourba', 'El Battan'] },
  { governorate: 'Nabeul', cities: ['Nabeul', 'Hammamet', 'Kélibia', 'Korba', 'Menzel Temime', 'Soliman', 'Grombalia', 'Dar Chaâbane'] },
  { governorate: 'Zaghouan', cities: ['Zaghouan', 'El Fahs', 'Nadhour', 'Bir Mcherga', 'Zriba'] },
  { governorate: 'Bizerte', cities: ['Bizerte', 'Menzel Bourguiba', 'Mateur', 'Ras Jebel', 'Menzel Jemil', 'Tinja', 'Sejnane'] },
  { governorate: 'Béja', cities: ['Béja', 'Medjez el-Bab', 'Testour', 'Nefza', 'Téboursouk', 'Goubellat'] },
  { governorate: 'Jendouba', cities: ['Jendouba', 'Tabarka', 'Aïn Draham', 'Bou Salem', 'Ghardimaou', 'Fernana'] },
  { governorate: 'Le Kef', cities: ['Le Kef', 'Dahmani', 'Tajerouine', 'Sakiet Sidi Youssef', 'Nebeur', 'Kalaat Senan'] },
  { governorate: 'Siliana', cities: ['Siliana', 'Bou Arada', 'Gaâfour', 'El Krib', 'Makthar', 'Rouhia'] },
  { governorate: 'Sousse', cities: ['Sousse', 'Msaken', 'Kalaa Kebira', 'Hammam Sousse', 'Akouda', 'Kalaa Sghira', 'Enfidha'] },
  { governorate: 'Monastir', cities: ['Monastir', 'Moknine', 'Jemmal', 'Ksar Hellal', 'Téboulba', 'Sahline', 'Bembla', 'Sayada'] },
  { governorate: 'Mahdia', cities: ['Mahdia', 'Ksour Essef', 'El Jem', 'Chebba', 'Bou Merdes', 'Melloulech'] },
  { governorate: 'Sfax', cities: ['Sfax', 'Sakiet Ezzit', 'Sakiet Eddaïer', 'El Ain', 'Thyna', 'Agareb', 'Jbeniana', 'Mahares', 'Kerkennah'] },
  { governorate: 'Kairouan', cities: ['Kairouan', 'Sbikha', 'Haffouz', 'Nasrallah', 'Hajeb El Ayoun', 'Chebika', 'Oueslatia'] },
  { governorate: 'Kasserine', cities: ['Kasserine', 'Sbeitla', 'Thala', 'Foussana', 'Fériana', 'Haïdra', 'Sbiba'] },
  { governorate: 'Sidi Bouzid', cities: ['Sidi Bouzid', 'Regueb', 'Jilma', 'Menzel Bouzaiane', 'Meknassy', 'Bir El Hafey'] },
  { governorate: 'Gabès', cities: ['Gabès', 'El Hamma', 'Mareth', 'Métouia', 'Ghannouch', 'Nouvelle Matmata', 'Matmata'] },
  { governorate: 'Médenine', cities: ['Médenine', 'Zarzis', 'Ben Gardane', 'Houmt Souk (Djerba)', 'Midoun', 'Ajim', 'Beni Khedache'] },
  { governorate: 'Tataouine', cities: ['Tataouine', 'Ghomrassen', 'Remada', 'Dehiba', 'Bir Lahmar', 'Smar'] },
  { governorate: 'Gafsa', cities: ['Gafsa', 'Métlaoui', 'Redeyef', 'El Guettar', 'Mdhilla', 'Sned', 'Belkhir'] },
  { governorate: 'Tozeur', cities: ['Tozeur', 'Nefta', 'Degache', 'Tameghza', 'Hazoua'] },
  { governorate: 'Kébili', cities: ['Kébili', 'Douz', 'Souk Lahad', 'El Golâa', 'Jemna', 'Faouar'] },
];

export const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  
  // Form state
  const [nom, setNom] = useState('');
  const [matriculeFiscale, setMatriculeFiscale] = useState('');
  const [specialite, setSpecialite] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState<string>('all');

  const loadFournisseurs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .order('nom');
    
    if (error) {
      toast.error('Erreur lors du chargement des fournisseurs');
      console.error(error);
    } else {
      setFournisseurs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFournisseurs();
  }, []);

  const resetForm = () => {
    setNom('');
    setMatriculeFiscale('');
    setSpecialite('');
    setPhone('');
    setSelectedGovernorate('');
    setSelectedCity('');
    setEditingFournisseur(null);
  };

  // Get cities for selected governorate
  const availableCities = selectedGovernorate
    ? TUNISIA_LOCATIONS.find(r => r.governorate === selectedGovernorate)?.cities || []
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nom.trim() || !specialite) {
      toast.error('Le nom et la spécialité sont requis');
      return;
    }

    const locationValue = selectedCity && selectedGovernorate 
      ? `${selectedCity}, ${selectedGovernorate}` 
      : null;

    const fournisseurData = {
      nom: nom.trim(),
      matricule_fiscale: matriculeFiscale.trim() || null,
      specialite,
      phone: phone.trim() || null,
      location: locationValue
    };

    if (editingFournisseur) {
      const { error } = await supabase
        .from('fournisseurs')
        .update(fournisseurData)
        .eq('id', editingFournisseur.id);

      if (error) {
        toast.error('Erreur lors de la mise à jour');
        console.error(error);
      } else {
        toast.success('Fournisseur mis à jour');
        setDialogOpen(false);
        resetForm();
        loadFournisseurs();
      }
    } else {
      const { error } = await supabase
        .from('fournisseurs')
        .insert(fournisseurData);

      if (error) {
        toast.error('Erreur lors de l\'ajout');
        console.error(error);
      } else {
        toast.success('Fournisseur ajouté');
        setDialogOpen(false);
        resetForm();
        loadFournisseurs();
      }
    }
  };

  const handleEdit = (fournisseur: Fournisseur) => {
    setEditingFournisseur(fournisseur);
    setNom(fournisseur.nom);
    setMatriculeFiscale(fournisseur.matricule_fiscale || '');
    setSpecialite(fournisseur.specialite);
    setPhone(fournisseur.phone || '');
    
    // Parse location back to governorate and city
    if (fournisseur.location) {
      const parts = fournisseur.location.split(', ');
      if (parts.length === 2) {
        setSelectedCity(parts[0]);
        setSelectedGovernorate(parts[1]);
      }
    } else {
      setSelectedGovernorate('');
      setSelectedCity('');
    }
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;

    const { error } = await supabase
      .from('fournisseurs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } else {
      toast.success('Fournisseur supprimé');
      loadFournisseurs();
    }
  };

  // Filter fournisseurs
  const filteredFournisseurs = fournisseurs.filter(f => {
    const matchesSearch = searchQuery === '' || 
      f.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.matricule_fiscale?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSpecialite = filterSpecialite === 'all' || f.specialite === filterSpecialite;
    
    return matchesSearch && matchesSpecialite;
  });

  // Get unique specialites from current data
  const uniqueSpecialites = [...new Set(fournisseurs.map(f => f.specialite))].sort();

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Fournisseurs</p>
              <p className="text-2xl font-bold">{fournisseurs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Spécialités</p>
              <p className="text-2xl font-bold">{uniqueSpecialites.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <MapPin className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Résultats filtrés</p>
              <p className="text-2xl font-bold">{filteredFournisseurs.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Liste des Fournisseurs
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter Fournisseur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingFournisseur ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom (Société) *</Label>
                    <Input
                      id="nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom du fournisseur"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="matricule">Matricule Fiscale</Label>
                    <Input
                      id="matricule"
                      value={matriculeFiscale}
                      onChange={(e) => setMatriculeFiscale(e.target.value)}
                      placeholder="Ex: 1234567/A/B/C/000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialite">Spécialité *</Label>
                    <Select value={specialite} onValueChange={setSpecialite}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une spécialité" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALITES.map((spec) => (
                          <SelectItem key={spec} value={spec}>
                            {spec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: +216 XX XXX XXX"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Gouvernorat</Label>
                      <Select 
                        value={selectedGovernorate} 
                        onValueChange={(val) => {
                          setSelectedGovernorate(val);
                          setSelectedCity(''); // Reset city when governorate changes
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Région" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {TUNISIA_LOCATIONS.map((region) => (
                            <SelectItem key={region.governorate} value={region.governorate}>
                              {region.governorate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ville</Label>
                      <Select 
                        value={selectedCity} 
                        onValueChange={setSelectedCity}
                        disabled={!selectedGovernorate}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={selectedGovernorate ? "Ville" : "Choisir région"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      {editingFournisseur ? 'Mettre à jour' : 'Ajouter'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, matricule, téléphone, localisation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterSpecialite} onValueChange={setFilterSpecialite}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Toutes les spécialités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les spécialités</SelectItem>
                {uniqueSpecialites.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : filteredFournisseurs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {fournisseurs.length === 0 
                ? 'Aucun fournisseur enregistré. Ajoutez-en un !' 
                : 'Aucun fournisseur ne correspond aux filtres.'}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Nom (Société)</TableHead>
                    <TableHead>Matricule Fiscale</TableHead>
                    <TableHead>Spécialité</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFournisseurs.map((fournisseur) => (
                    <TableRow key={fournisseur.id}>
                      <TableCell className="font-medium">{fournisseur.nom}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {fournisseur.matricule_fiscale || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {fournisseur.specialite}
                        </span>
                      </TableCell>
                      <TableCell>
                        {fournisseur.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {fournisseur.phone}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {fournisseur.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {fournisseur.location}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(fournisseur)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(fournisseur.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
