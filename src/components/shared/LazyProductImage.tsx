import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchProductGroupImageRef,
  fetchProductImageRef,
  resolveProductImageDisplayUrl,
  type ProductImageVariant,
} from '@/lib/productImageStorage';

type LazyProductImageProps = {
  groupId?: number;
  productId?: number;
  alt: string;
  className?: string;
  imgClassName?: string;
  variant?: ProductImageVariant;
  /** Optional inline ref — skips DB fetch when provided (e.g. edit preview). */
  storedRef?: string | null;
};

export function LazyProductImage({
  groupId,
  productId,
  alt,
  className,
  imgClassName,
  variant = 'thumb',
  storedRef,
}: LazyProductImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (storedRef !== undefined) {
      setVisible(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '80px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [storedRef]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setFailed(false);

    void (async () => {
      let ref = storedRef;
      if (ref === undefined) {
        if (groupId != null) {
          ref = await fetchProductGroupImageRef(groupId);
        } else if (productId != null) {
          ref = await fetchProductImageRef(productId);
        } else {
          ref = null;
        }
      }

      if (!ref) {
        if (!cancelled) setSrc(null);
        return;
      }

      const url = await resolveProductImageDisplayUrl(ref, variant);
      if (!cancelled) setSrc(url);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, groupId, productId, storedRef, variant]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex items-center justify-center overflow-hidden bg-muted',
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn('object-cover w-full h-full', imgClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="w-8 h-8 text-muted-foreground" />
      )}
    </div>
  );
}
