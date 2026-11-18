import { cleanup, render } from '@solidjs/testing-library';
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
});
