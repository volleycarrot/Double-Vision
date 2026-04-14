import Phaser from "phaser";
import { WORLDS } from "../worlds/WorldConfig";
import { loadProgress } from "../ProgressManager";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    const { width, height } = this.scale;
    const progress = loadProgress();

    this.cameras.main.setBackgroundColor("#1a1a2e");

    const leftCenterX = width / 2 - 100;

    const title = this.add.text(leftCenterX, height * 0.15, "DOUBLE VISION", {
      fontSize: "48px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(leftCenterX, height * 0.25, "2-Player Co-op Platformer", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#aaaacc",
    });
    subtitle.setOrigin(0.5);

    const controlBg = this.add.rectangle(leftCenterX, height * 0.48, 360, 120, 0x16213e, 0.8);
    controlBg.setStrokeStyle(2, 0x0f3460);

    this.add.text(leftCenterX, height * 0.4, "CONTROLS", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(leftCenterX - 140, height * 0.46, "Player 1:", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffcc00",
    });
    this.add.text(leftCenterX + 20, height * 0.46, "W = Jump  |  S = Duck", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
    });

    this.add.text(leftCenterX - 140, height * 0.52, "Player 2:", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#00ccff",
    });
    this.add.text(leftCenterX + 20, height * 0.52, "\u2190 = Left  |  \u2192 = Right", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
    });

    const playerSquare = this.add.rectangle(leftCenterX, height * 0.68, 32, 32, 0x4488ff);
    playerSquare.setStrokeStyle(2, 0x66aaff);

    this.tweens.add({
      targets: playerSquare,
      y: height * 0.68 - 10,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const prompt = this.add.text(leftCenterX, height * 0.82, "Click a world to start!", {
      fontSize: "20px",
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

    const btnW = 180;
    const btnH = 56;
    const btnGap = 20;
    const galleryX = width - btnW - 16;
    const galleryTop = 60;

    this.add.text(galleryX + btnW / 2, galleryTop, "SELECT WORLD", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);

    WORLDS.forEach((world, i) => {
      const btnY = galleryTop + 28 + i * (btnH + btnGap);
      const completed = progress.worlds[i]?.completed ?? false;

      const btnBg = this.add.rectangle(galleryX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0x16213e, 0.9);
      btnBg.setStrokeStyle(2, completed ? 0x00ff88 : 0x0f3460);
      btnBg.setInteractive({ useHandCursor: true });

      const worldEmojis = ["🌋", "🏖️", "🌴", "🪖"];
      this.add.text(galleryX + 18, btnY + btnH / 2, worldEmojis[i], {
        fontSize: "20px",
      }).setOrigin(0.5, 0.5);

      const label = this.add.text(galleryX + 34, btnY + btnH / 2 - 8, world.name, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: completed ? "#00ff88" : "#cccccc",
        fontStyle: completed ? "bold" : "normal",
      }).setOrigin(0, 0);

      if (completed) {
        this.add.text(galleryX + btnW - 12, btnY + btnH / 2, "\u2713", {
          fontSize: "20px",
          fontFamily: "monospace",
          color: "#00ff88",
          fontStyle: "bold",
        }).setOrigin(1, 0.5);
      }

      const deathCount = progress.worlds[i]?.deaths ?? 0;
      if (completed && deathCount > 0) {
        this.add.text(galleryX + 34, btnY + btnH / 2 + 8, `Deaths: ${deathCount}`, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#888888",
        }).setOrigin(0, 0);
      }

      btnBg.on("pointerover", () => {
        btnBg.setFillStyle(0x1e2d4a, 1);
        label.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setFillStyle(0x16213e, 0.9);
        label.setColor(completed ? "#00ff88" : "#cccccc");
      });
      btnBg.on("pointerdown", () => {
        this.scene.start("WarningScene", { worldIndex: i, deaths: 0, startTime: Date.now() });
      });
    });

    this.input.keyboard!.once("keydown-ENTER", () => {
      this.scene.start("WarningScene", { worldIndex: 0, deaths: 0, startTime: Date.now() });
    });
  }
}
