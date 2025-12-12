import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/components/Dashboard';
import { Inventory } from '@/components/Inventory';
import { Transactions } from '@/components/Transactions';
import { Reports } from '@/components/Reports';
import { AIAssistant } from '@/components/AIAssistant';
import { Settings } from '@/components/Settings';
import { SupplierComparison } from '@/components/SupplierComparison';
import { initDatabase } from '@/services/dbService';
import { Loader2 } from 'lucide-react';

const tabTitles: Record<string, string> = {
  dashboard: 'Tableau de Bord',
  inventory: 'Inventaire',
  comparison: 'Comparaison Prix Fournisseurs',
  transactions: 'Transactions',
  reports: 'Rapports & Documents',
  ai: 'Assistant IA',
  settings: 'Paramètres'
};

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Chargement de Grosafe Gestion</h2>
          <p className="text-sm text-muted-foreground mt-2">Initialisation de la base de données...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <Inventory />;
      case 'comparison':
        return <SupplierComparison />;
      case 'transactions':
        return <Transactions />;
      case 'reports':
        return <Reports />;
      case 'ai':
        return <AIAssistant />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
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
    </div>
  );
};

export default Index;
