import { useMemo } from 'react';
import { GitBranch, Plus } from 'lucide-react';

import { useStreamStore } from '@/stores/stream.store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StreamCard } from '@/components/streams/StreamCard';

interface StreamListProps {
  onStreamSelect: (streamName: string) => void;
}

export function StreamList({ onStreamSelect }: StreamListProps) {
  const streams = useStreamStore((s) => s.streams);
  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const loading = useStreamStore((s) => s.loading);

  // Filter active streams and sort by updatedAt descending
  const activeStreams = useMemo(() => {
    return streams
      .filter((s) => s.status === 'active')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [streams]);

  if (loading) {
    return null; // No spinner per UX spec — data loads in <200ms from store
  }

  if (activeStreams.length === 0) {
    return <StreamListEmptyState />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-2">
        {activeStreams.map((stream) => (
          <StreamCard
            key={stream.name}
            stream={stream}
            isActive={stream.name === activeStreamId}
            onClick={() => onStreamSelect(stream.name)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function StreamListEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <GitBranch className="h-10 w-10 text-interactive-muted" />
      <div className="text-center">
        <p className="text-[length:var(--text-md)] font-medium text-interactive-active">
          No streams yet
        </p>
        <p className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
          Create your first stream to get started
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button disabled className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create your first stream
          </Button>
        </TooltipTrigger>
        <TooltipContent>Coming soon</TooltipContent>
      </Tooltip>
    </div>
  );
}
