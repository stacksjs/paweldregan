import { defineSiteConfig } from '@stacksjs/stx'

// Component/layout/partial source files live under `resources/` (Stacks
// convention), but bun-plugin-stx hard-resolves <Component /> tags
// against the root-level `components/`, `layouts/`, `partials/`
// directories without honoring stx.config.ts or any passed-in dirs.
// Root-level symlinks (`components -> resources/components`, etc.)
// bridge the two: editors work in `resources/`, framework finds them
// at its defaults. The symlinks are committed; no config glue needed.
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
  pagesDir: 'resources/views',
  i18n: {
    // Translations live in resources/translations/<locale>.json — keys
    // are nested and get flattened to dotted lookup paths (nav.home,
    // coaching.lede, etc.) at build time. JSON files keep large copy
    // out of TS source.
    locales: ['en', 'de', 'pl'],
    defaultLocale: 'en',
    labels: { en: 'EN', de: 'DE', pl: 'PL' },
    translationsDir: 'resources/translations',
    format: 'json',
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
// resources/layouts/default.stx reads from here so siteId + endpoint
// are configured in one place.
export const analytics = {
  siteId: 'paweldregan',
  endpoint: 'https://analytics.paweldregan.com',
}
