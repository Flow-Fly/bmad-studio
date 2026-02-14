import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GitBranch,
  FolderOpen,
  FileText,
  Plus,
  Settings,
  Clock,
} from 'lucide-react';

import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { useStreamStore } from '@/stores/stream.store';
import { useProjectStore } from '@/stores/project.store';
import { useRecentItems, addRecentItem } from '@/hooks/useRecentItems';
import { listArtifacts } from '@/services/artifact.service';
import { capitalize } from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import type { ArtifactInfo } from '@/types/artifact';
import type { AppMode } from '@/components/layout/ActivityBar';

interface CommandPaletteProps {
  onClose: () => void;
  onNavigateToStream: (streamName: string) => void;
  onModeChange: (mode: AppMode) => void;
  onOpenCreateModal: () => void;
  onNavigateToArtifact?: (streamName: string, artifactPath: string, phase?: string) => void;
}

export function CommandPalette({
  onClose,
  onNavigateToStream,
  onModeChange,
  onOpenCreateModal,
  onNavigateToArtifact,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  const streams = useStreamStore((s) => s.streams);
  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const registeredProjects = useProjectStore((s) => s.registeredProjects);
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const { recentItems } = useRecentItems();

  // Fetch artifacts for the active stream
  useEffect(() => {
    if (!activeStreamId || !activeProjectName) {
      setArtifacts([]);
      return;
    }

    let cancelled = false;
    listArtifacts(activeProjectName, activeStreamId)
      .then((result) => {
        if (!cancelled) setArtifacts(result);
      })
      .catch(() => {
        if (!cancelled) setArtifacts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStreamId, activeProjectName]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  // Handle stream selection
  const handleSelectStream = useCallback(
    (streamName: string) => {
      const stream = streams.find((s) => s.name === streamName);
      if (stream && activeProjectName) {
        addRecentItem({ type: 'stream', name: stream.name, project: activeProjectName });
      }
      onNavigateToStream(streamName);
      onClose();
    },
    [streams, activeProjectName, onNavigateToStream, onClose],
  );

  // Handle project selection
  const handleSelectProject = useCallback(
    (projectName: string) => {
      useProjectStore.getState().setActiveProject(projectName);
      onModeChange('dashboard');
      onClose();
    },
    [onModeChange, onClose],
  );

  // Handle artifact selection
  const handleSelectArtifact = useCallback(
    (artifact: ArtifactInfo) => {
      if (activeStreamId && activeProjectName) {
        addRecentItem({
          type: 'artifact',
          filename: artifact.filename,
          streamName: activeStreamId,
          project: activeProjectName,
        });
      }
      if (onNavigateToArtifact && activeStreamId) {
        onNavigateToArtifact(activeStreamId, artifact.filename, artifact.phase);
      }
      onClose();
    },
    [activeStreamId, activeProjectName, onNavigateToArtifact, onClose],
  );

  // Handle create stream action
  const handleCreateStream = useCallback(() => {
    onModeChange('dashboard');
    onOpenCreateModal();
    onClose();
  }, [onModeChange, onOpenCreateModal, onClose]);

  // Handle open settings action
  const handleOpenSettings = useCallback(() => {
    onModeChange('settings');
    onClose();
  }, [onModeChange, onClose]);

  // Handle recent item selection
  const handleSelectRecent = useCallback(
    (item: (typeof recentItems)[number]) => {
      if (item.type === 'stream') {
        handleSelectStream(item.name);
      } else if (item.type === 'artifact' && onNavigateToArtifact) {
        addRecentItem(item);
        onNavigateToArtifact(item.streamName, item.filename);
        onClose();
      }
    },
    [handleSelectStream, onNavigateToArtifact, onClose],
  );

  // Filter recent items to only show items that still exist
  const validRecentItems = recentItems.filter((item) => {
    if (item.type === 'stream') {
      return streams.some((s) => s.name === item.name);
    }
    if (item.type === 'artifact') {
      return streams.some((s) => s.name === item.streamName);
    }
    return false;
  });

  const activeStreams = streams.filter((s) => s.status === 'active');
  const showRecent = !search && validRecentItems.length > 0;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[calc(var(--bmad-z-modal)+10)] flex justify-center bg-black/60 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={cn(
          'mt-[20vh] h-fit w-full max-w-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-surface-border bg-surface-raised shadow-lg',
          'max-[1440px]:max-w-[480px]',
          'motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200',
        )}
      >
        <Command
          aria-label="Command palette"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <CommandInput
            placeholder="Search streams, artifacts, actions..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results for &apos;{search}&apos;</CommandEmpty>

            {/* Recent items — shown only when no search text */}
            {showRecent && (
              <CommandGroup heading="Recent">
                {validRecentItems.map((item, index) => {
                  if (item.type === 'stream') {
                    const stream = streams.find((s) => s.name === item.name);
                    return (
                      <CommandItem
                        key={`recent-stream-${item.name}-${index}`}
                        value={`recent ${item.name} ${stream?.phase ?? ''}`}
                        onSelect={() => handleSelectRecent(item)}
                      >
                        <Clock className="h-4 w-4 shrink-0 text-interactive-muted" />
                        <span className="truncate">{item.name}</span>
                        {stream?.phase && (
                          <span className="ml-auto truncate text-[length:var(--text-xs)] text-interactive-muted">
                            {capitalize(stream.phase)}
                          </span>
                        )}
                      </CommandItem>
                    );
                  }
                  if (item.type === 'artifact') {
                    return (
                      <CommandItem
                        key={`recent-artifact-${item.filename}-${item.streamName}-${index}`}
                        value={`recent ${item.filename} ${item.streamName}`}
                        onSelect={() => handleSelectRecent(item)}
                      >
                        <Clock className="h-4 w-4 shrink-0 text-interactive-muted" />
                        <span className="truncate">{item.filename}</span>
                        <span className="ml-auto truncate text-[length:var(--text-xs)] text-interactive-muted">
                          {item.streamName}
                        </span>
                      </CommandItem>
                    );
                  }
                  return null;
                })}
              </CommandGroup>
            )}

            {/* Streams group */}
            {activeStreams.length > 0 && (
              <CommandGroup heading="Streams">
                {activeStreams.map((stream) => (
                  <CommandItem
                    key={`stream-${stream.name}`}
                    value={`stream ${stream.name} ${stream.phase ?? ''}`}
                    onSelect={() => handleSelectStream(stream.name)}
                  >
                    <GitBranch className="h-4 w-4 shrink-0 text-interactive-muted" />
                    <span className="truncate">{stream.name}</span>
                    {stream.phase && (
                      <span className="ml-auto truncate text-[length:var(--text-xs)] text-interactive-muted">
                        {capitalize(stream.phase)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Projects group */}
            {registeredProjects.length > 0 && (
              <CommandGroup heading="Projects">
                {registeredProjects.map((project) => (
                  <CommandItem
                    key={`project-${project.name}`}
                    value={`project ${project.name} ${project.repoPath}`}
                    onSelect={() => handleSelectProject(project.name)}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-interactive-muted" />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto truncate text-[length:var(--text-xs)] text-interactive-muted">
                      {project.repoPath}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Artifacts group */}
            {artifacts.length > 0 && (
              <CommandGroup heading="Artifacts">
                {artifacts
                  .filter((a) => a.type === 'file')
                  .map((artifact) => (
                    <CommandItem
                      key={`artifact-${artifact.filename}`}
                      value={`artifact ${artifact.filename} ${artifact.phase}`}
                      onSelect={() => handleSelectArtifact(artifact)}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-interactive-muted" />
                      <span className="truncate">{artifact.filename}</span>
                      <span className="ml-auto truncate text-[length:var(--text-xs)] text-interactive-muted">
                        {capitalize(artifact.phase)}
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {/* Actions group */}
            <CommandGroup heading="Actions">
              <CommandItem
                value="action create stream new add"
                keywords={['new', 'add']}
                onSelect={handleCreateStream}
              >
                <Plus className="h-4 w-4 shrink-0 text-interactive-muted" />
                <span>Create Stream</span>
              </CommandItem>
              <CommandItem
                value="action open settings preferences"
                keywords={['preferences', 'config']}
                onSelect={handleOpenSettings}
              >
                <Settings className="h-4 w-4 shrink-0 text-interactive-muted" />
                <span>Open Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
