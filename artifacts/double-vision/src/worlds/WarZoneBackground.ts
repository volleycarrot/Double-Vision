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

interface BuildingDef {
  x: number;
  width: number;
  height: number;
  roofType: "flat" | "peaked" | "antenna" | "watertower" | "spire";
  damageType: "intact" | "top_blown" | "side_collapse" | "gutted";
  damageSide: "left" | "right" | "center";
  floors: number;
  windowCols: number;
}

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

function generateCityBuildings(width: number, seed: string, _baseY: number, minH: number, maxH: number, count: number): BuildingDef[] {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const buildings: BuildingDef[] = [];
  const segW = Math.floor(width / count);

  for (let i = 0; i < count; i++) {
    const bWidth = rng.between(Math.floor(segW * 0.4), Math.floor(segW * 0.85));
    const gap = rng.between(4, Math.floor(segW * 0.15));
    const bx = segW * i + gap;
    const bHeight = rng.between(minH, maxH);
    const roofType = rng.pick(["flat", "flat", "flat", "peaked", "antenna", "watertower", "spire"] as BuildingDef["roofType"][]);
    const damageType = rng.pick(["intact", "intact", "top_blown", "side_collapse", "gutted"] as BuildingDef["damageType"][]);
    const damageSide = rng.pick(["left", "right", "center"] as BuildingDef["damageSide"][]);
    const floorH = rng.between(12, 20);
    const floors = Math.max(2, Math.floor(bHeight / floorH));
    const windowCols = Math.max(2, Math.floor(bWidth / rng.between(8, 14)));

    buildings.push({ x: bx, width: bWidth, height: bHeight, roofType, damageType, damageSide, floors, windowCols });
  }
  return buildings;
}

