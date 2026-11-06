import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { currentUser, setCurrentUser } from '~/lib/auth';

import { DeleteAccount } from './DeleteAccount';

const me = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

async function openDialog() {
  render(() => <DeleteAccount />);
  fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
  return screen.findByRole('dialog', { name: 'Delete account' });
}

function submit(password: string) {
  const input = document.querySelector<HTMLInputElement>('#delete-password');
  if (!input) throw new Error('Missing #delete-password');
  fireEvent.input(input, { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('<DeleteAccount />', () => {
  test('deletes the account once the password is confirmed', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();

    submit('Old-password-1!');

    await waitFor(() => expect(currentUser()).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ password: 'Old-password-1!' }),
      }),
    );
  });

  test('keeps the dialog open on a wrong password', async () => {
    setCurrentUser(me);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ message: 'invalid password' }, 400))
        .mockResolvedValueOnce(json(me, 200)),
    );
    await openDialog();

    submit('nope');

    expect(
      await screen.findByText('Mot de passe actuel incorrect.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(currentUser()).toEqual(me);
  });

  test('asks for the password before calling the backend', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();

    submit('');

    expect(await screen.findByText('Password required')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('closes without deleting on cancel', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
