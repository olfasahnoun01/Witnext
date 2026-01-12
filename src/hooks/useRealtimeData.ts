import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

type TableName = 'products' | 'transactions';

interface UseRealtimeOptions {
  tables: TableName[];
  onDataChange: () => void;
  showToast?: boolean;
}

const TABLE_LABELS: Record<TableName, string> = {
  products: 'Produits',
  transactions: 'Transactions',
};

const EVENT_LABELS: Record<string, string> = {
  INSERT: 'ajouté',
  UPDATE: 'modifié',
  DELETE: 'supprimé',
};

export const useRealtimeData = ({ tables, onDataChange, showToast = true }: UseRealtimeOptions) => {
  const isFirstRender = useRef(true);

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      console.log('Realtime update:', payload.eventType, payload.table);
      
      // Show toast notification (skip on first render to avoid false notifications)
      if (showToast && !isFirstRender.current) {
        const tableLabel = TABLE_LABELS[payload.table as TableName] || payload.table;
        const eventLabel = EVENT_LABELS[payload.eventType] || payload.eventType;
        
        toast({
          title: '🔄 Mise à jour en temps réel',
          description: `${tableLabel}: élément ${eventLabel}`,
          duration: 3000,
        });
      }
      
      onDataChange();
    },
    [onDataChange, showToast]
  );

  useEffect(() => {
    // Mark first render as complete after a short delay
    const timer = setTimeout(() => {
      isFirstRender.current = false;
    }, 1000);

    const channels = tables.map((table) => {
      const channel = supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          handleChange
        )
        .subscribe();

      return channel;
    });

    return () => {
      clearTimeout(timer);
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables, handleChange]);
};
