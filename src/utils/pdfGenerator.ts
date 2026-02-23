import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, DocumentItem } from '@/types';
import grosafeLogo from '@/assets/grosafe-logo.webp';

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

// Convert image to base64 for PDF embedding
const getLogoBase64 = (): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = grosafeLogo;
  });
};

export const generateInventoryPDF = (products: Product[]) => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text('GROSAFE ÉQUIPEMENT', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Liste Inventaire Complet', 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Généré le: ${new Date().toLocaleDateString('fr-TN')}`, 14, 40);
  
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
    const categoryTotal = categoryProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
    grandTotal += categoryTotal;
    
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
    
    const tableData = categoryProducts.map(p => [
      p.sku,
      p.name,
      p.size || '-',
      p.fournisseur || '-',
      p.quantity.toString(),
      `${p.price.toFixed(3)} TND`,
      `${(p.price * p.quantity).toFixed(3)} TND`
    ]);
    
    autoTable(doc, {
      startY: startY + 4,
      head: [['Code', 'Désignation', 'Taille', 'Fournisseur', 'Qté', 'Prix Unit.', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });
    
    // Category subtotal
    const tableEndY = (doc as any).lastAutoTable.finalY || startY + 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(`Sous-total ${category}: ${categoryTotal.toFixed(3)} TND`, 14, tableEndY + 6);
    
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
  doc.text(`Valeur Totale Inventaire: ${grandTotal.toFixed(3)} TND`, 14, startY + 10);
  
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
  doc.text(`Généré le: ${new Date().toLocaleDateString('fr-TN')}`, 14, 40);
  
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
}

export const generateOfficialPDF = async (params: OfficialPDFParams, options?: { returnBlob?: boolean }): Promise<jsPDF | void> => {
  const {
    docType, docNumber, docDate, docValidity, transportRef,
    thirdPartyName, thirdPartyAddress, thirdPartyTaxId, docItems
  } = params;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const logoBase64 = await getLogoBase64();
  
  // Add logo
  doc.addImage(logoBase64, 'PNG', 14, 10, 44, 12);
  
  // Company name next to logo
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('GROSAFE ÉQUIPEMENT', 60, 20);
  
  // Horizontal line under header
  doc.setDrawColor(199, 62, 62);
  doc.setLineWidth(1);
  doc.line(14, 32, pageWidth - 14, 32);
  
  // Document type title
  const typeInfo = documentTypes.find(t => t.value === docType)!;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(typeInfo.label.toUpperCase(), pageWidth / 2, 45, { align: 'center' });
  
  // Document number and date box
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - 75, 52, 61, 22, 2, 2);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`N° : ${docNumber || '______'}`, pageWidth - 72, 60);
  doc.text(`Date : ${new Date(docDate).toLocaleDateString('fr-FR')}`, pageWidth - 72, 68);
  
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
  doc.setTextColor(30, 58, 95);
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
  doc.setTextColor(30, 58, 95);
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
  
  autoTable(doc, {
    startY: 135,
    head: tableHead,
    body: tableData.length > 0 ? tableData : [emptyRow],
    theme: 'grid',
    headStyles: { 
      fillColor: [30, 58, 95],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 4
    },
    columnStyles: showPrice ? {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 50 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' }
    } : {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 75 },
      3: { cellWidth: 25, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    }
  });
  
  // Add total for documents with price
  if (showPrice && docItems.length > 0) {
    const grandTotal = docItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const tableY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(`Total Général : ${grandTotal.toFixed(3)} TND`, pageWidth - 14, tableY + 8, { align: 'right' });
  }
  
  // Signature boxes
  const finalY = Math.max((doc as any).lastAutoTable?.finalY || 150, 180);
  
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, finalY + 15, 80, 30, 2, 2);
  doc.roundedRect(pageWidth - 94, finalY + 15, 80, 30, 2, 2);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Signature et cachet Grosafe équipement', 16, finalY + 23);
  doc.text(`Signature et cachet ${thirdPartyLabel}`, pageWidth - 92, finalY + 23);
  
  // Footer section
  const footerY = pageHeight - 25;
  
  doc.setDrawColor(199, 62, 62);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Société Grosafe Equipment', 14, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Adresse : Immeuble Salma Dar Fadhal Aouina, Tunis', 14, footerY + 5);
  doc.text('Email : contact@grosafe.net', 14, footerY + 10);
  doc.text('Tel : +216 22219219 ; +216 27277777', pageWidth / 2, footerY + 10, { align: 'center' });
  doc.text('Code TVA : 1752965/M/A/M', pageWidth - 14, footerY + 10, { align: 'right' });
  
  if (options?.returnBlob) {
    return doc;
  }
  const fileName = `${docType}_${docNumber || 'nouveau'}_${docDate}.pdf`;
  doc.save(fileName);
};

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
  items: { designation: string; fournisseur: string; prix_ttc: number; quantity: number; remise: number; description?: string; prix_achat?: number }[];
  total_amount: number;
  notes: string | null;
  is_ttc: boolean;
}

