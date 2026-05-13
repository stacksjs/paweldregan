import type { Attributes } from '@stacksjs/types'
import { defineModel } from '@stacksjs/orm'
import { makeHash } from '@stacksjs/security'
import { schema } from '@stacksjs/validation'

// Admin user. paweldregan.com is a static marketing site so there's no
// public sign-up — the table is here to back a future admin login for
// Paweł (and any future maintainers) to view contact submissions and
// newsletter signups through whatever lightweight dashboard we add.
//
// Trimmed from the canonical Stacks User model: no commerce/auth
// scaffolding (PersonalAccessToken, Customer, Driver, Author,
// Subscriber relations), no public `useApi`, no seeder — we only ever
// want hand-created admin rows here.
export default defineModel({
  name: 'User',
  table: 'users',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useAuth: {
      usePasskey: true,
    },
    useUuid: true,
    useTimestamps: true,
  },

  attributes: {
    name: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(100),
        message: {
          min: 'Name must have a minimum of 2 characters',
          max: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },

    email: {
      unique: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().email().required(),
        message: {
          required: 'Email is required',
          email: 'Email must be a valid email address',
        },
      },
      factory: faker => faker.internet.email(),
    },

    password: {
      order: 3,
      hidden: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(8).max(255),
        message: {
          required: 'Password is required',
          min: 'Password must have a minimum of 8 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },
      factory: () => 'changemechangeme',
    },
  },

  get: {
    salutationName: (attributes: Attributes) => {
      return attributes.name
    },
  },

  set: {
    password: async (attributes: Attributes) => {
      return await makeHash(attributes.password, { algorithm: 'bcrypt' })
    },
  },
} as const)
