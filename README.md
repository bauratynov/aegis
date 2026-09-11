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
  <img src="https://img.shields.io/badge/tests-1085%20passing-brightgreen" alt="Tests">
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

<p align="center"><img src="https://raw.githubusercontent.com/bauratynov/aegis/main/assets/hydrate.gif" width="720" alt="The server-rendered button is visible first; island() hydrates it in place and each click changes one text node"></p>

That is the whole setup. The server HTML is visible before JavaScript runs and indexed by search engines; the island replaces it with a live template and keeps working after any server-driven swap.

- **Server HTML stays the source of truth.** No Node SSR, no client tree that re-renders what the server already sent.
- **A form works without JavaScript.** `wireForm()` only improves it: live validation, 422 errors on the right fields.
- **An island hydrates inside htmx, Turbo or jQuery pages.** Markup inserted later wakes up too.
- **30 KB gzip for islands + templates, zero dependencies, one file you can read.** Pin a version, add a hash, ship.

Start here: [Getting started](https://aegisjs.com/docs/getting-started/) (a `base.html` for Django, Laravel, Rails and Go) · [from Alpine](https://aegisjs.com/docs/from-alpine/) · [with htmx](https://aegisjs.com/docs/with-htmx/) · [when not to use Aegis](https://aegisjs.com/docs/when-not-to-use/).

## Why Aegis

You have a server that renders HTML and you want parts of the page to be alive: a search box, a form with validation, a table, a cart. The usual answer is a bundler, a component framework and a second rendering stack. Aegis is the other answer, and its neighbours are the other libraries that live inside server HTML.

| | Aegis | Alpine | Petite-Vue | htmx | Stimulus | Lit |
|---|---|---|---|---|---|---|
| Build step | none | none | none | none | none (or a bundler) | usually a bundler |
| Size, gzip | 30 KB islands + templates (7 KB signals, 93 KB everything) | 15 KB | 6 KB | 14 KB | 11 KB | 16 KB |
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
2. **Everything lives in a scope.** Effects, listeners, timers and resources created inside `island()` / `mount()` die with the component. Outside a scope you get E001.
3. **Use the `ctx` versions.** `on`, `effect`, `interval`, `observe` from the setup context are bound to the component's scope; the imported ones are not.
4. **Data never goes through `innerHTML`.** Data goes through `${}` in `html``` (text nodes, never parsed). Server HTML goes through `swap()` / `adopt()`.

---

## The canonical API

Aegis exports a lot (about 160 names, most of them small helpers). The API has three tiers:

- **Core, ten names, enough for most pages:** `signal`, `computed`, `effect`, `batch`, `html`, `island`, `mount`, `resource`, `wireForm`, `swap`.
- **Extended:** everything else — helpers for specific jobs (router, forms, cache, motion, accessibility). Same file, same guarantees; a bundler or `build.mjs` leaves out what you do not import.
- **Removed in 0.8:** the old aliases `clsMap`, `store`, `cachedResource`, `offlineResource` and `component` are gone; `cls(el, { … })`, `reactive(obj, { shallow: true })`, `resource(url, { cache: true })`, `resource(url, { offline: true })` and `mount()` are the names. Nothing in the file is marked `@deprecated`.

| Job | Use | Not |
|---|---|---|
| Component on a server page | `island(name, Component, { types })` | `register()` (low-level; keep for `{ load }`) |
| Component anywhere else | `mount(el, Component)` | — |
| Custom element | `element(tag, Component, { props })` | `defineElement()` (low-level definition object; keep for reflection and `formAssociated`) |
| State | `signal`, `computed`, `effect`, `reactive` | — |
| Template | `html```, `when`, `list`, `show` | `text`/`attr`/`cls`/`style` (for adopting existing DOM) |
| Data | `resource(url, { cache, offline, params, loader })`, `mutation`, `api`, `invalidate('/api/users*')` / `invalidate(['users'])` | — |
| Forms | `wireForm(formEl)` for server forms, `form(defaults)` for virtual ones | — |
| Server HTML | `swap`, `adopt`, `boost` | `innerHTML` with data |
| Router | `router({ '/users/:id': { loader, component: Page } }, { outlet, hash })` — `props = params + { data, query }` | `handler` + manual `mount()` |

`Component` is one contract everywhere: `({ props, html, signal, on, … }) => Node | api | void`.

---

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

The `integrity` key of an import map is enforced in Chrome 127+ and Safari 18+; an older browser ignores the key and loads the same file, still pinned by its URL. Nothing breaks either way, and the hash is checked wherever the browser knows how.

The same files with hashes for every version: [aegisjs.com/docs/installation](https://aegisjs.com/docs/installation/). `https://aegisjs.com/aegis.js` without a version is the latest release, for experiments only. The files on the site are the files in this repository at the tag; the jsDelivr mirror works too: `https://cdn.jsdelivr.net/gh/bauratynov/aegis@v0.7.0/aegis.min.js`.

### Which size is which

One file is served, but you rarely ship all of it. Every number on this page is real; they measure different things:

| Number | What it is |
|---|---|
| **7 KB** gzip | `signal`, `computed`, `effect`, `batch`, `createScope` after a production build: the reactive core alone |
| **30 KB** gzip | the usual page: islands, `html` templates, lists, events and two-way binding, production build |
| **93 KB** gzip | every export, production build (`node build.mjs --from app.js` strips the developer layer) |
| **108 KB** gzip | `aegis.min.js` as served from the pinned URL: the same code plus the 60+ dev warnings, which only fire on localhost |
| **11 KB** gzip | `aegis.core.min.js`, the signals + scope file for non-DOM code |

The pinned URL is the whole file, so a page that imports five names still downloads 108 KB. If that matters, build the subset once (below) or let a bundler tree-shake it; the per-subset numbers are in [`docs/distribution.md`](./docs/distribution.md).

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
# → one file with exactly the exports admin.js imports (a 15-export admin bundle is 26 KB gzip); unknown names fail here, not in the browser
```

### npm

The package is `aegisjs`, the same name as the site (`aegis` and `aegis-engine` on npm belong to other projects). Not published yet: the `exports` map (`.`, `./min`, `./core`, `./core/min`) is ready and `npm i aegisjs` lands with 0.8. Until then the pinned URL above is the release channel, and a bundler resolves it the same way after `npm i`.

### How the bare name `aegis` resolves

Every example here and on the site imports `from 'aegis'`. That name is not magic: it comes from the import map in your base template (the pinned block above). With a bundler it comes from `node_modules` instead. Without either, import the URL directly:

```js
import { island } from 'https://aegisjs.com/0.7.0/aegis.min.js';
```

---

## Documentation

The full documentation is [aegisjs.com](https://aegisjs.com): [getting started](https://aegisjs.com/docs/getting-started/) with a `base.html` per backend, [examples](https://aegisjs.com/examples/) you can edit on the page, the [playground](https://aegisjs.com/play/) and the [API reference](https://aegisjs.com/api/) generated from `aegis.d.ts`. The same chapters live in this repository as Markdown:

| Chapter | Read |
|---|---|
| Quick start: an island, a todo list, data fetching | [`docs/quick-start.md`](./docs/quick-start.md) |
| Features, chapter by chapter (reactive core, DOM, data, components, forms, routing, a11y, CSS, performance, debugging) | [`docs/features.md`](./docs/features.md) |
| Dev mode and the warning codes | [`docs/dev-mode.md`](./docs/dev-mode.md), [`ERRORS.md`](./ERRORS.md) |
| TypeScript, testing helpers, tree-shaking and custom builds | [`docs/typescript.md`](./docs/typescript.md), [`docs/testing.md`](./docs/testing.md), [`docs/distribution.md`](./docs/distribution.md) |
| Verified by design: what the tests prove and what they do not | [`docs/verified-by-design.md`](./docs/verified-by-design.md) |
| Browser support, background tabs, benchmarks | [`docs/browser-support.md`](./docs/browser-support.md), [`docs/background-tabs.md`](./docs/background-tabs.md), [`docs/benchmarks.md`](./docs/benchmarks.md) |
| Philosophy and FAQ | [`docs/philosophy.md`](./docs/philosophy.md), [`docs/faq.md`](./docs/faq.md) |
| Rules for AI assistants | [`llms.txt`](./llms.txt) |

Runnable code: [`recipes/`](./recipes/) (one self-contained HTML file per pattern), [`demo/admin.html`](./demo/admin.html) (router, table, forms, a 50 000-line virtual log) and [`demo/bench.html`](./demo/bench.html).

---

## Contributing

Bug reports and pull requests are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md) for the test suite, the conventions, a map of the sections of `aegis.js` and how a change gets in. Security issues go to the address in [SECURITY.md](./SECURITY.md), not the issue tracker.

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

Created by Baurzhan Atinov (Kazakhstan) · [aegisjs.com](https://aegisjs.com) · baurzhanatinov@gmail.com
