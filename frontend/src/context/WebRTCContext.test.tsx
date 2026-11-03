import { render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setCurrentUser } from '~/lib/auth';

import { useWebRTC, WebRTCProvider } from './WebRTCContext';

class MockPeerConnection {
  static instances: MockPeerConnection[] = [];

  connectionState: RTCPeerConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'complete';
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  signalingState: RTCSignalingState = 'stable';
  dataChannels: Array<{ label: string; options?: RTCDataChannelInit }> = [];

  constructor() {
    MockPeerConnection.instances.push(this);
  }

  close() {
    this.signalingState = 'closed';
  }

  createDataChannel(label: string, options?: RTCDataChannelInit) {
    this.dataChannels.push({ label, options });
    return {} as RTCDataChannel;
  }

  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'offer' });
  }

  setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription() {
    return Promise.resolve();
  }

  setConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  setCurrentUser(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockPeerConnection.instances = [];
});

describe('<WebRTCProvider />', () => {
  test('reconnects when login and logout change the identity', async () => {
    vi.stubGlobal('RTCPeerConnection', MockPeerConnection);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'answer', sdp: 'answer' }),
      }),
    );
    setCurrentUser(null);
    const { unmount } = render(() => <WebRTCProvider />);
    await settle();
    expect(MockPeerConnection.instances).toHaveLength(1);

    setCurrentUser({ id: '1', username: 'user', email: 'user@example.com' });
    await settle();
    expect(MockPeerConnection.instances).toHaveLength(2);
    expect(MockPeerConnection.instances[0]?.signalingState).toBe('closed');

    setCurrentUser(null);
    await settle();
    expect(MockPeerConnection.instances).toHaveLength(3);
    expect(MockPeerConnection.instances[1]?.signalingState).toBe('closed');
    unmount();
  });
  test('creates the configured data channels', async () => {
    vi.stubGlobal('RTCPeerConnection', MockPeerConnection);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'answer', sdp: 'answer' }),
      }),
    );
    let channels: NonNullable<ReturnType<typeof useWebRTC>>['channels'];
    const Probe = () => {
      channels = useWebRTC().channels;
      return null;
    };

    render(() => (
      <WebRTCProvider>
        <Probe />
      </WebRTCProvider>
    ));
    await settle();

    expect(MockPeerConnection.instances[0]?.dataChannels).toEqual([
      { label: 'control', options: undefined },
      { label: 'event', options: undefined },
      { label: 'state', options: { ordered: false, maxRetransmits: 0 } },
      { label: 'sync', options: { ordered: false } },
    ]);
    expect(Object.keys(channels!())).toEqual([
      'control',
      'event',
      'state',
      'sync',
    ]);
  });

  test('retries with exponential backoff and resets after connecting', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('RTCPeerConnection', MockPeerConnection);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'answer', sdp: 'answer' }),
      }),
    );

    const { unmount } = render(() => <WebRTCProvider />);
    await settle();

    MockPeerConnection.instances[0]?.setConnectionState('failed');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockPeerConnection.instances).toHaveLength(2);

    MockPeerConnection.instances[1]?.setConnectionState('failed');
    await vi.advanceTimersByTimeAsync(1_999);
    expect(MockPeerConnection.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockPeerConnection.instances).toHaveLength(3);

    MockPeerConnection.instances[2]?.setConnectionState('connected');
    MockPeerConnection.instances[2]?.setConnectionState('disconnected');
    expect(MockPeerConnection.instances[2]?.signalingState).toBe('closed');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockPeerConnection.instances).toHaveLength(4);

    unmount();
  });
});
