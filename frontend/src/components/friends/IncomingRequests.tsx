import { type Component, createSignal, For, onSettled, Show } from 'solid-js';

import {
  type Feedback,
  FIELD_LABEL,
  FormFeedback,
} from '~/components/settings/form';
import { Button } from '~/components/ui';
import {
  acceptFriendRequest,
  declineFriendRequest,
  type FriendRequest,
  listFriendRequests,
} from '~/lib/friends';

import { ROW } from './FriendsList';

export type IncomingRequestsProps = { onAccepted: () => void };

export const IncomingRequests: Component<IncomingRequestsProps> = (props) => {
  const [requests, setRequests] = createSignal<FriendRequest[]>();
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [busy, setBusy] = createSignal<string>();

  const load = async () => {
    const result = await listFriendRequests();
    if (result.ok) {
      setRequests(result.page.items);
    } else {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    }
  };

  onSettled(() => {
    void load();
  });

  const answer = async (request: FriendRequest, accept: boolean) => {
    setBusy(request.sender_id);
    setFeedback(undefined);
    const result = accept
      ? await acceptFriendRequest(request.sender_id)
      : await declineFriendRequest(request.sender_id);
    setBusy(undefined);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    } else if (accept) {
      setFeedback({
        kind: 'success',
        title: 'Friend added',
        message: `${request.username} fait maintenant partie de ton escouade.`,
      });
      props.onAccepted();
    } else {
      setFeedback({
        kind: 'info',
        title: 'Request declined',
        message: `Demande de ${request.username} refusée.`,
      });
    }
    await load();
  };

  return (
    <section class="space-y-space-md" aria-labelledby="requests-title">
      <div class={FIELD_LABEL}>
        <span id="requests-title">INCOMING REQUESTS</span>
      </div>
      <FormFeedback feedback={feedback()} />
      <Show when={requests()?.length === 0}>
        <p class="font-body-sm text-body-sm text-text-muted">
          Aucune demande en attente.
        </p>
      </Show>
      <ul class="space-y-space-sm">
        <For each={requests()}>
          {(request) => (
            <li class={ROW}>
              <div class="flex flex-col">
                <span class="font-label-mono-caps text-label-mono-caps text-text-primary">
                  {request.username}
                </span>
                <span class="font-label-data text-label-data text-text-muted">
                  {new Date(request.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div class="flex gap-space-sm">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  aria-label={`Accept ${request.username}`}
                  disabled={busy() !== undefined}
                  onClick={() => void answer(request, true)}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Decline ${request.username}`}
                  disabled={busy() !== undefined}
                  onClick={() => void answer(request, false)}
                >
                  Decline
                </Button>
              </div>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
};
