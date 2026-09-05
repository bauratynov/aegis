/**
 * Aegis DevTools — in-page inspector, built with Aegis itself. No extension, no build.
 *   Aegis.dev.panel()            from the console (or `import('aegis/devtools').then(m => m.open())`)
 *   ?aegis-devtools              in the URL
 * Shows live components (scope tree), their signals with current values, effects with dependencies,
 * engine stats, warnings, slow effects (dev.profile) — and highlights the component's element on hover.
 */
import { signal, computed, effect, html, list, show, mount, on, interval, dev, stats, onWarn, trace, destroy } from './aegis.js';

const CSS = `
:host { all: initial; position: fixed; right: 12px; bottom: 12px; z-index: 2147483000; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; color: #e6edf3 }
.panel { width: 420px; max-height: 70vh; display: grid; grid-template-rows: auto 1fr; background: #0d1117; border: 1px solid #30363d; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.45); overflow: hidden }
.panel.min { grid-template-rows: auto; max-height: none } .panel.min .body { display: none }
header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #161b22; border-bottom: 1px solid #30363d; cursor: default }
header b { color: #58a6ff } header .sp { flex: 1 } header button { background: none; border: 1px solid #30363d; color: inherit; border-radius: 6px; padding: 1px 7px; cursor: pointer; font: inherit } header button.on { border-color: #58a6ff; color: #58a6ff }
.body { display: grid; grid-template-columns: 170px 1fr; min-height: 0 }
.tree { overflow: auto; border-right: 1px solid #30363d } .tree div { padding: 3px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.tree div:hover { background: #161b22 } .tree div.sel { background: #1f6feb33; color: #58a6ff } .tree small { color: #8b949e }
.detail { overflow: auto; padding: 6px 10px } h4 { margin: 8px 0 4px; font-size: 11px; text-transform: uppercase; color: #8b949e; letter-spacing: .04em }
.row { display: flex; gap: 8px; padding: 2px 0; border-bottom: 1px solid #21262d } .row .n { color: #79c0ff; min-width: 120px; overflow: hidden; text-overflow: ellipsis } .row .v { color: #e6edf3; flex: 1; white-space: pre-wrap; word-break: break-all } .row .v.changed { color: #ffa657 }
.row .deps { color: #8b949e; flex: 1 } .row button { background: none; border: 0; color: #8b949e; cursor: pointer; font: inherit } .row button:hover { color: #58a6ff }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 6px 10px; border-bottom: 1px solid #30363d; background: #161b22 } .stats b { display: block; color: #58a6ff; font-size: 14px } .stats span { color: #8b949e }
.warn { color: #d29922 } .err { color: #f85149 } .empty { color: #8b949e; padding: 8px 0 }
`;

let _handle = null;

