export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-1">
        <span className="animate-pulse text-gray-600 dark:text-gray-400">●</span>
        <span
          className="animate-pulse text-gray-600 dark:text-gray-400"
          style={{ animationDelay: '0.2s' }}
        >
          ●
        </span>
        <span
          className="animate-pulse text-gray-600 dark:text-gray-400"
          style={{ animationDelay: '0.4s' }}
        >
          ●
        </span>
      </div>
    </div>
  );
}
