import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

import './insight-card.js';

import type { Insight, InsightStatus } from '../../../types/insight.js';
import {
  insightsState,
  insightFilters,
  getFilteredInsights,
  type InsightFilters,
} from '../../../state/insight.state.js';
import {
  fetchInsights,
  updateInsight,
  deleteInsight,
} from '../../../services/insight.service.js';
import { projectState } from '../../../state/project.state.js';

@customElement('insight-panel')
export class InsightPanel extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--bmad-color-bg-primary);
      color: var(--bmad-color-text-primary);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-primary);
      background-color: var(--bmad-color-bg-secondary);
    }

    .panel-title {
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-semibold);
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-sm);
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      border-bottom: 1px solid var(--bmad-color-border-secondary);
    }

    .search-row {
      display: flex;
      gap: var(--bmad-spacing-sm);
    }

    .search-row sl-input {
      flex: 1;
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: var(--bmad-spacing-sm);
      flex-wrap: wrap;
    }

    .status-filter {
      display: flex;
      gap: var(--bmad-spacing-xs);
    }

    .filter-chip {
      padding: 2px var(--bmad-spacing-sm);
      font-size: var(--bmad-font-size-xs);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-full);
      background: none;
      color: var(--bmad-color-text-secondary);
      cursor: pointer;
      transition: all var(--bmad-transition-fast);
    }

    .filter-chip:hover {
      background-color: var(--bmad-color-bg-tertiary);
    }

    .filter-chip:focus-visible {
      outline: 2px solid var(--bmad-color-accent);
      outline-offset: 1px;
    }

    .filter-chip[aria-pressed='true'] {
      background-color: var(--bmad-color-accent);
      color: var(--bmad-color-bg-primary);
      border-color: var(--bmad-color-accent);
    }

    .card-list {
      flex: 1;
      overflow-y: auto;
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-sm);
    }

    .empty-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--bmad-spacing-3xl);
      text-align: center;
      color: var(--bmad-color-text-muted);
      font-size: var(--bmad-font-size-md);
    }

    .panel-footer {
      display: flex;
      align-items: center;
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-lg);
      border-top: 1px solid var(--bmad-color-border-primary);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-tertiary);
    }

    sl-select::part(combobox) {
      min-height: 28px;
      font-size: var(--bmad-font-size-xs);
    }
  `;

  @state() private _expandedId: string | null = null;
  private _searchDebounce: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadInsights();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._searchDebounce) {
      clearTimeout(this._searchDebounce);
      this._searchDebounce = null;
    }
  }

  render() {
    const allInsights = insightsState.get();
    const filters = insightFilters.get();
    const filtered = getFilteredInsights();

    const usedCount = allInsights.filter(i => i.status === 'used').length;
    const archivedCount = allInsights.filter(i => i.status === 'archived').length;

    return html`
      <div class="panel-header">
        <span class="panel-title">Insights</span>
        <sl-select
          size="small"
          value=${filters.sortBy}
          @sl-change=${this._handleSortChange}
          aria-label="Sort insights"
        >
          <sl-option value="recency">Recent</sl-option>
          <sl-option value="used_count">Most Used</sl-option>
          <sl-option value="title">Title</sl-option>
        </sl-select>
      </div>

      <div class="controls">
        <div class="search-row">
          <sl-input
            size="small"
            placeholder="Search insights..."
            clearable
            .value=${filters.searchQuery}
            @sl-input=${this._handleSearch}
            @sl-clear=${this._handleSearchClear}
            aria-label="Search insights"
          >
            <span slot="prefix">&#x1F50D;</span>
          </sl-input>
        </div>
        <div class="filter-row">
          <div class="status-filter">
            ${this._renderStatusChip('fresh', filters)}
            ${this._renderStatusChip('used', filters)}
            ${this._renderStatusChip('archived', filters)}
          </div>
        </div>
      </div>

      ${allInsights.length === 0
        ? html`
            <div class="empty-state">
              No Insights yet. Compact a conversation to create your first.
            </div>
          `
        : filtered.length === 0
          ? html`
              <div class="empty-state">No Insights match your filters.</div>
            `
          : html`
              <div class="card-list" role="list">
                ${filtered.map(
                  insight => html`
                    <insight-card
                      .insight=${insight}
                      .expanded=${this._expandedId === insight.id}
                      @click=${() => this._handleCardClick(insight.id)}
                      @insight-inject=${this._handleInsightInject}
                      @insight-update=${this._handleInsightUpdate}
                      @insight-archive=${this._handleInsightArchive}
                      @insight-delete=${this._handleInsightDelete}
                    ></insight-card>
                  `
                )}
              </div>
            `}

      <div class="panel-footer">
        ${allInsights.length > 0
          ? html`${allInsights.length} insight${allInsights.length !== 1 ? 's' : ''}
              &middot; ${usedCount} used &middot; ${archivedCount} archived`
          : nothing}
      </div>
    `;
  }

  private _renderStatusChip(status: InsightStatus, filters: InsightFilters) {
    const isActive = filters.status.includes(status);
    return html`
      <button
        class="filter-chip"
        aria-pressed="${isActive}"
        @click=${() => this._toggleStatusFilter(status)}
      >
        ${status}
      </button>
    `;
  }

  private async _loadInsights(): Promise<void> {
    const project = projectState.get();
    if (!project) return;

    try {
      await fetchInsights(project.projectName);
    } catch (err) {
      console.warn(
        'Failed to load insights:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private _handleSearch(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this._searchDebounce = setTimeout(() => {
      const current = insightFilters.get();
      insightFilters.set({ ...current, searchQuery: value });
    }, 200);
  }

  private _handleSearchClear(): void {
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    const current = insightFilters.get();
    insightFilters.set({ ...current, searchQuery: '' });
  }

  private _handleSortChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value as InsightFilters['sortBy'];
    const current = insightFilters.get();
    insightFilters.set({ ...current, sortBy: value });
  }

  private _toggleStatusFilter(status: InsightStatus): void {
    const current = insightFilters.get();
    const statusList = current.status.includes(status)
      ? current.status.filter(s => s !== status)
      : [...current.status, status];
    insightFilters.set({ ...current, status: statusList });
  }

  private _handleCardClick(insightId: string): void {
    this._expandedId = this._expandedId === insightId ? null : insightId;
  }

  private _handleInsightInject(e: CustomEvent): void {
    // Re-dispatch for parent (story 3-11 will consume this)
    this.dispatchEvent(
      new CustomEvent('insight-inject', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _handleInsightUpdate(e: CustomEvent): Promise<void> {
    const project = projectState.get();
    if (!project) return;

    const updated: Insight = e.detail.insight;
    try {
      await updateInsight(project.projectName, updated);
    } catch (err) {
      console.warn(
        'Failed to update insight:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private async _handleInsightArchive(e: CustomEvent): Promise<void> {
    const project = projectState.get();
    if (!project) return;

    const insightId: string = e.detail.insightId;
    const insights = insightsState.get();
    const insight = insights.find(i => i.id === insightId);
    if (!insight) return;

    const updated: Insight = { ...insight, status: 'archived' };
    try {
      await updateInsight(project.projectName, updated);
    } catch (err) {
      console.warn(
        'Failed to archive insight:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private async _handleInsightDelete(e: CustomEvent): Promise<void> {
    const project = projectState.get();
    if (!project) return;

    const insightId: string = e.detail.insightId;
    try {
      await deleteInsight(project.projectName, insightId);
      if (this._expandedId === insightId) {
        this._expandedId = null;
      }
    } catch (err) {
      console.warn(
        'Failed to delete insight:',
        err instanceof Error ? err.message : err
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'insight-panel': InsightPanel;
  }
}
