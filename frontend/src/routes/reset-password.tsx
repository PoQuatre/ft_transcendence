import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import { Button, PasswordInput, Progress } from '~/components/ui';
import { type AuthResult, PASSWORD_RULES, resetPassword } from '~/lib/auth';
import { cn } from '~/lib/utils';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-text-secondary';

const MISSING_TOKEN: Extract<AuthResult, { ok: false }> = {
  ok: false,
  title: 'Invalid link',
  message:
    'Ce lien de réinitialisation est incomplet. Demande un nouveau lien.',
};

// Page ouverte par le lien du mail : /reset-password?token=…
// Mêmes règles et même jauge que l'inscription. La confirmation reste côté
// front et n'est jamais envoyée.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [search] = useSearchParams<{ token: string }>();
  const token = () => (typeof search.token === 'string' ? search.token : '');

  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
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
    // Valeurs lues dans le DOM : en Solid 2.0, un signal écrit dans le même
    // tick n'est visible qu'après le flush.
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
    if (!confirmRef || confirmRef.value !== pwd) {
      // Le message sous le champ de confirmation explique déjà l'écart.
      setError(undefined);
      confirmRef?.focus();
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
            <label class="block" for="password">
              <span class={LABEL}>
                NEW PASSWORD
                <Show when={showRules()}>
                  <span class="font-label-data text-label-data text-text-muted">
                    {score()}/{PASSWORD_RULES.length}
                  </span>
                </Show>
              </span>
              <PasswordInput
                id="password"
                name="password"
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

            <label class="block" for="confirm">
              <span class={LABEL}>CONFIRM PASSWORD</span>
              {/* Pas de name : le champ ne part jamais au backend. */}
              <PasswordInput
                ref={(el) => (confirmRef = el)}
                id="confirm"
                autocomplete="new-password"
                placeholder="••••••••••"
                aria-describedby="confirm-msg"
                aria-invalid={showConfirm() && !confirmOk() ? 'true' : 'false'}
                onFocus={() => setConfirmTouched(true)}
                onInput={(e) => setConfirm(e.currentTarget.value)}
                class={cn(
                  showConfirm() && !confirmOk() && 'border-accent-secondary',
                )}
              />
            </label>
            <p
              id="confirm-msg"
              aria-live="polite"
              // Tableau de classes et non cn() : tailwind-merge prend
              // text-label-data pour une couleur et l'écraserait par la couleur.
              class={[
                '-mt-space-sm min-h-[14px] font-label-data text-label-data',
                confirmOk()
                  ? 'text-success-foreground'
                  : 'text-accent-secondary',
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
              {pending() ? 'Updating…' : '◎ Set new password'}
            </Button>
          </form>
        </Show>
      </AuthCard>
    </>
  );
}
