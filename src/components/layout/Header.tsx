import { Bell, Search, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getLowStockProducts } from '@/services/dbService';
import { Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const loadLowStock = async () => {
      const products = await getLowStockProducts();
      setLowStockProducts(products);
    };
    loadLowStock();
    const interval = setInterval(loadLowStock, 5000);
    return () => clearInterval(interval);
  }, []);

  const alertCount = lowStockProducts.length;

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('fr-TN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-48"
            />
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                  {alertCount}
                </span>
              )}
            </button>

            {showNotifications && alertCount > 0 && (
              <div className="absolute right-0 top-12 w-80 bg-card rounded-xl shadow-xl border border-border p-4 animate-scale-in">
                <h3 className="font-semibold text-foreground mb-3">Alertes Stock</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                      <span className={`status-badge ${product.quantity === 0 ? 'status-badge-danger' : 'status-badge-warning'}`}>
                        {product.quantity === 0 ? 'Rupture' : `${product.quantity} unités`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User info & Sign out */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Déconnexion</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
