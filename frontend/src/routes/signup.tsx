import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import {
  createNewPassword,
  NewPasswordFields,
} from '~/components/auth/NewPasswordFields';
import { Button, Input } from '~/components/ui';
import { type AuthResult, signup, USERNAME_PATTERN } from '~/lib/auth';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-text-secondary';

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);
  const newPassword = createNewPassword();

  const submit = async (form: HTMLFormElement) => {
    newPassword.reveal();
    const data = new FormData(form);
    const passwordEntry = data.get('password');
    const pwd = typeof passwordEntry === 'string' ? passwordEntry : '';
    if (!newPassword.confirmMatches(pwd)) return;
    const usernameEntry = data.get('username');
    const emailEntry = data.get('email');
    setPending(true);
    const result = await signup({
      username: typeof usernameEntry === 'string' ? usernameEntry : '',
      email: typeof emailEntry === 'string' ? emailEntry : '',
      password: pwd,
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
      <Title>Sign up - FT_TRANSCENDENCE</Title>
      <AuthCard mode="signup" error={error()}>
        <form
          class="mt-space-lg space-y-space-md"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <label class="block" for="username">
            <span class={LABEL}>
              CALL-SIGN
              <span class="font-label-data text-label-data text-text-muted">
                3-30 · a-z A-Z 0-9 _
              </span>
            </span>
            <Input
              id="username"
              name="username"
              required
              minlength={3}
              maxlength={30}
              pattern={USERNAME_PATTERN}
              autocomplete="username"
              placeholder="NEXUS_VIPER"
            />
          </label>

          <label class="block" for="email">
            <span class={LABEL}>EMAIL</span>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autocomplete="email"
              placeholder="pilot@example.com"
            />
          </label>

          <NewPasswordFields
            state={newPassword}
            id="password"
            confirmId="confirm"
            label="PASSWORD"
            confirmLabel="CONFIRM PASSWORD"
            required
          />

          <Button
            type="submit"
            size="lg"
            class="w-full tracking-[0.1em]"
            disabled={pending()}
          >
            {pending() ? 'Enlisting…' : '◎ Enlist'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
