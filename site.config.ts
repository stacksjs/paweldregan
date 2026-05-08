import { defineSiteConfig } from '@stacksjs/stx'

export const site = defineSiteConfig({
  name: 'Paweł Dregan',
  port: 5555,
  url: 'https://paweldregan.com',
  description: 'Ultra runner. Coach. Husband. Finisher of SwissPeaks 700K, Lappland Arctic Ultra 500K, and the world\'s most demanding mountain races.',
  social: {
    instagram: 'ultrarunnerpaw',
    youtube: 'UC3BxCTwxiIROpXagOexE9gw',
  },
  seo: {
    siteName: 'Paweł Dregan',
    twitter: 'ultrarunnerpaw',
    locale: 'en_US',
    type: 'website',
    favicon: '/favicon.svg',
  },
  i18n: {
    // Translations live in translations/<locale>.json — keys are nested
    // and get flattened to dotted lookup paths (nav.home, coaching.lede,
    // etc.) at build time. JSON files keep large copy out of TS source.
    locales: ['en', 'de', 'pl'],
    defaultLocale: 'en',
    labels: { en: 'EN', de: 'DE', pl: 'PL' },
  },
  pages: {
    '/': {
      title: 'Paweł Dregan — Ultra Runner',
      description: 'Finisher of SwissPeaks 700K, Lappland Arctic Ultra 500K, and the world\'s most demanding mountain races. Pushing limits where the trail ends and willpower begins.',
      priority: 1.0,
      changefreq: 'weekly',
    },
    '/about': {
      title: 'About — Paweł Dregan',
      description: 'From first ultra to 700K finisher. The story, the philosophy, and the partnerships behind the journey.',
      priority: 0.9,
    },
    '/races': {
      title: 'Races — Paweł Dregan',
      description: 'UTMB-indexed race results from 100K to 700K. Every start line, every finish, every lesson.',
      priority: 0.9,
    },
    '/coaching': {
      title: 'Coaching — Paweł Dregan',
      description: 'Personalized 1:1 ultra running coaching built on real experience. From your first 50K to your biggest dream race.',
      priority: 0.9,
      changefreq: 'monthly',
    },
  },
})

// @stacksjs/ts-analytics integration. The loader snippet in
// layouts/default.stx reads from here so siteId + endpoint are
// configured in one place.
export const analytics = {
  siteId: 'paweldregan',
  endpoint: 'https://analytics.paweldregan.com',
}
