import process from 'node:process'
import { deploySite } from '@stacksjs/ts-cloud'
import { site } from '../site.config'

const result = await deploySite({
  siteName: 'paweldregan',
  domain: new URL(site.url).hostname,
})

if (!result.success) {
  console.error(`\nDeployment failed: ${result.message}`)
  process.exit(1)
}

console.log('\nDeployment complete!')
if (result.bucket) console.log(`  Bucket: ${result.bucket}`)
if (result.distributionDomain) console.log(`  CDN: ${result.distributionDomain}`)
if (typeof result.filesUploaded === 'number') console.log(`  Files uploaded: ${result.filesUploaded}`)
if (typeof result.filesSkipped === 'number') console.log(`  Files unchanged: ${result.filesSkipped}`)
if (result.url) console.log(`\nLive: ${result.url}`)
console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`)
