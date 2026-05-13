import { defineStore, state } from '@stacksjs/stx'

// Contact form store. Backs <ContactForm /> on /coaching. Same
// rationale as subscribe.ts — defineStore so <script client> can pull
// it in via the `useStore('contact')` global instead of an ES import.

// Public shape, exposed for `<script client>` blocks that consume the
// store. Same idea as SubscribeStore — describes the shape returned
// by `useStore('contact')`.
export interface ContactStore {
  isSubmitting: () => boolean
  isSuccess: () => boolean
  isInvalid: () => boolean
  isRateLimited: () => boolean
  isError: () => boolean
  submit: (payload: ContactPayload) => Promise<boolean>
  reset: () => void
}

export interface ContactPayload {
  name: string
  email: string
  message: string
}

interface ContactResponse {
  success: boolean
  contact?: { id: number | string, uuid?: string }
  errors?: Array<{ message: string }>
}

defineStore('contact', (): ContactStore => {
  // All module-private constants are pulled into the setup closure
  // because the framework concatenates `resources/stores/*.ts` into a
  // single IIFE — a shared `const EMAIL_REGEX` at module scope across
  // stores throws `redeclaration of const` at parse time. See
  // subscribe.ts for the same note.
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Mirrors the API's per-IP window in app/Actions/ContactSubmitAction.
  // Browser-side check prevents the user from spamming the button
  // before the server has a chance to 429; not a security boundary.
  const RATE_LIMIT_MS = 60_000
  const STORAGE_KEY = 'contact:lastSubmit'

  const isSubmitting = state(false)
  const isSuccess = state(false)
  const isInvalid = state(false)
  const isRateLimited = state(false)
  const isError = state(false)

  function reset(): void {
    isSubmitting.set(false)
    isSuccess.set(false)
    isInvalid.set(false)
    isRateLimited.set(false)
    isError.set(false)
  }

  async function submit(payload: ContactPayload): Promise<boolean> {
    const name = (payload?.name || '').trim()
    const email = (payload?.email || '').trim()
    const message = (payload?.message || '').trim()

    if (!name || !email || !message || !EMAIL_REGEX.test(email)) {
      reset()
      isInvalid.set(true)
      return false
    }

    try {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0)
      if (Date.now() - last < RATE_LIMIT_MS) {
        reset()
        isRateLimited.set(true)
        return false
      }
    }
    catch {
      // private-mode browsers — drop the local check, let the server
      // enforce the 429 if needed.
    }

    reset()
    isSubmitting.set(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          message,
          locale: typeof document !== 'undefined'
            ? (document.documentElement.lang || 'en')
            : 'en',
        }),
      })

      if (!res.ok) {
        if (res.status === 422) {
          reset()
          isInvalid.set(true)
          return false
        }
        if (res.status === 429) {
          reset()
          isRateLimited.set(true)
          return false
        }
        throw new Error(`contact endpoint returned ${res.status}`)
      }

      await res.json().catch<ContactResponse>(() => ({ success: true }))

      try { localStorage.setItem(STORAGE_KEY, String(Date.now())) }
      catch {}

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
    isRateLimited,
    isError,
    submit,
    reset,
  }
})
