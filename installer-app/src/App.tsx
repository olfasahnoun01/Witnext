import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/SplashScreen';
import {
  CompleteView,
  InstallingView,
  InstallerWizard,
} from './components/InstallerWizard';
import { useInstaller } from './hooks/useInstaller';

export default function App() {
  const {
    phase,
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
  } = useInstaller();

  if (!window.alphaInstaller) {
    return (
      <motion.div className="flex h-screen items-center justify-center bg-[#070b14] text-slate-400">
        Run via Electron: npm run installer:electron:dev
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'splash' && <SplashScreen key="splash" />}
      {phase === 'welcome' && (
        <InstallerWizard
          key="welcome"
          defaults={defaults}
          options={options}
          onBrowse={browsePath}
          onOptionChange={updateOption}
          onInstall={startInstall}
          onCancel={closeInstaller}
        />
      )}
      {phase === 'installing' && (
        <InstallingView key="installing" progress={progress} onCancel={cancelInstall} />
      )}
      {phase === 'complete' && resultPaths && (
        <CompleteView key="complete" installDir={resultPaths.installDir} onClose={closeInstaller} />
      )}
      {phase === 'error' && (
        <motion.div
          key="error"
          className="flex h-full min-h-[560px] flex-col items-center justify-center p-10 installer-gradient"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div className="glass-panel max-w-md rounded-3xl p-10 text-center">
            <p className="text-lg font-semibold text-rose-400">Installation failed</p>
            <p className="mt-3 text-sm text-slate-400">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-8 w-full rounded-xl border border-white/10 py-3 text-sm text-slate-300 hover:bg-white/5"
            >
              Try again
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
