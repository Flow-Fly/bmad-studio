import { GitBranch } from 'lucide-react';

export function StreamDetail() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-surface-base text-interactive-default">
      <GitBranch className="mb-4 h-12 w-12 text-interactive-muted" />
      <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
        Stream Detail
      </h1>
      <p className="mt-2 text-[length:var(--text-md)] text-interactive-muted">
        Stream phase graph and details coming soon
      </p>
    </div>
  );
}
