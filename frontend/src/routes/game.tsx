import { Title } from '@solidjs/meta';
import { createEffect, createSignal, For, Show } from 'solid-js';

import { useWebRTC } from '~/context/WebRTCContext';

import Game from '../components/Game';

type Lobby = { lobbyId: string; players: { id: string; username: string }[] };

export default function GamePage() {
  const network = useWebRTC();
  const [lobby, setLobby] = createSignal<Lobby>();
  const [error, setError] = createSignal('');
  const [joining, setJoining] = createSignal(false);

  function join(channel: RTCDataChannel) {
    if (channel.readyState !== 'open') return;
    try {
      channel.send(JSON.stringify({ type: 'QuickPlayRequest' }));
      setError('');
      setJoining(true);
    } catch {
      setJoining(false);
      setError('Could not join the lobby. Please try again.');
    }
  }

  createEffect(
    () => network.channels().control,
    (channel) => {
      setLobby(undefined);
      setJoining(false);
      setError('');
      if (!channel) return undefined;

      const onOpen = () => join(channel);
      const onClose = () => {
        setLobby(undefined);
        setJoining(false);
      };
      const onMessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (!message || typeof message !== 'object' || !('type' in message))
            return;
          if (
            message.type === 'LobbyState' &&
            'lobbyId' in message &&
            typeof message.lobbyId === 'string' &&
            'players' in message &&
            Array.isArray(message.players) &&
            message.players.every(
              (player: unknown) =>
                player !== null &&
                typeof player === 'object' &&
                'id' in player &&
                typeof player.id === 'string' &&
                'username' in player &&
                typeof player.username === 'string',
            )
          ) {
            setLobby({ lobbyId: message.lobbyId, players: message.players });
            setJoining(false);
            setError('');
          } else if (message.type === 'GameLeft') {
            setLobby(undefined);
            setJoining(false);
          } else if (
            message.type === 'Error' &&
            'error' in message &&
            typeof message.error === 'string'
          ) {
            setJoining(false);
            setError(message.error);
          }
        } catch {
          setJoining(false);
          setError('Received an invalid lobby message.');
        }
      };
      channel.addEventListener('open', onOpen);
      channel.addEventListener('close', onClose);
      channel.addEventListener('message', onMessage);
      if (channel.readyState === 'open') join(channel);

      return () => {
        channel.removeEventListener('open', onOpen);
        channel.removeEventListener('close', onClose);
        channel.removeEventListener('message', onMessage);
        if (channel.readyState === 'open') {
          try {
            channel.send(JSON.stringify({ type: 'LeaveGameRequest' }));
          } catch {
            // The peer may have closed while the page was being removed.
          }
        }
      };
    },
  );

  return (
    <main class="p-4 space-y-4">
      <Title>Game - Solid App</Title>
      <section
        class="font-mono p-4 border border-border-subtle rounded-md space-y-2"
        aria-label="Lobby"
      >
        <h1 class="text-accent-primary font-bold">QUICK PLAY LOBBY</h1>
        <Show
          when={lobby()}
          fallback={
            <output>
              {error()
                ? 'Lobby unavailable.'
                : joining()
                  ? 'Joining lobby…'
                  : 'Connecting to server…'}
            </output>
          }
        >
          {(room) => (
            <>
              <p>
                Lobby: {room().lobbyId} · {room().players.length}/8 players
              </p>
              <ul>
                <For each={room().players}>
                  {(player) => <li>{player.username}</li>}
                </For>
              </ul>
              <p class="text-text-muted">
                Local game prototype — multiplayer gameplay is not yet
                available.
              </p>
            </>
          )}
        </Show>
        <Show when={error()}>
          <p role="alert">{error()}</p>
          <button
            type="button"
            onClick={() => {
              const channel = network.channels().control;
              if (channel) join(channel);
            }}
          >
            Retry
          </button>
        </Show>
        <a href="/">Leave lobby</a>
      </section>
      <Show when={lobby()}>
        <div class="h-[calc(100vh-16rem)]">
          <Game />
        </div>
      </Show>
    </main>
  );
}
