# Double Vision — Code Overview

*A guide for people new to programming*

---

## What is this project?

Double Vision is a cooperative 2-player platformer video game. Two players run, jump, and dodge hazards across procedurally generated levels organized into four themed worlds (Lava, Beach, Jungle, War Zone). Players can play on the same keyboard, on separate computers connected online, or alone.

The project is a full-stack web application: there is a game that runs in the browser, a server that handles accounts and coordinates online multiplayer, and a database that stores persistent data like coins earned, accessories bought, and custom maps created.

---

## How the code is organized

The repository uses a **monorepo** — one repository that contains multiple separate packages that can share code with each other. The root directory contains a `pnpm-workspace.yaml` file that tells the package manager which folders are packages.

```
Double-Vision/
├── artifacts/
│   ├── double-vision/     ← The game (runs in the browser)
│   ├── api-server/        ← The server (runs on a computer in the cloud)
│   └── mockup-sandbox/    ← A playground for testing UI components
├── lib/
│   ├── db/                ← Database schema and connection
│   ├── api-spec/          ← OpenAPI definition of the API
│   ├── api-zod/           ← Data validation rules (Zod schemas)
│   └── api-client-react/  ← Auto-generated code for calling the API from React
├── docker/                ← Configuration to run everything in Docker containers
└── scripts/               ← Utility scripts (e.g., database migrations)
```

The big idea behind this layout is **separation of concerns**: the game code does not contain database connection logic, and the server code does not contain game physics. Shared pieces (like what a valid "user" looks like) live in `lib/` and are imported by both.

---

## The technology stack

| Layer | Technology | What it does |
|---|---|---|
| Game engine | Phaser 3 | Renders graphics, runs physics, handles input |
| Frontend language | TypeScript | JavaScript with type checking |
| Frontend build tool | Vite | Bundles code for the browser, runs a dev server |
| Frontend UI | React + Radix UI | Small HTML overlays (menus, forms) inside Phaser scenes |
| Backend server | Node.js + Express 5 | Handles HTTP requests and WebSocket connections |
| Real-time protocol | WebSockets (ws library) | Bidirectional communication for multiplayer |
| Database | PostgreSQL | Persistent storage |
| Database access | Drizzle ORM | Type-safe queries (avoids raw SQL in most places) |
| Auth tokens | JWT | Stateless login sessions |
| Monorepo tooling | pnpm workspaces | Shared dependencies across packages |

---

## The game front-end: `artifacts/double-vision/`

### Entry point

**`src/main.ts`** (13 lines) is where everything starts. It creates a Phaser `Game` object, tells it which scenes exist and what order they should load in, and sets the canvas size to 800×480 pixels. This is the only place where Phaser is configured at the top level.

### Scenes

Phaser organizes a game into **scenes** — think of each scene as one screen. Scenes can start, pause, resume, or stop, and Phaser manages switching between them. All scene files live in `src/scenes/`.

| File | What the player sees |
|---|---|
| `StartScene.ts` | Title screen with an animated player character |
| `AuthScene.ts` | Login and registration forms |
| `InputModeSelectScene.ts` | Choose keyboard or touch controls |
| `ModeSelectScene.ts` | Choose single-player, local co-op, or online co-op |
| `LobbyScene.ts` | Create or join an online room using a 5-letter code |
| `TitleScene.ts` | World map, level select, shop entry, settings |
| `ShopScene.ts` | Buy accessories (hats, glasses, neckwear) with coins |
| `WarningScene.ts` | Controls reminder shown before a level starts |
| `GameScene.ts` | The actual game — physics, hazards, players, coins |
| `WinScene.ts` | End-of-level summary (time, deaths, coins collected) |
| `MapEditorScene.ts` | Custom level editor with a tile grid |

`GameScene.ts` is by far the largest file at roughly 2,400 lines. It is where the physics world is set up, where the level is generated and drawn, and where both players' characters run every frame.

### Managers

Manager files in `src/` hold global state and logic that needs to survive across scene transitions. For example, when the player earns coins in `GameScene`, those coins must still be there when they reach `WinScene` and later `ShopScene`. Each manager is a singleton — only one instance exists for the whole game session.

| File | Responsibility |
|---|---|
| `AuthManager.ts` | Login state, JWT token storage, API request helpers |
| `AccessoryManager.ts` | Which accessories the player owns and has equipped |
| `CoinManager.ts` | Current coin balance, syncing to server |
| `ProgressManager.ts` | Which worlds and levels have been completed |
| `StatsManager.ts` | All-time counters (total deaths, coins earned, etc.) |
| `OnlineMultiplayerManager.ts` | WebSocket connection and message handling |
| `MusicManager.ts` | Playing the correct music track per world |
| `KeyBindings.ts` | Customizable keyboard controls |
| `GameSettings.ts` | Saved preferences (music on/off, background color, etc.) |
| `TouchControls.ts` | On-screen buttons for mobile players |
| `EventBus.ts` | A simple message system for modules to talk to each other |

