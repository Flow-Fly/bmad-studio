import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/tool-confirm-modal.ts';
import {
  pendingToolConfirm,
  sessionDismissedTools,
  clearPendingConfirm,
} from '../../../src/state/chat.state.ts';
import type { PendingToolConfirm } from '../../../src/types/tool.ts';

const makePendingConfirm = (overrides: Partial<PendingToolConfirm> = {}): PendingToolConfirm => ({
  conversationId: 'conv-1',
  messageId: 'msg-1',
  toolId: 'tool-1',
  toolName: 'bash',
  input: { command: 'ls -la' },
  ...overrides,
});

describe('ToolConfirmModal', () => {
  beforeEach(() => {
    clearPendingConfirm();
    sessionDismissedTools.set(new Set());
  });

  afterEach(() => {
    clearPendingConfirm();
    sessionDismissedTools.set(new Set());
  });

  it('renders nothing when pendingToolConfirm is null', async () => {
    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.be.null;
  });

  it('opens dialog when pendingToolConfirm is set', async () => {
    pendingToolConfirm.set(makePendingConfirm());

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('sl-dialog');
    expect(dialog).to.exist;
    expect(dialog!.hasAttribute('open')).to.be.true;
  });

  it('displays tool name', async () => {
    pendingToolConfirm.set(makePendingConfirm({ toolName: 'file_write' }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const toolName = el.shadowRoot!.querySelector('.tool-name');
    expect(toolName!.textContent).to.equal('file_write');
  });

  it('displays tool hint', async () => {
    pendingToolConfirm.set(makePendingConfirm({ toolName: 'bash' }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const hint = el.shadowRoot!.querySelector('.tool-hint');
    expect(hint!.textContent).to.contain('shell command');
  });

  it('displays input preview as JSON', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      input: { path: '/test/file.txt' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const preview = el.shadowRoot!.querySelector('.input-preview');
    expect(preview!.textContent).to.contain('/test/file.txt');
  });

  it('explains bash rm command', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: 'rm -rf /tmp/test' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation).to.exist;
    expect(explanation!.textContent).to.contain('Delete files');
  });

  it('explains file_write with path', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'file_write',
      input: { path: '/output/result.txt', content: 'data' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation).to.exist;
    expect(explanation!.textContent).to.contain('Write to');
    expect(explanation!.textContent).to.contain('/output/result.txt');
  });

  it('shows "Don\'t ask again" checkbox for dangerous tools', async () => {
    pendingToolConfirm.set(makePendingConfirm({ toolName: 'bash' }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const checkbox = el.shadowRoot!.querySelector('sl-checkbox');
    expect(checkbox).to.exist;
  });

  it('hides "Don\'t ask again" checkbox for safe tools', async () => {
    pendingToolConfirm.set(makePendingConfirm({ toolName: 'file_read' }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const checkbox = el.shadowRoot!.querySelector('sl-checkbox');
    expect(checkbox).to.be.null;
  });

  it('has Approve and Deny buttons', async () => {
    pendingToolConfirm.set(makePendingConfirm());

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const buttons = el.shadowRoot!.querySelectorAll('sl-button');
    expect(buttons.length).to.equal(2);

    const buttonTexts = Array.from(buttons).map(b => b.textContent!.trim());
    expect(buttonTexts).to.include('Approve');
    expect(buttonTexts).to.include('Deny');
  });

  it('explains bash mv command', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: 'mv old.txt new.txt' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation!.textContent).to.contain('Move or rename');
  });

  it('explains bash cp command', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: 'cp source.txt dest.txt' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation!.textContent).to.contain('Copy files');
  });

  it('explains bash sudo command', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: 'sudo apt-get install' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation!.textContent).to.contain('elevated privileges');
  });

  it('explains bash redirect command', async () => {
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: 'echo "test" > output.txt' },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation!.textContent).to.contain('Write to file');
  });

  it('truncates long bash commands in explanation', async () => {
    const longCommand = 'echo ' + 'x'.repeat(100);
    pendingToolConfirm.set(makePendingConfirm({
      toolName: 'bash',
      input: { command: longCommand },
    }));

    const el = await fixture(
      html`<tool-confirm-modal></tool-confirm-modal>`,
    );
    await el.updateComplete;

    const explanation = el.shadowRoot!.querySelector('.tool-explanation-text');
    expect(explanation!.textContent).to.contain('...');
  });
});
