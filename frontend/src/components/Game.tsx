import { createSignal, createUniqueId, onCleanup, Show } from 'solid-js';

type GameInstance = {
  ['_game_shutdown'](): void;
};

type GameFactory = (options: {
  canvas: HTMLCanvasElement;
  locateFile(path: string): string;
}) => Promise<GameInstance>;

export default function Game() {
  const [buildId, setBuildId] = createSignal(
    import.meta.env.DEV ? String(Date.now()) : GAME_BUILD_ID,
  );

  if (import.meta.hot) {
    const hot = import.meta.hot;
    const onGameRebuilt = ({ buildId: rebuiltBuildId }: { buildId: string }) =>
      setBuildId(rebuiltBuildId);
    hot.on('game:rebuilt', onGameRebuilt);
    onCleanup(() => hot.off('game:rebuilt', onGameRebuilt));
  }

  return (
    <Show when={buildId()} keyed>
      {(currentBuildId) => <GameView buildId={currentBuildId} />}
    </Show>
  );
}

function GameView(props: { buildId: string }) {
  const canvasId = `game-canvas-${createUniqueId()}`;
  let game: GameInstance | undefined;
  let disposed = false;

  function attachCanvas(canvas: HTMLCanvasElement) {
    void (async () => {
      const gameUrl = new URL('/assets/game/game.mjs', window.location.href);
      const wasmUrl = new URL('/assets/game/game.wasm', window.location.href);
      gameUrl.searchParams.set('v', props.buildId);
      wasmUrl.searchParams.set('v', props.buildId);
      const { default: createGame } = (await import(
        /* @vite-ignore */ gameUrl.href
      )) as { default: GameFactory };
      if (disposed) return;

      const instance = await createGame({
        canvas,
        locateFile: () => wasmUrl.href,
      });
      if (disposed) {
        instance['_game_shutdown']();
        return;
      }
      game = instance;
    })();
  }

  onCleanup(() => {
    disposed = true;
    game?.['_game_shutdown']();
  });

  return (
    <canvas
      id={canvasId}
      ref={(canvas) => attachCanvas(canvas)}
      class="h-full! w-full!"
    />
  );
}
