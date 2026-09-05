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
                            ${list(() => current.value.effects, (ef) => html`<div class="row"><span class="n" title=${ef.name}>${ef.name}</span><span class="deps">← ${ef.deps.join(', ') || '—'}</span></div>`, { key: (ef, i) => ef.name + '#' + i })}
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
