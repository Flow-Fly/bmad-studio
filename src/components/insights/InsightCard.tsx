import { useState, useRef, useCallback } from 'react';
import type { Insight } from '../../types/insight';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const HIGHLIGHT_DOT_COLORS: Record<string, string> = {
  yellow: '#f0c040',
  green: '#40c057',
  red: '#e05252',
  blue: '#4a9eff',
};

const HIGHLIGHT_LABELS: Record<string, string> = {
  yellow: 'interesting',
  green: 'to-remember',
  red: 'disagree',
  blue: 'to-explore',
};

interface InsightCardProps {
  insight: Insight;
  expanded: boolean;
  onToggle: () => void;
  onInject: (insightId: string) => void;
  onUpdate: (updated: Insight) => void;
  onArchive: (insightId: string) => void;
  onDelete: (insightId: string) => void;
}

export function InsightCard({
  insight,
  expanded,
  onToggle,
  onInject,
  onUpdate,
  onArchive,
  onDelete,
}: InsightCardProps) {
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isArchived = insight.status === 'archived';

  const formatDate = (isoDate: string): string => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onUpdate({ ...insight, tags: insight.tags.filter(t => t !== tag) });
    },
    [insight, onUpdate],
  );

  const handleTagKeydown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && newTag.trim()) {
      onUpdate({ ...insight, tags: [...insight.tags, newTag.trim()] });
      setNewTag('');
      setEditingTags(false);
    }
    if (e.key === 'Escape') {
      setEditingTags(false);
      setNewTag('');
    }
  };

  const actionBtnClass =
    'inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-border-primary bg-transparent px-2 py-1 text-[length:var(--text-xs)] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

  return (
    <div
      className={cn(
        'cursor-pointer rounded-[var(--radius-md)] border border-border-primary bg-bg-elevated p-3 transition-colors hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
        isArchived && 'opacity-50',
      )}
      role="listitem"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={insight.title}
      onClick={onToggle}
      onKeyDown={handleKeydown}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
            insight.status === 'fresh' && 'bg-accent',
            insight.status === 'used' && 'border border-accent bg-accent/50',
            insight.status === 'archived' && 'bg-text-muted',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--text-md)] font-semibold text-text-primary">
            {insight.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[length:var(--text-xs)] text-text-secondary">
            <span>{insight.source_agent}</span>
            <span className="text-text-muted">&middot;</span>
            <span>{formatDate(insight.created_at)}</span>
            {insight.status === 'used' && (
              <>
                <span className="text-text-muted">&middot;</span>
                <span className="font-medium text-warning">
                  USED ({insight.used_in_count})
                </span>
              </>
            )}
          </div>
          {insight.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {insight.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full border border-border-primary px-2 py-0 text-[length:var(--text-xs)] text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {!expanded && (
            <div className="mt-2 line-clamp-2 text-[length:var(--text-sm)] leading-normal text-text-secondary">
              {insight.extracted_idea || insight.origin_context || 'No content'}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="mt-3 border-t border-border-secondary pt-3"
          onClick={e => e.stopPropagation()}
        >
          {insight.origin_context && (
            <>
              <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-text-tertiary">
                Origin Context
              </div>
              <div className="mb-3">
                <MarkdownRenderer content={insight.origin_context} />
              </div>
            </>
          )}

          {insight.extracted_idea && (
            <>
              <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-text-tertiary">
                Extracted Idea
              </div>
              <div className="mb-3">
                <MarkdownRenderer content={insight.extracted_idea} />
              </div>
            </>
          )}

          <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-text-tertiary">
            Tags
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1">
            {insight.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-border-primary px-2 py-0 text-[length:var(--text-xs)] text-text-secondary"
              >
                {tag}
                <button
                  className="ml-0.5 cursor-pointer border-none bg-transparent p-0 text-[length:var(--text-xs)] text-text-muted hover:text-text-primary"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
            {editingTags ? (
              <Input
                ref={tagInputRef}
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={handleTagKeydown}
                onBlur={() => {
                  setEditingTags(false);
                  setNewTag('');
                }}
                placeholder="Add tag..."
                className="h-6 w-24 text-[length:var(--text-xs)]"
                autoFocus
              />
            ) : (
              <button
                className={actionBtnClass}
                onClick={() => setEditingTags(true)}
                aria-label="Add tag"
              >
                + Tag
              </button>
            )}
          </div>

          {insight.highlight_colors_used.length > 0 && (
            <>
              <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-wider text-text-tertiary">
                Highlight Colors Used
              </div>
              <div className="mb-3 flex gap-1">
                {insight.highlight_colors_used.map(color => (
                  <span
                    key={color}
                    className="h-3 w-3 rounded-full border border-border-primary"
                    style={{
                      backgroundColor: HIGHLIGHT_DOT_COLORS[color] ?? color,
                    }}
                    title={HIGHLIGHT_LABELS[color] ?? color}
                    aria-label={`Highlight: ${HIGHLIGHT_LABELS[color] ?? color}`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex gap-2 border-t border-border-secondary pt-2">
            <button
              className={actionBtnClass}
              onClick={() => onInject(insight.id)}
              aria-label="Inject insight into conversation"
            >
              Inject
            </button>
            <button
              className={actionBtnClass}
              onClick={() => {
                if (insight.status === 'archived') {
                  onUpdate({ ...insight, status: 'fresh' });
                } else {
                  onArchive(insight.id);
                }
              }}
              aria-label={
                insight.status === 'archived'
                  ? 'Unarchive insight'
                  : 'Archive insight'
              }
            >
              {insight.status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
            <button
              className={cn(actionBtnClass, 'hover:border-error hover:text-error')}
              onClick={() => onDelete(insight.id)}
              aria-label="Delete insight"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
