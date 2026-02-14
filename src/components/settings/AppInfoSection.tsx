import { Info, Monitor } from 'lucide-react';

function getAppVersion(): string {
  // Check Electron context first
  if (
    typeof window !== 'undefined' &&
    'electronAPI' in window &&
    window.electronAPI &&
    typeof (window.electronAPI as Record<string, unknown>).getAppVersion === 'function'
  ) {
    return String((window.electronAPI as Record<string, unknown>).getAppVersion());
  }
  return 'Development';
}

function getPlatform(): string {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    return navigator.platform;
  }
  return 'Unknown';
}

function getElectronVersion(): string | null {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const match = navigator.userAgent.match(/Electron\/([\d.]+)/);
    if (match) return match[1];
  }
  return null;
}

export function AppInfoSection() {
  const version = getAppVersion();
  const platform = getPlatform();
  const electronVersion = getElectronVersion();

  const infoItems = [
    { label: 'Version', value: version },
    { label: 'Platform', value: platform },
    ...(electronVersion
      ? [{ label: 'Electron', value: electronVersion }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          Application Info
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
          Build and environment details
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-overlay p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-interactive-muted" />
          <div className="flex-1 space-y-3">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[length:var(--text-sm)] text-interactive-muted w-24">
                  {item.label}
                </span>
                <span className="text-[length:var(--text-sm)] font-medium text-interactive-default">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-5 w-5 text-interactive-muted" />
            <div className="flex-1">
              <div className="text-[length:var(--text-sm)] text-interactive-muted">
                BMAD Studio — AI workflow orchestration for software development
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
