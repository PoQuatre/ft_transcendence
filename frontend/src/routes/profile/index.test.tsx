import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn<(to: string, options?: object) => void>();
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));
vi.mock('~/router', () => ({
  paths: {
    login: () => '/login',
    profile: (username?: string) =>
      username ? `/profile/${encodeURIComponent(username)}` : '/profile',
  },
}));

import { setCurrentUser } from '~/lib/auth';

import Profile from './index';

const me = {
  id: '1',
  username: 'nexus_viper',
  email: 'nexus@example.com',
  verified: true,
};

function mockFetch(status: number, body: unknown = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  cleanup();
  navigate.mockReset();
  setCurrentUser(undefined);
  vi.unstubAllGlobals();
});

describe('<Profile />', () => {
  test('redirects a logged-out visitor to the login form', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    setCurrentUser(null);
    const view = render(() => <Profile />);

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true }),
    );
    expect(view.queryByText(/PILOT_FILE/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('waits for the session before rendering or redirecting', () => {
    setCurrentUser(undefined);
    const view = render(() => <Profile />);

    expect(view.getByText('VERIFYING UPLINK…')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('shows the pilot identity and friends', async () => {
    mockFetch(200, {
      relations: [{ friend_id: 'a', username: 'ghost_byte' }],
      total_pages: 1,
      current_page: 1,
    });
    setCurrentUser(me);
    const view = render(() => <Profile />);

    expect(
      await view.findByText('[PILOT_FILE // nexus_viper]'),
    ).toBeInTheDocument();
    expect(view.getByText('nexus@example.com')).toBeInTheDocument();
    expect(view.getByText('✓ EMAIL VERIFIED')).toBeInTheDocument();
    expect(view.getByText('ONLINE')).toBeInTheDocument();
    expect(
      view.queryByRole('link', { name: 'EDIT PROFILE' }),
    ).not.toBeInTheDocument();
    expect(
      await view.findByRole('link', { name: 'ghost_byte' }),
    ).toHaveAttribute('href', '/profile/ghost_byte');
    expect(view.getByText('PILOT LEVEL')).toBeInTheDocument();
    expect(view.getByText('LEVEL PROGRESS')).toBeInTheDocument();
    // Règles du leaderboard : 3 981 kills × 5 + 15 230 formes = 35 135 XP,
    // soit le niveau 19 (32 400 XP), à 965 XP du niveau 20 (36 100 XP).
    expect(view.getByText('35,135')).toBeInTheDocument();
    expect(view.getByText('◇ LVL 19')).toBeInTheDocument();
    expect(view.getByText('965 XP TO LVL 20')).toBeInTheDocument();
    // Matchs, rang, taux de victoire, K/D et bloc ranked : pas encore suivis.
    expect(view.getAllByText('COMING SOON')).toHaveLength(5);
    expect(view.queryByText('CURRENT ELO')).not.toBeInTheDocument();
    expect(view.getByRole('progressbar')).toBeInTheDocument();
  });

  test('asks an unverified pilot to verify their email', async () => {
    mockFetch(403, { message: 'you need to verify your mail' });
    setCurrentUser({ ...me, verified: false });
    const view = render(() => <Profile />);

    expect(await view.findByText('Email not verified')).toBeInTheDocument();
    expect(
      view.getByText('Verify your email in the settings to use friends.'),
    ).toBeInTheDocument();
  });
});
