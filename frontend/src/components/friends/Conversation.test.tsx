import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { Conversation } from './Conversation';

const me = { id: '1', username: 'NEXUS_VIPER', email: 'nexus@example.com' };
const ghost = { username: 'ghost', friend_id: 'f1' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

const said = (message: string, sender: string, at: string) => ({
  message,
  sender_id: sender,
  sent_at: `2026-11-21T18:0${at}:00Z`,
});

function send(view: ReturnType<typeof render>, message: string) {
  const input = view.container.querySelector<HTMLInputElement>('#chat-message');
  if (!input) throw new Error('Missing #chat-message');
  fireEvent.input(input, { target: { value: message } });
  fireEvent.submit(view.getByRole('button', { name: 'Send' }));
  return input;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setCurrentUser(undefined);
});

describe('<Conversation />', () => {
  test('puts my messages on the right', async () => {
    setCurrentUser(me);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json(
            { messages: [said('yo', 'f1', '1'), said('salut', '1', '2')] },
            200,
          ),
        ),
    );
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));

    expect((await view.findByText('salut')).closest('li')).toHaveClass(
      'items-end',
    );
    expect(view.getByText('yo').closest('li')).toHaveClass('items-start');
  });

  test('sends a message and clears the field', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [] }, 200))
      .mockResolvedValueOnce(json({ message: 'ok' }, 200))
      .mockResolvedValueOnce(json({ messages: [said('gg', '1', '3')] }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));
    await view.findByText('Pas encore de messages, dis bonjour.');

    const input = send(view, ' gg ');

    expect(await view.findByText('gg')).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/friends/chat/send-message',
      expect.objectContaining({
        body: JSON.stringify({ friend_id: 'f1', message: 'gg' }),
      }),
    );
  });

  test('refuses a message the backend would reject', async () => {
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ messages: [] }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));
    await view.findByText('Pas encore de messages, dis bonjour.');

    send(view, 'é'.repeat(71));

    expect(await view.findByText('Message too long')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('reloads the conversation every few seconds', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [] }, 200))
      .mockResolvedValueOnce(
        json({ messages: [said('t la ?', 'f1', '4')] }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));
    await view.findByText('Pas encore de messages, dis bonjour.');

    vi.advanceTimersByTime(3000);

    expect(await view.findByText('t la ?')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('stops reloading after an error', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setCurrentUser(me);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ message: 'user not in your friends list' }, 401),
      )
      .mockResolvedValue(json(me, 200));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));

    expect(await view.findByText('Not a friend')).toBeInTheDocument();
    const calls = fetchMock.mock.calls.length;
    vi.advanceTimersByTime(9000);

    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });
});
