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

// Laisse Solid appliquer les écritures de signaux avant d'observer le DOM.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'password successfully changed.' }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText, queryByText } = render(() => (
      <PasswordForm />
    ));

    fill(container, STRONG, STRONG);
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(await findByText('Password updated')).toBeInTheDocument();
    // Formulaire vidé : règles et correspondance repartent cachées.
    expect(queryByText(/UNE MAJUSCULE/)).not.toBeInTheDocument();
    expect(queryByText(/CORRESPONDENT/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          oldpassword: CURRENT,
          newpassword: STRONG,
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
          status: 400,
        }),
      ),
    );
    const { container, getByRole, findByText } = render(() => <PasswordForm />);

    fill(container, STRONG, STRONG);
    fireEvent.submit(getByRole('button', { name: /update password/i }));

    expect(await findByText('Access denied')).toBeInTheDocument();
  });

  test('shows the rules once the new password is touched', async () => {
    const { container, queryByText, findByText } = render(() => (
      <PasswordForm />
    ));

    await settle();
    expect(queryByText(/UNE MAJUSCULE/)).not.toBeInTheDocument();
    fireEvent.focus(field(container, 'new-password'));

    expect(await findByText(/UNE MAJUSCULE/)).toBeInTheDocument();
  });
});
