import { defineStxConfig } from '@stacksjs/stx'

// Stacks-app layout: views/components/layouts live under resources/.
// Setting `root: 'resources'` makes the framework prefix the default
// `components`/`layouts`/`partials` dirs with that root, so component
// resolution finds resources/components/<Name>.stx automatically.
export default defineStxConfig({
  root: 'resources',
  pagesDir: 'views',
  componentsDir: 'components',
  layoutsDir: 'layouts',
  partialsDir: 'partials',
})
