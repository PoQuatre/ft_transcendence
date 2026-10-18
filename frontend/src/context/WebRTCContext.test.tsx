import { render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockPeerConnection.instances = [];
});

describe('<WebRTCProvider />', () => {
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
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockPeerConnection.instances).toHaveLength(4);

    unmount();
  });
});
