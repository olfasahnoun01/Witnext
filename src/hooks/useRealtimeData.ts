import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'products' | 'transactions';

interface UseRealtimeOptions {
  tables: TableName[];
  onDataChange: () => void;
}

export const useRealtimeData = ({ tables, onDataChange }: UseRealtimeOptions) => {
  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      console.log('Realtime update:', payload.eventType, payload.table);
      onDataChange();
    },
    [onDataChange]
  );

  useEffect(() => {
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
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [tables, handleChange]);
};
