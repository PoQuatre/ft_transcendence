import { describe, expect, test } from 'vitest';

import { levelProgress, xpForLevel } from './level';

describe('levelProgress', () => {
  test('starts at level 1 with no XP', () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      next: 2,
      current: 0,
      span: 100,
      remaining: 100,
      progress: 0,
    });
  });

  test('levels up exactly on the threshold', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelProgress(99).level).toBe(1);
    expect(levelProgress(100)).toMatchObject({
      level: 2,
      current: 0,
      span: 300,
    });
  });

  test('reports progress towards the next level', () => {
    expect(levelProgress(35_135)).toEqual({
      level: 19,
      next: 20,
      current: 2735,
      span: 3700,
      remaining: 965,
      progress: 73.91,
    });
  });
});
