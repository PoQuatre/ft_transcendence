import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import AuthForm from './AuthForm';

function inputByName(container: HTMLElement, name: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  );
  if (!input) throw new Error(`Missing ${name} input`);
  return input;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<AuthForm />', () => {
  test('sends login credentials as JSON', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { container, getByRole } = render(() => <AuthForm mode="login" />);
    fireEvent.input(inputByName(container, 'email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.input(inputByName(container, 'password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.submit(getByRole('button', { name: 'Log in' }).closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ada@example.com',
          password: 'Password123!',
        }),
      });
    });
  });

  test('sends signup credentials as JSON', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const { container, getByRole } = render(() => <AuthForm mode="signup" />);
    fireEvent.input(inputByName(container, 'username'), {
      target: { value: 'ada_lovelace' },
    });
    fireEvent.input(inputByName(container, 'email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.input(inputByName(container, 'password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.submit(getByRole('button', { name: 'Sign up' }).closest('form')!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ada_lovelace',
          email: 'ada@example.com',
          password: 'Password123!',
        }),
      });
    });
  });
});
