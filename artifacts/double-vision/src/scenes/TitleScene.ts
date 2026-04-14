import Phaser from "phaser";
import { WORLDS } from "../worlds/WorldConfig";

export class TitleScene extends Phaser.Scene {
  private devMenuOpen = false;
  private devContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    this.devMenuOpen = false;
    this.devContainer = null;

    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#1a1a2e");

    const title = this.add.text(width / 2, height * 0.2, "DOUBLE VISION", {
      fontSize: "48px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const devBtn = this.add.text(width / 2, height * 0.28, "[ DEV: SELECT WORLD ]", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ff6666",
      backgroundColor: "#330000",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    devBtn.on("pointerover", () => devBtn.setColor("#ffffff"));
    devBtn.on("pointerout", () => devBtn.setColor("#ff6666"));
    devBtn.on("pointerdown", () => this.toggleDevMenu());

    const subtitle = this.add.text(width / 2, height * 0.36, "2-Player Co-op Platformer", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#aaaacc",
    });
    subtitle.setOrigin(0.5);

    const controlBg = this.add.rectangle(width / 2, height * 0.58, 360, 120, 0x16213e, 0.8);
    controlBg.setStrokeStyle(2, 0x0f3460);

    this.add.text(width / 2, height * 0.5, "CONTROLS", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2 - 140, height * 0.56, "Player 1:", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffcc00",
    });
    this.add.text(width / 2 + 20, height * 0.56, "W = Jump  |  S = Duck", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
    });

    this.add.text(width / 2 - 140, height * 0.62, "Player 2:", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#00ccff",
    });
    this.add.text(width / 2 + 20, height * 0.62, "\u2190 = Left  |  \u2192 = Right", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
    });

    const playerSquare = this.add.rectangle(width / 2, height * 0.76, 32, 32, 0x4488ff);
    playerSquare.setStrokeStyle(2, 0x66aaff);

    this.tweens.add({
      targets: playerSquare,
      y: height * 0.76 - 10,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const prompt = this.add.text(width / 2, height * 0.88, "Press ENTER to Start", {
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

    this.input.keyboard!.once("keydown-ENTER", () => {
      if (this.devMenuOpen) return;
      this.scene.start("WarningScene", { worldIndex: 0, deaths: 0, startTime: Date.now() });
    });
  }

  private toggleDevMenu() {
    if (this.devMenuOpen && this.devContainer) {
      this.devContainer.destroy();
      this.devContainer = null;
      this.devMenuOpen = false;
      return;
    }

    this.devMenuOpen = true;
    const { width, height } = this.scale;

    const panelW = 260;
    const panelH = 44 + WORLDS.length * 40;
    const panelX = width / 2;
    const panelY = height / 2;

    this.devContainer = this.add.container(panelX, panelY).setDepth(200);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a1e, 0.95);
    bg.setStrokeStyle(2, 0xe94560);
    this.devContainer.add(bg);

    const header = this.add.text(0, -panelH / 2 + 18, "SELECT WORLD", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.devContainer.add(header);

    WORLDS.forEach((world, i) => {
      const btnY = -panelH / 2 + 50 + i * 40;

      const btnBg = this.add.rectangle(0, btnY, panelW - 24, 32, 0x16213e, 0.9);
      btnBg.setStrokeStyle(1, 0x0f3460);
      btnBg.setInteractive({ useHandCursor: true });

      const colorSwatch = this.add.rectangle(-panelW / 2 + 28, btnY, 14, 14, world.groundColor);

      const label = this.add.text(-panelW / 2 + 44, btnY, `${i + 1}. ${world.name}`, {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#cccccc",
      }).setOrigin(0, 0.5);

      btnBg.on("pointerover", () => {
        btnBg.setFillStyle(0x1e2d4a, 1);
        label.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setFillStyle(0x16213e, 0.9);
        label.setColor("#cccccc");
      });
      btnBg.on("pointerdown", () => {
        this.scene.start("WarningScene", { worldIndex: i, deaths: 0, startTime: Date.now() });
      });

      this.devContainer!.add([btnBg, colorSwatch, label]);
    });
  }
}
