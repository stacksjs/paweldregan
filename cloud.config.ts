import type { CloudConfig } from '@stacksjs/ts-cloud'

const slug = 'paweldregan'
const domain = 'paweldregan.com'

export default {
  project: {
    name: 'Paweł Dregan',
    slug,
    region: 'us-east-1',
  },

  // Both services run on the same EC2 box, each as its own systemd unit.
  // Caddy (installed separately, see post-deploy step) terminates TLS on
  // :443 and splits traffic: /api/* → :3008, /* → :4173.
  sites: {
    frontend: {
      root: './dist',
      // Copy serve-static.ts into dist/ so it ships alongside the built
      // assets. `bun run build` produces dist/; the cp makes the static
      // server self-contained inside the deploy root.
      build: 'bun run build && cp serve-static.ts dist/',
      start: 'bun serve-static.ts',
      port: 4173,
      domain,
      env: {
        NODE_ENV: 'production',
        PORT: '4173',
      },
    },

    api: {
      root: '.',
      start: 'bun run start:api',
      port: 3008,
      domain,
      // Caddy routes anything under /api/* to this site's port; the
      // frontend (no explicit `path`) acts as the catch-all.
      path: '/api/*',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        APP_NAME: 'paweldregan',
        APP_URL: `https://${domain}`,
        PORT: '3008',
        DB_CONNECTION: 'sqlite',
        // ⚠️ Secrets (APP_KEY, STRIPE_SECRET_KEY, MAIL_PASSWORD, etc.)
        // should be added to SSM Parameter Store and pulled at deploy
        // time — do NOT paste them here once this file is committed.
      },
    },
  },

  infrastructure: {
    compute: {
      runtime: 'bun',
      runtimeVersion: '1.3.0',
      size: 't3.small',
      disk: { size: 20 },
      systemPackages: ['sqlite'],
      allowSsh: false,
    },
  },

  environments: {
    production: {
      type: 'production',
      domain,
    },
  },
} satisfies CloudConfig
