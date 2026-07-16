import { cn } from '@/lib/utils';
import { getFinanceCompanyLogo } from '../lib/companyLogos';

interface FinanceCompanyLogoProps {
  code: string;
  companyName: string;
  logoUrl?: string | null;
  className?: string;
  imageClassName?: string;
}

export function FinanceCompanyLogo({
  code,
  companyName,
  logoUrl,
  className,
  imageClassName,
}: FinanceCompanyLogoProps) {
  const src = logoUrl?.trim() || getFinanceCompanyLogo(code);

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
