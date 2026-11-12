import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn<(to: string, options?: object) => void>();
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));
vi.mock('~/router', () => ({ paths: { login: () => '/login' } }));

import { setCurrentUser } from '~/lib/auth';

import Settings from './settings';

const me = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

afterEach(() => {
  cleanup();
  navigate.mockReset();
  setCurrentUser(undefined);
  localStorage.clear();
});

describe('<Settings />', () => {
  test('sends a logged-out visitor to the login', async () => {
    setCurrentUser(null);
    render(() => <Settings />);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true }),
    );
  });

  test('waits while the session is being checked', async () => {
    const view = render(() => <Settings />);

    expect(await view.findByText('VERIFYING UPLINK…')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('shows the operator tab to a logged-in pilot', async () => {
    setCurrentUser(me);
    const view = render(() => <Settings />);

    expect(
      await view.findByText('[SYS_CONFIG // nexus_viper]'),
    ).toBeInTheDocument();
    expect(view.getByRole('tab', { name: 'OPERATOR' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(view.queryByText('KEY BINDINGS')).not.toBeInTheDocument();
  });

  test('opens the combat tab', async () => {
    setCurrentUser(me);
    const view = render(() => <Settings />);

    fireEvent.click(await view.findByRole('tab', { name: 'COMBAT' }));

    expect(await view.findByText('KEY BINDINGS')).toBeVisible();
  });
});
