import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';

import Leaderboard from './leaderboard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<Leaderboard />', () => {
  test('links pilots in the podium and standings to their profile', () => {
    const { getByRole } = render(() => <Leaderboard />);
    expect(getByRole('link', { name: 'View NEOVIM profile' })).toHaveAttribute(
      'href',
      '/users/NEOVIM',
    );
    expect(getByRole('link', { name: 'NULLBYTE' })).toHaveAttribute(
      'href',
      '/users/NULLBYTE',
    );
  });

  test('changes period data and podium, then sorts and resets pagination', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn<() => number>(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn<(id: number) => void>());
    const { getByRole, getByText, container } = render(() => <Leaderboard />);
    const pageSize = getByRole('combobox', { name: 'Pilots per page' });
    fireEvent.click(pageSize);
    fireEvent.click(await screen.findByRole('option', { name: '5' }));
    await waitFor(() =>
      expect(getByRole('button', { name: 'NEXT' })).toBeEnabled(),
    );
    fireEvent.click(getByRole('button', { name: 'NEXT' }));
    await waitFor(() =>
      expect(getByText(/6–8 \/ 8 PILOTS/)).toBeInTheDocument(),
    );

    fireEvent.click(getByRole('combobox', { name: 'Ranking period' }));
    fireEvent.click(await screen.findByRole('option', { name: 'THIS SEASON' }));
    await waitFor(() => {
      expect(getByText(/1–5 \/ 6 PILOTS/)).toBeInTheDocument();
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
      expect(
        container.querySelector('tbody tr')?.getAttribute('data-pilot'),
      ).toBe('NEOVIM');
      expect(
        container.querySelector('.arena-podium-champion h3'),
      ).toHaveTextContent('NEOVIM');
    });
    fireEvent.click(getByRole('button', { name: 'WINS', pressed: false }));
    await waitFor(() => {
      expect(
        container.querySelector('tbody tr')?.getAttribute('data-pilot'),
      ).toBe('V3X_PILOT');
      expect(
        container.querySelector('.arena-podium-champion h3'),
      ).toHaveTextContent('NEOVIM');
    });
    fireEvent.input(getByRole('searchbox', { name: 'Search pilot' }), {
      target: { value: 'nullbyte' },
    });
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(
        container.querySelector('tbody tr')?.getAttribute('data-pilot'),
      ).toBe('NULLBYTE');
      expect(getByText(/1–1 \/ 1 PILOTS/)).toBeInTheDocument();
    });
  });

  test('handles a period with two pilots and an empty period', async () => {
    const { getByRole, getByText, container } = render(() => <Leaderboard />);
    fireEvent.click(getByRole('combobox', { name: 'Ranking period' }));
    fireEvent.click(await screen.findByRole('option', { name: 'THIS MONTH' }));
    await waitFor(() => {
      expect(container.querySelectorAll('.arena-podium-item')).toHaveLength(2);
      expect(
        container.querySelector('tbody tr')?.getAttribute('data-pilot'),
      ).toBe('NULLBYTE');
      expect(getByText(/1–2 \/ 2 PILOTS/)).toBeInTheDocument();
    });
    fireEvent.click(getByRole('combobox', { name: 'Ranking period' }));
    fireEvent.click(await screen.findByRole('option', { name: 'THIS WEEK' }));
    await waitFor(() => {
      expect(
        getByText('No ranking data available for this period.'),
      ).toBeInTheDocument();
      expect(getByText('No ranking data available yet.')).toBeInTheDocument();
      expect(getByText(/0–0 \/ 0 PILOTS/)).toBeInTheDocument();
    });
  });

  test('uses rank-change colors for rising, falling and unchanged pilots', () => {
    const { getByRole } = render(() => <Leaderboard />);
    const changeCell = (name: string) => {
      const row = getByRole('rowheader', { name }).closest('tr');
      return row?.querySelectorAll('td')[3];
    };
    expect(changeCell('NEOVIM')).toHaveClass('text-success-foreground!');
    expect(changeCell('NULLBYTE')).toHaveClass('text-error-foreground!');
    expect(changeCell('KAIROS')).not.toHaveClass(
      'text-success-foreground!',
      'text-error-foreground!',
    );
  });

  test('offers page sizes up to 20 and disables navigation on a single page', async () => {
    const { getByRole, getByText } = render(() => <Leaderboard />);
    const select = getByRole('combobox', { name: 'Pilots per page' });
    expect(select).toHaveTextContent('20');
    expect(getByRole('button', { name: 'PREVIOUS' })).toBeDisabled();
    expect(getByRole('button', { name: 'NEXT' })).toBeDisabled();
    fireEvent.click(select);
    await waitFor(() =>
      expect(screen.getByRole('option', { name: '5' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('option', { name: '5' }));
    await waitFor(() => expect(select).toHaveTextContent('5'));
    expect(getByText(/1–5 \/ 8 PILOTS/)).toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: 'NEXT' }));
    await waitFor(() => {
      expect(getByText(/6–8 \/ 8 PILOTS/)).toBeInTheDocument();
      expect(getByRole('rowheader', { name: 'VSCODE' })).toBeInTheDocument();
    });
  });

  test('renders the podium and filters standings by pilot name', async () => {
    const { getByRole, getAllByText, queryByRole } = render(() => (
      <Leaderboard />
    ));

    expect(
      getByRole('heading', { name: 'THE APEX THREE' }),
    ).toBeInTheDocument();
    expect(getAllByText('NEOVIM')).toHaveLength(2);

    fireEvent.input(getByRole('searchbox', { name: 'Search pilot' }), {
      target: { value: 'nullbyte' },
    });
    await waitFor(() => {
      expect(
        queryByRole('rowheader', { name: 'NEOVIM' }),
      ).not.toBeInTheDocument();
      expect(getByRole('rowheader', { name: 'NULLBYTE' })).toBeInTheDocument();
    });
  });
});
