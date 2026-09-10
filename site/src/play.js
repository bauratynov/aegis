// aegisjs.com/play — edit, run (Ctrl+Enter), share a link. The iframe imports the full engine from /aegis.js.
const PRESETS = {
    counter: `import { mount } from 'aegis';

mount('#app', ({ signal, html }) => {
    const count = signal(0);
    return html\`<button @click=\${() => count.value++}>Clicked \${count} times</button>\`;
});`,
    island: `import { island } from 'aegis';

// server HTML (already on the page):
document.body.insertAdjacentHTML('afterbegin', '<div data-aegis="hello" data-name="Aegis" data-n="3"><p>Hello …</p></div>');

island('hello', ({ props, signal, html }) => {
    const n = signal(props.n);
    return html\`<p>Hello \${props.name} × \${n} <button @click=\${() => n.value++}>+</button></p>\`;
}, { types: { n: Number } });`,
    todos: `import { mount } from 'aegis';

mount('#app', ({ signal, html, list }) => {
    const todos = signal([{ id: 1, text: 'Ship it', done: false }]);
    const draft = signal('');
    const add = () => { if (!draft.value.trim()) return; todos.value = [...todos.value, { id: Date.now(), text: draft.value, done: false }]; draft.value = ''; };
    const toggle = (t) => { todos.value = todos.value.map(x => x === t ? { ...x, done: !x.done } : x); };
    return html\`
        <form @submit.prevent=\${add}>
            <input bind:value=\${draft} placeholder="What needs doing?">
            <button ?disabled=\${() => !draft.value.trim()}>Add</button>
        </form>
        <ul>\${list(todos, (t) => html\`<li style=\${{ textDecoration: t.done ? 'line-through' : 'none' }} @click=\${() => toggle(t)}>\${t.text}</li>\`, { key: 'id' })}</ul>\`;
});`,
    resource: `import { mount, resource } from 'aegis';

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
});`,
    form: `import { mount, form, required, minLen, emailRule } from 'aegis';

mount('#app', ({ html }) => {
    const f = form({
        name: { value: '', rules: [required(), minLen(2)] },
        email: { value: '', rules: [required(), emailRule()] },
    }, { onSubmit: async (values) => { await new Promise(r => setTimeout(r, 500)); console.log('saved', values); } });
    return html\`
        <form @submit.prevent=\${f.submit}>
            <p><input bind:field=\${f.field('name')} placeholder="Name"> <small>\${() => f.errors.name}</small></p>
            <p><input bind:field=\${f.field('email')} placeholder="Email"> <small>\${() => f.errors.email}</small></p>
            <button ?disabled=\${() => !f.canSubmit.value}>\${() => f.submitting.value ? 'Saving…' : 'Save'}</button>
        </form>\`;
});`,
    reactive: `import { mount, reactive } from 'aegis';

mount('#app', ({ html, list }) => {
    const state = reactive({
        rows: [{ id: 1, name: 'Ada', score: 92 }, { id: 2, name: 'Linus', score: 71 }, { id: 3, name: 'Grace', score: 88 }],
        q: '',
        get shown() { return this.rows.filter(r => r.name.toLowerCase().includes(this.q.toLowerCase())).sort((a, b) => b.score - a.score); },
        bump(r) { r.score += 1; },
    });
    return html\`
        <input bind:value=\${() => state.q} @input=\${e => { state.q = e.target.value; }} placeholder="Filter…">
        <table>\${list(() => state.shown, r => html\`<tr><td>\${() => r.name}</td><td>\${() => r.score}</td><td><button @click=\${() => state.bump(r)}>+1</button></td></tr>\`, { key: 'id' })}</table>\`;
});`,
};

const $ = (id) => document.getElementById(id);
const code = $('code'), frame = $('frame'), out = $('console'), preset = $('preset'), msg = $('msg');
for (const k of Object.keys(PRESETS)) preset.append(new Option(k, k));

const AEGIS_URL = location.origin + '/aegis.js';
const run = () => {
    out.textContent = '';
    const src = code.value;
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script type="importmap">${JSON.stringify({ imports: { aegis: AEGIS_URL } })}<\/script>
<script>
window.__AEGIS_DEV__ = true;
const send = (level, args) => parent.postMessage({ pg: level, text: args.map(a => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); } }).join(' ') }, '*');
for (const l of ['log', 'warn', 'error', 'info']) { const o = console[l].bind(console); console[l] = (...a) => { o(...a); send(l, a); }; }
addEventListener('error', (e) => send('error', [e.message]));
addEventListener('unhandledrejection', (e) => send('error', [String(e.reason && e.reason.message || e.reason)]));
<\/script>
<style>body{font:14px system-ui,sans-serif;padding:14px;color:#1A2233} input,button{font:inherit;padding:6px 10px;border:1px solid #E6E3DA;border-radius:6px} button{background:#E8B42E;border-color:#C99A18;cursor:pointer} td{padding:4px 8px}</style></head>
<body><div id="app"></div>
<script type="module">${src.replace(/<\/script/g, '<\\/script')}<\/script></body></html>`;
};
addEventListener('message', (e) => {
    if (!e.data || !e.data.pg) return;
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
    location.hash = 'code=' + await pack(code.value);
    try { await navigator.clipboard.writeText(location.href); msg.textContent = 'Link copied'; } catch (e) { msg.textContent = 'Link is in the address bar'; }
    setTimeout(() => { msg.textContent = ''; }, 2000);
};
preset.onchange = () => { code.value = PRESETS[preset.value]; run(); };
code.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Tab') { e.preventDefault(); const s = code.selectionStart; code.setRangeText('    ', s, code.selectionEnd, 'end'); }
});
(async () => {
    const m = location.hash.match(/code=([A-Za-z0-9_-]+)/);
    const p = new URLSearchParams(location.search).get('preset');
    if (m) { try { code.value = await unpack(m[1]); } catch (e) { code.value = PRESETS.counter; } }
    else { code.value = PRESETS[p] || PRESETS.counter; if (PRESETS[p]) preset.value = p; }
    run();
})();
