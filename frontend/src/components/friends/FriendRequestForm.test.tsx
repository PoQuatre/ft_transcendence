import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { FriendRequestForm } from './FriendRequestForm';

const me = { id: '1', username: 'NEXUS_VIPER', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function send(view: ReturnType<typeof render>, username: string) {
  const input =
    view.container.querySelector<HTMLInputElement>('#friend-username');
  if (!input) throw new Error('Missing #friend-username');
  fireEvent.input(input, { target: { value: username } });
  fireEvent.submit(view.getByRole('button', { name: /send/i }));
  return input;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('<FriendRequestForm />', () => {
  test('sends the call-sign and clears the field', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ message: 'request successfully sent.' }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <FriendRequestForm />);

    const input = send(view, ' ghost ');

    expect(
      await view.findByText('Demande envoyée à ghost.'),
    ).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/friends/requests/send',
      expect.objectContaining({ body: JSON.stringify({ username: 'ghost' }) }),
    );
  });

  test('refuses your own call-sign', async () => {
    setCurrentUser(me);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <FriendRequestForm />);

    send(view, 'nexus_viper');

    expect(await view.findByText('Nice try')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('asks for a call-sign', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <FriendRequestForm />);

    send(view, '  ');

    expect(await view.findByText('Call-sign required')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows an unknown call-sign', async () => {
    setCurrentUser(me);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ message: 'user not found' }, 404))
        .mockResolvedValueOnce(json(me, 200)),
    );
    const view = render(() => <FriendRequestForm />);

    send(view, 'ghost');

    expect(
      await view.findByText('Aucun pilote avec ce call-sign.'),
    ).toBeInTheDocument();
  });
});
