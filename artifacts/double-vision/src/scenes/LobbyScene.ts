import Phaser from "phaser";
import { getBgColor } from "../GameSettings";
import { onlineManager } from "../OnlineMultiplayerManager";

export class LobbyScene extends Phaser.Scene {
  private statusText: Phaser.GameObjects.Text | null = null;
  private codeDisplay: Phaser.GameObjects.Text | null = null;
  private joinInput: Phaser.GameObjects.DOMElement | null = null;
  private startBtn: Phaser.GameObjects.Rectangle | null = null;
  private startLabel: Phaser.GameObjects.Text | null = null;
  private guestReady = false;
  private errorText: Phaser.GameObjects.Text | null = null;
  private view: "menu" | "host" | "join" = "menu";

  constructor() {
    super({ key: "LobbyScene" });
  }

  create() {
    this.view = "menu";
    this.guestReady = false;
    this.statusText = null;
    this.codeDisplay = null;
    this.joinInput = null;
    this.startBtn = null;
    this.startLabel = null;
    this.errorText = null;

    onlineManager.removeAllListeners();

    this.showMenu();
  }

  private cleanup() {
    onlineManager.removeAllListeners();
    onlineManager.leaveRoom();
    this.removeInputElement();
  }

  private removeInputElement() {
    const existing = document.getElementById("lobby-join-input");
    if (existing) existing.remove();
  }

  private clearScene() {
    this.children.removeAll(true);
    this.removeInputElement();
  }