`EventBus.ts` is worth understanding. It has only 15 lines but is used throughout the codebase. It lets one part of the code broadcast a message (like `"coin-collected"`) without needing to know what other parts of the code are listening. This avoids tight coupling — you do not need to import `StatsManager` from `GameScene`; you just emit an event.

### World and level code

The `src/worlds/` folder contains one file per world theme, plus shared utilities:

- `WorldConfig.ts` — defines the 4 worlds (colors, names, hazard names)
- `LevelGenerator.ts` — takes a numeric seed and produces a repeatable level layout (same seed always produces the same level)
- `LavaBackground.ts`, `BeachBackground.ts`, `JungleBackground.ts`, `WarZoneBackground.ts` — animated backgrounds and world-specific hazard update logic

The `src/tracks/` folder contains music note arrays and BPM data that `MusicManager` uses to play chiptune-style music.

---

## The server: `artifacts/api-server/`

### Entry point

**`src/index.ts`** creates an HTTP server, attaches a WebSocket server to it, and starts listening on a port. It also handles graceful shutdown (closing connections when the process is stopped).

**`src/app.ts`** sets up the Express middleware stack: logging, CORS (allowing requests from the browser), and JSON body parsing.

### Routes

All HTTP routes are under `/api`. Protected routes require a `Bearer <token>` header.

| Route | Purpose |
|---|---|
| `POST /api/auth/register` | Create a new account |
| `POST /api/auth/login` | Return a JWT on successful login |
| `GET  /api/auth/me` | Verify a token is still valid |
| `GET  /api/user/data` | Load coins, progress, accessories, stats in one call |
| `POST /api/user/coins` | Update coin balance |
| `POST /api/user/progress` | Update world completion/death count |
| `POST /api/user/accessories` | Save which accessories are owned/equipped |
| `POST /api/user/stats` | Update all-time statistics |
| `GET  /api/user/maps` | List custom maps |
| `POST /api/user/maps` | Create a new custom map |
| `PUT  /api/user/maps/:id` | Update an existing map |
| `DELETE /api/user/maps/:id` | Delete a map |

### Authentication middleware

`src/middleware/auth.ts` verifies the JWT token on every protected route. If the token is missing or invalid, the server returns 401. If valid, it adds the user's ID to the request object so route handlers can use it.

### WebSocket room manager

`src/ws/roomManager.ts` (285 lines) handles all real-time multiplayer. It is described in detail in the multiplayer section below.

---

## Shared libraries: `lib/`

### `lib/db/`

Contains the database table definitions and the Drizzle connection pool. The schema file (`src/schema/users.ts`) is the single source of truth for what tables exist. Drizzle auto-generates TypeScript types from the schema, so if a column name changes, TypeScript errors will appear at every place that reads that column.

### `lib/api-zod/`

Contains Zod schemas that describe what valid API request and response bodies look like. These are imported by the server (for input validation) and the client (for type safety).

### `lib/api-spec/`

An OpenAPI YAML file that documents the API. This is a machine-readable description of every endpoint, useful for generating client code and for documentation.

### `lib/api-client-react/`

Auto-generated React Query hooks (`useUserData`, `useUpdateCoins`, etc.) that the frontend uses to call the API. Because they are generated from the OpenAPI spec, they stay in sync with the server contract automatically.

---

## Phaser vs. custom code

A common question when starting with a game engine is: "What does the engine do for me, and what do I have to write myself?" Here is the breakdown for Double Vision.

### What Phaser handles

- **Physics simulation** — Gravity (800 px/s²), velocity, ground collisions, and object-to-object overlap detection are all handled by Phaser's Arcade Physics engine. The game just says "this player has a body, and this tile group is solid ground" and Phaser keeps them from passing through each other.
- **Scene lifecycle** — Phaser calls `create()` once when a scene starts and `update()` 60 times per second. All game logic is placed inside these two methods.
- **Input polling** — `this.cursors = this.input.keyboard.createCursorKeys()` gives the game access to arrow key state. Phaser polls the browser keyboard events and exposes a simple `isDown` boolean.
- **Rendering** — Phaser renders a canvas each frame. Drawing text, rectangles, and images is done through Phaser's GameObjects (`this.add.text(...)`, `this.add.rectangle(...)`).
- **Camera** — Following the players, scrolling the level, and fitting the canvas to the window are built into Phaser.

### What is custom code

