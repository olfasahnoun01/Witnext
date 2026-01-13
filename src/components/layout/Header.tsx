import { Bell, Search, LogOut, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getLowStockProducts } from '@/services/dbService';
import { Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { OnlineUsersIndicator } from '@/components/OnlineUsersIndicator';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, signOut, isAdmin, isModerator } = useAuth();
  const { onlineUsers } = usePresence();

  const loadLowStock = useCallback(async () => {
    const products = await getLowStockProducts();
    setLowStockProducts(products);
  }, []);

  // Initial load
  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

  // Subscribe to realtime updates on products table
  useRealtimeData({
    tables: ['products'],
    onDataChange: loadLowStock,
  });

  // Filter out dismissed notifications
  const visibleNotifications = lowStockProducts.filter(p => !dismissedIds.has(p.id));
  const alertCount = visibleNotifications.length;

  const clearAllNotifications = () => {
    const allIds = new Set(lowStockProducts.map(p => p.id));
    setDismissedIds(allIds);
    setShowNotifications(false);
  };

  const dismissNotification = (productId: number) => {
    setDismissedIds(prev => new Set([...prev, productId]));
  };

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
          {/* Online Users (Admin and Moderator) */}
          {(isAdmin || isModerator) && (
            <OnlineUsersIndicator 
              onlineUsers={onlineUsers} 
              currentUserId={user?.id}
            />
          )}

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

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-card rounded-xl shadow-xl border border-border p-4 animate-scale-in z-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Alertes Stock</h3>
                  {alertCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllNotifications}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Effacer tout
                    </Button>
                  )}
                </div>
                {alertCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune alerte
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {visibleNotifications.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted group"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`status-badge ${product.quantity === 0 ? 'status-badge-danger' : 'status-badge-warning'}`}>
                            {product.quantity === 0 ? 'Rupture' : `${product.quantity} unités`}
                          </span>
                          <button
                            onClick={() => dismissNotification(product.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded transition-opacity"
                            title="Masquer"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

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
