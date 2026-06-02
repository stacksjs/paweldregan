/**
 * `buddy build:server` for paweldregan — builds the API container.
 *
 * The framework's `build/server.ts` action `cd`s into
 * `storage/framework/cloud/` and runs `bun build.ts`. Upstream ships
 * the wiring but not the file, so this is the paweldregan-side
 * implementation: a Docker image of the API server, ready to push to
 * the ECS Fargate task referenced by `cloud/serverless.ts`.
 *
 * Build context is the repo ROOT (Dockerfile copies the whole
 * workspace so `bun install` can resolve `workspace:*`). The
 * Dockerfile lives at `cloud/Dockerfile` and runs
 * `bun storage/framework/core/server/src/start.ts` as its entrypoint
 * — same command the local `start:api` npm script uses.
 */
import process from 'node:process'
import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const imageTag = process.env.IMAGE_TAG ?? 'paweldregan-api:latest'
const dockerfile = projectPath('cloud/Dockerfile')
const buildContext = projectPath()

log.info(`Building API image \`${imageTag}\``)
log.info(`  Dockerfile: ${dockerfile}`)
log.info(`  Context:    ${buildContext}`)

$.cwd(buildContext)

// `--pull` keeps the base image (oven/bun) current — silent staleness
// on a long-lived CI runner is a frequent cause of "works locally,
// breaks in prod" Bun version drift.
try {
  await $`docker build --pull -f ${dockerfile} -t ${imageTag} ${buildContext}`
}
catch (error) {
  log.error(`docker build failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

log.success(`Built ${imageTag}`)
