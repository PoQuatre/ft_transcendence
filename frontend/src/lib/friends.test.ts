import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from './auth';
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  sendFriendRequest,
  unfriend,
} from './friends';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('friend lists', () => {
  test('reads a page of friends', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        {
          relations: [{ username: 'ghost', friend_id: 'f1' }],
          total_pages: 3,
          current_page: 2,
        },
        200,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await listFriends(2)).toEqual({
      ok: true,
      page: {
        items: [{ username: 'ghost', friend_id: 'f1' }],
        totalPages: 3,
        currentPage: 2,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/friends/list?page=2',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  test('reads the incoming requests', async () => {
    const request = {
      username: 'viper',
      sender_id: 's1',
      created_at: '2026-11-17T10:00:00Z',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ requests: [request], total_pages: 1, current_page: 1 }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);

    expect(await listFriendRequests()).toMatchObject({
      ok: true,
      page: { items: [request], totalPages: 1 },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/friends/requests/list?page=1',
    );
  });

  test('asks for a verified email', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json({ message: 'you need to verify your mail' }, 403),
        )
        .mockResolvedValueOnce(json({ id: '1' }, 200)),
    );

    expect(await listFriends()).toMatchObject({
      ok: false,
      title: 'Email not verified',
    });
  });
});

describe('friend actions', () => {
  test.each([
    [
      'send',
      () => sendFriendRequest('ghost'),
      '/api/friends/requests/send',
      { username: 'ghost' },
    ],
    [
      'accept',
      () => acceptFriendRequest('s1'),
      '/api/friends/requests/accept',
      { sender_id: 's1' },
    ],
    [
      'decline',
      () => declineFriendRequest('s1'),
      '/api/friends/requests/decline',
      { sender_id: 's1' },
    ],
    [
      'unfriend',
      () => unfriend('f1'),
      '/api/friends/unfriend',
      { friend_id: 'f1' },
    ],
  ])('%s posts the right body', async (_name, action, path, body) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ message: 'ok' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    expect(await action()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  test.each([
    [404, 'user not found', 'Unknown pilot'],
    [409, 'request already exists', 'Already requested'],
    [409, 'already friends', 'Already friends'],
  ])('translates %i "%s"', async (status, message, title) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ message }, status))
        .mockResolvedValueOnce(json({ id: '1' }, 200)),
    );

    expect(await sendFriendRequest('ghost')).toMatchObject({
      ok: false,
      title,
    });
  });
});
