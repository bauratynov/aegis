// The examples catalogue: every entry is a page at /examples/<slug>/ with an editable app.js + index.html, a live result on the
// page's mock server, an explanation and the API it demonstrates. Keep each under ~40 lines; the point is the pattern, not the app.
const app = `<div id="app"></div>`;
export const CATEGORIES = ['Basics', 'Islands on server HTML', 'Data & cache', 'Forms', 'Lists & tables', 'Navigation & server HTML', 'Motion & accessibility'];

export const EXAMPLES = [
    // ── Basics ──────────────────────────────────────────────────────────────
    { slug: 'counter', category: 'Basics', title: 'Counter', summary: 'A signal in a template: the smallest possible component.', api: ['mount', 'signal', 'html'],
        why: 'A <code>signal</code> holds state, <code>html``</code> renders it. <code>${count}</code> is live because it is the signal itself, not its value: the text node updates in place, nothing else re-renders.',
        notice: ['<code>${count}</code> is a subscription; <code>${count.value}</code> would be a one-time snapshot (the dev build warns about it as E019).', '<code>mount()</code> gives the setup a scope: every effect and listener created here dies with the component.', 'There is no render function to call again. The template is parsed once, the binding updates the text node.'],
        try: 'Change <code>${count}</code> to <code>${count.value}</code> and click: the number stops updating.',
        html: app, js: `import { mount } from 'aegis';

mount('#app', ({ signal, html }) => {
    const count = signal(0);
    return html\`
        <p>You clicked <b>\${count}</b> times.</p>
        <button @click=\${() => count.value++}>Click me</button>
        <button class="secondary" @click=\${() => { count.value = 0; }}>Reset</button>\`;
});` },
    { slug: 'derived-state', category: 'Basics', title: 'Derived state', summary: 'computed() for values, effect() for the outside world, show() for a branch.', api: ['computed', 'effect', 'show'],
        why: 'Temperature converter from 7GUIs: two inputs stay in sync through one signal. Derived values are <code>computed</code>, side effects (here the document title) live in an <code>effect</code>, and a conditional branch is a <code>show()</code> with its own scope.',
        notice: ['Both inputs write the same <code>celsius</code> signal; <code>fahrenheit</code> is a computed, never stored twice.', '<code>effect()</code> re-runs only when a signal it read changes; it is disposed with the component.', '<code>show()</code> creates and destroys the warning branch instead of toggling a class, so nothing leaks.'],
        try: 'Type 100 in either field and watch the title of the frame and the warning appear.',
        html: app, js: `import { mount } from 'aegis';

mount('#app', ({ signal, computed, effect, html, show }) => {
    const celsius = signal(21);
    const fahrenheit = computed(() => Math.round(celsius.value * 9 / 5 + 32));
    const hot = computed(() => celsius.value >= 30);
    effect(() => { document.title = celsius.value + ' °C'; });
    return html\`
        <form @submit.prevent>
            <label>Celsius <input type="number" .value=\${celsius} @input=\${e => { celsius.value = +e.target.value; }}></label>
            <label>Fahrenheit <input type="number" .value=\${fahrenheit} @input=\${e => { celsius.value = Math.round((+e.target.value - 32) * 5 / 9); }}></label>
        </form>
        \${show(hot, () => html\`<p class="error">That is hot.</p>\`)}\`;
});` },
    { slug: 'two-way-binding', category: 'Basics', title: 'Two-way binding', summary: 'bind:value and bind:checked on text, checkbox, radio, select and range.', api: ['bind', 'signal', 'computed'],
        why: 'Form controls are the one place where the DOM writes back into your state. <code>bind:value</code> and <code>bind:checked</code> wire both directions and pick the right event and property for each control type.',
        notice: ['One signal per control; the summary below is a computed over all of them.', 'Radios share a signal: <code>bind:checked</code> on a radio compares the value.', 'The range input writes a number, not a string, because the signal started as a number.'],
        try: 'Move the slider and toggle the checkbox: the summary sentence rewrites itself.',
        html: app, js: `import { mount } from 'aegis';

mount('#app', ({ signal, computed, html }) => {
    const name = signal('Ada'), agree = signal(false), size = signal('m'), volume = signal(40);
    const summary = computed(() => \`\${name.value || 'Someone'} picked size \${size.value.toUpperCase()} at volume \${volume.value}\${agree.value ? ' and agreed' : ''}.\`);
    return html\`
        <form @submit.prevent>
            <label>Name <input bind:value=\${name}></label>
            <label>Size <select bind:value=\${size}><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label>
            <label>Volume \${volume} <input type="range" min="0" max="100" bind:value=\${volume}></label>
            <label class="row"><input type="checkbox" bind:checked=\${agree}> I agree</label>
        </form>
        <p><b>\${summary}</b></p>\`;
});` },
    { slug: 'lists', category: 'Basics', title: 'Keyed lists', summary: 'list() keeps rows by key: add, remove and move without re-rendering the rest.', api: ['list', 'signal'],
        why: '<code>list()</code> reconciles by key. A row is exactly the nodes you return; when the array changes, existing rows are kept, moved with the minimum number of DOM moves and only new rows are rendered.',
        notice: ['The row template receives the item and a lazy <code>index</code> signal.', 'Reversing the array moves nodes; open the frame\'s inspector and the <code>li</code> elements keep their identity.', 'Removing writes a new array; the removed row\'s scope is disposed with its listeners.'],
        try: 'Add three items, reverse, then remove the middle one.',
        html: app, js: `import { mount } from 'aegis';

let id = 4;
mount('#app', ({ signal, html, list }) => {
    const items = signal([{ id: 1, text: 'Signals' }, { id: 2, text: 'Islands' }, { id: 3, text: 'Templates' }]);
    const add = () => { items.value = [...items.value, { id: id++, text: 'Item ' + id }]; };
    const remove = (it) => { items.value = items.value.filter(x => x !== it); };
    return html\`
        <p><button @click=\${add}>Add</button> <button class="secondary" @click=\${() => { items.value = [...items.value].reverse(); }}>Reverse</button></p>
        <ul>\${list(items, (it, index) => html\`
            <li><span class="muted">\${() => index.value + 1}.</span> \${it.text} <button class="secondary" @click=\${() => remove(it)}>Remove</button></li>\`,
            { key: 'id' })}</ul>\`;
});` },

    // ── Islands on server HTML ─────────────────────────────────────────────
    { slug: 'island-props', category: 'Islands on server HTML', title: 'Island with typed props', summary: 'Server HTML plus data-* attributes become a live component.', api: ['island', 'mutation', 'defaults'],
        why: 'The server renders the markup and the numbers; the island only has to wake it up. <code>data-*</code> attributes arrive as strings, so <code>{ types }</code> declares which ones are numbers. The like button writes the signal first and posts after.',
        notice: ['The server HTML is real content: it is visible before JavaScript runs and indexed by search engines.', '<code>{ types: { count: Number } }</code> coerces once; every other attribute stays a string, so IDs never lose precision.', 'A failed POST rolls the optimistic count back (turn on failures in the mock server).'],
        try: 'Click the heart several times, then edit <code>data-count</code> in index.html: the island starts from the new value.',
        html: `<!-- rendered by the server -->
<ul data-aegis="likes" data-url="/api/likes" data-count="12">
    <li>12 likes</li>
</ul>`, js: `import { island, mutation, defaults } from 'aegis';

island('likes', ({ props, signal, html }) => {
    const count = signal(props.count);                                    // data-count="12" → 12
    const like = mutation(() => defaults.fetcher(props.url, { method: 'POST' }), {
        optimistic: () => count.value++,
    });
    return html\`<li>\${count} likes <button @click=\${like} ?disabled=\${like.pending}>♥</button></li>\`;
}, { types: { count: Number } });` },
    { slug: 'lazy-island', category: 'Islands on server HTML', title: 'Lazy island', summary: 'data-aegis-load="visible" hydrates an island only when it scrolls into view.', api: ['island', 'hydrate'],
        why: 'A page can have dozens of islands; most are below the fold. With <code>data-aegis-load</code> the island stays inert server HTML until it is needed: <code>visible</code>, <code>idle</code> or <code>interaction</code>.',
        notice: ['The chart island at the bottom is registered up front but mounts only when scrolled near (400px before the viewport).', 'The timestamp shows when hydration actually happened.', '<code>visible(300px)</code>, <code>idle(1500)</code> and <code>interaction(click,keydown)</code> take arguments.'],
        try: 'Scroll the result down slowly and watch the mounted-at time appear.',
        html: `<div data-aegis="hero"><p>Above the fold: hydrated immediately.</p></div>
<div style="height: 620px; display: grid; place-items: center; color: #888">scroll down ↓</div>
<div data-aegis="chart" data-aegis-load="visible"><p>Below the fold: waiting to be seen…</p></div>`, js: `import { island } from 'aegis';

const stamp = () => new Date().toLocaleTimeString() + '.' + String(Date.now() % 1000).padStart(3, '0');

island('hero', ({ html }) => html\`<p>Hero mounted at <b>\${stamp()}</b></p>\`);
island('chart', ({ html }) => html\`<p>Chart mounted at <b>\${stamp()}</b> — only once you scrolled here.</p>\`);` },
    { slug: 'json-props', category: 'Islands on server HTML', title: 'JSON props', summary: 'Big or nested data goes in a <script type="application/json"> inside the island.', api: ['island', 'list'],
        why: 'Attributes are fine for a few scalars. For a list or a nested object the server inlines JSON next to the markup (Django\'s <code>json_script</code>, Rails <code>json_escape</code>) and the island reads it as <code>props</code>, without a request.',
        notice: ['The JSON block is inside the island, so an injected island elsewhere on the page cannot read it (S008).', 'Nothing is fetched: the data arrived with the HTML.', 'The same component could also receive <code>data-aegis-props="#id"</code> pointing at a sibling script.'],
        try: 'Add a fourth row to the JSON in index.html; the table re-renders on the next run.',
        html: `<div data-aegis="scores">
    <script type="application/json">{ "rows": [{ "name": "Ada", "score": 92 }, { "name": "Linus", "score": 71 }, { "name": "Grace", "score": 88 }] }</script>
    <p>Loading scores…</p>
</div>`, js: `import { island } from 'aegis';

island('scores', ({ props, html, list }) => {
    const rows = props.rows.slice().sort((a, b) => b.score - a.score);      // props.rows came from the JSON block
    return html\`<table><thead><tr><th>#</th><th>Name</th><th>Score</th></tr></thead>
        <tbody>\${list(rows, (r, i) => html\`<tr><td>\${() => i.value + 1}</td><td>\${r.name}</td><td>\${r.score}</td></tr>\`, { key: 'name' })}</tbody></table>\`;
});` },
    { slug: 'hydrate-watch', category: 'Islands on server HTML', title: 'Islands inserted later', summary: 'hydrate(document, { watch: true }) wakes up markup added by htmx, Turbo or jQuery.', api: ['island', 'hydrate'],
        why: 'Server-driven pages add HTML all the time. With <code>watch: true</code> a MutationObserver hydrates islands that appear later and destroys the ones that are removed, so the engine coexists with any other way of updating the page.',
        notice: ['The inserted markup is plain HTML, exactly what an htmx swap would put there.', 'Each new island gets its own scope; removing the node disposes it.', 'No re-scan of the whole page: the observer only looks at the inserted subtree.'],
        try: 'Insert three cards, remove one; the timestamps prove each mounted on its own.',
        html: `<button id="add">Insert a card from the “server”</button>
<div id="cards"></div>`, js: `import { island, hydrate } from 'aegis';

island('card', ({ el, html }) => html\`<p>Card mounted at \${new Date().toLocaleTimeString()} <button class="secondary" @click=\${() => el.remove()}>Remove</button></p>\`);
hydrate(document, { watch: true });

let n = 0;
document.getElementById('add').onclick = () => {
    // what a server response inserted by htmx / Turbo / jQuery looks like
    document.getElementById('cards').insertAdjacentHTML('beforeend', \`<div data-aegis="card"><p>Card \${++n} (server HTML)</p></div>\`);
};` },

    // ── Data & cache ────────────────────────────────────────────────────────
    { slug: 'fetch-when', category: 'Data & cache', title: 'Fetching data', summary: 'resource() owns the async state; when() renders loading, error, empty and data.', api: ['resource', 'when', 'list'],
        why: 'No <code>useEffect</code>, no manual loading flags. A <code>resource</code> is a signal-shaped view of a request: <code>data</code>, <code>loading</code>, <code>validating</code>, <code>error</code>, <code>refresh()</code>. <code>when()</code> picks the branch.',
        notice: ['Reload keeps the old rows on screen while <code>validating</code>; only the first load shows the skeleton.', 'Every request appears in the Server requests panel with its latency.', '<code>rowsSignal</code> in the data branch lets <code>list()</code> patch rows on refetch instead of rebuilding them.'],
        try: 'Set <code>window.__server.latency = 2000</code> at the top of app.js and reload.',
        html: app, js: `import { mount, resource } from 'aegis';

mount('#app', ({ html, when, list }) => {
    const users = resource('/api/users');
    return html\`
        <p><button @click=\${users.refresh}>Reload</button> <span class="muted">\${() => users.validating.value ? 'refreshing…' : ''}</span></p>
        \${when(users, {
            loading: () => html\`<p class="skeleton">Loading…</p>\`,
            error: (e, retry) => html\`<p class="error">\${e.message} <button @click=\${retry}>Retry</button></p>\`,
            data: (rows, rowsSignal) => html\`<ul>\${list(rowsSignal, (u) => html\`<li>\${u.name} <span class="muted">\${u.role}</span></li>\`, { key: 'id' })}</ul>\`,
        })}\`;
});` },
    { slug: 'active-search', category: 'Data & cache', title: 'Active search', summary: 'A URL that is a function of the query: debounce, abort, keepPrevious.', api: ['resource', 'when'],
        why: 'The htmx “active search” pattern with signals. The resource URL is a function of the query signal; an empty query means no request, a new query aborts the previous one, and <code>keepPrevious</code> keeps the last list visible while the next loads.',
        notice: ['<code>@input.debounce.300</code> is an event modifier: no timer code.', 'Type fast and watch the Server requests panel: aborted requests never resolve into the UI.', 'The <code>empty</code> branch of <code>when()</code> distinguishes “no matches” from “nothing typed yet”.'],
        try: 'Type “lo”, then “lon”, then “xyz”.',
        html: app, js: `import { mount, resource } from 'aegis';

mount('#app', ({ signal, html, when, list }) => {
    const q = signal('');
    const hits = resource(() => q.value.trim() ? \`/api/cities?q=\${encodeURIComponent(q.value.trim())}\` : null, { keepPrevious: true });
    return html\`
        <input placeholder="Search cities…" @input.debounce.300=\${(e) => { q.value = e.target.value; }}>
        \${when(hits, {
            loading: () => html\`<p class="muted">Searching…</p>\`,
            empty: () => html\`<p class="muted">\${() => q.value.trim() ? 'No city matches' : 'Type a city: Berlin, London, Paris…'}</p>\`,
            data: (rows, rowsSignal) => html\`<ul class=\${{ dim: hits.validating }}>\${list(rowsSignal, (c) => html\`<li>\${c}</li>\`, { key: (c) => c })}</ul>\`,
        })}\`;
});` },
    { slug: 'swr-cache', category: 'Data & cache', title: 'Shared cache', summary: 'Two components, one request: cache: true with staleTime.', api: ['resource', 'invalidate', 'cache'],
        why: 'Both islands ask for <code>/api/stats</code>. With <code>cache: true</code> they share one entry: one request on mount, an instant answer for the second reader, and a background revalidation only once the entry is older than <code>staleTime</code>.',
        notice: ['Mount both: the Server requests panel shows a single GET.', 'Refresh inside 5 seconds serves from cache; after that the data is stale and refetches while still showing the old value.', '<code>invalidate()</code> forces every live reader to refetch.'],
        try: 'Click “Invalidate” and compare the request count with the two refresh buttons.',
        html: `<div data-aegis="stats" data-title="Header widget"></div>
<div data-aegis="stats" data-title="Sidebar widget"></div>
<p><button id="inv">Invalidate /api/stats</button></p>`, js: `import { island, resource, invalidate } from 'aegis';

island('stats', ({ props, html, when }) => {
    const stats = resource('/api/stats', { cache: true, staleTime: 5000 });
    return html\`<p><b>\${props.title}</b> \${when(stats, { data: (s) => html\`— \${() => s.requests} requests served, uptime \${() => s.uptime}, fetched \${() => s.at}\` })}
        <button class="secondary" @click=\${stats.refresh}>Refresh</button></p>\`;
});
document.getElementById('inv').onclick = () => invalidate('/api/stats');` },
    { slug: 'optimistic-mutation', category: 'Data & cache', title: 'Optimistic mutation', summary: 'Write the UI first, send later, roll back on failure.', api: ['mutation', 'resource', 'defaults'],
        why: 'The button feels instant because <code>optimistic</code> runs before the request. The mutation snapshots the listed resources first; if the server fails, only this change is rolled back, concurrent edits survive.',
        notice: ['<code>like.pending</code> disables the button: a double-submit guard for free.', 'The mock server fails every third POST; the count jumps back and the error is shown.', 'Rollback is a patch log, not a snapshot restore: other optimistic edits in flight stay applied.'],
        try: 'Click three times quickly and watch the third one roll back.',
        html: app, js: `import { mount, resource, mutation, defaults } from 'aegis';

window.__server.failEvery = 3;                                              // make the mock server fail every third POST

mount('#app', ({ html, when }) => {
    const likes = resource('/api/likes');
    const like = mutation(() => defaults.fetcher('/api/likes', { method: 'POST' }), {
        resources: [likes],
        optimistic: () => likes.mutate(v => ({ count: v.count + 1 })),
    });
    return html\`
        \${when(likes, { data: (v) => html\`<p style="font-size: 32px; margin: 0">\${() => v.count} <span class="muted" style="font-size: 14px">likes</span></p>\` })}
        <p><button @click=\${like} ?disabled=\${like.pending}>\${() => like.pending.value ? 'Saving…' : '♥ Like'}</button></p>
        <p class="error">\${() => like.error.value ? 'Rolled back: ' + like.error.value.message : ''}</p>\`;
});` },
    { slug: 'infinite-scroll', category: 'Data & cache', title: 'Infinite scroll', summary: 'infiniteResource() accumulates pages; loadMore is deduplicated.', api: ['infiniteResource', 'inView', 'list'],
        why: 'Cursor pagination without bookkeeping: <code>infiniteResource()</code> turns a cursor into a URL, keeps every page and exposes <code>hasMore</code> and <code>loadMore()</code>. A sentinel element observed with <code>inView()</code> triggers the next page.',
        notice: ['Pages are appended; <code>list()</code> keeps the already rendered rows.', 'Calling <code>loadMore()</code> twice while a page is in flight sends one request.', '<code>hasMore</code> comes from the <code>next</code> cursor the server returns.'],
        try: 'Scroll to the bottom of the result repeatedly until the list ends at 16 users.',
        html: app, js: `import { mount, infiniteResource, inView } from 'aegis';

mount('#app', ({ html, list, effect, show }) => {
    const users = infiniteResource((cursor) => \`/api/users/paged?cursor=\${cursor ?? 0}&size=5\`, {
        getNext: (page) => page.next,
        select: (page) => page.items,
    });
    const sentinel = document.createElement('p');
    sentinel.className = 'muted'; sentinel.textContent = '…';
    const seen = inView(sentinel);                                            // { visible, ratio } signals
    effect(() => { if (seen.visible.value && users.hasMore.value && !users.loading.value) users.loadMore(); });
    return html\`
        <ul>\${list(users.data, (u) => html\`<li>\${u.id}. \${u.name}</li>\`, { key: 'id' })}</ul>
        \${show(users.hasMore, () => sentinel, () => html\`<p class="muted">That is everyone.</p>\`)}\`;
});` },
    { slug: 'prefetch-on-hover', category: 'Data & cache', title: 'Prefetch on hover', summary: 'Warm the cache when the cursor slows down over a link.', api: ['prefetchOn', 'resource', 'when'],
        why: 'The request starts on intent, not on click. <code>prefetchOn()</code> watches hover (with a fly-by detector), tap or visibility and warms the same cache the resource reads from, so the detail view opens with no spinner.',
        notice: ['Hover a name for a moment before clicking: the GET appears in Server requests before the click.', 'The detail resource uses <code>cache: true</code>, so the prefetched entry is found by key.', 'Save-Data and 2g connections turn prefetch off automatically.'],
        try: 'Compare: click a name immediately vs. hover first.',
        html: app, js: `import { mount, resource, prefetchOn } from 'aegis';

mount('#app', ({ signal, html, when, list, onDispose }) => {
    const id = signal(1);
    const user = resource(() => \`/api/users/\${id.value}\`, { cache: true, staleTime: 60000 });
    const ids = [1, 2, 3, 4, 5];
    const row = (i) => {
        const a = html\`<li><a href="#" @click.prevent=\${() => { id.value = i; }}>User \${i}</a></li>\`;
        onDispose(prefetchOn(a.firstElementChild, \`/api/users/\${i}\`, { on: 'hover' }));
        return a;
    };
    return html\`
        <ul>\${list(ids, row, { key: (i) => i })}</ul>
        \${when(user, { loading: () => html\`<p class="muted">Loading…</p>\`, data: (u) => html\`<p><b>\${() => u.name}</b> · \${() => u.email}</p>\` })}\`;
});` },

    // ── Forms ───────────────────────────────────────────────────────────────
    { slug: 'inline-validation', category: 'Forms', title: 'Inline validation', summary: 'wireForm() on a server form: rules, blur-then-live, no JavaScript required to submit.', api: ['wireForm', 'required', 'minLen', 'matches'],
        why: 'The form is a normal server form and works without JavaScript. <code>wireForm()</code> layers rules on top, uses the browser\'s Constraint Validation API for messages and accessibility, and shows errors after you leave a field, then live.',
        notice: ['<code>aria-invalid</code> and <code>:user-invalid</code> are set for you; the red border is one CSS rule.', 'The password rule lives once; “Repeat” compares against it with <code>matches()</code>.', 'Without JavaScript the same form posts to <code>/signup</code> and the server validates.'],
        try: 'Type a 4-character password and tab away.',
        html: `<form data-aegis="signup" method="post" action="/api/signup">
    <label>Username <input name="username" required></label>
    <label>Password <input name="password" type="password" required minlength="8"></label>
    <label>Repeat <input name="repeat" type="password" required></label>
    <button>Create account</button>
</form>`, js: `import { island, wireForm, required, minLen, matches } from 'aegis';

island('signup', ({ el }) => {
    const f = wireForm(el, {
        schema: {
            username: [required, minLen(3)],
            password: [required, minLen(8)],
            repeat: [required, matches('password', 'Passwords differ')],
        },
        mode: 'blur-then-live',
        submit: async (v) => { console.log('would POST', v); },
    });
});` },
    { slug: 'server-errors', category: 'Forms', title: 'Server-side errors', summary: 'A 422 with field errors lands on the right inputs; an async rule checks availability.', api: ['form', 'HttpError', 'defaults'],
        why: 'The server is the source of truth for “taken” and “already registered”. When submit throws an <code>HttpError</code> with <code>data.errors</code>, each message is mapped onto its field. An async rule asks the server while you type, debounced and cancelled on the next keystroke.',
        notice: ['Try <code>admin</code> as a username: the async rule reports it before submit, the server rejects it on submit.', '<code>f.submitting</code> and <code>f.canSubmit</code> drive the button; no manual flags.', 'The Server requests panel shows the 422 with its payload.'],
        try: 'Sign up as <code>ada</code> with <code>x@taken.com</code>: two errors from one response.',
        html: app, js: `import { mount, form, required, minLen, emailRule, defaults } from 'aegis';

const available = async (v, key, fields, { signal }) => {
    const r = await defaults.fetcher(\`/api/check-username?u=\${encodeURIComponent(v)}\`, { signal });
    return r.available ? null : 'This username is taken';
};

mount('#app', ({ html }) => {
    const f = form({
        username: { value: '', rules: [required, minLen(3), available] },
        email: { value: '', rules: [required, emailRule] },
    });
    const signup = (values) => defaults.fetcher('/api/signup', { method: 'POST', body: values });   // throws HttpError(422, …) with data.errors
    return html\`
        <form @submit.prevent=\${() => f.submit(signup)}>
            <label>Username <input bind:field=\${f.field('username')}> <small>\${f.errors.username}</small></label>
            <label>Email <input bind:field=\${f.field('email')}> <small>\${f.errors.email}</small></label>
            <button ?disabled=\${() => !f.canSubmit.value}>\${() => f.submitting.value ? 'Creating…' : 'Create account'}</button>
        </form>
        <p aria-live="polite">\${() => f.status.value === 'success' ? 'Account created.' : ''}</p>\`;
});` },
    { slug: 'wizard', category: 'Forms', title: 'Multi-step wizard', summary: 'wizard() over a server form with [data-step] sections: validation per step, focus, progress.', api: ['wireForm', 'wizard'],
        why: 'Steps are just sections of one form. <code>wizard()</code> validates only the current step before moving on, moves focus to the new step, announces “Step n of N” and exposes <code>step</code>, <code>first</code>, <code>last</code> and <code>progress</code> as signals.',
        notice: ['Pressing Next with an empty field keeps you on the step and shows the error.', 'Back never validates; the values are kept because it is one form.', 'The progress bar is a computed over <code>w.progress</code>.'],
        try: 'Fill the first step, go Next, then Back: your values are still there.',
        html: `<form data-aegis="signup">
    <section data-step><label>Name <input name="name" required></label></section>
    <section data-step><label>Email <input name="email" type="email" required></label></section>
    <section data-step><label>City <input name="city" required></label></section>
    <p class="row"><button type="button" data-prev class="secondary">Back</button><button type="button" data-next>Next</button><button data-submit>Finish</button></p>
    <progress max="1"></progress>
</form>`, js: `import { island, wireForm, wizard } from 'aegis';

island('signup', ({ el, effect, on }) => {
    const f = wireForm(el, { submit: async (v) => { console.log('done', v); } });
    const w = wizard(f);
    on(el.querySelector('[data-next]'), 'click', () => w.next());
    on(el.querySelector('[data-prev]'), 'click', () => w.prev());
    effect(() => {
        el.querySelector('[data-prev]').hidden = w.first.value;
        el.querySelector('[data-next]').hidden = w.last.value;
        el.querySelector('[data-submit]').hidden = !w.last.value;
        el.querySelector('progress').value = w.progress.value;
    });
});` },

    // ── Lists & tables ───────────────────────────────────────────────────────
    { slug: 'sortable-table', category: 'Lists & tables', title: 'Sortable, filterable table', summary: 'reactive() state with a getter for the visible rows; list() moves nodes instead of re-rendering.', api: ['reactive', 'list', 'mount'],
        why: 'State is one <code>reactive()</code> object. The visible rows are a getter, so sort and filter are derived, never duplicated. <code>list()</code> is keyed by id: sorting 200 rows moves DOM nodes, it does not rebuild them.',
        notice: ['Clicking a header toggles the field and the direction with a single write.', 'Filtering by “1” keeps identity: rows that stay are the same DOM nodes.', 'The getter runs lazily and is cached until <code>rows</code>, <code>q</code> or the sort changes.'],
        try: 'Filter by “1”, then sort by price.',
        html: app, js: `import { mount, reactive } from 'aegis';

mount('#app', ({ html, list }) => {
    const state = reactive({
        rows: Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: 'Item ' + (i + 1), price: (i * 37) % 500, stock: i % 7 })),
        q: '', by: 'id', dir: 1,
        get shown() { const q = this.q.toLowerCase(); return [...this.rows].filter(r => r.name.toLowerCase().includes(q)).sort((a, b) => (a[this.by] > b[this.by] ? 1 : -1) * this.dir); },
        sort(k) { if (this.by === k) this.dir = -this.dir; else { this.by = k; this.dir = 1; } },
    });
    const th = (k, label) => html\`<th @click=\${() => state.sort(k)}>\${label} \${() => state.by === k ? (state.dir > 0 ? '↑' : '↓') : ''}</th>\`;
    return html\`
        <input placeholder="Filter…" bind:value=\${[() => state.q, v => state.q = v]}>
        <p class="muted">\${() => state.shown.length} rows</p>
        <table><thead><tr>\${th('id', '#')}\${th('name', 'Name')}\${th('price', 'Price')}\${th('stock', 'Stock')}</tr></thead>
        <tbody>\${list(() => state.shown, (r) => html\`<tr class=\${{ low: () => r.stock === 0 }}><td>\${() => r.id}</td><td>\${() => r.name}</td><td>\${() => r.price}</td><td>\${() => r.stock}</td></tr>\`, { key: 'id' })}</tbody></table>\`;
});` },
    { slug: 'animated-reorder', category: 'Lists & tables', title: 'Animated reorder', summary: 'flip() records positions, list() moves the nodes, the animation plays from old to new.', api: ['flip', 'list', 'signal'],
        why: 'FLIP: measure First, apply the change, measure Last, Invert and Play. <code>flip(nodes)</code> does the measuring; you make the change; the returned function animates each node from where it was. Since <code>list()</code> moves nodes instead of re-creating them, every row keeps its identity and can animate.',
        notice: ['Shuffle moves the same <code>li</code> elements: the numbers travel, nothing fades in or out.', '<code>prefers-reduced-motion</code> turns the animation into an instant move.', 'Sorting uses the same code path; only the comparator differs.'],
        try: 'Shuffle a few times, then Sort.',
        html: app, js: `import { mount, flip } from 'aegis';

mount('#app', ({ signal, html, list, el }) => {
    const items = signal([1, 2, 3, 4, 5, 6, 7, 8]);
    const animate = (next) => { const play = flip(el.querySelectorAll('li')); items.value = next; requestAnimationFrame(play); };
    const shuffle = () => animate([...items.value].sort(() => Math.random() - 0.5));
    const sort = () => animate([...items.value].sort((a, b) => a - b));
    return html\`
        <p><button @click=\${shuffle}>Shuffle</button> <button class="secondary" @click=\${sort}>Sort</button></p>
        <ul class="grid">\${list(items, (n) => html\`<li class="tile">\${n}</li>\`, { key: (n) => n })}</ul>\`;
});` },

    // ── Navigation & server HTML ─────────────────────────────────────────────
    { slug: 'hash-router', category: 'Navigation & server HTML', title: 'Router with loaders', summary: 'Routes as data: a loader fetches before the page swaps, pending is a signal.', api: ['router', 'resource'],
        why: 'A route is an object: <code>loader</code> runs while the old page is still visible, the handler renders with the data, <code>r.pending</code> drives an indicator. Hash mode needs no server rewrite rules, which is why this example uses it.',
        notice: ['Click User 3, then User 7: the old page stays until the new data arrives.', 'The active link gets <code>aria-current="page"</code> and the <code>on</code> class.', 'A route that does not match falls to <code>*</code>; unknown non-hash paths go to the server.'],
        try: 'Set <code>window.__server.latency = 1500</code> and watch the pending indicator.',
        html: `<nav><a href="#/">Home</a><a href="#/users/3">User 3</a><a href="#/users/7">User 7</a><a href="#/nowhere">Broken link</a></nav>
<p id="pending" class="muted"></p>
<div id="outlet"></div>`, js: `import { router, html, defaults } from 'aegis';

const r = router({
    '/': () => html\`<p>Home. Pick a user above.</p>\`,
    '/users/:id': {
        loader: ({ id }) => defaults.fetcher(\`/api/users/\${id}\`),
        handler: (params, { data }) => html\`<p><b>\${data.name}</b> · \${data.email} · \${data.role}</p>\`,
    },
    '*': () => html\`<p class="error">Not found</p>\`,
}, { root: document.getElementById('outlet'), hash: true, activeClass: 'on' });

r.pending.subscribe((busy) => { document.getElementById('pending').textContent = busy ? 'loading…' : ''; });   // a signal outside a component: subscribe by hand` },
    { slug: 'swap-fragment', category: 'Navigation & server HTML', title: 'Click to load', summary: 'swap() appends a server-rendered fragment, keeping the markup on the server.', api: ['swap', 'defaults'],
        why: 'The htmx “click to load” pattern. The server renders the next batch of comments as HTML; <code>swap()</code> inserts it the right way: islands inside are hydrated, <code>data-cloak</code> removed, focus preserved. Data never goes through <code>innerHTML</code> in your code.',
        notice: ['The fragment comes from <code>/fragments/comments.html</code>; look at it in Server requests.', '<code>mode: "append"</code> keeps what is already there; the old “Load more” button is replaced by the new one.', 'Event delegation on the container means new buttons need no wiring.'],
        try: 'Load all three pages; the last response ends the list.',
        html: `<section id="comments"><button data-page="1">Load comments</button></section>`, js: `import { swap, defaults, delegate } from 'aegis';

const box = document.getElementById('comments');
delegate(box, 'click', 'button[data-page]', async (e, btn) => {
    btn.disabled = true;
    const fragment = await defaults.fetcher(\`/fragments/comments.html?page=\${btn.dataset.page}\`);
    btn.remove();
    await swap(box, fragment, { mode: 'append' });
});` },
    { slug: 'morph', category: 'Navigation & server HTML', title: 'Morph a server fragment', summary: 'swap(…, { mode: "morph" }) patches the DOM in place: open <details> stays open, focus stays put.', api: ['swap', 'defaults'],
        why: 'Replacing HTML wholesale loses state: open disclosures, scroll positions, focus, CSS transitions. Morph diffs the new fragment against the live DOM and touches only what changed, so a server re-render feels like a client update.',
        notice: ['Open the details, then switch users: it stays open because the element was patched, not replaced.', 'Id-aware matching means the same nodes are kept even when their text changes.', 'A live island inside a morphed subtree keeps its DOM and remounts only if its <code>data-*</code> props changed.'],
        try: 'Focus the input, switch users with the buttons: focus and your text survive.',
        html: `<p><button data-id="1">User 1</button> <button data-id="2">User 2</button> <button data-id="3">User 3</button></p>
<input placeholder="Type here, then switch users">
<div id="profile"><article class="profile"><h3>Nobody yet</h3><p>Pick a user.</p><details open><summary>Details</summary><p>Open me and switch.</p></details></article></div>`, js: `import { swap, defaults, delegate } from 'aegis';

delegate(document, 'click', 'button[data-id]', async (e, btn) => {
    const fragment = await defaults.fetcher(\`/fragments/profile.html?id=\${btn.dataset.id}\`);
    await swap(document.getElementById('profile'), fragment, { mode: 'morph' });
});` },

    // ── Motion & accessibility ───────────────────────────────────────────────
    { slug: 'spring', category: 'Motion & accessibility', title: 'Spring physics', summary: 'springSignal(): write the target, read the animated current value.', api: ['springSignal', 'effect'],
        why: 'A spring is a value, not a timeline. You write <code>target</code>; <code>current</code> follows with physics and keeps its velocity when the target changes mid-flight. Bind it to a style and the layout takes care of itself.',
        notice: ['Click quickly in different places: the box never snaps, it re-aims.', 'Stiffness and damping are the only two knobs.', 'With <code>prefers-reduced-motion</code> the spring jumps to the target.'],
        try: 'Change <code>damping</code> to 8 for a bouncier feel.',
        html: `<div id="stage" style="position: relative; height: 200px; border: 1px dashed #CFD8DE; border-radius: 8px; cursor: crosshair"><div id="box" style="position: absolute; width: 40px; height: 40px; border-radius: 10px; background: #184C64"></div></div>
<p class="muted">Click anywhere in the box.</p>`, js: `import { mount, springSignal } from 'aegis';

mount('#stage', ({ el, effect, on }) => {                                // a scope: the spring's effects die with the component
    const pos = springSignal({ x: 20, y: 20 }, { stiffness: 120, damping: 14 });
    const box = el.querySelector('#box');
    effect(() => { const p = pos.current.value; box.style.transform = \`translate(\${p.x}px, \${p.y}px)\`; });
    on(el, 'click', (e) => { const r = el.getBoundingClientRect(); pos.target.value = { x: e.clientX - r.left - 20, y: e.clientY - r.top - 20 }; });
});` },
    { slug: 'modal', category: 'Motion & accessibility', title: 'Modal dialog', summary: 'A native <dialog> driven by a signal: focus trap, Escape, backdrop, focus return.', api: ['modal', 'mount'],
        why: 'The browser already has an accessible modal. <code>modal(dialog, open)</code> calls <code>showModal()</code>/<code>close()</code> as the signal changes and writes Escape, the backdrop and the close button back into the signal. No z-index, no focus code.',
        notice: ['Escape, the backdrop and Cancel all resolve to “Kept”; only the Delete button returns <code>ok</code>.', 'Focus returns to the button that opened the dialog.', 'The dialog is server HTML: it renders without JavaScript, only the behaviour is added.'],
        try: 'Open it, press Escape, open it again and click outside.',
        html: `<div id="app"></div>
<dialog id="confirm"><form method="dialog"><p>Delete the project?</p><button value="cancel">Cancel</button><button value="ok" autofocus>Delete</button></form></dialog>`, js: `import { mount, modal } from 'aegis';

mount('#app', ({ signal, html, on }) => {
    const open = signal(false), status = signal('');
    const dialog = document.querySelector('#confirm');
    modal(dialog, open);
    on(dialog, 'close', () => { status.value = dialog.returnValue === 'ok' ? 'Deleted' : 'Kept'; });
    return html\`
        <button @click=\${() => { dialog.returnValue = ''; open.value = true; }}>Delete project…</button>
        <p><b>\${status}</b></p>\`;
});` },
    { slug: 'roving-menu', category: 'Motion & accessibility', title: 'Keyboard menu', summary: 'roving() gives a toolbar arrow-key navigation; announce() tells screen readers what happened.', api: ['roving', 'announce'],
        why: 'A composite widget has one tab stop; arrows move inside it. <code>roving()</code> manages <code>tabindex</code>, Home/End, wrapping and typeahead. <code>announce()</code> speaks through a permanent live region with a lossless queue, so rapid updates are not lost.',
        notice: ['Tab into the toolbar once, then use ← → Home End; Tab leaves it.', 'Type a letter to jump to the matching button.', 'Every activation is announced; screen readers hear it, sighted users see the status line.'],
        try: 'Focus the toolbar with Tab and press B, then Enter.',
        html: `<div id="toolbar" role="toolbar" aria-label="Formatting"><button>Bold</button><button>Italic</button><button>Underline</button><button>Code</button><button>Link</button></div>
<p id="status" class="muted">Nothing activated yet.</p>`, js: `import { roving, announce, on } from 'aegis';

const bar = document.getElementById('toolbar');
roving(bar, { wrap: true, typeahead: true, onActivate: (el) => { document.getElementById('status').textContent = 'Activated: ' + el.textContent; announce(el.textContent + ' activated'); } });
on(bar, 'click', (e) => { if (e.target.tagName === 'BUTTON') { document.getElementById('status').textContent = 'Activated: ' + e.target.textContent; announce(e.target.textContent + ' activated'); } });` },
];
