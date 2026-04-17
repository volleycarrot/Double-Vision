import Phaser from "phaser";
import { apiRequest, isLoggedIn } from "../AuthManager";
import { getBgColor } from "../GameSettings";
import type { GameMode } from "./ModeSelectScene";

interface GalleryMap {
  id: number;
  name: string;
  bgColor: string;
  groundColor: string;
  platformColor: string;
  creatorUsername: string;
  likeCount: number;
  likedByMe: boolean;
}

const PER_PAGE = 6;

export class BrowseMapScene extends Phaser.Scene {
  private gameMode: GameMode = "single";
  private fromScene: string = "TitleScene";
  private maps: GalleryMap[] = [];
  private page = 0;
  private searchQuery = "";
  private isLoading = false;
  private pendingSearch: string | null = null;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private searchInput: HTMLInputElement | null = null;

  constructor() {
    super({ key: "BrowseMapScene" });
  }

  create(data: { gameMode?: GameMode; from?: string }) {
    this.gameMode = data?.gameMode || "single";
    this.fromScene = data?.from || "TitleScene";
    this.maps = [];
    this.page = 0;
    this.searchQuery = "";
    this.isLoading = false;
    this.pendingSearch = null;
    this.dynamicObjects = [];
    this.searchInput = null;

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(getBgColor().value);

    this.buildStaticUI(width, height);
    this.buildSearchInput(width, height);
    this.fetchMaps();
  }

