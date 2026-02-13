import { FolderOpen } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project.store';
import { openProject } from '@/services/project.service';
import { selectProjectFolder } from '@/services/dialog.service';

interface EmptyStateProps {
  onProjectOpened?: () => void;
}

export function EmptyState({ onProjectOpened }: EmptyStateProps) {
  const recentProjects = useProjectStore(s => s.recentProjects);

  const handleOpenFolder = useCallback(async () => {
    const folder = await selectProjectFolder();
    if (folder) {
      await openProject(folder);
      if (useProjectStore.getState().project) {
        onProjectOpened?.();
      }
    }
  }, [onProjectOpened]);

  const handleOpenRecent = useCallback(
    async (path: string) => {
      await openProject(path);
      if (useProjectStore.getState().project) {
        onProjectOpened?.();
      }
    },
    [onProjectOpened],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-surface-base p-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-surface-raised">
        <FolderOpen className="h-8 w-8 text-interactive-accent" />
      </div>

      <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
        BMAD Studio
      </h1>
      <p className="mt-2 text-[length:var(--text-md)] text-interactive-muted">
        Open a project folder to get started
      </p>

      {recentProjects.length > 0 && (
        <div className="mt-6 w-full max-w-[400px] text-left">
          <h3 className="mb-2 text-[length:var(--text-sm)] uppercase tracking-wide text-interactive-muted">
            Recent Projects
          </h3>
          {recentProjects.map(rp => (
            <div
              key={rp.path}
              className="cursor-pointer rounded-[var(--radius-md)] px-3 py-2 transition-colors duration-150 hover:bg-surface-raised"
              onClick={() => handleOpenRecent(rp.path)}
            >
              <div className="text-[length:var(--text-md)] text-interactive-active">
                {rp.name}
              </div>
              <div className="mt-0.5 max-w-[280px] truncate text-[length:var(--text-xs)] text-interactive-muted">
                {rp.path}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        size="lg"
        className="mt-6"
        onClick={handleOpenFolder}
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        Open Folder
      </Button>
    </div>
  );
}
