import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/components/tag/tag.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';

import '../../shared/markdown-renderer.js';

import type { Insight } from '../../../types/insight.js';

@customElement('insight-card')
export class InsightCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background-color: var(--bmad-color-bg-elevated);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-md);
      cursor: pointer;
      transition: background-color var(--bmad-transition-fast);
    }

    .card:hover {
      background-color: var(--bmad-color-bg-tertiary);
    }

    .card:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    :host([archived]) .card {
      opacity: 0.5;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: var(--bmad-spacing-sm);
    }

    .status-dot {
      flex-shrink: 0;
      width: 10px;
      height: 10px;
      border-radius: var(--bmad-radius-full);
      margin-top: 4px;
    }

    .status-dot--fresh {
      background-color: var(--bmad-color-accent);
    }

    .status-dot--used {
      background: linear-gradient(
        to bottom,
        var(--bmad-color-accent) 50%,
        transparent 50%
      );
      border: 1px solid var(--bmad-color-accent);
    }

    .status-dot--archived {
      background-color: var(--bmad-color-text-muted);
    }

    .card-content {
      flex: 1;
      min-width: 0;
    }

    .title {
      font-size: var(--bmad-font-size-md);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      margin-top: var(--bmad-spacing-xs);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
    }

    .meta-separator {
      color: var(--bmad-color-text-muted);
    }

    .used-badge {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-warning);
      font-weight: var(--bmad-font-weight-medium);
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--bmad-spacing-xs);
      margin-top: var(--bmad-spacing-xs);
    }

    .preview {
      margin-top: var(--bmad-spacing-sm);
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: var(--bmad-line-height-normal);
    }

    /* Expanded view */
    .expanded-content {
      margin-top: var(--bmad-spacing-md);
      padding-top: var(--bmad-spacing-md);
      border-top: 1px solid var(--bmad-color-border-secondary);
    }

    .section-label {
      font-size: var(--bmad-font-size-xs);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--bmad-spacing-xs);
    }

    .section-content {
      margin-bottom: var(--bmad-spacing-md);
    }

    .highlight-colors {
      display: flex;
      gap: var(--bmad-spacing-xs);
      margin-bottom: var(--bmad-spacing-md);
    }

    .highlight-dot {
      width: 12px;
      height: 12px;
      border-radius: var(--bmad-radius-full);
      border: 1px solid var(--bmad-color-border-primary);
    }

    .actions {
      display: flex;
      gap: var(--bmad-spacing-sm);
      margin-top: var(--bmad-spacing-md);
      padding-top: var(--bmad-spacing-sm);
      border-top: 1px solid var(--bmad-color-border-secondary);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--bmad-spacing-xs);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
      background: none;
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-sm);
      cursor: pointer;
      transition: all var(--bmad-transition-fast);
    }

    .action-btn:hover {
      background-color: var(--bmad-color-bg-tertiary);
      color: var(--bmad-color-text-primary);
    }

    .action-btn:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 1px;
    }

    .action-btn--danger:hover {
      color: var(--bmad-color-error);
      border-color: var(--bmad-color-error);
    }

    .tag-edit {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--bmad-spacing-xs);
    }

    .tag-remove {
      cursor: pointer;
    }

    sl-input::part(base) {
      min-height: 24px;
      font-size: var(--bmad-font-size-xs);
    }
  `;

  @property({ type: Object }) insight!: Insight;
  @property({ type: Boolean, reflect: true }) expanded = false;
  @state() private _editingTags = false;
  @state() private _newTag = '';

  render() {
    const insight = this.insight;
    if (!insight) return nothing;

    const isArchived = insight.status === 'archived';
    if (isArchived) {
      this.setAttribute('archived', '');
    } else {
      this.removeAttribute('archived');
    }

    return html`
      <div
        class="card"
        role="listitem"
        tabindex="0"
        aria-expanded="${this.expanded}"
        aria-label="${insight.title}"
        @click=${this._toggleExpand}
        @keydown=${this._handleKeydown}
      >
        <div class="card-header">
          <span class="status-dot status-dot--${insight.status}" aria-hidden="true"></span>
          <div class="card-content">
            <p class="title">${insight.title}</p>
            <div class="meta">
              <span>${insight.source_agent}</span>
              <span class="meta-separator">&middot;</span>
              <span>${this._formatDate(insight.created_at)}</span>
              ${insight.status === 'used'
                ? html`
                    <span class="meta-separator">&middot;</span>
                    <span class="used-badge">USED (${insight.used_in_count})</span>
                  `
                : nothing}
            </div>
            ${insight.tags.length > 0
              ? html`
                  <div class="tags">
                    ${insight.tags.map(
                      tag => html`<sl-tag size="small" variant="neutral">${tag}</sl-tag>`
                    )}
                  </div>
                `
              : nothing}
            ${!this.expanded
              ? html`
                  <div class="preview">
                    ${insight.extracted_idea || insight.origin_context || 'No content'}
                  </div>
                `
              : nothing}
          </div>
        </div>

        ${this.expanded ? this._renderExpanded() : nothing}
      </div>
    `;
  }

  private _renderExpanded() {
    const insight = this.insight;
    return html`
      <div class="expanded-content" @click=${(e: Event) => e.stopPropagation()}>
        ${insight.origin_context
          ? html`
              <div class="section-label">Origin Context</div>
              <div class="section-content">
                <markdown-renderer .content=${insight.origin_context}></markdown-renderer>
              </div>
            `
          : nothing}

        ${insight.extracted_idea
          ? html`
              <div class="section-label">Extracted Idea</div>
              <div class="section-content">
                <markdown-renderer .content=${insight.extracted_idea}></markdown-renderer>
              </div>
            `
          : nothing}

        <div class="section-label">Tags</div>
        <div class="section-content">
          <div class="tag-edit">
            ${insight.tags.map(
              tag => html`
                <sl-tag
                  size="small"
                  variant="neutral"
                  removable
                  @sl-remove=${() => this._removeTag(tag)}
                >
                  ${tag}
                </sl-tag>
              `
            )}
            ${this._editingTags
              ? html`
                  <sl-input
                    size="small"
                    placeholder="Add tag..."
                    .value=${this._newTag}
                    @sl-input=${(e: Event) => {
                      this._newTag = (e.target as HTMLInputElement).value;
                    }}
                    @keydown=${this._handleTagKeydown}
                    @sl-blur=${() => {
                      this._editingTags = false;
                      this._newTag = '';
                    }}
                  ></sl-input>
                `
              : html`
                  <button
                    class="action-btn"
                    @click=${() => {
                      this._editingTags = true;
                    }}
                    aria-label="Add tag"
                  >
                    + Tag
                  </button>
                `}
          </div>
        </div>

        ${insight.highlight_colors_used.length > 0
          ? html`
              <div class="section-label">Highlight Colors Used</div>
              <div class="highlight-colors">
                ${insight.highlight_colors_used.map(
                  color =>
                    html`<span
                      class="highlight-dot"
                      style="background-color: ${color}"
                      aria-label="Highlight color ${color}"
                    ></span>`
                )}
              </div>
            `
          : nothing}

        <div class="actions">
          <button
            class="action-btn"
            @click=${this._handleInject}
            aria-label="Inject insight into conversation"
          >
            Inject
          </button>
          <button
            class="action-btn"
            @click=${this._handleArchive}
            aria-label="${insight.status === 'archived' ? 'Unarchive insight' : 'Archive insight'}"
          >
            ${insight.status === 'archived' ? 'Unarchive' : 'Archive'}
          </button>
          <button
            class="action-btn action-btn--danger"
            @click=${this._handleDelete}
            aria-label="Delete insight"
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }

  private _toggleExpand(): void {
    this.expanded = !this.expanded;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._toggleExpand();
    }
  }

  private _handleTagKeydown(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Enter' && this._newTag.trim()) {
      const newTags = [...this.insight.tags, this._newTag.trim()];
      this._newTag = '';
      this._editingTags = false;
      this._dispatchUpdate({ ...this.insight, tags: newTags });
    }
    if (e.key === 'Escape') {
      this._editingTags = false;
      this._newTag = '';
    }
  }

  private _removeTag(tag: string): void {
    const newTags = this.insight.tags.filter(t => t !== tag);
    this._dispatchUpdate({ ...this.insight, tags: newTags });
  }

  private _handleInject(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('insight-inject', {
        detail: { insightId: this.insight.id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleArchive(e: Event): void {
    e.stopPropagation();
    if (this.insight.status === 'archived') {
      this._dispatchUpdate({ ...this.insight, status: 'fresh' });
    } else {
      this.dispatchEvent(
        new CustomEvent('insight-archive', {
          detail: { insightId: this.insight.id },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleDelete(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('insight-delete', {
        detail: { insightId: this.insight.id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _dispatchUpdate(updated: Insight): void {
    this.dispatchEvent(
      new CustomEvent('insight-update', {
        detail: { insight: updated },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _formatDate(isoDate: string): string {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'insight-card': InsightCard;
  }
}
