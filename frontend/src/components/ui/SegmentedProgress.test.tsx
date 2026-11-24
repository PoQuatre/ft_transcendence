import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, test } from 'vitest';

import { SegmentedProgress } from './SegmentedProgress';

afterEach(cleanup);

const fills = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-segment] > div'),
    (fill) => fill.style.width,
  );

describe('<SegmentedProgress />', () => {
  test('fills whole blocks then part of the last one', () => {
    render(() => (
      <SegmentedProgress value={45} max={100} segments={4} label="Level" />
    ));
    expect(fills()).toEqual(['100%', '80%', '0%', '0%']);
  });

  test('fills the full height of each block', () => {
    render(() => (
      <SegmentedProgress
        value={50}
        label="Height"
        segmentClass="h-3"
        color="pink"
      />
    ));
    for (const fill of document.querySelectorAll('[data-segment] > div')) {
      expect(fill).toHaveClass('h-full', 'bg-accent-secondary');
      expect(fill.className).not.toMatch(/\bh-1\.5\b|bg-background/);
    }
  });

  test('is announced as a labelled progress bar', () => {
    render(() => (
      <SegmentedProgress
        value={300}
        max={900}
        label="Progress to level 4"
        valueText="300 / 900 XP"
      />
    ));
    const bar = screen.getByRole('progressbar', {
      name: 'Progress to level 4',
    });
    expect(bar).toHaveAttribute('aria-valuenow', '300');
    expect(bar).toHaveAttribute('aria-valuemax', '900');
    expect(bar).toHaveAttribute('aria-valuetext', '300 / 900 XP');
    expect(fills()).toHaveLength(20);
  });

  test('clamps values outside the range', () => {
    render(() => (
      <SegmentedProgress value={150} max={100} segments={2} label="Over" />
    ));
    expect(fills()).toEqual(['100%', '100%']);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});
