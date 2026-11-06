import { type Component, createSignal } from 'solid-js';

import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PasswordInput,
} from '~/components/ui';
import { deleteAccount } from '~/lib/auth';

import { type Feedback, FIELD_LABEL, FormFeedback, text } from './form';

export const DeleteAccount: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [feedback, setFeedback] = createSignal<Feedback>();

  const close = () => {
    if (pending()) return;
    setOpen(false);
    setFeedback(undefined);
  };

  const confirm = async (form: HTMLFormElement) => {
    const password = text(new FormData(form).get('delete-password'));
    if (!password) {
      setFeedback({
        kind: 'error',
        title: 'Password required',
        message: 'Saisis ton mot de passe pour confirmer la suppression.',
      });
      return;
    }
    setPending(true);
    setFeedback(undefined);
    const result = await deleteAccount(password);
    setPending(false);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
    }
  };

  return (
    <section class="space-y-space-md" aria-labelledby="delete-account-title">
      <div class={FIELD_LABEL}>
        <span id="delete-account-title">DANGER ZONE</span>
      </div>
      <p class="font-body-sm text-body-sm text-text-secondary">
        Supprime définitivement ton compte et toutes ses données. Cette action
        est irréversible.
      </p>
      <Button
        type="button"
        variant="destructive"
        size="lg"
        class="w-full tracking-[0.1em]"
        onClick={() => setOpen(true)}
      >
        ◎ Delete account
      </Button>

      <Dialog
        open={open()}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        labelledBy="delete-dialog-title"
      >
        <form
          novalidate
          onSubmit={(event) => {
            event.preventDefault();
            void confirm(event.currentTarget);
          }}
        >
          <DialogHeader>
            <DialogTitle id="delete-dialog-title">Delete account</DialogTitle>
            <DialogDescription>
              Ton compte et toutes ses données seront supprimés. Saisis ton mot
              de passe pour confirmer.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-space-md py-space-md">
            <FormFeedback feedback={feedback()} />
            <label class="block" for="delete-password">
              <span class={FIELD_LABEL}>PASSWORD</span>
              <PasswordInput
                id="delete-password"
                name="delete-password"
                autocomplete="current-password"
                placeholder="••••••••••"
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending()}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending()}>
              {pending() ? 'Deleting…' : 'Delete forever'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </section>
  );
};
