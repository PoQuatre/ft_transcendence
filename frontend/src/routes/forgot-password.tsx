import { Title } from '@solidjs/meta';
import { createSignal } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import { Button, Input } from '~/components/ui';
import { type AuthResult, requestPasswordReset } from '~/lib/auth';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-text-secondary';

// Même texte que le compte existe ou non : la page ne révèle pas quels
// emails sont inscrits. Un email non vérifié ne reçoit pas de lien.
const SENT = {
  title: 'Link sent',
  message:
    "Si un compte vérifié correspond à cet email, un lien vient d'y être envoyé. Il est valable 15 minutes, pense à regarder tes spams.",
};

export default function ForgotPassword() {
  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);
  const [sent, setSent] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const entry = new FormData(form).get('email');
    const email = typeof entry === 'string' ? entry.trim() : '';
    if (!email.includes('@')) {
      setSent(false);
      setError({
        ok: false,
        title: 'Invalid email',
        message:
          "Saisis l'adresse email de ton compte (ex: pilote@example.com).",
      });
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (result.ok) {
      setSent(true);
    } else {
      setSent(false);
      setError(result);
    }
  };

  return (
    <>
      <Title>Forgot password - FT_TRANSCENDENCE</Title>
      <AuthCard
        mode="forgot"
        error={error()}
        notice={sent() ? SENT : undefined}
      >
        <form
          novalidate
          class="mt-space-lg space-y-space-md"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <label class="block" for="email">
            <span class={LABEL}>EMAIL</span>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autocomplete="email"
              placeholder="pilote@example.com"
            />
          </label>

          <Button
            type="submit"
            size="lg"
            class="w-full tracking-[0.1em]"
            disabled={pending()}
          >
            {pending()
              ? 'Sending…'
              : sent()
                ? '◎ Resend link'
                : '◎ Send reset link'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
