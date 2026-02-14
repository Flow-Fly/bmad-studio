import { useEffect, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import {
  useMessages,
  useActiveSession,
  useSessionStatus,
} from '../../stores/opencode.store';
import { MessageBlock } from './MessageBlock';
import { ChatInput } from './ChatInput';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { PermissionDialog } from './PermissionDialog';
import { useAutoScroll } from '../../hooks/useAutoScroll';

export function ChatPanel() {
  const messages = useMessages();
  const { sessionId } = useActiveSession();
  const status = useSessionStatus();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get auto-scroll behavior with messages as dependency
  const { scrollRef, isAtBottom, handleScroll, scrollToBottom } = useAutoScroll([
    messages,
  ]);

  // Connect scrollRef to the Radix ScrollArea viewport
  useEffect(() => {
    if (!scrollAreaRef.current) return undefined;

    // Query for Radix viewport element
    const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]'
    );

    if (!viewport) return undefined;

    scrollRef.current = viewport;

    // Attach scroll listener
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, scrollRef]);

  // Scroll to bottom when session status changes from busy to idle (final scroll)
  useEffect(() => {
    if (status === 'idle' && isAtBottom) {
      scrollToBottom();
    }
  }, [status, isAtBottom, scrollToBottom]);

  if (!sessionId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center text-interactive-muted">
          <p>No active session</p>
        </div>
        <ChatInput />
      </div>
    );
  }

  // Find the last assistant message index for streaming indicator
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-interactive-muted">
            <p>Waiting for messages...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {messages.map((message, index) => (
              <MessageBlock
                key={message.messageId}
                message={message}
                isLastAssistant={index === lastAssistantIndex}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      <ScrollToBottomButton isVisible={!isAtBottom} onClick={scrollToBottom} />
      <ChatInput />
      <PermissionDialog />
    </div>
  );
}
