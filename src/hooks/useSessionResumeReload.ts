import { useEffect, useRef } from 'react';
import { onSessionResume } from '@/lib/sessionResume';

/** Re-run `reload` when the app wakes up with a refreshed Supabase session. */
export function useSessionResumeReload(reload: () => void | Promise<void>) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    return onSessionResume(() => {
      void reloadRef.current();
    });
  }, []);
}
