/**
 * Symlinks local stx + ts-cloud packages into ./node_modules.
 *
 * The packages in ~/Code/Tools/stx and ~/Code/Tools/ts-cloud declare their
 * inner deps via `workspace:*`, so we can't `bun install` them as `file:`
 * deps from outside the workspace. Instead, we symlink the already-built
 * packages so Bun can resolve them at runtime.
 *
 * Override the source paths via STX_PATH and TS_CLOUD_PATH env vars (used by CI).
 */
import { existsSync, mkdirSync, rmSync, symlinkSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const repoRoot = resolve(import.meta.dir, '..')
const stxRoot = process.env.STX_PATH
  ? resolve(process.env.STX_PATH)
  : resolve(repoRoot, '../../Tools/stx')
const tsCloudRoot = process.env.TS_CLOUD_PATH
  ? resolve(process.env.TS_CLOUD_PATH)
  : resolve(repoRoot, '../../Tools/ts-cloud')
const nodeModules = join(repoRoot, 'node_modules')

const links: Array<{ name: string, target: string }> = [
  { name: 'bun-plugin-stx', target: join(stxRoot, 'packages/bun-plugin') },
  { name: '@stacksjs/stx', target: join(stxRoot, 'packages/stx') },
  { name: '@stacksjs/ts-cloud', target: join(tsCloudRoot, 'packages/ts-cloud') },
  // stx's runtime deps that get dynamic-import'd from inside stx — Bun resolves
  // those from the build's CWD (paweldregan), not from the symlink target,
  // so we expose stx's already-installed copies here so they're discoverable.
  { name: '@cwcss/crosswind', target: join(stxRoot, 'node_modules/@cwcss/crosswind') },
]

let linked = 0
for (const link of links) {
  const linkPath = join(nodeModules, link.name)

  if (!existsSync(link.target)) {
    console.warn(`Skipping ${link.name}: target ${link.target} not found`)
    continue
  }

  mkdirSync(dirname(linkPath), { recursive: true })

  if (existsSync(linkPath)) {
    try {
      const stat = statSync(linkPath)
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        rmSync(linkPath, { recursive: true, force: true })
      }
    }
    catch {}
  }

  symlinkSync(link.target, linkPath, 'dir')
  linked++
  console.log(`linked ${link.name} -> ${link.target}`)
}

console.log(`\nLinked ${linked} package(s).`)
process.exit(0)
