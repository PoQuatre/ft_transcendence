import { type Component, createSignal } from 'solid-js';

import { Button } from '~/components/ui';
import { type AuthUser, exportAccount } from '~/lib/auth';

import { type Feedback, FIELD_LABEL, FormFeedback } from './form';

function download(filename: string, data: unknown) {
  const link = document.createElement('a');
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2),
  )}`;
  link.download = filename;
  link.click();
}

export type DataExportProps = { user: AuthUser };

export const DataExport: Component<DataExportProps> = (props) => {
  const [feedback, setFeedback] = createSignal<Feedback>();
  const [pending, setPending] = createSignal(false);

  const run = async () => {
    setPending(true);
    setFeedback(undefined);
    const result = await exportAccount();
    setPending(false);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        title: result.title,
        message: result.message,
      });
      return;
    }
    const filename = `ft_transcendence-${props.user.username}.json`;
    download(filename, result.data);
    setFeedback({
      kind: 'success',
      title: 'Export ready',
      message: `Le fichier ${filename} a été téléchargé.`,
    });
  };

  return (
    <section class="space-y-space-md" aria-labelledby="data-export-title">
      <div class={FIELD_LABEL}>
        <span id="data-export-title">YOUR DATA</span>
      </div>
      <FormFeedback feedback={feedback()} />
      <p class="font-body-sm text-body-sm text-text-secondary">
        Télécharge toutes les données liées à ton compte, dans un fichier JSON.
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        class="w-full tracking-[0.1em]"
        disabled={pending()}
        onClick={() => void run()}
      >
        {pending() ? 'Exporting…' : '◎ Export my data'}
      </Button>
    </section>
  );
};
