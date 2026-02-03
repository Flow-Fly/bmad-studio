import { expect } from '@open-wc/testing';
import { sendMessage, cancelStream, initChatService } from '../../../src/services/chat.service.ts';
import { on, send } from '../../../src/services/websocket.service.ts';
import {
  chatConnectionState,
  streamingConversationId,
  activeConversations,
  setConversation,
  getConversation,
  clearChatState,
} from '../../../src/state/chat.state.ts';
import {
  CHAT_SEND,
  CHAT_CANCEL,
  CHAT_STREAM_START,
  CHAT_TEXT_DELTA,
  CHAT_THINKING_DELTA,
  CHAT_STREAM_END,
  CHAT_ERROR,
} from '../../../src/types/conversation.ts';
import type { WebSocketEvent } from '../../../src/services/websocket.service.ts';

beforeEach(() => {
  clearChatState();
});

afterEach(() => {
  clearChatState();
});

describe('chat.service', () => {
  describe('sendMessage', () => {
    it('throws when WebSocket is not connected', () => {
      expect(() =>
        sendMessage('conv-1', 'Hello', 'claude-sonnet-4-5-20250929', 'claude', 'test-key'),
      ).to.throw('WebSocket is not connected');
    });

    it('creates a new conversation in state before sending', () => {
      try {
        sendMessage('conv-new', 'Hello', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws because WebSocket is not connected; expected in test
      }

      const conv = getConversation('conv-new');
      expect(conv).to.not.be.undefined;
      expect(conv!.id).to.equal('conv-new');
      expect(conv!.model).to.equal('claude-sonnet-4-5-20250929');
      expect(conv!.provider).to.equal('claude');
    });

    it('adds user message to conversation', () => {
      try {
        sendMessage('conv-1', 'Hello world', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws; expected
      }

      const conv = getConversation('conv-1');
      expect(conv!.messages.length).to.equal(1);
      expect(conv!.messages[0].role).to.equal('user');
      expect(conv!.messages[0].content).to.equal('Hello world');
    });

    it('resets chatConnectionState to idle when send fails', () => {
      expect(chatConnectionState.get()).to.equal('idle');

      try {
        sendMessage('conv-1', 'Hello', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws; expected
      }

      expect(chatConnectionState.get()).to.equal('idle');
    });

    it('resets streamingConversationId when send fails', () => {
      expect(streamingConversationId.get()).to.be.null;

      try {
        sendMessage('conv-1', 'Hello', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws; expected
      }

      expect(streamingConversationId.get()).to.be.null;
    });

    it('appends user message to existing conversation', () => {
      setConversation({
        id: 'conv-existing',
        messages: [{ id: 'msg-1', role: 'user', content: 'First', timestamp: Date.now() }],
        createdAt: Date.now(),
        model: 'claude-sonnet-4-5-20250929',
        provider: 'claude',
      });

      try {
        sendMessage('conv-existing', 'Second', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws; expected
      }

      const conv = getConversation('conv-existing');
      expect(conv!.messages.length).to.equal(2);
      expect(conv!.messages[0].content).to.equal('First');
      expect(conv!.messages[1].content).to.equal('Second');
      expect(conv!.messages[1].role).to.equal('user');
    });

    it('generates a user message id prefixed with msg-user-', () => {
      try {
        sendMessage('conv-1', 'Hello', 'claude-sonnet-4-5-20250929', 'claude', 'test-key');
      } catch {
        // wsSend throws; expected
      }

      const conv = getConversation('conv-1');
      expect(conv!.messages[0].id).to.match(/^msg-user-/);
    });
  });

  describe('cancelStream', () => {
    it('throws when WebSocket is not connected', () => {
      expect(() => cancelStream('conv-1')).to.throw('WebSocket is not connected');
    });
  });

  describe('initChatService', () => {
    it('returns a cleanup function', () => {
      const cleanup = initChatService();
      expect(cleanup).to.be.a('function');
      cleanup();
    });

    it('cleanup function can be called multiple times without error', () => {
      const cleanup = initChatService();
      cleanup();
      cleanup();
    });
  });

  describe('state management', () => {
    it('setConversation adds to activeConversations', () => {
      setConversation({
        id: 'test-conv',
        messages: [],
        createdAt: Date.now(),
        model: 'claude-sonnet-4-5-20250929',
        provider: 'claude',
      });

      const conv = getConversation('test-conv');
      expect(conv).to.not.be.undefined;
      expect(conv!.id).to.equal('test-conv');
    });

    it('getConversation returns undefined for unknown id', () => {
      const conv = getConversation('nonexistent');
      expect(conv).to.be.undefined;
    });

    it('clearChatState resets all state', () => {
      chatConnectionState.set('streaming');
      streamingConversationId.set('conv-1');
      setConversation({
        id: 'test',
        messages: [],
        createdAt: Date.now(),
        model: 'test',
        provider: 'test',
      });

      clearChatState();

      expect(chatConnectionState.get()).to.equal('idle');
      expect(streamingConversationId.get()).to.be.null;
      expect(activeConversations.get().size).to.equal(0);
    });

    it('setConversation updates existing conversation immutably', () => {
      const original = {
        id: 'conv-1',
        messages: [{ id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: Date.now() }],
        createdAt: Date.now(),
        model: 'claude-sonnet-4-5-20250929',
        provider: 'claude',
      };
      setConversation(original);

      const updated = {
        ...original,
        messages: [
          ...original.messages,
          { id: 'msg-2', role: 'assistant' as const, content: 'Hi', timestamp: Date.now() },
        ],
      };
      setConversation(updated);

      const conv = getConversation('conv-1');
      expect(conv!.messages.length).to.equal(2);

      // Verify immutability: the original messages array should be unchanged
      expect(original.messages.length).to.equal(1);
    });

    it('chatConnectionState starts as idle', () => {
      expect(chatConnectionState.get()).to.equal('idle');
    });

    it('streamingConversationId starts as null', () => {
      expect(streamingConversationId.get()).to.be.null;
    });

    it('activeConversations starts as empty map', () => {
      expect(activeConversations.get().size).to.equal(0);
    });
  });
});

describe('websocket.service send', () => {
  it('send throws when not connected', () => {
    const event: WebSocketEvent = {
      type: CHAT_SEND,
      payload: { conversation_id: 'conv-1', content: 'hi' },
      timestamp: new Date().toISOString(),
    };
    expect(() => send(event)).to.throw('WebSocket is not connected');
  });

  it('on returns unsubscribe function for chat events', () => {
    const unsub = on(CHAT_STREAM_START, () => {});
    expect(unsub).to.be.a('function');
    unsub();
  });

  it('on allows multiple handlers for same event type', () => {
    const unsub1 = on(CHAT_TEXT_DELTA, () => {});
    const unsub2 = on(CHAT_TEXT_DELTA, () => {});

    expect(unsub1).to.be.a('function');
    expect(unsub2).to.be.a('function');

    unsub1();
    unsub2();
  });
});

describe('conversation types', () => {
  it('event type constants have correct values', () => {
    expect(CHAT_STREAM_START).to.equal('chat:stream-start');
    expect(CHAT_TEXT_DELTA).to.equal('chat:text-delta');
    expect(CHAT_THINKING_DELTA).to.equal('chat:thinking-delta');
    expect(CHAT_STREAM_END).to.equal('chat:stream-end');
    expect(CHAT_ERROR).to.equal('chat:error');
    expect(CHAT_SEND).to.equal('chat:send');
    expect(CHAT_CANCEL).to.equal('chat:cancel');
  });
});
