import Phaser from "phaser";

const STORAGE_KEY = "double-vision-keybindings";

export interface ControlBindings {
  left: number;
  right: number;
  jump: number;
  duck: number;
}

export interface KeyBindingsConfig {
  single: ControlBindings;
  multiplayer: ControlBindings;
}

const DEFAULT_BINDINGS: KeyBindingsConfig = {
  single: {
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    jump: Phaser.Input.Keyboard.KeyCodes.UP,
    duck: Phaser.Input.Keyboard.KeyCodes.DOWN,
  },
  multiplayer: {
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    jump: Phaser.Input.Keyboard.KeyCodes.W,
    duck: Phaser.Input.Keyboard.KeyCodes.S,
  },
};

let currentBindings: KeyBindingsConfig = loadFromStorage();

function loadFromStorage(): KeyBindingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneBindings(DEFAULT_BINDINGS);
    const parsed = JSON.parse(raw) as KeyBindingsConfig;
    if (!parsed.single || !parsed.multiplayer) return cloneBindings(DEFAULT_BINDINGS);
    if (
      typeof parsed.single.left !== "number" ||
      typeof parsed.single.right !== "number" ||
      typeof parsed.single.jump !== "number" ||
      typeof parsed.single.duck !== "number" ||
      typeof parsed.multiplayer.left !== "number" ||
      typeof parsed.multiplayer.right !== "number" ||
      typeof parsed.multiplayer.jump !== "number" ||
      typeof parsed.multiplayer.duck !== "number"
    ) {
      return cloneBindings(DEFAULT_BINDINGS);
    }
    return parsed;
  } catch {
    return cloneBindings(DEFAULT_BINDINGS);
  }
}

function cloneBindings(b: KeyBindingsConfig): KeyBindingsConfig {
  return {
    single: { ...b.single },
    multiplayer: { ...b.multiplayer },
  };
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBindings));
  } catch {}
}

export function getBindings(mode: "single" | "multiplayer"): ControlBindings {
  return { ...currentBindings[mode] };
}

export function getDefaultBindings(mode: "single" | "multiplayer"): ControlBindings {
  return { ...DEFAULT_BINDINGS[mode] };
}

export function setBinding(mode: "single" | "multiplayer", action: keyof ControlBindings, keyCode: number): void {
  currentBindings[mode][action] = keyCode;
  saveToStorage();
}

export function resetBindings(mode: "single" | "multiplayer"): void {
  currentBindings[mode] = { ...DEFAULT_BINDINGS[mode] };
  saveToStorage();
}

export function resetAllBindings(): void {
  currentBindings = cloneBindings(DEFAULT_BINDINGS);
  saveToStorage();
}

const KEY_NAME_MAP: Record<number, string> = {
  [Phaser.Input.Keyboard.KeyCodes.LEFT]: "←",
  [Phaser.Input.Keyboard.KeyCodes.RIGHT]: "→",
  [Phaser.Input.Keyboard.KeyCodes.UP]: "↑",
  [Phaser.Input.Keyboard.KeyCodes.DOWN]: "↓",
  [Phaser.Input.Keyboard.KeyCodes.SPACE]: "Space",
  [Phaser.Input.Keyboard.KeyCodes.SHIFT]: "Shift",
  [Phaser.Input.Keyboard.KeyCodes.CTRL]: "Ctrl",
  [Phaser.Input.Keyboard.KeyCodes.ALT]: "Alt",
  [Phaser.Input.Keyboard.KeyCodes.TAB]: "Tab",
  [Phaser.Input.Keyboard.KeyCodes.ENTER]: "Enter",
  [Phaser.Input.Keyboard.KeyCodes.BACKSPACE]: "Backspace",
  [Phaser.Input.Keyboard.KeyCodes.DELETE]: "Delete",
  [Phaser.Input.Keyboard.KeyCodes.ESC]: "Esc",
};

export function getKeyName(keyCode: number): string {
  if (KEY_NAME_MAP[keyCode]) return KEY_NAME_MAP[keyCode];
  const entry = Object.entries(Phaser.Input.Keyboard.KeyCodes).find(
    ([, v]) => v === keyCode
  );
  if (entry) return entry[0].length === 1 ? entry[0] : entry[0].charAt(0) + entry[0].slice(1).toLowerCase();
  return `Key${keyCode}`;
}

const ARROW_NAV_KEYS = new Set([
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.PAGE_UP,
  Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN,
  Phaser.Input.Keyboard.KeyCodes.HOME,
  Phaser.Input.Keyboard.KeyCodes.END,
  Phaser.Input.Keyboard.KeyCodes.INSERT,
  Phaser.Input.Keyboard.KeyCodes.DELETE,
]);

export function isArrowNavKey(keyCode: number): boolean {
  return ARROW_NAV_KEYS.has(keyCode);
}

export function isLetterKey(keyCode: number): boolean {
  return keyCode >= 65 && keyCode <= 90;
}

const RESERVED_KEYS = new Set([
  Phaser.Input.Keyboard.KeyCodes.ESC,
  Phaser.Input.Keyboard.KeyCodes.P,
  Phaser.Input.Keyboard.KeyCodes.ENTER,
]);

export function isReservedKey(keyCode: number): boolean {
  return RESERVED_KEYS.has(keyCode);
}
