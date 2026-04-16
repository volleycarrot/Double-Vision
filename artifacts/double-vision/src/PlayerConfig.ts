import Phaser from "phaser";

export interface ColorPreset {
  name: string;
  fill: number;
  stroke: number;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: "White", fill: 0xffffff, stroke: 0xcccccc },
  { name: "Blue", fill: 0x4488ff, stroke: 0x66aaff },
  { name: "Red", fill: 0xff4444, stroke: 0xff6666 },
  { name: "Green", fill: 0x44cc44, stroke: 0x66ee66 },
  { name: "Yellow", fill: 0xffcc00, stroke: 0xffdd44 },
  { name: "Purple", fill: 0xaa44ff, stroke: 0xcc66ff },
  { name: "Orange", fill: 0xff8800, stroke: 0xffaa44 },
];

let selectedIndex = 0;

export function getSelectedColor(): ColorPreset {
  return COLOR_PRESETS[selectedIndex];
}

export function setSelectedColorIndex(index: number) {
  if (index >= 0 && index < COLOR_PRESETS.length) {
    selectedIndex = index;
  }
}

export function getSelectedColorIndex(): number {
  return selectedIndex;
}

export const EYE = {
  WIDTH: 6,
  HEIGHT: 8,
  SPACING: 8,
  VERTICAL_RATIO: 0.3,
};

export function getEyeOffsetY(bodyHeight: number): number {
  return -bodyHeight / 2 + bodyHeight * EYE.VERTICAL_RATIO;
}

export function drawEyes(
  gfx: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  bodyHeight: number
) {
  gfx.clear();
  const eyeOffsetY = getEyeOffsetY(bodyHeight);

  gfx.fillStyle(0x000000, 1);
  gfx.fillRect(
    centerX - EYE.SPACING - EYE.WIDTH / 2,
    centerY + eyeOffsetY - EYE.HEIGHT / 2,
    EYE.WIDTH,
    EYE.HEIGHT
  );
  gfx.fillRect(
    centerX + EYE.SPACING - EYE.WIDTH / 2,
    centerY + eyeOffsetY - EYE.HEIGHT / 2,
    EYE.WIDTH,
    EYE.HEIGHT
  );
}
