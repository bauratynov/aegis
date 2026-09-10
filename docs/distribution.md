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
