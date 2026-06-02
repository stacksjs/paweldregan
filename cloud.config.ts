import type { CloudConfig } from '@stacksjs/ts-cloud'

const slug = 'paweldregan'
const apiDomain = 'api.paweldregan.com'

// SQLite lives OUTSIDE the deploy dir (/var/www/api is wiped except .env on
// every release) so submissions survive redeploys. preStart creates the dir.
const dbPath = '/var/lib/paweldregan/paweldregan.sqlite'

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
      // service starts. Install Linux deps, ensure the persistent DB dir
      // exists, then migrate (idempotent — creates tables on first deploy).
      preStart: [
        'bun install',
        `mkdir -p ${dbPath.replace(/\/[^/]+$/, '')}`,
        'bun storage/framework/core/buddy/src/cli.ts migrate',
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
        DB_CONNECTION: 'sqlite',
        DB_DIALECT: 'sqlite',
        DB_DATABASE_PATH: dbPath,
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
      systemPackages: ['sqlite'],
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
