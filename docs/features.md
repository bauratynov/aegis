## Features

### Reactive Core
- **Signals** — TC39-aligned, glitch-free diamond propagation, custom equality
- **Computed** — lazy, cached, version-tracked
- **Effects** — auto-tracking, auto-cleanup via scopes, optional cleanup callback (`return () => …`)
- **`untrack()`** — read signals without subscribing
- **`linked()`** — writable derived that resets when its source changes; **`persisted()`** — a signal in localStorage/sessionStorage with cross-tab sync; **`selector()`** — O(2) updates for "selected row"; **`until()`** — await a signal (`until(ready)`, `until(n).toBe(3)`, `{ timeout }`)
- **`provide()` / `inject()`** — context down the scope chain and across islands via DOM ancestors
- **`watch()`** — `onCleanup`, `{ once }`, `pause()` / `resume()`; `computed((prev) => …, { initial })`
- **Batch** — group updates, single flush
- **Reactive objects** — deep Proxy-based reactivity (like Vue `reactive()`), arrays included: `push`/`splice`/`sort`, index writes, `length`, key add/delete
- **Interop** — `from()` turns an EventTarget, a producer or any `{ subscribe }` (Preact, RxJS, Svelte store) into a signal; `history()` gives undo/redo for a signal or a `reactive()` object
- **`reactive()` 2.0** — getters become computeds, methods become batched actions, `$patch` / `$subscribe` / `$snapshot` / `$reset`; only plain objects and arrays are wrapped (Date/Map/File stay as they are); a shallow container is `reactive(obj, { shallow: true })`
- **`watch()`** — explicit dependency watching with debounce
- **Semantics** — A `computed()` is subscribed to its sources only while something observes it and needs no scope; what an effect creates in its body dies before the effect re-runs (Solid / Svelte 5 semantics); the setup `ctx` helpers survive an `await`. An exception inside `computed()` is a cached value, not a torn graph: subscriptions survive and the graph recovers as soon as a dependency changes; effect errors go to `scope.onError` → `onError(fn)` → `reportError`, never to the code that wrote the signal.

### DOM
- **`html\`\``** — tagged template literals, CSP-safe, parsed once per template by a real HTML tokenizer. Prefixes everyone knows:

  | Syntax | Meaning |
  |---|---|
  | `@click=${fn}` | `addEventListener` (also `onclick=${fn}`) |
  | `.value=${sig}` | element **property** — `<input .value>`, `<select .value>`, `<my-chart .points=${obj}>` |
  | `?disabled=${sig}` | boolean attribute (`toggleAttribute`) |
  | `bind:value=${sig}` | two-way binding (`bind:checked` for checkboxes) |
  | `:title=${sig}` | reactive attribute |
  | `title="a ${x} ${y}"` | several values in one attribute |
  | `<input ${ref}>` | `ref()` or `(el) => …` inside a tag |
  | `<canvas ${attach(el => …)}>` | init + cleanup + reactivity for third-party widgets, runs after mount |
  | `@submit.prevent`, `@keydown.enter`, `@click.outside`, `@keydown.esc.window`, `@input.debounce.300`, `@scroll.passive` | event modifiers (also `prevent(fn)` / `stop(fn)` / `self(fn)` helpers) |
  | `class=${{ active, done: () => … }}`, `class=${['btn', size]}` | clsx-style classes with a diff: static and third-party classes are never touched, works on SVG |
  | `style=${{ '--w': () => w.value + 'px', color }}` | per-property styles; custom properties go through `setProperty` (`cssVars(el, { x })` for signal → CSS variable) |
  | `${when(users, { loading, error, data })}` | three states of a resource in one place |
  | `${() => cond ? html`…` : null}` | reactive children: a function may return text, a node, a template or an array — each run gets its own scope |

  Bare `value`/`checked`/`selected` on form fields are treated as properties, so `<input value=${sig}>` keeps working after the user has typed.
