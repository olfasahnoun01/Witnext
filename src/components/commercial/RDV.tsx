import { useState, useMemo, useCallback, useEffect } from 'react';
import { formatAppDate, formatAppDateTime } from '@/lib/formatAppDate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { COMMERCIAL_EXCEL_TABLE_CLASS } from '@/lib/tableStyles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock,
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  FileCheck,
  FileX,
  Pencil,
  Trash2,
  MoreHorizontal,
  Download, 
  Filter,
  Table as TableIcon,
  X,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { format, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { PhoneLinesEditor } from '@/components/shared/PhoneLinesEditor';
import { formatPhonesDisplay, parsePhoneListFromStorage, serializePhoneList } from '@/lib/phoneList';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { userDisplayName } from '@/lib/userDisplay';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { exportReportCsv } from '@/lib/reportExport';

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

interface RDVFormData {
  dateCreation: string;
  societe: string;
  activite: string;
  adresse: string;
  telephoneLines: string[];
  email: string;
  personneContactee: string;
  dateRDV: string;
  heureRDV: string;
  notes: string;
  besoin: string;
  pieceJointe: 'envoyé' | 'non envoyé';
}

type RdvListFilters = {
  societe: string;
  pieceJointe: 'all' | 'envoyé' | 'non envoyé';
  dateFrom: string;
  dateTo: string;
};

const defaultRdvFilters = (): RdvListFilters => ({
  societe: '',
  pieceJointe: 'all',
  dateFrom: '',
  dateTo: '',
});

function parseRdvNumeroSeq(numero: string): number {
  const match = /^RDV-(\d+)$/i.exec(String(numero ?? '').trim());
  return match ? parseInt(match[1], 10) : 0;
}

function sortRdvsByNumeroDesc(a: RDV, b: RDV): number {
  const byNumero = parseRdvNumeroSeq(b.numero) - parseRdvNumeroSeq(a.numero);
  if (byNumero !== 0) return byNumero;
  try {
    return parseISO(b.dateRDV).getTime() - parseISO(a.dateRDV).getTime();
  } catch {
    return b.numero.localeCompare(a.numero);
  }
}

const createEmptyFormData = (): RDVFormData => ({
  dateCreation: new Date().toISOString().split('T')[0],
  societe: '',
  activite: '',
  adresse: '',
  telephoneLines: [''],
  email: '',
  personneContactee: '',
  dateRDV: '',
  heureRDV: '',
  notes: '',
  besoin: '',
  pieceJointe: 'non envoyé',
});

const buildRDVDateTime = (date: string, time?: string) => {
  if (!date) {
    return new Date().toISOString();
  }

  const normalizedTime = time && time.trim() ? time : '00:00';
  return new Date(`${date}T${normalizedTime}:00`).toISOString();
};

async function generateNextRdvNumero(companyId: string): Promise<string> {
  let query = (supabase as any).from('rdvs').select('numero').ilike('numero', 'RDV-%');
  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw error;

  let maxSeq = 0;
  for (const row of data ?? []) {
    const match = /^RDV-(\d+)$/i.exec(String(row.numero ?? '').trim());
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }

  return `RDV-${(maxSeq + 1).toString().padStart(3, '0')}`;
}

export const RDV = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<RdvListFilters>(defaultRdvFilters);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [chargeDisplayByRaw, setChargeDisplayByRaw] = useState<Record<string, string>>({});
  const [currentUserDisplay, setCurrentUserDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRDV, setEditingRDV] = useState<RDV | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [deleteTarget, setDeleteTarget] = useState<RDV | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRdvs = useCallback(async () => {
    setIsLoading(true);
    try {
      const companyId = getActiveCompanyId();
      let query = (supabase as any).from('rdvs').select('*');
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const mappedRdvs: RDV[] = (data || []).map((item: any) => ({
        id: item.id,
        numero: item.numero,
        dateCreation: item.date_creation,
        societe: item.societe,
        activite: item.activite || '',
        adresse: item.adresse || '',
        telephone: item.telephone || '',
        email: item.email || '',
        personneContactee: item.personne_contactee || '',
        dateRDV: item.date_rdv,
        notes: item.notes || '',
        besoin: item.besoin || '',
        pieceJointe: item.piece_jointe as 'envoyé' | 'non envoyé',
        charge: item.charge || ''
      }));

      setRdvs(mappedRdvs);

      const rawCharges = [...new Set(mappedRdvs.map((r) => r.charge.trim()).filter(Boolean))];
      if (rawCharges.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('full_name, email')
          .in('email', rawCharges);
        const displayMap: Record<string, string> = {};
        for (const raw of rawCharges) {
          const profile = (profiles ?? []).find(
            (p) => (p.email ?? '').trim().toLowerCase() === raw.toLowerCase()
          );
          displayMap[raw] = userDisplayName(profile?.full_name, profile?.email ?? raw);
        }
        setChargeDisplayByRaw(displayMap);
      } else {
        setChargeDisplayByRaw({});
      }
    } catch (error: any) {
      console.error('Error fetching rdvs:', error);
      toast.error('Erreur lors du chargement des rendez-vous');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRdvs();
  }, [fetchRdvs]);

  useEffect(() => {
    if (!user?.id) {
      setCurrentUserDisplay('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setCurrentUserDisplay(userDisplayName(data?.full_name, user.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  useSessionResumeReload(fetchRdvs);
  useCompanyChangeReload(fetchRdvs);
  
  // Form State
  const [formData, setFormData] = useState<RDVFormData>(createEmptyFormData());

  const resetForm = useCallback(() => {
    setFormData(createEmptyFormData());
    setEditingRDV(null);
  }, []);

  const handleSubmitRDV = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dateRDV = buildRDVDateTime(formData.dateRDV, formData.heureRDV);

    try {
      const companyId = getActiveCompanyId();
      if (!companyId) {
        toast.error('Société active non chargée. Réessayez dans quelques secondes.');
        return;
      }
      const payload = {
        date_creation: formData.dateCreation || new Date().toISOString().split('T')[0],
        societe: formData.societe || '',
        activite: formData.activite || '',
        adresse: formData.adresse || '',
        telephone: serializePhoneList(formData.telephoneLines) || '',
        email: formData.email || '',
        personne_contactee: formData.personneContactee || '',
        date_rdv: dateRDV,
        notes: formData.notes || '',
        besoin: formData.besoin || '',
        piece_jointe: formData.pieceJointe,
        charge: editingRDV?.charge || currentUserDisplay || userDisplayName(null, user?.email),
        ...(companyId ? { company_id: companyId } : {}),
      };

      if (editingRDV) {
        const { error } = await (supabase as any)
          .from('rdvs')
          .update(payload)
          .eq('id', editingRDV.id);
        if (error) throw error;
      } else {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const numero = await generateNextRdvNumero(companyId);
          const { error } = await (supabase as any).from('rdvs').insert([
            { ...payload, numero },
          ]);
          if (!error) {
            lastError = null;
            break;
          }
          if (error.code === '23505') {
            lastError = error;
            continue;
          }
          throw error;
        }
        if (lastError) throw lastError;
      }

      toast.success(editingRDV ? 'Rendez-vous modifié avec succès' : 'Rendez-vous ajouté avec succès');
      setDialogOpen(false);
      resetForm();
      await fetchRdvs();
    } catch (error: any) {
      console.error('Error saving rdv:', error);
      const detail = error?.message ? `: ${error.message}` : '';
      toast.error(
        (editingRDV ? 'Erreur lors de la modification du rendez-vous' : 'Erreur lors de l\'ajout du rendez-vous') +
          detail
      );
    }
  };

  const handleDeleteRDV = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase as any).from('rdvs').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Rendez-vous ${deleteTarget.numero} supprimé`);
      if (editingRDV?.id === deleteTarget.id) {
        setDialogOpen(false);
        resetForm();
      }
      setDeleteTarget(null);
      await fetchRdvs();
    } catch (error: any) {
      console.error('Error deleting rdv:', error);
      const detail = error?.message ? `: ${error.message}` : '';
      toast.error(`Erreur lors de la suppression du rendez-vous${detail}`);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, editingRDV?.id, fetchRdvs, resetForm]);

  const handleEditRDV = useCallback((rdv: RDV) => {
    let datePart = '';
    let timePart = '';

    try {
      const parsedDate = parseISO(rdv.dateRDV);
      datePart = format(parsedDate, 'yyyy-MM-dd');
      timePart = format(parsedDate, 'HH:mm');
    } catch {
      datePart = '';
      timePart = '';
    }

    setEditingRDV(rdv);
    const telLines = parsePhoneListFromStorage(rdv.telephone);
    setFormData({
      dateCreation: rdv.dateCreation || new Date().toISOString().split('T')[0],
      societe: rdv.societe || '',
      activite: rdv.activite || '',
      adresse: rdv.adresse || '',
      telephoneLines: telLines.length > 0 ? telLines : [''],
      email: rdv.email || '',
      personneContactee: rdv.personneContactee || '',
      dateRDV: datePart,
      heureRDV: timePart,
      notes: rdv.notes || '',
      besoin: rdv.besoin || '',
      pieceJointe: rdv.pieceJointe || 'non envoyé',
    });
    setDialogOpen(true);
  }, []);

  const filteredRdvs = useMemo(() => {
    const numeroQuery = searchQuery.trim().toLowerCase();

    return [...rdvs]
      .filter((rdv) => {
        if (numeroQuery && !rdv.numero.toLowerCase().includes(numeroQuery)) {
          return false;
        }
        if (filters.societe.trim()) {
          const societeQ = filters.societe.trim().toLowerCase();
          if (!rdv.societe.toLowerCase().includes(societeQ)) return false;
        }
        if (filters.pieceJointe !== 'all' && rdv.pieceJointe !== filters.pieceJointe) {
          return false;
        }
        if (filters.dateFrom) {
          try {
            if (parseISO(rdv.dateRDV) < parseISO(filters.dateFrom)) return false;
          } catch {
            return false;
          }
        }
        if (filters.dateTo) {
          try {
            const end = parseISO(filters.dateTo);
            end.setHours(23, 59, 59, 999);
            if (parseISO(rdv.dateRDV) > end) return false;
          } catch {
            return false;
          }
        }
        return true;
      })
      .sort(sortRdvsByNumeroDesc);
  }, [rdvs, searchQuery, filters]);

  const filterResetKey = `${searchQuery}|${filters.societe}|${filters.pieceJointe}|${filters.dateFrom}|${filters.dateTo}`;

  const {
    slice: rdvsPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(filteredRdvs, filterResetKey);

  const hasActiveFilters =
    Boolean(filters.societe.trim()) ||
    filters.pieceJointe !== 'all' ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  const resetFilters = () => {
    setFilters(defaultRdvFilters());
    setFilterPopoverOpen(false);
  };

  const handleDownloadCsv = () => {
    if (filteredRdvs.length === 0) {
      toast.error('Aucun rendez-vous à exporter');
      return;
    }

    exportReportCsv({
      title: 'Rendez-vous commerciaux',
      filenameBase: `rendez-vous_${format(new Date(), 'yyyy-MM-dd')}`,
      headers: [
        'N° RDV',
        'Date création',
        'Société',
        'Activité',
        'Adresse',
        'Téléphone',
        'Email',
        'Contact',
        'Date RDV',
        'Besoin',
        'Pièce jointe',
        'Compte utilisateur',
        'Notes',
      ],
      rows: filteredRdvs.map((rdv) => [
        rdv.numero,
        rdv.dateCreation,
        rdv.societe,
        rdv.activite,
        rdv.adresse,
        formatPhonesDisplay(rdv.telephone),
        rdv.email,
        rdv.personneContactee,
        rdv.dateRDV ? formatAppDateTime(rdv.dateRDV) : '',
        rdv.besoin,
        rdv.pieceJointe,
        chargeDisplayByRaw[rdv.charge] ?? rdv.charge,
        rdv.notes,
      ]),
    });
    toast.success(`${filteredRdvs.length} rendez-vous exporté(s) en CSV`);
  };

  const rdvsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return rdvs
      .filter((rdv) => {
        try {
          return isSameDay(parseISO(rdv.dateRDV), selectedDate);
        } catch {
          return false;
        }
      })
      .sort(sortRdvsByNumeroDesc);
  }, [rdvs, selectedDate]);

  const appointmentsDates = useMemo(() => {
    return rdvs.map(r => {
      try {
        return parseISO(r.dateRDV);
      } catch {
        return null;
      }
    }).filter(d => d !== null) as Date[];
  }, [rdvs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rendez-vous Commerciaux</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('table')}
              className="gap-2"
            >
              <TableIcon className="w-4 h-4" />
              Tableau
            </Button>
            <Button 
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('calendar')}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Calendrier
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 shadow-lg transition-all duration-300"
                onClick={() => resetForm()}
              >
                <Plus className="w-4 h-4" />
                Nouveau RDV
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {editingRDV ? `Modifier ${editingRDV.numero}` : 'Ajouter un Rendez-vous'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitRDV} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
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
                  value={formData.dateRDV}
                  onChange={e => setFormData({...formData, dateRDV: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heureRDV">Heure RDV</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="heureRDV"
                    type="time"
                    className="pl-10"
                    value={formData.heureRDV}
                    onChange={e => setFormData({...formData, heureRDV: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <PhoneLinesEditor
                  idPrefix="rdv"
                  label="Téléphone(s) du contact"
                  lines={formData.telephoneLines}
                  onChange={(telephoneLines) => setFormData({ ...formData, telephoneLines })}
                />
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
                  onValueChange={val => setFormData({...formData, pieceJointe: val as RDVFormData['pieceJointe']})}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  {editingRDV ? 'Enregistrer les modifications' : 'Enregistrer le RDV'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border border-rose-500/20 shadow-lg bg-card overflow-hidden">
        <CardHeader className="pb-4 bg-rose-500/5 border-b border-rose-500/15">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl flex items-center gap-2 text-rose-950 dark:text-rose-100">
              <Calendar className="w-5 h-5 text-rose-600" />
              Répertoire des Rendez-vous
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filtrer par N° RDV…" 
                  className="pl-10 bg-background/50 border-muted"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={hasActiveFilters ? 'secondary' : 'outline'}
                    size="icon"
                    className="shrink-0"
                    title="Filtres avancés"
                    aria-label="Filtres avancés"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-4" align="end">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Filtres</p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={resetFilters}>
                        <X className="w-3 h-3" />
                        Réinitialiser
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-societe">Société</Label>
                    <Input
                      id="filter-societe"
                      placeholder="Nom de société…"
                      value={filters.societe}
                      onChange={(e) => setFilters((f) => ({ ...f, societe: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pièce jointe</Label>
                    <Select
                      value={filters.pieceJointe}
                      onValueChange={(val) =>
                        setFilters((f) => ({ ...f, pieceJointe: val as RdvListFilters['pieceJointe'] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        <SelectItem value="envoyé">Envoyé</SelectItem>
                        <SelectItem value="non envoyé">Non envoyé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="filter-date-from">Date RDV du</Label>
                      <Input
                        id="filter-date-from"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filter-date-to">au</Label>
                      <Input
                        id="filter-date-to"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Exporter en CSV"
                aria-label="Exporter en CSV"
                onClick={handleDownloadCsv}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : viewMode === 'table' ? (
            <div className={cn('overflow-x-auto', COMMERCIAL_EXCEL_TABLE_CLASS)}>
              <table>
                <thead>
                  <tr>
                    <th className="w-[100px]">N° RDV</th>
                    <th>Date création</th>
                    <th className="min-w-[150px]">Société</th>
                    <th>Activité</th>
                    <th className="min-w-[200px]">Adresse</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Date RDV</th>
                    <th className="min-w-[200px]">Besoin</th>
                    <th>P. jointe</th>
                    <th>Compte utilisateur</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRdvs.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="h-32 text-center text-muted-foreground italic bg-background">
                        Aucun rendez-vous trouvé. Cliquez sur « Nouveau RDV » pour commencer.
                      </td>
                    </tr>
                  ) : (
                    rdvsPage.map((rdv) => (
                      <tr key={rdv.id}>
                        <td className="font-mono text-xs font-bold text-rose-700 dark:text-rose-300">{rdv.numero}</td>
                        <td className="text-xs whitespace-nowrap">{rdv.dateCreation}</td>
                        <td className="font-medium">{rdv.societe}</td>
                        <td className="text-xs">{rdv.activite}</td>
                        <td className="text-xs max-w-[200px] truncate" title={rdv.adresse}>{rdv.adresse}</td>
                        <td className="text-xs max-w-[180px]" title={formatPhonesDisplay(rdv.telephone)}>
                          {formatPhonesDisplay(rdv.telephone) || '—'}
                        </td>
                        <td className="text-xs">{rdv.email}</td>
                        <td className="text-xs">{rdv.personneContactee}</td>
                        <td>
                          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200">
                            {rdv.dateRDV ? formatAppDateTime(rdv.dateRDV) : '—'}
                          </Badge>
                        </td>
                        <td className="text-xs italic text-muted-foreground max-w-[200px] truncate" title={rdv.besoin}>
                          {rdv.besoin}
                        </td>
                        <td>
                          {rdv.pieceJointe === 'envoyé' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 gap-1">
                              <FileCheck className="w-3 h-3" />
                              Envoyé
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 gap-1">
                              <FileX className="w-3 h-3" />
                              Non envoyé
                            </Badge>
                          )}
                        </td>
                        <td className="text-xs font-semibold">
                          {chargeDisplayByRaw[rdv.charge] ?? rdv.charge}
                        </td>
                        <td className="text-right w-[52px]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Actions sur le rendez-vous"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => handleEditRDV(rdv)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(rdv)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="px-4 pb-4">
                <ListPagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  from={from}
                  to={to}
                  onPageChange={setPage}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row h-[600px]">
              <div className="p-6 border-l border-border bg-muted/20">
                <UICalendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border shadow-sm bg-background"
                  locale={fr}
                  modifiers={{
                    appointment: appointmentsDates
                  }}
                  modifiersStyles={{
                    appointment: { 
                      fontWeight: 'bold', 
                      backgroundColor: 'var(--primary)', 
                      color: 'white',
                      borderRadius: '4px'
                    }
                  }}
                />
              </div>
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="font-bold text-lg">
                    {selectedDate ? formatAppDate(selectedDate) : 'Sélectionnez une date'}
                  </h3>
                  <Badge variant="outline">{rdvsOnSelectedDate.length} RDV</Badge>
                </div>

                <div className="space-y-3">
                  {rdvsOnSelectedDate.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground italic">
                      Aucun rendez-vous prévu pour cette date.
                    </div>
                  ) : (
                    rdvsOnSelectedDate.map(rdv => (
                      <div key={rdv.id} className="p-4 rounded-xl border bg-background hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-primary">{rdv.societe}</p>
                            <p className="text-xs text-muted-foreground">{rdv.activite}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {format(parseISO(rdv.dateRDV), 'HH:mm')}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">{rdv.numero}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span>{rdv.personneContactee}</span>
                          </div>
                          <div className="flex items-center gap-2 col-span-2">
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="break-words">{formatPhonesDisplay(rdv.telephone) || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate">{rdv.adresse}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground line-clamp-2">
                          {rdv.besoin}
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditRDV(rdv)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(rdv)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Le rendez-vous ${deleteTarget.numero} (${deleteTarget.societe}) sera définitivement supprimé. Cette action est irréversible.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteRDV();
              }}
            >
              {isDeleting ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
