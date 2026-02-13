import { ScrollArea } from '../ui/scroll-area';
import { useMessages, useActiveSession } from '../../stores/opencode.store';
import { MessageBlock } from './MessageBlock';

export function ChatPanel() {
  const messages = useMessages();
  const { sessionId } = useActiveSession();

  // Empty state: no session or no messages
  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>No active session</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Waiting for messages...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {messages.map((message) => (
          <MessageBlock key={message.messageId} message={message} />
        ))}
      </div>
    </ScrollArea>
  );
}
