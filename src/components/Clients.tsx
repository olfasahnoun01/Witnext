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
import { Plus, Pencil, Trash2, Search, Users, Phone, MapPin, Mail, AlertCircle, Upload, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { convertFileToWebp } from '@/lib/imageCompression';

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
  return !client.matricule_fiscale?.trim() || 
         !client.phone?.trim() || 
         !client.email?.trim() || 
         !client.location?.trim() ||
         !client.code?.trim();
};

export const Clients = memo(() => {
  const { isAdmin, isModerator } = useAuth();
  const canDelete = isAdmin || isModerator;
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Form state
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [matriculeFiscale, setMatriculeFiscale] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [exactLocation, setExactLocation] = useState('');
  const [patenteUrl, setPatenteUrl] = useState<string | null>(null); // Stores path in DB
  const [rcUrl, setRcUrl] = useState<string | null>(null); // Stores path in DB
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Stores signed URL for UI
  const [rcPreviewUrl, setRcPreviewUrl] = useState<string | null>(null); // Stores signed URL for UI
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingRC, setIsUploadingRC] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageErrorRC, setStorageErrorRC] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rcFileInputRef = useRef<HTMLInputElement>(null);
  
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
    setPhone('');
    setEmail('');
    setSelectedGovernorate('');
    setSelectedCity('');
    setExactLocation('');
    setPatenteUrl(null);
    setRcUrl(null);
    setPreviewUrl(null);
    setRcPreviewUrl(null);
    setEditingClient(null);
    setStorageError(null);
    setStorageErrorRC(null);
  }, []);

  // Get cities for selected governorate
  const availableCities = useMemo(() => {
    return selectedGovernorate
      ? TUNISIA_LOCATIONS.find(r => r.governorate === selectedGovernorate)?.cities || []
      : [];
  }, [selectedGovernorate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 5Mo)');
      return;
    }

    setIsUploading(true);
    setStorageError(null);
    try {
      // Step 1: Convert to WebP (95% quality)
      const { blob, ext } = await convertFileToWebp(file, { quality: 0.95 });
      
      const fileName = `${Date.now()}_${file.name.split('.')[0].replace(/\s+/g, '_')}.${ext}`;
      const filePath = `client_patentes/${fileName}`;
      
      let { error: uploadError } = await supabase.storage
        .from('patentes_client')
        .upload(filePath, blob);

      // Self-healing attempt: if bucket is missing, try to create it
      if (uploadError && ((uploadError as any).status === 400 || (uploadError as any).message?.includes('not found'))) {
        console.log("Attempting to create missing bucket 'patentes_client'...");
        const { error: createError } = await supabase.storage.createBucket('patentes_client', { public: false });
        
        if (!createError) {
          // Retry upload if creation succeeded
          const { error: retryError } = await supabase.storage
            .from('patentes_client')
            .upload(filePath, blob);
          uploadError = retryError;
        } else {
          // If creation failed (permissions), set storage error to show help UI
          setStorageError('BUCKET_NOT_FOUND');
          throw uploadError;
        }
      }

      if (uploadError) throw uploadError;

      // Now we store the path, not the public URL
      setPatenteUrl(filePath);
      toast.success('Patente téléchargée');
    } catch (error: any) {
      console.error('Error uploading patente:', error);
      if (error.message?.includes('not found') || error.status === 400) {
        setStorageError('BUCKET_NOT_FOUND');
      }
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRCFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 5Mo)');
      return;
    }

    setIsUploadingRC(true);
    setStorageErrorRC(null);
    try {
      // Step 1: Convert to WebP (95% quality)
      const { blob, ext } = await convertFileToWebp(file, { quality: 0.95 });
      
      const fileName = `${Date.now()}_RC_${file.name.split('.')[0].replace(/\s+/g, '_')}.${ext}`;
      const filePath = `registre_commerce/${fileName}`;
      
      let { error: uploadError } = await supabase.storage
        .from('registre_commerce_client')
        .upload(filePath, blob);

      // Self-healing attempt: if bucket is missing, try to create it
      if (uploadError && ((uploadError as any).status === 400 || (uploadError as any).message?.includes('not found'))) {
        console.log("Attempting to create missing bucket 'registre_commerce_client'...");
        const { error: createError } = await supabase.storage.createBucket('registre_commerce_client', { public: false });
        
        if (!createError) {
          const { error: retryError } = await supabase.storage
            .from('registre_commerce_client')
            .upload(filePath, blob);
          uploadError = retryError;
        } else {
          setStorageErrorRC('BUCKET_NOT_FOUND');
          throw uploadError;
        }
      }

      if (uploadError) throw uploadError;

      setRcUrl(filePath);
      toast.success('Registre de Commerce téléchargé');
    } catch (error: any) {
      console.error('Error uploading RC:', error);
      if (error.message?.includes('not found') || error.status === 400) {
        setStorageErrorRC('BUCKET_NOT_FOUND');
      }
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploadingRC(false);
    }
  };

  const handleViewDocument = async (path: string, bucket: string = 'patentes_client') => {
    if (!path) return;
    
    // Support legacy full URLs if any
    if (path.startsWith('http')) {
      window.open(path, '_blank');
      return;
    }

    setIsGeneratingLink(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60); // Link valid for 60 seconds

      if (error) throw error;
      if (data) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error(`Error creating signed URL for ${bucket}:`, error);
      toast.error('Impossible d\'ouvrir le document');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Resolve paths to preview URLs for the modal
  useEffect(() => {
    const fetchPreviews = async () => {
      // Patente Preview
      if (patenteUrl && !patenteUrl.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('patentes_client')
          .createSignedUrl(patenteUrl, 3600);
        if (!error && data) {
          setPreviewUrl(data.signedUrl);
        }
      } else {
        setPreviewUrl(patenteUrl);
      }

      // RC Preview
      if (rcUrl && !rcUrl.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('registre_commerce_client')
          .createSignedUrl(rcUrl, 3600);
        if (!error && data) {
          setRcPreviewUrl(data.signedUrl);
        }
      } else {
        setRcPreviewUrl(rcUrl);
      }
    };
    
    fetchPreviews();
  }, [patenteUrl, rcUrl]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nom.trim()) {
      toast.error('Le nom du client est requis');
      return;
    }

    // Build location string defensively
    const locationParts = [exactLocation.trim(), selectedCity, selectedGovernorate].filter(Boolean);
    const locationValue = locationParts.length > 0 ? locationParts.join(', ') : null;

    const clientData = {
      nom: nom.trim(),
      matricule_fiscale: matriculeFiscale.trim(),
      phone: phone.trim(),
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
  }, [nom, selectedCity, selectedGovernorate, exactLocation, matriculeFiscale, phone, email, patenteUrl, rcUrl, editingClient, resetForm, loadClients]);

  const handleEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setNom(client.nom);
    setCode(client.code || '');
    setMatriculeFiscale(client.matricule_fiscale || '');
    setPhone(client.phone || '');
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

  // Filter clients - memoized with debounced search
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = debouncedSearchQuery === '' || 
        c.nom.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.matricule_fiscale?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.phone?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [clients, debouncedSearchQuery]);

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
              <p className="text-2xl font-bold">{clients.filter(c => c.phone).length}</p>
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
                    <Label htmlFor="matricule">Matricule Fiscale *</Label>
                    <Input
                      id="matricule"
                      value={matriculeFiscale}
                      onChange={(e) => setMatriculeFiscale(e.target.value)}
                      placeholder="Ex: 1234567/A/B/C/000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone / Fix *</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: +216 XX XXX XXX"
                    />
                  </div>
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

                  {/* Patente Upload */}
                  <div className="space-y-4 pt-4 border-t mt-4">
                    <Label className="text-base font-semibold">Document Patente</Label>
                    
                    {storageError === 'BUCKET_NOT_FOUND' && (
                      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                        <div className="flex items-start gap-2 text-amber-800">
                          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <p className="font-bold">Configuration du stockage requise</p>
                            <p>Le dossier "patentes_client" n'existe pas dans votre projet Supabase.</p>
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded border font-mono text-xs overflow-x-auto">
                          {`INSERT INTO storage.buckets (id, name, public) VALUES ('patentes_client', 'patentes_client', false);`}
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => {
                            const sql = "INSERT INTO storage.buckets (id, name, public) VALUES ('patentes_client', 'patentes_client', false);\n\nCREATE POLICY \"Lecture sécurisée patentes\" ON storage.objects FOR SELECT USING (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);\n\nCREATE POLICY \"Upload patentes\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'patentes_client' AND auth.uid() IS NOT NULL);";
                            navigator.clipboard.writeText(sql);
                            toast.success('SQL copié ! Collez-le dans l\'Editeur SQL de Supabase.');
                            window.open('https://supabase.com/dashboard/project/lptoakdzyuhkfvslgpsw/sql/new', '_blank');
                          }}
                        >
                          Copier le SQL et ouvrir Supabase
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {patenteUrl ? (
                        <div className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                          {previewUrl ? (
                            <img src={previewUrl} alt="Patente preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <FileText className="w-6 h-6 text-muted-foreground animate-pulse" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-white hover:text-destructive"
                              onClick={() => {
                                setPatenteUrl(null);
                                setPreviewUrl(null);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-20 h-20 border-dashed"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                          ) : (
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Upload Patente</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG (max 5Mo)</p>
                      </div>
                    </div>

                    {/* Registre de Commerce Upload */}
                    <Label className="text-base font-semibold pt-4 border-t block">Registre de Commerce</Label>
                    
                    {storageErrorRC === 'BUCKET_NOT_FOUND' && (
                      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                        <div className="flex items-start gap-2 text-amber-800">
                          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <p className="font-bold">Configuration du stockage requise (RC)</p>
                            <p>Le dossier "registre_commerce_client" n'existe pas.</p>
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded border font-mono text-xs overflow-x-auto">
                          {`INSERT INTO storage.buckets (id, name, public) VALUES ('registre_commerce_client', 'registre_commerce_client', false);`}
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => {
                            const sql = "INSERT INTO storage.buckets (id, name, public) VALUES ('registre_commerce_client', 'registre_commerce_client', false);\n\nCREATE POLICY \"Lecture sécurisée RC\" ON storage.objects FOR SELECT USING (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);\n\nCREATE POLICY \"Upload RC\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'registre_commerce_client' AND auth.uid() IS NOT NULL);";
                            navigator.clipboard.writeText(sql);
                            toast.success('SQL copié !');
                            window.open('https://supabase.com/dashboard/project/lptoakdzyuhkfvslgpsw/sql/new', '_blank');
                          }}
                        >
                          Copier le SQL et ouvrir Supabase
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      {rcUrl ? (
                        <div className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                          {rcPreviewUrl ? (
                            <img src={rcPreviewUrl} alt="RC preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <FileText className="w-6 h-6 text-muted-foreground animate-pulse" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-white hover:text-destructive"
                              onClick={() => {
                                setRcUrl(null);
                                setRcPreviewUrl(null);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-20 h-20 border-dashed"
                          onClick={() => rcFileInputRef.current?.click()}
                          disabled={isUploadingRC}
                        >
                          {isUploadingRC ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                          ) : (
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                      <input
                        ref={rcFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleRCFileChange}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Upload Registre de Commerce</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG (max 5Mo)</p>
                      </div>
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
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead>Nom (Société)</TableHead>
                      <TableHead>Matricule Fiscale</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Patente</TableHead>
                      <TableHead>R.C.</TableHead>
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
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            {client.phone || '-'}
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
                              disabled={isGeneratingLink}
                              onClick={() => handleViewDocument(client.patente_url!, 'patentes_client')}
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
                              disabled={isGeneratingLink}
                              onClick={() => handleViewDocument(client.registre_commerce_url!, 'registre_commerce_client')}
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
    </div>
  );
});

Clients.displayName = 'Clients';
