#!/bin/sh
set -e

# Container entrypoint (option A: migrate-on-start).
#
# Runs pending DB migrations against the volume-mounted SQLite file
# (DB_DATABASE_PATH, e.g. /data/paweldregan.sqlite on an EFS/Docker volume),
# then execs the production server. Migrations are idempotent: first boot
# creates the tables, later boots are a no-op.
#
# We invoke the buddy CLI directly via `bun` rather than `./buddy` — the
# wrapper script bootstraps `pantry`, which isn't shipped in the image.
# `bun:sqlite` is built into Bun, so migrate needs no pantry tooling.

echo "[entrypoint] running migrations against ${DB_DATABASE_PATH:-database/stacks.sqlite} ..."
bun storage/framework/core/buddy/src/cli.ts migrate

echo "[entrypoint] starting server on port ${PORT:-3000} ..."
exec bun storage/framework/core/server/src/start.ts
