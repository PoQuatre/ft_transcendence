import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { FriendsPanel } from './FriendsPanel';

vi.mock('~/router', () => ({
  paths: { settings: () => '/settings' },
}));

const me = { id: '1', username: 'NEXUS_VIPER', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function backend() {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = typeof input === 'string' ? input : '';
    const page = { total_pages: 1, current_page: 1 };
    return Promise.resolve(
      url.startsWith('/api/friends/requests/list')
        ? json({ ...page, requests: [] }, 200)
        : json(
            { ...page, relations: [{ username: 'ghost', friend_id: 'f1' }] },
            200,
          ),
    );
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('<FriendsPanel />', () => {
  test('shows the friend tools', async () => {
    setCurrentUser({ ...me, verified: true });
    vi.stubGlobal('fetch', backend());
    render(() => <FriendsPanel onClose={vi.fn<() => void>()} />);

    expect(
      screen.getByRole('complementary', { name: 'FRIENDS' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ADD A FRIEND')).toBeInTheDocument();
    expect(await screen.findByText('ghost')).toBeInTheDocument();
  });

  test('asks for a verified email first', () => {
    setCurrentUser({ ...me, verified: false });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    render(() => <FriendsPanel onClose={vi.fn<() => void>()} />);

    expect(screen.getByText('Email not verified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('closes with Escape and with the close button', () => {
    setCurrentUser({ ...me, verified: false });
    const onClose = vi.fn<() => void>();
    render(() => <FriendsPanel onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close friends panel' }),
    );

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