- **`show()`** — conditional rendering with scope-per-branch (no leaks); `{ keep: true }` hides instead of destroying (like `v-show`)
- **Components return their template** — `mount(el, ({ html, slot }) => html\`…\`)` replaces the element's content; `slot()` / `slot('[slot=footer]')` hand server-rendered children to the template
- **Server HTML** — `swap(el, response, { mode: 'morph' })` inserts server-rendered fragments the right way: islands in the replaced subtree are disposed, new ones hydrated, `data-cloak` removed, focus and caret restored; `morph` patches in place (id-aware, live islands keep their DOM and remount only when their `data-*` props change); a full page in the response is reduced to the target's selector
- **`boost()`** — MPA navigation without reload: fetch the next page, morph `<main>`, View Transitions, prefetch on hover; islands outside the root survive; `data-no-boost` opts out; a `router()` keeps its own routes
- **`tpl('#card')`** — a server `<template>` with `data-slot` becomes a render function for `list()`/`show()`: one markup for the first render and the client (no HTML parsing, CSP-safe)
- **`adopt(el)`html``** — bind a template to already server-rendered DOM with zero mutations (text, attributes, events, refs); dev warning when the server partial drifts from the template
- **Island props** — `register(name, setup, { types: { count: Number, on: Boolean, tags: JSON } })`; `data-*` stay strings unless typed (IDs never lose precision), `<script type="application/json">` inside an island (Django `json_script`) or `data-aegis-props="#id"` lands in `data.props`; `jsonScript('#config')`
- **Lazy islands** — `register('chart', { load: () => import('/js/islands/chart.js') })` or `<div data-aegis="chart" data-aegis-src="/js/islands/chart.js" data-aegis-load="visible">`: island code is fetched only when needed (400px before a `visible` island enters the viewport); `data-aegis-prefetch="/api/…"` warms its data too
- **Routing 2.0** — nested routes with `layout` and a live `outlet`, async `handler`/`loader` awaited inside `intercept()` (native loading indicator, scroll after data, races cancelled via `signal`), `guard`/`redirect` as route data, `r.search('page', { parse: Number })` two-way URL signals that do not recreate the route scope, lazy routes via `load: () => import(…)` with hover/visible preload, `aria-current` + `activeClass` on server-rendered links, `transition: true` View Transitions with back/forward direction; hash links, forms, downloads, `data-aegis-reload` and unknown paths go to the server
- **Forms 2.0** — `wireForm` validates through the Constraint Validation API (`noValidate`, `setCustomValidity`, browser-localised messages, `:user-invalid`), accepts a Standard Schema (zod/valibot/arktype) next to per-field rules, async rules with `validating[key]`, debounce and stale-response cancellation, nested names (`items[0][qty]`, `address.city`) in `values`/`setErrors`, `setInitial(resource.data)` / `commit()` / `dirtyFields` / `changes` / `guardUnload()`, server submit with `FormData` (422 → field errors, 303 → navigation); `form(defaults, { rules, schema })` for virtual forms
- **`hydrate(root, { watch: true })`** — islands inserted by htmx/Turbo/jQuery come alive, removed ones are destroyed; `register()` auto-hydrates the document; `aegis:hydrate` / `aegis:hydrated` / `aegis:destroy` events; eager islands mount in ~8 ms slices between tasks
- **Event handlers are batched** — `on()`, `delegate()`, `@click`: five signal writes in a handler, one flush
- **Effects run under their owner** — whatever created the effect owns everything it creates on every re-run (`getOwner()` / `runWithOwner()` for code after `await`)
- **`list()`** — keyed reconciliation with prefix/suffix trim, DocumentFragment batch insert; a row is exactly the nodes you return (`<tr>` inside `<tbody>`, `<option>` inside `<select>`, `<dt>`+`<dd>`) — no wrapper elements; a row re-renders when the object behind its key is replaced, `index` is a lazy signal, duplicate/missing keys never drop rows
- **`bind()`** — two-way binding (checkbox, radio, select, number)
- **`text()`, `attr()`, `cls()`, `style()`** — single-property reactive bindings
- **`cls(el, { … })`, `styleMap()`** — multi-property reactive bindings
- **`portal()`** — render to a different DOM location
- **`ref()`** — DOM element references
- **Synchronous first render** — `show()`/`list()` inside `html``` render immediately; `flushSync()` for manual inserts. Tests read `action → assert` with no `await nextTick`
- **`list()` options** — `{ key, fallback, transition, item: 'signal' }`; `item: 'signal'` patches a row signal instead of re-rendering when the object behind a key is replaced
- **Faster bindings** — `${sig}` in text and attributes subscribes directly to the node (no effect per binding); `list()` moves the minimum number of rows (LIS): a swap is 2 DOM moves, not 997

