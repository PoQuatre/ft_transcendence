import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn<(to: string) => void>();
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Signup from './signup';

const STRONG = 'Abcdefgh1!';

function field(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing #${id}`);
  return input;
}

function fill(container: HTMLElement, confirm: string) {
  fireEvent.input(field(container, 'username'), {
    target: { value: 'NEXUS_VIPER' },
  });
  fireEvent.input(field(container, 'email'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.input(field(container, 'password'), { target: { value: STRONG } });
  fireEvent.input(field(container, 'confirm'), { target: { value: confirm } });
}

// Laisse Solid appliquer les écritures de signaux avant d'observer le DOM.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  cleanup();
  navigate.mockReset();
  vi.unstubAllGlobals();
});

describe('<Signup />', () => {
  test('toggles password visibility with the eye button', async () => {
    const { container, getAllByRole } = render(() => <Signup />);
    const eye = getAllByRole('button', {
      name: 'Afficher le mot de passe',
    })[0]!;
    expect(field(container, 'password').type).toBe('password');
    fireEvent.click(eye);
    await waitFor(() => expect(field(container, 'password').type).toBe('text'));
    expect(eye).toHaveAttribute('aria-label', 'Masquer le mot de passe');
  });

  test('blocks submit when confirmation differs', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => <Signup />);

    fill(container, 'nope');
    fireEvent.submit(getByRole('button', { name: /enlist/i }));

    expect(
      await findByText('◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field(container, 'confirm')).toHaveAttribute('aria-invalid', 'true');
  });

  test('sends signup without the confirmation, then logs in', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole } = render(() => <Signup />);

    fill(container, STRONG);
    fireEvent.submit(getByRole('button', { name: /enlist/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/signup',
      expect.objectContaining({
        body: JSON.stringify({
          username: 'NEXUS_VIPER',
          email: 'ada@example.com',
          password: STRONG,
        }),
      }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/login');
  });

  test('shows the backend conflict message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'username already used' }), {
          status: 409,
        }),
      ),
    );
    const { container, getByRole, findByText } = render(() => <Signup />);

    fill(container, STRONG);
    fireEvent.submit(getByRole('button', { name: /enlist/i }));

    expect(await findByText('Call-sign taken')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('shows the password rules once the field is touched', async () => {
    const { container, queryByText, findByText } = render(() => <Signup />);

    await settle();
    expect(queryByText(/UNE MAJUSCULE/)).not.toBeInTheDocument();
    fireEvent.focus(field(container, 'password'));

    expect(await findByText(/UNE MAJUSCULE/)).toBeInTheDocument();
  });

  test('shows the match status once the confirmation is touched', async () => {
    const { container, queryByText, findByText } = render(() => <Signup />);

    // Rempli sans focus, comme le ferait le gestionnaire de mots de passe.
    fireEvent.input(field(container, 'confirm'), {
      target: { value: 'nope' },
    });
    await settle();
    expect(queryByText(/CORRESPONDENT/)).not.toBeInTheDocument();
    fireEvent.focus(field(container, 'confirm'));

    expect(
      await findByText('◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'),
    ).toBeInTheDocument();
  });
});
