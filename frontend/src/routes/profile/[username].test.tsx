import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('~/router', () => ({
  paths: { profile: () => '/profile' },
}));

import { setCurrentUser } from '~/lib/auth';

import PilotProfile from './[username]';

const me = {
  id: '1',
  username: 'nexus_viper',
  email: 'nexus@example.com',
  verified: true,
};

const renderFor = (username: string) =>
  render(() => (
    <PilotProfile
      {...({ params: { username } } as unknown as Parameters<
        typeof PilotProfile
      >[0])}
    />
  ));

afterEach(() => {
  cleanup();
  setCurrentUser(undefined);
});

describe('<PilotProfile />', () => {
  test("shows another pilot's public file", async () => {
    setCurrentUser(me);
    const view = renderFor('ghost_byte');

    expect(
      await view.findByText('[PILOT_FILE // ghost_byte]'),
    ).toBeInTheDocument();
    expect(view.getByRole('heading', { level: 1 })).toHaveTextContent(
      'ghost_byte',
    );
    expect(view.getByText('PUBLIC FILE')).toBeInTheDocument();
    expect(view.queryByText('nexus@example.com')).not.toBeInTheDocument();
    expect(view.getByRole('link', { name: '← MY PROFILE' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(view.getByText('PILOT LEVEL')).toBeInTheDocument();
  });

  test('hides the way back for a logged-out visitor', async () => {
    setCurrentUser(null);
    const view = renderFor('ghost_byte');

    expect(
      await view.findByText('[PILOT_FILE // ghost_byte]'),
    ).toBeInTheDocument();
    expect(
      view.queryByRole('link', { name: '← MY PROFILE' }),
    ).not.toBeInTheDocument();
  });
});
