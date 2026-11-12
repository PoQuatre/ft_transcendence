import { type Component, createSignal } from 'solid-js';

import { Button, Input } from '~/components/ui';
import {
  type AuthUser,
  type ProfilePayload,
  updateProfile,
  USERNAME_PATTERN,
} from '~/lib/auth';

import { type Feedback, FIELD_LABEL, FormFeedback, text } from './form';

const USERNAME_RE = new RegExp(`^${USERNAME_PATTERN}$`);

export type ProfileFormProps = { user: AuthUser };

// Onglet OPERATOR : call-sign et email du compte. Seuls les champs modifiés
// partent au backend (PATCH /api/auth/me), currentUser est resynchronisé par
// updateProfile en cas de succès.
export const ProfileForm: Component<ProfileFormProps> = (props) => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const username = text(data.get('username')).trim();
    // Le backend normalise l'email en minuscules : on compare sur cette base.
    const email = text(data.get('email')).trim().toLowerCase();

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
      <FormFeedback feedback={feedback()} />

      <label class="block" for="profile-username">
        <span class={FIELD_LABEL}>
          CALL-SIGN
          <span class="font-label-data text-label-data text-text-muted">
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
        <span class={FIELD_LABEL}>EMAIL</span>
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
