/**
 * Aegis test utilities — `import { render, fire, waitFor, mockFetch, cleanup } from 'aegis/test'`
 * Works in any browser test runner (test.html, Vitest browser mode, Playwright, Web Test Runner). No dependencies.
 *
 *   const t = render(Counter, { props: { start: 5 } });
 *   fire.click(t.find('button'));
 *   await waitFor(() => t.text().includes('6'));
 *   t.unmount();
 */
import { mount, destroy, settled, reset, configure, defaults, flushSync, batch, createScope, useClock, useScheduler, cache } from './aegis.js';

/**
 * Детерминированные часы кэша: staleTime, cacheTime и GC идут по ним, Date.now не трогается.
 *   const clock = fakeClock(); await clock.advance(31_000); … clock.restore();
 */
export function fakeClock(start = Date.now()) {
    let t = start;
    const restore = useClock(() => t);
    return {
        now: () => t,
        /** сдвинуть время, собрать мусор по новым часам и дождаться эффектов/ресурсов */
        async advance(ms) { t += ms; cache.gc(t); await flushAll(); },
        set(ms) { t = ms; cache.gc(t); },
        restore,
    };
}

const _mounted = new Set();

/**
 * Mount a component (the same `(ctx) => Node | api` contract as island()/mount()) into a fresh container in document.body.
 * @param {Function} Component
 * @param {{ props?: object, el?: Element, html?: string }} [opts] — html: server markup to hydrate/adopt against
 */
export function render(Component, opts = {}) {
    const container = opts.el || document.createElement('div');
    if (!opts.el) { container.setAttribute('data-aegis-test', ''); document.body.appendChild(container); }
    if (opts.html != null) container.innerHTML = opts.html;
    const props = opts.props || {};
    const result = mount(container, (ctx) => Component({ ...ctx, props }));
    flushSync();
    const handle = {
        el: container,
        api: result && typeof result === 'object' && !(result.el instanceof Element && typeof result.destroy === 'function') ? result : null,
        /** querySelector inside the container; throws with a readable message when missing */
        find(selector) { const n = container.querySelector(selector); if (!n) throw new Error(`render(): nothing matches "${selector}" in\n${container.innerHTML.slice(0, 400)}`); return n; },
        findAll(selector) { return [...container.querySelectorAll(selector)]; },
        /** textContent with collapsed whitespace */
        text() { return container.textContent.replace(/\s+/g, ' ').trim(); },
        html() { return container.innerHTML; },
        unmount() { destroy(container); if (!opts.el) container.remove(); _mounted.delete(handle); },
    };
    _mounted.add(handle);
    return handle;
}

const _event = (el, type, init = {}) => {
    const Ctor = /^key/.test(type) ? KeyboardEvent : /^(click|dbl|mouse|pointer|context)/.test(type) ? (type.startsWith('pointer') ? PointerEvent : MouseEvent) : /^(focus|blur)/.test(type) ? FocusEvent : /^(input|change)$/.test(type) ? Event : /^submit$/.test(type) ? SubmitEvent : Event;
    const ev = new Ctor(type, { bubbles: true, cancelable: true, composed: true, ...init });
    el.dispatchEvent(ev);
    return ev;
};

/** Dispatch real DOM events (bubbling, cancelable). `fire(el, 'custom', { detail })` for anything else. */
export function fire(el, type, init) { return _event(el, type, init); }
fire.click = (el, init) => _event(el, 'click', init);
fire.dblclick = (el, init) => _event(el, 'dblclick', init);
/** set the value like a user would: value + input + change (checkbox/radio: checked) */
fire.input = (el, value) => {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!value;
    else if (el.tagName === 'SELECT') { el.value = value; }
    else el.value = value == null ? '' : String(value);
    _event(el, 'input');
    _event(el, 'change');
};
fire.change = (el, value) => { if (value !== undefined) el.value = value; return _event(el, 'change'); };
fire.submit = (form) => { const f = form.tagName === 'FORM' ? form : form.closest('form'); return f.requestSubmit ? (f.requestSubmit(), null) : _event(f, 'submit'); };
fire.key = (el, key, init = {}) => { const down = _event(el, 'keydown', { key, ...init }); if (!down.defaultPrevented) { _event(el, 'keypress', { key, ...init }); } _event(el, 'keyup', { key, ...init }); return down; };
fire.focus = (el) => { el.focus(); return _event(el, 'focusin', { bubbles: true }); };
fire.blur = (el) => { el.blur(); return _event(el, 'focusout', { bubbles: true }); };
fire.scroll = (el, top) => { if (top != null) el.scrollTop = top; return _event(el, 'scroll', { bubbles: false }); };

/**
 * Wait until `pred()` is truthy (or resolves), draining Aegis work between checks: effects, pending resources/mutations,
 * microtasks and a macrotask. Timer-throttled tabs are fine — it never sleeps longer than needed.
 */
