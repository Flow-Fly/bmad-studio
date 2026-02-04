import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/conversation-block.ts';
import type { Message, Highlight } from '../../../src/types/conversation.ts';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world! This is a test message.',
  timestamp: new Date('2026-02-04T10:30:00Z').getTime(),
  ...overrides,
});

const makeHighlight = (overrides: Partial<Highlight> = {}): Highlight => ({
  id: 'hl-1',
  messageId: 'msg-1',
  startOffset: 0,
  endOffset: 5,
  color: 'yellow',
  ...overrides,
});

describe('ConversationBlock highlighting', () => {
  it('highlight-popover is hidden by default', async () => {
    const msg = makeMessage();
    const el = await fixture(
      html`<conversation-block .message=${msg} conversationId="conv-1"></conversation-block>`
    );
    await el.updateComplete;

    const popover = el.shadowRoot!.querySelector('highlight-popover');
    expect(popover).to.exist;
    expect(popover!.hasAttribute('open')).to.be.false;
  });

  it('highlighted text displays with colored mark for user messages', async () => {
    const msg = makeMessage({ role: 'user', content: 'Hello world test' });
    const highlights: Highlight[] = [
      makeHighlight({ startOffset: 0, endOffset: 5, color: 'yellow', messageId: 'msg-1' }),
    ];

    const el = await fixture(
      html`<conversation-block
        .message=${msg}
        .highlights=${highlights}
        conversationId="conv-1"
      ></conversation-block>`
    );
    await el.updateComplete;

    const marks = el.shadowRoot!.querySelectorAll('mark.text-highlight');
    expect(marks.length).to.equal(1);
    expect(marks[0].textContent).to.equal('Hello');
  });

  it('multiple highlights render correctly for user messages', async () => {
    const msg = makeMessage({ role: 'user', content: 'Hello world test message' });
    const highlights: Highlight[] = [
      makeHighlight({ id: 'hl-1', startOffset: 0, endOffset: 5, color: 'yellow', messageId: 'msg-1' }),
      makeHighlight({ id: 'hl-2', startOffset: 6, endOffset: 11, color: 'green', messageId: 'msg-1' }),
    ];

    const el = await fixture(
      html`<conversation-block
        .message=${msg}
        .highlights=${highlights}
        conversationId="conv-1"
      ></conversation-block>`
    );
    await el.updateComplete;

    const marks = el.shadowRoot!.querySelectorAll('mark.text-highlight');
    expect(marks.length).to.equal(2);
    expect(marks[0].textContent).to.equal('Hello');
    expect(marks[1].textContent).to.equal('world');
  });

  it('highlighted marks have correct aria-label', async () => {
    const msg = makeMessage({ role: 'user', content: 'Hello world test' });
    const highlights: Highlight[] = [
      makeHighlight({ startOffset: 0, endOffset: 5, color: 'yellow', messageId: 'msg-1' }),
      makeHighlight({ id: 'hl-2', startOffset: 6, endOffset: 11, color: 'red', messageId: 'msg-1' }),
    ];

    const el = await fixture(
      html`<conversation-block
        .message=${msg}
        .highlights=${highlights}
        conversationId="conv-1"
      ></conversation-block>`
    );
    await el.updateComplete;

    const marks = el.shadowRoot!.querySelectorAll('mark.text-highlight');
    expect(marks[0].getAttribute('aria-label')).to.equal('important');
    expect(marks[1].getAttribute('aria-label')).to.equal('disagree');
  });

  it('does not render highlights for a different message', async () => {
    const msg = makeMessage({ id: 'msg-2', role: 'user', content: 'Different message' });
    const highlights: Highlight[] = [
      makeHighlight({ messageId: 'msg-1', startOffset: 0, endOffset: 5, color: 'yellow' }),
    ];

    const el = await fixture(
      html`<conversation-block
        .message=${msg}
        .highlights=${highlights}
        conversationId="conv-1"
      ></conversation-block>`
    );
    await el.updateComplete;

    const marks = el.shadowRoot!.querySelectorAll('mark.text-highlight');
    expect(marks.length).to.equal(0);
  });

  it('renders highlight-popover component', async () => {
    const msg = makeMessage();
    const el = await fixture(
      html`<conversation-block .message=${msg} conversationId="conv-1"></conversation-block>`
    );
    await el.updateComplete;

    const popover = el.shadowRoot!.querySelector('highlight-popover');
    expect(popover).to.exist;
  });

  it('does not show highlights on streaming messages', async () => {
    const msg = makeMessage({ role: 'user', content: 'Streaming...', isStreaming: true });
    const highlights: Highlight[] = [
      makeHighlight({ startOffset: 0, endOffset: 5, color: 'yellow', messageId: 'msg-1' }),
    ];

    const el = await fixture(
      html`<conversation-block
        .message=${msg}
        .highlights=${highlights}
        conversationId="conv-1"
      ></conversation-block>`
    );
    await el.updateComplete;

    // Streaming messages still render through markdown-renderer, not through
    // the text-highlight path, so mark elements won't appear
    const userText = el.shadowRoot!.querySelector('.user-text');
    // When streaming, content is rendered through markdown-renderer (not user-text)
    // so highlights are applied differently
    expect(el.shadowRoot!.querySelector('mark.text-highlight')).to.be.null;
  });
});
