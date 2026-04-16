PORT ?= 5173
BASE_PATH ?= /

.PHONY: install dev docker-build docker-restart docker-clean-restart docker-logs docker-shell docker-claude docker-stop

install:
	pnpm install

dev:
	PORT=$(PORT) BASE_PATH=$(BASE_PATH) pnpm --filter @workspace/double-vision run dev

docker-build:
	bash docker/build.sh

docker-restart:
	bash docker/restart.sh

docker-clean-restart:
	bash docker/restart.sh --clean

docker-logs:
	@. .env.docker && docker logs -f "$$DOCKER_CONTAINER_NAME"

docker-shell:
	@. .env.docker && docker exec -it "$$DOCKER_CONTAINER_NAME" bash

docker-claude:
	@. .env.docker && docker exec -it "$$DOCKER_CONTAINER_NAME" claude

docker-stop:
	@. .env.docker && docker rm -f "$$DOCKER_CONTAINER_NAME"
