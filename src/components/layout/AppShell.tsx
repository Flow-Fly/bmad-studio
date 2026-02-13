import { useCallback, useState } from 'react';

import { ActivityBar, type AppMode } from '@/components/layout/ActivityBar';
import { EmptyState } from '@/components/layout/EmptyState';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { StreamDetail } from '@/components/streams/StreamDetail';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { useStreamStore } from '@/stores/stream.store';

interface AppShellProps {
  hasProject: boolean;
  onProjectOpened?: () => void;
}

export function AppShell({ hasProject, onProjectOpened }: AppShellProps) {
  const [activeMode, setActiveMode] = useState<AppMode>('dashboard');

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
      <div className="flex min-w-0 flex-1 flex-col border-l-0">
        {activeMode === 'dashboard' && (
          <Dashboard onNavigateToStream={handleNavigateToStream} />
        )}
        {activeMode === 'stream' && <StreamDetail />}
        {activeMode === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}
