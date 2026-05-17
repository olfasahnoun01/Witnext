import { useCallback, useEffect, useState } from 'react';
import type { InstallOptions, InstallProgress, InstallerDefaults, InstallerPhase } from '../types/installer';

const defaultOptions: InstallOptions = {
  installPath: '',
  desktopShortcut: true,
  startMenuShortcut: true,
  launchAfterInstall: true,
};

export function useInstaller() {
  const [phase, setPhase] = useState<InstallerPhase>('splash');
  const [defaults, setDefaults] = useState<InstallerDefaults | null>(null);
  const [options, setOptions] = useState<InstallOptions>(defaultOptions);
  const [progress, setProgress] = useState<InstallProgress>({
    stage: 'preparing',
    percent: 0,
    statusLabel: 'Preparing files',
  });
  const [error, setError] = useState<string | null>(null);
  const [resultPaths, setResultPaths] = useState<{ installDir: string; exePath: string } | null>(null);

  useEffect(() => {
    const api = window.alphaInstaller;
    if (!api) return;

    void api.getDefaults().then((d) => {
      setDefaults(d);
      setOptions((prev) => ({ ...prev, installPath: d.defaultInstallPath }));
    });

    return api.onProgress((p) => setProgress(p));
  }, []);

  useEffect(() => {
    if (phase !== 'splash') return;
    const t = window.setTimeout(() => setPhase('welcome'), 2200);
    return () => window.clearTimeout(t);
  }, [phase]);

  const browsePath = useCallback(async () => {
    const chosen = await window.alphaInstaller?.browsePath();
    if (chosen) setOptions((o) => ({ ...o, installPath: chosen }));
  }, []);

  const updateOption = useCallback(<K extends keyof InstallOptions>(key: K, value: InstallOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  }, []);

  const startInstall = useCallback(async () => {
    setError(null);
    setPhase('installing');
    setProgress({ stage: 'preparing', percent: 0, statusLabel: 'Preparing files' });

    const res = await window.alphaInstaller.startInstall(options);
    if (res.cancelled) {
      setPhase('welcome');
      return;
    }
    if (!res.ok) {
      setError(res.error ?? 'Installation failed');
      setPhase('error');
      return;
    }

    setResultPaths({ installDir: res.installDir!, exePath: res.exePath! });
    setPhase('complete');

    if (options.launchAfterInstall && res.exePath) {
      await window.alphaInstaller.launchApp(res.exePath);
    }
  }, [options]);

  const cancelInstall = useCallback(async () => {
    await window.alphaInstaller.cancelInstall();
    if (phase === 'installing') setPhase('welcome');
    else await window.alphaInstaller.quit();
  }, [phase]);

  const closeInstaller = useCallback(() => {
    void window.alphaInstaller.quit();
  }, []);

  return {
    phase,
    setPhase,
    defaults,
    options,
    progress,
    error,
    resultPaths,
    browsePath,
    updateOption,
    startInstall,
    cancelInstall,
    closeInstaller,
  };
}
