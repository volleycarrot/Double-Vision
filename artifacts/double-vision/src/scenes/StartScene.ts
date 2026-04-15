import Phaser from "phaser";
import { getSelectedColor, EYE, getEyeOffsetY } from "../PlayerConfig";
import { getBgColor } from "../GameSettings";
import { initMusicOnInteraction } from "../MusicManager";

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: "StartScene" });
  }

  create() {
    const { width, height } = this.scale;
    const bg = getBgColor();

    this.cameras.main.setBackgroundColor(bg.value);
    initMusicOnInteraction();

    const title = this.add.text(width / 2, height * 0.25, "DOUBLE VISION", {
      fontSize: "52px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.38, "A Co-op Platformer", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#aaaacc",
    });
    subtitle.setOrigin(0.5);

    const selectedColor = getSelectedColor();
    const playerY = height * 0.52;
    const playerSquare = this.add.rectangle(width / 2, playerY, 32, 32, selectedColor.fill);
    playerSquare.setStrokeStyle(2, selectedColor.stroke);

    const eyeOffsetY = getEyeOffsetY(32);
    const leftEye = this.add.rectangle(
      width / 2 - EYE.SPACING, playerY + eyeOffsetY,
      EYE.WIDTH, EYE.HEIGHT, 0x000000
    );
    const rightEye = this.add.rectangle(
      width / 2 + EYE.SPACING, playerY + eyeOffsetY,
      EYE.WIDTH, EYE.HEIGHT, 0x000000
    );

    this.tweens.add({
      targets: [playerSquare, leftEye, rightEye],
      y: `-=10`,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const btnW = 220;
    const btnH = 54;
    const btnBg = this.add.rectangle(width / 2, height * 0.72, btnW, btnH, 0x16213e, 0.9);
    btnBg.setStrokeStyle(2, 0xe94560);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(width / 2, height * 0.72, "START GAME", {
      fontSize: "22px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    });
    btnText.setOrigin(0.5);

    btnBg.on("pointerover", () => {
      btnBg.setFillStyle(0x1e2d4a, 1);
      btnText.setColor("#ffffff");
    });
    btnBg.on("pointerout", () => {
      btnBg.setFillStyle(0x16213e, 0.9);
      btnText.setColor("#e94560");
    });

    const startGame = () => {
      this.scene.start("ModeSelectScene");
    };

    btnBg.on("pointerdown", startGame);

    this.input.keyboard!.once("keydown-ENTER", startGame);

    const hint = this.add.text(width / 2, height * 0.88, "Press ENTER", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#666688",
    });
    hint.setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }
}
