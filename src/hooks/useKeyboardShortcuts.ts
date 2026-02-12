import { useEffect } from 'react';

type SectionId = 'graph' | 'chat' | 'insights' | 'artifacts';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  onSectionChange: (section: SectionId) => void;
  onFocusChatInput?: () => void;
}

const SECTION_MAP: Record<string, SectionId> = {
  '1': 'graph',
  '2': 'chat',
  '3': 'insights',
  '4': 'artifacts',
};

export function useKeyboardShortcuts({
  enabled,
  onSectionChange,
  onFocusChatInput,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeydown(e: KeyboardEvent) {
      if (!e.metaKey) return;
      const section = SECTION_MAP[e.key];
      if (section) {
        e.preventDefault();
        onSectionChange(section);
        if (section === 'chat' && onFocusChatInput) {
          // Small delay to let the chat panel render
          requestAnimationFrame(() => onFocusChatInput());
        }
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [enabled, onSectionChange, onFocusChatInput]);
}
