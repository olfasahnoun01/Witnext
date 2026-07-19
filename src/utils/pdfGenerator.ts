import jsPDF from 'jspdf';
import { formatAppDate, formatAppDateTime, formatAppMonthYear } from '@/lib/formatAppDate';
import { autoTable } from 'jspdf-autotable';
import { Product, DocumentItem, UnifiedDocument } from '@/types';
import { computeDevisLine, computeDevisTotals, resolveDevisLineTvaRate, resolveFodecEnabled } from '@/lib/devisPricing';
import {
  applyPartyTvaPolicyToItems,
  devisItemsHavePositiveTva,
  fetchClientTvaStatusByParty,
  isPartyExonereDeTva,
} from '@/lib/devisTvaPolicy';
import { getDevisItemArticleCode, getDevisItemDetailDescription } from '@/lib/devisItemPdf';
import { getFactureCompanyBrand } from '@/lib/factureCompanyBrand';
import grosafeLogoFallback from '@/assets/grosafe-logo.webp';

/** Company logo bounds in PDF headers (mm). */
const PDF_LOGO_MAX_HEIGHT = 18;
const PDF_LOGO_MAX_WIDTH = 50;

const DEVIS_PDF_MARGIN_X = 14;

/** Short header labels — single line in narrow PDF columns (devis / BC / BL / facture). */
const DEVIS_PDF_TABLE_HEAD_TTC = [
  '#',
  'Code',
  'Désignation',
  'Description',
  'Qté',
  'PU HT',
  'Rem.%',
  'Net HT',
  'TVA %',
  'Mnt HT',
] as const;

const DEVIS_PDF_TABLE_HEAD_HT = [
  '#',
  'Code',
  'Désignation',
  'Description',
  'Qté',
  'PU HT',
  'Rem.%',
  'Net HT',
  'Mnt HT',
] as const;

const DEVIS_PDF_HEAD_STYLES = {
  fillColor: [30, 58, 95] as [number, number, number],
  textColor: 255,
  fontSize: 7.5,
  fontStyle: 'bold' as const,
  halign: 'center' as const,
  /** Tight horizontal padding so header labels use the full column width. */
  cellPadding: { top: 3.5, right: 0.6, bottom: 3.5, left: 0.6 },
  minCellHeight: 9,
  overflow: 'linebreak' as const,
  valign: 'middle' as const,
  lineColor: [30, 58, 95] as [number, number, number],
  lineWidth: 0.2,
};

/** Body cells — lighter, distinct from the header band. */
const DEVIS_PDF_BODY_STYLES = {
  fontSize: 8,
  fontStyle: 'normal' as const,
  cellPadding: { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 },
  overflow: 'linebreak' as const,
  valign: 'middle' as const,
  halign: 'center' as const,
  lineColor: [200, 205, 215] as [number, number, number],
  lineWidth: 0.15,
  textColor: [30, 30, 30] as [number, number, number],
};

/** Relative column weights (must sum to 100). Text columns wider so headers fit fully. */
const DEVIS_PDF_COL_WEIGHTS_TTC = [4, 6, 20, 16, 6, 10, 7, 10, 8, 13] as const;
const DEVIS_PDF_COL_WEIGHTS_HT = [4, 6, 22, 20, 7, 11, 8, 11, 11] as const;

function weightsToColumnStyles(
  weights: readonly number[],
  availableWidth: number
): Record<number, object> {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const styles: Record<number, object> = {};
  weights.forEach((weight, index) => {
    styles[index] = {
      cellWidth: (availableWidth * weight) / totalWeight,
      valign: 'middle',
      halign: 'center',
    };
  });
  return styles;
}

/** @internal Exported for unit tests — column width fractions must sum to table width. */
export function getDevisPdfTableColumnWidths(
  showTvaColumn: boolean,
  tableWidth: number
): number[] {
  const weights = showTvaColumn ? DEVIS_PDF_COL_WEIGHTS_TTC : DEVIS_PDF_COL_WEIGHTS_HT;
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => (tableWidth * w) / totalWeight);
}

/** Show TVA column + breakdown only in TTC mode when at least one line has a rate > 0. */
export function devisPdfShowsTvaBreakdown(
  items: DevisPDFData['items'],
  isTtc = false,
  partyExonereDeTva = false
): boolean {
  if (partyExonereDeTva) return false;
  if (!isTtc) return false;
  return items.some((item) => resolveDevisLineTvaRate(item.tva) > 0);
}

