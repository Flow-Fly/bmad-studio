import type { Message } from '../../types/message';
import { cn } from '../../lib/utils';
import { useSessionStatus } from '../../stores/opencode.store';
import { MessagePartText } from './MessagePartText';
import { MessagePartThinking } from './MessagePartThinking';
import { MessagePartToolCall } from './MessagePartToolCall';
import { MessagePartToolResult } from './MessagePartToolResult';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageBlockProps {
  message: Message;
}

export function MessageBlock({ message }: MessageBlockProps) {
  const sessionStatus = useSessionStatus();

  const isUser = message.role === 'user';
  const isStreaming = sessionStatus === 'busy' && !isUser;

  return (
    <div
      className={cn(
        'rounded-lg p-4',
        isUser
          ? 'ml-auto max-w-[80%] bg-blue-50 dark:bg-blue-950'
          : 'mr-auto max-w-[95%] bg-gray-50 dark:bg-gray-900'
      )}
    >
      <div className="flex flex-col gap-3">
        {message.parts.map((part) => {
          switch (part.data.type) {
            case 'text':
              return (
                <MessagePartText
                  key={part.partId}
                  part={part.data}
                />
              );
            case 'thinking':
              return (
                <MessagePartThinking
                  key={part.partId}
                  part={part.data}
                />
              );
            case 'tool-call':
              return (
                <MessagePartToolCall
                  key={part.partId}
                  part={part.data}
                />
              );
            case 'tool-result':
              return (
                <MessagePartToolResult
                  key={part.partId}
                  part={part.data}
                />
              );
            default:
              return null;
          }
        })}

        {isStreaming && <StreamingIndicator />}
      </div>
    </div>
  );
}
