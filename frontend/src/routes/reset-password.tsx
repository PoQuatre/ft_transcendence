import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import {
  createNewPassword,
  NewPasswordFields,
} from '~/components/auth/NewPasswordFields';
import { Button } from '~/components/ui';
import { type AuthResult, PASSWORD_RULES, resetPassword } from '~/lib/auth';

const MISSING_TOKEN: Extract<AuthResult, { ok: false }> = {
  ok: false,
  title: 'Invalid link',
  message:
    'Ce lien de réinitialisation est incomplet. Demande un nouveau lien.',
};

// Page ouverte par le lien du mail : /reset-password?token=…
// Mêmes règles et même jauge que l'inscription.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [search] = useSearchParams<{ token: string }>();
  const token = () => (typeof search.token === 'string' ? search.token : '');

  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);
  const newPassword = createNewPassword();

  const submit = async (form: HTMLFormElement) => {
    newPassword.reveal();
    const entry = new FormData(form).get('password');
    const pwd = typeof entry === 'string' ? entry : '';
    if (PASSWORD_RULES.some((rule) => !rule.test(pwd))) {
      setError({
        ok: false,
        title: 'Weak password',
        message: 'Le nouveau mot de passe ne respecte pas toutes les règles.',
      });
      return;
    }
    if (!newPassword.confirmMatches(pwd)) {
      // Le message sous le champ de confirmation explique déjà l'écart.
      setError(undefined);
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await resetPassword({ password: pwd, token: token() });
    setPending(false);
    if (result.ok) {
      navigate('/login?reset=done', { replace: true });
    } else {
      setError(result);
    }
  };

  return (
    <>
      <Title>Reset password - FT_TRANSCENDENCE</Title>
      <AuthCard
        mode="reset"
        error={error() ?? (token() ? undefined : MISSING_TOKEN)}
      >
        <Show when={token()}>
          <form
            novalidate
            class="mt-space-lg space-y-space-md"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(event.currentTarget);
            }}
          >
            <NewPasswordFields
              state={newPassword}
              id="password"
              confirmId="confirm"
              label="NEW PASSWORD"
              confirmLabel="CONFIRM PASSWORD"
            />

            <Button
              type="submit"
              size="lg"
              class="w-full tracking-[0.1em]"
              disabled={pending()}
            >
              {pending() ? 'Updating…' : '◎ Set new password'}
            </Button>
          </form>
        </Show>
      </AuthCard>
    </>
  );
}