### Data
- **`resource()`** — one primitive for async data: `resource(url)`, `resource(() => url)`, `resource({ params, loader })`, `resource(url, { cache: true, staleTime })` (SWR, shared by key, `keepPrevious`), `resource(url, { offline: true })` (IndexedDB + mutation queue). One result shape: `data`, `loading` (first load), `validating` (refetch over data), `stale`, `status`, `error`, `refresh()`, `mutate()`, `abort()`, `ready()`. Structural sharing keeps row identity on refetch, `retry` with backoff, `refetch: { focus, reconnect, interval }` opt-in
- **`mutation()`** — pending, double-submit guard, optimistic update + rollback, `invalidates`
- **`streamResource()`** / **`sse()`** — NDJSON/text streaming into a growing signal; Server-Sent Events writing straight into signals
- **`configure({ csrf: 'django' })`** — CSRF presets (django/rails/laravel/go), default headers, `baseURL`, `timeout`; `request()`/`api.get|post|…` send JSON, add the token, throw `HttpError` with the parsed body; `defaults.fetcher` is the single mocking point
- **`prefetch()` / `prefetchOn(el, url, { on: 'hover' })`** — warm the cache on hover/tap/visible; `infiniteResource()` for cursor pagination
- **`settled()`** — await every in-flight request in tests instead of `sleep(50)`
- **`resource(url, { cache: true })`** — the SWR cache; `invalidate()` revalidates live resources immediately, `revalidateOn: ['focus', 'reconnect']` by default
- **`seed()` / `seedFrom()`** — zero-fetch hydration: the server inlines data, the island renders without a request

  ```html
  <script type="application/json" data-aegis-cache="/api/users?page=1" data-aegis-age="120">[…]</script>
  <div data-aegis="users" data-url="/api/users?page=1"></div>
  ```
  `hydrate()` seeds the cache first, so `resource(data.url, { cache: true, staleTime: 30_000 })` inside the island has its data immediately. `seed(key, data)` also puts a mutation response straight into the cache.
- **`resource(url, { offline: true })`** — IndexedDB cache, one mutation queue per app flushed on reconnect with retry/backoff and Background Sync, `send()` for network writes

### Components
- **`mount()`** — a component with rich context (20+ utilities pre-bound to scope); with a CSS selector as the first argument it is the shorthand form
- **`register()` + `hydrate()`** — server-rendered HTML hydration with lazy strategies (visible, idle, interaction, media)
- **`errorBoundary()`** — catch errors, show fallback
- **Custom Elements** — `element()` for the component form, `defineElement()` for the definition object with signals↔attrs↔props reflection, Shadow DOM, `formAssociated`
- **One component contract** — `const Counter = ({ props, html }) => html`…``; `island('counter', Counter, { types })` for a server island and `element('x-counter', Counter, { props })` for a custom element, same function, `ctx.props` is a reactive object in both

### Forms
- **`form()`** — schema-based with validation rules, dirty/valid tracking, submit with error mapping
- **`wireForm()`** — auto-wire existing `<form>` elements, multi-step wizards, a11y (`aria-invalid`, `aria-describedby`)
- **Files in forms** — `File` values, `maxSize('2MB')` / `mime(['image/*'])` / `maxFiles(n)`, `f.formData()`, `f.preview(key)`
- **Forms** — `submitting`, `submitCount`, `submitError`, `result`, `errors.$form`; server errors mapped from `non_field_errors`/`detail`/RFC 9457 arrays; double-submit guard
- **Leaving, drafts, wizards and accessible errors** — `f.guard()`, `draft()` and `wizard()` cover leaving, drafts and multi-step forms, and errors are accessible without a chorus of live regions: one announcement, `aria-errormessage`, a GOV.UK-style `f.summary()`. Forms grow (`fieldArray`, `addField`, `observe`), an HTML 422 from Rails or Django is morphed onto the live form with its errors harvested from the markup, and `formnovalidate` / intent buttons work exactly like they do without JavaScript. Forms separate truth from display: `f.issues` and `f.valid` are always right, `f.errors` is what the user sees, `f.canSubmit` drives the button, `bind:field=${f.field('email')}` wires touched / aria / `:user-invalid` in one attribute, and submit is a `status` machine with abort, a pending submitter and PRG through the router.
- **Two-way binding to derived values** — `lens(get, set)` and `bind:value=${[get, set]}` bind two-way to any derived or nested value, `signals({ … })` names signals after their keys, and the engine warns when `${count.value}` is dropped into html`` as a one-time snapshot (E048).

### Animation
- **`spring()`** — physics-based spring animation via Web Animations API
- **`flip()`** — FLIP animation for list reordering
- **`animate()`** — View Transitions API with CSS-class fallback
- **`transition()`** — CSS enter/leave transitions
- **One CSS contract for motion** — `.${name}-enter-from|active|to` / `.${name}-leave-*` works in `transition()`, `show(…, { transition })`, `list(…, { transition })` and `animate()`; leave animations finish before nodes are removed, interrupts are safe (no `offsetHeight` reflow dance), `injectStyles()` ships defaults in `@layer aegis`
- **Springs** — `spring()` continues from the current position and velocity when interrupted and compiles to two keyframes + CSS `linear()`; `springSignal()` / `tween()` are values you write `target` to and read `current` from

