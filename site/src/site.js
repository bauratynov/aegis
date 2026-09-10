// aegisjs.com — the site chrome is built with Aegis itself (custom tree-shaken build: /aegis-site.js)
import { signal, computed, island, mount, html, list, persisted } from '/aegis-site.js';

// ── theme ────────────────────────────────────────────────────────────────────
island('theme-toggle', ({ html, effect }) => {
    const theme = persisted('aegis:theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    effect(() => { document.documentElement.dataset.theme = theme.value; });
    const flip = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark'; };
    return html`<button class="icon-btn" title="Toggle theme" aria-label="Toggle theme" aria-pressed=${() => String(theme.value === 'dark')} @click=${flip}><i class=${() => 'fa-solid ' + (theme.value === 'dark' ? 'fa-sun' : 'fa-moon')} aria-hidden="true"></i></button>`;
});

// ── search ───────────────────────────────────────────────────────────────────
let indexPromise = null;
const loadIndex = () => indexPromise || (indexPromise = fetch('/search.json').then(r => r.json()).catch(() => []));
const tokens = (s) => s.toLowerCase().split(/[^a-z0-9а-яё$._:@-]+/i).filter(Boolean);
const score = (e, q) => {
    const h = e.h.toLowerCase(), t = e.t.toLowerCase(), x = e.x.toLowerCase();
    let s = 0;
    for (const w of q) {
        if (h === w) s += 60; else if (h.startsWith(w)) s += 30; else if (h.includes(w)) s += 18;
        if (t.includes(w)) s += 6;
        if (x.includes(w)) s += 4; else if (!h.includes(w) && !t.includes(w)) return 0;
    }
    return s + (e.k === 'docs' ? 2 : 0);
};
const mark = (text, q) => {
    const parts = []; let rest = text, guard = 0;
    while (rest && guard++ < 20) {
        let best = -1, len = 0;
        for (const w of q) { const i = rest.toLowerCase().indexOf(w); if (i >= 0 && (best < 0 || i < best)) { best = i; len = w.length; } }
        if (best < 0) { parts.push(rest); break; }
        parts.push(rest.slice(0, best), html`<mark>${rest.slice(best, best + len)}</mark>`);
        rest = rest.slice(best + len);
    }
    return parts;
};
const KIND = { api: 'API', docs: 'Docs', examples: 'Example', errors: 'Code' };
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

island('site-search', ({ el, html, on, effect }) => {
    const query = signal(''), open = signal(false), sel = signal(0), index = signal([]), q = signal('');
    effect(() => { const v = query.value; const t = setTimeout(() => { q.value = v; }, 80); return () => clearTimeout(t); });
    const results = computed(() => {
        const words = tokens(q.value); if (!words.length) return [];
        return index.value.map(e => [score(e, words), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([, e]) => e);
    });
    const listOpen = computed(() => open.value && !!q.value.trim());
    effect(() => { results.value; sel.value = 0; });
    const go = () => { const r = results.value[sel.value]; if (r) location.href = r.u; };
    const focus = async () => { open.value = true; if (!index.value.length) index.value = await loadIndex(); };
    const editable = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    on(document, 'keydown', (e) => {
        const input = el.querySelector('input');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el.classList.add('open'); input.focus(); }
        else if (e.key === '/' && !editable(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); el.classList.add('open'); input.focus(); }
    });
    on(document, 'pointerdown', (e) => { if (!e.target.closest('.search')) { open.value = false; el.classList.remove('open'); } });
    // mobile: the collapsed icon opens a full-width field under the header
    on(el, 'click', (e) => { if (matchMedia('(max-width: 800px)').matches && !el.classList.contains('open')) { e.preventDefault(); el.classList.add('open'); requestAnimationFrame(() => el.querySelector('input').focus()); } });
    const key = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = Math.min(sel.value + 1, results.value.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = Math.max(sel.value - 1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); go(); }
        else if (e.key === 'Escape') { open.value = false; el.classList.remove('open'); e.target.blur(); }
    };
    return html`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search docs…" aria-label="Search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="search-list" aria-expanded=${() => String(listOpen.value)} aria-activedescendant=${() => listOpen.value && results.value.length ? 'sr-' + sel.value : null} bind:value=${query} @focus=${focus} @input=${focus} @keydown=${key}>
        <kbd>${isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        ${() => listOpen.value ? html`<div class="res" id="search-list" role="listbox" aria-label="Search results">${() => results.value.length
            ? list(results, (r, i) => html`<a href=${r.u} id=${() => 'sr-' + i.value} role="option" aria-selected=${() => String(i.value === sel.value)} class=${{ sel: () => i.value === sel.value }} @pointerenter=${() => { sel.value = i.value; }}><span class="k">${KIND[r.k] || r.k}</span><b>${mark(r.h, tokens(q.value))}</b><small>${r.t} · ${mark(r.x.slice(0, 140), tokens(q.value))}</small></a>`, { key: 'u' })
            : html`<div class="none" role="status">Nothing found for “${q}”</div>`}<div class="hint"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div>` : null}`;
});

