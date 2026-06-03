import { formatDerniereModification, formatModifieePar, type DocumentAuditFields } from '@/lib/documentListAudit';

export const documentAuditTableHeadCells = (
  <>
    <th className="text-left whitespace-nowrap">Dernière modification</th>
    <th className="text-left whitespace-nowrap">Modifiée par</th>
  </>
);

export function DocumentAuditTableCells({ doc }: { doc: DocumentAuditFields }) {
  return (
    <>
      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDerniereModification(doc)}
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatModifieePar(doc)}
      </td>
    </>
  );
}
