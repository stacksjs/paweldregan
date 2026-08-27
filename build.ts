import { buildStaticSite } from '@stacksjs/stx'
import { bundleAndInjectStores } from './scripts/bundle-stores'
import { verifyOgCards } from './scripts/generate-og'
import { site } from './config/site'

// Share cards are committed rather than drawn on every build: fifteen cards at
// roughly a second each would be thirty times this build. The trade only works
// if staleness is loud, so check the committed cards still match the copy
// before anything else runs. `bun run og` regenerates them.
await verifyOgCards()

// config/stx.ts (`root: 'resources'`) is picked up by stxPlugin itself as of
// @stacksjs/stx 0.2.233, so the build resolves components out of resources/
// with no help from here. Before that it did not, and seeding `defaultConfig`
// by hand was what stood in.
const result = await buildStaticSite(site)

// Post-build HTML fixups. See scripts/bundle-stores.ts.
await bundleAndInjectStores(result.outDir)

console.log(`\nBuilt ${result.pages.length} pages → ${result.outDir}/ in ${(result.durationMs / 1000).toFixed(1)}s`)
for (const path of result.pages) console.log(`  ${path}`)
