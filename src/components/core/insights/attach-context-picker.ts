import { LitElement, html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';

import type { Insight } from '../../../types/insight.js';
import type { FileEntry } from '../../../types/file.js';
import { insightsState } from '../../../state/insight.state.js';
import { fetchProjectFiles, fetchFileContent } from '../../../services/file.service.js';
import { injectContext } from '../../../services/chat.service.js';
import { markInsightUsed } from '../../../services/insight.service.js';

/** Maximum file size for uploads (1 MB). */
const MAX_UPLOAD_SIZE = 1_048_576;

interface SelectedItem {
  type: 'insight' | 'file' | 'upload';
  id: string;
  label: string;
  content: string;
  costPercent: number;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
}

// Lucide x icon
const X_ICON = [
  ['path', { d: 'M18 6 6 18' }],
  ['path', { d: 'm6 6 12 12' }],
] as const;

// Lucide upload icon
const UPLOAD_ICON = [
  ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
  ['polyline', { points: '17 8 12 3 7 8' }],
  ['line', { x1: '12', y1: '3', x2: '12', y2: '15' }],
] as const;

/**
 * Estimate the context cost of a text string as a percentage of the context window.
 * Uses ~4 characters per token as a simple heuristic.
 */
function estimateCostPercent(text: string, contextWindowSize: number): number {
  if (!text || contextWindowSize <= 0) return 0;
  return Math.ceil((text.length / 4) / contextWindowSize * 100);
}

@customElement('attach-context-picker')
export class AttachContextPicker extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: contents;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog {
      background: var(--bmad-color-bg-primary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-lg);
      width: min(600px, 90vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--bmad-shadow-lg);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-primary);
    }

    .dialog-title {
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-text-primary);
    }

    .close-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: none;
      color: var(--bmad-color-text-tertiary);
      cursor: pointer;
      padding: 0;
      transition: all var(--bmad-transition-fast);
    }

    .close-button:hover {
      background-color: var(--bmad-color-bg-tertiary);
      color: var(--bmad-color-text-primary);
    }

    .close-button:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 2px;
    }

    .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
    }

    .icon svg {
      width: 100%;
      height: 100%;
    }

    .icon--lg {
      width: 32px;
      height: 32px;
    }

    /* Tab bar */
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--bmad-color-border-secondary);
      padding: 0 var(--bmad-spacing-lg);
    }

    .tab {
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--bmad-color-text-secondary);
      font-size: var(--bmad-font-size-sm);
      cursor: pointer;
      transition: all var(--bmad-transition-fast);
    }

    .tab:hover {
      color: var(--bmad-color-text-primary);
    }

    .tab:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: -2px;
    }

    .tab[aria-selected='true'] {
      color: var(--bmad-color-accent);
      border-bottom-color: var(--bmad-color-accent);
    }

    /* Content area */
    .tab-content {
      flex: 1;
      overflow-y: auto;
      min-height: 200px;
      max-height: 400px;
    }

    .search-bar {
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-secondary);
    }

    .item-list {
      padding: var(--bmad-spacing-xs) 0;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      cursor: pointer;
      transition: background-color var(--bmad-transition-fast);
    }

    .item:hover {
      background-color: var(--bmad-color-bg-tertiary);
    }

    .item-check {
      width: 18px;
      height: 18px;
      border: 2px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-sm);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--bmad-transition-fast);
    }

    .item-check--selected {
      background-color: var(--bmad-color-accent);
      border-color: var(--bmad-color-accent);
    }

    .item-check--selected::after {
      content: '';
      width: 10px;
      height: 10px;
      background: var(--bmad-color-bg-primary);
      border-radius: 1px;
      clip-path: polygon(20% 50%, 40% 70%, 80% 30%, 85% 35%, 40% 80%, 15% 55%);
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-title {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cost-badge {
      flex-shrink: 0;
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
      background: var(--bmad-color-bg-tertiary);
      padding: 1px var(--bmad-spacing-xs);
      border-radius: var(--bmad-radius-sm);
    }

    .empty-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--bmad-spacing-3xl);
      color: var(--bmad-color-text-muted);
      font-size: var(--bmad-font-size-sm);
      text-align: center;
    }

    /* Upload tab */
    .upload-zone {
      margin: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      padding: var(--bmad-spacing-xl);
      border: 2px dashed var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      text-align: center;
      color: var(--bmad-color-text-muted);
      cursor: pointer;
      transition: all var(--bmad-transition-fast);
    }

    .upload-zone:hover,
    .upload-zone--dragover {
      border-color: var(--bmad-color-accent);
      background-color: color-mix(in srgb, var(--bmad-color-accent) 5%, transparent);
    }

    .upload-zone input[type='file'] {
      display: none;
    }

    .upload-text {
      font-size: var(--bmad-font-size-sm);
      margin-top: var(--bmad-spacing-sm);
    }

    .upload-hint {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
      margin-top: var(--bmad-spacing-xs);
    }

    .uploaded-list {
      padding: 0 var(--bmad-spacing-lg) var(--bmad-spacing-md);
    }

    .uploaded-item {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-xs) 0;
    }

    .uploaded-item .item-info {
      flex: 1;
    }

    .remove-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: var(--bmad-radius-sm);
      background: none;
      color: var(--bmad-color-text-tertiary);
      cursor: pointer;
      padding: 0;
    }

    .remove-button:hover {
      color: var(--bmad-color-error);
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      border-top: 1px solid var(--bmad-color-border-primary);
    }

    .footer-stats {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-md);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
    }

    .warning {
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-warning);
      padding: var(--bmad-spacing-xs) var(--bmad-spacing-sm);
      background: color-mix(in srgb, var(--bmad-color-warning) 10%, transparent);
      border-radius: var(--bmad-radius-sm);
    }

    .footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--bmad-spacing-sm);
    }

    @media (prefers-reduced-motion: reduce) {
      .tab, .item, .close-button, .upload-zone {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) conversationId = '';
  @property({ type: String }) projectId = '';
  @property({ type: Number }) currentContextPercent = 0;
  @property({ type: Number }) contextWindowSize = 200000;
  @property({ type: String }) preSelectedInsightId = '';

  @state() private _activeTab: 'insights' | 'files' | 'upload' = 'insights';
  @state() private _selectedItems: SelectedItem[] = [];
  @state() private _files: FileEntry[] = [];
  @state() private _uploadedFiles: UploadedFile[] = [];
  @state() private _searchQuery = '';
  @state() private _filesLoaded = false;
  @state() private _dragOver = false;

  private _boundKeyHandler = this._handleKeydown.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._boundKeyHandler);
  }

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('open') && this.open) {
      this._reset();
      // Pre-select an Insight if requested
      if (this.preSelectedInsightId) {
        this._activeTab = 'insights';
        const insights = insightsState.get();
        const insight = insights.find(i => i.id === this.preSelectedInsightId);
        if (insight) {
          const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
          this._selectedItems = [{
            type: 'insight',
            id: insight.id,
            label: insight.title,
            content,
            costPercent: estimateCostPercent(content, this.contextWindowSize),
          }];
        }
      }
    }
  }

  private _reset(): void {
    this._selectedItems = [];
    this._uploadedFiles = [];
    this._searchQuery = '';
    this._dragOver = false;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this._close();
    }
  }

  private _close(): void {
    this.open = false;
    this.preSelectedInsightId = '';
    this.dispatchEvent(new CustomEvent('picker-close', { bubbles: true, composed: true }));
  }

  private _handleOverlayClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this._close();
    }
  }

  private _handleTabChange(tab: 'insights' | 'files' | 'upload'): void {
    this._activeTab = tab;
    // Lazy-load files on first tab activation
    if (tab === 'files' && !this._filesLoaded) {
      this._loadFiles();
    }
  }

  private async _loadFiles(): Promise<void> {
    if (!this.projectId) return;
    try {
      this._files = await fetchProjectFiles(this.projectId);
      this._filesLoaded = true;
    } catch (err) {
      console.warn('Failed to load project files:', err instanceof Error ? err.message : err);
      this._files = [];
      this._filesLoaded = true;
    }
  }

  private _isSelected(type: string, id: string): boolean {
    return this._selectedItems.some(s => s.type === type && s.id === id);
  }

  private _toggleInsight(insight: Insight): void {
    if (this._isSelected('insight', insight.id)) {
      this._selectedItems = this._selectedItems.filter(
        s => !(s.type === 'insight' && s.id === insight.id)
      );
    } else {
      const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
      this._selectedItems = [...this._selectedItems, {
        type: 'insight',
        id: insight.id,
        label: insight.title,
        content,
        costPercent: estimateCostPercent(content, this.contextWindowSize),
      }];
    }
  }

  private async _toggleFile(file: FileEntry): Promise<void> {
    if (this._isSelected('file', file.path)) {
      this._selectedItems = this._selectedItems.filter(
        s => !(s.type === 'file' && s.id === file.path)
      );
      return;
    }

    try {
      const content = await fetchFileContent(this.projectId, file.path);
      this._selectedItems = [...this._selectedItems, {
        type: 'file',
        id: file.path,
        label: file.name,
        content,
        costPercent: estimateCostPercent(content, this.contextWindowSize),
      }];
    } catch (err) {
      console.warn('Failed to fetch file content:', err instanceof Error ? err.message : err);
    }
  }

  private _handleFileDrop(e: DragEvent): void {
    e.preventDefault();
    this._dragOver = false;
    const files = e.dataTransfer?.files;
    if (files) {
      this._readUploadedFiles(files);
    }
  }

  private _handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      this._readUploadedFiles(input.files);
    }
    input.value = ''; // reset so same file can be re-selected
  }

  private _readUploadedFiles(files: FileList): void {
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_SIZE) {
        console.warn(`File "${file.name}" exceeds 1MB limit, skipping.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const uploaded: UploadedFile = { name: file.name, content, size: file.size };
        this._uploadedFiles = [...this._uploadedFiles, uploaded];

        // Auto-select the uploaded file
        this._selectedItems = [...this._selectedItems, {
          type: 'upload',
          id: `upload-${file.name}-${Date.now()}`,
          label: file.name,
          content,
          costPercent: estimateCostPercent(content, this.contextWindowSize),
        }];
      };
      reader.readAsText(file);
    }
  }

  private _removeUpload(index: number): void {
    const file = this._uploadedFiles[index];
    if (file) {
      this._selectedItems = this._selectedItems.filter(
        s => !(s.type === 'upload' && s.label === file.name)
      );
      this._uploadedFiles = this._uploadedFiles.filter((_, i) => i !== index);
    }
  }

  private _getTotalCost(): number {
    return this._selectedItems.reduce((sum, item) => sum + item.costPercent, 0);
  }

  private _getProjectedPercent(): number {
    return this.currentContextPercent + this._getTotalCost();
  }

  private async _handleAttach(): Promise<void> {
    const insights = insightsState.get();

    for (const item of this._selectedItems) {
      injectContext(this.conversationId, item.content, item.label);

      // Mark Insights as used
      if (item.type === 'insight') {
        const insight = insights.find(i => i.id === item.id);
        if (insight && this.projectId) {
          try {
            await markInsightUsed(this.projectId, insight);
          } catch (err) {
            console.warn('Failed to mark insight used:', err instanceof Error ? err.message : err);
          }
        }
      }
    }

    this.dispatchEvent(new CustomEvent('context-attached', {
      detail: { itemCount: this._selectedItems.length, totalCost: this._getTotalCost() },
      bubbles: true,
      composed: true,
    }));

    this._close();
  }

  private _getFilteredInsights(): Insight[] {
    const insights = insightsState.get();
    if (!this._searchQuery.trim()) return insights;
    const query = this._searchQuery.toLowerCase().trim();
    return insights.filter(i =>
      i.title.toLowerCase().includes(query) ||
      i.tags.some(t => t.toLowerCase().includes(query)) ||
      i.extracted_idea.toLowerCase().includes(query)
    );
  }

  private _renderIcon(paths: readonly (readonly [string, Record<string, string>])[], cls = 'icon') {
    return html`
      <span class="${cls}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${paths.map(([tag, attrs]) => {
            if (tag === 'path') return svg`<path d=${attrs.d} />`;
            if (tag === 'polyline') return svg`<polyline points=${attrs.points} />`;
            if (tag === 'line') return svg`<line x1=${attrs.x1} y1=${attrs.y1} x2=${attrs.x2} y2=${attrs.y2} />`;
            return nothing;
          })}
        </svg>
      </span>
    `;
  }

  private _renderInsightsTab() {
    const insights = this._getFilteredInsights();

    return html`
      <div class="search-bar">
        <sl-input
          size="small"
          placeholder="Search insights..."
          clearable
          .value=${this._searchQuery}
          @sl-input=${(e: Event) => { this._searchQuery = (e.target as HTMLInputElement).value; }}
          @sl-clear=${() => { this._searchQuery = ''; }}
          aria-label="Search insights"
        ></sl-input>
      </div>
      ${insights.length === 0
        ? html`<div class="empty-tab">No insights found.</div>`
        : html`
          <div class="item-list">
            ${insights.map(insight => {
              const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
              const cost = estimateCostPercent(content, this.contextWindowSize);
              const selected = this._isSelected('insight', insight.id);
              return html`
                <div class="item" @click=${() => this._toggleInsight(insight)}>
                  <div class="item-check ${selected ? 'item-check--selected' : ''}"></div>
                  <div class="item-info">
                    <div class="item-title">${insight.title}</div>
                    <div class="item-meta">${insight.source_agent} &middot; ${insight.tags.slice(0, 3).join(', ')}</div>
                  </div>
                  <span class="cost-badge">+${cost}%</span>
                </div>
              `;
            })}
          </div>
        `
      }
    `;
  }

  private _renderFilesTab() {
    if (!this._filesLoaded) {
      return html`<div class="empty-tab">Loading files...</div>`;
    }
    if (this._files.length === 0) {
      return html`<div class="empty-tab">No project files found.</div>`;
    }

    return html`
      <div class="item-list">
        ${this._files.map(file => {
          // Estimate cost from file size (approximate: 1 byte ~ 1 char)
          const cost = estimateCostPercent('x'.repeat(file.size), this.contextWindowSize);
          const selected = this._isSelected('file', file.path);
          return html`
            <div class="item" @click=${() => this._toggleFile(file)}>
              <div class="item-check ${selected ? 'item-check--selected' : ''}"></div>
              <div class="item-info">
                <div class="item-title">${file.name}</div>
                <div class="item-meta">${file.path}</div>
              </div>
              <span class="cost-badge">~+${cost}%</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderUploadTab() {
    return html`
      <div
        class="upload-zone ${this._dragOver ? 'upload-zone--dragover' : ''}"
        @click=${() => this.shadowRoot?.querySelector<HTMLInputElement>('#file-input')?.click()}
        @dragover=${(e: DragEvent) => { e.preventDefault(); this._dragOver = true; }}
        @dragleave=${() => { this._dragOver = false; }}
        @drop=${this._handleFileDrop}
      >
        <input
          id="file-input"
          type="file"
          multiple
          @change=${this._handleFileSelect}
        />
        ${this._renderIcon(UPLOAD_ICON, 'icon icon--lg')}
        <div class="upload-text">Drop files here or click to browse</div>
        <div class="upload-hint">Text files only. Max 1MB per file.</div>
      </div>
      ${this._uploadedFiles.length > 0 ? html`
        <div class="uploaded-list">
          ${this._uploadedFiles.map((file, idx) => {
            const cost = estimateCostPercent(file.content, this.contextWindowSize);
            return html`
              <div class="uploaded-item">
                <div class="item-info">
                  <div class="item-title">${file.name}</div>
                  <div class="item-meta">${(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <span class="cost-badge">+${cost}%</span>
                <button class="remove-button" @click=${() => this._removeUpload(idx)} aria-label="Remove ${file.name}">
                  ${this._renderIcon(X_ICON)}
                </button>
              </div>
            `;
          })}
        </div>
      ` : nothing}
    `;
  }

  render() {
    if (!this.open) return nothing;

    const totalCost = this._getTotalCost();
    const projected = this._getProjectedPercent();
    const showWarning = projected > 80;

    return html`
      <div class="overlay" @click=${this._handleOverlayClick}>
        <div
          class="dialog"
          role="dialog"
          aria-label="Attach context to conversation"
          aria-modal="true"
        >
          <div class="dialog-header">
            <span class="dialog-title">Attach Context</span>
            <button class="close-button" @click=${this._close} aria-label="Close">
              ${this._renderIcon(X_ICON)}
            </button>
          </div>

          <div class="tab-bar" role="tablist">
            <button
              class="tab"
              role="tab"
              aria-selected="${this._activeTab === 'insights'}"
              @click=${() => this._handleTabChange('insights')}
            >Insights</button>
            <button
              class="tab"
              role="tab"
              aria-selected="${this._activeTab === 'files'}"
              @click=${() => this._handleTabChange('files')}
            >Project Files</button>
            <button
              class="tab"
              role="tab"
              aria-selected="${this._activeTab === 'upload'}"
              @click=${() => this._handleTabChange('upload')}
            >Upload</button>
          </div>

          <div class="tab-content" role="tabpanel">
            ${this._activeTab === 'insights' ? this._renderInsightsTab() : nothing}
            ${this._activeTab === 'files' ? this._renderFilesTab() : nothing}
            ${this._activeTab === 'upload' ? this._renderUploadTab() : nothing}
          </div>

          <div class="dialog-footer">
            <div class="footer-stats">
              <span>${this._selectedItems.length} selected</span>
              <span>&middot;</span>
              <span>+${totalCost}% context</span>
              <span>&middot;</span>
              <span>Current: ${this.currentContextPercent}%</span>
              <span>&middot;</span>
              <span>Projected: ${projected}%</span>
            </div>
            ${showWarning ? html`
              <div class="warning">
                Attaching these items will push context usage above 80%. Consider attaching fewer items.
              </div>
            ` : nothing}
            <div class="footer-actions">
              <sl-button size="small" @click=${this._close}>Cancel</sl-button>
              <sl-button
                size="small"
                variant="primary"
                ?disabled=${this._selectedItems.length === 0}
                @click=${this._handleAttach}
              >Attach (${this._selectedItems.length})</sl-button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'attach-context-picker': AttachContextPicker;
  }
}
