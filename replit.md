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
- **4 themed worlds**: Lava, Beach, Jungle, War Zone
- Each world has unique kill blocks, spikes/hazards, and movement mechanics
- 5 checkpoints per level, death respawn at last checkpoint
- Win screen shows total deaths and elapsed time

### Controls
- **Player 1**: W (jump), S (duck)
- **Player 2**: Left/Right arrows (move)

### Key Files
- `src/main.ts` - Phaser config and game initialization
- `src/scenes/TitleScene.ts` - Title screen with controls
- `src/scenes/WarningScene.ts` - Pre-world hazard warning
- `src/scenes/GameScene.ts` - Core gameplay with physics, hazards, checkpoints
- `src/scenes/WinScene.ts` - Victory screen with stats
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
