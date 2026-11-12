import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { DataExport } from './DataExport';

const user = { id: '1', username: 'nexus_viper', email: 'nexus@example.com' };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<DataExport />', () => {
  test('downloads the account data as a JSON file', async () => {
    const data = { user, matches: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(json(data, 200)),
    );
    const links: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      links.push(this);
    });
    const view = render(() => <DataExport user={user} />);

    fireEvent.click(view.getByRole('button', { name: /export my data/i }));

    expect(await view.findByText('Export ready')).toBeInTheDocument();
    expect(links).toHaveLength(1);
    expect(links[0]?.download).toBe('ft_transcendence-nexus_viper.json');
    const href = links[0]?.getAttribute('href') ?? '';
    expect(
      JSON.parse(decodeURIComponent(href.slice(href.indexOf(',') + 1))),
    ).toEqual(data);
  });

  test('reports a missing backend route as offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('404 page not found', { status: 404 })),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const view = render(() => <DataExport user={user} />);

    fireEvent.click(view.getByRole('button', { name: /export my data/i }));

    expect(await view.findByText('Module offline')).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });
});
