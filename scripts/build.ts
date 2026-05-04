import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildStaticSite } from '@stacksjs/stx'
import { site } from '../site.config'

const result = await buildStaticSite(site)

// Workaround for stx-router ≤ 0.2.32: the progress bar element is appended
// to <body>, which gets wiped on every SPA nav (container:'body'). Re-parent
// it to <html> after the router initializes so it survives body swaps.
// Will be removed once stx ships the fix.
const REPARENT_PROGRESS = `<script data-stx-reparent-progress="1">(function(){function reparent(){var el=document.getElementById('stx-router-progress');if(el&&el.parentElement!==document.documentElement)document.documentElement.appendChild(el)}function poll(){reparent();var n=0;var iv=setInterval(function(){reparent();if(++n>20)clearInterval(iv)},100)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',poll);else poll();})();</script>`

for (const file of readdirSync(result.outDir).filter(f => f.endsWith('.html'))) {
  const fullPath = join(result.outDir, file)
  let html = readFileSync(fullPath, 'utf8')
  if (!html.includes('data-stx-reparent-progress')) {
    html = html.replace(/<\/body>/i, `${REPARENT_PROGRESS}\n</body>`)
    writeFileSync(fullPath, html)
  }
}

console.log(`\nBuilt ${result.pages.length} pages → ${result.outDir}/ in ${(result.durationMs / 1000).toFixed(1)}s`)
for (const path of result.pages) console.log(`  ${path}`)
