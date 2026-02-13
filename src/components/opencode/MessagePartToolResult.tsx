import type { ToolResultPart } from '../../types/message';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessagePartToolResultProps {
  part: ToolResultPart;
}

export function MessagePartToolResult({ part }: MessagePartToolResultProps) {
  const isError = part.isError === true;

  // Format the result for display
  let formattedResult: string;
  let isJson = false;
  if (typeof part.result === 'string') {
    try {
      const parsed = JSON.parse(part.result);
      formattedResult = JSON.stringify(parsed, null, 2);
      isJson = true;
    } catch {
      formattedResult = part.result;
    }
  } else if (part.result != null) {
    formattedResult = JSON.stringify(part.result, null, 2);
    isJson = true;
  } else {
    formattedResult = '';
  }

  return (
    <div
      className={cn(
        'ml-4 rounded border p-3',
        isError
          ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
          : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950'
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {isError ? (
          <>
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">Tool Error</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">Result</span>
          </>
        )}
      </div>

      <pre
        className={cn(
          'overflow-x-auto rounded p-2 text-xs',
          isError
            ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
            : 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
          isJson && 'font-mono'
        )}
      >
        {formattedResult}
      </pre>
    </div>
  );
}
