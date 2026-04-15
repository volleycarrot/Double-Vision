import Phaser from "phaser";
import { LEVEL_WIDTH, TILE, LEVEL_HEIGHT } from "./WorldConfig";

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  color: number;
}

export interface WarZoneBackgroundState {
  skyGfx: Phaser.GameObjects.Graphics;
  farCityImg: Phaser.GameObjects.Image;
  midBuildingsImg: Phaser.GameObjects.Image;
  nearDebrisImg: Phaser.GameObjects.Image;
  smokeGfx: Phaser.GameObjects.Graphics;
  particles: SmokeParticle[];
  particleTimer: number;
}

const SCREEN_W = 800;
const SCREEN_H = LEVEL_HEIGHT * TILE;

function drawSmokySky(gfx: Phaser.GameObjects.Graphics) {
  const bands = [
    { color: 0x0f0f0f, stop: 0 },
    { color: 0x1a1615, stop: 0.1 },
    { color: 0x2a2220, stop: 0.2 },
    { color: 0x3a2e28, stop: 0.35 },
    { color: 0x4a3830, stop: 0.5 },
    { color: 0x3d302a, stop: 0.65 },
    { color: 0x2e2420, stop: 0.8 },
    { color: 0x1f1a18, stop: 1.0 },
  ];

  for (let i = 0; i < bands.length - 1; i++) {
    const y0 = Math.floor(bands[i].stop * SCREEN_H);
    const y1 = Math.floor(bands[i + 1].stop * SCREEN_H);
    gfx.fillStyle(bands[i].color, 1);
    gfx.fillRect(0, y0, SCREEN_W, y1 - y0);
  }

  const rng = new Phaser.Math.RandomDataGenerator(["warsky"]);
  for (let i = 0; i < 18; i++) {
    const cx = rng.between(0, SCREEN_W);
    const cy = rng.between(0, Math.floor(SCREEN_H * 0.5));
    const w = rng.between(30, 120);
    const h = rng.between(6, 18);
    gfx.fillStyle(rng.pick([0x3a3030, 0x443830, 0x2e2828]), 0.25);
    gfx.fillRect(cx - w / 2, cy, w, h);
  }

  for (let i = 0; i < 6; i++) {
    const cx = rng.between(100, SCREEN_W - 100);
    const cy = rng.between(Math.floor(SCREEN_H * 0.2), Math.floor(SCREEN_H * 0.5));
    const r = rng.between(15, 40);
    for (let dy = -r; dy < r; dy += 4) {
      for (let dx = -r; dx < r; dx += 4) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r) {
          const a = (1 - dist / r) * 0.12;
          gfx.fillStyle(rng.pick([0x883322, 0x774422, 0x993311]), a);
          gfx.fillRect(cx + dx, cy + dy, 4, 4);
        }
      }
    }
  }
}

function generateRuinProfile(width: number, seed: string, baseY: number, minH: number, maxH: number, buildingCount: number): number[] {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const step = 4;
  const profile = new Array(Math.ceil(width / step)).fill(baseY);

  const buildings: { start: number; end: number; height: number; style: number }[] = [];
  const segWidth = Math.floor(width / buildingCount);

  for (let b = 0; b < buildingCount; b++) {
    const bStart = Math.floor(segWidth * b + rng.frac() * segWidth * 0.2);
    const bWidth = rng.between(30, segWidth - 10);
    const bEnd = Math.min(bStart + bWidth, width);
    const height = rng.between(minH, maxH);
    buildings.push({ start: bStart, end: bEnd, height, style: rng.between(0, 2) });
  }

  for (const b of buildings) {
    const startIdx = Math.floor(b.start / step);
    const endIdx = Math.min(Math.floor(b.end / step), profile.length - 1);

    for (let i = startIdx; i <= endIdx; i++) {
      let topY = baseY - b.height;
      const relX = (i - startIdx) / (endIdx - startIdx + 1);

      if (b.style === 0) {
        const damage = rng.frac();
        if (damage > 0.7) {
          topY += rng.between(10, b.height * 0.5);
        }
        if (relX < 0.05 || relX > 0.95) {
          topY += rng.between(5, 15);
        }
      } else if (b.style === 1) {
        const jagged = Math.sin(relX * Math.PI * 4 + rng.frac() * 2) * 15;
        topY += Math.max(0, jagged);
        if (rng.frac() > 0.85) {
          topY += rng.between(15, 40);
        }
      } else {
        if (relX > 0.3 && relX < 0.7) {
          topY += rng.between(20, b.height * 0.6);
        }
      }

      const noise = rng.between(-3, 3);
      profile[i] = Math.min(profile[i], Math.round((topY + noise) / 4) * 4);
    }
  }

  return profile;
}

