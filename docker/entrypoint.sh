#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${PORT:-5173}"
BASE_PATH="${BASE_PATH:-/}"

export PORT="$APP_PORT"
export BASE_PATH

# ============================================================
# 1. Install dependencies if missing or stale
# ============================================================
install_deps() {
  # Named volumes may be created as root; fix ownership
  sudo chown "$(id -u):$(id -g)" /workspace/node_modules 2>/dev/null || true

  cd /workspace

  # pnpm-workspace.yaml has overrides that exclude all platform-specific native
  # binaries except linux-x64 (Replit's arch). Strip the overrides block from
  # both workspace config and lockfile so pnpm resolves for this container's
  # architecture. Originals are restored after install to avoid dirtying the
  # bind-mounted source tree.
  if [ ! -d node_modules/.pnpm ]; then
    echo "Installing dependencies (fresh)..."
    cp pnpm-workspace.yaml /tmp/pnpm-workspace-original.yaml
    cp pnpm-lock.yaml /tmp/pnpm-lock-original.yaml

    # Strip overrides from workspace config (keeps non-platform overrides like esbuild version)
    python3 -c "
text = open('pnpm-workspace.yaml').read()
# Remove lines that exclude platform-specific packages (value is '-')
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
                continue  # skip platform exclusion
            lines.append(line)
        else:
            in_overrides = False
            lines.append(line)
    else:
        lines.append(line)
open('pnpm-workspace.yaml','w').write('\n'.join(lines)+'\n')
"
    # Delete lockfile to force full resolution
    rm pnpm-lock.yaml

    pnpm install --no-frozen-lockfile

    cp /tmp/pnpm-workspace-original.yaml pnpm-workspace.yaml
    cp /tmp/pnpm-lock-original.yaml pnpm-lock.yaml
  else
    pnpm install
  fi
}

# ============================================================
# 2. Dispatch
# ============================================================
case "${1:-dev}" in
  dev)
    install_deps
    cd /workspace
    exec pnpm --filter @workspace/double-vision run dev
    ;;
  build)
    install_deps
    cd /workspace
    exec pnpm run build
    ;;
  *)
    exec "$@"
    ;;
esac
