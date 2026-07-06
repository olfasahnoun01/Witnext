/**
 * Export PDF — Tableau de bord fiscal mensuel (normes comptables tunisiennes).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatAppDateTime } from '@/lib/formatAppDate';
import { FISCAL_LABELS } from './fiscalTerminology';
import { formatMontantDt } from './money';
import type { FiscalPeriodSummary } from '../services/fiscalPeriodSummary';
import type { VatMonthlyDeclaration } from '../types/financeDomain';

export interface FiscalDashboardPdfData {
  companyName: string;
  moisLabel: string;
  annee: number;
  summary: FiscalPeriodSummary;
  declaration?: VatMonthlyDeclaration | null;
}

function fmtAmount(n: number | null): string {
  if (n === null) return '—';
  return formatMontantDt(n);
}

function aggregateRows(
  title: string,
  rows: VatMonthlyDeclaration['collectee']
): string[][] {
  if (rows.length === 0) return [[`${title}`, '—', '—', '—']];
  return rows.map((r) => [
    title,
    `${r.taux} %`,
    fmtAmount(r.totalHt),
    fmtAmount(r.totalTva),
  ]);
}

export function buildFiscalDashboardPdf(data: FiscalDashboardPdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const generatedAt = formatAppDateTime(new Date());

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, 297, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(88, 28, 135);
  doc.text(FISCAL_LABELS.tableauDeBordFiscal, margin, 20);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(data.companyName, margin, 28);
  doc.text(`Période : ${data.moisLabel} ${data.annee}`, margin, 34);
  doc.setFontSize(8);
  doc.text(`Généré le ${generatedAt}`, margin, 40);

  const s = data.summary;
  const summaryRows: string[][] = [
    [FISCAL_LABELS.chiffreAffairesHt, fmtAmount(s.chiffreAffairesHt)],
    [FISCAL_LABELS.tvaCollectee, fmtAmount(s.tvaCollectee)],
    [FISCAL_LABELS.tvaDeductible, fmtAmount(s.tvaDeductible)],
    s.estCredit
      ? [FISCAL_LABELS.creditTva, fmtAmount(s.creditTva)]
      : [FISCAL_LABELS.tvaNetteAPayer, fmtAmount(s.tvaNetteAPayer)],
    [FISCAL_LABELS.tclAPayer, fmtAmount(s.tclAPayer)],
    [FISCAL_LABELS.timbresFiscauxAReverser, fmtAmount(s.timbresFiscauxAReverser)],
    [FISCAL_LABELS.retenuesClientsAEncaisser, fmtAmount(s.retenuesClientsAEncaisser)],
    [FISCAL_LABELS.retenuesFournisseursAReverser, fmtAmount(s.retenuesFournisseursAReverser)],
    [FISCAL_LABELS.retenuesLoyersAReverser, fmtAmount(s.retenuesLoyersAReverser)],
  ];

  autoTable(doc, {
    startY: 46,
    head: [['Indicateur fiscal', 'Montant (DT)']],
    body: summaryRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [88, 28, 135], textColor: 255 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  let nextY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(FISCAL_LABELS.tvaFormule, margin, nextY + 8);

  if (data.declaration) {
    const d = data.declaration;
    const detailRows = [
      ...aggregateRows(FISCAL_LABELS.tvaCollectee, d.collectee),
      ...aggregateRows(`${FISCAL_LABELS.tvaDeductible} — Achats`, d.deductibleAchats),
      ...aggregateRows(`${FISCAL_LABELS.tvaDeductible} — Immob.`, d.deductibleImmobilisations),
    ];

    autoTable(doc, {
      startY: nextY + 14,
      head: [['Rubrique', 'Taux', 'Base HT', 'Montant TVA']],
      body: detailRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });

    nextY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 40;
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text(
    'Document de synthèse — à valider par votre expert-comptable avant dépôt officiel.',
    pageW / 2,
    pageH - 10,
    { align: 'center' }
  );

  return doc;
}

export function downloadFiscalDashboardPdf(data: FiscalDashboardPdfData, filename?: string): void {
  const doc = buildFiscalDashboardPdf(data);
  const slug = `${data.moisLabel}-${data.annee}`.replace(/\s+/g, '_');
  doc.save(filename ?? `tableau-fiscal-${slug}.pdf`);
}

export function openFiscalDashboardPdfPrint(data: FiscalDashboardPdfData): void {
  const doc = buildFiscalDashboardPdf(data);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      w.focus();
      w.print();
    };
  } else {
    downloadFiscalDashboardPdf(data);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
