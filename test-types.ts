// Type tests — compiled by `tsc -p tsconfig.types.json` on `npm test`, never executed.
// Each block asserts what autocomplete promises: what compiles here exists at runtime, and vice versa.
import {
    signal, computed, effect, createScope, debounced, html, list, form, minLen, required, emailRule,
    resource, HttpError, defineElement, element, island, i18n, reactive, router, ref, attach, flush, stats,
    type Signal, type ReadonlySignal, type Computed, type ValidationRule, type HtmlValue,
} from './aegis.js';

// ── #59: methods the runtime has
const count = signal(0);
count.update(v => v + 1);
const doubled: Computed<number> = computed(() => count.value * 2);
doubled.dispose();
const ro: ReadonlySignal<number> = doubled;
// @ts-expect-error — read-only
ro.value = 1;
const d = debounced((q: string) => q.length, 100);
d('a'); d.flush('b'); d.cancel();
const scope = createScope('name');
scope.run(() => effect(() => { count.value; }, { flush: 'micro', trace: true }));
flush();
stats().effectRuns;
// @ts-expect-error — a plain { value } is not a Signal
const notSignal: Signal<number> = { value: 1, peek: () => 1, subscribe: () => () => {}, update: () => {} };

// ── #90: html`` accepts values it can render, rejects what it can't
html`<p class=${{ on: count }} title=${() => 'x'}>${count} ${'s'} ${1} ${null} ${[html`<i></i>`]}</p>`;
html`<input ${ref<HTMLInputElement>()} ${attach(el => { el.focus(); })}>`;
// @ts-expect-error — a Promise renders as [object Promise]; use when()/resource()
html`<p>${fetch('/x')}</p>`;
// @ts-expect-error — Date is not Displayable; use ${String(date)} or t.date()
html`<p>${new Date()}</p>`;
const v: HtmlValue = 'ok'; void v;

// ── #59: list() has no 4th options argument
list(signal([{ id: 1 }]), (item) => html`<i>${item.id}</i>`, 'id');
list(signal([{ id: 1 }]), (item) => html`<i>${() => item.value.id}</i>`, { key: 'id', item: 'signal' });
list(signal([{ id: 1 }]), (item: Signal<{ id: number }>) => html`<i>${() => item.value.id}</i>`, { key: 'id', item: 'signal' });
// @ts-expect-error — enter/exit are not list options (transition: true is)
list(signal([{ id: 1 }]), (item) => html`<i>${item.id}</i>`, { key: 'id', enter() {} });

// ── #90: form — shorthand schema and typed rules
const f1 = form({ name: '', age: 0 });
const nameSig: Signal<string> = f1.fields.name;
const ageSig: Signal<number> = f1.fields.age;
void nameSig; void ageSig;
const f2 = form({ name: { value: '', rules: [required, minLen(3), emailRule] }, age: { value: 0, rules: [required] } });
const n2: Signal<string> = f2.fields.name; void n2;
// @ts-expect-error — minLen checks strings; a numeric field never satisfies it
form({ age: { value: 0, rules: [minLen(3)] } });
const custom: ValidationRule<number> = (v) => v > 0 ? null : 'positive';
form({ qty: { value: 1, rules: [custom] } });

// ── #61: resource with initial has no null; HttpError narrows
interface User { id: number; name: string }
const users = resource('/api/users', { initial: [] as User[] });
users.data.value.map(u => u.name);
const maybe = resource<User[]>('/api/users');
// @ts-expect-error — without initial data may be null
maybe.data.value.map(u => u.name);
if (users.error.value instanceof HttpError) { const s: number = users.error.value.status; void s; users.error.value.response.headers; }

