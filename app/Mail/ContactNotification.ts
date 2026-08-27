import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'

// Contact form mail. Sends two emails for each submission:
//   1. Internal notification to `hello@paweldregan.com` (Pawel) with
//      the full message + sender details. Reply-To is set to the
//      visitor's email so hitting reply lands in their inbox.
//   2. Auto-reply back to the visitor saying "got it, talk soon" —
//      locale-aware via resources/emails/contact-received.stx.
//
// All locale dictionaries live HERE (not in the template) because the
// stx `<script server>` sandbox throws "Attempted to assign to readonly
// property" on common identifiers (`name`, `message`, others we
// haven't enumerated). Pure-structure templates with
// `{{ placeholder }}` interpolation sidestep that entirely.
//
// Called fire-and-forget from app/Actions/ContactSubmitAction. The
// row in `contacts` is the source of truth — a failed send is logged
// but doesn't 500 the form submission.

export interface ContactNotificationOptions {
  name: string
  email: string
  message: string
  locale?: 'en' | 'de' | 'pl' | string
  ipAddress?: string | null
}

interface AutoReplyCopy {
  subject: string
  heading: string
  intro: string
  nextWord: string
  sign: string
  footer: string
}

const ADMIN_ADDRESS = 'hello@paweldregan.com'

function autoReplyCopy(senderName: string, localeKey: string): AutoReplyCopy {
  const dict: Record<string, AutoReplyCopy> = {
    en: {
      subject: 'Got your message',
      heading: 'Got it.',
      intro: senderName
        ? `Thanks for reaching out, ${senderName}. I'll get back to you within a few days — usually faster.`
        : 'Thanks for reaching out. I\'ll get back to you within a few days — usually faster.',
      nextWord: 'Talk soon,',
      sign: 'Paweł',
      footer: 'You\'re receiving this because you sent a message through paweldregan.com/coaching.',
    },
    de: {
      subject: 'Nachricht erhalten',
      heading: 'Hab\'s.',
      intro: senderName
        ? `Danke für deine Nachricht, ${senderName}. Ich melde mich innerhalb weniger Tage — meist schneller.`
        : 'Danke für deine Nachricht. Ich melde mich innerhalb weniger Tage — meist schneller.',
      nextWord: 'Bis bald,',
      sign: 'Paweł',
      footer: 'Du erhältst diese E-Mail, weil du das Formular auf paweldregan.com/coaching genutzt hast.',
    },
    pl: {
      subject: 'Mam Twoją wiadomość',
      heading: 'Mam.',
      intro: senderName
        ? `Dzięki za wiadomość, ${senderName}. Odezwę się w ciągu kilku dni — zazwyczaj szybciej.`
        : 'Dzięki za wiadomość. Odezwę się w ciągu kilku dni — zazwyczaj szybciej.',
      nextWord: 'Do usłyszenia,',
      sign: 'Paweł',
      footer: 'Otrzymujesz tę wiadomość, ponieważ skorzystałeś z formularza na paweldregan.com/coaching.',
    },
  }
  return dict[localeKey] ?? dict.en!
}

export async function sendContactNotification(options: ContactNotificationOptions): Promise<void> {
  const { name, email, message } = options
  const localeKey = options.locale && ['en', 'de', 'pl'].includes(options.locale as string)
    ? options.locale as string
    : 'en'

  const fromName = config.email?.from?.name || 'Paweł Dregan'
  const fromAddress = config.email?.from?.address || ADMIN_ADDRESS

  // 1. Internal notification to the admin mailbox. ReplyTo is the
  //    visitor's email so Pawel can hit reply and the response goes
  //    straight to them.
  const adminSubject = `New contact form submission — ${name}`
  const adminTemplate = await template('contact-notification', {
    variables: {
      subject: adminSubject,
      senderName: name,
      senderEmail: email,
      body: message,
      locale: localeKey,
      ipAddress: options.ipAddress || 'unknown',
      submittedAt: new Date().toISOString(),
    },
    subject: adminSubject,
  })

  await mail.send({
    to: [ADMIN_ADDRESS],
    from: { name: fromName, address: fromAddress },
    replyTo: { name, address: email },
    subject: adminSubject,
    html: adminTemplate.html,
    text: adminTemplate.text,
  })

  // 2. Auto-reply to the visitor. Skip if the visitor's email
  //    happens to BE the admin mailbox (test cases, spammers) so
  //    we don't loop back the notification with a visitor variant.
  if (email.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) return

  const copy = autoReplyCopy(name, localeKey)
  const visitorTemplate = await template('contact-received', {
    variables: {
      ...copy,
      locale: localeKey,
      siteUrl: config.app?.url || 'https://paweldregan.com',
      year: new Date().getFullYear(),
    },
    subject: copy.subject,
  })

  await mail.send({
    to: [email],
    from: { name: fromName, address: fromAddress },
    subject: copy.subject,
    html: visitorTemplate.html,
    text: visitorTemplate.text,
  })
}

export default sendContactNotification
