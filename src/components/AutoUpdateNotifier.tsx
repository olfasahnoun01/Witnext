import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type UpdateProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export const AutoUpdateNotifier = () => {
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    // Check if we are running in Electron
    if (window.electronAPI) {
      window.electronAPI.onUpdateMessage((message: string) => {
        toast.info(message, {
          duration: 5000,
          position: 'bottom-right',
        });
      });

      window.electronAPI.onUpdateProgress((nextProgress) => {
        setProgress(nextProgress);
      });
    }
  }, []);

  if (!progress) return null;

  const percentage = Math.min(100, Math.max(0, progress.percent));

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-2 text-sm font-medium">Telechargement de la mise a jour</div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {percentage.toFixed(1)}% ({Math.round(progress.transferred / 1024 / 1024)} MB /{' '}
        {Math.max(1, Math.round(progress.total / 1024 / 1024))} MB)
      </div>
    </div>
  );
};
