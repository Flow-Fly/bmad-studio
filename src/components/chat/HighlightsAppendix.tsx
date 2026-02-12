import { useState, useMemo, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Highlight, Message, HighlightColor } from '../../types/conversation';
import { HIGHLIGHT_COLORS } from '../../types/conversation';
import { cn } from '../../lib/utils';

const COLOR_ORDER: HighlightColor[] = ['yellow', 'green', 'red', 'blue'];

const SECTION_COLORS: Record<HighlightColor, string> = {
  yellow: '#f0c040',
  green: '#40c057',
  red: '#e05252',
  blue: '#4a9eff',
};

interface HighlightItem {
  id: string;
  color: HighlightColor;
  text: string;
  label: string;
}

interface HighlightsAppendixProps {
  highlights: Highlight[];
  messages: Message[];
  onGetEnrichmentText?: (text: string) => void;
}

export function HighlightsAppendix({ highlights, messages }: HighlightsAppendixProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const items = useMemo<HighlightItem[]>(() => {
    const result: HighlightItem[] = [];
    for (const h of highlights) {
      if (dismissedIds.has(h.id)) continue;
      const msg = messages.find(m => m.id === h.messageId);
      if (!msg) continue;
      const text = msg.content.slice(h.startOffset, h.endOffset);
      if (!text) continue;
      result.push({ id: h.id, color: h.color, text, label: HIGHLIGHT_COLORS[h.color] });
    }
    return result;
  }, [highlights, messages, dismissedIds]);

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  if (items.length === 0) return null;

  // Group by color
  const grouped = new Map<HighlightColor, HighlightItem[]>();
  for (const item of items) {
    if (!grouped.has(item.color)) grouped.set(item.color, []);
    grouped.get(item.color)!.push(item);
  }

  return (
    <div className="mx-4 max-h-[200px] overflow-y-auto rounded-t-[var(--radius-md)] border border-b-0 border-border-primary bg-bg-secondary">
      <div
        className="flex cursor-pointer select-none items-center gap-1 px-2 py-1 text-[length:var(--text-xs)] font-medium text-text-secondary hover:text-text-primary"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform duration-200', !collapsed && 'rotate-90')}
        />
        <span>Highlights ({items.length})</span>
      </div>
      {!collapsed && (
        <div className="px-2 pb-2">
          {COLOR_ORDER.filter(c => grouped.has(c)).map(color => (
            <div key={color}>
              <div className="mt-1 mb-0.5 flex items-center gap-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-text-tertiary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: SECTION_COLORS[color] }}
                />
                {HIGHLIGHT_COLORS[color]}
              </div>
              {grouped.get(color)!.map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-1 py-0.5 text-[length:var(--text-xs)] leading-normal text-text-primary"
                >
                  <span className="min-w-0 flex-1 truncate" title={item.text}>
                    {item.text}
                  </span>
                  <button
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-[10px] leading-none text-text-muted hover:bg-bg-tertiary hover:text-text-primary cursor-pointer"
                    onClick={() => dismiss(item.id)}
                    aria-label="Dismiss highlight"
                    title="Dismiss"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Utility to compute enrichment text from highlights (call from parent) */
export function getHighlightEnrichmentText(
  highlights: Highlight[],
  messages: Message[],
  dismissedIds: Set<string> = new Set(),
): string {
  const items: { label: string; text: string }[] = [];
  for (const h of highlights) {
    if (dismissedIds.has(h.id)) continue;
    const msg = messages.find(m => m.id === h.messageId);
    if (!msg) continue;
    const text = msg.content.slice(h.startOffset, h.endOffset);
    if (!text) continue;
    items.push({ label: HIGHLIGHT_COLORS[h.color], text });
  }
  if (items.length === 0) return '';
  const lines = ['\n---\nHighlighted sections:'];
  for (const item of items) {
    lines.push(`- [${item.label}]: "${item.text}"`);
  }
  return lines.join('\n');
}
