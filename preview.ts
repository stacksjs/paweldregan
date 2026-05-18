import { existsSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const distDir = './dist'
if (!existsSync(distDir)) {
  console.error('dist/ not found. Run `bun run build` first.')
  process.exit(1)
}

// Read PREVIEW_PORT first so the preview server can run side-by-side
// with `./buddy dev --frontend` (which uses .env's `PORT=3000`).
// Falling back to `PORT` keeps the old behavior for anyone who only
// has the single var set; final default is Vite's familiar 4173.
const requestedPort = Number(process.env.PREVIEW_PORT ?? process.env.PORT ?? 4173)

// The dist's client code POSTs to relative paths like `/api/subscribe`
// (the canonical static-site setup — in prod CloudFront routes /api/*
// to the actual backend). Locally the preview server has to do the
// equivalent or every form submission 404s on its own origin. Mirrors
// the `proxyToApi` helper used by the dev server.
const apiPort = Number(process.env.PORT_API) || 3008
const apiBase = `http://127.0.0.1:${apiPort}`

async function proxyToApi(req: Request): Promise<Response> {
  const incoming = new URL(req.url)
  const target = `${apiBase}${incoming.pathname}${incoming.search}`
  const fwd = new Headers(req.headers)
  fwd.delete('host')
  fwd.delete('content-length')
  fwd.set('x-forwarded-host', incoming.host)
  fwd.set('x-forwarded-proto', incoming.protocol.replace(':', ''))
  const body = req.method === 'GET' || req.method === 'HEAD'
    ? undefined
    : await req.arrayBuffer()
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: fwd,
      body,
      redirect: 'manual',
    })
    const out = new Headers(upstream.headers)
    out.delete('content-length')
    out.delete('content-encoding')
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    })
  }
  catch {
    // Connection refused / API server not running. Return a 502 with
    // a hint so the dev sees what's missing instead of a generic
    // network error in devtools.
    return new Response(
      JSON.stringify({
        error: 'API server unreachable',
        hint: `preview proxies /api/* to ${apiBase} but nothing is listening there. Start the API dev server in another shell: \`./buddy dev --api\` (or set PORT_API to override the port).`,
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }
}

const server = Bun.serve({
  port: requestedPort,
  async fetch(req) {
    const reqUrl = new URL(req.url)
    let pathname = reqUrl.pathname

    // /api/** is owned by the backend, not the static bundle.
    if (pathname.startsWith('/api/'))
      return proxyToApi(req)

    if (pathname === '/') pathname = '/index.html'
    else if (!pathname.includes('.')) {
      // Try directory-style (/de → /de/index.html) first, then flat
      // (/about → /about.html). Mirrors S3+CloudFront's index-document
      // behavior for prefixed paths so the local preview matches prod.
      const dirIndex = Bun.file(join(distDir, pathname, 'index.html'))
      if (await dirIndex.exists()) return new Response(dirIndex)
      pathname = `${pathname}.html`
    }

    const file = Bun.file(join(distDir, pathname))
    if (await file.exists()) return new Response(file)

    const notFound = Bun.file(join(distDir, '404.html'))
    if (await notFound.exists()) return new Response(notFound, { status: 404 })

    return new Response('Not Found', { status: 404 })
  },
})

// `server.port` is the source of truth — if a future caller asks
// for port 0 Bun assigns a free port and reports it back here.
const url = `http://localhost:${server.port}`
const useColor = !process.env.NO_COLOR
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
const banner
  = `\n  ${c('32', '➜')}  ${c('1', 'Preview')}:    ${c('32', url)}\n`
  + `  ${c('2', '➜  serving')}    ${c('2', './dist/')}\n`
  + `  ${c('2', '➜  api proxy')}   ${c('2', `${apiBase}/api/*`)}\n`
  + `  ${c('2', '➜  press Ctrl+C to stop')}\n\n`

// Print the banner via a direct write(2) syscall (bypasses Bun's
// userspace buffer). This works when run directly as `bun preview.ts`
// or `bun run preview`, but is unfortunately swallowed when the
// script runs under `pantry run preview` — pantry pipes the child's
// stdio and only forwards on child exit, so a long-running server
// never gets its banner forwarded. The browser-open path below is
// the real source of truth for the URL in that case.
try { writeSync(1, banner) }
catch { try { writeSync(2, banner) } catch { /* give up */ } }

// Open the URL in the default browser unless the caller explicitly
// disables it (`PREVIEW_OPEN=0` / `NO_OPEN=1`) or no GUI is available
// (CI, ssh without -X, etc — heuristically signalled by absent DISPLAY
// on non-darwin / absent TERM_PROGRAM in pure-batch contexts).
// Auto-open is the actual UX of `preview` — the whole point of the
// script is to view the build in a browser — and it also gives us
// a way to surface the URL even when wrappers like pantry hide our
// stdout. Use Bun.spawn detached so the opener returns immediately
// and doesn't block the event loop.
const wantOpen = process.env.NO_OPEN !== '1'
  && process.env.PREVIEW_OPEN !== '0'
  && process.env.CI !== 'true'
if (wantOpen) {
  const opener = process.platform === 'darwin'
    ? ['open', url]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', url]
      : ['xdg-open', url]
  try {
    Bun.spawn(opener, { stdio: ['ignore', 'ignore', 'ignore'] })
  }
  catch {
    // Opener missing (rare; e.g. Linux without xdg-utils). Banner write
    // above is the only other channel — nothing else we can do.
  }
}
