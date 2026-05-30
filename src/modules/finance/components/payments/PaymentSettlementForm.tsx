import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Printer, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BANQUES_TUNISIE } from '../../lib/constants';
import { formatMontantDt, parseMontantInput } from '../../lib/money';
import { FinanceAmount } from '../shared/FinanceAmount';
import type { CounterpartyOption, ModeReglement, ReglementStatus, SettlementDirection } from '../../types/paymentTypes';
import type { LetterageLine, TreasuryAccount } from '../../types/financeDomain';
import {
  buildLetterageFromDocuments,
  calculerMontantRs,
  computeLetterageTotals,
  isRetenueSourceRequise,
  solderAutomatiquement,
} from '../../services/financeService';
import { fetchUnpaidInvoicesForCounterparty, submitSettlement } from '../../services/paymentApi';
import { listAvoirsForCounterparty } from '../../services/avoirApi';
import { loadTreasuryAccounts } from '../../services/treasuryStorage';
import { generateNumeroPiece, validateSettlementInput } from '../../services/paymentService';
import { CounterpartyCombobox } from './CounterpartyCombobox';
import { FinanceLetterageTable } from './FinanceLetterageTable';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import {
  buildTraiteDataFromForm,
  buildTraiteDataFromPaymentId,
  openTraitePdfPrint,
} from '../../services/traitePdfService';

interface PaymentSettlementFormProps {
  companyId: string;
  direction: SettlementDirection;
  counterparties: CounterpartyOption[];
  onSuccess?: () => void;
}

const MODES: { value: ModeReglement; label: string }[] = [
  { value: 'ESPECE', label: 'Espèce' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'TRAITE', label: 'Traite' },
  { value: 'PRELEVEMENT', label: 'Prélèvement' },
  { value: 'REMISE', label: 'Remise' },
  { value: 'PROFIT', label: 'Profit' },
];

/**
 * Règlement client / paiement fournisseur — lettrage, avoirs, RS, compte trésorerie.
 */
