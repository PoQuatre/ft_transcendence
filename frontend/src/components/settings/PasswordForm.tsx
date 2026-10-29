import { type Component, createSignal } from 'solid-js';

import {
  createNewPassword,
  NewPasswordFields,
} from '~/components/auth/NewPasswordFields';
import { Button, PasswordInput } from '~/components/ui';
import { changePassword, PASSWORD_RULES } from '~/lib/auth';

import { type Feedback, FIELD_LABEL, FormFeedback, text } from './form';

// Onglet OPERATOR : changement de mot de passe (POST /api/auth/change-password).
// Mêmes règles et même jauge que l'inscription. La confirmation reste côté
// front et n'est jamais envoyée.
export const PasswordForm: Component = () => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);
  const newPassword = createNewPassword();

  const submit = async (form: HTMLFormElement) => {
    newPassword.reveal();
    const data = new FormData(form);
    const current = text(data.get('current-password'));
    const next = text(data.get('new-password'));

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
    if (!newPassword.confirmMatches(next)) {
      // Le message sous le champ de confirmation explique déjà l'écart.
      setFeedback(undefined);
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
      newPassword.reset();
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

      <NewPasswordFields
        state={newPassword}
        id="new-password"
        confirmId="confirm-password"
        label="NEW PASSWORD"
        confirmLabel="CONFIRM NEW PASSWORD"
      />

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
