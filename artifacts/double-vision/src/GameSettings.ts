const STORAGE_KEY = "double-vision-settings";

export interface BackgroundColorPreset {
  name: string;
  value: string;
  hex: number;
  uiColor: number;
  uiHover: number;
}

export const BG_PRESETS: BackgroundColorPreset[] = [
  { name: "Midnight", value: "#1a1a2e", hex: 0x1a1a2e, uiColor: 0x16213e, uiHover: 0x1e2d4a },
  { name: "Charcoal", value: "#2b2b2b", hex: 0x2b2b2b, uiColor: 0x3a3a3a, uiHover: 0x4a4a4a },
  { name: "Deep Blue", value: "#0d1b2a", hex: 0x0d1b2a, uiColor: 0x1b2838, uiHover: 0x243448 },
  { name: "Dark Green", value: "#1a2e1a", hex: 0x1a2e1a, uiColor: 0x213e16, uiHover: 0x2d4a1e },
  { name: "Dark Purple", value: "#2e1a2e", hex: 0x2e1a2e, uiColor: 0x3e1640, uiHover: 0x4a1e50 },
  { name: "Dark Red", value: "#2e1a1a", hex: 0x2e1a1a, uiColor: 0x3e1616, uiHover: 0x4a1e1e },
];

export interface Settings {
  musicEnabled: boolean;
  bgColorIndex: number;
}

function defaultSettings(): Settings {
  return {
    musicEnabled: true,
    bgColorIndex: 0,
  };
}

let currentSettings: Settings = loadFromStorage();

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Settings;
    if (typeof parsed.musicEnabled !== "boolean") return defaultSettings();
    if (typeof parsed.bgColorIndex !== "number" || parsed.bgColorIndex < 0 || parsed.bgColorIndex >= BG_PRESETS.length) {
      parsed.bgColorIndex = 0;
    }
    return parsed;
  } catch {
    return defaultSettings();
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {}
}

export function getSettings(): Settings {
  return { ...currentSettings };
}

export function setMusicEnabled(enabled: boolean): void {
  currentSettings.musicEnabled = enabled;
  saveToStorage();
}

export function setBgColorIndex(index: number): void {
  if (index >= 0 && index < BG_PRESETS.length) {
    currentSettings.bgColorIndex = index;
    saveToStorage();
  }
}

export function getBgColor(): BackgroundColorPreset {
  return BG_PRESETS[currentSettings.bgColorIndex];
}

export function isMusicEnabled(): boolean {
  return currentSettings.musicEnabled;
}
