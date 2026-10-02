import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { fileRoutes } from 'filesystem-routing/vite';
import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const gameBuildIdPath = resolve(
  import.meta.dirname,
  'public/assets/game/build-id',
);

function gameReloadPlugin(): Plugin {
  const buildIdPath = normalizePath(gameBuildIdPath);
  let publishedBuildId: string | undefined;

  return {
    name: 'game-reload',
    configureServer(server) {
      server.watcher.add(gameBuildIdPath);
    },
    handleHotUpdate(ctx) {
      if (normalizePath(ctx.file) !== buildIdPath) return [];
      if (!existsSync(gameBuildIdPath)) return [];

      const buildId = readFileSync(gameBuildIdPath, 'utf8').trim();
      if (!buildId || buildId === publishedBuildId) return [];

      publishedBuildId = buildId;
      ctx.server.ws.send({
        type: 'custom',
        event: 'game:rebuilt',
        data: { buildId },
      });
      return [];
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    solid({
      start: {
        devtools: false,
        middleware: './src/middleware.ts',
      },
      ssr: true,
      extensions: ['.tsx'],
      diagnostics: true,
    }),
    fileRoutes({ types: '.generated/file-routes.d.ts' }),
    tailwindcss(),
    gameReloadPlugin(),
  ],
  define: {
    GAME_BUILD_ID: JSON.stringify(
      existsSync(gameBuildIdPath)
        ? readFileSync(gameBuildIdPath, 'utf8').trim()
        : '',
    ),
  },
  server: {
    allowedHosts: ['nginx'],
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest-setup.ts'],
    isolate: false,
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