- **World-specific hazards** — Lava splashes, ocean wave pursuit logic, vine swinging with rope physics, quicksand, poison flowers, and tank bullets are all written from scratch inside each world's background file and inside `GameScene`.
- **Procedural level generation** — `LevelGenerator.ts` implements a seeded random number generator and custom algorithms for placing gaps, platforms, checkpoints, and hazards. Phaser does not generate levels.
- **Accessory rendering** — Hats, glasses, and neckwear are drawn each frame using Phaser's Graphics API (drawing circles and rectangles) over the player's body. The positions and shapes are all defined in `AccessoryManager.ts`.
- **Checkpoint system** — Visual markers that save position mid-level are custom logic.
- **Multiplayer synchronization** — Phaser has no networking. All WebSocket communication is custom.
- **Custom map editor** — The grid-based tile editor in `MapEditorScene.ts` is built using Phaser's pointer input and graphics objects, but the editing workflow and save/load logic are entirely hand-written.
- **Manager singleton system** — Phaser does not provide global state management. The manager pattern is custom.

In short: Phaser provides a canvas, a physics engine, and a loop. Everything that makes Double Vision *this specific game* is custom code.

---

## How multiplayer works

### The protocol: raw WebSockets

Double Vision uses WebSockets, not a higher-level multiplayer framework like Colyseus or Socket.io. A WebSocket is a persistent two-way connection between the browser and the server — unlike a regular HTTP request, the server can send messages to the client at any time.

The server-side code is in `artifacts/api-server/src/ws/roomManager.ts`. The client-side code is in `artifacts/double-vision/src/OnlineMultiplayerManager.ts`.

### Rooms

When Player 1 clicks "Create Room," the browser sends a `create_room` message to the server. The server generates a 5-character room code (using letters A-Z and numbers 2-9, excluding 0, 1, O, and I to avoid visual confusion) and sends it back. Player 1 shows the code on screen.

When Player 2 enters the code and clicks "Join," the browser sends a `join_room` message. The server looks up the room, adds Player 2, and notifies both players that they are connected.

Rooms have exactly 2 players. There is no spectator mode.

### Starting a game

Player 1 (the host) selects a world. The browser sends a `select_world` message containing:
- `worldIndex` — which world (0–3)
- `seed` — a random number used to generate the level
- `customMapData` (optional) — the full tile array if playing a custom map

The server relays this to Player 2. Both players independently run `LevelGenerator` with the same seed and get identical levels. This is called **deterministic generation** — the same seed always produces the same result, so both players see the same layout without the server needing to send the full level data.

### Synchronizing during play

Every 33 milliseconds (approximately 30 times per second), each player sends a `player_input` message with their current keyboard state:

```json
{ "type": "player_input", "left": false, "right": true, "jump": false, "duck": false }
```

The server relays this to the other player. Each browser applies the received inputs to the remote player's character and runs the physics locally. This is called **input-based synchronization** — each side simulates the same game with the same inputs, so the characters should be in the same positions.

There is also a `game_state` message that sends raw position and velocity (`x`, `y`, `vx`, `vy`) for correction when the simulations drift out of sync.

### Other message types

| Message | Who sends it | What happens |
|---|---|---|
| `player_death` | Either player | The other player is notified |
| `player_pause` / `player_unpause` | Either player | Both players pause/unpause |
| `change_level` / `start_level` | Host | Guest advances to the next level |
| `ping` / `pong` | Both sides | Keep-alive every 30 seconds; unresponsive clients are disconnected |

### Limitations of the approach

The input-based approach is simple and lightweight, but it assumes both simulations stay in sync. If one player's computer is slow or the network introduces packet loss, the two players may see their characters in different positions. The `game_state` correction message helps, but there is no sophisticated lag compensation or rollback system (techniques used in professional multiplayer games). For a fun co-op game between friends, this is a reasonable trade-off.

---

## The database layer

### What is stored

The database has five tables, all defined in `lib/db/src/schema/users.ts`.

**`users`** — One row per account.
- `username` (3–15 chars, alphanumeric + underscore, lowercase, unique)
- `password_hash` (bcrypt — the password is never stored directly)
- `coins` (current balance, 0–999,999)
- `created_at`, `updated_at`

**`user_progress`** — One row per (user, world) pair.
- Which worlds the player has completed
- How many deaths occurred in each world
- Whether the world was completed without dying (`deathless`)

**`user_accessories`** — One row per (user, accessory) pair.
- Which accessories the player has purchased
- Which ones are currently equipped

**`user_stats`** — One row per user. All-time counters:
- Total coins ever earned and spent
- Total deaths
- Total level completions
- Total custom levels created

The server uses `GREATEST(current_value, new_value)` when updating stats, which means stats can only go up — a client cannot accidentally reset a counter by sending a stale value.

**`custom_maps`** — One row per saved map.
- Map name, tile data (JSON array), background and tile colors
- Linked to the user who created it
- Max 50 maps per user; max 5,000 tiles per map

### What is NOT stored

The database covers the basics of user accounts and progression, but several common game features are absent:

