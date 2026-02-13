export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-1">
        <span className="animate-pulse text-interactive-default">●</span>
        <span
          className="animate-pulse text-interactive-default"
          style={{ animationDelay: '0.2s' }}
        >
          ●
        </span>
        <span
          className="animate-pulse text-interactive-default"
          style={{ animationDelay: '0.4s' }}
        >
          ●
        </span>
      </div>
    </div>
  );
}
