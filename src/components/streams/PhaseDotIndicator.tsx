import { cn } from '@/lib/utils';

const PHASE_ORDER = ['analysis', 'planning', 'solutioning', 'implementation'] as const;

const PHASE_LABELS: Record<string, string> = {
  analysis: 'Analysis',
  planning: 'Planning',
  solutioning: 'Solutioning',
  implementation: 'Implementation',
};

/**
 * Phase color CSS custom properties from globals.css.
 * Used inline for the half-filled (in-progress) gradient effect.
 */
const PHASE_CSS_VARS: Record<string, string> = {
  analysis: 'var(--phase-analysis)',
  planning: 'var(--phase-planning)',
  solutioning: 'var(--phase-solutioning)',
  implementation: 'var(--phase-implementation)',
};

/**
 * Tailwind bg-* classes for filled (complete) dots.
 */
const PHASE_BG_CLASSES: Record<string, string> = {
  analysis: 'bg-phase-analysis',
  planning: 'bg-phase-planning',
  solutioning: 'bg-phase-solutioning',
  implementation: 'bg-phase-implementation',
};

type PhaseStatus = 'complete' | 'in-progress' | 'pending';

function getPhaseStatus(phase: string, currentPhase: string | undefined): PhaseStatus {
  if (!currentPhase) return 'pending';

  const currentIndex = PHASE_ORDER.indexOf(currentPhase as (typeof PHASE_ORDER)[number]);
  const phaseIndex = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);

  if (currentIndex < 0) return 'pending';
  if (phaseIndex < currentIndex) return 'complete';
  if (phaseIndex === currentIndex) return 'in-progress';
  return 'pending';
}

function buildAriaLabel(currentPhase: string | undefined): string {
  if (!currentPhase) return 'Phase: No phase data';

  const parts: string[] = [];
  for (const phase of PHASE_ORDER) {
    const status = getPhaseStatus(phase, currentPhase);
    const label = PHASE_LABELS[phase];
    if (status === 'in-progress') {
      parts.push(`${label} in progress`);
    } else if (status === 'complete') {
      parts.push(`${label} complete`);
    }
  }

  return parts.length > 0 ? `Phase: ${parts.join(', ')}` : 'Phase: No phase data';
}

interface PhaseDotIndicatorProps {
  currentPhase: string | undefined;
  className?: string;
}

export function PhaseDotIndicator({ currentPhase, className }: PhaseDotIndicatorProps) {
  const ariaLabel = buildAriaLabel(currentPhase);

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {PHASE_ORDER.map((phase) => {
        const status = getPhaseStatus(phase, currentPhase);
        const bgClass = PHASE_BG_CLASSES[phase];
        const cssVar = PHASE_CSS_VARS[phase];

        if (status === 'in-progress') {
          // Half-filled: left half colored, right half transparent with border
          return (
            <span
              key={phase}
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${cssVar} 50%, transparent 50%)`,
                border: `1px solid ${cssVar}`,
              }}
            />
          );
        }

        return (
          <span
            key={phase}
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              status === 'complete' && bgClass,
              status === 'pending' && 'border border-status-pending bg-transparent',
            )}
          />
        );
      })}
    </div>
  );
}