function drawFarSkyline(gfx: Phaser.GameObjects.Graphics, _width: number, buildings: BuildingDef[], baseY: number, bodyColor: number, seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);

  for (const b of buildings) {
    const topY = baseY - b.height;
    let effectiveTopY = topY;

    if (b.damageType === "top_blown") {
      const cutDepth = b.height * rng.realInRange(0.15, 0.35);
      const cutStart = b.x + b.width * rng.realInRange(0.2, 0.5);
      const cutEnd = cutStart + b.width * rng.realInRange(0.2, 0.4);

      gfx.fillStyle(bodyColor, 1);
      gfx.fillRect(b.x, topY, cutStart - b.x, b.height + (baseY - topY));
      gfx.fillRect(cutEnd, topY + cutDepth * 0.5, b.x + b.width - cutEnd, b.height - cutDepth * 0.5 + (baseY - topY));

      for (let jx = cutStart; jx < cutEnd; jx += 4) {
        const jaggedY = topY + cutDepth + rng.between(-8, 8);
        gfx.fillStyle(bodyColor, 1);
        gfx.fillRect(jx, jaggedY, 4, baseY - jaggedY);
      }
    } else if (b.damageType === "side_collapse") {
      const collapseW = b.width * rng.realInRange(0.2, 0.4);
      if (b.damageSide === "left") {
        gfx.fillStyle(bodyColor, 1);
        gfx.fillRect(b.x + collapseW, topY, b.width - collapseW, baseY - topY);
        for (let jx = b.x; jx < b.x + collapseW; jx += 4) {
          const slopeY = topY + (jx - b.x) / collapseW * b.height * 0.5;
          gfx.fillRect(jx, topY + b.height * 0.3 + rng.between(-4, 8), 4, baseY - slopeY);
        }
      } else {
        gfx.fillStyle(bodyColor, 1);
        gfx.fillRect(b.x, topY, b.width - collapseW, baseY - topY);
        const startX = b.x + b.width - collapseW;
        for (let jx = startX; jx < b.x + b.width; jx += 4) {
          const t = (jx - startX) / collapseW;
          const slopeY = topY + t * b.height * 0.5;
          gfx.fillRect(jx, slopeY + rng.between(-4, 8), 4, baseY - slopeY);
        }
      }
    } else if (b.damageType === "gutted") {
      gfx.fillStyle(bodyColor, 1);
      const wallThick = Math.max(4, Math.floor(b.width * 0.12));
      gfx.fillRect(b.x, topY, wallThick, baseY - topY);
      gfx.fillRect(b.x + b.width - wallThick, topY + rng.between(0, 15), wallThick, baseY - topY);
      for (let fy = topY + 14; fy < baseY; fy += Math.floor(b.height / b.floors)) {
        if (rng.frac() > 0.3) {
          const floorW = b.width * rng.realInRange(0.3, 0.8);
          const floorX = b.x + (rng.frac() > 0.5 ? 0 : b.width - floorW);
          gfx.fillRect(floorX, fy, floorW, 3);
        }
      }
    } else {
      gfx.fillStyle(bodyColor, 1);
      gfx.fillRect(b.x, topY, b.width, baseY - topY);
    }

    const highlightColor = Phaser.Display.Color.GetColor(
      Math.min(255, ((bodyColor >> 16) & 0xff) + 12),
      Math.min(255, ((bodyColor >> 8) & 0xff) + 10),
      Math.min(255, (bodyColor & 0xff) + 8)
    );
    gfx.fillStyle(highlightColor, 0.6);
    gfx.fillRect(b.x, topY, b.width, 2);
    gfx.fillRect(b.x, topY, 2, Math.min(20, baseY - topY));

    effectiveTopY = topY;
    if (b.roofType === "antenna" && b.damageType !== "top_blown") {
      const antennaX = b.x + Math.floor(b.width * 0.5);
      const antennaH = rng.between(15, 35);
      gfx.fillStyle(bodyColor, 1);
      gfx.fillRect(antennaX, effectiveTopY - antennaH, 2, antennaH);
      gfx.fillRect(antennaX - 4, effectiveTopY - antennaH, 10, 2);
      if (rng.frac() > 0.5) {
        gfx.fillRect(antennaX - 6, effectiveTopY - antennaH + 6, 14, 2);
      }
    } else if (b.roofType === "watertower" && b.damageType !== "top_blown") {
      const twX = b.x + Math.floor(b.width * rng.realInRange(0.3, 0.6));
      const twW = rng.between(8, 14);
      const twH = rng.between(8, 14);
      const legH = rng.between(4, 8);
      gfx.fillStyle(bodyColor, 1);
      gfx.fillRect(twX, effectiveTopY - legH - twH, twW, twH);
      gfx.fillRect(twX + 2, effectiveTopY - legH, 2, legH);
      gfx.fillRect(twX + twW - 4, effectiveTopY - legH, 2, legH);
    } else if (b.roofType === "peaked" && b.damageType !== "top_blown") {
      const peakH = rng.between(8, 18);
      for (let py = 0; py < peakH; py += 2) {
        const t = py / peakH;
        const rowW = b.width * (1 - t);
        gfx.fillStyle(bodyColor, 1);
        gfx.fillRect(b.x + (b.width - rowW) / 2, effectiveTopY - py, rowW, 2);
      }
    } else if (b.roofType === "spire" && b.damageType !== "top_blown") {
      const spireH = rng.between(20, 40);
      for (let sy = 0; sy < spireH; sy += 2) {
        const t = sy / spireH;
        const sw = Math.max(2, Math.floor(8 * (1 - t)));
        gfx.fillStyle(bodyColor, 1);
        gfx.fillRect(b.x + Math.floor(b.width / 2) - Math.floor(sw / 2), effectiveTopY - sy, sw, 2);
      }
    }
  }
}

