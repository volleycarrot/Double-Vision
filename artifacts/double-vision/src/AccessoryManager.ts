import Phaser from "phaser";
import { EYE, getEyeOffsetY } from "./PlayerConfig";
import { isLoggedIn, syncAccessories } from "./AuthManager";

const STORAGE_KEY = "double-vision-accessories";

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
  { id: "halo", name: "Halo", category: "hat", price: 120, emoji: "😇" },
  { id: "headband", name: "Headband", category: "hat", price: 45, emoji: "🎀" },
  { id: "sunglasses", name: "Sunglasses", category: "glasses", price: 35, emoji: "😎" },
  { id: "nerdglasses", name: "Nerd Glasses", category: "glasses", price: 25, emoji: "🤓" },
  { id: "monocle", name: "Monocle", category: "glasses", price: 60, emoji: "🧐" },
  { id: "bowtie", name: "Bow Tie", category: "neckwear", price: 20, emoji: "🎀" },
  { id: "cape", name: "Cape", category: "neckwear", price: 80, emoji: "🦸" },
  { id: "scarf", name: "Scarf", category: "neckwear", price: 50, emoji: "🧣" },
  { id: "medal", name: "Medal", category: "neckwear", price: 90, emoji: "🏅" },
];

interface AccessoryState {
  owned: string[];
  equipped: Record<string, string | null>;
}

function defaultState(): AccessoryState {
  return { owned: [], equipped: { hat: null, glasses: null, neckwear: null } };
}

const MIGRATION_V1_KEY = "double-vision-accessories-migrated-v1";
const MIGRATION_V2_KEY = "double-vision-accessories-migrated-v2";

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

function migrateState(s: AccessoryState): AccessoryState {
  s = migrateV1(s);
  s = migrateV2(s);
  return s;
}

let state: AccessoryState = migrateState(loadState());
save();

