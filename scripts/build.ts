import { Glob } from 'bun'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import stxPlugin from 'bun-plugin-stx'
import { injectCrosswindCSS } from '@stacksjs/stx'

const outdir = './dist'
rmSync(outdir, { recursive: true, force: true })

const glob = new Glob('pages/**/*.stx')
const entrypoints = await Array.fromAsync(glob.scan('.'))

console.log(`Building ${entrypoints.length} pages...`)
for (const file of entrypoints) console.log(`  ${file}`)

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [stxPlugin()],
  naming: { entry: '[name].[ext]' },
})

if (!result.success) {
  console.error('Build failed:')
  console.error(result.logs)
  process.exit(1)
}

const htmlOutputs = result.outputs.filter(o => o.path.endsWith('.html'))
console.log(`\nInjecting Crosswind CSS into ${htmlOutputs.length} pages...`)

for (const out of htmlOutputs) {
  const html = readFileSync(out.path, 'utf8')
  const withCss = await injectCrosswindCSS(html, process.cwd())
  writeFileSync(out.path, withCss)
}

const notFoundSrc = readFileSync(join(outdir, 'index.html'), 'utf8').replace(
  /<title>[^<]*<\/title>/,
  '<title>404 — Paweł Dregan</title>',
)
writeFileSync(join(outdir, '404.html'), notFoundSrc)

console.log(`\nBuilt ${result.outputs.length} files to ${outdir}/`)
for (const out of result.outputs) {
  const size = (out.size / 1024).toFixed(2)
  console.log(`  ${out.path} (${size} KB)`)
}
