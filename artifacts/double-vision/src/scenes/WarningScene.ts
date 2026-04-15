import Phaser from "phaser";
import { WORLDS } from "../worlds/WorldConfig";
import type { GameMode } from "./ModeSelectScene";
import { onlineManager } from "../OnlineMultiplayerManager";

interface HazardEntry {
  name: string;
  desc: string;
  drawPreview: (gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) => void;
}

function getHazards(worldIndex: number): HazardEntry[] {
  const world = WORLDS[worldIndex];
  switch (worldIndex) {
    case 0:
      return [
        {
          name: "Lava Block",
          desc: "Instant Kill",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(world.killBlockColor, 0.85);
            gfx.fillRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
            gfx.fillStyle(0xff4400, 0.5);
            gfx.fillEllipse(cx, cy, s - 4, s * 0.25);
            for (let i = 0; i < 3; i++) {
              const bx = cx - s * 0.3 + i * s * 0.3;
              const by = cy - s * 0.05 + (i % 2) * s * 0.05;
              gfx.fillStyle(i % 2 === 0 ? 0xffdd00 : 0xffee55, 0.8);
              gfx.fillCircle(bx, by, 1.5);
            }
          },
        },
        {
          name: "Lava Spray",
          desc: "Hazard",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(0xaa0000, 0.7);
            gfx.fillEllipse(cx, cy + s * 0.3, s * 0.5, s * 0.25);
            gfx.fillStyle(0xcc2200, 0.5);
            gfx.fillEllipse(cx, cy + s * 0.32, s * 0.35, s * 0.15);
            gfx.fillStyle(0xff4400, 0.8);
            gfx.fillRect(cx - 2, cy - s * 0.35, 4, s * 0.5);
            gfx.fillStyle(0xffaa00, 0.6);
            gfx.fillCircle(cx, cy - s * 0.3, 3);
            gfx.fillCircle(cx - 3, cy - s * 0.1, 2);
            gfx.fillCircle(cx + 3, cy, 2);
          },
        },
        {
          name: "Landslide",
          desc: "Movement",
          drawPreview: (gfx, cx, cy, s) => {
            const colors = [0x8b6340, 0x6b4226, 0x3d2010];
            gfx.fillStyle(colors[1], 1);
            gfx.fillRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
            gfx.lineStyle(1.5, 0x4a2e18, 1);
            gfx.strokeRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
            for (let i = 0; i < 3; i++) {
              const ax = cx - s * 0.25 + i * s * 0.25;
              gfx.fillStyle(0xffffff, 0.4);
              gfx.fillTriangle(ax, cy, ax + 4, cy, ax + 2, cy - 4);
            }
          },
        },
        {
          name: "Duck Cave",
          desc: "Obstacle",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(0x2a0e0e, 1);
            gfx.fillRect(cx - s / 2, cy - s * 0.2, s, s * 0.4);
            gfx.lineStyle(1.5, 0x1a0808, 0.9);
            gfx.strokeRect(cx - s / 2, cy - s * 0.2, s, s * 0.4);
            gfx.fillStyle(0x1a0808, 1);
            gfx.fillRect(cx - s / 2, cy - s * 0.2, s, 3);
            gfx.fillStyle(0x3a1818, 0.8);
            gfx.fillRect(cx - s / 2, cy + s * 0.2 - 3, s, 3);
            for (let i = 0; i < 4; i++) {
              const jx = cx - s * 0.4 + i * s * 0.27;
              gfx.fillStyle(0x2a0e0e, 1);
              gfx.fillTriangle(jx - 3, cy - s * 0.2, jx, cy - s * 0.2 - 5, jx + 3, cy - s * 0.2);
            }
          },
        },
      ];
    case 1:
      return [
        {
          name: "Water Block",
          desc: "Instant Kill",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(0x555555, 1);
            const finW = s * 0.5;
            gfx.fillTriangle(cx - finW * 0.15, cy + s * 0.2, cx, cy - s * 0.3, cx + finW * 0.85, cy + s * 0.2);
            gfx.fillStyle(0x444444, 1);
            gfx.fillTriangle(cx, cy - s * 0.3, cx + finW * 0.85, cy + s * 0.2, cx + finW * 0.3, cy + s * 0.2);
            gfx.fillStyle(0xffffff, 0.9);
            gfx.fillTriangle(cx - finW * 0.05, cy - s * 0.15, cx, cy - s * 0.3, cx + finW * 0.2, cy - s * 0.15);
          },
        },
        {
          name: "Sea Urchin",
          desc: "Hazard",
          drawPreview: (gfx, cx, cy, s) => {
            const r = s * 0.2;
            const spikeLen = s * 0.15;
            gfx.fillStyle(world.spikeColor, 1);
            gfx.fillCircle(cx, cy, r);
            gfx.fillStyle(0x1a0a2e, 1);
            gfx.fillCircle(cx, cy, r - 2);
            gfx.lineStyle(1.5, 0x3d1f56, 1);
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const x1 = cx + Math.cos(angle) * r;
              const y1 = cy + Math.sin(angle) * r;
              const x2 = cx + Math.cos(angle) * (r + spikeLen);
              const y2 = cy + Math.sin(angle) * (r + spikeLen);
              gfx.lineBetween(x1, y1, x2, y2);
            }
          },
        },
        {
          name: "Wave",
          desc: "Movement",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.lineStyle(2.5, world.movementColor, 1);
            gfx.beginPath();
            for (let i = 0; i <= 20; i++) {
              const t = i / 20;
              const wx = cx - s * 0.4 + t * s * 0.8;
              const wy = cy + Math.sin(t * Math.PI * 2) * s * 0.15;
              if (i === 0) gfx.moveTo(wx, wy);
              else gfx.lineTo(wx, wy);
            }
            gfx.strokePath();
            gfx.lineStyle(1.5, 0x66ccee, 0.5);
            gfx.beginPath();
            for (let i = 0; i <= 20; i++) {
              const t = i / 20;
              const wx = cx - s * 0.35 + t * s * 0.7;
              const wy = cy + s * 0.08 + Math.sin(t * Math.PI * 2 + 1) * s * 0.1;
              if (i === 0) gfx.moveTo(wx, wy);
              else gfx.lineTo(wx, wy);
            }
            gfx.strokePath();
          },
        },
      ];
    case 2:
      return [
        {
          name: "Quicksand",
          desc: "Instant Kill",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(0xc9a84c, 1);
            gfx.fillRect(cx - s / 2, cy - s / 2, s, s);
            gfx.fillStyle(0xb8963e, 0.5);
            gfx.fillRect(cx - s / 2, cy - s / 2, s, s * 0.35);
            gfx.fillStyle(0xd4b464, 0.4);
            gfx.fillRect(cx - s / 2, cy + s * 0.1, s, s * 0.4);
            for (let i = 0; i < 6; i++) {
              const dx = cx - s * 0.35 + (i % 3) * s * 0.3;
              const dy = cy - s * 0.3 + Math.floor(i / 3) * s * 0.4;
              gfx.fillStyle(i % 2 === 0 ? 0xa07830 : 0xd4a84a, 0.6);
              gfx.fillCircle(dx, dy, 1.2);
            }
          },
        },
        {
          name: "Poison Flower",
          desc: "Hazard",
          drawPreview: (gfx, cx, cy, s) => {
            const petalColors = [0x9b30ff, 0xff1493, 0xffdd00, 0xcc22cc, 0xff69b4];
            const petalR = s * 0.18;
            for (let i = 0; i < 5; i++) {
              const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
              const px = cx + Math.cos(angle) * s * 0.15;
              const py = cy - s * 0.1 + Math.sin(angle) * s * 0.15;
              gfx.fillStyle(petalColors[i], 0.9);
              gfx.fillEllipse(px, py, petalR, petalR * 1.4);
            }
            gfx.fillStyle(0xffff00, 1);
            gfx.fillCircle(cx, cy - s * 0.1, 3);
            gfx.fillStyle(0x228b22, 1);
            gfx.fillRect(cx - 1, cy + s * 0.1, 2, s * 0.25);
          },
        },
        {
          name: "Vine",
          desc: "Movement",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.lineStyle(2, 0x228b22, 1);
            gfx.beginPath();
            gfx.moveTo(cx, cy - s * 0.4);
            for (let i = 1; i <= 8; i++) {
              const t = i / 8;
              const vx = cx + Math.sin(t * Math.PI * 2) * s * 0.12;
              const vy = cy - s * 0.4 + t * s * 0.8;
              gfx.lineTo(vx, vy);
            }
            gfx.strokePath();
            gfx.fillStyle(0x2eaa2e, 0.9);
            gfx.fillEllipse(cx + s * 0.15, cy - s * 0.1, s * 0.2, s * 0.08);
            gfx.fillEllipse(cx - s * 0.12, cy + s * 0.15, s * 0.18, s * 0.07);
            gfx.fillStyle(0x006600, 1);
            gfx.fillCircle(cx, cy - s * 0.4, 3);
          },
        },
      ];
    case 3:
      return [
        {
          name: "Barbed Wire",
          desc: "Hazard",
          drawPreview: (gfx, cx, cy, s) => {
            const wireColor = world.spikeColor;
            const wireTint = Phaser.Display.Color.IntegerToColor(wireColor).brighten(20).color;
            gfx.fillStyle(wireColor, 1);
            gfx.fillRect(cx - s * 0.4, cy - 2, s * 0.8, 4);
            gfx.lineStyle(1, wireTint, 1);
            gfx.strokeRect(cx - s * 0.4, cy - 2, s * 0.8, 4);
            for (let i = 0; i < 4; i++) {
              const bx = cx - s * 0.3 + i * s * 0.2;
              gfx.fillStyle(wireTint, 1);
              gfx.fillTriangle(bx, cy - 6, bx - 2, cy - 2, bx + 2, cy - 2);
              gfx.fillTriangle(bx, cy + 6, bx - 2, cy + 2, bx + 2, cy + 2);
            }
          },
        },
        {
          name: "Trench",
          desc: "Movement",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(world.movementColor, 1);
            gfx.fillRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
            gfx.lineStyle(1.5, 0x333333, 1);
            gfx.strokeRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
            gfx.fillStyle(0x4a2a10, 1);
            gfx.fillRect(cx - s / 2 + 2, cy - s * 0.15 + 2, s - 4, 4);
            gfx.fillStyle(0x3a1a08, 1);
            for (let i = 0; i < 3; i++) {
              const tx = cx - s * 0.35 + i * s * 0.3;
              gfx.fillRect(tx, cy + s * 0.15 - 4, s * 0.2, 3);
            }
          },
        },
        {
          name: "Bullets",
          desc: "Projectile",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(0xdaa520, 1);
            gfx.fillRect(cx - s * 0.15, cy - 2.5, s * 0.3, 5);
            gfx.lineStyle(1, 0xb8860b, 1);
            gfx.strokeRect(cx - s * 0.15, cy - 2.5, s * 0.3, 5);
            gfx.fillStyle(0xffd700, 1);
            gfx.fillTriangle(cx - s * 0.15 - 4, cy, cx - s * 0.15, cy - 2.5, cx - s * 0.15, cy + 2.5);
            gfx.fillStyle(0xb8860b, 1);
            gfx.fillRect(cx + s * 0.15, cy - 2.5, 2, 5);
            gfx.fillStyle(0xdaa520, 0.5);
            gfx.fillRect(cx + s * 0.25, cy - 1.5, s * 0.12, 3);
            gfx.fillRect(cx + s * 0.3, cy + 1, s * 0.08, 2);
          },
        },
      ];
    default: {
      const w = WORLDS[worldIndex];
      if (!w) return [];
      return [
        {
          name: w.killBlockName,
          desc: "Instant Kill",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(w.killBlockColor, 1);
            gfx.fillRect(cx - s / 2, cy - s / 2, s, s);
            gfx.lineStyle(1, 0xffffff, 0.2);
            gfx.strokeRect(cx - s / 2, cy - s / 2, s, s);
          },
        },
        {
          name: w.spikeName,
          desc: "Hazard",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(w.spikeColor, 1);
            gfx.fillTriangle(cx - s * 0.3, cy + s * 0.3, cx, cy - s * 0.3, cx + s * 0.3, cy + s * 0.3);
          },
        },
        {
          name: w.movementName,
          desc: "Movement",
          drawPreview: (gfx, cx, cy, s) => {
            gfx.fillStyle(w.movementColor, 1);
            gfx.fillRect(cx - s / 2, cy - s * 0.15, s, s * 0.3);
          },
        },
      ];
    }
  }
}

