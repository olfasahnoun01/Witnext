/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TARGET?: "web" | "electron";
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_DEBUG_INGEST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}

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
