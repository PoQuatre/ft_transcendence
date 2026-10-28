/* The listbox uses the ARIA select-only combobox pattern with focus on the trigger. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */
import { Portal } from '@solidjs/web';
import {
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onSettled,
  Show,
} from 'solid-js';

import { cn } from '~/lib/utils';

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  class?: string;
};

export function Select(props: SelectProps) {
  const id = createUniqueId();
  const listId = `select-${id}`;
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  const [position, setPosition] = createSignal({
    top: 0,
    left: 0,
    width: 0,
    above: false,
  });
  let trigger: HTMLButtonElement | undefined;
  let list: HTMLDivElement | undefined;
  let search = '';
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const enabled = () =>
    props.options
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
  const selected = () =>
    props.options.find((option) => option.value === props.value);
  const optionId = (index: number) => `${listId}-option-${index}`;

  function updatePosition() {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const above =
      window.innerHeight - rect.bottom < 240 &&
      rect.top > window.innerHeight - rect.bottom;
    setPosition({
      top: above ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      above,
    });
  }
  function show() {
    if (props.disabled || enabled().length === 0) return;
    const selectedIndex = props.options.findIndex(
      (option) => option.value === props.value && !option.disabled,
    );
    setActive(selectedIndex < 0 ? enabled()[0]! : selectedIndex);
    updatePosition();
    setOpen(true);
  }
  function close() {
    setOpen(false);
  }
  function choose(index: number) {
    const option = props.options[index];
    if (!option || option.disabled) return;
    props.onChange(option.value);
    close();
    trigger?.focus();
  }
  function move(direction: 1 | -1) {
    const indices = enabled();
    const current = indices.indexOf(active());
    const next = Math.max(0, Math.min(indices.length - 1, current + direction));
    const index = indices[next];
    if (index !== undefined) {
      setActive(index);
      document
        .getElementById(optionId(index))
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }
  function onKeyDown(event: KeyboardEvent) {
    if (props.disabled) return;
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'Escape') {
      if (open()) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open()) show();
      else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open()) choose(active());
      else show();
      return;
    }
    if (open() && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      const indices = enabled();
      const index =
        event.key === 'Home' ? indices[0] : indices[indices.length - 1];
      if (index !== undefined) {
        setActive(index);
        document
          .getElementById(optionId(index))
          ?.scrollIntoView?.({ block: 'nearest' });
      }
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      search += event.key.toLocaleLowerCase();
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        search = '';
      }, 700);
      const index = props.options.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(search),
      );
      if (index >= 0) {
        if (!open()) show();
        setActive(index);
      }
    }
  }
  onSettled(() => {
    const outside = (event: PointerEvent) => {
      if (
        open() &&
        !trigger?.contains(event.target as Node) &&
        !list?.contains(event.target as Node)
      )
        close();
    };
    const reposition = () => {
      if (open()) updatePosition();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  });
  onCleanup(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  return (
    <>
      <Show when={props.name}>
        <input
          type="hidden"
          name={props.name}
          value={props.value}
          disabled={props.disabled}
        />
      </Show>
      <button
        ref={(element) => (trigger = element)}
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={open() ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open() ? optionId(active()) : undefined}
        aria-invalid={props.invalid ? 'true' : undefined}
        disabled={props.disabled}
        onKeyDown={onKeyDown}
        onClick={() => (open() ? close() : show())}
        class={cn(
          'flex h-9 items-center justify-between gap-space-md rounded-md border border-border-subtle bg-surface-2 px-space-md font-label-data text-label-data text-text-primary pointer-coarse:h-11',
          'transition-colors hover:border-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-primary',
          'aria-invalid:border-error-border disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )}
      >
        <span>{selected()?.label ?? 'Select…'}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={(element) => (list = element)}
            id={listId}
            role="listbox"
            aria-label={props['aria-label']}
            class="fixed z-50 max-h-60 overflow-y-auto rounded-md border border-border-subtle bg-surface-2 p-space-xs font-label-data text-label-data text-text-primary shadow-lg"
            style={{
              top: `${position().top}px`,
              left: `${position().left}px`,
              'min-width': `${position().width}px`,
              transform: position().above ? 'translateY(-100%)' : undefined,
            }}
          >
            <For each={props.options}>
              {(option, index) => (
                <div
                  id={optionId(index())}
                  role="option"
                  aria-selected={
                    option.value === props.value ? 'true' : 'false'
                  }
                  aria-disabled={option.disabled ? 'true' : undefined}
                  class={cn(
                    'flex min-h-9 cursor-pointer items-center justify-between gap-space-md rounded-sm px-space-sm',
                    active() === index() &&
                      'bg-accent-primary-subtle text-accent-primary',
                    option.disabled && 'cursor-not-allowed opacity-50',
                  )}
                  onPointerMove={() => {
                    if (!option.disabled) setActive(index());
                  }}
                  onPointerDown={(event) => {
                    if (event.pointerType === 'mouse') event.preventDefault();
                  }}
                  onClick={() => choose(index())}
                >
                  <span>{option.label}</span>
                  <Show when={option.value === props.value}>
                    <span aria-hidden="true">✓</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Portal>
      </Show>
    </>
  );
}
