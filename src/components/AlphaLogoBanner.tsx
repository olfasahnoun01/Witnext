import { cn } from '@/lib/utils';
import logoApp from '@/assets/logo-app.png';
import logoApp2x from '@/assets/logo-app-2x.png';

const BANNER_ASPECT = '164 / 314';

/** Auth login */
const AUTH_WIDTH = 'w-24 sm:w-28';

/** Sidebar / in-app header */
const APP_WIDTH = 'w-11';

type AlphaLogoBannerProps = {
  className?: string;
  /** `auth` = login screen; `app` = sidebar & in-app */
  variant?: 'auth' | 'app';
};

/**
 * Vertical Alpha banner for UI (not the installer or square icon).
 */
export const AlphaLogoBanner = ({ className, variant = 'app' }: AlphaLogoBannerProps) => {
  const widthClass = variant === 'auth' ? AUTH_WIDTH : APP_WIDTH;
  const intrinsicW = variant === 'auth' ? 112 : 44;
  const intrinsicH = Math.round(intrinsicW * (314 / 164));

  return (
    <img
      src={logoApp}
      srcSet={`${logoApp} 1x, ${logoApp2x} 2x`}
      alt="Alpha"
      width={intrinsicW}
      height={intrinsicH}
      decoding="async"
      draggable={false}
      className={cn('h-auto max-w-full shrink-0 object-contain', widthClass, className)}
      style={{ aspectRatio: BANNER_ASPECT }}
    />
  );
};
