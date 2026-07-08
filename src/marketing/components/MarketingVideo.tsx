import { useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductShowcase } from '@/marketing/components/ProductShowcase';
import { Button } from '@/components/ui/button';

const videoUrl = import.meta.env.VITE_MARKETING_VIDEO_URL?.trim() ?? '';

function parseVideoSource(url: string): { type: 'youtube' | 'vimeo' | 'mp4'; src: string } | null {
  if (!url) return null;

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      type: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
    };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    };
  }

  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.startsWith('/')) {
    return { type: 'mp4', src: url };
  }

  return null;
}

type Props = {
  className?: string;
  variant?: 'hero' | 'section';
};

export function MarketingVideo({ className, variant = 'hero' }: Props) {
  const [playing, setPlaying] = useState(false);
  const source = useMemo(() => parseVideoSource(videoUrl), []);
  const hasExternalVideo = source !== null;

  if (playing && source) {
    return (
      <div
        className={cn(
          'relative aspect-video w-full overflow-hidden rounded-2xl border border-border marketing-video-glow bg-black',
          className
        )}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/90 shadow-md"
          onClick={() => setPlaying(false)}
          aria-label="Fermer la vidéo"
        >
          <X className="h-4 w-4" />
        </Button>
        {source.type === 'mp4' ? (
          <video
            className="h-full w-full object-cover"
            src={source.src}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={source.src}
            title="Démonstration Witnext"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative group', className)}>
      <ProductShowcase compact={variant === 'hero'} />

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none sm:pointer-events-auto">
        <Button
          type="button"
          size="lg"
          className="pointer-events-auto rounded-full h-14 w-14 sm:h-16 sm:w-16 p-0 shadow-xl shadow-primary/30 marketing-float"
          onClick={() => {
            if (hasExternalVideo) setPlaying(true);
          }}
          aria-label={hasExternalVideo ? 'Lire la démonstration vidéo' : 'Aperçu interactif Witnext'}
        >
          <Play className="h-6 w-6 sm:h-7 sm:w-7 ml-0.5 fill-current" />
        </Button>
        <p className="mt-3 text-xs sm:text-sm font-medium text-foreground/90 pointer-events-none text-center px-4">
          {hasExternalVideo
            ? 'Voir la démonstration'
            : 'Aperçu du tableau de bord Witnext'}
        </p>
      </div>

      {/* Always-visible play on mobile (no hover) */}
      <div className="absolute bottom-3 left-3 right-3 sm:hidden">
        <Button
          type="button"
          size="sm"
          className="w-full shadow-lg"
          onClick={() => {
            if (hasExternalVideo) setPlaying(true);
          }}
        >
          <Play className="h-4 w-4 mr-2 fill-current" />
          {hasExternalVideo ? 'Voir la vidéo' : 'Aperçu interactif'}
        </Button>
      </div>
    </div>
  );
}
