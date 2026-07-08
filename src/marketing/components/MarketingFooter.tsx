import { Link } from 'react-router-dom';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { AnimateIn } from '@/marketing/components/AnimateIn';

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <AnimateIn animation="fade-up" className="sm:col-span-2">
            <WitnextLogoBanner className="h-10 w-auto mb-4" />
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Witnext est l&apos;ERP tout-en-un pour la gestion commerciale, le stock, la finance
              et les opérations terrain — conçu pour les entreprises tunisiennes.
            </p>
          </AnimateIn>
          <AnimateIn animation="fade-up" delay={80}>
            <h4 className="font-semibold text-sm mb-4">Produit</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/pricing" className="hover:text-primary transition-colors">Tarifs</Link></li>
              <li><Link to="/trial" className="hover:text-primary transition-colors">Essai gratuit</Link></li>
              <li><Link to="/buy" className="hover:text-primary transition-colors">Acheter une licence</Link></li>
            </ul>
          </AnimateIn>
          <AnimateIn animation="fade-up" delay={160}>
            <h4 className="font-semibold text-sm mb-4">Accès</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/auth" className="hover:text-primary transition-colors">Connexion</Link></li>
              <li><Link to="/" className="hover:text-primary transition-colors">Accueil</Link></li>
            </ul>
          </AnimateIn>
        </div>
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {year} Witnext. Tous droits réservés.</span>
          <span className="text-center sm:text-right">ERP web & desktop · Tunisie</span>
        </div>
      </div>
    </footer>
  );
}
