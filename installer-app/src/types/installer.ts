export type InstallerPhase = 'splash' | 'welcome' | 'installing' | 'complete' | 'error';

export type InstallStage =
  | 'preparing'
  | 'extracting'
  | 'components'
  | 'finalizing';

export interface InstallProgress {
  stage: InstallStage;
  percent: number;
  statusLabel: string;
  detail?: string;
  done?: boolean;
}

export interface InstallOptions {
  installPath: string;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
  launchAfterInstall: boolean;
}

export interface InstallerDefaults {
  productName: string;
  defaultInstallPath: string;
  payloadDir: string;
  appVersion: string;
  dev: boolean;
}

export interface AlphaInstallerApi {
  getDefaults: () => Promise<InstallerDefaults>;
  browsePath: () => Promise<string | null>;
  startInstall: (options: InstallOptions) => Promise<{
    ok: boolean;
    installDir?: string;
    exePath?: string;
    error?: string;
    cancelled?: boolean;
  }>;
  cancelInstall: () => Promise<{ ok: boolean }>;
  launchApp: (exePath: string) => Promise<{ ok: boolean }>;
  quit: () => Promise<void>;
  onProgress: (callback: (p: InstallProgress) => void) => () => void;
}

declare global {
  interface Window {
    alphaInstaller: AlphaInstallerApi;
  }
}

export {};
