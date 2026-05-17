import { motion } from 'framer-motion';

type ProgressBarProps = {
  percent: number;
  label: string;
  detail?: string;
};

export function ProgressBar({ percent, label, detail }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <motion.div layout className="space-y-3">
      <motion.div layout className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {detail ? <p className="mt-1 truncate text-xs text-slate-500">{detail}</p> : null}
        </div>
        <span className="text-2xl font-semibold tabular-nums text-white">{Math.round(clamped)}%</span>
      </motion.div>
      <motion.div layout className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </motion.div>
    </motion.div>
  );
}
