import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPayrollMoney, PAYROLL_MONTH_LABELS, type PayrollSlipRow } from './payrollTypes';
import {
  buildCnssDeclarationLines,
  computeTfpFoprolos,
  quarterLabel,
  type CnssDeclarationLine,
} from './tunisiaPayroll';

export function downloadPayrollSlipsPdf(
  slips: PayrollSlipRow[],
  title: string,
  filename?: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  doc.setFontSize(12);
  doc.text(title, 14, 12);

  autoTable(doc, {
    startY: 16,
    head: [
      [
        'Mois',
        'Matricule',
        'Nom',
        'Prénom',
        'TxH',
        'J/HT',
        'Nb.H',
        'H.supp',
        'Congé',
        'Férié',
        'Sal. base',
        'Primes',
        'Sal. brut',
        'CNSS',
        'Sal. impos.',
        'IRPP',
        'CSS',
        'Sal. net',
        'Avance',
        'Prêts',
        'Pénal.',
        'Net à payer',
      ],
    ],
    body: slips.map((s) => [
      '',
      s.matricule_cnss,
      s.employee?.nom || '',
      s.employee?.prenom || '',
      formatPayrollMoney(s.taux_horaire),
      String(s.jours_ht),
      String(s.nb_heures),
      String(s.nb_heures_supp),
      String(s.jours_conge),
      String(s.jours_ferie),
      formatPayrollMoney(s.salaire_base),
      formatPayrollMoney(s.primes),
      formatPayrollMoney(s.salaire_brut),
      formatPayrollMoney(s.cnss_salariale),
      formatPayrollMoney(s.salaire_imposable),
      formatPayrollMoney(s.irpp),
      formatPayrollMoney(s.css),
      formatPayrollMoney(s.salaire_net),
      formatPayrollMoney(s.avances),
      formatPayrollMoney(s.prets),
      formatPayrollMoney(s.penalites),
      formatPayrollMoney(s.net_a_payer),
    ]),
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [99, 102, 241], fontSize: 6 },
    theme: 'grid',
  });

  doc.save(filename || 'fiches_paie.pdf');
}

export function downloadCnssDeclarationPdf(params: {
  companyName: string;
  year: number;
  quarter: number;
  lines: CnssDeclarationLine[];
  totalBrut: number;
}) {
  const doc = new jsPDF();
  const { tfp, foprolos } = computeTfpFoprolos(params.totalBrut);
  const totalCnss = params.lines.reduce((s, l) => s + l.montantAPayer, 0);

  doc.setFontSize(14);
  doc.text(`Déclaration CNSS — ${quarterLabel(params.quarter, params.year)}`, 14, 16);
  doc.setFontSize(10);
  doc.text(params.companyName, 14, 24);

  autoTable(doc, {
    startY: 30,
    head: [['Nature', 'Salaire déclaré', 'Taux cotisation', 'Montant à payer']],
    body: [
      ...params.lines.map((l) => [
        l.nature,
        formatPayrollMoney(l.salaireDeclare),
        `${l.tauxCotisation.toFixed(2)} %`,
        formatPayrollMoney(l.montantAPayer),
      ]),
      ['Total CNSS', '', '', formatPayrollMoney(totalCnss)],
    ],
    theme: 'grid',
  });

  const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
  doc.text(`TFP (2 %) : ${formatPayrollMoney(tfp)}`, 14, y + 12);
  doc.text(`FOPROLOS (1 %) : ${formatPayrollMoney(foprolos)}`, 14, y + 20);
  doc.text(`Total salaires bruts trimestre : ${formatPayrollMoney(params.totalBrut)}`, 14, y + 28);

  doc.save(`cnss_${params.year}_T${params.quarter}.pdf`);
}

export function payrollSlipsPdfTitle(year: number, month: number, companyName: string) {
  return `Fiches de paie — ${PAYROLL_MONTH_LABELS[month - 1]} ${year} — ${companyName}`;
}

export { buildCnssDeclarationLines };
