import { LitElement, html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

import {
  workflowState,
  workflowLoadingState,
  currentPhase$,
  phaseCompletions$,
  nextWorkflow$,
} from '../../../state/workflow.state.js';
import type {
  PhaseCompletionStatus,
  WorkflowCompletionStatus,
  WorkflowStatusValue,
} from '../../../types/workflow.js';

const STATUS_BADGE_VARIANT: Record<string, string> = {
  complete: 'success',
  required: 'primary',
  not_started: 'neutral',
  optional: 'neutral',
  skipped: 'neutral',
  recommended: 'primary',
};

const STATUS_LABELS: Record<string, string> = {
  complete: 'Complete',
  required: 'Required',
  not_started: 'Not Started',
  optional: 'Optional',
  skipped: 'Skipped',
  recommended: 'Recommended',
};

@customElement('workflow-status-display')
export class WorkflowStatusDisplay extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      padding: var(--bmad-spacing-xl);
    }

    .status-summary {
      background-color: var(--bmad-color-bg-secondary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-lg);
      margin-bottom: var(--bmad-spacing-xl);
    }

    .summary-title {
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-semibold);
      color: var(--bmad-color-accent);
      margin: 0 0 var(--bmad-spacing-sm) 0;
    }

    .summary-detail {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-secondary);
      margin: 0;
      line-height: var(--bmad-line-height-normal);
    }

    .summary-detail + .summary-detail {
      margin-top: var(--bmad-spacing-xs);
    }

    .next-workflow {
      color: var(--bmad-color-text-primary);
      font-weight: var(--bmad-font-weight-medium);
    }

    .phases-section {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
    }

    .phase-row {
      background-color: var(--bmad-color-bg-secondary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-md) var(--bmad-spacing-lg);
      transition: border-color var(--bmad-transition-fast);
    }

    .phase-row.current {
      border-color: var(--bmad-color-accent);
    }

    .phase-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--bmad-spacing-sm);
    }

    .phase-name {
      font-size: var(--bmad-font-size-md);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-primary);
    }

    .phase-count {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
    }

    sl-progress-bar {
      --height: 6px;
      margin-bottom: var(--bmad-spacing-md);
    }

    .workflow-list {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-xs);
    }

    .workflow-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--bmad-spacing-xs) 0;
    }

    .workflow-name {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--bmad-spacing-3xl) var(--bmad-spacing-lg);
    }

    .empty-state p {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-secondary);
      margin: 0;
      line-height: var(--bmad-line-height-relaxed);
    }

    /* Loading skeleton */
    .skeleton-layout {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-lg);
    }

    .skeleton-card {
      background-color: var(--bmad-color-bg-secondary);
      border: 1px solid var(--bmad-color-border-primary);
      border-radius: var(--bmad-radius-md);
      padding: var(--bmad-spacing-lg);
    }

    .skeleton-line {
      height: 14px;
      background-color: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-sm);
      margin-bottom: var(--bmad-spacing-sm);
    }

    .skeleton-line.short {
      width: 40%;
    }

    .skeleton-line.medium {
      width: 65%;
    }

    .skeleton-line.full {
      width: 100%;
      height: 6px;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }

    .skeleton-card {
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }

    /* Error state */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--bmad-spacing-3xl) var(--bmad-spacing-lg);
    }

    .error-state p {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-error);
      margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-card {
        animation: none;
        opacity: 0.6;
      }

      .phase-row {
        transition: none;
      }
    }
  `;

  render() {
    const loading = workflowLoadingState.get();
    const status = workflowState.get();

    if (loading.status === 'loading') {
      return this._renderSkeleton();
    }

    if (loading.status === 'error') {
      return this._renderError(loading.error ?? 'Unknown error');
    }

    if (!status) {
      return this._renderEmpty();
    }

    return this._renderLoaded();
  }

  private _renderEmpty() {
    return html`
      <div class="empty-state">
        <p>No workflow status available — run a BMAD workflow to begin tracking progress</p>
      </div>
    `;
  }

  private _renderSkeleton() {
    return html`
      <div class="skeleton-layout">
        <div class="skeleton-card">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line medium"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line medium"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line medium"></div>
        </div>
      </div>
    `;
  }

  private _renderError(message: string) {
    return html`
      <div class="error-state">
        <p>${message}</p>
      </div>
    `;
  }

  private _renderLoaded() {
    const phase = currentPhase$.get();
    const phases = phaseCompletions$.get();
    const next = nextWorkflow$.get();
    const status = workflowState.get()!;

    return html`
      <div class="status-summary">
        <p class="summary-title">
          Phase ${phase?.num ?? '?'} of ${phases.length} — ${phase?.name ?? 'Unknown'}
        </p>
        ${next ? html`
          <p class="summary-detail">
            Next: <span class="next-workflow">${next.id}</span> (${next.agent})
          </p>
        ` : html`
          <p class="summary-detail">All workflows complete</p>
        `}
      </div>

      <div class="phases-section">
        ${phases.map(p => this._renderPhaseRow(p, p.phase_num === phase?.num, status))}
      </div>
    `;
  }

  private _renderPhaseRow(
    phase: PhaseCompletionStatus,
    isCurrent: boolean,
    status: { workflow_statuses: Record<string, WorkflowCompletionStatus> },
  ) {
    const phaseWorkflows = this._getWorkflowsForPhase(phase, status.workflow_statuses);

    return html`
      <div class="phase-row ${isCurrent ? 'current' : ''}">
        <div class="phase-header">
          <span class="phase-name">${phase.name}</span>
          <span class="phase-count">${phase.completed_count}/${phase.total_required}</span>
        </div>
        <sl-progress-bar value=${phase.percent_complete}></sl-progress-bar>
        ${phaseWorkflows.length > 0 ? html`
          <div class="workflow-list">
            ${phaseWorkflows.map(w => this._renderWorkflowItem(w))}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderWorkflowItem(workflow: WorkflowCompletionStatus) {
    const variant = STATUS_BADGE_VARIANT[workflow.status] ?? 'neutral';
    const label = STATUS_LABELS[workflow.status] ?? workflow.status;

    return html`
      <div class="workflow-item">
        <span class="workflow-name">${workflow.workflow_id}</span>
        <sl-tooltip content="${label}${workflow.artifact_path ? ` — ${workflow.artifact_path}` : ''}">
          <sl-badge variant=${variant}>${label}</sl-badge>
        </sl-tooltip>
      </div>
    `;
  }

  /**
   * Groups workflows by phase. Since the API doesn't provide a direct phase→workflow mapping,
   * we distribute workflows across phases based on phase order. This is a simplified approach
   * that works for the current BMAD workflow structure.
   *
   * The backend's phase_completion already gives us counts, so the visual grouping here
   * distributes all known workflow_statuses into phase buckets by index allocation.
   */
  private _getWorkflowsForPhase(
    phase: PhaseCompletionStatus,
    allWorkflows: Record<string, WorkflowCompletionStatus>,
  ): WorkflowCompletionStatus[] {
    // The API response includes all workflows in a flat map.
    // Without explicit phase→workflow mapping from the backend, we show all
    // workflows in the first phase that has capacity. For MVP, showing all
    // workflows under their completion status is sufficient — Stories 2.3/2.4
    // will implement the proper phase graph with correct grouping.
    //
    // For now, show all workflows under the first phase only to avoid duplication.
    const allValues = Object.values(allWorkflows);
    if (phase.phase_num === 1) {
      return allValues;
    }
    return [];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workflow-status-display': WorkflowStatusDisplay;
  }
}
