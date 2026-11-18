import {
  type Component,
  createEffect,
  createSignal,
  For,
  Show,
} from 'solid-js';

import {
  type Feedback,
  FIELD_LABEL,
  FormFeedback,
} from '~/components/settings/form';
import { type Friend, listFriends } from '~/lib/friends';

export const ROW =
  'flex items-center justify-between gap-space-md rounded-md border border-border-subtle/60 bg-surface-1/60 px-space-md py-space-sm';

// Changer `version` recharge la liste (après une demande acceptée).
export const FriendsList: Component<{ version?: number }> = (props) => {
  const [friends, setFriends] = createSignal<Friend[]>();
  const [feedback, setFeedback] = createSignal<Feedback>();

  const load = async () => {
    const result = await listFriends();
    if (result.ok) {
      setFriends(result.page.items);
    } else {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    }
  };

  createEffect(
    () => props.version,
    () => {
      void load();
    },
  );

  return (
    <section class="space-y-space-md" aria-labelledby="friends-title">
      <div class={FIELD_LABEL}>
        <span id="friends-title">FRIENDS</span>
      </div>
      <FormFeedback feedback={feedback()} />
      <Show when={friends()?.length === 0}>
        <p class="font-body-sm text-body-sm text-text-muted">
          Pas encore d'amis dans ton escouade.
        </p>
      </Show>
      <ul class="space-y-space-sm">
        <For each={friends()}>
          {(friend) => (
            <li class={ROW}>
              <span class="font-label-mono-caps text-label-mono-caps text-text-primary">
                {friend.username}
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
};
