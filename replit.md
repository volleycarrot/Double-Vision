# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Double Vision Game

A 2-player co-op 2D platformer built with Phaser 3 (v3.90). Located in `artifacts/double-vision/`.

### Game Structure
- **4 themed worlds**: Lava, Beach, Jungle, War Zone (all unlocked from start)
- Each world has unique kill blocks, spikes/hazards, and movement mechanics
- 5 checkpoints per level, death respawn at last checkpoint
- Title screen has a world gallery on the right with completion indicators
- Pause menu (ESC or P) with Unpause, Restart, Home buttons
- Progress (completion, best deaths) persisted to localStorage
- Completing a world returns to title; completing all 4 shows WinScene

### Controls
- **Player 1**: W (jump), S (duck) — customizable via settings
- **Player 2**: Left/Right arrows (move) — customizable via settings
- **Single Player**: Arrow keys for all controls — customizable via settings
- **Pause**: Escape or P
- Controls can be remapped via the settings gear icon on the TitleScene
- In multiplayer, Player 1 keys are restricted to letter keys (A-Z), Player 2 to arrow/nav keys
- Custom bindings persist in localStorage

### Settings
- **Music**: Procedural Web Audio API music, toggleable ON/OFF from settings modal or pause menu
- **Background Color**: 6 presets (Midnight, Charcoal, Deep Blue, Dark Green, Dark Purple, Dark Red)
- Settings accessible from TitleScene gear icon and in-game pause menu
- All settings persist in localStorage

### Key Files
- `src/main.ts` - Phaser config and game initialization
- `src/KeyBindings.ts` - Key binding configuration module with localStorage persistence
- `src/GameSettings.ts` - Settings persistence (music, background color)
- `src/MusicManager.ts` - Procedural music via Web Audio API
- `src/ProgressManager.ts` - localStorage progress read/write (completion, deaths)
- `src/scenes/TitleScene.ts` - Title screen with world gallery, controls display, and settings modal
- `src/scenes/WarningScene.ts` - Pre-world hazard warning
- `src/scenes/GameScene.ts` - Core gameplay with physics, hazards, checkpoints, pause menu
- `src/scenes/WinScene.ts` - Victory screen with stats (shown when all 4 worlds complete)
- `src/worlds/WorldConfig.ts` - World definitions and physics constants
- `src/worlds/LevelGenerator.ts` - Procedural level generation

### Dependencies
- Phaser 3 (game framework with Arcade Physics)
- Vite (dev server and bundling)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
