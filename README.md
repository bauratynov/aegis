<p align="center">
  <a href="https://aegisjs.com"><img src="https://aegisjs.com/logo/mark.svg" width="96" alt="Aegis"></a>
</p>

<h1 align="center">Aegis</h1>

<p align="center"><b>Your server renders the page. Aegis makes parts of it alive.</b><br>
One ES module, no build step, no npm. Django, Laravel, Rails, Go, PHP: keep your templates, add <code>data-aegis</code> where the page has to react.</p>

<p align="center">
  <a href="https://aegisjs.com/play/">🎬 Live playground</a> ·
  <a href="https://aegisjs.com">📚 Docs</a> ·
  <a href="https://aegisjs.com/examples/">Examples</a> ·
  <a href="https://aegisjs.com/api/">API reference</a> ·
  <a href="https://aegisjs.com/llms.txt">llms.txt</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/build_step-none-brightgreen" alt="Zero build">
  <img src="https://img.shields.io/badge/dependencies-0-blue" alt="No dependencies">
  <img src="https://img.shields.io/badge/signals%20core-11%20KB%20gzip-orange" alt="Size">
  <a href="https://github.com/bauratynov/aegis/actions/workflows/ci.yml"><img src="https://github.com/bauratynov/aegis/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-1074%20passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

```html
<!-- rendered by Django / Rails / Laravel / Go / PHP … -->
<div data-aegis="counter" data-start="5">
    <button>Clicked 5 times</button>
</div>

<script type="module">
import { island } from 'https://aegisjs.com/0.7.0/aegis.min.js';

island('counter', ({ props, signal, html }) => {
    const count = signal(props.start);
    return html`<button @click=${() => count.value++}>Clicked ${count} times</button>`;
}, { types: { start: Number } });
// no mount() call: every [data-aegis] on the page is hydrated after island()
</script>
```

That is the whole setup. The server HTML is visible before JavaScript runs and indexed by search engines; the island replaces it with a live template and keeps working after any server-driven swap.

- **Server HTML stays the source of truth.** No Node SSR, no client tree that re-renders what the server already sent.
- **A form works without JavaScript.** `wireForm()` only improves it: live validation, 422 errors on the right fields.
- **An island hydrates inside htmx, Turbo or jQuery pages.** Markup inserted later wakes up too.
- **21 KB gzip for islands + templates, zero dependencies, one file you can read.** Pin a version, add a hash, ship.

