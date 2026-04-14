import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#1a1a2e");

    const title = this.add.text(width / 2, height * 0.25, "DOUBLE VISION", {
      fontSize: "48px",
      fontFamily: "monospace",
      color: "#00ffcc",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.38, "2-Player Co-op Platformer", {
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
      this.scene.start("WarningScene", { worldIndex: 0, deaths: 0, startTime: Date.now() });
    });
  }
}
