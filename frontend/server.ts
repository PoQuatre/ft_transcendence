import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';

import sirv from 'sirv';

type HandleRequest = (request: Request) => Promise<Response>;

const { handleRequest } = (await import(
  new URL('../server/server.js', import.meta.url).href
)) as {
  handleRequest: HandleRequest;
};

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const internalOrigin = process.env.INTERNAL_ORIGIN
  ? new URL(process.env.INTERNAL_ORIGIN).origin
  : undefined;
const assets = sirv(resolve('dist/client'), {
  dev: process.env.NODE_ENV !== 'production',
  etag: true,
});

function headersFromRequest(req: IncomingMessage) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  return new Promise<boolean>((resolveServe, reject) => {
    let done = false;
    const settle = (served: boolean) => {
      if (done) return;
      done = true;
      res.off('error', reject);
      res.off('finish', finish);
      resolveServe(served);
    };
    const finish = () => settle(true);

    res.once('error', reject);
    res.once('finish', finish);
    assets(req, res, () => settle(false));
  });
}

// oxlint-disable-next-line typescript/no-misused-promises
const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    const origin =
      internalOrigin ??
      `${
        headerValue(req.headers['x-forwarded-proto'])
          ?.split(',', 1)[0]
          ?.trim() ?? 'http'
      }://${
        headerValue(req.headers['x-forwarded-host']) ??
        headerValue(req.headers.host) ??
        'localhost'
      }`;
    const url = new URL(req.url ?? '/', origin);

    if (await serveStatic(req, res)) return;

    const requestInit: RequestInit & { duplex?: 'half' } = {
      headers: headersFromRequest(req),
      method,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      requestInit.body = Readable.toWeb(req) as BodyInit;
      requestInit.duplex = 'half';
    }

    const response = await handleRequest(new Request(url, requestInit));

    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (method === 'HEAD' || !response.body) {
      res.end();
    } else {
      Readable.fromWeb(
        response.body as Parameters<typeof Readable.fromWeb>[0],
      ).pipe(res);
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
}).listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log('Shutting down...');
    server.close((err) => process.exit(err ? 1 : 0));
  });
}
