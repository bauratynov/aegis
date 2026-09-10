# Changelog

All notable changes to Aegis are documented in this file, in the [Keep a Changelog](https://keepachangelog.com/) shape: what a user of the file sees. Internal phases and the reasoning behind them are in [`CHANGELOG.internal.md`](./CHANGELOG.internal.md).

## [Unreleased]

### Removed
- The deprecated aliases `clsMap()`, `store()`, `cachedResource()`, `offlineResource()` and `component()`. Replacements, one to one: `cls(el, { … })`, `reactive(obj, { shallow: true })`, `resource(url, { cache: true })`, `resource(url, { offline: true })`, `mount(el, Component)`. `defineElement()` stays as the documented low-level form under `element()`; nothing in `aegis.d.ts` is marked `@deprecated` any more.

### Added
- `defaults.orphanEffects`: what an `effect()` outside a scope does — `'warn'` (dev warning, the default), `'throw'` (an error, in production too) or `'root'` (owned by an app-level scope). `defaults` moved into the core section, so `aegis.core.js` has it too.
- An unhandled effect error marks the nearest component host with `data-aegis-error="<effect name>"` before it goes to `reportError`, so CSS can show a fallback; `error.aegis.host` carries the element for `onError` handlers. Other islands are not affected.
- `.github/CODEOWNERS`, `test-webkit.mjs` (test.html in Playwright WebKit) and a third CI job for it.
- `test-core.mjs`: tests for the frozen value of a disposed computed and for the caching semantics of `untrack()` inside a computed.
- README “Verified by design”: what the node suite proves, what only the browser suite covers, and the limits the tests do not promise (E001 is a reported leak, `untrack()` caches, E027 is a ceiling, contracts are sampled in dev, unhandled effect errors go to `reportError`).

### Changed
- An effect error with no `onError` / `scope.onError` in an environment without `reportError` and without `window` (node, workers) is logged with `console.error` instead of being rethrown from a timer; in browsers the behaviour is unchanged (uncaught error, page keeps running).
- The file header no longer claims “bugs impossible by design”; it names what the architecture prevents and what the dev build reports.

### Fixed
- `computed.dispose()` now freezes the value as E045 promised: a disposed computed no longer recomputes on `value`/`peek()` when a source changes (the non-live durability check ignored the disposed flag).

## [0.7.0] — 2026-09-04

The release the site and the pinned URL `https://aegisjs.com/0.7.0/` point to. User-facing summary; the phase-by-phase history is in [`CHANGELOG.internal.md`](./CHANGELOG.internal.md).

### Added
- Router guards and redirects decide before the navigation commits (Navigation API `precommitHandler` where available, one history entry, no URL flicker); routes compile to `URLPattern` with a regex fallback.
- `portal(target, fn, { popover, anchor, placement })` in the top layer; `command()` follows the Invoker Commands spec; `trap()` uses `CloseWatcher` so Escape and the Android back gesture share the platform stack.
- Typed attribute sinks: `href=${v}` can never become `javascript:`, `on*` attributes are not bindable; Trusted Types and the Sanitizer API are used when present; trust zones per island (`data-aegis-untrusted`, `configure({ islands: { allow } })`); `data-aegis-src` with `integrity`.
- Cache: persistence to IndexedDB with gzip for records above 2 KB, ETag/304, `staleTime: 'http' | 'auto'`, `Aegis-Invalidate` headers, a circuit breaker and a retry budget, optimistic updates as a patch log with 412/409 conflict handling, entity fan-out, prefetch with intent and a byte budget.
- Forms: `f.guard()` for unsaved edits, drafts, wizards, growing forms (`addField`, rules by pattern), accessible error summaries, `wireForm()` over server-rendered forms with 422 mapping and HTML responses morphed in place.
- Accessibility: `tabbables()`, `trap` 3.0 with `inert`, `roving` 2.0, `announce` 2.0 with two permanent live regions.
- Custom builds: `node build.mjs --from app.js` writes one tree-shaken production module; `aegis.core.js` is the signals + scope subset; gzip budgets per subset are enforced by `test/test-shake.mjs`.
- Dev mode: every warning carries the scope path, the element and the source position with a snippet; new detectors E031–E052; `?aegis-devtools` opens the in-page inspector; `stats()`, `dev.profile()`, `trace()`.
- `modal()` closes on a backdrop click; six JSDoc blocks moved next to the exports they describe in `aegis.d.ts`.

### Changed
- Reactive core rebuilt on one hidden class per node with a transactional dispose; lanes are deadline classes; `computed()` subscribes to its sources only while it has observers; an exception inside `computed()` is a cached value, as in the TC39 proposal.
- Templates compile to a walk program; `list()` reconciles without hash-table churn; morph matches children by unique fingerprints.
- The production build strips the developer layer by default; light subsets no longer pull the cache, the request layer or the form messages.

### Fixed
- `list()` inserted new tail rows before the first row when the last old row was removed in the same update; duplicate keys in the `dev` namespace and the IndexedDB wrapper.

## [0.6.0] — 2026-08-28

### Added
- `offlineResource()` — IndexedDB cache + Background Sync + optimistic mutations
- `virtualScroll()` — `content-visibility: auto` virtualization
- `command()` — Invoker Commands pattern
- `router()` — Navigation API with popstate fallback
- `anchor()` — CSS Anchor Positioning with JS fallback
- `defineElement()` — Custom Elements adapter with signals↔attrs↔props

## [0.5.0] — 2026-08-20

### Added
- `css()` — Constructable Stylesheets with `@scope` support
- `adoptStyles()` — deduplicated stylesheet adoption
- `scopedStyle()` — per-element scoping with `@scope` fallback
- `trap()` — focus trap with restore
- `roving()` — arrow-key navigation for composite widgets
- `announce()` — live region announcements
- TypeScript declarations (`aegis.d.ts`)

## [0.4.0] — 2026-08-12

### Added
- `spring()` — physics-based animation via Web Animations API
- `flip()` — FLIP animation for list reordering
- `animate()` — View Transitions API with CSS-class fallback
- `cachedResource()` — SWR + request dedup + cache + refcount GC
- `wireForm()` — auto-wired server-rendered forms with multi-step wizard support

## [0.3.0] — 2026-08-04

### Added
- `reactive()` — deep Proxy-based reactivity
- `form()` — schema-based form state management
- Validation rules: `required`, `minLen`, `maxLen`, `pattern`, `emailRule`, `matches`
- `lazy()` — viewport-based lazy loading
- `i18n()` — translation with reactive dictionary
- `nextTick()` — post-render callback
- `uncloak()` / `injectStyles()` — cloak helpers

## [0.2.0] — 2026-07-27

### Added
- `resource()` — async data with auto-refetch and abort
- `watch()` — explicit dependency watching with debounce and immediate
- `store()` — reactive container (properties → signals, getters → computeds, methods → bound)
- `portal()` — render to different DOM location
- `transition()` — CSS enter/leave transitions
- `errorBoundary()` — error catching with fallback
- `ref()`, `render()`, `$()`, `$$()` — convenience helpers

## [0.1.0] — 2026-07-19

### Added
- Signal-based reactive core: `signal()`, `computed()`, `effect()`, `batch()`
- Scope lifecycle with auto-cleanup
- Scoped utilities: `on()`, `delegate()`, `interval()`, `timeout()`, `observe()`, `resize()`, `mutate()`
- `guardedFetch()` — auto-abort fetch with scope cleanup
- `debounced()`, `throttled()`, `poll()`
- `html` tagged template literal — CSP-safe DOM rendering
- DOM helpers: `text()`, `attr()`, `cls()`, `style()`, `bind()`, `show()`
- `list()` — keyed reconciliation with DocumentFragment batch insert
- `component()` / `register()` / `hydrate()` — component system with smart hydration strategies
- Prototype pollution defense
