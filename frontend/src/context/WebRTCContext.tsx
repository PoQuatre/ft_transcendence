import {
  createContext,
  createSignal,
  onSettled,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js';

type ConnectionState = RTCPeerConnectionState | 'idle';

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

  console.log('WebRTC answer applied');
}

export function useWebRTC() {
  return useContext(WebRTCContext);
}

export function WebRTCProvider(props: ParentProps) {
  const [state, setState] = createSignal<ConnectionState>('idle');
  let peer: RTCPeerConnection | null = null;

  function getPeer() {
    if (peer && peer.signalingState !== 'closed') {
      return peer;
    }

    peer = new RTCPeerConnection();
    const currentPeer = peer;

    setState(currentPeer.connectionState);
    currentPeer.onconnectionstatechange = () => {
      console.log(`WebRTC: connection state: ${currentPeer.connectionState}`);
      setState(currentPeer.connectionState);
    };
    return currentPeer;
  }

  function disconnect() {
    peer?.close();
    peer = null;
    setState('closed');
  }

  onSettled(() => {
    const currentPeer = getPeer();
    connect(currentPeer).catch((err) =>
      console.error('WebRTC negotiation failed:', err),
    );
    return disconnect;
  });

  return (
    <WebRTCContext value={{ state, getPeer, disconnect }}>
      {props.children}
    </WebRTCContext>
  );
}
