import { useState, useRef, useCallback, useEffect } from 'react';
import {
  User,
  Bot,
  Brain,
  Code,
  Palette,
  Shield,
  ClipboardList,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useChatStore } from '../../stores/chat.store';
import { cn } from '../../lib/utils';
import type { Agent } from '../../types/agent';

const ICON_MAP: Record<string, LucideIcon> = {
  user: User,
  bot: Bot,
  brain: Brain,
  code: Code,
  palette: Palette,
  shield: Shield,
  'clipboard-list': ClipboardList,
};

function AgentIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? User;
  return <Icon className={className} />;
}

interface AgentBadgeProps {
  onAgentChange?: (agentId: string) => void;
}

export function AgentBadge({ onAgentChange }: AgentBadgeProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const agents = useAgentStore(s => s.agents);
  const activeAgentId = useAgentStore(s => s.activeAgentId);
  const activeAgent = useAgentStore(s => s.activeAgent)();
  const agentConversations = useAgentStore(s => s.agentConversations);
  const conversations = useChatStore(s => s.conversations);

  const hasActiveConversation = useCallback(
    (agentId: string): boolean => {
      const convId = agentConversations[agentId];
      if (!convId) return false;
      return !!conversations[convId];
    },
    [agentConversations, conversations],
  );

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  const selectAgent = useCallback(
    (agent: Agent) => {
      useAgentStore.getState().setActiveAgent(agent.id);
      onAgentChange?.(agent.id);
      closeDropdown();
      badgeRef.current?.focus();
    },
    [onAgentChange, closeDropdown],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        badgeRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, closeDropdown]);

  // Focus management for dropdown items
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const items = dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="option"]',
    );
    items?.[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  const handleBadgeKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setFocusedIndex(0);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  };

  const handleDropdownKeydown = (e: React.KeyboardEvent) => {
    if (agents.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % agents.length);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + agents.length) % agents.length);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < agents.length) {
          selectAgent(agents[focusedIndex]);
        }
        break;
      }
      case 'Escape':
      case 'Tab': {
        e.preventDefault();
        closeDropdown();
        badgeRef.current?.focus();
        break;
      }
    }
  };

  if (agents.length === 0) {
    return (
      <span className="text-[length:var(--text-sm)] font-medium text-text-primary">
        Chat
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        ref={badgeRef}
        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-1 text-[length:var(--text-sm)] leading-tight text-text-primary transition-colors hover:border-border-primary hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select BMAD agent"
        aria-activedescendant={
          open && focusedIndex >= 0 && agents[focusedIndex]
            ? `agent-option-${agents[focusedIndex].id}`
            : undefined
        }
        onClick={() => setOpen(!open)}
        onKeyDown={handleBadgeKeydown}
      >
        {activeAgent ? (
          <>
            <AgentIcon name={activeAgent.icon} className="h-4 w-4 shrink-0" />
            <span className="font-medium whitespace-nowrap">{activeAgent.name}</span>
            <span className="max-w-[140px] truncate whitespace-nowrap text-text-secondary">
              {activeAgent.title}
            </span>
          </>
        ) : (
          <span className="font-medium">Chat</span>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-text-secondary transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-[calc(100%+4px)] z-[var(--bmad-z-dropdown)] min-w-[280px] max-h-[400px] overflow-y-auto rounded-[var(--radius-md)] border border-border-primary bg-bg-elevated py-1 shadow-md animate-in fade-in slide-in-from-top-1 duration-200"
          role="listbox"
          aria-label="Select BMAD agent"
          onKeyDown={handleDropdownKeydown}
        >
          {agents.map((a, index) => (
            <button
              key={a.id}
              id={`agent-option-${a.id}`}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[length:var(--text-sm)] text-text-primary transition-colors hover:bg-bg-tertiary focus-visible:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                a.id === activeAgentId && 'border-l-2 border-l-accent bg-bg-tertiary',
              )}
              role="option"
              aria-selected={a.id === activeAgentId}
              tabIndex={index === focusedIndex ? 0 : -1}
              onClick={() => selectAgent(a)}
            >
              <AgentIcon name={a.icon} className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block truncate text-[length:var(--text-xs)] text-text-secondary">
                  {a.title}
                </span>
              </span>
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  hasActiveConversation(a.id)
                    ? 'bg-accent'
                    : 'border-[1.5px] border-text-muted bg-transparent',
                )}
                title={
                  hasActiveConversation(a.id)
                    ? 'Active conversation'
                    : 'No conversation'
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
