import process from 'node:process'
import { existsSync } from 'node:fs'
import { cloudAdapter } from '@stx/deploy'

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('Missing AWS credentials. Populate .env or export them in your shell.')
  process.exit(1)
}

if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
  console.error('Missing PORKBUN_API_KEY / PORKBUN_SECRET_KEY in .env.')
  process.exit(1)
}

if (!existsSync('./dist/index.html')) {
  console.error('dist/ is empty. Run `bun run build` first.')
  process.exit(1)
}

const adapter = cloudAdapter({
  siteName: 'paweldregan',
  region: process.env.AWS_REGION ?? 'us-east-1',
  domain: 'paweldregan.com',
  defaultRootObject: 'index.html',
  errorDocument: '404.html',
  cacheControl: 'max-age=31536000, public',
  cleanBucket: false,
  dnsProvider: { provider: 'porkbun' },
  tags: {
    Project: 'paweldregan',
    Environment: 'production',
  },
  onProgress(stage, detail) {
    console.log(`[${stage}] ${detail ?? ''}`)
  },
})

console.log('Deploying paweldregan.com to AWS via Porkbun DNS...\n')

const result = await adapter.deploy!({
  outputDir: './dist',
  production: true,
})

if (!result.success) {
  console.error('\nDeployment failed:')
  for (const line of result.logs) console.error(`  ${line}`)
  process.exit(1)
}

console.log('\nDeployment complete!')
for (const line of result.logs) console.log(`  ${line}`)
if (result.url) console.log(`\nLive: ${result.url}`)
console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`)
