import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import { pendingToolConfirm, dismissToolForSession } from '../../../state/chat.state.js';
import { sendToolApprove } from '../../../services/chat.service.js';
import { TOOL_HINTS, isDangerousTool } from '../../../types/tool.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import type SlCheckbox from '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';

@customElement('tool-confirm-modal')
export class ToolConfirmModal extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: contents;
    }

    sl-dialog::part(panel) {
      max-width: 480px;
    }

    sl-dialog::part(header) {
      padding-bottom: var(--bmad-spacing-sm);
    }

    sl-dialog::part(body) {
      padding: var(--bmad-spacing-md);
    }

    sl-dialog::part(footer) {
      padding-top: var(--bmad-spacing-sm);
    }

    .tool-info {
      display: flex;
      flex-direction: column;
      gap: var(--bmad-spacing-md);
    }

    .tool-name {
      font-family: var(--bmad-font-family-mono);
      font-size: var(--bmad-font-size-lg);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-text-primary);
    }

    .tool-hint {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-secondary);
      line-height: var(--bmad-line-height-relaxed);
    }

    .tool-explanation {
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      background: var(--bmad-color-bg-tertiary);
      border-radius: var(--bmad-radius-md);
      border-left: 3px solid var(--bmad-color-warning);
    }

    .tool-explanation-label {
      font-size: var(--bmad-font-size-xs);
      font-weight: var(--bmad-font-weight-medium);
      color: var(--bmad-color-warning);
      margin-bottom: var(--bmad-spacing-xs);
    }

    .tool-explanation-text {
      font-size: var(--bmad-font-size-sm);
      color: var(--bmad-color-text-primary);
      font-family: var(--bmad-font-family-mono);
      word-break: break-word;
    }

    .input-preview {
      padding: var(--bmad-spacing-sm) var(--bmad-spacing-md);
      background: var(--bmad-color-bg-primary);
      border: 1px solid var(--bmad-color-border-secondary);
      border-radius: var(--bmad-radius-md);
      font-family: var(--bmad-font-family-mono);
      font-size: var(--bmad-font-size-xs);
      color: var(--bmad-color-text-secondary);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 150px;
      overflow-y: auto;
    }

    .dismiss-option {
      margin-top: var(--bmad-spacing-sm);
    }

    .actions {
      display: flex;
      gap: var(--bmad-spacing-sm);
      justify-content: flex-end;
    }
  `;

  @state() private _dontAskAgain = false;

  private _explainBashCommand(command: string): string {
    const trimmed = command.trim();
    if (trimmed.startsWith('rm ') || trimmed.startsWith('rm\t')) {
      const args = trimmed.slice(3).trim();
      return `Delete files: ${args}`;
    }
    if (trimmed.startsWith('mv ')) {
      return 'Move or rename files';
    }
    if (trimmed.startsWith('cp ')) {
      return 'Copy files';
    }
    if (trimmed.startsWith('chmod ')) {
      return 'Change file permissions';
    }
    if (trimmed.startsWith('chown ')) {
      return 'Change file ownership';
    }
    if (trimmed.includes('sudo')) {
      return 'Run with elevated privileges';
    }
    if (trimmed.includes('>') || trimmed.includes('>>')) {
      return 'Write to file via redirect';
    }
    const preview = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    return `Execute: ${preview}`;
  }

  private _getExplanation(): string | null {
    const pending = pendingToolConfirm.get();
    if (!pending) return null;

    if (pending.toolName === 'bash') {
      const command = pending.input.command as string;
      if (command) {
        return this._explainBashCommand(command);
      }
    }

    if (pending.toolName === 'file_write') {
      const path = pending.input.path as string;
      if (path) {
        return `Write to: ${path}`;
      }
    }

    return null;
  }

  private _handleApprove(): void {
    const pending = pendingToolConfirm.get();
    if (!pending) return;

    if (this._dontAskAgain) {
      dismissToolForSession(pending.toolName);
    }

    sendToolApprove(pending.toolId, true);
    this._dontAskAgain = false;
  }

  private _handleDeny(): void {
    const pending = pendingToolConfirm.get();
    if (!pending) return;

    sendToolApprove(pending.toolId, false);
    this._dontAskAgain = false;
  }

  private _handleRequestClose(e: CustomEvent): void {
    // Prevent closing via ESC or overlay click — user must explicitly approve or deny
    if (e.detail.source === 'overlay' || e.detail.source === 'keyboard') {
      e.preventDefault();
    }
  }

  render() {
    const pending = pendingToolConfirm.get();
    if (!pending) return nothing;

    const hint = TOOL_HINTS[pending.toolName] ?? 'Execute a tool';
    const explanation = this._getExplanation();
    const isDangerous = isDangerousTool(pending.toolName);

    return html`
      <sl-dialog
        label="Tool Confirmation"
        ?open=${true}
        @sl-request-close=${this._handleRequestClose}
      >
        <div class="tool-info">
          <div class="tool-name">${pending.toolName}</div>
          <div class="tool-hint">${hint}</div>

          ${explanation ? html`
            <div class="tool-explanation">
              <div class="tool-explanation-label">This will:</div>
              <div class="tool-explanation-text">${explanation}</div>
            </div>
          ` : nothing}

          <div class="input-preview">${JSON.stringify(pending.input, null, 2)}</div>

          ${isDangerous ? html`
            <sl-checkbox
              class="dismiss-option"
              ?checked=${this._dontAskAgain}
              @sl-change=${(e: Event) => { this._dontAskAgain = (e.target as SlCheckbox).checked; }}
            >
              Don't ask again this session
            </sl-checkbox>
          ` : nothing}
        </div>

        <div class="actions" slot="footer">
          <sl-button variant="default" @click=${this._handleDeny}>Deny</sl-button>
          <sl-button variant="primary" @click=${this._handleApprove}>Approve</sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tool-confirm-modal': ToolConfirmModal;
  }
}
