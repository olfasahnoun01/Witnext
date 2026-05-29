/**
 * Génération PDF — Lettre de change (traite) tunisienne.
 * Mentions conformes au Code de commerce (Livre III, art. 269).
 */

import jsPDF from 'jspdf';
import { formatMontantDt } from './money';
import { montantEnLettresDtCapitalized } from './amountInWordsFr';

export interface TraiteParty {
  nom: string;
  matriculeFiscal?: string | null;
  adresse?: string | null;
}

export interface TraitePdfData {
  numero: string;
  montant: number;
  dateCreation: string;
  lieuCreation: string;
  dateEcheance: string;
  lieuPaiement: string;
  tireur: TraiteParty;
  tire: TraiteParty;
  beneficiaire: TraiteParty;
  banque?: string | null;
  rib?: string | null;
  valeurEn?: string | null;
  aOrdre?: boolean;
}

function formatDateFr(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function drawLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(x1, y1, x2, y2);
}

function labelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(value || '—', maxWidth);
  doc.text(lines, x, y + 4.5);
  return y + 4.5 + lines.length * 4.5;
}

export function buildTraitePdf(data: TraitePdfData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const margin = 14;
  const innerW = pageW - margin * 2;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, 'F');

  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.6);
  doc.rect(margin, margin, innerW, pageH - margin * 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text('LETTRE DE CHANGE', pageW / 2, margin + 12, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text('( TRAITE )', pageW / 2, margin + 18, { align: 'center' });

  if (data.aOrdre !== false) {
    doc.setFontSize(9);
    doc.text('À ORDRE', pageW - margin - 8, margin + 12, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`N° ${data.numero}`, margin + 6, margin + 12);

  const amountBoxX = pageW - margin - 72;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(30, 58, 95);
  doc.roundedRect(amountBoxX, margin + 22, 66, 22, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Montant', amountBoxX + 4, margin + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text(formatMontantDt(data.montant), amountBoxX + 4, margin + 38);

  const col1 = margin + 6;
  const col2 = pageW / 2 + 4;
  const colW = pageW / 2 - margin - 10;

  labelValue(doc, 'Lieu de création', data.lieuCreation, col1, margin + 28, colW - 10);
  labelValue(doc, 'Date de création', formatDateFr(data.dateCreation), col2, margin + 28, colW - 10);

  const bodyY = margin + 52;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const montantLettres = montantEnLettresDtCapitalized(data.montant);
  const bodyText =
    `Contre cette lettre de change, veuillez payer${data.aOrdre !== false ? " à l'ordre de" : ' à'} ` +
    `${data.beneficiaire.nom}, la somme de :\n\n` +
    `${montantLettres}.\n\n` +
    `( ${formatMontantDt(data.montant)} )`;

  const bodyLines = doc.splitTextToSize(bodyText, innerW - 12);
  doc.text(bodyLines, margin + 6, bodyY);

  drawLine(doc, margin + 6, bodyY + bodyLines.length * 5 + 4, pageW - margin - 6, bodyY + bodyLines.length * 5 + 4);

  let blockY = bodyY + bodyLines.length * 5 + 14;

  blockY = labelValue(doc, 'Échéance', formatDateFr(data.dateEcheance), col1, blockY, colW - 10);
  labelValue(doc, 'Lieu de paiement', data.lieuPaiement, col2, blockY - 18, colW - 10);

  blockY += 4;
  if (data.banque) {
    blockY = labelValue(doc, 'Domiciliation bancaire', data.banque, col1, blockY, innerW - 12);
  }
  if (data.rib) {
    blockY = labelValue(doc, 'RIB', data.rib, col1, blockY, innerW - 12);
  }
  if (data.valeurEn) {
    blockY = labelValue(doc, 'Valeur en', data.valeurEn, col1, blockY, innerW - 12);
  }

  const partyY = Math.max(blockY + 6, pageH - margin - 58);
  drawLine(doc, margin + 6, partyY - 4, pageW - margin - 6, partyY - 4);

  const partyW = (innerW - 12) / 3;

  const drawParty = (title: string, party: TraiteParty, x: number, startY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(title.toUpperCase(), x, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    let py = startY + 5;
    const nameLines = doc.splitTextToSize(party.nom, partyW - 4);
    doc.text(nameLines, x, py);
    py += nameLines.length * 4.5;
    if (party.matriculeFiscal) {
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`MF : ${party.matriculeFiscal}`, x, py + 3);
      py += 7;
    }
    if (party.adresse) {
      const addrLines = doc.splitTextToSize(party.adresse, partyW - 4);
      doc.text(addrLines, x, py + 2);
    }
  };

  drawParty('Tiré (doit payer)', data.tire, col1, partyY);
  drawParty('Tireur', data.tireur, col1 + partyW, partyY);
  drawParty('Bénéficiaire', data.beneficiaire, col1 + partyW * 2, partyY);

  const sigY = pageH - margin - 22;
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('Acceptation du tiré (date, signature et cachet)', col1, sigY);
  doc.text('Signature du tireur', col1 + partyW * 2, sigY);
  drawLine(doc, col1, sigY + 10, col1 + partyW - 8, sigY + 10);
  drawLine(doc, col1 + partyW * 2, sigY + 10, pageW - margin - 6, sigY + 10);

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Document généré électroniquement — Code de commerce tunisien, Livre III. Signatures manuscrites requises.',
    pageW / 2,
    pageH - margin + 2,
    { align: 'center' }
  );

  return doc;
}

export function downloadTraitePdf(data: TraitePdfData, filename?: string): void {
  const doc = buildTraitePdf(data);
  const name = filename ?? `traite-${data.numero.replace(/[^\w-]/g, '_')}.pdf`;
  doc.save(name);
}

export function openTraitePdfPrint(data: TraitePdfData): void {
  const doc = buildTraitePdf(data);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      w.focus();
      w.print();
    };
  } else {
    downloadTraitePdf(data);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
