import { useCallback, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type AnchorPos = { top: number; left: number; width: number };

export function DevisAnchoredDropdown({
  anchorRef,
  open,
  children,
  className,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState<AnchorPos | null>(null);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      role="listbox"
      className={cn(
        'fixed z-[250] overflow-y-auto rounded-md border-2 border-border bg-popover shadow-lg pointer-events-auto',
        className
      )}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {children}
    </div>,
    document.body
  );
}
