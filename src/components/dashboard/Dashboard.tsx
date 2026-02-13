import { useProjectStore } from '@/stores/project.store';
import { StreamList } from '@/components/streams/StreamList';

interface DashboardProps {
  onNavigateToStream: (streamName: string) => void;
}

export function Dashboard({ onNavigateToStream }: DashboardProps) {
  const projectName = useProjectStore((s) => s.project?.projectName);

  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      {/* Header */}
      <div className="border-b border-surface-border px-4 py-3">
        <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          Dashboard
        </h1>
        {projectName && (
          <p className="mt-0.5 text-[length:var(--text-sm)] text-interactive-muted">
            {projectName}
          </p>
        )}
      </div>

      {/* Stream List */}
      <StreamList onStreamSelect={onNavigateToStream} />
    </div>
  );
}
