import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2 py-0.5 font-label-mono-caps text-[11px] font-bold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-primary-container/20 text-primary-container shadow-[0_0_10px_rgba(0,240,255,0.3)]',
        secondary: 'bg-secondary-container/20 text-secondary',
        tertiary: 'bg-tertiary-fixed-dim/20 text-tertiary-fixed',
        success: 'bg-[#39ff14]/20 text-[#39ff14]',
        warning: 'bg-[#ffb703]/20 text-[#ffb703]',
        danger: 'bg-error-container/40 text-error',
        outline: 'border border-outline/40 text-outline',
        surface: 'bg-surface-container-low text-on-surface-variant',
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
