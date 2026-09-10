// aegisjs.com/play — two files (index.html = server HTML, app.js = your module), CodeMirror editor, sandboxed result frame with the mock server.
import { createEditor } from '/cm.js';
import { createRunner, pack, unpack } from '/runner.js';

const P = (label, html, js) => ({ label, html, js });
const PRESETS = {
    counter: P('Counter', `<div id="app"></div>`, `import { mount } from 'aegis';

mount('#app', ({ signal, html }) => {
    const count = signal(0);
    return html\`<button @click=\${() => count.value++}>Clicked \${count} times</button>\`;
});`),
    island: P('Island on server HTML', `<!-- rendered by your server; the island wakes it up -->
<div data-aegis="hello" data-name="Aegis" data-n="3">
    <p>Hello Aegis × 3</p>
</div>`, `import { island } from 'aegis';

island('hello', ({ props, signal, html }) => {
    const n = signal(props.n);
    return html\`<p>Hello \${props.name} × \${n} <button @click=\${() => n.value++}>+</button></p>\`;
}, { types: { n: Number } });`),
    todos: P('Todo list · list()', `<div id="app"></div>`, `import { mount } from 'aegis';

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
});`),
    resource: P('Data · resource() + when()', `<div id="app"></div>`, `import { mount, resource } from 'aegis';

// GET /api/users is answered by the mock server of this page (see "Server requests")
mount('#app', ({ html, when, list }) => {
    const users = resource('/api/users');
    return html\`
        <button @click=\${users.refresh}>Reload</button>
        \${when(users, {
            loading: () => html\`<p>Loading…</p>\`,
            error: (e, retry) => html\`<p>\${e.message} <button @click=\${retry}>Retry</button></p>\`,
            data: (rows, rowsSignal) => html\`<ul>\${list(rowsSignal, (u) => html\`<li>\${u.name}</li>\`, { key: 'id' })}</ul>\`,
        })}\`;
});`),
    mutation: P('Optimistic mutation with rollback', `<div id="app"></div>`, `import { mount, resource, mutation, defaults } from 'aegis';

window.__server.failEvery = 3;   // the mock server fails every third POST so you can watch the rollback

mount('#app', ({ html, when }) => {
    const likes = resource('/api/likes');
    const like = mutation(() => defaults.fetcher('/api/likes', { method: 'POST' }), {
        resources: [likes],                                  // snapshot before, rollback on error
        optimistic: () => likes.mutate(v => ({ count: v.count + 1 })),
    });
    return html\`
        \${when(likes, { data: (v) => html\`<p>\${() => v.count} likes</p>\` })}
        <button @click=\${like} ?disabled=\${like.pending}>\${() => like.pending.value ? 'Saving…' : 'Like'}</button>
        <p class="muted">\${() => like.error.value ? 'Rolled back: ' + like.error.value.message : 'Every third click fails on purpose.'}</p>\`;
});`),
    form: P('Form · rules and submit state', `<div id="app"></div>`, `import { mount, form, required, minLen, emailRule } from 'aegis';

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
});`),
    router: P('Hash router', `<nav><a href="#/">Home</a> · <a href="#/users/3">User 3</a> · <a href="#/users/7">User 7</a></nav>
<div id="app"></div>`, `import { router, html } from 'aegis';

const r = router({
    '/': () => html\`<p>Home. Pick a user above.</p>\`,
    '/users/:id': (params) => html\`<p>User #\${params.id}</p>\`,
    '*': () => html\`<p>Not found</p>\`,
}, { root: document.getElementById('app'), hash: true, activeClass: 'on' });`),
    reactive: P('reactive() store with getters', `<div id="app"></div>`, `import { mount, reactive } from 'aegis';

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
});`),
};