/** Column widths — all cells centered in the PDF table. */
function getDevisPdfTableColumnStyles(showTvaColumn: boolean, availableWidth: number): Record<number, object> {
  const weights = showTvaColumn ? DEVIS_PDF_COL_WEIGHTS_TTC : DEVIS_PDF_COL_WEIGHTS_HT;
  return weightsToColumnStyles(weights, availableWidth);
}

interface PdfLogoAsset {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

export interface SavedDocument {
  id: number;
  type: 'bon_livraison' | 'bon_sortie' | 'bon_entree';
  doc_number: string;
  doc_date: string;
  validity: string | null;
  transport_ref: string | null;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  items: DocumentItem[];
  total_amount: number;
  created_at: string;
}

export type DocumentType = 'bon_livraison' | 'bon_sortie' | 'bon_entree';

export const documentTypes: { value: DocumentType; label: string; color: string }[] = [
  { value: 'bon_livraison', label: 'Bon de Livraison', color: 'destructive' },
  { value: 'bon_sortie', label: 'Bon de Sortie', color: 'destructive' },
  { value: 'bon_entree', label: "Bon d'Entrée", color: 'success' }
];

/** Load company logo from brand URL (webp/png/svg) and convert to PNG for jsPDF. */
const getCompanyLogoForPdf = (logoUrl?: string | null): Promise<PdfLogoAsset | null> => {
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
      let heightMm = PDF_LOGO_MAX_HEIGHT;
      let widthMm = heightMm * aspect;
      if (widthMm > PDF_LOGO_MAX_WIDTH) {
        widthMm = PDF_LOGO_MAX_WIDTH;
        heightMm = widthMm / aspect;
      }
      finish({
        dataUrl: canvas.toDataURL('image/png'),
        widthMm,
        heightMm,
      });
    };
    img.onerror = () => {
      console.warn('Could not load company logo for PDF');
      finish(null);
    };
    const brand = getFactureCompanyBrand();
    img.src = logoUrl?.trim() || brand.logoUrl || grosafeLogoFallback;
    setTimeout(() => finish(null), 3000);
  });
};

const drawPdfCompanyLogo = (doc: jsPDF, logo: PdfLogoAsset | null, x = 14, y = 10) => {
  if (logo?.dataUrl) {
    doc.addImage(logo.dataUrl, 'PNG', x, y, logo.widthMm, logo.heightMm);
  }
  return logo ? logo.widthMm : 0;
};

export const generateInventoryPDF = (products: Product[], filterName?: string) => {
  const doc = new jsPDF();
  
  const title = filterName
    ? `Inventaire — ${filterName}`
    : 'Liste Inventaire Complet';

  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Généré le: ${formatAppDate(new Date())}`, 14, 40);
  
  // Group products by category
  const productsByCategory: Record<string, Product[]> = {};
  products.forEach(p => {
    const category = p.category || 'Non catégorisé';
    if (!productsByCategory[category]) {
      productsByCategory[category] = [];
    }
    productsByCategory[category].push(p);
  });
  
  // Sort categories alphabetically
  const sortedCategories = Object.keys(productsByCategory).sort((a, b) => 
    a.localeCompare(b, 'fr')
  );
  
  let startY = 48;
  let grandTotal = 0;
  
  sortedCategories.forEach((category, catIndex) => {
    const categoryProducts = productsByCategory[category];
    const categoryTotalNet = categoryProducts.reduce((sum, p) => {
      const netHT = p.price * (1 - (p.remise || 0) / 100);
      return sum + netHT * p.quantity;
    }, 0);
    grandTotal += categoryTotalNet;
    
    // Check if we need a new page
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
    
    // Category header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(`${category} (${categoryProducts.length} articles)`, 14, startY);
    
    const tableData = categoryProducts.map(p => {
      const netHT = p.price * (1 - (p.remise || 0) / 100);
      const total = netHT * p.quantity;
      return [
        p.sku,
        p.name,
        p.size || '-',
        p.fournisseur || '-',
        p.quantity.toString(),
        p.remise > 0 ? `${p.remise}%` : '-',
        `${netHT.toFixed(3)} TND`,
        `${total.toFixed(3)} TND`
      ];
    });
    
    let tableEndY = startY + 20;
    autoTable(doc, {
      startY: startY + 4,
      head: [['Code', 'Désignation', 'Taille', 'Fournisseur', 'Qté', 'Remise', 'Net HT', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15 },
        3: { cellWidth: 25 },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        tableEndY = data.cursor?.y || tableEndY;
      }
    });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(`Sous-total ${category} (Net): ${categoryTotalNet.toFixed(3)} TND`, 14, tableEndY + 6);
    
    startY = tableEndY + 14;
  });
  
  // Grand total
  if (startY > 270) {
    doc.addPage();
    startY = 20;
  }
  
  doc.setDrawColor(199, 62, 62);
  doc.setLineWidth(0.5);
  doc.line(14, startY, doc.internal.pageSize.getWidth() - 14, startY);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(`Valeur Totale Inventaire (Net HT): ${grandTotal.toFixed(3)} TND`, 14, startY + 10);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total: ${products.length} articles en ${sortedCategories.length} catégories`, 14, startY + 18);
  
  doc.save('inventaire_grosafe.pdf');
};

