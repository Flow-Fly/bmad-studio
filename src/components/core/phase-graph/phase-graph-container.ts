import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import './phase-node.js';

import {
  phasesState,
  phasesLoadingState,
  phaseGraphNodes$,
  phaseGraphEdges$,
  getNodeVisualState,
} from '../../../state/phases.state.js';
import { workflowState, nextWorkflow$ } from '../../../state/workflow.state.js';
import type { PhasesResponse, PhaseGraphNode, PhaseGraphEdge } from '../../../types/phases.js';

// Lucide repeat icon for dev loop (only icon kept in container)
const REPEAT_ICON: Array<[string, Record<string, string>]> = [
  ['path', { d: 'm17 2 4 4-4 4' }],
  ['path', { d: 'M3 11v-1a4 4 0 0 1 4-4h14' }],
  ['path', { d: 'm7 22-4-4 4-4' }],
  ['path', { d: 'M21 13v1a4 4 0 0 1-4 4H3' }],
];

const PHASE_ABBR: Record<string, string> = {
  Analysis: 'Anl',
  Planning: 'Pln',
  Solutioning: 'Sol',
  Implementation: 'Impl',
};

// Implementation-phase dev loop workflow IDs
const DEV_LOOP_IDS = new Set(['create-story', 'dev-story', 'code-review']);

interface PhaseColumn {
  num: number;
  name: string;
  nodes: PhaseGraphNode[];
}

