import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
import { Plus, Pencil, Trash2, Search, Building2, Phone, MapPin, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SPECIALITES } from '@/constants/fournisseurs';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';

interface Fournisseur {
  id: number;
  code: string;
  nom: string;
  matricule_fiscale: string | null;
  specialite: string;
  phone: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

const ITEMS_PER_PAGE = 15;

const isFournisseurIncomplete = (f: Fournisseur) => {
  return !f.matricule_fiscale?.trim() || 
         !f.phone?.trim() || 
         !f.location?.trim() ||
         !f.code?.trim();
};

export const Fournisseurs = memo(() => {
  const { isAdmin, isModerator } = useAuth();
  const canDelete = isAdmin || isModerator;
  
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Form state
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [matriculeFiscale, setMatriculeFiscale] = useState('');
  const [specialite, setSpecialite] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState<string>('all');

  const loadFournisseurs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .order('nom');
    
    if (error) {
      toast.error('Erreur lors du chargement des fournisseurs');
      console.error(error);
    } else {
      setFournisseurs((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFournisseurs();
  }, [loadFournisseurs]);

  const resetForm = useCallback(() => {
    setNom('');
    setCode('');
    setMatriculeFiscale('');
    setSpecialite('');
    setPhone('');
    setSelectedGovernorate('');
    setSelectedCity('');
    setEditingFournisseur(null);
  }, []);

  // Get cities for selected governorate
  const availableCities = useMemo(() => {
    return selectedGovernorate
      ? TUNISIA_LOCATIONS.find(r => r.governorate === selectedGovernorate)?.cities || []
      : [];
  }, [selectedGovernorate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nom.trim()) {
      toast.error('Le nom du fournisseur est requis');
      return;
    }

    // Build location string defensively
    const locationParts = [selectedCity, selectedGovernorate].filter(Boolean);
    const locationValue = locationParts.length > 0 ? locationParts.join(', ') : null;

    const fournisseurData = {
      nom: nom.trim(),
      matricule_fiscale: matriculeFiscale.trim(),
      specialite,
      phone: phone.trim(),
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
  }, [nom, specialite, selectedCity, selectedGovernorate, matriculeFiscale, phone, editingFournisseur, resetForm, loadFournisseurs]);

  const handleEdit = useCallback((fournisseur: Fournisseur) => {
    setEditingFournisseur(fournisseur);
    setNom(fournisseur.nom);
    setCode(fournisseur.code || '');
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
  }, []);

  const handleDelete = useCallback(async (id: number) => {
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
  }, [loadFournisseurs]);

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter fournisseurs - memoized with debounced search
  const filteredFournisseurs = useMemo(() => {
    return fournisseurs.filter(f => {
      const matchesSearch = debouncedSearchQuery === '' || 
        f.nom.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        f.matricule_fiscale?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        f.phone?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        f.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        f.code?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesSpecialite = filterSpecialite === 'all' || f.specialite === filterSpecialite;
      
      return matchesSearch && matchesSpecialite;
    });
  }, [fournisseurs, debouncedSearchQuery, filterSpecialite]);

  // Paginated results
  const paginatedFournisseurs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFournisseurs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFournisseurs, currentPage]);

  const totalPages = Math.ceil(filteredFournisseurs.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterSpecialite]);

  // Get unique specialites from current data - memoized
  const uniqueSpecialites = useMemo(() => {
    return [...new Set(fournisseurs.map(f => f.specialite))].sort();
  }, [fournisseurs]);

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
                    <Label htmlFor="nom">Nom Fournisseur *</Label>
                    <Input
                      id="nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom de la société"
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
                    <Label htmlFor="specialite">Spécialité</Label>
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
                          setSelectedCity('');
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
                placeholder="Rechercher par nom, code, matricule, téléphone..."
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
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead>Nom (Société)</TableHead>
                      <TableHead>Matricule Fiscale</TableHead>
                      <TableHead>Spécialité</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFournisseurs.map((fournisseur) => (
                      <TableRow key={fournisseur.id}>
                        <TableHead className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                          {fournisseur.code}
                        </TableHead>
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
                          <div className="flex justify-end gap-2 items-center">
                            {isFournisseurIncomplete(fournisseur) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                onClick={() => handleEdit(fournisseur)}
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Compléter
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(fournisseur)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(fournisseur.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

Fournisseurs.displayName = 'Fournisseurs';
