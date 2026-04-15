import Phaser from "phaser";
import { LEVEL_WIDTH, TILE, LEVEL_HEIGHT } from "./WorldConfig";

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  flicker: number;
}

export interface LavaBackgroundState {
  skyGfx: Phaser.GameObjects.Graphics;
  farVolcanoImg: Phaser.GameObjects.Image;
  midHillsImg: Phaser.GameObjects.Image;
  nearRocksImg: Phaser.GameObjects.Image;
  emberGfx: Phaser.GameObjects.Graphics;
  embers: EmberParticle[];
  emberTimer: number;
}

const SCREEN_W = 800;
const SCREEN_H = LEVEL_HEIGHT * TILE;

function drawSkyGradient(gfx: Phaser.GameObjects.Graphics) {
  const bands = [
    { color: 0x1a0000, stop: 0 },
    { color: 0x2d0505, stop: 0.15 },
    { color: 0x4a0a00, stop: 0.3 },
    { color: 0x6b1500, stop: 0.5 },
    { color: 0x8b2500, stop: 0.65 },
    { color: 0xaa3300, stop: 0.8 },
    { color: 0xcc4400, stop: 0.9 },
    { color: 0xdd5500, stop: 1.0 },
  ];

  for (let i = 0; i < bands.length - 1; i++) {
    const y0 = Math.floor(bands[i].stop * SCREEN_H);
    const y1 = Math.floor(bands[i + 1].stop * SCREEN_H);
    gfx.fillStyle(bands[i].color, 1);
    gfx.fillRect(0, y0, SCREEN_W, y1 - y0);
  }

  const rng = new Phaser.Math.RandomDataGenerator(["lavasky"]);
  for (let i = 0; i < 12; i++) {
    const cx = rng.between(0, SCREEN_W);
    const cy = rng.between(0, Math.floor(SCREEN_H * 0.4));
    const w = rng.between(20, 80);
    const h = rng.between(4, 12);
    gfx.fillStyle(rng.pick([0x993300, 0x882200, 0x774400]), 0.3);
    gfx.fillRect(cx - w / 2, cy, w, h);
  }
}

function generateVolcanoProfile(width: number, seed: string, baseY: number, peakMinH: number, peakMaxH: number, volcanoCount: number): number[] {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const profile = new Array(Math.ceil(width / 4)).fill(baseY);
  const step = 4;

  const volcanoPositions: { center: number; halfWidth: number; height: number }[] = [];
  const segWidth = Math.floor(width / volcanoCount);
  for (let v = 0; v < volcanoCount; v++) {
    const center = Math.floor(segWidth * (v + 0.3 + rng.frac() * 0.4));
    const halfWidth = rng.between(40, 90);
    const height = rng.between(peakMinH, peakMaxH);
    volcanoPositions.push({ center, halfWidth, height });
  }

  for (let i = 0; i < profile.length; i++) {
    const x = i * step;
    let minY = baseY;
    for (const v of volcanoPositions) {
      const dist = Math.abs(x - v.center);
      if (dist < v.halfWidth) {
        const t = 1 - dist / v.halfWidth;
        const peakY = baseY - v.height * (t * t * 0.4 + t * 0.6);
        const jitter = rng.between(-2, 2);
        const snapped = Math.round(peakY / 4) * 4 + jitter;
        if (snapped < minY) minY = snapped;
      }
    }
    const noise = rng.between(-2, 2);
    profile[i] = Math.round((minY + noise) / 4) * 4;
  }

  return profile;
}

