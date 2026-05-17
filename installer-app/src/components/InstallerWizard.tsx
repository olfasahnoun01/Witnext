import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, FolderOpen, Monitor, Rocket, X } from 'lucide-react';
import type { InstallOptions, InstallerDefaults } from '../types/installer';
import { ProgressBar } from './ProgressBar';
import logoIcon from '../../../src/assets/logo-icon-512.png';

type InstallerWizardProps = {
  defaults: InstallerDefaults | null;
  options: InstallOptions;
  onBrowse: () => void;
  onOptionChange: <K extends keyof InstallOptions>(key: K, value: InstallOptions[K]) => void;
  onInstall: () => void;
  onCancel: () => void;
};

export function InstallerWizard({
  defaults,
  options,
  onBrowse,
  onOptionChange,
  onInstall,
  onCancel,
}: InstallerWizardProps) {
  return (
    <motion.div
      className="flex h-full min-h-[560px] installer-gradient"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45 }}
    >
      <aside className="relative hidden w-[38%] flex-col justify-between border-r border-white/10 p-10 lg:flex">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-panel mb-8 inline-flex rounded-2xl p-3">
            <img src={logoIcon} alt="" className="h-14 w-14" draggable={false} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Install Alpha</h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            Enterprise resource planning for inventory, sales, purchasing, and documents — tailored for your team.
          </p>
        </motion.div>
        <p className="text-xs text-slate-600">
          v{defaults?.appVersion ?? '—'} · {defaults?.productName ?? 'Alpha'}
        </p>
      </aside>

      <main className="flex flex-1 flex-col p-6 sm:p-10">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <motion.div
            className="glass-panel mx-auto w-full max-w-lg rounded-3xl p-8"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-xl font-semibold text-white">Setup</h2>
            <p className="mt-1 text-sm text-slate-400">Choose where to install and how shortcuts are created.</p>

            <label className="mt-6 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Installation folder
            </label>
            <motion.div layout className="mt-2 flex gap-2">
              <input
                readOnly
                value={options.installPath}
                className="flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              />
              <button
                type="button"
                onClick={onBrowse}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </button>
            </motion.div>

            <div className="mt-6 space-y-3">
              <OptionRow
                icon={<Monitor className="h-4 w-4" />}
                label="Desktop shortcut"
                checked={options.desktopShortcut}
                onChange={(v) => onOptionChange('desktopShortcut', v)}
              />
              <OptionRow
                icon={<FolderOpen className="h-4 w-4" />}
                label="Start menu shortcut"
                checked={options.startMenuShortcut}
                onChange={(v) => onOptionChange('startMenuShortcut', v)}
              />
              <OptionRow
                icon={<Rocket className="h-4 w-4" />}
                label="Launch Alpha when finished"
                checked={options.launchAfterInstall}
                onChange={(v) => onOptionChange('launchAfterInstall', v)}
              />
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onInstall}
                disabled={!options.installPath}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:brightness-110 disabled:opacity-40"
              >
                Install
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}

function OptionRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 transition hover:bg-white/5">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-sm text-slate-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-transparent accent-blue-500"
      />
    </label>
  );
}

export function InstallingView({
  progress,
  onCancel,
}: {
  progress: { percent: number; statusLabel: string; detail?: string };
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="flex h-full min-h-[560px] flex-col items-center justify-center p-10 installer-gradient"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-panel w-full max-w-md rounded-3xl p-10"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
      >
        <h2 className="text-xl font-semibold text-white">Installing Alpha</h2>
        <p className="mt-1 text-sm text-slate-400">Please wait while setup completes.</p>
        <div className="mt-8">
          <ProgressBar percent={progress.percent} label={progress.statusLabel} detail={progress.detail} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-8 w-full rounded-xl border border-white/10 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

export function CompleteView({
  installDir,
  onClose,
}: {
  installDir: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="flex h-full min-h-[560px] flex-col items-center justify-center p-10 installer-gradient"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="glass-panel w-full max-w-md rounded-3xl p-10 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
        >
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </motion.div>
        <h2 className="mt-6 text-2xl font-bold text-white">Installation complete</h2>
        <p className="mt-2 break-all text-sm text-slate-400">{installDir}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}
