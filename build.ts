import { buildStaticSite, defaultConfig, loadStxConfig } from '@stacksjs/stx'
import { bundleAndInjectStores } from './scripts/bundle-stores'
import { site } from './config/site'

// Apply config/stx.ts to the build.
//
// `buildStaticSite` bundles pages through `stxPlugin()`, and the plugin
// builds its options as `{ ...defaultConfig, ...userOptions }` — it never
// calls `loadStxConfig`. Only the dev server does. So `bun run dev` honoured
// `root: 'resources'` while `bun run build` did not, and every `<Nav />` /
// `<Footer />` in the layout rendered as an "Error loading component" block
// in the shipped HTML. With no components left on the page there was no
// reactive syntax either, so the signals runtime was never injected — while
// the store bundle still was, which is what threw `defineStore is not
// defined` on the live site.
//
// Seeding `defaultConfig` is the same merge the plugin should be doing.
// Redundant (harmless) once stxPlugin loads the config itself — the project
// config it loads is this same object.
Object.assign(defaultConfig, await loadStxConfig(process.cwd()))

const result = await buildStaticSite(site)

// Post-build HTML fixups (doctype hoisting). See scripts/bundle-stores.ts.
await bundleAndInjectStores(result.outDir)

console.log(`\nBuilt ${result.pages.length} pages → ${result.outDir}/ in ${(result.durationMs / 1000).toFixed(1)}s`)
for (const path of result.pages) console.log(`  ${path}`)
