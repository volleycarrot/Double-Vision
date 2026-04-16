import { isLoggedIn, syncCoins } from "./AuthManager";
import { recordCoinsEarned, recordCoinsSpent } from "./StatsManager";
import { emitProgressChange } from "./EventBus";

const STORAGE_KEY = "double-vision-coins";

let coinBalance = loadBalance();

function loadBalance(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const val = JSON.parse(raw);
    return typeof val === "number" && val >= 0 ? Math.floor(val) : 0;
  } catch {
    return 0;
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coinBalance));
  } catch {}
  if (isLoggedIn()) {
    syncCoins(coinBalance);
  }
}

export function getCoins(): number {
  return coinBalance;
}

export function addCoins(amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) return;
  coinBalance += Math.floor(amount);
  save();
  recordCoinsEarned(Math.floor(amount));
  emitProgressChange();
}

export function spendCoins(amount: number): boolean {
  if (amount <= 0 || !Number.isFinite(amount)) return false;
  if (coinBalance < amount) return false;
  coinBalance -= Math.floor(amount);
  save();
  recordCoinsSpent(Math.floor(amount));
  return true;
}

export function loadServerData(serverCoins: number): void {
  coinBalance = serverCoins;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coinBalance));
  } catch {}
}
