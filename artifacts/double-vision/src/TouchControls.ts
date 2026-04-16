import Phaser from "phaser";
import { getControlsFlipped } from "./GameSettings";

export type TouchRole = "host" | "guest" | null;

export interface TouchInputState {
  leftDown: boolean;
  rightDown: boolean;
  jumpDown: boolean;
  jumpJustDown: boolean;
  duckDown: boolean;
}

type Action = "left" | "right" | "jump" | "duck";

export class TouchControls {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buttons: { rect: Phaser.GameObjects.Rectangle; action: Action }[] = [];
  private activePointers: Map<number, Action> = new Map();
  private role: TouchRole;

  private _leftDown = false;
  private _rightDown = false;
  private _jumpDown = false;
  private _jumpJustDown = false;
  private _duckDown = false;
  private _jumpWasDown = false;

  constructor(scene: Phaser.Scene, role: TouchRole = null) {
    this.scene = scene;
    this.role = role;
    this.container = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);
    this.createButtons();
    this.hide();
  }

  private createButtons() {
    this.buttons = [];
    this.activePointers.clear();

    const { width, height } = this.scene.cameras.main;
    const btnSize = 56;
    const padding = 16;
    const gap = 8;
    const alpha = 0.35;
    const flipped = getControlsFlipped();

    const leftSideX1 = padding + btnSize / 2;
    const leftSideX2 = padding + btnSize + gap + btnSize / 2;
    const rightSideX1 = width - padding - btnSize / 2;
    const rightSideX2 = width - padding - btnSize - gap - btnSize / 2;
    const bottomY = height - padding - btnSize / 2;

    const showHorizontal = this.role !== "guest";
    const showVertical = this.role !== "host";

    if (flipped) {
      if (showVertical) {
        const jumpBtn = this.createButton(leftSideX1, bottomY - btnSize - gap, btnSize, btnSize, "▲", alpha);
        const duckBtn = this.createButton(leftSideX2, bottomY, btnSize, btnSize, "▼", alpha);
        this.buttons.push({ rect: jumpBtn, action: "jump" }, { rect: duckBtn, action: "duck" });
      }
      if (showHorizontal) {
        const leftBtn = this.createButton(rightSideX2, bottomY, btnSize, btnSize, "◀", alpha);
        const rightBtn = this.createButton(rightSideX1, bottomY, btnSize, btnSize, "▶", alpha);
        this.buttons.push({ rect: leftBtn, action: "left" }, { rect: rightBtn, action: "right" });
      }
    } else {
      if (showHorizontal) {
        const leftBtn = this.createButton(leftSideX1, bottomY, btnSize, btnSize, "◀", alpha);
        const rightBtn = this.createButton(leftSideX2, bottomY, btnSize, btnSize, "▶", alpha);
        this.buttons.push({ rect: leftBtn, action: "left" }, { rect: rightBtn, action: "right" });
      }
      if (showVertical) {
        const jumpBtn = this.createButton(rightSideX1, bottomY - btnSize - gap, btnSize, btnSize, "▲", alpha);
        const duckBtn = this.createButton(rightSideX2, bottomY, btnSize, btnSize, "▼", alpha);
        this.buttons.push({ rect: jumpBtn, action: "jump" }, { rect: duckBtn, action: "duck" });
      }
    }

    this.buttons.forEach(({ rect, action }) => {
      rect.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.activePointers.set(pointer.id, action);
        this.syncState();
      });
      rect.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        this.activePointers.delete(pointer.id);
        this.syncState();
      });
      rect.on("pointerout", (pointer: Phaser.Input.Pointer) => {
        this.activePointers.delete(pointer.id);
        this.syncState();
      });
    });
  }

  private createButton(x: number, y: number, w: number, h: number, label: string, alpha: number): Phaser.GameObjects.Rectangle {
    const bg = this.scene.add.rectangle(x, y, w, h, 0xffffff, alpha);
    bg.setStrokeStyle(2, 0xffffff);
    bg.setInteractive({ draggable: false });
    this.container.add(bg);

    const text = this.scene.add.text(x, y, label, {
      fontSize: "24px",
      fontFamily: "monospace",
      color: "#ffffff",
    }).setOrigin(0.5).setAlpha(0.7);
    this.container.add(text);

    return bg;
  }

  private syncState() {
    const pressed = new Set(this.activePointers.values());
    this._leftDown = pressed.has("left");
    this._rightDown = pressed.has("right");
    this._jumpDown = pressed.has("jump");
    this._duckDown = pressed.has("duck");

    this.buttons.forEach(({ rect, action }) => {
      rect.setFillStyle(0xffffff, pressed.has(action) ? 0.6 : 0.35);
    });
  }

  update() {
    this._jumpJustDown = this._jumpDown && !this._jumpWasDown;
    this._jumpWasDown = this._jumpDown;
  }

  getState(): TouchInputState {
    return {
      leftDown: this._leftDown,
      rightDown: this._rightDown,
      jumpDown: this._jumpDown,
      jumpJustDown: this._jumpJustDown,
      duckDown: this._duckDown,
    };
  }

  show() {
    this.container.setVisible(true);
    this.container.setActive(true);
  }

  hide() {
    this.container.setVisible(false);
    this.container.setActive(false);
    this.activePointers.clear();
    this._leftDown = false;
    this._rightDown = false;
    this._jumpDown = false;
    this._duckDown = false;
    this._jumpJustDown = false;
    this._jumpWasDown = false;
  }

  reposition() {
    this.container.removeAll(true);
    this.createButtons();
  }

  destroy() {
    this.container.removeAll(true);
    this.container.destroy();
  }
}
