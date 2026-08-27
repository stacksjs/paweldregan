import type { EmailConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

const domain = 'paweldregan.com'

export default {
  from: {
    name: 'Paweł Dregan',
    address: `hello@${domain}`,
  },
  domain,
  url: `https://${domain}`,
  charset: 'UTF-8',
  default: 'smtp',
  mailboxes: [
    {
      email: `pawel@${domain}`,
      displayName: 'Paweł Dregan',
      password: env.MAIL_PASSWORD_PAWEL,
    },
    {
      email: `hello@${domain}`,
      displayName: 'Paweł Dregan',
      password: env.MAIL_PASSWORD_HELLO || env.MAIL_PASSWORD,
    },
  ],
  server: {
    enabled: true,
    mode: 'server',
    attachTo: 'stacks',
    generatePasswords: false,
    scan: true,
    subdomain: 'mail',
    dmarc: {
      policy: 'none',
      reportTo: `pawel@${domain}`,
    },
    storage: {
      retentionDays: 90,
      archiveAfterDays: 30,
    },
    features: {
      imap: true,
      pop3: true,
    },
  },
} satisfies EmailConfig
