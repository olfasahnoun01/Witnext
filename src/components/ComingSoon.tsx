import { Sparkles } from 'lucide-react';

interface ComingSoonProps {
  sectionLabel: string;
}

export const ComingSoon = ({ sectionLabel }: ComingSoonProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="p-6 rounded-2xl bg-primary/10 mb-6">
        <Sparkles className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{sectionLabel}</h2>
      <p className="text-muted-foreground max-w-md">
        Cette section est en cours de préparation. Les fonctionnalités seront disponibles très bientôt.
      </p>
      <div className="mt-6 px-4 py-2 rounded-full bg-muted text-sm font-medium text-muted-foreground">
        Bientôt disponible
      </div>
    </div>
  );
};
