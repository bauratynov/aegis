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
