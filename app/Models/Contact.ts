import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

// Contact form submissions from <ContactForm /> on /coaching. POST to
// /api/contact writes one row per send. We persist alongside the
// email-send so a failed SMTP delivery isn't a lost lead — the row
// stays and an admin can re-process from the dashboard.
//
// `ipAddress` mirrors what api/contact.ts uses for the 60s rate-limit
// window. Storing it lets us spot repeat spammers and revoke their
// submissions in bulk if needed (one of the reasons we don't trust
// the in-memory limiter long-term).
export default defineModel({
  name: 'Contact',
  table: 'contacts',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'contacts',
      routes: ['index', 'show', 'update', 'destroy'],
      // PII + free-text body. Public submit is /api/contact (its
      // own rate-limited action); CRUD routes here are admin-only.
      middleware: ['auth'],
    },
  },

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(200),
        message: {
          required: 'Name is required',
          min: 'Name must have a minimum of 2 characters',
          max: 'Name must have a maximum of 200 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    email: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email().required().max(320),
        message: {
          required: 'Email is required',
          email: 'Email must be a valid email address',
          max: 'Email must have a maximum of 320 characters',
        },
      },
      factory: faker => faker.internet.email(),
    },

    message: {
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(1).max(5000),
        message: {
          required: 'Message is required',
          max: 'Message must have a maximum of 5000 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    // Locale of the page the form was submitted from — useful when
    // replying in the visitor's language without asking. Allowed
    // values: 'en' | 'de' | 'pl' (must match site.config.ts
    // i18n.locales). Modeled as varchar rather than a Postgres enum
    // — see Newsletter.ts for the migration-generator collision
    // that makes enums unsafe across multiple models.
    locale: {
      required: true,
      fillable: true,
      default: 'en',
      validation: {
        rule: schema.string().min(2).max(5),
      },
      factory: faker => faker.helpers.arrayElement(['en', 'de', 'pl']),
    },

    // Captured server-side from x-forwarded-for / x-real-ip headers
    // by api/contact.ts. Optional because behind some proxies we may
    // not be able to determine the real client IP reliably.
    ipAddress: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(45), // IPv6 max length
      },
      factory: faker => faker.internet.ip(),
    },

    // Allowed: 'new' | 'replied' | 'archived' | 'spam'. Stored as
    // varchar instead of a Postgres enum — see Newsletter.ts for
    // the reason (migrator emits a global `status_type` and
    // collides across models). Whitelist enforced in the API action.
    status: {
      required: true,
      fillable: true,
      default: 'new',
      validation: {
        rule: schema.string().max(20),
      },
      factory: () => 'new',
    },

    // Filled in by the admin reply flow once a response goes out
    // (future dashboard feature). Null = unanswered.
    repliedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },
  },
} as const)
