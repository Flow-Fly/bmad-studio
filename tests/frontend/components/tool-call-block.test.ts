import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/tool-call-block.ts';
import type { ToolCallBlock } from '../../../src/types/tool.ts';

const makeToolBlock = (overrides: Partial<ToolCallBlock> = {}): ToolCallBlock => ({
  type: 'tool',
  id: 'block-tool-1',
  toolId: 'tool-1',
  toolName: 'file_read',
  input: { path: '/test/file.txt' },
  inputRaw: '{"path": "/test/file.txt"}',
  status: 'running',
  startedAt: Date.now(),
  ...overrides,
});

describe('ToolCallBlock', () => {
  it('renders tool name in header', async () => {
    const block = makeToolBlock({ toolName: 'bash' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const toolName = el.shadowRoot!.querySelector('.tool-name');
    expect(toolName).to.exist;
    expect(toolName!.textContent).to.equal('bash');
  });

  it('shows running status with loader icon', async () => {
    const block = makeToolBlock({ status: 'running' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const statusIcon = el.shadowRoot!.querySelector('.status-icon--running');
    expect(statusIcon).to.exist;

    const statusLabel = el.shadowRoot!.querySelector('.status-label');
    expect(statusLabel!.textContent).to.equal('Running');
  });

  it('shows success status with check icon', async () => {
    const block = makeToolBlock({
      status: 'success',
      output: 'file contents here',
      completedAt: Date.now(),
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const statusIcon = el.shadowRoot!.querySelector('.status-icon--success');
    expect(statusIcon).to.exist;

    const statusLabel = el.shadowRoot!.querySelector('.status-label');
    expect(statusLabel!.textContent).to.equal('Complete');
  });

  it('shows error status with x icon', async () => {
    const block = makeToolBlock({
      status: 'error',
      error: 'File not found',
      completedAt: Date.now(),
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const statusIcon = el.shadowRoot!.querySelector('.status-icon--error');
    expect(statusIcon).to.exist;

    const statusLabel = el.shadowRoot!.querySelector('.status-label');
    expect(statusLabel!.textContent).to.equal('Failed');
  });

  it('shows pending status', async () => {
    const block = makeToolBlock({ status: 'pending' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const statusLabel = el.shadowRoot!.querySelector('.status-label');
    expect(statusLabel!.textContent).to.equal('Pending');
  });

  it('has collapsible input section', async () => {
    const block = makeToolBlock({
      input: { path: '/foo/bar.txt', encoding: 'utf-8' },
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const inputToggle = el.shadowRoot!.querySelector('.section-toggle');
    expect(inputToggle).to.exist;
    expect(inputToggle!.textContent).to.contain('Input');
  });

  it('shows output section when status is success', async () => {
    const block = makeToolBlock({
      status: 'success',
      output: 'Some output content',
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const sections = el.shadowRoot!.querySelectorAll('.collapsible-section');
    expect(sections.length).to.equal(2); // Input and Output sections
  });

  it('shows error section when status is error', async () => {
    const block = makeToolBlock({
      status: 'error',
      error: 'Permission denied',
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const sections = el.shadowRoot!.querySelectorAll('.collapsible-section');
    expect(sections.length).to.equal(2); // Input and Error sections
  });

  it('hides output section when running', async () => {
    const block = makeToolBlock({ status: 'running' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const sections = el.shadowRoot!.querySelectorAll('.collapsible-section');
    expect(sections.length).to.equal(1); // Only Input section
  });

  it('formats input as JSON', async () => {
    const block = makeToolBlock({
      input: { command: 'ls -la' },
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    // Expand input section by clicking toggle
    const toggle = el.shadowRoot!.querySelector('.section-toggle') as HTMLButtonElement;
    toggle.click();
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector('.section-body');
    expect(body!.textContent).to.contain('"command"');
    expect(body!.textContent).to.contain('ls -la');
  });

  it('uses correct icon for bash tool', async () => {
    const block = makeToolBlock({ toolName: 'bash' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const toolIcon = el.shadowRoot!.querySelector('.tool-icon svg');
    expect(toolIcon).to.exist;
  });

  it('uses correct icon for file_read tool', async () => {
    const block = makeToolBlock({ toolName: 'file_read' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const toolIcon = el.shadowRoot!.querySelector('.tool-icon svg');
    expect(toolIcon).to.exist;
  });

  it('uses correct icon for web_search tool', async () => {
    const block = makeToolBlock({ toolName: 'web_search' });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    const toolIcon = el.shadowRoot!.querySelector('.tool-icon svg');
    expect(toolIcon).to.exist;
  });

  it('renders nothing when block is undefined', async () => {
    const el = await fixture(
      html`<tool-call-block></tool-call-block>`,
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.tool-call')).to.be.null;
  });

  it('truncates long output', async () => {
    const longOutput = 'x'.repeat(600);
    const block = makeToolBlock({
      status: 'success',
      output: longOutput,
    });
    const el = await fixture(
      html`<tool-call-block .block=${block}></tool-call-block>`,
    );
    await el.updateComplete;

    // Expand output section
    const toggles = el.shadowRoot!.querySelectorAll('.section-toggle');
    const outputToggle = toggles[1] as HTMLButtonElement;
    outputToggle.click();
    await el.updateComplete;

    const bodies = el.shadowRoot!.querySelectorAll('.section-body');
    const outputBody = bodies[1];
    expect(outputBody!.textContent).to.contain('(truncated)');
  });
});
