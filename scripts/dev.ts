import { existsSync, statSync, watch } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { buildStaticSite } from '@stacksjs/stx'
import { site } from '../site.config'

// Why this isn't `stx-serve`: stx-serve skips the `applyTranslations`
// post-process pass that turns `{t:key}` markers into real strings, so
// dev mode would render the literal tokens. buildStaticSite is fast
// enough (~200ms here) to rebuild on every change and serve dist/.

const distDir = './dist'
const port = Number(process.env.PORT ?? 3000)

let buildId = 0
let building: Promise<void> | null = null
let queued = false

async function rebuild() {
  if (building) { queued = true; return }
  building = (async () => {
    const start = performance.now()
    try {
      await buildStaticSite({ ...site, noClean: true })
      buildId++
      console.log(`  rebuilt #${buildId} in ${(performance.now() - start).toFixed(0)}ms`)
      pushReload()
    }
    catch (err) {
      console.error('build failed:', err)
    }
  })()
  await building
  building = null
  if (queued) { queued = false; void rebuild() }
}

console.log('Initial build…')
await buildStaticSite(site)
buildId = 1

// Why the extension filter: buildStaticSite copies public/ assets into
// dist/ on every build, and macOS fs.watch reports a `change` on the
// SOURCE files when that happens (probably APFS clone semantics).
// Without filtering, each rebuild retriggers itself — the page reloads
// mid-render in a tight loop. We only care about source-edit
// extensions; binary assets handled on next manual restart.
const watched = ['pages', 'layouts', 'components', 'translations', 'public']
const sourceExt = /\.(stx|tsx?|m?js|json|ya?ml|css|html|md|svg)$/i
let debounce: ReturnType<typeof setTimeout> | null = null
for (const p of watched) {
  if (!existsSync(p)) continue
  const opts = statSync(p).isDirectory() ? { recursive: true as const } : {}
  watch(p, opts, (_event, filename) => {
    if (filename && !sourceExt.test(filename)) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => void rebuild(), 80)
  })
}

const sseControllers = new Set<ReadableStreamDefaultController<Uint8Array>>()

function pushReload() {
  const data = new TextEncoder().encode(`data: ${buildId}\n\n`)
  for (const c of sseControllers) {
    try { c.enqueue(data) }
    catch { sseControllers.delete(c) }
  }
}

const reloadSnippet = `<script>(function(){var s=new EventSource('/__dev/reload');var seen=null;s.onmessage=function(e){if(seen===null){seen=e.data;return}if(e.data!==seen){location.reload()}};})();</script>`

Bun.serve({
  port,
  idleTimeout: 0, // SSE connections sit idle between rebuilds — don't reap them
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/__dev/reload') {
      let ctrl: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          ctrl = controller
          sseControllers.add(controller)
          controller.enqueue(new TextEncoder().encode(`data: ${buildId}\n\n`))
        },
        cancel() { sseControllers.delete(ctrl) },
      })
      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        },
      })
    }

    if (building) await building

    let pathname = url.pathname
    if (pathname === '/') pathname = '/index.html'
    else if (!pathname.includes('.')) {
      const dirIndex = Bun.file(join(distDir, pathname, 'index.html'))
      if (await dirIndex.exists()) pathname = join(pathname, 'index.html')
      else pathname = `${pathname}.html`
    }

    const file = Bun.file(join(distDir, pathname))
    if (await file.exists()) {
      if (pathname.endsWith('.html')) {
        const html = await file.text()
        const injected = html.includes('</body>')
          ? html.replace('</body>', `${reloadSnippet}</body>`)
          : html + reloadSnippet
        return new Response(injected, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }
      return new Response(file)
    }

    const notFound = Bun.file(join(distDir, '404.html'))
    if (await notFound.exists()) return new Response(notFound, { status: 404 })
    return new Response('Not Found', { status: 404 })
  },
})

console.log(`Dev server ready at http://localhost:${port}`)
