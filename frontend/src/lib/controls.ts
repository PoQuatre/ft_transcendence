export const CONTROL_ACTIONS = [
  { id: 'up', label: 'Avancer' },
  { id: 'down', label: 'Reculer' },
  { id: 'left', label: 'Gauche' },
  { id: 'right', label: 'Droite' },
  { id: 'dash', label: 'Dash' },
] as const;

export type ControlAction = (typeof CONTROL_ACTIONS)[number]['id'];
export type Controls = Record<ControlAction, number>;

export const DEFAULT_CONTROLS: Controls = {
  up: 87,
  down: 83,
  left: 65,
  right: 68,
  dash: 340,
};

export const ARROW_CONTROLS: Controls = {
  up: 265,
  down: 264,
  left: 263,
  right: 262,
  dash: 340,
};

// keyCode -> [code raylib, libellé], comme DOMToGLFWKeyCode d'emscripten.
const KEYS = new Map<number, [number, string]>([
  [0x20, [32, 'SPACE']],
  [0x25, [263, '←']],
  [0x26, [265, '↑']],
  [0x27, [262, '→']],
  [0x28, [264, '↓']],
  [0x10, [340, 'SHIFT']],
  [0x11, [341, 'CTRL']],
  [0x12, [342, 'ALT']],
]);
for (let code = 0x30; code <= 0x39; code++) {
  KEYS.set(code, [code, String.fromCharCode(code)]);
}
for (let code = 0x41; code <= 0x5a; code++) {
  KEYS.set(code, [code, String.fromCharCode(code)]);
}

const LABELS = new Map(KEYS.values());

export function keyFromEvent(event: KeyboardEvent): number | undefined {
  return KEYS.get(event.keyCode)?.[0];
}

export function keyLabel(key: number): string {
  return LABELS.get(key) ?? '?';
}

export function actionUsing(
  controls: Controls,
  key: number,
  except?: ControlAction,
): ControlAction | undefined {
  return CONTROL_ACTIONS.find(
    (action) => action.id !== except && controls[action.id] === key,
  )?.id;
}

function isControls(value: unknown): value is Controls {
  if (!value || typeof value !== 'object') return false;
  const keys = CONTROL_ACTIONS.map(
    (action) => (value as Record<string, unknown>)[action.id],
  );
  return (
    keys.every((key) => typeof key === 'number' && LABELS.has(key)) &&
    new Set(keys).size === keys.length
  );
}

const STORAGE_KEY = 'ft_transcendence.controls';

export function loadControls(): Controls {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isControls(parsed)) return parsed;
    }
  } catch {
    // Stockage indisponible ou abîmé.
  }
  return { ...DEFAULT_CONTROLS };
}

export function saveControls(controls: Controls): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
    return true;
  } catch {
    return false;
  }
}
