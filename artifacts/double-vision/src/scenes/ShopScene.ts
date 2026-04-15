import Phaser from "phaser";
import { getCoins, spendCoins } from "../CoinManager";
import {
  ACCESSORIES,
  isOwned,
  purchaseAccessory,
  equipAccessory,
  unequipCategory,
  getEquipped,
  drawAccessories,
  drawSingleAccessory,
  type Accessory,
} from "../AccessoryManager";
import {
  getSelectedColor,
  getSelectedColorIndex,
  EYE,
  getEyeOffsetY,
} from "../PlayerConfig";
import { getBgColor } from "../GameSettings";

type Category = "hat" | "glasses" | "neckwear";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "hat", label: "Headwear" },
  { key: "glasses", label: "Eyewear" },
  { key: "neckwear", label: "Neckwear" },
];

const LIST_TOP = 130;
const LIST_BOTTOM_MARGIN = 40;
const ITEM_H = 56;
const ITEM_GAP = 8;
const SCROLL_SPEED = 20;
const FADE_HEIGHT = 24;

export class ShopScene extends Phaser.Scene {
  private selectedCategory: Category = "hat";
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private previewGfx: Phaser.GameObjects.Graphics | null = null;
  private previewLabel: Phaser.GameObjects.Text | null = null;
  private coinText!: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;

  private scrollContainer: Phaser.GameObjects.Container | null = null;
  private scrollMaskGraphics: Phaser.GameObjects.Graphics | null = null;
  private scrollY = 0;
  private maxScroll = 0;
  private listHeight = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private fadeTopGfx: Phaser.GameObjects.Graphics | null = null;
  private fadeBotGfx: Phaser.GameObjects.Graphics | null = null;
  private scrollbarGfx: Phaser.GameObjects.Graphics | null = null;
  private itemButtons: { obj: Phaser.GameObjects.Rectangle; localY: number }[] = [];
  private boundPointermove: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private boundPointerup: (() => void) | null = null;

  constructor() {
    super({ key: "ShopScene" });
  }

  create(data?: { category?: Category }) {
    this.selectedCategory = data?.category || "hat";
    this.dynamicObjects = [];
    this.previewGfx = null;
    this.messageText = null;
    this.messageTimer = null;
    this.scrollContainer = null;
    this.scrollMaskGraphics = null;
    this.scrollY = 0;
    this.isDragging = false;
    this.fadeTopGfx = null;
    this.fadeBotGfx = null;
    this.scrollbarGfx = null;
    this.itemButtons = [];

    const { width, height } = this.scale;
    const bg = getBgColor();
    this.cameras.main.setBackgroundColor(bg.value);

    this.add
      .text(width / 2, 30, "ACCESSORY SHOP", {
        fontSize: "32px",
        fontFamily: "monospace",
        color: "#ffcc00",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.coinText = this.add
      .text(width / 2, 60, `Coins: ${getCoins()}`, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#ffdd44",
      })
      .setOrigin(0.5);

    const backBtn = this.add
      .text(16, 16, "< Back", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#cccccc",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#cccccc"));
    backBtn.on("pointerdown", () => this.scene.start("TitleScene"));

    const escKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );
    escKey.on("down", () => this.scene.start("TitleScene"));

    this.boundPointermove = (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dy = this.dragStartY - pointer.y;
        this.scrollY = Phaser.Math.Clamp(this.dragStartScroll + dy, 0, this.maxScroll);
        this.applyScroll();
      }
    };
    this.boundPointerup = () => {
      this.isDragging = false;
    };
    this.input.on("pointermove", this.boundPointermove);
    this.input.on("pointerup", this.boundPointerup);

    this.renderCategoryTabs(width);
    this.renderItems();
    this.renderPreview(width, height);

    this.events.on("shutdown", () => {
      if (this.messageTimer) {
        this.messageTimer.destroy();
        this.messageTimer = null;
      }
      if (this.boundPointermove) {
        this.input.off("pointermove", this.boundPointermove);
      }
      if (this.boundPointerup) {
        this.input.off("pointerup", this.boundPointerup);
      }
    });
  }

