/** Article code for PDF tables (explicit sku or parsed from legacy description). */
export function getDevisItemArticleCode(item: {
  sku?: string;
  description?: string;
}): string {
  if (item.sku?.trim()) return item.sku.trim();
  const desc = item.description?.trim();
  if (!desc) return '—';
  const sep = desc.indexOf(' - ');
  if (sep > 0) return desc.slice(0, sep).trim();
  return desc;
}

/** Line detail for PDF (size/color/notes), without repeating the article code. */
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
  if (code !== '—' && desc === code) return '—';
  return desc;
}
