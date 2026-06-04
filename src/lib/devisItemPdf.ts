/** True when description follows legacy catalog format: "SKU - Taille: …" / "SKU - Color: …". */
function isLegacyCatalogDescription(desc: string): boolean {
  return /\s-\sTaille\s*:/i.test(desc) || /\s-\s[A-Za-zÀ-ÿ][\wÀ-ÿ]*\s*:/.test(desc);
}

/** Article code for PDF tables — SKU only, or legacy prefix parsed from catalog description. */
export function getDevisItemArticleCode(item: {
  sku?: string;
  description?: string;
}): string {
  if (item.sku?.trim()) return item.sku.trim();
  const desc = item.description?.trim();
  if (!desc || !isLegacyCatalogDescription(desc)) return '—';
  const sep = desc.indexOf(' - ');
  if (sep > 0) return desc.slice(0, sep).trim();
  return '—';
}

/** Code article for UI tables (sku field, or legacy catalogue description). */
export function getDevisItemDisplayCode(item: {
  sku?: string;
  description?: string;
}): string {
  return getDevisItemArticleCode(item);
}

/** Line detail for PDF (sizes, pointures, notes) — never merged into désignation. */
export function getDevisItemDetailDescription(item: {
  sku?: string;
  description?: string;
}): string {
  const desc = item.description?.trim();
  if (!desc) return '—';
  const code = getDevisItemArticleCode(item);
  if (code !== '—' && desc.startsWith(`${code} - `)) {
    const rest = desc.slice(code.length + 3).trim();
    return rest || '—';
  }
  return desc;
}
