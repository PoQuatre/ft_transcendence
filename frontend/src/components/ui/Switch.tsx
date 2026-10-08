import type { ComponentProps } from '@solidjs/web';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type SwitchProps = ComponentProps<'button'> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch: Component<SwitchProps> = (props) => {
  const rest = omit(props, 'checked', 'onCheckedChange', 'class');

  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={props.checked ? 'true' : 'false'}
      onClick={() => props.onCheckedChange?.(!props.checked)}
      class={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container',
        props.checked
          ? 'bg-primary-container shadow-[0_0_10px_rgba(0,240,255,0.5)]'
          : 'bg-surface-container-high',
        props.class,
      )}
    >
      <span
        class={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-surface-container-lowest transition-transform',
          props.checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
};