export class WarningScene extends Phaser.Scene {
  constructor() {
    super({ key: "WarningScene" });
  }

  create(data: { worldIndex: number; deaths: number; startTime: number; gameMode: GameMode; levelSeed?: number }) {
    const { width, height } = this.scale;
    const world = WORLDS[data.worldIndex];

    this.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(world.bgColor).rgba);

    const homeBtn = this.add.text(width - 16, 16, "[ Home ]", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#cccccc",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    homeBtn.on("pointerover", () => homeBtn.setColor("#ffffff"));
    homeBtn.on("pointerout", () => homeBtn.setColor("#cccccc"));
    homeBtn.on("pointerdown", () => this.scene.start("TitleScene", { gameMode: data.gameMode }));

    const worldNum = this.add.text(width / 2, height * 0.15, `WORLD ${data.worldIndex + 1}`, {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#aaaaaa",
    });
    worldNum.setOrigin(0.5);

    const title = this.add.text(width / 2, height * 0.28, world.name.toUpperCase(), {
      fontSize: "42px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const hazards = getHazards(data.worldIndex);
    const count = hazards.length;
    const rowHeight = count > 3 ? 36 : 48;
    const previewSize = count > 3 ? 28 : 32;
    const nameFontSize = count > 3 ? "13px" : "16px";
    const descFontSize = count > 3 ? "10px" : "12px";
    const totalHeight = count * rowHeight;
    const startY = height * 0.42 + ((height * 0.38 - totalHeight) / 2);

    hazards.forEach((h, i) => {
      const y = startY + i * rowHeight;
      const previewX = width / 2 - 128;

      const gfx = this.add.graphics();
      h.drawPreview(gfx, previewX, y, previewSize);

      this.add.text(width / 2 - 100, y, h.name, {
        fontSize: nameFontSize,
        fontFamily: "monospace",
        color: "#ffffff",
      }).setOrigin(0, 0.5);
      this.add.text(width / 2 + 80, y, `[${h.desc}]`, {
        fontSize: descFontSize,
        fontFamily: "monospace",
        color: "#888888",
      }).setOrigin(0, 0.5);
    });

    const isOnlineGuest = data.gameMode === "online" && onlineManager.role === "guest";
    const isOnlineHost = data.gameMode === "online" && onlineManager.role === "host";

    const promptText = isOnlineGuest
      ? "Waiting for host to start..."
      : "Press ENTER to continue";

    const prompt = this.add.text(width / 2, height * 0.85, promptText, {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#ffffff",
    });
    prompt.setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    if (isOnlineGuest) {
      onlineManager.removeAllListeners();
      onlineManager.on("remote_start_level", () => {
        this.scene.start("GameScene", data);
      });
      onlineManager.on("partner_disconnected", () => {
        onlineManager.disconnect();
        this.scene.start("ModeSelectScene");
      });
      onlineManager.on("disconnected", () => {
        onlineManager.disconnect();
        this.scene.start("ModeSelectScene");
      });
    } else {
      this.input.keyboard!.once("keydown-ENTER", () => {
        if (isOnlineHost) {
          onlineManager.sendStartLevel();
        }
        this.scene.start("GameScene", data);
      });
    }
  }
}
