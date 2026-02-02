import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

import {
  phasesState,
  phasesLoadingState,
  phaseGraphNodes$,
  phaseGraphEdges$,
  getNodeVisualState,
} from '../../../state/phases.state.js';
import { workflowState, nextWorkflow$ } from '../../../state/workflow.state.js';
import type { PhasesResponse, PhaseGraphNode, PhaseGraphEdge, NodeVisualState } from '../../../types/phases.js';

// Lucide icon SVG element definitions: [tagName, attributes]
const ICONS: Record<string, Array<[string, Record<string, string>]>> = {
  'circle-check': [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm9 12 2 2 4-4' }]],
  'circle-dot': [['circle', { cx: '12', cy: '12', r: '10' }], ['circle', { cx: '12', cy: '12', r: '1' }]],
  circle: [['circle', { cx: '12', cy: '12', r: '10' }]],
  lock: [['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
  repeat: [['path', { d: 'm17 2 4 4-4 4' }], ['path', { d: 'M3 11v-1a4 4 0 0 1 4-4h14' }], ['path', { d: 'm7 22-4-4 4-4' }], ['path', { d: 'M21 13v1a4 4 0 0 1-4 4H3' }]],
};

const STATE_ICONS: Record<NodeVisualState, string> = {
  current: 'circle-dot',
  complete: 'circle-check',
  skipped: 'circle-check',
  conditional: 'circle',
  required: 'circle',
  recommended: 'circle',
  optional: 'circle',
  'not-started': 'circle',
};

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

    /* Node base */
    .node {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      width: 120px;
      height: 40px;
      padding: 0 var(--bmad-spacing-sm);
      border-radius: var(--bmad-radius-md);
      border: 1px solid var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-tertiary);
      cursor: default;
      transition: border-color var(--bmad-transition-fast),
                  background-color var(--bmad-transition-fast),
                  box-shadow var(--bmad-transition-fast);
      box-sizing: border-box;
      outline: none;
    }

    .node:hover {
      border-color: var(--bmad-color-accent-hover);
    }

    .node:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .node-icon {
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }

    .node-icon svg {
      width: 100%;
      height: 100%;
    }

    .node-label {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .node-agent {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Node visual states */
    .node--current {
      border-color: var(--bmad-color-accent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--bmad-color-accent) 40%, transparent);
    }
    .node--current .node-icon { color: var(--bmad-color-accent); }

    .node--complete {
      background-color: var(--bmad-color-success);
      border-color: var(--bmad-color-success);
    }
    .node--complete .node-label { color: var(--bmad-color-text-primary); }
    .node--complete .node-icon { color: var(--bmad-color-text-primary); }

    .node--skipped {
      background-color: var(--bmad-color-bg-tertiary);
      border-color: var(--bmad-color-border-primary);
    }
    .node--skipped .node-label {
      color: var(--bmad-color-text-muted);
      text-decoration: line-through;
    }
    .node--skipped .node-icon { color: var(--bmad-color-text-muted); }

    .node--conditional {
      border-color: var(--bmad-color-warning);
    }
    .node--conditional .node-icon { color: var(--bmad-color-warning); }

    .node--required {
      border-color: var(--bmad-color-accent);
    }
    .node--required .node-icon { color: var(--bmad-color-accent); }
    .node--required .node-label { color: var(--bmad-color-text-primary); }

    .node--recommended {
      border-style: dashed;
      border-color: var(--bmad-color-accent);
    }
    .node--recommended .node-icon { color: var(--bmad-color-accent); }

    .node--optional {
      border-style: dashed;
      border-color: var(--bmad-color-border-primary);
    }
    .node--optional .node-label { color: var(--bmad-color-text-secondary); }

    .node--not-started {
      border-color: var(--bmad-color-border-primary);
    }
    .node--not-started .node-label { color: var(--bmad-color-text-muted); }
    .node--not-started .node-icon { color: var(--bmad-color-text-muted); }

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

    .dev-loop .node-icon { color: var(--bmad-color-text-secondary); }
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

    .graph.compact .node,
    .graph.compact .dev-loop {
      width: 90px;
      height: 32px;
      padding: 0 var(--bmad-spacing-xs);
    }

    .graph.compact .node-label {
      font-size: var(--bmad-font-size-xs);
    }

    .graph.compact .node-agent {
      display: none;
    }

    .graph.compact .node-icon {
      width: 12px;
      height: 12px;
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
      .node {
        transition: none;
      }

      .node--current {
        box-shadow: none;
      }

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

    return html`
      <div
        class="graph ${this._compact ? 'compact' : ''}"
        role="group"
        aria-label="BMAD phase graph"
        @keydown=${this._handleKeydown}
      >
        ${columns.map(col => this._renderPhaseColumn(col, col.num === currentPhaseNum))}
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

  private _renderPhaseColumn(col: PhaseColumn, isCurrent: boolean) {
    const label = this._compact ? (PHASE_ABBR[col.name] ?? col.name) : col.name;

    const regularNodes = col.nodes.filter(n => !DEV_LOOP_IDS.has(n.workflow_id));
    const hasDevLoop = col.nodes.some(n => DEV_LOOP_IDS.has(n.workflow_id));

    return html`
      <div class="phase-column ${isCurrent ? 'current-phase' : ''}">
        <span class="phase-label">${label}</span>
        <div class="nodes-stack">
          ${regularNodes.map(node => this._renderNode(node))}
          ${hasDevLoop ? this._renderDevLoop() : nothing}
        </div>
      </div>
    `;
  }

  private _renderNode(node: PhaseGraphNode) {
    const allNodes = phaseGraphNodes$.get();
    const nodeIndex = allNodes.indexOf(node);
    const visualState = getNodeVisualState(node.status, node.is_current);
    const iconName = STATE_ICONS[visualState];
    const isFocused = nodeIndex === this._focusedIndex;
    const labelText = this._compact && node.label.length > 10
      ? node.label.substring(0, 10)
      : node.label;
    const ariaLabel = `${node.label}, Phase ${node.phase_num}, ${node.is_required ? 'required' : node.is_optional ? 'optional' : 'conditional'}, ${visualState}`;

    return html`
      <sl-tooltip content="${node.label}${node.agent ? ` (${node.agent})` : ''} — ${visualState}">
        <div
          class="node node--${visualState}"
          role="button"
          tabindex="${isFocused ? 0 : -1}"
          aria-label="${ariaLabel}"
          data-node-index="${nodeIndex}"
          @focus=${() => { this._focusedIndex = nodeIndex; }}
        >
          <span class="node-icon">${this._renderIcon(iconName)}</span>
          <span class="node-label">${labelText}</span>
        </div>
      </sl-tooltip>
    `;
  }

  private _renderDevLoop() {
    return html`
      <div class="dev-loop">
        <span class="node-icon">${this._renderIcon('repeat')}</span>
        <span class="node-label">${this._compact ? 'Dev' : 'Dev Loop'}</span>
      </div>
    `;
  }

  private _renderIcon(name: string) {
    const elements = ICONS[name];
    if (!elements) return nothing;
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${elements.map(([tag, attrs]) => {
          switch (tag) {
            case 'circle': return svg`<circle cx=${attrs.cx} cy=${attrs.cy} r=${attrs.r} />`;
            case 'path': return svg`<path d=${attrs.d} />`;
            case 'rect': return svg`<rect width=${attrs.width} height=${attrs.height} x=${attrs.x} y=${attrs.y} rx=${attrs.rx} ry=${attrs.ry} />`;
            default: return nothing;
          }
        })}
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

  protected updated(): void {
    requestAnimationFrame(() => this._computeEdgePaths());
  }

  private _computeEdgePaths(): void {
    const svgEl = this.renderRoot.querySelector('.edges-overlay') as SVGElement | null;
    if (!svgEl) return;

    const container = this.renderRoot.querySelector('.graph') as HTMLElement | null;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const paths = svgEl.querySelectorAll('path.edge-line');

    for (const pathEl of paths) {
      const fromId = pathEl.getAttribute('data-from');
      const toId = pathEl.getAttribute('data-to');
      if (!fromId || !toId) continue;

      const fromNode = this._findNodeElement(fromId);
      const toNode = this._findNodeElement(toId);
      if (!fromNode || !toNode) continue;

      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();

      const x1 = fromRect.right - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.left - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;

      const dx = Math.abs(x2 - x1) * 0.4;
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      pathEl.setAttribute('d', d);
    }
  }

  private _findNodeElement(workflowId: string): HTMLElement | null {
    const nodes = phaseGraphNodes$.get();
    const index = nodes.findIndex(n => n.workflow_id === workflowId);
    if (index === -1) return null;
    return this.renderRoot.querySelector(`[data-node-index="${index}"]`) as HTMLElement | null;
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
