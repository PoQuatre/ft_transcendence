import { render, waitFor } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';
import { expect, test, vi } from 'vitest';

import { Footer } from './Footer';

const [pathname, setPathname] = createRoot(() => createSignal('/'));
vi.mock('@solidjs/router', () => ({
  useLocation: () => ({
    get pathname() {
      return pathname();
    },
  }),
}));

test('hides the footer on the game page and restores it on other pages', async () => {
  const view = render(() => <Footer />);
  expect(view.getByRole('contentinfo')).toBeInTheDocument();
  setPathname('/game/');
  await waitFor(() =>
    expect(view.queryByRole('contentinfo')).not.toBeInTheDocument(),
  );
  setPathname('/terms');
  await waitFor(() =>
    expect(view.getByRole('contentinfo')).toBeInTheDocument(),
  );
});
