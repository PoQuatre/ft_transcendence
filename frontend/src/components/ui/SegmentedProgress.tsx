/* ARIA progressbar on a div: a native <progress> cannot be themed or split into blocks. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import type { ComponentProps } from '@solidjs/web';
import type { VariantProps } from 'class-variance-authority';
import { type Component, For, omit } from 'solid-js';

import { cn } from '~/lib/utils';

import { progressRatio, progressVariants } from './Progress';

export type SegmentedProgressProps = Omit<ComponentProps<'div'>, 'children'> &
  VariantProps<typeof progressVariants> & {
    value?: number;
    max?: number;
    /** Number of blocks the bar is split into. */
    segments?: number;
    /** Adds the CRT stripes over the filled part. */
    striped?: boolean;
    /** Accessible name, e.g. "Progress from level 5 to level 6". */
    label: string;
    /** Spoken instead of the raw number, e.g. "500 / 900 XP". */
    valueText?: string;
    /** Classes applied to each block (height, radius…). */
    segmentClass?: string;
  };

/** A gauge split into equal blocks; the last one fills partially. */
export const SegmentedProgress: Component<SegmentedProgressProps> = (props) => {
  const rest = omit(
    props,
    'value',
    'max',
    'color',
    'segments',
    'striped',
    'label',
    'valueText',
    'segmentClass',
    'class',
  );
  const max = () => props.max ?? 100;
  const segments = () => Math.max(1, Math.floor(props.segments ?? 20));
  const filled = () => progressRatio(props.value, max()) * segments();

  return (
    <div
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={max()}
      aria-valuenow={(filled() / segments()) * max()}
      aria-valuetext={props.valueText}
      class={cn('grid gap-1', props.class)}
      style={{
        'grid-template-columns': `repeat(${segments()}, minmax(0, 1fr))`,
      }}
      {...rest}
    >
      <For each={Array.from({ length: segments() }, (_, index) => index)}>
        {(index) => (
          <div
            data-segment
            class={cn(
              'h-3 min-w-0 overflow-hidden rounded-sm bg-border-subtle',
              props.segmentClass,
            )}
          >
            <div
              class={cn(
                'h-full transition-all duration-300',
                progressVariants({ color: props.color }),
                props.striped && 'striped-pattern',
              )}
              style={{
                width: `${Math.min(Math.max(filled() - index, 0), 1) * 100}%`,
              }}
            />
          </div>
        )}
      </For>
    </div>
  );
};
