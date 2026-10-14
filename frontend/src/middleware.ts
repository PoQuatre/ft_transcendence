import { clientIPContext } from './client-ip-context';

const internalOrigin = process.env.INTERNAL_ORIGIN;

if (internalOrigin) {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (
      typeof input !== 'string' ||
      !input.startsWith('/') ||
      input.startsWith('//')
    ) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init?.headers);
    const clientIP = clientIPContext.getStore();
    if (clientIP) headers.set('x-forwarded-for', clientIP);

    return nativeFetch(new URL(input, internalOrigin), { ...init, headers });
  };
}

export default (_request: Request, next: () => Promise<Response>) => next();
