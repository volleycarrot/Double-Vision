export interface WorldConfig {
  name: string;
  bgColor: number;
  groundColor: number;
  platformColor: number;
  killBlockName: string;
  killBlockColor: number;
  spikeName: string;
  spikeColor: number;
  movementName: string;
  movementColor: number;
  checkpointColor: number;
}

export const WORLDS: WorldConfig[] = [
  {
    name: "Lava World",
    bgColor: 0x4a0000,
    groundColor: 0x3a1212,
    platformColor: 0x5a2020,
    killBlockName: "Lava Block",
    killBlockColor: 0xff8800,
    spikeName: "Lava Spray",
    spikeColor: 0xdd0000,
    movementName: "Landslide",
    movementColor: 0x6b4226,
    checkpointColor: 0xffbb33,
  },
  {
    name: "Beach World",
    bgColor: 0x87ceeb,
    groundColor: 0xd2b48c,
    platformColor: 0xc2a47c,
    killBlockName: "Water Block",
    killBlockColor: 0x0077be,
    spikeName: "Sea Urchin",
    spikeColor: 0x2d1b3d,
    movementName: "Wave",
    movementColor: 0x0099cc,
    checkpointColor: 0xffdd00,
  },
  {
    name: "Jungle World",
    bgColor: 0x0d2b0d,
    groundColor: 0x3b5e2b,
    platformColor: 0x5a3a1a,
    killBlockName: "Quicksand",
    killBlockColor: 0xc9a84c,
    spikeName: "Thorn Bush",
    spikeColor: 0x2d5a1e,
    movementName: "Vine Swing",
    movementColor: 0x228b22,
    checkpointColor: 0x00ff88,
  },
  {
    name: "War Zone",
    bgColor: 0x2a2a2a,
    groundColor: 0x4a4a4a,
    platformColor: 0x5a5a5a,
    killBlockName: "Mine",
    killBlockColor: 0x8b0000,
    spikeName: "Barbed Wire",
    spikeColor: 0x808080,
    movementName: "Tank Push",
    movementColor: 0x556b2f,
    checkpointColor: 0x00ff00,
  },
];

export const TILE = 32;
export const LEVEL_WIDTH = 200;
export const LEVEL_HEIGHT = 15;
export const CHECKPOINT_COUNT = 5;

export const PHYSICS = {
  GRAVITY_Y: 800,
  MOVE_SPEED: 200,
  JUMP_VELOCITY: -400,
  DUCK_HEIGHT: 16,
  NORMAL_HEIGHT: 32,
  LANDSLIDE_BOOST: 120,
  WAVE_SPEED: 350,
  QUICKSAND_SINK: 50,
  VINE_SWING_RANGE: 60,
  TANK_SPEED: 80,
  BULLET_SPEED: 300,
};
