import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

// Newsletter signups from the <SubscribeForm /> in the footer. POST to
// /api/subscribe writes one row per email. Status drives the email
// pipeline (only `subscribed` rows get sent the digest; `bounced` /
// `unsubscribed` are skipped). Locale is captured at signup so future
// race reports / training notes can be sent in the language the
// visitor was reading.
export default defineModel({
  name: 'Newsletter',
  table: 'newsletters',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'newsletters',
      routes: ['index', 'show', 'destroy'],
      // PII (email + status). Public signup hits the dedicated
      // /api/subscribe action with rate limiting + honeypot; CRUD
      // routes here are admin-only.
      middleware: ['auth'],
    },
  },

  attributes: {
    email: {
      unique: true,
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
        message: {
          required: 'Email is required',
          email: 'Email must be a valid email address',
          max: 'Email must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.internet.email(),
    },

    // Allowed: 'subscribed' | 'unsubscribed' | 'pending' | 'bounced'.
    // Modeled as a varchar (not a Postgres enum) because the
    // migration generator emits a single global `status_type` enum
    // and collides when more than one model uses `status: enum(...)`.
    // Whitelist is enforced via `schema.string()` length + the API
    // action that writes the row.
    status: {
      required: true,
      fillable: true,
      default: 'subscribed',
      validation: {
        rule: schema.string().max(20),
      },
      factory: faker => faker.helpers.arrayElement(['subscribed', 'subscribed', 'subscribed', 'unsubscribed', 'pending']),
    },

    // Allowed: 'en' | 'de' | 'pl' (must match site.config.ts i18n.locales).
    // Same enum-collision reason as `status` above — kept as varchar.
    locale: {
      required: true,
      fillable: true,
      default: 'en',
      validation: {
        rule: schema.string().min(2).max(5),
      },
      factory: faker => faker.helpers.arrayElement(['en', 'de', 'pl']),
    },

    // Page slug where the visitor signed up — `footer` for the
    // form in resources/components/Footer.stx, future CTAs can use
    // their own labels (`hero`, `coaching-cta`, etc.) so we can
    // measure which surfaces convert.
    source: {
      required: false,
      fillable: true,
      default: 'footer',
      validation: {
        rule: schema.string().max(64),
      },
      factory: faker => faker.helpers.arrayElement(['footer', 'hero', 'coaching-cta', 'about-page']),
    },

    // Stamped by the unsubscribe action; `subscribed` rows have
    // this as null. Kept separate from `status` so we can audit
    // when each unsubscribe happened.
    unsubscribedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },
  },
} as const)