function drawMidBuildings(
  gfx: Phaser.GameObjects.Graphics,
  _width: number,
  buildings: BuildingDef[],
  baseY: number,
  bodyColor: number,
  detailColor: number,
  windowColor: number,
  seed: string,
) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);

  for (const b of buildings) {
    const topY = baseY - b.height;

    gfx.fillStyle(bodyColor, 1);
    gfx.fillRect(b.x, topY, b.width, baseY - topY);

    const edgeColor = Phaser.Display.Color.GetColor(
      Math.min(255, ((bodyColor >> 16) & 0xff) + 15),
      Math.min(255, ((bodyColor >> 8) & 0xff) + 12),
      Math.min(255, (bodyColor & 0xff) + 10)
    );
    gfx.fillStyle(edgeColor, 0.7);
    gfx.fillRect(b.x, topY, b.width, 2);
    gfx.fillRect(b.x, topY, 2, baseY - topY);
    gfx.fillRect(b.x + b.width - 2, topY, 2, baseY - topY);

    const floorH = Math.floor(b.height / b.floors);
    for (let f = 0; f < b.floors; f++) {
      const floorY = topY + f * floorH;

      gfx.fillStyle(detailColor, 0.4);
      gfx.fillRect(b.x, floorY + floorH - 2, b.width, 2);

      const winW = Math.max(4, Math.floor((b.width - 8) / b.windowCols) - 3);
      const winH = Math.max(4, floorH - 6);
      const spacing = Math.floor((b.width - 4) / b.windowCols);

      for (let c = 0; c < b.windowCols; c++) {
        const wx = b.x + 4 + c * spacing;
        const wy = floorY + 3;

        if (b.damageType === "gutted" && f < b.floors * 0.6 && rng.frac() > 0.4) {
          continue;
        }

        if (b.damageType === "side_collapse") {
          if (b.damageSide === "left" && c < b.windowCols * 0.3 && rng.frac() > 0.3) continue;
          if (b.damageSide === "right" && c > b.windowCols * 0.7 && rng.frac() > 0.3) continue;
        }

        const broken = rng.frac() > 0.55;
        if (broken) {
          gfx.fillStyle(0x0a0a0a, 0.8);
          gfx.fillRect(wx, wy, winW, winH);
          if (rng.frac() > 0.5) {
            gfx.fillStyle(detailColor, 0.3);
            const shardH = rng.between(2, Math.floor(winH * 0.6));
            gfx.fillRect(wx, wy + winH - shardH, rng.between(1, winW), shardH);
          }
        } else {
          const glowing = rng.frac() > 0.85;
          if (glowing) {
            gfx.fillStyle(0x884422, 0.3);
            gfx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
          }
          gfx.fillStyle(windowColor, glowing ? 0.6 : 0.35);
          gfx.fillRect(wx, wy, winW, winH);
          gfx.fillStyle(detailColor, 0.2);
          gfx.fillRect(wx + Math.floor(winW / 2), wy, 1, winH);
          gfx.fillRect(wx, wy + Math.floor(winH / 2), winW, 1);
        }
      }
    }

    if (b.damageType === "top_blown") {
      const cutStart = b.x + b.width * rng.realInRange(0.15, 0.4);
      const cutEnd = cutStart + b.width * rng.realInRange(0.25, 0.45);
      const cutDepth = b.height * rng.realInRange(0.15, 0.35);

      gfx.fillStyle(0x0f0d0c, 1);
      for (let jx = cutStart; jx < cutEnd; jx += 4) {
        const jaggedY = topY + rng.between(-6, 12);
        gfx.fillRect(jx, topY - 2, 4, jaggedY - topY + cutDepth);
      }

      gfx.fillStyle(0x6a4a30, 0.5);
      for (let rb = 0; rb < 4; rb++) {
        const rx = rng.between(cutStart, cutEnd);
        const rh = rng.between(8, 20);
        gfx.fillRect(rx, topY - rh, 2, rh + 6);
      }
    }

    if (b.damageType === "side_collapse") {
      const collapseW = b.width * rng.realInRange(0.2, 0.35);
      if (b.damageSide === "left") {
        for (let jx = b.x; jx < b.x + collapseW; jx += 4) {
          const t = (jx - b.x) / collapseW;
          const jaggedTop = topY + t * b.height * 0.5 + rng.between(-6, 6);
          gfx.fillStyle(0x0f0d0c, 1);
          gfx.fillRect(jx, topY, 4, jaggedTop - topY);

          if (rng.frac() > 0.6) {
            gfx.fillStyle(0x6a4a30, 0.5);
            gfx.fillRect(jx + 1, jaggedTop - rng.between(4, 12), 2, rng.between(6, 16));
          }
        }
      } else {
        const startX = b.x + b.width - collapseW;
        for (let jx = startX; jx < b.x + b.width; jx += 4) {
          const t = (jx - startX) / collapseW;
          const jaggedTop = topY + t * b.height * 0.5 + rng.between(-6, 6);
          gfx.fillStyle(0x0f0d0c, 1);
          gfx.fillRect(jx, topY, 4, jaggedTop - topY);
        }
      }
    }

    if (b.damageType === "gutted") {
      const interiorColor = 0x151210;
      const wallThick = Math.max(4, Math.floor(b.width * 0.1));
      gfx.fillStyle(interiorColor, 0.8);
      gfx.fillRect(b.x + wallThick, topY + 4, b.width - wallThick * 2, (baseY - topY) * 0.6);

      gfx.fillStyle(0x6a4a30, 0.4);
      for (let beam = 0; beam < 3; beam++) {
        const bx = b.x + wallThick + rng.between(4, b.width - wallThick * 2 - 4);
        gfx.fillRect(bx, topY, 2, baseY - topY);
      }

      for (let f = 0; f < b.floors; f++) {
        const fy = topY + f * floorH + floorH;
        if (rng.frac() > 0.4) {
          const floorW = (b.width - wallThick * 2) * rng.realInRange(0.3, 0.85);
          const fx = rng.frac() > 0.5 ? b.x + wallThick : b.x + b.width - wallThick - floorW;
          gfx.fillStyle(detailColor, 0.5);
          gfx.fillRect(fx, fy, floorW, 3);
        }
      }
    }

    if (b.roofType === "antenna" && b.damageType !== "top_blown") {
      const ax = b.x + Math.floor(b.width * 0.5);
      const ah = rng.between(12, 28);
      gfx.fillStyle(detailColor, 0.7);
      gfx.fillRect(ax, topY - ah, 2, ah);
      gfx.fillRect(ax - 5, topY - ah, 12, 2);
      if (rng.frac() > 0.4) {
        gfx.fillRect(ax - 3, topY - ah + 5, 8, 2);
      }
    } else if (b.roofType === "watertower" && b.damageType !== "top_blown") {
      const twX = b.x + Math.floor(b.width * rng.realInRange(0.3, 0.55));
      const twW = rng.between(10, 16);
      const twH = rng.between(10, 16);
      const legH = rng.between(5, 10);
      gfx.fillStyle(detailColor, 0.6);
      gfx.fillRect(twX, topY - legH - twH, twW, twH);
      gfx.fillRect(twX + 2, topY - legH, 2, legH);
      gfx.fillRect(twX + twW - 4, topY - legH, 2, legH);
      gfx.fillRect(twX, topY - legH - twH - 2, twW, 2);
    } else if (b.roofType === "peaked" && b.damageType !== "top_blown") {
      const peakH = rng.between(8, 16);
      gfx.fillStyle(bodyColor, 1);
      for (let py = 0; py < peakH; py += 2) {
        const t = py / peakH;
        const rowW = b.width * (1 - t);
        gfx.fillRect(b.x + (b.width - rowW) / 2, topY - py, rowW, 2);
      }
    } else if (b.roofType === "spire" && b.damageType !== "top_blown") {
      const spH = rng.between(18, 35);
      gfx.fillStyle(detailColor, 0.7);
      for (let sy = 0; sy < spH; sy += 2) {
        const t = sy / spH;
        const sw = Math.max(2, Math.floor(10 * (1 - t)));
        gfx.fillRect(b.x + Math.floor(b.width / 2) - Math.floor(sw / 2), topY - sy, sw, 2);
      }
    }
  }
}

