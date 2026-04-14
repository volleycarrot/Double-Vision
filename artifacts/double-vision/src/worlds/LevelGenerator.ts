import { TILE, LEVEL_WIDTH, LEVEL_HEIGHT, CHECKPOINT_COUNT, type WorldConfig } from "./WorldConfig";

export interface LevelTile {
  x: number;
  y: number;
  type: "ground" | "platform" | "kill" | "spike" | "movement" | "checkpoint";
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
      continue;
    }

    if (x < 5 || x > LEVEL_WIDTH - 5) {
      tiles.push({ x, y: groundLevel, type: "ground" });
      tiles.push({ x, y: groundLevel + 1, type: "ground" });
      continue;
    }

    const gapChance = 0.08 + difficulty * 0.12;
    const isGap = rand() < gapChance && x % 3 === 0;

    if (!isGap) {
      tiles.push({ x, y: groundLevel, type: "ground" });
      tiles.push({ x, y: groundLevel + 1, type: "ground" });

      if (rand() < 0.06 + difficulty * 0.08) {
        tiles.push({ x, y: groundLevel, type: "kill" });
      }

      if (rand() < 0.04 + difficulty * 0.06) {
        tiles.push({ x, y: groundLevel - 1, type: "spike" });
      }

      if (rand() < 0.05 + difficulty * 0.05) {
        tiles.push({ x, y: groundLevel, type: "movement" });
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

  return tiles;
}
