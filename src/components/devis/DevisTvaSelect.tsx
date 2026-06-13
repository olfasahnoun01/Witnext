import { DEVIS_TVA_OPTIONS } from '@/lib/devisPricing';
import { cn } from '@/lib/utils';
import { devisZohoCellInputClass } from './DevisFormUi';

export function DevisTvaSelect({
  value,
  onChange,
  className,
}: {
  value: number | null | undefined;
  onChange: (rate: number) => void;
  className?: string;
}) {
  return (
    <select
      value={String(value ?? 0)}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(devisZohoCellInputClass, 'text-center text-[11px]', className)}
      aria-label="Taux de TVA"
    >
      {DEVIS_TVA_OPTIONS.map((rate) => (
        <option key={rate} value={rate}>
          {rate === 0 ? '0%' : `${rate}%`}
        </option>
      ))}
    </select>
  );
}
