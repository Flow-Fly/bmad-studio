import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowDown, MoreVertical } from 'lucide-react';

import { useChatStore } from '../../stores/chat.store';
import { useProviderStore } from '../../stores/provider.store';
import { useProjectStore } from '../../stores/project.store';
import { useAgentStore } from '../../stores/agent.store';
import { useConnectionStore } from '../../stores/connection.store';

import { compactConversation, createInsight } from '../../services/insight.service';
import type { CompactConversationRequest } from '../../services/insight.service';
import { getApiKey } from '../../services/keychain.service';

import { ConversationBlock } from './ConversationBlock';
import { ChatInput } from './ChatInput';
import type { ChatInputHandle } from './ChatInput';
import { ContextIndicator } from './ContextIndicator';
import { ConversationLifecycleMenu } from './ConversationLifecycleMenu';
import { DiscardConfirmDialog } from './DiscardConfirmDialog';
import { ContextFullModal } from './ContextFullModal';
import { HighlightsAppendix, getHighlightEnrichmentText } from './HighlightsAppendix';
import { ToolConfirmModal } from './ToolConfirmModal';
import { AgentBadge } from '../navigation/AgentBadge';

import type { Conversation, Message, HighlightColor } from '../../types/conversation';
import { HIGHLIGHT_COLORS } from '../../types/conversation';
import type { Insight } from '../../types/insight';
import type { ProviderType } from '../../types/provider';
import { cn } from '../../lib/utils';

// Known model context window sizes (tokens)
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-5-20251101': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'claude-haiku-4-5-20251001': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
};
const DEFAULT_CONTEXT_WINDOW = 200000;

const CONNECTION_STATUS_COLORS: Record<string, string> = {
  connected: 'bg-success',
  connecting: 'bg-warning animate-pulse',
  error: 'bg-error',
};

const CONNECTION_STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  error: 'Connection error',
  disconnected: 'Disconnected',
};

