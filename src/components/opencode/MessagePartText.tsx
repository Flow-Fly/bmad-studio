import type { TextPart } from '../../types/message';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface MessagePartTextProps {
  part: TextPart;
}

export function MessagePartText({ part }: MessagePartTextProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <MarkdownRenderer content={part.text} />
    </div>
  );
}
