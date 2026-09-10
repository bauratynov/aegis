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

Every code (E0xx and S0xx) with the fix for each: [ERRORS.md](../ERRORS.md).

Open the in-page inspector — `Aegis.dev.panel()` from the console or `?aegis-devtools` in the URL. It is `aegis-devtools.js` (built with Aegis, Shadow DOM, no extension): a live component tree that highlights the element on hover, signals with current values and change marks, `trace` per signal, effects with their dependencies, engine stats, slow effects under `profile`, warnings.

Or from the console:

```js
Aegis.dev.of($0)        // signals, effects and their deps of the island under the selected element
Aegis.dev.inspect()     // JSON snapshot of every component — paste it into a chat with an assistant
Aegis.dev.graph()       // dependency graph as Mermaid
Aegis.stats()           // { flushes, effectRuns, maxRounds, scopes, effects, components, … }
```

Zero cost in production — warnings are gated behind `window.__AEGIS_DEV__`.
