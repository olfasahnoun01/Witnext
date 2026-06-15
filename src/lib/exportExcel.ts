import type { Borders, CellValue } from 'exceljs';

export interface ExportExcelTableOptions {
  filename: string;
  sheetName: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  headerColor?: string;
}

const THIN_BORDER: Partial<Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

function cellText(value: CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text;
  }
  return String(value);
}

function columnWidthForText(text: string, isHeader: boolean): number {
  const lines = text.split(/\r?\n/);
  const longest = Math.max(...lines.map((l) => l.length), 0);
  const base = longest + (isHeader ? 3 : 2);
  return Math.min(Math.max(base, isHeader ? 12 : 10), 48);
}

export async function exportExcelTable({
  filename,
  sheetName,
  headers,
  rows,
  headerColor = 'FF1E3A5F',
}: ExportExcelTableOptions): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Witnext ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
    properties: { defaultRowHeight: 18 },
  });

  const headerRow = sheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  rows.forEach((row, rowIndex) => {
    const dataRow = sheet.addRow(headers.map((_, colIndex) => row[colIndex] ?? ''));
    const isEven = rowIndex % 2 === 1;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > headers.length) return;
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = THIN_BORDER;
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  headers.forEach((header, colIndex) => {
    let maxWidth = columnWidthForText(header, true);
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const text = cellText(row.getCell(colIndex + 1).value);
      maxWidth = Math.max(maxWidth, columnWidthForText(text, false));
    });
    sheet.getColumn(colIndex + 1).width = maxWidth;
  });

  if (headers.length > 0 && rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
