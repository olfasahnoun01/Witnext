import { useEffect, useRef, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import { onSessionResume } from '@/lib/sessionResume';

type TableName = 'products' | 'transactions' | 'product_groups' | 'fournisseurs' | 'documents';

interface UseRealtimeOptions {
  tables: TableName[];
  onDataChange: () => void;
  showToast?: boolean;
}

const TABLE_LABELS: Record<TableName, string> = {
  products: 'Variantes',
  transactions: 'Transactions',
  product_groups: 'Produits',
  fournisseurs: 'Fournisseurs',
  documents: 'Documents',
};

const EVENT_LABELS: Record<string, string> = {
  INSERT: 'ajouté',
  UPDATE: 'modifié',
  DELETE: 'supprimé',
};

const REALTIME_REFETCH_MS = 400;

export const useRealtimeData = ({ tables, onDataChange, showToast = true }: UseRealtimeOptions) => {
  const [resumeGeneration, setResumeGeneration] = useState(0);
  const isFirstRender = useRef(true);
  const onDataChangeRef = useRef(onDataChange);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Keep the callback ref updated
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    return onSessionResume(() => {
      setResumeGeneration((n) => n + 1);
      onDataChangeRef.current();
    });
  }, []);

  // Memoize tables array to prevent unnecessary re-subscriptions
  const tablesKey = useMemo(() => tables.join(','), [tables]);

  useEffect(() => {
    const tableList = tablesKey.split(',') as TableName[];
    
    const handleChange = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
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

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        onDataChangeRef.current();
      }, REALTIME_REFETCH_MS);
    };

    // Mark first render as complete after a short delay
    const timer = setTimeout(() => {
      isFirstRender.current = false;
    }, 1000);

    const channels = tableList.map((table) => {
      // Use a stable channel name to avoid multiple connections for the same table
      const channel = supabase
        .channel(`table-db-changes-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          handleChange
        )
        .subscribe((status, err) => {
          if (err) {
            console.error(`Realtime subscription error for ${table}:`, err);
          }
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to ${table} changes`);
          }
        });

      return channel;
    });

    return () => {
      clearTimeout(timer);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tablesKey, showToast, resumeGeneration]);
};
