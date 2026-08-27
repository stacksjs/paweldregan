import type { CloudConfig as StacksCloudConfig } from '@stacksjs/types'
import type { CloudConfig } from '@stacksjs/ts-cloud'
import process from 'node:process'
import { env } from '@stacksjs/env'

const domain = 'paweldregan.com'
const apiPort = 3188

/**
 * Deploy the site and API as an isolated tenant on the shared Stacks Hetzner
 * box. Static files are served directly by rpx; the API owns only `/api`.
 */
export const tsCloud = {
  project: {
    name: 'Paweł Dregan',
    slug: 'paweldregan',
    region: 'fsn1',
  },
  stateDir: 'storage/cloud',
  cloud: {
    provider: 'hetzner',
    attachTo: 'stacks',
  },
  mode: 'server',
  environments: {
    production: {
      type: 'production',
      deployBranch: 'main',
      domain,
    },
  },
  infrastructure: {
    dns: {
      provider: 'porkbun',
    },
  },
  sites: {
    frontend: {
      root: 'dist',
      path: '/',
      domain,
      deploy: 'server',
      type: 'static',
      build: 'bun run build',
      pathRewriteStyle: 'flat',
    },
    api: {
      root: '.',
      path: '/api',
      domain,
      deploy: 'server',
      start: './buddy serve:api',
      port: apiPort,
      exclude: [
        'node_modules',
        '.git',
        'dist',
        'pantry',
        'storage/cloud',
        'database/*.sqlite*',
      ],
      preStart: [
        'bun install --frozen-lockfile',
        'for f in $(find database/migrations -maxdepth 1 -name "*.sql" ! -name "*.down.sql" | sort); do psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U paweldregan -d paweldregan -f "$f"; done',
      ],
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        APP_NAME: 'paweldregan',
        APP_URL: `https://${domain}`,
        PORT: String(apiPort),
        DB_CONNECTION: 'postgres',
        DB_DIALECT: 'postgres',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_DATABASE: 'paweldregan',
        DB_USERNAME: 'paweldregan',
        DB_PASSWORD: '',
        MAIL_MAILER: 'smtp',
        MAIL_DRIVER: 'smtp',
        MAIL_HOST: 'mail.stacksjs.com',
        MAIL_PORT: '587',
        MAIL_ENCRYPTION: 'tls',
        MAIL_USERNAME: `hello@${domain}`,
        MAIL_PASSWORD: process.env.MAIL_PASSWORD_HELLO || env.MAIL_PASSWORD || '',
        MAIL_FROM_NAME: 'Paweł Dregan',
        MAIL_FROM_ADDRESS: `hello@${domain}`,
        MAIL_DOMAIN: domain,
      },
    },
  },
} satisfies CloudConfig

const config: StacksCloudConfig = {}

export default config
