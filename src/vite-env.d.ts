/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    onUpdateMessage: (callback: (message: string) => void) => void;
    onUpdateInfo: (
      callback: (info: {
        currentVersion: string;
        newVersion: string;
        totalBytes: number | null;
        grouped: boolean;
      }) => void
    ) => void;
    onUpdateProgress: (
      callback: (
        progress: {
          percent: number;
          transferred: number;
          total: number;
          bytesPerSecond: number;
        } | null
      ) => void
    ) => void;
  };
}
