import {
  type Component,
  createEffect,
  createSignal,
  For,
  onSettled,
  Show,
} from 'solid-js';

import { type Feedback, FormFeedback, text } from '~/components/settings/form';
import { Button, Input } from '~/components/ui';
import { currentUser } from '~/lib/auth';
import {
  type ChatMessage,
  type Friend,
  getMessages,
  isMessageTooLong,
  sendMessage,
} from '~/lib/friends';

// Pas encore de temps réel côté backend : on relit la conversation.
const POLL_MS = 3000;

const key = (message: ChatMessage) => `${message.sender_id}/${message.sent_at}`;

const lastKey = (messages: ChatMessage[]) => {
  const last = messages.at(-1);
  return last ? key(last) : '';
};

export type ConversationProps = { friend: Friend; onBack: () => void };

export const Conversation: Component<ConversationProps> = (props) => {
  const [messages, setMessages] = createSignal<ChatMessage[]>();
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);
  let list: HTMLOListElement | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };

  const load = async () => {
    const result = await getMessages(props.friend.friend_id);
    if (!result.ok) {
      stop();
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
      return;
    }
    const previous = messages();
    const next = result.messages;
    if (
      previous?.length === next.length &&
      lastKey(previous) === lastKey(next)
    ) {
      return;
    }
    // Réutilise les messages déjà affichés pour ne pas recréer toute la liste.
    const known = new Map((previous ?? []).map((m) => [key(m), m]));
    setMessages(next.map((m) => known.get(key(m)) ?? m));
  };

  const start = () => {
    timer ??= setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
  };

  onSettled(() => {
    void load();
    start();
    return stop;
  });

  createEffect(messages, () => {
    if (list) list.scrollTop = list.scrollHeight;
  });

  const submit = async (form: HTMLFormElement) => {
    const message = text(new FormData(form).get('chat-message')).trim();
    if (!message) return;
    if (isMessageTooLong(message)) {
      setFeedback({
        kind: 'error',
        title: 'Message too long',
        message: 'Ton message dépasse 140 caractères.',
      });
      return;
    }

    setPending(true);
    setFeedback(undefined);
    const result = await sendMessage(props.friend.friend_id, message);
    setPending(false);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
      return;
    }
    form.reset();
    await load();
    start();
  };

  return (
    <section
      class="flex h-full min-h-0 flex-col gap-space-sm"
      aria-labelledby="chat-title"
    >
      <div class="flex items-center gap-space-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Back to friends"
          onClick={() => props.onBack()}
        >
          ←
        </Button>
        <h3
          id="chat-title"
          class="font-label-mono-caps text-label-mono-caps text-text-primary"
        >
          {props.friend.username}
        </h3>
      </div>

      <FormFeedback feedback={feedback()} />
      <Show when={messages()?.length === 0}>
        <p class="font-body-sm text-body-sm text-text-muted">
          Pas encore de messages, dis bonjour.
        </p>
      </Show>

      <ol
        ref={(element) => {
          list = element;
        }}
        role="log"
        aria-label={`Messages with ${props.friend.username}`}
        class="min-h-0 flex-1 space-y-space-sm overflow-y-auto"
      >
        <For each={messages()}>
          {(message) => {
            const mine = message.sender_id === currentUser()?.id;
            return (
              <li
                class={[
                  'flex flex-col gap-space-xs',
                  mine ? 'items-end pl-space-xl' : 'items-start pr-space-xl',
                ]}
              >
                <span
                  class={[
                    'rounded-md border px-space-sm py-space-xs font-body-sm text-body-sm text-text-primary wrap-break-word',
                    mine
                      ? 'border-accent-primary/40 bg-accent-primary-subtle'
                      : 'border-border-subtle bg-surface-2',
                  ]}
                >
                  {message.message}
                </span>
                <time
                  datetime={message.sent_at}
                  class="font-label-data text-label-data text-text-muted"
                >
                  {new Date(message.sent_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </li>
            );
          }}
        </For>
      </ol>

      <form
        novalidate
        class="flex items-center gap-space-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label class="flex-1" for="chat-message">
          <span class="sr-only">Message</span>
          <Input
            id="chat-message"
            name="chat-message"
            autocomplete="off"
            maxlength={140}
            placeholder={`Message ${props.friend.username}`}
          />
        </label>
        <Button type="submit" disabled={pending()}>
          Send
        </Button>
      </form>
    </section>
  );
};
