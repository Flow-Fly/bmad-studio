import { Settings } from 'lucide-react';

export function SettingsPanel() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-surface-base text-interactive-default">
      <Settings className="mb-4 h-12 w-12 text-interactive-muted" />
      <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
        Settings
      </h1>
      <p className="mt-2 text-[length:var(--text-md)] text-interactive-muted">
        Application settings coming soon
      </p>
    </div>
  );
}
