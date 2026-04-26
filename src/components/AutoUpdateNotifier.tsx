import { useEffect } from 'react';
import { toast } from 'sonner';

export const AutoUpdateNotifier = () => {
  useEffect(() => {
    // Check if we are running in Electron
    if (window.electronAPI) {
      window.electronAPI.onUpdateMessage((message: string) => {
        toast.info(message, {
          duration: 5000,
          position: 'bottom-right',
        });
      });
    }
  }, []);

  return null;
};
