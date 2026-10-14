const internalOrigin = process.env.INTERNAL_ORIGIN;

if (internalOrigin) {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    nativeFetch(
      typeof input === 'string' &&
        input.startsWith('/') &&
        !input.startsWith('//')
        ? new URL(input, internalOrigin)
        : input,
      init,
    );
}

export default (_request: Request, next: () => Promise<Response>) => next();
