import { FileText, Loader2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { AgentBadge } from './AgentBadge';
import { formatWorkflowLabel } from '../../lib/phase-utils';
import type { PhaseGraphNode } from '../../types/phases';
import { cn } from '../../lib/utils';
import { useOpenCodeStore } from '../../stores/opencode.store';
import { useProjectStore } from '../../stores/project.store';
import { useStreamStore } from '../../stores/stream.store';
import { WORKFLOW_SKILL_MAP, launchWorkflow } from '../../services/opencode.service';

interface WorkflowActionPopoverProps {
  node: PhaseGraphNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewArtifact?: (artifactPath: string) => void;
  artifactPath?: string | null;
  children: React.ReactNode;
}

export function WorkflowActionPopover({
  node,
  open,
  onOpenChange,
  onViewArtifact,
  artifactPath,
  children,
}: WorkflowActionPopoverProps) {
  const skillCommand = WORKFLOW_SKILL_MAP[node.workflow_id] ?? node.workflow_id;
  const hasArtifact = !!artifactPath;

  const serverStatus = useOpenCodeStore((state) => state.serverStatus);
  const errorMessage = useOpenCodeStore((state) => state.errorMessage);
  const sessionLaunching = useOpenCodeStore((state) => state.sessionLaunching);
  const setSessionLaunching = useOpenCodeStore((state) => state.setSessionLaunching);
  const setActiveSession = useOpenCodeStore((state) => state.setActiveSession);
  const setSessionError = useOpenCodeStore((state) => state.setSessionError);

  const project = useProjectStore((state) => state.project);
  const streams = useStreamStore((state) => state.streams);
  const activeStreamId = useStreamStore((state) => state.activeStreamId);

  const activeStream = streams.find((s) => s.name === activeStreamId);

  const isServerReady = serverStatus === 'ready';
  const isServerConnecting =
    serverStatus === 'connecting' || serverStatus === 'restarting';

  const canLaunch = isServerReady && !sessionLaunching && !!project && !!activeStream;

  const buttonText = sessionLaunching
    ? 'Launching...'
    : isServerConnecting
      ? 'Connecting to OpenCode...'
      : 'Launch Workflow';

  function getButtonTooltip(): string | undefined {
    if (sessionLaunching) {
      return 'Creating OpenCode session...';
    }
    switch (serverStatus) {
      case 'not-installed':
        return 'OpenCode not detected — install to enable AI sessions';
      case 'not-configured':
        return 'Configure OpenCode to enable AI sessions';
      case 'error':
        return `OpenCode unavailable: ${errorMessage}`;
      case 'connecting':
      case 'restarting':
        return 'OpenCode server is starting...';
      default:
        return undefined;
    }
  }

  async function handleLaunchWorkflow() {
    if (!canLaunch || !project || !activeStream) return;

    setSessionLaunching(true);
    setSessionError(null);

    try {
      const result = await launchWorkflow({
        workflowId: node.workflow_id,
        streamName: activeStream.name,
        projectName: project.projectName,
        projectId: project.projectName,
        streamId: activeStream.name,
        projectRoot: project.projectRoot,
        worktreePath: activeStream.worktree,
      });

      setActiveSession(result.sessionId, activeStream.name);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to launch workflow';
      console.error('[WorkflowActionPopover] Launch failed:', message);
      setSessionError(message);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72"
        onEscapeKeyDown={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h3 className="text-[length:var(--text-sm)] font-semibold text-text-primary">
                {formatWorkflowLabel(node.workflow_id)}
              </h3>
              {node.agent && (
                <div className="mt-1">
                  <AgentBadge agent={node.agent} compact={false} />
                </div>
              )}
            </div>
          </div>

          {/* Purpose */}
          {node.purpose && (
            <p className="text-[length:var(--text-xs)] leading-relaxed text-text-secondary">
              {node.purpose}
            </p>
          )}

          {/* Skill command */}
          <div className="rounded-[var(--radius-sm)] bg-bg-primary px-2 py-1.5">
            <code className="text-[length:var(--text-xs)] text-accent">
              {skillCommand}
            </code>
          </div>

          {/* Actions */}
          <div className={cn('flex gap-2', hasArtifact ? 'flex-col' : '')}>
            <button
              className={cn(
                'flex-1 rounded-[var(--radius-md)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium transition-opacity',
                canLaunch
                  ? 'bg-accent/20 text-accent hover:bg-accent/30 cursor-pointer'
                  : 'bg-accent/20 text-accent opacity-50 cursor-not-allowed'
              )}
              disabled={!canLaunch}
              title={getButtonTooltip()}
              onClick={handleLaunchWorkflow}
            >
              {sessionLaunching && (
                <Loader2 className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin" />
              )}
              {buttonText}
            </button>
            {hasArtifact && (
              <button
                className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border-primary px-3 py-1.5 text-[length:var(--text-sm)] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                onClick={() => {
                  onOpenChange(false);
                  onViewArtifact?.(artifactPath!);
                }}
              >
                <FileText className="h-3 w-3" />
                View Artifact
              </button>
            )}
          </div>

          {/* Server status messages */}
          {serverStatus === 'not-installed' && (
            <p className="text-[length:var(--text-xs)] text-warning">
              OpenCode not detected — install to enable AI sessions
            </p>
          )}
          {serverStatus === 'not-configured' && (
            <p className="text-[length:var(--text-xs)] text-warning">
              OpenCode detected but not configured — configure to enable AI sessions
            </p>
          )}
          {serverStatus === 'error' && (
            <p className="text-[length:var(--text-xs)] text-error">
              OpenCode unavailable: {errorMessage}
            </p>
          )}
          {serverStatus === 'restarting' && (
            <p className="text-[length:var(--text-xs)] text-text-muted">
              OpenCode server restarting...
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
