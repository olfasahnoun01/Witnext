import { exportExcelTable } from '@/lib/exportExcel';

export type ReportExportFormat = 'csv' | 'excel' | 'pdf' | 'print';

export interface ReportExportPayload {
  title: string;
  subtitle?: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number)[][];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportCsv({ filenameBase, headers, rows }: ReportExportPayload): void {
  const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => String(c)).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filenameBase}.csv`);
}

export async function exportReportExcel(payload: ReportExportPayload): Promise<void> {
  await exportExcelTable({
    filename: `${payload.filenameBase}.xlsx`,
    sheetName: payload.title.slice(0, 31),
    headers: payload.headers,
    rows: payload.rows,
  });
}

export async function exportReportPdf(payload: ReportExportPayload): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(payload.title, 14, 16);
  if (payload.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(payload.subtitle, 14, 22);
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: payload.subtitle ? 26 : 20,
    head: [payload.headers],
    body: payload.rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${payload.filenameBase}.pdf`);
}

export function printReport(payload: ReportExportPayload): void {
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${payload.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { font-size: 12px; color: #555; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #1e3a5f; color: #fff; padding: 8px 6px; text-align: left; }
      td { border-bottom: 1px solid #e5e7eb; padding: 6px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .num { text-align: right; }
      @media print { body { padding: 12px; } }
    </style></head><body>
    <h1>${payload.title}</h1>
    ${payload.subtitle ? `<p>${payload.subtitle}</p>` : ''}
    <table>
      <thead><tr>${payload.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${payload.rows
          .map(
            (row) =>
              `<tr>${row.map((cell, i) => {
                const isNum = i > 0 && typeof cell === 'number';
                return `<td class="${isNum ? 'num' : ''}">${cell}</td>`;
              }).join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
    <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export async function exportReport(
  format: ReportExportFormat,
  payload: ReportExportPayload
): Promise<void> {
  switch (format) {
    case 'csv':
      exportReportCsv(payload);
      break;
    case 'excel':
      await exportReportExcel(payload);
      break;
    case 'pdf':
      await exportReportPdf(payload);
      break;
    case 'print':
      printReport(payload);
      break;
  }
}
