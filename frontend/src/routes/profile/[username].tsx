import { Title } from '@solidjs/meta';
import type { RouteProps } from '@solidjs/router';
import { Show } from 'solid-js';

import { IdentityCard } from '~/components/profile/IdentityCard';
import { PilotStatsPanel } from '~/components/profile/PilotStatsPanel';
import { FOCUS_PRIMARY, ProfileBackdrop } from '~/components/profile/shared';
import { buttonVariants } from '~/components/ui';
import { useSessionUser } from '~/lib/auth';
import { MOCK_STATS } from '~/lib/profile';
import { cn } from '~/lib/utils';
import { paths } from '~/router';

// Profil public d'un autre pilote, ouvert depuis la liste d'amis.
// TEMPORAIRE : le backend n'expose pas encore de profil public (seulement
// /api/auth/me) : on affiche le pseudo de l'URL avec les stats fictives,
// sans e-mail ni liste d'amis.
export default function PilotProfile(props: RouteProps<'/profile/:username'>) {
  const username = () => props.params.username;
  const session = useSessionUser();
  const isMe = () => session()?.username === username();

  return (
    <>
      <Title>{`${username()} - FT_TRANSCENDENCE`}</Title>
      <ProfileBackdrop />
      <div class="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <IdentityCard
            username={username()}
            status={{ label: isMe() ? 'YOUR PUBLIC FILE' : 'PUBLIC FILE' }}
            action={
              <Show when={session()}>
                <a
                  href={paths.profile()}
                  class={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'no-underline tracking-wider',
                    FOCUS_PRIMARY,
                  )}
                >
                  ← MY PROFILE
                </a>
              </Show>
            }
          >
            <p class="mt-space-xs font-body-sm text-body-sm text-text-secondary">
              Pilot profile
            </p>
          </IdentityCard>

          <div class="grid min-w-0 lg:col-span-12">
            <PilotStatsPanel stats={MOCK_STATS} />
          </div>
        </div>
      </div>
    </>
  );
}
