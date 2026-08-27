/**
 * DOM-level locale completeness check.
 *
 * Visits every page × locale combination in a real WebKit engine,
 * extracts the visible body text after JS settles, and flags anything
 * that still looks like the wrong language: untranslated stx tokens,
 * raw <strong> bleed-through, or English words on /de/ /pl/ pages.
 *
 * Usage: bun run scripts/check-locales.ts            — checks live
 *        bun run scripts/check-locales.ts http://...  — local preview
 */
import process from 'node:process'

const baseUrl = process.argv[2] ?? 'https://paweldregan.com'

const pages = ['/', '/v2', '/about', '/races', '/coaching']
const locales = [
  { code: 'en', prefix: '' },
  { code: 'de', prefix: '/de' },
  { code: 'pl', prefix: '/pl' },
]

// Words that, if they appear in body text on a non-English page,
// almost certainly mean a translation slipped through. Keep this
// to high-signal, low-frequency English words/phrases that don't
// share spelling with German or Polish equivalents and that aren't
// proper nouns (race names, brand names, units like "km").
const englishMarkers = [
  'Training Plans', 'Race Strategy', 'Initial Assessment', 'Plan Design',
  'Execute & Adapt', 'Race & Reflect', 'How It Works', 'HOW IT WORKS',
  'WHY TRAIN WITH ME', 'READY TO START', 'GO FURTHER', 'BORN TO RUN FAR',
  'THE RECORD', 'MILESTONES', 'PARTNERS', 'Personalized', 'Custom periodized',
  'Weekly structured training', 'Periodization', 'Course-specific pacing',
  'Pacing plans', 'Weekly check-ins', 'I have run', 'Every athlete',
  'I coach because', 'Send me a DM', 'DM on Instagram', 'Back to Home',
  'Error 404', 'This route', 'Based In', 'Specialty', 'Longest Finish',
  'Best Result', 'Next Race', 'Team Athlete', 'Apparel Partner', 'UTMB Races',
  'Longest Distance', 'Max Elevation', 'Finish Rate', 'Date', 'Race', 'Cat.',
  'Distance', 'Elevation', 'Time', 'Rank', 'Latest Achievement', 'Distance',
  'Finish Time', 'Overall', 'Upcoming', 'Follow the Journey', 'Learn More',
  'View Results', 'Get Started', 'Longest Race', 'Arctic Finish',
  'Ultra Runner · Coach · Husband',
]
// Same idea in the other direction — German words appearing on /pl
// or English pages would also be a sign of a swapped key.
const germanMarkers = [
  'Trainingspläne', 'Rennstrategie', 'Erstgespräch', 'WIE ES FUNKTIONIERT',
  'GEH WEITER', 'Wohnort', 'Spezialgebiet', 'Längste Distanz', 'Längster Zieleinlauf',
  'Längstes Rennen', 'Reise verfolgen', 'Mehr erfahren', 'BEREIT LOSZULEGEN',
  'GEBOREN ZUM WEITLAUFEN', 'Ultraläufer', 'Geh weiter',
]
// And Polish.
const polishMarkers = [
  'Plany treningowe', 'Strategia wyścigu', 'Rozmowa wstępna', 'JAK TO DZIAŁA',
  'IDŹ DALEJ', 'GOTOWY ZACZĄĆ', 'Skuteczność', 'Najdłuższy', 'Wyścigi UTMB',
  'Ultramaratończyk', 'Dowiedz się więcej',
]

if (typeof Bun.WebView !== 'function') {
  console.error('Bun.WebView is not available.')
  process.exit(1)
}

const view = new Bun.WebView({ width: 1280, height: 800, headless: true, dataStore: 'ephemeral' })
const evaluate = <T = unknown>(expr: string) => view.evaluate(expr) as Promise<T>
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

let issues = 0
function fail(label: string, detail?: string): void {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  issues++
}
function ok(label: string, detail?: string): void {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
}

for (const locale of locales) {
  for (const page of pages) {
    const url = `${baseUrl}${locale.prefix}${page === '/' ? '/' : page}`
    await view.navigate(url)
    await wait(600)

    const snapshot = await evaluate<{
      lang: string
      title: string
      bodyText: string
      tokenLeak: string | null
      rawStrongLeak: string | null
    }>(`(() => {
      const body = document.body;
      // Visible text — innerText respects display:none / scripts.
      const bodyText = body.innerText.replace(/\\s+/g, ' ').trim();
      const html = body.innerHTML;
      const tokenMatch = html.match(/\\{t:[a-zA-Z][\\w.-]*\\}/);
      const rawStrongMatch = html.match(/&lt;strong[^&]*&gt;/);
      return {
        lang: document.documentElement.lang,
        title: document.title,
        bodyText: bodyText,
        tokenLeak: tokenMatch ? tokenMatch[0] : null,
        rawStrongLeak: rawStrongMatch ? rawStrongMatch[0] : null,
      };
    })()`)

    const where = `${locale.code} ${url}`
    if (snapshot.lang !== locale.code)
      fail(`${where}: <html lang> mismatch`, `expected ${locale.code}, got ${snapshot.lang}`)

    if (snapshot.tokenLeak)
      fail(`${where}: unreplaced token in body`, snapshot.tokenLeak)

    if (snapshot.rawStrongLeak)
      fail(`${where}: HTML escaped into text (translation contains markup that got escaped)`, snapshot.rawStrongLeak)

    // Locale-specific contamination: words that wouldn't legitimately
    // appear on a translated page. Allowlist proper nouns globally —
    // race names, brand names, and units cross language boundaries.
    if (locale.code !== 'en') {
      for (const m of englishMarkers) {
        if (snapshot.bodyText.includes(m)) {
          fail(`${where}: English text leaked into ${locale.code} page`, `"${m}"`)
        }
      }
    }
    if (locale.code !== 'de') {
      for (const m of germanMarkers) {
        if (snapshot.bodyText.includes(m)) {
          fail(`${where}: German text leaked into ${locale.code} page`, `"${m}"`)
        }
      }
    }
    if (locale.code !== 'pl') {
      for (const m of polishMarkers) {
        if (snapshot.bodyText.includes(m)) {
          fail(`${where}: Polish text leaked into ${locale.code} page`, `"${m}"`)
        }
      }
    }

    // No leaks found for this page+locale → mark it clean.
    ok(`${where}: ${snapshot.title}`, `${snapshot.bodyText.length} chars body text`)
  }
}

view.close()

if (issues > 0) {
  console.error(`\n${issues} issue(s) across ${pages.length * locales.length} page-locale combos.`)
  process.exit(1)
}
console.log(`\nAll ${pages.length * locales.length} page-locale combos clean.`)
