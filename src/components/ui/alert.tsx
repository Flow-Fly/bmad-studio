import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-[var(--radius-md)] border px-4 py-3 text-[length:var(--text-sm)]',
  {
    variants: {
      variant: {
        default: 'border-border-primary bg-bg-secondary text-text-primary',
        destructive: 'border-error/50 bg-error/10 text-error',
        warning: 'border-warning/50 bg-warning/10 text-warning',
        success: 'border-success/50 bg-success/10 text-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant, className }))} {...props} />;
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[length:var(--text-sm)] opacity-80', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
