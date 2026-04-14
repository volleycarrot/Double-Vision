import Phaser from "phaser";
import { WORLDS } from "../worlds/WorldConfig";

export class WarningScene extends Phaser.Scene {
  constructor() {
    super({ key: "WarningScene" });
  }

  create(data: { worldIndex: number; deaths: number; startTime: number }) {
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
    homeBtn.on("pointerdown", () => this.scene.start("TitleScene"));

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

    const hazardEmojis: string[][] = [
      ["🔥", "🌋", "🪨"],
      ["💧", "🦔", "🌊"],
      ["⏳", "🌿", "🌱"],
      ["💣", "🪡", "🪖"],
    ];

    const emojis = hazardEmojis[data.worldIndex] || ["⬛", "⬛", "⬛"];

    const hazards = [
      { name: world.killBlockName, color: world.killBlockColor, desc: "Instant Kill", emoji: emojis[0] },
      { name: world.spikeName, color: world.spikeColor, desc: "Hazard", emoji: emojis[1] },
      { name: world.movementName, color: world.movementColor, desc: "Movement", emoji: emojis[2] },
    ];

    const startY = height * 0.45;
    hazards.forEach((h, i) => {
      const y = startY + i * 50;
      this.add.text(width / 2 - 128, y, h.emoji, {
        fontSize: "22px",
      }).setOrigin(0.5, 0.5);
      this.add.text(width / 2 - 100, y, h.name, {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffffff",
      }).setOrigin(0, 0.5);
      this.add.text(width / 2 + 80, y, `[${h.desc}]`, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#888888",
      }).setOrigin(0, 0.5);
    });

    const prompt = this.add.text(width / 2, height * 0.85, "Press ENTER to continue", {
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

    this.input.keyboard!.once("keydown-ENTER", () => {
      this.scene.start("GameScene", data);
    });
  }
}
