import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import { Button, Input, PasswordInput, Progress } from '~/components/ui';
import {
  type AuthResult,
  PASSWORD_RULES,
  signup,
  USERNAME_PATTERN,
} from '~/lib/auth';
import { cn } from '~/lib/utils';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-on-surface-variant';

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);
  const [password, setPassword] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);

  const score = () => PASSWORD_RULES.filter((r) => r.test(password())).length;
  const showConfirm = () => submitted() || confirm() !== '';
  const confirmOk = () => confirm() !== '' && confirm() === password();

  let confirmRef: HTMLInputElement | undefined;

  const submit = async (form: HTMLFormElement) => {
    setSubmitted(true);
    // Valeurs lues dans le DOM : en Solid 2.0, un signal écrit dans le même
    // tick n'est visible qu'après le flush.
    const data = new FormData(form);
    const passwordEntry = data.get('password');
    const pwd = typeof passwordEntry === 'string' ? passwordEntry : '';
    // Vérification front uniquement : la confirmation n'est jamais envoyée.
    if (!confirmRef || confirmRef.value === '' || confirmRef.value !== pwd) {
      confirmRef?.focus();
      return;
    }
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
      <Title>Sign up - Cybercore</Title>
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
              <span class="font-label-data text-label-data text-outline">
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
              placeholder="pilot@cybercore.net"
            />
          </label>

          <label class="block" for="password">
            <span class={LABEL}>
              PASSWORD
              <span class="font-label-data text-label-data text-outline">
                {score()}/{PASSWORD_RULES.length}
              </span>
            </span>
            <PasswordInput
              id="password"
              name="password"
              required
              minlength={10}
              maxlength={72}
              autocomplete="new-password"
              placeholder="••••••••••"
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>

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
                    rule.test(password()) ? 'text-neon-green' : 'text-outline'
                  }
                >
                  {rule.test(password()) ? '◆' : '◇'} {rule.label}
                </li>
              )}
            </For>
          </ul>

          <label class="block" for="confirm">
            <span class={LABEL}>CONFIRM PASSWORD</span>
            {/* Pas de name : le champ ne part jamais au backend. */}
            <PasswordInput
              ref={(el) => (confirmRef = el)}
              id="confirm"
              required
              autocomplete="new-password"
              placeholder="••••••••••"
              aria-describedby="confirm-msg"
              aria-invalid={showConfirm() && !confirmOk() ? 'true' : 'false'}
              onInput={(e) => setConfirm(e.currentTarget.value)}
              class={cn(showConfirm() && !confirmOk() && 'border-neon-pink')}
            />
          </label>
          <p
            id="confirm-msg"
            aria-live="polite"
            // Tableau de classes et non cn() : tailwind-merge prend
            // text-label-data pour une couleur et l'écraserait par la couleur.
            class={[
              '-mt-space-sm min-h-[14px] font-label-data text-label-data',
              confirmOk() ? 'text-neon-green' : 'text-neon-pink',
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
            {pending() ? 'Enlisting…' : '◎ Enlist'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
