import { HydrationScript } from '@solidjs/web';
import type { ParentProps } from 'solid-js';

export default function Document(props: ParentProps) {
  return (
    <html class="dark" lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <title>FT_TRANSCENDENCE</title>

        {/* Polices et icônes du Design System */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />

        <HydrationScript />
      </head>
      <body class="bg-background font-sans text-text-primary antialiased selection:bg-accent-primary selection:text-accent-primary-on">
        {props.children}
      </body>
    </html>
  );
}
