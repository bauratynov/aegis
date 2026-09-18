## Benchmarks

`demo/bench.html` — a js-framework-benchmark-style table (1,000 rows, `list()` + `html```) plus the reactive core. Median of 5 runs, headless Chrome, ms:

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

Run it yourself: serve the repository root and open `demo/bench.html` — the numbers are in `<pre>` and `window.__bench`. The same three jobs next to Alpine and Vue, in your browser: [aegisjs.com/bench/](https://aegisjs.com/bench/) (a 10 000-row table, a search filter, an optimistic PATCH).