- **Leaderboards** — There is no global ranking of completion times or death counts. Stats are private to each user.
- **Match history** — Completed game sessions are not recorded. There is no "play history" screen.
- **Achievements** — Unlock conditions (e.g., "complete a world deathlessly") are checked in JavaScript on the client and stored in localStorage, not in the database. This means achievements can be lost if the user clears browser storage.
- **Friend lists and social features** — Players can only connect by sharing a room code manually. There is no friend system, profile page, or way to see other players' stats.
- **Map discovery** — Custom maps are private to their creator. There is no public gallery, search, or rating system for user-made levels.
- **Session tracking** — JWT tokens are not stored in the database. There is no way to invalidate a specific token (e.g., after a password change) without changing the JWT secret, which would log everyone out.
- **Soft deletes** — Deleted maps are permanently removed with no recovery option.

---

## Recommendations for improvement

The codebase is well-structured for a game of this size. The following are suggestions for making it easier to maintain and extend.

### 1. Split `GameScene.ts` into smaller files

At ~2,400 lines, `GameScene.ts` does too many things: it sets up physics groups, generates the level, handles hazard updates for all four worlds, manages online sync, tracks checkpoint state, and more. This makes it hard to find specific logic. Consider extracting:
- A `HazardManager` per world (e.g., `LavaHazardManager.ts`) to hold the update and collision logic for each world's unique hazards.
- A `CheckpointSystem.ts` for checkpoint placement, activation, and respawn.
- A `LevelRenderer.ts` for the code that converts the generator output into Phaser tiles and physics bodies.

### 2. Move achievement/unlock logic to the server

Achievements are currently evaluated in JavaScript in the browser and stored in `localStorage`. A player could open the browser console and mark any achievement as unlocked. Moving this logic to the server (checking conditions when progress is saved) would make unlocks trustworthy and persistent across devices.

### 3. Add rate limiting to authentication endpoints

The `/api/auth/register` and `/api/auth/login` routes have no rate limiting. A malicious actor could attempt thousands of password guesses per minute. Adding a simple rate limiter (e.g., `express-rate-limit`) — for example, 10 login attempts per IP per minute — would prevent brute-force attacks.

### 4. Add server-side input validation at the WebSocket layer

The HTTP API validates all input carefully (tile counts, field lengths, value ranges). The WebSocket handler in `roomManager.ts` relays messages with minimal validation. A malformed or oversized `select_world` message containing a very large `customMapData` payload could cause memory pressure. Adding the same tile-data validation used in the HTTP `/user/maps` endpoint to the WebSocket path would close this gap.

### 5. Add auto-save to the map editor

`MapEditorScene.ts` has no auto-save. If the browser tab is accidentally closed, all unsaved work is lost. Saving the current map state to `localStorage` every 30 seconds (and restoring it on re-entry) is a small change that would prevent frustrating data loss.

### 6. Paginate the maps list

`GET /api/user/maps` returns all of a user's maps at once. With 50 maps each containing up to 5,000 tiles, the response can be several hundred kilobytes. Adding `?page=` and `?limit=` query parameters, and returning only map metadata (name, id, created_at) in the list response — with full tile data only on `GET /api/user/maps/:id` — would make the list faster to load.

### 7. Add server-side session invalidation

Currently, JWT tokens last 30 days and cannot be revoked. If a user's account is compromised or the user wants to log out of all devices, there is no mechanism to do so short of rotating the JWT secret (which logs everyone out). Storing a short `session_id` in the token and a `sessions` table in the database would allow individual tokens to be invalidated.

### 8. Centralize error handling in the server

Many `try/catch` blocks in the server routes swallow errors silently or log them inconsistently. Adding a shared Express error-handling middleware and ensuring all async route handlers propagate errors to it would give a consistent error response format and make debugging easier.

### 9. Extract magic numbers into named constants

`GameScene.ts` and other files contain literal numbers like `800` (gravity), `200` (player speed), `400` (jump velocity), and `32` (tile size) scattered throughout. Defining these as named constants at the top of each file (e.g., `const PLAYER_SPEED = 200`) makes the code easier to read and means changing a value requires editing only one place.

### 10. Add a public map gallery

The infrastructure for custom maps exists — the database stores them, the editor creates them, and the game can load them. The missing piece is a public listing so players can discover and play each other's maps. Adding a `GET /api/maps/public` endpoint (with pagination, sorting, and a `published` flag on the `custom_maps` table) would make user-created content a genuine feature rather than a private tool.

---

## Summary

Double Vision is a full-stack game application with a clear separation between the game client (Phaser + custom TypeScript), the API server (Express + WebSockets), and the data layer (PostgreSQL + Drizzle). Multiplayer is implemented with input-based synchronization over raw WebSockets, which is simple and effective for a cooperative game between friends. The database covers authentication and core progression but leaves social, discovery, and security-hardening features as natural next steps.
