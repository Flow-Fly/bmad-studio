import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/chat/chat-panel.ts';
import {
  chatConnectionState,
  activeConversations,
  streamingConversationId,
  clearChatState,
  setConversation,
} from '../../../src/state/chat.state.ts';
import { activeProviderState, selectedModelState } from '../../../src/state/provider.state.ts';
import { projectState } from '../../../src/state/project.state.ts';
import { connectionState } from '../../../src/state/connection.state.ts';
import type { ProjectData } from '../../../src/types/project.ts';
import type { Conversation, Message } from '../../../src/types/conversation.ts';

const mockProject: ProjectData = {
  projectName: 'test-project',
  projectRoot: '/path/to/test-project',
  bmadLoaded: true,
  services: {
    config: true,
    phases: true,
    agents: true,
    status: true,
    artifacts: true,
    watcher: true,
  },
};

// Stub fetch globally
beforeEach(() => {
  clearChatState();
  projectState.set(mockProject);
  activeProviderState.set('claude');
  selectedModelState.set('claude-3-opus');
  connectionState.set('connected');
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
});

afterEach(() => {
  clearChatState();
  projectState.set(null);
  activeProviderState.set('');
  selectedModelState.set('');
  connectionState.set('disconnected');
});

describe('ChatPanel', () => {
  it('renders empty state when no project open', async () => {
    projectState.set(null);
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
    expect(emptyState!.textContent).to.include('Open a project');
  });

  it('renders empty state when no provider configured', async () => {
    activeProviderState.set('');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
    expect(emptyState!.textContent).to.include('Configure a provider');
  });

  it('creates conversation on first render when project + provider available', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    // A conversation should have been created in state
    const conversations = activeConversations.get();
    expect(conversations.size).to.be.greaterThan(0);
  });

  it('renders panel header with connection status', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const header = el.shadowRoot!.querySelector('.panel-header');
    expect(header).to.exist;

    const title = el.shadowRoot!.querySelector('.header-title');
    expect(title!.textContent).to.equal('Chat');

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot).to.exist;
  });

  it('renders message list from conversation signals', async () => {
    // Set up conversation with messages
    const convId = 'test-conv';
    const conversation: Conversation = {
      id: convId,
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
      ],
      model: 'claude-3-opus',
      provider: 'claude',
      createdAt: Date.now(),
    };
    setConversation(conversation);

    const el = await fixture(html`<chat-panel></chat-panel>`);
    // Set conversation ID manually for test
    (el as any)._conversationId = convId;
    await el.updateComplete;

    const blocks = el.shadowRoot!.querySelectorAll('conversation-block');
    expect(blocks.length).to.equal(2);
  });

  it('renders chat-input at bottom', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const chatInput = el.shadowRoot!.querySelector('chat-input');
    expect(chatInput).to.exist;
  });

  it('message area has role=log and aria-live', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const messageArea = el.shadowRoot!.querySelector('.message-area');
    expect(messageArea!.getAttribute('role')).to.equal('log');
    expect(messageArea!.getAttribute('aria-live')).to.equal('polite');
  });

  it('shows "Start a conversation" when no messages', async () => {
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    // Inside message-list, there should be an empty state
    const emptyStates = el.shadowRoot!.querySelectorAll('.empty-state');
    const messageEmptyState = Array.from(emptyStates).find(
      e => e.textContent?.includes('Start a conversation')
    );
    expect(messageEmptyState).to.exist;
  });

  it('connection dot shows connected state', async () => {
    connectionState.set('connected');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot).to.exist;
    expect(dot!.getAttribute('title')).to.equal('Connected');
  });

  it('connection dot shows connecting state with animation', async () => {
    connectionState.set('connecting');
    const el = await fixture(html`<chat-panel></chat-panel>`);
    await el.updateComplete;

    const dot = el.shadowRoot!.querySelector('.connection-dot');
    expect(dot!.classList.contains('connection-dot--connecting')).to.be.true;
  });
});
