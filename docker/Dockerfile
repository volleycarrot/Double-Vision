FROM node:22-bookworm-slim

# === Layer 1: System packages ===
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl wget sudo ca-certificates locales \
    ripgrep fd-find jq tree make bubblewrap socat \
    python3 python3-pip \
    tmux procps file less util-linux vim-tiny htop bat \
    bash-completion lsof strace net-tools \
    postgresql postgresql-client \
    && sed -i 's/^# *en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# === Layer 1b: PostgreSQL trust auth for local connections ===
RUN PG_CONF=$(find /etc/postgresql -name postgresql.conf 2>/dev/null | head -1) && \
    PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1) && \
    if [ -n "$PG_CONF" ]; then \
      sed -i "s/^#listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF"; \
    fi && \
    if [ -n "$PG_HBA" ]; then \
      printf "local all all trust\nhost all all 127.0.0.1/32 trust\n" > "$PG_HBA"; \
    fi

# === Layer 2: pnpm + Claude Code ===
ENV COREPACK_ENABLE_AUTO_PIN=0
ENV CLAUDE_CODE_DISABLE_AUTO_UPDATE=1
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && npm install -g @anthropic-ai/claude-code

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

# === Layer 4: Working directory + symlinks ===
RUN mkdir -p /workspace /pgdata \
    && chown "$USER_UID":"$USER_UID" /workspace /pgdata 2>/dev/null || true
RUN ln -sf /usr/bin/batcat /usr/local/bin/bat \
    && ln -sf /opt/ateam/ateam-linux-amd64 /usr/local/bin/ateam

COPY entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER agent
RUN echo "alias ll='ls -alFh'" >> ~/.bashrc \
    && echo "alias bat='batcat'" >> ~/.bashrc
WORKDIR /workspace
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dev"]