export function open() {
    if (_handle) return _handle;
    const host = document.createElement('aegis-devtools');
    host.setAttribute('data-aegis-ignore', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = CSS; shadow.appendChild(style);
    const root = document.createElement('div'); shadow.appendChild(root);
    document.body.appendChild(host);

    // подсветка элемента компонента
    const outline = document.createElement('div');
    outline.setAttribute('data-aegis-ignore', '');
    outline.style.cssText = 'position:fixed;pointer-events:none;z-index:2147482999;border:2px solid #58a6ff;background:#58a6ff22;border-radius:3px;display:none';
    document.body.appendChild(outline);
    const highlight = (el) => {
        if (!el || !el.getBoundingClientRect) { outline.style.display = 'none'; return; }
        const r = el.getBoundingClientRect();
        Object.assign(outline.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };

    const api = mount(root, ({ signal, computed, effect, html, list, show, on, interval }) => {
        const tick = signal(0);
        const minimized = signal(false);
        const profiling = signal(false);
        const selected = signal(null);           // выбранный scope (объект из dev.inspect)
        const warnings = signal([]);
        const prev = new Map();                  // name → предыдущее значение (подсветка изменений)
        const s = signal(stats());
        interval(() => { tick.value++; s.value = stats(); }, 500);
        const offWarn = onWarn((w) => { warnings.value = [...warnings.value.slice(-49), w]; });
        const comps = computed(() => { tick.value; try { return dev.inspect(); } catch (e) { return []; } });
        const current = computed(() => {
            tick.value;
            const sel = selected.value;
            if (!sel) return null;
            const fresh = comps.value.find(c => c.el === sel.el && c.scope === sel.scope) || sel;
            return fresh;
        });
        const changed = (name, value) => { const was = prev.get(name); prev.set(name, value); return was !== undefined && was !== value; };
        const fmt = (v) => v == null ? String(v) : typeof v === 'string' ? v : JSON.stringify(v);
        const graph = () => { try { navigator.clipboard.writeText(dev.graph()); } catch (e) { /* */ } };
        return html`
            <div class=${{ panel: true, min: minimized }}>
                <header>
                    <b>⚡ Aegis</b> <span>${() => comps.value.length} components · ${() => s.value.effects} effects · ${() => s.value.scopes} scopes</span>
                    <span class="sp"></span>
                    <button class=${{ on: profiling }} title="performance.measure on every flush (Performance panel)" @click=${() => { profiling.value = !profiling.value; dev.profile(profiling.value); }}>profile</button>
                    <button title="copy dependency graph (Mermaid)" @click=${graph}>graph</button>
                    <button @click=${() => { minimized.value = !minimized.value; }}>${() => minimized.value ? '▴' : '▾'}</button>
                    <button title="close" @click=${() => close()}>×</button>
                </header>
                <div class="body">
                    <div class="tree">
                        ${list(comps, (c) => html`<div class=${{ sel: () => current.value && current.value.el === c.el && current.value.scope === c.scope }}
                            @click=${() => { selected.value = c; }} @mouseenter=${() => highlight(c.el)} @mouseleave=${() => highlight(null)}>
                            ${c.scope || 'scope'} <small>${c.signals.length}s ${c.effects.length}e</small></div>`, { key: (c) => (c.scope || '') + '#' + (c.el ? c.el.tagName + (c.el.id || '') : '') })}
                        ${show(() => comps.value.length === 0, () => html`<div class="empty">no live components</div>`)}
                    </div>
                    <div class="detail">
                        <div class="stats">
                            <div><b>${() => s.value.flushes}</b><span>flushes</span></div>
                            <div><b>${() => s.value.effectRuns}</b><span>effect runs</span></div>
                            <div><b>${() => s.value.maxRounds}</b><span>max rounds</span></div>
                            <div><b>${() => s.value.resourceCache}</b><span>cache</span></div>
                        </div>
                        ${show(current, () => html`
                            <h4>signals</h4>
                            ${list(() => current.value.signals, (sg) => html`<div class="row"><span class="n" title=${sg.name}>${sg.name}</span><span class=${{ v: true, changed: () => changed(sg.name, sg.value) }}>${() => fmt(sg.value)}</span>${sg.ref ? html`<button title="log who writes this signal (trace)" @click=${() => trace(sg.ref)}>trace</button>` : ''}</div>`, { key: 'name' })}
                            <h4>effects</h4>
                            ${list(() => current.value.effects, (ef) => html`<div class="row"><span class="n" title=${ef.site || ef.name}>${ef.name}</span><span class="deps">← ${ef.deps.join(', ') || '—'}${ef.site ? ' · ' + ef.site : ''}</span></div>`, { key: (ef, i) => ef.name + '#' + i })}
                        `, () => html`<div class="empty">select a component</div>`)}
                        ${show(() => s.value.slow.length > 0, () => html`<h4>slow effects (&gt; 1 ms)</h4>${list(() => s.value.slow.slice().reverse(), (x) => html`<div class="row"><span class="n">${x.name}</span><span class="v">${x.ms} ms</span></div>`, { key: (x, i) => x.name + i })}`)}
                        ${show(() => warnings.value.length > 0, () => html`<h4>warnings</h4>${list(warnings, (w) => html`<div class=${'row ' + (w.code[0] === 'S' ? 'err' : 'warn')}><span class="n">${w.code}</span><span class="v">${w.what}</span></div>`, { key: (w, i) => w.code + i })}`)}
                    </div>
                </div>
            </div>`;
    });

    const close = () => { destroy(root); host.remove(); outline.remove(); _handle = null; };
    _handle = { host, shadow, close, highlight };
    return _handle;
}

export function close() { if (_handle) _handle.close(); }

if (typeof location !== 'undefined' && /[?&]aegis-devtools\b/.test(location.search)) {
    if (document.body) open(); else addEventListener('DOMContentLoaded', () => open(), { once: true });
}

// ───────────────────────────── explain(code) — ERRORS.md ─────────────────────────────
const DOCS = {"E001":{"what":"`effect()` created outside a scope — it will never be cleaned up.","fix":"Create it inside `component()`/`mount()` setup or `scope.run(() => …)`."},"E002":{"what":"A signal was written inside a `computed()`.","fix":"Computeds must be pure — move the write into an effect or an action."},"E003":{"what":"`mount(selector)` found no element.","fix":"Check the selector or call `mount()` after `DOMContentLoaded`."},"E004":{"what":"`list()` keys are missing or duplicated.","fix":"Pass a unique key: `list(items, render, { key: 'uuid' })`."},"E005":{"what":"A scope was created or `run()` on an already disposed scope.","fix":"Do not reuse disposed scopes — create a new one."},"E006":{"what":"A value in `html``` sits in an unsupported position (tag name, comment, `<script>`/`<style>` body) or a property/boolean/`bind:` binding has more than one value.","fix":"Put values into text or attributes; `.prop=${v}` takes exactly one value."},"E007":{"what":"Invalid JSON in `data-aegis-cache` or `jsonScript()`.","fix":"Serialize with JSON and escape `</script` as `<\\/script`."},"E008":{"what":"`slot()` called twice for the same selector.","fix":"Server children are moved once — keep the returned fragment."},"E009":{"what":"`bind:value` got something that is not a signal.","fix":"`bind:value=${mySignal}` — pass the signal, not `.value`."},"E010":{"what":"`register()` called twice with the same name, or with something that is not a setup function / `{ load }`.","fix":"Register each island once."},"E011":{"what":"`hydrate()` found `data-aegis=\"x\"` but nothing registered under `x`. The warning prints a ready-to-paste `register()` scaffold.","fix":"Register it (or check the name — the message suggests close matches)."},"E012":{"what":"A reactive child in `html``` returned more than 20 nodes.","fix":"Use `list(items, render, { key })` for collections."},"E013":{"what":"`clone()` / `show(cond, fragment)` had to fall back to `cloneNode` — bindings would be dead.","fix":"Pass a factory: `show(cond, () => html`…`)`."},"E014":{"what":"`attach()` element was never connected to the document.","fix":"Insert the template in the same task, or call `attach(el, fn)` after inserting."},"E015":{"what":"HTTP layer: unknown CSRF preset, or a response that looks like JSON but has a non-JSON `Content-Type`.","fix":"Use `django`/`rails`/`laravel`/`go` or a custom `{ header, cookie }`; send `Content-Type: application/json`."},"E016":{"what":"An effect returned a Promise.","fix":"Signals read after `await` are not tracked — move async work into `resource()`/`mutation()`/`watch()`."},"E017":{"what":"`onDispose()` called outside a scope.","fix":"Call it inside setup or `scope.run()`."},"E018":{"what":"`IntersectionObserver`/`ResizeObserver`/`MutationObserver` is missing in this environment (jsdom).","fix":"The observer is a no-op; polyfill it in tests if you need the behaviour."},"E019":{"what":"Lost reactivity: `text(el, count.value)`, `show(count.value > 3, …)`, an effect that read no signals, `setErrors()` with an unknown field, or a signal inside `css```.","fix":"Pass the signal or a function: `text(el, count)`, `show(() => count.value > 3, …)`."},"E020":{"what":"Unknown event modifier on `@event.mod`, or `.prevent` combined with `.passive`.","fix":"Supported: `prevent stop self once passive capture outside window document debounce.N throttle.N enter esc space tab up down left right delete backspace ctrl meta shift alt`."},"E021":{"what":"`persisted()` could not read or write storage.","fix":"The signal keeps working in memory; clear the key or fix `serialize`/`deserialize`."},"E022":{"what":"`inject(key)` found nothing provided.","fix":"`provide(key, value)` in a parent setup or pass a fallback: `inject(key, fallback)`."},"E023":{"what":"`swap()` did not find the `select` selector in the response.","fix":"Return the fragment itself or pass `{ select }` that matches the response."},"E024":{"what":"`adopt()` template does not match the server DOM (wrong element at a path, or a text value that is not the only child).","fix":"Keep the server partial and the template in sync; wrap text values in `<span>`."},"E025":{"what":"A `data-*` island prop looks numeric but is passed as a string.","fix":"Declare the type: `register(name, setup, { types: { count: Number } })`."},"E026":{"what":"The setup `ctx` has no such key (typo in the destructuring).","fix":"Use the suggested name from the warning; the full list is in `aegis.d.ts` (`SetupContext`)."},"E027":{"what":"A flush took many rounds — effects keep writing signals other effects depend on (ping-pong).","fix":"Derive with `computed()` instead of writing from an effect; batch related writes; break the cycle."},"E028":{"what":"Zombie binding: the node left the document, but the binding keeps updating it — it leaks until the owner scope is disposed.","fix":"Render the branch through `show()`/`list()`, or dispose the binding (`const off = text(el, …); off()`) before dropping the node."},"E029":{"what":"Two `resource()` instances fetched the same URL within a second.","fix":"Add `cache: { key }` so they share one request, or lift the resource into a parent and `provide()` it."},"E030":{"what":"The same URL was fetched many times within a second (a fetch loop).","fix":"Do not create a `resource()` inside an effect; give it a stable key; check `refetchOn` dependencies."},"E031":{"what":"A Promise or a plain object was rendered as text in `html``` (shows as `[object Promise]` / `[object Object]`).","fix":"Async work goes in `resource()` + `when(res, { data })`; pick a field or `JSON.stringify()` for objects."},"E032":{"what":"`@event` name is not a DOM event on that element (typo like `@clik`).","fix":"Use the suggested name; custom events need a dash (`@item-select`)."},"E033":{"what":"Vue / Alpine / Angular / mustache syntax inside `html``` (`v-if`, `x-data`, `{{ }}`) — inert here.","fix":"`show()` / `list()` / `bind:value` / `@click` / `${}` — see llms.txt \"Template syntax\"."},"E034":{"what":"`@event` got a non-function: the handler was called (`@click=${save()}`) or is `undefined`.","fix":"Pass the function: `@click=${save}` or `@click=${() => save(id)}`; `null`/`false` skips a handler on purpose."},"E035":{"what":"A resource URL contains `undefined`, `null`, `NaN` or `[object …]`.","fix":"Return `null` from the URL function until the value is ready — a null URL skips the request."},"E036":{"what":"`html()` was called as a function instead of a template tag.","fix":"`html`<p>${name}</p>`` with backticks; `tpl()` / `swap()` for server HTML strings."},"E037":{"what":"`router`: no route matches the URL and there is no `*` route.","fix":"Add `'*': () => render404()` or fix the pattern / `base`."},"E038":{"what":"`resource({ cache })` got a non-string cache key.","fix":"Pass a URL, an array key `cache: { key: ['users', id] }` or params — they are normalized."},"E039":{"what":"`staleTime` is larger than `cacheTime` — the entry is collected while still fresh.","fix":"Set `cacheTime >= staleTime` (or `Infinity` for reference data)."},"E040":{"what":"`invalidate(key)` matched no cache entry (query order, trailing slash, typo).","fix":"Use the suggested key, the prefix form `invalidate('/api/users*')`, an array key or a predicate."},"E041":{"what":"`revalidateOn` refetched 8+ entries at once on focus/reconnect (thundering herd).","fix":"Raise `staleTime` on slow-changing data or set `revalidateOn: []` where mutations already invalidate."},"S001":{"what":"Attempt to set `__proto__` / `prototype` / `constructor` on a reactive object — blocked.","fix":"Use a regular property name."}};
/** Объяснение кода из ERRORS.md; печатает в консоль и возвращает текст */
export function explain(code) {
    const c = String(code).toUpperCase();
    const doc = DOCS[c];
    const text = doc ? `[Aegis:${c}] ${doc.what}\n  Fix: ${doc.fix}\n  All codes: ERRORS.md` : `[Aegis] unknown code "${code}" — known: ${Object.keys(DOCS).join(', ')}`;
    console.log(text);
    return text;
}

// ───────────────────────────── notify(info) — dev-overlay ─────────────────────────────
let _toastHost = null;
const _seenToast = new Set();
/** Тост предупреждения в углу страницы (вызывается движком в dev-режиме); клик — открыть панель */
export function notify(info) {
    if (!document.body) return;
    const key = info.code + '|' + info.what;
    if (_seenToast.has(key)) return;
    _seenToast.add(key);
    if (!_toastHost) {
        _toastHost = document.createElement('aegis-devtools-toasts');
        _toastHost.setAttribute('data-aegis-ignore', '');
        const sh = _toastHost.attachShadow({ mode: 'open' });
        const st = document.createElement('style');
        st.textContent = `:host { all: initial; position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; display: grid; gap: 6px; max-width: 460px; font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace }
.t { background: #0d1117; color: #e6edf3; border: 1px solid #d29922; border-left-width: 4px; border-radius: 8px; padding: 8px 10px; box-shadow: 0 8px 24px rgba(0,0,0,.4); cursor: pointer; animation: in .15s ease-out }
.t.s { border-color: #f85149 } .t b { color: #d29922 } .t.s b { color: #f85149 } .t small { color: #8b949e; display: block; margin-top: 3px } .t .x { float: right; color: #8b949e; margin-left: 8px }
@keyframes in { from { opacity: 0; transform: translateY(6px) } }`;
        sh.appendChild(st);
        document.body.appendChild(_toastHost);
    }
    const sh = _toastHost.shadowRoot;
    while (sh.querySelectorAll('.t').length >= 3) sh.querySelector('.t').remove();
    const t = document.createElement('div');
    t.className = 't' + (info.code[0] === 'S' ? ' s' : '');
    t.innerHTML = '<span class="x">×</span><b></b> <span class="w"></span><pre></pre><small></small>';
    const pre = t.querySelector('pre');
    if (info.snippetText) { pre.textContent = info.snippetText; pre.style.cssText = 'margin:6px 0 0;padding:6px 8px;background:#161b22;border-radius:6px;white-space:pre;overflow:auto;font:11px/1.4 inherit;color:#e6edf3'; } else pre.remove();
    t.querySelector('b').textContent = info.code;
    t.querySelector('.w').textContent = info.what;
    t.querySelector('small').textContent = (info.site ? info.site + ' · ' : '') + (info.where ? info.where + ' · ' : '') + 'Fix: ' + info.fix + ' · click for the inspector';
    t.addEventListener('click', (e) => { t.remove(); if (!e.target.classList.contains('x')) { const p = open(); if (info.el && info.el.isConnected) p.highlight(info.el); } });
    sh.appendChild(t);
    setTimeout(() => t.remove(), 12000);
}

// ───────────────────────────── snippet(at, strings, index, token) — исходник с кареткой ─────────────────────────────
const _srcCache = new Map();
function _source(url) {
    let p = _srcCache.get(url);
    if (!p) { p = (typeof fetch === 'function' ? fetch(url).then(r => r.ok ? r.text() : null) : Promise.resolve(null)).catch(() => null); _srcCache.set(url, p); }
    return p;
}
/** Смещение в тексте по line:col (1-based) */
function _offsetOf(text, line, col) {
    let pos = 0;
    for (let l = 1; l < line; l++) { pos = text.indexOf('\n', pos); if (pos < 0) return -1; pos++; }
    return pos + col - 1;
}
/** Позиция значения #index (или токена token) внутри html``-литерала, начинающегося после site */
function _locateInTemplate(text, site, strings, index, token) {
    const from = _offsetOf(text, site.line, site.col);
    if (from < 0) return -1;
    const tick = text.indexOf('`', Math.max(0, from - 8));
    if (tick < 0 || tick - from > 4000) return -1;
    if (token != null) { const i = text.indexOf(token, tick); return i >= 0 && i - tick < 20000 ? i : -1; }
    const raw = strings && strings.raw;
    if (!raw) return -1;
    let pos = tick + 1;
    for (let i = 0; i < raw.length; i++) {
        if (text.substr(pos, raw[i].length) !== raw[i]) return -1;
        pos += raw[i].length;
        if (i === index) return pos;                 // начало ${
        if (i === raw.length - 1) return -1;
        if (text.substr(pos, 2) !== '${') return -1;
        pos += 2;
        let depth = 1;
        while (depth && pos < text.length) {
            const ch = text[pos];
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
            else if (ch === '`' || ch === "'" || ch === '"') { const q = ch; pos++; while (pos < text.length && text[pos] !== q) { if (text[pos] === '\\') pos++; pos++; } }
            pos++;
        }
    }
    return -1;
}
/** Строка исходника с кареткой под позицией */
function _caretLine(text, pos, label) {
    const ls = text.lastIndexOf('\n', pos - 1) + 1;
    let le = text.indexOf('\n', pos); if (le < 0) le = text.length;
    const line = text.slice(ls, le), col = pos - ls;
    const lineNo = text.slice(0, ls).split('\n').length;
    const trimmed = line.replace(/^\s+/, ''), shift = line.length - trimmed.length;
    const width = Math.max(1, Math.min(40, (line.slice(col).match(/^\$\{[^}]*\}|^\S+/) || [''])[0].length));
    const head = `  ${lineNo} | `;
    return `${head}${trimmed.slice(0, 160)}\n${' '.repeat(head.length + col - shift)}${'^'.repeat(width)}${label ? ' ' + label : ''}`;
}
/** Строка исходника с кареткой под виновным ${} — файл подтягивается fetch-ем один раз на URL (вызывается ядром из _warn) */
export function snippet(at, strings, index, token) {
    if (!at || !at.url) return Promise.resolve(null);
    return _source(at.url).then(text => {
        if (!text) return null;
        let pos = -1, label = '';
        if (strings && (index >= 0 || token != null)) { pos = _locateInTemplate(text, at, strings, index, token); label = token != null ? '' : `value #${index + 1}`; }
        if (pos < 0) pos = _offsetOf(text, at.line, at.col);
        return pos >= 0 ? _caretLine(text, pos, label) : null;
    }).catch(() => null);
}
