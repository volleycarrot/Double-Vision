const TOKEN_KEY = "double-vision-auth-token";
const USERNAME_KEY = "double-vision-auth-username";

let token: string | null = null;
let username: string | null = null;

type AuthChangeCallback = () => void;
const authChangeListeners: AuthChangeCallback[] = [];

export function onAuthChange(cb: AuthChangeCallback): void {
  authChangeListeners.push(cb);
}

/**
 * Broadcast an auth namespace change to all registered managers so they
 * reload their in-memory state from the now-active storage namespace.
 *
 * On LOGIN: call this AFTER loadServerData() has already written merged
 * data to the account-scoped keys, so managers reload the correct values.
 *
 * On LOGOUT: called automatically inside logout().
 */
export function broadcastAuthChange(): void {
  authChangeListeners.forEach(cb => cb());
}

function loadFromStorage(): void {
  try {
    token = localStorage.getItem(TOKEN_KEY);
    username = localStorage.getItem(USERNAME_KEY);
  } catch {
    token = null;
    username = null;
  }
}

loadFromStorage();

export function isLoggedIn(): boolean {
  return token !== null && username !== null;
}

export function getUsername(): string {
  return username || "Guest";
}

export function getToken(): string | null {
  return token;
}

/**
 * Returns a namespaced localStorage key.
 * Guests use the original flat key (e.g. "double-vision-coins") for backward compatibility.
 * Logged-in accounts use a per-username key (e.g. "double-vision-user-alice-coins").
 */
export function getStorageKey(base: string): string {
  if (isLoggedIn() && username) {
    return `double-vision-user-${username}-${base}`;
  }
  return `double-vision-${base}`;
}

export function setAuth(newToken: string, newUsername: string): void {
  token = newToken;
  username = newUsername;
  try {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USERNAME_KEY, newUsername);
  } catch {}
  // Do NOT notify here — callers must call broadcastAuthChange() themselves
  // after server data has been loaded into the account namespace, so that
  // managers reload the fully-merged state rather than an empty namespace.
}

export function logout(): void {
  // Clear account-scoped local save keys before nulling username
  if (username) {
    for (const base of ["coins", "progress", "stats", "accessories"]) {
      try {
        localStorage.removeItem(`double-vision-user-${username}-${base}`);
      } catch {}
    }
  }
  token = null;
  username = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  } catch {}
  // Notify immediately on logout so managers switch back to guest namespace
  broadcastAuthChange();
}

function getApiBase(): string {
  const base = (import.meta as any).env?.BASE_URL || "/";
  const apiBase = base.replace(/\/$/, "");
  return window.location.origin + "/api";
}

export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  if (res.status === 401 && token) {
    logout();
  }
  return res;
}

export async function loginRequest(usr: string, pwd: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: usr, password: pwd }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Login failed" };
    }
    setAuth(data.token, data.username);
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function registerRequest(usr: string, pwd: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: usr, password: pwd }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Registration failed" };
    }
    setAuth(data.token, data.username);
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function loadUserData(): Promise<{ coins: number; progress: Array<{ worldIndex: number; completed: boolean; deaths: number; deathless?: boolean }>; accessories: any[]; stats: { totalCoinsEarned: number; totalCoinsSpent: number; totalDeaths: number; totalLevelCompletions: number; totalLevelsCreated: number } | null } | null> {
  if (!isLoggedIn()) return null;
  try {
    const res = await apiRequest("/user/data");
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function syncCoins(coins: number): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    await apiRequest("/user/coins", {
      method: "POST",
      body: JSON.stringify({ coins }),
    });
  } catch {}
}

export async function syncProgress(worldIndex: number, completed: boolean, deaths: number, deathless: boolean = false): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    await apiRequest("/user/progress", {
      method: "POST",
      body: JSON.stringify({ worldIndex, completed, deaths, deathless }),
    });
  } catch {}
}

export async function syncAccessories(owned: string[], equipped: Record<string, boolean>): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    await apiRequest("/user/accessories", {
      method: "POST",
      body: JSON.stringify({ owned, equipped }),
    });
  } catch {}
}

export async function syncStats(stats: { totalCoinsEarned: number; totalCoinsSpent: number; totalDeaths: number; totalLevelCompletions: number; totalLevelsCreated: number }): Promise<void> {
  if (!isLoggedIn()) return;
  try {
    await apiRequest("/user/stats", {
      method: "POST",
      body: JSON.stringify(stats),
    });
  } catch {}
}
