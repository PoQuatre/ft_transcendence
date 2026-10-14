import { Title } from '@solidjs/meta';

import Game from '../components/Game';

export default function GamePage() {
  return (
    <main class="h-[calc(100vh-64px)] p-4">
      <Title>Game - Solid App</Title>
      <Game />
    </main>
  );
}
