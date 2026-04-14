import { WORLDS } from "./worlds/WorldConfig";

const STORAGE_KEY = "double-vision-progress";

export interface WorldProgress {
  completed: boolean;
  deaths: number;
}

export interface GameProgress {
  worlds: WorldProgress[];
}

function defaultProgress(): GameProgress {
  return {
    worlds: WORLDS.map(() => ({ completed: false, deaths: 0 })),
  };
}

export function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as GameProgress;
    if (!parsed.worlds || parsed.worlds.length !== WORLDS.length) {
      return defaultProgress();
    }
    return parsed;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
  }
}

export function markWorldCompleted(worldIndex: number, deaths: number): void {
  const progress = loadProgress();
  if (worldIndex >= 0 && worldIndex < progress.worlds.length) {
    progress.worlds[worldIndex].completed = true;
    progress.worlds[worldIndex].deaths += deaths;
  }
  saveProgress(progress);
}

export function isWorldCompleted(worldIndex: number): boolean {
  const progress = loadProgress();
  return progress.worlds[worldIndex]?.completed ?? false;
}

export function allWorldsCompleted(): boolean {
  const progress = loadProgress();
  return progress.worlds.every((w) => w.completed);
}
