import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT, CHECKPOINT_COUNT, type WorldConfig } from "./WorldConfig";

export interface LevelTile {
  x: number;
  y: number;
  type: "ground" | "platform" | "kill" | "spike" | "movement" | "checkpoint";
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
  const rand = seededRandom(worldIndex * 1000 + 42);
  const checkpointSpacing = Math.floor(LEVEL_WIDTH / (CHECKPOINT_COUNT + 1));

  const groundLevel = LEVEL_HEIGHT - 2;

  const hazardOccupied = new Set<number>();
  const noGroundColumns = new Set<number>();
  const isLavaWorld = worldIndex === 0;

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
    const isGap = rand() < gapChance && x % 3 === 0;

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
          tiles.push({ x, y: groundLevel, type: "kill" });
          hazardOccupied.add(x);
        }
      }

      if (rand() < 0.04 + difficulty * 0.06) {
        if (!hazardOccupied.has(x)) {
          tiles.push({ x, y: groundLevel - 1, type: "spike" });
          hazardOccupied.add(x);
        }
      }

      if (!isLavaWorld) {
        if (rand() < 0.05 + difficulty * 0.05) {
          if (!hazardOccupied.has(x)) {
            tiles.push({ x, y: groundLevel, type: "movement" });
            hazardOccupied.add(x);
          }
        }
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

  if (isLavaWorld) {
    const conveyorRand = seededRandom(worldIndex * 1000 + 9999);
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
  }

  const clearRadius = 2;
  const checkpointXs = tiles.filter(t => t.type === "checkpoint").map(t => t.x);
  const hazardTypes = new Set(["kill", "spike", "movement"]);
  return tiles.filter(t => {
    if (!hazardTypes.has(t.type)) return true;
    for (const cpx of checkpointXs) {
      const tileEndX = t.width ? t.x + t.width - 1 : t.x;
      if (t.x <= cpx + clearRadius && tileEndX >= cpx - clearRadius) {
        return false;
      }
    }
    return true;
  });
}
