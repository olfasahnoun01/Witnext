import jsPDF from 'jspdf';
import type { RhReportSection, RhSecurityReportForm, RhVehicleInfo } from '@/lib/rhReportTypes';
import { incidentTypeLabels, RH_REPORT_KINDS } from '@/lib/rhReportTypes';

const PAGE_W = 210;
const MARGIN = 25;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 282;
/** Colon alignment for « Label : Valeur » lines */
const META_LABEL_RIGHT_X = MARGIN + 40;
const META_COLON_X = MARGIN + 42;
const META_VALUE_X = MARGIN + 46;
const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [80, 80, 80];

const GSS_LOGO_URL = '/gss-logo2.png';

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

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function drawPageFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`— ${page} —`, PAGE_W / 2, FOOTER_Y, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Document confidentiel', PAGE_W / 2, FOOTER_Y + 4, { align: 'center' });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 12) {
    doc.addPage();
    return MARGIN + 8;
  }
  return y;
}

/** Centered logo + thin rule (first page header). */
function drawCenteredHeader(doc: jsPDF, logo: { dataUrl: string; w: number; h: number } | null): number {
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
    `Rapport établi le ${new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`,
    PAGE_W / 2,
    y,
    { align: 'center' }
  );
  return y + 12;
}

function formatDateDdMmYyyy(isoDate: string): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatHeure(time: string): string {
  const t = time?.trim();
  if (!t) return '—';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** Aligned « Label : Valeur » on one line (no table borders). */
function drawMetadataBlock(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string }[]
): number {
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

/** Section: bold black title + body paragraph (no boxes, no colored bars). */
function drawProseSection(doc: jsPDF, y: number, title: string, body: string): number {
  let cy = ensureSpace(doc, y, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  const titleLines = doc.splitTextToSize(title.trim(), CONTENT_W);
  doc.text(titleLines, MARGIN, cy);
  cy += titleLines.length * 5.5 + 4;

  const content = body?.trim() || '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  const bodyLines = doc.splitTextToSize(content, CONTENT_W);
  const bodyH = bodyLines.length * 5.2;
  cy = ensureSpace(doc, cy, bodyH + 4);
  doc.text(bodyLines, MARGIN, cy, { maxWidth: CONTENT_W });
  cy += bodyLines.length * 5.2 + 10;

  return cy;
}

function drawVehicleProse(doc: jsPDF, y: number, vehicle: RhVehicleInfo): number {
  const parts: string[] = [];
  if (vehicle.immatriculation) parts.push(`Immatriculation : ${vehicle.immatriculation}`);
  if (vehicle.marque_modele) parts.push(`Marque et modèle : ${vehicle.marque_modele}`);
  if (vehicle.conducteur) parts.push(`Conducteur : ${vehicle.conducteur}`);
  if (vehicle.description_degats) parts.push(`Description des dégâts : ${vehicle.description_degats}`);
  return drawProseSection(
    doc,
    y,
    'Informations sur le véhicule concerné',
    parts.length > 0 ? parts.join('\n\n') : '—'
  );
}

export async function generateRhSecurityReportPdf(
  form: RhSecurityReportForm,
  attachmentDataUrls: string[] = []
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const logo = await loadImageAsDataUrl(GSS_LOGO_URL);

  let y = drawCenteredHeader(doc, logo);

  const kindLabel =
    RH_REPORT_KINDS.find((k) => k.id === form.reportKind)?.label ?? form.reportKind;

  const mainTitle = (form.title.trim() || kindLabel).toUpperCase();
  y = ensureSpace(doc, y, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BLACK);
  const titleLines = doc.splitTextToSize(mainTitle, CONTENT_W - 10);
  doc.text(titleLines, PAGE_W / 2, y, { align: 'center' });
  y += titleLines.length * 7 + 6;

  if (form.subtitle.trim()) {
    y = ensureSpace(doc, y, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    const subLines = doc.splitTextToSize(form.subtitle.trim(), CONTENT_W - 10);
    doc.text(subLines, PAGE_W / 2, y, { align: 'center' });
    y += subLines.length * 5.5 + 8;
  }

  y = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const natureLine = `Nature(s) du constat : ${incidentTypeLabels(form.incidentTypes)}`;
  const natureLines = doc.splitTextToSize(natureLine, CONTENT_W);
  doc.text(natureLines, MARGIN, y);
  y += natureLines.length * 5 + 12;

  y = drawMetadataBlock(doc, y, [
    { label: 'Nom de la société', value: form.companyName },
    { label: 'Date', value: formatDateDdMmYyyy(form.incidentDate) },
    { label: 'Heure', value: formatHeure(form.incidentTime) },
    { label: 'Lieu', value: form.location },
    { label: "Type d'incident", value: form.incidentTypeDetail || kindLabel },
  ]);

  for (const section of form.sections) {
    if (!section.title.trim() && !section.content.trim()) continue;
    y = drawProseSection(doc, y, section.title, section.content);
  }

  if (form.incidentTypes.includes('accident')) {
    y = drawVehicleProse(doc, y, form.vehicleInfo);
  }

  const allAttachments = [...attachmentDataUrls];
  for (const file of form.attachmentFiles) {
    try {
      if (file.type.startsWith('image/')) {
        allAttachments.push(await fileToDataUrl(file));
      }
    } catch {
      /* skip */
    }
  }

  if (allAttachments.length > 0) {
    y = drawProseSection(
      doc,
      y,
      'Annexes — pièces jointes',
      `${allAttachments.length} photographie(s) ou document(s) joint(s) en pages suivantes.`
    );

    for (let i = 0; i < allAttachments.length; i++) {
      doc.addPage();
      let ay = MARGIN + 8;
      if (logo) {
        const x = (PAGE_W - logo.w) / 2;
        doc.addImage(logo.dataUrl, 'PNG', x, ay, logo.w * 0.65, logo.h * 0.65);
        ay += logo.h * 0.65 + 10;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...BLACK);
      doc.text(`Annexe ${i + 1} — Photographie`, PAGE_W / 2, ay, { align: 'center' });
      ay += 12;
      try {
        const maxH = FOOTER_Y - ay - 10;
        const imgW = CONTENT_W;
        const imgH = Math.min(maxH, imgW * 0.75);
        doc.addImage(allAttachments[i], 'JPEG', MARGIN, ay, imgW, imgH, undefined, 'FAST');
      } catch {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('(Image non affichable)', MARGIN, ay + 10);
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p, pageCount);
  }

  return doc;
}

export async function downloadRhSecurityReportPdf(
  form: RhSecurityReportForm,
  fileName?: string
): Promise<void> {
  const doc = await generateRhSecurityReportPdf(form);
  const safeName =
    fileName ||
    `rapport_${form.companyName.replace(/[^\w.-]+/g, '_') || 'site'}_${form.incidentDate || 'date'}.pdf`;
  doc.save(safeName);
}
