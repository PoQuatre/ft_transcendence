import {
  createContext,
  createSignal,
  onSettled,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js';

type ConnectionState = RTCPeerConnectionState | 'idle';

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface WebRTCContextValue {
  state: Accessor<ConnectionState>;
  getPeer: () => RTCPeerConnection;
  disconnect: () => void;
}

const WebRTCContext = createContext<WebRTCContextValue>();

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise((resolve) => {
    const onChange = () => {
      if (peer.iceGatheringState === 'complete') {
        peer.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };

    peer.addEventListener('icegatheringstatechange', onChange);
    onChange();
  });
}

async function connect(peer: RTCPeerConnection) {
  peer.createDataChannel('cli');

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  await waitForIceGathering(peer);

  const response = await fetch('/api/webrtc/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(peer.localDescription),
  });

  if (!response.ok) throw new Error(response.statusText);

  const answer: RTCSessionDescriptionInit = await response.json();
  await peer.setRemoteDescription(answer);
}

export function useWebRTC() {
  return useContext(WebRTCContext);
}

export function WebRTCProvider(props: ParentProps) {
  const [state, setState] = createSignal<ConnectionState>('idle');
  let peer: RTCPeerConnection | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempt = 0;
  let stopped = false;

  function cancelReconnect() {
    if (reconnectTimer === undefined) return;

    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  function startConnection() {
    const currentPeer = getPeer();
    void connect(currentPeer).catch(() => {
      if (peer === currentPeer) scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer !== undefined) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
      MAX_RECONNECT_DELAY_MS,
    );
    reconnectAttempt += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (stopped) return;

      const previousPeer = peer;
      peer = null;
      previousPeer?.close();
      startConnection();
    }, delay);
  }

  function getPeer() {
    if (peer && peer.signalingState !== 'closed') {
      return peer;
    }

    peer = new RTCPeerConnection();
    const currentPeer = peer;

    setState(currentPeer.connectionState);
    currentPeer.onconnectionstatechange = () => {
      if (peer !== currentPeer) return;

      setState(currentPeer.connectionState);

      if (currentPeer.connectionState === 'connected') {
        reconnectAttempt = 0;
        cancelReconnect();
      } else if (
        currentPeer.connectionState === 'failed' ||
        currentPeer.connectionState === 'disconnected'
      ) {
        scheduleReconnect();
      }
    };
    return currentPeer;
  }

  function disconnect() {
    stopped = true;
    cancelReconnect();
    peer?.close();
    peer = null;
    setState('closed');
  }

  onSettled(() => {
    stopped = false;
    startConnection();
    return disconnect;
  });

  return (
    <WebRTCContext value={{ state, getPeer, disconnect }}>
      {props.children}
    </WebRTCContext>
  );
}
