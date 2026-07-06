/**
 * Official Tunisian-style BL-Facture PDF (Granisafe reference layout).
 * Fixed A4 grid: header + meta, full-height lines table, footer pinned to page bottom.
 * Same structure for every company — only branding (name, colors, logo, legal lines) changes.
 */

import jsPDF from 'jspdf';
import {
  computeDevisLine,
  computeDevisTotals,
  resolveDevisLineTvaRate,
  resolveFodecEnabled,
  TIMBRE_FISCAL_DT,
} from '@/lib/devisPricing';
import { getDevisItemDetailDescription } from '@/lib/devisItemPdf';
import { getFactureCompanyBrand, type FactureCompanyBrand } from '@/lib/factureCompanyBrand';
import { montantEnLettresFactureStyle } from '@/modules/finance/lib/amountInWordsFr';
import { formatAppDate } from '@/lib/formatAppDate';
import type { DevisPDFData } from './pdfGenerator';

/** A4 page with tight professional margins (mm). */
const MX = 8;
const MY = 7;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MX * 2;

const LOGO_MAX_H = 26;
const LOGO_MAX_W = 52;

/** Footer block height reserved at bottom of each page. */
const FOOTER_H = 84;
const FOOTER_TOP = PAGE_H - MY - FOOTER_H;

const TABLE_HEAD_H = 7;
const TABLE_ROW_H = 8;

const COLS = {
  ref: 34,
  des: 0, // computed
  pht: 26,
  rem: 16,
  net: 28,
  tva: 16,
} as const;

