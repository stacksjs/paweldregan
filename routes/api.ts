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

// Note: routes/api.ts does NOT auto-prefix with `/api` (per the
// framework's route-loader: "key name becomes URL prefix EXCEPT 'api'
// and 'web' which have no prefix"). We declare `/api/...` explicitly
// so the URLs match the clients' fetch calls AND the serve.ts proxy
// path filter.

// Sanity ping. Useful when verifying that the API dev server is up
// before debugging /api/subscribe or /api/contact failures.
route.get('/api', () => response.text('paweldregan api ok'))

// Newsletter signup from <SubscribeForm /> in the footer.
// Backed by resources/stores/subscribe.ts on the client.
route.post('/api/subscribe', 'Actions/NewsletterSubscribeAction')
  .name('paweldregan.subscribe')
  .skipCsrf()

// Contact form from <ContactForm /> on /coaching.
// Backed by resources/stores/contact.ts on the client.
route.post('/api/contact', 'Actions/ContactSubmitAction')
  .name('paweldregan.contact')
  .skipCsrf()
