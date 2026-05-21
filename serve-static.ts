// Production static file server for the built frontend.
// Counterpart to preview.ts but stripped to prod-only behavior:
//   - Serves from the current working directory (not ./dist)
//   - No /api/* proxy — Caddy handles that split externally
//   - No browser auto-open, no banner
//
// Deploy-time layout: ts-cloud extracts `site.root: './dist'` into
// /var/www/frontend/, then systemd runs `bun serve-static.ts` with
// that as the cwd. So `.` here resolves to the dist contents.

import { join } from 'node:path'
import process from 'node:process'

const port = Number(process.env.PORT) || 4173

Bun.serve({
  port,
  async fetch(req) {
    let pathname = new URL(req.url).pathname

    if (pathname === '/') {
      pathname = '/index.html'
    }
    else if (!pathname.includes('.')) {
      // Try directory-style (/de → /de/index.html) first, then flat
      // (/about → /about.html). Mirrors S3+CloudFront's index-document
      // behavior for prefixed paths.
      const dirIndex = Bun.file(join('.', pathname, 'index.html'))
      if (await dirIndex.exists()) return new Response(dirIndex)
      pathname = `${pathname}.html`
    }

    const file = Bun.file(join('.', pathname))
    if (await file.exists()) return new Response(file)

    const notFound = Bun.file('./404.html')
    if (await notFound.exists()) return new Response(notFound, { status: 404 })
    return new Response('Not Found', { status: 404 })
  },
})

console.log(`[serve-static] listening on :${port}`)
