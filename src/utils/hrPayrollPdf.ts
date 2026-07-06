import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatAppDate } from '@/lib/formatAppDate';
import { formatHrMoney, type HrEmployee } from '@/lib/hrTypes';

export type PayrollPdfRow = {
  employee: HrEmployee;
  totalAvances: number;
  totalPenalites: number;
  netApres: number;
};

export function buildPayrollPdf(params: {
  rows: PayrollPdfRow[];
  totalAvances: number;
  totalPenalites: number;
  periodLabel?: string;
}): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text('Salaires, avances et pénalités', 14, 14);
  doc.setFontSize(10);
  doc.text(params.periodLabel || `Généré le ${formatAppDate(new Date())}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [
      [
        'N°',
        'Nom',
        'Prénom',
        'Salaire net',
        'Total avances',
        'Total pénalités',
        'Net à payer',
      ],
    ],
    body: params.rows.map((r, i) => [
      String(i + 1),
      r.employee.nom,
      r.employee.prenom,
      formatHrMoney(r.employee.salaire_net),
      `-${formatHrMoney(r.totalAvances)}`,
      `-${formatHrMoney(r.totalPenalites)}`,
      formatHrMoney(r.netApres),
    ]),
    foot: [
      [
        '',
        '',
        'TOTAUX',
        formatHrMoney(params.rows.reduce((s, r) => s + r.employee.salaire_net, 0)),
        `-${formatHrMoney(params.totalAvances)}`,
        `-${formatHrMoney(params.totalPenalites)}`,
        formatHrMoney(
          params.rows.reduce((s, r) => s + r.netApres, 0)
        ),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [80, 80, 80] },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    theme: 'grid',
  });

  return doc;
}

export function downloadPayrollPdf(params: Parameters<typeof buildPayrollPdf>[0], filename?: string) {
  const doc = buildPayrollPdf(params);
  doc.save(filename || `rh_salaires_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function printPayrollPdf(params: Parameters<typeof buildPayrollPdf>[0]) {
  const doc = buildPayrollPdf(params);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
