import Phaser from "phaser";
import { WORLDS } from "../worlds/WorldConfig";
import { loadProgress } from "../ProgressManager";
import { COLOR_PRESETS, getSelectedColor, getSelectedColorIndex, setSelectedColorIndex, EYE, getEyeOffsetY } from "../PlayerConfig";
import type { GameMode } from "./ModeSelectScene";
import { getBindings, getKeyName, setBinding, resetBindings, isReservedKey, type ControlBindings } from "../KeyBindings";
import { getBgColor, getSettings, setMusicEnabled, setBgColorIndex, BG_PRESETS, getInputMode, setInputMode, getControlsFlipped, setControlsFlipped, type InputMode } from "../GameSettings";
import { toggleMusic } from "../MusicManager";
import { onlineManager, type CustomMapData } from "../OnlineMultiplayerManager";
import { isLoggedIn, getUsername, logout, apiRequest } from "../AuthManager";
import { getStats } from "../StatsManager";

export class TitleScene extends Phaser.Scene {
  private gameMode: GameMode = "single";
  private settingsOpen = false;
  private statsOpen = false;
  private settingsOverlay: Phaser.GameObjects.Rectangle | null = null;
  private settingsModalBg: Phaser.GameObjects.Rectangle | null = null;
  private settingsDynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private controlTexts: Phaser.GameObjects.GameObject[] = [];
  private waitingForKey: keyof ControlBindings | null = null;
  private keyListener: ((event: KeyboardEvent) => void) | null = null;
  private errorText: Phaser.GameObjects.Text | null = null;
  private errorTimer: Phaser.Time.TimerEvent | null = null;
  private statsOverlay: Phaser.GameObjects.Rectangle | null = null;
  private statsModalBg: Phaser.GameObjects.Rectangle | null = null;
  private statsDynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private myMapsOpen = false;
  private myMapsOverlay: Phaser.GameObjects.Rectangle | null = null;
  private myMapsModalBg: Phaser.GameObjects.Rectangle | null = null;
  private myMapsDynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private myMapsPage = 0;
  private myMapsData: { id: number; name: string; tileData: string; bgColor: string; groundColor: string; platformColor: string }[] = [];

  constructor() {
    super({ key: "TitleScene" });
  }

