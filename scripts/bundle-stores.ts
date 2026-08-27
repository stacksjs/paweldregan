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
import { ogCardPath, ogCards } from '../config/og'
import { localeMetaCopy } from './generate-og'

export async function bundleAndInjectStores(distDir: string = './dist'): Promise<void> {
  if (!existsSync(distDir)) return
  const locales = site.i18n?.locales ?? []
  const defaultLocale = site.i18n?.defaultLocale ?? locales[0] ?? 'en'
  const meta = await localeMetaCopy()

  for (const file of walkHtml(distDir)) {
    const html = readFileSync(file, 'utf8')
    const { locale, base } = pageIdentity(file, distDir, locales, defaultLocale)

    let next = hoistDoctype(html)
    if (noindexPaths.includes(base)) next = stampNoindex(next)
    next = localizeSocialMeta(next, base, locale, meta)

    if (next !== html) writeFileSync(file, next)
  }
}

/**
 * Which page, in which locale, is this file?
 *
 * Localized output lives under a locale-named directory (`de/about.html`); the
 * default locale keeps the bare path (`about.html`). The base path is what the
 * site config and the card list are keyed on, so `v2.html`, `de/v2.html` and
 * `pl/v2.html` all resolve to `/v2`.
 */
function pageIdentity(
  file: string,
  distDir: string,
  locales: string[],
  defaultLocale: string,
): { locale: string, base: string } {
  const segments = relative(distDir, file).split(sep)
  const locale = locales.includes(segments[0]) ? segments.shift()! : defaultLocale
  const base = `/${segments.join('/').replace(/(?:index)?\.html$/, '').replace(/\/$/, '')}`
  return { locale, base: base || '/' }
}

/**
 * Give each locale its own title, description and share card.
 *
 * `site.pages` holds one title and one description per page, full stop, so the
 * framework wrote the English pair into every locale's head. The German page
 * declared `og:locale="de"` and then described itself in English, which is
 * worse than no translation at all: it tells the scraper the content is German
 * and hands it English to show.
 *
 * `og:image` is rewritten here too rather than left to the config, for the same
 * reason: one config value cannot name three cards. Absolute, because the
 * scrapers fetch the value as written.
 */
function localizeSocialMeta(
  html: string,
  base: string,
  locale: string,
  meta: Awaited<ReturnType<typeof localeMetaCopy>>,
): string {
  const card = ogCards.find(c => c.path === base)
  if (!card) return html

  const copy = meta[locale]?.[card.slug] ?? meta[site.i18n?.defaultLocale ?? 'en']?.[card.slug]
  if (!copy) return html

  const origin = site.url.replace(/\/$/, '')
  const image = `${origin}${ogCardPath(card.slug, locale)}`

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(copy.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/i, `$1${escapeAttr(copy.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/i, `$1${escapeAttr(copy.title)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/i, `$1${escapeAttr(copy.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/i, `$1${escapeAttr(copy.description)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/i, `$1${escapeAttr(copy.description)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/i, `$1${escapeAttr(image)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/i, `$1${escapeAttr(image)}$2`)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