Start here: [Getting started](https://aegisjs.com/docs/getting-started/) (a `base.html` for Django, Laravel, Rails and Go) · [from Alpine](https://aegisjs.com/docs/from-alpine/) · [with htmx](https://aegisjs.com/docs/with-htmx/) · [when not to use Aegis](https://aegisjs.com/docs/when-not-to-use/).

## Why Aegis

You have a server that renders HTML and you want parts of the page to be alive: a search box, a form with validation, a table, a cart. The usual answer is a bundler, a component framework and a second rendering stack. Aegis is the other answer, and its neighbours are the other libraries that live inside server HTML.

| | Aegis | Alpine | Petite-Vue | htmx | Stimulus | Lit |
|---|---|---|---|---|---|---|
| Build step | none | none | none | none | none (or a bundler) | usually a bundler |
| Size, gzip | 21 KB islands + templates (4 KB signals, 91 KB everything) | 15 KB | 6 KB | 14 KB | 11 KB | 16 KB |
| Server HTML | adopted as is; `swap()` morphs fragments; islands survive swaps | directives on the markup | directives on the markup | swapped as strings | controllers on the markup | replaced by shadow DOM |
| Reactivity | signals, computeds, effects; glitch-free, batched | proxy + directives | proxy + directives | none (server round-trip) | none (imperative) | properties → re-render |
| Templates | `html``` in JavaScript, parsed once, CSP-safe; keyed `list()` | `x-for` / `x-text` in HTML | `v-for` / `{{ }}` in HTML | HTML from the server | targets in HTML | `html``` (lit-html) |
| Data | `resource()`: cache, revalidation, ETag, offline, optimistic patches | none | none | requests per attribute | none | none |
| Forms | Constraint Validation, schemas, 422 mapping, wizards, drafts | none | none | server-side | none | none |
| Navigation | Navigation API router, `boost()` for server pages, View Transitions | none | none | `hx-boost` | Turbo | none |
| Dev warnings | 60+ codes: what / why / fix, source position | none | none | none | none | none |

The honest reading of the table: Alpine and Petite-Vue are smaller and fine for a dropdown; htmx is the right call when the server can render every state; Aegis is for the pages where you would otherwise reach for a component framework — a table with search and paging, a form with server errors, a cart, an admin screen — and want to keep the server templates.

**Aegis is not a React replacement.** If you have a single-page application, a React team and a component ecosystem you rely on, stay there. The comparison that matters for Aegis is “bundler + framework + data library on top of a server app” against “one file inside the server app”, and the same todo list is 18 lines in Aegis, 22 in React and 18 in Vue: see it side by side in the [playground](https://aegisjs.com/play/?preset=todos) (tab “vs React / Vue”).

## When not to use Aegis

- **A single-page application with client-side routing for everything.** Aegis has a router, but its home is a server that renders pages; if the server only serves JSON, a SPA framework fits better.
- **A team that lives in JSX and the React ecosystem.** Storybook, React Native, thousands of components: those are not Aegis, and they are not coming.
- **A dropdown or a tab strip on a static page.** Alpine or Petite-Vue is smaller and enough.
- **Every state rendered by the server.** If htmx alone covers the page, add Aegis only for the islands that need client state.
- **Browsers without ES modules.** Aegis ships as an ES module; there is no ES5 build.

## What can you build with it

- **Admin panels and dashboards on any backend** — Django, Rails, Laravel, Yii, Go, PHP: keep server templates, add islands where the page has to react. The [admin demo](https://aegisjs.com/demo/admin.html) is a router, a table with search and paging, optimistic mutations, forms with server errors and a 50 000-line virtual log in one file.
- **Progressive forms** — a plain `<form>` works without JavaScript; `wireForm()` adds live validation, async rules, server 422 errors on the right fields, wizards and drafts.
- **Search, filters, infinite lists** — `resource()` turns a query signal into requests that abort, dedupe, cache and revalidate; `list()` keeps rows keyed.
- **Content sites that stay server-first** — `swap()` and `boost()` navigate and patch server fragments with morph, View Transitions and prefetch on intent; islands survive.
- **Widgets in someone else's page** — an island is one `data-aegis` attribute; `hydrate(root, { watch: true })` wakes markup inserted by htmx, Turbo or jQuery.
- **Offline-capable tools** — `resource(url, { offline: true })` persists to IndexedDB and replays a mutation queue on reconnect.

Runnable versions of every example: the [examples catalogue](https://aegisjs.com/examples/) (24 patterns, each editable on the page), [`recipes/`](./recipes/) in this repository, the [playground](https://aegisjs.com/play/) and [`demo/admin.html`](./demo/admin.html).

---

## Mental model — 4 rules

1. **`${x.value}` is a snapshot, `${x}` and `${() => …}` are live.** A signal or a function in a template re-renders on change; a plain value renders once (dev warns with E019).
2. **Everything lives in a scope.** Effects, listeners, timers and resources created inside `island()` / `component()` / `mount()` die with the component. Outside a scope you get E001.
3. **Use the `ctx` versions.** `on`, `effect`, `interval`, `observe` from the setup context are bound to the component's scope; the imported ones are not.
4. **Data never goes through `innerHTML`.** Data goes through `${}` in `html``` (text nodes, never parsed). Server HTML goes through `swap()` / `adopt()`.

---

## The canonical API

Aegis exports a lot (about 170 names, most of them small helpers). The API has three tiers:

- **Core, ten names, enough for most pages:** `signal`, `computed`, `effect`, `batch`, `html`, `island`, `mount`, `resource`, `wireForm`, `swap`.
- **Extended:** everything else — helpers for specific jobs (router, forms, cache, motion, accessibility). Same file, same guarantees; a bundler or `build.mjs` leaves out what you do not import.
- **Deprecated:** older aliases still work and are marked `@deprecated` in `aegis.d.ts` with their replacement; they are removed in 1.0 and not documented here.

| Job | Use | Not |
|---|---|---|
| Component on a server page | `island(name, Component, { types })` | `register()` (low-level; keep for `{ load }`) |
| Component anywhere else | `mount(el, Component)` | `component()` |
| Custom element | `element(tag, Component, { props })` | `defineElement()` |
| State | `signal`, `computed`, `effect`, `reactive` | `store()` |
| Template | `html```, `when`, `list`, `show` | `text`/`attr`/`cls`/`style` (for adopting existing DOM) |
| Data | `resource(url, { cache, offline, params, loader })`, `mutation`, `api`, `invalidate('/api/users*')` / `invalidate(['users'])` | `cachedResource()`, `offlineResource()` |
| Forms | `wireForm(formEl)` for server forms, `form(defaults)` for virtual ones | — |
| Server HTML | `swap`, `adopt`, `boost` | `innerHTML` with data |
| Router | `router({ '/users/:id': { loader, component: Page } }, { outlet, hash })` — `props = params + { data, query }` | `handler` + manual `mount()` |

`Component` is one contract everywhere: `({ props, html, signal, on, … }) => Node | api | void`.

---

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
- **Store** — definition-based reactive container (properties → signals, getters → computeds, methods → actions, auto-batched)
- **Interop** — `from()` turns an EventTarget, a producer or any `{ subscribe }` (Preact, RxJS, Svelte store) into a signal; `history()` gives undo/redo for a signal, `reactive()` or `store()`
- **`reactive()` 2.0** — getters become computeds, methods become batched actions, `$patch` / `$subscribe` / `$snapshot` / `$reset`; only plain objects and arrays are wrapped (Date/Map/File stay as they are); `store()` = `reactive(obj, { shallow: true })`
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
- **`clsMap()`, `styleMap()`** — multi-property reactive bindings
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
- **`cachedResource()`** — alias of `resource(url, { cache: true })`; `invalidate()` revalidates live resources immediately, `revalidateOn: ['focus', 'reconnect']` by default
- **`seed()` / `seedFrom()`** — zero-fetch hydration: the server inlines data, the island renders without a request

  ```html
  <script type="application/json" data-aegis-cache="/api/users?page=1" data-aegis-age="120">[…]</script>
  <div data-aegis="users" data-url="/api/users?page=1"></div>
  ```
  `hydrate()` seeds the cache first, so `cachedResource(data.url, { staleTime: 30_000 })` inside the island has its data immediately. `seed(key, data)` also puts a mutation response straight into the cache.
- **`offlineResource()`** — alias of `resource(url, { offline: true })`: IndexedDB cache, one mutation queue per app flushed on reconnect with retry/backoff and Background Sync, `send()` for network writes

### Components
- **`component()`** — mount with rich context (20+ utilities pre-bound to scope)
- **`mount()`** — shorthand with CSS selector
- **`register()` + `hydrate()`** — server-rendered HTML hydration with lazy strategies (visible, idle, interaction, media)
- **`errorBoundary()`** — catch errors, show fallback
- **Custom Elements** — `defineElement()` with signals↔attrs↔props reflection, Shadow DOM, `formAssociated`
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

## Quick Start

### An island on a server page

```html
<ul data-aegis="likes" data-url="/api/likes" data-count="12">
    <li>12 likes</li>   <!-- server HTML shows while JS loads; replaced by the island's template -->
</ul>

<script type="module">
import { island, mutation, api } from './aegis.js';

island('likes', ({ props, signal, html }) => {
    const count = signal(props.count);
    const like = mutation(() => api.post(props.url), { optimistic: () => count.value++ });
    return html`<li>${count} likes <button @click=${like} ?disabled=${like.pending}>♥</button></li>`;
}, { types: { count: Number } });
</script>
```

### Todo list

```js
import { mount } from './aegis.js';

mount('#app', ({ signal, html, list }) => {
    const todos = signal([]);
    const draft = signal('');
    const add = () => {
        if (!draft.value.trim()) return;
        todos.value = [...todos.value, { id: Date.now(), text: draft.value, done: false }];
        draft.value = '';
    };
    const toggle = (t) => { todos.value = todos.value.map(x => x === t ? { ...x, done: !x.done } : x); };

    return html`
        <form @submit.prevent=${add}>
            <input bind:value=${draft} placeholder="What needs doing?">
            <button ?disabled=${() => !draft.value.trim()}>Add</button>
        </form>
        <ul>
            ${list(todos, (t) => html`<li class=${{ done: t.done }} @click=${() => toggle(t)}>${t.text}</li>`, { key: 'id' })}
        </ul>
    `;
});
```

### Data fetching

```js
import { island, resource } from './aegis.js';

island('users', ({ props, html, when, list }) => {
    const users = resource(props.url, { cache: true, staleTime: 30_000 });   // { data, loading, validating, error, refresh }
    return when(users, {
        loading: () => html`<p class="skeleton">Loading…</p>`,
        error: (e, retry) => html`<p>${e.message} <button @click=${retry}>Retry</button></p>`,
        data: (rows, rowsSignal) => html`<ul>${list(rowsSignal, (u) => html`<li>${u.name}</li>`, { key: 'id' })}</ul>`,
    });
});
```

No `innerHTML`, no manual `createElement` in an effect: `when()` picks the branch, `list()` keeps rows keyed, `resource()` owns the async state.

### The cache, explained

`resource(url, { cache: true })` is an SWR cache with canonical keys (query order does not matter; array keys `['users', id]`; `{ params, loader }`), `staleTime`/`cacheTime`, request dedupe, per-entry generations (a `refresh()` during an in-flight request never returns pre-mutation data), structural sharing by `id`, `prefetch()`/`seed()` freshness, `invalidate('/api/users*')` returning a Promise that `mutation({ invalidates })` awaits. When you need to see what it is doing:

```js
import { cache } from './aegis.js';
cache.get('/api/users');            // data without a request or a subscription
cache.explain('/api/users?page=2'); // { state: 'stale', why: 'age 41 s ≥ staleTime 30 s — …', suggestedStaleTime: 120000, history: [...] }
cache.stats();                      // every entry: age, subscribers, size, fetches, unchanged; prefetch hit/waste per trigger
cache.on((key, ev) => …);           // 'mount/fetch', 'focus/fresh', 'invalidate/fetch' — assertions in tests
```

The cache is bounded — `configure({ cache: { maxEntries: 500, maxBytes } })`, SIEVE eviction among idle entries, `pin: true` for reference data — and revalidation (focus, reconnect, `interval`) goes through one scheduler that coalesces events, prioritises visible and stale entries, paces requests and applies events from a hidden tab when you come back. It speaks HTTP: `ETag` → `If-None-Match` → 304 without a body, `staleTime: 'http'` takes freshness from `Cache-Control`/`Age`/`Expires`, `staleTime: 'auto'` derives it from the observed read and change rates, and a mutation response can invalidate keys server-side with `Aegis-Invalidate: /api/users*, /api/stats`. `configure({ breaker, retryBudget })` protects your API when it is down: fail-fast per origin and a bounded retry amplification. Optimistic updates are a patch log: a failed mutation rolls back only its own change, concurrent edits survive, and `mutation({ commit, updates, patch, onConflict })` lets a server response update lists in place, fan an entity out to every list (`configure({ identify })`) and resolve a 412 with a built-in 3-way merge. `cache: { persist: true }` keeps entries in IndexedDB and hydrates the next session from disk before the first request; entries are versioned and synchronised between tabs over `BroadcastChannel`, `leader()` elects one tab via Web Locks, and the offline queue is an append-only log with `Idempotency-Key` headers, FIFO per key and a dead-letter list.

Speculative requests have a budget: every speculative request obeys one network budget (`configure({ speculation })`: Save-Data, 2g and reduced-data switch it off, a concurrency cap turns bursts into a queue) and one intent detector (hover fires when the cursor slows down, cancels on a fly-by); the router preloads route `loader` data before the click, `predictor()` learns the user's route transitions (with a server prior from `<script data-aegis-predict>`) and warms the likely next page in idle time, and `speculate()` emits Speculation Rules for server-first pages.

The DevTools panel has a **cache** tab with the same data, age bars and invalidate/remove/explain buttons. `fakeClock()` from `aegis/test` makes `staleTime`, `cacheTime` and garbage collection deterministic. The engine warns when `staleTime` is far below the observed change rate (E042) or when a prefetch trigger wastes most of what it warms (E043).

---

## Benchmarks

`bench.html` — a js-framework-benchmark-style table (1,000 rows, `list()` + `html```) plus the reactive core. Median of 5 runs, headless Chrome, ms:

| DOM (1,000 rows) | ms | Core | ms |
|---|---|---|---|
| create | 17.1 (12.7 with `delegateEvents`) | deep chain 100 computeds × 1,000 writes | 9.4 |
| replace all | 14.3 | fan-out 1,000 effects × 100 writes | 10.4 |
| update every 10th | 0.5 | diamond × 100,000 | 30.5 |
| select row | 0.1 | batch 1,000 signals × 100 | 2.5 |
| swap rows (2 `insertBefore` calls) | 0.4 | `html``` × 1,000, static | 3.5 |
| remove row | 0.1 | `html``` × 1,000, 2 signal bindings | 4.4 |
| append 1,000 | 13.4 | `reactive()` filter 100k rows in an effect | 30 |
| create 10,000 | 146.6 (131.5 with `delegateEvents`) | `reactive()` for..of 100k rows | 20 |
| clear | 12.5 | `reactive()` wrap 100k rows, heap | 17 MB |

Run it yourself: serve the folder and open `bench.html` — the numbers are in `<pre>` and `window.__bench`. The same three jobs next to Alpine and Vue, in your browser: [aegisjs.com/bench/](https://aegisjs.com/bench/) (a 10 000-row table, a search filter, an optimistic PATCH).

---

## Verified by design

The reactive core is the part of a framework that must be right, so it is the part with the most adversarial tests. All of them run with `npm test`; nothing needs a browser.

| Check | What it proves | Command |
|---|---|---|
| Model-based fuzzer | random graphs of signals, computeds and effects against an oracle: consistency, no glitches, no wasted runs, at most one compute per change, no leaks after dispose; 1 000 seeds, plus a fault fuzzer that throws inside computeds | `node --test test-core.mjs` (uses `fuzz-graph.mjs`) |
| Scheduler simulation | the deadline scheduler keeps input latency under budget while draining transition and idle work: p98 of a 10 000-event trace | `npm run test:sched` |
| Prefetch simulation | the intent detector and the network budget: hit rate and wasted bytes on synthetic sessions | `npm run test:prefetch` |
| Export set and types | every runtime export is declared in `aegis.d.ts` and vice versa; `tsc` over `test-types.ts` | `node check-exports.mjs`, `tsc -p tsconfig.types.json` |
| Size budgets | tree-shaken subsets stay under their gzip budgets and never pull the cache, forms or IndexedDB into a light build | `npm run test:shake` |
| Graph contracts | in dev mode the engine checks its own invariants (no dangling subscriptions, scope tree is a tree, ownership is single) on sampled flushes; `dev.contracts = 'strict'` checks every flush in the browser suite | part of `test.html` |

The properties behind the fuzzer: pull-based evaluation without glitches, write backdating inside `batch()`, an earliest-deadline-first scheduler, dispose as a transaction, and provenance ordering of effects (Kahn over writer → reader edges). Run the fuzzer yourself before trusting the README.

The node suite covers the signal graph only. The DOM, templates, islands, lists and morph, the router, forms, the cache and offline are covered by the browser suite: `test.html`, 1 075 assertions in about 50 sections, run in headless Chrome and Firefox by `npm run test:browsers`. A green node run says the core is right; it says nothing about the UI layer.

What the tests do **not** promise, so you do not have to find out yourself:

- An `effect()` created outside any scope is a leak that is reported (E001), not prevented; `window.__AEGIS_DEV__ = 'strict'` makes it throw.
- `untrack()` inside a computed means that source is not a dependency: the cached value stays until a tracked source changes. Correct, and a trap.
- An effect cycle is stopped by a round ceiling and reported (E027); it is not silently resolved.
- Graph contracts run on sampled flushes in dev (`dev.contracts = 'sampled'`); the browser suite runs with `'strict'`.
- An effect error with no `onError` / `scope.onError` goes to `reportError` (a `window` error event; the page keeps running) or, in node, to `console.error`. Put a boundary where you want one.

## Testing

`aegis/test` is a dependency-free helper set for any browser runner (the repo's `test.html`, Vitest browser mode, Playwright, Web Test Runner):

```js
import { render, fire, waitFor, mockFetch, cleanup } from 'aegis/test';

const net = mockFetch({ 'GET /api/users': () => [{ id: 1, name: 'Ada' }], 'DELETE /api/users/:id': () => ({ status: 204 }) });
const t = render(Users);                       // the same Component contract as island() / mount()
await waitFor(() => t.findAll('tr').length === 1);
fire.click(t.find('button.delete'));           // real DOM events: click, input, submit, key, focus…
await waitFor(() => t.text().includes('0 rows'));
expect(net.last().method).toBe('DELETE');
cleanup();                                     // unmount, restore fetch, reset engine singletons
```

`waitFor` drains effects, pending resources and mutations between checks, so tests never need `sleep()`. `npm run test:browsers` runs the engine's own suite in headless Chrome and Firefox, `npm run test:webkit` in Playwright WebKit; CI runs all three on every push.

---

## Background tabs, timers and reduced motion

Browsers throttle hidden tabs: `setTimeout`/`setInterval` fire at most once per second (once per minute after 5 minutes in Chrome), `requestAnimationFrame` does not fire at all, and the whole tab may be frozen. Signals, effects and DOM updates keep working synchronously; only time-based helpers are affected:

- `debounced()`, `throttled()`, `interval()`, `timeout()`, `@input.debounce.N` — fire late, in order, never twice.
- `poll()` sleeps in a hidden tab by default (`{ background: true }` to keep polling); `resource({ refetch: { focus } })` refetches when the tab becomes visible.
- Transitions and `spring()`/`tween()` are rAF-driven; a 40 ms timer fallback finishes the CSS contract so `hidden` and classes never get stuck.
- `virtualScroll({ mode: 'window' })` recomputes its window on `visibilitychange`.
- `resource({ offline: true })` yields its IndexedDB connection when another tab upgrades the database and reports a blocked upgrade instead of hanging.

`prefers-reduced-motion` (an OS setting) turns every transition into an instant state change (`defaults.motion === 'auto'`). Tests and demos should pin `defaults.motion = true` or `false` explicitly.

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge / Opera / Brave / Yandex (Chromium 105+) | full; Navigation API router, View Transitions, `precommitHandler` guards from Chromium 138 |
| Firefox 101+ | full; the router uses the History API path (no Navigation API), guards run before `pushState` |
| Safari 16.4+ | full; the router uses the History API path, `css()` needs no fallback |
| Safari < 16.4 | the reactive core, templates, islands, forms and data work; `css()` needs a fallback |

The reactive core, DOM rendering, islands, forms, the cache and routing work in any browser with ES modules. Navigation API, CSS Anchor Positioning, View Transitions, `CloseWatcher`, Background Sync and `CompressionStream` are progressive: when a browser lacks one, the same call takes the older path and the behaviour is the same, minus the platform extra (one history entry instead of a pre-commit guard, a keydown listener instead of `CloseWatcher`). The suite runs in headless Chrome, Firefox and WebKit on every push ([CI](https://github.com/bauratynov/aegis/actions/workflows/ci.yml)).

---

## Distribution

| File | Use |
|---|---|
| `aegis.js` | readable source — read it, let an assistant modify it, debug with it |
| `aegis.min.js` (+ `.map`) | everything with dev warnings — 108 KB gzip (91 KB as a production build, see below) |
| `aegis.core.js` / `aegis.core.min.js` | signals + scope only — 11 KB gzip minified |

### With a bundler: pay for what you import

The source is one side-effect-free ES module (`"sideEffects": false`), so esbuild, Rollup and Vite tree-shake it by named import. Heavy parts (cache, forms, offline, router, transitions, the request layer) attach to the light ones through a late-binding registry, so `signal` or `component` alone never drag them in. Pass `define: { 'globalThis.AEGIS_PROD': 'true' }` to your bundler for a production build: every warning text and dev-only detector is folded away. Measured with `node build.mjs --subsets` (minified, gzip):

| You import | dev | production |
|---|---|---|
| `signal, computed, effect, batch, createScope` | 7.7 KB | 4.3 KB |
| `island, mount, html, list, show, when, hydrate` + events and `bind` | 30 KB | 21 KB |
| + `resource, mutation, api, settled` | 48 KB | 37 KB |
| + `form, wireForm` and rules | 64 KB | 52 KB |
| + `router` | 70 KB | 59 KB |
| everything (`aegis.min.js`) | 108 KB | 91 KB |

`npm test` includes `test-shake.mjs`, which fails the build if a light subset starts pulling in the cache, the form messages, the request layer or IndexedDB again.

Things a component reaches through `ctx` (`ctx.fetch`, `ctx.when`, `ctx.show`, `ctx.list`) and the `{ transition }` option of `show()`/`list()` are only in the bundle when the matching export (`api`, `when`, `show`, `list`, `transition`) is imported somewhere in the app; otherwise they throw a one-line error telling you what to import. The full file has everything, so zero-build pages never see this.

### Without a bundler: build the subset once

No bundler in the project? Let the repo build the subset for you — it reads the `import { … } from 'aegis'` line of your app and emits one tree-shaken, production ES module:

```sh
node build.mjs --from ../app/assets/js/admin.js --out ../app/assets/js/aegis.js   # only what admin.js imports, no dev texts
node build.mjs --from ../app/assets/js/admin.js --out aegis.dev.js --dev          # same, with warnings for development
node build.mjs --exports signal,effect,html,mount,list --out aegis.custom.js      # or name the exports by hand
node build.mjs --from app.js --list                                                # print what was kept
```

A 15-export admin bundle comes out at 14 KB gzip. Unknown names fail the build instead of failing in the browser. Otherwise take `aegis.min.js` (warnings included, they only fire on localhost) or `aegis.core.min.js`; the full file is the same code, nothing is duplicated between the two. `globalThis.AEGIS_PROD = true` before the import silences warnings at runtime without a build.

```html
<script type="importmap">{ "imports": { "aegis": "https://aegisjs.com/aegis.min.js" } }</script>
```
`npm run build` regenerates the minified files (esbuild, dev dependency only — users never build).

## Installation

### Pinned, with a hash (recommended)

Every release is served from `https://aegisjs.com/<version>/` and never changes; the import map carries the integrity hash, so the browser refuses a file that does not match:

```html
<script type="importmap">
{
  "imports": { "aegis": "https://aegisjs.com/0.7.0/aegis.min.js" },
  "integrity": { "https://aegisjs.com/0.7.0/aegis.min.js": "sha384-IlZI8EunTsg50qmYrO6AIH/tIHqkkD1bZZIIln8MQrwlRKLz8NuE+aW5umJBGDgu" }
}
</script>
<script type="module">
import { island, html } from 'aegis';
</script>
```

The same files with hashes for every version: [aegisjs.com/docs/installation](https://aegisjs.com/docs/installation/). `https://aegisjs.com/aegis.js` without a version is the latest release, for experiments only. The files on the site are the files in this repository at the tag; the jsDelivr mirror works too: `https://cdn.jsdelivr.net/gh/bauratynov/aegis@v0.7.0/aegis.min.js`.

### Vendored

Copy `aegis.js` (or `aegis.min.js` + `.map`) into your static folder next to your templates — it is one file with no dependencies. `aegis.core.js` is the signals + scope subset for non-DOM code.

```html
<script type="module">
import { signal, island, html } from './aegis.js';
</script>
```

### Only what you use, without a bundler

Three lines: the repo reads the `import { … } from 'aegis'` line of your app and writes one tree-shaken production module.

```sh
git clone https://github.com/bauratynov/aegis && cd aegis
node build.mjs --from ../app/static/js/admin.js --out ../app/static/js/aegis.js
# → one file with exactly the exports admin.js imports (a 15-export admin bundle is 14 KB gzip); unknown names fail here, not in the browser
```

### npm

Not published yet; the package name is being settled. The `exports` map (`.`, `./min`, `./core`, `./core/min`) is ready for it.

---

## TypeScript

Aegis ships with hand-authored `.d.ts` declarations, checked against the runtime on every `npm test` (`tsc` over `test-types.ts` + an export-set diff). No build step needed:

```js
// @ts-check
import { signal, computed, resource, form, minLen } from './aegis.js';

const count = signal(0);                          // Signal<number>
const doubled = computed(() => count.value * 2);  // Computed<number>
const users = resource('/api/users', { initial: [] as User[] });   // data: Signal<User[]> — no null
users.error.value instanceof HttpError && users.error.value.status; // narrowing works
form({ age: { value: 0, rules: [minLen(3)] } });  // error: minLen is a ValidationRule<string>
```

Route params are inferred from the pattern (`'/users/:id'` → `{ id: string }`), `element('x-counter', Counter, { props: { count: { type: Number, default: 0 } } })` types `ctx.props.count` as `number`, `i18n(dict)` types `t(key)` by the dictionary keys. Full IntelliSense in VS Code out of the box.

---

## Dev Mode

Enable dev-mode warnings for better error messages:

```html
<script>window.__AEGIS_DEV__ = true;</script>
<script type="module" src="./aegis.js"></script>
```

Warnings include:
- `E001` — Effect created outside scope (memory leak risk)
- `E002` — Signal written inside computed (purity violation)
- `E003` — `mount()` with non-existent selector
- `E027` — effects ping-pong (a flush took many rounds)
- `E028` — zombie binding: a node left the document but its effect keeps updating it
- `E029` / `E030` — the same URL fetched by two `resource()` instances / fetched in a loop
- `E031`–`E037` — a Promise or object rendered as text, a typo in `@event` (with did-you-mean), Vue/Alpine/mustache syntax inside `html```, a handler that was called instead of passed, `undefined` in a resource URL, `html()` without the tag, a URL no route matches

In production the warnings are silent. Two things are not warnings and stay on: `defaults.orphanEffects = 'throw'` makes an `effect()` outside a scope an error (or `'root'` adopts it into an app-level scope; the default `'warn'` is a dev-only warning and the effect leaks), and an effect error that no `onError` handles marks the component's host with `data-aegis-error="<effect name>"` before it goes to `reportError`, so a CSS rule can show a fallback while the other islands keep running. In CI run the suite with `window.__AEGIS_DEV__ = 'strict'`: every warning becomes a thrown `AegisWarning`.

Every warning says what happened, why, how to fix it, where (`component:div#app ‹ list:row`), which element (clickable in the console) and the source position (`At: /js/app.js:42:15` — the `html``` template, `effect()` or `resource()` call that caused it) with the line of your file and a caret under the exact `${}`:

```
⚠ [Aegis:E034] html``: @click got undefined instead of a function.
  Why: The handler is undefined — a misspelled name, a missing import, or a method read off a plain object (this is lost).
  Fix: Pass the function itself: @click=${save} or @click=${() => save(id)}. Use null/false to skip a handler conditionally.
  Where: component:div#app
  At: /js/users.js:44:23
  46 | <button @click=${handleSave}>Save</button>
                      ^^^^^^^^^^^^^ value #2
  Docs: Aegis.dev.explain('E034')
```

No compiler is involved: in dev mode the file is fetched once and the template literal is matched against its own static parts. It ends with `Aegis.dev.explain('E0xx')` for the long version. In dev mode warnings also show up as toasts in the page corner — click one to open the inspector on that element (`Aegis.dev.overlay = false` to keep them in the console only).

Every code (E0xx and S0xx) with the fix for each: [ERRORS.md](./ERRORS.md).

Open the in-page inspector — `Aegis.dev.panel()` from the console or `?aegis-devtools` in the URL. It is `aegis-devtools.js` (built with Aegis, Shadow DOM, no extension): a live component tree that highlights the element on hover, signals with current values and change marks, `trace` per signal, effects with their dependencies, engine stats, slow effects under `profile`, warnings.

Or from the console:

```js
Aegis.dev.of($0)        // signals, effects and their deps of the island under the selected element
Aegis.dev.inspect()     // JSON snapshot of every component — paste it into a chat with an assistant
Aegis.dev.graph()       // dependency graph as Mermaid
Aegis.stats()           // { flushes, effectRuns, maxRounds, scopes, effects, components, … }
```

Zero cost in production — warnings are gated behind `window.__AEGIS_DEV__`.

---

## Philosophy

1. **Zero build** — Drop one file, start building. No webpack, no vite, no npm required.
2. **Zero dependencies** — Everything is self-contained. No supply chain risk.
3. **Safety by architecture** — Everything created inside a scope dies with it; data never goes through `innerHTML`; attribute sinks are typed at compile time. What the architecture cannot prevent (an effect created outside any scope, a disposed computed still read, an effect cycle) the dev build reports with a code, a why and a fix, and `'strict'` mode turns into an exception.
4. **Progressive enhancement** — Use as little or as much as you need. Each API is independent.
5. **Future-ready** — Built on emerging browser standards (TC39 Signals, Navigation API, CSS Anchor Positioning, View Transitions), with fallbacks for today.

---

---

## FAQ

**Q: Is it really zero build?** A: Yes. `aegis.js` is one ES module. Import it from a URL or copy the file next to your templates; the `html\`\`` templates are parsed by a tokenizer at runtime, once per template, and cached. A bundler is optional and only buys tree-shaking.

**Q: How is this different from htmx or Alpine?** A: htmx swaps HTML strings; Alpine adds small behaviours. Aegis does both of those (`swap()`, islands) and also has what they leave to you: signals with a dependency graph, a cache with SWR/ETag/offline, a form layer, a router. It is one file with everything, and each part is independent.

**Q: Does the server have to render with JavaScript?** A: No. Any server HTML works. An island adopts the markup that is already there; `adopt()` binds a template to existing DOM with zero mutations; `swap()` and `boost()` bring server fragments in without rewriting them on the client.

**Q: What about TypeScript?** A: Hand-authored `aegis.d.ts` ships with the file and is checked against the runtime on every test run. No build needed: `// @ts-check` in a plain `.js` file gives full IntelliSense.

**Q: How big is it really?** A: What you import. Signals and scopes alone are 11 KB gzip; islands, templates, lists and events 21 KB; everything with the cache, forms and the router 91 KB as a production build. `node build.mjs --from app.js` emits exactly the subset your app imports.

**Q: Is it production-ready?** A: It runs the admin of a commercial product with a 15-export custom build (22 KB gzip) and passes 1 072 tests in headless Chrome and Firefox on every commit. The API is stable; older names stay as `@deprecated` aliases.

**Q: Can an AI assistant write Aegis code?** A: That is a design goal. [`llms.txt`](./llms.txt) holds the rules assistants get wrong most, [`AGENTS.md`](./AGENTS.md) the working contract, [`ERRORS.md`](./ERRORS.md) every warning with its fix, and the dev build explains mistakes in the console with the source position.

## Contributing

Bug reports and pull requests are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md) for the test suite, the conventions and how a change gets in. Security issues go to the address in [SECURITY.md](./SECURITY.md), not the issue tracker.

## Citation

```bibtex
@software{aegis2026,
  author = {Atinov, Baurzhan},
  title  = {Aegis: a zero-build reactive UI engine for server-rendered pages},
  year   = {2026},
  url    = {https://github.com/bauratynov/aegis}
}
```

## License

[MIT](LICENSE). Free for commercial use, attribution appreciated.

Created by Baurzhan Atinov (Kazakhstan) · [aegisjs.com](https://aegisjs.com) · bauratynov@gmail.com
