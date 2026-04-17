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
- User accounts with login/register (bcryptjs password hashing, JWT tokens)
- Guest mode: skip login, data stays in localStorage only
- Logged-in users: coins, progress, and accessories synced to server via API
- Auth screen appears after "Start Game" with Log In, Create Account, Play as Guest
- Progress (completion, best deaths) persisted to localStorage (+ server for logged-in users)
- Coins scattered through levels, collected on touch, tracked in localStorage (+ server for logged-in users)
- Accessory shop (13 items across 4 categories: hats, glasses, capes, neckwear) - buy with coins, equip/remove
- Equipped accessories drawn on player character in-game
- All-time stats tracking (total coins earned/spent, deaths, level completions) persisted to localStorage (+ server for logged-in users)
- Stats button (📊) on TitleScene opens a modal displaying all-time stats
- Completing a world returns to title; completing all 4 shows WinScene

### Game Modes
- **Single Player**: Full solo control with arrow keys
- **Local Co-op**: Two players on shared keyboard (Player 1: W/S for jump/duck, Player 2: arrows for movement)
- **Online Co-op**: Two players on separate devices via WebSocket. Host controls left/right, guest controls jump/duck. Room-code-based matchmaking.

### Controls
- **Player 1 (Local)**: W (jump), S (duck) — customizable via settings
- **Player 2 (Local)**: Left/Right arrows (move) — customizable via settings
- **Single Player**: Arrow keys for all controls — customizable via settings
- **Online Host**: Arrow keys for left/right movement
- **Online Guest**: Arrow keys for jump/duck
- **Pause**: Escape or P
- Controls can be remapped via the settings gear icon on the TitleScene
- In local multiplayer, Player 1 keys are restricted to letter keys (A-Z), Player 2 to arrow/nav keys
- Custom bindings persist in localStorage

### Settings
- **Music**: Procedural Web Audio API music, toggleable ON/OFF from settings modal or pause menu
- **Background Color**: 6 presets (Midnight, Charcoal, Deep Blue, Dark Green, Dark Purple, Dark Red)
- Settings accessible from TitleScene gear icon and in-game pause menu
- All settings persist in localStorage

### Custom Map Builder
- "Create Map" button on TitleScene (disabled for guests with "log in" message)
- "My Maps" button opens a modal listing saved maps with play/edit/delete actions
- MapEditorScene: scrollable grid editor (200×15 tiles at 32px), tile palette toolbar, background/ground/platform color pickers
- Custom maps saved to server via REST API, stored as JSON tile data
- Playable in all modes (single, local co-op, online co-op)
- For online co-op, custom tile data is sent to partner via WebSocket
- Maps use same LevelTile format as procedural levels

### Key Files
- `src/main.ts` - Phaser config and game initialization
- `src/KeyBindings.ts` - Key binding configuration module with localStorage persistence
- `src/GameSettings.ts` - Settings persistence (music, background color)
- `src/MusicManager.ts` - Procedural music via Web Audio API
- `src/AuthManager.ts` - Client-side auth state (JWT token, username, API helpers for login/register/sync)
- `src/CoinManager.ts` - Coin balance persistence in localStorage + server sync for logged-in users
- `src/AccessoryManager.ts` - Accessory definitions, ownership, equip state, drawing logic + server sync
- `src/ProgressManager.ts` - Progress read/write (localStorage + server sync for logged-in users)
- `src/scenes/AuthScene.ts` - Auth screen with Log In, Create Account, Play as Guest (HTML input overlays)
- `src/OnlineMultiplayerManager.ts` - WebSocket client singleton for online co-op room management and input relay
- `src/scenes/ModeSelectScene.ts` - Mode select with Single Player, Local Co-op, Online Co-op
- `src/scenes/LobbyScene.ts` - Online co-op lobby (Create Room / Join Room)
- `src/scenes/TitleScene.ts` - Title screen with world gallery, controls display, settings modal, map builder buttons
- `src/scenes/MapEditorScene.ts` - Map editor with grid canvas, tile palette, color pickers, save/load
- `src/scenes/ShopScene.ts` - Accessory shop with category tabs, buy/equip/remove, character preview
- `src/scenes/WarningScene.ts` - Pre-world hazard warning
- `src/scenes/GameScene.ts` - Core gameplay with physics, hazards, checkpoints, pause menu, online input handling, custom map support
- `src/scenes/WinScene.ts` - Victory screen with stats (shown when all 4 worlds complete)
- `src/worlds/WorldConfig.ts` - World definitions and physics constants
- `src/worlds/LevelGenerator.ts` - Procedural level generation

### Dependencies
- Phaser 3 (game framework with Arcade Physics)
- Vite (dev server and bundling)

## API Server (artifacts/api-server)

### Auth & User Data API
- POST `/api/auth/register` - Create account (username + password, bcryptjs hash)
- POST `/api/auth/login` - Log in, returns JWT token
- GET `/api/auth/me` - Get current user from token
- GET `/api/user/data` - Get coins, progress, accessories for logged-in user
- POST `/api/user/coins` - Update coin balance
- POST `/api/user/progress` - Update world progress
- POST `/api/user/accessories` - Update owned/equipped accessories
- POST `/api/user/stats` - Update all-time stats
- GET `/api/user/maps` - List user's custom maps
- GET `/api/user/maps/:id` - Get a specific custom map with tile data
- POST `/api/user/maps` - Create a new custom map
- PUT `/api/user/maps/:id` - Update an existing custom map
- DELETE `/api/user/maps/:id` - Delete a custom map
- Auth middleware extracts user from Bearer token in Authorization header
- Dependencies: bcryptjs, jsonwebtoken

### Database Schema
- `users` table: id, username, password_hash, coins, created_at, updated_at
- `user_progress` table: id, user_id, world_index, completed, deaths (unique on user_id + world_index)
- `user_accessories` table: id, user_id, accessory_id, equipped (unique on user_id + accessory_id)
- `custom_maps` table: id, user_id, name, tile_data (JSON), bg_color, ground_color, platform_color, created_at, updated_at

### WebSocket Room Management
- WebSocket server attached to HTTP server at `/api/ws`
- Room lifecycle: create (generates 5-char alphanumeric code), join by code, relay inputs, handle disconnects
- Server-side ping/pong for connection health monitoring
- One socket per room enforcement (joining/creating evicts from prior room)
- Key file: `src/ws/roomManager.ts`
- Dependencies: ws (WebSocket library)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
