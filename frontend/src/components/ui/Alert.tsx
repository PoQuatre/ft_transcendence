import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const alertVariants = cva(
  'relative w-full rounded-lg p-space-md border backdrop-blur-md flex items-start gap-space-sm',
  {
    variants: {
      variant: {
        default: 'bg-surface-1/70 border-border-subtle/60 text-text-primary',
        cyan: 'bg-accent-primary/10 border-accent-primary/40 text-text-primary shadow-glow-cyan-sm',
        destructive:
          'bg-error-background/20 border-error-border/40 text-error-foreground shadow-glow-pink-sm',
        warning:
          'bg-warning-foreground/10 border-warning-border/40 text-warning-foreground',
        success:
          'bg-success-foreground/10 border-success-border/40 text-success-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

export const Alert: Component<AlertProps> = (props) => {
  const rest = omit(props, 'variant', 'class');
  return (
    <div
      role="alert"
      class={cn(alertVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
};

export const AlertTitle: Component<ComponentProps<'h5'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <h5
      class={cn(
        'font-headline-md text-[15px] font-bold tracking-wide uppercase leading-none mb-1',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </h5>
  );
};

export const AlertDescription: Component<ComponentProps<'div'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <div
      class={cn(
        'font-body-sm text-body-sm text-text-secondary leading-relaxed',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
};