// ── landing: the README counter, alive ───────────────────────────────────────
island('counter', ({ props, signal, html }) => {
    const count = signal(props.start);
    return html`<button @click=${() => count.value++}>Clicked ${count} times</button><small>← this is the island from the code above, hydrated from <code>data-start="${props.start}"</code></small>`;
}, { types: { start: Number } });

// ── page chrome as one component: copy buttons, mobile menu, sidebar, TOC spy — all listeners live in its scope ────
mount(document.body, ({ on, delegate, signal, effect, html }) => {
    // copy buttons on every code block (the playground has its own toolbar)
    for (const pre of document.querySelectorAll('pre')) {
        if (pre.closest('.play')) continue;
        const state = signal('Copy');
        pre.appendChild(html`<button class=${{ copy: true, done: () => state.value === 'Copied' }} type="button" aria-label="Copy code" @click=${async () => {
            try { await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText); state.value = 'Copied'; } catch { state.value = 'Select & copy'; }
            setTimeout(() => { state.value = 'Copy'; }, 1500);
        }}>${state}</button>`);
    }
    // mobile menu: the site sections (hidden nav) + the docs/API sidebar when the page has one
    const burger = document.querySelector('.burger');
    if (burger) {
        const open = signal(false);
        const side = document.querySelector('.side');
        const menu = html`<nav class=${{ mnav: true, open }} id="mnav" aria-label="Site"><div class="primary">${[...document.querySelectorAll('.top nav a')].map(a => a.cloneNode(true))}</div>${side ? (() => { const s = side.cloneNode(true); s.className = 'side-copy'; return s; })() : null}</nav>`;
        document.body.appendChild(menu);
        effect(() => {
            const o = open.value;
            burger.setAttribute('aria-expanded', String(o)); document.body.classList.toggle('menu-open', o);
            const i = burger.querySelector('i'); if (i) { i.classList.toggle('fa-bars', !o); i.classList.toggle('fa-xmark', o); }
            if (o) document.querySelector('.mnav .side-copy a.on')?.scrollIntoView({ block: 'center' });
        });
        on(burger, 'click', () => { open.value = !open.value; });
        delegate(document, 'click', '.mnav a', () => { open.value = false; });
        on(document, 'keydown', (e) => { if (e.key === 'Escape') open.value = false; });
    }
    // desktop sidebar: keep the active item in view
    const side = document.querySelector('.side');
    if (side) { const a = side.querySelector('a.on'); if (a && side.scrollHeight > side.clientHeight) side.scrollTop = a.offsetTop - side.clientHeight / 2 + a.offsetHeight / 2; }
    // "On this page" scroll spy
    const toc = document.querySelector('.toc');
    if (toc) {
        const links = [...toc.querySelectorAll('a')], byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
        const heads = [...document.querySelectorAll('.content h2[id], .content h3[id]')].filter(h => byId.has(h.id));
        const current = signal(null);
        on(window, 'scroll', () => { const y = scrollY + 90; let best = null; for (const h of heads) if (h.offsetTop <= y) best = h; current.value = best && best.id; }, { passive: true });
        effect(() => { const id = current.value; links.forEach(a => { const isOn = a.getAttribute('href') === '#' + id; a.classList.toggle('on', isOn); if (isOn) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); });
        dispatchEvent(new Event('scroll'));
    }
    // examples: Result / Source tabs
    delegate(document, 'click', '.ex .tabs button', (e, t) => {
        const ex = t.closest('.ex');
        ex.querySelectorAll('.tabs button').forEach(x => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', String(x === t)); });
        ex.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
    });
});