function drawVolcanoLayer(
  gfx: Phaser.GameObjects.Graphics,
  width: number,
  profile: number[],
  bodyColor: number,
  lavaColor: number,
  glowColor: number,
  seed: string,
  drawLavaStreams: boolean
) {
  const step = 4;
  const rng = new Phaser.Math.RandomDataGenerator([seed]);

  for (let i = 0; i < profile.length; i++) {
    const x = i * step;
    const topY = profile[i];

    for (let y = topY; y < SCREEN_H; y += step) {
      const depth = (y - topY) / (SCREEN_H - topY);
      let c = bodyColor;
      if (depth < 0.1) {
        c = Phaser.Display.Color.GetColor(
          Math.min(255, ((bodyColor >> 16) & 0xff) + 20),
          Math.min(255, ((bodyColor >> 8) & 0xff) + 10),
          Math.min(255, (bodyColor & 0xff) + 5)
        );
      }
      const variation = rng.between(-8, 8);
      const r = Math.max(0, Math.min(255, ((c >> 16) & 0xff) + variation));
      const g = Math.max(0, Math.min(255, ((c >> 8) & 0xff) + variation));
      const b = Math.max(0, Math.min(255, (c & 0xff) + variation));
      gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      gfx.fillRect(x, y, step, step);
    }
  }

  if (drawLavaStreams) {
    const volcanoTops: { x: number; y: number }[] = [];
    for (let i = 2; i < profile.length - 2; i++) {
      if (profile[i] < profile[i - 1] && profile[i] < profile[i + 1] && profile[i] <= profile[i - 2] && profile[i] <= profile[i + 2]) {
        volcanoTops.push({ x: i * step, y: profile[i] });
      }
    }

    for (const peak of volcanoTops) {
      gfx.fillStyle(glowColor, 0.8);
      gfx.fillRect(peak.x - 8, peak.y - 4, 16, 8);
      gfx.fillStyle(lavaColor, 0.9);
      gfx.fillRect(peak.x - 4, peak.y - 2, 8, 6);

      const streamCount = rng.between(1, 3);
      for (let s = 0; s < streamCount; s++) {
        let sx = peak.x + rng.between(-6, 6);
        let sy = peak.y + 4;
        const streamLen = rng.between(15, 40);

        for (let j = 0; j < streamLen; j++) {
          gfx.fillStyle(lavaColor, 0.7 - j * 0.012);
          gfx.fillRect(sx, sy, step, step);
          gfx.fillStyle(glowColor, 0.3 - j * 0.006);
          gfx.fillRect(sx - step, sy, step, step);
          gfx.fillRect(sx + step, sy, step, step);
          sy += step;
          sx += rng.between(-1, 1) * step;
        }
      }
    }
  }
}

function drawRockDetails(gfx: Phaser.GameObjects.Graphics, width: number, profile: number[], seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const step = 4;

  for (let i = 0; i < 15; i++) {
    const idx = rng.between(0, profile.length - 1);
    const x = idx * step;
    const y = profile[idx] - rng.between(0, 8);
    const w = rng.between(8, 20);
    const h = rng.between(4, 8);
    gfx.fillStyle(rng.pick([0x3a1a0a, 0x2a1005, 0x4a2510]), 0.6);
    gfx.fillRect(x, y, w, h);
  }
}

