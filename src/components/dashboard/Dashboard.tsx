import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { useProjectStore } from '@/stores/project.store';
import { useStreamStore } from '@/stores/stream.store';
import { fetchRegisteredProjects, switchProject } from '@/services/project.service';
import { fetchStreams } from '@/services/stream.service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ProjectOverview } from '@/components/dashboard/ProjectOverview';
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState';
import { StreamCreationModal } from '@/components/dashboard/StreamCreationModal';

interface DashboardProps {
  onNavigateToStream: (streamName: string) => void;
  showCreateModal?: boolean;
  onCreateModalChange?: (open: boolean) => void;
}

export function Dashboard({ onNavigateToStream, showCreateModal, onCreateModalChange }: DashboardProps) {
  const registeredProjects = useProjectStore((s) => s.registeredProjects);
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const streams = useStreamStore((s) => s.streams);
  const activeStreamId = useStreamStore((s) => s.activeStreamId);

  // Local modal state, with optional external control
  const [localShowModal, setLocalShowModal] = useState(false);
  const isModalOpen = showCreateModal ?? localShowModal;
  const setModalOpen = onCreateModalChange ?? setLocalShowModal;

  // Fetch registered projects on mount
  useEffect(() => {
    fetchRegisteredProjects();
  }, []);

  // Fetch streams when active project changes
  useEffect(() => {
    if (activeProjectName) {
      fetchStreams(activeProjectName);
    }
  }, [activeProjectName]);

  // Memoize streams grouped by project
  const streamsByProject = useMemo(() => {
    const grouped: Record<string, typeof streams> = {};
    for (const stream of streams) {
      const key = stream.project;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(stream);
    }
    return grouped;
  }, [streams]);

  if (registeredProjects.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <div>
          <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
            Dashboard
          </h1>
          <p className="mt-0.5 text-[length:var(--text-sm)] text-interactive-muted">
            {registeredProjects.length} {registeredProjects.length === 1 ? 'project' : 'projects'} registered
          </p>
        </div>
        {activeProjectName && (
          <Button variant="default" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Stream
          </Button>
        )}
      </div>

      {/* Project Overview Cards */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {registeredProjects.map((project) => (
            <ProjectOverview
              key={project.name}
              project={project}
              streams={streamsByProject[project.name] ?? []}
              isActive={project.name === activeProjectName}
              activeStreamId={activeStreamId}
              onSelect={() => {
                if (project.name !== activeProjectName) {
                  switchProject(project.name, project.repoPath);
                }
              }}
              onNavigateToStream={onNavigateToStream}
              onCreateStream={() => setModalOpen(true)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Stream Creation Modal */}
      <StreamCreationModal
        open={isModalOpen}
        onOpenChange={setModalOpen}
        onStreamCreated={(streamName) => {
          setModalOpen(false);
          onNavigateToStream(streamName);
        }}
      />
    </div>
  );
}
