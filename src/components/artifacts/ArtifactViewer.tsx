import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { readArtifact } from '../../services/artifact.service';
import { useStreamStore } from '../../stores/stream.store';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface ArtifactViewerProps {
  artifactPath: string;
  phase?: string;
  onBack: () => void;
}

export function ArtifactViewer({ artifactPath, phase, onBack }: ArtifactViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const streams = useStreamStore((s) => s.streams);
  const stream = streams.find((s) => s.name === activeStreamId);

  const filename = artifactPath.split('/').pop() ?? artifactPath;
  const isMarkdown = filename.endsWith('.md');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!stream?.project || !activeStreamId) {
        setError('No active stream or project');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const text = await readArtifact(stream.project, activeStreamId, artifactPath);
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifact');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [artifactPath, stream?.project, activeStreamId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <button
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-sm)] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          onClick={onBack}
          aria-label="Back to Phase Graph"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="h-4 w-px bg-surface-border" aria-hidden="true" />
        <FileText className="h-4 w-4 shrink-0 text-interactive-muted" />
        <span className="truncate text-[length:var(--text-sm)] font-medium text-text-primary">
          {filename}
        </span>
        {phase && (
          <Badge variant="outline" className="shrink-0">
            {phase}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-interactive-muted" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <p className="text-[length:var(--text-sm)] text-status-blocked">{error}</p>
          </div>
        )}
        {!loading && !error && content !== null && (
          <div className={cn('mx-auto max-w-4xl', !isMarkdown && 'font-mono')}>
            {isMarkdown ? (
              <MarkdownRenderer content={content} />
            ) : (
              <pre className="whitespace-pre-wrap text-[length:var(--text-sm)] text-text-primary">
                {content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
