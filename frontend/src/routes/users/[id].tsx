import { Title } from '@solidjs/meta';
import { query, type RouteDefinition, type RouteProps } from '@solidjs/router';
import { createMemo } from 'solid-js';

import { paths } from '../../router';

// Async data loading: a query (cached per key) read through a memo — the
// surrounding <Loading> boundary (in App.tsx) shows its fallback until the
// promise settles. Swap the static JSON for any API endpoint.
const getUser = query(async (id: string) => {
  const response = await fetch('/users.json');
  const users: Record<string, { name: string; title: string }> =
    await response.json();
  return users[id] ?? { name: 'Unknown', title: 'No such user' };
}, 'user');

// Starts the fetch as soon as navigation begins, before the page renders.
export const route = {
  preload: ({ params }) => void getUser(params.id!),
} satisfies RouteDefinition;

export default function User(props: RouteProps<'/users/:id'>) {
  const user = createMemo(() => getUser(props.params.id));

  return (
    <section>
      <Title>{`User ${props.params.id} - Solid App`}</Title>
      <h2 class="my-2 text-2xl font-semibold">{user().name}</h2>
      <p>{user().title}</p>
      <p class="my-4">
        <a
          class="font-semibold text-accent-primary underline decoration-accent-primary decoration-2 underline-offset-4 transition-colors hover:text-accent-primary-hover focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-primary"
          href={paths.users(Number(props.params.id) + 1)}
        >
          Next user
        </a>
      </p>
    </section>
  );
}
