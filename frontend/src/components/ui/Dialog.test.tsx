import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Dialog, DialogTitle } from './Dialog';

function open(onOpenChange: (open: boolean) => void) {
  render(() => (
    <Dialog open onOpenChange={onOpenChange} labelledBy="dialog-title">
      <DialogTitle id="dialog-title">Delete account</DialogTitle>
    </Dialog>
  ));
}

afterEach(cleanup);

describe('<Dialog />', () => {
  test('is announced by its title', async () => {
    open(vi.fn<(open: boolean) => void>());

    expect(
      await screen.findByRole('dialog', { name: 'Delete account' }),
    ).toHaveAttribute('aria-modal', 'true');
  });

  test('closes with Escape', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    open(onOpenChange);
    await screen.findByRole('dialog');

    await vi.waitFor(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  test('closes on a backdrop click', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    open(onOpenChange);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Fermer la boîte de dialogue',
      }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