### Routing & Navigation
- **`router()`** — Navigation API with `popstate` fallback, regex-safe patterns
- **`command()`** — Invoker Commands pattern (delegated click/keydown)
- **`anchor()`** — CSS Anchor Positioning with JS fallback

### Accessibility
- **`trap()`** — focus trap with restore
- **`roving()`** — arrow-key navigation for composite widgets
- **`announce()`** — live region announcements
- **A11y** — `trap(el, { escape, outside, inert })`, `modal(dialog, open)` on native `<dialog>`; an unregistered island prints a ready-to-paste `register()` scaffold
- **Focus and announcements in depth** — `trap()` stacks, recaptures and sees into shadow roots, `roving()` covers grids, trees, typeahead, RTL and the combobox `aria-activedescendant` pattern. Screen readers hear the app: two permanent live regions with a lossless queue, a route announcer with focus reset, focus that moves to a neighbour instead of `<body>` when a row disappears, audible loading / error / saved states and dialogs that name themselves.

### CSS
- **`css\`\``** — Constructable Stylesheets with `<style>` fallback
- **`adoptStyles()`** — deduplicated stylesheet adoption
- **`scopedStyle()`** — `@scope` with class-prefix fallback
- **Styles** — `css.layer('components')```, `scopedStyle()` without touching `el.id` (one sheet per text, ref-counted, removed with the scope)
- **`media()`, `reducedMotion`, `theme()`** — media queries and dark mode as signals with `color-scheme`; `defaults.motion = false` turns animations off for tests and honours prefers-reduced-motion in `spring`/`flip`/`transition`

### Performance
- **`virtualScroll()`** — `content-visibility: auto` virtualization, or `{ mode: 'window' }` for DOM recycling (100k rows → ~30 nodes, `scrollToIndex()`)
- **`lazy()`** — viewport-based lazy loading with skeleton
- **Effect lanes** — `effect(fn, { flush: 'micro' | 'frame' })` coalesces bursts of writes into one run per microtask / frame; `flush()` drains them synchronously
- **Hydration strategies with arguments** — `data-aegis-load="visible(300px)"`, `"idle(1500)"`, `"interaction(click,keydown)"` — one shared IntersectionObserver, the waking event is replayed after mount
- **`stats()`** — flushes, effect runs, live scopes/effects, cache sizes; `dev.profile()` marks every flush in the Performance panel
- **Event delegation, opt-in** — `configure({ delegateEvents: ['click', 'input', 'keydown'] })`: one `document` listener per type, handlers stay on the element with native bubbling order and `stopPropagation`; `@click.direct` for widgets that swallow events
- **Layout as signals** — `size(el)`, `inView(el)`, `viewport()` (observers, never `getBoundingClientRect` inside an effect)

### Debugging
- **Dev mode without setup** — on automatically on localhost / file:// / `?dev` / `localStorage['aegis:dev']`; every warning prints once with what/why/fix; `onWarn()` turns warnings into assertions, `window.__AEGIS_DEV__ = 'strict'` throws `AegisWarning`; lost-reactivity detectors (E019) catch `text(el, count.value)`, `show(count.value > 3, …)` and effects that read no signals; `reset()` isolates tests, `root()` gives a disposable scope
- **Errors that explain themselves** — every effect error carries `e.aegis = { effect, scope, changed }` and the message says which effect, which component and which signals changed; `scope.onError()` / `ctx.onError()` catch them, so `errorBoundary()` finally catches errors after mount; `trace(sig)` prints who wrote a signal, `effect(fn, { trace: true })` prints why it re-ran; a typo in the `ctx` destructuring gets a did-you-mean
- **For assistants** — `llms.txt` (rules + canonical island), `AGENTS.md`, `ERRORS.md` (every warning code)

### Utilities
- **`guardedFetch()`** — auto-abort previous request on new call
- **`debounced()`, `throttled()`, `poll()`** — with auto-cleanup
- **`interval()`, `timeout()`** — scoped timers
- **`observe()`, `resize()`, `mutate()`** — scoped observers
- **`i18n()`** — translation with reactive dictionary
- **`nextTick()`** — post-render callback

---
- **i18n** — plural categories via `Intl.PluralRules`, reactive `t.locale` with lazy dictionaries, `t.num/date/rel/list` formatters; validation messages are localisable (`setValidationMessages`)
