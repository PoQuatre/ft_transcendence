import { Title } from '@solidjs/meta';
import { Loading } from 'solid-js';
import { Router } from './router';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import './App.css';

export default function App() {
  return (
    <Router>
      {(props) => (
        <div class="min-h-screen bg-surface-container-lowest font-body-lg text-on-surface antialiased selection:bg-primary-container selection:text-on-primary relative flex flex-col">
          <Title>CYBERCORE // NEURAL ARENA</Title>

          {/* Calque de scanlines CRT global (auto-fermant) */}
          <div class="fixed inset-0 scanlines z-40 pointer-events-none opacity-40" />

          {/* En-tête de navigation */}
          <Header />

          {/* Contenu principal */}
          <main class="w-full pt-16 flex-1 flex flex-col">
            <Loading
              fallback={
                <div class="flex-1 flex items-center justify-center p-12 text-primary-container text-glow-cyan font-label-mono-caps font-bold">
                  CHARGEMENT DU CYBERSPACE...
                </div>
              }
            >
              {props.children}
            </Loading>
          </main>

          {/* Pied de page */}
          <Footer />
        </div>
      )}
    </Router>
  );
}