import { afterEach, describe, expect, test, vi } from 'vitest';

import { changePassword, currentUser, updateProfile } from './auth';

const me = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
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
  test('sends snake_case fields with PUT to /api/auth/password', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(
      await changePassword({
        currentPassword: 'Old-password-1!',
        newPassword: 'New-password-1!',
      }),
    ).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          current_password: 'Old-password-1!',
          new_password: 'New-password-1!',
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
