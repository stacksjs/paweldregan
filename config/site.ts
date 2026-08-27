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
    // Default og:image / twitter:image — site-builder will resolve to an
    // absolute URL against `url` above. Per-page overrides live under
    // `pages[*].image` so the right shot ships with each share card.
    image: '/images/og.jpg',
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
      image: '/images/landing_landscape.jpg',
      priority: 1.0,
      changefreq: 'weekly',
    },
    // Alternative homepage, live for A/B comparison against '/'. Kept out
    // of the sitemap, and out of the index via `noindexPaths` below: two
    // pages with the same subject and near-identical copy would otherwise
    // compete with each other in search. Reachable only by direct link
    // while the test runs.
    '/v2': {
      title: 'Paweł Dregan, Ultra Runner',
      description: 'Seven hundred kilometres across the Alps. Five hundred through the Arctic. 1:1 coaching for runners preparing for distances like these.',
      image: '/images/landing_landscape.jpg',
      sitemap: false,
    },
    '/about': {
      title: 'About — Paweł Dregan',
      description: 'From first ultra to 700K finisher. The story, the philosophy, and the partnerships behind the journey.',
      image: '/images/about.jpg',
      priority: 0.9,
    },
    '/races': {
      title: 'Races — Paweł Dregan',
      description: 'UTMB-indexed race results from 100K to 700K. Every start line, every finish, every lesson.',
      image: '/images/ultra700.jpg',
      priority: 0.9,
    },
    '/coaching': {
      title: 'Coaching — Paweł Dregan',
      description: 'Personalized 1:1 ultra running coaching built on real experience. From your first 50K to your biggest dream race.',
      image: '/images/coach1.jpg',
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

// Pages that should not be indexed, as base paths (locale variants are
// covered too). `sitemap: false` only stops us from advertising a page;
// it does not stop a crawler that reaches it another way, and an A/B
// variant of the homepage competing with the homepage is exactly the
// case where that matters. The meta tag is stamped in the post-build
// pass — see scripts/bundle-stores.ts.
export const noindexPaths = ['/v2']

export default site
