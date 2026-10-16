import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 font-label-mono-caps text-[11px] font-bold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm',
        secondary: 'bg-accent-secondary/20 text-accent-secondary',
        tertiary: 'bg-accent-secondary-hover/20 text-accent-secondary-hover',
        success: 'bg-success-foreground/20 text-success-foreground',
        warning: 'bg-warning-foreground/20 text-warning-foreground',
        danger: 'bg-error-background/40 text-error-foreground',
        outline: 'border border-border-strong/40 text-text-muted',
        surface: 'bg-surface-1 text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeProps = ComponentProps<'div'> &
  VariantProps<typeof badgeVariants>;

export const Badge: Component<BadgeProps> = (props) => {
  const rest = omit(props, 'variant', 'class');

  return (
    <div
      class={cn(badgeVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
};
