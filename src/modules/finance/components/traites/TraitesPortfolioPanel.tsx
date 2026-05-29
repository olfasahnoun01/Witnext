import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, AlertTriangle, Building2, CheckCircle2, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { formatMontantDt } from '../../lib/money';
import { traiteStatusLabel } from '../../services/paymentService';
import { applyTraiteAction, fetchTraitesPortfolio } from '../../services/paymentApi';
import type { TraiteAction, TraitePortfolioItem } from '../../types/paymentTypes';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { buildTraiteDataFromPaymentId, openTraitePdfPrint } from '../../services/traitePdfService';

interface TraitesPortfolioPanelProps {
  companyId: string;
}

function statusBadgeVariant(
  statut: TraitePortfolioItem['statut']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (statut) {
    case 'VALIDE':
      return 'default';
    case 'IMPAYE':
      return 'destructive';
    case 'EN_BANQUE':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Suivi des traites et chèques — actions : remise en banque, validation, impayé.
 */
export function TraitesPortfolioPanel({ companyId }: TraitesPortfolioPanelProps) {
  const { company } = useFinanceCompany();
  const [items, setItems] = useState<TraitePortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingImpaye, setPendingImpaye] = useState<TraitePortfolioItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchTraitesPortfolio(companyId);
      setItems(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement du portefeuille impossible');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (paymentId: string, action: TraiteAction) => {
    setBusyId(paymentId);
    try {
      await applyTraiteAction(paymentId, action);
      const labels: Record<TraiteAction, string> = {
        REMETTRE_BANQUE: 'Effet remis en banque',
        VALIDER_ENCAISSEMENT: 'Encaissement validé — solde banque mis à jour',
        DECLARER_IMPAYE: 'Impayé déclaré — factures réouvertes',
      };
      toast.success(labels[action]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusyId(null);
      setPendingImpaye(null);
    }
  };

  const handlePrintTraite = async (paymentId: string) => {
    if (!company) {
      toast.error('Société non sélectionnée.');
      return;
    }
    setBusyId(paymentId);
    try {
      const data = await buildTraiteDataFromPaymentId(paymentId, company);
      openTraitePdfPrint(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impression impossible');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Suivi des traites et effets</CardTitle>
          <CardDescription>
            Chèques et traites en attente de maturité. L&apos;encaissement réel de la banque n&apos;est déclenché
            qu&apos;à la validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
              Aucun effet en portefeuille.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf. pièce</TableHead>
                    <TableHead>Tiers</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Banque</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.paymentId}>
                      <TableCell className="font-mono text-xs">{row.referencePiece}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{row.tiers}</TableCell>
                      <TableCell>{row.typeTiers}</TableCell>
                      <TableCell>{row.mode}</TableCell>
                      <TableCell>{row.banque ?? '—'}</TableCell>
                      <TableCell>{row.dateEcheance ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMontantDt(row.montant)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.statut)}>
                          {row.statut === 'IMPAYE' && (
                            <AlertTriangle className="h-3 w-3 mr-1 inline" />
                          )}
                          {traiteStatusLabel(row.statut)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busyId === row.paymentId}
                              aria-label="Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {row.mode === 'TRAITE' && (
                              <DropdownMenuItem onClick={() => void handlePrintTraite(row.paymentId)}>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimer la traite
                              </DropdownMenuItem>
                            )}
                            {row.statut === 'RECU_EMIS' && (
                              <DropdownMenuItem
                                onClick={() => void runAction(row.paymentId, 'REMETTRE_BANQUE')}
                              >
                                <Building2 className="h-4 w-4 mr-2" />
                                Remettre en banque
                              </DropdownMenuItem>
                            )}
                            {(row.statut === 'RECU_EMIS' || row.statut === 'EN_BANQUE') && (
                              <DropdownMenuItem
                                onClick={() => void runAction(row.paymentId, 'VALIDER_ENCAISSEMENT')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Valider l&apos;encaissement
                              </DropdownMenuItem>
                            )}
                            {row.statut !== 'IMPAYE' && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setPendingImpaye(row)}
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Déclarer impayé
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingImpaye} onOpenChange={(o) => !o && setPendingImpaye(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Déclarer un impayé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action annule le règlement virtuel, réouvre les factures lettrées et marque l&apos;effet{' '}
              <strong>Impayé</strong>. Référence : {pendingImpaye?.referencePiece}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                pendingImpaye && void runAction(pendingImpaye.paymentId, 'DECLARER_IMPAYE')
              }
            >
              Confirmer l&apos;impayé
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
