export interface ParsedDevisLine {
  designation: string;
  quantity: number;
  unitPrice: number;
  tvaRate: number;
}

export interface ParsedDevisHeader {
  supplierName?: string;
  taxId?: string;
  documentDate?: string;
  documentNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ParsedDevisDocument {
  lines: ParsedDevisLine[];
  header: ParsedDevisHeader;
  fullText: string;
}
