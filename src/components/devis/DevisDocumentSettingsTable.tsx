import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DevisFormTable, devisFormTableTdClass, devisFormTableThClass } from './DevisFormUi';

export function DevisDocumentSettingsTable({
  natureCell,
  fluxCell,
  pricingCell,
}: {
  natureCell: ReactNode;
  fluxCell: ReactNode;
  pricingCell: ReactNode;
}) {
  return (
    <DevisFormTable>
      <colgroup>
        <col style={{ width: '33.33%' }} />
        <col style={{ width: '33.33%' }} />
        <col style={{ width: '33.34%' }} />
      </colgroup>
      <thead>
        <tr>
          <th className={cn(devisFormTableThClass, 'text-left')}>Nature</th>
          <th className={cn(devisFormTableThClass, 'text-left')}>Flux</th>
          <th className={cn(devisFormTableThClass, 'text-left')}>Tarification</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={devisFormTableTdClass}>{natureCell}</td>
          <td className={devisFormTableTdClass}>{fluxCell}</td>
          <td className={devisFormTableTdClass}>{pricingCell}</td>
        </tr>
      </tbody>
    </DevisFormTable>
  );
}
