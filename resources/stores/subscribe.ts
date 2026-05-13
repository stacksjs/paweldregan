import { defineStore, state } from '@stacksjs/stx'

// Newsletter subscribe store. Backs <SubscribeForm /> in the footer.
// Defined via stx's defineStore so the component can do
// `const subscribe = useStore('subscribe')` from <script client>
// without an ES import (which the framework wraps in an IIFE and
// breaks at parse time).
//
// State + fetch live here so other surfaces (a hero CTA, a /coaching
// callout, a post-purchase flow) can reuse the same actions and
// observe the same signals without duplicating the request logic.

// Public shape of the store. Documented as an interface so any
// `<script client>` block that pulls in `useStore('subscribe')` has
// IDE help — even without ES-import-driven type inference reaching
// across the runtime boundary.
export interface SubscribeStore {
  isSubmitting: () => boolean
  isSuccess: () => boolean
  isInvalid: () => boolean
  // Dedupe state — the API rejects a repeat signup with 422 "Already
  // subscribed". UI-wise this is a friendlier message than the generic
  // invalid-email path, so it gets its own signal.
  isAlreadySubscribed: () => boolean
  isError: () => boolean
  submit: (email: string, source?: string) => Promise<boolean>
  reset: () => void
}

// What the server response body looks like (defined for clarity,
// currently only `success` is read — the rest is documentation for
// future admin tooling that might consume the same endpoint).
interface SubscribeResponse {
  success: boolean
  // The framework's error envelope (4xx + 5xx) puts the human-readable
  // reason in `message` — used to distinguish "already subscribed"
  // (422) from the generic "invalid email" (also 422).
  message?: string
  newsletter?: { id: number | string, uuid?: string }
  errors?: Array<{ message: string }>
}

defineStore('subscribe', (): SubscribeStore => {
  // Kept inside the setup closure: the framework concatenates every
  // `resources/stores/*.ts` into one IIFE-wrapped <script>, and any
  // module-level `const` with a shared name (EMAIL_REGEX in
  // contact.ts too) hits a `redeclaration of const` SyntaxError at
  // load time. Closure-local declarations are safe.
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // idle | submitting | success | invalid | alreadySubscribed | error
  // — modelled as independent booleans so `:show="isSubmitting"` etc.
  // in stx templates reactively bind without a string-comparison
  // wrapper.
  const isSubmitting = state(false)
  const isSuccess = state(false)
  const isInvalid = state(false)
  const isAlreadySubscribed = state(false)
  const isError = state(false)

  function reset(): void {
    isSubmitting.set(false)
    isSuccess.set(false)
    isInvalid.set(false)
    isAlreadySubscribed.set(false)
    isError.set(false)
  }

  // Performs client-side validation, POSTs to /api/subscribe (proxied
  // by serve.ts to the API server on port 3008 in dev), and maps the
  // response into the signals above. Returns true on success so
  // callers can chain UI effects (form.reset() etc.).
  async function submit(email: string, source: string = 'footer'): Promise<boolean> {
    const trimmed = (email || '').trim()
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      reset()
      isInvalid.set(true)
      return false
    }

    reset()
    isSubmitting.set(true)

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: trimmed,
          source,
          locale: typeof document !== 'undefined'
            ? (document.documentElement.lang || 'en')
            : 'en',
        }),
      })

      if (!res.ok) {
        // The API throws 422 for both validation failures AND repeat
        // signups. Branch on the response message so the UI can show
        // a friendlier "you're already on the list" rather than the
        // generic "please enter a valid email" — the two states need
        // distinct copy.
        if (res.status === 422) {
          const body = await res.json().catch<SubscribeResponse>(() => ({ success: false }))
          const message = typeof body?.message === 'string' ? body.message : ''
          reset()
          if (/already\s*subscribed/i.test(message))
            isAlreadySubscribed.set(true)
          else
            isInvalid.set(true)
          return false
        }
        throw new Error(`subscribe endpoint returned ${res.status}`)
      }

      // Successful 2xx — we don't actually need the body shape to
      // light up the success branch, but typing the parse keeps the
      // contract documented for admin dashboards.
      await res.json().catch<SubscribeResponse>(() => ({ success: true }))

      reset()
      isSuccess.set(true)
      return true
    }
    catch {
      reset()
      isError.set(true)
      return false
    }
  }

  return {
    isSubmitting,
    isSuccess,
    isInvalid,
    isAlreadySubscribed,
    isError,
    submit,
    reset,
  }
})