// ── #60: defineElement / element — props typed from { type, default }
defineElement('x-counter', {
    props: { count: { type: Number, default: 0 }, label: { type: String }, on: { type: Boolean } },
    setup(el, props) {
        const n: number = props.count.value;                 // default: 0 → number, not number | null
        const l: string | null = props.label.value;
        const b: boolean = props.on.value;
        void n; void l; void b; void el;
        // @ts-expect-error — unknown prop
        props.nope;
    },
});
// @ts-expect-error — custom element names need a dash (DOMException at runtime)
defineElement('counter', {});
element('x-uni', ({ props }) => { const n: number = props.count; const s: string | null = props.title; void n; void s; }, { props: { count: { type: Number, default: 0 }, title: String } });
island('counter', ({ props }) => { const n: number | null = props.count; const raw: unknown = props.anything; void n; void raw; }, { types: { count: Number } });

// ── #90: i18n keys from the dictionary
const t = i18n({ save: 'Save', 'nav.home': 'Home' });
t('save'); t('nav.home', { n: 2 });
// @ts-expect-error — typo in a key
t('svae');
t.locale.value = 'de'; t.num(1234.5, { style: 'currency', currency: 'EUR' }); t.date(new Date()); t.plural(3, { one: 'item', other: 'items' });
const t2 = i18n({ en: { save: 'Save' }, de: { save: 'Speichern' } }, { locale: 'de', fallback: 'en' });
t2('save');

// ── #40: route params from the pattern
router({
    '/users/:id': (params) => { const id: string = params.id; void id; },
    '/posts/:slug/comments/:cid': { handler: (params) => { const c: string = params.cid; void c; } },
});

// ── cache API, useClock, invalidate grammar
import { cache, useClock, invalidate, mutation, configure, api } from './aegis.js';
const cached: User[] | undefined = cache.get<User[]>(['users', 1]);
cache.set({ b: 1, a: 2 }, { x: 1 }, { staleTime: 30_000 });
const ex = cache.explain('/api/users'); const st: 'fresh' | 'stale' | 'inflight' | 'error' | 'empty' | 'absent' = ex.state; void st; void cached;
ex.history[0]?.reason; cache.stats().prefetch.byKind; cache.keys('/api/'); cache.remove('/api/*'); cache.gc(Date.now());
const offCache = cache.on((key, ev) => { void key; void ev.result; }); offCache();
const restore = useClock(() => 1000); restore();
await invalidate('/api/users*'); await invalidate(['users', 42]); await invalidate({ tags: ['users'], refetch: 'all' }); await invalidate((k) => k.startsWith('/api/'));
mutation(async () => 1, { invalidates: ['/api/users*', ['users']], awaitInvalidates: false });
resource('/api/rows', { cache: { key: ['rows', () => 1], tags: 'rows', interval: (d: unknown) => (d ? 0 : 5000), background: true, pin: true, cacheTime: Infinity }, share: 'uuid', dedupe: false });
configure({ cache: { maxEntries: 200, maxBytes: 4 << 20 }, revalidate: { focus: 10_000, concurrency: 4, stagger: 20 } });
configure({ invalidateHeader: 'HX-Trigger', breaker: { threshold: 3, cooldown: 2000, key: (u) => new URL(u, 'http://x').pathname }, retryBudget: { ratio: 0.1, min: 3 } });
resource('/api/a', { cache: { staleTime: 'http', cacheTime: 'http' } }); resource('/api/b', { cache: { staleTime: ['http', 5000] } }); resource('/api/c', { cache: { staleTime: { auto: true, k: 50, min: 2000 } } });
const herr = new HttpError(503, new Response(), null); herr.circuit; herr.retryAt; herr.budget; herr.retryAfter; cache.explain('/api/a').etag;
configure({ identify: (o) => (o && o.id != null ? 'user:' + o.id : null) });
const m3 = cache.merge3({ a: 1 }, { a: 2 }, { a: 1 }); m3.conflicts.length; cache.patchEntity('user:1', (u) => ({ ...u, name: 'x' }));
resource<User[]>('/api/users', { cache: { seeds: (d: User[]) => d.map(u => ['/api/users/' + u.id, u]), entity: false } });
mutation<[User], User>(async (v, { etag }) => api.put('/api/users/' + v.id, v, { ifMatch: etag || undefined }) as Promise<User>, {
    commit: (saved: User, base) => saved, updates: { '/api/users*': (list: User[], saved: User) => list.map(u => u.id === saved.id ? saved : u) },
    patch: (saved: User) => [['user:' + saved.id, () => saved]],
    onConflict: ({ base, local, server, merge }) => { const r = merge(); return r.conflicts.length ? 'server' : r.value; },
});
const sz: number = cache.size().bytes; void sz; cache.stats().limits.maxEntries;

