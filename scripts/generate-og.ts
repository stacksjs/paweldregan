/**
 * Draw one share card per page per locale, with ts-images.
 *
 * What the site shipped before this: the raw page photograph as og:image. Those
 * are portrait and square crops (about.jpg is 1440x1919), and the card slot is
 * 1.91:1, so every share was a hard centre-crop of a vertical photo with no
 * words on it. A card that says what the page is survives being reposted and
 * shown at thumbnail size; a cropped photo does not.
 *
 * Run with `bun run og`. The cards are committed rather than built on every
 * `bun run build`: a card takes about a second to draw and there are fifteen of
 * them, which is thirty times the current build. `verifyOgCards` guards the
 * trade — the build fails if a card is missing or its copy has moved on, so the
 * saving never turns into silent drift.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { generateSocialCard, loadFont } from 'ts-images'
import { ogCards, ogCardPath, type OgCard } from '../config/og'
import { site } from '../config/site'

const FONT_DIR = 'resources/assets/fonts'
const OUT_DIR = 'public/images/og'
const MANIFEST = join(OUT_DIR, 'manifest.json')

/** Off-white rather than #fff, matching the site's own type colour. */
const INK = { r: 250, g: 250, b: 250 }
/**
 * The site is strictly monochrome, so the eyebrow is a dimmed white rather than
 * ts-images' default orange accent, which would be the only colour on the page
 * and would not belong to the brand.
 */
const ACCENT = { r: 250, g: 250, b: 250, a: 0.62 }
const MUTED = { r: 250, g: 250, b: 250, a: 0.78 }

type Dict = Record<string, string>

/** Flatten a nested translation file to the dotted keys the card list uses. */
function flatten(value: unknown, prefix = '', out: Dict = {}): Dict {
  if (!value || typeof value !== 'object') return out
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

async function loadTranslations(locale: string): Promise<Dict> {
  const dir = site.i18n?.translationsDir ?? 'resources/translations'
  return flatten(JSON.parse(await readFile(join(dir as string, `${locale}.json`), 'utf8')))
}

/**
 * The strings a card is drawn from.
 *
 * Falls back to the default locale per key rather than per file, matching how
 * the framework resolves `{t:...}`: a locale missing one string still gets a
 * complete card.
 */
function copyFor(card: OgCard, strings: Dict, fallback: Dict) {
  const at = (key: string) => strings[key] ?? fallback[key] ?? ''
  return {
    eyebrow: at(card.eyebrowKey),
    headline: card.headlineKeys.map(at).filter(Boolean).join(' '),
    title: at(card.titleKey),
    description: at(card.descriptionKey),
  }
}

/**
 * Fingerprint of everything a card is drawn from.
 *
 * Copy, photograph and layout constants all go in, so editing a translation or
 * swapping a photo invalidates the card the same way changing this file does.
 */
async function fingerprint(card: OgCard, copy: ReturnType<typeof copyFor>): Promise<string> {
  const photo = await readFile(join('public', card.image))
  return createHash('sha256')
    .update(JSON.stringify({ ...copy, slug: card.slug, version: 1 }))
    .update(photo)
    .digest('hex')
    .slice(0, 16)
}

interface Manifest {
  cards: Record<string, string>
}

async function readManifest(): Promise<Manifest> {
  if (!existsSync(MANIFEST)) return { cards: {} }
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8')) as Manifest
  }
  catch {
    return { cards: {} }
  }
}

/** Every card the site should have, with the fingerprint of its inputs. */
async function expectedCards(): Promise<Map<string, { card: OgCard, locale: string, copy: ReturnType<typeof copyFor>, hash: string }>> {
  const locales = site.i18n?.locales ?? ['en']
  const defaultLocale = site.i18n?.defaultLocale ?? locales[0]
  const fallback = await loadTranslations(defaultLocale)

  const out = new Map<string, { card: OgCard, locale: string, copy: ReturnType<typeof copyFor>, hash: string }>()
  for (const locale of locales) {
    const strings = locale === defaultLocale ? fallback : await loadTranslations(locale)
    for (const card of ogCards) {
      const copy = copyFor(card, strings, fallback)
      out.set(ogCardPath(card.slug, locale), { card, locale, copy, hash: await fingerprint(card, copy) })
    }
  }
  return out
}

