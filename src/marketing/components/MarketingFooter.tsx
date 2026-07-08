import { Link } from 'react-router-dom';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <WitnextLogoBanner className="h-10 w-auto mb-4" />
            <p className="text-sm text-muted-foreground max-w-md">
              Witnext est l&apos;ERP tout-en-un pour la gestion commerciale, le stock, la finance
              et les opérations terrain — conçu pour les entreprises tunisiennes.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Produit</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/pricing" className="hover:text-foreground">Tarifs</Link></li>
              <li><Link to="/trial" className="hover:text-foreground">Essai gratuit</Link></li>
              <li><Link to="/buy" className="hover:text-foreground">Acheter une licence</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Accès</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground">Connexion</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {year} Witnext. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
