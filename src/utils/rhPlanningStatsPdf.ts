import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatAppDate, formatAppDateTime } from '@/lib/formatAppDate';
import type {
  ParsedPlanningSnapshot,
  PlanningPeriodComparison,
} from '@/lib/planningExport';

const PAGE_W = 210;
const MARGIN = 25;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 282;
const META_LABEL_RIGHT_X = MARGIN + 40;
const META_COLON_X = MARGIN + 42;
const META_VALUE_X = MARGIN + 46;
const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [80, 80, 80];
const LIGHT: [number, number, number] = [245, 245, 245];

const GSS_LOGO_URL = '/gss-logo2.png';

export interface RhPlanningStatsPdfInput {
  companyName: string;
  siteName: string;
  snapshots: ParsedPlanningSnapshot[];
  comparisons: PlanningPeriodComparison[];
  generatedAt?: Date;
}

const loadImageAsDataUrl = (url: string): Promise<{ dataUrl: string; w: number; h: number } | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (v: { dataUrl: string; w: number; h: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const aspect = img.width / img.height;
      let h = 28;
      let w = h * aspect;
      if (w > 70) {
        w = 70;
        h = w / aspect;
      }
      finish({ dataUrl: canvas.toDataURL('image/png'), w, h });
    };
    img.onerror = () => finish(null);
    img.src = url;
    setTimeout(() => finish(null), 5000);
  });

function pct(n: number): string {
  return `${n.toFixed(1)} %`;
}

