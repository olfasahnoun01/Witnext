import { cn } from '@/lib/utils';
import logoIcon from '@/assets/logo-icon-512.png';
import logoIcon2x from '@/assets/logo-icon-1024.png';

type AlphaLogoBannerProps = {
  className?: string;
  /** `auth` = login screen; `app` = sidebar & in-app */
  variant?: 'auth' | 'app';
};

const variantStyles = {
  auth: {
    box: 'h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shadow-lg ring-1 ring-border/60',
    img: 64,
  },
  app: {
    box: 'h-10 w-10 rounded-xl shadow-md ring-1 ring-border/50',
    img: 40,
  },
} as const;

/**
 * Compact rounded app mark (square icon) for login and sidebar — not the tall installer banner.
 */
export const AlphaLogoBanner = ({ className, variant = 'app' }: AlphaLogoBannerProps) => {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden bg-card',
        styles.box,
        className,
      )}
    >
      <img
        src={logoIcon}
        srcSet={`${logoIcon} 1x, ${logoIcon2x} 2x`}
        alt="Alpha"
        width={styles.img}
        height={styles.img}
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  );
};
