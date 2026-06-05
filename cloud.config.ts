import type { CloudConfig } from '@stacksjs/ts-cloud'

const slug = 'paweldregan'
const apiDomain = 'api.paweldregan.com'

// Postgres runs co-hosted on the same EC2 box (Forge-style), listening on
// loopback only. The app connects over 127.0.0.1:5432 via trust auth (no
// password — pg_hba allows loopback only, 5432 is closed in the security
// group). Data lives in /var/lib/pgsql/data, OUTSIDE the deploy dir, so it
// survives redeploys. This matches local dev (postgres, empty password).

export default {
  project: {
    name: 'Paweł Dregan',
    slug,
    // us-west-2, not us-east-1: the shared `stacks` account's us-east-1
    // vCPU budget is fully consumed by other projects' instances. us-west-2
    // has the same quota (1 vCPU) but zero usage, so a 1-vCPU t2.small fits.
    region: 'us-west-2',
  },

  // The Bun API runs as a systemd service on a single EC2 box (bun-direct,
  // no Docker). Caddy fronts it on api.paweldregan.com with automatic TLS.
  // The frontend stays on its existing S3+CloudFront deploy (paweldregan.com).
  sites: {
    api: {
      root: '.',
      // Host node_modules carry macOS native binaries (keytar, *-darwin
      // prebuilds) that won't run on Linux — ship source only and install
      // fresh on the box in preStart. Also drop dev caches + the frontend build.
      exclude: ['node_modules', '.git', 'pantry', 'dist', '.stacks', 'cloudformation', 'bin', 'database/*.sqlite*'],
      // Run inside /var/www/api after extraction + .env write, before the
      // service starts. Install Linux deps, then apply the Postgres migration
      // SQL files directly via psql. We bypass `buddy migrate` here because its
      // generation step is unreliable (see stacksjs/stacks#1930); the .sql
      // files use CREATE TABLE/INDEX IF NOT EXISTS, so re-applying is idempotent.
      preStart: [
        'bun install',
        // Dedup bun-query-builder to a SINGLE instance. The workspace packages
        // (@stacksjs/orm, query-builder, database) each install a nested copy;
        // with multiple copies, setConfig() (one instance) never reaches the
        // model executor (another instance) and every model query silently
        // falls back to in-memory SQLite. Removing the nested copies makes them
        // all resolve the root 0.1.25 (overrides pin), where setConfig writes
        // the same `config5` the executor reads. See stacksjs/bun-query-builder#1022.
        'find storage -type d -path "*/node_modules/bun-query-builder" -prune -exec rm -rf {} + 2>/dev/null || true',
        'for f in $(ls database/migrations/*.sql | grep -v "\\.down\\.sql" | sort); do echo "migrate $(basename "$f")"; psql -h 127.0.0.1 -U paweldregan -d paweldregan -f "$f" 2>&1 | tail -1; done',
      ],
      start: 'bun storage/framework/core/server/src/start.ts',
      port: 3008,
      domain: apiDomain,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        APP_NAME: 'paweldregan',
        APP_URL: 'https://paweldregan.com',
        PORT: '3008',
        // Co-hosted Postgres on loopback (trust auth, empty password — matches
        // local dev). Dialect is selected by DB_CONNECTION (config/query-builder.ts).
        DB_CONNECTION: 'postgres',
        DB_DIALECT: 'postgres',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_DATABASE: 'paweldregan',
        DB_USERNAME: 'paweldregan',
        DB_PASSWORD: '',
      },
    },
  },

  infrastructure: {
    compute: {
      runtime: 'bun',
      runtimeVersion: '1.3.0',
      size: 't2.small', // 1 vCPU / 2GB — fits the account's vCPU quota
      // Pinned: ts-cloud's AMI map returns a us-east-1 AMI regardless of
      // region. ts-cloud's userData uses `dnf`, so this MUST be Amazon
      // Linux 2023 (not Ubuntu) — current AL2023 x86_64 AMI for us-west-2.
      image: 'ami-029a761f237195c2c',
      disk: { size: 20 },
      // Postgres server + client for the co-hosted DB. (Affects fresh-box
      // userData; the current box was provisioned via SSM. The DB is set up
      // once out-of-band: initdb, loopback-trust pg_hba, role + database.)
      systemPackages: ['postgresql16-server', 'postgresql16'],
      allowSsh: false, // shell access via SSM Session Manager
    },
  },

  environments: {
    production: {
      type: 'production',
      domain: apiDomain,
    },
  },
} satisfies CloudConfig
