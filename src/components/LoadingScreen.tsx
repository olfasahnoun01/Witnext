import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(168_100%_39%/0.06),transparent_60%)]" />
      <div className="text-center relative z-10">
        {/* Animated Logo Container */}
        <div className="relative mb-8">
          {/* Pulsing ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-accent/20 animate-ping" />
          </div>
          
          {/* Rotating outer ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-36 h-36 rounded-full border-t-4 border-r-4 border-accent animate-spin" 
                 style={{ animationDuration: '2s' }} />
          </div>
          
          {/* Logo with scale animation */}
          <div className="relative z-10 animate-pulse">
            <WitnextLogoBanner variant="auth" className="mx-auto drop-shadow-md" />
          </div>
        </div>
        
        {/* Loading text with fade animation */}
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
            Witnext
          </h2>
          <p className="text-muted-foreground mb-6">
            Système de gestion d&apos;entreprise
          </p>
        </div>
        
        {/* Loading progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-loading-bar"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-4 animate-pulse">
            Initialisation en cours...
          </p>
        </div>
      </div>
    </div>
  );
};
