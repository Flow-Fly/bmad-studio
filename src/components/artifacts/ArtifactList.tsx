import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  Loader2,
} from 'lucide-react';
import { listArtifacts, listDirectoryArtifacts } from '../../services/artifact.service';
import { useStreamStore } from '../../stores/stream.store';
import { usePhaseStore } from '../../stores/phase.store';
import { AgentBadge } from '../phase-graph/AgentBadge';
import { cn } from '../../lib/utils';
import type { ArtifactInfo } from '../../types/artifact';

interface ArtifactListProps {
  selectedArtifact: string | null;
  onSelectArtifact: (artifactPath: string, phase: string) => void;
}

/**
 * Map artifact filename to the agent that produced it by matching against
 * workflow output paths and agent assignments from phase data.
 */
function useArtifactAgentMap(): Record<string, string> {
  const phases = usePhaseStore((s) => s.phases);
  const workflowStatus = usePhaseStore((s) => s.workflowStatus);

  if (!phases || !workflowStatus) return {};

  const map: Record<string, string> = {};

  for (const phase of phases.phases) {
    for (const workflow of phase.workflows) {
      if (!workflow.agent) continue;

      // Match by workflow output field
      if (workflow.output) {
        const baseName = workflow.output.split('/').pop() ?? workflow.output;
        map[baseName] = workflow.agent;
        // Also map the directory name for sharded artifacts
        const dirName = workflow.output.replace(/\.md$/, '');
        if (dirName !== workflow.output) {
          map[dirName] = workflow.agent;
        }
      }

      // Match by artifact_path from workflow status
      const status = workflowStatus.workflow_statuses[workflow.id];
      if (status?.artifact_path) {
        const baseName = status.artifact_path.split('/').pop() ?? status.artifact_path;
        map[baseName] = workflow.agent;
        const dirName = status.artifact_path.replace(/\.md$/, '');
        if (dirName !== status.artifact_path) {
          map[dirName] = workflow.agent;
        }
      }
    }
  }

  return map;
}

/**
 * Determine whether an artifact is "complete" based on workflow status data.
 */
function useArtifactCompletionMap(): Record<string, boolean> {
  const workflowStatus = usePhaseStore((s) => s.workflowStatus);

  if (!workflowStatus) return {};

  const map: Record<string, boolean> = {};

  for (const [, status] of Object.entries(workflowStatus.workflow_statuses)) {
    if (status.artifact_path) {
      const baseName = status.artifact_path.split('/').pop() ?? status.artifact_path;
      map[baseName] = status.is_complete;
      const dirName = status.artifact_path.replace(/\.md$/, '');
      if (dirName !== status.artifact_path) {
        map[dirName] = status.is_complete;
      }
    }
  }

  return map;
}

export function ArtifactList({ selectedArtifact, onSelectArtifact }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, ArtifactInfo[]>>({});
  const [expandingDir, setExpandingDir] = useState<string | null>(null);

  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const streams = useStreamStore((s) => s.streams);
  const stream = streams.find((s) => s.name === activeStreamId);

  const agentMap = useArtifactAgentMap();
  const completionMap = useArtifactCompletionMap();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!stream?.project || !activeStreamId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await listArtifacts(stream.project, activeStreamId);
        if (!cancelled) {
          setArtifacts(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifacts');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [stream?.project, activeStreamId]);

  const toggleDir = async (dirName: string) => {
    if (expandedDirs[dirName]) {
      // Collapse
      setExpandedDirs((prev) => {
        const next = { ...prev };
        delete next[dirName];
        return next;
      });
      return;
    }

    // Expand: fetch directory contents
    if (!stream?.project || !activeStreamId) return;

    setExpandingDir(dirName);
    try {
      const children = await listDirectoryArtifacts(stream.project, activeStreamId, dirName);
      setExpandedDirs((prev) => ({ ...prev, [dirName]: children }));
    } catch {
      // If listing fails, set empty array so user sees it's empty
      setExpandedDirs((prev) => ({ ...prev, [dirName]: [] }));
    } finally {
      setExpandingDir(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-interactive-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-3 py-6 text-center text-[length:var(--text-sm)] text-status-blocked">
        {error}
      </p>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
        <p className="text-[length:var(--text-sm)] text-interactive-muted">
          No artifacts yet. Launch a workflow to produce artifacts.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 p-2" role="list" aria-label="Artifacts">
      {artifacts.map((artifact) => {
        const isDir = artifact.type === 'directory';
        const isExpanded = !!expandedDirs[artifact.filename];
        const isSelected = selectedArtifact === artifact.filename;
        const isComplete = completionMap[artifact.filename] ?? false;
        const agent = agentMap[artifact.filename];

        return (
          <li key={artifact.filename}>
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors',
                'hover:bg-bg-tertiary',
                isSelected && 'bg-bg-tertiary',
              )}
              onClick={() => {
                if (isDir) {
                  toggleDir(artifact.filename);
                } else {
                  onSelectArtifact(artifact.filename, artifact.phase);
                }
              }}
            >
              {/* Status icon */}
              {isDir ? (
                isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-interactive-muted" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-interactive-muted" />
                )
              ) : isComplete ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-status-active" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 text-interactive-muted" />
              )}

              {/* Icon */}
              {isDir ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-interactive-muted" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-interactive-muted" />
              )}

              {/* Filename */}
              <span className="flex-1 truncate font-mono text-[length:var(--text-sm)] text-text-primary">
                {artifact.filename}
              </span>

              {/* Agent badge */}
              {agent && <AgentBadge agent={agent} compact />}
            </button>

            {/* Expanded directory children */}
            {isDir && isExpanded && (
              <ul className="flex flex-col gap-0.5 pl-6" role="group">
                {expandingDir === artifact.filename ? (
                  <li className="flex items-center justify-center py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-interactive-muted" />
                  </li>
                ) : expandedDirs[artifact.filename]?.length === 0 ? (
                  <li className="px-2 py-1.5 text-[length:var(--text-sm)] text-interactive-muted">
                    Empty directory
                  </li>
                ) : (
                  expandedDirs[artifact.filename]?.map((child) => {
                    const childPath = `${artifact.filename}/${child.filename}`;
                    const isChildSelected = selectedArtifact === childPath;
                    const isChildComplete =
                      completionMap[child.filename] ?? completionMap[artifact.filename] ?? false;

                    return (
                      <li key={child.filename}>
                        <button
                          className={cn(
                            'flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors',
                            'hover:bg-bg-tertiary',
                            isChildSelected && 'bg-bg-tertiary',
                          )}
                          onClick={() =>
                            onSelectArtifact(childPath, child.phase || artifact.phase)
                          }
                        >
                          {isChildComplete ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-status-active" />
                          ) : (
                            <Circle className="h-3 w-3 shrink-0 text-interactive-muted" />
                          )}
                          <FileText className="h-3.5 w-3.5 shrink-0 text-interactive-muted" />
                          <span className="flex-1 truncate font-mono text-[length:var(--text-sm)] text-text-primary">
                            {child.filename}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