interface PdfLogoAsset {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

interface LineRow {
  ref: string;
  designation: string;
  pht: string;
  rem: string;
  net: string;
  tva: string;
}

function colWidths(): number[] {
  const fixed = COLS.ref + COLS.pht + COLS.rem + COLS.net + COLS.tva;
  return [COLS.ref, CONTENT_W - fixed, COLS.pht, COLS.rem, COLS.net, COLS.tva];
}

function formatAmount(n: number): string {
  const fixed = n.toFixed(3);
  const [intPart, decPart] = fixed.split('.');
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${decPart}`;
}

function formatDateFr(iso: string): string {
  return formatAppDate(iso, iso);
}

function loadLogo(url: string): Promise<PdfLogoAsset | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let settled = false;
    const finish = (result: PdfLogoAsset | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const aspect = img.width / img.height;
      let heightMm = LOGO_MAX_H;
      let widthMm = heightMm * aspect;
      if (widthMm > LOGO_MAX_W) {
        widthMm = LOGO_MAX_W;
        heightMm = widthMm / aspect;
      }
      finish({ dataUrl: canvas.toDataURL('image/png'), widthMm, heightMm });
    };
    img.onerror = () => finish(null);
    img.src = url;
    setTimeout(() => finish(null), 3000);
  });
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number, lineW = 0.35) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineW);
  doc.rect(x, y, w, h);
}

function fillRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number]
) {
  doc.setFillColor(...rgb);
  doc.rect(x, y, w, h, 'F');
}

function fillStrokeRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
  lineW = 0.35
) {
  doc.setFillColor(...rgb);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineW);
  doc.rect(x, y, w, h, 'FD');
}

/** Header: logo left, company identity + legal block right. */
function drawHeader(doc: jsPDF, brand: FactureCompanyBrand, logo: PdfLogoAsset | null): number {
  const rightX = PAGE_W / 2 + 2;
  const rightW = PAGE_W - MX - rightX;
  const top = MY;

  if (logo?.dataUrl) {
    doc.addImage(logo.dataUrl, 'PNG', MX, top, logo.widthMm, logo.heightMm);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...brand.primaryRgb);
    doc.text(brand.displayName.slice(0, 3), MX, top + 12);
    doc.setFontSize(8);
    doc.setTextColor(...brand.secondaryRgb);
    doc.text(brand.displayName, MX, top + 18);
  }

  // Company name inside brand-colored box (matches paper template header bar)
  const nameBoxH = 9;
  fillStrokeRect(doc, rightX, top, rightW, nameBoxH, brand.headerBarRgb, 0.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...brand.secondaryRgb);
  doc.text(brand.displayName, rightX + rightW / 2, top + nameBoxH / 2 + 1.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  let ly = top + nameBoxH + 5;
  doc.text(`CODE TVA: ${brand.codeTva || '—'}`, rightX, ly);
  ly += 4.2;
  if (brand.address) {
    doc.text(brand.address, rightX, ly);
    ly += 4.2;
  }
  doc.text(`TEL/FAX: ${brand.telFax || ''}`, rightX, ly);
  ly += 4.2;
  if (brand.rib) {
    doc.setFont('helvetica', 'bold');
    doc.text(`RIB: ${brand.rib}`, rightX + rightW / 2, ly, { align: 'center' });
  }

  return Math.max(top + (logo?.heightMm ?? 22) + 2, ly + 4);
}

/**
 * Title "BL - Facture" on the left, then three equal-height boxes:
 * Commentaire | NUMERO/Du/CLIENT/PAGE | Client identity.
 */
function drawMetaSection(
  doc: jsPDF,
  devis: DevisPDFData,
  brand: FactureCompanyBrand,
  startY: number,
  pageLabel: string
): number {
  const titleY = startY + 7;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(20);
  doc.setTextColor(...brand.secondaryRgb);
  doc.text('BL - Facture', MX, titleY);

  const boxY = titleY + 3;
  const boxH = 30;
  const col1W = CONTENT_W * 0.26;
  const col2W = CONTENT_W * 0.26;
  const col3W = CONTENT_W - col1W - col2W;
  const x1 = MX;
  const x2 = x1 + col1W;
  const x3 = x2 + col2W;

  strokeRect(doc, x1, boxY, col1W, boxH);
  strokeRect(doc, x2, boxY, col2W, boxH);
  strokeRect(doc, x3, boxY, col3W, boxH);

  // Commentaire
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Commentaire', x1 + 2.5, boxY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const comment = (devis.third_party_name || '').toUpperCase();
  const commentLines = doc.splitTextToSize(comment, col1W - 5);
  doc.text(commentLines.slice(0, 4), x1 + 2.5, boxY + 11);

  // Meta
  const dateStr = formatDateFr(devis.devis_date);
  const meta: [string, string][] = [
    ['NUMERO', devis.devis_number],
    ['Du', dateStr],
    ['CLIENT', ''],
    ['PAGE', pageLabel],
  ];
  let my = boxY + 6.5;
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label} :`, x2 + 3, my);
    doc.setFont('helvetica', 'normal');
    doc.text(value, x2 + 26, my);
    my += 5.8;
  }

  // Client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const clientName = (devis.third_party_name || '—').toUpperCase();
  const nameLines = doc.splitTextToSize(clientName, col3W - 5);
  doc.text(nameLines.slice(0, 2), x3 + 2.5, boxY + 6);
  let cy = boxY + 6 + nameLines.slice(0, 2).length * 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (devis.third_party_address) {
    const addrLines = doc.splitTextToSize(devis.third_party_address.toUpperCase(), col3W - 5);
    doc.text(addrLines.slice(0, 2), x3 + 2.5, cy);
    cy += addrLines.slice(0, 2).length * 3.8;
  }
  if (devis.third_party_tax_id) {
    doc.text(`Ident. Fiscale : ${devis.third_party_tax_id}`, x3 + 2.5, cy);
    cy += 4;
  }
  doc.text(`Tel : ${devis.third_party_phone || ''}   Fax :`, x3 + 2.5, Math.min(cy, boxY + boxH - 3));

  return boxY + boxH;
}

function buildLineRows(devis: DevisPDFData, showTva: boolean): LineRow[] {
  return devis.items.map((item, idx) => {
    const line = computeDevisLine(item, false);
    const designation = [item.designation, getDevisItemDetailDescription(item)]
      .filter(Boolean)
      .join(' — ');
    return {
      ref: `${devis.devis_number} / ${String(idx + 1).padStart(5, '0')}`,
      designation,
      pht: formatAmount(line.unitHT),
      rem: item.remise > 0 ? item.remise.toFixed(2) : '',
      net: formatAmount(line.lineHT),
      tva: showTva ? resolveDevisLineTvaRate(item.tva).toFixed(2) : '',
    };
  });
}

