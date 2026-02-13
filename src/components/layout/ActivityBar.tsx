import { useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useConnectionStore, type ConnectionStatus } from '@/stores/connection.store';

export type AppMode = 'dashboard' | 'stream' | 'settings';

interface ModeConfig {
  id: AppMode;
  label: string;
  icon: LucideIcon;
}

const MODES: ModeConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stream', label: 'Stream Detail', icon: GitBranch },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected': return 'bg-success';
    case 'connecting': return 'bg-warning';
    case 'error': return 'bg-error';
    default: return 'bg-text-muted';
  }
}

function getStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'error': return 'Connection error';
    default: return 'Disconnected';
  }
}

interface ActivityBarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ActivityBar({ activeMode, onModeChange }: ActivityBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const connectionStatus = useConnectionStore(s => s.status);

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = MODES.findIndex(m => m.id === activeMode);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % MODES.length;
          break;
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = MODES.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onModeChange(MODES[nextIndex].id);

      // Focus the new button
      requestAnimationFrame(() => {
        const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
        buttons?.[nextIndex!]?.focus();
      });
    },
    [activeMode, onModeChange],
  );

  const statusColor = getStatusColor(connectionStatus);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-12 min-w-12 flex-col border-r border-surface-border bg-surface-raised">
        <nav
          ref={navRef}
          role="tablist"
          aria-orientation="vertical"
          onKeyDown={handleKeydown}
          className="flex flex-col gap-1 py-1"
        >
          {MODES.map(mode => {
            const isActive = mode.id === activeMode;
            const Icon = mode.icon;
            return (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>
                  <button
                    role="tab"
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={isActive}
                    aria-label={mode.label}
                    onClick={() => onModeChange(mode.id)}
                    className={cn(
                      'flex h-10 w-12 cursor-pointer items-center justify-center border-l-2 border-transparent bg-transparent text-interactive-default transition-colors duration-150 hover:text-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-interactive-accent',
                      isActive && 'border-l-interactive-accent text-interactive-active',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{mode.label}</TooltipContent>
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
              {getStatusLabel(connectionStatus)}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
