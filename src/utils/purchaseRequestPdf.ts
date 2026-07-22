import { jsPDF } from 'jspdf';
import grosafeLogo from '@/assets/grosafe-logo.webp';
import { formatAppDate } from '@/lib/formatAppDate';
import type { UnifiedDocument } from '@/types';

export function parsePurchaseRequestLineDescription(raw?: string | null): {
  articleName: string;
  supplier: string;
  size: string;
  detail: string;
} {
  if (!raw?.trim()) {
    return { articleName: 'Article', supplier: '', size: '', detail: '' };
  }
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  let articleName = '';
  let supplier = '';
  let size = '';
  const details: string[] = [];

  for (const part of parts) {
    const supplierMatch = part.match(/^Fournisseur:\s*(.+)$/i);
    if (supplierMatch) {
      supplier = supplierMatch[1].trim();
      continue;
    }
    const sizeMatch = part.match(/^Taille:\s*(.+)$/i);
    if (sizeMatch) {
      size = sizeMatch[1].trim();
      continue;
    }
    if (!articleName) {
      articleName = part;
    } else {
      details.push(part);
    }
  }

  return {
    articleName: articleName || 'Article',
    supplier,
    size,
    detail: details.join(' | '),
  };
}

export function encodePurchaseRequestLineDescription(input: {
  articleName: string;
  supplier?: string;
  size?: string;
  detail?: string;
}): string {
  return [
    input.articleName.trim(),
    input.supplier?.trim() ? `Fournisseur: ${input.supplier.trim()}` : '',
    input.size?.trim() ? `Taille: ${input.size.trim()}` : '',
    input.detail?.trim() || '',
  ]
    .filter(Boolean)
    .join(' | ');
}

type PdfLogo = { dataUrl: string; widthMm: number; heightMm: number };

const LOGO_MAX_H = 18;
const LOGO_MAX_W = 45;

function loadGrosafeLogoForPdf(): Promise<PdfLogo | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let settled = false;
    const finish = (result: PdfLogo | null) => {
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
      const aspect = img.width / Math.max(img.height, 1);
      let heightMm = LOGO_MAX_H;
      let widthMm = heightMm * aspect;
      if (widthMm > LOGO_MAX_W) {
        widthMm = LOGO_MAX_W;
        heightMm = widthMm / aspect;
      }
      finish({
        dataUrl: canvas.toDataURL('image/png'),
        widthMm,
        heightMm,
      });
    };
    img.onerror = () => finish(null);
    img.src = grosafeLogo;
    setTimeout(() => finish(null), 3000);
  });
}

/** Printable demande d'achat PDF with Grosafe logo. */
export async function downloadPurchaseRequestPDF(docData: UnifiedDocument): Promise<void> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;

  const logo = await loadGrosafeLogoForPdf();
  if (logo?.dataUrl) {
    pdf.addImage(logo.dataUrl, 'PNG', margin, 10, logo.widthMm, logo.heightMm);
  }

  let y = 12 + (logo?.heightMm ?? 0) + 6;

  pdf.setDrawColor(13, 44, 68);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(13, 44, 68);
  pdf.text("DEMANDE D'ACHAT", pageWidth / 2, y, { align: 'center' });
  y += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`N° ${docData.numero}`, margin, y);
  pdf.text(`Date : ${formatAppDate(docData.created_at)}`, pageWidth - margin, y, {
    align: 'right',
  });
  y += 10;

  const colX = {
    article: margin,
    fournisseur: margin + 55,
    taille: margin + 105,
    qte: margin + 135,
    detail: margin + 150,
  };

  pdf.setFillColor(190, 214, 236);
  pdf.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(13, 44, 68);
  pdf.text('Article', colX.article, y);
  pdf.text('Fournisseur', colX.fournisseur, y);
  pdf.text('Taille', colX.taille, y);
  pdf.text('Qté', colX.qte, y);
  pdf.text('Description', colX.detail, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);

  const lines = docData.lines ?? [];
  if (lines.length === 0) {
    pdf.text('Aucun article', margin, y);
    y += 6;
  } else {
    for (const line of lines) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      const parsed = parsePurchaseRequestLineDescription(
        line.description || line.product_name
      );
      const article =
        line.product_name?.trim() && !line.description?.startsWith(line.product_name)
          ? line.product_name
          : parsed.articleName;

      const articleLines = pdf.splitTextToSize(article, 50);
      const supplierLines = pdf.splitTextToSize(parsed.supplier || '—', 46);
      const detailLines = pdf.splitTextToSize(parsed.detail || '—', 42);
      const rowH = Math.max(
        6,
        articleLines.length * 4,
        supplierLines.length * 4,
        detailLines.length * 4
      );

      pdf.text(articleLines, colX.article, y);
      pdf.text(supplierLines, colX.fournisseur, y);
      pdf.text(parsed.size || '—', colX.taille, y);
      pdf.text(String(line.quantity), colX.qte, y);
      pdf.text(detailLines, colX.detail, y);
      y += rowH + 2;
    }
  }

  if (docData.notes?.trim()) {
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Notes', margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const noteLines = pdf.splitTextToSize(docData.notes.trim(), pageWidth - margin * 2);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 4 + 8;
  }

  y = Math.max(y + 16, 250);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Signature : ________________', margin, y);
  pdf.text('Visa : ________________', pageWidth / 2, y);

  pdf.save(`Demande_Achat_${docData.numero}.pdf`);
}

export async function printPurchaseRequestPDF(docData: UnifiedDocument): Promise<void> {
  await downloadPurchaseRequestPDF(docData);
}
