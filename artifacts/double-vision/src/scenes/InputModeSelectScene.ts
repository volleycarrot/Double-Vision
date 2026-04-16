import Phaser from "phaser";
import { getBgColor, setInputMode, hasInputModeBeenChosen } from "../GameSettings";

export class InputModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "InputModeSelectScene" });
  }

  create() {
    if (hasInputModeBeenChosen()) {
      this.scene.start("ModeSelectScene");
      return;
    }

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(getBgColor().value);

    this.add.text(width / 2, height * 0.15, "HOW ARE YOU PLAYING?", {
      fontSize: "32px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.26, "Choose your input method", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    const btnW = 260;
    const btnH = 100;
    const gap = 40;

    const kbX = width / 2 - btnW / 2 - gap / 2;
    const mbX = width / 2 + btnW / 2 + gap / 2;
    const btnY = height * 0.52;

    this.createModeButton(kbX, btnY, btnW, btnH, "⌨️", "KEYBOARD", "#ffcc00", "Use physical keyboard\narrow keys to play", () => {
      setInputMode("keyboard");
      this.scene.start("ModeSelectScene");
    });

    this.createModeButton(mbX, btnY, btnW, btnH, "📱", "MOBILE", "#00ccff", "Use on-screen touch\nbuttons to play", () => {
      setInputMode("mobile");
      this.scene.start("ModeSelectScene");
    });

    this.add.text(width / 2, height * 0.85, "You can change this later in Settings", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#666688",
    }).setOrigin(0.5);
  }

  private createModeButton(x: number, y: number, w: number, h: number, icon: string, label: string, color: string, desc: string, action: () => void) {
    const bg = this.add.rectangle(x, y, w, h, 0x16213e, 0.9);
    bg.setStrokeStyle(2, 0x0f3460);
    bg.setInteractive({ useHandCursor: true });

    this.add.text(x, y - 28, icon, {
      fontSize: "28px",
    }).setOrigin(0.5);

    const labelText = this.add.text(x, y + 4, label, {
      fontSize: "20px",
      fontFamily: "monospace",
      color: color,
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(x, y + 32, desc, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
      align: "center",
    }).setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(0x1e2d4a, 1);
      labelText.setColor("#ffffff");
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x16213e, 0.9);
      labelText.setColor(color);
    });
    bg.on("pointerdown", action);
  }
}
