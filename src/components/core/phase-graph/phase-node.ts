import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

import type { PhaseGraphNode, NodeVisualState } from '../../../types/phases.js';
import { formatWorkflowLabel } from '../../../state/phases.state.js';

// Lucide icon SVG element definitions: [tagName, attributes]
const ICONS: Record<string, Array<[string, Record<string, string>]>> = {
  'circle-check': [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm9 12 2 2 4-4' }]],
  'circle-dot': [['circle', { cx: '12', cy: '12', r: '10' }], ['circle', { cx: '12', cy: '12', r: '1' }]],
  circle: [['circle', { cx: '12', cy: '12', r: '10' }]],
  lock: [['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
};

const STATE_ICONS: Record<NodeVisualState, string> = {
  current: 'circle-dot',
  complete: 'circle-check',
  skipped: 'circle-check',
  locked: 'lock',
  conditional: 'circle',
  required: 'circle',
  recommended: 'circle',
  optional: 'circle',
  'not-started': 'circle',
};

@customElement('phase-node')
export class PhaseNode extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

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

    :host(:focus-visible) .node {
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

    .node--locked {
      background-color: var(--bmad-color-bg-tertiary);
      border-color: var(--bmad-color-border-primary);
      opacity: 0.6;
      cursor: not-allowed;
    }
    .node--locked .node-label { color: var(--bmad-color-text-muted); }
    .node--locked .node-icon { color: var(--bmad-color-text-muted); }

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

    /* Compact mode */
    :host([compact]) .node {
      width: 90px;
      height: 32px;
      padding: 0 var(--bmad-spacing-xs);
    }

    :host([compact]) .node-label {
      font-size: var(--bmad-font-size-xs);
    }

    :host([compact]) .node-agent {
      display: none;
    }

    :host([compact]) .node-icon {
      width: 12px;
      height: 12px;
    }

    @media (prefers-reduced-motion: reduce) {
      .node {
        transition: none;
      }

      .node--current {
        box-shadow: none;
      }
    }
  `;

  @property({ type: Object }) node!: PhaseGraphNode;
  @property({ type: String }) visualState: NodeVisualState = 'not-started';
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean }) focused = false;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('focused')) {
      this.tabIndex = this.focused ? 0 : -1;
    }
  }

  render() {
    if (!this.node) return nothing;

    const iconName = STATE_ICONS[this.visualState];
    const labelText = this.compact && this.node.label.length > 10
      ? this.node.label.substring(0, 10)
      : this.node.label;
    const isLocked = this.visualState === 'locked';

    return html`
      <sl-tooltip content="${this._buildTooltipContent()}">
        <div
          class="node node--${this.visualState}"
          role="button"
          aria-label="${this._buildAriaLabel()}"
          aria-disabled="${isLocked || nothing}"
        >
          <span class="node-icon">${this._renderIcon(iconName)}</span>
          <span class="node-label">${labelText}</span>
        </div>
      </sl-tooltip>
    `;
  }

  private _buildTooltipContent(): string {
    const parts = [this.node.label];
    parts.push(`Status: ${this.visualState}`);
    if (this.node.agent) {
      parts.push(`Agent: ${this.node.agent}`);
    }
    if (this.node.purpose) {
      parts.push(`Purpose: ${this.node.purpose}`);
    }
    if (this.visualState === 'locked' && this.node.unmet_dependencies.length > 0) {
      const depNames = this.node.unmet_dependencies.map(id => formatWorkflowLabel(id));
      parts.push(`Blocked by: ${depNames.join(', ')}`);
    }
    return parts.join('\n');
  }

  private _buildAriaLabel(): string {
    const typePart = this.node.is_required ? 'required' : this.node.is_optional ? 'optional' : 'conditional';
    let label = `${this.node.label}, Phase ${this.node.phase_num}, ${typePart}, ${this.visualState}`;
    if (this.visualState === 'locked' && this.node.unmet_dependencies.length > 0) {
      const depNames = this.node.unmet_dependencies.map(id => formatWorkflowLabel(id));
      label += ` — blocked by: ${depNames.join(', ')}`;
    }
    return label;
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
}

declare global {
  interface HTMLElementTagNameMap {
    'phase-node': PhaseNode;
  }
}