const buildDevisPDF = async (devis: DevisPDFData): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoBase64 = await getLogoBase64();

  // Header: logo + company info
  doc.addImage(logoBase64, 'PNG', 14, 10, 44, 12);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Grosafe Équipement', pageWidth - 14, 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Sécurité & Équipement Professionnel', pageWidth - 14, 20, { align: 'right' });

  // Blue separator
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(1);
  doc.line(14, 32, pageWidth - 14, 32);

  // Title
  const title = devis.type === 'sortant' ? 'OFFRE DE PRIX' : 'DEMANDE DE PRIX';
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(title, pageWidth / 2, 46, { align: 'center' });

  // Number & Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const dateStr = new Date(devis.devis_date).toLocaleDateString('fr-FR');
  doc.text(`N° ${devis.devis_number}`, pageWidth / 2 - 30, 54, { align: 'center' });
  doc.text(`Date: ${dateStr}`, pageWidth / 2 + 30, 54, { align: 'center' });

  // Client / Fournisseur box
  const partyLabel = devis.type === 'sortant' ? 'CLIENT' : 'FOURNISSEUR';
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

  // Items table
  const TVA_RATE = 0.19;
  const isTTC = devis.is_ttc;

  const isSortant = devis.type === 'sortant';
  const hasPrixAchat = isSortant && devis.items.some(i => i.prix_achat != null && i.prix_achat > 0);

  const tableData = devis.items.map((item, idx) => {
    if (isTTC) {
      const prixVenteHT = item.prix_ttc / (1 + TVA_RATE);
      const prixApresRemise = item.remise > 0 ? item.prix_ttc * (1 - item.remise / 100) : item.prix_ttc;
      const totalTTC = prixApresRemise * item.quantity;
      const row = [
        (idx + 1).toString(),
        item.designation,
        item.quantity.toString(),
      ];
      if (hasPrixAchat) row.push(item.prix_achat != null && item.prix_achat > 0 ? `${item.prix_achat.toFixed(3)} DT` : '-');
      row.push(`${prixVenteHT.toFixed(3)} DT`);
      row.push(item.remise > 0 ? `${item.remise}%` : '-');
      row.push(item.remise > 0 ? `${prixApresRemise.toFixed(3)} DT` : '-');
      row.push('19%');
      row.push(`${totalTTC.toFixed(3)} DT`);
      return row;
    } else {
      const prixHT = item.prix_ttc;
      const prixApresRemise = item.remise > 0 ? prixHT * (1 - item.remise / 100) : prixHT;
      const totalHT = prixApresRemise * item.quantity;
      const prixAchatHT = item.prix_achat != null && item.prix_achat > 0 ? item.prix_achat / (1 + TVA_RATE) : 0;
      const row = [
        (idx + 1).toString(),
        item.designation,
        item.quantity.toString(),
      ];
      if (hasPrixAchat) row.push(prixAchatHT > 0 ? `${prixAchatHT.toFixed(3)} DT` : '-');
      row.push(`${prixHT.toFixed(3)} DT`);
      row.push(item.remise > 0 ? `${item.remise}%` : '-');
      row.push(item.remise > 0 ? `${prixApresRemise.toFixed(3)} DT` : '-');
      row.push('');
      row.push(`${totalHT.toFixed(3)} DT`);
      return row;
    }
  });

  const headLabel = isTTC ? 'Total TTC' : 'Total HT';
  const headRow = ['Code', 'Désignation', 'Qté'];
  if (hasPrixAchat) headRow.push(isTTC ? 'P.U. Achat TTC' : 'P.U. Achat HT');
  headRow.push(isTTC ? 'P.U. Vente HT' : 'P.U. Vente HT', 'Remise', 'Après Remise', 'TVA', headLabel);

  const colStyles: Record<number, any> = {
    0: { cellWidth: 14, halign: 'center' },
    1: { cellWidth: hasPrixAchat ? 32 : 40 },
    2: { cellWidth: 14, halign: 'center' },
  };
  let colIdx = 3;
  if (hasPrixAchat) { colStyles[colIdx] = { cellWidth: 22, halign: 'right' }; colIdx++; }
  colStyles[colIdx] = { cellWidth: 22, halign: 'right' }; colIdx++;
  colStyles[colIdx] = { cellWidth: 16, halign: 'center' }; colIdx++;
  colStyles[colIdx] = { cellWidth: 22, halign: 'right' }; colIdx++;
  colStyles[colIdx] = { cellWidth: 14, halign: 'center' }; colIdx++;
  colStyles[colIdx] = { cellWidth: 24, halign: 'right' };

  autoTable(doc, {
    startY: 96,
    head: [headRow],
    body: tableData.length > 0 ? tableData : [headRow.map(() => '')],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: colStyles,
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  // Totals
  const tableEndY = (doc as any).lastAutoTable?.finalY || 120;

  if (isTTC) {
    const totalTTC = devis.total_amount;
    const totalHT = totalTTC / (1 + TVA_RATE);
    const tva = totalTTC - totalHT;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text('Total HT', pageWidth - 65, tableEndY + 10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${totalHT.toFixed(2)} DT`, pageWidth - 14, tableEndY + 10, { align: 'right' });

    doc.setTextColor(30, 58, 95);
    doc.text('TVA (19%)', pageWidth - 65, tableEndY + 18);
    doc.setTextColor(0, 0, 0);
    doc.text(`${tva.toFixed(2)} DT`, pageWidth - 14, tableEndY + 18, { align: 'right' });

    // Total TTC highlighted
    doc.setFillColor(30, 58, 95);
    doc.roundedRect(pageWidth - 90, tableEndY + 22, 76, 12, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Total TTC', pageWidth - 86, tableEndY + 30);
    doc.text(`${totalTTC.toFixed(2)} DT`, pageWidth - 18, tableEndY + 30, { align: 'right' });
  } else {
    // HT mode - just show Total HT
    doc.setFillColor(30, 58, 95);
    doc.roundedRect(pageWidth - 90, tableEndY + 8, 76, 12, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Total HT', pageWidth - 86, tableEndY + 16);
    doc.text(`${devis.total_amount.toFixed(2)} DT`, pageWidth - 18, tableEndY + 16, { align: 'right' });
  }

  // Footer
  const footerY = pageHeight - 25;
  doc.setDrawColor(199, 62, 62);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 10, pageWidth - 14, footerY - 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Grosafe Équipement - Sécurité & Équipement Professionnel', pageWidth / 2, footerY - 4, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Cette offre est valable 30 jours à compter de la date d\'émission.', pageWidth / 2, footerY + 2, { align: 'center' });

  return doc;
};

export const downloadDevisPDF = async (devis: DevisPDFData) => {
  const doc = await buildDevisPDF(devis);
  doc.save(`devis_${devis.devis_number}_${devis.devis_date}.pdf`);
};

export const getDevisPDFBlobUrl = async (devis: DevisPDFData): Promise<string> => {
  const doc = await buildDevisPDF(devis);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};
