import { type Component, createSignal, For, Show } from 'solid-js';

import { PasswordInput, Progress } from '~/components/ui';
import { PASSWORD_RULES } from '~/lib/auth';
import { cn } from '~/lib/utils';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-text-secondary';

// État des champs nouveau mot de passe + confirmation, créé par le formulaire
// parent qui garde la main sur l'envoi : reveal() à chaque tentative,
// confirmMatches() avant d'appeler le backend, reset() après un form.reset().
export function createNewPassword() {
  const [value, setValue] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  // Règles et correspondance n'apparaissent qu'une fois le champ touché
  // (focus : clic, tap ou Tab), puis restent visibles. L'envoi les révèle aussi.
  const [valueTouched, setValueTouched] = createSignal(false);
  const [confirmTouched, setConfirmTouched] = createSignal(false);
  let confirmInput: HTMLInputElement | undefined;

  return {
    value,
    setValue,
    confirm,
    setConfirm,
    score: () => PASSWORD_RULES.filter((r) => r.test(value())).length,
    showRules: () => submitted() || valueTouched(),
    // Rien tant que la confirmation est vide : pas d'erreur avant la saisie.
    showConfirm: () => submitted() || (confirmTouched() && confirm() !== ''),
    confirmOk: () => confirm() !== '' && confirm() === value(),
    touchValue: () => setValueTouched(true),
    touchConfirm: () => setConfirmTouched(true),
    setConfirmInput: (el: HTMLInputElement) => (confirmInput = el),
    reveal: () => setSubmitted(true),
    // Compare au mot de passe lu dans le DOM : en Solid 2.0, un signal écrit
    // dans le même tick n'est visible qu'après le flush. Vérification front
    // uniquement, la confirmation n'est jamais envoyée. Focus si elle diffère.
    confirmMatches: (password: string) => {
      const typed = confirmInput?.value ?? '';
      const ok = typed !== '' && typed === password;
      if (!ok) confirmInput?.focus();
      return ok;
    },
    reset: () => {
      setValue('');
      setConfirm('');
      setSubmitted(false);
      setValueTouched(false);
      setConfirmTouched(false);
    },
  };
}

export type NewPassword = ReturnType<typeof createNewPassword>;

export type NewPasswordFieldsProps = {
  state: NewPassword;
  // id et name du nouveau mot de passe ; la confirmation n'a pas de name.
  id: string;
  confirmId: string;
  label: string;
  confirmLabel: string;
  required?: boolean;
};

// Nouveau mot de passe avec jauge et règles, puis confirmation avec son état.
// Commun à l'inscription, aux settings et à la réinitialisation.
export const NewPasswordFields: Component<NewPasswordFieldsProps> = (props) => {
  const state = () => props.state;
  const messageId = () => `${props.confirmId}-msg`;

  return (
    <>
      <label class="block" for={props.id}>
        <span class={LABEL}>
          {props.label}
          <Show when={state().showRules()}>
            <span class="font-label-data text-label-data text-text-muted">
              {state().score()}/{PASSWORD_RULES.length}
            </span>
          </Show>
        </span>
        <PasswordInput
          id={props.id}
          name={props.id}
          required={props.required}
          minlength={10}
          maxlength={72}
          autocomplete="new-password"
          placeholder="••••••••••"
          onFocus={() => state().touchValue()}
          onInput={(e) => state().setValue(e.currentTarget.value)}
        />
      </label>

      <Show when={state().showRules()}>
        <Progress
          value={state().score()}
          max={PASSWORD_RULES.length}
          color={state().score() === PASSWORD_RULES.length ? 'lime' : 'pink'}
        />

        <ul class="grid grid-cols-2 gap-x-space-md gap-y-space-xs font-label-data text-label-data">
          <For each={PASSWORD_RULES}>
            {(rule) => (
              <li
                class={
                  rule.test(state().value())
                    ? 'text-success-foreground'
                    : 'text-text-muted'
                }
              >
                {rule.test(state().value()) ? '◆' : '◇'} {rule.label}
              </li>
            )}
          </For>
        </ul>
      </Show>

      <label class="block" for={props.confirmId}>
        <span class={LABEL}>{props.confirmLabel}</span>
        {/* Pas de name : le champ ne part jamais au backend. */}
        <PasswordInput
          ref={(el) => state().setConfirmInput(el)}
          id={props.confirmId}
          required={props.required}
          autocomplete="new-password"
          placeholder="••••••••••"
          aria-describedby={messageId()}
          aria-invalid={
            state().showConfirm() && !state().confirmOk() ? 'true' : 'false'
          }
          onFocus={() => state().touchConfirm()}
          onInput={(e) => state().setConfirm(e.currentTarget.value)}
          class={cn(
            state().showConfirm() &&
              !state().confirmOk() &&
              'border-accent-secondary',
          )}
        />
      </label>
      <p
        id={messageId()}
        aria-live="polite"
        // Tableau de classes et non cn() : tailwind-merge prend
        // text-label-data pour une couleur et l'écraserait par la couleur.
        class={[
          '-mt-space-sm min-h-[14px] font-label-data text-label-data',
          state().confirmOk()
            ? 'text-success-foreground'
            : 'text-accent-secondary',
        ]}
      >
        <Show when={state().showConfirm()}>
          {state().confirmOk()
            ? '◆ LES MOTS DE PASSE CORRESPONDENT'
            : '◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'}
        </Show>
      </p>
    </>
  );
};