export async function waitFor(pred, { timeout = 3000, interval = 20 } = {}) {
    const t0 = Date.now();
    let lastError = null;
    for (;;) {
        try { const v = await pred(); if (v) return v; } catch (e) { lastError = e; }
        if (Date.now() - t0 > timeout) throw new Error(`waitFor: condition not met within ${timeout} ms` + (lastError ? `: ${lastError.message}` : ''));
        flushSync();
        await settled();
        await new Promise(r => setTimeout(r, interval));
    }
}

/** Drain everything that is pending right now (effects, resources, mutations, microtasks) without waiting for a condition */
export async function flushAll() { flushSync(); await settled(); await new Promise(r => queueMicrotask(r)); flushSync(); }

let _restoreFetch = null;
/**
 * Route table → fake network for request()/api/resource(): `mockFetch({ 'GET /api/users': () => [...], 'POST /api/users': (body, { url, params }) => ({ id: 1 }) })`
 * Patterns: 'METHOD /path/:param' (params in ctx), '/path' (any method), '*' fallback. A handler may return data (JSON 200),
 * a Response, `{ status, body }`, or throw. `.calls` records every request; `.restore()` puts the real fetch back.
 */
export function mockFetch(routes = {}, { latency = 0 } = {}) {
    const table = Object.entries(routes).map(([k, h]) => {
        const m = k.match(/^(?:([A-Z]+)\s+)?(.+)$/);
        const method = m[1] || null, pattern = m[2];
        const keys = [];
        const re = pattern === '*' ? /.*/ : new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/?]+)'; }) + '$');
        return { method, re, keys, h };
    });
    const calls = [];
    const fake = async (input, init = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        const method = (init.method || (input && input.method) || 'GET').toUpperCase();
        let body = init.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { /* raw */ } }
        calls.push({ method, url: url.pathname + url.search, body, headers: init.headers || {} });
        if (latency) await new Promise(r => setTimeout(r, latency));
        if (init.signal && init.signal.aborted) throw new DOMException('The user aborted a request.', 'AbortError');
        for (const r of table) {
            if (r.method && r.method !== method) continue;
            const m = url.pathname.match(r.re);
            if (!m) continue;
            const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
            const out = await r.h(body, { url, params, query: Object.fromEntries(url.searchParams), method, init });
            if (out instanceof Response) return out;
            if (out && typeof out === 'object' && 'status' in out && ('body' in out || 'data' in out)) return new Response(JSON.stringify(out.body ?? out.data), { status: out.status, headers: { 'Content-Type': 'application/json' } });
            return new Response(out === undefined ? '' : JSON.stringify(out), { status: out === undefined ? 204 : 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ message: `mockFetch: no route for ${method} ${url.pathname}` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    };
    configure({ fetch: fake });
    _restoreFetch = () => configure({ fetch: null });
    return { calls, restore() { if (_restoreFetch) { _restoreFetch(); _restoreFetch = null; } }, last: () => calls[calls.length - 1] || null };
}

/** Unmount everything rendered by render(), restore fetch, reset engine singletons (components, caches, warnings). beforeEach/afterEach. */
export function cleanup() {
    for (const h of [..._mounted]) h.unmount();
    if (_restoreFetch) { _restoreFetch(); _restoreFetch = null; }
    reset();
    defaults.motion = false;
}

/** Run `fn` inside a throwaway scope and dispose it afterwards — for testing signals/effects without a component */
export async function withScope(fn) {
    const scope = createScope('test');
    try { return await scope.run(() => batch(fn)); } finally { scope.dispose(); }
}

/**
 * Детерминированный планировщик для тестов отзывчивости: виртуальное время, очереди micro/frame/idle/yield как явные списки,
 * cost(name) — виртуальная стоимость запуска эффекта, trace — [t, lane, effect]. inp(t0) — INP-оракул синтетического события:
 * конец синхронной части − t0 + presentation до границы кадра 16.7 мс.
 */
export function fakeScheduler({ cost = () => 0.5 } = {}) {
    let t = 0, pending = false, endSync = 0;
    const q = { micro: [], frame: [], idle: [], yield: [] }, trace = [];
    const restore = useScheduler({
        now: () => t,
        micro: (f) => q.micro.push(f),
        frame: (f) => q.frame.push(f),
        idle: (f) => q.idle.push(f),
        yield: () => new Promise(r => q.yield.push(r)),
        inputPending: () => pending,
        onRun: (obs, lane) => { t += cost(obs._name); trace.push([t, lane, obs._name]); if (lane === 'sync') endSync = t; },
    });
    const drain = (k) => { const l = q[k]; q[k] = []; for (const f of l) f(k === 'idle' ? { timeRemaining: () => 8, didTimeout: false } : t); };
    return {
        now: () => t,
        tick: (ms) => { t += ms; },
        micro: () => drain('micro'),
        frame: () => { t = Math.ceil(t / 16.7) * 16.7; drain('frame'); },
        idle: () => drain('idle'),
        yields: () => { pending = false; drain('yield'); },
        input: () => { pending = true; },
        trace,
        inp: (t0) => endSync - t0 + (16.7 - ((endSync - t0) % 16.7)),
        restore,
    };
}
