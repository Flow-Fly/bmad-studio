import { WifiOff } from 'lucide-react';
import { useIsOffline } from '@/stores/connection.store';

export function OfflineBanner() {
  const isOffline = useIsOffline();

  if (!isOffline) return null;

  return (
    <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/5 px-4 py-1.5 text-[length:var(--text-sm)] text-warning">
      <WifiOff className="h-4 w-4" />
      <span>You're offline — view-only mode</span>
    </div>
  );
}
