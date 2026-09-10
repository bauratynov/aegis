// aegisjs.com/play — edit, run (Ctrl+Enter), share a link. The sandboxed iframe imports the full engine from /aegis.js.
const PRESETS = {
    counter: ['Counter', `import { mount } from 'aegis';

mount('#app', ({ signal, html }) => {
    const count = signal(0);
    return html\`<button @click=\${() => count.value++}>Clicked \${count} times</button>\`;
});`],
    island: ['Island on server HTML', `import { island } from 'aegis';

// server HTML (already on the page):
document.body.insertAdjacentHTML('afterbegin', '<div data-aegis="hello" data-name="Aegis" data-n="3"><p>Hello …</p></div>');

island('hello', ({ props, signal, html }) => {
    const n = signal(props.n);
    return html\`<p>Hello \${props.name} × \${n} <button @click=\${() => n.value++}>+</button></p>\`;
}, { types: { n: Number } });`],
    todos: ['Todo list · list()', `import { mount } from 'aegis';

mount('#app', ({ signal, html, list }) => {
    const todos = signal([{ id: 1, text: 'Ship it', done: false }]);
    const draft = signal('');
    const add = () => {
        const text = draft.value.trim();
        if (!text) return;
        todos.value = [...todos.value, { id: Date.now(), text, done: false }];
        draft.value = '';
    };
    const toggle = (t) => { todos.value = todos.value.map(x => x === t ? { ...x, done: !x.done } : x); };
    return html\`
        <form @submit.prevent=\${add}>
            <input bind:value=\${draft} placeholder="What needs doing?">
            <button ?disabled=\${() => !draft.value.trim()}>Add</button>
        </form>
        <ul>\${list(todos, (t) => html\`<li class="\${t.done ? 'done' : ''}" @click=\${() => toggle(t)}>\${t.text}</li>\`, { key: 'id' })}</ul>\`;
});`],
    resource: ['Data · resource() + when()', `import { mount, resource } from 'aegis';

const fetcher = async (url) => { await new Promise(r => setTimeout(r, 400)); return [{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }]; };

mount('#app', ({ html, when, list }) => {
    const users = resource('/api/users', { fetcher });
    return html\`
        <button @click=\${users.refresh}>Reload</button>
        \${when(users, {
            loading: () => html\`<p>Loading…</p>\`,
            error: (e, retry) => html\`<p>\${e.message} <button @click=\${retry}>Retry</button></p>\`,
            data: (rows, rowsSignal) => html\`<ul>\${list(rowsSignal, (u) => html\`<li>\${u.name}</li>\`, { key: 'id' })}</ul>\`,
        })}\`;
});`],
    mutation: ['Optimistic mutation with rollback', `import { mount, resource, mutation } from 'aegis';

// mock server: the third save fails so you can watch the rollback
let saves = 0, likes = 12;
const fetcher = async () => ({ likes });
const save = async () => { await new Promise(r => setTimeout(r, 500)); if (++saves % 3 === 0) throw new Error('500 from the server'); return { likes: ++likes }; };

mount('#app', ({ html, when }) => {
    const post = resource('/api/post/1', { fetcher });
    const like = mutation(save, {
        resources: [post],                                  // snapshot before, rollback on error
        optimistic: () => post.mutate(p => ({ ...p, likes: p.likes + 1 })),
    });
    return html\`
        \${when(post, { data: (p) => html\`<p>\${() => p.likes} likes</p>\` })}
        <button @click=\${like} ?disabled=\${like.pending}>\${() => like.pending.value ? 'Saving…' : 'Like'}</button>
        <p class="muted">\${() => like.error.value ? 'Rolled back: ' + like.error.value.message : 'Every third click fails on purpose.'}</p>\`;
});`],
    form: ['Form · rules and submit state', `import { mount, form, required, minLen, emailRule } from 'aegis';

mount('#app', ({ html }) => {
    const f = form({
        name: { value: '', rules: [required, minLen(2)] },
        email: { value: '', rules: [required, emailRule] },
    });
    const save = async (values) => { await new Promise(r => setTimeout(r, 500)); console.log('saved', values); };
    return html\`
        <form @submit.prevent=\${() => f.submit(save)}>
            <p><input bind:field=\${f.field('name')} placeholder="Name"> <small>\${f.errors.name}</small></p>
            <p><input bind:field=\${f.field('email')} placeholder="Email"> <small>\${f.errors.email}</small></p>
            <button ?disabled=\${() => !f.canSubmit.value}>\${() => f.submitting.value ? 'Saving…' : 'Save'}</button>
        </form>\`;
});`],
    router: ['Hash router', `import { mount, router, html } from 'aegis';

document.body.insertAdjacentHTML('afterbegin', '<nav><a href="#/">Home</a> · <a href="#/users/3">User 3</a> · <a href="#/users/7">User 7</a></nav>');

const r = router({
    '/': () => html\`<p>Home. Pick a user above.</p>\`,
    '/users/:id': (params) => html\`<p>User #\${params.id}</p>\`,
    '*': () => html\`<p>Not found</p>\`,
}, { root: document.getElementById('app'), hash: true, activeClass: 'on' });`],
    reactive: ['reactive() store with getters', `import { mount, reactive } from 'aegis';

mount('#app', ({ html, list }) => {
    const state = reactive({
        rows: [{ id: 1, name: 'Ada', score: 92 }, { id: 2, name: 'Linus', score: 71 }, { id: 3, name: 'Grace', score: 88 }],
        q: '',
        get shown() { return [...this.rows].filter(r => r.name.toLowerCase().includes(this.q.toLowerCase())).sort((a, b) => b.score - a.score); },
        bump(r) { r.score += 1; },
    });
    return html\`
        <input bind:value=\${[() => state.q, v => state.q = v]} placeholder="Filter…">
        <table>\${list(() => state.shown, r => html\`<tr><td>\${() => r.name}</td><td>\${() => r.score}</td><td><button @click=\${() => state.bump(r)}>+1</button></td></tr>\`, { key: 'id' })}</table>\`;
});`],
};

