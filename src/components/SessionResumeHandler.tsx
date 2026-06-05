import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onSessionResume } from '@/lib/sessionResume';

/** Invalidates React Query caches when the session is refreshed after idle. */
export function SessionResumeHandler() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onSessionResume(() => {
      void queryClient.invalidateQueries();
    });
  }, [queryClient]);

  return null;
}