export function createLavaBackground(scene: Phaser.Scene): LavaBackgroundState {
  const skyGfx = scene.add.graphics().setScrollFactor(0).setDepth(-10);
  drawSkyGradient(skyGfx);

  const farWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.15) + 100;
  const farProfile = generateVolcanoProfile(farWidth, "farvol", Math.floor(SCREEN_H * 0.55), 80, 160, 5);
  const farGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawVolcanoLayer(farGfx, farWidth, farProfile, 0x2a0800, 0xff6600, 0xffaa00, "farvollava", true);
  farGfx.generateTexture("lava_far_vol", farWidth, SCREEN_H);
  farGfx.destroy();
  const farVolcanoImg = scene.add.image(0, 0, "lava_far_vol")
    .setOrigin(0, 0)
    .setScrollFactor(0.15, 0)
    .setDepth(-9);

  const midWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.3) + 100;
  const midProfile = generateVolcanoProfile(midWidth, "midhill", Math.floor(SCREEN_H * 0.65), 40, 100, 7);
  const midGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawVolcanoLayer(midGfx, midWidth, midProfile, 0x1f0600, 0xdd4400, 0xff8800, "midhilllava", true);
  drawRockDetails(midGfx, midWidth, midProfile, "midrocks");
  midGfx.generateTexture("lava_mid_hills", midWidth, SCREEN_H);
  midGfx.destroy();
  const midHillsImg = scene.add.image(0, 0, "lava_mid_hills")
    .setOrigin(0, 0)
    .setScrollFactor(0.3, 0)
    .setDepth(-8);

  const nearWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.5) + 100;
  const nearProfile = generateVolcanoProfile(nearWidth, "nearrock", Math.floor(SCREEN_H * 0.78), 20, 50, 10);
  const nearGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawVolcanoLayer(nearGfx, nearWidth, nearProfile, 0x150400, 0xcc3300, 0xff6600, "nearrocklava", false);
  drawRockDetails(nearGfx, nearWidth, nearProfile, "neardetails");
  nearGfx.generateTexture("lava_near_rocks", nearWidth, SCREEN_H);
  nearGfx.destroy();
  const nearRocksImg = scene.add.image(0, 0, "lava_near_rocks")
    .setOrigin(0, 0)
    .setScrollFactor(0.5, 0)
    .setDepth(-7);

  const emberGfx = scene.add.graphics().setScrollFactor(0).setDepth(-6);

  return {
    skyGfx,
    farVolcanoImg,
    midHillsImg,
    nearRocksImg,
    emberGfx,
    embers: [],
    emberTimer: 0,
  };
}

export function updateLavaBackground(state: LavaBackgroundState, delta: number) {
  state.emberTimer += delta;

  if (state.emberTimer > 100 && state.embers.length < 30) {
    state.emberTimer = 0;
    const rng = Math.random;
    state.embers.push({
      x: rng() * SCREEN_W,
      y: SCREEN_H + 4,
      vx: (rng() - 0.5) * 30,
      vy: -(rng() * 40 + 20),
      life: 0,
      maxLife: 2000 + rng() * 3000,
      size: 2 + Math.floor(rng() * 3),
      color: rng() > 0.5 ? 0xff6600 : (rng() > 0.5 ? 0xffaa00 : 0xff3300),
      flicker: rng() * Math.PI * 2,
    });
  }

  state.emberGfx.clear();

  for (let i = state.embers.length - 1; i >= 0; i--) {
    const e = state.embers[i];
    e.life += delta;
    if (e.life >= e.maxLife) {
      state.embers.splice(i, 1);
      continue;
    }

    e.x += e.vx * (delta / 1000);
    e.y += e.vy * (delta / 1000);
    e.vx += (Math.sin(e.flicker + e.life * 0.003) * 10) * (delta / 1000);

    const fade = 1 - e.life / e.maxLife;
    const flick = 0.5 + 0.5 * Math.sin(e.flicker + e.life * 0.01);
    const alpha = fade * flick;

    if (alpha > 0.05) {
      state.emberGfx.fillStyle(e.color, alpha);
      state.emberGfx.fillRect(
        Math.round(e.x / 2) * 2,
        Math.round(e.y / 2) * 2,
        e.size,
        e.size
      );

      state.emberGfx.fillStyle(0xffcc00, alpha * 0.3);
      state.emberGfx.fillRect(
        Math.round(e.x / 2) * 2 - 1,
        Math.round(e.y / 2) * 2 - 1,
        e.size + 2,
        e.size + 2
      );
    }
  }
}

export function destroyLavaBackground(state: LavaBackgroundState, scene: Phaser.Scene) {
  state.skyGfx.destroy();
  state.farVolcanoImg.destroy();
  state.midHillsImg.destroy();
  state.nearRocksImg.destroy();
  state.emberGfx.destroy();

  if (scene.textures.exists("lava_far_vol")) scene.textures.remove("lava_far_vol");
  if (scene.textures.exists("lava_mid_hills")) scene.textures.remove("lava_mid_hills");
  if (scene.textures.exists("lava_near_rocks")) scene.textures.remove("lava_near_rocks");
}
