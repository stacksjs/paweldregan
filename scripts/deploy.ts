import process from 'node:process'
import { deployStaticSiteWithExternalDns, invalidateCache, uploadStaticFiles } from '@stacksjs/ts-cloud'
import { site } from '../site.config'

const domain = new URL(site.url).hostname
const region = 'us-east-1'

// 1. Ensure infrastructure (S3 bucket, CloudFront, ACM cert) exists. DNS,
//    cert and CloudFront for paweldregan.com are already live, so we skip
//    DNS verification/record creation — no Porkbun credentials required.
//    NOTE: this step is infra-only; it does NOT upload the built files.
const result = await deployStaticSiteWithExternalDns({
  siteName: 'paweldregan',
  domain,
  skipDnsVerification: true,
  // Required by the type but unused when skipDnsVerification is true.
  dnsProvider: {
    provider: 'porkbun',
    apiKey: process.env.PORKBUN_API_KEY || '',
    secretKey: process.env.PORKBUN_SECRET_KEY || '',
  },
})

if (!result.success) {
  console.error(`\nInfrastructure step failed: ${result.message}`)
  process.exit(1)
}

// 2. Upload the freshly built files to S3 (only changed files are sent).
console.log('\nUploading built files...')
const upload = await uploadStaticFiles({
  sourceDir: 'dist',
  bucket: result.bucket,
  region,
})

if (upload.errors.length > 0) {
  console.error(`\nUpload errors:\n  ${upload.errors.join('\n  ')}`)
  process.exit(1)
}

// 3. Invalidate the CloudFront cache so the new content serves immediately.
if (result.distributionId) {
  console.log('Invalidating CloudFront cache...')
  await invalidateCache(result.distributionId)
}

console.log('\nDeployment complete!')
console.log(`  Bucket: ${result.bucket}`)
if (result.distributionDomain) console.log(`  CDN: ${result.distributionDomain}`)
console.log(`  Files uploaded: ${upload.uploaded}`)
console.log(`  Files unchanged: ${upload.skipped}`)
console.log(`\nLive: https://${domain}`)