export const generateLowStockPDF = (lowStockProducts: Product[]) => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(220, 38, 38);
  doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Rapport Stock Faible / Rupture', 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Généré le: ${formatAppDate(new Date())}`, 14, 40);
  
  if (lowStockProducts.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(34, 197, 94);
    doc.text('Aucun produit en stock faible ou en rupture!', 14, 55);
  } else {
    const tableData = lowStockProducts.map(p => [
      p.sku,
      p.name,
      p.fournisseur,
      p.quantity.toString(),
      p.min_stock.toString(),
      p.quantity === 0 ? 'RUPTURE' : 'FAIBLE'
    ]);
    
    autoTable(doc, {
      startY: 48,
      head: [['Code', 'Désignation', 'Fournisseur', 'Stock', 'Minimum', 'Statut']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 9 },
      bodyStyles: {
        cellPadding: 3
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          if (data.cell.text[0] === 'RUPTURE') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [234, 179, 8];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
  }
  
  doc.save('stock_faible_grosafe.pdf');
};

interface OfficialPDFParams {
  docType: DocumentType;
  docNumber: string;
  docDate: string;
  docValidity: string;
  transportRef: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  docItems: DocumentItem[];
  notes?: string;
}

export const generateOfficialPDF = async (params: OfficialPDFParams, options?: { returnBlob?: boolean }): Promise<jsPDF | void> => {
  const {
    docType, docNumber, docDate, docValidity, transportRef,
    thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems,
    notes = '',
  } = params;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  /** Space reserved at bottom so footer text is never clipped. */
  const FOOTER_HEIGHT = 26;

  const brand = getFactureCompanyBrand();
  const accentRgb = brand.primaryRgb;
  const headerRgb = brand.secondaryRgb;

  const drawOfficialFooter = () => {
    const footerBase = pageHeight - 18;
    doc.setDrawColor(...accentRgb);
    doc.setLineWidth(0.5);
    doc.line(14, footerBase - 5, pageWidth - 14, footerBase - 5);

    const companyName = (brand.legalName || brand.displayName || '').trim();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...headerRgb);
    doc.text(`Société ${companyName}`, 14, footerBase);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const address = brand.address?.trim() || '';
    if (address) {
      doc.text(`Adresse : ${address}`, 14, footerBase + 4);
    }

    // Third line: Email (left) | Tel (center) | Code TVA (right)
    const email = brand.email?.trim() || '';
    const tel = brand.telFax?.trim() || '';
    const tva = brand.codeTva?.trim() || '';
    const detailY = footerBase + 9;
    if (email) {
      doc.text(`Email : ${email}`, 14, detailY);
    }
    if (tel) {
      doc.text(`Tel : ${tel}`, pageWidth / 2, detailY, { align: 'center' });
    }
    if (tva) {
      doc.text(`Code TVA : ${tva}`, pageWidth - 14, detailY, { align: 'right' });
    }
  };
  
  const logo = await getCompanyLogoForPdf(brand.logoUrl);
  drawPdfCompanyLogo(doc, logo);

  // Horizontal line under header (logo only — no company title)
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(1);
  doc.line(14, 32, pageWidth - 14, 32);
  
  // Document type title
  const typeInfo = documentTypes.find(t => t.value === docType)!;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...headerRgb);
  doc.text(typeInfo.label.toUpperCase(), pageWidth / 2, 45, { align: 'center' });
  
  // Document number and date box
  doc.setDrawColor(...headerRgb);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - 75, 52, 61, 22, 2, 2);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`N° : ${docNumber || '______'}`, pageWidth - 72, 60);
  doc.text(`Date : ${formatAppDate(docDate)}`, pageWidth - 72, 68);
  
  // Validity info
  if (docValidity) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Ce bon de commande est valable jusqu'au ${docValidity}`, 14, 58);
  }
  
  // Third party section
  const isEntree = docType === 'bon_entree';
  const thirdPartyLabel = isEntree ? 'Fournisseur' : 'Client';
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...headerRgb);
  doc.text(thirdPartyLabel, 14, 82);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Raison sociale : ${thirdPartyName || '________________________'}`, 14, 90);
  doc.text(`Adresse de livraison : ${thirdPartyAddress || '________________________'}`, 14, 98);
  doc.text(`Identification Fiscale : ${thirdPartyTaxId || '________________________'}`, 14, 106);
  
  // Delivery details section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...headerRgb);
  doc.text('Détails de la livraison', 14, 120);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Immatriculation voiture : ${transportRef || '________________________'}`, 14, 128);
  
  // Items table
  const showPrice = docType === 'bon_livraison' || docType === 'bon_sortie';
  
  const tableData = docItems.map((item, index) => {
    const baseRow = [
      (index + 1).toString(),
      item.designation,
      item.description || '',
      item.quantity.toString()
    ];
    if (showPrice) {
      const price = item.price || 0;
      const total = price * item.quantity;
      // Show price only if > 0, otherwise show empty or dash
      baseRow.push(price > 0 ? `${price.toFixed(3)} TND` : '-');
      baseRow.push(price > 0 ? `${total.toFixed(3)} TND` : '-');
    }
    return baseRow;
  });
  
  const tableHead = showPrice 
    ? [['Réf', 'Désignation', 'Description', 'Qté', 'Prix Unit.', 'Total']]
    : [['Référence', 'Désignation', 'Description', 'Quantité']];
  
  const emptyRow = showPrice ? ['', '', '', '', '', ''] : ['', '', '', ''];

  const tableWidth = pageWidth - 28;
  const priceColWeights = [10, 22, 26, 12, 15, 15];
  const noPriceColWeights = [12, 30, 46, 12];
  const weights = showPrice ? priceColWeights : noPriceColWeights;
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const columnStyles: Record<number, { cellWidth: number; halign?: 'center' | 'right' }> = {};
  weights.forEach((weight, index) => {
    columnStyles[index] = {
      cellWidth: (tableWidth * weight) / weightSum,
      ...(index === 0 || index === 3 ? { halign: 'center' as const } : {}),
      ...(showPrice && (index === 4 || index === 5) ? { halign: 'right' as const } : {}),
    };
  });

  let officialTableEndY = 150;
  autoTable(doc, {
    startY: 135,
    head: tableHead,
    body: tableData.length > 0 ? tableData : [emptyRow],
    theme: 'grid',
    tableWidth,
    headStyles: {
      fillColor: headerRgb,
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      overflow: 'linebreak',
    },
    columnStyles,
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    },
    margin: { left: 14, right: 14, bottom: FOOTER_HEIGHT },
    didDrawPage: (data) => {
      officialTableEndY = data.cursor?.y || officialTableEndY;
      drawOfficialFooter();
    }
  });
  
  let cursorY = officialTableEndY + 8;

  // Add total for documents with price
  if (showPrice && docItems.length > 0) {
    const grandTotal = docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    if (cursorY > pageHeight - FOOTER_HEIGHT - 12) {
      doc.addPage();
      cursorY = 25;
      drawOfficialFooter();
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...headerRgb);
    doc.text(`Total Général : ${grandTotal.toFixed(3)} TND`, pageWidth - 14, cursorY, { align: 'right' });
    cursorY += 10;
  }

  // Notes / Observations
  const notesText = notes.trim();
  if (notesText) {
    if (cursorY > pageHeight - FOOTER_HEIGHT - 40) {
      doc.addPage();
      cursorY = 25;
      drawOfficialFooter();
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...headerRgb);
    doc.text('Notes / Observations', 14, cursorY);
    cursorY += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(notesText, pageWidth - 28) as string[];
    for (const line of noteLines) {
      if (cursorY > pageHeight - FOOTER_HEIGHT - 8) {
        doc.addPage();
        cursorY = 25;
        drawOfficialFooter();
      }
      doc.text(line, 14, cursorY);
      cursorY += 5;
    }
    cursorY += 6;
  }
  
  // Signature boxes — keep above footer
  if (cursorY + 45 > pageHeight - FOOTER_HEIGHT) {
    doc.addPage();
    cursorY = 25;
    drawOfficialFooter();
  }
  const finalY = cursorY;
  
  doc.setDrawColor(...headerRgb);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, finalY, 80, 30, 2, 2);
  doc.roundedRect(pageWidth - 94, finalY, 80, 30, 2, 2);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...headerRgb);
  doc.text('Signature et cachet', 16, finalY + 8);
  doc.text(`Signature et cachet ${thirdPartyLabel}`, pageWidth - 92, finalY + 8);

  // Ensure footer on last page (autoTable already drew it on table pages)
  drawOfficialFooter();
  
  if (options?.returnBlob) {
    return doc;
  }
  const fileName = `${docType}_${docNumber || 'nouveau'}_${docDate}.pdf`;
  doc.save(fileName);
};

