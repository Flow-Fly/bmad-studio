import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg-primary hover:bg-accent-hover',
        secondary: 'bg-bg-tertiary text-text-primary hover:bg-bg-elevated',
        outline: 'border border-border-primary bg-transparent text-text-primary hover:bg-bg-tertiary',
        ghost: 'bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
        destructive: 'bg-error text-white hover:bg-error/80',
      },
      size: {
        sm: 'h-7 px-2 text-[length:var(--text-xs)]',
        md: 'h-8 px-3',
        lg: 'h-10 px-4 text-[length:var(--text-md)]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
