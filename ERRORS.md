# Aegis dev warnings

Every warning has a code, and each message is printed once per place. Dev mode is on automatically on
`localhost`, `127.0.0.1`, `file://`, `*.local`, `*.test`, with `?dev` in the module URL or
`localStorage['aegis:dev'] = '1'` (`Aegis.dev.enable()` on a production page, then reload).
`window.__AEGIS_DEV__ = false` silences everything; `'strict'` turns every warning into a thrown `AegisWarning`
(`error.code`, `error.what`, `error.why`, `error.fix`). `onWarn(fn)` subscribes for tests.

| Code | What | Fix |
|---|---|---|
| **E001** | `effect()` created outside a scope — it will never be cleaned up. The effect still runs: this is a reported leak, not a prevented one. | Create it inside `component()`/`mount()` setup or `scope.run(() => …)`; `window.__AEGIS_DEV__ = 'strict'` throws here instead of warning; `defaults.orphanEffects = 'throw'` throws in production too, `'root'` adopts the effect into an app-level scope. |
| **E002** | A signal was written inside a `computed()`. | Computeds must be pure — move the write into an effect or an action. |
| **E003** | `mount(selector)` found no element. | Check the selector or call `mount()` after `DOMContentLoaded`. |
| **E004** | `list()` keys are missing or duplicated. | Pass a unique key: `list(items, render, { key: 'uuid' })`. |
| **E005** | A scope was created or `run()` on an already disposed scope. | Do not reuse disposed scopes — create a new one. |
| **E006** | A value in `html``` sits in an unsupported position (tag name, comment, `<script>`/`<style>` body) or a property/boolean/`bind:` binding has more than one value. | Put values into text or attributes; `.prop=${v}` takes exactly one value. |
| **E007** | Invalid JSON in `data-aegis-cache` or `jsonScript()`. | Serialize with JSON and escape `</script` as `<\/script`. |
| **E008** | `slot()` called twice for the same selector. | Server children are moved once — keep the returned fragment. |
| **E009** | `bind:value` got something that is not a signal. | `bind:value=${mySignal}` — pass the signal, not `.value`. |
| **E010** | `register()` called twice with the same name, or with something that is not a setup function / `{ load }`. | Register each island once. |
| **E011** | `hydrate()` found `data-aegis="x"` but nothing registered under `x`. The warning prints a ready-to-paste `register()` scaffold. | Register it (or check the name — the message suggests close matches). |
| **E012** | A reactive child in `html``` returned more than 20 nodes. | Use `list(items, render, { key })` for collections. |
| **E013** | `clone()` / `show(cond, fragment)` had to fall back to `cloneNode` — bindings would be dead. | Pass a factory: `show(cond, () => html`…`)`. |
| **E014** | `attach()` element was never connected to the document. | Insert the template in the same task, or call `attach(el, fn)` after inserting. |
| **E015** | HTTP layer: unknown CSRF preset, or a response that looks like JSON but has a non-JSON `Content-Type`. | Use `django`/`rails`/`laravel`/`go` or a custom `{ header, cookie }`; send `Content-Type: application/json`. |
| **E016** | An effect returned a Promise. | Signals read after `await` are not tracked — move async work into `resource()`/`mutation()`/`watch()`. |
| **E017** | `onDispose()` called outside a scope. | Call it inside setup or `scope.run()`. |
| **E018** | `IntersectionObserver`/`ResizeObserver`/`MutationObserver` is missing in this environment (jsdom). | The observer is a no-op; polyfill it in tests if you need the behaviour. |
| **E019** | Lost reactivity: `text(el, count.value)`, `show(count.value > 3, …)`, an effect that read no signals, `setErrors()` with an unknown field, or a signal inside `css```. | Pass the signal or a function: `text(el, count)`, `show(() => count.value > 3, …)`. |
| **E020** | Unknown event modifier on `@event.mod`, or `.prevent` combined with `.passive`. | Supported: `prevent stop self once passive capture outside window document debounce.N throttle.N enter esc space tab up down left right delete backspace ctrl meta shift alt`. |
| **E021** | `persisted()` could not read or write storage. | The signal keeps working in memory; clear the key or fix `serialize`/`deserialize`. |
| **E022** | `inject(key)` found nothing provided. | `provide(key, value)` in a parent setup or pass a fallback: `inject(key, fallback)`. |
| **E023** | `swap()` did not find the `select` selector in the response. | Return the fragment itself or pass `{ select }` that matches the response. |
| **E024** | `adopt()` template does not match the server DOM (wrong element at a path, or a text value that is not the only child). | Keep the server partial and the template in sync; wrap text values in `<span>`. |
| **E025** | A `data-*` island prop looks numeric but is passed as a string. | Declare the type: `register(name, setup, { types: { count: Number } })`. |
| **E026** | The setup `ctx` has no such key (typo in the destructuring). | Use the suggested name from the warning; the full list is in `aegis.d.ts` (`SetupContext`). |
| **E027** | A flush took many rounds — effects keep writing signals other effects depend on (ping-pong). The scheduler learns writer → reader edges: a self-write (`s.value = s.value + 1` inside the effect that reads `s`) and a write cycle between effects are reported in the first round with the effect names, not after the round limit. | Derive with `computed()` instead of writing from an effect; batch related writes; break the cycle. Applies to `flush: 'micro'` / `'frame'` lanes too: a lane drains in one tick, a self-loop throws `Infinite reactive loop in "micro" lane`. |
| **E028** | Zombie binding: the node left the document, but the binding keeps updating it — it leaks until the owner scope is disposed. | Render the branch through `show()`/`list()`, or dispose the binding (`const off = text(el, …); off()`) before dropping the node. |
| **E029** | Two `resource()` instances fetched the same URL within a second. | Add `cache: { key }` so they share one request, or lift the resource into a parent and `provide()` it. |
| **E030** | The same URL was fetched many times within a second (a fetch loop). | Do not create a `resource()` inside an effect; give it a stable key; check `refetchOn` dependencies. |
| **E031** | A Promise or a plain object was rendered as text in `html``` (shows as `[object Promise]` / `[object Object]`). | Async work goes in `resource()` + `when(res, { data })`; pick a field or `JSON.stringify()` for objects. |
| **E032** | `@event` name is not a DOM event on that element (typo like `@clik`). | Use the suggested name; custom events need a dash (`@item-select`). |
| **E033** | Vue / Alpine / Angular / mustache syntax inside `html``` (`v-if`, `x-data`, `{{ }}`) — inert here. | `show()` / `list()` / `bind:value` / `@click` / `${}` — see llms.txt "Template syntax". |
| **E034** | `@event` got a non-function: the handler was called (`@click=${save()}`) or is `undefined`. | Pass the function: `@click=${save}` or `@click=${() => save(id)}`; `null`/`false` skips a handler on purpose. |
| **E035** | A resource URL contains `undefined`, `null`, `NaN` or `[object …]`. | Return `null` from the URL function until the value is ready — a null URL skips the request. |
| **E036** | `html()` was called as a function instead of a template tag. | `html`<p>${name}</p>`` with backticks; `tpl()` / `swap()` for server HTML strings. |
| **E037** | `router`: no route matches the URL and there is no `*` route. | Add `'*': () => render404()` or fix the pattern / `base`. |
| **E038** | `resource({ cache })` got a non-string cache key. | Pass a URL, an array key `cache: { key: ['users', id] }` or params — they are normalized. |
| **E039** | `staleTime` is larger than `cacheTime` — the entry is collected while still fresh. | Set `cacheTime >= staleTime` (or `Infinity` for reference data). |
| **E040** | `invalidate(key)` matched no cache entry (query order, trailing slash, typo). | Use the suggested key, the prefix form `invalidate('/api/users*')`, an array key or a predicate. |
| **E041** | `revalidateOn` refetched 8+ entries at once on focus/reconnect (thundering herd). | Raise `staleTime` on slow-changing data or set `revalidateOn: []` where mutations already invalidate. |
| **E042** | 90 %+ of revalidations returned identical data — `staleTime` is far below the observed change rate. | Use the suggested `staleTime` from the warning / `cache.explain(key).suggestedStaleTime`, or `staleTime: 'auto'`. |
| **E043** | Fewer than 20 % of prefetched responses were ever used (`cache.stats().prefetch`). | Prefetch on `tap` instead of hover, raise the hover delay, or use a predictor. |
| **E044** | A cache entry violated an internal invariant (refCount, in-flight state, patches). | Engine bug — please report the steps; `cache.remove(key)` clears the entry meanwhile. |
| **E045** | A disposed `computed()` was read — its value is frozen. | Do not dispose a computed that is still read; `computed()` needs no dispose (it is unsubscribed while nobody observes it). |
| **E046** | `watch()` / `until()` got a plain value or a reactive object as source — it never fires. | `watch(() => state.count, cb)` or pass the signal. |
| **E047** | The same object reference was written back into a signal — inner mutations are invisible. | `sig.update(a => [...a, x])`, hold it in `reactive()`, or `signal(v, { equals: false })`. |
| **E048** | `${count.value}` (or `title=${count.value}`) inside html`` is a snapshot — inserted once, never updates. | Pass the signal `${count}` or a getter `${() => …}`; a deliberate snapshot is `${count.peek()}`. |
| **E049** | A dialog / `<dialog>` opened by `trap()` / `modal()` has no accessible name. | Put a heading inside (it becomes `aria-labelledby`) or set `aria-label`. |
| **E050** | The focused element was removed by `list()` / `show()` and no neighbour or container could take focus — focus fell to `<body>`. | Move focus before removing; for rows re-rendered on object replacement pass `{ item: 'signal' }`. |
| **E051** | A runtime contract of the reactive graph or the scope tree failed (subscriptions ⇔ dependencies, live computed ⇔ observed, no disposed observer in `subs`, no observer stranded in the queue, depth counters at rest, children ⇔ parent). Checked after every flush in dev when `dev.contracts` is `'strict'`, sampled (~64 per session) by default. | This is an engine bug, not an application bug: report it with the steps; `dev.contracts = false` silences it meanwhile. |
| **E052** | A `mutation({ isolation: 'validate' })` body read signals through `ctx.read` and they changed while the request was in flight — the request was built from stale state. The optimistic patch is dropped and the touched keys are refetched. | Read everything the request needs through `ctx.read` (not `sig.value` after an `await`), or drop `isolation` to accept last-writer-wins. |
| **S002** | A URL attribute (`href`, `src`, `action`, `formaction`, …) received a value that chose the scheme (`javascript:`, `data:`, `vbscript:`); it was replaced by `about:blank#aegis-unsafe`. Decided at compile time from the static prefix: `href="/u/${id}"` is never checked. | Pass a path or an https URL; wrap a vetted value in `trusted(url)`; allow custom schemes with `configure({ urlSchemes: [...] })`. |
| **S003** | An `on*` attribute got a string instead of a function — inline handler strings are code injection and are refused. | Write `@click=${fn}` or `onclick=${fn}`. |
| **S004** | An HTML sink (`srcdoc`, `.innerHTML`, `.outerHTML`) got a plain string. | Render markup with html``, or pass a `TrustedHTML` from your policy / `trusted(html)` for author-vetted markup. |
| **S006** | `data-aegis-src` points outside the origin policy (default same-origin) — the island module was not imported. | Serve islands same-origin or `configure({ islands: { src: ['https://cdn.example/'] } })`. |
| **S007** | An island inside `[data-aegis-untrusted]` is not in `configure({ islands: { allow } })` — not mounted (markup from sanitized/user zones must not instantiate arbitrary islands). | Add the island name to the allow-list if it is safe there, or move the markup out of the zone. |
| **S008** | `data-aegis-props` points to a JSON script outside the island (or its parent) — ignored, so an injected island cannot read arbitrary page JSON. | Put the `<script type="application/json">` inside or next to the island. |
| **S009** | A credential-like header (`Authorization`, `X-Api-Key`, `Cookie`, `X-CSRF-Token`) is being sent to an origin that is not trusted (dev only). | `configure({ origins: [...] })` if the origin is yours; flat `configure({ headers })` and the CSRF token only go to trusted origins. |
| **S010** | `data-aegis-integrity` did not match the fetched island module (SRI for dynamic import). | Update the hash after every deploy (`build.mjs` emits `dist/integrity.json`). |
| **S011** | Trusted Types are enforced by CSP and no server policy is configured — server HTML (`swap`, `boost`, `wireForm`) cannot be parsed. | `configure({ trustedTypes: { server: (html) => policy.createHTML(html) } })`; the html`` literal policy is `aegis` (add it to `trusted-types`). |
| **S012** | `swap({ sanitize })` ran without the Sanitizer API — only script/iframe/object, `on*` attributes and `javascript:` URLs were removed. | Sanitize on the server, or ship DOMPurify for browsers without `Element.setHTML()`. |
| **S001** | Attempt to set `__proto__` / `prototype` / `constructor` on a reactive object — blocked. | Use a regular property name. |
