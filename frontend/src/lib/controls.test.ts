import { afterEach, describe, expect, test } from 'vitest';

import {
  actionUsing,
  DEFAULT_CONTROLS,
  keyFromEvent,
  keyLabel,
  loadControls,
  saveControls,
} from './controls';

const STORAGE_KEY = 'ft_transcendence.controls';

const press = (keyCode: number) => new KeyboardEvent('keydown', { keyCode });

afterEach(() => localStorage.clear());

describe('keyFromEvent', () => {
  test('maps keys the way the game reads them', () => {
    expect(keyFromEvent(press(0x5a))).toBe(90);
    expect(keyFromEvent(press(0x31))).toBe(49);
    expect(keyFromEvent(press(0x26))).toBe(265);
    expect(keyFromEvent(press(0x10))).toBe(340);
    expect(keyFromEvent(press(0x20))).toBe(32);
  });

  test('ignores keys the game does not handle', () => {
    expect(keyFromEvent(press(0x70))).toBeUndefined();
    expect(keyFromEvent(press(0x1b))).toBeUndefined();
  });
});

describe('keyLabel', () => {
  test('names letters, arrows and modifiers', () => {
    expect(keyLabel(87)).toBe('W');
    expect(keyLabel(263)).toBe('←');
    expect(keyLabel(340)).toBe('SHIFT');
  });
});

describe('actionUsing', () => {
  test('finds the action bound to a key', () => {
    expect(actionUsing(DEFAULT_CONTROLS, 83)).toBe('down');
    expect(actionUsing(DEFAULT_CONTROLS, 83, 'down')).toBeUndefined();
    expect(actionUsing(DEFAULT_CONTROLS, 90)).toBeUndefined();
  });
});

describe('loadControls / saveControls', () => {
  test('falls back to the defaults', () => {
    expect(loadControls()).toEqual(DEFAULT_CONTROLS);
  });

  test('reads back what was saved', () => {
    const zqsd = { ...DEFAULT_CONTROLS, up: 90, left: 81 };
    expect(saveControls(zqsd)).toBe(true);
    expect(loadControls()).toEqual(zqsd);
  });

  test.each([
    ['broken JSON', '{'],
    ['a missing action', JSON.stringify({ up: 87 })],
    ['an unknown key', JSON.stringify({ ...DEFAULT_CONTROLS, up: 999 })],
    ['a key used twice', JSON.stringify({ ...DEFAULT_CONTROLS, up: 83 })],
  ])('ignores %s', (_case, saved) => {
    localStorage.setItem(STORAGE_KEY, saved);
    expect(loadControls()).toEqual(DEFAULT_CONTROLS);
  });
});
