import { cn } from '@/lib/utils';
import { useInView } from '@/marketing/hooks/useInView';
import type { ReactNode } from 'react';

type Animation = 'fade-up' | 'fade-in' | 'scale-in' | 'slide-left' | 'slide-right';

const ANIMATION_CLASS: Record<Animation, string> = {
  'fade-up': 'marketing-animate-fade-up',
  'fade-in': 'marketing-animate-fade-in',
  'scale-in': 'marketing-animate-scale-in',
  'slide-left': 'marketing-animate-slide-left',
  'slide-right': 'marketing-animate-slide-right',
};

type Props = {
  children: ReactNode;
  className?: string;
  animation?: Animation;
  delay?: number;
};

export function AnimateIn({
  children,
  className,
  animation = 'fade-up',
  delay = 0,
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn('marketing-reveal', inView && ANIMATION_CLASS[animation], className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
