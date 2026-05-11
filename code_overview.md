# Double Vision — Code Overview

This document explains how the Double Vision codebase is organized. It is written for people who are new to programming. No prior experience is assumed.

---

## What is this game?

Double Vision is a 2-player platformer game that runs in a web browser. Two players share the same keyboard: one controls left/right movement, the other controls jumping and ducking. The game has 4 worlds (Lava, Beach, Jungle, War Zone), each with its own look and hazards.

---

## The big picture: what is Phaser?

**Phaser** is a game library — a large collection of pre-written code that handles the hard parts of making a browser game:

- Drawing things on the screen (a canvas element)
- Physics: gravity, collisions, velocity
- Input: reading keyboard keys
- Scene management: switching between menu, gameplay, etc.
- A game loop: running your code ~60 times per second

Think of Phaser as the engine of a car. The engine makes the wheels turn, but you still have to decide where to drive.

**The custom code in this project** is everything on top of Phaser:

- The rules of the game (which tiles kill you, how checkpoints work)
- The level layouts (the procedural generator)
- The visual style of each world (colors, background art)
- The menus and win screen
- The save system

Roughly speaking: **Phaser = engine, our code = the game itself.**

---

## File structure

```
src/
├── main.ts                        # Entry point — starts the game
├── PlayerConfig.ts                # Player colors and eye rendering
├── ProgressManager.ts             # Saves/loads game progress
├── scenes/
│   ├── TitleScene.ts              # Main menu
│   ├── WarningScene.ts            # Pre-level hazard info screen
│   ├── GameScene.ts               # The actual gameplay
│   └── WinScene.ts                # Victory screen
└── worlds/
    ├── WorldConfig.ts             # Definitions for all 4 worlds
    ├── LevelGenerator.ts          # Builds a level from scratch
    ├── LavaBackground.ts          # Lava world background art
    ├── BeachBackground.ts         # Beach world background art
    ├── JungleBackground.ts        # Jungle world background art
    └── WarZoneBackground.ts       # War Zone background art
```

---

## File-by-file explanation

### `src/main.ts` — Starting point

This is the first file that runs when the game loads. Its only job is to create the Phaser game and tell it which scenes exist.

```typescript
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,          // Let Phaser pick WebGL or Canvas
    width: 800,
    height: 480,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 800 } }   // Everything falls down
    },
    scene: [TitleScene, WarningScene, GameScene, WinScene]
};

new Phaser.Game(config);
```

The scenes listed here form a sequence: the game always starts at `TitleScene`, then moves forward. Phaser handles the switching.

---

### `src/PlayerConfig.ts` — Player appearance

This file answers two questions: what color is the player's character, and where do their eyes go?

**Key parts:**

```typescript
export const COLOR_PRESETS = [
    { name: 'White',  fill: 0xffffff, stroke: 0x888888 },
    { name: 'Blue',   fill: 0x4488ff, stroke: 0x2244aa },
    // ... 5 more colors
];
```

Each preset is an object with a `fill` color (the main body) and a `stroke` color (the outline). The colors are written in hexadecimal format (e.g., `0x4488ff` is a shade of blue — same as `#4488ff` in CSS).

```typescript
export function drawEyes(gfx, centerX, centerY, bodyHeight) {
    // draws two small black rectangles to represent eyes
}
```

This function is called whenever the player character needs to be redrawn. It uses Phaser's `Graphics` object, which lets you draw shapes with code instead of using image files.

---

### `src/ProgressManager.ts` — Saving progress

This file handles remembering which worlds the player has completed, even after closing the browser.

It uses `localStorage`, which is a small database built into every browser that stores simple text values.

**Key parts:**

```typescript
interface WorldProgress {
    completed: boolean;
    deaths: number;
}
```

An **interface** in TypeScript is a description of what shape an object must have. Here, every world's progress is an object with a `completed` flag and a `deaths` count.

```typescript
export function saveProgress(progress: GameProgress) {
    localStorage.setItem('double-vision-progress', JSON.stringify(progress));
}

export function loadProgress(): GameProgress {
    const raw = localStorage.getItem('double-vision-progress');
    return raw ? JSON.parse(raw) : defaultProgress();
}
```

`JSON.stringify` converts a JavaScript object into plain text so it can be stored. `JSON.parse` converts it back.

---

### `src/worlds/WorldConfig.ts` — World definitions

This file is purely data — no logic, just constants. It defines the 4 worlds and the physics values used throughout the game.

