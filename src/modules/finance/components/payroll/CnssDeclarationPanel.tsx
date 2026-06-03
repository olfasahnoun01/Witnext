import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FINANCE_EXCEL_TABLE_CLASS } from '../../lib/financeStyles';
import { formatPayrollMoney } from '../../lib/payrollTypes';
import { listPayrollSlipsForMonths } from '../../services/payrollApi';
import {
  buildCnssDeclarationLines,
  computeTfpFoprolos,
  quarterLabel,
  quarterMonths,
} from '../../lib/tunisiaPayroll';
import { downloadCnssDeclarationPdf } from '../../lib/payrollSlipPdf';

const EXCEL_CELL = 'border border-border px-2 py-2 text-sm';

type Props = {
  companyId: string;
  companyName: string;
};

export function CnssDeclarationPanel({ companyId, companyName }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.floor(new Date().getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  );
  const [loading, setLoading] = useState(true);
  const [totalDeclare, setTotalDeclare] = useState(0);
  const [totalBrut, setTotalBrut] = useState(0);
  const [slipCount, setSlipCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const months = quarterMonths(quarter);
    const slips = await listPayrollSlipsForMonths(companyId, year, months);
    const declare = slips.reduce((s, r) => s + Number(r.salaire_declare_cnss), 0);
    const brut = slips.reduce((s, r) => s + Number(r.salaire_brut), 0);
    setTotalDeclare(declare);
    setTotalBrut(brut);
    setSlipCount(slips.length);
    setLoading(false);
  }, [companyId, year, quarter]);

  useEffect(() => {
    void load();
  }, [load]);

  const cnssLines = useMemo(() => buildCnssDeclarationLines(totalDeclare), [totalDeclare]);
  const charges = useMemo(() => computeTfpFoprolos(totalBrut), [totalBrut]);
  const totalCnss = cnssLines.reduce((s, l) => s + l.montantAPayer, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Déclaration CNSS (trimestrielle)</h3>
          <p className="text-sm text-muted-foreground">
            Agrégation des fiches de paie des mois du trimestre — {companyName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Année</Label>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </div>
        <div>
          <Label className="text-xs">Trimestre</Label>
          <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v) as 1 | 2 | 3 | 4)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => (
                <SelectItem key={q} value={String(q)}>
                  T{q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Actualiser
        </Button>
        <Button
          className="gap-2"
          disabled={slipCount === 0}
          onClick={() =>
            downloadCnssDeclarationPdf({
              companyName,
              year,
              quarter,
              lines: cnssLines,
              totalBrut,
            })
          }
        >
          <Download className="w-4 h-4" />
          Télécharger PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : slipCount === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
          Aucune fiche de paie pour {quarterLabel(quarter, year)}. Générez les fiches mensuelles dans
          l&apos;onglet « Fiche de paie ».
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {slipCount} fiche(s) sur {quarterMonths(quarter).length} mois — salaire déclaré CNSS cumulé :{' '}
            <strong>{formatPayrollMoney(totalDeclare)}</strong>
          </p>

          <div className={`overflow-x-auto rounded-lg border max-w-3xl ${FINANCE_EXCEL_TABLE_CLASS}`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  <th className={EXCEL_CELL}>Nature</th>
                  <th className={`${EXCEL_CELL} text-right`}>Salaire déclaré</th>
                  <th className={`${EXCEL_CELL} text-right`}>Taux cotisation</th>
                  <th className={`${EXCEL_CELL} text-right`}>Montant à payer</th>
                </tr>
              </thead>
              <tbody>
                {cnssLines.map((line) => (
                  <tr key={line.nature}>
                    <td className={EXCEL_CELL}>{line.nature}</td>
                    <td className={`${EXCEL_CELL} text-right tabular-nums`}>
                      {formatPayrollMoney(line.salaireDeclare)}
                    </td>
                    <td className={`${EXCEL_CELL} text-right`}>{line.tauxCotisation.toFixed(2)} %</td>
                    <td className={`${EXCEL_CELL} text-right tabular-nums font-medium`}>
                      {formatPayrollMoney(line.montantAPayer)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className={EXCEL_CELL} colSpan={3}>
                    Total CNSS à payer
                  </td>
                  <td className={`${EXCEL_CELL} text-right tabular-nums`}>
                    {formatPayrollMoney(totalCnss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 max-w-xl text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">TFP (2 % du salaire brut trimestre)</p>
              <p className="text-lg font-semibold tabular-nums">{formatPayrollMoney(charges.tfp)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">FOPROLOS (1 % du salaire brut trimestre)</p>
              <p className="text-lg font-semibold tabular-nums">{formatPayrollMoney(charges.foprolos)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
