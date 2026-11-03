import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test } from 'vitest';

import { DEFAULT_CONTROLS } from '~/lib/controls';

import { ControlsForm } from './ControlsForm';

const STORAGE_KEY = 'ft_transcendence.controls';

const saved = (): unknown =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

async function rebind(
  view: ReturnType<typeof render>,
  init: KeyboardEventInit,
) {
  fireEvent.click(view.getByRole('button', { name: 'Avancer : W' }));
  const button = await view.findByRole('button', {
    name: 'Avancer : appuie sur une touche',
  });
  fireEvent.keyDown(button, init);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('<ControlsForm />', () => {
  test('shows the default keys', async () => {
    const view = render(() => <ControlsForm />);

    expect(
      await view.findByRole('button', { name: 'Avancer : W' }),
    ).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Dash : SHIFT' })).toBeVisible();
  });

  test('binds an action to the next key pressed', async () => {
    const view = render(() => <ControlsForm />);
    await view.findByRole('button', { name: 'Avancer : W' });

    await rebind(view, { key: 'z', keyCode: 0x5a });

    expect(
      await view.findByRole('button', { name: 'Avancer : Z' }),
    ).toBeInTheDocument();
    expect(view.getByText('Key saved')).toBeInTheDocument();
    expect(saved()).toEqual({ ...DEFAULT_CONTROLS, up: 90 });
  });

  test('refuses a key used by another action', async () => {
    const view = render(() => <ControlsForm />);
    await view.findByRole('button', { name: 'Avancer : W' });

    await rebind(view, { key: 's', keyCode: 0x53 });

    expect(
      await view.findByText('S est déjà utilisée par Reculer.'),
    ).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Avancer : W' })).toBeVisible();
    expect(saved()).toBeNull();
  });

  test('rejects a key the game does not handle', async () => {
    const view = render(() => <ControlsForm />);
    await view.findByRole('button', { name: 'Avancer : W' });

    await rebind(view, { key: 'F1', keyCode: 0x70 });

    expect(await view.findByText('Key not supported')).toBeInTheDocument();
    expect(saved()).toBeNull();
  });

  test('cancels with Escape', async () => {
    const view = render(() => <ControlsForm />);
    await view.findByRole('button', { name: 'Avancer : W' });

    await rebind(view, { key: 'Escape', keyCode: 0x1b });

    expect(
      await view.findByRole('button', { name: 'Avancer : W' }),
    ).toBeInTheDocument();
    expect(view.queryByRole('alert')).not.toBeInTheDocument();
    expect(saved()).toBeNull();
  });

  test('loads the saved keys and resets them', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_CONTROLS, up: 90 }),
    );
    const view = render(() => <ControlsForm />);
    await view.findByRole('button', { name: 'Avancer : Z' });

    fireEvent.click(view.getByRole('button', { name: 'Touches par défaut' }));

    expect(
      await view.findByRole('button', { name: 'Avancer : W' }),
    ).toBeInTheDocument();
    expect(saved()).toEqual(DEFAULT_CONTROLS);
  });
});
