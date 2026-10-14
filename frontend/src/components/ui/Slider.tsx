import type { ComponentProps } from '@solidjs/web';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type SliderProps = ComponentProps<'input'> & {
  value?: number;
  onValueChange?: (val: number) => void;
};

export const Slider: Component<SliderProps> = (props) => {
  const rest = omit(props, 'value', 'onValueChange', 'class', 'type');

  return (
    <input
      type="range"
      value={props.value ?? 50}
      onInput={(e) => props.onValueChange?.(Number(e.currentTarget.value))}
      class={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-lowest accent-primary-container focus:outline-none',
        props.class,
      )}
      {...rest}
    />
  );
};
