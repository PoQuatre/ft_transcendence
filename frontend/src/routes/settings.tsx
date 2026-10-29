import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createEffect, Show } from 'solid-js';

import { EmailVerification } from '~/components/settings/EmailVerification';
import { PasswordForm } from '~/components/settings/PasswordForm';
import { ProfileForm } from '~/components/settings/ProfileForm';
import {
  Badge,
  Card,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui';
import { currentUser } from '~/lib/auth';
import { paths } from '~/router';

// Page réservée aux pilotes connectés : paramètres du compte (OPERATOR) et
// préférences de combat (COMBAT). Le contenu des onglets arrive ensuite.
export default function Settings() {
  const navigate = useNavigate();

  // currentUser() vaut undefined tant que la session n'est pas vérifiée (SSR,
  // getMe() du Header en cours) : on attend. null = vérifiée, personne n'est
  // connecté : retour au login.
  createEffect(
    () => currentUser(),
    (user) => {
      if (user === null) navigate(paths.login(), { replace: true });
    },
  );

  return (
    <>
      <Title>Settings - FT_TRANSCENDENCE</Title>
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
                    [SYS_CONFIG // {user().username}]
                  </span>
                  <Badge variant="success">
                    <span class="h-1.5 w-1.5 animate-pulse bg-success-foreground" />{' '}
                    UPLINK
                  </Badge>
                </div>

                <div class="p-space-lg">
                  <h1 class="font-headline-xl text-headline-xl uppercase">
                    Pilot{' '}
                    <span class="text-accent-primary text-glow-cyan">
                      Settings
                    </span>
                  </h1>
                  <p class="mt-space-xs font-body-sm text-body-sm text-text-secondary">
                    Paramètres du compte et préférences de combat.
                  </p>

                  <Tabs defaultValue="operator" class="mt-space-lg">
                    <TabsList class="w-full">
                      <TabsTrigger value="operator" class="flex-1">
                        OPERATOR
                      </TabsTrigger>
                      <TabsTrigger value="combat" class="flex-1">
                        COMBAT
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="operator" class="mt-space-md">
                      <ProfileForm user={user()} />
                      <EmailVerification user={user()} />
                      <Separator class="my-space-lg" />
                      <PasswordForm />
                    </TabsContent>
                    <TabsContent value="combat" class="mt-space-md">
                      <p class="font-label-data text-label-data text-text-muted">
                        COMBAT MODULE // PENDING
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </Card>
            )}
          </Show>
        </div>
      </section>
    </>
  );
}