  create(data: { gameMode?: GameMode }) {
    this.gameMode = data?.gameMode || "single";
    this.settingsOpen = false;
    this.statsOpen = false;
    this.settingsOverlay = null;
    this.settingsModalBg = null;
    this.settingsDynamicObjects = [];
    this.controlTexts = [];
    this.waitingForKey = null;
    this.keyListener = null;
    this.errorText = null;
    this.errorTimer = null;
    this.statsOverlay = null;
    this.statsModalBg = null;
    this.statsDynamicObjects = [];
    this.myMapsOpen = false;
    this.myMapsOverlay = null;
    this.myMapsModalBg = null;
    this.myMapsDynamicObjects = [];

    const { width, height } = this.scale;
    const progress = loadProgress();

    this.cameras.main.setBackgroundColor(getBgColor().value);

    const leftCenterX = width / 2 - 100;

    const title = this.add.text(leftCenterX, height * 0.15, "DOUBLE VISION", {
      fontSize: "48px",
      fontFamily: "monospace",
      color: "#ff2222",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const modeLabels: Record<string, string> = {
      single: "Single Player",
      online: "Online Co-op",
    };
    const modeLabel = modeLabels[this.gameMode] || "Single Player";
    const subtitle = this.add.text(leftCenterX, height * 0.25, modeLabel, {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#aaaacc",
    });
    subtitle.setOrigin(0.5);

    this.renderControlsBox(leftCenterX, height);

    const selectedColor = getSelectedColor();
    const playerSquare = this.add.rectangle(leftCenterX, height * 0.68, 32, 32, selectedColor.fill);
    playerSquare.setStrokeStyle(2, selectedColor.stroke);

    const eyeOffsetY = getEyeOffsetY(32);
    const leftEye = this.add.rectangle(
      leftCenterX - EYE.SPACING, height * 0.68 + eyeOffsetY,
      EYE.WIDTH, EYE.HEIGHT, 0x000000
    );
    const rightEye = this.add.rectangle(
      leftCenterX + EYE.SPACING, height * 0.68 + eyeOffsetY,
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

    const swatchY = height * 0.78;
    const swatchSize = 20;
    const swatchGap = 8;
    const totalSwatchWidth = COLOR_PRESETS.length * swatchSize + (COLOR_PRESETS.length - 1) * swatchGap;
    const swatchStartX = leftCenterX - totalSwatchWidth / 2 + swatchSize / 2;

    const selectionIndicators: Phaser.GameObjects.Rectangle[] = [];

    COLOR_PRESETS.forEach((preset, i) => {
      const sx = swatchStartX + i * (swatchSize + swatchGap);
      const isSelected = i === getSelectedColorIndex();

      const indicator = this.add.rectangle(sx, swatchY, swatchSize + 6, swatchSize + 6, 0xffffff, isSelected ? 1 : 0);
      selectionIndicators.push(indicator);

      const swatch = this.add.rectangle(sx, swatchY, swatchSize, swatchSize, preset.fill);
      swatch.setStrokeStyle(2, preset.stroke);
      swatch.setInteractive({ useHandCursor: true });

      swatch.on("pointerdown", () => {
        setSelectedColorIndex(i);
        playerSquare.setFillStyle(preset.fill);
        playerSquare.setStrokeStyle(2, preset.stroke);
        selectionIndicators.forEach((ind, j) => {
          ind.setFillStyle(0xffffff, j === i ? 1 : 0);
        });
      });
    });

    const prompt = this.add.text(leftCenterX, height * 0.87, "Click a world to start!", {
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

    const isOnlineGuest = this.gameMode === "online" && onlineManager.role === "guest";

    if (isOnlineGuest) {
      this.add.text(galleryX + btnW / 2, galleryTop + 28 + (WORLDS.length * (btnH + btnGap)) / 2, "Waiting for host\nto pick a world...", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#aaaacc",
        align: "center",
      }).setOrigin(0.5);

      onlineManager.removeAllListeners();

      const pending = onlineManager.consumePendingWorld();
      if (pending !== null) {
        this.startWorld(pending.worldIndex, pending.seed, pending.customMapData);
        return;
      }

      onlineManager.on("world_selected", (msg: Record<string, unknown>) => {
        this.startWorld(msg.worldIndex as number, msg.seed as number, msg.customMapData as CustomMapData | undefined);
      });
      onlineManager.on("partner_disconnected", () => {
        onlineManager.disconnect();
        this.scene.start("ModeSelectScene");
      });
      onlineManager.on("disconnected", () => {
        onlineManager.disconnect();
        this.scene.start("ModeSelectScene");
      });
    } else {
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
          if (this.settingsOpen) return;
          if (this.gameMode === "online") {
            const seed = Math.floor(Math.random() * 2147483646) + 1;
            onlineManager.sendWorldSelect(i, seed);
            this.startWorld(i, seed);
            return;
          }
          this.startWorld(i);
        });
      });

      const customBtnH = 36;
      const customBtnGap = 8;
      const customBtnY = galleryTop + 28 + WORLDS.length * (btnH + btnGap) + 4;

      const createBtnBg = this.add.rectangle(galleryX + btnW / 2, customBtnY + customBtnH / 2, btnW, customBtnH, 0x16213e, 0.9);
      createBtnBg.setStrokeStyle(2, isLoggedIn() ? 0x0f3460 : 0x333333);

      this.add.text(galleryX + 14, customBtnY + customBtnH / 2, "🔧", {
        fontSize: "14px",
      }).setOrigin(0.5, 0.5);

      const createLabel = this.add.text(galleryX + 30, customBtnY + customBtnH / 2, isLoggedIn() ? "Create Map" : "Create Map (log in)", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: isLoggedIn() ? "#cccccc" : "#666666",
      }).setOrigin(0, 0.5);

      if (isLoggedIn()) {
        createBtnBg.setInteractive({ useHandCursor: true });
        createBtnBg.on("pointerover", () => {
          createBtnBg.setFillStyle(0x1e2d4a, 1);
          createLabel.setColor("#ffffff");
        });
        createBtnBg.on("pointerout", () => {
          createBtnBg.setFillStyle(0x16213e, 0.9);
          createLabel.setColor("#cccccc");
        });
        createBtnBg.on("pointerdown", () => {
          if (this.settingsOpen || this.myMapsOpen) return;
          this.scene.start("MapEditorScene", { gameMode: this.gameMode });
        });
      } else {
        createBtnBg.setInteractive();
        createBtnBg.on("pointerdown", () => {
          this.showError("Log in to create maps");
        });
      }

      const myMapsBtnY = customBtnY + customBtnH + customBtnGap;
      const myMapsBtnBg = this.add.rectangle(galleryX + btnW / 2, myMapsBtnY + customBtnH / 2, btnW, customBtnH, 0x16213e, 0.9);
      myMapsBtnBg.setStrokeStyle(2, isLoggedIn() ? 0x0f3460 : 0x333333);

      this.add.text(galleryX + 14, myMapsBtnY + customBtnH / 2, "📁", {
        fontSize: "14px",
      }).setOrigin(0.5, 0.5);

      const myMapsLabel = this.add.text(galleryX + 30, myMapsBtnY + customBtnH / 2, isLoggedIn() ? "My Maps" : "My Maps (log in)", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: isLoggedIn() ? "#cccccc" : "#666666",
      }).setOrigin(0, 0.5);

