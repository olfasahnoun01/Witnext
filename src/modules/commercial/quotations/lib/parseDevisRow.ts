import { parseAttachmentUrls } from '@/lib/commercialAttachments';
import type { Devis, DevisItem } from '@/types';

export function parseDevisRow(
  d: Record<string, unknown>,
  profilesMap: Record<string, string>,
  sourceDevisMap?: Record<number, string>,
  sourceBcMap?: Record<number, string>
): Devis {
  let parsedItems: DevisItem[] = [];
  if (d.items) {
    if (typeof d.items === 'string') {
      try {
        parsedItems = JSON.parse(d.items);
      } catch {
        parsedItems = [];
      }
    } else if (Array.isArray(d.items)) {
      parsedItems = d.items as DevisItem[];
    }
  }

  const sourceDevisId = d.source_devis_id as number | null | undefined;
  const sourceBcId = d.source_bc_id as number | null | undefined;
  const sourceDevisIds = Array.isArray(d.source_devis_ids)
    ? (d.source_devis_ids as number[]).filter((id) => typeof id === 'number')
    : null;
  const sourceBcIds = Array.isArray(d.source_bc_ids)
    ? (d.source_bc_ids as number[]).filter((id) => typeof id === 'number')
    : null;
  const createdBy = d.created_by as string | undefined;
  const updatedBy = d.updated_by as string | null | undefined;

  return {
    ...(d as unknown as Devis),
    type: d.type as Devis['type'],
    status: d.status as Devis['status'],
    items: parsedItems,
    total_amount: Number(d.total_amount) || 0,
    is_bc: (d.is_bc as boolean) ?? false,
    is_ba: (d.is_ba as boolean) ?? false,
    is_bl: (d.is_bl as boolean) ?? false,
    source_devis_id: sourceDevisId ?? null,
    source_bc_id: sourceBcId ?? null,
    source_bc_ids: sourceBcIds,
    source_bc_number: (() => {
      const multi = sourceBcIds
        ?.map((id) => sourceBcMap?.[id])
        .filter(Boolean)
        .join(', ');
      if (multi) return multi;
      return sourceBcId && sourceBcMap ? sourceBcMap[sourceBcId] || null : null;
    })(),
    creator_name: createdBy ? profilesMap[createdBy] || null : null,
    updated_by: updatedBy ?? null,
    modifier_name: updatedBy ? profilesMap[updatedBy] || null : null,
    source_devis_number: (() => {
      const multi = sourceDevisIds
        ?.map((id) => sourceDevisMap?.[id])
        .filter(Boolean)
        .join(', ');
      if (multi) return multi;
      return sourceDevisId && sourceDevisMap ? sourceDevisMap[sourceDevisId] || null : null;
    })(),
    source_devis_ids: sourceDevisIds,
    attachment_urls: parseAttachmentUrls(d.attachment_urls),
  };
}
