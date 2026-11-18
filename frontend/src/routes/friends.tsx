import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createEffect, Show } from 'solid-js';

import { FriendRequestForm } from '~/components/friends/FriendRequestForm';
import { FriendsList } from '~/components/friends/FriendsList';
import { Badge, Card, Separator } from '~/components/ui';
import { currentUser } from '~/lib/auth';
import { paths } from '~/router';

export default function Friends() {
  const navigate = useNavigate();

  createEffect(
    () => currentUser(),
    (user) => {
      if (user === null) navigate(paths.login(), { replace: true });
    },
  );

  return (
    <>
      <Title>Friends - FT_TRANSCENDENCE</Title>
      <section class="relative z-10 flex flex-1 justify-center px-4 py-12">
        <div class="w-full max-w-3xl">
          <Show
            when={currentUser()}
            fallback={
              <p class="text-center font-label-mono-caps text-label-mono-caps text-text-secondary">
                VERIFYING UPLINK…
              </p>
            }
          >
            {(user) => (
              <Card variant="chamfer">
                <div class="flex items-center justify-between border-b border-border-subtle/60 px-space-lg py-space-sm">
                  <span class="font-label-data text-label-data text-text-muted">
                    [SQUAD // {user().username}]
                  </span>
                  <Badge variant="success">
                    <span class="h-1.5 w-1.5 animate-pulse bg-success-foreground" />{' '}
                    UPLINK
                  </Badge>
                </div>

                <div class="space-y-space-lg p-space-lg">
                  <div>
                    <h1 class="font-headline-xl text-headline-xl uppercase">
                      Pilot{' '}
                      <span class="text-accent-primary text-glow-cyan">
                        Squad
                      </span>
                    </h1>
                    <p class="mt-space-xs font-body-sm text-body-sm text-text-secondary">
                      Tes amis et les demandes reçues.
                    </p>
                  </div>
                  <FriendRequestForm />
                  <Separator />
                  <FriendsList />
                </div>
              </Card>
            )}
          </Show>
        </div>
      </section>
    </>
  );
}
