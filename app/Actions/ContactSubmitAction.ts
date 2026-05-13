import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { HttpError } from '@stacksjs/error-handling'
import { sendContactNotification } from '../Mail/ContactNotification'
// See NewsletterSubscribeAction.ts for why userland models are
// pulled in by relative path instead of from '@stacksjs/orm'.
import Contact from '../Models/Contact'

interface ContactPayload {
  name: string
  email: string
  message: string
  locale?: string
}

interface ContactRow {
  id: number | string
  uuid?: string
}

const TAG = '[ContactSubmitAction]'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_LOCALES = new Set(['en', 'de', 'pl'])
const RATE_LIMIT_MS = 60_000

// In-process rate limit by IP. Good enough for a single-server
// deploy; swap for Redis (or whatever shared store the rest of the
// stack uses) once paweldregan.com runs on >1 instance.
const recentByIp = new Map<string, number>()

function clientIp(request: RequestInstance<ContactPayload>): string {
  const xff = request.headers.get('x-forwarded-for') ?? ''
  const real = request.headers.get('x-real-ip') ?? ''
  return (xff.split(',')[0]?.trim() || real || 'unknown')
}

export default new Action({
  name: 'ContactSubmitAction',
  description: 'Persist a contact-form submission and queue the notification email.',
  method: 'POST',

  async handle(request: RequestInstance<ContactPayload>) {
    const startedAt = Date.now()
    console.log(`${TAG} ── request received`)

    const nameRaw = request.get('name') as unknown
    const emailRaw = request.get('email') as unknown
    const messageRaw = request.get('message') as unknown
    const localeRaw = request.get('locale', 'en') as unknown

    const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
    const email = typeof emailRaw === 'string' ? emailRaw.trim() : ''
    const message = typeof messageRaw === 'string' ? messageRaw.trim() : ''
    const locale = typeof localeRaw === 'string' && ALLOWED_LOCALES.has(localeRaw) ? localeRaw : 'en'

    if (!name || !email || !message)
      throw new HttpError(422, 'name, email and message are required')
    if (name.length > 200 || email.length > 320 || message.length > 5000)
      throw new HttpError(422, 'one or more fields exceeds the allowed length')
    if (!EMAIL_REGEX.test(email))
      throw new HttpError(422, 'A valid email is required')

    const ip = clientIp(request)
    const last = recentByIp.get(ip) ?? 0
    if (Date.now() - last < RATE_LIMIT_MS) {
      console.log(`${TAG} ✗ rate-limited ip=${ip} — throwing 429`)
      throw new HttpError(429, 'Too many submissions, please try again in a minute')
    }

    let row: ContactRow
    try {
      // Use snake_case column names directly — the ORM doesn't
      // auto-translate camelCase model attributes to snake_case
      // columns on insert, so `ipAddress` would 500 with
      // "no column named ipAddress". Same reason `replied_at` will
      // need to be set this way when the admin reply flow lands.
      row = (await Contact.create({
        name,
        email: email.toLowerCase(),
        message,
        locale,
        ip_address: ip === 'unknown' ? null : ip,
        status: 'new',
      } as unknown as Parameters<typeof Contact.create>[0])) as ContactRow
      console.log(`${TAG} ✓ Contact.create OK — id=${row.id} uuid=${row.uuid}`)
    }
    catch (err: unknown) {
      console.log(`${TAG} ✗ Contact.create threw:`, err instanceof Error ? err.message : err)
      throw err
    }

    recentByIp.set(ip, Date.now())

    // Two emails per submission, fire-and-forget so a slow SMTP
    // server doesn't tie up the request: an internal notification to
    // hello@paweldregan.com (Pawel) and an auto-reply to the visitor.
    // See app/Mail/ContactNotification.ts for the wire details.
    void sendContactNotification({
      name,
      email: email.toLowerCase(),
      message,
      locale,
      ipAddress: ip === 'unknown' ? null : ip,
    })
      .then(() => console.log(`${TAG} ✓ notification + auto-reply queued for ${email}`))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.log(`${TAG} ✗ contact email send failed for ${email}: ${message}`)
      })

    const ms = Date.now() - startedAt
    console.log(`${TAG} ── done in ${ms}ms`)
    return { success: true, contact: { id: row.id, uuid: row.uuid } }
  },
})
