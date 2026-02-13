import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  onClick: () => void;
}

/**
 * Fixed button that appears when user scrolls up in chat
 * Clicking it scrolls smoothly back to the bottom
 */
export function ScrollToBottomButton({
  isVisible,
  onClick,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-20 right-4 z-10',
        'rounded-full p-3 shadow-lg',
        'bg-surface-elevated hover:bg-surface-hover',
        'border border-stroke-default',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-interactive-focus',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-label="Scroll to bottom"
    >
      <ChevronDown className="h-5 w-5 text-interactive-default" />
    </button>
  );
}
