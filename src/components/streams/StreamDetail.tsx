import { useState, useEffect, useCallback } from 'react';
import { GitBranch } from 'lucide-react';

import { useStreamStore } from '@/stores/stream.store';
import { usePhaseStore } from '@/stores/phase.store';
import { useActiveSession } from '@/stores/opencode.store';
import { Badge } from '@/components/ui/badge';
import { PhaseDotIndicator } from '@/components/streams/PhaseDotIndicator';
import { PhaseGraphContainer } from '@/components/phase-graph/PhaseGraphContainer';
import { ArtifactViewer } from '@/components/artifacts/ArtifactViewer';
import { ConversationHeader } from '@/components/opencode/ConversationHeader';
import { ChatPanel } from '@/components/opencode/ChatPanel';
import { useOpenCodeEvents } from '@/hooks/useOpenCodeEvents';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { capitalize, formatRelativeTime } from '@/lib/format-utils';
import type { NodeVisualState } from '@/types/phases';

export function StreamDetail() {
  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const streams = useStreamStore((s) => s.streams);
  const stream = streams.find((s) => s.name === activeStreamId);
  const fetchPhaseData = usePhaseStore((s) => s.fetchPhaseData);
  const clearPhaseState = usePhaseStore((s) => s.clearPhaseState);

  const [view, setView] = useState<'graph' | 'artifact' | 'session'>('graph');
  const [artifactPath, setArtifactPath] = useState<string | null>(null);
  const [artifactPhase, setArtifactPhase] = useState<string | undefined>(undefined);

  const { sessionId } = useActiveSession();

  // Mount OpenCode events hook
  useOpenCodeEvents();

  const handleEscapeFromChat = useCallback(() => {
    setView('graph');
  }, []);

  useKeyboardShortcuts({
    enabled: view === 'session' && !!sessionId,
    onSectionChange: () => {}, // Not used in this context
    onEscapeFromChat: handleEscapeFromChat,
  });

  // Fetch phase data when active stream changes
  useEffect(() => {
    if (activeStreamId) {
      fetchPhaseData();
    } else {
      clearPhaseState();
    }
    // Reset view when switching streams
    setView('graph');
    setArtifactPath(null);
  }, [activeStreamId, fetchPhaseData, clearPhaseState]);

  // Handle node click from phase graph
  const handleNodeClick = useCallback(
    (workflowId: string, visualState: NodeVisualState, path?: string | null) => {
      if (visualState === 'complete' && path) {
        setArtifactPath(path);
        setArtifactPhase(stream?.phase);
        setView('artifact');
      }
    },
    [stream?.phase],
  );

  const handleBackToGraph = useCallback(() => {
    setView('graph');
    setArtifactPath(null);
  }, []);

  if (!stream) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-surface-base text-interactive-default">
        <GitBranch className="mb-4 h-12 w-12 text-interactive-muted" />
        <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          No Stream Selected
        </h1>
        <p className="mt-2 text-[length:var(--text-md)] text-interactive-muted">
          Select a stream from the dashboard to view its details
        </p>
      </div>
    );
  }

  const phaseLabel = stream.phase ? capitalize(stream.phase) : 'No phase data';

  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      {/* Stream header */}
      <div className="border-b border-surface-border px-4 py-3">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 shrink-0 text-interactive-muted" />
          <h1 className="truncate text-[length:var(--text-lg)] font-semibold text-interactive-active">
            {stream.name}
          </h1>
          <Badge variant="outline" className="shrink-0">
            {stream.type === 'full' ? 'Full Flow' : stream.type}
          </Badge>
        </div>
        <div className="mt-1.5 flex items-center gap-3 pl-8">
          <PhaseDotIndicator currentPhase={stream.phase} />
          <span className="text-[length:var(--text-sm)] text-interactive-default">
            {phaseLabel}
          </span>
          <span className="text-[length:var(--text-xs)] text-interactive-muted">
            Updated {formatRelativeTime(stream.updatedAt)}
          </span>
        </div>
      </div>

      {/* Content area — phase graph, artifact viewer, or session */}
      <div className="flex-1 overflow-auto">
        {view === 'graph' && (
          <PhaseGraphContainer onNodeClick={handleNodeClick} />
        )}
        {view === 'artifact' && artifactPath && (
          <ArtifactViewer
            artifactPath={artifactPath}
            phase={artifactPhase}
            onBack={handleBackToGraph}
          />
        )}
        {view === 'session' && (
          <div className="flex h-full flex-col">
            <ConversationHeader />
            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
