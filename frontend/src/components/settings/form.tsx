import { type Component, Show } from 'solid-js';

import { Alert, AlertDescription, AlertTitle } from '~/components/ui';

// Éléments communs aux formulaires de la page settings.

export const FIELD_LABEL =
  'mb-space-xs flex items-center justify-between font-label-mono-caps text-label-mono-caps text-on-surface-variant';

// FormData peut renvoyer un File : on ne garde que les chaînes, sans les
// modifier (les espaces sont valides dans un mot de passe).
export const text = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value : '';

export type Feedback = {
  kind: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

const ALERT_VARIANT = {
  error: 'destructive',
  success: 'success',
  info: 'cyan',
} as const;

export const FormFeedback: Component<{ feedback: Feedback | undefined }> = (
  props,
) => (
  <Show when={props.feedback}>
    {(fb) => (
      <Alert variant={ALERT_VARIANT[fb().kind]}>
        <span class="font-mono font-bold">
          {fb().kind === 'error' ? '!' : '◆'}
        </span>
        <div>
          <AlertTitle>{fb().title}</AlertTitle>
          <AlertDescription>{fb().message}</AlertDescription>
        </div>
      </Alert>
    )}
  </Show>
);
