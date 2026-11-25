import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, test } from 'vitest';

import { pilotXp } from '~/lib/level';

import Leaderboard from './leaderboard';

afterEach(cleanup);

describe('<Leaderboard />', () => {
  test('ranks pilots by XP, worth 5 per kill and 1 per shape destroyed', () => {
    const { getByRole, getAllByRole } = render(() => <Leaderboard />);
    const row = getByRole('rowheader', { name: 'NEOVIM' }).closest('tr');
    const cells = row?.querySelectorAll('td');
    expect(cells?.[1]).toHaveTextContent('39,760');
    expect(cells?.[2]).toHaveTextContent('4,268');
    expect(cells?.[3]).toHaveTextContent('18,420');
    expect(pilotXp({ kills: 2, shapes: 3 })).toBe(13);
    expect(getAllByRole('rowheader')[0]).toHaveTextContent('NEOVIM');
  });

  test('only offers FFA with XP, kills and shapes; the rest is coming soon', () => {
    const { getByRole, getByLabelText } = render(() => <Leaderboard />);
    const sort = within(getByLabelText('Sort standings'));
    expect(getByRole('button', { name: 'FREE-FOR-ALL' })).toBeEnabled();
    for (const name of [
      /SQUAD 4V4/,
      /^CTF/,
      /OVERLOAD/,
      /K\/D RATIO/,
      /WIN RATE/,
    ])
      expect(getByRole('button', { name })).toBeDisabled();
    for (const name of ['XP', 'KILLS', 'SHAPES DESTROYED'])
      expect(
        sort.getByRole('button', { name: new RegExp(`${name}$`) }),
      ).toBeEnabled();
  });

  test('sorts standings by kills when the kills metric is picked', async () => {
    const { getByLabelText, getAllByRole } = render(() => <Leaderboard />);
    expect(getAllByRole('rowheader')[1]).toHaveTextContent('KAIROS');
    fireEvent.click(
      within(getByLabelText('Sort standings')).getByRole('button', {
        name: 'KILLS',
      }),
    );
    await waitFor(() =>
      expect(getAllByRole('rowheader')[1]).toHaveTextContent('V3X_PILOT'),
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