@customElement('phase-graph-container')
export class PhaseGraphContainer extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      padding: var(--bmad-spacing-lg);
    }

    .graph {
      position: relative;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--bmad-spacing-lg);
      background-color: var(--bmad-color-bg-secondary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-lg);
      padding: var(--bmad-spacing-lg);
    }

    .phase-column {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
      align-items: center;
    }

    .phase-column.current-phase {
      background-color: color-mix(in srgb, var(--bmad-color-accent) 10%, transparent);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-sm);
      margin: calc(-1 * var(--bmad-spacing-sm));
    }

    .phase-label {
      font-size: var(--bmad-font-size-xs);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    }

    .nodes-stack {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
      width: 100%;
      align-items: center;
    }

    /* Dev loop group */
    .dev-loop {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      width: 120px;
      height: 40px;
      padding: 0 var(--bmad-spacing-sm);
      border-radius: var(--bmad-radius-md);
      border: 1px dashed var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-tertiary);
      box-sizing: border-box;
    }

    .dev-loop .node-icon {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
      color: var(--bmad-color-text-secondary);
    }

    .dev-loop .node-icon svg {
      width: 100%;
      height: 100%;
    }

    .dev-loop .node-label {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
    }

    /* SVG edges overlay */
    .edges-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }

    .edge-line {
      fill: none;
      stroke: var(--bmad-color-border-primary);
      stroke-width: 1.5;
    }

    .edge-line--optional {
      stroke-dasharray: 4 3;
    }

    /* Skeleton */
    .skeleton-layout {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--bmad-spacing-lg);
      background-color: var(--bmad-color-bg-secondary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-lg);
      padding: var(--bmad-spacing-lg);
    }

    .skeleton-column {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
      align-items: center;
    }

    .skeleton-label {
      width: 60px;
      height: 14px;
      background-color: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-sm);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }

    .skeleton-node {
      width: 120px;
      height: 40px;
      background-color: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-md);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }

    /* Error */
    .error-state {
      text-align: center;
      padding: var(--bmad-spacing-3xl) var(--bmad-spacing-lg);
      color: var(--bmad-color-error);
      font-size: var(--bmad-font-size-md);
    }

    /* Compact mode */
    .graph.compact {
      gap: var(--bmad-spacing-md);
      padding: var(--bmad-spacing-md);
    }

    .graph.compact .phase-label {
      font-size: 10px;
    }

    .graph.compact .nodes-stack {
      gap: 10px;
    }

    .graph.compact .dev-loop {
      width: 90px;
      height: 32px;
      padding: 0 var(--bmad-spacing-xs);
    }

    .graph.compact .skeleton-node {
      width: 90px;
      height: 32px;
    }

    /* aria-live region */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-label,
      .skeleton-node {
        animation: none;
        opacity: 0.6;
      }
    }
  `;

  @state() private _compact = false;
  @state() private _focusedIndex = -1;

  private _resizeObserver: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this._compact = entry.contentRect.width < 1280;
      }
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  render() {
    const loading = phasesLoadingState.get();
    const phases = phasesState.get();
    const ws = workflowState.get();

    if (loading.status === 'error') {
      return html`<div class="error-state">${loading.error ?? 'Failed to load phases'}</div>`;
    }

    if (!phases || !ws) {
      return this._renderSkeleton();
    }

    const nodes = phaseGraphNodes$.get();
    const edges = phaseGraphEdges$.get();
    if (!nodes.length) return this._renderSkeleton();

    const columns = this._buildColumns(phases, nodes);
    const currentPhaseNum = ws.current_phase;
    const nodeIndexMap = new Map(nodes.map((n, i) => [n.workflow_id, i]));

    return html`
      <div
        class="graph ${this._compact ? 'compact' : ''}"
        role="group"
        aria-label="BMAD phase graph"
        @keydown=${this._handleKeydown}
      >
        ${columns.map(col => this._renderPhaseColumn(col, col.num === currentPhaseNum, nodeIndexMap))}
        <svg class="edges-overlay" aria-hidden="true">
          ${this._renderEdges(edges)}
        </svg>
      </div>
      <div class="sr-only" aria-live="polite" id="phase-graph-announce">
        ${this._getAnnouncement()}
      </div>
    `;
  }

  private _buildColumns(phases: PhasesResponse, nodes: PhaseGraphNode[]): PhaseColumn[] {
    return phases.phases.map(phase => ({
      num: phase.phase,
      name: phase.name,
      nodes: nodes.filter(n => n.phase_num === phase.phase),
    }));
  }

  private _renderPhaseColumn(col: PhaseColumn, isCurrent: boolean, nodeIndexMap: Map<string, number>) {
    const label = this._compact ? (PHASE_ABBR[col.name] ?? col.name) : col.name;

    const regularNodes = col.nodes.filter(n => !DEV_LOOP_IDS.has(n.workflow_id));
    const hasDevLoop = col.nodes.some(n => DEV_LOOP_IDS.has(n.workflow_id));

    return html`
      <div class="phase-column ${isCurrent ? 'current-phase' : ''}">
        <span class="phase-label">${label}</span>
        <div class="nodes-stack">
          ${regularNodes.map(node => {
            const nodeIndex = nodeIndexMap.get(node.workflow_id) ?? -1;
            const visualState = getNodeVisualState(node.status, node.is_current, node.dependencies_met);
            const isFocused = nodeIndex === this._focusedIndex;
            return html`
              <phase-node
                .node=${node}
                .visualState=${visualState}
                ?compact=${this._compact}
                .focused=${isFocused}
                data-node-index="${nodeIndex}"
                data-workflow-id="${node.workflow_id}"
                @focus=${() => { this._focusedIndex = nodeIndex; }}
              ></phase-node>
            `;
          })}
          ${hasDevLoop ? this._renderDevLoop() : nothing}
        </div>
      </div>
    `;
  }

  private _renderDevLoop() {
    return html`
      <div class="dev-loop" role="group" aria-label="Development loop: create-story, dev-story, code-review">
        <span class="node-icon">${this._renderRepeatIcon()}</span>
        <span class="node-label">${this._compact ? 'Dev' : 'Dev Loop'}</span>
      </div>
    `;
  }

  private _renderRepeatIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${REPEAT_ICON.map(([, attrs]) => svg`<path d=${attrs.d} />`)}
      </svg>
    `;
  }

  private _renderEdges(edges: PhaseGraphEdge[]) {
    // Placeholder paths — actual d attributes computed in _computeEdgePaths via updated()
    return edges.map(edge => svg`
      <path
        class="edge-line ${edge.is_optional ? 'edge-line--optional' : ''}"
        data-from=${edge.from}
        data-to=${edge.to}
        d=""
      />
    `);
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.size === 1 && changedProperties.has('_focusedIndex')) return;
    requestAnimationFrame(() => this._computeEdgePaths());
  }

  private _computeEdgePaths(): void {
    const svgEl = this.renderRoot.querySelector('.edges-overlay') as SVGElement | null;
    if (!svgEl) return;

    const container = this.renderRoot.querySelector('.graph') as HTMLElement | null;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Pre-build element map for O(1) lookups
    const nodeElements = new Map<string, HTMLElement>();
    for (const el of this.renderRoot.querySelectorAll<HTMLElement>('[data-workflow-id]')) {
      const id = el.dataset.workflowId;
      if (id) nodeElements.set(id, el);
    }

    const paths = svgEl.querySelectorAll('path.edge-line');

    for (const pathEl of paths) {
      const fromId = pathEl.getAttribute('data-from');
      const toId = pathEl.getAttribute('data-to');
      if (!fromId || !toId) continue;

      const fromNode = nodeElements.get(fromId);
      const toNode = nodeElements.get(toId);
      if (!fromNode || !toNode) continue;

      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();

      // Detect same-column (within-phase) vs cross-column edges
      const fromCenterX = fromRect.left + fromRect.width / 2;
      const toCenterX = toRect.left + toRect.width / 2;
      const sameColumn = Math.abs(fromCenterX - toCenterX) < fromRect.width;

      let d: string;
      if (sameColumn) {
        // Vertical: bottom of source to top of target
        const x1 = fromCenterX - containerRect.left;
        const y1 = fromRect.bottom - containerRect.top;
        const x2 = toCenterX - containerRect.left;
        const y2 = toRect.top - containerRect.top;
        const dy = Math.abs(y2 - y1) * 0.4;
        d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
      } else {
        // Horizontal: right of source to left of target
        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;
        const dx = Math.abs(x2 - x1) * 0.4;
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      }

      pathEl.setAttribute('d', d);
    }
  }

  private _handleKeydown(e: KeyboardEvent): void {
    const nodes = phaseGraphNodes$.get();
    if (!nodes.length) return;

    const filteredNodes = nodes.filter(n => !DEV_LOOP_IDS.has(n.workflow_id));
    if (!filteredNodes.length) return;

    let currentFilteredIdx = filteredNodes.findIndex(
      (_, i) => nodes.indexOf(filteredNodes[i]) === this._focusedIndex,
    );
    if (currentFilteredIdx === -1) currentFilteredIdx = 0;

    const currentNode = filteredNodes[currentFilteredIdx];
    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight': {
        const nextPhaseNode = filteredNodes.find(n => n.phase_num > currentNode.phase_num);
        if (nextPhaseNode) nextIndex = nodes.indexOf(nextPhaseNode);
        break;
      }
      case 'ArrowLeft': {
        const prevPhaseNodes = filteredNodes.filter(n => n.phase_num < currentNode.phase_num);
        if (prevPhaseNodes.length) nextIndex = nodes.indexOf(prevPhaseNodes[prevPhaseNodes.length - 1]);
        break;
      }
      case 'ArrowDown': {
        const samePhase = filteredNodes.filter(n => n.phase_num === currentNode.phase_num);
        const pos = samePhase.indexOf(currentNode);
        if (pos < samePhase.length - 1) {
          nextIndex = nodes.indexOf(samePhase[pos + 1]);
        }
        break;
      }
      case 'ArrowUp': {
        const samePhase = filteredNodes.filter(n => n.phase_num === currentNode.phase_num);
        const pos = samePhase.indexOf(currentNode);
        if (pos > 0) {
          nextIndex = nodes.indexOf(samePhase[pos - 1]);
        }
        break;
      }
      case 'Enter':
        // No-op for now — Epic 5 wires click handler
        e.preventDefault();
        return;
      default:
        return;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      this._focusedIndex = nextIndex;
      const el = this.renderRoot.querySelector(`[data-node-index="${nextIndex}"]`) as HTMLElement;
      el?.focus();
    }
  }

  private _getAnnouncement(): string {
    const next = nextWorkflow$.get();
    if (!next) return '';
    return `Current workflow: ${next.id}`;
  }

  private _renderSkeleton() {
    const skeletonCounts = [2, 3, 3, 3];
    return html`
      <div class="skeleton-layout">
        ${skeletonCounts.map(count => html`
          <div class="skeleton-column">
            <div class="skeleton-label"></div>
            ${Array.from({ length: count }, () => html`
              <div class="skeleton-node"></div>
            `)}
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'phase-graph-container': PhaseGraphContainer;
  }
}
