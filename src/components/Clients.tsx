import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
import { Plus, Pencil, Trash2, Search, Users, Phone, MapPin, Mail, AlertCircle, Upload, Eye, FileText, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { convertFileToWebp } from '@/lib/imageCompression';
import { DocumentUploader } from './shared/DocumentUploader';
import { ClientDocumentPreviewDialog } from './shared/ClientDocumentPreviewDialog';
import { PhoneLinesEditor } from './shared/PhoneLinesEditor';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { formatPhonesDisplay, parsePhoneListFromStorage, serializePhoneList } from '@/lib/phoneList';

interface Client {
  id: number;
  code: string;
  nom: string;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  patente_url?: string | null;
  registre_commerce_url?: string | null;
  created_at: string;
  updated_at: string;
}

const ITEMS_PER_PAGE = 15;

const isClientIncomplete = (client: Client) => {
  const phones = parsePhoneListFromStorage(client.phone);
  return !client.matricule_fiscale?.trim() ||
         phones.length === 0 ||
         !client.email?.trim() ||
         !client.location?.trim() ||
         !client.code?.trim() ||
         !client.patente_url ||
         !client.registre_commerce_url;
};

export const Clients = memo(() => {
  const { isAdmin, isModerator } = useAuth();
  const canDelete = isAdmin || isModerator;
  const { preview: documentPreview, openDocumentPreview, closePreview: closeDocumentPreview } =
    useClientDocumentPreview();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<'code' | 'nom'>('nom');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Form state
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [matriculeFiscale, setMatriculeFiscale] = useState('');
  const [phoneLines, setPhoneLines] = useState<string[]>(['']);
  const [email, setEmail] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [exactLocation, setExactLocation] = useState('');
  const [patenteUrl, setPatenteUrl] = useState<string | null>(null);
  const [rcUrl, setRcUrl] = useState<string | null>(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  const loadClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('nom');
    
    if (error) {
      toast.error('Erreur lors du chargement des clients');
      console.error(error);
    } else {
      setClients((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const resetForm = useCallback(() => {
    setNom('');
    setCode('');
    setMatriculeFiscale('');
    setPhoneLines(['']);
    setEmail('');
    setSelectedGovernorate('');
    setSelectedCity('');
    setExactLocation('');
    setPatenteUrl(null);
    setRcUrl(null);
    setEditingClient(null);
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
      toast.error('Le nom du client est requis');
      return;
    }

    const phoneStored = serializePhoneList(phoneLines);

    if (!editingClient) {
      if (!phoneStored) {
        toast.error('Au moins un numéro de téléphone est requis');
        return;
      }
      if (!matriculeFiscale.trim()) {
        toast.error('Le matricule fiscal est requis');
        return;
      }
      if (!code.trim()) {
        toast.error('Le code client est requis (pour nommer les documents)');
        return;
      }
    }

    // Build location string defensively
    const locationParts = [exactLocation.trim(), selectedCity, selectedGovernorate].filter(Boolean);
    const locationValue = locationParts.length > 0 ? locationParts.join(', ') : null;

    const clientData = {
      nom: nom.trim(),
      code: code.trim() || null,
      matricule_fiscale: matriculeFiscale.trim(),
      phone: phoneStored || null,
      email: email.trim(),
      location: locationValue,
      patente_url: patenteUrl,
      registre_commerce_url: rcUrl
    };

    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingClient.id);

      if (error) {
        toast.error('Erreur lors de la mise à jour');
        console.error(error);
      } else {
        toast.success('Client mis à jour');
        setDialogOpen(false);
        resetForm();
        loadClients();
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert(clientData);

      if (error) {
        toast.error('Erreur lors de l\'ajout');
        console.error(error);
      } else {
        toast.success('Client ajouté');
        setDialogOpen(false);
        resetForm();
        loadClients();
      }
    }
  }, [nom, code, selectedCity, selectedGovernorate, exactLocation, matriculeFiscale, phoneLines, email, patenteUrl, rcUrl, editingClient, resetForm, loadClients]);

  const handleEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setNom(client.nom);
    setCode(client.code || '');
    setMatriculeFiscale(client.matricule_fiscale || '');
    const parsed = parsePhoneListFromStorage(client.phone);
    setPhoneLines(parsed.length > 0 ? parsed : ['']);
    setEmail(client.email || '');
    setPatenteUrl(client.patente_url);
    setRcUrl(client.registre_commerce_url);
    
    // Parse location back to exact address, city, and governorate
    if (client.location) {
      const parts = client.location.split(', ');
      if (parts.length >= 3) {
        // Has exact location + city + governorate
        setExactLocation(parts.slice(0, -2).join(', '));
        setSelectedCity(parts[parts.length - 2]);
        setSelectedGovernorate(parts[parts.length - 1]);
      } else if (parts.length === 2) {
        // Just city + governorate
        setExactLocation('');
        setSelectedCity(parts[0]);
        setSelectedGovernorate(parts[1]);
      } else {
        // Just one part, treat as exact location
        setExactLocation(parts[0]);
        setSelectedGovernorate('');
        setSelectedCity('');
      }
    } else {
      setExactLocation('');
      setSelectedGovernorate('');
      setSelectedCity('');
    }
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } else {
      toast.success('Client supprimé');
      loadClients();
    }
  }, [loadClients]);

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter and Sort clients - memoized with debounced search
  const filteredClients = useMemo(() => {
    let result = clients.filter(c => {
      const matchesSearch = debouncedSearchQuery === '' || 
        c.nom.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.matricule_fiscale?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        formatPhonesDisplay(c.phone).toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.code?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      return matchesSearch;
    });

    // Apply sorting
    result.sort((a, b) => {
      const valA = (a[sortColumn] || '').toLowerCase();
      const valB = (b[sortColumn] || '').toLowerCase();
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [clients, debouncedSearchQuery, sortColumn, sortDirection]);

  // Paginated results
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <MapPin className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avec Localisation</p>
              <p className="text-2xl font-bold">{clients.filter(c => c.location).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Phone className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avec Téléphone</p>
              <p className="text-2xl font-bold">{clients.filter(c => parsePhoneListFromStorage(c.phone).length > 0).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Liste des Clients
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter Client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingClient ? 'Modifier le Client' : 'Nouveau Client'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom Client *</Label>
                    <Input
                      id="nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      placeholder="Nom du client ou société"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codeClient">Code Client *</Label>
                    <Input
                      id="codeClient"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Code unique (ex: CLI-001)"
                      required={!editingClient}
                    />
                    <p className="text-xs text-muted-foreground">
                      Obligatoire pour l&apos;ajout : sert au nom des fichiers Patente et RNE.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="matricule">Matricule Fiscale *</Label>
                    <Input
                      id="matricule"
                      value={matriculeFiscale}
                      onChange={(e) => setMatriculeFiscale(e.target.value)}
                      placeholder="Ex: 1234567/A/B/C/000"
                      required={!editingClient}
                    />
                  </div>
                  <PhoneLinesEditor
                    idPrefix="client"
                    label="Téléphone(s)"
                    required={!editingClient}
                    lines={phoneLines}
                    onChange={setPhoneLines}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: contact@societe.tn"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Gouvernorat *</Label>
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
                      <Label>Ville *</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="exactLocation">Adresse Exacte *</Label>
                    <Input
                      id="exactLocation"
                      value={exactLocation}
                      onChange={(e) => setExactLocation(e.target.value)}
                      placeholder="Ex: Rue Ibn Khaldoun, N°15, Zone Industrielle..."
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-dashed">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Documents (PDF) — optionnel
                    </h3>

                    {code.trim() ? (
                      <div className="space-y-3">
                        <DocumentUploader
                          bucket="client-documents"
                          entityCode={code}
                          documentType="patente"
                          currentUrl={patenteUrl}
                          onUploadSuccess={(url) => setPatenteUrl(url)}
                          onConsult={(url) => void openDocumentPreview(url, `Patente — ${nom.trim() || code}`)}
                        />
                        <DocumentUploader
                          bucket="client-documents"
                          entityCode={code}
                          documentType="rc"
                          titleOverride="RNE (Registre national des entreprises)"
                          currentUrl={rcUrl}
                          onUploadSuccess={(url) => setRcUrl(url)}
                          onConsult={(url) => void openDocumentPreview(url, `RNE — ${nom.trim() || code}`)}
                        />
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2 text-amber-800 text-xs">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="italic">
                          Saisissez le <strong>code client</strong> ci-dessus pour activer l&apos;envoi Patente et RNE.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      {editingClient ? 'Mettre à jour' : 'Ajouter'}
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
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {clients.length === 0 
                ? 'Aucun client enregistré. Ajoutez-en un !' 
                : 'Aucun client ne correspond aux filtres.'}
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead 
                        className="w-[120px] cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          if (sortColumn === 'code') {
                            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortColumn('code');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Code
                          {sortColumn === 'code' && (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortColumn !== 'code' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          if (sortColumn === 'nom') {
                            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortColumn('nom');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Nom (Société)
                          {sortColumn === 'nom' && (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          )}
                          {sortColumn !== 'nom' && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead>Matricule Fiscale</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Patente</TableHead>
                      <TableHead>RNE</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                          {client.code}
                        </TableCell>
                        <TableCell className="font-medium text-primary">{client.nom}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {client.matricule_fiscale || '-'}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {formatPhonesDisplay(client.phone) || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            {client.location || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {client.patente_url ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-1.5"
                              onClick={() => void openDocumentPreview(client.patente_url, `Patente — ${client.nom}`)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Voir
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Aucune</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.registre_commerce_url ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-1.5"
                              onClick={() => void openDocumentPreview(client.registre_commerce_url, `RNE — ${client.nom}`)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Voir
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Aucun</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {isClientIncomplete(client) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                onClick={() => handleEdit(client)}
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Compléter
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(client)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(client.id)}
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
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages} ({filteredClients.length} clients)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ClientDocumentPreviewDialog preview={documentPreview} onClose={closeDocumentPreview} />
    </div>
  );
});

Clients.displayName = 'Clients';
