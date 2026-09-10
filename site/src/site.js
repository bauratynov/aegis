// aegisjs.com — the site chrome is built with Aegis itself (custom tree-shaken build: /aegis-site.js)
import { signal, computed, island, html, list, persisted } from '/aegis-site.js';

// ── theme ────────────────────────────────────────────────────────────────────
island('theme-toggle', ({ html, effect }) => {
    const theme = persisted('aegis:theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    effect(() => { document.documentElement.dataset.theme = theme.value; });
    const flip = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark'; };
    return html`<button class="icon-btn" title="Toggle theme" aria-label="Toggle theme" @click=${flip}>${() => theme.value === 'dark'
        ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>`
        : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`}</button>`;
});

// ── search ───────────────────────────────────────────────────────────────────
let indexPromise = null;
const loadIndex = () => indexPromise || (indexPromise = fetch('/search.json').then(r => r.json()).catch(() => []));
const tokens = (s) => s.toLowerCase().split(/[^a-z0-9а-яё$._]+/i).filter(Boolean);
const score = (e, q) => {
    const h = e.h.toLowerCase(), t = e.t.toLowerCase(), x = e.x.toLowerCase();
    let s = 0;
    for (const w of q) {
        if (h === w) s += 60; else if (h.startsWith(w)) s += 30; else if (h.includes(w)) s += 18;
        if (t.includes(w)) s += 6;
        if (x.includes(w)) s += 4; else if (!h.includes(w) && !t.includes(w)) return 0;
    }
    return s + (e.k === 'api' ? 2 : 0);
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

island('site-search', ({ html, on, effect }) => {
    const query = signal(''), open = signal(false), sel = signal(0), index = signal([]), q = signal('');
    effect(() => { const v = query.value; const t = setTimeout(() => { q.value = v; }, 80); return () => clearTimeout(t); });
    const results = computed(() => {
        const words = tokens(q.value); if (!words.length) return [];
        return index.value.map(e => [score(e, words), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 12).map(([, e]) => e);
    });
    effect(() => { results.value; sel.value = 0; });
    const go = () => { const r = results.value[sel.value]; if (r) location.href = r.u; };
    const focus = async () => { open.value = true; if (!index.value.length) index.value = await loadIndex(); };
    on(document, 'keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const i = document.querySelector('.search input'); i && i.focus(); }
    });
    on(document, 'pointerdown', (e) => { if (!e.target.closest('.search')) open.value = false; });
    const key = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = Math.min(sel.value + 1, results.value.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = Math.max(sel.value - 1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); go(); }
        else if (e.key === 'Escape') { open.value = false; e.target.blur(); }
    };
    return html`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search docs…" aria-label="Search" autocomplete="off" bind:value=${query} @focus=${focus} @input=${focus} @keydown=${key}>
        <kbd>Ctrl K</kbd>
        ${() => open.value && q.value.trim() ? html`<div class="res">${() => results.value.length
            ? list(results, (r, i) => html`<a href=${r.u} class=${{ sel: () => i.value === sel.value }} @pointerenter=${() => { sel.value = i.value; }}><b>${mark(r.h, tokens(q.value))} <span>· ${r.t}</span></b><small>${mark(r.x.slice(0, 140), tokens(q.value))}</small></a>`, { key: 'u' })
            : html`<div class="none">Nothing found for “${q}”</div>`}</div>` : null}`;
});

// ── landing: the README counter, alive ───────────────────────────────────────
island('counter', ({ props, signal, html }) => {
    const count = signal(props.start);
    return html`<button @click=${() => count.value++}>Clicked ${count} times</button><small>← this is the island from the code above, hydrated from <code>data-start="${props.start}"</code></small>`;
}, { types: { start: Number } });

// ── plain helpers: copy buttons, sidebar, TOC spy, example tabs ──────────────
for (const pre of document.querySelectorAll('pre')) {
    if (pre.closest('.play')) continue;
    const b = document.createElement('button'); b.className = 'copy'; b.textContent = 'Copy'; b.type = 'button';
    b.onclick = async () => { try { await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText); b.textContent = 'Copied'; b.classList.add('done'); } catch { b.textContent = 'Select & copy'; } setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1500); };
    pre.appendChild(b);
}
const burger = document.querySelector('.burger'), side = document.querySelector('.side');
if (burger && side) burger.onclick = () => side.classList.toggle('open');
const toc = document.querySelector('.toc');
if (toc) {
    const links = [...toc.querySelectorAll('a')], byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const heads = [...document.querySelectorAll('.content h2[id], .content h3[id]')].filter(h => byId.has(h.id));
    let current = null;
    const io = new IntersectionObserver(() => {
        const y = scrollY + 90; let best = null;
        for (const h of heads) if (h.offsetTop <= y) best = h;
        if (best && best !== current) { current = best; links.forEach(a => a.classList.remove('on')); byId.get(best.id).classList.add('on'); }
    }, { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] });
    heads.forEach(h => io.observe(h));
    addEventListener('scroll', () => io.takeRecords(), { passive: true });
}
for (const ex of document.querySelectorAll('.ex')) {
    const tabs = ex.querySelectorAll('.tabs button'), panes = ex.querySelectorAll('[data-pane]');
    tabs.forEach(t => { t.onclick = () => { tabs.forEach(x => x.classList.toggle('on', x === t)); panes.forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; }); }; });
}