export const downloadUnifiedDocumentPDF = async (doc: UnifiedDocument) => {
  await generateOfficialPDF(unifiedDocumentToPdfParams(doc));
};

function unifiedDocumentToPdfParams(doc: UnifiedDocument) {
  const typeMap: Record<string, DocumentType> = {
    BC_FOURNISSEUR: 'bon_entree',
    BE: 'bon_entree',
    BL_FOURNISSEUR: 'bon_entree',
    BS: 'bon_sortie',
    BL_CLIENT: 'bon_livraison',
    BC_CLIENT: 'bon_livraison',
    FACTURE: 'bon_livraison',
  };

  const docType = typeMap[doc.type] || 'bon_livraison';

  const docItems: DocumentItem[] = (doc.lines || []).map((l) => {
    const product = (l as { products?: { sku?: string; name?: string } }).products;
    const rawDescription = l.description || '';
    let designation = product?.name || '';
    let description = rawDescription;

    if (!designation && rawDescription) {
      const sep = ' — ';
      const idx = rawDescription.indexOf(sep);
      if (idx >= 0) {
        designation = rawDescription.slice(0, idx).trim();
        description = rawDescription.slice(idx + sep.length).trim();
      } else {
        designation = rawDescription;
        description = '';
      }
    }

    return {
      product_id: l.product_id || 0,
      ref: product?.sku || '',
      designation: designation || 'Article',
      description,
      quantity: l.quantity,
      price: l.unit_price,
      total: l.total_price,
    };
  });

  const metadata = doc.metadata as Record<string, unknown> | undefined;

  return {
    docType,
    docNumber: doc.numero,
    docDate: (metadata?.document_date as string) || doc.created_at,
    docValidity: (metadata?.validity as string) || '',
    transportRef: (metadata?.transport_ref as string) || '',
    thirdPartyName:
      doc.fournisseur_name || doc.client_name || (metadata?.third_party_name as string) || '',
    thirdPartyAddress: (metadata?.third_party_address as string) || '',
    thirdPartyTaxId: (metadata?.third_party_tax_id as string) || '',
    docItems,
    notes: doc.notes || '',
  };
}

