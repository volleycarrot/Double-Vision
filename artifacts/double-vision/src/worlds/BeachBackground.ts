import Phaser from "phaser";
import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT } from "./WorldConfig";

const WORLD_W = LEVEL_WIDTH * TILE;
const WORLD_H = LEVEL_HEIGHT * TILE;
const PX = 4;

export interface BeachParallaxLayer {
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

function drawSkyGradient(gfx: Phaser.GameObjects.Graphics, width: number) {
  const topColor = 0x5a8fcc;
  const midColor = 0x87ceeb;
  const horizonColor = 0xc8e0f0;
  const steps = Math.ceil(WORLD_H / PX);

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    let color: number;
    if (t < 0.5) {
      color = lerpColor(topColor, midColor, t / 0.5);
    } else {
      color = lerpColor(midColor, horizonColor, (t - 0.5) / 0.5);
    }
    px(gfx, 0, i * PX, width, PX, color);
  }
}

function drawClouds(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(150);
  const cloudColors = [0xffffff, 0xeef4fa, 0xe0eaf4, 0xd8e4f0];

  const cloudDefs: { cx: number; cy: number; w: number; h: number }[] = [];
  let cx = 30;
  while (cx < width) {
    const cw = 60 + rand() * 120;
    const ch = 16 + rand() * 24;
    const cy = 20 + rand() * (WORLD_H * 0.25);
    cloudDefs.push({ cx, cy, w: cw, h: ch });
    cx += cw + 80 + rand() * 200;
  }

  for (const cloud of cloudDefs) {
    const blobCount = 3 + Math.floor(rand() * 4);
    for (let b = 0; b < blobCount; b++) {
      const bx = cloud.cx + (rand() - 0.3) * cloud.w * 0.7;
      const by = cloud.cy + (rand() - 0.5) * cloud.h * 0.4;
      const bw = cloud.w * (0.3 + rand() * 0.5);
      const bh = cloud.h * (0.5 + rand() * 0.5);
      const color = cloudColors[Math.floor(rand() * cloudColors.length)];
      const alpha = 0.6 + rand() * 0.3;

      for (let py = 0; py < bh; py += PX) {
        const t = py / bh;
        const rowW = bw * Math.sin(t * Math.PI);
        px(gfx, bx + (bw - rowW) / 2, by + py, rowW, PX, color, alpha * (1 - t * 0.3));
      }
    }

    px(gfx, cloud.cx, cloud.cy + cloud.h * 0.3, cloud.w * 0.8, PX, 0xd0dae8, 0.3);
  }
}

function drawOceanHorizon(gfx: Phaser.GameObjects.Graphics, width: number) {
  const horizonY = WORLD_H * 0.55;
  const oceanTop = 0x3a8abf;
  const oceanMid = 0x2a6a9f;
  const oceanBot = 0x1a4a7f;

  for (let y = horizonY; y < WORLD_H; y += PX) {
    const t = (y - horizonY) / (WORLD_H - horizonY);
    let color: number;
    if (t < 0.4) {
      color = lerpColor(oceanTop, oceanMid, t / 0.4);
    } else {
      color = lerpColor(oceanMid, oceanBot, (t - 0.4) / 0.6);
    }
    px(gfx, 0, y, width, PX, color);
  }

  const rand = seededRandom(250);
  for (let i = 0; i < 20; i++) {
    const sx = rand() * width;
    const sy = horizonY + 10 + rand() * (WORLD_H * 0.35);
    const sw = 20 + rand() * 60;
    px(gfx, sx, sy, sw, PX, 0x5ab0dd, 0.15 + rand() * 0.1);
  }

  px(gfx, 0, horizonY - PX, width, PX * 2, 0x88bbdd, 0.4);
}

