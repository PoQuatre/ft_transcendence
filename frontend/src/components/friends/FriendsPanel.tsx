import { Portal } from '@solidjs/web';
import { type Component, createSignal, onSettled, Show } from 'solid-js';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Separator,
} from '~/components/ui';
import { currentUser } from '~/lib/auth';
import type { Friend } from '~/lib/friends';
import { paths } from '~/router';

import { Conversation } from './Conversation';
import { FriendRequestForm } from './FriendRequestForm';
import { FriendsList } from './FriendsList';
import { IncomingRequests } from './IncomingRequests';

export type FriendsPanelProps = { onClose: () => void };

export const FriendsPanel: Component<FriendsPanelProps> = (props) => {
  const [version, setVersion] = createSignal(0);
  const [chatWith, setChatWith] = createSignal<Friend>();

  const onKeyDown = (event: KeyboardEvent) => {
    // La popup de suppression d'un ami gère Échap elle-même.
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
      props.onClose();
    }
  };
  onSettled(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return (
    <Portal>
      <aside
        aria-labelledby="friends-panel-title"
        class="fixed inset-0 z-50 flex flex-col bg-surface-1 md:inset-auto md:top-16 md:right-0 md:bottom-0 md:w-85 md:border-l md:border-border-subtle md:shadow-2xl"
      >
        <div class="flex items-center justify-between border-b border-border-subtle/60 px-space-md py-space-xs">
          <h2
            id="friends-panel-title"
            class="font-label-mono-caps text-label-mono-caps text-accent-primary"
          >
            FRIENDS
          </h2>
          <button
            type="button"
            aria-label="Close friends panel"
            onClick={() => props.onClose()}
            class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:text-accent-primary"
          >
            <span class="material-symbols-outlined text-lg" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-space-md">
          <Show
            when={currentUser()?.verified !== false}
            fallback={
              <Alert variant="warning">
                <span class="font-mono font-bold">!</span>
                <div>
                  <AlertTitle>Email not verified</AlertTitle>
                  <AlertDescription>
                    Vérifie ton email dans les{' '}
                    <a
                      href={paths.settings()}
                      onClick={() => props.onClose()}
                      class="font-bold text-accent-primary underline-offset-4 hover:underline"
                    >
                      settings
                    </a>{' '}
                    pour ajouter des amis.
                  </AlertDescription>
                </div>
              </Alert>
            }
          >
            <Show
              when={chatWith()}
              fallback={
                <div class="space-y-space-lg">
                  <FriendRequestForm />
                  <Separator />
                  <IncomingRequests
                    onAccepted={() => setVersion((v) => v + 1)}
                  />
                  <Separator />
                  <FriendsList version={version()} onChat={setChatWith} />
                </div>
              }
            >
              {(friend) => (
                <Conversation
                  friend={friend()}
                  onBack={() => setChatWith(undefined)}
                />
              )}
            </Show>
          </Show>
        </div>
      </aside>
    </Portal>
  );
};
