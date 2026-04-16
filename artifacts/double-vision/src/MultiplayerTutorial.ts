import Phaser from "phaser";

const STORAGE_KEY = "dv_mp_tutorial_seen_v1";

export function hasSeenMultiplayerTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMultiplayerTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function showMultiplayerTutorial(scene: Phaser.Scene, onClose?: () => void): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const container = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);

  const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0, 0);
  dim.setInteractive();
  container.add(dim);

  const panelW = Math.min(520, width - 40);
  const panelH = Math.min(460, height - 40);
  const panelX = width / 2;
  const panelY = height / 2;

  const panel = scene.add.rectangle(panelX, panelY, panelW, panelH, 0x16213e, 0.98);
  panel.setStrokeStyle(2, 0x0f3460);
  container.add(panel);

  const top = panelY - panelH / 2;

  const title = scene.add.text(panelX, top + 28, "HOW TO PLAY CO-OP", {
    fontSize: "22px",
    fontFamily: "monospace",
    color: "#ff2222",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(title);

  const subtitle = scene.add.text(panelX, top + 58, "Two players share one character", {
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#aaaacc",
  }).setOrigin(0.5);
  container.add(subtitle);

  const rolesY = top + 96;

  const hostBg = scene.add.rectangle(panelX - panelW / 4, rolesY + 38, panelW / 2 - 24, 90, 0x0f3460, 0.6);
  hostBg.setStrokeStyle(1, 0xffcc00, 0.6);
  container.add(hostBg);

  const hostTitle = scene.add.text(hostBg.x, rolesY + 10, "PLAYER 1 (HOST)", {
    fontSize: "13px",
    fontFamily: "monospace",
    color: "#ffcc00",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(hostTitle);

  const hostRole = scene.add.text(hostBg.x, rolesY + 38, "LEFT  /  RIGHT", {
    fontSize: "16px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(hostRole);

  const hostDesc = scene.add.text(hostBg.x, rolesY + 62, "Controls horizontal\nmovement", {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#cccccc",
    align: "center",
  }).setOrigin(0.5);
  container.add(hostDesc);

  const guestBg = scene.add.rectangle(panelX + panelW / 4, rolesY + 38, panelW / 2 - 24, 90, 0x0f3460, 0.6);
  guestBg.setStrokeStyle(1, 0x00ccff, 0.6);
  container.add(guestBg);

  const guestTitle = scene.add.text(guestBg.x, rolesY + 10, "PLAYER 2 (GUEST)", {
    fontSize: "13px",
    fontFamily: "monospace",
    color: "#00ccff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(guestTitle);

  const guestRole = scene.add.text(guestBg.x, rolesY + 38, "JUMP  /  DUCK", {
    fontSize: "16px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(guestRole);

  const guestDesc = scene.add.text(guestBg.x, rolesY + 62, "Controls vertical\nmovement", {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#cccccc",
    align: "center",
  }).setOrigin(0.5);
  container.add(guestDesc);

  const stepsY = rolesY + 108;

  const stepsHeader = scene.add.text(panelX, stepsY, "GETTING STARTED", {
    fontSize: "13px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(stepsHeader);

  const steps = [
    "1. One player picks CREATE ROOM to get a 5-letter code",
    "2. The other player picks JOIN ROOM and enters the code",
    "3. Once both are connected, the host presses START GAME",
    "4. Work together - you only win if you cooperate!",
  ];

  steps.forEach((line, i) => {
    const t = scene.add.text(panelX - panelW / 2 + 24, stepsY + 22 + i * 18, line, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#dddddd",
    }).setOrigin(0, 0.5);
    container.add(t);
  });

  const btnY = panelY + panelH / 2 - 36;
  const btnBg = scene.add.rectangle(panelX, btnY, 160, 40, 0x006622, 0.9);
  btnBg.setStrokeStyle(2, 0x00ff66);
  btnBg.setInteractive({ useHandCursor: true });
  container.add(btnBg);

  const btnLabel = scene.add.text(panelX, btnY, "GOT IT!", {
    fontSize: "16px",
    fontFamily: "monospace",
    color: "#ffffff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  container.add(btnLabel);

  const close = () => {
    markMultiplayerTutorialSeen();
    container.destroy();
    if (onClose) onClose();
  };

  btnBg.on("pointerover", () => btnBg.setFillStyle(0x008833, 1));
  btnBg.on("pointerout", () => btnBg.setFillStyle(0x006622, 0.9));
  btnBg.on("pointerdown", close);

  dim.on("pointerdown", close);

  return container;
}
