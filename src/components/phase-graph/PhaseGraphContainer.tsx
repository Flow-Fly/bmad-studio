import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { computePhaseGraphNodes, computePhaseGraphEdges, getNodeVisualState } from '../../lib/phase-utils';
import type { PhasesResponse, PhaseGraphNode } from '../../types/phases';
import { PhaseNode } from './PhaseNode';
import { TooltipProvider } from '../ui/tooltip';
import { cn } from '../../lib/utils';

const PHASE_ABBR: Record<string, string> = {
  Analysis: 'Anl',
  Planning: 'Pln',
  Solutioning: 'Sol',
  Implementation: 'Impl',
};

const DEV_LOOP_IDS = new Set(['create-story', 'dev-story', 'code-review']);

interface PhaseColumn {
  num: number;
  name: string;
  nodes: PhaseGraphNode[];
}

// NOTE: Phase graph data sources (phases + workflow status) will be wired
// in Story 4-5 (Phase Graph Rendering). Until then, this component renders
// a skeleton placeholder since there is no data provider.

export function PhaseGraphContainer() {
  const [compact, setCompact] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Placeholder: phases and workflow status will be provided in Story 4-5
  const phases: PhasesResponse | null = null;
  const workflowStatus = null;

  const nodes = useMemo(
    () => computePhaseGraphNodes(phases, workflowStatus),
    [phases, workflowStatus],
  );

  const edges = useMemo(
    () => computePhaseGraphEdges(phases),
    [phases],
  );

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
        case 'Enter':
          e.preventDefault();
          return;
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
      }
    },
    [nodes, focusedIndex],
  );

  // Loading / no-data skeleton (always shown until Story 4-5 wires data)
  if (!phases || !workflowStatus || !nodes.length) {
    return renderSkeleton();
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
          onKeyDown={handleKeydown}
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
                    return (
                      <PhaseNode
                        key={node.workflow_id}
                        node={node}
                        visualState={visualState}
                        compact={compact}
                        focused={nodeIndex === focusedIndex}
                        nodeIndex={nodeIndex}
                        onFocus={() => setFocusedIndex(nodeIndex)}
                      />
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
        <div className="sr-only" aria-live="polite" />
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
