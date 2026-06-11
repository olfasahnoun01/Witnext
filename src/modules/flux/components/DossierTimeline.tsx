import { cn } from '@/lib/utils';
import type { FluxStep } from '../types/dossierTypes';
import { fluxStepStatusLabel } from '../types/dossierTypes';

interface DossierTimelineProps {
  steps: FluxStep[];
  onStepClick?: (step: FluxStep) => void;
}

function stepColor(status: FluxStep['status']) {
  switch (status) {
    case 'done':
      return 'bg-green-500 border-green-600 text-white';
    case 'in_progress':
      return 'bg-amber-400 border-amber-500 text-amber-950';
    case 'draft':
      return 'bg-slate-300 border-slate-400 text-slate-800';
    case 'skipped':
      return 'bg-muted border-border text-muted-foreground';
    case 'missing':
    default:
      return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-950/50 dark:text-red-200';
  }
}

export function DossierTimeline({ steps, onStepClick }: DossierTimelineProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-1">
        {steps.map((step, idx) => (
          <button
            key={step.key}
            type="button"
            onClick={() => onStepClick?.(step)}
            className={cn(
              'flex flex-col items-center w-[88px] shrink-0 group',
              onStepClick && 'cursor-pointer'
            )}
            title={step.hint ?? step.label}
          >
            <div className="flex items-center w-full">
              {idx > 0 && <div className="h-0.5 flex-1 bg-border min-w-[8px]" />}
              <div
                className={cn(
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0',
                  stepColor(step.status)
                )}
              >
                {step.status === 'done' ? '✓' : idx + 1}
              </div>
              {idx < steps.length - 1 && <div className="h-0.5 flex-1 bg-border min-w-[8px]" />}
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-tight text-center mt-1.5 leading-tight px-0.5 text-muted-foreground group-hover:text-foreground">
              {step.label}
            </p>
            <p className="text-[8px] text-muted-foreground">{fluxStepStatusLabel(step.status)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
