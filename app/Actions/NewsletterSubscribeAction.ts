import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { HttpError } from '@stacksjs/error-handling'
import { sendNewsletterWelcome } from '../Mail/NewsletterWelcome'
// `@stacksjs/orm` only re-exports models that appear in its hardcoded
// FRAMEWORK_MODEL_MANIFEST (User, Subscriber, Campaign, …). Userland
// models like ours are pulled in by path — the model's default export
// from `defineModel` already carries `.where()` / `.create()` etc.
import Newsletter from '../Models/Newsletter'

// Body shape the action accepts. Mirrors what resources/stores/subscribe.ts
// POSTs from the client. Optional fields fall back to defaults below
// rather than failing validation — `source` defaults to 'footer' and
// `locale` to 'en' so future surfaces (a hero CTA, a /coaching
// callout) don't have to remember to send them.
interface SubscribePayload {
  email: string
  source?: string
  locale?: string
}

interface NewsletterRow {
  id: number | string
  uuid?: string
  email: string
}

const TAG = '[NewsletterSubscribeAction]'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_LOCALES = new Set(['en', 'de', 'pl'])

export default new Action({
  name: 'NewsletterSubscribeAction',
  description: 'Save a newsletter signup to the newsletters table.',
  method: 'POST',

  async handle(request: RequestInstance<SubscribePayload>) {
    const startedAt = Date.now()
    console.log(`${TAG} ── request received`)

    const email = request.get('email') as unknown
    const sourceRaw = request.get('source', 'footer') as unknown
    const localeRaw = request.get('locale', 'en') as unknown

    const source = typeof sourceRaw === 'string' && sourceRaw ? sourceRaw : 'footer'
    const locale = typeof localeRaw === 'string' && ALLOWED_LOCALES.has(localeRaw) ? localeRaw : 'en'

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      console.log(`${TAG} ✗ invalid email — throwing 422`)
      throw new HttpError(422, 'A valid email is required')
    }

    const normalized = email.trim().toLowerCase()

    // Dedupe — repeat signups return 422 so the client's `isInvalid`
    // branch lights up rather than the generic `isError`. Avoids
    // hitting the DB unique-index violation (would surface as a 500).
    let existing: NewsletterRow | null = null
    try {
      existing = (await Newsletter.where('email', normalized).first()) as NewsletterRow | null
    }
    catch (err: unknown) {
      console.log(`${TAG} ✗ Newsletter.where().first() threw:`, err instanceof Error ? err.message : err)
      throw err
    }

    if (existing) {
      console.log(`${TAG} ✗ already subscribed — throwing 422`)
      throw new HttpError(422, 'Already subscribed')
    }

    let row: NewsletterRow
    try {
      row = (await Newsletter.create({
        email: normalized,
        status: 'subscribed',
        locale,
        source: source.slice(0, 64), // matches the column's max
      })) as NewsletterRow
      console.log(`${TAG} ✓ Newsletter.create OK — id=${row.id} uuid=${row.uuid}`)
    }
    catch (err: unknown) {
      console.log(`${TAG} ✗ Newsletter.create threw:`, err instanceof Error ? err.message : err)
      throw err
    }

    // Welcome email — fire-and-forget. The subscriber row is the
    // source of truth; a slow or unreachable SMTP server shouldn't
    // tie up the POST response. Errors are logged but never thrown.
    void sendNewsletterWelcome({ to: normalized, locale })
      .then(() => console.log(`${TAG} ✓ welcome email queued for ${normalized}`))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.log(`${TAG} ✗ welcome email failed for ${normalized}: ${message}`)
      })

    const ms = Date.now() - startedAt
    console.log(`${TAG} ── done in ${ms}ms`)
    return { success: true, newsletter: { id: row.id, uuid: row.uuid } }
  },
})
