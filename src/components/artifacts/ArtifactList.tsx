import { useState, useEffect } from 'react';
import { FileText, Folder, Loader2 } from 'lucide-react';
import { listArtifacts } from '../../services/artifact.service';
import { useStreamStore } from '../../stores/stream.store';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { ArtifactInfo } from '../../types/artifact';

interface ArtifactListProps {
  onSelectArtifact: (artifactPath: string, phase: string) => void;
}

export function ArtifactList({ onSelectArtifact }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const streams = useStreamStore((s) => s.streams);
  const stream = streams.find((s) => s.name === activeStreamId);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!stream?.project || !activeStreamId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await listArtifacts(stream.projectId, activeStreamId);
        if (!cancelled) {
          setArtifacts(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load artifacts');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [stream?.project, activeStreamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-interactive-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-status-blocked">
        {error}
      </p>
    );
  }

  if (artifacts.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[length:var(--text-sm)] text-interactive-muted">
        No artifacts yet
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 p-2" role="list" aria-label="Artifacts">
      {artifacts.map((artifact) => {
        const isFile = artifact.type === 'file';
        const Icon = isFile ? FileText : Folder;

        return (
          <li key={artifact.filename}>
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors',
                isFile
                  ? 'hover:bg-bg-tertiary'
                  : 'cursor-default opacity-70',
              )}
              onClick={() => {
                if (isFile) {
                  onSelectArtifact(artifact.filename, artifact.phase);
                }
              }}
              disabled={!isFile}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-interactive-muted" />
              <span className="flex-1 truncate text-[length:var(--text-sm)] text-text-primary">
                {artifact.filename}
              </span>
              <Badge variant="outline" className="shrink-0">
                {artifact.phase}
              </Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
