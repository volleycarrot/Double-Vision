import Phaser from "phaser";
import { StartScene } from "./scenes/StartScene";
import { AuthScene } from "./scenes/AuthScene";
import { ModeSelectScene } from "./scenes/ModeSelectScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { TitleScene } from "./scenes/TitleScene";
import { ShopScene } from "./scenes/ShopScene";
import { WarningScene } from "./scenes/WarningScene";
import { GameScene } from "./scenes/GameScene";
import { WinScene } from "./scenes/WinScene";
import { InputModeSelectScene } from "./scenes/InputModeSelectScene";

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
  input: {
    activePointers: 4,
  },
  dom: { createContainer: true },
  scene: [
    StartScene,
    AuthScene,
    InputModeSelectScene,
    ModeSelectScene,
    LobbyScene,
    TitleScene,
    ShopScene,
    WarningScene,
    GameScene,
    WinScene,
  ],
};

new Phaser.Game(config);
