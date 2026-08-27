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
// What remains are the two head fixups the framework does not cover:
//
//  1. `<!DOCTYPE html>` ends up below the framework's
//     `<!-- stx-layout: … -->` comment and signals-runtime <script>,
//     which puts the page into Quirks Mode. We hoist it back to the
//     top of every dist HTML file.
//  2. `<meta name="robots" content="noindex">` for the pages listed in
//     `noindexPaths`. The framework's page meta has no robots field,
//     and `sitemap: false` alone does not keep a crawler out.
//
// A third fixup lived here until @stacksjs/stx 0.2.233: the per-locale
// `<meta name="stx-layout-group">`, which only stx's dev server used to
// stamp. The static build stamps it now.
//
// Kept the filename so existing build.ts / serve.ts imports still
// work; future fixups (asset hashing, OG image inlining, etc.) can
// pile on here.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { noindexPaths, site } from '../config/site'

export async function bundleAndInjectStores(distDir: string = './dist'): Promise<void> {
  if (!existsSync(distDir)) return
  const locales = site.i18n?.locales ?? []

  for (const file of walkHtml(distDir)) {
    const html = readFileSync(file, 'utf8')
    let next = hoistDoctype(html)
    if (isNoindex(file, distDir, locales)) next = stampNoindex(next)
    if (next !== html) writeFileSync(file, next)
  }
}

/**
 * Is this file one of the `noindexPaths` pages, in any locale?
 *
 * Compares on the base path, so `v2.html`, `de/v2.html` and `pl/v2.html`
 * are all matched by the single entry `/v2`.
 */
function isNoindex(file: string, distDir: string, locales: string[]): boolean {
  const segments = relative(distDir, file).split(sep)
  if (locales.includes(segments[0])) segments.shift()
  const base = `/${segments.join('/').replace(/(?:index)?\.html$/, '').replace(/\/$/, '')}`
  return noindexPaths.includes(base || '/')
}

/**
 * Keep a page out of search results.
 *
 * The site config's `sitemap: false` only withholds the page from the
 * sitemap; it does not tell a crawler that already found the URL to leave
 * it alone. The framework's page meta has no robots field, so the tag is
 * stamped here, alongside the other head fixups.
 */
function stampNoindex(html: string): string {
  if (/<meta name="robots"/i.test(html)) return html
  const meta = '<meta name="robots" content="noindex, follow">'
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${meta}\n</head>`)
  return html
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
