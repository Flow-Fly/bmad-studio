import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { computePhaseGraphNodes, computePhaseGraphEdges, getNodeVisualState } from '../../lib/phase-utils';
import type { PhasesResponse, PhaseGraphNode, NodeVisualState } from '../../types/phases';
import { usePhaseStore } from '../../stores/phase.store';
import { PhaseNode } from './PhaseNode';
import { ConditionalGate } from './ConditionalGate';
import { WorkflowActionPopover } from './WorkflowActionPopover';
import { TooltipProvider } from '../ui/tooltip';
import { cn } from '../../lib/utils';

const PHASE_ABBR: Record<string, string> = {
  Analysis: 'Anl',
  Planning: 'Pln',
  Solutioning: 'Sol',
  Implementation: 'Impl',
};

const DEV_LOOP_IDS = new Set(['create-story', 'dev-story', 'code-review']);

/** Visual states that allow clicking to open the workflow action popover */
const ACTIONABLE_STATES = new Set<NodeVisualState>([
  'current', 'required', 'recommended', 'conditional', 'optional', 'not-started',
]);

interface PhaseColumn {
  num: number;
  name: string;
  nodes: PhaseGraphNode[];
}

interface PhaseGraphContainerProps {
  onNodeClick?: (workflowId: string, visualState: NodeVisualState, artifactPath?: string | null) => void;
}