function drawMidBuildingFires(gfx: Phaser.GameObjects.Graphics, buildings: BuildingDef[], baseY: number, seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  for (const b of buildings) {
    if (rng.frac() > 0.6) {
      const topY = baseY - b.height;
      const fx = b.x + rng.between(4, b.width - 10);
      const fy = topY + rng.between(10, Math.floor(b.height * 0.5));
      const fireW = rng.between(6, 14);
      const fireH = rng.between(8, 18);
      gfx.fillStyle(0xff6622, 0.5);
      gfx.fillRect(fx, fy - fireH, fireW, fireH);
      gfx.fillStyle(0xffaa33, 0.35);
      gfx.fillRect(fx + 2, fy - fireH + 2, fireW - 4, fireH - 4);
      gfx.fillStyle(0xff4400, 0.25);
      gfx.fillRect(fx - 2, fy - fireH - 4, fireW + 4, 6);
    }
  }
}

function drawNearUrbanDebris(gfx: Phaser.GameObjects.Graphics, width: number, seed: string) {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  const groundY = Math.floor(SCREEN_H * 0.78);

  gfx.fillStyle(0x2a2520, 0.9);
  gfx.fillRect(0, groundY, width, SCREEN_H - groundY);

  for (let x = 0; x < width; x += 4) {
    const crackChance = rng.frac();
    if (crackChance > 0.92) {
      gfx.fillStyle(0x151210, 0.6);
      const crackW = rng.between(1, 3);
      const crackH = rng.between(4, 12);
      gfx.fillRect(x, groundY + rng.between(0, 6), crackW, crackH);
    }
    if (rng.frac() > 0.95) {
      gfx.fillStyle(0x3a3530, 0.4);
      gfx.fillRect(x, groundY, rng.between(8, 24), 2);
    }
  }

  gfx.fillStyle(0x35302a, 0.7);
  for (let sx = 0; sx < width; sx += rng.between(60, 150)) {
    const curbW = rng.between(30, 80);
    gfx.fillRect(sx, groundY - 3, curbW, 4);
    gfx.fillStyle(0x3d3830, 0.5);
    gfx.fillRect(sx, groundY - 4, curbW, 1);
    gfx.fillStyle(0x35302a, 0.7);
  }

  const concreteCount = rng.between(15, 25);
  for (let i = 0; i < concreteCount; i++) {
    const cx = rng.between(0, width);
    const cy = groundY - rng.between(2, 20);
    const cw = rng.between(10, 40);
    const ch = rng.between(6, 16);
    const angle = rng.realInRange(-0.3, 0.3);
    const color = rng.pick([0x4a4540, 0x555048, 0x3a3530, 0x605a52]);
    gfx.fillStyle(color, 0.8);
    gfx.fillRect(cx, cy, cw, ch);
    gfx.fillStyle(0x0a0a0a, 0.3);
    gfx.fillRect(cx, cy + ch - 2, cw, 2);

    if (rng.frac() > 0.5) {
      gfx.fillStyle(0x6a4a30, 0.5);
      const rebarLen = rng.between(6, 18);
      if (angle > 0) {
        gfx.fillRect(cx + cw, cy + Math.floor(ch / 2), rebarLen, 2);
      } else {
        gfx.fillRect(cx - rebarLen, cy + Math.floor(ch / 2), rebarLen, 2);
      }
    }
  }

  const vehicleCount = rng.between(4, 8);
  for (let i = 0; i < vehicleCount; i++) {
    const vx = rng.between(20, width - 60);
    const vy = groundY - rng.between(2, 8);
    const vw = rng.between(28, 48);
    const vh = rng.between(12, 18);
    const crushed = rng.frac() > 0.4;
    const vColor = rng.pick([0x3a3535, 0x453d38, 0x2e2828, 0x4a4240]);

    gfx.fillStyle(vColor, 0.8);
    if (crushed) {
      gfx.fillRect(vx, vy - vh * 0.5, vw, vh * 0.5);
      gfx.fillStyle(0x222020, 0.6);
      gfx.fillRect(vx + 3, vy - vh * 0.5 + 2, Math.floor(vw * 0.3), vh * 0.3);
      gfx.fillRect(vx + vw - Math.floor(vw * 0.3) - 3, vy - vh * 0.5 + 2, Math.floor(vw * 0.3), vh * 0.3);
    } else {
      gfx.fillRect(vx, vy - vh, vw, vh);
      const cabW = Math.floor(vw * 0.4);
      const cabH = Math.floor(vh * 0.5);
      gfx.fillRect(vx + Math.floor(vw * 0.2), vy - vh - cabH, cabW, cabH);
      gfx.fillStyle(0x1a1818, 0.7);
      gfx.fillRect(vx + Math.floor(vw * 0.22), vy - vh - cabH + 2, cabW - 4, cabH - 3);
    }

    gfx.fillStyle(0x1a1818, 0.8);
    const wheelR = 3;
    gfx.fillRect(vx + 4, vy - wheelR * 2, wheelR * 2, wheelR * 2);
    gfx.fillRect(vx + vw - 8 - wheelR, vy - wheelR * 2, wheelR * 2, wheelR * 2);
  }

  const lampCount = rng.between(5, 10);
  for (let i = 0; i < lampCount; i++) {
    const lx = rng.between(10, width - 10);
    const ly = groundY;
    const lampH = rng.between(30, 50);
    const tilted = rng.frac() > 0.4;
    const tiltAngle = tilted ? rng.realInRange(-0.25, 0.25) : 0;
    const fallen = rng.frac() > 0.7;

    gfx.fillStyle(0x555048, 0.7);

    if (fallen) {
      const fallDir = rng.frac() > 0.5 ? 1 : -1;
      gfx.fillRect(lx, ly - 4, lampH * fallDir, 3);
      gfx.fillRect(lx + lampH * fallDir - 8 * fallDir, ly - 8, 8, 4);
    } else {
      for (let py = 0; py < lampH; py += 2) {
        const px = lx + Math.floor(py * tiltAngle);
        gfx.fillRect(px, ly - py, 3, 2);
      }
      const topX = lx + Math.floor(lampH * tiltAngle);
      const topYY = ly - lampH;
      gfx.fillRect(topX - 4, topYY, 12, 3);
      gfx.fillStyle(rng.frac() > 0.8 ? 0x665533 : 0x444038, 0.5);
      gfx.fillRect(topX - 2, topYY + 3, 8, 4);
    }
  }

  const pileCount = rng.between(12, 20);
  for (let i = 0; i < pileCount; i++) {
    const cx = rng.between(0, width);
    const pBaseY = groundY - rng.between(0, 4);
    const pileW = rng.between(16, 50);
    const pileH = rng.between(8, 24);
    const color = rng.pick([0x3a3530, 0x4a4540, 0x2e2a25, 0x55504a]);

    for (let py = 0; py < pileH; py += 4) {
      const t = py / pileH;
      const rowW = pileW * (1 - t * 0.7);
      gfx.fillStyle(color, 0.8);
      gfx.fillRect(cx - rowW / 2, pBaseY - py, rowW, 4);
    }

    for (let c = 0; c < 4; c++) {
      const chunkX = cx + rng.between(Math.floor(-pileW / 2), Math.floor(pileW / 2));
      const chunkY = pBaseY - rng.between(0, pileH);
      const chunkS = rng.between(3, 7);
      gfx.fillStyle(rng.pick([0x555050, 0x605a55, 0x4a4540]), 0.7);
      gfx.fillRect(chunkX, chunkY, chunkS, chunkS);
    }
  }

  for (let i = 0; i < 10; i++) {
    const rx = rng.between(0, width);
    const ry = groundY - rng.between(0, 8);
    const rh = rng.between(10, 30);
    gfx.fillStyle(0x6a4a30, 0.5);
    gfx.fillRect(rx, ry - rh, 2, rh);
    if (rng.frac() > 0.5) {
      gfx.fillRect(rx - 5, ry - rh, 12, 2);
    }
  }
}

