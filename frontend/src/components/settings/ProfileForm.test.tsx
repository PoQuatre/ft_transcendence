import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ProfileForm } from './ProfileForm';

const user = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

function field(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing #${id}`);
  return input;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<ProfileForm />', () => {
  test('prefills the account values', () => {
    const { container } = render(() => <ProfileForm user={user} />);

    expect(field(container, 'profile-username').value).toBe('nexus_viper');
    expect(field(container, 'profile-email').value).toBe('nexus@example.com');
  });

  test('sends only the changed fields', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 200))
      .mockResolvedValueOnce(json({ ...user, username: 'ada' }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => (
      <ProfileForm user={user} />
    ));

    fireEvent.input(field(container, 'profile-username'), {
      target: { value: 'ada' },
    });
    fireEvent.submit(getByRole('button', { name: /update profile/i }));

    expect(await findByText('Profile updated')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ username: 'ada' }),
      }),
    );
  });

  test('refuses to submit when nothing changed', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { getByRole, findByText } = render(() => <ProfileForm user={user} />);

    fireEvent.submit(getByRole('button', { name: /update profile/i }));

    expect(await findByText('Nothing to update')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows the backend conflict message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ message: 'email already used' }, 409)),
    );
    const { container, getByRole, findByText } = render(() => (
      <ProfileForm user={user} />
    ));

    fireEvent.input(field(container, 'profile-email'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.submit(getByRole('button', { name: /update profile/i }));

    expect(await findByText('Email taken')).toBeInTheDocument();
  });
});
