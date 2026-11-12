import { type Component, createSignal, For, onSettled, Show } from 'solid-js';

import { Button, Kbd } from '~/components/ui';
import {
  actionUsing,
  ARROW_CONTROLS,
  CONTROL_ACTIONS,
  type ControlAction,
  type Controls,
  DEFAULT_CONTROLS,
  keyFromEvent,
  keyLabel,
  loadControls,
  saveControls,
} from '~/lib/controls';

import { type Feedback, FIELD_LABEL, FormFeedback } from './form';

const ROW_LABEL =
  'font-label-mono-caps text-label-mono-caps uppercase text-text-secondary';

const actionName = (id: ControlAction) =>
  CONTROL_ACTIONS.find((action) => action.id === id)?.label ?? id;

export const ControlsForm: Component = () => {
  const [controls, setControls] = createSignal<Controls>({
    ...DEFAULT_CONTROLS,
  });
  const [listening, setListening] = createSignal<ControlAction>();
  const [feedback, setFeedback] = createSignal<Feedback>();

  onSettled(() => {
    setControls(loadControls());
  });

  const apply = (next: Controls, success: Feedback) => {
    setControls(next);
    setFeedback(
      saveControls(next)
        ? success
        : {
            kind: 'error',
            title: 'Not saved',
            message:
              "Le navigateur refuse d'enregistrer : ces touches seront perdues au rechargement.",
          },
    );
  };

  const capture = (action: ControlAction, event: KeyboardEvent) => {
    if (listening() !== action) return;
    event.preventDefault();
    setListening(undefined);
    if (event.key === 'Escape') return;

    const key = keyFromEvent(event);
    if (key === undefined) {
      setFeedback({
        kind: 'error',
        title: 'Key not supported',
        message:
          'Choisis une lettre, un chiffre, une flèche, Espace, Shift, Ctrl ou Alt.',
      });
      return;
    }
    const owner = actionUsing(controls(), key, action);
    if (owner) {
      setFeedback({
        kind: 'error',
        title: 'Key already used',
        message: `${keyLabel(key)} est déjà utilisée par ${actionName(owner)}.`,
      });
      return;
    }
    apply(
      { ...controls(), [action]: key },
      {
        kind: 'success',
        title: 'Key saved',
        message: `${actionName(action)} : ${keyLabel(key)}.`,
      },
    );
  };

  return (
    <section class="space-y-space-md" aria-labelledby="controls-title">
      <div class={FIELD_LABEL}>
        <span id="controls-title">KEY BINDINGS</span>
      </div>
      <p class="font-body-sm text-body-sm text-text-secondary">
        Clique sur une action, puis appuie sur la nouvelle touche. Échap annule.
        Les touches sont enregistrées dans ce navigateur.
      </p>

      <FormFeedback feedback={feedback()} />

      <ul class="space-y-space-sm">
        <For each={CONTROL_ACTIONS}>
          {(action) => {
            const isListening = () => listening() === action.id;
            return (
              <li class="flex items-center justify-between gap-space-md">
                <span class={ROW_LABEL}>{action.label}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="min-w-32"
                  aria-label={`${action.label} : ${
                    isListening()
                      ? 'appuie sur une touche'
                      : keyLabel(controls()[action.id])
                  }`}
                  onClick={() =>
                    setListening(isListening() ? undefined : action.id)
                  }
                  onKeyDown={(event) => capture(action.id, event)}
                  onBlur={() => {
                    if (isListening()) setListening(undefined);
                  }}
                >
                  <Show
                    when={isListening()}
                    fallback={
                      <span class="inline-flex min-w-[2.5rem] justify-center">
                        <Kbd>{keyLabel(controls()[action.id])}</Kbd>
                      </span>
                    }
                  >
                    PRESS A KEY…
                  </Show>
                </Button>
              </li>
            );
          }}
        </For>
        <li class="flex items-center justify-between gap-space-md">
          <span class={ROW_LABEL}>Viser</span>
          <Kbd variant="outline">SOURIS</Kbd>
        </li>
      </ul>

      <div class="flex flex-wrap gap-space-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            apply(
              { ...DEFAULT_CONTROLS },
              {
                kind: 'success',
                title: 'Keys reset',
                message: 'Touches par défaut : W, S, A, D et Shift.',
              },
            )
          }
        >
          Touches par défaut
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            apply(
              { ...ARROW_CONTROLS },
              {
                kind: 'success',
                title: 'Arrow keys',
                message: 'Déplacement aux flèches, dash sur Shift.',
              },
            )
          }
        >
          Flèches
        </Button>
      </div>
    </section>
  );
};
