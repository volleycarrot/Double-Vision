import Phaser from "phaser";
import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT } from "./WorldConfig";

const WORLD_W = LEVEL_WIDTH * TILE;
const WORLD_H = LEVEL_HEIGHT * TILE;

export interface ParallaxLayer {
  gfx: Phaser.GameObjects.Graphics;
  scrollFactor: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PX = 4;

function px(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1) {
  gfx.fillStyle(color, alpha);
  gfx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function lerpColor(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.floor(r1 + (r2 - r1) * t);
  const g = Math.floor(g1 + (g2 - g1) * t);
  const b = Math.floor(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

function drawMistyGradient(gfx: Phaser.GameObjects.Graphics, width: number) {
  const topColor = 0x0a2a1a;
  const midColor = 0x1a5a3a;
  const botColor = 0x0d3a1d;
  const steps = Math.ceil(WORLD_H / PX);

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    let color: number;
    if (t < 0.4) {
      color = lerpColor(topColor, midColor, t / 0.4);
    } else {
      color = lerpColor(midColor, botColor, (t - 0.4) / 0.6);
    }
    px(gfx, 0, i * PX, width, PX, color);
  }

  const glowCX = width * 0.5;
  const glowCY = WORLD_H * 0.3;
  const glowR = 160;
  for (let gy = -glowR; gy < glowR; gy += PX) {
    for (let gx = -glowR; gx < glowR; gx += PX) {
      const dist = Math.sqrt(gx * gx + gy * gy);
      if (dist < glowR) {
        const intensity = 1 - dist / glowR;
        const a = intensity * intensity * 0.3;
        px(gfx, glowCX + gx, glowCY + gy, PX, PX, 0x88ccaa, a);
      }
    }
  }
}

function drawFarMist(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(100);
  const mistColors = [0x1a6a4a, 0x2a7a5a, 0x1a5a3a, 0x2a8a6a];

  for (let layer = 0; layer < 3; layer++) {
    const baseY = WORLD_H * 0.25 + layer * 50;
    let mx = 0;
    while (mx < width) {
      const w = 80 + rand() * 160;
      const h = 30 + rand() * 50;
      const color = mistColors[Math.floor(rand() * mistColors.length)];
      const alpha = 0.15 + rand() * 0.15;

      for (let py = 0; py < h; py += PX) {
        const t = py / h;
        const rowW = w * Math.sin(t * Math.PI);
        px(gfx, mx + (w - rowW) / 2, baseY + py, rowW, PX, color, alpha * (1 - t * 0.5));
      }
      mx += w * 0.5 + rand() * 40;
    }
  }

  let treeX = 10;
  while (treeX < width) {
    const trunkW = 16 + rand() * 30;
    const trunkH = WORLD_H * 0.5 + rand() * WORLD_H * 0.3;
    const baseY = WORLD_H * 0.85 + rand() * WORLD_H * 0.1;
    const alpha = 0.2 + rand() * 0.15;

    for (let ty = 0; ty < trunkH; ty += PX) {
      const shade = lerpColor(0x1a4a3a, 0x0a3a2a, ty / trunkH);
      px(gfx, treeX, baseY - trunkH + ty, trunkW, PX, shade, alpha);
    }

    treeX += 60 + rand() * 120;
  }
}

function drawMidTrees(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(200);
  const trunkDark = [0x2a1508, 0x3a1a0a, 0x33180c];
  const trunkLight = [0x5a3820, 0x4a2a15, 0x6a4428];
  const canopyDark = [0x0a4a1a, 0x0d5a22, 0x084a18];
  const canopyBright = [0x2a8a3a, 0x339944, 0x228833, 0x3aaa4a];

  let treeX = 0;
  while (treeX < width) {
    const trunkW = 20 + rand() * 40;
    const trunkH = 120 + rand() * 180;
    const baseY = WORLD_H * 0.82 + rand() * WORLD_H * 0.08;
    const darkColor = trunkDark[Math.floor(rand() * trunkDark.length)];
    const lightColor = trunkLight[Math.floor(rand() * trunkLight.length)];

    for (let ty = 0; ty < trunkH; ty += PX) {
      const t = ty / trunkH;
      const barkColor = lerpColor(darkColor, lightColor, 0.3 + Math.sin(ty * 0.15) * 0.2);
      const w = trunkW * (1 + t * 0.3);
      px(gfx, treeX - (w - trunkW) / 2, baseY - trunkH + ty, w, PX, barkColor, 0.85);

      if (rand() > 0.6) {
        const knotX = treeX + rand() * trunkW * 0.6;
        px(gfx, knotX, baseY - trunkH + ty, PX * 2, PX, 0x1a0a04, 0.5);
      }
    }

    px(gfx, treeX - trunkW * 0.3, baseY, trunkW * 1.6, PX * 3, darkColor, 0.3);

    const canopyW = trunkW * 3 + rand() * 60;
    const canopyH = 60 + rand() * 50;
    const canopyCX = treeX + trunkW / 2;
    const canopyTopY = baseY - trunkH - canopyH * 0.3;

    for (let cl = 0; cl < 3; cl++) {
      const layerColor = cl === 0
        ? canopyDark[Math.floor(rand() * canopyDark.length)]
        : canopyBright[Math.floor(rand() * canopyBright.length)];
      const offsetY = cl * 12 - 10;
      const layerW = canopyW * (1 - cl * 0.15);

      for (let py = 0; py < canopyH; py += PX) {
        const t = py / canopyH;
        const rowW = layerW * Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.cos(t * 3 + cl));
        const jagged = Math.sin((canopyCX + py) * 0.3 + cl * 2) * 8;
        px(gfx, canopyCX - rowW / 2 + jagged, canopyTopY + py + offsetY, rowW, PX, layerColor, 0.7 + cl * 0.1);
      }
    }

    const leafCount = 3 + Math.floor(rand() * 5);
    for (let l = 0; l < leafCount; l++) {
      const lx = canopyCX - canopyW / 2 + rand() * canopyW;
      const ly = canopyTopY + rand() * canopyH * 0.5;
      const leafSize = PX + rand() * PX * 2;
      const leafColor = rand() > 0.4 ? 0x66cc44 : 0x44aa22;
      px(gfx, lx, ly, leafSize, leafSize, leafColor, 0.8);
    }

    treeX += 80 + rand() * 100;
  }
}

function drawHangingVines(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(300);
  const vineColors = [0x44aa22, 0x66cc33, 0x55bb28, 0x77dd44];
  const darkVine = [0x226611, 0x2a7718, 0x1a5510];

  let vx = 10;
  while (vx < width) {
    if (rand() > 0.25) {
      const vineLen = 50 + rand() * 120;
      const anchorY = rand() * 20;
      const sag = 20 + rand() * 40;
      const vineW = PX;
      const vineColor = darkVine[Math.floor(rand() * darkVine.length)];

      for (let vy = 0; vy < vineLen; vy += PX) {
        const t = vy / vineLen;
        const curve = Math.sin(t * Math.PI) * sag;
        const sway = Math.sin(t * 6 + vx * 0.1) * 3;
        px(gfx, vx + curve + sway, anchorY + vy, vineW, PX, vineColor, 0.8);
      }

      const leafCount = 2 + Math.floor(rand() * 4);
      for (let l = 0; l < leafCount; l++) {
        const lt = (l + 1) / (leafCount + 1);
        const ly = anchorY + vineLen * lt;
        const lx = vx + Math.sin(lt * Math.PI) * sag + Math.sin(lt * 6 + vx * 0.1) * 3;
        const leafColor = vineColors[Math.floor(rand() * vineColors.length)];
        const side = rand() > 0.5 ? 1 : -1;
        for (let lp = 0; lp < 3; lp++) {
          px(gfx, lx + side * (lp * PX), ly + lp * 2, PX * 2, PX, leafColor, 0.9);
        }
      }

      if (rand() > 0.5) {
        const v2Len = 30 + rand() * 60;
        const branchT = 0.3 + rand() * 0.3;
        const branchY = anchorY + vineLen * branchT;
        const branchX = vx + Math.sin(branchT * Math.PI) * sag;
        for (let vy = 0; vy < v2Len; vy += PX) {
          const t2 = vy / v2Len;
          px(gfx, branchX + t2 * 15, branchY + vy, vineW, PX, vineColor, 0.6);
        }
      }
    }

    vx += 30 + rand() * 50;
  }

  vx = 20;
  while (vx < width) {
    if (rand() > 0.4) {
      const droopLen = 30 + rand() * 50;
      const droopColor = vineColors[Math.floor(rand() * vineColors.length)];
      for (let d = 0; d < droopLen; d += PX) {
        const t = d / droopLen;
        const w = PX * (2 - t);
        px(gfx, vx, d, w, PX, droopColor, 0.7 * (1 - t * 0.4));
      }
    }
    vx += 15 + rand() * 25;
  }
}

function drawUndergrowth(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(400);
  const bushColors = [0x1a6a22, 0x228830, 0x0d5a18, 0x2a9a38, 0x339944];
  const fernColors = [0x44aa33, 0x55bb44, 0x66cc55, 0x338822];

  let bx = 0;
  while (bx < width) {
    const bushW = 50 + rand() * 80;
    const bushH = 25 + rand() * 40;
    const baseY = WORLD_H * 0.72 + rand() * (WORLD_H * 0.12);
    const mainColor = bushColors[Math.floor(rand() * bushColors.length)];
    const highlightColor = bushColors[Math.floor(rand() * bushColors.length)];

    for (let py = 0; py < bushH; py += PX) {
      const t = py / bushH;
      const rowW = bushW * Math.sin(t * Math.PI * 0.8 + 0.3);
      const jagged = Math.sin((bx + py) * 0.5) * 6;
      const color = t < 0.4 ? highlightColor : mainColor;
      px(gfx, bx + (bushW - rowW) / 2 + jagged, baseY - bushH + py, rowW, PX, color, 0.8);
    }

    const fernCount = 1 + Math.floor(rand() * 3);
    for (let f = 0; f < fernCount; f++) {
      const fernX = bx + rand() * bushW;
      const fernH = 25 + rand() * 45;
      const fernColor = fernColors[Math.floor(rand() * fernColors.length)];
      const lean = (rand() - 0.5) * 0.4;

      px(gfx, fernX, baseY - bushH - fernH, 2, fernH, 0x1a5510, 0.7);

      for (let fy = 0; fy < fernH; fy += PX * 2) {
        const t = fy / fernH;
        const leafLen = (1 - t) * 16;
        const leafX = fernX + lean * fy;

        for (let lp = 0; lp < leafLen; lp += PX) {
          const la = 0.8 * (1 - lp / leafLen);
          px(gfx, leafX - leafLen + lp, baseY - bushH - fernH + fy, PX, PX, fernColor, la);
          px(gfx, leafX + 2 + lp, baseY - bushH - fernH + fy, PX, PX, fernColor, la);
        }
      }
    }

    bx += 35 + rand() * 45;
  }
}

function drawCanopyTop(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(500);
  const darkLeaf = [0x0a3a10, 0x0d4a18, 0x083812];
  const brightLeaf = [0x55bb33, 0x66cc44, 0x77dd55, 0x44aa22, 0x88dd44];

  for (let layer = 0; layer < 2; layer++) {
    let cx = -20;
    while (cx < width) {
      const clumpW = 60 + rand() * 100;
      const clumpH = 30 + rand() * 40;
      const baseColor = darkLeaf[Math.floor(rand() * darkLeaf.length)];

      for (let py = 0; py < clumpH; py += PX) {
        const t = py / clumpH;
        const rowW = clumpW * (1 - t * 0.6) * (0.7 + 0.3 * Math.sin((cx + py) * 0.2));
        px(gfx, cx, layer * 15 + py, rowW, PX, baseColor, 0.9 - layer * 0.2);
      }

      const detailCount = 3 + Math.floor(rand() * 6);
      for (let d = 0; d < detailCount; d++) {
        const dx = cx + rand() * clumpW;
        const dy = layer * 15 + rand() * clumpH * 0.7;
        const dColor = brightLeaf[Math.floor(rand() * brightLeaf.length)];
        const ds = PX + rand() * PX * 2;
        px(gfx, dx, dy, ds, ds, dColor, 0.85);

        if (rand() > 0.5) {
          px(gfx, dx + PX, dy + PX, ds * 0.6, ds * 0.6, 0x88ee55, 0.6);
        }
      }

      cx += clumpW * 0.6 + rand() * 30;
    }
  }
}

function drawLightRays(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(600);
  let rx = 40;
  while (rx < width) {
    if (rand() > 0.55) {
      const rayW = 8 + rand() * 20;
      const rayH = WORLD_H * 0.4 + rand() * WORLD_H * 0.3;
      const startY = 0;
      const drift = (rand() - 0.5) * 30;

      for (let ry = 0; ry < rayH; ry += PX) {
        const t = ry / rayH;
        const w = rayW * (1 - t * 0.3);
        const alpha = 0.04 * (1 - t * 0.7) * Math.sin(t * Math.PI);
        const xOff = drift * t;
        px(gfx, rx + xOff - w / 2, startY + ry, w, PX, 0xaaffaa, alpha);
      }
    }
    rx += 60 + rand() * 100;
  }
}

function drawGroundMoss(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(700);
  const mossColors = [0x2a6a22, 0x1a5a18, 0x338833, 0x1d6d1d];

  let mx = 0;
  while (mx < width) {
    const patchW = 20 + rand() * 40;
    const patchH = PX * (1 + Math.floor(rand() * 3));
    const baseY = WORLD_H * 0.85 + rand() * WORLD_H * 0.08;
    const color = mossColors[Math.floor(rand() * mossColors.length)];
    px(gfx, mx, baseY, patchW, patchH, color, 0.5);
    mx += 15 + rand() * 30;
  }
}

export function createJungleBackground(scene: Phaser.Scene): ParallaxLayer[] {
  const cam = scene.cameras.main;
  const viewW = cam.width;
  const farW = WORLD_W * 0.5;
  const midW = WORLD_W * 0.7;
  const nearW = WORLD_W * 0.85;
  const vineW = WORLD_W * 0.9;

  const skyGfx = scene.add.graphics().setDepth(-12).setScrollFactor(0);
  drawMistyGradient(skyGfx, viewW);

  const farGfx = scene.add.graphics().setDepth(-11).setScrollFactor(0);
  drawFarMist(farGfx, farW);
  drawLightRays(farGfx, farW);

  const midGfx = scene.add.graphics().setDepth(-10).setScrollFactor(0);
  drawMidTrees(midGfx, midW);

  const nearGfx = scene.add.graphics().setDepth(-9).setScrollFactor(0);
  drawUndergrowth(nearGfx, nearW);
  drawGroundMoss(nearGfx, nearW);

  const vineGfx = scene.add.graphics().setDepth(-8).setScrollFactor(0);
  drawHangingVines(vineGfx, vineW);
  drawCanopyTop(vineGfx, vineW);

  return [
    { gfx: farGfx, scrollFactor: 0.1 },
    { gfx: midGfx, scrollFactor: 0.3 },
    { gfx: nearGfx, scrollFactor: 0.55 },
    { gfx: vineGfx, scrollFactor: 0.7 },
  ];
}

export function updateJungleParallax(
  layers: ParallaxLayer[],
  camera: Phaser.Cameras.Scene2D.Camera,
) {
  for (const layer of layers) {
    layer.gfx.setX(-camera.scrollX * layer.scrollFactor);
    layer.gfx.setY(-camera.scrollY * layer.scrollFactor * 0.3);
  }
}
