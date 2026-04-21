#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${PORT:-5173}"
API_PORT="${API_PORT:-5000}"
PG_PORT="${PG_PORT:-5432}"
BASE_PATH="${BASE_PATH:-/}"
PGDATA="/pgdata"

export PORT="$APP_PORT"
export BASE_PATH
export PGUSER="${PGUSER:-$(whoami)}"

# Add PostgreSQL binaries to PATH
PG_BIN=$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -rV | head -1)
[ -n "$PG_BIN" ] && export PATH="$PG_BIN:$PATH"

# Fix ownership of ~/.claude when volume-mounted (Docker creates it as root)
if [ -d "$HOME/.claude" ] && [ "$(stat -c %u "$HOME/.claude" 2>/dev/null)" != "$(id -u)" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$HOME/.claude" 2>/dev/null || true
fi

# ============================================================
# 1. Start PostgreSQL
# ============================================================
start_postgres() {
  if pg_isready -h /tmp -p "$PG_PORT" >/dev/null 2>&1; then
    export DATABASE_URL="postgresql://localhost:$PG_PORT/doublevision?host=/tmp"
    return
  fi

  sudo chown "$(id -u):$(id -g)" "$PGDATA" 2>/dev/null || true

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL..."
    initdb -D "$PGDATA" --no-locale --encoding=UTF8
  fi

  echo "Starting PostgreSQL on port $PG_PORT..."
  pg_ctl -D "$PGDATA" -o "-p $PG_PORT -h localhost -k /tmp" -l /tmp/pg.log start

  for i in $(seq 1 20); do
    pg_isready -h /tmp -p "$PG_PORT" >/dev/null 2>&1 && break
    sleep 0.5
  done

  if ! pg_isready -h /tmp -p "$PG_PORT" >/dev/null 2>&1; then
    echo "PostgreSQL failed to start:" >&2
    cat /tmp/pg.log >&2
    exit 1
  fi

  # Create database if it doesn't exist
  createdb -h /tmp -p "$PG_PORT" doublevision 2>/dev/null || true

  export DATABASE_URL="postgresql://localhost:$PG_PORT/doublevision?host=/tmp"
}

# ============================================================
# 2. Install dependencies if missing or stale
# ============================================================
# Detect the rollup native binary required for this container's arch.
# Used to decide when a stale node_modules volume needs to be re-resolved.
rollup_native_pkg() {
  case "$(uname -m)" in
    aarch64|arm64) echo "@rollup/rollup-linux-arm64-gnu" ;;
    x86_64)        echo "@rollup/rollup-linux-x64-gnu" ;;
    *)             echo "" ;;
  esac
}

needs_fresh_install() {
  # Fresh volume: nothing installed yet.
  [ ! -d node_modules/.pnpm ] && return 0

  # Stale volume: native binary for this arch is missing (e.g. volume was
  # populated on a different host arch, or pnpm-workspace.yaml overrides
  # stripped it before).
  local pkg
  pkg="$(rollup_native_pkg)"
  if [ -n "$pkg" ] && [ ! -d "node_modules/$pkg" ]; then
    return 0
  fi

  return 1
}

install_deps() {
  sudo chown "$(id -u):$(id -g)" /workspace/node_modules 2>/dev/null || true

  cd /workspace

  # pnpm-workspace.yaml has overrides that exclude all platform-specific native
  # binaries except linux-x64 (Replit's arch). When installing on a different
  # arch (e.g. arm64 under Docker on Apple Silicon), strip the overrides so pnpm
  # resolves for this container's architecture. Originals are restored after
  # install to avoid dirtying the bind-mounted source tree.
  if needs_fresh_install; then
    echo "Installing dependencies (fresh, stripping platform overrides)..."
    cp pnpm-workspace.yaml /tmp/pnpm-workspace-original.yaml
    cp pnpm-lock.yaml /tmp/pnpm-lock-original.yaml

    python3 -c "
text = open('pnpm-workspace.yaml').read()
lines = []
in_overrides = False
for line in text.splitlines():
    if line.rstrip() == 'overrides:':
        in_overrides = True
        lines.append(line)
        continue
    if in_overrides:
        if line.startswith('  '):
            if '\"-\"' in line or \"'-'\" in line:
                continue
            lines.append(line)
        else:
            in_overrides = False
            lines.append(line)
    else:
        lines.append(line)
open('pnpm-workspace.yaml','w').write('\n'.join(lines)+'\n')
"
    rm -f pnpm-lock.yaml
    pnpm install --no-frozen-lockfile

    cp /tmp/pnpm-workspace-original.yaml pnpm-workspace.yaml
    cp /tmp/pnpm-lock-original.yaml pnpm-lock.yaml
  else
    pnpm install
  fi
}

# ============================================================
# 3. Push database schema
# ============================================================
push_schema() {
  echo "Pushing database schema..."
  cd /workspace
  pnpm --filter @workspace/db run push 2>&1 || {
    echo "Warning: schema push failed, retrying with --force..."
    DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db exec drizzle-kit push --force --config ./drizzle.config.ts
  }
}

# ============================================================
# 4. Build and start API server (background)
# ============================================================
start_api() {
  echo "Building API server..."
  cd /workspace
  pnpm --filter @workspace/api-server run build

  echo "Starting API server on port $API_PORT..."
  PORT="$API_PORT" DATABASE_URL="$DATABASE_URL" \
    node --enable-source-maps /workspace/artifacts/api-server/dist/index.mjs &
  API_PID=$!

  for i in $(seq 1 30); do
    if curl -sf "http://localhost:$API_PORT/api/healthz" >/dev/null 2>&1; then
      echo "API server ready."
      return
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      echo "API server crashed." >&2
      exit 1
    fi
    sleep 1
  done

  echo "API server did not become ready within 30s." >&2
  exit 1
}

# ============================================================
# 5. Dispatch
# ============================================================
case "${1:-dev}" in
  dev)
    install_deps
    start_postgres
    push_schema
    start_api
    cd /workspace
    exec pnpm --filter @workspace/double-vision run dev
    ;;
  build)
    install_deps
    cd /workspace
    exec pnpm run build
    ;;
  claude)
    shift
    install_deps
    start_postgres
    push_schema
    start_api
    cd /workspace
    exec claude "$@"
    ;;
  bash)
    install_deps
    start_postgres
    push_schema
    exec bash
    ;;
  *)
    exec "$@"
    ;;
esac