export async function getUnifiedDocumentPDFBlob(doc: UnifiedDocument): Promise<Blob> {
  const pdf = (await generateOfficialPDF(unifiedDocumentToPdfParams(doc), {
    returnBlob: true,
  })) as jsPDF;
  return pdf.output('blob');
}

async function printPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          window.setTimeout(() => resolve(), 400);
        } catch (err) {
          reject(err);
        }
      };
      iframe.onerror = () => reject(new Error("Impossible d'ouvrir le PDF"));
      document.body.appendChild(iframe);
      window.setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 60_000);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function printUnifiedDocument(doc: UnifiedDocument): Promise<void> {
  const blob = await getUnifiedDocumentPDFBlob(doc);
  await printPdfBlob(blob);
}

export async function printUnifiedDocuments(docs: UnifiedDocument[]): Promise<void> {
  for (const doc of docs) {
    await printUnifiedDocument(doc);
  }
}

export const downloadDocumentPDF = async (savedDoc: SavedDocument) => {
  await generateOfficialPDF({
    docType: savedDoc.type,
    docNumber: savedDoc.doc_number,
    docDate: savedDoc.doc_date,
    docValidity: savedDoc.validity || '',
    transportRef: savedDoc.transport_ref || '',
    thirdPartyName: savedDoc.third_party_name || '',
    thirdPartyAddress: savedDoc.third_party_address || '',
    thirdPartyTaxId: savedDoc.third_party_tax_id || '',
    docItems: savedDoc.items
  });
};

