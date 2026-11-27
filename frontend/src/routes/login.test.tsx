import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
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
  test('offers a stay signed in switch that is off by default', () => {
    const { getByRole } = render(() => <Login />);
    expect(getByRole('switch', { name: /stay signed in/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('includes the selected stay signed in option in the login request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid email or password' }), {
        status: 400,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole } = render(() => <Login />);
    const email = container.querySelector<HTMLInputElement>('#email');
    if (!email) throw new Error('Missing #email');
    fireEvent.input(email, { target: { value: 'ada@example.com' } });
    fireEvent.click(getByRole('switch', { name: /stay signed in/i }));
    await waitFor(() =>
      expect(getByRole('switch', { name: /stay signed in/i })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    fireEvent.submit(getByRole('button', { name: /deploy in arena/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') throw new Error('Missing JSON body');
    expect(JSON.parse(request.body)).toMatchObject({
      staySignedIn: true,
    });
  });

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
