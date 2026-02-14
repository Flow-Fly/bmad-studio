import { useCallback, useEffect, useRef, useState } from 'react';

import { ActivityBar, type AppMode } from '@/components/layout/ActivityBar';
import { EmptyState } from '@/components/layout/EmptyState';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { StreamDetail } from '@/components/streams/StreamDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { SidecarStatus } from '@/components/layout/SidecarStatus';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProjectStore } from '@/stores/project.store';
import { useStreamStore } from '@/stores/stream.store';
import { useHasError } from '@/stores/sidecar.store';

interface AppShellProps {
  hasProject: boolean;
  onProjectOpened?: () => void;
}

export function AppShell({ hasProject, onProjectOpened }: AppShellProps) {
  const [activeMode, setActiveMode] = useState<AppMode>('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const hasBackendError = useHasError();
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const prevProjectRef = useRef(activeProjectName);

  // When active project changes, clear active stream and switch to dashboard
  useEffect(() => {
    if (prevProjectRef.current !== null && prevProjectRef.current !== activeProjectName) {
      useStreamStore.getState().setActiveStream(null);
      setActiveMode('dashboard');
    }
    prevProjectRef.current = activeProjectName;
  }, [activeProjectName]);

  // Cmd+N / Ctrl+N keyboard shortcut to open stream creation modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        if (activeProjectName) {
          e.preventDefault();
          setActiveMode('dashboard');
          setShowCreateModal(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProjectName]);

  // Cmd+K / Ctrl+K keyboard shortcut to toggle command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigateToStream = useCallback((streamName: string) => {
    useStreamStore.getState().setActiveStream(streamName);
    setActiveMode('stream');
  }, []);

  const handleNavigateToArtifact = useCallback(
    (streamName: string, _artifactPath: string, _phase?: string) => {
      useStreamStore.getState().setActiveStream(streamName);
      setActiveMode('stream');
      // StreamDetail will detect the stream change and show the graph view.
      // Artifact navigation within a stream is handled by StreamDetail's own state.
    },
    [],
  );

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  if (!hasProject) {
    return (
      <div className="flex min-h-screen min-w-[1024px] flex-row bg-surface-base">
        <EmptyState onProjectOpened={onProjectOpened} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-row bg-surface-base">
      <ActivityBar activeMode={activeMode} onModeChange={setActiveMode} />
      <TooltipProvider delayDuration={300}>
        <div className="flex min-w-0 flex-1 flex-col border-l-0">
          <SidecarStatus />
          {hasBackendError && (
            <div className="border-b border-warning bg-warning/10 px-4 py-2 text-sm text-warning">
              Backend is unavailable. Stream management and artifact tracking may not work.
            </div>
          )}
          {activeMode === 'dashboard' && (
            <Dashboard
              onNavigateToStream={handleNavigateToStream}
              showCreateModal={showCreateModal}
              onCreateModalChange={setShowCreateModal}
            />
          )}
          {activeMode === 'stream' && <StreamDetail />}
          {activeMode === 'settings' && <SettingsPanel />}
        </div>
      </TooltipProvider>
      {commandPaletteOpen && (
        <CommandPalette
          onClose={handleCloseCommandPalette}
          onNavigateToStream={handleNavigateToStream}
          onModeChange={setActiveMode}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onNavigateToArtifact={handleNavigateToArtifact}
        />
      )}
    </div>
  );
}
