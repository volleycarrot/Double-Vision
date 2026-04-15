import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT, CHECKPOINT_COUNT, type WorldConfig } from "./WorldConfig";

export interface LevelTile {
  x: number;
  y: number;
  type: "ground" | "platform" | "kill" | "spike" | "movement" | "checkpoint" | "cave";
  width?: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateLevel(worldIndex: number): LevelTile[] {
  const tiles: LevelTile[] = [];
  const baseSeed = Math.floor(Math.random() * 2147483646) + 1;
  const rand = seededRandom(baseSeed);
  const checkpointSpacing = Math.floor(LEVEL_WIDTH / (CHECKPOINT_COUNT + 1));

  const groundLevel = LEVEL_HEIGHT - 2;

  const hazardOccupied = new Set<number>();
  const noGroundColumns = new Set<number>();
  const quicksandColumns = new Set<number>();
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
      const platY = groundLevel - 3 - Math.floor(rand() * 3);
      const platLen = 2 + Math.floor(rand() * 3);
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
  return filtered.filter(t => {
    if (t.type === "ground" && t.y === groundLevel && quicksandColumns.has(t.x)) {
      return false;
    }
    if (t.type === "platform" && quicksandColumns.has(t.x) && t.y > groundLevel - 3) {
      return false;
    }
    return true;
  });
}
