import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const progressVariants = cva(
  'h-1.5 w-full bg-surface-container-lowest overflow-hidden',
  {
    variants: {
      color: {
        cyan: 'bg-primary-container',
        pink: 'bg-secondary-container',
        lime: 'bg-[#39ff14]',
        amber: 'bg-[#ffb703]',
        purple: 'bg-tertiary-fixed',
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
      class={cn(
        'h-1.5 w-full bg-surface-container-lowest overflow-hidden',
        props.class,
      )}
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
