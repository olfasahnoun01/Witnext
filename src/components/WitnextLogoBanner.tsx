import { cn } from '@/lib/utils';
import logoIcon from '@/assets/witnext-brand-logo-icon.png';
import logoIcon2x from '@/assets/logo-icon-1024.png';
import logoFull from '@/assets/witnext-brand-logo-full.png';

type WitnextLogoBannerProps = {
  className?: string;
  /** `auth` = login screen with full logo; `app` = sidebar compact mark */
  variant?: 'auth' | 'app';
  /** Show Wit/next wordmark beside the icon (sidebar). */
  showWordmark?: boolean;
};

/** Witnext brand logo — full mark on auth, icon (+ optional wordmark) in app chrome. */
export const WitnextLogoBanner = ({
  className,
  variant = 'app',
  showWordmark = false,
}: WitnextLogoBannerProps) => {
  if (variant === 'auth') {
    return (
      <img
        src={logoFull}
        alt="Witnext"
        width={240}
        height={200}
        decoding="async"
        draggable={false}
        className={cn('h-auto w-52 sm:w-60 object-contain', className)}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div className="shrink-0 h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/50">
        <img
          src={logoIcon}
          srcSet={`${logoIcon} 1x, ${logoIcon2x} 2x`}
          alt="Witnext"
          width={40}
          height={40}
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>
      {showWordmark && (
        <span className="truncate text-base font-semibold tracking-tight">
          <span className="text-primary">Wit</span>
          <span className="text-accent">next</span>
        </span>
      )}
    </div>
  );
};
