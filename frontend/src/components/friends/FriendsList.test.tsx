import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { FriendsList } from './FriendsList';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

const page = (relations: unknown[]) =>
  json({ relations, total_pages: 1, current_page: 1 }, 200);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<FriendsList />', () => {
  test('shows the friends', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(page([{ username: 'ghost', friend_id: 'f1' }])),
    );
    const view = render(() => <FriendsList />);

    expect(await view.findByText('ghost')).toBeInTheDocument();
  });

  test('says when there are no friends yet', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(page([])));
    const view = render(() => <FriendsList />);

    expect(
      await view.findByText("Pas encore d'amis dans ton escouade."),
    ).toBeInTheDocument();
  });

  test('shows the backend error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
    );
    const view = render(() => <FriendsList />);

    expect(await view.findByText('Uplink lost')).toBeInTheDocument();
  });

  test('removes a friend after confirmation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([{ username: 'ghost', friend_id: 'f1' }]))
      .mockResolvedValueOnce(json({ message: 'ok' }, 200))
      .mockResolvedValueOnce(page([]));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <FriendsList />);

    fireEvent.click(await view.findByRole('button', { name: 'Remove ghost' }));
    await screen.findByRole('dialog', { name: 'Remove friend' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(await view.findByText('Friend removed')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/friends/unfriend',
      expect.objectContaining({ body: JSON.stringify({ friend_id: 'f1' }) }),
    );
    expect(
      await view.findByText("Pas encore d'amis dans ton escouade."),
    ).toBeInTheDocument();
  });

  test('keeps the friend on cancel', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(page([{ username: 'ghost', friend_id: 'f1' }]));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <FriendsList />);

    fireEvent.click(await view.findByRole('button', { name: 'Remove ghost' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(view.getByText('ghost')).toBeInTheDocument();
  });
});
