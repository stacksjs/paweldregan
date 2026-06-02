// Server boot preamble — MUST be the first import in start.ts.
//
// ES module imports are hoisted and evaluated before any statement code in
// the importing module. So flags that need to be visible to *other* modules
// at their load time cannot be set as plain statements in start.ts — they'd
// run too late, after `@stacksjs/database` / `@stacksjs/config` have already
// evaluated. Setting them here, in a module imported first, guarantees they
// are in place before anything else loads.
//
//   • __STACKS_BINARY_MODE__ — tells routes/api.ts to skip auto-registration.
//   • SKIP_CONFIG_LOADING     — makes @stacksjs/config return an empty config
//     instead of eagerly importing every user `config/*.ts` file. Beyond the
//     startup-speed win, this keeps the production server off the full
//     user-config graph — which, when a local stx worktree is symlinked in,
//     transitively fails to resolve @stacksjs/ts-i18n and crashes boot.
;(globalThis as any).__STACKS_BINARY_MODE__ = true
process.env.SKIP_CONFIG_LOADING = 'true'
