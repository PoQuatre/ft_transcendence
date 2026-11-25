import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createEffect, createSignal, For, Show } from 'solid-js';

import { IdentityCard } from '~/components/profile/IdentityCard';
import { PilotStatsPanel } from '~/components/profile/PilotStatsPanel';
import {
  FOCUS_PRIMARY,
  initials,
  Notice,
  Pager,
  PANEL,
  PanelHeading,
  ProfileBackdrop,
} from '~/components/profile/shared';
import { Avatar, Badge } from '~/components/ui';
import { useSessionUser } from '~/lib/auth';
import { listFriends } from '~/lib/friends';
import { MOCK_STATS } from '~/lib/profile';
import { cn } from '~/lib/utils';
import { paths } from '~/router';

type FriendsResult = Awaited<ReturnType<typeof listFriends>>;

// Les messages de lib/auth.ts sont en français (partagés par toute l'app) :
// la page profil affiche sa propre version anglaise, à partir du titre.
const FRIENDS_ERROR_MESSAGES: Record<string, string> = {
  'Email not verified': 'Verify your email in the settings to use friends.',
  'Access denied': 'Your session has expired, please log in again.',
  'Module offline': 'This feature is not available on the server yet.',
  'Uplink lost': 'Could not reach the server, please try again later.',
};

const friendsErrorMessage = (title: string) =>
  FRIENDS_ERROR_MESSAGES[title] ?? 'Could not load your friends list.';

// Profil du pilote connecté : son identité et sa liste d'amis. Chaque ami
// renvoie vers son profil public (/profile/:username), qui reste accessible
// sans être connecté.
// Les demandes d'amis et le chat sont gérés par l'overlay du header.
export default function Profile() {
  const navigate = useNavigate();
  // undefined : session pas encore connue (SSR, hydratation, getMe() en cours),
  // on attend. null : personne n'est connecté, retour au login.
  const session = useSessionUser();

  createEffect(
    () => session(),
    (user) => {
      if (user === null) navigate(paths.login(), { replace: true });
    },
  );

  const [friends, setFriends] = createSignal<FriendsResult | undefined>();
  const [page, setPage] = createSignal(1);

  const loadFriends = async (target: number) => {
    setFriends(undefined);
    setFriends(await listFriends(target));
    setPage(target);
  };

  const friendsError = () => {
    const r = friends();
    return r && !r.ok ? r : undefined;
  };

  // La liste n'est demandée qu'une fois la session connue.
  createEffect(
    () => session()?.id,
    (id) => {
      if (id) void loadFriends(1);
    },
  );

  return (
    <>
      <Title>Profile - FT_TRANSCENDENCE</Title>
      <ProfileBackdrop />
      <div class="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
        <Show
          when={session()}
          fallback={
            <p class="text-center font-label-mono-caps text-label-mono-caps text-text-secondary">
              VERIFYING UPLINK…
            </p>
          }
        >
          {(user) => (
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <IdentityCard
                username={user().username}
                status={{ label: 'ONLINE', online: true }}
              >
                <p
                  class="mt-space-xs truncate font-body-sm text-body-sm text-text-secondary"
                  title={user().email}
                >
                  {user().email}
                </p>
                <div class="mt-space-sm flex flex-wrap gap-space-sm">
                  <Show
                    when={user().verified}
                    fallback={
                      <Badge variant="warning" class="whitespace-nowrap">
                        ! EMAIL NOT VERIFIED
                      </Badge>
                    }
                  >
                    <Badge variant="success" class="whitespace-nowrap">
                      ✓ EMAIL VERIFIED
                    </Badge>
                  </Show>
                  <Badge
                    variant="outline"
                    class="max-w-full truncate"
                    title={user().id}
                  >
                    ID {user().id}
                  </Badge>
                </div>
              </IdentityCard>

              <div class="grid min-w-0 lg:col-span-7">
                <PilotStatsPanel stats={MOCK_STATS} />
              </div>

              {/* Amis */}
              <section
                aria-labelledby="friends-title"
                class={cn(PANEL, 'lg:col-span-5')}
              >
                <PanelHeading
                  id="friends-title"
                  eyebrow="SQUAD"
                  title="Friends"
                  accent="secondary"
                />
                <div class="mt-space-md">
                  <Show
                    when={friends()}
                    fallback={
                      <output class="block font-label-mono-caps text-label-mono-caps text-text-muted">
                        SCANNING NETWORK…
                      </output>
                    }
                  >
                    {(result) => (
                      <Show
                        when={(() => {
                          const r = result();
                          return r.ok ? r.page : undefined;
                        })()}
                        fallback={
                          <Show when={friendsError()}>
                            {(err) => (
                              <Notice
                                variant={
                                  err().title === 'Email not verified'
                                    ? 'warning'
                                    : 'destructive'
                                }
                                title={err().title}
                                message={friendsErrorMessage(err().title)}
                              />
                            )}
                          </Show>
                        }
                      >
                        {(list) => (
                          <>
                            <Show
                              when={list().items.length > 0}
                              fallback={
                                <p class="font-body-sm text-body-sm text-text-secondary">
                                  No friends yet.
                                </p>
                              }
                            >
                              <ul class="grid gap-space-sm">
                                <For each={list().items}>
                                  {(friend) => (
                                    <li>
                                      <a
                                        href={paths.profile(friend.username)}
                                        class={cn(
                                          'group flex min-w-0 items-center gap-space-sm rounded-md border border-border-subtle/60 bg-surface-2/40 px-space-md py-space-sm no-underline transition-colors hover:border-accent-primary/60 hover:bg-accent-primary-subtle/30',
                                          FOCUS_PRIMARY,
                                        )}
                                      >
                                        <Avatar
                                          fallback={initials(friend.username)}
                                          aria-hidden="true"
                                        />
                                        <span class="min-w-0 flex-1 truncate font-label-mono-caps text-label-mono-caps text-text-primary">
                                          {friend.username}
                                        </span>
                                        <span
                                          aria-hidden="true"
                                          class="font-label-data text-label-data text-text-muted transition-colors group-hover:text-accent-primary"
                                        >
                                          →
                                        </span>
                                      </a>
                                    </li>
                                  )}
                                </For>
                              </ul>
                            </Show>
                            <Pager
                              label="Friends pagination"
                              page={page()}
                              totalPages={list().totalPages}
                              onPage={(target) => void loadFriends(target)}
                            />
                          </>
                        )}
                      </Show>
                    )}
                  </Show>
                </div>
              </section>
            </div>
          )}
        </Show>
      </div>
    </>
  );
}