// ── cache phase 6 — persist / sync / leader / offline dead-letter
import { leader } from './aegis.js';
resource<User[]>('/api/users', { cache: { persist: { version: 2, maxBytes: 5_000_000, maxAge: 86_400_000 }, sync: false, staleTime: 60_000 } });
resource<User[]>('/api/users', { cache: { persist: true } });
const rec = await cache.persisted('/api/users'); if (rec) { const at: number = rec.at; void at; }
const hyd: boolean = await cache.hydrated(['users', 1]); void hyd;
const isLeader = leader('sse', { fallback: false }); const l: boolean = isLeader.value; void l; isLeader.release();
const off = resource<number[]>('/api/queue', { offline: { maxAttempts: 5 } });
const dead = off.failed.value; if (dead.length) { const url: string = dead[0].mutation.url; void url; }

import { predictor, speculate, prefetchOn, prefetch, boost, type Predictor } from './aegis.js';
// ── cache phase 7 — speculation budget / intent / predictor / speculate
configure({ speculation: { maxInflight: 2, saveData: 'respect' }, prefetch: { minUtility: 0, hoverDelay: 'auto', horizon: 1500 } });
configure({ speculation: false });
prefetch('/api/next', { p: 0.4, kind: 'predict' }); prefetch('/api/x', { force: true });
prefetchOn(document.body, (a) => a.getAttribute('data-api'), { on: 'hover', delay: 'auto', velocity: 300, p: () => 0.5, rootMargin: 'auto' });
const pred: Predictor = predictor({ decay: 0.95, kappa: 5, storage: null });
pred.learn('/a', '/b'); const top = pred.next('/a', ['/b', '/c'])[0]; const pp: number = top.p; void pp; pred.prior('/a', { '/b': 0.6 }); pred.p('/a', '/b'); pred.reset();
const r7 = router({ '/u/:id': { loader: (p, { signal, speculative }) => ({ id: p.id, spec: !!speculative, aborted: !!signal?.aborted }), handler: () => {} } },
    { preload: { on: 'hover', delay: 'auto' }, preloadTTL: 20_000, preloadData: true, predict: { predictor: pred, topK: 2, minP: 0.3 } });
r7.preload('/u/1', 0.5);
const b7 = boost({ prefetch: { on: 'visible', rootMargin: 'auto' }, predict: true }); b7.prefetch('/orders', 0.4);
const undo7 = speculate({ prerender: 'conservative', exclude: '[data-no-speculate]' }); undo7();
const sp7 = stats().speculation; if (sp7) { const q: number = sp7.queued; void q; }
const cs7 = cache.stats(); const gh: number = cs7.ghost; void gh; cs7.speculation.skipped; cs7.prefetch.hoverDelay;

import { lens, signals, linked, bind, onError, type FunctionBinding } from './aegis.js';
// ── core phase 2b — lens / signals / function bindings / onError
const cents = signal(250);
const price = lens(() => cents.value / 100, (v) => { cents.value = Math.round(v * 100); }); price.value = 3; price.update(v => v + 1);
const addr = { city: '' }; const city = lens(addr, 'city'); city.value = 'Almaty';
const fb: FunctionBinding<string> = [() => addr.city, (v) => { addr.city = v; }];
bind(document.createElement('input'), fb); bind(document.createElement('input'), city);
const { count: cnt, total: tot } = signals({ count: 1, get total(): number { return (cnt as Signal<number>).value * 2; } }); const tv: number = tot.value; void tv;
const lk = linked(() => cnt.value); lk.update(v => v + 1);
const offErr = onError((e, info) => { void e; if (info) { const s: string = info.effect; void s; } }); offErr();

