import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  resolveGalleryPhotoDisplayUrl,
  type GalleryPhotoVariant,
} from '@/lib/galleryPhotoStorage';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
  /** thumb = 400px transform (grid); full = original (quick view). */
  variant?: GalleryPhotoVariant;
};

export function GalleryPhotoImage({
  src,
  alt,
  className,
  variant = 'thumb',
  ...rest
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true);
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;

    let cancelled = false;
    setFailed(false);

    void resolveGalleryPhotoDisplayUrl(src, variant).then((url) => {
      if (!cancelled) setResolved(url);
    });

    return () => {
      cancelled = true;
    };
  }, [src, variant, nearViewport]);

  const imgFit =
    variant === 'full' ? 'object-contain max-w-full max-h-full' : 'object-cover w-full h-full';

  if (failed) {
    return (
      <div
        ref={rootRef}
        className={cn(
          className,
          'flex items-center justify-center bg-muted text-muted-foreground'
        )}
      >
        <ImageIcon className="w-10 h-10 opacity-40" />
      </div>
    );
  }

  if (!resolved) {
    return (
      <div
        ref={rootRef}
        className={cn(className, 'bg-muted animate-pulse')}
        aria-hidden
      />
    );
  }

  return (
    <div ref={rootRef} className={cn(className, 'overflow-hidden flex items-center justify-center')}>
      <img
        src={resolved}
        alt={alt}
        className={imgFit}
        onError={() => setFailed(true)}
        {...rest}
      />
    </div>
  );
}
