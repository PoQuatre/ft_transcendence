import { Title } from '@solidjs/meta';
import { For } from 'solid-js';

import { Card, Separator } from '~/components/ui';

import './LegalDocument.css';

type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

type LegalDocumentProps = {
  title: string;
  titlePrefix?: string;
  accentTitle: string;
  highlights: readonly { title: string; text: string }[];
  sections: readonly LegalSection[];
};

const PANEL =
  'rounded-lg bg-surface-1/90 border-border-subtle/85 shadow-card-inner';

export function LegalDocument(props: LegalDocumentProps) {
  return (
    <div class="relative isolate flex-1 bg-background font-sans text-text-primary">
      <Title>{props.title} - Cybercore</Title>

      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div class="absolute inset-0 tactical-grid opacity-80" />
        <div class="absolute -top-40 -left-32 h-96 w-96 rounded-pill bg-accent-primary/15 blur-3xl" />
        <div class="absolute top-1/3 -right-40 h-96 w-96 rounded-pill bg-accent-secondary/15 blur-3xl" />
        <div class="absolute -bottom-40 left-1/3 h-96 w-96 rounded-pill bg-accent-secondary/10 blur-3xl" />
      </div>

      <div class="relative mx-auto grid container grid-cols-1 gap-space-xl px-margin py-space-xl lg:grid-cols-12">
        <aside class="min-w-0 lg:col-span-3">
          <Card
            class={`${PANEL} p-space-lg lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`}
          >
            <nav aria-label="Summary" class="legal-enter">
              <p class="font-label-mono-caps text-label-mono-caps font-bold text-text-muted uppercase">
                Summary
              </p>
              <Separator class="my-space-sm bg-border-subtle/85" />
              <ol class="space-y-space-xs font-label-data text-label-data uppercase">
                <For each={props.sections}>
                  {(section, index) => (
                    <li>
                      <a
                        href={`#${section.id}`}
                        target="_self"
                        class="flex items-start gap-space-sm rounded-md px-space-sm py-space-sm text-text-muted no-underline transition-colors hover:bg-surface-2 hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-primary"
                      >
                        <span class="shrink-0 font-bold text-accent-primary">
                          {String(index() + 1).padStart(2, '0')}
                        </span>
                        {section.title}
                      </a>
                    </li>
                  )}
                </For>
              </ol>
            </nav>
          </Card>
        </aside>

        <div class="min-w-0 space-y-space-lg lg:col-span-9">
          <section
            aria-labelledby="legal-title"
            class="legal-enter space-y-space-sm"
          >
            <p class="flex items-center gap-space-sm font-label-mono-caps text-label-mono-caps font-bold text-accent-primary uppercase">
              <span
                aria-hidden="true"
                class="h-2.5 w-2.5 shrink-0 bg-accent-primary shadow-glow-cyan"
              />
              // Legal / {props.title}
            </p>
            <h1
              id="legal-title"
              class="font-display-hero text-display-hero-mobile font-extrabold uppercase md:text-display-hero"
            >
              {props.titlePrefix}
              <span class="text-accent-primary neon-text-cyan">
                {props.accentTitle}
              </span>
            </h1>
            <p class="font-label-mono-caps text-label-mono-caps text-text-muted uppercase">
              Last updated [DATE] // Version 0.1
            </p>
            <Separator class="mt-space-lg bg-border-subtle/85" />
          </section>

          <div class="grid grid-cols-1 gap-space-md md:grid-cols-3">
            <For each={props.highlights}>
              {(highlight, index) => (
                <Card
                  class={`${PANEL} legal-enter p-space-lg`}
                  style={{ '--legal-delay': `${80 + index() * 60}ms` }}
                >
                  <h2 class="mb-space-sm flex items-center gap-space-sm font-label-mono-caps text-label-mono-caps font-bold text-accent-primary uppercase">
                    <span
                      aria-hidden="true"
                      class="h-1.5 w-1.5 shrink-0 bg-accent-primary shadow-glow-cyan-xs"
                    />
                    {highlight.title}
                  </h2>
                  <p class="font-body-sm text-body-sm text-text-primary">
                    {highlight.text}
                  </p>
                </Card>
              )}
            </For>
          </div>

          <For each={props.sections}>
            {(section, index) => (
              <section
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                tabindex={-1}
                class="scroll-mt-36 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-primary sm:scroll-mt-24"
              >
                <Card
                  class={`${PANEL} legal-enter p-space-lg sm:p-8`}
                  style={{
                    '--legal-delay': `${Math.min(200 + index() * 50, 400)}ms`,
                  }}
                >
                  <p class="mb-space-sm font-label-mono-caps text-label-mono-caps font-bold text-accent-primary">
                    #{String(index() + 1).padStart(2, '0')}
                  </p>
                  <h2
                    id={`${section.id}-title`}
                    class="font-headline-md text-headline-md font-bold text-text-primary"
                  >
                    {section.title}
                  </h2>
                  <Separator class="my-space-md bg-border-subtle/85" />
                  <div class="space-y-space-md font-body-lg text-body-lg text-text-secondary">
                    <For each={section.paragraphs}>
                      {(paragraph) => <p>{paragraph}</p>}
                    </For>
                  </div>
                </Card>
              </section>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
