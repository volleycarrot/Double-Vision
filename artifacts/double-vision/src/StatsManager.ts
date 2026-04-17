import { isLoggedIn, syncStats, getStorageKey, onAuthChange } from "./AuthManager";
import { emitProgressChange } from "./EventBus";

export interface AllTimeStats {
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  totalDeaths: number;
  totalLevelCompletions: number;
  totalLevelsCreated: number;
}

function defaultStats(): AllTimeStats {
  return {
    totalCoinsEarned: 0,
    totalCoinsSpent: 0,
    totalDeaths: 0,
    totalLevelCompletions: 0,
    totalLevelsCreated: 0,
  };
}

let stats: AllTimeStats = loadStats();

onAuthChange(() => {
  stats = loadStats();
  emitProgressChange();
});

function loadStats(): AllTimeStats {
  try {
    const raw = localStorage.getItem(getStorageKey("stats"));
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    const result = defaultStats();
    if (typeof parsed.totalCoinsEarned === "number" && parsed.totalCoinsEarned >= 0)
      result.totalCoinsEarned = Math.floor(parsed.totalCoinsEarned);
    if (typeof parsed.totalCoinsSpent === "number" && parsed.totalCoinsSpent >= 0)
      result.totalCoinsSpent = Math.floor(parsed.totalCoinsSpent);
    if (typeof parsed.totalDeaths === "number" && parsed.totalDeaths >= 0)
      result.totalDeaths = Math.floor(parsed.totalDeaths);
    if (typeof parsed.totalLevelCompletions === "number" && parsed.totalLevelCompletions >= 0)
      result.totalLevelCompletions = Math.floor(parsed.totalLevelCompletions);
    if (typeof parsed.totalLevelsCreated === "number" && parsed.totalLevelsCreated >= 0)
      result.totalLevelsCreated = Math.floor(parsed.totalLevelsCreated);
    return result;
  } catch {
    return defaultStats();
  }
}

function save(): void {
  try {
    localStorage.setItem(getStorageKey("stats"), JSON.stringify(stats));
  } catch {}
  if (isLoggedIn()) {
    syncStats(stats);
  }
  emitProgressChange();
}

export function getStats(): AllTimeStats {
  return { ...stats };
}

export function recordCoinsEarned(amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) return;
  stats.totalCoinsEarned += Math.floor(amount);
  save();
}

export function recordCoinsSpent(amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) return;
  stats.totalCoinsSpent += Math.floor(amount);
  save();
}

export function recordDeath(): void {
  stats.totalDeaths += 1;
  save();
}

export function recordLevelCompletion(): void {
  stats.totalLevelCompletions += 1;
  save();
}

export function recordLevelCreated(): void {
  stats.totalLevelsCreated += 1;
  save();
}

export function loadServerData(serverStats: Partial<AllTimeStats>): void {
  const replaced = defaultStats();
  replaced.totalCoinsEarned = serverStats.totalCoinsEarned ?? 0;
  replaced.totalCoinsSpent = serverStats.totalCoinsSpent ?? 0;
  replaced.totalDeaths = serverStats.totalDeaths ?? 0;
  replaced.totalLevelCompletions = serverStats.totalLevelCompletions ?? 0;
  replaced.totalLevelsCreated = serverStats.totalLevelsCreated ?? 0;
  stats = replaced;
  try {
    localStorage.setItem(getStorageKey("stats"), JSON.stringify(stats));
  } catch {}
}
