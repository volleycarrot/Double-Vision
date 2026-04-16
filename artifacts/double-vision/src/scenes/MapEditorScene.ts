import Phaser from "phaser";
import { TILE, LEVEL_HEIGHT } from "../worlds/WorldConfig";
import type { LevelTile } from "../worlds/LevelGenerator";
import { apiRequest, isLoggedIn } from "../AuthManager";
import { recordLevelCreated } from "../StatsManager";
import { attachUnlockToast } from "../UnlockToast";
import type { GameMode } from "./ModeSelectScene";

type TileType = LevelTile["type"];
type Direction = "up" | "down" | "left" | "right";

interface PaletteTile {
  type: TileType;
  label: string;
  color: number;
  dir?: Direction;
}

const PALETTE: PaletteTile[] = [
  { type: "ground", label: "Ground", color: 0x3a3a3a },
  { type: "platform", label: "Platform", color: 0x4a4a4a },
  { type: "kill", label: "Kill", color: 0xff8800 },
  { type: "spike", label: "Spike↑", color: 0xdd0000, dir: "up" },
  { type: "spike", label: "Spike↓", color: 0xdd0000, dir: "down" },
  { type: "spike", label: "Spike←", color: 0xdd0000, dir: "left" },
  { type: "spike", label: "Spike→", color: 0xdd0000, dir: "right" },
  { type: "movement", label: "Belt→", color: 0x6b4226, dir: "right" },
  { type: "movement", label: "Belt←", color: 0x6b4226, dir: "left" },
  { type: "checkpoint", label: "Flag", color: 0xffcc00 },
];

const ERASER = "eraser" as const;

const BG_COLORS = [
  "#1a1a2e", "#4a0000", "#87ceeb", "#0d2b0d", "#2a2a2a",
  "#1a0033", "#003322", "#2a1a00", "#000022", "#330011",
];

const BLOCK_COLORS = [
  "#3a3a3a", "#3a1212", "#d2b48c", "#3b5e2b", "#555555",
  "#2a2a5a", "#1a3a2a", "#5a3a1a", "#4a2a4a", "#1a4a4a",
];

const PLATFORM_COLORS = [
  "#4a4a4a", "#e85a1a", "#f0d060", "#4a2a0a", "#666666",
  "#3a3a7a", "#2a5a3a", "#7a4a2a", "#6a3a6a", "#2a6a6a",
];

const EDITOR_MAX_COLS = 50;
const TOOLBAR_HEIGHT = 50;
const BOTTOM_PANEL_HEIGHT = 80;
const PANEL_WIDTH = 0;

export class MapEditorScene extends Phaser.Scene {
  private grid: Map<string, { type: TileType; dir?: Direction }> = new Map();
  private selectedPalette: PaletteTile | { type: typeof ERASER; label: string; color: number } = PALETTE[0];
  private bgColor = "#1a1a2e";
  private groundColor = "#3a3a3a";
  private platformColor = "#4a4a4a";
  private gameMode: GameMode = "single";
  private mapId: number | null = null;
  private mapName = "Untitled Map";
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private uiContainer!: Phaser.GameObjects.Container;
  private isDrawing = false;
  private lastDrawCol = -1;
  private lastDrawRow = -1;
  private scrollX = 0;
  private paletteButtons: Phaser.GameObjects.Rectangle[] = [];
  private paletteIndicators: Phaser.GameObjects.Rectangle[] = [];
  private saveStatus: Phaser.GameObjects.Text | null = null;
  private colorPickerObjects: Phaser.GameObjects.GameObject[] = [];
  private bgColorIndex = 0;
  private groundColorIndex = 0;
  private platformColorIndex = 0;

  constructor() {
    super({ key: "MapEditorScene" });
  }

