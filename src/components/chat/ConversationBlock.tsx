import { useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, Copy, Check, ChevronRight } from 'lucide-react';
import type { Message, Highlight, HighlightColor, MessageBlock } from '../../types/conversation';
import { HIGHLIGHT_COLORS } from '../../types/conversation';
import { useChatStore } from '../../stores/chat.store';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { HighlightPopover } from './HighlightPopover';
import { ToolCallBlock } from './ToolCallBlock';
import { cn } from '../../lib/utils';

const HIGHLIGHT_TINTS: Record<HighlightColor, string> = {
  yellow: 'rgba(240, 192, 64, 0.3)',
  green: 'rgba(64, 192, 87, 0.3)',
  red: 'rgba(224, 82, 82, 0.3)',
  blue: 'rgba(74, 158, 255, 0.3)',
};

interface ConversationBlockProps {
  message: Message;
  conversationId: string;
  highlights: Highlight[];
  onRetry?: () => void;
  onExtractHighlightToInsight?: (detail: {
    highlightId: string;
    color: string;
    text: string;
    messageRole: string;
    messageContent: string;
  }) => void;
}

export function ConversationBlock({
  message,
  conversationId,
  highlights,
  onRetry,
  onExtractHighlightToInsight,
}: ConversationBlockProps) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [cachedSelectedText, setCachedSelectedText] = useState('');
  const [highlightMenu, setHighlightMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    highlight: Highlight | null;
    text: string;
  }>({ open: false, x: 0, y: 0, highlight: null, text: '' });

  const addHighlight = useChatStore(s => s.addHighlight);
  const removeHighlight = useChatStore(s => s.removeHighlight);

  // Skip context messages
  if (message.isContext) return null;

  const isUser = message.role === 'user';
  const isError = message.role === 'assistant' && message.content.startsWith('Error: ');
  const hasCopyableContent = !message.isStreaming || !!message.content;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* silent */ }
  };

  const messageHighlights = highlights.filter(h => h.messageId === message.id);

  // No shadow DOM — just `window.getSelection()` works!
  const handleContentMouseUp = () => {
    if (message.isStreaming) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;

    setCachedSelectedText(selectedText);
    const rect = range.getBoundingClientRect();
    setPopoverPos({ x: rect.right, y: rect.bottom + 4 });
    setShowPopover(true);
  };

  const handleHighlightSelect = useCallback(
    (color: HighlightColor) => {
      if (!cachedSelectedText) {
        setShowPopover(false);
        return;
      }
      const startOffset = message.content.indexOf(cachedSelectedText);
      if (startOffset === -1) {
        setShowPopover(false);
        return;
      }
      const highlight: Highlight = {
        id: crypto.randomUUID(),
        messageId: message.id,
        startOffset,
        endOffset: startOffset + cachedSelectedText.length,
        color,
      };
      addHighlight(conversationId, highlight);
      setCachedSelectedText('');
      window.getSelection()?.removeAllRanges();
      setShowPopover(false);
    },
    [cachedSelectedText, message.id, message.content, conversationId, addHighlight],
  );

  const handleHighlightClick = (e: React.MouseEvent, h: Highlight) => {
    e.stopPropagation();
    const text = message.content.slice(h.startOffset, h.endOffset);
    setHighlightMenu({ open: true, x: e.clientX, y: e.clientY, highlight: h, text });
  };

  const closeHighlightMenu = () =>
    setHighlightMenu({ open: false, x: 0, y: 0, highlight: null, text: '' });

  const renderHighlightedText = (text: string) => {
    if (!messageHighlights.length) return <>{text}</>;
    const sorted = [...messageHighlights].sort((a, b) => a.startOffset - b.startOffset);
    const parts: React.ReactNode[] = [];
    let lastEnd = 0;
    for (const h of sorted) {
      const start = Math.max(h.startOffset, lastEnd);
      const end = Math.min(h.endOffset, text.length);
      if (start >= end) continue;
      if (start > lastEnd) parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd, start)}</span>);
      parts.push(
        <mark
          key={h.id}
          className="cursor-pointer rounded-[2px] p-0"
          style={{ backgroundColor: HIGHLIGHT_TINTS[h.color] }}
          aria-label={HIGHLIGHT_COLORS[h.color]}
          onClick={(e) => handleHighlightClick(e, h)}
        >
          {text.slice(start, end)}
        </mark>,
      );
      lastEnd = end;
    }
    if (lastEnd < text.length) parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd)}</span>);
    return <>{parts}</>;
  };

  const renderBlock = (block: MessageBlock) => {
    switch (block.type) {
      case 'text':
        return <MarkdownRenderer content={block.content} onLinkClick={(url) => window.open(url, '_blank')} />;
      case 'thinking':
        return null; // rendered via thinkingSection
      case 'tool':
        return <ToolCallBlock block={block} />;
    }
  };

  const renderThinkingSection = () => {
    if (!message.thinkingContent || message.role !== 'assistant') return null;
    return (
      <div className="my-1">
        <button
          className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[length:var(--text-xs)] text-text-tertiary transition-colors hover:text-text-secondary focus-visible:rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => setThinkingExpanded(!thinkingExpanded)}
          aria-expanded={thinkingExpanded}
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform duration-200', thinkingExpanded && 'rotate-90')}
          />
          <span>{thinkingExpanded ? 'Hide thinking' : 'Show thinking'}</span>
        </button>
        <div
          className={cn(
            'overflow-hidden rounded-[var(--radius-md)] bg-bg-tertiary text-[length:var(--text-sm)] text-text-secondary transition-all duration-200',
            thinkingExpanded ? 'mt-1 max-h-[2000px] p-2 opacity-100' : 'max-h-0 p-0 opacity-0',
          )}
          role="region"
          aria-label="Agent thinking process"
        >
          <MarkdownRenderer content={message.thinkingContent} onLinkClick={(url) => window.open(url, '_blank')} />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (message.isStreaming && !message.content && !message.blocks?.length) {
      return (
        <div className="flex gap-1 py-1" aria-label="Assistant is typing">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      );
    }
    if (isError) {
      const errorMsg = message.content.replace(/^Error:\s*/, '');
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[length:var(--text-sm)] text-error">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-border-primary bg-transparent px-2 py-1 text-[length:var(--text-sm)] text-text-secondary transition-colors hover:border-text-tertiary hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onRetry}
            aria-label="Retry sending message"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      );
    }
    if (message.role === 'assistant' && message.blocks?.length) {
      return (
        <>
          {renderThinkingSection()}
          <div onMouseUp={handleContentMouseUp}>
            {message.blocks.map((block, i) => (
              <div key={block.id || i}>{renderBlock(block)}</div>
            ))}
          </div>
          {message.isPartial && (
            <span className="text-[length:var(--text-xs)] italic text-warning">Response was interrupted</span>
          )}
        </>
      );
    }
    return (
      <>
        {renderThinkingSection()}
        <div onMouseUp={handleContentMouseUp}>
          {isUser ? (
            <div>{renderHighlightedText(message.content)}</div>
          ) : (
            <MarkdownRenderer content={message.content} onLinkClick={(url) => window.open(url, '_blank')} />
          )}
        </div>
        {message.isPartial && (
          <span className="text-[length:var(--text-xs)] italic text-warning">Response was interrupted</span>
        )}
      </>
    );
  };

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 px-4 py-2',
        isUser ? 'bg-accent/8' : 'bg-bg-secondary',
        isError && 'border-l-[3px] border-error',
      )}
      role="listitem"
    >
      {hasCopyableContent && !isError && (
        <button
          className={cn(
            'absolute right-2 top-1 inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border-none bg-bg-elevated p-1 text-[length:var(--text-xs)] leading-none text-text-tertiary opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'group-hover/msg:opacity-100',
            copied && 'text-success',
          )}
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy message'}
          style={{ opacity: undefined }}
        >
          {copied ? <><Check className="h-3.5 w-3.5" /> <span className="text-success">Copied!</span></> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[length:var(--text-sm)] font-medium text-text-secondary">
          {isUser ? 'You' : 'Assistant'}
        </span>
        <span className="text-[length:var(--text-xs)] text-text-tertiary">
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div className="text-[length:var(--text-md)] leading-normal text-text-primary">
        {renderContent()}
      </div>

      <HighlightPopover
        x={popoverPos.x}
        y={popoverPos.y}
        open={showPopover}
        onSelect={handleHighlightSelect}
        onDismiss={() => { setShowPopover(false); setCachedSelectedText(''); }}
      />

      {highlightMenu.open && (
        <div
          className="fixed z-[var(--bmad-z-dropdown)] flex flex-col gap-0.5 rounded-[var(--radius-md)] border border-border-primary bg-bg-elevated p-1 shadow-md"
          style={{
            left: Math.min(highlightMenu.x, window.innerWidth - 180),
            top: Math.min(highlightMenu.y, window.innerHeight - 80),
          }}
        >
          <button
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border-none bg-transparent px-2 py-1 text-[length:var(--text-xs)] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            onClick={() => {
              if (highlightMenu.highlight && onExtractHighlightToInsight) {
                onExtractHighlightToInsight({
                  highlightId: highlightMenu.highlight.id,
                  color: highlightMenu.highlight.color,
                  text: highlightMenu.text,
                  messageRole: message.role,
                  messageContent: message.content,
                });
              }
              closeHighlightMenu();
            }}
          >
            Extract to Insight
          </button>
          <button
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border-none bg-transparent px-2 py-1 text-[length:var(--text-xs)] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-error"
            onClick={() => {
              if (highlightMenu.highlight) {
                removeHighlight(conversationId, highlightMenu.highlight.id);
              }
              closeHighlightMenu();
            }}
          >
            Remove Highlight
          </button>
        </div>
      )}
    </div>
  );
}
