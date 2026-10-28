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
        elo: 2100,
        best: 2200,
        matches: 120,
        delta: -10,
        gain: -1,
        remaining: 100,
        progress: 75,
      }}
    />
  ));

  expect(getByRole('heading', { name: 'TEST_PILOT' })).toBeInTheDocument();
  expect(getByText('2,100')).toBeInTheDocument();
  expect(getByText('#3')).toBeInTheDocument();
  expect(
    getByRole('progressbar', { name: 'Progress from Elite to Apex' }),
  ).toHaveAttribute('value', '75');
});
