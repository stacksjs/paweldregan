import { existsSync } from 'node:fs'
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
const port = Number(process.env.PREVIEW_PORT ?? process.env.PORT ?? 4173)
const url = `http://localhost:${port}`

// Print the ready banner BEFORE Bun.serve binds. Printing after works
// most of the time, but `pantry run preview` (and npm-style runners
// generally) sometimes buffer the child's stdout until later events,
// which made the URL look like it never printed at all. Writing it
// up-front avoids that whole class of "is it running?" confusion.
const green = '\x1b[32m'
const bold = '\x1b[1m'
const dim = '\x1b[2m'
const reset = '\x1b[0m'
process.stdout.write(
  `\n  ${green}➜${reset}  ${bold}Preview${reset}:    ${green}${url}${reset}\n`
  + `  ${dim}➜  serving${reset}    ${dim}./dist/${reset}\n\n`,
)

Bun.serve({
  port,
  async fetch(req) {
    const reqUrl = new URL(req.url)
    let pathname = reqUrl.pathname

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