import { form as form3, wireForm as wireForm3, setValidationMessages, i18n as i18n3, type FieldRef, type FormStatus } from './aegis.js';
// ── forms phase 3 — issues / canSubmit / wire / field / status
const f3 = form3({ email: '', age: 0 }, { rules: { email: [required, emailRule] }, mode: 'blur-then-live', native: true });
const iss: string | null = f3.issues.email.value; void iss; const cs3: boolean = f3.canSubmit.value; void cs3; const st3: FormStatus = f3.status.value; void st3;
const ref3: FieldRef<string> = f3.field('email'); html`<input bind:field=${ref3}> <input name="age" ${f3.wire('age')}>`;
f3.wire(document.createElement('input'), 'email'); f3.attach(document.createElement('form')); f3.focusFirstError(); f3.abort();
f3.submit(async (v, { signal, submitter }) => { void v.email; void signal.aborted; void submitter; }, { submitter: document.createElement('button') });
const w3 = wireForm3(document.createElement('form'), { messages: 'page', mode: 'submit', escapeAborts: true, onRedirect: 'router', submit: (v, ctx) => { void v; void ctx.signal; } });
w3.issues.$any.value; w3.canSubmit.value; w3.status.value; w3.submitted.value; w3.abort();
const t3 = i18n3({ en: { validation: { minLen: 'At least {n}' } } }, { locale: 'en' }); setValidationMessages(t3); setValidationMessages({ minLen: { one: '{n} char', other: '{n} chars' } }); setValidationMessages(null);

import { fieldArray, min, type FieldArray } from './aegis.js';
// ── forms phase 4a — fieldArray / growing form / wireForm observe, types, html, intents
const f4 = form3({ title: '' }, { rules: { 'items[].qty': [min(1)] } });
const items4: FieldArray<{ qty: number; sku: string }> = fieldArray(f4, 'items', { row: { qty: 1, sku: '' } });
const row4 = items4.push({ qty: 2 }); row4.field('qty'); row4.value('sku'); items4.move(0, 1); items4.length.value; items4.rows.value[0].key;
f4.addField('extra', 1, [required]); f4.renameField('extra', 'more'); f4.removeField('more'); const ks: string[] = f4.keys.value; void ks; f4.parsed.value;
const w4 = wireForm3(document.createElement('form'), { observe: true, types: { d: Date, n: Number, tags: Array }, html: 'morph', intents: { add: (f, e) => { void f.keys; void e; } } });
w4.wire(document.createElement('input')); w4.unwire('x'); w4.rewire(); w4.adoptErrors(); w4.el.noValidate; w4.parsed.value;

// ── aegis/test — render / fire / waitFor / mockFetch
import { render, fire, waitFor, mockFetch, cleanup, withScope, fakeClock } from './aegis-test.js';
const clock = fakeClock(1000); await clock.advance(30_000); clock.restore();
const h = render(({ props, html }) => html`<b>${props.n}</b>`, { props: { n: 1 } });
const b: HTMLElement = h.find('b'); void b;
fire.click(h.find('b')); fire.input(h.find<HTMLInputElement>('input'), 'x'); fire.key(h.el, 'Enter', { ctrlKey: true });
await waitFor(() => h.text() === '1');
const net = mockFetch({ 'GET /api/u/:id': (_body, { params }) => ({ id: params.id }), 'POST /api/u': (body) => ({ status: 201, body }) }, { latency: 10 });
net.calls[0]?.method; net.restore();
const ten: number = await withScope(() => 10); void ten;
cleanup();
h.unmount();

// ── reactive() — getters become computeds, methods actions, $-API
const state = reactive({ items: [1, 2], get total() { return this.items.length; }, add(n: number) { this.items.push(n); } });
const total: number = state.total; void total;
state.add(3);
state.$patch({ items: [] });
state.$reset();
const snap: { items: number[]; total: number } = state.$snapshot(); void snap;
