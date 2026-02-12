import { useCallback, useRef } from 'react';
import {
  GitBranch,
  MessageSquare,
  Lightbulb,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '../ui/tooltip';
import { useConnectionStore } from '../../stores/connection.store';

interface SectionConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: SectionConfig[] = [
  { id: 'graph', label: 'Phase Graph', icon: GitBranch },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'artifacts', label: 'Artifacts', icon: FileText },
];

interface ActivityBarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function ActivityBar({ activeSection, onSectionChange }: ActivityBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const connectionStatus = useConnectionStore(s => s.status);

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = SECTIONS.findIndex(s => s.id === activeSection);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % SECTIONS.length;
          break;
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = SECTIONS.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onSectionChange(SECTIONS[nextIndex].id);

      // Focus the new button
      requestAnimationFrame(() => {
        const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
        buttons?.[nextIndex!]?.focus();
      });
    },
    [activeSection, onSectionChange],
  );

  const statusColor =
    connectionStatus === 'connected'
      ? 'bg-success'
      : connectionStatus === 'connecting'
        ? 'bg-warning'
        : connectionStatus === 'error'
          ? 'bg-error'
          : 'bg-text-muted';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-12 min-w-12 flex-col border-r border-border-primary bg-bg-secondary">
        <nav
          ref={navRef}
          role="tablist"
          aria-orientation="vertical"
          onKeyDown={handleKeydown}
          className="flex flex-col gap-1 py-1"
        >
          {SECTIONS.map(section => {
            const isActive = section.id === activeSection;
            const Icon = section.icon;
            return (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <button
                    role="tab"
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={isActive}
                    aria-label={section.label}
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                      'flex h-10 w-12 items-center justify-center border-l-2 border-transparent bg-transparent text-text-secondary hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent cursor-pointer',
                      isActive && 'border-l-accent text-accent',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{section.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Connection status dot */}
        <div className="mt-auto flex justify-center pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn('h-2 w-2 rounded-full', statusColor)}
                aria-label={`Connection: ${connectionStatus}`}
              />
            </TooltipTrigger>
            <TooltipContent side="right">
              {connectionStatus === 'connected'
                ? 'Connected'
                : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : connectionStatus === 'error'
                    ? 'Connection error'
                    : 'Disconnected'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
