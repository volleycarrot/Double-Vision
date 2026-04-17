#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.docker"

# Read existing .env.docker as defaults
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi
APP_PORT="${DOCKER_APP_PORT:-5173}"
API_PORT="${DOCKER_API_PORT:-5000}"
PG_PORT="${DOCKER_PG_PORT:-5432}"
CONTAINER_NAME="${DOCKER_CONTAINER_NAME:-$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')-docker}"
IMAGE_NAME="${DOCKER_IMAGE_NAME:-$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')-dev}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --app-port)  APP_PORT="$2"; shift 2 ;;
    --api-port)  API_PORT="$2"; shift 2 ;;
    --pg-port)   PG_PORT="$2"; shift 2 ;;
    --name)      CONTAINER_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: build.sh [--app-port PORT] [--api-port PORT] [--pg-port PORT] [--name NAME]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

HOST_UID="$(id -u)"

echo "Building Docker image: $IMAGE_NAME ..."
docker build \
  -f "$SCRIPT_DIR/Dockerfile" \
  --build-arg USER_UID="$HOST_UID" \
  -t "$IMAGE_NAME" \
  "$SCRIPT_DIR"

cat > "$ENV_FILE" <<EOF
DOCKER_APP_PORT=$APP_PORT
DOCKER_API_PORT=$API_PORT
DOCKER_PG_PORT=$PG_PORT
DOCKER_CONTAINER_NAME=$CONTAINER_NAME
DOCKER_IMAGE_NAME=$IMAGE_NAME
EOF

echo ""
echo "Build complete."
echo "  Image:  $IMAGE_NAME"
echo "  App:    localhost:$APP_PORT"
echo "  API:    localhost:$API_PORT (internal)"
echo "  PG:     localhost:$PG_PORT (internal)"
echo "  Config: $ENV_FILE"
echo ""
echo "Next: make docker-restart"
