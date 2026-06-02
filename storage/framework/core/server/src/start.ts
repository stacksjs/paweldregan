// MUST be first: sets __STACKS_BINARY_MODE__ + SKIP_CONFIG_LOADING before any
// other module evaluates. See preamble.ts for why this can't be inline here
// (ES import hoisting runs statement code after all imports).
import './preamble'

// Side-effect import: utils.ts in @stacksjs/database calls setConfig() on
// bun-query-builder at module load using DB_CONNECTION / DB_HOST / etc.
// env vars. Without this, bun-query-builder keeps its postgres+test_db
// default, the `new SQL('postgres://…/test_db')` call fails, and
// `getBunSql()` silently falls back to an in-memory SQLite — every model
// query then 500s with "no such table". Has to land BEFORE any model
// definition runs (models use `createModel` from bun-query-builder
// directly, not from `@stacksjs/database`, so they don't trigger this
// lazy module load themselves). Imported after ./preamble so the
// SKIP_CONFIG_LOADING flag is already set when its config loader fires.
import '@stacksjs/database'

// IMPORTANT: Import router package first to ensure it's initialized before routes
import { loadRoutes, serve } from '@stacksjs/router'
import config from './config-production'
import routeRegistry from '../../../../../app/Routes'

console.log('[START] Application starting...')
console.log('[START] Node version:', process.version)
console.log('[START] Working directory:', process.cwd())
console.log('[START] Environment:', process.env.APP_ENV || 'not set')

// Disable runtime config loading for compiled binary
process.env.SKIP_CONFIG_LOADING = 'true'

console.log('[START] Config loaded:', {
  port: config.server.port,
  host: config.server.host,
  appName: config.app.name,
  appUrl: config.app.url,
})

// Load routes from the registry, then ORM auto-routes, then start the server
console.log('[START] Loading routes from registry...')
loadRoutes(routeRegistry)
  .then(async () => {
    console.log('[START] Routes loaded successfully')

    // Load ORM auto-generated routes (model CRUD endpoints)
    // These run after manual routes so routeExists() correctly detects conflicts
    try {
      await import('../../orm/routes')
      console.log('[START] ORM routes loaded successfully')
    } catch (ormError) {
      console.warn('[START] ORM routes skipped:', ormError instanceof Error ? ormError.message : String(ormError))
    }

    console.log('[START] Calling serve()...')
    try {
      serve({
        port: config.server.port,
        host: config.server.host,
      } as any)
      console.log('[START] serve() called successfully')
    } catch (error) {
      console.error('[START] ERROR calling serve():', error)
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('[START] ERROR loading routes:', error)
    process.exit(1)
  })
