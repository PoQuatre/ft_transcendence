import { type Component, createSignal, For, Show } from 'solid-js';

import { Button, PasswordInput, Progress } from '~/components/ui';
import { changePassword, PASSWORD_RULES } from '~/lib/auth';
import { cn } from '~/lib/utils';

import { type Feedback, FIELD_LABEL, FormFeedback, text } from './form';

// Onglet OPERATOR : changement de mot de passe (PUT /api/auth/password).
// Mêmes règles et même jauge que l'inscription. La confirmation reste côté
// front et n'est jamais envoyée.
export const PasswordForm: Component = () => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);
  const [password, setPassword] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  // Règles et correspondance n'apparaissent qu'une fois le champ touché
  // (focus : clic, tap ou Tab), puis restent visibles. L'envoi les révèle aussi.
  const [passwordTouched, setPasswordTouched] = createSignal(false);
  const [confirmTouched, setConfirmTouched] = createSignal(false);

  const score = () => PASSWORD_RULES.filter((r) => r.test(password())).length;
  const showRules = () => submitted() || passwordTouched();
  // Rien tant que la confirmation est vide : pas d'erreur avant la saisie.
  const showConfirm = () =>
    submitted() || (confirmTouched() && confirm() !== '');
  const confirmOk = () => confirm() !== '' && confirm() === password();

  let confirmRef: HTMLInputElement | undefined;

  const submit = async (form: HTMLFormElement) => {
    setSubmitted(true);
    const data = new FormData(form);
    const current = text(data.get('current-password'));
    const next = text(data.get('new-password'));
    const confirmation = text(data.get('confirm-password'));

    if (!current) {
      setFeedback({
        kind: 'error',
        title: 'Current password required',
        message: 'Saisis ton mot de passe actuel pour confirmer le changement.',
      });
      return;
    }
    if (PASSWORD_RULES.some((rule) => !rule.test(next))) {
      setFeedback({
        kind: 'error',
        title: 'Weak password',
        message: 'Le nouveau mot de passe ne respecte pas toutes les règles.',
      });
      return;
    }
    if (next === current) {
      setFeedback({
        kind: 'error',
        title: 'Same password',
        message: "Choisis un mot de passe différent de l'actuel.",
      });
      return;
    }
    if (confirmation !== next) {
      // Le message sous le champ de confirmation explique déjà l'écart.
      setFeedback(undefined);
      confirmRef?.focus();
      return;
    }

    setPending(true);
    setFeedback(undefined);
    const result = await changePassword({
      currentPassword: current,
      newPassword: next,
    });
    setPending(false);
    if (result.ok) {
      form.reset();
      setPassword('');
      setConfirm('');
      setSubmitted(false);
      setPasswordTouched(false);
      setConfirmTouched(false);
      setFeedback({
        kind: 'success',
        title: 'Password updated',
        message: 'Ton mot de passe a été modifié.',
      });
    } else {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    }
  };

  return (
    <form
      novalidate
      class="space-y-space-md"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <FormFeedback feedback={feedback()} />

      <label class="block" for="current-password">
        <span class={FIELD_LABEL}>CURRENT PASSWORD</span>
        <PasswordInput
          id="current-password"
          name="current-password"
          autocomplete="current-password"
          placeholder="••••••••••"
        />
      </label>

      <label class="block" for="new-password">
        <span class={FIELD_LABEL}>
          NEW PASSWORD
          <Show when={showRules()}>
            <span class="font-label-data text-label-data text-text-muted">
              {score()}/{PASSWORD_RULES.length}
            </span>
          </Show>
        </span>
        <PasswordInput
          id="new-password"
          name="new-password"
          minlength={10}
          maxlength={72}
          autocomplete="new-password"
          placeholder="••••••••••"
          onFocus={() => setPasswordTouched(true)}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </label>

      <Show when={showRules()}>
        <Progress
          value={score()}
          max={PASSWORD_RULES.length}
          color={score() === PASSWORD_RULES.length ? 'lime' : 'pink'}
        />

        <ul class="grid grid-cols-2 gap-x-space-md gap-y-space-xs font-label-data text-label-data">
          <For each={PASSWORD_RULES}>
            {(rule) => (
              <li
                class={
                  rule.test(password())
                    ? 'text-success-foreground'
                    : 'text-text-muted'
                }
              >
                {rule.test(password()) ? '◆' : '◇'} {rule.label}
              </li>
            )}
          </For>
        </ul>
      </Show>

      <label class="block" for="confirm-password">
        <span class={FIELD_LABEL}>CONFIRM NEW PASSWORD</span>
        <PasswordInput
          ref={(el) => (confirmRef = el)}
          id="confirm-password"
          name="confirm-password"
          autocomplete="new-password"
          placeholder="••••••••••"
          aria-describedby="confirm-password-msg"
          aria-invalid={showConfirm() && !confirmOk() ? 'true' : 'false'}
          onFocus={() => setConfirmTouched(true)}
          onInput={(e) => setConfirm(e.currentTarget.value)}
          class={cn(showConfirm() && !confirmOk() && 'border-accent-secondary')}
        />
      </label>
      <p
        id="confirm-password-msg"
        aria-live="polite"
        // Tableau de classes et non cn() : tailwind-merge prend
        // text-label-data pour une couleur et l'écraserait par la couleur.
        class={[
          '-mt-space-sm min-h-[14px] font-label-data text-label-data',
          confirmOk() ? 'text-success-foreground' : 'text-accent-secondary',
        ]}
      >
        <Show when={showConfirm()}>
          {confirmOk()
            ? '◆ LES MOTS DE PASSE CORRESPONDENT'
            : '◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'}
        </Show>
      </p>

      <Button
        type="submit"
        size="lg"
        class="w-full tracking-[0.1em]"
        disabled={pending()}
      >
        {pending() ? 'Updating…' : '◎ Update password'}
      </Button>
    </form>
  );
};
