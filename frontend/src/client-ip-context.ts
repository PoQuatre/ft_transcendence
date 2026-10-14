import { AsyncLocalStorage } from 'node:async_hooks';

type GlobalWithClientIPContext = typeof globalThis & {
  clientIPContext?: AsyncLocalStorage<string | undefined>;
};

const globalContext = globalThis as GlobalWithClientIPContext;

export const clientIPContext = (globalContext.clientIPContext ??=
  new AsyncLocalStorage<string | undefined>());
