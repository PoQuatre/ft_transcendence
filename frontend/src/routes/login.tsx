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
  const [emailValue, setEmailValue] = createSignal('');

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const email = (data.get('email') as string)?.trim() ?? '';
    const password = (data.get('password') as string) ?? '';

    // Détection immédiate si le joueur a entré son Pseudo au lieu de son Email
    if (!email || !email.includes('@')) {
      setError({
        ok: false,
        title: 'EMAIL REQUIS (PAS LE PSEUDO)',
        message: 'Veuillez saisir votre adresse email complète (ex: pilote@cybercore.net) et non votre Call-Sign.',
      });
      return;
    }

    setPending(true);
    setError(undefined);
    const result = await login({ email, password });
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
            <span class={LABEL}>
              <span>EMAIL DU PILOTE</span>
              <span class="text-[10px] text-[#00f0ff] font-mono font-bold tracking-wider">
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
              placeholder="pilote@cybercore.net"
              class={`normal-case ${
                error()?.title?.includes('EMAIL')
                  ? 'border-[#ff007f] shadow-[0_0_10px_rgba(255,0,127,0.4)]'
                  : ''
              }`}
            />
            <p class="text-[11px] text-slate-400 font-mono mt-1">
              ⚠️ Entrez l'adresse email renseignée à l'inscription.
            </p>
          </label>

          <label class="block" for="password">
            <span class={LABEL}>
              <span>PASSWORD</span>
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
            {pending() ? 'Authentification…' : '◎ Deploy in Arena'}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
