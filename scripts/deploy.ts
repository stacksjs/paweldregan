import process from 'node:process'
import { existsSync } from 'node:fs'
import { deployStaticSiteWithExternalDnsFull } from '@stacksjs/ts-cloud'

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

const start = Date.now()

const result = await deployStaticSiteWithExternalDnsFull({
  siteName: 'paweldregan',
  region: process.env.AWS_REGION ?? 'us-east-1',
  domain: 'paweldregan.com',
  defaultRootObject: 'index.html',
  errorDocument: '404.html',
  cacheControl: 'max-age=31536000, public',
  sourceDir: './dist',
  cleanBucket: false,
  dnsProvider: {
    provider: 'porkbun',
    apiKey: process.env.PORKBUN_API_KEY!,
    secretKey: process.env.PORKBUN_SECRET_KEY!,
  },
  tags: {
    Project: 'paweldregan',
    Environment: 'production',
  },
  onProgress(stage, detail) {
    console.log(`[${stage}] ${detail ?? ''}`)
  },
})

if (!result.success) {
  console.error(`\nDeployment failed: ${result.message}`)
  process.exit(1)
}

console.log('\nDeployment complete!')
if (result.stackName) console.log(`  Stack: ${result.stackName}`)
if (result.bucket) console.log(`  Bucket: ${result.bucket}`)
if (result.distributionDomain) console.log(`  CDN: ${result.distributionDomain}`)
if (result.domain) console.log(`  Domain: ${result.domain}`)
if (typeof result.filesUploaded === 'number') console.log(`  Files uploaded: ${result.filesUploaded}`)
if (typeof result.filesSkipped === 'number') console.log(`  Files unchanged: ${result.filesSkipped}`)
if (result.domain) console.log(`\nLive: https://${result.domain}`)
console.log(`Duration: ${((Date.now() - start) / 1000).toFixed(1)}s`)
