import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const progressVariants = cva(
  'h-1.5 w-full bg-background overflow-hidden',
  {
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
  },
);

export type ProgressProps = ComponentProps<'div'> &
  VariantProps<typeof progressVariants> & {
    value?: number;
    max?: number;
  };

export const Progress: Component<ProgressProps> = (props) => {
  const rest = omit(props, 'value', 'max', 'color', 'class');
  const percentage = () => {
    const val = props.value ?? 0;
    const maxVal = props.max ?? 100;
    return Math.min(Math.max((val / maxVal) * 100, 0), 100);
  };

  return (
    <div
      class={cn('h-1.5 w-full bg-background overflow-hidden', props.class)}
      {...rest}
    >
      <div
        class={cn(
          'h-full transition-all duration-300',
          progressVariants({ color: props.color }),
        )}
        style={{ width: `${percentage()}%` }}
      />
    </div>
  );
};
