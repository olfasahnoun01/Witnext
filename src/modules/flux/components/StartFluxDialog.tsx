import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Loader2, Play, Truck, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  fetchFluxParties,
  fetchPartyFluxDocuments,
  fluxDocumentKindLabel,
  type FluxDirection,
  type FluxDocumentOption,
  type FluxPartyOption,
} from '../services/fluxClientDocuments';
import { startFluxDossier } from '../services/dossierRepository';

type PartyMode = 'liste' | 'libre';

interface StartFluxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onStarted: (dossierId: string) => void;
}

export function StartFluxDialog({ open, onOpenChange, companyId, onStarted }: StartFluxDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<FluxDirection>('vente');
  const [partyMode, setPartyMode] = useState<PartyMode>('liste');
  const [parties, setParties] = useState<FluxPartyOption[]>([]);
  const [selectedPartyKey, setSelectedPartyKey] = useState<string>('');
  const [freePartyName, setFreePartyName] = useState('');
  const [docFilter, setDocFilter] = useState('');
  const [documents, setDocuments] = useState<FluxDocumentOption[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FluxDocumentOption | null>(null);
  const [loadingParties, setLoadingParties] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const partyLabel = direction === 'vente' ? 'Client' : 'Fournisseur';
  const isClient = direction === 'vente';

  const reset = useCallback(() => {
    setStep(1);
    setDirection('vente');
    setPartyMode('liste');
    setSelectedPartyKey('');
    setFreePartyName('');
    setDocFilter('');
    setDocuments([]);
    setSelectedDoc(null);
  }, []);

  const loadParties = useCallback(async () => {
    setLoadingParties(true);
    try {
      const list = await fetchFluxParties(companyId, direction);
      setParties(list);
      setSelectedPartyKey('');
    } catch {
      toast.error(`Impossible de charger les ${partyLabel.toLowerCase()}s`);
    } finally {
      setLoadingParties(false);
    }
  }, [companyId, direction, partyLabel]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    void loadParties();
  }, [open, loadParties, reset]);

  const selectedParty = useMemo(
    () => parties.find((p) => partyKey(p) === selectedPartyKey) ?? null,
    [parties, selectedPartyKey]
  );

  const partyName = useMemo(() => {
    if (partyMode === 'libre') return freePartyName.trim();
    return selectedParty?.nom.trim() ?? '';
  }, [partyMode, freePartyName, selectedParty]);

  const partyId = partyMode === 'liste' && selectedParty?.id != null ? selectedParty.id : null;

  const canContinueStep1 =
    partyMode === 'libre' ? freePartyName.trim().length >= 2 : selectedPartyKey !== '';

  const loadDocuments = useCallback(async () => {
    if (!partyName) return;
    setLoadingDocs(true);
    setSelectedDoc(null);
    try {
      const docs = await fetchPartyFluxDocuments(companyId, direction, partyName, partyId);
      setDocuments(docs);
      if (docs.length === 0) {
        toast.info(`Aucune pièce trouvée pour ce ${partyLabel.toLowerCase()}`, {
          description: 'Les noms issus des devis existants sont listés à l\'étape 1.',
        });
      }
    } catch (e) {
      toast.error('Erreur lors du chargement des documents', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoadingDocs(false);
    }
  }, [companyId, direction, partyName, partyId, partyLabel]);

  const goToStep2 = () => {
    if (!canContinueStep1) return;
    setStep(2);
    void loadDocuments();
  };

  const filteredDocs = useMemo(() => {
    const q = docFilter.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.numero.toLowerCase().includes(q) ||
        d.label.toLowerCase().includes(q) ||
        fluxDocumentKindLabel(d.kind).toLowerCase().includes(q)
    );
  }, [documents, docFilter]);

  const groupedDocs = useMemo(() => {
    const groups: Record<string, FluxDocumentOption[]> = {};
    for (const d of filteredDocs) {
      const key = fluxDocumentKindLabel(d.kind);
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }
    return groups;
  }, [filteredDocs]);

  const handleStart = async () => {
    if (!selectedDoc || !partyName) return;
    setSubmitting(true);
    try {
      const row = await startFluxDossier({
        companyId,
        direction,
        partyName,
        clientId: isClient ? partyId : null,
        fournisseurId: !isClient ? partyId : null,
        document: selectedDoc,
      });
      toast.success(`Flux ${row.dossier_number} démarré`);
      onStarted(row.id);
      onOpenChange(false);
    } catch (e) {
      toast.error('Impossible de démarrer le flux', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Démarrer un flux
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Clients et fournisseurs sont proposés depuis la liste officielle et les devis déjà saisis.'
              : `Pièces pour « ${partyName} »`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Type de flux</Label>
              <RadioGroup
                value={direction}
                onValueChange={(v) => {
                  setDirection(v as FluxDirection);
                  setSelectedPartyKey('');
                  setFreePartyName('');
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="vente" id="flux-vente" />
                  <Label htmlFor="flux-vente" className="font-normal cursor-pointer flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> Client (vente)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="achat" id="flux-achat" />
                  <Label htmlFor="flux-achat" className="font-normal cursor-pointer flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Fournisseur (achat)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>{partyLabel}</Label>
              <RadioGroup
                value={partyMode}
                onValueChange={(v) => setPartyMode(v as PartyMode)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="liste" id="party-liste" />
                  <Label htmlFor="party-liste" className="font-normal cursor-pointer">
                    Liste ({parties.length})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="libre" id="party-libre" />
                  <Label htmlFor="party-libre" className="font-normal cursor-pointer">
                    Saisie libre
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {partyMode === 'liste' ? (
              <div className="space-y-2">
                <Label htmlFor="party-select">{partyLabel}</Label>
                {loadingParties ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                ) : (
                  <Select value={selectedPartyKey} onValueChange={setSelectedPartyKey}>
                    <SelectTrigger id="party-select" className="h-11">
                      <SelectValue placeholder={`Sélectionner un ${partyLabel.toLowerCase()}…`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {parties.map((p) => (
                        <SelectItem key={partyKey(p)} value={partyKey(p)}>
                          <span className="flex items-center gap-2">
                            {p.nom}
                            {p.source === 'devis' && (
                              <span className="text-[10px] text-muted-foreground">(devis)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {parties.some((p) => p.source === 'devis') && (
                  <p className="text-xs text-muted-foreground">
                    Les entrées « devis » proviennent des tiers déjà renseignés sur vos devis / BC.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="party-free">{partyLabel} (saisie libre)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="party-free"
                    className="pl-9 h-11"
                    placeholder={isClient ? 'Ex. STE ABC SARL' : 'Ex. Fournisseur XYZ'}
                    value={freePartyName}
                    onChange={(e) => setFreePartyName(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 flex-1 min-h-0 flex flex-col">
            <Input
              placeholder="Filtrer par N° ou type…"
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
            />

            {loadingDocs ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Recherche des pièces…
              </div>
            ) : filteredDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune pièce pour ce {partyLabel.toLowerCase()}.
              </p>
            ) : (
              <ScrollArea className="flex-1 max-h-[340px] pr-3">
                <div className="space-y-4">
                  {Object.entries(groupedDocs).map(([group, items]) => (
                    <div key={group}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {group}
                      </p>
                      <div className="space-y-1">
                        {items.map((doc) => (
                          <button
                            key={`${doc.kind}-${doc.id}`}
                            type="button"
                            onClick={() => setSelectedDoc(doc)}
                            className={cn(
                              'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                              selectedDoc?.id === doc.id && selectedDoc?.kind === doc.kind
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:bg-muted/50'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{doc.numero}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {doc.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {doc.date}
                              {doc.status ? ` · ${doc.status}` : ''}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
          )}
          {step === 1 ? (
            <Button type="button" onClick={goToStep2} disabled={!canContinueStep1}>
              Continuer <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleStart()} disabled={!selectedDoc || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Création…
                </>
              ) : (
                <>
                  Démarrer le flux <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function partyKey(p: FluxPartyOption): string {
  return `${p.kind}-${p.id ?? 'devis'}-${normPartyKey(p.nom)}`;
}

function normPartyKey(nom: string): string {
  return nom.trim().toLowerCase().replace(/\s+/g, '-');
}
