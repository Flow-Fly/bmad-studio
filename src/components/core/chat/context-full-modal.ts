import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

@customElement('context-full-modal')
export class ContextFullModal extends LitElement {
  static styles = css`
    .dialog-body {
      font-size: var(--bmad-font-size-md);
      color: var(--bmad-color-text-secondary);
      line-height: var(--bmad-line-height-normal);
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--bmad-spacing-sm);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  private _handleRequestClose(e: CustomEvent): void {
    // Prevent closing via overlay click or Escape -- user must choose an action
    e.preventDefault();
  }

  private _compact(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-compact', {
      bubbles: true,
      composed: true,
    }));
  }

  private _discard(): void {
    this.dispatchEvent(new CustomEvent('lifecycle-discard', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <sl-dialog
        label="Context window full"
        ?open=${this.open}
        @sl-request-close=${this._handleRequestClose}
        no-header-close
      >
        <div class="dialog-body">
          The context window is full. You must compact the conversation into an Insight or discard it to continue.
        </div>
        <div slot="footer" class="dialog-footer">
          <sl-button variant="primary" @click=${this._compact}>Compact into Insight</sl-button>
          <sl-button variant="danger" @click=${this._discard}>Discard</sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'context-full-modal': ContextFullModal;
  }
}
