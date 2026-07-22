import { jsPDF } from 'jspdf';
import { formatAppDate } from '@/lib/formatAppDate';
import type { TenantBillingReceipt, TenantInfo } from '@/lib/tenantTypes';
import {
  TENANT_BILLING_CYCLE_LABELS,
  TENANT_PLAN_LABELS,
} from '@/lib/tenantTypes';

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(3)} ${currency}`;
}

/** Witnext SaaS license receipt (not a Tunisian commercial facture). */
export function downloadTenantBillingReceiptPDF(
  tenant: TenantInfo,
  receipt: TenantBillingReceipt
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Witnext', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Reçu de licence ERP', margin, y);
  y += 12;

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.line(margin, y, 210 - margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Reçu N° ${receipt.numero}`, margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Émis le : ${formatAppDate(receipt.issuedAt)}`, margin, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Organisation', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(tenant.tenantName, margin, y);
  y += 5;
  doc.setTextColor(100);
  doc.text(`Réf. ${tenant.slug}`, margin, y);
  doc.setTextColor(0);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Détails de la licence', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');

  const rows: [string, string][] = [
    ['Offre', TENANT_PLAN_LABELS[receipt.plan] ?? receipt.plan],
    [
      'Cycle',
      receipt.billingCycle
        ? TENANT_BILLING_CYCLE_LABELS[receipt.billingCycle]
        : '—',
    ],
    [
      'Période',
      receipt.periodStart && receipt.periodEnd
        ? `${formatAppDate(receipt.periodStart)} → ${formatAppDate(receipt.periodEnd)}`
        : '—',
    ],
    ['Montant HT', formatMoney(receipt.amountHt, receipt.currency)],
    ['Utilisateurs max.', String(tenant.maxUsers)],
    ['Sociétés max.', String(tenant.maxCompanies)],
  ];

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text(label, margin, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(value, margin + 45, y);
    y += 7;
  }

  if (receipt.notes?.trim()) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(receipt.notes.trim(), 170);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  y = Math.max(y + 16, 250);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'Document généré par Witnext — reçu d’abonnement logiciel. TVA et facture fiscale selon modalités commerciales.',
    margin,
    y,
    { maxWidth: 170 }
  );

  doc.save(`Witnext_Recu_${receipt.numero}.pdf`);
}