function drawRuinLayer(
  gfx: Phaser.GameObjects.Graphics,
  width: number,
  profile: number[],
  bodyColor: number,
  detailColor: number,
  windowColor: number,
  seed: string,
  drawWindows: boolean,
  drawFires: boolean,
) {
  const step = 4;
  const rng = new Phaser.Math.RandomDataGenerator([seed]);

  for (let i = 0; i < profile.length; i++) {
    const x = i * step;
    const topY = profile[i];

    for (let y = topY; y < SCREEN_H; y += step) {
      const depth = (y - topY) / (SCREEN_H - topY);
      let c = bodyColor;
      if (depth < 0.05) {
        c = Phaser.Display.Color.GetColor(
          Math.min(255, ((bodyColor >> 16) & 0xff) + 15),
          Math.min(255, ((bodyColor >> 8) & 0xff) + 12),
          Math.min(255, (bodyColor & 0xff) + 10)
        );
      }
      const variation = rng.between(-6, 6);
      const r = Math.max(0, Math.min(255, ((c >> 16) & 0xff) + variation));
      const g = Math.max(0, Math.min(255, ((c >> 8) & 0xff) + variation));
      const b = Math.max(0, Math.min(255, (c & 0xff) + variation));
      gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      gfx.fillRect(x, y, step, step);
    }
  }

  if (drawWindows) {
    for (let i = 0; i < profile.length - 2; i++) {
      const x = i * step;
      const topY = profile[i];
      const buildingH = SCREEN_H - topY;

      if (buildingH > 40) {
        for (let wy = topY + 12; wy < SCREEN_H - 20; wy += rng.between(14, 22)) {
          if (rng.frac() > 0.4) {
            const ww = rng.between(4, 10);
            const wh = rng.between(6, 12);
            const broken = rng.frac() > 0.5;
            if (broken) {
              gfx.fillStyle(0x0a0a0a, 0.8);
              gfx.fillRect(x, wy, ww, wh);
              gfx.fillStyle(detailColor, 0.3);
              gfx.fillRect(x, wy + wh - 2, ww, 2);
            } else {
              gfx.fillStyle(windowColor, 0.4);
              gfx.fillRect(x, wy, ww, wh);
            }
          }
        }
      }
    }
  }

  if (drawFires) {
    for (let i = 5; i < profile.length - 5; i++) {
      if (rng.frac() > 0.92) {
        const x = i * step;
        const y = profile[i] + rng.between(10, 40);
        const fireW = rng.between(6, 14);
        const fireH = rng.between(8, 18);

        gfx.fillStyle(0xff6622, 0.5);
        gfx.fillRect(x, y - fireH, fireW, fireH);
        gfx.fillStyle(0xffaa33, 0.35);
        gfx.fillRect(x + 2, y - fireH + 2, fireW - 4, fireH - 4);
        gfx.fillStyle(0xff4400, 0.25);
        gfx.fillRect(x - 2, y - fireH - 4, fireW + 4, 6);
      }
    }
  }
}

function drawRubbleDetails(gfx: Phaser.GameObjects.Graphics, width: number, profile: number[], seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const step = 4;

  for (let i = 0; i < 25; i++) {
    const idx = rng.between(0, profile.length - 1);
    const x = idx * step;
    const y = profile[idx] - rng.between(0, 6);
    const w = rng.between(6, 24);
    const h = rng.between(4, 10);
    gfx.fillStyle(rng.pick([0x3a3535, 0x2e2a28, 0x45403a, 0x504842]), 0.7);
    gfx.fillRect(x, y, w, h);
  }

  for (let i = 0; i < 12; i++) {
    const idx = rng.between(0, profile.length - 1);
    const x = idx * step;
    const baseY = profile[idx];
    const rebarH = rng.between(8, 25);
    gfx.fillStyle(0x6a4a30, 0.6);
    gfx.fillRect(x, baseY - rebarH, 2, rebarH);
    if (rng.frac() > 0.5) {
      gfx.fillRect(x - 4, baseY - rebarH, 10, 2);
    }
  }
}

function drawDebrisPiles(gfx: Phaser.GameObjects.Graphics, width: number, seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const step = 4;

  for (let i = 0; i < 20; i++) {
    const cx = rng.between(0, width);
    const baseY = SCREEN_H * 0.82 + rng.frac() * SCREEN_H * 0.1;
    const pileW = rng.between(20, 60);
    const pileH = rng.between(10, 30);
    const color = rng.pick([0x3a3530, 0x4a4540, 0x2e2a25, 0x55504a]);

    for (let py = 0; py < pileH; py += step) {
      const t = py / pileH;
      const rowW = pileW * (1 - t * 0.7);
      gfx.fillStyle(color, 0.8);
      gfx.fillRect(cx - rowW / 2, baseY - py, rowW, step);
    }

    for (let c = 0; c < 5; c++) {
      const chunkX = cx + rng.between(-pileW / 2, pileW / 2);
      const chunkY = baseY - rng.between(0, pileH);
      const chunkS = rng.between(3, 8);
      gfx.fillStyle(rng.pick([0x555050, 0x605a55, 0x4a4540]), 0.7);
      gfx.fillRect(chunkX, chunkY, chunkS, chunkS);
    }
  }
}

