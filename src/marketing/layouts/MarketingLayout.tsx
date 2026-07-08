import { Outlet } from 'react-router-dom';
import { MarketingNavbar } from '@/marketing/components/MarketingNavbar';
import { MarketingFooter } from '@/marketing/components/MarketingFooter';
import '@/marketing/styles/marketing.css';

export function MarketingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <MarketingNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
