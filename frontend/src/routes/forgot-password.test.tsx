import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import ForgotPassword from './forgot-password';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function send(view: ReturnType<typeof render>, email: string) {
  const input = view.container.querySelector<HTMLInputElement>('#email');
  if (!input) throw new Error('Missing #email');
  fireEvent.input(input, { target: { value: email } });
  fireEvent.submit(view.getByRole('button', { name: /send reset link/i }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<ForgotPassword />', () => {
  test('sends the email to /api/auth/forgot-password', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ message: 'email successfully sent.' }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <ForgotPassword />);

    send(view, ' ada@example.com ');

    expect(await view.findByText('Link sent')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ada@example.com' }),
      }),
    );
  });

  test.each([
    ['an unknown account', 404, 'user not found'],
    ['an unverified email', 400, 'email not verified'],
  ])('gives the same answer for %s', async (_case, status, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(json({ message }, status)),
    );
    const view = render(() => <ForgotPassword />);

    send(view, 'ada@example.com');

    expect(await view.findByText('Link sent')).toBeInTheDocument();
  });

  test('reports a missing backend route as offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ message: 'Not Found' }, 404)),
    );
    const view = render(() => <ForgotPassword />);

    send(view, 'ada@example.com');

    expect(await view.findByText('Module offline')).toBeInTheDocument();
    expect(view.queryByText('Link sent')).not.toBeInTheDocument();
  });

  test('reports disabled mails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ message: 'mails are disabled' }, 500)),
    );
    const view = render(() => <ForgotPassword />);

    send(view, 'ada@example.com');

    expect(await view.findByText('Mail offline')).toBeInTheDocument();
  });

  test('checks the email before calling the backend', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => <ForgotPassword />);

    send(view, 'nexus_viper');

    expect(await view.findByText('Invalid email')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
