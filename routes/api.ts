import { response, route } from '@stacksjs/router'

/**
 * paweldregan API routes. Mounted on the API dev server (port 3008)
 * and proxied through `serve.ts` (port 3000) for /api/** requests.
 *
 * Conventions used:
 * - `.skipCsrf()` because both endpoints are public, same-origin
 *   fetches from anonymous visitors — no session to derive a CSRF
 *   token from. Security boundaries are inside each Action
 *   (validation, dedupe, per-IP rate limit).
 * - `.name(...)` so we can `route('paweldregan.subscribe')` later
 *   without grepping for the path string.
 *
 * Add a middleware (auth, admin, etc.) here when you wire the
 * forthcoming admin dashboard:
 *   route.post('/admin/...').middleware('auth')
 *
 * @see https://docs.stacksjs.com/routing
 */

// Note: routes/api.ts auto-prefixes with `/api` (stacksjs/stacks#1835
// root cause 4 — `'api'` moved out of NO_PREFIX_KEYS in May 2026). So
// the paths declared here are *relative to `/api`* — `route.get('/')`
// mounts at `/api`, `route.post('/subscribe')` at `/api/subscribe`,
// etc. Writing `/api/foo` here would now double-prefix to
// `/api/api/foo` and 404.

// Sanity ping (lives at `/api`). Useful when verifying that the API
// dev server is up before debugging /api/subscribe failures.
route.get('/', () => response.text('paweldregan api ok'))

// Newsletter signup from <SubscribeForm /> in the footer.
// Backed by resources/stores/subscribe.ts on the client.
route.post('/subscribe', 'Actions/NewsletterSubscribeAction')
  .name('paweldregan.subscribe')
  .skipCsrf()

// Contact form from <ContactForm /> on /coaching.
// Backed by resources/stores/contact.ts on the client.
route.post('/contact', 'Actions/ContactSubmitAction')
  .name('paweldregan.contact')
  .skipCsrf()
