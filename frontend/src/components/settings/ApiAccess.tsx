import {
  type Component,
  createSignal,
  Match,
  onSettled,
  Show,
  Switch,
} from 'solid-js';

import {
  Badge,
  Button,
  buttonVariants,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from '~/components/ui';
import {
  type ApiKey,
  createApiKey,
  deleteApiKey,
  getApiKey,
} from '~/lib/apiKey';

import { type Feedback, FIELD_LABEL, FormFeedback } from './form';

type Action = 'regenerate' | 'delete';

const CONFIRM = {
  regenerate: {
    title: 'Regenerate key',
    description:
      "L'ancienne clé arrête de marcher tout de suite. Tes scripts devront utiliser la nouvelle.",
    button: 'Regenerate',
    pending: 'Generating…',
  },
  delete: {
    title: 'Delete key',
    description:
      "Les scripts qui utilisent cette clé n'auront plus accès à l'API.",
    button: 'Delete key',
    pending: 'Deleting…',
  },
} as const;

const day = (value: string) => new Date(value).toLocaleDateString('fr-FR');
const lastUse = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Jamais';

export const ApiAccess: Component = () => {
  const [loading, setLoading] = createSignal(true);
  // undefined : lecture en échec, null : le compte n'a pas de clé.
  const [key, setKey] = createSignal<ApiKey | null>();
  const [secret, setSecret] = createSignal<string>();
  const [copied, setCopied] = createSignal(false);
  const [action, setAction] = createSignal<Action>('regenerate');
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [feedback, setFeedback] = createSignal<Feedback>();

  const fail = (error: { title: string; message: string }) =>
    setFeedback({ kind: 'error', title: error.title, message: error.message });

  const load = async () => {
    setLoading(true);
    setFeedback(undefined);
    const result = await getApiKey();
    setLoading(false);
    if (result.ok) setKey(result.key);
    else fail(result);
  };

  onSettled(() => {
    void load();
  });

  const ask = (next: Action) => {
    setAction(next);
    setOpen(true);
  };

  const close = () => {
    if (!pending()) setOpen(false);
  };

  const generate = async () => {
    setPending(true);
    setFeedback(undefined);
    const result = await createApiKey();
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      fail(result);
      return;
    }
    setKey(result.key);
    setSecret(result.secret);
    setCopied(false);
    setFeedback({
      kind: 'success',
      title: 'Key generated',
      message:
        'Copie-la maintenant : elle disparaît dès que tu quittes cet onglet.',
    });
  };

  const remove = async () => {
    setPending(true);
    setFeedback(undefined);
    const result = await deleteApiKey();
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      fail(result);
      return;
    }
    setKey(null);
    setSecret(undefined);
    setFeedback({
      kind: 'info',
      title: 'Key deleted',
      message: "Ta clé d'API est révoquée.",
    });
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setFeedback({
        kind: 'error',
        title: 'Copy failed',
        message: 'Copie impossible, sélectionne la clé à la main.',
      });
    }
  };

  return (
    <>
      <section class="space-y-space-md" aria-labelledby="api-key-title">
        <div class={FIELD_LABEL}>
          <span id="api-key-title">API KEY</span>
          <Show when={!loading() && key() !== undefined}>
            <Badge variant={key() ? 'success' : 'outline'}>
              {key() ? 'ACTIVE' : 'NO KEY'}
            </Badge>
          </Show>
        </div>
        <p class="font-body-sm text-body-sm text-text-secondary">
          Ta clé donne accès à l'API publique depuis tes propres scripts.
          Envoie-la dans l'en-tête{' '}
          <code class="whitespace-nowrap font-label-data text-accent-primary">
            X-API-Key
          </code>{' '}
          de chaque requête.
        </p>
        <FormFeedback feedback={feedback()} />

        <Show when={secret()}>
          {(value) => (
            <div class="flex items-end gap-space-sm">
              <label class="block flex-1" for="api-key-secret">
                <span class={FIELD_LABEL}>YOUR KEY</span>
                <Input
                  id="api-key-secret"
                  readonly
                  value={value()}
                  class="text-body-sm tracking-normal"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void copy(value())}
              >
                {copied() ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          )}
        </Show>

        <Switch>
          <Match when={loading()}>
            <p class="font-label-mono-caps text-label-mono-caps text-text-muted">
              SCANNING KEYS…
            </p>
          </Match>
          <Match when={key() === undefined}>
            <Button
              type="button"
              variant="outline"
              size="lg"
              class="w-full tracking-[0.1em]"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </Match>
          <Match when={key() === null}>
            <Button
              type="button"
              size="lg"
              class="w-full tracking-[0.1em]"
              disabled={pending()}
              onClick={() => void generate()}
            >
              {pending() ? 'Generating…' : '◎ Generate key'}
            </Button>
          </Match>
          <Match when={key()}>
            {(info) => (
              <>
                <dl class="grid grid-cols-[auto_1fr] gap-x-space-lg gap-y-space-xs font-label-data text-label-data">
                  <dt class="text-text-muted">KEY</dt>
                  <dd class="text-text-primary">{info().prefix}••••••••</dd>
                  <dt class="text-text-muted">CREATED</dt>
                  <dd class="text-text-primary">{day(info().created_at)}</dd>
                  <dt class="text-text-muted">LAST USED</dt>
                  <dd class="text-text-primary">
                    {lastUse(info().last_used_at)}
                  </dd>
                </dl>
                <div class="flex flex-col gap-space-sm sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    class="w-full tracking-[0.1em] sm:flex-1"
                    onClick={() => ask('regenerate')}
                  >
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    class="w-full tracking-[0.1em] sm:flex-1"
                    onClick={() => ask('delete')}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </Match>
        </Switch>
      </section>

      <Separator class="my-space-lg" />

      <section class="space-y-space-md" aria-labelledby="api-docs-title">
        <div class={FIELD_LABEL}>
          <span id="api-docs-title">DOCUMENTATION</span>
        </div>
        <p class="font-body-sm text-body-sm text-text-secondary">
          Les routes de l'API, leurs paramètres et leurs limites de débit.
        </p>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          class={buttonVariants({
            variant: 'outline',
            size: 'lg',
            class: 'w-full tracking-[0.1em]',
          })}
        >
          Open the docs ↗
        </a>
      </section>

      <Dialog
        open={open()}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        labelledBy="api-key-dialog-title"
      >
        <DialogHeader class="border-b-0">
          <DialogTitle id="api-key-dialog-title">
            {CONFIRM[action()].title}
          </DialogTitle>
          <DialogDescription>{CONFIRM[action()].description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
            variant={action() === 'delete' ? 'destructive' : 'cyan'}
            disabled={pending()}
            onClick={() => void (action() === 'delete' ? remove() : generate())}
          >
            {pending() ? CONFIRM[action()].pending : CONFIRM[action()].button}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
};
