import { ScrollArea } from '../ui/scroll-area';
import { useMessages, useActiveSession } from '../../stores/opencode.store';
import { MessageBlock } from './MessageBlock';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  const messages = useMessages();
  const { sessionId } = useActiveSession();

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
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
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
      <ChatInput />
    </div>
  );
}
