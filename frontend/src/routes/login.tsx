import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import { Button, Input, Kbd, PasswordInput } from '~/components/ui';
import { type AuthResult, login } from '~/lib/auth';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-on-surface-variant';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    setPending(true);
    const result = await login({
      email: typeof email === 'string' ? email : '',
      password: typeof password === 'string' ? password : '',
    });
    setPending(false);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result);
    }
  };

  return (
    <>
      <Title>Log in - Cybercore</Title>
      <AuthCard mode="login" error={error()}>
        <form
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
              placeholder="pilot@cybercore.net"
              class="normal-case"
            />
          </label>

          <label class="block" for="password">
            <span class={LABEL}>
              PASSWORD
              <Kbd variant="outline" size="sm">
                ENTER
              </Kbd>
            </span>
            <PasswordInput
              id="password"
              name="password"
              required
              autocomplete="current-password"
              placeholder="••••••••••"
            />
          </label>

          <Button
            type="submit"
            size="lg"
            class="w-full tracking-[0.1em]"
            disabled={pending()}
          >
            {pending() ? 'Connecting…' : '◎ Deploy'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
