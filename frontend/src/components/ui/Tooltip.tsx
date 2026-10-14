import type { JSX } from '@solidjs/web';
import { type Component, createSignal, Show } from 'solid-js';

import { cn } from '~/lib/utils';

export type TooltipProps = {
  content: JSX.Element;
  children: JSX.Element;
  class?: string;
  side?: 'top' | 'bottom';
};

export const Tooltip: Component<TooltipProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const side = () => props.side ?? 'top';

  return (
    <div
      class="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {props.children}
      <Show when={isOpen()}>
        <div
          role="tooltip"
          class={cn(
            'absolute z-50 pointer-events-none px-2 py-1 font-label-mono-caps text-[10px] text-primary whitespace-nowrap bg-surface-container-lowest/95 border border-primary-container/40 rounded shadow-[0_0_10px_rgba(0,240,255,0.25)] left-1/2 -translate-x-1/2',
            side() === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            props.class,
          )}
        >
          {props.content}
        </div>
      </Show>
    </div>
  );
};
