/* ARIA progressbar on a div: a native <progress> cannot be themed or split into blocks. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

// Fill colour only: the track (size, background) is styled by each component,
// so these classes never override the fill's own height.
export const progressVariants = cva('', {
  variants: {
    color: {
      cyan: 'bg-accent-primary',
      pink: 'bg-accent-secondary',
      lime: 'bg-success-foreground',
      amber: 'bg-warning-foreground',
      purple: 'bg-accent-secondary-hover',
    },
  },
  defaultVariants: {
    color: 'cyan',
  },
});

export type ProgressProps = ComponentProps<'div'> &
  VariantProps<typeof progressVariants> & {
    value?: number;
    max?: number;
  };

/** Share of `max` reached by `value`, clamped between 0 and 1. */
export function progressRatio(value = 0, max = 100) {
  if (max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

export const Progress: Component<ProgressProps> = (props) => {
  const rest = omit(props, 'value', 'max', 'color', 'class');
  const max = () => props.max ?? 100;
  const ratio = () => progressRatio(props.value, max());

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max()}
      aria-valuenow={ratio() * max()}
      class={cn('h-1.5 w-full bg-background overflow-hidden', props.class)}
      {...rest}
    >
      <div
        class={cn(
          'h-full transition-all duration-300',
          progressVariants({ color: props.color }),
        )}
        style={{ width: `${ratio() * 100}%` }}
      />
    </div>
  );
};
