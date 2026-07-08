import { cn } from '@/lib/utils';

type Variant = 'hero' | 'inline';

type Props = {
  className?: string;
  variant?: Variant;
};

/** Logo-style wordmark: green W + dark "itnext". Hero variant includes letter animation. */
export function WitnextWordmark({ className, variant = 'inline' }: Props) {
  const isHero = variant === 'hero';

  if (isHero) {
    return (
      <span
        className={cn('marketing-brand-title inline-flex items-baseline', className)}
        aria-label="Witnext"
      >
        <span className="marketing-brand-w-letter inline-block">W</span>
        {'itnext'.split('').map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            className="marketing-brand-letter marketing-brand-rest-letter inline-block text-slate-900 dark:text-white"
            style={{ animationDelay: `${(i + 1) * 90}ms` }}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-baseline font-bold tracking-tight', className)} aria-label="Witnext">
      <span className="marketing-brand-text">W</span>
      <span className="text-slate-900">itnext</span>
    </span>
  );
}
