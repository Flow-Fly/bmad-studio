import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/conversation-block.ts';
import type { Message } from '../../../src/types/conversation.ts';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world!',
  timestamp: new Date('2026-02-03T10:30:00Z').getTime(),
  ...overrides,
});

describe('ConversationBlock', () => {
  it('renders user message with correct styling', async () => {
    const msg = makeMessage({ role: 'user', content: 'Hi there' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const messageDiv = el.shadowRoot!.querySelector('.message');
    expect(messageDiv).to.exist;
    expect(messageDiv!.classList.contains('message--user')).to.be.true;
    expect(messageDiv!.classList.contains('message--assistant')).to.be.false;

    const sender = el.shadowRoot!.querySelector('.sender');
    expect(sender!.textContent).to.equal('You');
  });

  it('renders assistant message with correct styling', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Hello!' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const messageDiv = el.shadowRoot!.querySelector('.message');
    expect(messageDiv!.classList.contains('message--assistant')).to.be.true;
    expect(messageDiv!.classList.contains('message--user')).to.be.false;

    const sender = el.shadowRoot!.querySelector('.sender');
    expect(sender!.textContent).to.equal('Assistant');
  });

  it('shows timestamp on messages', async () => {
    const msg = makeMessage({ timestamp: new Date('2026-02-03T14:30:00Z').getTime() });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const timestamp = el.shadowRoot!.querySelector('.timestamp');
    expect(timestamp).to.exist;
    expect(timestamp!.textContent).to.not.be.empty;
  });

  it('shows typing indicator when isStreaming and empty content', async () => {
    const msg = makeMessage({ role: 'assistant', content: '', isStreaming: true });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const typing = el.shadowRoot!.querySelector('.typing-indicator');
    expect(typing).to.exist;
    const dots = typing!.querySelectorAll('span');
    expect(dots.length).to.equal(3);
  });

  it('shows streaming content progressively through markdown-renderer', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Partial response...', isStreaming: true });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    // Should show content, not typing indicator
    const typing = el.shadowRoot!.querySelector('.typing-indicator');
    expect(typing).to.be.null;
    const content = el.shadowRoot!.querySelector('.content');
    expect(content).to.exist;

    // Content is now rendered through markdown-renderer
    const mdRenderer = content!.querySelector('markdown-renderer');
    expect(mdRenderer).to.exist;
  });

  it('renders message content through markdown-renderer', async () => {
    const msg = makeMessage({ role: 'assistant', content: '**bold** text' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const content = el.shadowRoot!.querySelector('.content');
    expect(content).to.exist;

    const mdRenderer = content!.querySelector('markdown-renderer');
    expect(mdRenderer).to.exist;
  });

  it('shows partial indicator for cancelled messages', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Incomplete', isPartial: true });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const partial = el.shadowRoot!.querySelector('.partial-indicator');
    expect(partial).to.exist;
    expect(partial!.textContent).to.equal('Response was interrupted');
  });

  it('shows error state with red styling', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Error: Something went wrong' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const messageDiv = el.shadowRoot!.querySelector('.message');
    expect(messageDiv!.classList.contains('message--error')).to.be.true;

    const errorText = el.shadowRoot!.querySelector('.error-text');
    expect(errorText).to.exist;
    expect(errorText!.textContent).to.include('Something went wrong');
  });

  it('shows retry button on error', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Error: Failed' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const retryButton = el.shadowRoot!.querySelector('.retry-button');
    expect(retryButton).to.exist;
    expect(retryButton!.textContent).to.include('Retry');
  });

  it('retry button dispatches retry-message event', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Error: Failed' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    let eventFired = false;
    el.addEventListener('retry-message', () => { eventFired = true; });

    const retryButton = el.shadowRoot!.querySelector<HTMLButtonElement>('.retry-button')!;
    retryButton.click();

    expect(eventFired).to.be.true;
  });

  it('has correct accessibility attributes', async () => {
    const msg = makeMessage({ role: 'user', content: 'Test message' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const messageDiv = el.shadowRoot!.querySelector('.message');
    expect(messageDiv!.getAttribute('role')).to.equal('listitem');
    expect(messageDiv!.getAttribute('aria-label')).to.include('You');
  });

  it('does not show partial indicator on normal messages', async () => {
    const msg = makeMessage({ role: 'assistant', content: 'Normal complete response' });
    const el = await fixture(
      html`<conversation-block .message=${msg}></conversation-block>`
    );
    await el.updateComplete;

    const partial = el.shadowRoot!.querySelector('.partial-indicator');
    expect(partial).to.be.null;
  });

  it('renders nothing when no message provided', async () => {
    const el = await fixture(
      html`<conversation-block></conversation-block>`
    );
    await el.updateComplete;

    const messageDiv = el.shadowRoot!.querySelector('.message');
    expect(messageDiv).to.be.null;
  });

  describe('copy button', () => {
    it('renders copy button for user message with content', async () => {
      const msg = makeMessage({ role: 'user', content: 'Test message' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton).to.exist;
    });

    it('renders copy button for assistant message with content', async () => {
      const msg = makeMessage({ role: 'assistant', content: 'Hello there' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton).to.exist;
    });

    it('has correct aria-label on copy button', async () => {
      const msg = makeMessage({ role: 'user', content: 'Test' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton!.getAttribute('aria-label')).to.equal('Copy message');
    });

    it('does not show copy button for streaming message with no content', async () => {
      const msg = makeMessage({ role: 'assistant', content: '', isStreaming: true });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton).to.be.null;
    });

    it('does not show copy button for error messages', async () => {
      const msg = makeMessage({ role: 'assistant', content: 'Error: Something went wrong' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton).to.be.null;
    });

    it('shows copy button for streaming message with partial content', async () => {
      const msg = makeMessage({ role: 'assistant', content: 'Partial...', isStreaming: true });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const copyButton = el.shadowRoot!.querySelector('.copy-button');
      expect(copyButton).to.exist;
    });

    it('calls clipboard API when copy button is clicked', async () => {
      const msg = makeMessage({ role: 'user', content: 'Copy me' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      // Mock clipboard API
      let copiedText = '';
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => { copiedText = text; },
        },
        writable: true,
        configurable: true,
      });

      const copyButton = el.shadowRoot!.querySelector<HTMLButtonElement>('.copy-button')!;
      copyButton.click();

      // Wait for async clipboard write
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(copiedText).to.equal('Copy me');

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it('shows "Copied!" feedback after clicking copy button', async () => {
      const msg = makeMessage({ role: 'user', content: 'Copy me' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      // Mock clipboard API
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async () => {},
        },
        writable: true,
        configurable: true,
      });

      const copyButton = el.shadowRoot!.querySelector<HTMLButtonElement>('.copy-button')!;
      copyButton.click();

      // Wait for async clipboard write and state update
      await new Promise(resolve => setTimeout(resolve, 50));
      await el.updateComplete;

      const copiedText = el.shadowRoot!.querySelector('.copied-text');
      expect(copiedText).to.exist;
      expect(copiedText!.textContent).to.equal('Copied!');

      const updatedButton = el.shadowRoot!.querySelector('.copy-button');
      expect(updatedButton!.getAttribute('aria-label')).to.equal('Copied');

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('thinking section', () => {
    it('shows thinking section when assistant message has thinkingContent', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Here is the answer.',
        thinkingContent: 'Let me reason about this...',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingSection = el.shadowRoot!.querySelector('.thinking-section');
      expect(thinkingSection).to.exist;

      const toggle = el.shadowRoot!.querySelector('.thinking-toggle');
      expect(toggle).to.exist;
    });

    it('does not show thinking section when thinkingContent is absent', async () => {
      const msg = makeMessage({ role: 'assistant', content: 'No thinking here.' });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingSection = el.shadowRoot!.querySelector('.thinking-section');
      expect(thinkingSection).to.be.null;
    });

    it('does not show thinking section for user messages', async () => {
      const msg = makeMessage({
        role: 'user',
        content: 'Hello',
        thinkingContent: 'This should not appear',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingSection = el.shadowRoot!.querySelector('.thinking-section');
      expect(thinkingSection).to.be.null;
    });

    it('thinking section is collapsed by default', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Answer',
        thinkingContent: 'Reasoning...',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingBody = el.shadowRoot!.querySelector('.thinking-body');
      expect(thinkingBody).to.exist;
      expect(thinkingBody!.classList.contains('thinking-body--expanded')).to.be.false;

      const toggle = el.shadowRoot!.querySelector('.thinking-toggle');
      expect(toggle!.getAttribute('aria-expanded')).to.equal('false');
    });

    it('clicking toggle expands thinking section', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Answer',
        thinkingContent: 'Reasoning...',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('.thinking-toggle')!;
      toggle.click();
      await el.updateComplete;

      const thinkingBody = el.shadowRoot!.querySelector('.thinking-body');
      expect(thinkingBody!.classList.contains('thinking-body--expanded')).to.be.true;

      const updatedToggle = el.shadowRoot!.querySelector('.thinking-toggle');
      expect(updatedToggle!.getAttribute('aria-expanded')).to.equal('true');
      expect(updatedToggle!.classList.contains('thinking-toggle--expanded')).to.be.true;
    });

    it('toggle text shows "Show thinking" when collapsed and "Hide thinking" when expanded', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Answer',
        thinkingContent: 'Reasoning...',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('.thinking-toggle')!;
      const toggleText = toggle.querySelector('span');
      expect(toggleText!.textContent).to.equal('Show thinking');

      toggle.click();
      await el.updateComplete;

      const expandedToggle = el.shadowRoot!.querySelector<HTMLButtonElement>('.thinking-toggle')!;
      const expandedText = expandedToggle.querySelector('span');
      expect(expandedText!.textContent).to.equal('Hide thinking');
    });

    it('thinking content renders through markdown-renderer', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Answer',
        thinkingContent: '**bold thinking**',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingBody = el.shadowRoot!.querySelector('.thinking-body');
      expect(thinkingBody).to.exist;

      const mdRenderer = thinkingBody!.querySelector('markdown-renderer');
      expect(mdRenderer).to.exist;
    });

    it('shows thinking section during streaming with thinkingContent', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Partial answer...',
        thinkingContent: 'Still thinking...',
        isStreaming: true,
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingSection = el.shadowRoot!.querySelector('.thinking-section');
      expect(thinkingSection).to.exist;

      // Main content should also be present
      const content = el.shadowRoot!.querySelector('.content');
      expect(content).to.exist;
    });

    it('does not show thinking section when thinkingContent is empty string', async () => {
      const msg = makeMessage({
        role: 'assistant',
        content: 'Answer',
        thinkingContent: '',
      });
      const el = await fixture(
        html`<conversation-block .message=${msg}></conversation-block>`
      );
      await el.updateComplete;

      const thinkingSection = el.shadowRoot!.querySelector('.thinking-section');
      expect(thinkingSection).to.be.null;
    });
  });
});
