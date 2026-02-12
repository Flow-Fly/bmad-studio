import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-8 w-full rounded-[var(--radius-md)] border border-border-primary bg-bg-primary px-3 text-[length:var(--text-sm)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
