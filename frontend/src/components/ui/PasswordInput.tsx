import { type Component, createSignal, omit, Show } from 'solid-js';

import { cn } from '~/lib/utils';

import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type'>;

// Input mot de passe avec un œil : barré quand masqué, ouvert quand visible.
export const PasswordInput: Component<PasswordInputProps> = (props) => {
  const [visible, setVisible] = createSignal(false);
  const rest = omit(props, 'class');
  const label = () =>
    visible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe';

  return (
    <div class="relative">
      <Input
        {...rest}
        type={visible() ? 'text' : 'password'}
        class={cn('pr-12', props.class)}
      />
      <button
        type="button"
        aria-label={label()}
        aria-pressed={visible() ? 'true' : 'false'}
        title={label()}
        onClick={() => setVisible((v) => !v)}
        class={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center cursor-pointer transition-colors',
          'hover:text-accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-primary',
          visible() ? 'text-accent-primary' : 'text-text-muted',
        )}
      >
        <svg
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <Show
            when={visible()}
            fallback={
              <>
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                <path d="m2 2 20 20" />
              </>
            }
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </Show>
        </svg>
      </button>
    </div>
  );
};