export function PaymentSettlementForm({
  companyId,
  direction,
  counterparties,
  onSuccess,
}: PaymentSettlementFormProps) {
  const { company } = useFinanceCompany();
  const amountKind = direction === 'client' ? 'income' : 'charge';
  const [counterparty, setCounterparty] = useState<CounterpartyOption | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [numeroPiece] = useState(() => generateNumeroPiece(direction));
  const [mode, setMode] = useState<ModeReglement>('VIREMENT');
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [accounts, setAccounts] = useState<TreasuryAccount[]>(() => loadTreasuryAccounts(companyId));
  const [montantTotal, setMontantTotal] = useState('');
  const [pieceNumero, setPieceNumero] = useState('');
  const [banque, setBanque] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [reglementStatus, setReglementStatus] = useState<ReglementStatus>('PAYEE');
  const [notes, setNotes] = useState('');
  const [letterageLines, setLetterageLines] = useState<LetterageLine[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [withholdingRate, setWithholdingRate] = useState('1');
  const [busy, setBusy] = useState(false);
  const [caisseError, setCaisseError] = useState<string | null>(null);

  const title = direction === 'client' ? 'Règlement client' : 'Paiement fournisseur';
  const invoiceType = direction === 'client' ? 'vente' : 'achat';
  const avoirType = invoiceType;

  const selectableAccounts = useMemo(
    () => accounts.filter((a) => a.actif && a.type !== 'ATTENTE_EFFETS'),
    [accounts]
  );

  useEffect(() => {
    if (!treasuryAccountId && selectableAccounts.length > 0) {
      const def =
        mode === 'ESPECE'
          ? selectableAccounts.find((a) => a.type === 'CAISSE')
          : selectableAccounts.find((a) => a.type === 'BANQUE');
      setTreasuryAccountId(def?.id ?? selectableAccounts[0].id);
    }
  }, [selectableAccounts, treasuryAccountId, mode]);

  const loadDocuments = useCallback(async () => {
    if (!counterparty) {
      setLetterageLines([]);
      return;
    }
    setLoadingDocs(true);
    try {
      const [invoices, avoirs] = await Promise.all([
        fetchUnpaidInvoicesForCounterparty(companyId, invoiceType, counterparty),
        Promise.resolve(listAvoirsForCounterparty(companyId, avoirType, counterparty.id)),
      ]);
      setLetterageLines(buildLetterageFromDocuments(invoices, avoirs));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement impossible');
      setLetterageLines([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [companyId, counterparty, invoiceType, avoirType]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const montantTotalNum = parseMontantInput(montantTotal) ?? 0;
  const selectedAccount = accounts.find((a) => a.id === treasuryAccountId);

  const factureBrut = useMemo(
    () =>
      letterageLines
        .filter((l) => l.kind === 'FACTURE' && l.selected)
        .reduce((s, l) => s + l.montantAImputer, 0),
    [letterageLines]
  );

  const retenueMontant = useMemo(() => {
    if (direction !== 'fournisseur' || !isRetenueSourceRequise(factureBrut)) return 0;
    const taux = Number(withholdingRate) || 1;
    return letterageLines
      .filter((l) => l.kind === 'FACTURE' && l.selected && l.montantAImputer > 0)
      .reduce((s, l) => s + calculerMontantRs(l.montantAImputer, taux), 0);
  }, [letterageLines, factureBrut, withholdingRate, direction]);

  const totals = useMemo(
    () => computeLetterageTotals(montantTotalNum, letterageLines, retenueMontant),
    [montantTotalNum, letterageLines, retenueMontant]
  );

  const showEffetFields = mode === 'CHEQUE' || mode === 'TRAITE';
  const isTraite = mode === 'TRAITE';

  useEffect(() => {
    if (mode === 'CHEQUE' || mode === 'TRAITE') {
      setReglementStatus('EN_COURS');
    } else if (mode === 'PRELEVEMENT') {
      setReglementStatus('EN_COURS');
    } else {
      setReglementStatus('PAYEE');
    }
  }, [mode]);

  const canPreviewTraite =
    isTraite &&
    company &&
    counterparty &&
    pieceNumero.trim() &&
    banque &&
    dateEcheance &&
    montantTotalNum > 0;

  const invoiceRefsForTraite = useMemo(
    () =>
      letterageLines
        .filter((l) => l.selected && l.kind === 'FACTURE')
        .map((l) => l.numero),
    [letterageLines]
  );

  const handlePreviewTraite = () => {
    if (!company || !counterparty || !canPreviewTraite) {
      toast.error('Complétez le tiers, montant, N° traite, banque et échéance.');
      return;
    }
    try {
      const data = buildTraiteDataFromForm({
        company,
        companyId,
        direction,
        counterparty,
        numeroPiece,
        pieceNumero: pieceNumero.trim(),
        montant: montantTotalNum,
        paymentDate,
        dateEcheance,
        banque,
        treasuryAccountId,
        invoiceReferences: invoiceRefsForTraite,
        notes,
      });
      openTraitePdfPrint(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aperçu impossible');
    }
  };

  useEffect(() => {
    setCaisseError(null);
    if (
      mode === 'ESPECE' &&
      direction === 'fournisseur' &&
      selectedAccount?.type === 'CAISSE' &&
      montantTotalNum > selectedAccount.soldeActuel + 0.0001
    ) {
      setCaisseError(
        `Fonds insuffisants en caisse : disponible ${formatMontantDt(selectedAccount.soldeActuel)}, demandé ${formatMontantDt(montantTotalNum)}.`
      );
    }
  }, [mode, direction, selectedAccount, montantTotalNum]);

  const handleAutoSettle = () => {
    const m = parseMontantInput(montantTotal);
    if (m == null || m <= 0) {
      toast.error("Saisissez d'abord le montant total du règlement.");
      return;
    }
    setLetterageLines(solderAutomatiquement(m, letterageLines));
    toast.success('Montant réparti du plus ancien au plus récent.');
  };

  const handleSubmit = async () => {
    const montant = parseMontantInput(montantTotal);
    if (montant == null) {
      toast.error('Montant total invalide.');
      return;
    }
    if (!counterparty || !treasuryAccountId) {
      toast.error('Tiers et compte de trésorerie obligatoires.');
      return;
    }
    if (caisseError) {
      toast.error(caisseError);
      return;
    }

    const hasAllocation = letterageLines.some((l) => l.selected && l.montantAImputer > 0);
    if (!hasAllocation) {
      toast.error('Sélectionnez au moins une ligne à imputer.');
      return;
    }

    const invoiceRows = letterageLines
      .filter((l) => l.kind === 'FACTURE' && l.invoice)
      .map((l) => ({
        invoice: l.invoice!,
        montantInitialTtc: l.montantTtc,
        resteAPayer: l.resteAPayer,
        montantAImputer: l.montantAImputer,
        selected: l.selected,
      }));

    if (invoiceRows.some((r) => r.selected)) {
      const validation = validateSettlementInput({
        montantTotalSaisi: montant,
        rows: invoiceRows,
        mode,
        direction,
        soldeCaisse: selectedAccount?.type === 'CAISSE' ? selectedAccount.soldeActuel : undefined,
        pieceNumero,
        banque,
        dateEcheance,
      });
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }
    }

    const allocations = letterageLines
      .filter((l) => l.selected && l.montantAImputer > 0)
      .map((l) => ({
        documentId: l.id,
        kind: l.kind,
        amount: l.montantAImputer,
      }));

    setBusy(true);
    try {
      const paymentId = await submitSettlement({
        companyId,
        direction,
        treasuryAccountId,
        counterparty,
        paymentDate,
        montantTotal: montant,
        mode,
        pieceNumero: showEffetFields ? pieceNumero : undefined,
        banque: showEffetFields ? banque : undefined,
        dateEcheance: dateEcheance || undefined,
        reglementStatus,
        userNotes: notes,
        withholdingAmount: retenueMontant,
        withholdingRate: Number(withholdingRate),
        allocations,
      });
      toast.success(`${title} enregistré — ${numeroPiece}`);
      if (isTraite && company) {
        try {
          const traiteData = await buildTraiteDataFromPaymentId(paymentId, company);
          openTraitePdfPrint(traiteData);
          toast.message('Impression de la lettre de change', {
            description: 'Signez le tireur et obtenez l’acceptation du tiré après impression.',
          });
        } catch {
          toast.message('Traite enregistrée — utilisez le portefeuille effets pour réimprimer.');
        }
      }
      setAccounts(loadTreasuryAccounts(companyId));
      setMontantTotal('');
      setLetterageLines([]);
      setCounterparty(null);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            Pièce {numeroPiece} — lettrage factures et avoirs, net après RS (fournisseur).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tiers *</Label>
              <CounterpartyCombobox
                options={counterparties}
                value={counterparty}
                onChange={setCounterparty}
              />
            </div>
            <div className="space-y-2">
              <Label>Date opération</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Compte de trésorerie *</Label>
              <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Compte" />
                </SelectTrigger>
                <SelectContent>
                  {selectableAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nom} ({a.type}) — {formatMontantDt(a.soldeActuel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant total *</Label>
              <Input
                inputMode="decimal"
                placeholder="0,000"
                value={montantTotal}
                onChange={(e) => setMontantTotal(e.target.value)}
              />
            </div>
          </div>

          {caisseError && (
            <Alert variant="destructive">
              <AlertDescription>{caisseError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label>Mode de règlement</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ModeReglement)}
              className="flex flex-wrap gap-4"
            >
              {MODES.map((m) => (
                <div key={m.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={m.value} id={`mode-${m.value}`} />
                  <Label htmlFor={`mode-${m.value}`} className="font-normal cursor-pointer">
                    {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2 p-4 rounded-lg border bg-muted/20">
            <div className="space-y-2">
              <Label>Date échéance</Label>
              <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
              <p className="text-xs text-muted-foreground">Pour le suivi mensuel des échéances à payer.</p>
            </div>
            <div className="space-y-2">
              <Label>Statut du règlement</Label>
              <Select value={reglementStatus} onValueChange={(v) => setReglementStatus(v as ReglementStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYEE">Payée</SelectItem>
                  <SelectItem value="EN_COURS">En cours</SelectItem>
                  <SelectItem value="IMPAYEE">Impayée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showEffetFields && (
            <div className="space-y-3">
              <div className="grid gap-4 md:grid-cols-3 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-2">
                  <Label>N° chèque / traite *</Label>
                  <Input value={pieceNumero} onChange={(e) => setPieceNumero(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Banque émettrice *</Label>
                  <Select value={banque} onValueChange={setBanque}>
                    <SelectTrigger>
                      <SelectValue placeholder="Banque" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANQUES_TUNISIE.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Échéance pièce *</Label>
                  <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
                </div>
              </div>
              {isTraite && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!canPreviewTraite}
                    onClick={handlePreviewTraite}
                  >
                    <Printer className="h-4 w-4" />
                    Aperçu / Imprimer la traite
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Lettre de change conforme art. 269 — montant en lettres, signatures manuscrites après impression.
                  </p>
                </div>
              )}
            </div>
          )}

          {direction === 'fournisseur' && isRetenueSourceRequise(factureBrut) && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <Badge variant="outline">Retenue à la source</Badge>
              <Select value={withholdingRate} onValueChange={setWithholdingRate}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 % — Achats courants</SelectItem>
                  <SelectItem value="1.5">1,5 % — Personne physique</SelectItem>
                  <SelectItem value="3">3 % — Honoraires réel</SelectItem>
                  <SelectItem value="10">10 % — Loyer</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm tabular-nums">
                RS : <strong>{formatMontantDt(retenueMontant)}</strong> — Net :{' '}
                <strong>{formatMontantDt(totals.netAPayer)}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Lettrage</CardTitle>
            {loadingDocs && (
              <CardDescription className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </CardDescription>
            )}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleAutoSettle} className="gap-1">
            <Sparkles className="h-4 w-4" />
            Solder automatiquement
          </Button>
        </CardHeader>
        <CardContent>
          <FinanceLetterageTable
            lines={letterageLines}
            onChange={setLetterageLines}
            disabled={busy || !counterparty}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 border rounded-xl bg-card/95 backdrop-blur p-4 shadow-lg">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div>
            <p className="text-muted-foreground">Total saisi</p>
            <p className="text-lg font-semibold">
              <FinanceAmount amount={totals.montantSaisi} kind={amountKind} className="text-lg" />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Affecté (net)</p>
            <p className="text-lg font-semibold">
              <FinanceAmount amount={totals.montantAffecte} kind={amountKind} className="text-lg" />
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Restant</p>
            <p className="text-lg font-semibold tabular-nums">{formatMontantDt(totals.montantRestant)}</p>
          </div>
          {totals.retenueSource > 0 && (
            <div>
              <p className="text-muted-foreground">RS</p>
              <p className="text-lg font-semibold tabular-nums text-amber-700">
                {formatMontantDt(totals.retenueSource)}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Net à payer</p>
            <p className="text-lg font-bold">
              <FinanceAmount amount={totals.netAPayer} kind={amountKind} className="text-lg" />
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:justify-between">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="max-w-xl" placeholder="Notes…" />
          <Button size="lg" disabled={busy || !!caisseError} onClick={() => void handleSubmit()}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}
