import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { Conversation } from './Conversation';

const me = { id: '1', username: 'NEXUS_VIPER', email: 'nexus@example.com' };
const ghost = { username: 'ghost', friend_id: 'f1' };

const [channels, setChannels] = createRoot(() =>
  createSignal<Partial<{ control: RTCDataChannel }>>({}),
);
vi.mock('~/context/WebRTCContext', () => ({ useWebRTC: () => ({ channels }) }));

class Channel extends EventTarget {
  readyState: RTCDataChannelState = 'connecting';

  open() {
    this.readyState = 'open';
    this.dispatchEvent(new Event('open'));
  }

  message(data: unknown) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(data) }),
    );
  }
}

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
  setChannels({});
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

  test('reloads only for messages from the current friend, not on a timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setCurrentUser(me);
    const channel = new Channel();
    channel.readyState = 'open';
    setChannels({ control: channel as unknown as RTCDataChannel });
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

    vi.advanceTimersByTime(9000);
    channel.message({
      type: 'PrivateMessage',
      senderId: 'other',
      message: 'hi',
    });
    channel.message({ type: 'LobbyState' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    channel.message({
      type: 'PrivateMessage',
      senderId: 'f1',
      message: 't la ?',
    });

    expect(await view.findByText('t la ?')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('refreshes on reconnect and ignores the old channel', async () => {
    setCurrentUser(me);
    const first = new Channel();
    first.readyState = 'open';
    setChannels({ control: first as unknown as RTCDataChannel });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [] }, 200))
      .mockResolvedValueOnce(
        json({ messages: [said('missed', 'f1', '4')] }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));
    await view.findByText('Pas encore de messages, dis bonjour.');

    setChannels({});
    const second = new Channel();
    const listen = vi.spyOn(second, 'addEventListener');
    setChannels({ control: second as unknown as RTCDataChannel });
    await waitFor(() => expect(listen).toHaveBeenCalled());
    first.message({ type: 'PrivateMessage', senderId: 'f1', message: 'old' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    second.open();

    expect(await view.findByText('missed')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    view.unmount();
    second.message({ type: 'PrivateMessage', senderId: 'f1', message: 'late' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('keeps the newest conversation when refresh responses arrive out of order', async () => {
    setCurrentUser(me);
    const channel = new Channel();
    channel.readyState = 'open';
    setChannels({ control: channel as unknown as RTCDataChannel });
    let resolveOld!: (response: Response) => void;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ messages: [] }, 200))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(
        json({ messages: [said('newest', 'f1', '4')] }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    const view = render(() => (
      <Conversation friend={ghost} onBack={vi.fn<() => void>()} />
    ));
    await view.findByText('Pas encore de messages, dis bonjour.');
    channel.message({
      type: 'PrivateMessage',
      senderId: 'f1',
      message: 'first',
    });
    channel.message({
      type: 'PrivateMessage',
      senderId: 'f1',
      message: 'second',
    });
    expect(await view.findByText('newest')).toBeInTheDocument();
    resolveOld(json({ messages: [said('stale', 'f1', '3')] }, 200));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.queryByText('stale')).not.toBeInTheDocument();
    expect(view.getByText('newest')).toBeInTheDocument();
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
