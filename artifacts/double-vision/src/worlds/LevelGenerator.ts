import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT, CHECKPOINT_COUNT, type WorldConfig } from "./WorldConfig";

export interface LevelTile {
  x: number;
  y: number;
  type: "ground" | "platform" | "kill" | "spike" | "movement" | "checkpoint" | "cave" | "secret";
  width?: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateLevel(worldIndex: number, seed?: number): LevelTile[] {
  const tiles: LevelTile[] = [];
  const baseSeed = seed ?? Math.floor(Math.random() * 2147483646) + 1;
  const rand = seededRandom(baseSeed);
  const checkpointSpacing = Math.floor(LEVEL_WIDTH / (CHECKPOINT_COUNT + 1));

  const groundLevel = LEVEL_HEIGHT - 2;

  const hazardOccupied = new Set<number>();
  const noGroundColumns = new Set<number>();
  const quicksandColumns = new Set<number>();
  const gapRanges: { start: number; width: number }[] = [];
  const isLavaWorld = worldIndex === 0;
  const isBeachWorld = worldIndex === 1;
  const isJungleWorld = worldIndex === 2;

  for (let x = 0; x < LEVEL_WIDTH; x++) {
    const sectionIndex = Math.floor(x / checkpointSpacing);
    const difficulty = Math.min(sectionIndex / CHECKPOINT_COUNT, 1.0);

    const isCheckpoint = x > 0 && x % checkpointSpacing === 0 && sectionIndex <= CHECKPOINT_COUNT;

    if (isCheckpoint) {
      for (let y = 0; y <= groundLevel; y++) {
        tiles.push({ x, y: groundLevel, type: "ground" });
      }
      tiles.push({ x, y: groundLevel - 3, type: "checkpoint" });
      tiles.push({ x: x + 1, y: groundLevel, type: "ground" });
      noGroundColumns.add(x);
      noGroundColumns.add(x + 1);
      continue;
    }

    if (x < 5 || x > LEVEL_WIDTH - 5) {
      tiles.push({ x, y: groundLevel, type: "ground" });
      tiles.push({ x, y: groundLevel + 1, type: "ground" });
      continue;
    }

    const gapChance = 0.08 + difficulty * 0.12;
    const gapRoll = rand();
    const isGap = !isBeachWorld && gapRoll < gapChance && x % 3 === 0;

    if (isGap) {
      const gapWidth = rand() < 0.5 ? 2 : 3;
      let canPlaceGap = true;
      for (let g = 0; g < gapWidth; g++) {
        const col = x + g;
        if (col >= LEVEL_WIDTH - 5 || noGroundColumns.has(col)) {
          canPlaceGap = false;
          break;
        }
        const colSection = Math.floor(col / checkpointSpacing);
        const isNearCheckpoint = col > 0 && Math.abs(col - colSection * checkpointSpacing) <= 2;
        const isNextCheckpoint = colSection < CHECKPOINT_COUNT && Math.abs(col - (colSection + 1) * checkpointSpacing) <= 2;
        if (isNearCheckpoint || isNextCheckpoint) {
          canPlaceGap = false;
          break;
        }
      }
      if (canPlaceGap) {
        for (let g = 0; g < gapWidth; g++) {
          noGroundColumns.add(x + g);
        }
        for (let g = 1; g < gapWidth; g++) {
          hazardOccupied.add(x + g);
        }
        gapRanges.push({ start: x, width: gapWidth });
      }
    }

    if (!noGroundColumns.has(x)) {
      tiles.push({ x, y: groundLevel, type: "ground" });
      tiles.push({ x, y: groundLevel + 1, type: "ground" });

      if (rand() < 0.06 + difficulty * 0.08) {
        if (!hazardOccupied.has(x)) {
          if (isJungleWorld) {
            const patchWidth = 2 + Math.floor(rand() * 2);
            let canPlace = true;
            for (let p = 0; p < patchWidth; p++) {
              const col = x + p;
              if (col >= LEVEL_WIDTH - 5 || hazardOccupied.has(col) || noGroundColumns.has(col)) {
                canPlace = false;
                break;
              }
            }
            if (canPlace) {
              for (let p = 0; p < patchWidth; p++) {
                tiles.push({ x: x + p, y: groundLevel, type: "kill" });
                hazardOccupied.add(x + p);
                quicksandColumns.add(x + p);
              }
              if (x - 1 >= 0) hazardOccupied.add(x - 1);
              if (x + patchWidth < LEVEL_WIDTH) hazardOccupied.add(x + patchWidth);
            }
          } else {
            tiles.push({ x, y: groundLevel, type: "kill" });
            hazardOccupied.add(x);
          }
        }
      }

      if (rand() < 0.04 + difficulty * 0.06) {
        if (!hazardOccupied.has(x)) {
          tiles.push({ x, y: groundLevel - 1, type: "spike" });
          hazardOccupied.add(x);
        }
      }

      if (!isLavaWorld && worldIndex !== 3) {
        if (rand() < 0.05 + difficulty * 0.05) {
          if (!hazardOccupied.has(x)) {
            tiles.push({ x, y: groundLevel, type: "movement" });
            hazardOccupied.add(x);
          }
        }
      } else if (!isLavaWorld) {
        rand();
      } else {
        rand();
      }
    }

    if (rand() < 0.12 + difficulty * 0.08) {
      let platY = groundLevel - 3 - Math.floor(rand() * 3);
      const platLen = 2 + Math.floor(rand() * 3);

      const GAP_CLEARANCE = 2;
      let nearGap = false;
      for (const gap of gapRanges) {
        if (gap.width < 2) continue;
        const gapEnd = gap.start + gap.width - 1;
        for (let px = 0; px < platLen; px++) {
          const col = x + px;
          if (col >= gap.start - GAP_CLEARANCE && col <= gapEnd + GAP_CLEARANCE) {
            nearGap = true;
            break;
          }
        }
        if (nearGap) break;
      }

      if (nearGap) {
        const minY = groundLevel - 6;
        if (platY > minY) {
          platY = minY;
        }
      }

      for (let px = 0; px < platLen && x + px < LEVEL_WIDTH; px++) {
        tiles.push({ x: x + px, y: platY, type: "platform" });
      }
    }
  }

  if (worldIndex === 3) {
    const tankRand = seededRandom(baseSeed + 8888);
    let tx = 8;
    while (tx < LEVEL_WIDTH - 8) {
      const sectionIndex = Math.floor(tx / checkpointSpacing);
      const difficulty = Math.min(sectionIndex / CHECKPOINT_COUNT, 1.0);
      const chance = 0.06 + difficulty * 0.06;
      if (tankRand() < chance) {
        const tankLen = 2 + Math.floor(tankRand() * 5);
        let canPlace = true;
        for (let i = 0; i < tankLen; i++) {
          const col = tx + i;
          if (col >= LEVEL_WIDTH - 5 || hazardOccupied.has(col) || noGroundColumns.has(col)) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          tiles.push({ x: tx, y: groundLevel, type: "movement", width: tankLen });
          for (let i = 0; i < tankLen; i++) {
            hazardOccupied.add(tx + i);
          }
          tx += tankLen + 3;
          continue;
        }
      }
      tx++;
    }
  }

  if (isLavaWorld) {
    const conveyorRand = seededRandom(baseSeed + 9999);
    let cx = 8;
    while (cx < LEVEL_WIDTH - 8) {
      const sectionIndex = Math.floor(cx / checkpointSpacing);
      const difficulty = Math.min(sectionIndex / CHECKPOINT_COUNT, 1.0);
      const chance = 0.05 + difficulty * 0.05;
      if (conveyorRand() < chance) {
        const stripLen = 3 + Math.floor(conveyorRand() * 3);
        let canPlace = true;
        for (let i = 0; i < stripLen; i++) {
          const col = cx + i;
          if (col >= LEVEL_WIDTH - 5 || hazardOccupied.has(col) || noGroundColumns.has(col)) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          tiles.push({ x: cx, y: groundLevel, type: "movement", width: stripLen });
          for (let i = 0; i < stripLen; i++) {
            hazardOccupied.add(cx + i);
          }
          cx += stripLen + 2;
          continue;
        }
      }
      cx++;
    }

    const caveRand = seededRandom(baseSeed + 7777);
    let caveX = 15;
    while (caveX < LEVEL_WIDTH - 10) {
      const sectionIndex = Math.floor(caveX / checkpointSpacing);
      const difficulty = Math.min(sectionIndex / CHECKPOINT_COUNT, 1.0);
      const chance = 0.06 + difficulty * 0.06;
      if (caveRand() < chance) {
        let canPlace = true;
        for (let dx = -2; dx <= 2; dx++) {
          const col = caveX + dx;
          if (col < 5 || col >= LEVEL_WIDTH - 5 || noGroundColumns.has(col)) {
            canPlace = false;
            break;
          }
        }
        const isNearCheckpoint = tiles.some(t =>
          t.type === "checkpoint" && Math.abs(t.x - caveX) <= 4
        );
        if (canPlace && !isNearCheckpoint) {
          const caveLen = caveRand() < 0.5 ? 2 : 3;
          let canFitLen = true;
          for (let dx = 0; dx < caveLen; dx++) {
            const col = caveX + dx;
            if (col >= LEVEL_WIDTH - 5 || noGroundColumns.has(col)) {
              canFitLen = false;
              break;
            }
          }
          if (canFitLen) {
            tiles.push({ x: caveX, y: groundLevel - 1, type: "cave", width: caveLen });
            for (let dx = 0; dx < caveLen; dx++) {
              hazardOccupied.add(caveX + dx);
            }
            caveX += caveLen + 8;
            continue;
          }
        }
      }
      caveX++;
    }

    const caveClearRadius = 2;
    const caveTiles = tiles.filter(t => t.type === "cave");
    const hazardTypesForCaveClear = new Set(["kill", "spike", "movement"]);
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      if (!hazardTypesForCaveClear.has(t.type)) continue;
      for (const cave of caveTiles) {
        const caveEndX = cave.x + (cave.width ?? 1) - 1;
        const tileEndX = t.width ? t.x + t.width - 1 : t.x;
        if (t.x <= caveEndX + caveClearRadius && tileEndX >= cave.x - caveClearRadius) {
          tiles.splice(i, 1);
          break;
        }
      }
    }

    const holeClearRadius = 4;
    const checkpointColumns = new Set<number>();
    for (const t of tiles) {
      if (t.type === "checkpoint") {
        checkpointColumns.add(t.x);
        checkpointColumns.add(t.x + 1);
      }
    }
    for (const cave of caveTiles) {
      const caveStart = cave.x;
      const caveEnd = cave.x + (cave.width ?? 1) - 1;
      for (let col = caveStart - holeClearRadius; col <= caveEnd + holeClearRadius; col++) {
        if (col < 0 || col >= LEVEL_WIDTH) continue;
        if (checkpointColumns.has(col)) continue;
        if (noGroundColumns.has(col)) {
          noGroundColumns.delete(col);
          const hasGround = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === col);
          if (!hasGround) {
            tiles.push({ x: col, y: groundLevel, type: "ground" });
            tiles.push({ x: col, y: groundLevel + 1, type: "ground" });
          }
          if (isLavaWorld) {
            const hasKill = tiles.some(t => t.type === "kill" && t.y === groundLevel && t.x === col);
            if (!hasKill) {
              tiles.push({ x: col, y: groundLevel, type: "kill" });
            }
          }
        }
      }
    }

