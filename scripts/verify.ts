/**
 * End-to-end smoke test for the deployed site.
 *
 * Runs in a real WebKit (or Chrome) engine via Bun.WebView so we can
 * confirm the runtime behavior — theme bootstrap, toggle, scroll-aware
 * nav, SPA navigation — actually works against the live deploy.
 *
 * Usage: bun run verify  (or: bun run verify https://staging.example)
 */
import process from 'node:process'

const baseUrl = process.argv[2] ?? 'https://paweldregan.com'

if (typeof Bun.WebView !== 'function') {
  console.error('Bun.WebView is not available in this Bun version — skipping E2E.')
  process.exit(0)
}

const view = new Bun.WebView({ width: 1280, height: 800, headless: true, dataStore: 'ephemeral' })
const evaluate = <T = unknown>(expr: string) => view.evaluate(expr) as Promise<T>
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

let failed = 0
function check(label: string, predicate: boolean, detail?: string): void {
  if (predicate) {
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  }
  else {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

await view.navigate(`${baseUrl}/?_=${Date.now()}`)
await wait(1200)

const initial = await evaluate<{
  htmlClass: string, guard: number, toggle: number, router: string,
  hasButton: boolean, hasNavbar: boolean,
}>(`(() => ({
  htmlClass: document.documentElement.className,
  guard: window.__stxThemeGuard,
  toggle: window.__stxThemeToggle,
  router: typeof window.__stxRouter,
  hasButton: !!document.getElementById('theme-toggle'),
  hasNavbar: !!document.getElementById('navbar'),
}))()`)

check('initial: <html class="dark">', initial.htmlClass.includes('dark'), `class="${initial.htmlClass}"`)
check('theme FOUC guard ran', initial.guard === 1)
check('theme toggle handler registered', initial.toggle === 1)
check('SPA router loaded', initial.router === 'object', `typeof __stxRouter = ${initial.router}`)
check('theme-toggle button present', initial.hasButton)

const darkNav = await evaluate<{ navBg: string, navHeight: number, themeColor: string | null }>(`(() => {
  const n = document.querySelector('nav')
  const tc = document.querySelector('meta[name="theme-color"]:not([media])')
  return {
    navBg: getComputedStyle(n).backgroundColor,
    navHeight: n.getBoundingClientRect().height,
    themeColor: tc ? tc.getAttribute('content') : null,
  }
})()`)
check('dark: nav bg is dark', /^rgba?\(0,\s*0,\s*0/.test(darkNav.navBg), darkNav.navBg)
check('dark: theme-color meta is dark', darkNav.themeColor === '#000000', `theme-color="${darkNav.themeColor}"`)

await view.click('#theme-toggle')
await wait(300)
const lightNav = await evaluate<{ htmlClass: string, storage: string, bodyBg: string, navBg: string, navHeight: number, themeColor: string | null }>(`(() => {
  const n = document.querySelector('nav')
  const tc = document.querySelector('meta[name="theme-color"]:not([media])')
  return {
    htmlClass: document.documentElement.className,
    storage: localStorage.getItem('theme'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    navBg: getComputedStyle(n).backgroundColor,
    navHeight: n.getBoundingClientRect().height,
    themeColor: tc ? tc.getAttribute('content') : null,
  }
})()`)
check('light: dark class removed from <html>', !lightNav.htmlClass.includes('dark'), `class="${lightNav.htmlClass}"`)
check('light: persisted to localStorage', lightNav.storage === 'light', `localStorage["theme"] = "${lightNav.storage}"`)
check('light: body bg is white', /^rgb\(255,\s*255,\s*255/.test(lightNav.bodyBg), lightNav.bodyBg)
check('light: nav bg is white-ish', /rgba?\(25[0-5],\s*25[0-5],\s*25[0-5]/.test(lightNav.navBg), lightNav.navBg)
check('light: theme-color meta is white', lightNav.themeColor === '#ffffff', `theme-color="${lightNav.themeColor}"`)
check('nav height stable across theme', darkNav.navHeight === lightNav.navHeight, `dark=${darkNav.navHeight}px, light=${lightNav.navHeight}px`)

// Plant a sentinel on window — survives SPA nav, gets wiped on full reload
await evaluate(`window.__stxNavSentinel = '${baseUrl}-' + Date.now()`)
const sentinelBefore = await evaluate<string>(`window.__stxNavSentinel`)
const t0 = Date.now()
await view.click('a[href="/about"]')
let landed = false
for (let i = 0; i < 50; i++) {
  await wait(100)
  const path = await evaluate<string>(`location.pathname`)
  if (path === '/about') { landed = true; break }
}
const navResult = await evaluate<{ url: string, title: string, htmlClass: string, sentinel: string | undefined }>(`(() => ({
  url: location.pathname,
  title: document.title,
  htmlClass: document.documentElement.className,
  sentinel: window.__stxNavSentinel,
}))()`)
check(`SPA navigated to /about`, landed, `${Date.now() - t0}ms`)
check('title swapped on SPA nav', navResult.title.includes('About'), navResult.title)
check('window sentinel survived — no full reload', navResult.sentinel === sentinelBefore, `before=${sentinelBefore} after=${navResult.sentinel ?? '<gone>'}`)
check('theme persisted across SPA nav', !navResult.htmlClass.includes('dark'), `class="${navResult.htmlClass}"`)

// Multi-hop SPA navigation — every nav link should stay client-side
for (const target of ['/races', '/coaching', '/']) {
  const before = await evaluate<string>(`window.__stxNavSentinel`)
  await view.click(`a[href="${target}"]`)
  for (let i = 0; i < 50; i++) {
    await wait(100)
    const path = await evaluate<string>(`location.pathname`)
    if (path === target) break
  }
  const after = await evaluate<{ url: string, title: string, sentinel: string | undefined }>(`(() => ({
    url: location.pathname,
    title: document.title,
    sentinel: window.__stxNavSentinel,
  }))()`)
  check(`SPA: nav → ${target}`, after.url === target && after.sentinel === before, `${after.title} (sentinel=${after.sentinel ?? '<gone>'})`)
}

view.close()

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
