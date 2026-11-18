import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { IncomingRequests } from './IncomingRequests';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

const request = {
  username: 'ghost',
  sender_id: 's1',
  created_at: '2026-11-17T10:00:00Z',
};

const page = (requests: unknown[]) =>
  json({ requests, total_pages: 1, current_page: 1 }, 200);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<IncomingRequests />', () => {
  test('accepts a request and tells the page', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([request]))
      .mockResolvedValueOnce(json({ message: 'ok' }, 200))
      .mockResolvedValueOnce(page([]));
    vi.stubGlobal('fetch', fetchMock);
    const onAccepted = vi.fn<() => void>();
    const view = render(() => <IncomingRequests onAccepted={onAccepted} />);

    fireEvent.click(await view.findByRole('button', { name: 'Accept ghost' }));

    expect(await view.findByText('Friend added')).toBeInTheDocument();
    expect(onAccepted).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/friends/requests/accept',
      expect.objectContaining({ body: JSON.stringify({ sender_id: 's1' }) }),
    );
    expect(
      await view.findByText('Aucune demande en attente.'),
    ).toBeInTheDocument();
  });

  test('declines a request', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([request]))
      .mockResolvedValueOnce(json({ message: 'ok' }, 200))
      .mockResolvedValueOnce(page([]));
    vi.stubGlobal('fetch', fetchMock);
    const onAccepted = vi.fn<() => void>();
    const view = render(() => <IncomingRequests onAccepted={onAccepted} />);

    fireEvent.click(await view.findByRole('button', { name: 'Decline ghost' }));

    expect(await view.findByText('Request declined')).toBeInTheDocument();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/friends/requests/decline');
  });

  test('says when nothing is pending', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(page([])));
    const view = render(() => (
      <IncomingRequests onAccepted={vi.fn<() => void>()} />
    ));

    expect(
      await view.findByText('Aucune demande en attente.'),
    ).toBeInTheDocument();
  });
});