  private buildStaticUI(width: number, height: number) {
    const headerBg = this.add.rectangle(width / 2, 28, width, 56, 0x111122, 0.97);
    headerBg.setDepth(10);

    this.add.text(width / 2, 28, "BROWSE MAPS", {
      fontSize: "22px",
      fontFamily: "monospace",
      color: "#e94560",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(11);

    const backBtn = this.add.text(14, 28, "< Back", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#cccccc",
      backgroundColor: "#222244",
      padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(12);

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#cccccc"));
    backBtn.on("pointerdown", () => {
      this.cleanupInput();
      this.scene.start(this.fromScene, { gameMode: this.gameMode });
    });

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on("down", () => {
      this.cleanupInput();
      this.scene.start(this.fromScene, { gameMode: this.gameMode });
    });

    this.events.on("shutdown", () => {
      this.cleanupInput();
    });
  }

  private buildSearchInput(width: number, _height: number) {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = "Search by map name or creator...";
    inputEl.style.cssText = `
      width: 300px;
      padding: 6px 12px;
      background: #16213e;
      border: 1px solid #4488ff;
      color: #ffffff;
      font-family: monospace;
      font-size: 13px;
      outline: none;
      border-radius: 2px;
    `;
    this.searchInput = inputEl;

    const gameCanvas = this.sys.game.canvas;
    const container = gameCanvas.parentElement;
    if (!container) return;

    const wrapper = document.createElement("div");
    wrapper.id = "browse-search-wrapper";
    wrapper.style.cssText = `
      position: absolute;
      pointer-events: auto;
      z-index: 100;
    `;
    wrapper.appendChild(inputEl);
    container.appendChild(wrapper);

    this.repositionInput(width);

    inputEl.addEventListener("input", () => {
      this.searchQuery = inputEl.value;
      this.page = 0;
      this.fetchMaps();
    });

    inputEl.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });
  }

  private repositionInput(width: number) {
    const wrapper = document.getElementById("browse-search-wrapper");
    if (!wrapper) return;

    const gameCanvas = this.sys.game.canvas;
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = rect.width / 800;
    const scaleY = rect.height / 480;

    const inputX = (width / 2 - 150) * scaleX + rect.left;
    const inputY = 56 * scaleY + rect.top;

    wrapper.style.left = `${inputX}px`;
    wrapper.style.top = `${inputY}px`;
    wrapper.style.transform = `scale(${scaleX})`;
    wrapper.style.transformOrigin = "top left";
  }

  private cleanupInput() {
    const wrapper = document.getElementById("browse-search-wrapper");
    if (wrapper) wrapper.remove();
    this.searchInput = null;
  }

  private async fetchMaps() {
    if (this.isLoading) {
      this.pendingSearch = this.searchQuery;
      return;
    }
    this.isLoading = true;
    this.pendingSearch = null;

    const queryAtStart = this.searchQuery;
    this.clearDynamic();
    this.showLoading();

    let stale = false;
    let error = false;

    try {
      const params = queryAtStart.length > 0
        ? `?search=${encodeURIComponent(queryAtStart)}`
        : "";
      const res = await apiRequest(`/maps/gallery${params}`);

      if (queryAtStart !== this.searchQuery) {
        stale = true;
      } else if (!res.ok) {
        error = true;
      } else {
        const data = await res.json();
        this.maps = data.maps || [];
        this.page = 0;
      }
    } catch {
      if (queryAtStart !== this.searchQuery) {
        stale = true;
      } else {
        error = true;
      }
    } finally {
      this.isLoading = false;
    }

    if (stale || this.pendingSearch !== null) {
      this.fetchMaps();
      return;
    }

    if (error) {
      this.clearDynamic();
      this.showError("Network error. Check your connection.");
      return;
    }

    this.renderPage();
  }

  private showLoading() {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2, "Loading...", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#aaaaaa",
    }).setOrigin(0.5);
    this.dynamicObjects.push(t);
  }

  private showError(msg: string) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2, msg, {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ff4444",
    }).setOrigin(0.5);
    this.dynamicObjects.push(t);
  }

  private clearDynamic() {
    this.dynamicObjects.forEach(o => o.destroy());
    this.dynamicObjects = [];
  }

  private renderPage() {
    this.clearDynamic();

    const { width, height } = this.scale;
    const totalPages = Math.ceil(this.maps.length / PER_PAGE);

    if (this.maps.length === 0) {
      const msg = this.searchQuery
        ? `No maps found for "${this.searchQuery}"`
        : "No public maps yet. Be the first to publish one!";

      const t = this.add.text(width / 2, height / 2, msg, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#888888",
        align: "center",
        wordWrap: { width: 500 },
      }).setOrigin(0.5);
      this.dynamicObjects.push(t);
      return;
    }

    const listTop = 108;
    const rowH = 52;
    const startIdx = this.page * PER_PAGE;
    const endIdx = Math.min(startIdx + PER_PAGE, this.maps.length);
    const listLeft = 20;
    const listRight = width - 20;
    const rowW = listRight - listLeft;

    for (let i = startIdx; i < endIdx; i++) {
      const map = this.maps[i];
      const row = i - startIdx;
      const ry = listTop + row * rowH;

      const rowBg = this.add.rectangle(width / 2, ry + rowH / 2 - 2, rowW, rowH - 6, 0x16213e, 0.85);
      rowBg.setStrokeStyle(1, 0x0f3460);
      this.dynamicObjects.push(rowBg);

      const nameText = this.add.text(listLeft + 12, ry + 10, map.name, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#e8e8e8",
        fontStyle: "bold",
      }).setOrigin(0, 0);
      this.dynamicObjects.push(nameText);

      const creatorText = this.add.text(listLeft + 12, ry + 28, `by ${map.creatorUsername}`, {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#7788aa",
      }).setOrigin(0, 0);
      this.dynamicObjects.push(creatorText);

      const likeColor = map.likedByMe ? "#ff6688" : "#888888";
      const likeIcon = map.likedByMe ? "♥" : "♡";
      const likeText = this.add.text(listRight - 180, ry + rowH / 2 - 2, `${likeIcon} ${map.likeCount}`, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: likeColor,
      }).setOrigin(0.5);
      this.dynamicObjects.push(likeText);

      if (isLoggedIn()) {
        likeText.setInteractive({ useHandCursor: true });
        likeText.on("pointerover", () => likeText.setColor("#ffffff"));
        likeText.on("pointerout", () => likeText.setColor(map.likedByMe ? "#ff6688" : "#888888"));
        likeText.on("pointerdown", () => this.toggleLike(map, likeText));
      } else {
        const hintBg = this.add.rectangle(listRight - 180, ry + rowH / 2 - 2, 80, 24, 0x333355, 0.9);
        hintBg.setInteractive({ useHandCursor: true });
        this.dynamicObjects.push(hintBg);
        hintBg.on("pointerdown", () => this.showLoginHint(width, height));
        likeText.setInteractive({ useHandCursor: true });
        likeText.on("pointerdown", () => this.showLoginHint(width, height));
      }

      const playBtnBg = this.add.rectangle(listRight - 90, ry + rowH / 2 - 2, 70, 30, 0x00aa44, 1);
      playBtnBg.setStrokeStyle(1, 0x00ff66);
      playBtnBg.setInteractive({ useHandCursor: true });
      this.dynamicObjects.push(playBtnBg);

      const playBtnLabel = this.add.text(listRight - 90, ry + rowH / 2 - 2, "▶ Play", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.dynamicObjects.push(playBtnLabel);

      playBtnBg.on("pointerover", () => { playBtnBg.setFillStyle(0x00cc55, 1); });
      playBtnBg.on("pointerout", () => { playBtnBg.setFillStyle(0x00aa44, 1); });
      playBtnBg.on("pointerdown", () => this.playMap(map));
    }

    const navY = listTop + PER_PAGE * rowH + 8;

    if (totalPages > 1) {
      const pageText = this.add.text(width / 2, navY + 10, `${this.page + 1} / ${totalPages}`, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#aaaaaa",
      }).setOrigin(0.5);
      this.dynamicObjects.push(pageText);

      if (this.page > 0) {
        const prevBg = this.add.rectangle(width / 2 - 80, navY + 10, 100, 28, 0x0f3460, 0.9);
        prevBg.setStrokeStyle(1, 0x4488ff);
        prevBg.setInteractive({ useHandCursor: true });
        this.dynamicObjects.push(prevBg);

        const prevLabel = this.add.text(width / 2 - 80, navY + 10, "< Prev", {
          fontSize: "12px", fontFamily: "monospace", color: "#88aaff",
        }).setOrigin(0.5);
        this.dynamicObjects.push(prevLabel);

        prevBg.on("pointerover", () => { prevBg.setFillStyle(0x1e2d4a); prevLabel.setColor("#ffffff"); });
        prevBg.on("pointerout", () => { prevBg.setFillStyle(0x0f3460); prevLabel.setColor("#88aaff"); });
        prevBg.on("pointerdown", () => { this.page--; this.renderPage(); });
      }

      if (this.page < totalPages - 1) {
        const nextBg = this.add.rectangle(width / 2 + 80, navY + 10, 100, 28, 0x0f3460, 0.9);
        nextBg.setStrokeStyle(1, 0x4488ff);
        nextBg.setInteractive({ useHandCursor: true });
        this.dynamicObjects.push(nextBg);

        const nextLabel = this.add.text(width / 2 + 80, navY + 10, "Next >", {
          fontSize: "12px", fontFamily: "monospace", color: "#88aaff",
        }).setOrigin(0.5);
        this.dynamicObjects.push(nextLabel);

        nextBg.on("pointerover", () => { nextBg.setFillStyle(0x1e2d4a); nextLabel.setColor("#ffffff"); });
        nextBg.on("pointerout", () => { nextBg.setFillStyle(0x0f3460); nextLabel.setColor("#88aaff"); });
        nextBg.on("pointerdown", () => { this.page++; this.renderPage(); });
      }
    }
  }

  private showLoginHint(width: number, height: number) {
    const existing = this.children.getByName("login-hint");
    if (existing) return;

    const bg = this.add.rectangle(width / 2, height - 40, 360, 32, 0x222244, 0.95)
      .setStrokeStyle(1, 0x4488ff)
      .setName("login-hint")
      .setDepth(50);

    const t = this.add.text(width / 2, height - 40, "Log in to like maps!", {
      fontSize: "13px", fontFamily: "monospace", color: "#aabbff",
    }).setOrigin(0.5).setDepth(51).setName("login-hint-text");

    this.time.delayedCall(2000, () => {
      bg.destroy();
      t.destroy();
    });
  }

  private async toggleLike(map: GalleryMap, likeText: Phaser.GameObjects.Text) {
    if (!isLoggedIn()) return;

    const wasLiked = map.likedByMe;
    map.likedByMe = !wasLiked;
    map.likeCount += wasLiked ? -1 : 1;

    const icon = map.likedByMe ? "♥" : "♡";
    likeText.setText(`${icon} ${map.likeCount}`);
    likeText.setColor(map.likedByMe ? "#ff6688" : "#888888");

    try {
      const method = wasLiked ? "DELETE" : "POST";
      const res = await apiRequest(`/maps/${map.id}/like`, { method });
      if (res.ok) {
        const data = await res.json();
        map.likeCount = data.likeCount;
        map.likedByMe = data.likedByMe;
        const icon2 = map.likedByMe ? "♥" : "♡";
        likeText.setText(`${icon2} ${map.likeCount}`);
        likeText.setColor(map.likedByMe ? "#ff6688" : "#888888");
      } else {
        map.likedByMe = wasLiked;
        map.likeCount += wasLiked ? 1 : -1;
        const icon2 = map.likedByMe ? "♥" : "♡";
        likeText.setText(`${icon2} ${map.likeCount}`);
        likeText.setColor(map.likedByMe ? "#ff6688" : "#888888");
      }
    } catch {
      map.likedByMe = wasLiked;
      map.likeCount += wasLiked ? 1 : -1;
      const icon2 = map.likedByMe ? "♥" : "♡";
      likeText.setText(`${icon2} ${map.likeCount}`);
      likeText.setColor(map.likedByMe ? "#ff6688" : "#888888");
    }
  }

  private async playMap(map: GalleryMap) {
    try {
      const res = await apiRequest(`/maps/public/${map.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const m = data.map;
      const tiles = JSON.parse(m.tileData);
      const seed = Math.floor(Math.random() * 2147483646) + 1;

      this.cleanupInput();
      this.scene.start("WarningScene", {
        worldIndex: 0,
        deaths: 0,
        startTime: Date.now(),
        gameMode: this.gameMode,
        levelSeed: seed,
        customTiles: tiles,
        customBgColor: m.bgColor,
        customGroundColor: m.groundColor,
        customPlatformColor: m.platformColor,
      });
    } catch {}
  }
}
