import { cn } from '@/lib/utils';
import witnextLogo from '@/assets/witnext-brand-logo-icon.png';

type WitnextLogoBannerProps = {
  className?: string;
  /** `auth` = login (large); `app` = sidebar (compact) — same mark everywhere */
  variant?: 'auth' | 'app';
};

/** Single Witnext logo mark — web, auth, sidebar, favicon, and Electron icon source. */
export const WitnextLogoBanner = ({ className, variant = 'app' }: WitnextLogoBannerProps) => {
  const size = variant === 'auth' ? 160 : 44;

  return (
    <img
      src={witnextLogo}
      alt="Witnext"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={cn(
        'h-auto object-contain bg-transparent',
        variant === 'auth' ? 'w-36 sm:w-44' : 'w-11',
        className,
      )}
    />
  );
};
