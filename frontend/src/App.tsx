import { Title } from '@solidjs/meta';
import { Loading } from 'solid-js';
import { paths, Router } from './router';
import './App.css';

export default function App() {
  return (
    <Router>
      {(props) => (
        <div class="min-h-screen bg-[#050510] text-white font-sans selection:bg-[#ff007f] selection:text-white">
          <Title>Rider App</Title>
          <nav class="bg-[#080d1a] p-4 border-b border-[#00f0ff]/30 shadow-[0_4px_20px_rgba(0,240,255,0.15)] flex justify-center gap-6">
            <a
              class="px-4 py-2 font-bold text-[#00f0ff] text-glow-cyan no-underline transition-all hover:text-white hover:scale-105"
              href={paths()}
            >
              HOME
            </a>
            <a
              class="px-4 py-2 font-bold text-[#00f0ff] text-glow-cyan no-underline transition-all hover:text-white hover:scale-105"
              href={paths.users(1)}
            >
              USERS
            </a>
            <a
              class="px-4 py-2 font-bold text-[#ff007f] text-glow-pink no-underline transition-all hover:text-white hover:scale-105"
              href="/game"
            >
              GAME
            </a>
          </nav>
          <Loading fallback={<main class="px-4 py-12 text-[#ff007f] text-glow-pink font-bold">CHARGEMENT DU CYBERSPACE...</main>}>
            {props.children}
          </Loading>
        </div>
      )}
    </Router>
  );
}