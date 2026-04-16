import Phaser from "phaser";
import type { SpecialUnlockedDetail } from "./EventBus";

export function attachUnlockToast(scene: Phaser.Scene): void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<SpecialUnlockedDetail>).detail;
    if (!detail) return;
    showToast(scene, `🌟 Unlocked: ${detail.name}!`);
  };
  window.addEventListener("special-unlocked", handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener("special-unlocked", handler);
  });
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => {
    window.removeEventListener("special-unlocked", handler);
  });
}

let activeToasts = 0;

function showToast(scene: Phaser.Scene, message: string): void {
  if (!scene.scene.isActive()) return;
  const { width } = scene.scale;
  const slot = activeToasts;
  activeToasts++;
  const y = 80 + slot * 48;

  const text = scene.add
    .text(width / 2, y, message, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffdd44",
      fontStyle: "bold",
      backgroundColor: "#1a1a2e",
      padding: { x: 14, y: 8 },
      align: "center",
    })
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(10000)
    .setAlpha(0);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    y: y + 6,
    duration: 250,
    ease: "Sine.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        alpha: 0,
        y: y - 10,
        duration: 400,
        delay: 2400,
        ease: "Sine.easeIn",
        onComplete: () => {
          text.destroy();
          activeToasts = Math.max(0, activeToasts - 1);
        },
      });
    },
  });
}