const $ = (id) => document.getElementById(id);
const code = $('code'), frame = $('frame'), out = $('console'), preset = $('preset'), msg = $('msg'), status = $('status');
preset.append(new Option('Custom', '', true, true)); preset.options[0].hidden = true;
for (const [k, [label]] of Object.entries(PRESETS)) preset.append(new Option(label, k));

const AEGIS_URL = location.origin + '/aegis.js';
const run = () => {
    out.textContent = '';
    status.textContent = 'Running…';
    const src = code.value;
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script type="importmap">${JSON.stringify({ imports: { aegis: AEGIS_URL } })}<\/script>
<script>
window.__AEGIS_DEV__ = true;
const fmt = (a) => { try { if (a instanceof Error) return a.stack || a.message; if (a instanceof Node) return a.outerHTML || String(a); if (a && typeof a === 'object' && 'peek' in a && 'value' in a) return 'Signal(' + JSON.stringify(a.peek()) + ')'; return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); } };
const send = (level, args) => parent.postMessage({ pg: level, text: args.map(fmt).join(' ') }, '*');
for (const l of ['log', 'warn', 'error', 'info', 'debug']) { const o = console[l].bind(console); console[l] = (...a) => { o(...a); send(l === 'debug' ? 'log' : l, a); }; }
console.table = (d) => console.log(d); console.dir = (d) => console.log(d);
addEventListener('error', (e) => send('error', [e.message + (e.lineno ? ' (line ' + (e.lineno - 10) + ')' : '')]));
addEventListener('unhandledrejection', (e) => send('error', [String(e.reason && e.reason.message || e.reason)]));
addEventListener('load', () => parent.postMessage({ pg: 'ready' }, '*'));
<\/script>
<style>body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:14px;color:#2B2F36;margin:0}input,select,textarea{font:inherit;padding:6px 9px;border:1px solid #CFD8DE;border-radius:6px;margin:2px 0}button{font:inherit;font-weight:600;padding:6px 12px;border:1px solid #123A4D;border-radius:6px;background:#184C64;color:#fff;cursor:pointer}button:disabled{opacity:.5;cursor:default}td{padding:4px 8px}ul{padding-left:20px}li.done{text-decoration:line-through;color:#6B7280}.muted{color:#6B7280;font-size:13px}small{color:#C8353B}nav a.on{font-weight:700}</style></head>
<body><div id="app"></div>
<script type="module">${src.replace(/<\/script/g, '<\\/script')}<\/script></body></html>`;
};
addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow || !e.data || !e.data.pg) return;
    if (e.data.pg === 'ready') { status.textContent = 'Ran at ' + new Date().toLocaleTimeString(); return; }
    const line = document.createElement('div');
    line.className = e.data.pg;
    line.textContent = (e.data.pg === 'log' || e.data.pg === 'info' ? '› ' : e.data.pg === 'warn' ? '⚠ ' : '✗ ') + e.data.text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
});

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pack = async (text) => { const cs = new CompressionStream('gzip'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(text)); w.close(); return b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer())); };
const unpack = async (s) => { const ds = new DecompressionStream('gzip'); const w = ds.writable.getWriter(); w.write(unb64u(s)); w.close(); return new Response(ds.readable).text(); };

$('run').onclick = run;
$('share').onclick = async () => {
    run();
    history.replaceState(null, '', location.pathname + '#code=' + await pack(code.value));
    try { await navigator.clipboard.writeText(location.href); msg.textContent = 'Link copied'; } catch (e) { msg.textContent = 'Link is in the address bar'; }
    setTimeout(() => { msg.textContent = ''; }, 2000);
};
preset.onchange = () => { if (PRESETS[preset.value]) { code.value = PRESETS[preset.value][1]; history.replaceState(null, '', location.pathname + '?preset=' + preset.value); run(); } };
code.addEventListener('input', () => { preset.value = ''; });
code.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    else if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey) { e.preventDefault(); const s = code.selectionStart; code.setRangeText('    ', s, code.selectionEnd, 'end'); }
    else if (e.key === 'Escape') { code.blur(); $('run').focus(); }
});
(async () => {
    const m = location.hash.match(/code=([A-Za-z0-9_-]+)/);
    const p = new URLSearchParams(location.search).get('preset');
    if (m) { try { code.value = await unpack(m[1]); preset.value = ''; } catch (e) { code.value = PRESETS.counter[1]; preset.value = 'counter'; } }
    else { const k = PRESETS[p] ? p : 'counter'; code.value = PRESETS[k][1]; preset.value = k; }
    run();
})();
