import { WORLDS } from "./worlds/WorldConfig";
import { isLoggedIn, syncProgress, getStorageKey } from "./AuthManager";
import { emitProgressChange } from "./EventBus";

export interface WorldProgress {
  completed: boolean;
  deaths: number;
  deathless?: boolean;
}

export interface GameProgress {
  worlds: WorldProgress[];
}

function defaultProgress(): GameProgress {
  return {
    worlds: WORLDS.map(() => ({ completed: false, deaths: 0, deathless: false })),
  };
}

export function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(getStorageKey("progress"));
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as GameProgress;
    if (!parsed.worlds || parsed.worlds.length !== WORLDS.length) {
      return defaultProgress();
    }
    for (const w of parsed.worlds) {
      if (typeof w.deathless !== "boolean") w.deathless = false;
    }
    return parsed;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(getStorageKey("progress"), JSON.stringify(progress));
  } catch {}
}

export function markWorldCompleted(worldIndex: number, deaths: number, deathlessRun: boolean = false): void {
  const progress = loadProgress();
  if (worldIndex >= 0 && worldIndex < progress.worlds.length) {
    progress.worlds[worldIndex].completed = true;
    progress.worlds[worldIndex].deaths += deaths;
    progress.worlds[worldIndex].deathless = deathlessRun;
  }
  saveProgress(progress);
  if (isLoggedIn()) {
    syncProgress(worldIndex, true, progress.worlds[worldIndex]?.deaths ?? deaths, progress.worlds[worldIndex]?.deathless ?? false);
  }
  emitProgressChange();
}

export function clearWorldDeathless(worldIndex: number): void {
  const progress = loadProgress();
  if (worldIndex < 0 || worldIndex >= progress.worlds.length) return;
  if (!progress.worlds[worldIndex].deathless) return;
  progress.worlds[worldIndex].deathless = false;
  saveProgress(progress);
  if (isLoggedIn()) {
    syncProgress(worldIndex, progress.worlds[worldIndex].completed, progress.worlds[worldIndex].deaths, false);
  }
  emitProgressChange();
}

export function isWorldCompleted(worldIndex: number): boolean {
  const progress = loadProgress();
  return progress.worlds[worldIndex]?.completed ?? false;
}

export function allWorldsCompleted(): boolean {
  const progress = loadProgress();
  return progress.worlds.every((w) => w.completed);
}

export function isWorldDeathless(worldIndex: number): boolean {
  const progress = loadProgress();
  return !!progress.worlds[worldIndex]?.deathless;
}

export function allWorldsDeathless(): boolean {
  const progress = loadProgress();
  return progress.worlds.every((w) => w.completed && w.deathless);
}

export function deathlessWorldCount(): number {
  const progress = loadProgress();
  return progress.worlds.filter((w) => w.completed && w.deathless).length;
}

export function loadServerData(serverProgress: Array<{ worldIndex: number; completed: boolean; deaths: number; deathless?: boolean }>): void {
  const progress = defaultProgress();
  for (const sp of serverProgress) {
    if (sp.worldIndex >= 0 && sp.worldIndex < progress.worlds.length) {
      progress.worlds[sp.worldIndex].completed = sp.completed;
      progress.worlds[sp.worldIndex].deaths = sp.deaths;
      progress.worlds[sp.worldIndex].deathless = !!sp.deathless;
    }
  }
  saveProgress(progress);
  emitProgressChange();
}
