import { describe, expect, test } from 'vitest';

import { paginate } from './pagination';

describe('paginate', () => {
  const pilots = Array.from({ length: 43 }, (_, index) => index + 1);

  test('limits pages to 20 players and retains the final partial page', () => {
    expect(paginate(pilots, 1, 20).items).toHaveLength(20);
    expect(paginate(pilots, 3, 20)).toEqual({
      page: 3,
      totalPages: 3,
      start: 41,
      end: 43,
      items: [41, 42, 43],
    });
  });

  test('supports smaller page sizes and clamps pages after filtering', () => {
    expect(paginate(pilots, 2, 5).items).toEqual([6, 7, 8, 9, 10]);
    expect(paginate(pilots.slice(0, 6), 9, 5)).toEqual({
      page: 2,
      totalPages: 2,
      start: 6,
      end: 6,
      items: [6],
    });
    expect(paginate([], 2, 10)).toEqual({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      items: [],
    });
  });
});
