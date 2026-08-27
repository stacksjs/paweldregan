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
import { join, relative, sep } from 'node:path'
import { site } from '../config/site'

export async function bundleAndInjectStores(distDir: string = './dist'): Promise<void> {
  if (!existsSync(distDir)) return
  const locales = site.i18n?.locales ?? []
  const defaultLocale = site.i18n?.defaultLocale ?? locales[0]

  for (const file of walkHtml(distDir)) {
    const html = readFileSync(file, 'utf8')
    let next = hoistDoctype(html)
    next = stampLocaleLayoutGroup(next, localeOf(file, distDir, locales, defaultLocale))
    if (next !== html) writeFileSync(file, next)
  }
}

/**
 * Which locale's copy of a page is this file?
 *
 * Localized output lives under a locale-named directory (`de/about.html`);
 * the default locale keeps the bare path (`about.html`).
 */
function localeOf(
  file: string,
  distDir: string,
  locales: string[],
  defaultLocale: string | undefined,
): string | undefined {
  if (!defaultLocale) return undefined
  const [first] = relative(distDir, file).split(sep)
  return locales.includes(first) ? first : defaultLocale
}

/**
 * Tag each page with its locale for the SPA router's "layout group".
 *
 * The router swaps only the container (`<main>`) on a same-group navigation,
 * so `<nav>` and `<footer>` keep the markup of whichever page loaded first.
 * That is wrong for every cross-locale hop: the chrome carries translated
 * labels and `/de/`-prefixed hrefs that the build already resolved for the
 * destination. A differing group tells the router to swap the whole body
 * instead — still client-side, no reload — which brings the chrome along.
 *
 * The framework's dev server stamps this; its static build does not (fixed
 * upstream in stx, not yet released). Until that lands, the built site
 * translated `<main>` on a language switch and left the nav in the previous
 * language. Written only when absent, so it is a no-op once stx ships it.
 */
function stampLocaleLayoutGroup(html: string, locale: string | undefined): string {
  if (!locale || /<meta name="stx-layout-group"/i.test(html)) return html
  const meta = `<meta name="stx-layout-group" content="i18n:${locale}">`
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