      if (isLoggedIn()) {
        myMapsBtnBg.setInteractive({ useHandCursor: true });
        myMapsBtnBg.on("pointerover", () => {
          myMapsBtnBg.setFillStyle(0x1e2d4a, 1);
          myMapsLabel.setColor("#ffffff");
        });
        myMapsBtnBg.on("pointerout", () => {
          myMapsBtnBg.setFillStyle(0x16213e, 0.9);
          myMapsLabel.setColor("#cccccc");
        });
        myMapsBtnBg.on("pointerdown", () => {
          if (this.settingsOpen || this.myMapsOpen) return;
          this.openMyMaps();
        });
      } else {
        myMapsBtnBg.setInteractive();
        myMapsBtnBg.on("pointerdown", () => {
          this.showError("Log in to view your maps");
        });
      }
    }

    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enterKey.on("down", () => {
      if (this.settingsOpen || isOnlineGuest) return;
      if (this.gameMode === "online") {
        const seed = Math.floor(Math.random() * 2147483646) + 1;
        onlineManager.sendWorldSelect(0, seed);
        this.startWorld(0, seed);
        return;
      }
      this.startWorld(0);
    });

    const handleBack = () => {
      if (this.gameMode === "online") {
        onlineManager.disconnect();
      }
      this.scene.start("ModeSelectScene");
    };

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on("down", () => {
      if (this.myMapsOpen) {
        this.closeMyMaps();
        return;
      }
      if (this.statsOpen) {
        this.closeStats();
        return;
      }
      if (this.settingsOpen) {
        this.closeSettings();
        return;
      }
      handleBack();
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
      if (this.settingsOpen) return;
      handleBack();
    });

    this.addSettingsButton(leftCenterX, height);
    this.addShopButton(leftCenterX, height);
    this.addStatsButton(leftCenterX, height);

    const playerName = getUsername();
    const nameLabel = this.add.text(16, height - 30, isLoggedIn() ? `Player: ${playerName}` : "Playing as Guest", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#888888",
    });

    if (isLoggedIn()) {
      const logoutBtn = this.add.text(16, height - 14, "[Log Out]", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#e94560",
      }).setInteractive({ useHandCursor: true });

      logoutBtn.on("pointerover", () => logoutBtn.setColor("#ffffff"));
      logoutBtn.on("pointerout", () => logoutBtn.setColor("#e94560"));
      logoutBtn.on("pointerdown", () => {
        if (this.settingsOpen) return;
        logout();
        this.scene.start("AuthScene");
      });
    }

    this.events.on("shutdown", () => {
      this.removeKeyListener();
      this.clearError();
      if (this.gameMode === "online") {
        onlineManager.removeAllListeners();
      }
    });
  }

  private startWorld(worldIndex: number, seed?: number, customMapData?: CustomMapData) {
    this.scene.start("WarningScene", {
      worldIndex,
      deaths: 0,
      startTime: Date.now(),
      gameMode: this.gameMode,
      levelSeed: seed,
      customTiles: customMapData?.tiles,
      customBgColor: customMapData?.bgColor,
      customGroundColor: customMapData?.groundColor,
      customPlatformColor: customMapData?.platformColor,
    });
  }

  private renderControlsBox(leftCenterX: number, height: number) {
    this.controlTexts.forEach(t => t.destroy());
    this.controlTexts = [];

    const controlBoxY = height * 0.48;
    const controlBoxW = 440;
    const bindings = getBindings("single");

    if (this.gameMode === "online") {
      const controlBoxH = 120;
      const controlBg = this.add.rectangle(leftCenterX, controlBoxY, controlBoxW, controlBoxH, 0x16213e, 0.8);
      controlBg.setStrokeStyle(2, 0x0f3460);
      this.controlTexts.push(controlBg);

      const header = this.add.text(leftCenterX, controlBoxY - 40, "ONLINE CONTROLS", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#e94560",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.controlTexts.push(header);

      const textLeftX = leftCenterX - controlBoxW / 2 + 20;
      const textRightX = leftCenterX - controlBoxW / 2 + 170;

      const hostLabel = this.add.text(textLeftX, controlBoxY - 12, "Host (You):", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffcc00",
      });
      this.controlTexts.push(hostLabel);

      const hostVal = this.add.text(textRightX, controlBoxY - 12, `${getKeyName(bindings.left)} / ${getKeyName(bindings.right)} = Move`, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffffff",
      });
      this.controlTexts.push(hostVal);

      const guestLabel = this.add.text(textLeftX, controlBoxY + 14, "Partner:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#00ccff",
      });
      this.controlTexts.push(guestLabel);

      const guestVal = this.add.text(textRightX, controlBoxY + 14, "Jump / Duck", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ffffff",
      });
      this.controlTexts.push(guestVal);
    } else if (this.gameMode === "single") {
      const isMobile = getInputMode() === "mobile";
      const controlBoxH = 120;
      const controlBg = this.add.rectangle(leftCenterX, controlBoxY, controlBoxW, controlBoxH, 0x16213e, 0.8);
      controlBg.setStrokeStyle(2, 0x0f3460);
      this.controlTexts.push(controlBg);

      const header = this.add.text(leftCenterX, controlBoxY - 40, isMobile ? "TOUCH CONTROLS" : "CONTROLS", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#e94560",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.controlTexts.push(header);

      const textLeftX = leftCenterX - controlBoxW / 2 + 20;
      const textRightX = leftCenterX - controlBoxW / 2 + 130;

      if (isMobile) {
        const flipped = getControlsFlipped();
        const moveSide = flipped ? "bottom-right" : "bottom-left";
        const actSide = flipped ? "bottom-left" : "bottom-right";

        const moveLabel = this.add.text(textLeftX, controlBoxY - 14, "Move:", {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffcc00",
        });
        this.controlTexts.push(moveLabel);

        const moveVal = this.add.text(textRightX, controlBoxY - 14, `◀ ▶  buttons (${moveSide})`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffffff",
        });
        this.controlTexts.push(moveVal);

        const actLabel = this.add.text(textLeftX, controlBoxY + 10, "Actions:", {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffcc00",
        });
        this.controlTexts.push(actLabel);

        const actVal = this.add.text(textRightX, controlBoxY + 10, `▲ Jump  ▼ Duck (${actSide})`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffffff",
        });
        this.controlTexts.push(actVal);
      } else {
        const moveLabel = this.add.text(textLeftX, controlBoxY - 14, "Move:", {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffcc00",
        });
        this.controlTexts.push(moveLabel);

        const moveVal = this.add.text(textRightX, controlBoxY - 14, `${getKeyName(bindings.left)} = Left  |  ${getKeyName(bindings.right)} = Right`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffffff",
        });
        this.controlTexts.push(moveVal);

        const actLabel = this.add.text(textLeftX, controlBoxY + 10, "Actions:", {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffcc00",
        });
        this.controlTexts.push(actLabel);

        const actVal = this.add.text(textRightX, controlBoxY + 10, `${getKeyName(bindings.jump)} = Jump  |  ${getKeyName(bindings.duck)} = Duck`, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: "#ffffff",
        });
        this.controlTexts.push(actVal);
      }
    }
  }

  private addSettingsButton(_leftCenterX: number, _height: number) {
    const { width } = this.scale;
    const gearX = width - 78;
    const gearY = 20;

    const gearBg = this.add.rectangle(gearX, gearY, 36, 36, 0x16213e, 0.9);
    gearBg.setStrokeStyle(2, 0x0f3460);
    gearBg.setInteractive({ useHandCursor: true });

    const gearIcon = this.add.text(gearX, gearY, "⚙", {
      fontSize: "22px",
      fontFamily: "monospace",
      color: "#aaaacc",
    }).setOrigin(0.5);

    gearBg.on("pointerover", () => {
      gearBg.setFillStyle(0x1e2d4a, 1);
      gearIcon.setColor("#ffffff");
    });
    gearBg.on("pointerout", () => {
      gearBg.setFillStyle(0x16213e, 0.9);
      gearIcon.setColor("#aaaacc");
    });
    gearBg.on("pointerdown", () => {
      if (!this.settingsOpen) this.openSettings();
    });
  }

  private addShopButton(leftCenterX: number, height: number) {
    const shopX = leftCenterX;
    const shopY = height * 0.32;

    const btnWidth = 110;
    const btnHeight = 36;

    const shopBg = this.add.rectangle(shopX, shopY, btnWidth, btnHeight, 0x16213e, 0.9);
    shopBg.setStrokeStyle(2, 0x0f3460);
    shopBg.setInteractive({ useHandCursor: true });

    const shopIcon = this.add.text(shopX - 24, shopY, "🛒", {
      fontSize: "18px",
    }).setOrigin(0.5);

    const shopLabel = this.add.text(shopX + 10, shopY, "Shop", {
      fontSize: "14px",
      fontFamily: "Arial, sans-serif",
      color: "#e0e0e0",
      fontStyle: "bold",
    }).setOrigin(0.5);

    shopBg.on("pointerover", () => {
      shopBg.setFillStyle(0x1e2d4a, 1);
      shopLabel.setColor("#ffffff");
    });
    shopBg.on("pointerout", () => {
      shopBg.setFillStyle(0x16213e, 0.9);
      shopLabel.setColor("#e0e0e0");
    });
    shopBg.on("pointerdown", () => {
      if (!this.settingsOpen) this.scene.start("ShopScene");
    });
  }

  private addStatsButton(_leftCenterX: number, _height: number) {
    const { width } = this.scale;
    const statsX = width - 38;
    const statsY = 20;

    const statsBg = this.add.rectangle(statsX, statsY, 36, 36, 0x16213e, 0.9);
    statsBg.setStrokeStyle(2, 0x0f3460);
    statsBg.setInteractive({ useHandCursor: true });

    const statsIcon = this.add.text(statsX, statsY, "\u{1F4CA}", {
      fontSize: "20px",
    }).setOrigin(0.5);

    statsBg.on("pointerover", () => {
      statsBg.setFillStyle(0x1e2d4a, 1);
    });
    statsBg.on("pointerout", () => {
      statsBg.setFillStyle(0x16213e, 0.9);
    });
    statsBg.on("pointerdown", () => {
      if (!this.settingsOpen && !this.statsOpen) this.openStats();
    });
  }

  private openStats() {
    this.statsOpen = true;
    const { width, height } = this.scale;
    const modalW = 360;
    const modalH = 280;
    const modalX = width / 2;
    const modalY = height / 2;

    this.statsOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.statsOverlay.setInteractive();

    this.statsModalBg = this.add.rectangle(modalX, modalY, modalW, modalH, getBgColor().hex, 1);
    this.statsModalBg.setStrokeStyle(2, 0xe94560);

    const titleText = this.add.text(modalX, modalY - modalH / 2 + 24, "ALL-TIME STATS", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.statsDynamicObjects.push(titleText);

    const closeBtn = this.add.text(modalX + modalW / 2 - 20, modalY - modalH / 2 + 12, "\u2715", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.statsDynamicObjects.push(closeBtn);
    closeBtn.on("pointerover", () => closeBtn.setColor("#ffffff"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#888888"));
    closeBtn.on("pointerdown", () => this.closeStats());

    const stats = getStats();
    const leftX = modalX - modalW / 2 + 30;
    const rightX = modalX + modalW / 2 - 30;
    let curY = modalY - modalH / 2 + 64;
    const rowH = 40;

    const statRows: { label: string; value: number; color: string }[] = [
      { label: "Coins Earned", value: stats.totalCoinsEarned, color: "#ffd700" },
      { label: "Coins Spent", value: stats.totalCoinsSpent, color: "#ff8844" },
      { label: "Total Deaths", value: stats.totalDeaths, color: "#ff4444" },
      { label: "Levels Completed", value: stats.totalLevelCompletions, color: "#00ff88" },
    ];

    statRows.forEach((row) => {
      const labelText = this.add.text(leftX, curY, row.label, {
        fontSize: "15px",
        fontFamily: "monospace",
        color: "#cccccc",
      }).setOrigin(0, 0.5);
      this.statsDynamicObjects.push(labelText);

      const valueText = this.add.text(rightX, curY, row.value.toLocaleString(), {
        fontSize: "18px",
        fontFamily: "monospace",
        color: row.color,
        fontStyle: "bold",
      }).setOrigin(1, 0.5);
      this.statsDynamicObjects.push(valueText);

      curY += rowH;
    });

    const divider = this.add.rectangle(modalX, curY + 4, modalW - 60, 1, 0x444466, 0.5);
    this.statsDynamicObjects.push(divider);
  }

  private closeStats() {
    this.statsOpen = false;
    this.statsDynamicObjects.forEach(obj => obj.destroy());
    this.statsDynamicObjects = [];
    if (this.statsOverlay) {
      this.statsOverlay.destroy();
      this.statsOverlay = null;
    }
    if (this.statsModalBg) {
      this.statsModalBg.destroy();
      this.statsModalBg = null;
    }
  }

  private async openMyMaps() {
    this.myMapsOpen = true;
    const { width, height } = this.scale;
    const modalW = 420;
    const modalH = 360;
    const modalX = width / 2;
    const modalY = height / 2;

    this.myMapsOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.myMapsOverlay.setInteractive();

    this.myMapsModalBg = this.add.rectangle(modalX, modalY, modalW, modalH, getBgColor().hex, 1);
    this.myMapsModalBg.setStrokeStyle(2, 0xe94560);

    this.renderMyMapsHeader(modalX, modalY, modalW, modalH);

    const loadingText = this.add.text(modalX, modalY, "Loading...", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#aaaaaa",
    }).setOrigin(0.5);
    this.myMapsDynamicObjects.push(loadingText);

    try {
      const res = await apiRequest("/user/maps");
      if (!res.ok) {
        loadingText.setText("Failed to load maps");
        return;
      }
      const data = await res.json();
      this.myMapsData = data.maps || [];
      this.myMapsPage = 0;
      this.renderMyMapsPage(modalX, modalY, modalW, modalH);
    } catch {
      loadingText.setText("Network error");
    }
  }

  private renderMyMapsHeader(modalX: number, modalY: number, modalW: number, modalH: number) {
    const titleText = this.add.text(modalX, modalY - modalH / 2 + 24, "MY MAPS", {
      fontSize: "20px", fontFamily: "monospace", color: "#e94560", fontStyle: "bold",
    }).setOrigin(0.5);
    this.myMapsDynamicObjects.push(titleText);

    const closeBtnBg = this.add.rectangle(modalX + modalW / 2 - 18, modalY - modalH / 2 + 18, 28, 28, 0xe94560, 1).setStrokeStyle(1, 0xffffff).setDepth(50).setInteractive({ useHandCursor: true });
    const closeBtn = this.add.text(modalX + modalW / 2 - 18, modalY - modalH / 2 + 18, "\u2715", {
      fontSize: "18px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(51);
    this.myMapsDynamicObjects.push(closeBtnBg);
    this.myMapsDynamicObjects.push(closeBtn);
    closeBtnBg.on("pointerover", () => closeBtnBg.setFillStyle(0xff6680));
    closeBtnBg.on("pointerout", () => closeBtnBg.setFillStyle(0xe94560));
    closeBtnBg.on("pointerdown", () => this.closeMyMaps());
  }

  private renderMyMapsPage(modalX: number, modalY: number, modalW: number, modalH: number) {
    this.myMapsDynamicObjects.forEach(obj => obj.destroy());
    this.myMapsDynamicObjects = [];

    this.renderMyMapsHeader(modalX, modalY, modalW, modalH);

    const maps = this.myMapsData;

    if (maps.length === 0) {
      const emptyText = this.add.text(modalX, modalY, "No saved maps yet.\nCreate one with the Create Map button!", {
        fontSize: "13px", fontFamily: "monospace", color: "#888888", align: "center",
      }).setOrigin(0.5);
      this.myMapsDynamicObjects.push(emptyText);
      return;
    }

    const perPage = 6;
    const totalPages = Math.ceil(maps.length / perPage);
    const page = this.myMapsPage;
    const startIdx = page * perPage;
    const endIdx = Math.min(startIdx + perPage, maps.length);

    const rowH = 44;
    const listStartY = modalY - modalH / 2 + 56;

    for (let i = startIdx; i < endIdx; i++) {
      const map = maps[i];
      const row = i - startIdx;
      const ry = listStartY + row * rowH;

      const rowBg = this.add.rectangle(modalX, ry + rowH / 2, modalW - 30, rowH - 4, 0x16213e, 0.8);
      rowBg.setStrokeStyle(1, 0x0f3460);
      this.myMapsDynamicObjects.push(rowBg);

      const nameText = this.add.text(modalX - modalW / 2 + 30, ry + rowH / 2, map.name, {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#cccccc",
      }).setOrigin(0, 0.5);
      this.myMapsDynamicObjects.push(nameText);

      const playBtn = this.add.text(modalX + modalW / 2 - 40, ry + rowH / 2 - 8, "▶", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#00ff88",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.myMapsDynamicObjects.push(playBtn);

      playBtn.on("pointerover", () => playBtn.setColor("#ffffff"));
      playBtn.on("pointerout", () => playBtn.setColor("#00ff88"));
      playBtn.on("pointerdown", () => {
        this.playCustomMap(map.id);
      });

      const editBtn = this.add.text(modalX + modalW / 2 - 70, ry + rowH / 2 - 8, "✎", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffcc00",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.myMapsDynamicObjects.push(editBtn);

      editBtn.on("pointerover", () => editBtn.setColor("#ffffff"));
      editBtn.on("pointerout", () => editBtn.setColor("#ffcc00"));
      editBtn.on("pointerdown", () => {
        this.editCustomMap(map.id);
      });

      const delBtn = this.add.text(modalX + modalW / 2 - 100, ry + rowH / 2 - 8, "✕", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#ff4444",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.myMapsDynamicObjects.push(delBtn);

      delBtn.on("pointerover", () => delBtn.setColor("#ffffff"));
      delBtn.on("pointerout", () => delBtn.setColor("#ff4444"));
      delBtn.on("pointerdown", async () => {
        const confirmed = window.confirm(`Delete "${map.name}"?`);
        if (!confirmed) return;
        try {
          await apiRequest(`/user/maps/${map.id}`, { method: "DELETE" });
          this.myMapsData = this.myMapsData.filter(m => m.id !== map.id);
          if (this.myMapsPage > 0 && this.myMapsPage * perPage >= this.myMapsData.length) {
            this.myMapsPage--;
          }
          this.renderMyMapsPage(modalX, modalY, modalW, modalH);
        } catch {}
      });

      const actionLabels = this.add.text(modalX + modalW / 2 - 70, ry + rowH / 2 + 10, "del  edit  play", {
        fontSize: "8px",
        fontFamily: "monospace",
        color: "#666666",
      }).setOrigin(0.5);
      this.myMapsDynamicObjects.push(actionLabels);
    }

    if (totalPages > 1) {
      const navY = listStartY + perPage * rowH + 10;

      const pageText = this.add.text(modalX, navY, `Page ${page + 1} of ${totalPages}`, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#aaaaaa",
      }).setOrigin(0.5);
      this.myMapsDynamicObjects.push(pageText);

      if (page > 0) {
        const prevBtn = this.add.text(modalX - 80, navY, "< Prev", {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#88aaff",
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.myMapsDynamicObjects.push(prevBtn);
        prevBtn.on("pointerover", () => prevBtn.setColor("#ffffff"));
        prevBtn.on("pointerout", () => prevBtn.setColor("#88aaff"));
        prevBtn.on("pointerdown", () => {
          this.myMapsPage--;
          this.renderMyMapsPage(modalX, modalY, modalW, modalH);
        });
      }

      if (page < totalPages - 1) {
        const nextBtn = this.add.text(modalX + 80, navY, "Next >", {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#88aaff",
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.myMapsDynamicObjects.push(nextBtn);
        nextBtn.on("pointerover", () => nextBtn.setColor("#ffffff"));
        nextBtn.on("pointerout", () => nextBtn.setColor("#88aaff"));
        nextBtn.on("pointerdown", () => {
          this.myMapsPage++;
          this.renderMyMapsPage(modalX, modalY, modalW, modalH);
        });
      }
    }
  }

  private closeMyMaps() {
    this.myMapsOpen = false;
    this.myMapsDynamicObjects.forEach(obj => obj.destroy());
    this.myMapsDynamicObjects = [];
    if (this.myMapsOverlay) {
      this.myMapsOverlay.destroy();
      this.myMapsOverlay = null;
    }
    if (this.myMapsModalBg) {
      this.myMapsModalBg.destroy();
      this.myMapsModalBg = null;
    }
  }

  private async playCustomMap(mapId: number) {
    try {
      const res = await apiRequest(`/user/maps/${mapId}`);
      if (!res.ok) return;
      const data = await res.json();
      const map = data.map;
      const tiles = JSON.parse(map.tileData);
      const seed = Math.floor(Math.random() * 2147483646) + 1;

      const customMapPayload = {
        tiles,
        bgColor: map.bgColor || "#1a1a2e",
        groundColor: map.groundColor || "#3a3a3a",
        platformColor: map.platformColor || "#4a4a4a",
      };

      if (this.gameMode === "online") {
        onlineManager.sendWorldSelect(0, seed, customMapPayload);
      }

      this.closeMyMaps();
      this.scene.start("WarningScene", {
        worldIndex: 0,
        deaths: 0,
        startTime: Date.now(),
        gameMode: this.gameMode,
        levelSeed: seed,
        customTiles: tiles,
        customBgColor: map.bgColor,
        customGroundColor: map.groundColor,
        customPlatformColor: map.platformColor,
      });
    } catch {}
  }

  private async editCustomMap(mapId: number) {
    try {
      const res = await apiRequest(`/user/maps/${mapId}`);
      if (!res.ok) return;
      const data = await res.json();
      const map = data.map;

      this.closeMyMaps();
      this.scene.start("MapEditorScene", {
        gameMode: this.gameMode,
        mapId: map.id,
        mapName: map.name,
        tileData: map.tileData,
        bgColor: map.bgColor,
        groundColor: map.groundColor,
        platformColor: map.platformColor,
      });
    } catch {}
  }

  private getModalDimensions() {
    const modalW = 440;
    const modalH = 460;
    return { modalW, modalH };
  }

  private openSettings() {
    this.settingsOpen = true;
    const { width, height } = this.scale;
    const { modalW, modalH } = this.getModalDimensions();
    const modalX = width / 2;
    const modalY = height / 2;

    this.settingsOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.settingsOverlay.setInteractive();

    this.settingsModalBg = this.add.rectangle(modalX, modalY, modalW, modalH, getBgColor().hex, 1);
    this.settingsModalBg.setStrokeStyle(2, 0xe94560);

    this.renderDynamicSettingsContent(modalX, modalY, modalW, modalH);
  }

  private renderDynamicSettingsContent(modalX: number, modalY: number, modalW: number, modalH: number) {
    this.settingsDynamicObjects.forEach(obj => obj.destroy());
    this.settingsDynamicObjects = [];

    const titleText = this.add.text(modalX, modalY - modalH / 2 + 24, "SETTINGS", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(titleText);

    const closeBtn = this.add.text(modalX + modalW / 2 - 20, modalY - modalH / 2 + 12, "✕", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#888888",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.settingsDynamicObjects.push(closeBtn);
    closeBtn.on("pointerover", () => closeBtn.setColor("#ffffff"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#888888"));
    closeBtn.on("pointerdown", () => this.closeSettings());

    let curY = modalY - modalH / 2 + 52;
    const leftX = modalX - modalW / 2 + 30;

    const settings = getSettings();
    const musicLabel = this.add.text(leftX, curY, "Music:", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#cccccc",
    }).setOrigin(0, 0.5);
    this.settingsDynamicObjects.push(musicLabel);

    const musicToggleBg = this.add.rectangle(modalX + modalW / 2 - 80, curY, 90, 24, settings.musicEnabled ? 0x00aa44 : 0x662222, 0.9);
    musicToggleBg.setStrokeStyle(1, settings.musicEnabled ? 0x00ff66 : 0xff4444);
    musicToggleBg.setInteractive({ useHandCursor: true });
    this.settingsDynamicObjects.push(musicToggleBg);

    const musicToggleLabel = this.add.text(modalX + modalW / 2 - 80, curY, settings.musicEnabled ? "ON" : "OFF", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(musicToggleLabel);

    musicToggleBg.on("pointerdown", () => {
      const newVal = !getSettings().musicEnabled;
      setMusicEnabled(newVal);
      toggleMusic(newVal);
      this.refreshSettingsModal();
    });

    curY += 30;

    const bgLabel = this.add.text(leftX, curY, "Background:", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#cccccc",
    }).setOrigin(0, 0.5);
    this.settingsDynamicObjects.push(bgLabel);

    const swatchSize = 22;
    const swatchGap = 6;
    const swatchStartX = modalX + modalW / 2 - 30 - (BG_PRESETS.length - 1) * (swatchSize + swatchGap);
    BG_PRESETS.forEach((preset, i) => {
      const sx = swatchStartX + i * (swatchSize + swatchGap);
      const isSelected = i === settings.bgColorIndex;

      if (isSelected) {
        const indicator = this.add.rectangle(sx, curY, swatchSize + 4, swatchSize + 4, 0xffffff, 1);
        this.settingsDynamicObjects.push(indicator);
      }

      const swatch = this.add.rectangle(sx, curY, swatchSize, swatchSize, preset.hex);
      swatch.setStrokeStyle(1, 0x666666);
      swatch.setInteractive({ useHandCursor: true });
      this.settingsDynamicObjects.push(swatch);

      swatch.on("pointerdown", () => {
        setBgColorIndex(i);
        this.cameras.main.setBackgroundColor(preset.value);
        if (this.settingsModalBg) {
          this.settingsModalBg.setFillStyle(preset.hex, 1);
        }
        this.refreshSettingsModal();
      });
    });

    curY += 32;

    const inputModeLabel = this.add.text(leftX, curY, "Input Mode:", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#cccccc",
    }).setOrigin(0, 0.5);
    this.settingsDynamicObjects.push(inputModeLabel);

    const currentMode = getInputMode();
    const kbBtnX = modalX + modalW / 2 - 120;
    const mbBtnX = modalX + modalW / 2 - 50;

    const kbBg = this.add.rectangle(kbBtnX, curY, 64, 24, currentMode === "keyboard" ? 0x00aa44 : 0x333344, 0.9);
    kbBg.setStrokeStyle(1, currentMode === "keyboard" ? 0x00ff66 : 0x666688);
    kbBg.setInteractive({ useHandCursor: true });
    this.settingsDynamicObjects.push(kbBg);

    const kbLabel = this.add.text(kbBtnX, curY, "KB", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(kbLabel);

    const mbBg = this.add.rectangle(mbBtnX, curY, 64, 24, currentMode === "mobile" ? 0x00aa44 : 0x333344, 0.9);
    mbBg.setStrokeStyle(1, currentMode === "mobile" ? 0x00ff66 : 0x666688);
    mbBg.setInteractive({ useHandCursor: true });
    this.settingsDynamicObjects.push(mbBg);

    const mbLabel = this.add.text(mbBtnX, curY, "Mobile", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(mbLabel);

    kbBg.on("pointerdown", () => {
      setInputMode("keyboard");
      this.refreshSettingsModal();
      this.refreshControlsBox();
    });
    mbBg.on("pointerdown", () => {
      setInputMode("mobile");
      this.refreshSettingsModal();
      this.refreshControlsBox();
    });

    curY += 30;

    const divider = this.add.rectangle(modalX, curY, modalW - 40, 1, 0x444466, 0.5);
    this.settingsDynamicObjects.push(divider);

    curY += 14;

    const controlsHeader = this.add.text(modalX, curY, "CONTROLS", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(controlsHeader);

    curY += 20;

    const isMobileMode = getInputMode() === "mobile";

    if (isMobileMode) {
      const flipLabel = this.add.text(modalX - 60, curY, "Flip Controls", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#cccccc",
      }).setOrigin(0, 0.5);
      this.settingsDynamicObjects.push(flipLabel);

      const flipped = getControlsFlipped();
      const flipBtnW = 50;
      const flipBtnX = modalX + 60;
      const flipBg = this.add.rectangle(flipBtnX, curY, flipBtnW, 26, flipped ? 0x44bb44 : 0x0f3460, 0.9);
      flipBg.setStrokeStyle(1, flipped ? 0x66dd66 : 0x4488ff);
      flipBg.setInteractive({ useHandCursor: true });
      this.settingsDynamicObjects.push(flipBg);

      const flipText = this.add.text(flipBtnX, curY, flipped ? "ON" : "OFF", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.settingsDynamicObjects.push(flipText);

      flipBg.on("pointerdown", () => {
        setControlsFlipped(!flipped);
        this.refreshSettingsModal();
        this.refreshControlsBox();
      });

      curY += 30;

      const layoutDesc = this.add.text(modalX, curY, flipped
        ? "Left: Jump / Duck    Right: Move"
        : "Left: Move    Right: Jump / Duck", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#888899",
      }).setOrigin(0.5);
      this.settingsDynamicObjects.push(layoutDesc);
    } else {
      const bindings = getBindings("single");
      const actionLabels: Record<keyof ControlBindings, string> = {
        left: "Move Left",
        right: "Move Right",
        jump: "Jump",
        duck: "Duck",
      };

      const actions: (keyof ControlBindings)[] = ["left", "right", "jump", "duck"];
      actions.forEach((action, i) => {
        const rowY = curY + i * 34;
        this.renderBindingRow(modalX, rowY, modalW, action, actionLabels[action], bindings[action]);
      });

      const resetBtn = this.createButton(
        modalX, modalY + modalH / 2 - 28, 180, 28,
        "Reset Controls", "#ffcc00", getBgColor().uiColor, 0x0f3460
      );
      resetBtn.forEach(obj => this.settingsDynamicObjects.push(obj));
      (resetBtn[0] as Phaser.GameObjects.Rectangle).on("pointerdown", () => {
        resetBindings("single");
        this.refreshSettingsModal();
        this.refreshControlsBox();
      });
    }
  }

  private renderBindingRow(
    modalX: number,
    rowY: number,
    modalW: number,
    action: keyof ControlBindings,
    label: string,
    keyCode: number
  ) {
    const labelX = modalX - modalW / 2 + 40;
    const keyBtnX = modalX + modalW / 2 - 90;

    const actionLabel = this.add.text(labelX, rowY, label, {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#cccccc",
    }).setOrigin(0, 0.5);
    this.settingsDynamicObjects.push(actionLabel);

    const isWaiting = this.waitingForKey === action;
    const keyDisplayText = isWaiting ? "Press a key..." : getKeyName(keyCode);

    const keyBtnBg = this.add.rectangle(keyBtnX, rowY, 120, 28, isWaiting ? 0xe94560 : 0x0f3460, 0.9);
    keyBtnBg.setStrokeStyle(1, isWaiting ? 0xff6688 : 0x4488ff);
    keyBtnBg.setInteractive({ useHandCursor: true });
    this.settingsDynamicObjects.push(keyBtnBg);

    const keyLabel = this.add.text(keyBtnX, rowY, keyDisplayText, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: isWaiting ? "#ffffff" : "#4488ff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.settingsDynamicObjects.push(keyLabel);

    keyBtnBg.on("pointerdown", () => {
      this.startListeningForKey(action);
    });
  }

  private startListeningForKey(action: keyof ControlBindings) {
    this.removeKeyListener();
    this.waitingForKey = action;
    this.clearError();

    this.refreshSettingsModal();

    this.keyListener = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const keyCode = event.keyCode;

      if (isReservedKey(keyCode)) {
        this.showError("That key is reserved (ESC/P/Enter)");
        return;
      }

      const bindings = getBindings("single");
      const actions = Object.keys(bindings) as (keyof ControlBindings)[];
      for (const a of actions) {
        if (a !== action && bindings[a] === keyCode) {
          this.showError(`Already used for ${a}`);
          return;
        }
      }

      this.removeKeyListener();
      this.waitingForKey = null;
      this.clearError();

      setBinding("single", action, keyCode);
      this.refreshSettingsModal();
      this.refreshControlsBox();
    };

    window.addEventListener("keydown", this.keyListener, { capture: true });
  }

  private removeKeyListener() {
    if (this.keyListener) {
      window.removeEventListener("keydown", this.keyListener, { capture: true });
      this.keyListener = null;
    }
  }

  private showError(msg: string) {
    this.clearError();
    const { width, height } = this.scale;
    const { modalH } = this.getModalDimensions();
    this.errorText = this.add.text(width / 2, height / 2 + modalH / 2 - 50, msg, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ff4444",
      fontStyle: "bold",
      backgroundColor: "#000000",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(10);

    this.errorTimer = this.time.delayedCall(2500, () => {
      this.clearError();
    });
  }

  private clearError() {
    if (this.errorTimer) {
      this.errorTimer.destroy();
      this.errorTimer = null;
    }
    if (this.errorText) {
      this.errorText.destroy();
      this.errorText = null;
    }
  }

  private refreshSettingsModal() {
    const { width, height } = this.scale;
    const { modalW, modalH } = this.getModalDimensions();
    const modalX = width / 2;
    const modalY = height / 2;

    this.clearError();
    this.renderDynamicSettingsContent(modalX, modalY, modalW, modalH);
  }

  private refreshControlsBox() {
    const { height } = this.scale;
    const leftCenterX = this.scale.width / 2 - 100;
    this.renderControlsBox(leftCenterX, height);
  }

  private closeSettings() {
    this.removeKeyListener();
    this.waitingForKey = null;
    this.settingsOpen = false;
    this.clearError();
    this.settingsDynamicObjects.forEach(obj => obj.destroy());
    this.settingsDynamicObjects = [];
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy();
      this.settingsOverlay = null;
    }
    if (this.settingsModalBg) {
      this.settingsModalBg.destroy();
      this.settingsModalBg = null;
    }
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    text: string, textColor: string, bgColor: number, strokeColor: number
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.9);
    bg.setStrokeStyle(2, strokeColor);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, text, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: textColor,
      fontStyle: "bold",
    }).setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(0x1e2d4a, 1);
      label.setColor("#ffffff");
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(bgColor, 0.9);
      label.setColor(textColor);
    });

    return [bg, label];
  }
}
