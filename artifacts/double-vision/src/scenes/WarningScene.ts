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

    const hazards = [
      { name: world.killBlockName, color: world.killBlockColor, desc: "Instant Kill" },
      { name: world.spikeName, color: world.spikeColor, desc: "Hazard" },
      { name: world.movementName, color: world.movementColor, desc: "Movement" },
    ];

    const startY = height * 0.45;
    hazards.forEach((h, i) => {
      const y = startY + i * 50;
      this.add.rectangle(width / 2 - 120, y, 24, 24, h.color);
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
