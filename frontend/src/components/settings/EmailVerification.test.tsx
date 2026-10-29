import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { EmailVerification } from './EmailVerification';

const user = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };
const unverified = { ...user, verified: false };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

function codeField(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('#verification-code');
  if (!input) throw new Error('Missing #verification-code');
  return input;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('<EmailVerification />', () => {
  test('stays hidden while the backend does not report verified', () => {
    const { queryByText } = render(() => <EmailVerification user={user} />);

    expect(queryByText('EMAIL VERIFICATION')).not.toBeInTheDocument();
  });

  test('shows a verified account without any action', () => {
    const { getByText, queryByRole } = render(() => (
      <EmailVerification user={{ ...user, verified: true }} />
    ));

    expect(getByText('VERIFIED')).toBeInTheDocument();
    expect(
      queryByRole('button', { name: /send verification code/i }),
    ).not.toBeInTheDocument();
  });

  test('sends a code, then confirms it', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'email verification sent' }, 200))
      .mockResolvedValueOnce(json(unverified, 200))
      .mockResolvedValueOnce(
        json({ message: 'user email successfully validated' }, 200),
      )
      .mockResolvedValueOnce(json({ ...user, verified: true }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => (
      <EmailVerification user={unverified} />
    ));

    fireEvent.click(getByRole('button', { name: /send verification code/i }));
    expect(await findByText('Code sent')).toBeInTheDocument();

    fireEvent.input(codeField(container), { target: { value: '123456' } });
    fireEvent.submit(getByRole('button', { name: /verify email/i }));

    expect(await findByText('Email verified')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/verify-email/request');
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/auth/verify-email/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
      }),
    );
  });

  test('reports a server that verifies without sending mails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json({ message: 'email verification sent' }, 200),
        )
        .mockResolvedValueOnce(json({ ...user, verified: true }, 200)),
    );
    const { getByRole, findByText, queryByText } = render(() => (
      <EmailVerification user={unverified} />
    ));

    fireEvent.click(getByRole('button', { name: /send verification code/i }));

    expect(await findByText('Email verified')).toBeInTheDocument();
    expect(queryByText('Code sent')).not.toBeInTheDocument();
  });

  test('rejects a malformed code without calling the backend', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'email verification sent' }, 200))
      .mockResolvedValueOnce(json(unverified, 200));
    vi.stubGlobal('fetch', fetchMock);
    const { container, getByRole, findByText } = render(() => (
      <EmailVerification user={unverified} />
    ));

    fireEvent.click(getByRole('button', { name: /send verification code/i }));
    await findByText('Code sent');
    fireEvent.input(codeField(container), { target: { value: '12ab' } });
    fireEvent.submit(getByRole('button', { name: /verify email/i }));

    expect(
      await findByText('Le code contient exactement 6 chiffres.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('shows the backend message for a wrong code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json({ message: 'email verification sent' }, 200),
        )
        .mockResolvedValueOnce(json(unverified, 200))
        .mockResolvedValueOnce(json({ message: 'invalid code' }, 400))
        .mockResolvedValueOnce(json(unverified, 200)),
    );
    const { container, getByRole, findByText } = render(() => (
      <EmailVerification user={unverified} />
    ));

    fireEvent.click(getByRole('button', { name: /send verification code/i }));
    await findByText('Code sent');
    fireEvent.input(codeField(container), { target: { value: '654321' } });
    fireEvent.submit(getByRole('button', { name: /verify email/i }));

    expect(
      await findByText('Code incorrect, vérifie le mail reçu.'),
    ).toBeInTheDocument();
  });
});
