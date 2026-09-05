# Working on Aegis (for coding agents)

- **Source of truth:** `aegis.js` — one ES module, plain JavaScript, no build, no dependencies, no `eval`/`new Function`, no `innerHTML` with data. Sections are numbered `// N. NAME`; keep new code in the section it belongs to.
- **Types:** `aegis.d.ts` is hand-written. Every new export gets a declaration and a one-line JSDoc there.
- **Tests:** `test.html` (browser, ~540 asserts) and `test-core.mjs` (`npm test`, reactive core on Node). Add a test for every behaviour change; edge cases over happy paths. Run the browser suite with a static server and Chrome (headless works: `chrome --headless=new --virtual-time-budget=300000 --dump-dom http://localhost:8765/test.html`).
- **Distribution:** `npm run build` (esbuild dev dependency) produces `aegis.min.js` and `aegis.core.js`. Users never build.
- **Dev warnings:** use `_warn('Exxx', { what, why, fix })` with a new code listed in `ERRORS.md`. Never `console.warn` directly.
- **Principles that decide API questions:** server-first (HTML from the server, JS hydrates), zero-build, zero-footgun (leaks and stale state impossible by construction: everything is owned by a scope), CSP-native, coexist with jQuery/Bootstrap (never touch classes or listeners you did not add, never delegate on `document` by default), AI-native (one obvious way, see `llms.txt`).
- **Conventions:** internal helpers start with `_`; signals expose `.value`/`.peek()`; disposers are functions; options are the last object argument; new DOM helpers accept `Reactive<T>` (value | signal | getter).
- **Do not:** add a build step for users, add runtime dependencies, add global mutable registries (use `provide/inject`), parse HTML from data, or introduce a second way to do something that already has one.
