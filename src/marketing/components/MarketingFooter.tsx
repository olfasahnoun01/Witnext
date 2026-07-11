import { Link } from 'react-router-dom';
import { Mail, Phone, User } from 'lucide-react';
import { WitnextLogoBanner } from '@/components/WitnextLogoBanner';
import { AnimateIn } from '@/marketing/components/AnimateIn';
import { WitnextWordmark } from '@/marketing/components/WitnextWordmark';

const DEVELOPER = {
  name: 'Adam Abdeljalil',
  email: 'adamabdeljalil@hotmail.com',
  phone: '+216 25 240 323',
};

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="marketing-chrome border-t marketing-chrome-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <AnimateIn animation="fade-up" className="sm:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <WitnextLogoBanner className="h-10 w-auto" />
              <WitnextWordmark className="text-xl" />
            </div>
            <p className="text-sm marketing-chrome-muted max-w-md leading-relaxed">
              Witnext est l&apos;ERP tout-en-un pour la gestion commerciale, le stock, la finance
              et les opérations terrain — conçu pour les entreprises tunisiennes.
            </p>
          </AnimateIn>
          <AnimateIn animation="fade-up" delay={80}>
            <h4 className="font-semibold text-sm mb-4 text-slate-900 dark:text-slate-100">Produit</h4>
            <ul className="space-y-2.5 text-sm marketing-chrome-muted">
              <li><Link to="/pricing" className="marketing-link">Tarifs</Link></li>
              <li><Link to="/trial" className="marketing-link">Essai gratuit</Link></li>
              <li><Link to="/buy" className="marketing-link">Acheter une licence</Link></li>
            </ul>
          </AnimateIn>
          <AnimateIn animation="fade-up" delay={160}>
            <h4 className="font-semibold text-sm mb-4 text-slate-900 dark:text-slate-100">Accès</h4>
            <ul className="space-y-2.5 text-sm marketing-chrome-muted">
              <li><Link to="/auth" className="marketing-link">Connexion</Link></li>
              <li><Link to="/" className="marketing-link">Accueil</Link></li>
            </ul>
          </AnimateIn>
        </div>

        <AnimateIn animation="fade-up" delay={200}>
          <div className="mt-10 pt-6 border-t marketing-chrome-border text-center">
            <p className="text-xs font-semibold uppercase tracking-wider marketing-brand-text mb-3">
              Développement
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-2">
                <User className="h-4 w-4 marketing-brand-text shrink-0" />
                {DEVELOPER.name}
              </span>
              <a href={`mailto:${DEVELOPER.email}`} className="inline-flex items-center gap-2 marketing-link">
                <Mail className="h-4 w-4 marketing-brand-text shrink-0" />
                {DEVELOPER.email}
              </a>
              <a
                href={`tel:${DEVELOPER.phone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-2 marketing-link"
              >
                <Phone className="h-4 w-4 marketing-brand-text shrink-0" />
                {DEVELOPER.phone}
              </a>
            </div>
          </div>
        </AnimateIn>

        <div className="mt-8 pt-6 border-t marketing-chrome-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs marketing-chrome-muted">
          <span>© {year} <span className="marketing-brand-text font-semibold">W</span>itnext. Tous droits réservés.</span>
          <span className="text-center sm:text-right">ERP web & desktop · Tunisie</span>
        </div>
      </div>
    </footer>
  );
}
