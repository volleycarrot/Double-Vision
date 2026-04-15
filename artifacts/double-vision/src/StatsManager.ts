import { isLoggedIn, syncStats } from "./AuthManager";

const STORAGE_KEY = "double-vision-stats";

export interface AllTimeStats {
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  totalDeaths: number;
  totalLevelCompletions: number;
}

function defaultStats(): AllTimeStats {
  return {
    totalCoinsEarned: 0,
    totalCoinsSpent: 0,
    totalDeaths: 0,
    totalLevelCompletions: 0,
  };
}

let stats: AllTimeStats = loadStats();

function loadStats(): AllTimeStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    return result;
  } catch {
    return defaultStats();
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {}
  if (isLoggedIn()) {
    syncStats(stats);
  }
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

export function loadServerData(serverStats: Partial<AllTimeStats>): void {
  const merged = defaultStats();
  merged.totalCoinsEarned = Math.max(stats.totalCoinsEarned, serverStats.totalCoinsEarned ?? 0);
  merged.totalCoinsSpent = Math.max(stats.totalCoinsSpent, serverStats.totalCoinsSpent ?? 0);
  merged.totalDeaths = Math.max(stats.totalDeaths, serverStats.totalDeaths ?? 0);
  merged.totalLevelCompletions = Math.max(stats.totalLevelCompletions, serverStats.totalLevelCompletions ?? 0);
  stats = merged;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {}
  const localExceedsServer =
    merged.totalCoinsEarned > (serverStats.totalCoinsEarned ?? 0) ||
    merged.totalCoinsSpent > (serverStats.totalCoinsSpent ?? 0) ||
    merged.totalDeaths > (serverStats.totalDeaths ?? 0) ||
    merged.totalLevelCompletions > (serverStats.totalLevelCompletions ?? 0);
  if (localExceedsServer && isLoggedIn()) {
    syncStats(stats);
  }
}
