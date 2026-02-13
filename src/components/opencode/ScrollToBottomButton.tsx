import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({
  isVisible,
  onClick,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute bottom-16 right-4 z-10',
        'rounded-full p-3 shadow-md',
        'bg-surface-overlay hover:bg-surface-raised',
        'border border-surface-border',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-interactive-accent',
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
      aria-label="Scroll to bottom"
    >
      <ChevronDown className="h-5 w-5 text-interactive-default" />
    </button>
  );
}
