FROM node:22-bookworm-slim

# === Layer 1: System packages ===
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl sudo ca-certificates \
    procps make python3 \
    && rm -rf /var/lib/apt/lists/*

# === Layer 2: pnpm ===
ENV COREPACK_ENABLE_AUTO_PIN=0
RUN corepack enable && corepack prepare pnpm@latest --activate

# === Layer 3: Agent user matching host UID ===
ARG USER_UID=1000
RUN if [ "$USER_UID" != "1000" ]; then \
      useradd -m -u "$USER_UID" agent; \
    else \
      usermod -l agent -d /home/agent -m node 2>/dev/null || \
      useradd -m -u 1000 agent 2>/dev/null || true; \
    fi \
    && echo "agent ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/agent \
    && chmod 0440 /etc/sudoers.d/agent

# === Layer 4: Working directory ===
RUN mkdir -p /workspace && chown "$USER_UID":"$USER_UID" /workspace 2>/dev/null || true

COPY entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER agent
WORKDIR /workspace
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dev"]
