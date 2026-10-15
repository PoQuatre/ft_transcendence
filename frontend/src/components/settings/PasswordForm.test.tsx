import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { PasswordForm } from './PasswordForm';

const CURRENT = 'Old-password-1!';
const STRONG = 'New-password-1!';

function field(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing #${id}`);
  return input;
}

function fill(container: HTMLElement, next: string, confirm: string) {
  fireEvent.input(field(container, 'current-password'), {
    target: { value: CURRENT },
  });
  fireEvent.input(field(container, 'new-password'), {
    target: { value: next },
  });
  fireEvent.input(field(container, 'confirm-password'), {
    target: { value: confirm },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<PasswordForm />', () => {
  test('rejects a new password that breaks the rules', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => <PasswordForm />);

    fill(container, 'short', 'short');
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(await findByText('Weak password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('blocks submit when the confirmation differs', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => <PasswordForm />);

    fill(container, STRONG, 'nope');
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(
      await findByText('◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sends current and new password, then clears the form', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => <PasswordForm />);

    fill(container, STRONG, STRONG);
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(await findByText('Password updated')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/password',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          current_password: CURRENT,
          new_password: STRONG,
        }),
      }),
    );
    expect(field(container, 'current-password').value).toBe('');
    expect(field(container, 'new-password').value).toBe('');
  });

  test('shows the backend error for a wrong current password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'invalid password' }), {
          status: 401,
        }),
      ),
    );
    const { container, getByRole, findByText } = render(() => <PasswordForm />);

    fill(container, STRONG, STRONG);
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(await findByText('Access denied')).toBeInTheDocument();
  });
});
