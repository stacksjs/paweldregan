// Post-build fixups for dist/ HTML files.
//
// History: this script used to ALSO bundle resources/stores/*.ts and
// inject them into <head> because we thought `buildStaticSite()`
// skipped the store-loader. It doesn't — the framework emits its own
// `<script data-stx-stores>` IIFE per page that calls
// `defineStore(...)` for every file under resources/stores/. Our
// post-injection was duplicating that work AND producing a broken
// bundle (Bun.build's CJS interop leaked `__` references into the
// browser). Removed.
//
// What remains is the one fixup the framework currently does need
// help with: `<!DOCTYPE html>` ends up below the framework's
// `<!-- stx-layout: … -->` comment and signals-runtime <script>,
// which puts the page into Quirks Mode. We hoist the doctype back
// to the top of every dist HTML file as a single sweep after each
// build.
//
// Kept the filename so existing build.ts / serve.ts imports still
// work; future fixups (asset hashing, OG image inlining, etc.) can
// pile on here.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function bundleAndInjectStores(distDir: string = './dist'): Promise<void> {
  if (!existsSync(distDir)) return
  for (const file of walkHtml(distDir)) {
    const html = readFileSync(file, 'utf8')
    const next = hoistDoctype(html)
    if (next !== html) writeFileSync(file, next)
  }
}

/**
 * Move `<!DOCTYPE html>` back to the top of the document.
 *
 * The framework emits its signals-runtime <script> (and an
 * `<!-- stx-layout: … -->` marker) ABOVE the doctype, which puts
 * the page into Quirks Mode in the browser. Doctype MUST be the
 * first non-whitespace content. Pull it to the front; everything
 * else slides one position down.
 */
function hoistDoctype(html: string): string {
  const m = html.match(/<!DOCTYPE\s+html[^>]*>/i)
  if (!m) return html
  if (html.trimStart().startsWith(m[0])) return html
  const without = html.replace(m[0], '')
  return `${m[0]}\n${without.replace(/^\s*\n/, '')}`
}

function* walkHtml(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield * walkHtml(full)
    }
    else if (entry.endsWith('.html')) {
      yield full
    }
  }
}
