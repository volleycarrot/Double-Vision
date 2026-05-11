# Double Vision — Code Overview

A guide for people new to programming who want to understand how this game is built.

---

## Table of Contents

1. [What is this project?](#1-what-is-this-project)
2. [High-level architecture](#2-high-level-architecture)
3. [Directory structure](#3-directory-structure)
4. [The frontend game (`artifacts/double-vision`)](#4-the-frontend-game)
   - [Entry point: `main.ts`](#41-entry-point-maints)
   - [Scenes: the screens of the game](#42-scenes-the-screens-of-the-game)
   - [Manager modules](#43-manager-modules)
   - [World and level generation](#44-world-and-level-generation)
5. [Phaser vs. custom code](#5-phaser-vs-custom-code)
6. [How online multiplayer works](#6-how-online-multiplayer-works)
7. [The backend server (`artifacts/api-server`)](#7-the-backend-server)
8. [The database layer (`lib/db`)](#8-the-database-layer)
9. [Infrastructure and tooling](#9-infrastructure-and-tooling)
10. [Recommendations for improvement](#10-recommendations-for-improvement)

---

## 1. What is this project?

**Double Vision** is a 2-player cooperative 2D platformer that runs in a web browser.

The core concept: two players share control of *one* character at the same time. One player controls left/right movement; the other controls jumping and ducking. To get through the levels, the two players must coordinate their inputs.

The game has:
- 4 worlds (Lava, Beach, Jungle, War Zone), each with unique hazards
- Procedurally generated levels (different every run, but reproducible with a seed)
- Local co-op (two keyboards on one machine) and online co-op (two people in different locations)
- An in-game shop with cosmetic accessories (hats, glasses, neckwear)
- User accounts that persist coins, progress, and accessories across sessions

---

## 2. High-level architecture

The project is split into three parts that run separately and communicate with each other:

```
┌─────────────────────────────────────────────┐
│  Browser (player's computer)                │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Game frontend (double-vision)       │   │
│  │  TypeScript + Phaser + Vite          │   │
│  │  Renders the game, handles input     │   │
│  └───────────────┬──────────────────────┘   │
└──────────────────┼──────────────────────────┘
                   │  HTTP (REST API) + WebSocket
┌──────────────────▼──────────────────────────┐
│  Server (api-server)                        │
│  Node.js + Express + TypeScript             │
│  Handles accounts, relays multiplayer msgs  │
└──────────────────┬──────────────────────────┘
                   │  SQL
┌──────────────────▼──────────────────────────┐
│  Database                                   │
│  PostgreSQL + Drizzle ORM                   │
│  Stores users, progress, coins, accessories │
└─────────────────────────────────────────────┘
```

**Frontend** is the game itself. It runs entirely in the user's browser after being loaded from the server.

**Backend server** does two things:
1. Serves a REST HTTP API for user accounts (login, register, save progress, etc.)
2. Provides a WebSocket endpoint that lets two players find each other and exchange inputs in real time.

**Database** is a PostgreSQL database that stores persistent user data.

---

## 3. Directory structure

```
Double-Vision/
├── artifacts/
│   ├── double-vision/       ← The game frontend
│   │   ├── src/
│   │   │   ├── main.ts      ← Entry point, Phaser config
│   │   │   ├── scenes/      ← One file per screen (title, game, shop, …)
│   │   │   ├── worlds/      ← Level generation and world backgrounds
│   │   │   ├── tracks/      ← Music data
│   │   │   ├── AuthManager.ts
│   │   │   ├── AccessoryManager.ts
│   │   │   ├── CoinManager.ts
│   │   │   ├── GameSettings.ts
│   │   │   ├── KeyBindings.ts
│   │   │   ├── MusicManager.ts
│   │   │   ├── OnlineMultiplayerManager.ts
│   │   │   ├── PlayerConfig.ts
│   │   │   ├── ProgressManager.ts
│   │   │   ├── StatsManager.ts
│   │   │   └── TouchControls.ts
│   │   └── vite.config.ts   ← Build tool config
│   │
│   └── api-server/          ← The server
│       └── src/
│           ├── index.ts     ← Server entry point
│           ├── app.ts       ← Express middleware setup
│           ├── routes/
│           │   ├── auth.ts  ← /api/auth/register, /api/auth/login
│           │   ├── user.ts  ← /api/user/coins, /progress, /accessories, /stats
│           │   └── health.ts
│           ├── ws/
│           │   └── roomManager.ts  ← WebSocket multiplayer
│           └── middleware/
│               └── auth.ts  ← JWT token verification
│
├── lib/
│   └── db/
│       └── src/
│           ├── index.ts     ← Database connection
│           └── schema/
│               └── users.ts ← All table definitions
│
└── docker/                  ← Docker setup for local development
```

---

## 4. The frontend game

### 4.1 Entry point: `main.ts`

`main.ts` is the first file that runs. It does one job: configure and start the Phaser game engine.

```typescript
// src/main.ts  (simplified)
const config = {
  width: 800,
  height: 480,
  physics: { default: "arcade", arcade: { gravity: { y: 800 } } },
  scene: [StartScene, AuthScene, InputModeSelectScene, ModeSelectScene,
          LobbyScene, TitleScene, ShopScene, WarningScene, GameScene, WinScene],
};

new Phaser.Game(config);
```

Key settings:
- **800×480**: fixed canvas size (Phaser scales it to fit the window)
- **arcade physics**: a simple collision system built into Phaser (rectangles colliding with each other, affected by gravity)
- **gravity y: 800**: everything falls downward at acceleration 800 pixels/second²
- **scene list**: the 10 "screens" of the game, described in the next section

### 4.2 Scenes: the screens of the game

In Phaser, a **Scene** is like a screen or page. Only one scene is visible at a time, and switching scenes is how the game moves from the title screen to gameplay to the shop.

Each scene class has three standard Phaser methods:

| Method | When it runs | What it does |
|--------|-------------|--------------|
| `preload()` | Once before first display | Load images, sounds |
| `create()` | Once when scene starts | Build the screen |
| `update()` | Every frame (~60×/second) | Handle input, move things |

Here is what each scene does:

| File | Purpose |
|------|---------|
| `StartScene.ts` | The title screen. Shows "DOUBLE VISION", an animated player square, and a "PLAY" button. |
| `AuthScene.ts` | Login / register form. After success, loads user data from server and moves to next scene. |
| `InputModeSelectScene.ts` | Asks the player whether they are using a keyboard or a touchscreen. Saves the choice. |
| `ModeSelectScene.ts` | Choose game mode: single-player, local co-op, or online co-op. |
| `LobbyScene.ts` | Online co-op lobby. Host creates a room and gets a 5-letter code; guest enters the code to join. |
| `TitleScene.ts` | World selection: pick which of the 4 worlds to play. |
| `ShopScene.ts` | The accessory shop. Spend coins to buy hats, glasses, and neckwear. |
| `WarningScene.ts` | A brief warning screen shown before the game starts. |
| `GameScene.ts` | **The main game.** ~1,200 lines. Level rendering, physics, player movement, hazards, coins, checkpoints, online sync. |
| `WinScene.ts` | Shown when a world is completed. Displays time, deaths, and coins. |

#### A closer look at GameScene.ts

`GameScene.ts` is by far the largest file. When it starts (`create()` method), it:

1. Generates the level layout using `generateLevel()`
2. Creates Phaser physics groups for each tile type (ground, platforms, kill blocks, spikes, etc.)
3. Places the player rectangle and attaches the physics body
4. Registers collision rules (player vs. ground → land; player vs. kill block → die)
5. Sets up keyboard bindings
6. Registers WebSocket listeners if playing online
7. Spawns coins and secret areas

Then every frame (`update()` method, called ~60 times/second):

1. Reads keyboard (or touch) inputs
2. If online: sends inputs to the partner every 33ms (≈30 times/second)
3. Moves the player (set velocity based on left/right/jump inputs)
4. Applies world-specific effects (lava sprays, ocean waves, quicksand sinking, vine swinging, moving tanks/bullets)
5. Updates background parallax layers
6. Draws the player's eyes and accessories on top of the player rectangle

### 4.3 Manager modules

The game uses a pattern of **manager modules**: standalone files that handle one concern each. They expose functions that other files call.

| File | Responsibility | Main exports |
|------|---------------|--------------|
| `AuthManager.ts` | Authentication: JWT token, localStorage, API calls | `isLoggedIn()`, `loginRequest()`, `syncCoins()`, `apiRequest()` |
| `CoinManager.ts` | In-game coin balance | `getCoins()`, `addCoins()`, `spendCoins()` |
| `AccessoryManager.ts` | Owned and equipped accessories, drawing them | `purchaseAccessory()`, `drawAccessories()` |
| `ProgressManager.ts` | Which worlds have been completed | `markWorldCompleted()`, `allWorldsCompleted()` |
| `StatsManager.ts` | Lifetime stats (total deaths, coins earned, etc.) | `recordDeath()`, `recordCoinsEarned()` |
| `GameSettings.ts` | User preferences (music on/off, background color, input mode) | `getSettings()`, `setMusicEnabled()` |
| `MusicManager.ts` | Background music playback using the Web Audio API | `startMusic()`, `toggleMusic()` |
| `KeyBindings.ts` | Keyboard key mapping per game mode | `getBindings()` |
| `PlayerConfig.ts` | Player color palette and eye drawing geometry | `getSelectedColor()`, `drawEyes()` |
| `OnlineMultiplayerManager.ts` | WebSocket connection and message routing | `connect()`, `sendInputs()`, `on()` |
| `TouchControls.ts` | On-screen buttons for mobile play | `show()`, `getState()` |

**Persistence pattern:** Most managers store data in two places:

1. **`localStorage`** (in the browser): fast, works offline, survives page refresh
2. **Server database** (if logged in): persists across devices, survives clearing browser data

When the user logs in, server data is merged into localStorage. From then on, every change is saved locally and also "synced" to the server via a fire-and-forget API call.

### 4.4 World and level generation

**`worlds/WorldConfig.ts`** defines the 4 worlds as data objects:

```typescript
{ name: "Lava World", bgColor: 0x4a0000, groundColor: 0x3a1212, … }
{ name: "Beach World", bgColor: 0x87ceeb, groundColor: 0xd2b48c, … }
{ name: "Jungle World", bgColor: 0x0d2b0d, groundColor: 0x3b5e2b, … }
{ name: "War Zone",    bgColor: 0x2a2a2a, groundColor: 0x3a3a3a, … }
```

It also exports physics constants (`TILE = 32px`, `LEVEL_WIDTH = 200 tiles`, `JUMP_VELOCITY = -400`, etc.) used throughout the game.

**`worlds/LevelGenerator.ts`** generates the tile layout procedurally. The key ideas:

- **Seeded random**: given the same seed number, the function always produces the same level. This is essential for online play: both players generate the same level from the same seed, without transmitting the whole layout over the network.
- **Difficulty scaling**: hazards become denser toward the right side of the level.
- **Safe zones**: checkpoints and the start/end of the level are kept hazard-free.
- **World-specific tiles**: each world has its own hazard type (lava blocks, water, quicksand, mines).

The four background files (`LavaBackground.ts`, `JungleBackground.ts`, `BeachBackground.ts`, `WarZoneBackground.ts`) each implement decorative animated backgrounds using Phaser's `Graphics` API and parallax scrolling (background layers move slower than the foreground to create a sense of depth).

---

## 5. Phaser vs. custom code

[Phaser](https://phaser.io) is an open-source 2D game framework. It provides foundational building blocks so the custom code doesn't have to re-implement them from scratch.

### What Phaser provides

| Phaser feature | What it does in this game |
|----------------|--------------------------|
| **Game loop** | Calls `update()` on every scene 60 times per second automatically |
| **Arcade physics** | Handles gravity, velocity, and AABB (box-vs-box) collision detection |
| **Camera** | Follows the player horizontally; crops the view to the level bounds |
| **Input** | Reads keyboard state each frame; provides "JustDown" (key pressed this frame) |
| **Graphics API** | Draws rectangles, circles, triangles, lines — used for the player, terrain, accessories, and effects |
| **Scene manager** | Starts, stops, and transitions between the 10 scenes |
| **Tweens** | Animates values smoothly over time (used for the bouncing player on the title screen) |
| **DOM elements** | Embeds HTML input fields inside the canvas (used for the lobby's room-code input) |
| **Scale manager** | Stretches the 800×480 canvas to fill the browser window on any screen size |

### What custom code adds

Everything game-specific is custom:

- **Level generation**: the seeded procedural algorithm in `LevelGenerator.ts`
- **Hazard behaviors**: lava spray timers, ocean wave logic, quicksand sinking, vine physics, tank movement, bullet spawning — all implemented by hand in `GameScene.ts`
- **Online multiplayer**: the WebSocket connection, room creation, input sharing, and physics authority logic
- **All menus and UI**: every button, text label, and screen is drawn using Phaser primitives (there is no HTML/CSS UI outside the lobby code-input)
- **Accessory rendering**: each hat, glasses, and neckwear item is drawn pixel-by-pixel using the Phaser `Graphics` API
- **Music**: generated procedurally using the Web Audio API (not Phaser's audio system)
- **Backend**: the Express server, JWT authentication, and database layer are standard Node.js, not Phaser

### Visual note

Because the game uses Phaser's `Graphics` API and simple `Rectangle` objects instead of image sprites, the visual style is intentionally minimal: colored rectangles with eyes. The backgrounds and accessories add visual variety, but all of it is drawn in code rather than loaded as artwork.

---

## 6. How online multiplayer works

### The "split controls" concept

The game's hook is that one character is controlled by two people. One player controls left/right movement; the other controls jump and duck. This maps naturally to network multiplayer: each player sends only two button states.

### Roles: host and guest

- The **host** creates the room.
- The **guest** joins using a 5-character code.

The host is the **authoritative** game instance: Phaser's physics engine runs on the host's machine, and the host is the single source of truth for where the character is.

### Connection flow

```
Host browser         Server (roomManager.ts)       Guest browser
     │                        │                         │
     │── create_room ────────▶│                         │
     │◀─ room_created (ABCDE)─│                         │
     │                        │◀─── join_room (ABCDE) ──│
     │◀─ guest_joined ────────│──── room_joined ───────▶│
     │── start_game ─────────▶│                         │
     │◀─ game_start (host) ───│──── game_start (guest) ▶│
     │                        │                         │
     │── select_world ────────▶                         │
     │                        │──── world_selected ────▶│
     │   (Both generate identical level from same seed) │
     │                        │                         │
     │           [game running: ~30 times/second]       │
     │── game_state (x,y,vx,vy) ──────────────────────▶│
     │                        │◀─── player_input (jump,duck) ──│
     │◀─ remote_input ────────│                         │
```

### Input synchronization

Every 33 milliseconds (about 30 times per second):

- **Host** sends its current position and velocity to the server, which forwards it to the guest. The guest receives this as a `game_state` message and teleports the player rectangle to the host's coordinates.
- **Guest** sends its current button states (left, right, jump, duck) to the server, which forwards them to the host. The host reads these as `remoteInputs` and applies them in `getEffectiveInputs()`.

```typescript
// In GameScene.ts — host sends position every 33ms
if (onlineManager.role === "host") {
  onlineManager.sendPosition(
    this.player.x, this.player.y,
    this.player.body.velocity.x, this.player.body.velocity.y
  );
}
```

```typescript
// In GameScene.ts — guest applies received position
onlineManager.on("game_state", (msg) => {
  this.player.setPosition(msg.state.x, msg.state.y);
  this.player.body.setVelocity(msg.state.vx, msg.state.vy);
});
```

### The server's role

The server (`roomManager.ts`) is a **relay**: it receives messages from one WebSocket connection and forwards them to the other. It stores no game state — just a `rooms` map of active rooms with their two connections.

```typescript
// roomManager.ts — relay player_input from one side to the other
case "player_input": {
  const target = room.host === ws ? room.guest : room.host;
  send(target, { type: "remote_input", inputs: msg.inputs });
}
```

The server also handles:
- **Ping/pong**: sends a `ping` to each connected client every 30 seconds; terminates connections that don't respond
- **Disconnect notifications**: if one player leaves, the other gets a `partner_disconnected` message
- **World selection**: only the host can call `select_world`; the server validates the world index and seed, then forwards to the guest

### Events relayed through the server

| Client sends | Server forwards as | Purpose |
|---|---|---|
| `player_input` | `remote_input` | Guest → host: button states |
| `game_state` | `game_state` | Host → guest: player position |
| `select_world` | `world_selected` | Host → guest: which level to load |
| `player_death` | `remote_death` | Either → other: trigger death |
| `player_pause` | `remote_pause` | Either → other: pause the game |
| `player_unpause` | `remote_unpause` | Either → other: resume |

---

## 7. The backend server

The server lives in `artifacts/api-server/src/`.

**`index.ts`** starts the HTTP server and attaches the WebSocket server to it.

**`app.ts`** configures the Express middleware stack: request logging (Pino), CORS headers, JSON body parsing.

**`middleware/auth.ts`** implements JWT (JSON Web Token) authentication. When a user logs in, the server creates a signed token containing `{ userId, username }` with a 30-day expiry. The client stores this token and sends it as `Authorization: Bearer <token>` on every subsequent request. The `authRequired` middleware verifies the token before allowing access to protected endpoints.

> **Security note**: The fallback for `JWT_SECRET` (`process.env.DATABASE_URL?.slice(0, 32)`) is a problem — if `JWT_SECRET` is not set in production, the signing key is derived from the database URL, which is less secure. The `JWT_SECRET` environment variable should always be set explicitly.

**`routes/auth.ts`** handles:
- `POST /api/auth/register` — validates username (3–20 chars, alphanumeric+underscore, no profanity), hashes the password with bcrypt, inserts user
- `POST /api/auth/login` — looks up user, compares password hash, returns a JWT
- `GET /api/auth/me` — returns the current user's info (requires auth)

**`routes/user.ts`** handles the 5 data-sync endpoints (all require auth):
- `GET /api/user/data` — returns coins, progress, accessories, stats in one call
- `POST /api/user/coins` — sets the coin balance
- `POST /api/user/progress` — upserts world completion data
- `POST /api/user/accessories` — upserts owned/equipped accessories
- `POST /api/user/stats` — updates lifetime stats using `GREATEST()` so values can only increase

---

## 8. The database layer

### Schema

The database (`lib/db/src/schema/users.ts`) has 4 tables:

**`users`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (auto) | Primary key |
| `username` | text | Unique, stored lowercase |
| `password_hash` | text | bcrypt hash |
| `coins` | integer | Current coin balance |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**`user_progress`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (auto) | |
| `user_id` | integer | Foreign key → users |
| `world_index` | integer | 0–3 |
| `completed` | boolean | |
| `deaths` | integer | Cumulative death count |

Unique index on `(user_id, world_index)`.

**`user_accessories`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (auto) | |
| `user_id` | integer | Foreign key → users |
| `accessory_id` | text | e.g. "tophat", "crown" |
| `equipped` | boolean | |

Unique index on `(user_id, accessory_id)`.

**`user_stats`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | integer (auto) | |
| `user_id` | integer | Foreign key → users (unique) |
| `total_coins_earned` | integer | |
| `total_coins_spent` | integer | |
| `total_deaths` | integer | |
| `total_level_completions` | integer | |

### ORM: Drizzle

The project uses [Drizzle ORM](https://orm.drizzle.team/), a TypeScript-first SQL library. Queries look like:

```typescript
// Fetch a user by username
const [user] = await db.select()
  .from(usersTable)
  .where(eq(usersTable.username, username.toLowerCase()))
  .limit(1);
```

Drizzle generates SQL from TypeScript, providing type safety (typos in column names are caught at compile time).

### What the database covers

- User identity (registration, login, bcrypt password hashing)
- Coin balance persistence across devices
- World completion and per-world death counts
- Accessory ownership and equip state
- Lifetime gameplay statistics

### What the database does not cover

- **No leaderboards**: there is no way to compare scores between users
- **No coin transaction log**: only the current balance is stored; there is no audit trail of how coins were earned or spent
- **No rate limiting**: the login and register endpoints have no throttling, making brute-force password attempts straightforward
- **No email or password recovery**: if a user forgets their password, the account is unrecoverable
- **No server-side coin validation**: the client tells the server "I now have X coins", and the server accepts it. A user who modifies their browser's network requests could set any coin value
- **No cascade deletes**: if a user record is deleted, the child rows in `user_progress`, `user_accessories`, and `user_stats` are orphaned (no `ON DELETE CASCADE`)
- **Room state is in-memory only**: active multiplayer rooms exist only in the server's RAM; a server restart ends all active games with no recovery

---

## 9. Infrastructure and tooling

The project uses **pnpm workspaces** (`pnpm-workspace.yaml`): a monorepo setup where `artifacts/double-vision`, `artifacts/api-server`, and `lib/db` are separate packages that can share code.

**Vite** is the build tool for the frontend. It compiles TypeScript, bundles modules, and serves the game during development with hot-reload.

**`docker/`** contains a Dockerfile and helper scripts for running the full stack locally (PostgreSQL + server + frontend) inside a container, which avoids "works on my machine" problems.

---

## 10. Recommendations for improvement

### Code organization

**1. Split `GameScene.ts` into smaller files.**
At ~1,200 lines, `GameScene.ts` handles too many things: rendering, physics, hazards, input, online sync, UI, coins, checkpoints. Each major concern (hazards per world, HUD, online sync logic) should be its own module. Large files are hard to read, hard to test, and cause merge conflicts in collaborative development.

**2. Move world-specific hazard logic out of `GameScene.ts`.**
The lava spray, wave, quicksand, vine, tank, and bullet systems are each handled inline in `update()`. They could be separate classes (e.g., `LavaHazards`, `BeachHazards`) initialized once and called with `hazards.update(delta)`.

### Security

**3. Set `JWT_SECRET` as a required environment variable with no fallback.**
The current code falls back to a slice of `DATABASE_URL`, which is weaker than a properly random secret. The server should refuse to start if `JWT_SECRET` is not set.

**4. Add rate limiting to auth endpoints.**
Without throttling, the `/api/auth/login` endpoint can be attacked with many password guesses per second. A simple in-memory rate limiter (e.g., `express-rate-limit`) would mitigate this.

**5. Validate coins server-side.**
The server accepts whatever coin value the client sends. A more secure approach is to have the server track coin-earning events (e.g., level completion) and compute the balance from those records, rather than trusting the client's total.

### Multiplayer

**6. Add interpolation for the guest's view.**
Currently the guest applies the host's position by teleporting the player rectangle (`setPosition()`). If a network packet is delayed or dropped, the character will visibly jump. Smoothly interpolating toward the target position would reduce this jitter.

**7. Add reconnection logic.**
If the WebSocket connection drops temporarily, the game shows a disconnect overlay with no way to recover. A reconnect-with-backoff loop would improve robustness, especially on mobile networks.

### Data model

**8. Add `ON DELETE CASCADE` to foreign keys.**
If a user is deleted from `users`, the rows in `user_progress`, `user_accessories`, and `user_stats` remain orphaned. Adding cascade deletes keeps the database consistent.

**9. Replace localStorage migrations with proper DB migrations.**
`AccessoryManager.ts` contains `migrateV1` and `migrateV2` functions that patch old localStorage data when the data model changed. This pattern does not scale: for users who skip a version or clear their storage, data may be lost or misread. Schema changes should be handled as tracked database migrations (the Drizzle toolchain supports this with `drizzle-kit`).

### Testing

**10. Add tests.**
There are no automated tests of any kind. Even basic unit tests for the level generator (e.g., "generated level always has a valid path") and API endpoints (e.g., "register rejects duplicate usernames") would catch regressions quickly and make the codebase safer to change.

### Minor items

- The `AccessoryManager` contains a `drawSingleAccessory` function and a private `_drawAccessoryById` function that do essentially the same thing. One of them can be removed.
- `GameSettings.ts` exposes both `getSettings()` (returns the whole object) and individual getters (`isMusicEnabled()`, `getBgColor()`, etc.). Picking one convention would be simpler.
- The `tracks/` directory has only two music tracks (`DefaultTrack.ts`, `LavaTrack.ts`). Adding tracks for the Beach and Jungle worlds would complete the set.
