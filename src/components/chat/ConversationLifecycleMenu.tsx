import { useEffect, useRef, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

interface ConversationLifecycleMenuProps {
  open: boolean;
  forceAction?: boolean;
  onKeep: () => void;
  onCompact: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

export function ConversationLifecycleMenu({
  open,
  forceAction = false,
  onKeep,
  onCompact,
  onDiscard,
  onDismiss,
}: ConversationLifecycleMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onDismiss, open);

  useEffect(() => {
    if (open) {
      const firstBtn = ref.current?.querySelector<HTMLButtonElement>('button');
      firstBtn?.focus();
    }
  }, [open]);

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = ref.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!items?.length) return;
      const idx = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          items[(idx + 1) % items.length].focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length].focus();
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

  const itemClass =
    'flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[length:var(--text-sm)] text-text-primary cursor-pointer transition-colors hover:bg-bg-tertiary focus-visible:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-[var(--bmad-z-dropdown)] mt-1 min-w-[200px] overflow-hidden rounded-[var(--radius-md)] border border-border-primary bg-bg-elevated shadow-md"
      role="menu"
      aria-label="Conversation actions"
      onKeyDown={handleKeydown}
    >
      {!forceAction && (
        <button className={itemClass} role="menuitem" tabIndex={0} onClick={onKeep}>
          Keep Working
        </button>
      )}
      <button className={itemClass} role="menuitem" tabIndex={0} onClick={onCompact}>
        Compact into Insight
      </button>
      <button
        className={`${itemClass} text-error hover:bg-error/10`}
        role="menuitem"
        tabIndex={0}
        onClick={onDiscard}
      >
        Discard
      </button>
    </div>
  );
}
