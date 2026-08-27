import { buildStaticSite } from '@stacksjs/stx'
import { bundleAndInjectStores } from './scripts/bundle-stores'
import { site } from './config/site'

const result = await buildStaticSite(site)

// Bundle resources/stores/*.ts and inject into every HTML page's
// <head>. See scripts/bundle-stores.ts for why this is a separate
// post-build step rather than something the framework handles.
await bundleAndInjectStores(result.outDir)

console.log(`\nBuilt ${result.pages.length} pages → ${result.outDir}/ in ${(result.durationMs / 1000).toFixed(1)}s`)
for (const path of result.pages) console.log(`  ${path}`)
