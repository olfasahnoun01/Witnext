import { motion } from 'framer-motion';
import logoIcon from '../../../src/assets/logo-icon-512.png';

export function SplashScreen() {
  return (
    <motion.div
      className="flex h-full min-h-[560px] flex-col items-center justify-center installer-gradient"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.45 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel flex h-28 w-28 items-center justify-center rounded-3xl"
      >
        <img src={logoIcon} alt="Alpha" className="h-20 w-20 object-contain" draggable={false} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="mt-8 text-sm font-medium tracking-[0.35em] text-slate-400 uppercase"
      >
        Alpha ERP
      </motion.p>
      <motion.div
        className="mt-10 h-1 w-32 overflow-hidden rounded-full bg-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-rose-500"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          style={{ width: '40%' }}
        />
      </motion.div>
    </motion.div>
  );
}