function fmtDelta(n: number, suffix = ''): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}${suffix}`;
}

function formatDateDdMmYyyy(isoDate: string): string {
  return formatAppDate(isoDate, isoDate);
}

function drawPageFooter(doc: jsPDF, page: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`— ${page} —`, PAGE_W / 2, FOOTER_Y, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Document confidentiel — usage interne RH', PAGE_W / 2, FOOTER_Y + 4, { align: 'center' });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 12) {
    doc.addPage();
    return MARGIN + 8;
  }
  return y;
}

function drawCenteredHeader(
  doc: jsPDF,
  logo: { dataUrl: string; w: number; h: number } | null,
  reportDate: Date
): number {
  let y = MARGIN;
  if (logo) {
    const x = (PAGE_W - logo.w) / 2;
    doc.addImage(logo.dataUrl, 'PNG', x, y, logo.w, logo.h);
    y += logo.h + 8;
  } else {
    y += 10;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    `Rapport généré le ${formatAppDateTime(reportDate)}`,
    PAGE_W / 2,
    y,
    { align: 'center' }
  );
  return y + 12;
}

function drawMetadataBlock(doc: jsPDF, y: number, items: { label: string; value: string }[]): number {
  let cy = ensureSpace(doc, y, 20);
  const lineGap = 7.5;

  doc.setFontSize(11);
  doc.setTextColor(...BLACK);

  for (const { label, value } of items) {
    const val = value?.trim() || '—';
    const valueLines = doc.splitTextToSize(val, CONTENT_W - (META_VALUE_X - MARGIN));
    const blockH = Math.max(lineGap, valueLines.length * 5.2);
    cy = ensureSpace(doc, cy, blockH + 2);

    doc.setFont('helvetica', 'normal');
    doc.text(label, META_LABEL_RIGHT_X, cy, { align: 'right' });
    doc.text(':', META_COLON_X, cy);
    doc.text(valueLines[0], META_VALUE_X, cy);
    for (let i = 1; i < valueLines.length; i++) {
      cy += 5.2;
      cy = ensureSpace(doc, cy, 6);
      doc.text(valueLines[i], META_VALUE_X, cy);
    }

    cy += blockH + 3;
  }

  return cy + 6;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  let cy = ensureSpace(doc, y, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  const lines = doc.splitTextToSize(title, CONTENT_W);
  doc.text(lines, MARGIN, cy);
  cy += lines.length * 5.5 + 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, cy, PAGE_W - MARGIN, cy);
  return cy + 6;
}

function drawProse(doc: jsPDF, y: number, text: string): number {
  let cy = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  cy = ensureSpace(doc, cy, lines.length * 5 + 4);
  doc.text(lines, MARGIN, cy);
  return cy + lines.length * 5 + 8;
}

const tableBase = {
  margin: { left: MARGIN, right: MARGIN },
  styles: {
    fontSize: 9,
    cellPadding: 2.5,
    textColor: BLACK,
    lineColor: BLACK,
    lineWidth: 0.1,
  },
  headStyles: {
    fillColor: LIGHT,
    textColor: BLACK,
    fontStyle: 'bold' as const,
    lineWidth: 0.2,
  },
  alternateRowStyles: { fillColor: [252, 252, 252] as [number, number, number] },
};

function runTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: (string | number)[][],
  columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right' }>
): number {
  autoTable(doc, {
    ...tableBase,
    startY,
    head,
    body,
    columnStyles,
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

/** Simple horizontal bars for effectifs evolution */
function drawEffectifsChart(
  doc: jsPDF,
  y: number,
  rows: { label: string; agents: number }[]
): number {
  if (rows.length === 0) return y;
  let cy = ensureSpace(doc, y, 12 + rows.length * 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);

  const maxAgents = Math.max(...rows.map((r) => r.agents), 1);
  const barMaxW = CONTENT_W - 55;
  const barX = MARGIN + 50;

  for (const row of rows) {
    cy = ensureSpace(doc, cy, 10);
    doc.text(row.label.slice(0, 28), MARGIN, cy + 3);
    const barW = (row.agents / maxAgents) * barMaxW;
    doc.setFillColor(30, 58, 95);
    doc.rect(barX, cy - 2, barW, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(String(row.agents), barX + barW + 2, cy + 3);
    doc.setFont('helvetica', 'normal');
    cy += 8;
  }
  return cy + 6;
}

function sortedSnapshots(snapshots: ParsedPlanningSnapshot[]): ParsedPlanningSnapshot[] {
  return [...snapshots].sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
}

function periodRangeLabel(snapshots: ParsedPlanningSnapshot[]): string {
  const sorted = sortedSnapshots(snapshots);
  if (sorted.length === 0) return '—';
  if (sorted.length === 1) return sorted[0].periodLabel;
  return `${sorted[0].periodLabel} → ${sorted[sorted.length - 1].periodLabel}`;
}

function sourceFilesList(snapshots: ParsedPlanningSnapshot[]): string {
  return sortedSnapshots(snapshots)
    .map((s) => `• ${s.periodLabel} (${s.fileName})`)
    .join('\n');
}

function drawAgentList(
  doc: jsPDF,
  y: number,
  title: string,
  names: { name: string }[],
  emptyText: string
): number {
  let cy = drawSectionTitle(doc, y, `${title} (${names.length})`);
  if (names.length === 0) {
    return drawProse(doc, cy, emptyText);
  }
  const numbered = names.map((a, i) => `${i + 1}. ${a.name}`);
  const chunkSize = 35;
  for (let i = 0; i < numbered.length; i += chunkSize) {
    const chunk = numbered.slice(i, i + chunkSize).join('\n');
    cy = drawProse(doc, cy, chunk);
  }
  return cy;
}

export async function generateRhPlanningStatsPdf(
  input: RhPlanningStatsPdfInput
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const logo = await loadImageAsDataUrl(GSS_LOGO_URL);
  const reportDate = input.generatedAt ?? new Date();
  const snapshots = sortedSnapshots(input.snapshots);
  const comparisons = input.comparisons;
  const latest = comparisons[comparisons.length - 1];

  let y = drawCenteredHeader(doc, logo, reportDate);

  y = ensureSpace(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BLACK);
  doc.text('RAPPORT STATISTIQUES RH', PAGE_W / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(13);
  doc.text('ANALYSE COMPARATIVE DU PLANNING', PAGE_W / 2, y, { align: 'center' });
  y += 14;

  const firstRef = snapshots[0]?.referenceDate ?? '';
  const lastRef = snapshots[snapshots.length - 1]?.referenceDate ?? '';

  y = drawMetadataBlock(doc, y, [
    { label: 'Nom de la société', value: input.companyName },
    { label: 'Site', value: input.siteName },
    {
      label: 'Périodes analysées',
      value: String(snapshots.length),
    },
    {
      label: 'Couverture temporelle',
      value: periodRangeLabel(snapshots),
    },
    {
      label: 'Références',
      value:
        firstRef && lastRef
          ? `${formatDateDdMmYyyy(firstRef)} — ${formatDateDdMmYyyy(lastRef)}`
          : '—',
    },
    {
      label: 'Comparaisons',
      value: String(comparisons.length),
    },
  ]);

  // —— Résumé exécutif ——
  y = drawSectionTitle(doc, y, '1. Résumé exécutif');

  if (latest) {
    const execSummary = [
      `Ce rapport compare ${snapshots.length} export(s) Planning pour « ${input.companyName} » sur le site « ${input.siteName} ».`,
      `Dernière évolution analysée : ${latest.fromLabel} → ${latest.toLabel}.`,
      `Effectifs planifiés : ${latest.agentsFrom} → ${latest.agentsTo} (${fmtDelta(latest.agentsDelta)} agents, soit ${fmtDelta(latest.agentsDeltaPct, ' %')} sur la période précédente).`,
      `Taux d'affectation : ${pct(latest.tauxAffectationFrom)} → ${pct(latest.tauxAffectationTo)} (${fmtDelta(latest.tauxAffectationDelta, ' pts')}).`,
      `Assiduité : ${pct(latest.attendanceFrom)} → ${pct(latest.attendanceTo)} (${fmtDelta(latest.attendanceDelta, ' pts')}).`,
      `Mouvements : ${latest.recrutement.length} recrutement(s), ${latest.departs.length} départ(s), ${latest.stables.length} agent(s) présent(s) sur les deux périodes.`,
    ].join('\n\n');
    y = drawProse(doc, y, execSummary);
  } else {
    y = drawProse(
      doc,
      y,
      'Données insuffisantes pour une comparaison (minimum 2 périodes requises).'
    );
  }

  // —— Synthèse par période ——
  y = drawSectionTitle(doc, y, '2. Synthèse par période');
  y = runTable(
    doc,
    y,
    [['Période', 'Fichier source', 'Agents', 'Taux affectation', 'Assiduité', 'J. travail moy.']],
    snapshots.map((s) => [
      s.periodLabel,
      s.fileName,
      String(s.agents.length),
      pct(s.tauxAffectation),
      pct(s.attendanceRate),
      s.avgWorkDaysPerAgent.toFixed(1),
    ]),
    {
      0: { halign: 'left' },
      1: { halign: 'left' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    }
  );

  // —— Évolution ——
  y = drawSectionTitle(doc, y, '3. Évolution des indicateurs');
  y = runTable(
    doc,
    y,
    [['Période', 'Agents', 'Taux affectation (%)', 'Assiduité (%)', 'Jours travail moy.']],
    snapshots.map((s) => [
      s.periodLabel,
      String(s.agents.length),
      s.tauxAffectation.toFixed(1),
      s.attendanceRate.toFixed(1),
      s.avgWorkDaysPerAgent.toFixed(1),
    ]),
    {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    }
  );

  y = drawSectionTitle(doc, y, '3.1 Évolution des effectifs (graphique)');
  y = drawEffectifsChart(
    doc,
    y,
    snapshots.map((s) => ({ label: s.periodLabel, agents: s.agents.length }))
  );

  // —— Comparaisons détaillées ——
  y = drawSectionTitle(doc, y, '4. Comparaisons période à période');

  comparisons.forEach((c, idx) => {
    y = ensureSpace(doc, y, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(
      `4.${idx + 1} ${c.fromLabel} → ${c.toLabel}`,
      MARGIN,
      y
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Sources : ${c.fromFile} → ${c.toFile}`, MARGIN, y);
    y += 10;

    y = runTable(
      doc,
      y,
      [['Indicateur', 'Valeur']],
      [
        [
          'Agents planifiés',
          `${c.agentsFrom} → ${c.agentsTo} (${fmtDelta(c.agentsDelta)})`,
        ],
        [
          'Variation effectifs (%)',
          fmtDelta(c.agentsDeltaPct, ' %'),
        ],
        [
          "Taux d'affectation",
          `${pct(c.tauxAffectationFrom)} → ${pct(c.tauxAffectationTo)} (${fmtDelta(c.tauxAffectationDelta, ' pts')})`,
        ],
        [
          'Assiduité',
          `${pct(c.attendanceFrom)} → ${pct(c.attendanceTo)} (${fmtDelta(c.attendanceDelta, ' pts')})`,
        ],
        ['Agents stables (présents 2 périodes)', String(c.stables.length)],
        ['Recrutements', String(c.recrutement.length)],
        ['Départs', String(c.departs.length)],
      ],
      { 0: { halign: 'left' }, 1: { halign: 'right' } }
    );

    y = drawAgentList(doc, y, 'Recrutements', c.recrutement, 'Aucun nouvel agent sur cette période.');
    y = drawAgentList(doc, y, 'Départs', c.departs, 'Aucun départ constaté sur cette période.');
    y = drawAgentList(
      doc,
      y,
      'Agents stables',
      c.stables,
      'Aucun agent commun entre les deux périodes.'
    );
    y += 4;
  });

  // —— Méthodologie ——
  y = drawSectionTitle(doc, y, '5. Méthodologie et définitions');
  y = drawProse(
    doc,
    y,
    [
      "Les données proviennent des exports JSON générés depuis la sous-section Planning (bouton JSON). Seuls les fichiers dont la société et le site correspondent au filtre saisi sont retenus.",
      "Taux d'affectation : proportion d'agents ayant au moins un jour de travail planifié (codes J, N, J-P1, J-P2, N-P1, N-P2) sur la période.",
      "Assiduité : ratio jours travaillés / (jours travaillés + jours de repos R) sur l'ensemble des agents et de la période.",
      "Jours de travail moyen : moyenne des jours de travail par agent planifié.",
      "Recrutement : agent présent dans la période ultérieure mais absent de la période antérieure (appariement par nom normalisé).",
      "Départ : agent présent dans la période antérieure mais absent de la période ultérieure.",
      "Agent stable : présent sur les deux périodes comparées consécutives.",
      "Les comparaisons sont effectuées dans l'ordre chronologique des dates de référence des exports.",
    ].join('\n\n')
  );

  // —— Fichiers sources ——
  y = drawSectionTitle(doc, y, '6. Annexes — fichiers sources');
  y = drawProse(doc, y, sourceFilesList(snapshots));

  // —— Détail agents (chaque période) ——
  y = drawSectionTitle(doc, y, '7. Détail par agent et par période');
  snapshots.forEach((snap, periodIdx) => {
    y = ensureSpace(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(`7.${periodIdx + 1} ${snap.periodLabel}`, MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Fichier : ${snap.fileName}`, MARGIN, y);
    y += 8;

    if (snap.agents.length === 0) {
      y = drawProse(doc, y, 'Aucun agent dans cet export.');
      return;
    }

    y = runTable(
      doc,
      y,
      [['Agent', 'J. travail', 'J. repos', 'Non planifiés', 'Affecté', 'Répartition shifts']],
      snap.agents.map((a) => {
        const codes = Object.entries(a.shiftsByCode)
          .sort((x, y2) => y2[1] - x[1])
          .map(([k, v]) => `${k} (${v})`)
          .join(', ');
        return [
          a.name,
          String(a.workDays),
          String(a.restDays),
          String(a.emptyDays),
          a.isAffected ? 'Oui' : 'Non',
          codes || '—',
        ];
      }),
      {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'left' },
      }
    );
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p);
  }

  return doc;
}

export async function downloadRhPlanningStatsPdf(
  input: RhPlanningStatsPdfInput,
  fileName?: string
): Promise<void> {
  const doc = await generateRhPlanningStatsPdf(input);
  const safeCompany = input.companyName.replace(/[^\w.-]+/g, '_') || 'societe';
  const safeSite = input.siteName.replace(/[^\w.-]+/g, '_') || 'site';
  const dateStr = (input.generatedAt ?? new Date()).toISOString().slice(0, 10);
  const name =
    fileName || `statistiques_rh_${safeCompany}_${safeSite}_${dateStr}.pdf`;
  doc.save(name);
}
