## Verified by design

The reactive core is the part of a framework that must be right, so it is the part with the most adversarial tests. All of them run with `npm test`; nothing needs a browser.

| Check | What it proves | Command |
|---|---|---|
| Model-based fuzzer | random graphs of signals, computeds and effects against an oracle: consistency, no glitches, no wasted runs, at most one compute per change, no leaks after dispose; 1 000 seeds, plus a fault fuzzer that throws inside computeds | `node --test test/test-core.mjs` (uses `test/fuzz-graph.mjs`) |
| Scheduler simulation | the deadline scheduler keeps input latency under budget while draining transition and idle work: p98 of a 10 000-event trace | `npm run test:sched` |
| Prefetch simulation | the intent detector and the network budget: hit rate and wasted bytes on synthetic sessions | `npm run test:prefetch` |
| Export set and types | every runtime export is declared in `aegis.d.ts` and vice versa; `tsc` over `test/test-types.ts` | `node test/check-exports.mjs`, `tsc -p test/tsconfig.json` |
| Size budgets | tree-shaken subsets stay under their gzip budgets and never pull the cache, forms or IndexedDB into a light build | `npm run test:shake` |
| Graph contracts | in dev mode the engine checks its own invariants (no dangling subscriptions, scope tree is a tree, ownership is single) on sampled flushes; `dev.contracts = 'strict'` checks every flush in the browser suite | part of `test.html` |

The properties behind the fuzzer: pull-based evaluation without glitches, write backdating inside `batch()`, an earliest-deadline-first scheduler, dispose as a transaction, and provenance ordering of effects (Kahn over writer → reader edges). Run the fuzzer yourself before trusting the README.

The node suite covers the signal graph only. The DOM, templates, islands, lists and morph, the router, forms, the cache and offline are covered by the browser suite: `test/test.html`, 1 085 assertions in about 145 sections, run in headless Chrome, Firefox and WebKit by `npm run test:browsers`. A green node run says the core is right; it says nothing about the UI layer.

What the tests do **not** promise, so you do not have to find out yourself:

- An `effect()` created outside any scope is a leak that is reported (E001), not prevented; `window.__AEGIS_DEV__ = 'strict'` makes it throw.
- `untrack()` inside a computed means that source is not a dependency: the cached value stays until a tracked source changes. Correct, and a trap.
- An effect cycle is stopped by a round ceiling and reported (E027); it is not silently resolved.
- Graph contracts run on sampled flushes in dev (`dev.contracts = 'sampled'`); the browser suite runs with `'strict'`.
- An effect error with no `onError` / `scope.onError` goes to `reportError` (a `window` error event; the page keeps running) or, in node, to `console.error`. Put a boundary where you want one.
