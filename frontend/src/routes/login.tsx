import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal } from 'solid-js';

import { AuthCard } from '~/components/auth/AuthCard';
import { FIELD_LABEL } from '~/components/settings/form';
import { Button, Input, Kbd, PasswordInput, Switch } from '~/components/ui';
import { type AuthResult, login } from '~/lib/auth';

// Affiché au retour de /reset-password (?reset=done).
const RESET_DONE = {
  title: 'Password updated',
  message: 'Connecte-toi avec ton nouveau mot de passe.',
};

export default function Login() {
  const navigate = useNavigate();
  const [search] = useSearchParams<{ reset: string }>();
  const [error, setError] = createSignal<Extract<AuthResult, { ok: false }>>();
  const [pending, setPending] = createSignal(false);
  const [emailValue, setEmailValue] = createSignal('');
  const [staySignedIn, setStaySignedIn] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const email = (data.get('email') as string)?.trim() ?? '';
    const password = (data.get('password') as string) ?? '';

    // Détection immédiate si le joueur a entré son Pseudo au lieu de son Email
    if (!email || !email.includes('@')) {
      setError({
        ok: false,
        title: 'EMAIL REQUIS (PAS LE PSEUDO)',
        message:
          'Veuillez saisir votre adresse email complète (ex: pilote@example.com) et non votre Call-Sign.',
      });
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await login({
      email,
      password,
      staySignedIn: staySignedIn(),
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
      <Title>Log in - FT_TRANSCENDENCE</Title>
      <AuthCard
        mode="login"
        error={error()}
        notice={search.reset === 'done' ? RESET_DONE : undefined}
      >
        {/* novalidate empêche l'infobulle invisible du navigateur */}
        <form
          novalidate
          class="mt-space-lg space-y-space-md"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          <label class="block" for="email">
            <span class={FIELD_LABEL}>
              EMAIL DU PILOTE
              <span class="text-[10px] text-accent-primary font-mono font-bold tracking-wider">
                [ PAS DE CALL-SIGN ]
              </span>
            </span>
            <Input
              id="email"
              name="email"
              type="text"
              required
              autocomplete="email"
              value={emailValue()}
              onInput={(e) => setEmailValue(e.currentTarget.value)}
              placeholder="pilote@example.com"
              class={{
                'border-accent-secondary shadow-glow-magenta-sm': Boolean(
                  error()?.title?.includes('EMAIL'),
                ),
              }}
            />
          </label>

          <label class="block" for="password">
            <span class={FIELD_LABEL}>
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
          <p class="-mt-space-sm text-right">
            <a
              href="/forgot-password"
              class="font-label-data text-label-data text-accent-primary underline-offset-4 hover:underline"
            >
              Mot de passe oublié ?
            </a>
          </p>

          <div class="flex items-center gap-2 font-label-data text-label-data text-text-secondary">
            <Switch
              aria-labelledby="staySignedInLabel"
              checked={staySignedIn()}
              onCheckedChange={setStaySignedIn}
            />
            <span id="staySignedInLabel">Stay signed in</span>
          </div>

          <Button
            type="submit"
            size="lg"
            class="w-full tracking-[0.1em]"
            disabled={pending()}
          >
            {pending() ? 'Authentification…' : '◎ Deploy in Arena'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
