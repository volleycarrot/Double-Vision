# Double Vision

A 2-player co-op 2D platformer built with Phaser 3. One player controls jump/duck, the other controls movement.

## Controls

- **Player 1**: W (jump), S (duck)
- **Player 2**: Left/Right arrows (move)
- **Pause**: Escape or P

## Worlds

4 themed worlds (all unlocked from start), each with unique hazards and mechanics:
Lava, Beach, Jungle, War Zone.

5 checkpoints per level, progress saved to localStorage.

## Tech Stack

- Phaser 3 (v3.90) with Arcade Physics
- TypeScript 5.9
- Vite dev server and bundler
- pnpm workspaces monorepo

## Running Locally

### Prerequisites

- Node.js 22+
- pnpm

### Native

```sh
make install
make dev
```

The game runs at http://localhost:5173.

### Docker

Requires Docker.

```sh
make docker-build
make docker-restart
```

The game runs at http://localhost:5173.

Other Docker targets:

| Target | Description |
|---|---|
| `make docker-clean-restart` | Restart with fresh node_modules |
| `make docker-logs` | Tail container logs |
| `make docker-shell` | Shell into running container |
| `make docker-stop` | Stop and remove container |

## Project Structure

```
artifacts/double-vision/    Game (Phaser 3 + Vite)
  src/main.ts               Phaser config and boot
  src/scenes/               TitleScene, GameScene, WinScene, WarningScene
  src/worlds/               WorldConfig, LevelGenerator, per-world backgrounds
  src/ProgressManager.ts    localStorage persistence
  src/PlayerConfig.ts       Player configuration
artifacts/api-server/       Express 5 API server
lib/                        Shared libraries (api-zod, api-spec, api-client-react, db)
docker/                     Dockerfile and helper scripts
```

## Build

```sh
pnpm run build       # typecheck + build all packages
pnpm run typecheck   # typecheck only
```
