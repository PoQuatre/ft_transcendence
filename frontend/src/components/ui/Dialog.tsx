import type { ComponentProps, JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { type Component, createEffect, Show, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelledBy?: string;
  children?: JSX.Element;
};

export const Dialog: Component<DialogProps> = (props) => {
  createEffect(
    () => props.open,
    (open) => {
      if (!open) return undefined;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') props.onOpenChange(false);
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    },
  );

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop accessible au clavier et à la souris */}
          <button
            type="button"
            aria-label="Fermer la boîte de dialogue"
            tabindex={-1}
            class="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity cursor-pointer border-0 p-0"
            onClick={() => props.onOpenChange(false)}
          />
          {/* Contenu modale Cyber */}
          <dialog
            open
            aria-modal="true"
            aria-labelledby={props.labelledBy}
            class="relative z-50 w-full max-w-lg bg-surface-1/95 border border-accent-primary/40 p-space-lg rounded-lg shadow-glow-cyan-ambient text-text-primary"
          >
            {props.children}
          </dialog>
        </div>
      </Portal>
    </Show>
  );
};

export const DialogHeader: Component<ComponentProps<'div'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <div
      class={cn(
        'flex flex-col gap-2 pb-4 border-b border-border-subtle/40',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
};

export const DialogTitle: Component<ComponentProps<'h3'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <h3
      class={cn(
        'font-headline-md text-headline-md text-white font-bold tracking-wide',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </h3>
  );
};

export const DialogDescription: Component<ComponentProps<'p'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <p
      class={cn('font-body-sm text-body-sm text-text-secondary', props.class)}
      {...rest}
    >
      {props.children}
    </p>
  );
};

export const DialogFooter: Component<ComponentProps<'div'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <div
      class={cn(
        'flex items-center justify-end gap-space-sm pt-4 border-t border-border-subtle/40',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
};