function loadState(): AccessoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AccessoryState;
    if (!Array.isArray(parsed.owned)) return defaultState();
    if (!parsed.equipped || typeof parsed.equipped !== "object") return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  if (isLoggedIn()) {
    const equippedMap: Record<string, boolean> = {};
    for (const cat of ["hat", "glasses", "cape", "neckwear"]) {
      const id = state.equipped[cat];
      if (id) equippedMap[id] = true;
    }
    syncAccessories(state.owned, equippedMap);
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

export function loadServerData(serverAccessories: Array<{ accessoryId: string; equipped: boolean }>): void {
  const newState = defaultState();
  for (const sa of serverAccessories) {
    newState.owned.push(sa.accessoryId);
    if (sa.equipped) {
      const acc = ACCESSORIES.find(a => a.id === sa.accessoryId);
      if (acc) {
        newState.equipped[acc.category] = sa.accessoryId;
      }
    }
  }
  state = newState;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
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
      gfx.fillRect(centerX - bodyWidth / 2 - 2, topY - 4, bodyWidth + 4, 4);
      gfx.fillRect(centerX - 8, topY - 18, 16, 14);
      gfx.lineStyle(1, 0x444444, 1);
      gfx.strokeRect(centerX - 8, topY - 18, 16, 14);
      gfx.fillStyle(0xcc8800, 1);
      gfx.fillRect(centerX - 7, topY - 8, 14, 2);
      break;
    }
    case "crown": {
      gfx.fillStyle(0xffd700, 1);
      gfx.fillRect(centerX - 10, topY - 6, 20, 6);
      gfx.fillTriangle(centerX - 10, topY - 6, centerX - 10, topY - 14, centerX - 4, topY - 6);
      gfx.fillTriangle(centerX - 3, topY - 6, centerX, topY - 16, centerX + 3, topY - 6);
      gfx.fillTriangle(centerX + 10, topY - 6, centerX + 10, topY - 14, centerX + 4, topY - 6);
      gfx.fillStyle(0xff0000, 1);
      gfx.fillCircle(centerX, topY - 10, 2);
      break;
    }
    case "partyhat": {
      gfx.fillStyle(0xff4488, 1);
      gfx.fillTriangle(centerX - 10, topY, centerX, topY - 20, centerX + 10, topY);
      gfx.fillStyle(0xffdd00, 1);
      gfx.fillCircle(centerX, topY - 20, 3);
      gfx.fillStyle(0x44ccff, 1);
      gfx.fillRect(centerX - 6, topY - 8, 3, 3);
      gfx.fillStyle(0x44ff44, 1);
      gfx.fillRect(centerX + 3, topY - 14, 3, 3);
      break;
    }
    case "cowboy": {
      gfx.fillStyle(0x8b4513, 1);
      gfx.fillRect(centerX - bodyWidth / 2 - 4, topY - 3, bodyWidth + 8, 4);
      gfx.fillRect(centerX - 9, topY - 12, 18, 9);
      gfx.fillStyle(0xa0522d, 1);
      gfx.fillRect(centerX - 9, topY - 12, 18, 3);
      break;
    }
    case "beanie": {
      gfx.fillStyle(0x3366cc, 1);
      gfx.fillRect(centerX - bodyWidth / 2, topY - 8, bodyWidth, 9);
      gfx.fillStyle(0x4488ee, 1);
      gfx.fillRect(centerX - bodyWidth / 2, topY - 8, bodyWidth, 3);
      gfx.fillStyle(0xff4444, 1);
      gfx.fillCircle(centerX, topY - 10, 3);
      break;
    }
    case "halo": {
      gfx.lineStyle(2, 0xffdd44, 0.9);
      gfx.strokeEllipse(centerX, topY - 8, 24, 8);
      break;
    }
    case "headband": {
      gfx.fillStyle(0xcc3333, 0.9);
      gfx.fillRect(centerX - bodyWidth / 2 - 1, topY - 4, bodyWidth + 2, 5);
      gfx.fillStyle(0xeeee44, 1);
      gfx.fillRect(centerX - 3, topY - 4, 6, 5);
      break;
    }
    case "sunglasses": {
      gfx.fillStyle(0x111111, 1);
      gfx.fillRect(centerX - EYE.SPACING - 5, eyeY - 3, 10, 7);
      gfx.fillRect(centerX + EYE.SPACING - 5, eyeY - 3, 10, 7);
      gfx.lineStyle(1, 0x333333, 1);
      gfx.lineBetween(centerX - EYE.SPACING + 5, eyeY, centerX + EYE.SPACING - 5, eyeY);
      break;
    }
    case "nerdglasses": {
      gfx.lineStyle(2, 0x333333, 1);
      gfx.strokeCircle(centerX - EYE.SPACING, eyeY, 5);
      gfx.strokeCircle(centerX + EYE.SPACING, eyeY, 5);
      gfx.lineBetween(centerX - EYE.SPACING + 5, eyeY, centerX + EYE.SPACING - 5, eyeY);
      break;
    }
    case "monocle": {
      gfx.lineStyle(2, 0xccaa00, 1);
      gfx.strokeCircle(centerX + EYE.SPACING, eyeY, 6);
      gfx.lineStyle(1, 0xccaa00, 0.6);
      gfx.lineBetween(centerX + EYE.SPACING, eyeY + 6, centerX + EYE.SPACING - 4, centerY + bodyHeight / 2);
      break;
    }
    case "cape": {
      gfx.fillStyle(0xcc0000, 0.85);
      gfx.fillRect(centerX - bodyWidth / 2 - 6, topY + 4, 6, bodyHeight - 4);
      gfx.fillTriangle(
        centerX - bodyWidth / 2 - 6, centerY + bodyHeight / 2,
        centerX - bodyWidth / 2 - 10, centerY + bodyHeight / 2 + 8,
        centerX - bodyWidth / 2, centerY + bodyHeight / 2
      );
      break;
    }
    case "scarf": {
      const neckY = centerY;
      gfx.fillStyle(0x2266aa, 0.9);
      gfx.fillRect(centerX - bodyWidth / 2 - 2, neckY - 3, bodyWidth + 4, 8);
      gfx.fillRect(centerX + bodyWidth / 2 - 3, neckY + 5, 6, 14);
      gfx.fillStyle(0x3388cc, 1);
      gfx.fillRect(centerX + bodyWidth / 2 - 2, neckY + 5, 4, 3);
      gfx.fillRect(centerX + bodyWidth / 2 - 2, neckY + 11, 4, 3);
      gfx.fillRect(centerX + bodyWidth / 2 - 4, neckY + 17, 8, 3);
      break;
    }
    case "bowtie": {
      const bowY = centerY + bodyHeight * 0.15;
      gfx.fillStyle(0xff2244, 1);
      gfx.fillTriangle(centerX, bowY, centerX - 6, bowY - 4, centerX - 6, bowY + 4);
      gfx.fillTriangle(centerX, bowY, centerX + 6, bowY - 4, centerX + 6, bowY + 4);
      gfx.fillStyle(0xcc1133, 1);
      gfx.fillCircle(centerX, bowY, 2);
      break;
    }
    case "medal": {
      const medalY = centerY + bodyHeight * 0.1;
      gfx.lineStyle(1, 0x4444ff, 0.8);
      gfx.lineBetween(centerX, topY + 4, centerX, medalY);
      gfx.fillStyle(0xffd700, 1);
      gfx.fillCircle(centerX, medalY + 4, 5);
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillCircle(centerX, medalY + 4, 3);
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
}