export function createWarZoneBackground(scene: Phaser.Scene): WarZoneBackgroundState {
  const skyGfx = scene.add.graphics().setScrollFactor(0).setDepth(-10);
  drawSmokySky(skyGfx);

  const farWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.15) + 100;
  const farProfile = generateRuinProfile(farWidth, "farcity", Math.floor(SCREEN_H * 0.4), 60, 180, 8);
  const farGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawRuinLayer(farGfx, farWidth, farProfile, 0x1a1818, 0x2a2525, 0x222020, "farcitydet", false, true);
  farGfx.generateTexture("war_far_city", farWidth, SCREEN_H);
  farGfx.destroy();
  const farCityImg = scene.add.image(0, 0, "war_far_city")
    .setOrigin(0, 0)
    .setScrollFactor(0.15, 0)
    .setDepth(-9);

  const midWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.3) + 100;
  const midProfile = generateRuinProfile(midWidth, "midbuildings", Math.floor(SCREEN_H * 0.45), 50, 140, 12);
  const midGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawRuinLayer(midGfx, midWidth, midProfile, 0x252020, 0x3a3530, 0x1a1818, "midbuilddet", true, true);
  drawRubbleDetails(midGfx, midWidth, midProfile, "midrubble");
  midGfx.generateTexture("war_mid_buildings", midWidth, SCREEN_H);
  midGfx.destroy();
  const midBuildingsImg = scene.add.image(0, 0, "war_mid_buildings")
    .setOrigin(0, 0)
    .setScrollFactor(0.3, 0)
    .setDepth(-8);

  const nearWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.5) + 100;
  const nearProfile = generateRuinProfile(nearWidth, "neardebris", Math.floor(SCREEN_H * 0.7), 20, 60, 15);
  const nearGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawRuinLayer(nearGfx, nearWidth, nearProfile, 0x1e1a18, 0x302a28, 0x151212, "neardebrdet", true, false);
  drawRubbleDetails(nearGfx, nearWidth, nearProfile, "nearrubbledet");
  drawDebrisPiles(nearGfx, nearWidth, "nearpiles");
  nearGfx.generateTexture("war_near_debris", nearWidth, SCREEN_H);
  nearGfx.destroy();
  const nearDebrisImg = scene.add.image(0, 0, "war_near_debris")
    .setOrigin(0, 0)
    .setScrollFactor(0.5, 0)
    .setDepth(-7);

  const smokeGfx = scene.add.graphics().setScrollFactor(0).setDepth(-6);

  return {
    skyGfx,
    farCityImg,
    midBuildingsImg,
    nearDebrisImg,
    smokeGfx,
    particles: [],
    particleTimer: 0,
  };
}

export function updateWarZoneBackground(state: WarZoneBackgroundState, delta: number) {
  state.particleTimer += delta;

  if (state.particleTimer > 120 && state.particles.length < 35) {
    state.particleTimer = 0;
    const rng = Math.random;
    const spawnFromBottom = rng() > 0.4;
    state.particles.push({
      x: rng() * SCREEN_W,
      y: spawnFromBottom ? SCREEN_H + 4 : rng() * SCREEN_H * 0.8,
      vx: (rng() - 0.3) * 20,
      vy: -(rng() * 15 + 5),
      life: 0,
      maxLife: 3000 + rng() * 4000,
      size: 3 + Math.floor(rng() * 5),
      alpha: 0.15 + rng() * 0.25,
      color: rng() > 0.7 ? 0x554a44 : (rng() > 0.5 ? 0x4a4240 : 0x3a3535),
    });
  }

  state.smokeGfx.clear();

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += delta;
    if (p.life >= p.maxLife) {
      state.particles.splice(i, 1);
      continue;
    }

    p.x += p.vx * (delta / 1000);
    p.y += p.vy * (delta / 1000);
    p.vx += Math.sin(p.life * 0.001 + p.x * 0.01) * 5 * (delta / 1000);

    const fade = 1 - p.life / p.maxLife;
    const growFactor = 1 + (p.life / p.maxLife) * 1.5;
    const currentSize = Math.floor(p.size * growFactor);
    const currentAlpha = p.alpha * fade;

    if (currentAlpha > 0.02) {
      state.smokeGfx.fillStyle(p.color, currentAlpha);
      state.smokeGfx.fillRect(
        Math.round(p.x / 2) * 2,
        Math.round(p.y / 2) * 2,
        currentSize,
        currentSize
      );

      state.smokeGfx.fillStyle(p.color, currentAlpha * 0.4);
      state.smokeGfx.fillRect(
        Math.round(p.x / 2) * 2 - 2,
        Math.round(p.y / 2) * 2 - 2,
        currentSize + 4,
        currentSize + 4
      );
    }
  }
}

export function destroyWarZoneBackground(state: WarZoneBackgroundState, scene: Phaser.Scene) {
  state.skyGfx.destroy();
  state.farCityImg.destroy();
  state.midBuildingsImg.destroy();
  state.nearDebrisImg.destroy();
  state.smokeGfx.destroy();

  if (scene.textures.exists("war_far_city")) scene.textures.remove("war_far_city");
  if (scene.textures.exists("war_mid_buildings")) scene.textures.remove("war_mid_buildings");
  if (scene.textures.exists("war_near_debris")) scene.textures.remove("war_near_debris");
}
