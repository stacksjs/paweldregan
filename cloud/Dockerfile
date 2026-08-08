# Stacks API container (ECS Fargate target).
#
# Build context is the repo ROOT, not cloud/:
#   docker build -f cloud/Dockerfile -t paweldregan-api .
#
# Runs the production server entry (storage/framework/core/server/src/start.ts,
# the same one `bun run start:api` uses) as a long-lived Bun.serve process.
# Dependencies are installed INSIDE the container so native binaries match
# Linux — host node_modules (macOS) are excluded via .dockerignore.

FROM oven/bun:1.3.14 AS base
WORKDIR /usr/src/app

# 1. Install dependencies. We copy the full source first because this is a
#    Bun workspace (workspaces: storage/framework/**) — bun install needs the
#    workspace members' package.json files present to resolve `workspace:*`
#    deps, and most of them live under storage/framework.
COPY package.json bun.lock ./
COPY . .
RUN bun install

# Workaround for a broken upstream publish: @stacksjs/bun-router@0.0.14 shipped
# to npm without its dist/ (no code). bun pins that broken version inside some
# workspace packages' nested node_modules, which shadows the working 0.0.16
# hoisted at the root. Remove every nested copy so resolution falls through to
# the root. Safe because all consumers declare a range 0.0.16 satisfies.
RUN find storage -type d -path '*/node_modules/@stacksjs/bun-router' -prune -exec rm -rf {} + 2>/dev/null || true

# 2. curl is used by the container HEALTHCHECK (and later the ALB target check).
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# 3. Runtime config. config-production.ts reads PORT (defaults 3000); the ECS
#    task definition can override any of these at deploy time.
#    DB_DATABASE_PATH points at the mounted volume (Docker volume locally, EFS
#    on Fargate) so the SQLite file persists across deploys/restarts and lives
#    OUTSIDE the immutable image layer.
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=3000
ENV DB_CONNECTION=sqlite
ENV DB_DIALECT=sqlite
ENV DB_DATABASE_PATH=/data/paweldregan.sqlite
EXPOSE 3000/tcp

# Volume mount point for the persistent SQLite DB. Created + owned by `bun` so
# a fresh volume inherits writable ownership on first mount.
RUN mkdir -p /data && chown bun:bun /data
VOLUME ["/data"]

# 4. Health probe. NOTE: /health does not exist yet — the API currently only
#    serves /api. Using /api here so the local container check passes; we'll
#    add a dedicated /health route before wiring the ALB target group.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api" || exit 1

# 5. Source + deps were copied/installed as root, but we run as `bun`. Make
#    the runtime-writable paths owned by bun: the framework logger writes to
#    storage/logs, and SQLite / uploads also live under storage/.
# Source + deps were copied/installed as root, but we run as `bun`. Every dir
# the framework writes to at runtime must be bun-owned: storage/ (logs, etc.),
# .stacks/ (migration lock + markers — a non-writable .stacks makes `migrate`
# silently process.exit()), and .qb/ (model snapshot). The DB itself lives on
# the mounted /data volume (chowned above).
RUN mkdir -p storage/logs .stacks .qb && chown -R bun:bun storage database .stacks .qb

# 6. Make the entrypoint executable (migrate-on-start, then serve).
RUN chmod +x cloud/entrypoint.sh

# 7. Run as the non-root bun user.
USER bun

ENTRYPOINT ["./cloud/entrypoint.sh"]
