import { type Component, createSignal, Show } from 'solid-js';

import { Badge, Button, Input, Separator } from '~/components/ui';
import {
  type AuthUser,
  confirmEmailVerification,
  requestEmailVerification,
} from '~/lib/auth';

import { type Feedback, FIELD_LABEL, FormFeedback, text } from './form';

const CODE_RE = /^\d{6}$/;

export type EmailVerificationProps = { user: AuthUser };

// Onglet OPERATOR : vérification de l'email par un code reçu par mail.
// Requise pour le mot de passe oublié. Masquée tant que le backend ne
// renvoie pas `verified` dans /api/auth/me.
export const EmailVerification: Component<EmailVerificationProps> = (props) => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);
  const [codeSent, setCodeSent] = createSignal(false);

  const sendCode = async () => {
    setPending(true);
    setFeedback(undefined);
    const result = await requestEmailVerification();
    setPending(false);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    } else if (result.verified) {
      setFeedback({
        kind: 'success',
        title: 'Email verified',
        message: 'Ton email est vérifié.',
      });
    } else {
      setCodeSent(true);
      setFeedback({
        kind: 'info',
        title: 'Code sent',
        message: `Un code à 6 chiffres a été envoyé à ${props.user.email}. Il est valable 10 minutes.`,
      });
    }
  };

  const confirm = async (form: HTMLFormElement) => {
    const code = text(new FormData(form).get('code')).trim();
    if (!CODE_RE.test(code)) {
      setFeedback({
        kind: 'error',
        title: 'Invalid code',
        message: 'Le code contient exactement 6 chiffres.',
      });
      return;
    }
    setPending(true);
    setFeedback(undefined);
    const result = await confirmEmailVerification(code);
    setPending(false);
    setFeedback(
      result.ok
        ? {
            kind: 'success',
            title: 'Email verified',
            message: 'Ton email est vérifié.',
          }
        : { kind: 'error', title: result.title, message: result.message },
    );
  };

  return (
    <Show when={props.user.verified !== undefined}>
      <Separator class="my-space-lg" />
      <section
        class="space-y-space-md"
        aria-labelledby="email-verification-title"
      >
        <div class={FIELD_LABEL}>
          <span id="email-verification-title">EMAIL VERIFICATION</span>
          <Badge variant={props.user.verified ? 'success' : 'warning'}>
            {props.user.verified ? 'VERIFIED' : 'UNVERIFIED'}
          </Badge>
        </div>

        <FormFeedback feedback={feedback()} />

        <Show when={!props.user.verified}>
          <p class="font-body-sm text-body-sm text-text-secondary">
            Vérifie ton email pour pouvoir réinitialiser ton mot de passe en cas
            d'oubli.
          </p>
          <Show
            when={codeSent()}
            fallback={
              <Button
                type="button"
                size="lg"
                class="w-full tracking-[0.1em]"
                disabled={pending()}
                onClick={() => void sendCode()}
              >
                {pending() ? 'Sending…' : '◎ Send verification code'}
              </Button>
            }
          >
            <form
              novalidate
              class="space-y-space-md"
              onSubmit={(event) => {
                event.preventDefault();
                void confirm(event.currentTarget);
              }}
            >
              <label class="block" for="verification-code">
                <span class={FIELD_LABEL}>
                  CODE
                  <span class="font-label-data text-label-data text-text-muted">
                    6 CHIFFRES
                  </span>
                </span>
                <Input
                  id="verification-code"
                  name="code"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength={6}
                  placeholder="123456"
                />
              </label>
              <Button
                type="submit"
                size="lg"
                class="w-full tracking-[0.1em]"
                disabled={pending()}
              >
                {pending() ? 'Verifying…' : '◎ Verify email'}
              </Button>
              <Button
                type="button"
                variant="link"
                class="w-full"
                disabled={pending()}
                onClick={() => void sendCode()}
              >
                Renvoyer un code
              </Button>
            </form>
          </Show>
        </Show>
      </section>
    </Show>
  );
};
