import { buildSite } from '../lib'
import { site } from '../site.config'

const result = await buildSite(site)
console.log(`\nBuilt ${result.pages.length} pages → ${result.outDir}/ in ${(result.durationMs / 1000).toFixed(1)}s`)
for (const path of result.pages) console.log(`  ${path}`)
