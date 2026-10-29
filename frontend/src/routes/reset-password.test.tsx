import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn<(to: string, options?: object) => void>();
let search: { token?: string } = {};
vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [search, vi.fn<() => void>()],
}));

import ResetPassword from './reset-password';

const TOKEN = 'a1b2c3d4';
const STRONG = 'New-password-1!';

function field(container: HTMLElement, id: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) throw new Error(`Missing #${id}`);
  return input;
}

function send(view: ReturnType<typeof render>, next: string, confirm: string) {
  fireEvent.input(field(view.container, 'password'), {
    target: { value: next },
  });
  fireEvent.input(field(view.container, 'confirm'), {
    target: { value: confirm },
  });
  fireEvent.submit(view.getByRole('button', { name: /set new password/i }));
}

afterEach(() => {
  cleanup();
  navigate.mockReset();
  vi.unstubAllGlobals();
  search = {};
});

describe('<ResetPassword />', () => {
  test('sends the new password with the token, then goes to the login', async () => {
    search = { token: TOKEN };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'password successfully updated.' }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <ResetPassword />);

    send(view, STRONG, STRONG);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login?reset=done', {
        replace: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: STRONG, token: TOKEN }),
      }),
    );
  });

  test('rejects a password that breaks the rules', async () => {
    search = { token: TOKEN };
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <ResetPassword />);

    send(view, 'short', 'short');

    expect(await view.findByText('Weak password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('blocks submit when the confirmation differs', async () => {
    search = { token: TOKEN };
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <ResetPassword />);

    send(view, STRONG, 'nope');

    expect(
      await view.findByText('◇ LES MOTS DE PASSE NE CORRESPONDENT PAS'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows an expired link when the backend answers 500', async () => {
    search = { token: TOKEN };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Internal Server Error' }), {
          status: 500,
        }),
      ),
    );
    const view = render(() => <ResetPassword />);

    send(view, STRONG, STRONG);

    expect(await view.findByText('Link expired')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('asks for a new link when the token is missing', async () => {
    const view = render(() => <ResetPassword />);

    expect(await view.findByText('Invalid link')).toBeInTheDocument();
    expect(view.container.querySelector('#password')).toBeNull();
    expect(view.getByRole('link', { name: 'Nouveau lien' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
