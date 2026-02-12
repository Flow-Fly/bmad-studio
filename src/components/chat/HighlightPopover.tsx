import { useEffect, useRef, useCallback } from 'react';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../types/conversation';

const COLORS: HighlightColor[] = ['yellow', 'green', 'red', 'blue'];

const COLOR_VALUES: Record<HighlightColor, string> = {
  yellow: '#f0c040',
  green: '#40c057',
  red: '#e05252',
  blue: '#4a9eff',
};

interface HighlightPopoverProps {
  x: number;
  y: number;
  open: boolean;
  onSelect: (color: HighlightColor) => void;
  onDismiss: () => void;
}

export function HighlightPopover({ x, y, open, onSelect, onDismiss }: HighlightPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClick);
    });
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onDismiss]);

  useEffect(() => {
    if (open) {
      const firstBtn = ref.current?.querySelector('button');
      firstBtn?.focus();
    }
  }, [open]);

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const focused = document.activeElement;
      const idx = Array.from(buttons).indexOf(focused as HTMLButtonElement);

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          buttons[(idx + 1) % buttons.length].focus();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          buttons[(idx - 1 + buttons.length) % buttons.length].focus();
          break;
        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
      }
    },
    [onDismiss],
  );

  if (!open) return null;

  const clampedX = Math.min(x, window.innerWidth - 120);
  const clampedY = Math.min(y, window.innerHeight - 40);

  return (
    <div
      ref={ref}
      className="fixed z-[var(--bmad-z-dropdown)] flex gap-1 rounded-[var(--radius-md)] border border-border-primary bg-bg-elevated p-1 shadow-md"
      style={{ left: clampedX, top: clampedY }}
      role="toolbar"
      aria-label="Highlight colors"
      onKeyDown={handleKeydown}
    >
      {COLORS.map(color => (
        <button
          key={color}
          className="h-5 w-5 cursor-pointer rounded-full border-2 border-transparent p-0 transition-transform hover:scale-[1.2] hover:border-text-primary focus-visible:scale-[1.2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ backgroundColor: COLOR_VALUES[color] }}
          title={HIGHLIGHT_COLORS[color]}
          aria-label={`Highlight as ${HIGHLIGHT_COLORS[color]}`}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
  );
}
