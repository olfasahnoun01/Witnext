import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import type { AssignedRole, FluxDossierDetail, FluxStep } from '../types/dossierTypes';
import { FLUX_STEP_LABELS, fluxHealthLabel, fluxStepStatusLabel } from '../types/dossierTypes';
import { useFluxDossierDetail } from '../hooks/useFluxDossierDetail';
import { DossierTimeline } from './DossierTimeline';
import { MissingDocumentsAlert } from './MissingDocumentsAlert';
import {
  addDossierNote,
  confirmClientReceived,
  confirmPreparationDone,
  confirmClientOrder,
  validateBeDocument,
  validateBsDocument,
} from '../services/fluxActions';
import { assignDossier } from '../services/dossierRepository';
import { resolveUserIdsWithSectionAccess } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';

interface DossierDetailDrawerProps {
  dossierId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function DossierDetailDrawer({ dossierId, onClose, onUpdated }: DossierDetailDrawerProps) {
  const { currentCompanyId } = useAppCompany();
  const companyId = currentCompanyId;
  const { detail, events, loading, reload } = useFluxDossierDetail(companyId, dossierId);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRole, setAssignRole] = useState<AssignedRole>('commercial');
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [userOptions, setUserOptions] = useState<{ id: string; name: string }[]>([]);
  const [acting, setActing] = useState(false);

  if (!dossierId) return null;

  const runAction = async (fn: () => Promise<void>) => {
    setActing(true);
    try {
      await fn();
      toast.success('Action enregistrée');
      await reload();
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActing(false);
    }
  };

  const openAssign = async () => {
    const ids = await resolveUserIdsWithSectionAccess('ventes');
    const { data } = await supabase.rpc('get_notification_directory');
    const directory = (data ?? []) as { user_id: string; full_name: string }[];
    setUserOptions(
      directory.filter((u) => ids.includes(u.user_id)).map((u) => ({ id: u.user_id, name: u.full_name }))
    );
    setAssignOpen(true);
  };

  const primaryAction = (d: FluxDossierDetail): { label: string; action: () => Promise<void> } | null => {
    const blocked = d.blockedAt;
    if (!blocked || !companyId) return null;
    switch (blocked) {
      case 'confirmation':
        return { label: 'Confirmer commande client', action: () => confirmClientOrder(d.id, companyId) };
      case 'reception_stock':
        if (d.steps.find((s) => s.key === 'reception_stock')?.ref?.module === 'documents') {
          const docId = d.steps.find((s) => s.key === 'reception_stock')!.ref!.id;
          return { label: 'Valider bon d\'entrée stock', action: () => validateBeDocument(d.id, companyId, docId) };
        }
        return null;
      case 'preparation':
        return { label: 'Marquer préparation terminée', action: () => confirmPreparationDone(d.id, companyId) };
      case 'sortie_stock':
        if (d.steps.find((s) => s.key === 'sortie_stock')?.ref?.module === 'documents') {
          const docId = d.steps.find((s) => s.key === 'sortie_stock')!.ref!.id;
          return { label: 'Valider sortie stock (BS)', action: () => validateBsDocument(d.id, companyId, docId) };
        }
        return null;
      case 'livraison_confirmee':
        return { label: 'Confirmer reçu client', action: () => confirmClientReceived(d.id, companyId) };
      default:
        return null;
    }
  };

  const action = detail && companyId ? primaryAction(detail) : null;

  return (
    <Dialog open={!!dossierId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {loading || !detail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>{detail.client_name ?? detail.fournisseur_name}</span>
                <Badge variant="outline">{detail.dossier_number}</Badge>
                <Badge>{fluxHealthLabel(detail.health)}</Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                BC : {detail.bc_reference ?? '—'}
                {detail.devis_reference ? ` · Devis : ${detail.devis_reference}` : ''}
              </p>
            </DialogHeader>

            <MissingDocumentsAlert labels={detail.missingDocumentLabels} />

            <DossierTimeline steps={detail.steps} />

            <div className="flex flex-wrap gap-2">
              {action && (
                <Button disabled={acting} onClick={() => runAction(action.action)}>
                  {action.label}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
                Ajouter une note
              </Button>
              <Button variant="outline" size="sm" onClick={() => void openAssign()}>
                <UserPlus className="w-4 h-4 mr-1" /> Assigner
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void reload()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-semibold">Historique</h4>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement.</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
                  {events.map((ev) => (
                    <li key={ev.id} className="border-l-2 border-muted pl-3 py-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString('fr-FR')}
                      </span>
                      <p>{ev.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {detail.steps
                .filter((s) => s.ref)
                .map((s) => (
                  <StepRefCard key={s.key} step={s} />
                ))}
            </div>
          </>
        )}

        <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Note de suivi</DialogTitle>
            </DialogHeader>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} />
            <DialogFooter>
              <Button
                onClick={() =>
                  runAction(async () => {
                    if (!dossierId || !noteText.trim()) return;
                    await addDossierNote(dossierId, noteText.trim());
                    setNoteText('');
                    setNoteOpen(false);
                  })
                }
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assigner le dossier</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Rôle responsable</Label>
                <Select value={assignRole} onValueChange={(v) => setAssignRole(v as AssignedRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="achats">Achats</SelectItem>
                    <SelectItem value="magasin">Magasin</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Utilisateur</Label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {userOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() =>
                  runAction(async () => {
                    if (!dossierId) return;
                    await assignDossier(dossierId, assignUserId || null, assignRole);
                    setAssignOpen(false);
                  })
                }
              >
                Assigner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function StepRefCard({ step }: { step: FluxStep }) {
  return (
    <div className="rounded-lg border p-2 bg-muted/30">
      <p className="font-medium text-[10px] uppercase text-muted-foreground">{FLUX_STEP_LABELS[step.key]}</p>
      <p className="font-mono truncate">{step.ref?.numero}</p>
      <p className="text-muted-foreground">{fluxStepStatusLabel(step.status)}</p>
    </div>
  );
}
