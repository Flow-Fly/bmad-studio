import { useState } from 'react';
import { cn } from '../../lib/utils';

type ContextLevel = 'low' | 'medium' | 'high' | 'critical';

interface ContextIndicatorProps {
  percentage: number;
  modelName: string;
  onClick?: () => void;
}

function getLevel(pct: number): ContextLevel {
  if (pct >= 95) return 'critical';
  if (pct >= 80) return 'high';
  if (pct >= 60) return 'medium';
  return 'low';
}

const BAR_COLORS: Record<ContextLevel, string> = {
  low: 'bg-accent',
  medium: 'bg-warning',
  high: 'bg-[#f0883e]',
  critical: 'bg-error animate-pulse',
};

const TRACK_HEIGHTS: Record<ContextLevel, string> = {
  low: 'h-0.5',
  medium: 'h-[3px]',
  high: 'h-1',
  critical: 'h-1',
};

export function ContextIndicator({ percentage, modelName, onClick }: ContextIndicatorProps) {
  const [hovered, setHovered] = useState(false);
  const level = getLevel(percentage);
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div
      className="relative cursor-pointer px-4 py-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-bg-tertiary transition-all duration-300',
          TRACK_HEIGHTS[level],
        )}
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Context window usage"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', BAR_COLORS[level])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {hovered && (
        <div className="absolute bottom-full right-0 z-50 mb-1 whitespace-nowrap rounded-[var(--radius-sm)] border border-border-primary bg-bg-elevated px-2 py-1 text-[length:var(--text-xs)] text-text-secondary">
          {clamped}% of {modelName} context
        </div>
      )}
    </div>
  );
}
