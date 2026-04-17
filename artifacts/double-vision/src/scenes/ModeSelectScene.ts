import Phaser from "phaser";
import { getBgColor } from "../GameSettings";

export type GameMode = "single" | "online";

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "ModeSelectScene" });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(getBgColor().value);

    const title = this.add.text(width / 2, height * 0.15, "CHOOSE MODE", {
      fontSize: "36px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const btnW = 280;
    const btnH = 60;

    const singleY = height * 0.42;
    const onlineY = height * 0.62;

    const singleBg = this.add.rectangle(width / 2, singleY, btnW, btnH, 0x16213e, 0.9);
    singleBg.setStrokeStyle(2, 0x0f3460);
    singleBg.setInteractive({ useHandCursor: true });

    const singleLabel = this.add.text(width / 2, singleY - 8, "SINGLE PLAYER", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#ffcc00",
      fontStyle: "bold",
    });
    singleLabel.setOrigin(0.5);

    this.add.text(width / 2, singleY + 16, "Arrow keys to move, jump & duck", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    const onlineBg = this.add.rectangle(width / 2, onlineY, btnW, btnH, 0x16213e, 0.9);
    onlineBg.setStrokeStyle(2, 0x0f3460);
    onlineBg.setInteractive({ useHandCursor: true });

    const onlineLabel = this.add.text(width / 2, onlineY - 8, "ONLINE CO-OP", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#ff8800",
      fontStyle: "bold",
    });
    onlineLabel.setOrigin(0.5);

    this.add.text(width / 2, onlineY + 16, "Share control over the internet", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    singleBg.on("pointerover", () => {
      singleBg.setFillStyle(0x1e2d4a, 1);
      singleLabel.setColor("#ffffff");
    });
    singleBg.on("pointerout", () => {
      singleBg.setFillStyle(0x16213e, 0.9);
      singleLabel.setColor("#ffcc00");
    });
    singleBg.on("pointerdown", () => this.scene.start("TitleScene", { gameMode: "single" as GameMode }));

    onlineBg.on("pointerover", () => {
      onlineBg.setFillStyle(0x1e2d4a, 1);
      onlineLabel.setColor("#ffffff");
    });
    onlineBg.on("pointerout", () => {
      onlineBg.setFillStyle(0x16213e, 0.9);
      onlineLabel.setColor("#ff8800");
    });
    onlineBg.on("pointerdown", () => this.scene.start("LobbyScene"));

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.once("down", () => {
      this.scene.start("StartScene");
    });

    const backBtn = this.add.text(16, 16, "< Back", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#cccccc",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#cccccc"));
    backBtn.on("pointerdown", () => {
      this.scene.start("StartScene");
    });
  }
}