export function PhaseGraphContainer({ onNodeClick }: PhaseGraphContainerProps) {
  const [compact, setCompact] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  const phases = usePhaseStore((s) => s.phases);
  const workflowStatus = usePhaseStore((s) => s.workflowStatus);
  const loading = usePhaseStore((s) => s.loading);
  const error = usePhaseStore((s) => s.error);
  const fetchPhaseData = usePhaseStore((s) => s.fetchPhaseData);

  const nodes = useMemo(
    () => computePhaseGraphNodes(phases, workflowStatus),
    [phases, workflowStatus],
  );

  const edges = useMemo(
    () => computePhaseGraphEdges(phases),
    [phases],
  );

  // Build a set of conditional workflows keyed by their included_by parent
  const conditionalGates = useMemo(() => {
    if (!phases) return new Map<string, { workflowId: string; label: string; conditionType: string }[]>();
    const gates = new Map<string, { workflowId: string; label: string; conditionType: string }[]>();
    for (const phase of phases.phases) {
      for (const wf of phase.workflows) {
        if (wf.conditional !== null && wf.included_by !== null) {
          const existing = gates.get(wf.included_by) ?? [];
          existing.push({
            workflowId: wf.id,
            label: wf.conditional,
            conditionType: wf.condition_type ?? 'flag',
          });
          gates.set(wf.included_by, existing);
        }
      }
    }
    return gates;
  }, [phases]);

  // ResizeObserver for compact mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCompact(entry.contentRect.width < 1280);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute SVG edge paths after layout
  const computeEdgePaths = useCallback(() => {
    const svgEl = svgRef.current;
    const container = graphRef.current;
    if (!svgEl || !container) return;

    const containerRect = container.getBoundingClientRect();

    // Build element map for O(1) lookups
    const nodeElements = new Map<string, HTMLElement>();
    for (const el of container.querySelectorAll<HTMLElement>('[data-workflow-id]')) {
      const id = el.dataset.workflowId;
      if (id) nodeElements.set(id, el);
    }

    const paths = svgEl.querySelectorAll<SVGPathElement>('path.edge-line');

    for (const pathEl of paths) {
      const fromId = pathEl.getAttribute('data-from');
      const toId = pathEl.getAttribute('data-to');
      if (!fromId || !toId) continue;

      const fromNode = nodeElements.get(fromId);
      const toNode = nodeElements.get(toId);
      if (!fromNode || !toNode) continue;

      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();

      const fromCenterX = fromRect.left + fromRect.width / 2;
      const toCenterX = toRect.left + toRect.width / 2;
      const sameColumn = Math.abs(fromCenterX - toCenterX) < fromRect.width;

      let d: string;
      if (sameColumn) {
        const x1 = fromCenterX - containerRect.left;
        const y1 = fromRect.bottom - containerRect.top;
        const x2 = toCenterX - containerRect.left;
        const y2 = toRect.top - containerRect.top;
        const dy = Math.abs(y2 - y1) * 0.4;
        d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
      } else {
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;
        const dx = Math.abs(x2 - x1) * 0.4;
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      }

      pathEl.setAttribute('d', d);
    }
  }, []);

  // Recompute edges whenever nodes, edges, or compact mode changes
  useEffect(() => {
    const frame = requestAnimationFrame(computeEdgePaths);
    return () => cancelAnimationFrame(frame);
  }, [nodes, edges, compact, computeEdgePaths]);

  // Announce focused node to screen readers
  const announceNode = useCallback((node: PhaseGraphNode) => {
    if (announceRef.current) {
      const visualState = getNodeVisualState(node.status, node.is_current, node.dependencies_met);
      const artifactPath = workflowStatus?.workflow_statuses[node.workflow_id]?.artifact_path;
      let text = `${node.label}, Phase ${node.phase_num}, ${visualState}`;
      if (node.agent) text += `, Agent: ${node.agent}`;
      if (artifactPath) text += ', artifact available';
      announceRef.current.textContent = text;
    }
  }, [workflowStatus]);

  // Handle node click dispatch
  const handleNodeClick = useCallback(
    (workflowId: string, visualState: NodeVisualState) => {
      if (!workflowStatus) return;
      const artifactPath = workflowStatus.workflow_statuses[workflowId]?.artifact_path;

      if (visualState === 'complete' && artifactPath) {
        onNodeClick?.(workflowId, visualState, artifactPath);
        return;
      }

      if (visualState === 'complete' && !artifactPath) {
        // No artifact for this completed node — no action
        return;
      }

      if (ACTIONABLE_STATES.has(visualState)) {
        setPopoverNodeId(workflowId);
      }
    },
    [workflowStatus, onNodeClick],
  );

  // Handle node activation from keyboard (Enter/Space)
  const activateNode = useCallback(
    (node: PhaseGraphNode, openArtifactDirectly: boolean = false) => {
      if (!workflowStatus) return;
      const visualState = getNodeVisualState(node.status, node.is_current, node.dependencies_met);
      const artifactPath = workflowStatus.workflow_statuses[node.workflow_id]?.artifact_path;

      if (visualState === 'locked') return;

      if (openArtifactDirectly && visualState === 'complete' && artifactPath) {
        onNodeClick?.(node.workflow_id, visualState, artifactPath);
        return;
      }

      handleNodeClick(node.workflow_id, visualState);
    },
    [workflowStatus, handleNodeClick, onNodeClick],
  );

  // Focus management: Tab entering graph auto-focuses suggested/first node
  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      // Only handle focus entering from outside (not from child elements)
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (!nodes.length) return;

      const filteredNodes = nodes.filter(n => !DEV_LOOP_IDS.has(n.workflow_id));
      if (!filteredNodes.length) return;

      // Find the suggested node or first non-locked node
      let targetNode = filteredNodes.find(
        n => n.workflow_id === workflowStatus?.next_workflow_id,
      );
      if (!targetNode) {
        targetNode = filteredNodes.find(n => {
          const vs = getNodeVisualState(n.status, n.is_current, n.dependencies_met);
          return vs !== 'locked';
        });
      }
      if (!targetNode) targetNode = filteredNodes[0];

      const targetIndex = nodes.indexOf(targetNode);
      setFocusedIndex(targetIndex);
      const el = graphRef.current?.querySelector<HTMLElement>(
        `[data-node-index="${targetIndex}"]`,
      );
      el?.focus();
    },
    [nodes, workflowStatus],
  );

  // Keyboard navigation
  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!nodes.length) return;

      const filteredNodes = nodes.filter(n => !DEV_LOOP_IDS.has(n.workflow_id));
      if (!filteredNodes.length) return;

      let currentFilteredIdx = filteredNodes.findIndex(
        (_, i) => nodes.indexOf(filteredNodes[i]) === focusedIndex,
      );
      if (currentFilteredIdx === -1) currentFilteredIdx = 0;

      const currentNode = filteredNodes[currentFilteredIdx];
      let nextIndex = -1;

      switch (e.key) {
        case 'ArrowRight': {
          const nextPhaseNode = filteredNodes.find(
            n => n.phase_num > currentNode.phase_num,
          );
          if (nextPhaseNode) nextIndex = nodes.indexOf(nextPhaseNode);
          break;
        }
        case 'ArrowLeft': {
          const prevPhaseNodes = filteredNodes.filter(
            n => n.phase_num < currentNode.phase_num,
          );
          if (prevPhaseNodes.length)
            nextIndex = nodes.indexOf(prevPhaseNodes[prevPhaseNodes.length - 1]);
          break;
        }
        case 'ArrowDown': {
          const samePhase = filteredNodes.filter(
            n => n.phase_num === currentNode.phase_num,
          );
          const pos = samePhase.indexOf(currentNode);
          if (pos < samePhase.length - 1) {
            nextIndex = nodes.indexOf(samePhase[pos + 1]);
          }
          break;
        }
        case 'ArrowUp': {
          const samePhase = filteredNodes.filter(
            n => n.phase_num === currentNode.phase_num,
          );
          const pos = samePhase.indexOf(currentNode);
          if (pos > 0) {
            nextIndex = nodes.indexOf(samePhase[pos - 1]);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          activateNode(currentNode, false);
          return;
        }
        case ' ': {
          e.preventDefault();
          // Space directly opens artifact for complete nodes
          activateNode(currentNode, true);
          return;
        }
        case 'i': {
          // Show tooltip — trigger focus on the node to show its tooltip
          e.preventDefault();
          const el = graphRef.current?.querySelector<HTMLElement>(
            `[data-node-index="${focusedIndex}"]`,
          );
          if (el) {
            // Blur and refocus to retrigger tooltip
            el.blur();
            requestAnimationFrame(() => el.focus());
          }
          return;
        }
        default:
          return;
      }

      if (nextIndex >= 0) {
        e.preventDefault();
        setFocusedIndex(nextIndex);
        const el = graphRef.current?.querySelector<HTMLElement>(
          `[data-node-index="${nextIndex}"]`,
        );
        el?.focus();

        // Announce focused node for screen readers
        const nextNode = nodes[nextIndex];
        if (nextNode) announceNode(nextNode);
      }
    },
    [nodes, focusedIndex, activateNode, announceNode],
  );

  // Derive focused node id for aria-activedescendant
  const focusedNodeId = focusedIndex >= 0 && nodes[focusedIndex]
    ? `node-${nodes[focusedIndex].workflow_id}`
    : undefined;

  // Error state
  if (error) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 p-6">
        <p className="text-[length:var(--text-sm)] text-[var(--status-blocked)]">
          {error}
        </p>
        <button
          className="rounded-[var(--radius-md)] border border-border-primary bg-bg-tertiary px-3 py-1.5 text-[length:var(--text-sm)] text-text-primary transition-colors hover:bg-bg-secondary"
          onClick={() => fetchPhaseData()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading / no-data skeleton
  if (loading || !phases || !workflowStatus || !nodes.length) {
    return renderSkeleton();
  }

  // Quick Flow detection
  const isQuickFlow = phases.track === 'quick' || phases.phases.length <= 2;

  if (isQuickFlow) {
    return renderQuickFlow(
      nodes, workflowStatus, compact, focusedIndex, setFocusedIndex,
      handleNodeClick, handleKeydown, handleFocus, focusedNodeId, announceRef,
      popoverNodeId, setPopoverNodeId, onNodeClick,
    );
  }

  const columns = buildColumns(phases, nodes);
  const currentPhaseNum = workflowStatus.current_phase;
  const nodeIndexMap = new Map(nodes.map((n, i) => [n.workflow_id, i]));

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={containerRef} className="w-full p-6">
        <div
          ref={graphRef}
          className={cn(
            'relative grid grid-cols-4 gap-6 rounded-[var(--radius-lg)] border border-border-primary bg-bg-secondary p-6',
            compact && 'gap-4 p-4',
          )}
          role="group"
          aria-label="BMAD phase graph"
          aria-activedescendant={focusedNodeId}
          tabIndex={0}
          onKeyDown={handleKeydown}
          onFocus={handleFocus}
        >
          {columns.map(col => {
            const isCurrent = col.num === currentPhaseNum;
            const label = compact ? (PHASE_ABBR[col.name] ?? col.name) : col.name;
            const regularNodes = col.nodes.filter(
              n => !DEV_LOOP_IDS.has(n.workflow_id),
            );
            const hasDevLoop = col.nodes.some(n =>
              DEV_LOOP_IDS.has(n.workflow_id),
            );

            return (
              <div
                key={col.num}
                className={cn(
                  'flex flex-col items-center gap-6',
                  compact && 'gap-4',
                  isCurrent &&
                    '-m-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--bmad-color-accent)_10%,transparent)] p-2',
                )}
              >
                <span
                  className={cn(
                    'text-center text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-text-secondary',
                    compact && 'text-[10px]',
                  )}
                >
                  {label}
                </span>
                <div
                  className={cn(
                    'flex w-full flex-col items-center gap-6',
                    compact && 'gap-2.5',
                  )}
                >
                  {regularNodes.map(node => {
                    const nodeIndex = nodeIndexMap.get(node.workflow_id) ?? -1;
                    const visualState = getNodeVisualState(
                      node.status,
                      node.is_current,
                      node.dependencies_met,
                    );
                    const artifactPath =
                      workflowStatus.workflow_statuses[node.workflow_id]?.artifact_path;
                    const isSuggested =
                      node.workflow_id === workflowStatus.next_workflow_id;
                    const gates = conditionalGates.get(node.workflow_id);
                    const isPopoverOpen = popoverNodeId === node.workflow_id;
                    const isActionable = ACTIONABLE_STATES.has(visualState);

                    const nodeElement = (
                      <PhaseNode
                        key={node.workflow_id}
                        node={node}
                        visualState={visualState}
                        compact={compact}
                        focused={nodeIndex === focusedIndex}
                        nodeIndex={nodeIndex}
                        artifactPath={artifactPath}
                        isSuggested={isSuggested}
                        onFocus={() => setFocusedIndex(nodeIndex)}
                        onClick={handleNodeClick}
                      />
                    );

                    return (
                      <div key={node.workflow_id} className="flex flex-col items-center gap-2">
                        {isActionable ? (
                          <WorkflowActionPopover
                            node={node}
                            open={isPopoverOpen}
                            onOpenChange={(open) => setPopoverNodeId(open ? node.workflow_id : null)}
                            onViewArtifact={(path) => onNodeClick?.(node.workflow_id, 'complete', path)}
                            artifactPath={artifactPath}
                          >
                            {nodeElement}
                          </WorkflowActionPopover>
                        ) : (
                          nodeElement
                        )}
                        {/* Conditional gates after this node */}
                        {gates?.map(gate => {
                          const parentComplete = workflowStatus.workflow_statuses[node.workflow_id]?.is_complete ?? false;
                          return (
                            <ConditionalGate
                              key={gate.workflowId}
                              label={gate.label}
                              isOpen={parentComplete}
                              compact={compact}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  {hasDevLoop && (
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-border-primary bg-bg-tertiary px-2',
                        compact ? 'h-8 w-[90px] px-1.5' : 'h-10 w-[120px]',
                      )}
                      role="group"
                      aria-label="Development loop: create-story, dev-story, code-review"
                    >
                      <Repeat
                        className={cn(
                          'shrink-0 text-text-secondary',
                          compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
                        )}
                      />
                      <span className="text-[length:var(--text-sm)] text-text-secondary">
                        {compact ? 'Dev' : 'Dev Loop'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* SVG edges overlay */}
          <svg
            ref={svgRef}
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            {edges.map(edge => (
              <path
                key={`${edge.from}-${edge.to}`}
                className={cn(
                  'edge-line fill-none stroke-border-primary stroke-[1.5]',
                  edge.is_optional && 'stroke-dasharray-[4_3]',
                )}
                data-from={edge.from}
                data-to={edge.to}
                d=""
              />
            ))}
          </svg>
        </div>

        {/* Screen reader announcement */}
        <div ref={announceRef} className="sr-only" aria-live="polite" />
      </div>
    </TooltipProvider>
  );
}

function buildColumns(
  phases: PhasesResponse,
  nodes: PhaseGraphNode[],
): PhaseColumn[] {
  return phases.phases.map(phase => ({
    num: phase.phase,
    name: phase.name,
    nodes: nodes.filter(n => n.phase_num === phase.phase),
  }));
}

const QUICK_FLOW_NODE_COLORS = [
  'border-[var(--phase-quickflow-spec)] bg-[var(--phase-quickflow-spec-bg)]',
  'border-[var(--phase-quickflow-dev)] bg-[var(--phase-quickflow-dev-bg)]',
];

function renderQuickFlow(
  nodes: PhaseGraphNode[],
  workflowStatus: import('../../types/workflow').WorkflowStatus,
  compact: boolean,
  focusedIndex: number,
  setFocusedIndex: (idx: number) => void,
  handleNodeClick: (workflowId: string, visualState: NodeVisualState) => void,
  handleKeydown: (e: React.KeyboardEvent) => void,
  handleFocus: (e: React.FocusEvent<HTMLDivElement>) => void,
  focusedNodeId: string | undefined,
  announceRef: React.RefObject<HTMLDivElement | null>,
  popoverNodeId: string | null,
  setPopoverNodeId: (id: string | null) => void,
  onNodeClick?: (workflowId: string, visualState: NodeVisualState, artifactPath?: string | null) => void,
) {
  const nodeIndexMap = new Map(nodes.map((n, i) => [n.workflow_id, i]));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-full justify-center p-6">
        <div
          className="relative flex flex-col items-center gap-6 rounded-[var(--radius-lg)] border border-border-primary bg-bg-secondary p-6"
          role="group"
          aria-label="BMAD quick flow phase graph"
          aria-activedescendant={focusedNodeId}
          tabIndex={0}
          onKeyDown={handleKeydown}
          onFocus={handleFocus}
        >
          <span className="text-center text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-text-secondary">
            Quick Flow
          </span>
          {nodes.map((node, idx) => {
            const nodeIndex = nodeIndexMap.get(node.workflow_id) ?? -1;
            const visualState = getNodeVisualState(
              node.status,
              node.is_current,
              node.dependencies_met,
            );
            const artifactPath =
              workflowStatus.workflow_statuses[node.workflow_id]?.artifact_path;
            const isSuggested =
              node.workflow_id === workflowStatus.next_workflow_id;
            const isPopoverOpen = popoverNodeId === node.workflow_id;
            const isActionable = ACTIONABLE_STATES.has(visualState);

            const nodeElement = (
              <PhaseNode
                node={node}
                visualState={visualState}
                compact={compact}
                focused={nodeIndex === focusedIndex}
                nodeIndex={nodeIndex}
                artifactPath={artifactPath}
                isSuggested={isSuggested}
                onFocus={() => setFocusedIndex(nodeIndex)}
                onClick={handleNodeClick}
              />
            );

            return (
              <div key={node.workflow_id} className="flex flex-col items-center gap-6">
                <div className={cn('rounded-[var(--radius-md)]', QUICK_FLOW_NODE_COLORS[idx])}>
                  {isActionable ? (
                    <WorkflowActionPopover
                      node={node}
                      open={isPopoverOpen}
                      onOpenChange={(open) => setPopoverNodeId(open ? node.workflow_id : null)}
                      onViewArtifact={(path) => onNodeClick?.(node.workflow_id, 'complete', path)}
                      artifactPath={artifactPath}
                    >
                      {nodeElement}
                    </WorkflowActionPopover>
                  ) : (
                    nodeElement
                  )}
                </div>
                {/* Vertical edge between nodes */}
                {idx < nodes.length - 1 && (
                  <div className="h-6 w-px bg-border-primary" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Screen reader announcement */}
      <div ref={announceRef} className="sr-only" aria-live="polite" />
    </TooltipProvider>
  );
}

function renderSkeleton() {
  const skeletonCounts = [2, 3, 3, 3];
  return (
    <div className="w-full p-6">
      <div className="grid grid-cols-4 gap-6 rounded-[var(--radius-lg)] border border-border-primary bg-bg-secondary p-6">
        {skeletonCounts.map((count, i) => (
          <div key={i} className="flex flex-col items-center gap-6">
            <div className="h-3.5 w-[60px] animate-pulse rounded-[var(--radius-sm)] bg-bg-tertiary" />
            {Array.from({ length: count }, (_, j) => (
              <div
                key={j}
                className="h-10 w-[120px] animate-pulse rounded-[var(--radius-md)] bg-bg-tertiary"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