```typescript
export const WORLDS: WorldConfig[] = [
    {
        name: 'Lava World',
        killColor:      0xff4400,   // color of lava blocks
        spikeColor:     0xff8800,   // color of lava spray
        movementColor:  0xcc2200,   // color of landslide tiles
        // ...
    },
    // Beach, Jungle, War Zone follow the same shape
];
```

```typescript
export const PHYSICS = {
    SPEED:      200,    // pixels per second sideways
    JUMP:      -400,    // pixels per second upward (negative = up)
    DUCK_HEIGHT: 16,    // player height when ducking (vs 32 normally)
};
```

Having all these values in one place makes it easy to tune the game — change a number here and it affects everything that uses it.

---

### `src/worlds/LevelGenerator.ts` — Building a level

This file generates a level from scratch using code, rather than hand-placing every tile. This is called **procedural generation**.

The key idea: given a world index (0–3), always produce the same level (so the game is fair and repeatable), but make it feel varied.

**How it works:**

1. A **seeded random number generator** is used. A seed is a starting number; the same seed always produces the same sequence of "random" numbers. The world index is the seed.

2. The level is divided into 5 sections (one per checkpoint). Each section is harder than the last.

3. Within each section, the generator places:
   - Ground tiles (you walk on these)
   - Gaps (you fall through these)
   - Platforms (floating tiles)
   - Hazard tiles (kill blocks, spikes, moving obstacles)

```typescript
export interface LevelTile {
    type: 'ground' | 'platform' | 'kill' | 'spike' | 'movement' | 'checkpoint';
    x: number;         // position in tile units (1 tile = 32 pixels)
    y: number;
    width: number;     // how many tiles wide
}
```

`GameScene` reads this array of tiles and turns each one into something visible and physical in the game world.

---

### `src/scenes/TitleScene.ts` — Main menu

This is the first thing the player sees. It shows the game title, a color picker, and 4 world buttons.

It is a Phaser **Scene** — a class that extends `Phaser.Scene` and has two key methods:

- `create()`: runs once when the scene starts, sets everything up
- `update()`: runs every frame (~60 times per second), handles ongoing logic

```typescript
export class TitleScene extends Phaser.Scene {
    create() {
        // Draw title text, color swatches, world buttons
    }
    // No update() needed here — the title screen is mostly static
}
```

When the player clicks a world button, the scene calls:
```typescript
this.scene.start('WarningScene', { worldIndex: 2 });
```
This tells Phaser to switch to `WarningScene` and pass along which world was chosen.

---

### `src/scenes/WarningScene.ts` — Hazard briefing

A simple screen that displays the world's name and describes its three hazard types before the game starts. The player presses Enter to continue.

```typescript
create(data: { worldIndex: number }) {
    const world = WORLDS[data.worldIndex];
    // Display world.name, world hazard descriptions
}
```

It receives the `worldIndex` passed from `TitleScene` and looks up the world's details from `WorldConfig`.

---

### `src/scenes/GameScene.ts` — The game itself

This is the largest and most complex file (over 3,500 lines). It is the core of the game. Everything that happens during actual gameplay lives here.

**What it does on startup (`create`):**

1. Reads the world index and calls `LevelGenerator.generateLevel(worldIndex)` to get the tile data
2. Creates **physics groups** — Phaser containers that know how to handle collisions:
   - `groundGroup`: tiles you stand on (static, never move)
   - `killGroup`: tiles that kill you on contact
   - `spikeGroup`: hazards that damage on overlap
   - `movementGroup`: tiles that push the player
3. Calls `buildLevel()` to turn each `LevelTile` into a visible, physical object
4. Creates the player character using a `Graphics` object and attaches arcade physics to it
5. Sets up the camera to follow the player as they scroll right
6. Creates the appropriate background (lava, beach, etc.)

**What it does every frame (`update`):**

```typescript
update(time: number, delta: number) {
    // 1. Read keyboard input
    // 2. Move the player left/right
    // 3. Handle jumping and ducking
    // 4. Update world-specific mechanics (lava spray, waves, tanks, etc.)
    // 5. Check if the player reached a checkpoint
    // 6. Check if the player finished the level
    // 7. Update the background parallax
}
```

**`delta`** is the time in milliseconds since the last frame. Using it ensures the game runs at the same speed regardless of frame rate:

```typescript
// Wrong: speed depends on frame rate
player.x += 5;

// Right: 200 pixels per second regardless of frame rate
player.x += 200 * (delta / 1000);
```

**World-specific mechanics** — each world has unique hazards handled by dedicated methods:

