import { type Component, createSignal } from 'solid-js';

import {
  type Feedback,
  FIELD_LABEL,
  FormFeedback,
  text,
} from '~/components/settings/form';
import { Button, Input } from '~/components/ui';
import { currentUser } from '~/lib/auth';
import { sendFriendRequest } from '~/lib/friends';

export const FriendRequestForm: Component = () => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);

  const submit = async (form: HTMLFormElement) => {
    const username = text(new FormData(form).get('friend-username')).trim();
    if (!username) {
      setFeedback({
        kind: 'error',
        title: 'Call-sign required',
        message: 'Saisis le call-sign du pilote à ajouter.',
      });
      return;
    }
    // Le backend répond 401 dans ce cas, ce qui ferait croire à une session perdue.
    if (username.toLowerCase() === currentUser()?.username.toLowerCase()) {
      setFeedback({
        kind: 'error',
        title: 'Nice try',
        message: "Tu ne peux pas t'ajouter toi-même.",
      });
      return;
    }

    setPending(true);
    setFeedback(undefined);
    const result = await sendFriendRequest(username);
    setPending(false);
    if (result.ok) {
      form.reset();
      setFeedback({
        kind: 'success',
        title: 'Request sent',
        message: `Demande envoyée à ${username}.`,
      });
    } else {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    }
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
      <div class="flex items-end gap-space-sm">
        <label class="block flex-1" for="friend-username">
          <span class={FIELD_LABEL}>ADD A FRIEND</span>
          <Input
            id="friend-username"
            name="friend-username"
            autocomplete="off"
            maxlength={30}
            placeholder="NEXUS_VIPER"
          />
        </label>
        <Button type="submit" class="tracking-[0.1em]" disabled={pending()}>
          {pending() ? 'Sending…' : '◎ Send'}
        </Button>
      </div>
    </form>
  );
};