/**
 * The title and description each page carries in each locale.
 *
 * The same strings the cards are drawn from, so the head and the picture in it
 * cannot say different things. Shaped `[locale][slug]` for the post-build pass,
 * which walks files rather than cards.
 */
export async function localeMetaCopy(): Promise<Record<string, Record<string, { title: string, description: string }>>> {
  const locales = site.i18n?.locales ?? ['en']
  const defaultLocale = site.i18n?.defaultLocale ?? locales[0]
  const fallback = await loadTranslations(defaultLocale)

  const out: Record<string, Record<string, { title: string, description: string }>> = {}
  for (const locale of locales) {
    const strings = locale === defaultLocale ? fallback : await loadTranslations(locale)
    out[locale] = {}
    for (const card of ogCards) {
      const { title, description } = copyFor(card, strings, fallback)
      out[locale][card.slug] = { title, description }
    }
  }
  return out
}

export async function generateOgCards(): Promise<string[]> {
  const bytes = async (name: string) => new Uint8Array(await readFile(join(FONT_DIR, name)))
  // Bebas Neue is the site's display face and carries the headline; Inter sets
  // everything small. Both are static instances on purpose — ts-images draws a
  // variable font's default master only, so a variable Inter would silently
  // come out Regular wherever SemiBold was asked for.
  const titleFont = loadFont(await bytes('BebasNeue-Regular.ttf'))
  const bodyFont = loadFont(await bytes('Inter-SemiBold.ttf'))

  await rm(OUT_DIR, { recursive: true, force: true })

  const expected = await expectedCards()
  const manifest: Manifest = { cards: {} }
  const written: string[] = []

  for (const [url, { card, copy, hash }] of expected) {
    const out = join('public', url.replace(/^\//, ''))
    await mkdir(dirname(out), { recursive: true })

    await generateSocialCard(out, {
      background: join('public', card.image),
      brand: site.name.toUpperCase(),
      eyebrow: copy.eyebrow.toUpperCase(),
      title: copy.headline,
      subtitle: copy.description,
      titleFont,
      bodyFont,
      color: INK,
      accent: ACCENT,
      mutedColor: MUTED,
      // 1200x630 is the slot Facebook, LinkedIn and Slack render, and the one
      // Twitter's summary_large_image crops from most gracefully.
      width: 1200,
      height: 630,
      titleLines: 2,
      // The descriptions run to about 140 characters, which is three lines at
      // this size. Two would cut the last clause mid-word.
      subtitleLines: 3,
      quality: 82,
    })

    manifest.cards[url] = hash
    written.push(url)
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  return written
}

/**
 * Fail the build when the committed cards no longer match the copy.
 *
 * Cheap: it hashes the same inputs the generator does and compares, so it costs
 * a few file reads rather than the fifteen seconds of drawing.
 */
export async function verifyOgCards(): Promise<void> {
  const expected = await expectedCards()
  const manifest = await readManifest()
  const problems: string[] = []

  for (const [url, { hash }] of expected) {
    if (!existsSync(join('public', url.replace(/^\//, '')))) {
      problems.push(`missing: ${url}`)
      continue
    }
    if (manifest.cards[url] !== hash) problems.push(`stale: ${url}`)
  }
  for (const url of Object.keys(manifest.cards)) {
    if (!expected.has(url)) problems.push(`orphaned: ${url}`)
  }

  if (problems.length > 0) {
    throw new Error(
      `Share cards are out of date:\n  ${problems.join('\n  ')}\n\nRun \`bun run og\` and commit the result.`,
    )
  }
}

if (import.meta.main) {
  const written = await generateOgCards()
  console.log(`Generated ${written.length} share cards → ${OUT_DIR}/`)
  for (const url of written) console.log(`  ${url}`)
  process.exit(0)
}