function drawBoats(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(350);
  const horizonY = WORLD_H * 0.55;

  const boatDefs: { x: number; y: number; size: number; type: string }[] = [];
  let bx = 60 + rand() * 100;
  while (bx < width - 40) {
    const size = 0.6 + rand() * 0.6;
    const y = horizonY + 4 + rand() * 20;
    const type = rand() > 0.4 ? "sail" : "ship";
    boatDefs.push({ x: bx, y, size, type });
    bx += 140 + rand() * 260;
  }

  for (const boat of boatDefs) {
    const s = boat.size;
    if (boat.type === "sail") {
      const hullW = 24 * s;
      const hullH = 6 * s;
      px(gfx, boat.x - hullW / 2, boat.y, hullW, hullH, 0x5a3a1a, 0.9);
      px(gfx, boat.x - hullW / 2 + PX, boat.y + PX, hullW - PX * 2, PX, 0x7a5a3a, 0.7);

      const mastH = 28 * s;
      px(gfx, boat.x - 1, boat.y - mastH, PX, mastH, 0x4a3a2a, 0.9);

      const sailW = 14 * s;
      const sailH = 20 * s;
      for (let sy = 0; sy < sailH; sy += PX) {
        const t = sy / sailH;
        const rowW = sailW * (1 - t * 0.3) * Math.sin((t + 0.1) * Math.PI * 0.8);
        px(gfx, boat.x + 2, boat.y - mastH + 4 + sy, rowW, PX, 0xf0ece0, 0.85);
      }
    } else {
      const hullW = 32 * s;
      const hullH = 8 * s;
      px(gfx, boat.x - hullW / 2, boat.y, hullW, hullH, 0x4a3020, 0.9);
      px(gfx, boat.x - hullW / 2, boat.y + hullH - PX, hullW, PX, 0x3a2010, 0.8);

      const cabinW = 12 * s;
      const cabinH = 10 * s;
      px(gfx, boat.x - cabinW / 2, boat.y - cabinH, cabinW, cabinH, 0x6a4a2a, 0.9);

      const mastH = 22 * s;
      px(gfx, boat.x + 2, boat.y - cabinH - mastH, PX, mastH, 0x4a3a2a, 0.9);

      const flagW = 8 * s;
      const flagH = 5 * s;
      const flagColor = rand() > 0.5 ? 0xcc3333 : 0x3366aa;
      px(gfx, boat.x + 2 + PX, boat.y - cabinH - mastH, flagW, flagH, flagColor, 0.8);
    }
  }
}

function drawDistantIslands(gfx: Phaser.GameObjects.Graphics, width: number) {
  const rand = seededRandom(450);
  const horizonY = WORLD_H * 0.55;

  let ix = 100 + rand() * 200;
  while (ix < width - 60) {
    const islandW = 40 + rand() * 80;
    const islandH = 8 + rand() * 14;
    const baseY = horizonY - 2;

    for (let py = 0; py < islandH; py += PX) {
      const t = py / islandH;
      const rowW = islandW * Math.sin(t * Math.PI * 0.5 + 0.5);
      const color = lerpColor(0x5a8a55, 0x3a6a35, t);
      px(gfx, ix + (islandW - rowW) / 2, baseY - islandH + py, rowW, PX, color, 0.5 + t * 0.2);
    }

    if (rand() > 0.4) {
      const palmX = ix + islandW * (0.3 + rand() * 0.4);
      const trunkH = 12 + rand() * 8;
      px(gfx, palmX, baseY - islandH - trunkH, PX, trunkH, 0x6a5030, 0.5);
      px(gfx, palmX - PX * 2, baseY - islandH - trunkH - PX, PX * 5, PX * 2, 0x3a8a3a, 0.5);
    }

    ix += islandW + 200 + rand() * 300;
  }
}

export function createBeachBackground(scene: Phaser.Scene): BeachParallaxLayer[] {
  const cam = scene.cameras.main;
  const viewW = cam.width;
  const farW = WORLD_W * 0.5;
  const midW = WORLD_W * 0.7;

  const skyGfx = scene.add.graphics().setDepth(-12).setScrollFactor(0);
  drawSkyGradient(skyGfx, viewW);

  const farGfx = scene.add.graphics().setDepth(-11).setScrollFactor(0);
  drawOceanHorizon(farGfx, farW);
  drawDistantIslands(farGfx, farW);

  const midGfx = scene.add.graphics().setDepth(-10).setScrollFactor(0);
  drawBoats(midGfx, midW);

  const cloudGfx = scene.add.graphics().setDepth(-9).setScrollFactor(0);
  drawClouds(cloudGfx, farW);

  return [
    { gfx: farGfx, scrollFactor: 0.1 },
    { gfx: midGfx, scrollFactor: 0.2 },
    { gfx: cloudGfx, scrollFactor: 0.05 },
  ];
}

export function updateBeachParallax(
  layers: BeachParallaxLayer[],
  camera: Phaser.Cameras.Scene2D.Camera,
) {
  for (const layer of layers) {
    layer.gfx.setX(-camera.scrollX * layer.scrollFactor);
    layer.gfx.setY(-camera.scrollY * layer.scrollFactor * 0.3);
  }
}
