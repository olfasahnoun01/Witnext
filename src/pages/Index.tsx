import { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { initDatabase } from '@/services/dbService';
import { Loader2 } from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TeamChat } from '@/components/TeamChat';

// Lazy load heavy components
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('@/components/Inventory').then(m => ({ default: m.Inventory })));
const Transactions = lazy(() => import('@/components/Transactions').then(m => ({ default: m.Transactions })));
const Reports = lazy(() => import('@/components/Reports').then(m => ({ default: m.Reports })));
const AIAssistant = lazy(() => import('@/components/AIAssistant').then(m => ({ default: m.AIAssistant })));
const Settings = lazy(() => import('@/components/Settings').then(m => ({ default: m.Settings })));
const SupplierComparison = lazy(() => import('@/components/SupplierComparison').then(m => ({ default: m.SupplierComparison })));
const Fournisseurs = lazy(() => import('@/components/Fournisseurs').then(m => ({ default: m.Fournisseurs })));

const tabTitles: Record<string, string> = {
  dashboard: 'Tableau de Bord',
  inventory: 'Inventaire',
  fournisseurs: 'Gestion des Fournisseurs',
  comparison: 'Comparaison Prix Fournisseurs',
  transactions: 'Transactions',
  reports: 'Rapports & Documents',
  ai: 'Assistant IA',
  settings: 'Paramètres'
};

const ComponentLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const renderContent = () => {
    return (
      <Suspense fallback={<ComponentLoader />}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'fournisseurs' && <Fournisseurs />}
        {activeTab === 'comparison' && <SupplierComparison />}
        {activeTab === 'transactions' && <Transactions />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'ai' && <AIAssistant />}
        {activeTab === 'settings' && <Settings />}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="lg:ml-72">
        <Header title={tabTitles[activeTab]} />
        
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
      
      {/* Team Chat - floating button for admins/moderators */}
      <TeamChat />
    </div>
  );
};

export default Index;