export function ChatPanel() {
  const [conversationId, setConversationId] = useState('');
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [showLifecycleMenu, setShowLifecycleMenu] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showContextFullModal, setShowContextFullModal] = useState(false);
  const [compactLoading, setCompactLoading] = useState(false);

  const chatInputRef = useRef<ChatInputHandle>(null);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const lastAgentIdRef = useRef<string | null>(null);
  const contextFullShownRef = useRef(false);

  // Store selectors
  const conversations = useChatStore(s => s.conversations);
  const project = useProjectStore(s => s.project);
  const activeProvider = useProviderStore(s => s.activeProvider);
  const selectedModel = useProviderStore(s => s.selectedModel);
  const connectionStatus = useConnectionStore(s => s.status);
  const activeAgentId = useAgentStore(s => s.activeAgentId);
  const pendingToolConfirm = useChatStore(s => s.pendingToolConfirm);

  // Derived
  const conversation: Conversation | undefined = conversationId
    ? conversations[conversationId]
    : undefined;
  const messages: Message[] = conversation?.messages ?? [];
  const highlights = conversation?.highlights ?? [];
  const projectName = project?.projectName ?? '';

  // --- Conversation management ---

  const ensureConversation = useCallback((): string => {
    if (conversationId) {
      const existing = useChatStore.getState().getConversation(conversationId);
      if (existing) return conversationId;
    }

    const id = crypto.randomUUID();
    const provider = useProviderStore.getState().activeProvider;
    const model = useProviderStore.getState().selectedModel;
    const currentAgentId = useAgentStore.getState().activeAgentId;

    const newConversation: Conversation = {
      id,
      messages: [],
      highlights: [],
      model: model || '',
      provider: provider || '',
      createdAt: Date.now(),
      agentId: currentAgentId ?? undefined,
    };
    useChatStore.getState().setConversation(newConversation);
    setConversationId(id);

    if (currentAgentId) {
      useAgentStore.getState().setAgentConversation(currentAgentId, id);
    }

    return id;
  }, [conversationId]);

  // Agent switch detection
  useEffect(() => {
    if (!project || !activeProvider) return;

    const previousAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = activeAgentId;

    if (activeAgentId !== previousAgentId) {
      if (activeAgentId) {
        // Check if agent has an existing conversation
        const existingConvId = useAgentStore.getState().getAgentConversationId(activeAgentId);
        if (existingConvId && useChatStore.getState().getConversation(existingConvId)) {
          setConversationId(existingConvId);
          return;
        }

        // Migrate orphaned conversation
        if (previousAgentId === null && conversationId) {
          const orphan = useChatStore.getState().getConversation(conversationId);
          if (orphan && !orphan.agentId) {
            const migrated: Conversation = { ...orphan, agentId: activeAgentId };
            useChatStore.getState().setConversation(migrated);
            useAgentStore.getState().setAgentConversation(activeAgentId, conversationId);
            return;
          }
        }

        // Agent has no conversation - will create one
        setConversationId('');
      }
    }
  }, [activeAgentId, project, activeProvider, conversationId]);

  // Ensure conversation exists when state is ready
  useEffect(() => {
    if (project && activeProvider) {
      ensureConversation();
    }
  }, [project, activeProvider, ensureConversation]);

  // --- Scrolling ---

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messageAreaRef.current) {
        messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
      }
    });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (!userHasScrolled) {
      scrollToBottom();
    }
  }, [messages.length, messages[messages.length - 1]?.content, userHasScrolled, scrollToBottom]);

  // Context full detection
  useEffect(() => {
    const pct = getContextPercentage();
    if (pct >= 100 && !contextFullShownRef.current) {
      contextFullShownRef.current = true;
      setShowContextFullModal(true);
    }
  });

  const handleScroll = useCallback(() => {
    const el = messageAreaRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setUserHasScrolled(!atBottom);
  }, []);

  const scrollToBottomAndReset = useCallback(() => {
    setUserHasScrolled(false);
    scrollToBottom();
  }, [scrollToBottom]);

  // --- Context percentage ---

  function getContextPercentage(): number {
    if (!conversation || conversation.messages.length === 0) return 0;

    const totalTokens = conversation.messages.reduce((sum, msg) => {
      if (msg.usage) {
        return sum + msg.usage.input_tokens + msg.usage.output_tokens;
      }
      return sum;
    }, 0);

    if (totalTokens === 0) return 0;

    const model = useProviderStore.getState().selectedModel;
    if (!model) return 0;

    const contextWindow = MODEL_CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW;
    return Math.min(100, Math.round((totalTokens / contextWindow) * 100));
  }

  // --- Event handlers ---

  const handleRetry = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        chatInputRef.current?.sendContent(messages[i].content);
        break;
      }
    }
  }, [messages]);

  const handleExtractHighlightToInsight = useCallback(
    async (detail: {
      color: string;
      text: string;
      messageRole: string;
      messageContent: string;
    }) => {
      if (!projectName) return;

      const label = HIGHLIGHT_COLORS[detail.color as HighlightColor] ?? detail.color;
      const title =
        detail.text.length > 80 ? detail.text.slice(0, 77) + '...' : detail.text;
      const contextPreview =
        detail.messageContent.length > 300
          ? detail.messageContent.slice(0, 297) + '...'
          : detail.messageContent;

      const agent = useAgentStore.getState().activeAgent();

      const insight: Insight = {
        id: crypto.randomUUID(),
        title,
        extracted_idea: detail.text,
        origin_context: `From ${detail.messageRole} message: ${contextPreview}`,
        tags: [label],
        highlight_colors_used: [detail.color],
        created_at: new Date().toISOString(),
        source_agent: agent?.name || 'Unknown',
        status: 'fresh',
        used_in_count: 0,
      };

      try {
        await createInsight(projectName, insight);
      } catch (err) {
        console.error('Failed to create insight from highlight:', err);
      }
    },
    [projectName],
  );

  // --- Lifecycle handlers ---

  const handleLifecycleKeep = useCallback(() => {
    setShowLifecycleMenu(false);
  }, []);

  const clearCurrentConversation = useCallback(() => {
    const conv = useChatStore.getState().getConversation(conversationId);
    const agentId = conv?.agentId;

    useChatStore.getState().removeConversation(conversationId);
    if (agentId) {
      useAgentStore.getState().clearAgentConversation(agentId);
    }

    setConversationId('');
    contextFullShownRef.current = false;
  }, [conversationId]);

  const handleLifecycleCompact = useCallback(async () => {
    setShowLifecycleMenu(false);
    setShowContextFullModal(false);

    if (!conversation) return;
    if (!projectName) return;

    const provider = useProviderStore.getState().activeProvider;
    const model = useProviderStore.getState().selectedModel;
    if (!provider || !model) return;

    let apiKey = '';
    if (provider !== 'ollama') {
      try {
        const key = await getApiKey(provider as ProviderType);
        if (!key) return;
        apiKey = key;
      } catch {
        return;
      }
    }

    const agent = useAgentStore.getState().activeAgent();

    const filteredMessages = conversation.messages
      .filter(m => !m.isContext)
      .map(m => ({ role: m.role, content: m.content }));

    if (filteredMessages.length === 0) return;

    const highlightedSections: { color: string; text: string; message_role: string }[] =
      [];
    for (const h of conversation.highlights) {
      const msg = conversation.messages.find(m => m.id === h.messageId);
      if (!msg) continue;
      const text = msg.content.slice(h.startOffset, h.endOffset);
      if (!text) continue;
      highlightedSections.push({
        color: HIGHLIGHT_COLORS[h.color],
        text,
        message_role: msg.role,
      });
    }

    const request: CompactConversationRequest = {
      messages: filteredMessages,
      provider,
      model,
      api_key: apiKey,
      source_agent: agent?.name || 'Unknown',
      highlight_colors_used: [
        ...new Set(conversation.highlights.map(h => h.color)),
      ],
      ...(highlightedSections.length > 0
        ? { highlighted_sections: highlightedSections }
        : {}),
    };

    setCompactLoading(true);
    try {
      await compactConversation(projectName, request);
      clearCurrentConversation();
    } catch (err) {
      console.error('Failed to compact conversation:', err);
    } finally {
      setCompactLoading(false);
    }
  }, [conversation, projectName, clearCurrentConversation]);

  const handleLifecycleDiscard = useCallback(() => {
    setShowLifecycleMenu(false);
    setShowContextFullModal(false);
    setShowDiscardConfirm(true);
  }, []);

  const handleLifecycleDismiss = useCallback(() => {
    setShowLifecycleMenu(false);
  }, []);

  const handleDiscardConfirmed = useCallback(() => {
    setShowDiscardConfirm(false);
    clearCurrentConversation();
  }, [clearCurrentConversation]);

  const handleDiscardCancelled = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  // Enrichment text for chat input (from highlights appendix)
  const appendixText = getHighlightEnrichmentText(highlights, messages);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useChatStore.getState().getActiveConversationCount() > 1) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const statusColor = CONNECTION_STATUS_COLORS[connectionStatus] ?? 'bg-warning';

  // --- Render ---

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Open a project to start chatting
      </div>
    );
  }

  if (!activeProvider) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Configure a provider in settings to start chatting
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex min-h-9 items-center gap-2 border-b border-border-primary bg-bg-secondary px-4 py-1">
        <AgentBadge />
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', statusColor)}
          title={CONNECTION_STATUS_LABELS[connectionStatus] ?? 'Disconnected'}
        />
        {messages.length > 0 && (
          <div className="relative ml-auto flex items-center gap-1">
            {compactLoading ? (
              <span className="text-[length:var(--text-sm)] font-medium italic text-text-primary">
                Compacting...
              </span>
            ) : (
              <button
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => setShowLifecycleMenu(!showLifecycleMenu)}
                aria-label="Conversation actions"
                aria-haspopup="menu"
                aria-expanded={showLifecycleMenu}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
            <ConversationLifecycleMenu
              open={showLifecycleMenu}
              forceAction={getContextPercentage() >= 100}
              onKeep={handleLifecycleKeep}
              onCompact={handleLifecycleCompact}
              onDiscard={handleLifecycleDiscard}
              onDismiss={handleLifecycleDismiss}
            />
          </div>
        )}
      </div>

      {/* Message area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div
          ref={messageAreaRef}
          className="flex flex-1 flex-col overflow-y-auto"
          role="log"
          aria-live="polite"
          onScroll={handleScroll}
        >
          <div className="flex flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-5 text-text-muted">
                Start a conversation
              </div>
            ) : (
              messages.map(msg => (
                <ConversationBlock
                  key={msg.id}
                  message={msg}
                  conversationId={conversationId}
                  highlights={highlights}
                  onRetry={handleRetry}
                  onExtractHighlightToInsight={handleExtractHighlightToInsight}
                />
              ))
            )}
          </div>
        </div>

        {userHasScrolled && (
          <button
            className="absolute bottom-2 right-4 z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-bg-elevated text-text-secondary shadow-sm transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={scrollToBottomAndReset}
            aria-label="Scroll to latest message"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Context indicator */}
      {messages.length > 0 && (
        <ContextIndicator
          percentage={getContextPercentage()}
          modelName={selectedModel || ''}
          onClick={() => setShowLifecycleMenu(!showLifecycleMenu)}
        />
      )}

      {/* Highlights appendix */}
      {highlights.length > 0 && (
        <HighlightsAppendix highlights={highlights} messages={messages} />
      )}

      {/* Chat input */}
      <ChatInput
        ref={chatInputRef}
        conversationId={conversationId}
        appendixText={appendixText}
        onAttachContextRequest={() => {
          // AttachContextPicker will be added in Phase 6
        }}
        onMessageSent={() => {
          // Clear dismissed highlights on new message
        }}
      />

      {/* Discard confirm dialog */}
      <DiscardConfirmDialog
        open={showDiscardConfirm}
        onConfirm={handleDiscardConfirmed}
        onCancel={handleDiscardCancelled}
      />

      {/* Context full modal */}
      <ContextFullModal
        open={showContextFullModal}
        onCompact={handleLifecycleCompact}
        onDiscard={handleLifecycleDiscard}
      />

      {/* Tool confirm modal */}
      {pendingToolConfirm && <ToolConfirmModal />}
    </div>
  );
}
