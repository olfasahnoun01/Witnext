/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  electronAPI?: {
    onUpdateMessage: (callback: (message: string) => void) => void;
  };
}
