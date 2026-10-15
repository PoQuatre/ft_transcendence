import { type Component, createSignal, Show } from 'solid-js';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
} from '~/components/ui';
import {
  type AuthUser,
  type ProfilePayload,
  updateProfile,
  USERNAME_PATTERN,
} from '~/lib/auth';

const LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-on-surface-variant';

const USERNAME_RE = new RegExp(`^${USERNAME_PATTERN}$`);

// FormData peut renvoyer un File : on ne garde que les chaînes.
const text = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : '';

type Feedback = {
  kind: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

const ALERT_VARIANT = {
  error: 'destructive',
  success: 'success',
  info: 'cyan',
} as const;

export type ProfileFormProps = { user: AuthUser };

// Onglet OPERATOR : call-sign et email du compte. Seuls les champs modifiés
// partent au backend (PATCH /api/auth/me), currentUser est resynchronisé par
// updateProfile en cas de succès.
export const ProfileForm: Component<ProfileFormProps> = (props) => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const username = text(data.get('username'));
    // Le backend normalise l'email en minuscules : on compare sur cette base.
    const email = text(data.get('email')).toLowerCase();

    if (!USERNAME_RE.test(username)) {
      setFeedback({
        kind: 'error',
        title: 'Invalid call-sign',
        message: '3 à 30 caractères : lettres, chiffres et _ uniquement.',
      });
      return;
    }
    if (!email.includes('@')) {
      setFeedback({
        kind: 'error',
        title: 'Invalid email',
        message: 'Saisis une adresse email complète.',
      });
      return;
    }

    const payload: ProfilePayload = {};
    if (username !== props.user.username) payload.username = username;
    if (email !== props.user.email) payload.email = email;
    if (Object.keys(payload).length === 0) {
      setFeedback({
        kind: 'info',
        title: 'Nothing to update',
        message: 'Aucune modification détectée.',
      });
      return;
    }

    setPending(true);
    setFeedback(undefined);
    const result = await updateProfile(payload);
    setPending(false);
    setFeedback(
      result.ok
        ? {
            kind: 'success',
            title: 'Profile updated',
            message: 'Tes identifiants ont été mis à jour.',
          }
        : { kind: 'error', title: result.title, message: result.message },
    );
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
      <Show when={feedback()}>
        {(fb) => (
          <Alert variant={ALERT_VARIANT[fb().kind]}>
            <span class="font-mono font-bold">
              {fb().kind === 'error' ? '!' : '◆'}
            </span>
            <div>
              <AlertTitle>{fb().title}</AlertTitle>
              <AlertDescription>{fb().message}</AlertDescription>
            </div>
          </Alert>
        )}
      </Show>

      <label class="block" for="profile-username">
        <span class={LABEL}>
          CALL-SIGN
          <span class="font-label-data text-label-data text-outline">
            3-30 · a-z A-Z 0-9 _
          </span>
        </span>
        <Input
          id="profile-username"
          name="username"
          value={props.user.username}
          minlength={3}
          maxlength={30}
          autocomplete="username"
        />
      </label>

      <label class="block" for="profile-email">
        <span class={LABEL}>EMAIL</span>
        <Input
          id="profile-email"
          name="email"
          type="email"
          value={props.user.email}
          autocomplete="email"
        />
      </label>

      <Button
        type="submit"
        size="lg"
        class="w-full tracking-[0.1em]"
        disabled={pending()}
      >
        {pending() ? 'Updating…' : '◎ Update profile'}
      </Button>
    </form>
  );
};
