import { OpenCodeSection } from './OpenCodeSection';

export function SettingsPanel() {
  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      <div className="max-w-4xl w-full mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-[length:var(--text-xl)] font-bold text-interactive-active">
            Settings
          </h1>
          <p className="mt-1 text-[length:var(--text-md)] text-interactive-muted">
            Configure BMAD Studio and integrations
          </p>
        </div>

        <OpenCodeSection />
      </div>
    </div>
  );
}
