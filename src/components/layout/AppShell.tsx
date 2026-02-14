import { useCallback, useEffect, useRef, useState } from 'react';

import { ActivityBar, type AppMode } from '@/components/layout/ActivityBar';
import { EmptyState } from '@/components/layout/EmptyState';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { StreamDetail } from '@/components/streams/StreamDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { SidecarStatus } from '@/components/layout/SidecarStatus';
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

  const handleNavigateToStream = useCallback((streamName: string) => {
    useStreamStore.getState().setActiveStream(streamName);
    setActiveMode('stream');
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
            <Dashboard onNavigateToStream={handleNavigateToStream} />
          )}
          {activeMode === 'stream' && <StreamDetail />}
          {activeMode === 'settings' && <SettingsPanel />}
        </div>
      </TooltipProvider>
    </div>
  );
}
