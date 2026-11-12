import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  changePassword,
  currentUser,
  deleteAccount,
  exportAccount,
  setCurrentUser,
  updateProfile,
} from './auth';

const me = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('updateProfile', () => {
  test('sends a PATCH to /api/auth/me then refreshes currentUser', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 200))
      .mockResolvedValueOnce(json(me, 200));
    vi.stubGlobal('fetch', fetchMock);

    expect(await updateProfile({ username: 'nexus_viper' })).toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ username: 'nexus_viper' }),
      }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/me');
    await vi.waitFor(() => expect(currentUser()).toEqual(me));
  });

  test('translates a taken call-sign', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ message: 'username already used' }, 409)),
    );

    expect(await updateProfile({ username: 'taken' })).toMatchObject({
      ok: false,
      title: 'Call-sign taken',
    });
  });
});

describe('changePassword', () => {
  test('posts oldpassword and newpassword to /api/auth/change-password', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'password successfully changed.' }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    expect(
      await changePassword({
        currentPassword: 'Old-password-1!',
        newPassword: 'New-password-1!',
      }),
    ).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          oldpassword: 'Old-password-1!',
          newpassword: 'New-password-1!',
        }),
      }),
    );
  });

  test('reports a missing backend route as offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('404 page not found', { status: 404 })),
    );

    expect(
      await changePassword({ currentPassword: 'a', newPassword: 'b' }),
    ).toMatchObject({ ok: false, title: 'Module offline' });
  });
});

describe('session check after a failed authenticated call', () => {
  test('drops the session when /me answers 401', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'invalid session user id' }, 500))
      .mockResolvedValueOnce(json({ message: 'unauthorized' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await changePassword({ currentPassword: 'a', newPassword: 'b' });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/me');
    await vi.waitFor(() => expect(currentUser()).toBeNull());
  });

  test('keeps the session when the check cannot reach the server', async () => {
    setCurrentUser(me);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ message: 'invalid password' }, 400))
        .mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );

    await changePassword({ currentPassword: 'a', newPassword: 'b' });

    await vi.waitFor(() => expect(currentUser()).toEqual(me));
  });
});

describe('exportAccount', () => {
  test('returns the JSON sent by /api/auth/me/export', async () => {
    const data = { user: me, matches: [] };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(data, 200));
    vi.stubGlobal('fetch', fetchMock);

    expect(await exportAccount()).toEqual({ ok: true, data });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me/export',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  test('reports a missing backend route as offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('404 page not found', { status: 404 })),
    );

    expect(await exportAccount()).toMatchObject({
      ok: false,
      title: 'Module offline',
    });
  });
});

describe('deleteAccount', () => {
  test('sends a DELETE with the password, then drops the session', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await deleteAccount('Old-password-1!')).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ password: 'Old-password-1!' }),
      }),
    );
    await vi.waitFor(() => expect(currentUser()).toBeNull());
  });

  test('keeps the session on a wrong password', async () => {
    setCurrentUser(me);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ message: 'invalid password' }, 400))
        .mockResolvedValueOnce(json(me, 200)),
    );

    expect(await deleteAccount('nope')).toMatchObject({
      ok: false,
      title: 'Access denied',
    });
    await vi.waitFor(() => expect(currentUser()).toEqual(me));
  });
});