  private showMenu() {
    this.clearScene();
    this.view = "menu";
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(getBgColor().value);

    const title = this.add.text(width / 2, height * 0.15, "ONLINE CO-OP", {
      fontSize: "36px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height * 0.25, "Share control of one character online!", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    const btnW = 280;
    const btnH = 70;

    const createBg = this.add.rectangle(width / 2, height * 0.45, btnW, btnH, 0x16213e, 0.9);
    createBg.setStrokeStyle(2, 0x0f3460);
    createBg.setInteractive({ useHandCursor: true });

    const createLabel = this.add.text(width / 2, height * 0.45 - 8, "CREATE ROOM", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#ffcc00",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45 + 16, "Host a game and share the code", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    const joinBg = this.add.rectangle(width / 2, height * 0.65, btnW, btnH, 0x16213e, 0.9);
    joinBg.setStrokeStyle(2, 0x0f3460);
    joinBg.setInteractive({ useHandCursor: true });

    const joinLabel = this.add.text(width / 2, height * 0.65 - 8, "JOIN ROOM", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#00ccff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.65 + 16, "Enter a room code to connect", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    createBg.on("pointerover", () => { createBg.setFillStyle(0x1e2d4a, 1); createLabel.setColor("#ffffff"); });
    createBg.on("pointerout", () => { createBg.setFillStyle(0x16213e, 0.9); createLabel.setColor("#ffcc00"); });
    createBg.on("pointerdown", () => this.handleCreate());

    joinBg.on("pointerover", () => { joinBg.setFillStyle(0x1e2d4a, 1); joinLabel.setColor("#ffffff"); });
    joinBg.on("pointerout", () => { joinBg.setFillStyle(0x16213e, 0.9); joinLabel.setColor("#00ccff"); });
    joinBg.on("pointerdown", () => this.showJoinView());

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
      this.cleanup();
      this.scene.start("ModeSelectScene");
    });
  }

  private async handleCreate() {
    this.clearScene();
    this.view = "host";
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(getBgColor().value);

    this.add.text(width / 2, height * 0.12, "CREATE ROOM", {
      fontSize: "28px",
      fontFamily: "monospace",
      color: "#ffcc00",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.statusText = this.add.text(width / 2, height * 0.25, "Connecting...", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

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
      this.cleanup();
      this.showMenu();
    });

    try {
      await onlineManager.connect();
    } catch {
      if (this.statusText) this.statusText.setText("Failed to connect to server.\nPlease try again.");
      if (this.statusText) this.statusText.setColor("#ff4444");
      return;
    }

    onlineManager.on("room_created", (msg: any) => {
      onlineManager.setRole("host");
      onlineManager.setRoomCode(msg.code);
      this.showHostWaiting(msg.code);
    });

    onlineManager.on("guest_joined", () => {
      this.guestReady = true;
      if (this.statusText) {
        this.statusText.setText("Player 2 connected!");
        this.statusText.setColor("#00ff88");
      }
      if (this.startBtn && this.startLabel) {
        this.startBtn.setFillStyle(0x006622, 0.9);
        this.startBtn.setStrokeStyle(2, 0x00ff66);
        this.startBtn.setInteractive({ useHandCursor: true });
        this.startLabel.setColor("#00ff88");
      }
    });

    onlineManager.on("game_start", (msg: any) => {
      onlineManager.setRole(msg.role);
      this.scene.start("TitleScene", { gameMode: "online" });
    });

    onlineManager.on("error", (msg: any) => {
      this.showError(msg.message || "An error occurred");
    });

    onlineManager.on("partner_disconnected", () => {
      this.guestReady = false;
      if (this.statusText) {
        this.statusText.setText("Player 2 disconnected.\nWaiting for Player 2...");
        this.statusText.setColor("#ff8800");
      }
      if (this.startBtn && this.startLabel) {
        this.startBtn.setFillStyle(0x333333, 0.5);
        this.startBtn.disableInteractive();
        this.startLabel.setColor("#666666");
      }
    });

    onlineManager.on("disconnected", () => {
      this.showError("Connection lost");
      this.cleanup();
      this.time.delayedCall(2000, () => this.showMenu());
    });

    onlineManager.createRoom();
  }

  private showHostWaiting(code: string) {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.35, "ROOM CODE", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5);

    this.codeDisplay = this.add.text(width / 2, height * 0.48, code, {
      fontSize: "56px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 12,
    }).setOrigin(0.5);

    if (this.statusText) {
      this.statusText.setText("Waiting for Player 2...");
      this.statusText.setColor("#aaaacc");
      this.statusText.setY(height * 0.60);
    }

    this.add.text(width / 2, height * 0.68, "Share this code with your partner", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#666666",
    }).setOrigin(0.5);

    const roleInfo = this.add.text(width / 2, height * 0.76, "You control: LEFT / RIGHT movement", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffcc00",
    }).setOrigin(0.5);

    this.startBtn = this.add.rectangle(width / 2, height * 0.88, 200, 44, 0x333333, 0.5);
    this.startBtn.setStrokeStyle(2, 0x444444);
    this.startBtn.disableInteractive();

    this.startLabel = this.add.text(width / 2, height * 0.88, "START GAME", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#666666",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.startBtn.on("pointerover", () => {
      if (this.guestReady && this.startBtn) this.startBtn.setFillStyle(0x008833, 1);
    });
    this.startBtn.on("pointerout", () => {
      if (this.guestReady && this.startBtn) this.startBtn.setFillStyle(0x006622, 0.9);
    });
    this.startBtn.on("pointerdown", () => {
      if (this.guestReady) {
        onlineManager.startGame();
      }
    });
  }

  private showJoinView() {
    this.clearScene();
    this.view = "join";
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(getBgColor().value);

    this.add.text(width / 2, height * 0.12, "JOIN ROOM", {
      fontSize: "28px",
      fontFamily: "monospace",
      color: "#00ccff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.25, "Enter the room code:", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    const inputHtml = `<input id="lobby-join-input" type="text" maxlength="5" placeholder="XXXXX" 
      style="width:200px;height:48px;font-size:32px;font-family:monospace;text-align:center;
      background:#16213e;color:#ffffff;border:2px solid #0f3460;outline:none;text-transform:uppercase;
      letter-spacing:8px;border-radius:4px;" />`;

    this.joinInput = this.add.dom(width / 2, height * 0.40).createFromHTML(inputHtml);

    const joinBtnBg = this.add.rectangle(width / 2, height * 0.56, 200, 44, 0x16213e, 0.9);
    joinBtnBg.setStrokeStyle(2, 0x0f3460);
    joinBtnBg.setInteractive({ useHandCursor: true });

    const joinBtnLabel = this.add.text(width / 2, height * 0.56, "CONNECT", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#00ccff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    joinBtnBg.on("pointerover", () => { joinBtnBg.setFillStyle(0x1e2d4a, 1); joinBtnLabel.setColor("#ffffff"); });
    joinBtnBg.on("pointerout", () => { joinBtnBg.setFillStyle(0x16213e, 0.9); joinBtnLabel.setColor("#00ccff"); });
    joinBtnBg.on("pointerdown", () => this.handleJoin());

    this.statusText = this.add.text(width / 2, height * 0.68, "", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.78, "You will control: JUMP / DUCK", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#00ccff",
    }).setOrigin(0.5);

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
      this.cleanup();
      this.showMenu();
    });

    setTimeout(() => {
      const el = document.getElementById("lobby-join-input") as HTMLInputElement;
      if (el) el.focus();
    }, 100);
  }

  private async handleJoin() {
    const el = document.getElementById("lobby-join-input") as HTMLInputElement;
    if (!el) return;

    const code = el.value.toUpperCase().trim();
    if (code.length < 4) {
      this.showError("Please enter a valid room code");
      return;
    }

    if (this.statusText) {
      this.statusText.setText("Connecting...");
      this.statusText.setColor("#aaaacc");
    }

    try {
      await onlineManager.connect();
    } catch {
      this.showError("Failed to connect to server");
      return;
    }

    onlineManager.on("room_joined", (msg: any) => {
      onlineManager.setRole("guest");
      onlineManager.setRoomCode(msg.code);
      if (this.statusText) {
        this.statusText.setText("Connected! Waiting for host to start...");
        this.statusText.setColor("#00ff88");
      }
    });

    onlineManager.on("game_start", (msg: any) => {
      onlineManager.setRole(msg.role);
      this.scene.start("TitleScene", { gameMode: "online" });
    });

    onlineManager.on("error", (msg: any) => {
      this.showError(msg.message || "An error occurred");
    });

    onlineManager.on("partner_disconnected", () => {
      this.showError("Host disconnected");
      this.cleanup();
      this.time.delayedCall(2000, () => this.showMenu());
    });

    onlineManager.on("disconnected", () => {
      this.showError("Connection lost");
      this.cleanup();
      this.time.delayedCall(2000, () => this.showMenu());
    });

    onlineManager.joinRoom(code);
  }

  private showError(msg: string) {
    if (this.errorText) this.errorText.destroy();
    const { width, height } = this.scale;
    this.errorText = this.add.text(width / 2, height * 0.92, msg, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ff4444",
      fontStyle: "bold",
      backgroundColor: "#000000",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    this.time.delayedCall(3000, () => {
      if (this.errorText) {
        this.errorText.destroy();
        this.errorText = null;
      }
    });
  }
}
