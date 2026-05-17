import { AlphaLogoBanner } from '@/components/AlphaLogoBanner';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        {/* Animated Logo Container */}
        <div className="relative mb-8">
          {/* Pulsing ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-primary/20 animate-ping" />
          </div>
          
          {/* Rotating outer ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-36 h-36 rounded-full border-t-4 border-r-4 border-primary animate-spin" 
                 style={{ animationDuration: '2s' }} />
          </div>
          
          {/* Logo with scale animation */}
          <div className="relative z-10 animate-pulse">
            <AlphaLogoBanner variant="auth" className="mx-auto drop-shadow-md" />
          </div>
        </div>
        
        {/* Loading text with fade animation */}
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Alpha
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
