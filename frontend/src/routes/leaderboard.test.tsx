import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, test } from 'vitest';

import Leaderboard from './leaderboard';

afterEach(cleanup);

describe('<Leaderboard />', () => {
  test('uses rank-change colors for rising, falling and unchanged pilots', () => {
    const { getByRole } = render(() => <Leaderboard />);
    const changeCell = (name: string) => {
      const row = getByRole('rowheader', { name }).closest('tr');
      return row?.querySelectorAll('td')[3];
    };
    expect(changeCell('NEONVOID')).toHaveClass('text-success-foreground!');
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
      expect(getByRole('rowheader', { name: 'SYNTHWAVE' })).toBeInTheDocument();
    });
  });

  test('renders the podium and filters standings by pilot name', async () => {
    const { getByRole, getAllByText, queryByRole } = render(() => (
      <Leaderboard />
    ));

    expect(
      getByRole('heading', { name: 'THE APEX THREE' }),
    ).toBeInTheDocument();
    expect(getAllByText('NEONVOID')).toHaveLength(2);

    fireEvent.input(getByRole('searchbox', { name: 'Search pilot' }), {
      target: { value: 'nullbyte' },
    });
    await waitFor(() => {
      expect(
        queryByRole('rowheader', { name: 'NEONVOID' }),
      ).not.toBeInTheDocument();
      expect(getByRole('rowheader', { name: 'NULLBYTE' })).toBeInTheDocument();
    });
  });
});
