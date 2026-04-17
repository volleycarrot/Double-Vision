import Phaser from "phaser";
import type { GameMode } from "./ModeSelectScene";

export class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: "WinScene" });
  }

  private gameMode: GameMode = "single";

  create(data: { deaths: number; startTime: number; gameMode?: GameMode }) {
    this.gameMode = data?.gameMode || "single";
    const { width, height } = this.scale;
    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    this.cameras.main.setBackgroundColor("#0a0a1e");

    const title = this.add.text(width / 2, height * 0.2, "YOU WIN!", {
      fontSize: "56px",
      fontFamily: "monospace",
      color: "#00ffcc",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    this.tweens.add({
      targets: title,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.add.text(width / 2, height * 0.42, "All 4 worlds completed!", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.55, `Total Deaths: ${data.deaths}`, {
      fontSize: "22px",
      fontFamily: "monospace",
      color: "#e94560",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.65, `Time: ${minutes}m ${seconds.toString().padStart(2, "0")}s`, {
      fontSize: "22px",
      fontFamily: "monospace",
      color: "#ffcc00",
    }).setOrigin(0.5);

    for (let i = 0; i < 20; i++) {
      const star = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        4, 4,
        Phaser.Math.Between(0, 1) ? 0x00ffcc : 0xffcc00
      );
      this.tweens.add({
        targets: star,
        alpha: 0,
        duration: Phaser.Math.Between(400, 1200),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1000),
      });
    }

    const prompt = this.add.text(width / 2, height * 0.85, "Press ENTER to Continue", {
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
      this.scene.start("TitleScene", { gameMode: this.gameMode });
    });
  }
}