    for (let i = gapRanges.length - 1; i >= 0; i--) {
      const gap = gapRanges[i];
      const gapEnd = gap.start + gap.width - 1;
      for (const cave of caveTiles) {
        const caveStart = cave.x;
        const caveEndX = cave.x + (cave.width ?? 1) - 1;
        if (gap.start <= caveEndX + holeClearRadius && gapEnd >= caveStart - holeClearRadius) {
          gapRanges.splice(i, 1);
          break;
        }
      }
    }
  }

  const secretRand = seededRandom(baseSeed + 5555);
  const targetSecrets = 1 + Math.floor(secretRand() * 2);
  const secretSpacing = Math.floor((LEVEL_WIDTH - 20) / (targetSecrets + 1));
  let secretsPlaced = 0;

  const isNearOther = (col: number) => {
    return tiles.some(t => t.type === "checkpoint" && Math.abs(t.x - col) <= 5) ||
           tiles.some(t => t.type === "cave" && Math.abs(t.x - col) <= 6) ||
           tiles.some(t => t.type === "secret" && Math.abs(t.x - col) <= 12);
  };

  for (let si = 0; si < targetSecrets && secretsPlaced < 2; si++) {
    const baseCol = 10 + (si + 1) * secretSpacing + Math.floor((secretRand() - 0.5) * 8);
    const secretWidth = 2;

    let bestCol = -1;
    for (let offset = 0; offset < 40; offset++) {
      const tryCol = baseCol + (offset % 2 === 0 ? offset / 2 : -Math.ceil(offset / 2));
      if (tryCol < 8 || tryCol + secretWidth >= LEVEL_WIDTH - 5) continue;
      if (isNearOther(tryCol)) continue;
      let canPlace = true;
      for (let dx = 0; dx < secretWidth; dx++) {
        const col = tryCol + dx;
        if (hazardOccupied.has(col) || noGroundColumns.has(col)) {
          canPlace = false;
          break;
        }
      }
      if (canPlace) {
        bestCol = tryCol;
        break;
      }
    }
    if (bestCol >= 0) {
      tiles.push({ x: bestCol, y: groundLevel, type: "secret", width: secretWidth });
      for (let dx = 0; dx < secretWidth; dx++) {
        hazardOccupied.add(bestCol + dx);
        for (let i = tiles.length - 1; i >= 0; i--) {
          const t = tiles[i];
          if (t.x === bestCol + dx && t.y === groundLevel && t.type === "ground") {
            tiles.splice(i, 1);
          }
        }
      }
      for (const wallCol of [bestCol - 1, bestCol + secretWidth]) {
        if (wallCol >= 0 && wallCol < LEVEL_WIDTH) {
          const hasGround = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === wallCol);
          if (!hasGround && !noGroundColumns.has(wallCol)) {
            tiles.push({ x: wallCol, y: groundLevel, type: "ground" });
          }
        }
      }
      secretsPlaced++;
    }
  }

  while (secretsPlaced < 1) {
    const fallbackCol = 12 + Math.floor(secretRand() * (LEVEL_WIDTH - 24));
    const secretWidth = 2;
    if (isNearOther(fallbackCol)) { secretRand(); continue; }
    let canPlace = true;
    for (let dx = 0; dx < secretWidth; dx++) {
      if (noGroundColumns.has(fallbackCol + dx)) { canPlace = false; break; }
    }
    if (!canPlace) continue;
    tiles.push({ x: fallbackCol, y: groundLevel, type: "secret", width: secretWidth });
    for (let dx = 0; dx < secretWidth; dx++) {
      hazardOccupied.add(fallbackCol + dx);
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i];
        if (t.x === fallbackCol + dx && t.y === groundLevel && t.type === "ground") {
          tiles.splice(i, 1);
        }
      }
    }
    for (const wallCol of [fallbackCol - 1, fallbackCol + secretWidth]) {
      if (wallCol >= 0 && wallCol < LEVEL_WIDTH) {
        const hasGround = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === wallCol);
        if (!hasGround && !noGroundColumns.has(wallCol)) {
          tiles.push({ x: wallCol, y: groundLevel, type: "ground" });
        }
      }
    }
    secretsPlaced++;
  }

  const secretClearRadius = 2;
  const secretTiles = tiles.filter(t => t.type === "secret");
  const hazardTypesForSecretClear = new Set(["kill", "spike", "movement"]);
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i];
    if (!hazardTypesForSecretClear.has(t.type)) continue;
    for (const secret of secretTiles) {
      const secretEndX = secret.x + (secret.width ?? 1) - 1;
      const tileEndX = t.width ? t.x + t.width - 1 : t.x;
      if (t.x <= secretEndX + secretClearRadius && tileEndX >= secret.x - secretClearRadius) {
        tiles.splice(i, 1);
        break;
      }
    }
  }

  for (const secret of secretTiles) {
    const sStart = secret.x;
    const sEnd = secret.x + (secret.width ?? 1) - 1;
    for (let col = sStart - secretClearRadius; col <= sEnd + secretClearRadius; col++) {
      if (col < 0 || col >= LEVEL_WIDTH) continue;
      if (col >= sStart && col <= sEnd) continue;
      if (noGroundColumns.has(col)) {
        noGroundColumns.delete(col);
        const hasGround = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === col);
        if (!hasGround) {
          tiles.push({ x: col, y: groundLevel, type: "ground" });
          tiles.push({ x: col, y: groundLevel + 1, type: "ground" });
        }
      }
    }
  }

  const WINDOW_SIZE = 6;
  const MAX_OBSTACLES_PER_WINDOW = 3;
  const obstacleTypes = new Set(["kill", "spike"]);

  const isObstacleColumn = (col: number): boolean => {
    const hasGround = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === col);
    if (!hasGround) return true;
    return tiles.some(t => {
      if (!obstacleTypes.has(t.type)) return false;
      const tStart = t.x;
      const tEnd = t.x + (t.width ?? 1) - 1;
      return col >= tStart && col <= tEnd;
    });
  };

  const removeObstacleAt = (col: number): void => {
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      if (!obstacleTypes.has(t.type)) continue;
      const tStart = t.x;
      const tEnd = t.x + (t.width ?? 1) - 1;
      if (col < tStart || col > tEnd) continue;
      if (t.width && t.width > 1) {
        const origX = t.x;
        const origWidth = t.width;
        tiles.splice(i, 1);
        if (col > origX) {
          tiles.push({ ...t, x: origX, width: col - origX });
        }
        if (origX + origWidth > col + 1) {
          tiles.push({ ...t, x: col + 1, width: origX + origWidth - col - 1 });
        }
      } else {
        tiles.splice(i, 1);
      }
    }
    hazardOccupied.delete(col);
    quicksandColumns.delete(col);
    if (noGroundColumns.has(col)) {
      noGroundColumns.delete(col);
      const hasGroundNow = tiles.some(t => t.type === "ground" && t.y === groundLevel && t.x === col);
      if (!hasGroundNow) {
        tiles.push({ x: col, y: groundLevel, type: "ground" });
        tiles.push({ x: col, y: groundLevel + 1, type: "ground" });
      }
    }
  };

  for (let winStart = 0; winStart <= LEVEL_WIDTH - WINDOW_SIZE; winStart++) {
    const obstacleCols: number[] = [];
    for (let c = winStart; c < winStart + WINDOW_SIZE; c++) {
      if (isObstacleColumn(c)) {
        obstacleCols.push(c);
      }
    }
    while (obstacleCols.length > MAX_OBSTACLES_PER_WINDOW) {
      const col = obstacleCols.pop()!;
      removeObstacleAt(col);
    }
  }

  const LOW_PLATFORM_THRESHOLD = 4;
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i];
    if (t.type !== "platform") continue;
    const heightAboveGround = groundLevel - t.y;
    if (heightAboveGround >= LOW_PLATFORM_THRESHOLD) continue;
    const platStart = t.x;
    const platEnd = t.x + (t.width ?? 1) - 1;
    let overlapsObstacle = false;
    for (const obs of tiles) {
      if (obs.type !== "kill" && obs.type !== "spike") continue;
      const obsStart = obs.x - 1;
      const obsEnd = obs.x + (obs.width ?? 1);
      if (platEnd < obsStart || platStart > obsEnd) continue;
      if (obs.y > t.y) {
        overlapsObstacle = true;
        break;
      }
    }
    if (overlapsObstacle) {
      tiles.splice(i, 1);
    }
  }

  const MIN_PLATFORM_CLEARANCE = 3;
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i];
    if (t.type !== "platform") continue;
    const platStart = t.x;
    const platEnd = t.x + (t.width ?? 1) - 1;
    let highestObstacleY: number | null = null;
    for (const obs of tiles) {
      if (obs.type !== "kill" && obs.type !== "spike") continue;
      const obsStart = obs.x - 1;
      const obsEnd = obs.x + (obs.width ?? 1);
      if (platEnd < obsStart || platStart > obsEnd) continue;
      if (obs.y > t.y) {
        if (highestObstacleY === null || obs.y < highestObstacleY) {
          highestObstacleY = obs.y;
        }
      }
    }
    if (highestObstacleY !== null) {
      const clearance = highestObstacleY - t.y;
      if (clearance < MIN_PLATFORM_CLEARANCE) {
        const newY = highestObstacleY - MIN_PLATFORM_CLEARANCE;
        if (newY >= 1) {
          tiles[i] = { ...t, y: newY };
        } else {
          tiles.splice(i, 1);
        }
      }
    }
  }

  const GAP_CLEARANCE_POST = 2;
  const MIN_PLATFORM_Y_NEAR_GAP = groundLevel - 6;
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i];
    if (t.type !== "platform") continue;
    for (const gap of gapRanges) {
      if (gap.width < 2) continue;
      const gapEnd = gap.start + gap.width - 1;
      if (t.x >= gap.start - GAP_CLEARANCE_POST && t.x <= gapEnd + GAP_CLEARANCE_POST) {
        if (t.y > MIN_PLATFORM_Y_NEAR_GAP) {
          tiles.splice(i, 1);
          break;
        }
      }
    }
  }

  const clearRadius = 2;
  const checkpointXs = tiles.filter(t => t.type === "checkpoint").map(t => t.x);
  const hazardTypes = new Set(["kill", "spike", "movement"]);
  const filtered = tiles.filter(t => {
    if (!hazardTypes.has(t.type)) return true;
    for (const cpx of checkpointXs) {
      const tileEndX = t.width ? t.x + t.width - 1 : t.x;
      if (t.x <= cpx + clearRadius && tileEndX >= cpx - clearRadius) {
        if (t.type === "kill" && quicksandColumns.has(t.x)) {
          quicksandColumns.delete(t.x);
        }
        return false;
      }
    }
    return true;
  });
  const finalTiles = filtered.filter(t => {
    if (t.type === "ground" && t.y === groundLevel && quicksandColumns.has(t.x)) {
      return false;
    }
    if (t.type === "platform" && quicksandColumns.has(t.x) && t.y > groundLevel - 3) {
      return false;
    }
    return true;
  });

  return finalTiles;
}