export function createWarZoneBackground(scene: Phaser.Scene): WarZoneBackgroundState {
  const skyGfx = scene.add.graphics().setScrollFactor(0).setDepth(-10);
  drawSmokySky(skyGfx);

  const farWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.15) + 100;
  const farBaseY = Math.floor(SCREEN_H * 0.5);
  const farBuildings = generateCityBuildings(farWidth, "farcity2", farBaseY, 60, 200, 10);
  const farGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawFarSkyline(farGfx, farWidth, farBuildings, farBaseY, 0x1a1818, "farskydet2");
  farGfx.fillStyle(0x1a1818, 1);
  farGfx.fillRect(0, farBaseY, farWidth, SCREEN_H - farBaseY);
  drawMidBuildingFires(farGfx, farBuildings, farBaseY, "farfires2");
  farGfx.generateTexture("war_far_city", farWidth, SCREEN_H);
  farGfx.destroy();
  const farCityImg = scene.add.image(0, 0, "war_far_city")
    .setOrigin(0, 0)
    .setScrollFactor(0.15, 0)
    .setDepth(-9);

  const midWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.3) + 100;
  const midBaseY = Math.floor(SCREEN_H * 0.55);
  const midBuildings = generateCityBuildings(midWidth, "midcity2", midBaseY, 50, 160, 14);
  const midGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawMidBuildings(midGfx, midWidth, midBuildings, midBaseY, 0x252020, 0x3a3530, 0x1a1818, "middet2");
  midGfx.fillStyle(0x252020, 1);
  midGfx.fillRect(0, midBaseY, midWidth, SCREEN_H - midBaseY);
  drawMidBuildingFires(midGfx, midBuildings, midBaseY, "midfires2");
  midGfx.generateTexture("war_mid_buildings", midWidth, SCREEN_H);
  midGfx.destroy();
  const midBuildingsImg = scene.add.image(0, 0, "war_mid_buildings")
    .setOrigin(0, 0)
    .setScrollFactor(0.3, 0)
    .setDepth(-8);

  const nearWidth = SCREEN_W + Math.ceil(LEVEL_WIDTH * TILE * 0.5) + 100;
  const nearGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  drawNearUrbanDebris(nearGfx, nearWidth, "neaurban2");
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
