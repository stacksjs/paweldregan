/**
 * Share cards: which page gets which photograph, and where its copy comes from.
 *
 * Shared by `scripts/generate-og.ts` (which draws the cards) and
 * `scripts/bundle-stores.ts` (which points each page's head at the card for its
 * locale). One list so the two cannot disagree about what exists.
 *
 * Copy is looked up per locale from resources/translations, so the German card
 * carries German words. Card copy is written for the card: the `og.*` strings
 * are meta copy, not the page's display copy, and `headline` is the one big
 * line, set in the site's display face.
 */

export interface OgCard {
  /** Page path, matching the keys in `site.pages`. */
  path: string
  /** Slug used for the generated file, `<locale>/<slug>.jpg`. */
  slug: string
  /** Background photograph, relative to public/. Cover-cropped to 1200x630. */
  image: string
  /** Translation key for the small line above the headline. */
  eyebrowKey: string
  /**
   * Translation key(s) for the big display line. Several keys are joined with a
   * space, which is how the alternative homepage's two-line hero becomes one
   * headline.
   */
  headlineKeys: string[]
  /** Translation key for og:title, twitter:title and <title>. */
  titleKey: string
  /** Translation key for og:description, twitter:description and the subtitle. */
  descriptionKey: string
}

export const ogCards: OgCard[] = [
  {
    path: '/',
    slug: 'home',
    image: 'images/landing_landscape.jpg',
    eyebrowKey: 'home.kicker',
    headlineKeys: ['og.home.headline'],
    titleKey: 'og.home.title',
    descriptionKey: 'og.home.description',
  },
  {
    path: '/v2',
    slug: 'v2',
    image: 'images/hero2.jpg',
    eyebrowKey: 'home2.eyebrow',
    // The hero sets this over two lines; a card has one.
    headlineKeys: ['home2.titleA', 'home2.titleB'],
    titleKey: 'og.v2.title',
    descriptionKey: 'og.v2.description',
  },
  {
    path: '/about',
    slug: 'about',
    image: 'images/about.jpg',
    eyebrowKey: 'about.kicker',
    headlineKeys: ['about.title'],
    titleKey: 'og.about.title',
    descriptionKey: 'og.about.description',
  },
  {
    path: '/races',
    slug: 'races',
    image: 'images/ultra700.jpg',
    eyebrowKey: 'races.kicker',
    headlineKeys: ['races.title'],
    titleKey: 'og.races.title',
    descriptionKey: 'og.races.description',
  },
  {
    path: '/coaching',
    slug: 'coaching',
    image: 'images/coach1.jpg',
    eyebrowKey: 'coaching.kicker',
    headlineKeys: ['coaching.title'],
    titleKey: 'og.coaching.title',
    descriptionKey: 'og.coaching.description',
  },
]

/** Where a card lives, as a root-relative URL. */
export function ogCardPath(slug: string, locale: string): string {
  return `/images/og/${locale}/${slug}.jpg`
}
