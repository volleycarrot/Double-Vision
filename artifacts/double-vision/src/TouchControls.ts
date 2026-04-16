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

interface ButtonInfo {
  rect: Phaser.GameObjects.Rectangle;
  action: Action;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

const HIT_PADDING = 20;

export class TouchControls {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private buttons: ButtonInfo[] = [];
  private activePointers: Map<number, Action> = new Map();
  private role: TouchRole;
  private visible = false;

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

    const add = (x: number, y: number, label: string, action: Action) => {
      const rect = this.createButton(x, y, btnSize, btnSize, label, alpha);
      this.buttons.push({
        rect,
        action,
        hitX: x,
        hitY: y,
        hitW: btnSize + HIT_PADDING * 2,
        hitH: btnSize + HIT_PADDING * 2,
      });
    };

    if (flipped) {
      if (showVertical) {
        add(leftSideX1, bottomY - btnSize - gap, "▲", "jump");
        add(leftSideX2, bottomY, "▼", "duck");
      }
      if (showHorizontal) {
        add(rightSideX2, bottomY, "◀", "left");
        add(rightSideX1, bottomY, "▶", "right");
      }
    } else {
      if (showHorizontal) {
        add(leftSideX1, bottomY, "◀", "left");
        add(leftSideX2, bottomY, "▶", "right");
      }
      if (showVertical) {
        add(rightSideX1, bottomY - btnSize - gap, "▲", "jump");
        add(rightSideX2, bottomY, "▼", "duck");
      }
    }

    this.buttons.forEach((info) => {
      info.rect.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.activePointers.set(pointer.id, info.action);
        this.syncState();
      });
    });
  }

  private createButton(x: number, y: number, w: number, h: number, label: string, alpha: number): Phaser.GameObjects.Rectangle {
    const bg = this.scene.add.rectangle(x, y, w, h, 0xffffff, alpha);
    bg.setStrokeStyle(2, 0xffffff);
    const hitArea = new Phaser.Geom.Rectangle(
      -HIT_PADDING,
      -HIT_PADDING,
      w + HIT_PADDING * 2,
      h + HIT_PADDING * 2,
    );
    bg.setInteractive({ hitArea, hitAreaCallback: Phaser.Geom.Rectangle.Contains, draggable: false });
    this.container.add(bg);

    const text = this.scene.add.text(x, y, label, {
      fontSize: "24px",
      fontFamily: "monospace",
      color: "#ffffff",
    }).setOrigin(0.5).setAlpha(0.7);
    this.container.add(text);

    return bg;
  }

  private pointerInButton(px: number, py: number, info: ButtonInfo): boolean {
    const halfW = info.hitW / 2;
    const halfH = info.hitH / 2;
    return (
      px >= info.hitX - halfW &&
      px <= info.hitX + halfW &&
      py >= info.hitY - halfH &&
      py <= info.hitY + halfH
    );
  }

  private hitTest(px: number, py: number): Action | null {
    for (const info of this.buttons) {
      if (this.pointerInButton(px, py, info)) return info.action;
    }
    return null;
  }

  private syncState() {
    const pressed = new Set(this.activePointers.values());
    this._leftDown = pressed.has("left");
    this._rightDown = pressed.has("right");
    this._jumpDown = pressed.has("jump");
    this._duckDown = pressed.has("duck");

    this.buttons.forEach((info) => {
      info.rect.setFillStyle(0xffffff, pressed.has(info.action) ? 0.6 : 0.35);
    });
  }

  update() {
    if (this.visible) {
      const pointers = this.scene.input.manager.pointers;
      const live = new Map<number, Action>();
      for (const p of pointers) {
        if (!p || !p.active || !p.isDown) continue;
        const existing = this.activePointers.get(p.id);
        if (existing !== undefined) {
          live.set(p.id, existing);
        } else {
          const action = this.hitTest(p.x, p.y);
          if (action) live.set(p.id, action);
        }
      }
      this.activePointers = live;
      this.syncState();
    }

    this._jumpJustDown = this._jumpDown && !this._jumpWasDown;
    this._jumpWasDown = this._jumpDown;
  }

  resetJumpEdge() {
    this._jumpWasDown = false;
    this._jumpJustDown = false;
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
    this.visible = true;
  }

  hide() {
    this.container.setVisible(false);
    this.container.setActive(false);
    this.visible = false;
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
