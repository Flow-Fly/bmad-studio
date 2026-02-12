import { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useProviderStore } from '../../stores/provider.store';
import { useChatStore } from '../../stores/chat.store';
import { sendMessage } from '../../services/chat.service';
import { getApiKey } from '../../services/keychain.service';
import { cn } from '../../lib/utils';
import type { ProviderType } from '../../types/provider';

export interface ChatInputHandle {
  sendContent: (content: string) => Promise<void>;
  focusInput: () => void;
}

interface ChatInputProps {
  conversationId: string;
  appendixText: string;
  onAttachContextRequest?: () => void;
  onMessageSent?: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ conversationId, appendixText, onAttachContextRequest, onMessageSent }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [error, setError] = useState('');

    const provider = useProviderStore(s => s.activeProvider);
    const model = useProviderStore(s => s.selectedModel);
    const connectionState = useChatStore(s => s.connectionState);

    const isStreaming = connectionState === 'streaming';

    const autoGrow = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 126)}px`;
    }, []);

    const send = useCallback(async () => {
      const content = textareaRef.current?.value.trim();
      if (!content) return;

      if (!provider || !model) {
        setError('No provider configured. Check settings.');
        return;
      }

      if (!conversationId) return;

      let apiKey = '';
      if (provider !== 'ollama') {
        try {
          const key = await getApiKey(provider as ProviderType);
          if (!key) {
            setError('API key not found. Check provider settings.');
            return;
          }
          apiKey = key;
        } catch {
          setError('API key not found. Check provider settings.');
          return;
        }
      }

      setError('');

      try {
        const fullContent = appendixText ? content + appendixText : content;
        sendMessage(conversationId, fullContent, model, provider, apiKey);
        textareaRef.current!.value = '';
        autoGrow();
        onMessageSent?.();
      } catch {
        setError('Failed to send message. Check your connection.');
      }
    }, [provider, model, conversationId, appendixText, autoGrow, onMessageSent]);

    const handleKeydown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || !e.shiftKey)) {
          e.preventDefault();
          send();
        }
      },
      [send],
    );

    useImperativeHandle(ref, () => ({
      sendContent: async (content: string) => {
        if (!content.trim()) return;
        if (textareaRef.current) textareaRef.current.value = content;
        await send();
      },
      focusInput: () => textareaRef.current?.focus(),
    }));

    if (!provider) {
      return (
        <div className="border-t border-border-primary bg-bg-primary px-4 py-2 text-center text-[length:var(--text-sm)] text-text-muted">
          Configure a provider in settings to start chatting
        </div>
      );
    }

    return (
      <div className="border-t border-border-primary bg-bg-primary px-4 py-2">
        <div
          className={cn(
            'flex items-end gap-2 rounded-[var(--radius-md)] border border-border-primary bg-bg-tertiary p-2 transition-colors focus-within:border-accent',
            isStreaming && 'animate-pulse opacity-70',
          )}
        >
          <button
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-muted"
            disabled={isStreaming}
            onClick={onAttachContextRequest}
            aria-label="Attach context"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Type a message..."
            disabled={isStreaming}
            aria-label="Chat message input"
            role="textbox"
            aria-multiline
            onKeyDown={handleKeydown}
            onInput={autoGrow}
            className="flex-1 resize-none border-none bg-transparent p-0 font-[family-name:var(--bmad-font-family)] text-[length:var(--text-md)] leading-normal text-text-primary outline-none placeholder:text-text-muted"
            style={{ minHeight: 21, maxHeight: 126 }}
          />
          <button
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:text-text-muted"
            disabled={isStreaming}
            onClick={send}
            aria-label="Send message"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
        {error && (
          <div className="pt-1 text-[length:var(--text-sm)] text-error">{error}</div>
        )}
      </div>
    );
  },
);
ChatInput.displayName = 'ChatInput';
