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
  type Accessory,
} from "../AccessoryManager";
import {
  getSelectedColor,
  getSelectedColorIndex,
  EYE,
  getEyeOffsetY,
} from "../PlayerConfig";
import { getBgColor } from "../GameSettings";

type Category = "hat" | "glasses" | "cape" | "neckwear";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "hat", label: "Hats" },
  { key: "glasses", label: "Glasses" },
  { key: "cape", label: "Capes" },
  { key: "neckwear", label: "Neckwear" },
];

export class ShopScene extends Phaser.Scene {
  private selectedCategory: Category = "hat";
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];
  private previewGfx: Phaser.GameObjects.Graphics | null = null;
  private previewLabel: Phaser.GameObjects.Text | null = null;
  private coinText!: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: "ShopScene" });
  }

  create(data?: { category?: Category }) {
    this.selectedCategory = data?.category || "hat";
    this.dynamicObjects = [];
    this.previewGfx = null;
    this.messageText = null;
    this.messageTimer = null;

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

    this.renderCategoryTabs(width);
    this.renderItems();
    this.renderPreview(width, height);

    this.events.on("shutdown", () => {
      if (this.messageTimer) {
        this.messageTimer.destroy();
        this.messageTimer = null;
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

    const items = ACCESSORIES.filter(
      (a) => a.category === this.selectedCategory,
    );
    const startY = 130;
    const itemH = 56;
    const itemW = 360;
    const { width } = this.scale;
    const listX = width / 2 - 100;

    items.forEach((item, i) => {
      const y = startY + i * (itemH + 8);
      const owned = isOwned(item.id);
      const equipped = getEquipped(item.category) === item.id;

      const bg = this.add.rectangle(listX, y + itemH / 2, itemW, itemH, 0x16213e, 0.9);
      bg.setStrokeStyle(2, equipped ? 0x00ff88 : owned ? 0x335588 : 0x222244);
      this.dynamicObjects.push(bg);

      const emoji = this.add
        .text(listX - itemW / 2 + 24, y + itemH / 2, item.emoji, {
          fontSize: "24px",
        })
        .setOrigin(0.5);
      this.dynamicObjects.push(emoji);

      const name = this.add
        .text(listX - itemW / 2 + 56, y + itemH / 2 - 8, item.name, {
          fontSize: "14px",
          fontFamily: "monospace",
          color: equipped ? "#00ff88" : "#ffffff",
          fontStyle: equipped ? "bold" : "normal",
        })
        .setOrigin(0, 0);
      this.dynamicObjects.push(name);

      if (!owned) {
        const priceText = this.add
          .text(listX - itemW / 2 + 56, y + itemH / 2 + 8, `${item.price} coins`, {
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#ffdd44",
          })
          .setOrigin(0, 0);
        this.dynamicObjects.push(priceText);
      }

      const btnX = listX + itemW / 2 - 50;
      const btnY = y + itemH / 2;

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
    this.dynamicObjects.push(bg);

    const label = this.add
      .text(x, y, text, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.dynamicObjects.push(label);

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