// ── the same thing in React and Vue, for the "vs React / Vue" tab ──────────────
const COMPARE = {
    counter: { react: { deps: 'react, react-dom + a bundler (Vite)', code: `import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}

createRoot(document.getElementById('app')).render(<Counter />);` }, vue: { deps: 'vue + a bundler for .vue files (or the runtime compiler build)', code: `<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>

<template>
  <button @click="count++">Clicked {{ count }} times</button>
</template>

<!-- main.js -->
import { createApp } from 'vue';
import Counter from './Counter.vue';
createApp(Counter).mount('#app');` } },
    island: { react: { deps: 'react, react-dom + a bundler; hydrateRoot needs the same tree the server rendered, so the server must render with React too', code: `// server: renderToString(<Hello name="Aegis" n={3} />) — Django/Rails/PHP cannot do this without a Node process
import { useState } from 'react';
import { hydrateRoot } from 'react-dom/client';

function Hello({ name, n: start }) {
    const [n, setN] = useState(start);
    return <p>Hello {name} × {n} <button onClick={() => setN(n + 1)}>+</button></p>;
}

const el = document.querySelector('[data-hello]');
hydrateRoot(el, <Hello name={el.dataset.name} n={+el.dataset.n} />);` }, vue: { deps: 'vue; the server markup is replaced, not adopted, unless you also render it with Vue SSR', code: `import { createApp, ref } from 'vue';

const el = document.querySelector('[data-hello]');
createApp({
    setup() { const n = ref(+el.dataset.n); return { n, name: el.dataset.name }; },
    template: '<p>Hello {{ name }} × {{ n }} <button @click="n++">+</button></p>',
}).mount(el);   // the server's <p>Hello Aegis × 3</p> is thrown away and re-rendered` } },
    todos: { react: { deps: 'react, react-dom + a bundler', code: `import { useState } from 'react';

function Todos() {
    const [todos, setTodos] = useState([{ id: 1, text: 'Ship it', done: false }]);
    const [draft, setDraft] = useState('');
    const add = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text) return;
        setTodos([...todos, { id: Date.now(), text, done: false }]);
        setDraft('');
    };
    const toggle = (t) => setTodos(todos.map(x => x === t ? { ...x, done: !x.done } : x));
    return (
        <>
            <form onSubmit={add}>
                <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="What needs doing?" />
                <button disabled={!draft.trim()}>Add</button>
            </form>
            <ul>{todos.map(t => <li key={t.id} className={t.done ? 'done' : ''} onClick={() => toggle(t)}>{t.text}</li>)}</ul>
        </>
    );
}` }, vue: { deps: 'vue + a bundler for .vue files', code: `<script setup>
import { ref } from 'vue';
const todos = ref([{ id: 1, text: 'Ship it', done: false }]);
const draft = ref('');
function add() {
    const text = draft.value.trim();
    if (!text) return;
    todos.value.push({ id: Date.now(), text, done: false });
    draft.value = '';
}
</script>

<template>
  <form @submit.prevent="add">
    <input v-model="draft" placeholder="What needs doing?" />
    <button :disabled="!draft.trim()">Add</button>
  </form>
  <ul><li v-for="t in todos" :key="t.id" :class="{ done: t.done }" @click="t.done = !t.done">{{ t.text }}</li></ul>
</template>` } },
    resource: { react: { deps: 'react, react-dom, @tanstack/react-query (or a hand-written useEffect with loading/error/abort state) + a bundler', code: `import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

const client = new QueryClient();

function Users() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetch('/api/users').then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    });
    if (isLoading) return <p>Loading…</p>;
    if (error) return <p>{error.message} <button onClick={() => refetch()}>Retry</button></p>;
    return (
        <>
            <button onClick={() => refetch()}>Reload{isFetching ? '…' : ''}</button>
            <ul>{data.map(u => <li key={u.id}>{u.name}</li>)}</ul>
        </>
    );
}

createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><Users /></QueryClientProvider>);` }, vue: { deps: 'vue + a bundler; SWR needs @tanstack/vue-query or your own composable', code: `<script setup>
import { ref, onMounted } from 'vue';
const users = ref([]), loading = ref(true), error = ref(null);
async function load() {
    loading.value = true; error.value = null;
    try { const r = await fetch('/api/users'); if (!r.ok) throw new Error(r.statusText); users.value = await r.json(); }
    catch (e) { error.value = e; }
    finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <button @click="load">Reload</button>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error">{{ error.message }} <button @click="load">Retry</button></p>
  <ul v-else><li v-for="u in users" :key="u.id">{{ u.name }}</li></ul>
</template>` } },
    form: { react: { deps: 'react, react-dom, react-hook-form (or hand-written state per field) + a bundler', code: `import { useForm } from 'react-hook-form';

function Form() {
    const { register, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm({ mode: 'onBlur' });
    const save = async (values) => { await new Promise(r => setTimeout(r, 500)); console.log('saved', values); };
    return (
        <form onSubmit={handleSubmit(save)}>
            <p><input {...register('name', { required: 'Required', minLength: { value: 2, message: 'Min 2' } })} placeholder="Name" /> <small>{errors.name?.message}</small></p>
            <p><input {...register('email', { required: 'Required', pattern: { value: /\\S+@\\S+/, message: 'Email' } })} placeholder="Email" /> <small>{errors.email?.message}</small></p>
            <button disabled={!isValid || isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
        </form>
    );
}` }, vue: { deps: 'vue, vee-validate (or hand-written rules) + a bundler', code: `<script setup>
import { useForm, useField } from 'vee-validate';
const { handleSubmit, isSubmitting, meta } = useForm();
const { value: name, errorMessage: nameError } = useField('name', v => !v ? 'Required' : v.length < 2 ? 'Min 2' : true);
const { value: email, errorMessage: emailError } = useField('email', v => !v ? 'Required' : !/\\S+@\\S+/.test(v) ? 'Email' : true);
const save = handleSubmit(async (values) => { await new Promise(r => setTimeout(r, 500)); console.log('saved', values); });
</script>

<template>
  <form @submit="save">
    <p><input v-model="name" placeholder="Name" /> <small>{{ nameError }}</small></p>
    <p><input v-model="email" placeholder="Email" /> <small>{{ emailError }}</small></p>
    <button :disabled="!meta.valid || isSubmitting">{{ isSubmitting ? 'Saving…' : 'Save' }}</button>
  </form>
</template>` } },
    mutation: { react: { deps: 'react, react-dom, @tanstack/react-query + a bundler; optimistic updates are ~15 lines of onMutate / onError / onSettled', code: `const client = useQueryClient();
const likes = useQuery({ queryKey: ['likes'], queryFn: () => fetch('/api/likes').then(r => r.json()) });
const like = useMutation({
    mutationFn: () => fetch('/api/likes', { method: 'POST' }).then(r => { if (!r.ok) throw new Error('500'); return r.json(); }),
    onMutate: async () => {
        await client.cancelQueries({ queryKey: ['likes'] });
        const previous = client.getQueryData(['likes']);
        client.setQueryData(['likes'], (v) => ({ count: v.count + 1 }));
        return { previous };
    },
    onError: (err, vars, ctx) => client.setQueryData(['likes'], ctx.previous),
    onSettled: () => client.invalidateQueries({ queryKey: ['likes'] }),
});
return (
    <>
        <p>{likes.data?.count} likes</p>
        <button onClick={() => like.mutate()} disabled={like.isPending}>{like.isPending ? 'Saving…' : 'Like'}</button>
        <p className="muted">{like.error ? 'Rolled back: ' + like.error.message : 'Every third click fails on purpose.'}</p>
    </>
);` }, vue: { deps: 'vue, @tanstack/vue-query + a bundler (same onMutate / onError dance as React)', code: `const client = useQueryClient();
const { data } = useQuery({ queryKey: ['likes'], queryFn: () => fetch('/api/likes').then(r => r.json()) });
const like = useMutation({
    mutationFn: () => fetch('/api/likes', { method: 'POST' }).then(r => { if (!r.ok) throw new Error('500'); return r.json(); }),
    onMutate: async () => {
        await client.cancelQueries({ queryKey: ['likes'] });
        const previous = client.getQueryData(['likes']);
        client.setQueryData(['likes'], (v) => ({ count: v.count + 1 }));
        return { previous };
    },
    onError: (e, v, ctx) => client.setQueryData(['likes'], ctx.previous),
    onSettled: () => client.invalidateQueries({ queryKey: ['likes'] }),
});` } },
};
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KW = /\b(?:import|export|from|const|let|var|function|return|if|else|for|of|in|while|new|class|this|async|await|try|catch|finally|throw|default|null|undefined|true|false)\b/;
const hl = (src) => { let out = '', last = 0; for (const m of src.matchAll(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->)|(`(?:\\[\s\S]|[^`])*`|'(?:\\.|[^'\n])*'|"(?:\\.|[^"\n])*")|([A-Za-z_$][\w$]*)/g)) { out += escHtml(src.slice(last, m.index)); last = m.index + m[0].length; if (m[1]) out += `<span class="cm">${escHtml(m[1])}</span>`; else if (m[2]) out += `<span class="str">${escHtml(m[2])}</span>`; else out += KW.test(m[3]) ? `<span class="kw">${m[3]}</span>` : m[3]; } return out + escHtml(src.slice(last)); };
const lines = (s) => s.split('\n').filter(l => l.trim() && !/^\s*(\/\/|<!--)/.test(l)).length;
const renderCompare = (key) => {
    const box = document.getElementById('compare'); if (!box) return;
    const c = COMPARE[key], p = PRESETS[key];
    if (!c) { box.innerHTML = '<p class="none">No comparison for this preset yet. Presets with a React and Vue version: counter, island, todos, resource, mutation, form.</p>'; return; }
    const n = { aegis: lines(p.js), react: lines(c.react.code), vue: lines(c.vue.code) };
    box.innerHTML = `<div class="tally"><span><b>Aegis</b> ${n.aegis} lines · 0 dependencies · no build</span><span><b>React</b> ${n.react} lines · ${escHtml(c.react.deps)}</span><span><b>Vue</b> ${n.vue} lines · ${escHtml(c.vue.deps)}</span></div>
    <div class="cols"><div class="col aegis"><h4>Aegis <span>${n.aegis} lines</span></h4><pre><code>${hl(p.js)}</code></pre></div><div class="col"><h4>React <span>${n.react} lines</span></h4><pre><code>${hl(c.react.code)}</code></pre></div><div class="col"><h4>Vue <span>${n.vue} lines</span></h4><pre><code>${hl(c.vue.code)}</code></pre></div></div>`;
};

const $ = (id) => document.getElementById(id);
const preset = $('preset'), msg = $('msg');
const files = { js: '', html: '' };
let active = 'js';
const runner = createRunner({ frame: $('frame'), consoleEl: $('console'), requestsEl: $('requests'), statusEl: $('status'), onError: (line) => { if (line) { if (active !== 'js') showTab('js'); editor.markError(line); } } });
const run = () => { editor.markError(null); runner.run(files); };
const editor = createEditor({ parent: $('editor'), doc: '', lang: 'js', onChange: (text) => { files[active] = text; preset.value = ''; }, onRun: run });
preset.append(new Option('Custom', '', true, true)); preset.options[0].hidden = true;
for (const [k, p] of Object.entries(PRESETS)) preset.append(new Option(p.label, k));
const showTab = (name) => { active = name; document.querySelectorAll('.play .ftab[data-file]').forEach(b => { const on = b.dataset.file === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); editor.set(files[name], name); editor.focus(); };
document.querySelectorAll('.play .ftab[data-file]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.file)));
document.querySelectorAll('.otab[data-out]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.otab[data-out]').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('[data-outpane]').forEach(p => { p.hidden = p.dataset.outpane !== b.dataset.out; }); }));
const load = (js, html) => { files.js = js; files.html = html; editor.set(files[active], active); };

$('run').onclick = run;
$('share').onclick = async () => {
    run();
    history.replaceState(null, '', location.pathname + '#code=' + await pack(JSON.stringify({ js: files.js, html: files.html })));
    try { await navigator.clipboard.writeText(location.href); msg.textContent = 'Link copied'; } catch (e) { msg.textContent = 'Link is in the address bar'; }
    setTimeout(() => { msg.textContent = ''; }, 2000);
};
preset.onchange = () => { const p = PRESETS[preset.value]; if (p) { load(p.js, p.html); history.replaceState(null, '', location.pathname + '?preset=' + preset.value); renderCompare(preset.value); run(); } };
{   // the resizer between editor and result
    const panes = document.querySelector('.play .panes'), bar = $('resizer');
    let drag = null;
    bar.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, w: panes.firstElementChild.getBoundingClientRect().width }; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', (e) => { if (!drag) return; const total = panes.getBoundingClientRect().width; const w = Math.min(Math.max(drag.w + e.clientX - drag.x, 280), total - 280); panes.style.gridTemplateColumns = `${w}px 6px minmax(0, 1fr)`; });
    bar.addEventListener('pointerup', () => { drag = null; });
}
(async () => {
    const m = location.hash.match(/code=([A-Za-z0-9_-]+)/);
    const p = new URLSearchParams(location.search).get('preset');
    if (m) {
        try { const text = await unpack(m[1]); let js = text, html = '<div id="app"></div>'; try { const o = JSON.parse(text); if (o && typeof o.js === 'string') { js = o.js; html = o.html || ''; } } catch {} load(js, html); preset.value = ''; }
        catch (e) { load(PRESETS.counter.js, PRESETS.counter.html); preset.value = 'counter'; }
    } else { const k = PRESETS[p] ? p : 'counter'; load(PRESETS[k].js, PRESETS[k].html); preset.value = k; }
    renderCompare(preset.value);
    run();
})();
