import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, expect, test } from 'vitest';

import { PilotTelemetry } from './PilotTelemetry';

afterEach(cleanup);

test('displays the supplied pilot telemetry and accessible progress', () => {
  const { getByRole, getByText } = render(() => (
    <PilotTelemetry
      telemetry={{
        name: 'TEST_PILOT',
        position: 3,
        xp: 2100,
        best: 220,
        matches: 120,
        delta: -10,
        gain: -1,
      }}
    />
  ));

  expect(getByRole('heading', { name: 'TEST_PILOT' })).toBeInTheDocument();
  expect(getByText('2,100')).toBeInTheDocument();
  expect(getByText('#3')).toBeInTheDocument();
  // 2,100 XP: level 5 starts at 1,600 XP and level 6 at 2,500 XP.
  expect(getByText('◇ LEVEL 5')).toBeInTheDocument();
  expect(getByText('400 XP TO LEVEL 6')).toBeInTheDocument();
  expect(
    getByRole('progressbar', { name: 'Progress from level 5 to level 6' }),
  ).toHaveAttribute('aria-valuenow', '500');
});
