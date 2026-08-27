import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'

// Sends the "thanks for signing up" welcome email to a newsletter
// subscriber. Locale-aware copy is built here (in TS) rather than
// inside the stx <script server> block — that sandbox throws
// "Attempted to assign to readonly property" on common identifiers,
// so all templates stay pure-structure with `{{ placeholder }}`
// interpolation only.
//
// Called fire-and-forget from app/Actions/NewsletterSubscribeAction
// so a slow or unreachable SMTP server doesn't tie up the POST
// response. The row in `newsletters` is already saved by the time
// this runs; failure is logged but the visitor still sees success.

export interface NewsletterWelcomeOptions {
  to: string
  locale?: 'en' | 'de' | 'pl' | string
}

interface Copy {
  subject: string
  heading: string
  intro: string
  nextWord: string
  sign: string
  visit: string
  footer: string
}

const COPY: Record<string, Copy> = {
  en: {
    subject: 'Thanks for signing up',
    heading: 'Thanks for signing up.',
    intro: 'You\'re on the list. Race reports, training notes, and behind-the-scenes from the trail — straight to your inbox. No spam.',
    nextWord: 'See you out there,',
    sign: 'Paweł',
    visit: 'Visit paweldregan.com',
    footer: 'You\'re receiving this because you signed up at paweldregan.com.',
  },
  de: {
    subject: 'Danke für deine Anmeldung',
    heading: 'Danke für deine Anmeldung.',
    intro: 'Du bist dabei. Renn-Berichte, Trainingsnotizen und Eindrücke vom Trail — direkt in dein Postfach. Kein Spam.',
    nextWord: 'Bis bald draußen,',
    sign: 'Paweł',
    visit: 'paweldregan.com besuchen',
    footer: 'Du erhältst diese E-Mail, weil du dich auf paweldregan.com angemeldet hast.',
  },
  pl: {
    subject: 'Dzięki za zapis',
    heading: 'Dzięki za zapis.',
    intro: 'Jesteś na liście. Relacje z biegów, notatki treningowe i kulisy z trasy — prosto na Twoją skrzynkę. Bez spamu.',
    nextWord: 'Do zobaczenia na trasie,',
    sign: 'Paweł',
    visit: 'Odwiedź paweldregan.com',
    footer: 'Otrzymujesz tę wiadomość, ponieważ zapisałeś się na paweldregan.com.',
  },
}

export async function sendNewsletterWelcome(options: NewsletterWelcomeOptions): Promise<void> {
  const localeKey = options.locale && COPY[options.locale] ? options.locale : 'en'
  const copy = COPY[localeKey] ?? COPY.en!

  const { html, text } = await template('newsletter-welcome', {
    variables: {
      ...copy,
      locale: localeKey,
      siteUrl: config.app?.url || 'https://paweldregan.com',
      year: new Date().getFullYear(),
    },
    subject: copy.subject,
  })

  await mail.send({
    to: [options.to],
    from: {
      name: config.email?.from?.name || 'Paweł Dregan',
      address: config.email?.from?.address || 'hello@paweldregan.com',
    },
    subject: copy.subject,
    html,
    text,
  })
}

export default sendNewsletterWelcome
