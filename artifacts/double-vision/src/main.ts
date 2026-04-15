import Phaser from "phaser";
import { StartScene } from "./scenes/StartScene";
import { ModeSelectScene } from "./scenes/ModeSelectScene";
import { TitleScene } from "./scenes/TitleScene";
import { ShopScene } from "./scenes/ShopScene";
import { WarningScene } from "./scenes/WarningScene";
import { GameScene } from "./scenes/GameScene";
import { WinScene } from "./scenes/WinScene";

const basePath = (import.meta as any).env?.BASE_URL || "/";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [StartScene, ModeSelectScene, TitleScene, ShopScene, WarningScene, GameScene, WinScene],
};

new Phaser.Game(config);
