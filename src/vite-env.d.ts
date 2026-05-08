/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  electronAPI?: {
    onUpdateMessage: (callback: (message: string) => void) => void;
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
