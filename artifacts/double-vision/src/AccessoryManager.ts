import Phaser from "phaser";
import { EYE, getEyeOffsetY } from "./PlayerConfig";
import { isLoggedIn, syncAccessories, getStorageKey, onAuthChange } from "./AuthManager";
import { getStats } from "./StatsManager";
import { deathlessWorldCount, allWorldsDeathless } from "./ProgressManager";
import { onProgressChange, dispatchSpecialUnlocked } from "./EventBus";
import { WORLDS } from "./worlds/WorldConfig";

const SPECIAL_PREFIX = "special:";

export interface Accessory {
  id: string;
  name: string;
  category: "hat" | "glasses" | "neckwear";
  price: number;
  emoji: string;
}

export const ACCESSORIES: Accessory[] = [
  { id: "tophat", name: "Top Hat", category: "hat", price: 50, emoji: "🎩" },
  { id: "crown", name: "Crown", category: "hat", price: 100, emoji: "👑" },
  { id: "partyhat", name: "Party Hat", category: "hat", price: 30, emoji: "🥳" },
  { id: "cowboy", name: "Cowboy Hat", category: "hat", price: 75, emoji: "🤠" },
  { id: "beanie", name: "Beanie", category: "hat", price: 40, emoji: "🧢" },
  { id: "glowring", name: "Glow Ring", category: "hat", price: 120, emoji: "💫" },
  { id: "headband", name: "Headband", category: "hat", price: 45, emoji: "🎀" },
  { id: "sunglasses", name: "Sunglasses", category: "glasses", price: 35, emoji: "😎" },
  { id: "nerdglasses", name: "Nerd Glasses", category: "glasses", price: 25, emoji: "🤓" },
  { id: "monocle", name: "Monocle", category: "glasses", price: 60, emoji: "🧐" },
  { id: "bowtie", name: "Bow Tie", category: "neckwear", price: 20, emoji: "🎀" },
  { id: "cape", name: "Cape", category: "neckwear", price: 80, emoji: "🦸" },
  { id: "scarf", name: "Scarf", category: "neckwear", price: 50, emoji: "🧣" },
  { id: "medal", name: "Medal", category: "neckwear", price: 90, emoji: "🏅" },
];

export type UnlockType = "deaths" | "levels" | "coinsEarned" | "flawless" | "levelsCreated";

export interface Special {
  id: string;
  name: string;
  description: string;
  pieces: string[];
  slots: ("hat" | "glasses" | "neckwear")[];
  unlockType: UnlockType;
  threshold: number;
}

export const SPECIALS: Special[] = [
  {
    id: "devil",
    name: "Devil Attire",
    description: "Devil horns and a wicked tail.",
    pieces: ["devil_horns", "devil_tail"],
    slots: ["hat"],
    unlockType: "deaths",
    threshold: 500,
  },
  {
    id: "angel",
    name: "Angel Attire",
    description: "A radiant halo and angelic wings.",
    pieces: ["angel_halo", "angel_wings"],
    slots: ["hat", "neckwear"],
    unlockType: "levels",
    threshold: 100,
  },
  {
    id: "goldjacket",
    name: "Gold Jacket",
    description: "A glittering jacket of pure gold.",
    pieces: ["gold_jacket"],
    slots: [],
    unlockType: "coinsEarned",
    threshold: 1000,
  },
  {
    id: "construction",
    name: "Construction Attire",
    description: "A hard hat and trusty hammer for level builders.",
    pieces: ["construction_hat", "construction_hammer"],
    slots: ["hat"],
    unlockType: "levelsCreated",
    threshold: 5,
  },
  {
    id: "unique",
    name: "Unique Attire",
    description: "A one-of-a-kind hat, visor, and collar.",
    pieces: ["unique_hat", "unique_glasses", "unique_neck"],
    slots: ["hat", "glasses", "neckwear"],
    unlockType: "flawless",
    threshold: WORLDS.length,
  },
];

