import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const distDir = './dist'
if (!existsSync(distDir)) {
  console.error('dist/ not found. Run `bun run build` first.')
  process.exit(1)
}

const port = Number(process.env.PORT ?? 4173)

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    let pathname = url.pathname

    if (pathname === '/') pathname = '/index.html'
    else if (!pathname.includes('.')) pathname = `${pathname}.html`

    const file = Bun.file(join(distDir, pathname))
    if (await file.exists()) return new Response(file)

    const notFound = Bun.file(join(distDir, '404.html'))
    if (await notFound.exists()) return new Response(notFound, { status: 404 })

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`Preview ready at http://localhost:${port}`)
