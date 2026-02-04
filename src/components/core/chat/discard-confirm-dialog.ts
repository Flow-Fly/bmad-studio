import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

@customElement('discard-confirm-dialog')
export class DiscardConfirmDialog extends LitElement {
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
    // Allow all close methods (overlay, escape, close button)
    e.stopPropagation();
    this._cancel();
  }

  private _cancel(): void {
    this.dispatchEvent(new CustomEvent('discard-cancelled', {
      bubbles: true,
      composed: true,
    }));
  }

  private _confirm(): void {
    this.dispatchEvent(new CustomEvent('discard-confirmed', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <sl-dialog
        label="Discard conversation?"
        ?open=${this.open}
        @sl-request-close=${this._handleRequestClose}
      >
        <div class="dialog-body">
          This cannot be undone. The conversation and all highlights will be permanently deleted.
        </div>
        <div slot="footer" class="dialog-footer">
          <sl-button variant="default" @click=${this._cancel}>Cancel</sl-button>
          <sl-button variant="danger" @click=${this._confirm}>Discard</sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'discard-confirm-dialog': DiscardConfirmDialog;
  }
}
