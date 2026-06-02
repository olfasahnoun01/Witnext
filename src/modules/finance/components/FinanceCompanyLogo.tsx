import { cn } from '@/lib/utils';
import { getFinanceCompanyLogo } from '../lib/companyLogos';
import type { CompanyCode } from '../types';

interface FinanceCompanyLogoProps {
  code: CompanyCode | string;
  companyName: string;
  className?: string;
  imageClassName?: string;
}

export function FinanceCompanyLogo({
  code,
  companyName,
  className,
  imageClassName,
}: FinanceCompanyLogoProps) {
  const src = getFinanceCompanyLogo(code);

  if (!src) return null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border bg-white p-2 shadow-sm',
        className,
      )}
    >
      <img
        src={src}
        alt={`Logo ${companyName}`}
        className={cn('h-10 w-auto max-w-[140px] object-contain', imageClassName)}
      />
    </div>
  );
}
