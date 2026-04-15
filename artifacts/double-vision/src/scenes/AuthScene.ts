import Phaser from "phaser";
import { getBgColor } from "../GameSettings";
import { loginRequest, registerRequest, isLoggedIn, loadUserData } from "../AuthManager";
import { loadServerData as loadServerCoins } from "../CoinManager";
import { loadServerData as loadServerProgress } from "../ProgressManager";
import { loadServerData as loadServerAccessories } from "../AccessoryManager";

type AuthMode = "menu" | "login" | "register";

export class AuthScene extends Phaser.Scene {
  private mode: AuthMode = "menu";
  private usernameInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private formContainer: HTMLDivElement | null = null;
  private errorText: Phaser.GameObjects.Text | null = null;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: "AuthScene" });
  }

  create() {
    this.mode = "menu";
    this.cleanupHTML();
    this.clearUI();
    this.cameras.main.setBackgroundColor(getBgColor().value);

    if (isLoggedIn()) {
      this.handleLoginSuccess();
      return;
    }

    this.showMenu();
  }

  private clearUI() {
    this.uiObjects.forEach(o => o.destroy());
    this.uiObjects = [];
    if (this.errorText) {
      this.errorText.destroy();
      this.errorText = null;
    }
  }

  private showMenu() {
    this.mode = "menu";
    this.clearUI();
    this.cleanupHTML();

    const { width, height } = this.scale;

    const title = this.add.text(width / 2, height * 0.18, "DOUBLE VISION", {
      fontSize: "42px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.uiObjects.push(title);

    const subtitle = this.add.text(width / 2, height * 0.3, "Welcome! Choose an option:", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);
    this.uiObjects.push(subtitle);

    const btnW = 240;
    const btnH = 50;
    const buttons = [
      { label: "LOG IN", y: 0.44, color: "#ffcc00", action: () => this.showForm("login") },
      { label: "CREATE ACCOUNT", y: 0.56, color: "#00ccff", action: () => this.showForm("register") },
      { label: "PLAY AS GUEST", y: 0.68, color: "#88ff88", action: () => this.playAsGuest() },
    ];

    buttons.forEach(btn => {
      const bg = this.add.rectangle(width / 2, height * btn.y, btnW, btnH, 0x16213e, 0.9);
      bg.setStrokeStyle(2, 0x0f3460);
      bg.setInteractive({ useHandCursor: true });
      this.uiObjects.push(bg);

      const label = this.add.text(width / 2, height * btn.y, btn.label, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: btn.color,
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.uiObjects.push(label);

      bg.on("pointerover", () => {
        bg.setFillStyle(0x1e2d4a, 1);
        label.setColor("#ffffff");
      });
      bg.on("pointerout", () => {
        bg.setFillStyle(0x16213e, 0.9);
        label.setColor(btn.color);
      });
      bg.on("pointerdown", btn.action);
    });

    const backBtn = this.add.text(width / 2, height * 0.85, "< Back to Title", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#666688",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.uiObjects.push(backBtn);

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#666688"));
    backBtn.on("pointerdown", () => this.scene.start("StartScene"));

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.once("down", () => this.scene.start("StartScene"));
  }

  private showForm(mode: "login" | "register") {
    this.mode = mode;
    this.clearUI();
    this.cleanupHTML();

    const { width, height } = this.scale;
    const heading = mode === "login" ? "LOG IN" : "CREATE ACCOUNT";
    const headingColor = mode === "login" ? "#ffcc00" : "#00ccff";

    const title = this.add.text(width / 2, height * 0.15, heading, {
      fontSize: "32px",
      fontFamily: "monospace",
      color: headingColor,
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.uiObjects.push(title);

    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / 800;
    const scaleY = canvasRect.height / 480;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = `${canvasRect.left + (width / 2 - 130) * scaleX}px`;
    container.style.top = `${canvasRect.top + (height * 0.3) * scaleY}px`;
    container.style.width = `${260 * scaleX}px`;
    container.style.zIndex = "1000";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = `${8 * scaleY}px`;

    const inputStyle = `
      width: 100%;
      padding: ${8 * scaleY}px ${10 * scaleX}px;
      font-family: monospace;
      font-size: ${14 * scaleY}px;
      background: #16213e;
      color: #ffffff;
      border: 2px solid #0f3460;
      border-radius: 4px;
      outline: none;
      box-sizing: border-box;
    `;

    const usernameLabel = document.createElement("label");
    usernameLabel.textContent = "Username";
    usernameLabel.style.color = "#aaaacc";
    usernameLabel.style.fontFamily = "monospace";
    usernameLabel.style.fontSize = `${12 * scaleY}px`;
    container.appendChild(usernameLabel);

    this.usernameInput = document.createElement("input");
    this.usernameInput.type = "text";
    this.usernameInput.placeholder = "Enter username";
    this.usernameInput.maxLength = 20;
    this.usernameInput.style.cssText = inputStyle;
    container.appendChild(this.usernameInput);

    const passwordLabel = document.createElement("label");
    passwordLabel.textContent = "Password";
    passwordLabel.style.color = "#aaaacc";
    passwordLabel.style.fontFamily = "monospace";
    passwordLabel.style.fontSize = `${12 * scaleY}px`;
    passwordLabel.style.marginTop = `${4 * scaleY}px`;
    container.appendChild(passwordLabel);

    this.passwordInput = document.createElement("input");
    this.passwordInput.type = "password";
    this.passwordInput.placeholder = "Enter password";
    this.passwordInput.style.cssText = inputStyle;
    container.appendChild(this.passwordInput);

    this.passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submitForm();
    });

    document.body.appendChild(container);
    this.formContainer = container;

    setTimeout(() => this.usernameInput?.focus(), 100);

    const submitBtnY = height * 0.62;
    const submitBg = this.add.rectangle(width / 2, submitBtnY, 200, 44, 0x16213e, 0.9);
    submitBg.setStrokeStyle(2, 0xe94560);
    submitBg.setInteractive({ useHandCursor: true });
    this.uiObjects.push(submitBg);

    const submitLabel = this.add.text(width / 2, submitBtnY, mode === "login" ? "LOG IN" : "SIGN UP", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.uiObjects.push(submitLabel);

    submitBg.on("pointerover", () => {
      submitBg.setFillStyle(0x1e2d4a, 1);
      submitLabel.setColor("#ffffff");
    });
    submitBg.on("pointerout", () => {
      submitBg.setFillStyle(0x16213e, 0.9);
      submitLabel.setColor("#e94560");
    });
    submitBg.on("pointerdown", () => this.submitForm());

    const backBtn = this.add.text(width / 2, height * 0.78, "< Back", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#666688",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.uiObjects.push(backBtn);

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#666688"));
    backBtn.on("pointerdown", () => this.showMenu());
  }

  private async submitForm() {
    const usr = this.usernameInput?.value?.trim() || "";
    const pwd = this.passwordInput?.value || "";

    if (!usr || !pwd) {
      this.showError("Please fill in both fields");
      return;
    }

    this.showError("Please wait...");

    const result = this.mode === "login"
      ? await loginRequest(usr, pwd)
      : await registerRequest(usr, pwd);

    if (result.success) {
      this.handleLoginSuccess();
    } else {
      this.showError(result.error || "Something went wrong");
    }
  }

  private async handleLoginSuccess() {
    this.cleanupHTML();
    try {
      const data = await loadUserData();
      if (data) {
        loadServerCoins(data.coins);
        loadServerProgress(data.progress);
        loadServerAccessories(data.accessories);
      }
    } catch {}
    this.scene.start("ModeSelectScene");
  }

  private playAsGuest() {
    this.cleanupHTML();
    this.scene.start("ModeSelectScene");
  }

  private showError(message: string) {
    if (this.errorText) this.errorText.destroy();
    const { width, height } = this.scale;
    this.errorText = this.add.text(width / 2, height * 0.72, message, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ff4444",
    }).setOrigin(0.5);
    this.uiObjects.push(this.errorText);
  }

  private cleanupHTML() {
    if (this.formContainer) {
      this.formContainer.remove();
      this.formContainer = null;
    }
    this.usernameInput = null;
    this.passwordInput = null;
  }

  shutdown() {
    this.cleanupHTML();
  }

  destroy() {
    this.cleanupHTML();
  }
}