  create(data: { gameMode?: GameMode; mapId?: number; mapName?: string; tileData?: string; bgColor?: string; groundColor?: string; platformColor?: string }) {
    this.gameMode = data?.gameMode || "single";
    this.mapId = data?.mapId ?? null;
    this.mapName = data?.mapName || "Untitled Map";
    this.bgColor = data?.bgColor || "#1a1a2e";
    this.groundColor = data?.groundColor || "#3a3a3a";
    this.platformColor = data?.platformColor || "#4a4a4a";
    this.grid = new Map();
    this.selectedPalette = PALETTE[0];
    this.scrollX = 0;
    this.isDrawing = false;
    this.paletteButtons = [];
    this.paletteIndicators = [];
    this.colorPickerObjects = [];
    this.saveStatus = null;

    attachUnlockToast(this);

    this.bgColorIndex = BG_COLORS.indexOf(this.bgColor);
    if (this.bgColorIndex < 0) this.bgColorIndex = 0;
    this.groundColorIndex = BLOCK_COLORS.indexOf(this.groundColor);
    if (this.groundColorIndex < 0) this.groundColorIndex = 0;
    this.platformColorIndex = PLATFORM_COLORS.indexOf(this.platformColor);
    if (this.platformColorIndex < 0) this.platformColorIndex = 0;

    if (data?.tileData) {
      try {
        const tiles: LevelTile[] = JSON.parse(data.tileData);
        for (const tile of tiles) {
          const w = tile.width || 1;
          for (let dx = 0; dx < w; dx++) {
            this.grid.set(`${tile.x + dx},${tile.y}`, { type: tile.type, dir: tile.dir });
          }
        }
      } catch {}
    }

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(this.bgColor);

    this.tileGraphics = this.add.graphics();
    this.gridGraphics = this.add.graphics();

    this.drawGrid();
    this.drawTiles();

    this.buildToolbar();
    this.buildColorPickers();
    this.buildTutorial();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < TOOLBAR_HEIGHT) return;
      if (pointer.y > height - BOTTOM_PANEL_HEIGHT) return;
      this.isDrawing = true;
      this.lastDrawCol = -1;
      this.lastDrawRow = -1;
      this.handleDraw(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isDrawing) return;
      if (pointer.y < TOOLBAR_HEIGHT) return;
      if (pointer.y > height - BOTTOM_PANEL_HEIGHT) return;
      this.handleDraw(pointer);
    });

    this.input.on("pointerup", () => {
      this.isDrawing = false;
    });

    const leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const aKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const dKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.events.on("update", () => {
      const scrollSpeed = 8;
      if (leftKey.isDown || aKey.isDown) {
        this.scrollX = Math.max(0, this.scrollX - scrollSpeed);
        this.drawGrid();
        this.drawTiles();
      }
      if (rightKey.isDown || dKey.isDown) {
        const maxScroll = EDITOR_MAX_COLS * TILE - this.scale.width;
        this.scrollX = Math.min(maxScroll, this.scrollX + scrollSpeed);
        this.drawGrid();
        this.drawTiles();
      }
    });

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on("down", () => {
      this.scene.start("TitleScene", { gameMode: this.gameMode });
    });
  }

  private handleDraw(pointer: Phaser.Input.Pointer) {
    const worldX = pointer.x + this.scrollX;
    const worldY = pointer.y - TOOLBAR_HEIGHT;
    const col = Math.floor(worldX / TILE);
    const row = Math.floor(worldY / TILE);

    if (col < 0 || col >= EDITOR_MAX_COLS || row < 0 || row >= LEVEL_HEIGHT) return;
    if (col === this.lastDrawCol && row === this.lastDrawRow) return;
    this.lastDrawCol = col;
    this.lastDrawRow = row;

    const key = `${col},${row}`;
    if (this.selectedPalette.type === ERASER) {
      this.grid.delete(key);
    } else {
      const sel = this.selectedPalette as PaletteTile;
      this.grid.set(key, { type: sel.type, dir: sel.dir });
    }

    this.drawTiles();
  }

  private drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x333333, 0.3);

    const { width, height } = this.scale;
    const viewH = height - TOOLBAR_HEIGHT - BOTTOM_PANEL_HEIGHT;
    const startCol = Math.floor(this.scrollX / TILE);
    const endCol = Math.min(EDITOR_MAX_COLS, startCol + Math.ceil(width / TILE) + 1);

    for (let col = startCol; col <= endCol; col++) {
      const x = col * TILE - this.scrollX;
      this.gridGraphics.lineBetween(x, TOOLBAR_HEIGHT, x, TOOLBAR_HEIGHT + viewH);
    }
    for (let row = 0; row <= LEVEL_HEIGHT; row++) {
      const y = row * TILE + TOOLBAR_HEIGHT;
      if (y > TOOLBAR_HEIGHT + viewH) break;
      this.gridGraphics.lineBetween(0, y, width, y);
    }
  }

  private drawTiles() {
    this.tileGraphics.clear();

    const { width } = this.scale;
    const startCol = Math.floor(this.scrollX / TILE);
    const endCol = Math.min(EDITOR_MAX_COLS, startCol + Math.ceil(width / TILE) + 2);

    const colorMap: Record<TileType, number> = {
      ground: parseInt(this.groundColor.replace("#", ""), 16),
      platform: parseInt(this.platformColor.replace("#", ""), 16),
      kill: 0xff8800,
      spike: 0xdd0000,
      movement: 0x6b4226,
      checkpoint: 0xffcc00,
      cave: 0x222222,
      secret: 0x444488,
    };

    for (const [key, val] of this.grid.entries()) {
      const [cs, rs] = key.split(",");
      const col = parseInt(cs, 10);
      const row = parseInt(rs, 10);
      const type = val.type;
      const dir = val.dir;

      if (col < startCol - 1 || col > endCol) continue;

      const x = col * TILE - this.scrollX;
      const y = row * TILE + TOOLBAR_HEIGHT;

      if (type === "spike") {
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        const h = TILE / 2 - 2;
        this.tileGraphics.fillStyle(0xdd0000, 1);
        if (dir === "down") {
          this.tileGraphics.fillTriangle(cx - h, cy - h, cx + h, cy - h, cx, cy + h);
        } else if (dir === "left") {
          this.tileGraphics.fillTriangle(cx + h, cy - h, cx + h, cy + h, cx - h, cy);
        } else if (dir === "right") {
          this.tileGraphics.fillTriangle(cx - h, cy - h, cx - h, cy + h, cx + h, cy);
        } else {
          this.tileGraphics.fillTriangle(cx - h, cy + h, cx + h, cy + h, cx, cy - h);
        }
      } else {
        this.tileGraphics.fillStyle(colorMap[type] || 0xffffff, 1);
        this.tileGraphics.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }

      if (type === "checkpoint") {
        this.tileGraphics.fillStyle(0x000000, 0.3);
        this.tileGraphics.fillRect(x + TILE / 2 - 2, y + 4, 4, TILE - 8);
        this.tileGraphics.fillStyle(0xff0000, 0.8);
        this.tileGraphics.fillTriangle(x + TILE / 2 + 2, y + 4, x + TILE / 2 + 12, y + 10, x + TILE / 2 + 2, y + 16);
      } else if (type === "kill") {
        this.tileGraphics.lineStyle(2, 0xffff00, 0.4);
        this.tileGraphics.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      } else if (type === "movement") {
        this.tileGraphics.fillStyle(0xffcc66, 0.95);
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        if (dir === "left") {
          this.tileGraphics.fillTriangle(cx + 5, cy - 5, cx + 5, cy + 5, cx - 5, cy);
        } else {
          this.tileGraphics.fillTriangle(cx - 5, cy - 5, cx - 5, cy + 5, cx + 5, cy);
        }
      }
    }
  }

  private buildToolbar() {
    const { width } = this.scale;

    const toolbarBg = this.add.rectangle(width / 2, TOOLBAR_HEIGHT / 2, width, TOOLBAR_HEIGHT, 0x111122, 0.95);
    toolbarBg.setDepth(10);

    const allItems: (PaletteTile | { type: typeof ERASER; label: string; color: number })[] = [
      ...PALETTE,
      { type: ERASER, label: "Eraser", color: 0x880000 },
    ];

    const btnSize = 32;
    const btnGap = 6;
    const totalPaletteW = allItems.length * (btnSize + btnGap) - btnGap;
    const startX = (width / 2) - (totalPaletteW / 2);

    const isSelected = (item: PaletteTile | { type: typeof ERASER }) => {
      if (item.type === ERASER) return this.selectedPalette.type === ERASER;
      const cur = this.selectedPalette as PaletteTile;
      const palItem = item as PaletteTile;
      return cur.type === palItem.type && cur.dir === palItem.dir;
    };

    allItems.forEach((item, i) => {
      const bx = startX + i * (btnSize + btnGap) + btnSize / 2;
      const by = TOOLBAR_HEIGHT / 2 - 4;

      const indicator = this.add.rectangle(bx, by, btnSize + 4, btnSize + 4, 0xffffff, isSelected(item) ? 1 : 0);
      indicator.setDepth(11);
      this.paletteIndicators.push(indicator);

      const btn = this.add.rectangle(bx, by, btnSize, btnSize, item.color, 1);
      btn.setStrokeStyle(1, 0x666666);
      btn.setInteractive({ useHandCursor: true });
      btn.setDepth(12);
      this.paletteButtons.push(btn);

      const dir = (item as PaletteTile).dir;

      if (item.type === "spike") {
        const g = this.add.graphics().setDepth(13);
        g.fillStyle(0xffffff, 0.6);
        if (dir === "down") {
          g.fillTriangle(bx - 10, by - 10, bx + 10, by - 10, bx, by + 10);
        } else if (dir === "left") {
          g.fillTriangle(bx + 10, by - 10, bx + 10, by + 10, bx - 10, by);
        } else if (dir === "right") {
          g.fillTriangle(bx - 10, by - 10, bx - 10, by + 10, bx + 10, by);
        } else {
          g.fillTriangle(bx - 10, by + 10, bx, by - 10, bx + 10, by + 10);
        }
      } else if (item.type === "kill") {
        const g = this.add.graphics().setDepth(13);
        g.lineStyle(2, 0xffff00, 0.6);
        g.strokeRect(bx - 8, by - 8, 16, 16);
        g.fillStyle(0xff4400, 0.4);
        g.fillRect(bx - 5, by - 5, 10, 10);
      } else if (item.type === "checkpoint") {
        const g = this.add.graphics().setDepth(13);
        g.fillStyle(0x000000, 0.5);
        g.fillRect(bx - 2, by - 10, 4, 20);
        g.fillStyle(0xff0000, 0.9);
        g.fillTriangle(bx + 2, by - 10, bx + 12, by - 4, bx + 2, by);
      } else if (item.type === "movement") {
        const g = this.add.graphics().setDepth(13);
        g.fillStyle(0xffcc66, 1);
        if (dir === "left") {
          g.fillTriangle(bx + 7, by - 7, bx + 7, by + 7, bx - 7, by);
        } else {
          g.fillTriangle(bx - 7, by - 7, bx - 7, by + 7, bx + 7, by);
        }
      }

      const label = this.add.text(bx, by + btnSize / 2 + 3, item.label, {
        fontSize: "7px",
        fontFamily: "monospace",
        color: "#aaaaaa",
      }).setOrigin(0.5, 0).setDepth(12);

      btn.on("pointerdown", () => {
        this.selectedPalette = item;
        this.paletteIndicators.forEach((ind, j) => {
          ind.setFillStyle(0xffffff, j === i ? 1 : 0);
        });
      });
    });

    const backBtn = this.add.text(12, TOOLBAR_HEIGHT / 2, "< Back", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#cccccc",
      backgroundColor: "#222244",
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(12);

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#cccccc"));
    backBtn.on("pointerdown", () => {
      this.scene.start("TitleScene", { gameMode: this.gameMode });
    });

    const saveBtn = this.add.rectangle(width - 45, TOOLBAR_HEIGHT / 2 - 2, 70, 28, 0x00aa44, 1);
    saveBtn.setStrokeStyle(1, 0x00ff66);
    saveBtn.setInteractive({ useHandCursor: true });
    saveBtn.setDepth(12);

    const saveLabel = this.add.text(width - 45, TOOLBAR_HEIGHT / 2 - 2, "Save", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(13);

    saveBtn.on("pointerdown", () => this.saveMap());

    this.saveStatus = this.add.text(width - 45, TOOLBAR_HEIGHT / 2 + 16, "", {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#88ff88",
    }).setOrigin(0.5).setDepth(13);
  }

  private buildColorPickers() {
    this.colorPickerObjects.forEach(o => o.destroy());
    this.colorPickerObjects = [];

    const { width, height } = this.scale;
    const panelTop = height - BOTTOM_PANEL_HEIGHT;
    const swatchSize = 16;
    const gap = 3;

    const panelBg = this.add.rectangle(width / 2, panelTop + BOTTOM_PANEL_HEIGHT / 2, width, BOTTOM_PANEL_HEIGHT, 0x111122, 0.95).setDepth(10);
    this.colorPickerObjects.push(panelBg);

    const row1Y = panelTop + 12;
    const row2Y = panelTop + 32;
    const row3Y = panelTop + 52;
    const row4Y = panelTop + 72;

    const nameLabel = this.add.text(12, row1Y, `Map: ${this.mapName}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#cccccc",
    }).setOrigin(0, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    this.colorPickerObjects.push(nameLabel);

    nameLabel.on("pointerdown", () => {
      const newName = prompt("Map name:", this.mapName);
      if (newName && newName.trim().length > 0 && newName.trim().length <= 50) {
        this.mapName = newName.trim();
        nameLabel.setText(`Map: ${this.mapName}`);
      }
    });

    const scrollHint = this.add.text(width - 12, row1Y, "← → or A/D to scroll", {
      fontSize: "10px", fontFamily: "monospace", color: "#555566",
    }).setOrigin(1, 0.5).setDepth(11);
    this.colorPickerObjects.push(scrollHint);

    const labelWidth = 50;
    const buildRow = (label: string, colors: string[], selectedIdx: number, x: number, y: number, onSelect: (i: number, c: string) => void) => {
      const lbl = this.add.text(x, y, label, {
        fontSize: "10px", fontFamily: "monospace", color: "#888899",
      }).setOrigin(0, 0.5).setDepth(11);
      this.colorPickerObjects.push(lbl);

      const swatchStart = x + labelWidth;
      colors.forEach((c, i) => {
        const sx = swatchStart + i * (swatchSize + gap);
        const indicator = this.add.rectangle(sx, y, swatchSize + 3, swatchSize + 3, 0xffffff, i === selectedIdx ? 0.8 : 0).setDepth(11);
        this.colorPickerObjects.push(indicator);

        const swatch = this.add.rectangle(sx, y, swatchSize, swatchSize, parseInt(c.replace("#", ""), 16)).setDepth(12);
        swatch.setStrokeStyle(1, 0x555555);
        swatch.setInteractive({ useHandCursor: true });
        this.colorPickerObjects.push(swatch);

        swatch.on("pointerdown", () => onSelect(i, c));
      });
    };

    buildRow("BG:", BG_COLORS, this.bgColorIndex, 12, row2Y, (i, c) => {
      this.bgColorIndex = i;
      this.bgColor = c;
      this.cameras.main.setBackgroundColor(c);
      this.buildColorPickers();
    });

    buildRow("Block:", BLOCK_COLORS, this.groundColorIndex, 12, row3Y, (i, c) => {
      this.groundColorIndex = i;
      this.groundColor = c;
      this.drawTiles();
      this.buildColorPickers();
    });

    buildRow("Plat:", PLATFORM_COLORS, this.platformColorIndex, 12, row4Y, (i, c) => {
      this.platformColorIndex = i;
      this.platformColor = c;
      this.drawTiles();
      this.buildColorPickers();
    });
  }

  private buildTutorial() {
    const { width, height } = this.scale;
    const seenKey = "dv_editor_tutorial_seen";
    if (typeof localStorage !== "undefined" && localStorage.getItem(seenKey) === "1") return;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setDepth(100);
    overlay.setInteractive();

    const boxW = Math.min(420, width - 40);
    const boxH = 240;
    const boxX = width / 2;
    const boxY = height / 2;

    const box = this.add.rectangle(boxX, boxY, boxW, boxH, 0x1a1a2e, 1).setStrokeStyle(2, 0x4488ff).setDepth(101);

    const title = this.add.text(boxX, boxY - boxH / 2 + 18, "How to Build", {
      fontSize: "16px", fontFamily: "monospace", color: "#88ccff", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(102);

    const lines = [
      "• Pick a tile from the top toolbar",
      "• Click or drag in the grid to place it",
      "• Eraser removes tiles",
      "• Spike↑↓←→ and Belt→← set direction",
      "• ← → or A/D scrolls the level (50 wide)",
      "• Bottom panel: rename map and pick colors",
      "• Save button stores it to your account",
    ];
    const linesText = this.add.text(boxX, boxY - 30, lines.join("\n"), {
      fontSize: "12px", fontFamily: "monospace", color: "#dddddd", align: "left", lineSpacing: 4,
    }).setOrigin(0.5).setDepth(102);

    const btn = this.add.rectangle(boxX, boxY + boxH / 2 - 26, 120, 32, 0x00aa44).setStrokeStyle(1, 0x00ff66).setDepth(102).setInteractive({ useHandCursor: true });
    const btnLabel = this.add.text(boxX, boxY + boxH / 2 - 26, "Got it!", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5).setDepth(103);

    const dismiss = () => {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(seenKey, "1"); } catch {}
      overlay.destroy(); box.destroy(); title.destroy(); linesText.destroy(); btn.destroy(); btnLabel.destroy();
    };
    btn.on("pointerdown", dismiss);
    overlay.on("pointerdown", dismiss);
  }

  private exportTiles(): LevelTile[] {
    const tiles: LevelTile[] = [];
    const processed = new Set<string>();

    const sortedKeys = [...this.grid.keys()].sort((a, b) => {
      const [ax, ay] = a.split(",").map(Number);
      const [bx, by] = b.split(",").map(Number);
      return ay - by || ax - bx;
    });

    for (const key of sortedKeys) {
      if (processed.has(key)) continue;
      const cell = this.grid.get(key)!;
      const { type, dir } = cell;
      const [col, row] = key.split(",").map(Number);

      let w = 1;
      while (true) {
        const next = this.grid.get(`${col + w},${row}`);
        if (!next || processed.has(`${col + w},${row}`)) break;
        if (next.type !== type || next.dir !== dir) break;
        w++;
      }

      for (let dx = 0; dx < w; dx++) {
        processed.add(`${col + dx},${row}`);
      }

      const tile: LevelTile = { x: col, y: row, type };
      if (w > 1) tile.width = w;
      if (dir) tile.dir = dir;
      tiles.push(tile);
    }

    return tiles;
  }

  private async saveMap() {
    if (!isLoggedIn()) {
      if (this.saveStatus) this.saveStatus.setText("Log in to save").setColor("#ff4444");
      return;
    }

    const tiles = this.exportTiles();
    const tileData = JSON.stringify(tiles);

    if (this.saveStatus) this.saveStatus.setText("Saving...").setColor("#ffcc00");

    const parseError = async (res: Response): Promise<string> => {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const data = await res.json();
          if (data && typeof data.error === "string") return data.error;
        } catch {
          // fall through to status-based message
        }
      }
      if (res.status === 413) return "Map too large to save";
      if (res.status === 401 || res.status === 403) return "Log in to save";
      if (res.status === 404) return "Map not found";
      if (res.status === 429) return "Too many requests, try again";
      if (res.status >= 500 && res.status < 600) return "Server unavailable";
      return "Save failed, try again";
    };

    try {
      if (this.mapId) {
        const res = await apiRequest(`/user/maps/${this.mapId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: this.mapName,
            tileData,
            bgColor: this.bgColor,
            groundColor: this.groundColor,
            platformColor: this.platformColor,
          }),
        });
        if (res.ok) {
          if (this.saveStatus) this.saveStatus.setText("Saved!").setColor("#88ff88");
        } else {
          const msg = await parseError(res);
          if (this.saveStatus) this.saveStatus.setText(msg).setColor("#ff4444");
        }
      } else {
        const res = await apiRequest("/user/maps", {
          method: "POST",
          body: JSON.stringify({
            name: this.mapName,
            tileData,
            bgColor: this.bgColor,
            groundColor: this.groundColor,
            platformColor: this.platformColor,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          this.mapId = data.map.id;
          recordLevelCreated();
          if (this.saveStatus) this.saveStatus.setText("Saved!").setColor("#88ff88");
        } else {
          const msg = await parseError(res);
          if (this.saveStatus) this.saveStatus.setText(msg).setColor("#ff4444");
        }
      }
    } catch {
      if (this.saveStatus) this.saveStatus.setText("Network error").setColor("#ff4444");
    }

    this.time.delayedCall(3000, () => {
      if (this.saveStatus) this.saveStatus.setText("");
    });
  }
}
