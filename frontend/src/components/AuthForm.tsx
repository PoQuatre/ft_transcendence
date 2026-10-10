import { Show } from 'solid-js';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  mode: AuthMode;
}

export default function AuthForm(props: AuthFormProps) {
  const isSignup = () => props.mode === 'signup';

  const submit = (event: SubmitEvent) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(form);

    void fetch(`/api/auth/${props.mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <main class="mx-auto max-w-sm px-4 py-12">
      <h1 class="mb-6 text-3xl font-bold">
        {isSignup() ? 'Sign up' : 'Log in'}
      </h1>
      <form class="space-y-4" onSubmit={submit}>
        <Show when={isSignup()}>
          <label class="block" for="username">
            Username
            <input
              class="mt-1 block w-full rounded border p-2"
              id="username"
              name="username"
              required
            />
          </label>
        </Show>
        <label class="block" for="email">
          Email
          <input
            class="mt-1 block w-full rounded border p-2"
            id="email"
            name="email"
            required
            type="email"
          />
        </label>
        <label class="block" for="password">
          Password
          <input
            class="mt-1 block w-full rounded border p-2"
            id="password"
            name="password"
            required
            type="password"
          />
        </label>
        <button class="rounded bg-slate-800 px-4 py-2 text-white" type="submit">
          {isSignup() ? 'Sign up' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