export const getDocumentPDFBlobUrl = async (savedDoc: SavedDocument): Promise<string> => {
  const doc = await generateOfficialPDF({
    docType: savedDoc.type,
    docNumber: savedDoc.doc_number,
    docDate: savedDoc.doc_date,
    docValidity: savedDoc.validity || '',
    transportRef: savedDoc.transport_ref || '',
    thirdPartyName: savedDoc.third_party_name || '',
    thirdPartyAddress: savedDoc.third_party_address || '',
    thirdPartyTaxId: savedDoc.third_party_tax_id || '',
    docItems: savedDoc.items
  }, { returnBlob: true }) as jsPDF;
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// ─── Devis (Offre de Prix) PDF ───────────────────────────────────

export interface DevisPDFData {
  devis_number: string;
  devis_date: string;
  type: 'entrant' | 'sortant';
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  items: { designation: string; fournisseur: string; prix_ttc: number; quantity: number; remise: number; sku?: string; description?: string; prix_achat?: number; tva?: number }[];
  total_amount: number;
  notes: string | null;
  is_ttc: boolean;
  is_bc: boolean;
  is_ba: boolean;
  is_bl?: boolean;
  is_facture?: boolean;
  date_echeance?: string | null;
  /** Client exonéré de TVA — masque TVA dans le PDF même si des lignes ont un taux enregistré. */
  party_exonere_de_tva?: boolean;
  /** Optional company code override for facture branding (defaults to active company). */
  company_code?: string | null;
}

/** Safe PDF basename: document number + client or fournisseur name. */
export const buildDocumentPdfFileName = (devis: DevisPDFData): string => {
  const sanitize = (value: string, fallback: string) => {
    const cleaned = value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return cleaned || fallback;
  };

  const isVente = devis.type === 'sortant';
  const num = sanitize(devis.devis_number || 'document', 'document');
  const party = sanitize(
    devis.third_party_name || '',
    isVente ? 'client' : 'fournisseur'
  );
  return `${num} ${party}.pdf`;
};

const buildDevisPDF = async (devis: DevisPDFData): Promise<jsPDF> => {
  // Official BL-Facture layout (same template for all companies; logo/theme per brand).
  if (devis.is_facture) {
    const { buildFacturePDF } = await import('./facturePdfTemplate');
    const { getActiveCompanyCode } = await import('@/lib/factureCompanyBrand');
    return buildFacturePDF(devis, devis.company_code ?? getActiveCompanyCode());
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const brand = getFactureCompanyBrand(devis.company_code);
  const logo = await getCompanyLogoForPdf(brand.logoUrl);
  drawPdfCompanyLogo(doc, logo);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brand.secondaryRgb);
  doc.text(brand.displayName, pageWidth - 14, 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (brand.address) {
    doc.text(brand.address, pageWidth - 14, 20, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brand.secondaryRgb);
  if (brand.rib) {
    doc.text(`RIB : ${brand.rib}`, pageWidth - 14, 27, { align: 'right' });
  }

  // Brand separator
  doc.setDrawColor(...brand.primaryRgb);
  doc.setLineWidth(1);
  doc.line(14, 32, pageWidth - 14, 32);

  // Title
  const isVente = devis.type === 'sortant' || devis.type === 'vente' as any;
  const title = devis.is_facture
    ? 'FACTURE'
    : devis.is_bl
      ? 'BON DE LIVRAISON'
      : devis.is_ba
        ? "BON D'ACHAT"
        : devis.is_bc
          ? 'BON DE COMMANDE'
          : isVente
            ? 'OFFRE DE PRIX'
            : 'DEMANDE DE PRIX';
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(title, pageWidth / 2, 46, { align: 'center' });

  // Number & Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const dateStr = formatAppDate(devis.devis_date);
  const metaY = devis.is_facture && devis.date_echeance ? 52 : 54;
  if (devis.is_facture && devis.date_echeance) {
    const dueStr = formatAppDate(devis.date_echeance);
    const metaMargin = 18;
    doc.text(`N° ${devis.devis_number}`, metaMargin, metaY);
    doc.text(`Date : ${dateStr}`, pageWidth / 2, metaY, { align: 'center' });
    doc.text(`Échéance : ${dueStr}`, pageWidth - metaMargin, metaY, { align: 'right' });
  } else {
    doc.text(`N° ${devis.devis_number}`, pageWidth / 2 - 30, metaY, { align: 'center' });
    doc.text(`Date : ${dateStr}`, pageWidth / 2 + 30, metaY, { align: 'center' });
  }

  // Client / Fournisseur box
  const partyLabel = isVente ? 'CLIENT' : 'FOURNISSEUR';
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 62, pageWidth - 28, 28, 2, 2);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(partyLabel, 18, 70);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(devis.third_party_name || '—', 18, 78);
  if (devis.third_party_address) {
    doc.setFontSize(9);
    doc.text(devis.third_party_address, 18, 84);
  }
  if (devis.third_party_tax_id) {
    doc.setFontSize(9);
    doc.text(`MF: ${devis.third_party_tax_id}`, pageWidth - 18, 78, { align: 'right' });
  }
  if (devis.third_party_phone) {
    doc.setFontSize(9);
    doc.text(`Tél: ${devis.third_party_phone}`, pageWidth - 18, 84, { align: 'right' });
  }

  // Items table — PU HT + per-line TVA (is_ttc legacy OR explicit line rates)
  const showTvaColumn = devisPdfShowsTvaBreakdown(
    devis.items,
    devis.is_ttc,
    devis.party_exonere_de_tva
  );
  /** Lignes enregistrées en PU HT (avant remise) ; TVA/remise via computeDevisLine */
  const linePricesAreUnitHt = false;

  const tableData = devis.items.map((item, idx) => {
    const line = computeDevisLine(item, linePricesAreUnitHt);
    const sousTotal = line.lineHT;
    const prixUnitDisplay = line.unitHT.toFixed(3);
    return [
      (idx + 1).toString(),
      getDevisItemArticleCode(item),
      item.designation,
      getDevisItemDetailDescription(item),
      item.quantity.toString(),
      `${prixUnitDisplay} TND`,
      item.remise > 0 ? `${item.remise}%` : '-',
      `${line.unitAfterRemiseHT.toFixed(3)} TND`,
      ...(showTvaColumn ? [`${resolveDevisLineTvaRate(item.tva)}%`] : []),
      `${sousTotal.toFixed(3)} TND`,
    ];
  });

  const headRow = showTvaColumn ? [...DEVIS_PDF_TABLE_HEAD_TTC] : [...DEVIS_PDF_TABLE_HEAD_HT];

  const itemsTableWidth = pageWidth - DEVIS_PDF_MARGIN_X * 2;

  let devisTableEndY = 120;
  autoTable(doc, {
    startY: 96,
    head: [headRow],
    body: tableData.length > 0 ? tableData : [headRow.map(() => '')],
    theme: 'grid',
    tableWidth: itemsTableWidth,
    headStyles: DEVIS_PDF_HEAD_STYLES,
    bodyStyles: DEVIS_PDF_BODY_STYLES,
    styles: {
      ...DEVIS_PDF_BODY_STYLES,
    },
    rowPageBreak: 'avoid',
    columnStyles: getDevisPdfTableColumnStyles(showTvaColumn, itemsTableWidth),
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: DEVIS_PDF_MARGIN_X, right: DEVIS_PDF_MARGIN_X, bottom: 35 },
    didParseCell: (data) => {
      if (data.section === 'head') {
        // Header band: labels use full cell width, wrap if needed, stay centered.
        data.cell.styles.overflow = 'linebreak';
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.valign = 'middle';
        data.cell.styles.halign = 'center';
        data.cell.styles.cellPadding = { top: 3.5, right: 0.6, bottom: 3.5, left: 0.6 };
        data.cell.styles.minCellHeight = 9;
        data.cell.styles.fillColor = [30, 58, 95];
        data.cell.styles.textColor = 255;
      }
      if (data.section === 'body') {
        // Body values — normal weight, more padding, clearly below the header.
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle';
        data.cell.styles.fontStyle = 'normal';
        data.cell.styles.fontSize = 8;
        data.cell.styles.cellPadding = { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 };
        data.cell.styles.textColor = [30, 30, 30];
      }
    },
    didDrawCell: (data) => {
      // Thick separator between header row and article values.
      if (data.section === 'head') {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.7);
        doc.line(x, y + height, x + width, y + height);
      }
    },
    didDrawPage: (data) => {
      devisTableEndY = data.cursor?.y || devisTableEndY;
    }
  });

  // Compute detailed totals using shared helper
  const totals = computeDevisTotals(devis.items, linePricesAreUnitHt, {
    devisType: (devis.type === 'sortant' || devis.type === 'vente' as any) ? 'vente' : 'achat',
    docType: devis.is_bc ? 'bc' : (devis.is_ba ? 'ba' : 'devis'),
    isTvaEnabled: showTvaColumn,
    isFodecEnabled: resolveFodecEnabled({
      devisType: (devis.type === 'sortant' || devis.type === 'vente' as any) ? 'vente' : 'achat',
      items: devis.items,
    }),
  });
  const { totalHT, totalRemise, totalNet, totalTVA, totalTTC } = totals;
  const showTvaTotals = showTvaColumn && totalTVA > 0;

  const tableEndY = devisTableEndY;

  const totalsRows: (string | string[])[][] = [
    ['Total HT', `${totalHT.toFixed(3)} TND`],
  ];
  if (totalRemise > 0) {
    totalsRows.push(['Remise', `-${totalRemise.toFixed(3)} TND`]);
  }
  totalsRows.push(['Net HT', `${totalNet.toFixed(3)} TND`]);
  if (showTvaTotals) {
    totalsRows.push(
      ['TVA', `${totalTVA.toFixed(3)} TND`],
      ['Total TTC', `${totalTTC.toFixed(3)} TND`],
    );
    if (totals.totalFodec !== undefined && totals.totalFodec > 0) {
      totalsRows.push(['FODEC (1%)', `${totals.totalFodec.toFixed(3)} TND`]);
    }
  }
  totalsRows.push(
    ['Timbre fiscal', '1.000 TND'],
    // Distinct label: "Total TTC" above is before timbre; this row includes it.
    ['Net à payer', `${(showTvaTotals ? totals.totalFinal : totals.totalFinalHT).toFixed(3)} TND`],
  );

  // Manual drawing of totals to guarantee right alignment
  let ty = tableEndY + 12;
  const totalsBoxWidth = 96;
  const startX = pageWidth - totalsBoxWidth - 14;

  // Calculate total height to check for page break
  const totalTotalsHeight = (totalsRows.length - 1) * 8 + 10 + 12; // 12 is the margin top
  
  if (ty + totalTotalsHeight > pageHeight - 30) {
    doc.addPage();
    ty = 25; // Reset to top of new page
  }

  totalsRows.forEach((row, i) => {
    const isLast = i === totalsRows.length - 1;
    const label = String(row[0]);
    const val = String(row[1]);
    const rowHeight = isLast ? 10 : 8;
    
    // Background
    if (isLast) {
      doc.setFillColor(30, 58, 95);
      doc.rect(startX, ty - 6, totalsBoxWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      if (i % 2 === 0) doc.setFillColor(248, 249, 252);
      else doc.setFillColor(255, 255, 255);
      doc.rect(startX, ty - 6, totalsBoxWidth, rowHeight, 'F');
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', label === 'Net HT' || label === 'Total TTC' || label === 'Total HT' ? 'bold' : 'normal');
      doc.setFontSize(9);
      
      // Border bottom
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(startX, ty - 6 + rowHeight, startX + totalsBoxWidth, ty - 6 + rowHeight);
    }
    
    // Text
    doc.text(label, startX + 5, ty);
    doc.text(val, startX + totalsBoxWidth - 5, ty, { align: 'right' });
    
    ty += rowHeight;
  });

  const notesText = devis.notes?.trim();
  if (notesText) {
    ty += 12;
    if (ty > pageHeight - 45) {
      doc.addPage();
      ty = 25;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Notes', 14, ty);
    ty += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(notesText, pageWidth - 28);
    for (const line of noteLines) {
      if (ty > pageHeight - 22) {
        doc.addPage();
        ty = 25;
      }
      doc.text(line, 14, ty);
      ty += 5;
    }
  }

  // Footer
  const footerY = pageHeight - 10;
  doc.setDrawColor(199, 62, 62);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 10, pageWidth - 14, footerY - 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Grosafe Équipement - Sécurité & Équipement Professionnel', pageWidth / 2, footerY - 4, { align: 'center' });

  return doc;
};

async function normalizeDevisPdfData(devis: DevisPDFData): Promise<DevisPDFData> {
  if (devis.type !== 'sortant') return devis;

  const status = await fetchClientTvaStatusByParty(
    devis.third_party_name,
    devis.third_party_tax_id
  );

  if (isPartyExonereDeTva(status)) {
    return {
      ...devis,
      is_ttc: false,
      party_exonere_de_tva: true,
      items: applyPartyTvaPolicyToItems(devis.items, status),
    };
  }

  if (!devis.is_ttc && !devisItemsHavePositiveTva(devis.items)) {
    return {
      ...devis,
      is_ttc: false,
      party_exonere_de_tva: true,
      items: applyPartyTvaPolicyToItems(devis.items, 'exonere'),
    };
  }

  return devis;
}

export const downloadDevisPDF = async (devis: DevisPDFData) => {
  const normalized = await normalizeDevisPdfData(devis);
  const doc = await buildDevisPDF(normalized);
  doc.save(buildDocumentPdfFileName(normalized));
};

export const getDevisPDFBlobUrl = async (devis: DevisPDFData): Promise<string> => {
  const normalized = await normalizeDevisPdfData(devis);
  const doc = await buildDevisPDF(normalized);
  const buffer = doc.output("arraybuffer");
  const blob = new Blob([buffer], { type: "application/pdf" });
  return URL.createObjectURL(blob);
};

/** Trigger print on a visible PDF preview iframe (Electron cannot preview hidden-frame prints). */
export const printPdfPreviewIframe = (iframe: HTMLIFrameElement | null): boolean => {
  const win = iframe?.contentWindow;
  if (!win) return false;
  win.focus();
  win.print();
  return true;
};
