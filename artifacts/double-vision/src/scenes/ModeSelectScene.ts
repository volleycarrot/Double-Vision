import Phaser from "phaser";

export type GameMode = "single" | "multiplayer";

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "ModeSelectScene" });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#1a1a2e");

    const title = this.add.text(width / 2, height * 0.18, "CHOOSE MODE", {
      fontSize: "36px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const btnW = 280;
    const btnH = 70;

    const singleBg = this.add.rectangle(width / 2, height * 0.42, btnW, btnH, 0x16213e, 0.9);
    singleBg.setStrokeStyle(2, 0x0f3460);
    singleBg.setInteractive({ useHandCursor: true });

    const singleLabel = this.add.text(width / 2, height * 0.42 - 8, "SINGLE PLAYER", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#ffcc00",
      fontStyle: "bold",
    });
    singleLabel.setOrigin(0.5);

    this.add.text(width / 2, height * 0.42 + 16, "Arrow keys to move, jump & duck", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    const multiBg = this.add.rectangle(width / 2, height * 0.62, btnW, btnH, 0x16213e, 0.9);
    multiBg.setStrokeStyle(2, 0x0f3460);
    multiBg.setInteractive({ useHandCursor: true });

    const multiLabel = this.add.text(width / 2, height * 0.62 - 8, "MULTIPLAYER", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#00ccff",
      fontStyle: "bold",
    });
    multiLabel.setOrigin(0.5);

    this.add.text(width / 2, height * 0.62 + 16, "Two players, shared keyboard", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    const selectMode = (mode: GameMode) => {
      this.scene.start("TitleScene", { gameMode: mode });
    };

    singleBg.on("pointerover", () => {
      singleBg.setFillStyle(0x1e2d4a, 1);
      singleLabel.setColor("#ffffff");
    });
    singleBg.on("pointerout", () => {
      singleBg.setFillStyle(0x16213e, 0.9);
      singleLabel.setColor("#ffcc00");
    });
    singleBg.on("pointerdown", () => selectMode("single"));

    multiBg.on("pointerover", () => {
      multiBg.setFillStyle(0x1e2d4a, 1);
      multiLabel.setColor("#ffffff");
    });
    multiBg.on("pointerout", () => {
      multiBg.setFillStyle(0x16213e, 0.9);
      multiLabel.setColor("#00ccff");
    });
    multiBg.on("pointerdown", () => selectMode("multiplayer"));

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
