import { cn } from '@/lib/utils';
import { formatMontantDt, type FinanceAmountKind } from '../../lib/money';

export function financeAmountClass(kind?: FinanceAmountKind, className?: string): string {
  return cn(
    'tabular-nums',
    kind === 'income' && 'font-semibold text-emerald-600 dark:text-emerald-400',
    kind === 'charge' && 'font-semibold text-red-600 dark:text-red-400',
    className
  );
}

interface FinanceAmountProps {
  amount: number;
  kind?: FinanceAmountKind;
  className?: string;
  suffix?: string;
}

/** Montant formaté avec couleur recette (vert) ou charge (rouge). */
export function FinanceAmount({ amount, kind, className, suffix }: FinanceAmountProps) {
  return (
    <span className={financeAmountClass(kind, className)}>
      {formatMontantDt(amount, suffix ? { suffix } : undefined)}
    </span>
  );
}