/** Draw full-height items table from tableTop down to FOOTER_TOP. */
function drawItemsTable(
  doc: jsPDF,
  rows: LineRow[],
  tableTop: number,
  tableBottom: number,
  headFill: [number, number, number]
) {
  const widths = colWidths();
  const headers = ['Référence', 'Désignation', 'P. H.T', 'Rem. %', 'Mt Net HT', 'TVA %'];
  const tableH = tableBottom - tableTop;

  // Outer frame
  strokeRect(doc, MX, tableTop, CONTENT_W, tableH, 0.4);

  // Header band
  fillRect(doc, MX, tableTop, CONTENT_W, TABLE_HEAD_H, headFill);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(MX, tableTop + TABLE_HEAD_H, MX + CONTENT_W, tableTop + TABLE_HEAD_H);

  // Vertical column lines (full table height)
  let vx = MX;
  for (let i = 0; i < widths.length - 1; i++) {
    vx += widths[i];
    doc.line(vx, tableTop, vx, tableBottom);
  }

  // Header labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  let hx = MX;
  for (let i = 0; i < headers.length; i++) {
    const cx = hx + widths[i] / 2;
    doc.text(headers[i], cx, tableTop + 4.8, { align: 'center' });
    hx += widths[i];
  }

  // Body rows
  const bodyTop = tableTop + TABLE_HEAD_H;
  const maxRows = Math.floor((tableBottom - bodyTop) / TABLE_ROW_H);
  const visible = rows.slice(0, maxRows);

  for (let r = 0; r < visible.length; r++) {
    const row = visible[r];
    const y = bodyTop + r * TABLE_ROW_H;
    const textY = y + 5.2;
    const cells = [row.ref, row.designation, row.pht, row.rem, row.net, row.tva];
    const aligns: Array<'left' | 'center' | 'right'> = [
      'left',
      'left',
      'right',
      'center',
      'right',
      'center',
    ];

    // Row separator (except last drawn row — empty area stays open)
    doc.setLineWidth(0.2);
    doc.line(MX, y + TABLE_ROW_H, MX + CONTENT_W, y + TABLE_ROW_H);

    let cx = MX;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (let c = 0; c < cells.length; c++) {
      const pad = 1.5;
      const cellW = widths[c];
      let text = cells[c];
      if (c === 1) {
        const lines = doc.splitTextToSize(text, cellW - pad * 2);
        text = lines[0] ?? '';
      }
      if (aligns[c] === 'left') {
        doc.text(text, cx + pad, textY);
      } else if (aligns[c] === 'right') {
        doc.text(text, cx + cellW - pad, textY, { align: 'right' });
      } else {
        doc.text(text, cx + cellW / 2, textY, { align: 'center' });
      }
      cx += cellW;
    }
  }

  return rows.length > maxRows ? rows.slice(maxRows) : [];
}

function buildTaxBreakdown(
  items: DevisPDFData['items'],
  partyExonere: boolean
): { taux: number; base: number; montant: number }[] {
  if (partyExonere) return [];
  const map = new Map<number, { base: number; montant: number }>();
  for (const item of items) {
    const rate = resolveDevisLineTvaRate(item.tva);
    if (rate <= 0) continue;
    const line = computeDevisLine(item, false);
    const prev = map.get(rate) ?? { base: 0, montant: 0 };
    prev.base += line.lineHT;
    prev.montant += line.lineTVA;
    map.set(rate, prev);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, v]) => ({
      taux,
      base: Math.round(v.base * 1000) / 1000,
      montant: Math.round(v.montant * 1000) / 1000,
    }));
}

