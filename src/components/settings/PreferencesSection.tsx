import { Settings2, FolderOpen } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { useSettingsStore } from '../../stores/settings.store';

export function PreferencesSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const error = useSettingsStore((s) => s.error);

  const worktreeEnabled = settings?.default_worktree_creation ?? true;
  const artifactStorePath = settings?.artifact_store_path || '~/.bmad-studio';

  const handleWorktreeToggle = (checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    updateSettings({ default_worktree_creation: checked });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          Global Preferences
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
          Configure default behaviors for BMAD Studio
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-overlay p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 text-interactive-muted" />
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="worktree-toggle"
                checked={worktreeEnabled}
                onCheckedChange={handleWorktreeToggle}
              />
              <label
                htmlFor="worktree-toggle"
                className="text-[length:var(--text-md)] font-medium text-interactive-default cursor-pointer select-none"
              >
                Create worktree for new streams by default
              </label>
            </div>
            <p className="text-[length:var(--text-sm)] text-interactive-muted">
              When enabled, a Git worktree is automatically created for each new stream
            </p>
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="mt-0.5 h-5 w-5 text-interactive-muted" />
            <div className="flex-1">
              <div className="text-[length:var(--text-md)] font-medium text-interactive-default">
                Artifact Store Path
              </div>
              <code className="mt-1 block text-[length:var(--text-sm)] font-mono text-interactive-muted">
                {artifactStorePath}
              </code>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-[length:var(--text-sm)] text-error-default">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
