#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.docker"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.docker not found. Run 'make docker-build' first."
  exit 1
fi

CLEAN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean) CLEAN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

source "$ENV_FILE"

APP_PORT="${DOCKER_APP_PORT}"
CONTAINER="${DOCKER_CONTAINER_NAME}"
IMAGE="${DOCKER_IMAGE_NAME}"

DOCKER_RUN_ARGS=(
  -e "PORT=$APP_PORT"
  -e "BASE_PATH=/"
  -v "$PROJECT_DIR:/workspace"
  -v "${CONTAINER}-node-modules:/workspace/node_modules"
  -p "${APP_PORT}:${APP_PORT}"
)

docker rm -f "$CONTAINER" 2>/dev/null || true

if [ "$CLEAN" = true ]; then
  echo "Removing node_modules volume..."
  docker volume rm "${CONTAINER}-node-modules" 2>/dev/null || true
fi

docker run -d \
  --name "$CONTAINER" \
  "${DOCKER_RUN_ARGS[@]}" \
  "$IMAGE" \
  dev >/dev/null

echo "Waiting for dev server on port $APP_PORT..."

for i in $(seq 1 60); do
  # Container died
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    echo "Error: container '$CONTAINER' crashed." >&2
    echo "" >&2
    docker logs "$CONTAINER" 2>&1 | tail -30 >&2
    exit 1
  fi
  # Dev server is up
  if curl -sf "http://localhost:$APP_PORT" >/dev/null 2>&1; then
    echo "Container '$CONTAINER' started."
    echo "  App:  http://localhost:$APP_PORT"
    echo "  Logs: docker logs -f $CONTAINER"
    exit 0
  fi
  sleep 2
done

echo "Error: dev server did not become ready within 120s." >&2
echo "" >&2
docker logs "$CONTAINER" 2>&1 | tail -30 >&2
exit 1