  private renderCategoryTabs(width: number) {
    const tabY = 90;
    const tabW = 100;
    const tabH = 30;
    const totalW = CATEGORIES.length * tabW + (CATEGORIES.length - 1) * 8;
    const startX = width / 2 - totalW / 2 + tabW / 2;

    CATEGORIES.forEach((cat, i) => {
      const x = startX + i * (tabW + 8);
      const isActive = cat.key === this.selectedCategory;

      const bg = this.add.rectangle(
        x,
        tabY,
        tabW,
        tabH,
        isActive ? 0x0f3460 : 0x16213e,
        0.9,
      );
      bg.setStrokeStyle(2, isActive ? 0x00ccff : 0x333355);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add
        .text(x, tabY, cat.label, {
          fontSize: "12px",
          fontFamily: "monospace",
          color: isActive ? "#00ccff" : "#888888",
          fontStyle: isActive ? "bold" : "normal",
        })
        .setOrigin(0.5);

      bg.on("pointerdown", () => {
        this.selectedCategory = cat.key;
        this.scene.restart({ category: cat.key });
      });
    });
  }

  private renderItems() {
    this.dynamicObjects.forEach((o) => o.destroy());
    this.dynamicObjects = [];
    this.itemButtons = [];
    if (this.scrollContainer) {
      this.scrollContainer.destroy();
      this.scrollContainer = null;
    }
    if (this.scrollMaskGraphics) {
      this.scrollMaskGraphics.destroy();
      this.scrollMaskGraphics = null;
    }
    if (this.fadeTopGfx) {
      this.fadeTopGfx.destroy();
      this.fadeTopGfx = null;
    }
    if (this.fadeBotGfx) {
      this.fadeBotGfx.destroy();
      this.fadeBotGfx = null;
    }
    if (this.scrollbarGfx) {
      this.scrollbarGfx.destroy();
      this.scrollbarGfx = null;
    }

    const items = ACCESSORIES.filter(
      (a) => a.category === this.selectedCategory,
    );
    const itemW = 360;
    const { width, height } = this.scale;
    const listX = width / 2 - 100;
    const visibleHeight = height - LIST_TOP - LIST_BOTTOM_MARGIN;
    const contentHeight = items.length * (ITEM_H + ITEM_GAP) - ITEM_GAP;

    this.listHeight = visibleHeight;
    this.maxScroll = Math.max(0, contentHeight - visibleHeight);
    this.scrollY = Math.min(this.scrollY, this.maxScroll);

    this.scrollContainer = this.add.container(0, LIST_TOP);
    this.scrollContainer.setDepth(10);

    const maskGfx = this.add.graphics();
    maskGfx.setVisible(false);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(listX - itemW / 2 - 10, LIST_TOP, itemW + 20, visibleHeight);
    this.scrollMaskGraphics = maskGfx;
    const mask = maskGfx.createGeometryMask();
    this.scrollContainer.setMask(mask);

    const hitArea = this.add.rectangle(
      listX, LIST_TOP + visibleHeight / 2, itemW + 20, visibleHeight, 0x000000, 0
    ).setInteractive().setDepth(5);
    this.dynamicObjects.push(hitArea);

    hitArea.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number, _dz: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * SCROLL_SPEED * 0.05, 0, this.maxScroll);
      this.applyScroll();
    });

    hitArea.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollY;
    });

    items.forEach((item, i) => {
      const y = i * (ITEM_H + ITEM_GAP);
      const owned = isOwned(item.id);
      const equipped = getEquipped(item.category) === item.id;

      const bg = this.add.rectangle(listX, y + ITEM_H / 2, itemW, ITEM_H, 0x16213e, 0.9);
      bg.setStrokeStyle(2, equipped ? 0x00ff88 : owned ? 0x335588 : 0x222244);
      this.scrollContainer!.add(bg);

      const iconSize = 24;
      const iconX = listX - itemW / 2 + 24;
      const iconY = y + ITEM_H / 2;
      const iconCenterY: Record<string, number> = {
        tophat: 19,
        crown: 18,
        partyhat: 21,
        cowboy: 15,
        beanie: 16,
        halo: 18,
        sunglasses: 3,
        nerdglasses: 5,
        monocle: 0,
        cape: -6,
        scarf: -4,
        bowtie: -3,
        medal: -3,
      };
      const iconGfx = this.add.graphics();
      iconGfx.setPosition(iconX, iconY);
      const yOffset = iconCenterY[item.id] ?? 0;
      drawSingleAccessory(iconGfx, item.id, 0, yOffset, iconSize * 0.7, iconSize * 0.8);
      this.scrollContainer!.add(iconGfx);

      const name = this.add
        .text(listX - itemW / 2 + 56, y + ITEM_H / 2 - 8, item.name, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: equipped ? "#00ff88" : "#ffffff",
          fontStyle: equipped ? "bold" : "normal",
        })
        .setOrigin(0, 0);
      this.scrollContainer!.add(name);

      if (!owned) {
        const priceText = this.add
          .text(listX - itemW / 2 + 56, y + ITEM_H / 2 + 8, `${item.price} coins`, {
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#ffdd44",
          })
          .setOrigin(0, 0);
        this.scrollContainer!.add(priceText);
      }

      const btnX = listX + itemW / 2 - 50;
      const btnY = y + ITEM_H / 2;

      if (!owned) {
        this.createButton(
          btnX,
          btnY,
          "BUY",
          70,
          28,
          getCoins() >= item.price ? 0x006633 : 0x442222,
          () => this.buyItem(item),
        );
      } else if (equipped) {
        this.createButton(btnX, btnY, "REMOVE", 70, 28, 0x663322, () => {
          unequipCategory(item.category);
          this.refreshShop();
        });
      } else {
        this.createButton(btnX, btnY, "EQUIP", 70, 28, 0x224488, () => {
          equipAccessory(item.id);
          this.refreshShop();
        });
      }
    });

    this.renderScrollIndicators(listX, itemW, visibleHeight);
    this.applyScroll();
  }

  private renderScrollIndicators(listX: number, itemW: number, visibleHeight: number) {
    if (this.maxScroll <= 0) return;

    this.fadeTopGfx = this.add.graphics().setDepth(20);
    this.fadeBotGfx = this.add.graphics().setDepth(20);

    const left = listX - itemW / 2 - 10;
    const fadeW = itemW + 20;

    this.fadeTopGfx.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x0a0a1e, 0x0a0a1e, 1, 1, 0, 0);
    this.fadeTopGfx.fillRect(left, LIST_TOP, fadeW, FADE_HEIGHT);

    this.fadeBotGfx.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x0a0a1e, 0x0a0a1e, 0, 0, 1, 1);
    this.fadeBotGfx.fillRect(left, LIST_TOP + visibleHeight - FADE_HEIGHT, fadeW, FADE_HEIGHT);

    const sbX = listX + itemW / 2 + 6;
    const sbH = visibleHeight;
    this.scrollbarGfx = this.add.graphics().setDepth(20);
    this.scrollbarGfx.fillStyle(0x222244, 0.5);
    this.scrollbarGfx.fillRoundedRect(sbX, LIST_TOP, 4, sbH, 2);

    this.updateScrollIndicators();
  }

  private updateScrollIndicators() {
    if (this.fadeTopGfx) {
      this.fadeTopGfx.setAlpha(this.scrollY > 0 ? 1 : 0);
    }
    if (this.fadeBotGfx) {
      this.fadeBotGfx.setAlpha(this.scrollY < this.maxScroll ? 1 : 0);
    }
    if (this.scrollbarGfx && this.maxScroll > 0) {
      this.scrollbarGfx.clear();

      const { width } = this.scale;
      const itemW = 360;
      const listX = width / 2 - 100;
      const sbX = listX + itemW / 2 + 6;
      const sbTrackH = this.listHeight;

      this.scrollbarGfx.fillStyle(0x222244, 0.3);
      this.scrollbarGfx.fillRoundedRect(sbX, LIST_TOP, 4, sbTrackH, 2);

      const thumbRatio = this.listHeight / (this.listHeight + this.maxScroll);
      const thumbH = Math.max(20, sbTrackH * thumbRatio);
      const thumbY = LIST_TOP + (this.scrollY / this.maxScroll) * (sbTrackH - thumbH);

      this.scrollbarGfx.fillStyle(0x4488cc, 0.7);
      this.scrollbarGfx.fillRoundedRect(sbX, thumbY, 4, thumbH, 2);
    }
  }

  private applyScroll() {
    if (this.scrollContainer) {
      this.scrollContainer.y = LIST_TOP - this.scrollY;
    }
    for (const btn of this.itemButtons) {
      const worldY = btn.localY + LIST_TOP - this.scrollY;
      const visible = worldY > LIST_TOP - ITEM_H / 2 && worldY < LIST_TOP + this.listHeight + ITEM_H / 2;
      if (visible) {
        btn.obj.setInteractive();
      } else {
        btn.obj.disableInteractive();
      }
    }
    this.updateScrollIndicators();
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    w: number,
    h: number,
    color: number,
    onClick: () => void,
  ) {
    const bg = this.add.rectangle(x, y, w, h, color, 0.95);
    bg.setStrokeStyle(1, 0x555555);
    bg.setInteractive({ useHandCursor: true });
    if (this.scrollContainer) {
      this.scrollContainer.add(bg);
      this.itemButtons.push({ obj: bg, localY: y });
    } else {
      this.dynamicObjects.push(bg);
    }

    const label = this.add
      .text(x, y, text, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    if (this.scrollContainer) {
      this.scrollContainer.add(label);
    } else {
      this.dynamicObjects.push(label);
    }

    bg.on("pointerover", () => bg.setAlpha(0.8));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", onClick);
  }

  private buyItem(item: Accessory) {
    if (isOwned(item.id)) return;
    if (!spendCoins(item.price)) {
      this.showMessage("Not enough coins!", "#ff4444");
      return;
    }
    purchaseAccessory(item.id);
    equipAccessory(item.id);
    this.showMessage(`Bought ${item.name}!`, "#00ff88");
    this.refreshShop();
  }

  private refreshShop() {
    this.coinText.setText(`Coins: ${getCoins()}`);
    this.renderItems();
    this.renderPreview(this.scale.width, this.scale.height);
  }

  private showMessage(msg: string, color: string) {
    if (this.messageTimer) {
      this.messageTimer.destroy();
      this.messageTimer = null;
    }
    if (this.messageText) {
      this.messageText.destroy();
    }
    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height - 30, msg, {
        fontSize: "16px",
        fontFamily: "monospace",
        color: color,
        fontStyle: "bold",
        backgroundColor: "#000000",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(200);

    this.messageTimer = this.time.delayedCall(2000, () => {
      if (this.messageText) {
        this.messageText.destroy();
        this.messageText = null;
      }
    });
  }

  private renderPreview(width: number, height: number) {
    if (this.previewGfx) {
      this.previewGfx.destroy();
    }
    if (this.previewLabel) {
      this.previewLabel.destroy();
      this.previewLabel = null;
    }

    const previewX = width - 80;
    const previewY = height / 2 + 40;
    const bodyW = 42;
    const bodyH = 56;
    const color = getSelectedColor();

    this.previewGfx = this.add.graphics().setDepth(50);
    const gfx = this.previewGfx;

    gfx.fillStyle(0x111122, 0.6);
    gfx.fillRoundedRect(previewX - 45, previewY - 55, 90, 120, 8);
    gfx.lineStyle(1, 0x333355, 1);
    gfx.strokeRoundedRect(previewX - 45, previewY - 55, 90, 120, 8);

    gfx.fillStyle(color.fill, 1);
    gfx.fillRect(previewX - bodyW / 2, previewY - bodyH / 2, bodyW, bodyH);
    gfx.lineStyle(2, color.stroke, 1);
    gfx.strokeRect(previewX - bodyW / 2, previewY - bodyH / 2, bodyW, bodyH);

    const eyeOffsetY = getEyeOffsetY(bodyH);
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(
      previewX - EYE.SPACING - EYE.WIDTH / 2,
      previewY + eyeOffsetY - EYE.HEIGHT / 2,
      EYE.WIDTH + 1,
      EYE.HEIGHT + 1,
    );
    gfx.fillRect(
      previewX + EYE.SPACING - EYE.WIDTH / 2,
      previewY + eyeOffsetY - EYE.HEIGHT / 2,
      EYE.WIDTH + 1,
      EYE.HEIGHT + 1,
    );

    drawAccessories(gfx, previewX, previewY, bodyW, bodyH, color.fill);

    this.previewLabel = this.add
      .text(previewX, previewY + 50, "Preview", {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#888888",
      })
      .setOrigin(0.5);
  }
}
