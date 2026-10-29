import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn<(to: string) => void>();
let search: { reset?: string } = {};
vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [search, vi.fn<() => void>()],
}));

import Login from './login';

afterEach(() => {
  cleanup();
  navigate.mockReset();
  vi.unstubAllGlobals();
  search = {};
});

describe('<Login />', () => {
  test('links to the forgot password page', () => {
    const { getByRole } = render(() => <Login />);

    expect(
      getByRole('link', { name: 'Mot de passe oublié ?' }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  test('confirms a password reset, until a login fails', async () => {
    search = { reset: 'done' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ message: 'invalid email or password' }),
            { status: 400 },
          ),
        ),
    );
    const { container, getByRole, findByText, queryByText } = render(() => (
      <Login />
    ));

    expect(await findByText('Password updated')).toBeInTheDocument();

    const email = container.querySelector<HTMLInputElement>('#email');
    if (!email) throw new Error('Missing #email');
    fireEvent.input(email, { target: { value: 'ada@example.com' } });
    fireEvent.submit(getByRole('button', { name: /deploy in arena/i }));

    expect(await findByText('Access denied')).toBeInTheDocument();
    expect(queryByText('Password updated')).not.toBeInTheDocument();
  });
});
