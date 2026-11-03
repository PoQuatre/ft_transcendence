import { render, waitFor } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';

import GamePage from './game';

const [channels, setChannels] = createRoot(() =>
  createSignal<Partial<{ control: RTCDataChannel }>>({}),
);
vi.mock('~/context/WebRTCContext', () => ({ useWebRTC: () => ({ channels }) }));
vi.mock('../components/Game', () => ({
  default: () => <div>Game prototype</div>,
}));

class Channel extends EventTarget {
  readyState: RTCDataChannelState = 'connecting';
  send = vi.fn<(data: string) => void>();

  open() {
    this.readyState = 'open';
    this.dispatchEvent(new Event('open'));
  }

  message(value: unknown) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(value) }),
    );
  }
}

describe('quick play lobby', () => {
  test('joins on open, displays roster updates, and leaves on unmount', async () => {
    const channel = new Channel();
    setChannels({ control: channel as unknown as RTCDataChannel });
    const view = render(() => <GamePage />);
    channel.open();
    expect(channel.send).toHaveBeenCalledWith('{"type":"QuickPlayRequest"}');
    channel.message({
      type: 'LobbyState',
      lobbyId: 'room',
      players: [{ id: '1', username: 'Alice' }],
    });
    await waitFor(() => expect(view.getByText('Alice')).toBeInTheDocument());
    channel.message({
      type: 'LobbyState',
      lobbyId: 'room',
      players: [{ id: '2', username: 'Bob' }],
    });
    await waitFor(() => expect(view.getByText('Bob')).toBeInTheDocument());
    expect(view.queryByText('Alice')).not.toBeInTheDocument();
    view.unmount();
    expect(channel.send).toHaveBeenLastCalledWith(
      '{"type":"LeaveGameRequest"}',
    );
  });

  test('rejoins a replacement channel and allows retry after an error', async () => {
    const first = new Channel();
    first.readyState = 'open';
    setChannels({ control: first as unknown as RTCDataChannel });
    const view = render(() => <GamePage />);
    const second = new Channel();
    second.readyState = 'open';
    setChannels({ control: second as unknown as RTCDataChannel });
    await waitFor(() =>
      expect(second.send).toHaveBeenCalledWith('{"type":"QuickPlayRequest"}'),
    );
    second.message({ type: 'Error', error: 'Try again' });
    await waitFor(() =>
      expect(view.getByRole('alert')).toHaveTextContent('Try again'),
    );
    view.getByRole('button', { name: 'Retry' }).click();
    expect(second.send).toHaveBeenCalledTimes(2);
    view.unmount();
  });
});