| World | Method | What it does |
|---|---|---|
| Lava | `updateLavaSpray()` | Activates/deactivates timed lava jets |
| Lava | `updateLandslide()` | Shifts conveyor tiles, pushes the player |
| Beach | `updateWaves()` | Spawns waves that the player can ride |
| Jungle | `updateVineSwings()` | Simulates rope physics for vine swinging |
| War Zone | `updateTankPush()` | Tanks that push the player when touched |
| War Zone | `updateBullets()` | Spawns and moves bullets across the screen |

**The duck mechanic** is a good example of how physics bodies work:

```typescript
// When ducking:
this.playerBody.setSize(32, 16);    // shrink the hitbox height
this.playerBody.setOffset(0, 16);  // shift it down so feet stay on ground

// When standing:
this.playerBody.setSize(32, 32);
this.playerBody.setOffset(0, 0);
```

The "hitbox" is the invisible rectangle Phaser uses to detect collisions. Shrinking it lets the player fit through low gaps.

---

### `src/scenes/WinScene.ts` — Victory screen

Shown after all 4 worlds are completed. Displays the total death count, elapsed time, and some celebratory animation (stars). Pressing Enter returns to the title screen.

---

### Background files (`src/worlds/*Background.ts`)

There are four background modules, one per world. They are kept separate from `GameScene` to keep the file sizes manageable.

Each module follows the same pattern:

```typescript
// Called once when the level loads
export function createLavaBackground(scene: Phaser.Scene): LavaBackgroundState { ... }

// Called every frame to animate things (particles, scrolling)
export function updateLavaBackground(state: LavaBackgroundState, cameraX: number) { ... }

// Called when leaving the level to free memory
export function destroyLavaBackground(state: LavaBackgroundState) { ... }
```

They use Phaser's `Graphics` API to draw everything in code — volcanoes, clouds, ruined buildings, jungle trees. No image files are needed; the shapes are generated with math.

**Parallax scrolling** is a visual trick where background layers move at different speeds to create a sense of depth. Layers closer to the camera scroll faster; distant layers scroll slowly:

```typescript
farLayer.setScrollFactor(0.1);   // moves 10% as fast as the camera
midLayer.setScrollFactor(0.4);   // moves 40% as fast
nearLayer.setScrollFactor(0.8);  // moves 80% as fast
```

---

## How the scenes connect

The game always flows in this order:

```
TitleScene
   │  player picks a world
   ▼
WarningScene
   │  player presses Enter
   ▼
GameScene
   │  player finishes the world
   ▼
  (back to TitleScene, unless all 4 worlds done)
   │  all 4 worlds completed
   ▼
WinScene
   │  player presses Enter
   ▼
TitleScene
```

Each scene passes data to the next using a plain object:
```typescript
this.scene.start('GameScene', { worldIndex: 1, startTime: Date.now() });
```

---

## Phaser vs. custom code — a summary

| What | Provided by | Example |
|---|---|---|
| Game loop (~60fps) | Phaser | calls `update()` automatically |
| Drawing on screen | Phaser | `Graphics`, `Text`, `Image` objects |
| Physics & gravity | Phaser | `arcade.gravity`, `setVelocityY()` |
| Collision detection | Phaser | `addCollider()`, `addOverlap()` |
| Camera scrolling | Phaser | `camera.startFollow(player)` |
| Scene switching | Phaser | `this.scene.start('GameScene')` |
| Keyboard input | Phaser | `this.input.keyboard.createCursorKeys()` |
| | | |
| Level layout | Custom | `LevelGenerator.ts` |
| World rules & hazards | Custom | `GameScene.ts` update methods |
| Saving progress | Custom | `ProgressManager.ts` + localStorage |
| Background art | Custom | `LavaBackground.ts` etc. |
| World definitions | Custom | `WorldConfig.ts` |
| Player colors | Custom | `PlayerConfig.ts` |

---

## Key concepts for beginners

**Scene**: A self-contained screen or game state. Like a slide in a presentation, but interactive. Phaser scenes have `create()` (setup) and `update()` (per-frame logic).

**Physics body**: An invisible shape attached to a game object. Phaser uses it to calculate gravity, velocity, and collisions. You rarely move objects directly — instead you set velocities and let physics do the work.

**Group**: A collection of objects that share the same physics behavior (e.g., all ground tiles are static). Checking collisions against a group is more efficient than checking each object individually.

**Graphics**: Phaser's drawing tool. Instead of using image files, you call methods like `fillRect()`, `fillCircle()`, `strokePath()` to draw shapes with code.

**Seeded random**: A way to get reproducible "random" numbers. Given the same starting seed, you always get the same sequence. This makes levels consistent across play sessions.

**delta time**: The time elapsed since the last frame. Multiplying speeds by `delta / 1000` makes movement frame-rate independent — the game feels the same whether it runs at 30fps or 60fps.
