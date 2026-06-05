import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/formatBytes';

type UpdateInfo = {
  currentVersion: string;
  newVersion: string;
  totalBytes: number | null;
  grouped: boolean;
};

type UpdateProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export const AutoUpdateNotifier = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateInfo((info) => {
      setUpdateInfo(info);
    });

    window.electronAPI.onUpdateMessage((message: string) => {
      toast.info(message, {
        duration: 6000,
        position: 'bottom-right',
      });
    });

    window.electronAPI.onUpdateProgress((nextProgress) => {
      setProgress(nextProgress);
      if (!nextProgress) {
        setUpdateInfo(null);
      }
    });
  }, []);

  if (!updateInfo && !progress) return null;

  const info = updateInfo;
  const percentage = progress
    ? Math.min(100, Math.max(0, progress.percent))
    : 0;
  const totalBytes =
    progress && progress.total > 0
      ? progress.total
      : info?.totalBytes && info.totalBytes > 0
        ? info.totalBytes
        : 0;
  const transferredBytes = progress?.transferred ?? 0;
  const speedBytes = progress?.bytesPerSecond ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-2 flex items-start gap-2">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {info?.grouped ? 'Mise à jour groupée' : 'Téléchargement de la mise à jour'}
          </div>
          {info && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              v{info.currentVersion} → v{info.newVersion}
              {info.grouped ? ' (toutes les versions intermédiaires incluses)' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-0.5 text-xs text-muted-foreground tabular-nums">
        <div>
          {percentage.toFixed(1)}% — {formatBytes(transferredBytes)}
          {totalBytes > 0 ? ` / ${formatBytes(totalBytes)}` : ''}
        </div>
        {speedBytes > 0 && <div>Vitesse : {formatBytes(speedBytes)}/s</div>}
      </div>
    </div>
  );
};