interface AccessoryState {
  owned: string[];
  equipped: Record<string, string | null>;
  ownedSpecials: string[];
  equippedSpecial: string | null;
}

function defaultState(): AccessoryState {
  return {
    owned: [],
    equipped: { hat: null, glasses: null, neckwear: null },
    ownedSpecials: [],
    equippedSpecial: null,
  };
}

const MIGRATION_V1_KEY = "double-vision-accessories-migrated-v1";
const MIGRATION_V2_KEY = "double-vision-accessories-migrated-v2";
const MIGRATION_V3_KEY = "double-vision-accessories-migrated-v3";

function migrateV1(s: AccessoryState): AccessoryState {
  try {
    if (localStorage.getItem(MIGRATION_V1_KEY)) return s;
  } catch {
    return s;
  }

  let hadOldScarf = false;
  s.owned = s.owned.map(id => {
    if (id === "scarf") {
      hadOldScarf = true;
      return "headband";
    }
    return id;
  });
  if (hadOldScarf) {
    const seen = new Set<string>();
    s.owned = s.owned.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  if (s.equipped["cape"] === "scarf") {
    s.equipped["cape"] = null;
    if (s.owned.includes("headband") && !s.equipped["hat"]) {
      s.equipped["hat"] = "headband";
    }
  }

  try {
    localStorage.setItem(MIGRATION_V1_KEY, "1");
  } catch {}
  return s;
}

function migrateV2(s: AccessoryState): AccessoryState {
  try {
    if (localStorage.getItem(MIGRATION_V2_KEY)) return s;
  } catch {
    return s;
  }

  if (s.equipped["cape"]) {
    if (!s.equipped["neckwear"]) {
      s.equipped["neckwear"] = s.equipped["cape"];
    }
    delete s.equipped["cape"];
  }

  try {
    localStorage.setItem(MIGRATION_V2_KEY, "1");
  } catch {}
  return s;
}

function migrateV3(s: AccessoryState): AccessoryState {
  try {
    if (localStorage.getItem(MIGRATION_V3_KEY)) return s;
  } catch {
    return s;
  }

  let hadHalo = false;
  s.owned = s.owned.map(id => {
    if (id === "halo") {
      hadHalo = true;
      return "glowring";
    }
    return id;
  });
  if (hadHalo) {
    const seen = new Set<string>();
    s.owned = s.owned.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if (s.equipped["hat"] === "halo") {
    s.equipped["hat"] = "glowring";
  }

  try {
    localStorage.setItem(MIGRATION_V3_KEY, "1");
  } catch {}
  return s;
}

function migrateState(s: AccessoryState): AccessoryState {
  s = migrateV1(s);
  s = migrateV2(s);
  s = migrateV3(s);
  return s;
}

function loadState(): AccessoryState {
  try {
    const raw = localStorage.getItem(getStorageKey("accessories"));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AccessoryState>;
    const base = defaultState();
    if (Array.isArray(parsed.owned)) base.owned = parsed.owned as string[];
    if (parsed.equipped && typeof parsed.equipped === "object") {
      base.equipped = { ...base.equipped, ...parsed.equipped };
    }
    if (Array.isArray(parsed.ownedSpecials)) {
      base.ownedSpecials = (parsed.ownedSpecials as string[]).filter(id => SPECIALS.some(s => s.id === id));
    }
    if (typeof parsed.equippedSpecial === "string" && SPECIALS.some(s => s.id === parsed.equippedSpecial)) {
      base.equippedSpecial = parsed.equippedSpecial;
    }
    return base;
  } catch {
    return defaultState();
  }
}

let state: AccessoryState = migrateState(loadState());
try {
  localStorage.setItem(getStorageKey("accessories"), JSON.stringify(state));
} catch {}

onAuthChange(() => {
  state = migrateState(loadState());
  try {
    localStorage.setItem(getStorageKey("accessories"), JSON.stringify(state));
  } catch {}
  checkSpecialUnlocks();
});

function save(): void {
  try {
    localStorage.setItem(getStorageKey("accessories"), JSON.stringify(state));
  } catch {}
  if (isLoggedIn()) {
    const equippedMap: Record<string, boolean> = {};
    for (const cat of ["hat", "glasses", "cape", "neckwear"]) {
      const id = state.equipped[cat];
      if (id) equippedMap[id] = true;
    }
    const ownedAll: string[] = [...state.owned];
    for (const sid of state.ownedSpecials) {
      const key = SPECIAL_PREFIX + sid;
      ownedAll.push(key);
      if (state.equippedSpecial === sid) equippedMap[key] = true;
    }
    syncAccessories(ownedAll, equippedMap);
  }
}

export function isOwned(id: string): boolean {
  return state.owned.includes(id);
}

export function purchaseAccessory(id: string): void {
  if (!state.owned.includes(id)) {
    state.owned.push(id);
    save();
  }
}

export function equipAccessory(id: string): void {
  const acc = ACCESSORIES.find(a => a.id === id);
  if (!acc || !state.owned.includes(id)) return;
  state.equipped[acc.category] = id;
  if (state.equippedSpecial) {
    const sp = SPECIALS.find(s => s.id === state.equippedSpecial);
    if (sp && sp.slots.includes(acc.category)) {
      state.equippedSpecial = null;
    }
  }
  save();
}

export function unequipCategory(category: string): void {
  state.equipped[category] = null;
  save();
}

export function getEquipped(category: string): string | null {
  return state.equipped[category] ?? null;
}

export function getEquippedAccessories(): Accessory[] {
  const result: Accessory[] = [];
  for (const cat of ["hat", "glasses", "neckwear"]) {
    const id = state.equipped[cat];
    if (id) {
      const acc = ACCESSORIES.find(a => a.id === id);
      if (acc) result.push(acc);
    }
  }
  return result;
}

export function isSpecialOwned(id: string): boolean {
  return state.ownedSpecials.includes(id);
}

export function getEquippedSpecial(): Special | null {
  if (!state.equippedSpecial) return null;
  return SPECIALS.find(s => s.id === state.equippedSpecial) ?? null;
}

export function equipSpecial(id: string): void {
  const sp = SPECIALS.find(s => s.id === id);
  if (!sp || !state.ownedSpecials.includes(id)) return;
  for (const slot of sp.slots) {
    state.equipped[slot] = null;
  }
  state.equippedSpecial = id;
  save();
}

export function unequipSpecial(): void {
  state.equippedSpecial = null;
  save();
}

export interface SpecialProgress {
  current: number;
  total: number;
  text: string;
}

export function getSpecialProgress(id: string): SpecialProgress {
  const sp = SPECIALS.find(s => s.id === id);
  if (!sp) return { current: 0, total: 0, text: "" };
  const stats = getStats();
  switch (sp.unlockType) {
    case "deaths":
      return {
        current: stats.totalDeaths,
        total: sp.threshold,
        text: `Deaths ${Math.min(stats.totalDeaths, sp.threshold)} / ${sp.threshold}`,
      };
    case "levels":
      return {
        current: stats.totalLevelCompletions,
        total: sp.threshold,
        text: `Levels ${Math.min(stats.totalLevelCompletions, sp.threshold)} / ${sp.threshold}`,
      };
    case "coinsEarned":
      return {
        current: stats.totalCoinsEarned,
        total: sp.threshold,
        text: `Coins earned ${Math.min(stats.totalCoinsEarned, sp.threshold)} / ${sp.threshold}`,
      };
    case "flawless": {
      const c = deathlessWorldCount();
      return {
        current: c,
        total: sp.threshold,
        text: `Deathless worlds ${c} / ${sp.threshold}`,
      };
    }
    case "levelsCreated":
      return {
        current: stats.totalLevelsCreated,
        total: sp.threshold,
        text: `Levels created ${Math.min(stats.totalLevelsCreated, sp.threshold)} / ${sp.threshold}`,
      };
  }
}

function isUnlockEligible(sp: Special): boolean {
  const stats = getStats();
  switch (sp.unlockType) {
    case "deaths":
      return stats.totalDeaths >= sp.threshold;
    case "levels":
      return stats.totalLevelCompletions >= sp.threshold;
    case "coinsEarned":
      return stats.totalCoinsEarned >= sp.threshold;
    case "flawless":
      return allWorldsDeathless();
    case "levelsCreated":
      return stats.totalLevelsCreated >= sp.threshold;
  }
}

export function devUnlockAll(): void {
  for (const acc of ACCESSORIES) {
    if (!state.owned.includes(acc.id)) state.owned.push(acc.id);
  }
  for (const sp of SPECIALS) {
    if (!state.ownedSpecials.includes(sp.id)) state.ownedSpecials.push(sp.id);
  }
  save();
}

export function checkSpecialUnlocks(): string[] {
  const newlyUnlocked: string[] = [];
  let changed = false;
  for (const sp of SPECIALS) {
    if (!state.ownedSpecials.includes(sp.id) && isUnlockEligible(sp)) {
      state.ownedSpecials.push(sp.id);
      newlyUnlocked.push(sp.id);
      changed = true;
    }
  }
  if (changed) {
    save();
    for (const id of newlyUnlocked) {
      const sp = SPECIALS.find(s => s.id === id);
      if (sp) dispatchSpecialUnlocked({ id: sp.id, name: sp.name });
    }
  }
  return newlyUnlocked;
}

onProgressChange(() => {
  checkSpecialUnlocks();
});

checkSpecialUnlocks();

export function loadServerData(serverAccessories: Array<{ accessoryId: string; equipped: boolean }>): void {
  const mergedOwned = new Set<string>(state.owned);
  const mergedSpecials = new Set<string>(state.ownedSpecials);
  const mergedEquipped: Record<string, string | null> = { ...state.equipped };
  let mergedEquippedSpecial: string | null = state.equippedSpecial;

  for (const sa of serverAccessories) {
    if (sa.accessoryId.startsWith(SPECIAL_PREFIX)) {
      const sid = sa.accessoryId.slice(SPECIAL_PREFIX.length);
      if (SPECIALS.some(s => s.id === sid)) {
        mergedSpecials.add(sid);
        if (sa.equipped) mergedEquippedSpecial = sid;
      }
      continue;
    }
    const remappedId = sa.accessoryId === "halo" ? "glowring" : sa.accessoryId;
    mergedOwned.add(remappedId);
    if (sa.equipped) {
      const acc = ACCESSORIES.find(a => a.id === remappedId);
      if (acc) {
        mergedEquipped[acc.category] = remappedId;
      }
    }
  }

  state = {
    ...state,
    owned: [...mergedOwned],
    equipped: mergedEquipped,
    ownedSpecials: [...mergedSpecials],
    equippedSpecial: mergedEquippedSpecial,
  };
  if (mergedEquippedSpecial) {
    const sp = SPECIALS.find(s => s.id === mergedEquippedSpecial);
    if (sp) {
      for (const slot of sp.slots) {
        state.equipped[slot] = null;
      }
    }
  }
  try {
    localStorage.setItem(getStorageKey("accessories"), JSON.stringify(state));
  } catch {}

  save();
  checkSpecialUnlocks();
}

export function drawSingleAccessory(
  gfx: Phaser.GameObjects.Graphics,
  accId: string,
  centerX: number,
  centerY: number,
  bodyWidth: number,
  bodyHeight: number
) {
  const topY = centerY - bodyHeight / 2;
  const eyeOffsetY = getEyeOffsetY(bodyHeight);
  const eyeY = centerY + eyeOffsetY;
  _drawAccessoryById(gfx, accId, centerX, centerY, bodyWidth, bodyHeight, topY, eyeY);
}

export function drawSpecialPreview(
  gfx: Phaser.GameObjects.Graphics,
  specialId: string,
  centerX: number,
  centerY: number,
  bodyWidth: number,
  bodyHeight: number
) {
  const sp = SPECIALS.find(s => s.id === specialId);
  if (!sp) return;
  const topY = centerY - bodyHeight / 2;
  const eyeOffsetY = getEyeOffsetY(bodyHeight);
  const eyeY = centerY + eyeOffsetY;
  for (const piece of sp.pieces) {
    _drawAccessoryById(gfx, piece, centerX, centerY, bodyWidth, bodyHeight, topY, eyeY);
  }
}

function _drawAccessoryById(
  gfx: Phaser.GameObjects.Graphics,
  accId: string,
  centerX: number,
  centerY: number,
  bodyWidth: number,
  bodyHeight: number,
  topY: number,
  eyeY: number
) {
  switch (accId) {
    case "tophat": {
      gfx.fillStyle(0x222222, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 3, topY - 6, bodyWidth + 6, 6);
      gfx.fillRect(centerX - 11, topY - 26, 22, 20);
      gfx.lineStyle(1, 0x444444, 1);
      gfx.strokeRect(centerX - 11, topY - 26, 22, 20);
      gfx.fillStyle(0xcc8800, 1);
      gfx.fillRect(centerX - 10, topY - 12, 20, 3);
      break;
    }
    case "crown": {
      gfx.fillStyle(0xffd700, 1);
      gfx.fillRect(centerX - 14, topY - 9, 28, 9);
      gfx.fillTriangle(centerX - 14, topY - 9, centerX - 14, topY - 20, centerX - 6, topY - 9);
      gfx.fillTriangle(centerX - 4, topY - 9, centerX, topY - 24, centerX + 4, topY - 9);
      gfx.fillTriangle(centerX + 14, topY - 9, centerX + 14, topY - 20, centerX + 6, topY - 9);
      gfx.fillStyle(0xff0000, 1);
      gfx.fillCircle(centerX, topY - 14, 3);
      break;
    }
    case "partyhat": {
      gfx.fillStyle(0xff4488, 1);
      gfx.fillTriangle(centerX - 14, topY, centerX, topY - 30, centerX + 14, topY);
      gfx.fillStyle(0xffdd00, 1);
      gfx.fillCircle(centerX, topY - 30, 4);
      gfx.fillStyle(0x44ccff, 1);
      gfx.fillRect(centerX - 8, topY - 12, 5, 5);
      gfx.fillStyle(0x44ff44, 1);
      gfx.fillRect(centerX + 4, topY - 20, 5, 5);
      break;
    }
    case "cowboy": {
      gfx.fillStyle(0x8b4513, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 6, topY - 5, bodyWidth + 12, 6);
      gfx.fillRect(centerX - 13, topY - 18, 26, 13);
      gfx.fillStyle(0xa0522d, 1);
      gfx.fillRect(centerX - 13, topY - 18, 26, 4);
      break;
    }
    case "beanie": {
      gfx.fillStyle(0x3366cc, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 1, topY - 12, bodyWidth + 2, 13);
      gfx.fillStyle(0x4488ee, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 1, topY - 12, bodyWidth + 2, 4);
      gfx.fillStyle(0xff4444, 1);
      gfx.fillCircle(centerX, topY - 14, 4);
      break;
    }
    case "glowring": {
      gfx.lineStyle(3, 0x66ddff, 0.9);
      gfx.strokeCircle(centerX, topY - 8, 14);
      gfx.lineStyle(2, 0xaaeeff, 0.6);
      gfx.strokeCircle(centerX, topY - 8, 17);
      break;
    }
    case "headband": {
      gfx.fillStyle(0xcc3333, 0.9);
      gfx.fillRect(centerX - bodyWidth / 2 - 2, topY - 6, bodyWidth + 4, 7);
      gfx.fillStyle(0xeeee44, 1);
      gfx.fillRect(centerX - 4, topY - 6, 8, 7);
      break;
    }
    case "sunglasses": {
      gfx.fillStyle(0x111111, 1);
      gfx.fillRect(centerX - EYE.SPACING - 7, eyeY - 5, 14, 10);
      gfx.fillRect(centerX + EYE.SPACING - 7, eyeY - 5, 14, 10);
      gfx.lineStyle(2, 0x333333, 1);
      gfx.lineBetween(centerX - EYE.SPACING + 7, eyeY, centerX + EYE.SPACING - 7, eyeY);
      break;
    }
    case "nerdglasses": {
      gfx.lineStyle(2, 0x333333, 1);
      gfx.strokeCircle(centerX - EYE.SPACING, eyeY, 7);
      gfx.strokeCircle(centerX + EYE.SPACING, eyeY, 7);
      gfx.lineBetween(centerX - EYE.SPACING + 7, eyeY, centerX + EYE.SPACING - 7, eyeY);
      break;
    }
    case "monocle": {
      gfx.lineStyle(2, 0xccaa00, 1);
      gfx.strokeCircle(centerX + EYE.SPACING, eyeY, 8);
      gfx.lineStyle(1, 0xccaa00, 0.6);
      gfx.lineBetween(centerX + EYE.SPACING, eyeY + 8, centerX + EYE.SPACING - 4, centerY + bodyHeight / 2);
      break;
    }
    case "cape": {
      const capeH = Math.max(bodyHeight - 4, 8);
      gfx.fillStyle(0xcc0000, 0.85);
      gfx.fillRect(centerX - bodyWidth / 2 - 8, topY + 4, 8, capeH);
      gfx.fillTriangle(
        centerX - bodyWidth / 2 - 8, centerY + bodyHeight / 2,
        centerX - bodyWidth / 2 - 12, centerY + bodyHeight / 2 + 8,
        centerX - bodyWidth / 2, centerY + bodyHeight / 2
      );
      break;
    }
    case "scarf": {
      const neckY = centerY;
      const tailLen = Math.min(14, bodyHeight * 0.5);
      gfx.fillStyle(0x2266aa, 0.9);
      gfx.fillRect(centerX - bodyWidth / 2 - 3, neckY - 4, bodyWidth + 6, 11);
      gfx.fillRect(centerX + bodyWidth / 2 - 4, neckY + 7, 8, tailLen);
      gfx.fillStyle(0x3388cc, 1);
      gfx.fillRect(centerX + bodyWidth / 2 - 3, neckY + 7, 6, 4);
      if (tailLen > 8) gfx.fillRect(centerX + bodyWidth / 2 - 3, neckY + 13, 6, 4);
      if (tailLen > 12) gfx.fillRect(centerX + bodyWidth / 2 - 5, neckY + 18, 10, 4);
      break;
    }
    case "bowtie": {
      const bowY = centerY + bodyHeight * 0.15;
      gfx.fillStyle(0xff2244, 1);
      gfx.fillTriangle(centerX, bowY, centerX - 9, bowY - 6, centerX - 9, bowY + 6);
      gfx.fillTriangle(centerX, bowY, centerX + 9, bowY - 6, centerX + 9, bowY + 6);
      gfx.fillStyle(0xcc1133, 1);
      gfx.fillCircle(centerX, bowY, 3);
      break;
    }
    case "medal": {
      const medalY = centerY + bodyHeight * 0.1;
      const ribbonHalfWidth = bodyWidth / 2;
      const ribbonTopY = topY + 4 + (medalY - (topY + 4)) * 0.75;
      gfx.lineStyle(2, 0x4444ff, 0.8);
      gfx.lineBetween(centerX - ribbonHalfWidth, ribbonTopY, centerX, medalY);
      gfx.lineBetween(centerX + ribbonHalfWidth, ribbonTopY, centerX, medalY);
      gfx.fillStyle(0xffd700, 1);
      gfx.fillCircle(centerX, medalY + 5, 7);
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillCircle(centerX, medalY + 5, 4);
      break;
    }
    case "devil_horns": {
      gfx.fillStyle(0xaa0000, 1);
      gfx.fillTriangle(centerX - 10, topY, centerX - 14, topY - 12, centerX - 6, topY - 2);
      gfx.fillTriangle(centerX + 10, topY, centerX + 14, topY - 12, centerX + 6, topY - 2);
      gfx.lineStyle(1, 0x550000, 1);
      gfx.strokeTriangle(centerX - 10, topY, centerX - 14, topY - 12, centerX - 6, topY - 2);
      gfx.strokeTriangle(centerX + 10, topY, centerX + 14, topY - 12, centerX + 6, topY - 2);
      break;
    }
    case "devil_tail": {
      const baseX = centerX + bodyWidth / 2;
      const baseY = centerY + bodyHeight / 2 - 4;
      gfx.lineStyle(3, 0xaa0000, 1);
      gfx.beginPath();
      gfx.moveTo(baseX, baseY);
      gfx.lineTo(baseX + 8, baseY + 4);
      gfx.lineTo(baseX + 14, baseY - 2);
      gfx.lineTo(baseX + 18, baseY + 6);
      gfx.strokePath();
      gfx.fillStyle(0xaa0000, 1);
      gfx.fillTriangle(baseX + 18, baseY + 6, baseX + 24, baseY + 2, baseX + 22, baseY + 12);
      break;
    }
    case "angel_halo": {
      gfx.lineStyle(3, 0xffdd44, 1);
      gfx.strokeEllipse(centerX, topY - 12, 32, 10);
      gfx.lineStyle(1, 0xffffaa, 0.7);
      gfx.strokeEllipse(centerX, topY - 12, 36, 12);
      break;
    }
    case "angel_wings": {
      const wingTopY = topY + bodyHeight * 0.25;
      const leftBaseX = centerX - bodyWidth / 2;
      const rightBaseX = centerX + bodyWidth / 2;
      gfx.fillStyle(0xffffff, 0.95);
      gfx.fillTriangle(leftBaseX, wingTopY, leftBaseX - 16, wingTopY - 6, leftBaseX - 14, wingTopY + 14);
      gfx.fillTriangle(leftBaseX, wingTopY + 6, leftBaseX - 18, wingTopY + 2, leftBaseX - 12, wingTopY + 18);
      gfx.fillTriangle(rightBaseX, wingTopY, rightBaseX + 16, wingTopY - 6, rightBaseX + 14, wingTopY + 14);
      gfx.fillTriangle(rightBaseX, wingTopY + 6, rightBaseX + 18, wingTopY + 2, rightBaseX + 12, wingTopY + 18);
      gfx.lineStyle(1, 0xcccccc, 0.6);
      gfx.strokeTriangle(leftBaseX, wingTopY, leftBaseX - 16, wingTopY - 6, leftBaseX - 14, wingTopY + 14);
      gfx.strokeTriangle(rightBaseX, wingTopY, rightBaseX + 16, wingTopY - 6, rightBaseX + 14, wingTopY + 14);
      break;
    }
    case "gold_jacket": {
      const jw = bodyWidth + 4;
      const jh = bodyHeight * 0.4;
      const jx = centerX - jw / 2;
      const jy = centerY + bodyHeight * 0.05;
      gfx.fillStyle(0xffd700, 1);
      gfx.fillRect(jx, jy, jw, jh);
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillRect(jx, jy, jw, 4);
      gfx.lineStyle(1, 0xcc8800, 1);
      gfx.strokeRect(jx, jy, jw, jh);
      gfx.lineBetween(centerX, jy, centerX, jy + jh);
      gfx.fillStyle(0xfff099, 1);
      gfx.fillCircle(centerX - jw / 4, jy + jh * 0.3, 1.5);
      gfx.fillCircle(centerX + jw / 4, jy + jh * 0.3, 1.5);
      gfx.fillCircle(centerX - jw / 4, jy + jh * 0.7, 1.5);
      gfx.fillCircle(centerX + jw / 4, jy + jh * 0.7, 1.5);
      break;
    }
    case "construction_hat": {
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillEllipse(centerX, topY - 4, 30, 14);
      gfx.fillRect(centerX - 15, topY - 4, 30, 6);
      gfx.lineStyle(1, 0xcc6600, 1);
      gfx.strokeEllipse(centerX, topY - 4, 30, 14);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(centerX - 6, topY - 11, 12, 4);
      gfx.fillStyle(0xcc6600, 1);
      gfx.fillRect(centerX - 1, topY - 14, 2, 8);
      gfx.fillRect(centerX - 4, topY - 11, 8, 2);
      break;
    }
    case "construction_hammer": {
      const hx = centerX + bodyWidth / 2 + 6;
      const hy = centerY + bodyHeight * 0.05;
      gfx.fillStyle(0x885522, 1);
      gfx.fillRect(hx - 1, hy - 4, 2, 18);
      gfx.lineStyle(1, 0x442200, 1);
      gfx.strokeRect(hx - 1, hy - 4, 2, 18);
      gfx.fillStyle(0xaaaaaa, 1);
      gfx.fillRect(hx - 5, hy - 8, 10, 6);
      gfx.fillStyle(0x666666, 1);
      gfx.fillRect(hx - 5, hy - 8, 10, 2);
      gfx.lineStyle(1, 0x333333, 1);
      gfx.strokeRect(hx - 5, hy - 8, 10, 6);
      break;
    }
    case "unique_hat": {
      gfx.fillStyle(0x6622cc, 1);
      gfx.fillTriangle(centerX - 16, topY, centerX + 16, topY, centerX, topY - 22);
      gfx.fillStyle(0xff66cc, 1);
      gfx.fillCircle(centerX, topY - 22, 3);
      gfx.fillStyle(0x22ddaa, 1);
      gfx.fillCircle(centerX - 8, topY - 6, 2);
      gfx.fillCircle(centerX + 8, topY - 6, 2);
      gfx.fillCircle(centerX, topY - 14, 2);
      break;
    }
    case "unique_glasses": {
      gfx.lineStyle(2, 0xff66cc, 1);
      gfx.strokeRect(centerX - EYE.SPACING - 8, eyeY - 6, 16, 12);
      gfx.strokeRect(centerX + EYE.SPACING - 8, eyeY - 6, 16, 12);
      gfx.fillStyle(0x22ddaa, 0.4);
      gfx.fillRect(centerX - EYE.SPACING - 8, eyeY - 6, 16, 12);
      gfx.fillRect(centerX + EYE.SPACING - 8, eyeY - 6, 16, 12);
      gfx.lineBetween(centerX - EYE.SPACING + 8, eyeY, centerX + EYE.SPACING - 8, eyeY);
      break;
    }
    case "unique_neck": {
      const neckY = centerY + bodyHeight * 0.05;
      gfx.fillStyle(0x6622cc, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 2, neckY - 3, bodyWidth + 4, 6);
      gfx.fillStyle(0xffdd44, 1);
      gfx.fillTriangle(centerX, neckY + 3, centerX - 5, neckY + 12, centerX + 5, neckY + 12);
      gfx.fillStyle(0xff66cc, 1);
      gfx.fillCircle(centerX, neckY + 9, 2);
      break;
    }
  }
}

export function drawAccessories(
  gfx: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  bodyWidth: number,
  bodyHeight: number,
  fillColor: number
) {
  const equipped = getEquippedAccessories();
  const topY = centerY - bodyHeight / 2;
  const eyeOffsetY = getEyeOffsetY(bodyHeight);
  const eyeY = centerY + eyeOffsetY;

  for (const acc of equipped) {
    _drawAccessoryById(gfx, acc.id, centerX, centerY, bodyWidth, bodyHeight, topY, eyeY);
  }

  const sp = getEquippedSpecial();
  if (sp) {
    for (const piece of sp.pieces) {
      _drawAccessoryById(gfx, piece, centerX, centerY, bodyWidth, bodyHeight, topY, eyeY);
    }
  }
}
