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
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui';
import { type Friend, listFriends, unfriend } from '~/lib/friends';

export const ROW =
  'flex items-center justify-between gap-space-md rounded-md border border-border-subtle/60 bg-surface-1/60 px-space-md py-space-sm';

// Changer `version` recharge la liste (après une demande acceptée).
export const FriendsList: Component<{ version?: number }> = (props) => {
  const [friends, setFriends] = createSignal<Friend[]>();
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [target, setTarget] = createSignal<Friend>();
  const [pending, setPending] = createSignal(false);

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

  const close = () => {
    if (!pending()) setTarget(undefined);
  };

  const remove = async (friend: Friend) => {
    setPending(true);
    setFeedback(undefined);
    const result = await unfriend(friend.friend_id);
    setPending(false);
    setTarget(undefined);
    setFeedback(
      result.ok
        ? {
            kind: 'info',
            title: 'Friend removed',
            message: `${friend.username} ne fait plus partie de ton escouade.`,
          }
        : { kind: 'error', title: result.title, message: result.message },
    );
    await load();
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${friend.username}`}
                onClick={() => setTarget(friend)}
              >
                Remove
              </Button>
            </li>
          )}
        </For>
      </ul>

      <Dialog
        open={target() !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        labelledBy="unfriend-title"
      >
        <DialogHeader>
          <DialogTitle id="unfriend-title">Remove friend</DialogTitle>
          <DialogDescription>
            Retirer {target()?.username} de ton escouade ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="mt-space-md">
          <Button
            type="button"
            variant="ghost"
            disabled={pending()}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending()}
            onClick={() => {
              const friend = target();
              if (friend) void remove(friend);
            }}
          >
            {pending() ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  );
};
