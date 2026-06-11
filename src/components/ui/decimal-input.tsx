import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  filterDecimalDraft,
  formatDecimalInputDisplay,
  parseDecimalInputLoose,
} from '@/lib/numberInput';

export interface DecimalInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'inputMode'> {
  value: number;
  onValueChange: (value: number) => void;
  /** When true, shows an empty field instead of "0" until the user types (e.g. remise %). */
  allowEmptyZero?: boolean;
}

/**
 * Decimal text input that preserves mid-typing states like "0." or "0,215"
 * instead of collapsing to a parsed number on every keystroke.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, allowEmptyZero = false, className, onFocus, onBlur, ...props }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    const display =
      draft ??
      formatDecimalInputDisplay(
        Number.isFinite(value) ? value : 0,
        allowEmptyZero
      );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        className={cn('tabular-nums', className)}
        onFocus={(e) => {
          setDraft(formatDecimalInputDisplay(Number.isFinite(value) ? value : 0, allowEmptyZero));
          onFocus?.(e);
        }}
        onChange={(e) => {
          const next = filterDecimalDraft(e.target.value);
          setDraft(next);
          onValueChange(parseDecimalInputLoose(next));
        }}
        onBlur={(e) => {
          setDraft(null);
          onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);

DecimalInput.displayName = 'DecimalInput';
