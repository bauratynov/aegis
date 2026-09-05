# Aegis dev warnings

Every warning has a code, and each message is printed once per place. Dev mode is on automatically on
`localhost`, `127.0.0.1`, `file://`, `*.local`, `*.test`, with `?dev` in the module URL or
`localStorage['aegis:dev'] = '1'` (`Aegis.dev.enable()` on a production page, then reload).
`window.__AEGIS_DEV__ = false` silences everything; `'strict'` turns every warning into a thrown `AegisWarning`
(`error.code`, `error.what`, `error.why`, `error.fix`). `onWarn(fn)` subscribes for tests.

| Code | What | Fix |
|---|---|---|
| **E001** | `effect()` created outside a scope — it will never be cleaned up. | Create it inside `component()`/`mount()` setup or `scope.run(() => …)`. |
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
| **E027** | A flush took many rounds — effects keep writing signals other effects depend on (ping-pong). | Derive with `computed()` instead of writing from an effect; batch related writes; break the cycle. |
| **E028** | Zombie binding: the node left the document, but the binding keeps updating it — it leaks until the owner scope is disposed. | Render the branch through `show()`/`list()`, or dispose the binding (`const off = text(el, …); off()`) before dropping the node. |
| **E029** | Two `resource()` instances fetched the same URL within a second. | Add `cache: { key }` so they share one request, or lift the resource into a parent and `provide()` it. |
| **E030** | The same URL was fetched many times within a second (a fetch loop). | Do not create a `resource()` inside an effect; give it a stable key; check `refetchOn` dependencies. |
| **S001** | Attempt to set `__proto__` / `prototype` / `constructor` on a reactive object — blocked. | Use a regular property name. |
