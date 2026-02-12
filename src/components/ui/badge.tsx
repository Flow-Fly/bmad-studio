import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent/20 text-accent',
        secondary: 'bg-bg-tertiary text-text-secondary',
        success: 'bg-success/20 text-success',
        warning: 'bg-warning/20 text-warning',
        destructive: 'bg-error/20 text-error',
        outline: 'border border-border-primary text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