/** Footer pinned to bottom of the page — tax, words, N.B., véhicule, reçu, totals. */
function drawFooter(
  doc: jsPDF,
  brand: FactureCompanyBrand,
  totals: { totalNet: number; totalTVA: number; totalFinal: number },
  taxRows: { taux: number; base: number; montant: number }[],
  notes: string | null
) {
  const y0 = FOOTER_TOP + 2;
  const totalsW = 48;
  const totalsX = PAGE_W - MX - totalsW;
  const leftW = 72;
  const midX = MX + leftW + 3;
  const midW = totalsX - midX - 3;

  // --- Tax breakdown (top-left): TAUX / BASE / MONTANT + TOTAL TAXES in one bordered block ---
  const taxColW = [leftW * 0.22, leftW * 0.4, leftW * 0.38];
  const taxRowH = 5.5;
  const taxHeadY = y0;
  const rows =
    taxRows.length > 0 ? taxRows : [{ taux: 0, base: totals.totalNet, montant: 0 }];
  const displayRows = rows.slice(0, 2);
  const taxBlockH = taxRowH * (1 + displayRows.length + 1); // head + data + TOTAL TAXES

  // Outer border for the whole tax block
  strokeRect(doc, MX, taxHeadY, leftW, taxBlockH, 0.4);

  // Header row (brand theme)
  fillRect(doc, MX, taxHeadY, leftW, taxRowH, brand.tableHeadRgb);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MX, taxHeadY + taxRowH, MX + leftW, taxHeadY + taxRowH);
  doc.line(MX + taxColW[0], taxHeadY, MX + taxColW[0], taxHeadY + taxBlockH - taxRowH);
  doc.line(
    MX + taxColW[0] + taxColW[1],
    taxHeadY,
    MX + taxColW[0] + taxColW[1],
    taxHeadY + taxBlockH - taxRowH
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TAUX', MX + taxColW[0] / 2, taxHeadY + 3.8, { align: 'center' });
  doc.text('BASE', MX + taxColW[0] + taxColW[1] / 2, taxHeadY + 3.8, { align: 'center' });
  doc.text('MONTANT', MX + taxColW[0] + taxColW[1] + taxColW[2] / 2, taxHeadY + 3.8, {
    align: 'center',
  });

  let ty = taxHeadY + taxRowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const row of displayRows) {
    doc.line(MX, ty + taxRowH, MX + leftW, ty + taxRowH);
    doc.text(row.taux > 0 ? `${row.taux.toFixed(0)}%` : '', MX + taxColW[0] / 2, ty + 3.8, {
      align: 'center',
    });
    doc.text(formatAmount(row.base), MX + taxColW[0] + taxColW[1] - 1.5, ty + 3.8, {
      align: 'right',
    });
    doc.text(
      formatAmount(row.montant),
      MX + taxColW[0] + taxColW[1] + taxColW[2] - 1.5,
      ty + 3.8,
      { align: 'right' }
    );
    ty += taxRowH;
  }

  // TOTAL TAXES row — last row of the same bordered table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL TAXES', MX + 2, ty + 3.8);
  doc.text(formatAmount(totals.totalTVA), MX + leftW - 2, ty + 3.8, { align: 'right' });
  ty += taxRowH;

  // Amount in words — bordered box
  ty += 3;
  const lettres = montantEnLettresFactureStyle(totals.totalFinal);
  const wordsPrefix = 'Arrêtée la présente Facture à la somme de :';
  const wordsBoxW = leftW + midW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const wordsLines = doc.splitTextToSize(lettres, wordsBoxW - 5);
  const wordsLineH = 4.8;
  const wordsBoxH = 5 + wordsLineH + wordsLines.slice(0, 3).length * wordsLineH + 3;
  strokeRect(doc, MX, ty, wordsBoxW, wordsBoxH, 0.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(wordsPrefix, MX + 2.5, ty + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(wordsLines.slice(0, 3), MX + 2.5, ty + 5 + wordsLineH);
  ty += wordsBoxH;

  // --- Totals box (top-right, aligned with tax table) ---
  const totalsRows: [string, string, boolean][] = [
    ['TOTAL HT', formatAmount(totals.totalNet), false],
    ['TOTAL TAXES', formatAmount(totals.totalTVA), false],
    ['TIMBRE F.', formatAmount(TIMBRE_FISCAL_DT), false],
    ['A PAYER', formatAmount(totals.totalFinal), true],
  ];
  const tRowH = 6.5;
  let tryY = y0;
  for (const [label, value, isPay] of totalsRows) {
    if (isPay) {
      doc.setDrawColor(...brand.primaryRgb);
      doc.setLineWidth(0.8);
      doc.rect(totalsX, tryY, totalsW, tRowH);
      doc.setDrawColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...brand.secondaryRgb);
    } else {
      strokeRect(doc, totalsX, tryY, totalsW, tRowH, 0.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
    }
    doc.text(label, totalsX + 2, tryY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(value, totalsX + totalsW - 2, tryY + 4.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    tryY += tRowH;
  }

  // --- Bottom boxes: N.B. | Véhicule/Chauffeur | Reçu par (flush to page bottom) ---
  const bottomH = 24;
  const bottomY = PAGE_H - MY - bottomH;
  const nbW = 28;
  const vehW = leftW - nbW;
  const recuW = midW;

  strokeRect(doc, MX, bottomY, nbW, bottomH, 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('N.B.', MX + 2, bottomY + 5);
  if (notes?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const nbLines = doc.splitTextToSize(notes.trim(), nbW - 4);
    doc.text(nbLines.slice(0, 4), MX + 2, bottomY + 10);
  }

  strokeRect(doc, MX + nbW, bottomY, vehW, bottomH, 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Véhicule :', MX + nbW + 2, bottomY + 8);
  doc.text('Chauffeur :', MX + nbW + 2, bottomY + 16);

  strokeRect(doc, midX, bottomY, recuW, bottomH, 0.35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Reçu par', midX + 2, bottomY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...brand.secondaryRgb);
  doc.text(brand.displayName, midX + recuW / 2, bottomY + 13, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('Service Commercial', midX + recuW / 2, bottomY + 18, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function drawContinuationHeader(doc: jsPDF, brand: FactureCompanyBrand, pageNum: number, totalPages: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brand.secondaryRgb);
  doc.text(brand.displayName, MX, MY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`BL - Facture (suite) — PAGE ${pageNum} / ${totalPages}`, PAGE_W - MX, MY + 5, {
    align: 'right',
  });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MX, MY + 8, PAGE_W - MX, MY + 8);
}

/** Build the official BL-Facture PDF for the active (or given) company brand. */
export async function buildFacturePDF(
  devis: DevisPDFData,
  companyCode?: string | null
): Promise<jsPDF> {
  const brand = getFactureCompanyBrand(companyCode);
  const logo = await loadLogo(brand.logoUrl);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const showTva =
    !devis.party_exonere_de_tva &&
    devis.items.some((item) => resolveDevisLineTvaRate(item.tva) > 0);

  const allRows = buildLineRows(devis, showTva);
  const headFill: [number, number, number] = [...brand.tableHeadRgb];

  const totals = computeDevisTotals(devis.items, false, {
    devisType: 'vente',
    docType: 'devis',
    isTvaEnabled: showTva,
    isFodecEnabled: resolveFodecEnabled({ devisType: 'vente', items: devis.items }),
  });
  const taxRows = buildTaxBreakdown(devis.items, !!devis.party_exonere_de_tva);
  const totalFinal = showTva ? totals.totalFinal : totals.totalFinalHT;
  const totalsPayload = {
    totalNet: totals.totalNet,
    totalTVA: showTva ? totals.totalTVA : 0,
    totalFinal,
  };

  // Estimate page count so PAGE label is correct on page 1
  const headerBottomEstimate = MY + LOGO_MAX_H + 4;
  const metaBottomEstimate = headerBottomEstimate + 7 + 3 + 30;
  const page1TableTop = metaBottomEstimate + 2;
  const page1BodyH = FOOTER_TOP - page1TableTop - TABLE_HEAD_H;
  const rowsPage1 = Math.max(1, Math.floor(page1BodyH / TABLE_ROW_H));
  const contTop = MY + 12;
  const contBodyH = FOOTER_TOP - contTop - TABLE_HEAD_H;
  const rowsCont = Math.max(1, Math.floor(contBodyH / TABLE_ROW_H));
  let totalPages = 1;
  if (allRows.length > rowsPage1) {
    totalPages = 1 + Math.ceil((allRows.length - rowsPage1) / rowsCont);
  }

  // Page 1 — full professional layout filling A4
  const headerBottom = drawHeader(doc, brand, logo);
  const metaBottom = drawMetaSection(doc, devis, brand, headerBottom, `1 / ${totalPages}`);
  const tableTop = metaBottom + 2;
  let remaining = drawItemsTable(doc, allRows, tableTop, FOOTER_TOP, headFill);
  drawFooter(doc, brand, totalsPayload, taxRows, devis.notes);

  // Overflow pages — continuation tables still fill down to the footer band
  let pageNum = 1;
  while (remaining.length > 0) {
    pageNum += 1;
    doc.addPage();
    drawContinuationHeader(doc, brand, pageNum, totalPages);
    remaining = drawItemsTable(doc, remaining, contTop, FOOTER_TOP, headFill);
    if (remaining.length === 0) {
      drawFooter(doc, brand, totalsPayload, taxRows, devis.notes);
    }
  }

  return doc;
}
