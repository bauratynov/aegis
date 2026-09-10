/**
 * AEGIS — Frontend Engine
 * Zero-build, zero-footgun, signal-based reactive UI.
 * Hand-authored TypeScript declarations (no build step required).
 *
 * Usage with @ts-check:
 *   // @ts-check
 *   /** @type {import('./aegis.js')} *​/
 *   import { signal, computed, effect } from './aegis.js';
 *
 * @version 0.7.0
 * @license MIT
 *
 * API tiers — where to start:
 *   Core (10 names, enough for most pages): signal, computed, effect, batch, html, island, mount, resource, wireForm, swap
 *   Extended: everything else below — helpers for specific jobs (router, forms, cache, motion, a11y). Same file, same guarantees,
 *             tree-shaken away when you do not import it.
 *   Removed before 1.0 (0.8): clsMap → cls(el, { … }), store → reactive(obj, { shallow: true }), cachedResource → resource(url, { cache: true }),
 *             offlineResource → resource(url, { offline: true }), component → mount. Nothing is marked @deprecated any more.
 */

// ── Reactive Core ──────────────────────────────────────────────

declare const SIGNAL: unique symbol;

export interface ReadonlySignal<T> {
    readonly value: T;
    /** read without subscribing */
    peek(): T;
    /** manual subscription: fn(value) on every real change; returns unsubscribe */
    subscribe(fn: (value: T) => void): () => void;
    /** brand: only Aegis signals (not any { value }) */
    readonly [SIGNAL]: true;
}
export interface Signal<T> extends ReadonlySignal<T> {
    value: T;
    /** sig.update(v => v + 1) */
    update(fn: (prev: T) => T): void;
}
/** computed(): a read-only signal with manual dispose (rarely needed — it dies with its scope) */
export interface Computed<T> extends ReadonlySignal<T> {
    dispose(): void;
}

export interface SignalOptions<T> {
    /** the first subscriber appeared (effect / computed / subscribe) — start the producer, open the connection */
    watched?(): void;
    /** the last subscriber left — stop */
    unwatched?(): void;
    name?: string;
    equals?: false | ((a: T, b: T) => boolean);
    /** How often it is written: 'high' — config/locale/theme, 'medium' — session, 'low' (default) — everything else. Derived non-live computeds are re-checked only after writes of their own level (Salsa durability) */
    durability?: 'low' | 'medium' | 'high';
}
export interface ComputedOptions<T> extends SignalOptions<T> {
    /** computed((prev) => …, { initial }) — the previous value as the first argument */
    initial?: T;
}

/** A value, a signal or a getter — anything the reactive helpers accept */
export type Reactive<T> = T | Signal<T> | ReadonlySignal<T> | (() => T);
export type Displayable = string | number | boolean | null | undefined;
/** class: string | array | { name: reactive truthy } (clsx semantics) */
export type ClassValue = string | null | undefined | false | ClassValue[] | Record<string, Reactive<unknown>>;

export function signal<T>(initial: T, nameOrOpts?: string | SignalOptions<T>): Signal<T>;
export function computed<T>(fn: (prev: T) => T, nameOrOpts?: string | ComputedOptions<T>): Computed<T>;
export interface EffectOptions {
    /** false — children of the effect (effect/on/interval/createScope/subscribe created in its body) live until the owner is disposed, not until the next run */
    own?: boolean;
    name?: string;
    /** print the reason for every re-run (dev) */
    trace?: boolean;
    /** 'sync' (default) — synchronous; 'micro' — one run per microtask; 'frame' — one run per frame */
    flush?: 'sync' | 'micro' | 'frame' | 'transition' | 'idle';   // transition/idle — deadline classes (250 ms / 2 s), drained in slices after the current task
}
export function effect(fn: () => void | (() => void), nameOrOpts?: string | EffectOptions): () => void;
/** Debugging: print the stack of every write to a signal. trace(sig, false) — turn off */
export function trace<T extends Signal<any>>(sig: T, on?: boolean): T;
export function batch<T>(fn: () => T): T;
/** Non-urgent update: writes inside go to the transition class (250 ms deadline) in slices after the current task; a repeated write before the drain collapses, the old UI stays visible. startTransition.pending — a signal */
export const startTransition: (<T>(fn: () => T) => T) & { readonly pending: ReadonlySignal<boolean> };
/** A deferred shadow of a signal (useDeferredValue): the input is bound to src, the heavy list — to deferred(src) */
export function deferred<T>(src: Signal<T> | ReadonlySignal<T>, opts?: { lane?: 'transition' | 'idle' }): ReadonlySignal<T>;
/** Optimistic transaction (OCC): read(sig) records versions without subscribing; on commit the read-set is validated, on conflict — retry (retries) or onConflict → 'abort'; writes are applied in one batch */
export function transaction<T>(fn: (tx: { read<V>(sig: Signal<V> | ReadonlySignal<V>): V; write<V>(sig: Signal<V>, value: V): void; attempt: number }) => Promise<T> | T, opts?: { retries?: number; onConflict?: (changed: Array<{ name: string; value: string }>) => 'abort' | void }): Promise<T>;
/** Replace the scheduler's clock and queues (tests, simulations); returns restore */
export function useScheduler(impl: Partial<{ now(): number; micro(f: () => void): void; frame(f: (t?: number) => void): void; idle(f: (d: { timeRemaining(): number; didTimeout: boolean }) => void): void; yield(): Promise<void>; inputPending(): boolean; onRun: ((obs: { _name: string }, lane: string) => void) | null }>): () => void;

// ── Dev & testing ──────────────────────────────────────────────

export interface WarningInfo {
    /** scope path where the warning occurred: component:div#app ‹ list:row (null outside a scope) */
    where?: string | null;
    /** the element the warning is about (printed to the console as %o) */
    el?: Element | null;
    /** source position (dev): '/js/app.js:42:15' — the html`` template, effect() or resource() where the warning occurred */
    site?: string | null;
    /** full file URL for site */
    url?: string | null;
    /** the source line with a caret under the offending ${} (dev; the file is fetched once) */
    snippet?: Promise<string | null>;
    /** the same after resolution */
    snippetText?: string | null; code: string; what: string; why: string; fix: string }
/** An engine warning as an exception (window.__AEGIS_DEV__ = 'strict') */
export class AegisWarning extends Error { code: string; what: string; why: string; fix: string }
/**
 * Effect errors not swallowed by scope.onError / errorBoundary: fn(error, error.aegis). Without handlers — self.reportError(e).
 * The writer of the signal does not get the exception (except with __AEGIS_DEV__ = 'strict'). Returns unsubscribe; inside a scope it is removed automatically.
 */
export function onError(fn: (error: unknown, info: { effect: string; scope: string; changed: Array<{ name: string; value: string }>; site?: string } | null) => void): () => void;
/** Subscribe to warnings (dev mode): warnings-as-assertions in tests. Returns unsubscribe */
export function onWarn(fn: (w: WarningInfo) => void): () => void;
export interface ScopeInspection { scope: string | null; el: Element | null; signals: Array<{ name: string; value: string; /** the signal itself (non-enumerable field) */ readonly ref?: ReadonlySignal<unknown> }>; effects: Array<{ name: string; deps: string[]; scope: string | null; /** source position of the effect() (dev) */ site?: string | null }>; children: number }
/** Dev-mode control: dev.enable() (localStorage + reload in production), dev.disable(), dev.resetWarnings() */
export const dev: {
    readonly on: boolean;
    enable(): void;
    disable(): void;
    resetWarnings(): void;
    /** performance.measure / console.timeStamp on every flush in the “Aegis” track of the Performance panel */
    profile(on?: boolean): void;
    /** The reactive world of an island by DOM node: Aegis.dev.of($0) */
    of(el: Element): ScopeInspection | null;
    /** JSON snapshot of the components (or of one scope) — for a chat with an assistant */
    inspect(root?: Document | Element | Scope): ScopeInspection[] | ScopeInspection;
    /** Dependency graph as Mermaid */
    graph(root?: Scope): string;
    /** dev overlay: warnings pop up in the page corner; false — console only (or localStorage aegis:overlay=0) */
    overlay: boolean;
    /** EXPLAIN ANALYZE of the latest list() reconciliations: plan keyed | rebuild, n, kept, lis, moves, ms */
    plans(): Array<{ plan: 'keyed' | 'rebuild'; n: number; kept: number; lis: number; moves: number; ms: number }>;
    /** Runtime contracts of the graph and the scope tree: 'sampled' (default) | 'strict' (every flush; tests) | false */
    contracts: 'sampled' | 'strict' | false;
    /** Explanation of a warning code from ERRORS.md — prints to the console and returns the text */
    explain(code: string): Promise<string>;
    /** Snapshot of the resource cache (same as cache.stats().entries) — console.table(Aegis.dev.cache()) */
    cache(): CacheEntryStats[];
    /** In-page inspector panel (loads aegis-devtools.js next to the module); also ?aegis-devtools in the URL */
    panel(): Promise<{ host: HTMLElement; shadow: ShadowRoot; close(): void; highlight(el: Element | null): void }>;
};
/** Reset module singletons between tests (components, registry, resource cache, live region) */
export function reset(opts?: { components?: boolean; cache?: boolean; registry?: boolean; dom?: boolean }): void;
/** Synchronously run deferred show()/list() renders and the effect queue */
export function flushSync(): void;
/** Synchronously run the deferred micro/frame lanes and the effect queue */
export function flush(): void;
/** Engine counters: flushes, effectRuns, maxRounds, slow (top-20 by ms under dev.profile), scopes, effects, components, caches */
export function stats(): { /** resident islands, page-outs and hibernations */ islands: { resident: number; evictions: number; hibernations: number } | null; flushes: number; effectRuns: number; maxRounds: number; /** rounds where the effect order had to be restored by sorting (subscription churn) */ reordered: number; slow: Array<{ name: string; ms: number }>; scopes: number; effects: number; components: number; resourceCache: number; cssCache: number; queued: number; prefetch: { fired: number; used: number; wasted: number; hoverDelay: number } | null; speculation: { inflight: number; queued: number; fired: number; skipped: number; aborted: number } | null };
/** Root scope for tests: const [api, dispose] = root(dispose => …) */
export function root<T>(fn: (dispose: () => void) => T): [T, () => void];
/** Await a signal: resolves on the first value for which the predicate is true; rejects with TimeoutError / on scope dispose */
export function until<T>(source: Reactive<T>, predicate?: (v: T) => boolean, opts?: { timeout?: number }): Promise<T> & { toBe(v: T): Promise<T>; changed(): Promise<T> };

// ── Context ────────────────────────────────────────────────────

export interface Context<T> { readonly id: symbol; readonly default: T }
export function createContext<T>(defaultValue?: T): Context<T>;
/** Put a value into the context of the current scope (outside a scope — globally) */
export function provide<T>(key: Context<T> | string, value: T): void;
/** Take from the context: scope chain → DOM ancestors (between islands) → global. Call synchronously in setup */
export function inject<T>(key: Context<T>): T;
export function inject<T>(key: Context<T> | string, fallback: T): T;
export function inject(key: string): unknown;

// ── State helpers ──────────────────────────────────────────────

/** A signal in localStorage/sessionStorage with cross-tab sync */
export function persisted<T>(key: string, initial: T, opts?: {
    storage?: Storage | null;
    serialize?: (v: T) => string;
    deserialize?: (s: string) => T;
    sync?: boolean;
    debounce?: number;
}): Signal<T> & { clear(): void };
/** Writable derived: a write lives until the next change of the source */
/**
 * Two-way lens: reading — computed(get), writing — set(v) into the source (no local state).
 *   bind:value=${lens(() => cents.value / 100, v => cents.value = Math.round(v * 100))}   |   lens(state.address, 'city')
 */
export function lens<T>(get: () => T, set: (v: T) => void, name?: string): Signal<T>;
export function lens<O extends object, K extends keyof O>(obj: O, key: K, name?: string): Signal<O[K]>;
/** [get, set] — function binding for bind:value / bind(): the same as lens(get, set) */
export type FunctionBinding<T = any> = [() => T, (v: T) => void];
/**
 * Named signals from object keys — for E-messages, trace() and dev.graph(); a getter → computed.
 *   const { count, query } = signals({ count: 0, query: '' });
 */
export function signals<T extends Record<string, unknown>>(obj: T, opts?: { prefix?: string }): { [K in keyof T]: Signal<T[K]> };
export function linked<T>(source: () => T, name?: string): Signal<T>;
export function linked<S, T>(opts: { source: () => S; compute: (source: S, prev: { source: S; value: T } | undefined) => T }, name?: string): Signal<T>;
/** An external source as a signal: (EventTarget, event, map) | (producer(set) => unsubscribe, initial) | { subscribe } */
export function from<T, E extends EventTarget = EventTarget>(target: E, event: string, map?: (target: E) => T): ReadonlySignal<T>;
export function from<T>(producer: (set: (v: T) => void) => (() => void) | void, initial?: T, opts?: { /** the producer starts with the first subscriber and stops with the last */ lazy?: boolean }): ReadonlySignal<T>;
export function from<T>(subscribable: { subscribe(fn: (v: T) => void): (() => void) | { unsubscribe(): void }; value?: T; peek?(): T }): ReadonlySignal<T>;
/** Undo/redo for a signal, reactive() or store() */
export function history<T>(source: Signal<T> | object, opts?: { limit?: number; debounce?: number }): {
    undo(): void; redo(): void; canUndo: ReadonlySignal<boolean>; canRedo: ReadonlySignal<boolean>;
    pause(): void; resume(): void; commit(): void; clear(): void;
    past: ReadonlySignal<unknown[]>; future: ReadonlySignal<unknown[]>;
};
/** O(2) updates instead of N for the “selected row”: const isSelected = selector(selectedId) */
export function selector<K, S = K>(source: Signal<S> | ReadonlySignal<S> | (() => S), equals?: (source: S, key: K) => boolean): (key: K) => boolean;
/** Run fn without subscribing to the signals it reads */
export function untrack<T>(fn: () => T): T;
export function isSignal(v: unknown): v is Signal<unknown>;

// ── Reactive Object ────────────────────────────────────────────

export interface ReactiveExtras<T> {
    readonly $signals: Record<string, Signal<unknown>>;
    readonly $raw: T;
    $snapshot(): T;
    $patch(patch: Partial<T>): void;
    /** effect over a deep snapshot */
    $subscribe(fn: (snapshot: T) => void): () => void;
    $reset(): void;
}
/**
 * Deeply reactive object: fields → signals, getters → computeds, methods → batched actions;
 * arrays and plain objects are reactive deeply, Date/Map/File/DOM stay as they are. { shallow: true } = store()
 */
export function reactive<T extends object>(obj: T, opts?: { shallow?: boolean }): T & ReactiveExtras<T>;
export function isReactive(v: unknown): boolean;

// ── Scope ──────────────────────────────────────────────────────

export interface Scope {
    readonly name: string | null;
    /** the component element (inject() through DOM ancestors) */
    el: Element | null;
    run<T>(fn: () => T): T;
    /** using scope = createScope() */
    [Symbol.dispose]?(): void;
    /** Returns unregister — remove the cleanup early */
    onDispose(fn: () => void): () => void;
    /** Error handler for effects of this scope and nested ones; errors carry e.aegis = { effect, scope, changed } */
    onError(fn: (error: any) => void): () => void;
    dispose(): void;
}

/** name — for error messages (component:div#app, list:row) */
export function createScope(name?: string): Scope;
/** The current owner scope (null outside a scope). For code after await: runWithOwner(getOwner(), () => …) */
export function getOwner(): Scope | null;
export function runWithOwner<T>(scope: Scope | null, fn: () => T): T;
export function onDispose(fn: () => void): () => void;

// ── DOM Rendering ──────────────────────────────────────────────

/** What can go into html``: text, a node, a signal, a function (reactive), ref/attach, a class/style object, an array. Not Promise/Date (${String(date)}, when()/resource()) */
export type HtmlValue = Displayable | Node | ReadonlySignal<any> | ((...args: any[]) => unknown) | Ref<any> | Attachment<any> | ClassValue | Record<string, Reactive<unknown>> | FunctionBinding | FieldRef | HtmlValue[];
export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): DocumentFragment;
/** The author vouches for the value: bypasses the html`` sink checks (a URL with a non-standard scheme, ready HTML for srcdoc/.innerHTML) */
export function trusted<T = string>(v: T): { readonly __aegisTrusted: T };
/** DOMPurify config for user-HTML zones: no data-aegis*, on*, script/template/iframe */
export const sanitizeConfig: Readonly<{ FORBID_ATTR: string[]; FORBID_TAGS: string[] }>;
export function render(target: Element, content: DocumentFragment | Element): void;

export function text(el: Element, value: Reactive<Displayable>): () => void;
export function attr(el: Element, name: string, value: Reactive<Displayable>): () => void;

/**
 * Toggle a single CSS class reactively.
 * @param el — target element
 * @param name — class name
 * @param fn — boolean signal, function, or static value
 */
export function cls(el: Element, name: string, value: Reactive<unknown>): () => void;
/** cls(el, { active: sig, done: () => … }) / cls(el, ['btn', size]) — diffs only its own classes */
export function cls(el: Element, classes: ClassValue): () => void;

/**
 * Bind a single CSS property reactively.
 * @param el — target element
 * @param prop — CSS property name (camelCase)
 * @param fn — string signal, function, or static value
 */
/** --custom-property goes through setProperty; a number — only for unitless properties */
export function style(el: HTMLElement | SVGElement, prop: string, value: Reactive<string | number | null>): () => void;
/** CSS custom properties from signals: cssVars(el, { x, progress }) → --x, --progress */
export function cssVars(el: HTMLElement | SVGElement, vars: Record<string, Reactive<string | number | null>>): () => void;

/**
 * Toggle multiple CSS classes via a map { className: signal/fn/bool }.
 * @returns cleanup function that disposes all class effects
 */

/**
 * Bind multiple CSS properties via a map { prop: signal/fn/string }.
 * @returns cleanup function that disposes all style effects
 */
export function styleMap(el: HTMLElement | SVGElement, map: Record<string, Reactive<string | number | null>>): () => void;

/**
 * Two-way bind an input's value to a signal.
 * Handles checkbox/radio (checked), number, select.
 * @returns cleanup function
 */
export function bind(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, sig: Signal<any> | FunctionBinding): () => void;

/**
 * Conditional rendering with automatic scope management.
 * Creates a Comment anchor internally, inserts/removes branches reactively.
 * Each branch gets its own Scope — effects/listeners are disposed on switch.
 *
 * @param condition — signal, function, or boolean controlling which branch shows
 * @param trueBranch — content factory or element for truthy condition
 * @param falseBranch — content factory or element for falsy condition (optional)
 * @returns Comment anchor node (insert this into your DOM)
 */
/** The three states of a resource in html``: ${when(users, { loading, error, data })} */
/** a11y message: a string | a function of the value | false (silent) */
export type A11yMsg<X = unknown> = string | ((x: X) => string | null | false) | false;
export function when<T>(res: { data: { value: T | null; peek(): T | null }; loading?: { value: boolean }; error?: { value: unknown; peek(): unknown }; refresh?: () => unknown }, branches: {
    loading?: () => Node | Node[] | string;
    error?: (error: any, retry: () => void) => Node | Node[] | string;
    /** data(value, signal) — the second argument for reactive list()/text() inside the branch */
    data?: (data: T, signal: ReadonlySignal<T | null>) => Node | Node[] | string;
    empty?: () => Node | Node[] | string;
}, opts?: { /** aria-busy on the container while loading/validating (default true) */ busy?: boolean; /** announcements: error assertive (default: the error text), data — only after a real wait, loading */ announce?: false | { loading?: A11yMsg<void>; error?: A11yMsg<unknown>; data?: A11yMsg<T> } }): Comment;

/** Svelte 5-style event wrappers: @submit=${prevent(save)} (in html`` also @submit.prevent, .stop, .self, .once, .passive, .capture, .outside, .window, .document, .enter/.esc/…, .ctrl/.meta/.shift/.alt, .debounce.N, .throttle.N) */
export function prevent<E extends Event>(fn: (e: E) => void): (e: E) => void;
export function stop<E extends Event>(fn: (e: E) => void): (e: E) => void;
export function self<E extends Event>(fn: (e: E) => void): (e: E) => void;

/** matchMedia as a signal (one per query) */
export function media(query: string): ReadonlySignal<boolean>;
/** prefers-reduced-motion as a signal; a write overrides the system setting */
export const reducedMotion: Signal<boolean>;
/** Theme: mode 'light' | 'dark' | 'system' in localStorage + an attribute on <html> + color-scheme */
export function theme(opts?: { attr?: string; storage?: string }): { mode: Signal<'light' | 'dark' | 'system'>; dark: ReadonlySignal<boolean> };

export interface ShowOptions {
    /** branches are created once and hidden with display:none (like v-show): DOM and state are kept */
    keep?: boolean;
    /** CSS contract `${name}-enter-from|active|to` / `${name}-leave-*` (true → 'aegis'); leave plays out before removal */
    transition?: boolean | string;
}
/** show(open, () => html`…`, { transition: 'fade' }) — options as the third argument when there is no else branch */
export function show(
    condition: Signal<boolean> | (() => boolean) | boolean,
    trueBranch: (() => DocumentFragment | Element) | DocumentFragment | Element,
    opts: ShowOptions,
): Comment;
export function show(
    condition: Signal<boolean> | (() => boolean) | boolean,
    trueBranch: (() => DocumentFragment | Element) | DocumentFragment | Element,
    falseBranch?: (() => DocumentFragment | Element) | DocumentFragment | Element | null,
    opts?: ShowOptions
): Comment;

/** Lazy row index of list(): the signal is created on the first read of .value */
export interface RowIndex {
    readonly value: number;
    peek(): number;
    subscribe(fn: (i: number) => void): () => void;
}

export interface ListOptions<T = any> {
    key?: string | ((item: T, index: number) => string | number);
    /** markup for the empty list */
    fallback?: (() => Node | DocumentFragment | string) | Node;
    /** enter/leave CSS contract for rows (true → 'aegis'); a leaving row gets data-leaving */
    transition?: boolean | string | 'view';
    /** 'signal' — renderFn receives Signal<T>; replacing the object under a key patches the signal instead of re-rendering */
    item?: 'signal';
    /** 'view' — moves and inserts are animated with the View Transitions API (one startViewTransition per flush, FLIP for free); viewClass — the view-transition-class of rows (default 'aegis-row') */
    viewClass?: string;
    /** off-screen rows are frozen (contentvisibilityautostatechange): the row scope is destroyed, the DOM stays as a snapshot, on return — re-render with current data */
    hibernate?: boolean;
    /** a signal “rows are still being created in slices” (streaming assembly under startTransition / typing) */
    pending?: Signal<boolean>;
    /** assembly order from the visible part: the scrolling element and the row height */
    viewport?: Element; itemHeight?: number;
}
export function list<T>(
    items: Signal<T[]> | ReadonlySignal<T[]> | (() => T[]) | T[],
    renderFn: (item: Signal<T>, index: RowIndex) => Node | Node[] | string | number,
    opts: ListOptions<T> & { item: 'signal' }
): Comment;
export function list<T>(
    items: Signal<T[]> | ReadonlySignal<T[]> | (() => T[]) | T[],
    renderFn: (item: T, index: RowIndex) => Node | Node[] | string | number,
    opts: ListOptions<T>
): Comment;
export function list<T>(
    items: Signal<T[]> | ReadonlySignal<T[]> | (() => T[]) | T[],
    /** index — a signal: current after sorting/removal. A row re-renders if the object under its key was replaced */
    /** renderFn may return one node, a fragment of several (<tr>+<tr>, <dt>+<dd>) or an array — no wrappers */
    renderFn: (item: T, index: RowIndex) => Node | Node[] | string | number,
    key?: string | ((item: T) => string | number),
    opts?: ListOptions
): Comment;

/**
 * DOM element ref — plain object with `.el` property.
 * NOT a Signal. Set automatically by the html`` engine.
 *
 * @example
 *   const inputRef = ref();
 *   html`<input ${inputRef}>`;
 *   effect(() => inputRef.el?.focus());
 */
export interface Ref<T extends Element = Element> {
    el: T | null;
    /** @internal — called by the html`` engine */
    _set(el: T): void;
}
export function ref<T extends Element = Element>(): Ref<T>;

/** attach() marker for html``: <canvas ${attach(el => …)}> */
export interface Attachment<E extends Element = Element> {
    readonly fn: (el: E) => void | (() => void);
    readonly opts: AttachOptions;
}
export interface AttachOptions {
    /** init + cleanup only, without reactive re-runs (maps, editors) */
    once?: boolean;
}
/**
 * Behaviour on an element after mount: init + cleanup + reactivity in one function.
 * fn runs as an effect: re-runs when the signals it read change, cleanup before a re-run and on dispose.
 */
export function attach<E extends Element = Element>(fn: (el: E) => void | (() => void), opts?: AttachOptions): Attachment<E>;
export function attach<E extends Element>(el: E, fn: (el: E) => void | (() => void), opts?: AttachOptions): () => void;

/**
 * A live copy of a fragment from html``: bindings are created anew in the current scope.
 * A fragment with finished nodes (list()/show() anchors) cannot be reproduced — cloneNode + dev warning E013.
 */
export function clone(frag: DocumentFragment): DocumentFragment;

// ── Events ─────────────────────────────────────────────────────

export function on<K extends keyof HTMLElementEventMap>(el: Element, event: K, handler: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): () => void;
export function on(el: Element, event: string, handler: (e: Event) => void, opts?: AddEventListenerOptions): () => void;
export function delegate(root: Element, event: string, selector: string, handler: (this: Element, e: Event, target: Element) => void): () => void;

// ── Utilities ──────────────────────────────────────────────────

export function interval(fn: () => void, ms: number): () => void;
export function timeout(fn: () => void, ms: number): () => void;
export function observe(el: Element, callback: IntersectionObserverCallback, opts?: IntersectionObserverInit): () => void;
export function resize(el: Element, callback: (entries: ResizeObserverEntry[]) => void): () => void;
export function mutate(el: Element, callback: MutationCallback, opts?: MutationObserverInit): () => void;
export function nextTick(fn?: () => void): Promise<void>;

// ── Guard / Fetch ──────────────────────────────────────────────

/**
 * Factory: creates a fetch function with auto-abort of previous requests.
 * Each call to the returned function aborts the prior inflight request.
 * Scope dispose aborts the current request.
 *
 * @param scope — optional Scope for auto-abort on dispose (falls back to current scope)
 * @returns an async fetch function: (url, opts?) => Promise<json | text | undefined>
 */
export interface GuardedFetch {
    /** a stale (cancelled) call never resolves; { stale: 'undefined' } — the old behaviour */
    (url: string, opts?: RequestOptions & { stale?: 'undefined' }): Promise<any>;
    pending: ReadonlySignal<boolean>;
    error: ReadonlySignal<unknown>;
}
export function guardedFetch(scope?: Scope): GuardedFetch;

// ── HTTP layer ─────────────────────────────────────────────────

/** HTTP response error: status, Response and the parsed body (e.data.errors from Laravel/Django) */
export class HttpError extends Error {
    name: 'HttpError';
    status: number;
    response: Response;
    data: unknown;
    /** the circuit breaker is open — the request was not sent; retryAt — when to try again (ms epoch) */
    circuit?: boolean;
    retryAt?: number;
    /** the retry was rejected by the retry budget */
    budget?: boolean;
    /** the server asked to wait longer than maxWait (ms) */
    retryAfter?: number;
    constructor(status: number, response: Response, data: unknown);
}

export type CsrfPreset = 'django' | 'rails' | 'laravel' | 'go';
export interface CsrfConfig {
    header: string;
    cookie?: string;
    meta?: string;
    token?: () => string;
    /** decodeURIComponent of the cookie value (Laravel) */
    decode?: boolean;
}
export interface AegisConfig {
    /** Trusted origins (besides your own and baseURL): only they receive the flat headers and the CSRF token */
    origins?: string[];
    /** Allowed non-standard schemes for URL attributes (myapp:, intent:) */
    urlSchemes?: string[];
    /** Islands: origin policy for data-aegis-src ('same-origin' | function | RegExp | prefixes) and an allow-list of names inside [data-aegis-untrusted] */
    islands?: { src?: 'same-origin' | ((url: string) => boolean) | RegExp | string[]; allow?: string[] };
    /** Trusted Types: the name of the passthrough policy for html`` literals (default 'aegis') and the policy for server HTML (swap/boost/wireForm) */
    trustedTypes?: { name?: string; server?: ((html: string, who: string) => any) | string };
    /** event delegation: one listener on document for the listed types (bubbling only; capture/passive/once and @ev.direct — directly) */
    delegateEvents?: string[] | null;
    /** SWR cache capacity: maxEntries (default 500, SIEVE eviction among idle entries), maxBytes (default 0 — no limit) */
    cache?: { maxEntries?: number;
    /** Persist principal: entries and offline mutations of another scope are neither hydrated nor replayed (logout: cache.purge()) */
    scope?: () => string | null | undefined;
    /** Names of query parameters whose values are replaced with * in cache keys, BroadcastChannel and history */
    redact?: string[]; maxBytes?: number };
    /** response header with key patterns for invalidate() — 'Aegis-Invalidate: /api/users*, /api/stats' (same-origin); false — off */
    invalidateHeader?: string | false;
    /** circuit breaker per origin: after threshold consecutive retryable errors requests fail immediately (e.circuit, e.retryAt) for cooldown, then one probe */
    breaker?: boolean | { threshold?: number; cooldown?: number; key?: (url: string) => string };
    /** entity identification for cache.patchEntity() and cache: { entity }: (obj) => 'user:42' | null */
    identify?: ((obj: any) => string | null) | null;
    /** speculative requests (prefetch, route preload, predict, island warm-up): 'auto' — by navigator.connection (saveData / 2g / prefers-reduced-data → off, 3g → one in flight), false — never, { maxInflight, saveData: 'ignore' } */
    speculation?: 'auto' | false | { maxInflight?: number; saveData?: 'respect' | 'ignore' };
    /** warm-up usefulness threshold (p·min(rtt, horizon) − transfer − fixedCost, ms) and hover delay: 80 | 'auto' (adaptive by dwell histograms) */
    prefetch?: { minUtility?: number; fixedCost?: number; horizon?: number; hoverDelay?: number | 'auto'; rtt?: number; bytes?: number } | null;
    /** retry limit per client in a sliding window: retries ≤ ratio × requests + min; rejection — e.budget === true */
    retryBudget?: boolean | { ratio?: number; min?: number; window?: number };
    /** revalidation scheduler: token-bucket refill per reason (ms), concurrency, stagger between starts, reconnect jitter */
    revalidate?: { focus?: number; reconnect?: number; concurrency?: number; stagger?: number; reconnectJitter?: number };
    /** a preset or your own scheme; null — off; without a call — auto-detected from <meta name="aegis-csrf"> / <meta name="csrf-token"> */
    csrf?: CsrfPreset | CsrfConfig | null;
    /** default headers (default: X-Requested-With: XMLHttpRequest) */
    headers?: Record<string, string>;
    baseURL?: string;
    /** ms; 0 — no timeout */
    timeout?: number;
    /** fetch replacement: proxies, logging, mocks */
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    onError?: (error: HttpError, info: { url: string; status: number }) => void;
    /** after a form's PRG redirect: 'assign' (default) — location.assign(response.url); 'none'; or your own handler */
    onRedirect?: 'assign' | 'none' | ((response: Response) => void);
}
/** Configure the HTTP layer for your backend — one line per project: configure({ csrf: 'django' }) */
export function configure(opts: AegisConfig): AegisConfig;

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method' | 'headers'> {
    /** If-Match for optimistic locking (the ETag from cache.explain(key).etag or the mutation's ctx.etag) */
    ifMatch?: string;
    method?: string;
    /** object → JSON + Content-Type; FormData/Blob/string — as is */
    body?: unknown;
    query?: Record<string, string | number | boolean> | URLSearchParams;
    headers?: HeadersInit;
    /** ms; default configure().timeout */
    timeout?: number;
    /** return the Response without parsing the body */
    raw?: boolean;
}
/**
 * One HTTP request: baseURL, query, JSON body, CSRF for unsafe same-origin, timeout, HttpError with the parsed body.
 */
export function request<T = unknown>(url: string, init?: RequestOptions & { raw?: false }): Promise<T>;
export function request(url: string, init: RequestOptions & { raw: true }): Promise<Response>;
/** Sugar over request() */
export const api: {
    get<T = unknown>(url: string, opts?: RequestOptions): Promise<T>;
    post<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    put<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    patch<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    delete<T = unknown>(url: string, opts?: RequestOptions): Promise<T>;
};
export type Fetcher = (url: string, opts: { signal?: AbortSignal; method?: string; body?: unknown }) => Promise<unknown>;
/** The single mocking point for the whole engine: defaults.fetcher = mock — resource/cache/offline/guardedFetch go through it */
export const defaults: {
    /** null → the engine's request(); mocking: defaults.fetcher = mock */ fetcher: Fetcher | null;
    motion: 'auto' | 'reduce' | 'none';
    /** effect() outside a scope (E001): 'warn' — dev warns, the effect runs forever (default); 'throw' — an error, in production too; 'root' — owned by an app-level root scope (lives until reset()) */
    orphanEffects: 'warn' | 'throw' | 'root';
};

export interface RetryOptions {
    retries?: number;
    base?: number;
    max?: number;
    signal?: AbortSignal;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
}
/** Retry with exponential backoff and full jitter; honours Retry-After; AbortError is not retried */
export function withRetry<T>(fn: (attempt: number) => Promise<T>, opts?: RetryOptions): Promise<T>;

/** Element size as signals (ResizeObserver) */
export function size(el: Element, opts?: { box?: 'border-box' | 'content-box' }): { width: ReadonlySignal<number>; height: ReadonlySignal<number> };
/** Element visibility as signals (IntersectionObserver) */
export function inView(el: Element, opts?: IntersectionObserverInit): { visible: ReadonlySignal<boolean>; ratio: ReadonlySignal<number> };
/** The window as signals (singleton, one passive listener, writes in rAF) */
export function viewport(): { width: ReadonlySignal<number>; height: ReadonlySignal<number>; scrollX: ReadonlySignal<number>; scrollY: ReadonlySignal<number> };

export function debounced<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel(): void; /** call immediately, cancelling the timer */ flush: T };
export function throttled<T extends (...args: any[]) => any>(fn: T, ms: number): T;
/** Polling with auto-stop on dispose. Sleeps in a background tab (background: true — do not sleep) */
export function poll(fn: () => Promise<void> | void, ms: number, opts?: { background?: boolean }): () => void;

// ── Data ───────────────────────────────────────────────────────

export type ResourceStatus = 'idle' | 'pending' | 'success' | 'error';

/** One contract for resource() / resource({ cache }) / resource({ offline }) / streamResource / infiniteResource */
export interface ResourceResult<T> {
    data: ReadonlySignal<T | null> | Signal<T | null>;
    /** a request is in flight and there is no data yet (skeleton once) */
    loading: ReadonlySignal<boolean>;
    /** a request is in flight over existing data (dimming, not flicker) */
    validating: ReadonlySignal<boolean>;
    /** keepPrevious: data of the previous key is shown while the new one loads */
    stale: ReadonlySignal<boolean>;
    status: ReadonlySignal<ResourceStatus>;
    error: ReadonlySignal<HttpError | Error | null>;
    /** current URL / serialised params */
    key: ReadonlySignal<string | null>;
    refresh(): Promise<void>;
    /** Optimistic update: a local write (for offline — also into IndexedDB) */
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
    abort(): void;
    /** the last request of this resource (for await in tests) */
    readonly promise: Promise<void> | null;
    /** await the data: resolve(data) or reject(error) */
    ready(): Promise<T | null>;
    dispose(): void;
}

export interface ResourceOptions<T> {
    initial?: T;
    transform?: (data: unknown) => T;
    fetcher?: Fetcher;
    immediate?: boolean;
    /** structural sharing of the response: unchanged parts keep their identity; arrays of objects are matched by the 'id' field (default), by your own field or a function; false — off */
    share?: boolean | string | ((item: any) => unknown);
    /** one GET per URL in flight for several resource(url) (default true with the default fetcher) */
    dedupe?: boolean;
    /** retries with backoff: true → 3, a number, or a predicate (err, attempt) => boolean; default 0 */
    retry?: boolean | number | ((error: unknown, attempt: number) => boolean);
    /** refetch on events — opt-in only */
    refetch?: { focus?: boolean; reconnect?: boolean; interval?: number };
}
/** A cache key part: a string, a number, a params object or a function (the reactive part) */
export type CacheKeyPart = string | number | boolean | null | Record<string, unknown> | (() => string | number | Record<string, unknown>);
export interface CacheOptions {
    /** a key instead of the URL: a string or a hierarchical array ['users', () => id.value] (invalidate(['users']) matches all) */
    key?: string | CacheKeyPart[] | (() => string | CacheKeyPart[]);
    /** tags for invalidate({ tags }) */
    tags?: string | string[];
    /** after every list response seed the child entries: (data) => [[key, item], …] — a card opens without a request */
    seeds?: (data: any) => Array<[string | CacheKeyPart[], unknown]>;
    /** the response is an entity (configure({ identify })): update it in every list */
    entity?: boolean;
    /** ms | 'http' (Cache-Control max-age / Age / Expires of the response; ['http', fallbackMs]) | 'auto' | { auto: true, k?, min?, max? } — T* = sqrt(2k/(λ̂μ̂)) − 1/λ̂ from the observed rates */
    staleTime?: number | 'http' | ['http', number] | 'auto' | { auto: true; k?: number; min?: number; max?: number };
    /** ms until an idle entry is collected; Infinity — keep until evicted by limits; 'http' — max-age + stale-while-revalidate from the response */
    cacheTime?: number | 'http';
    /** keep old data when the URL changes (default true for a reactive source) */
    keepPrevious?: boolean;
    /** default ['focus', 'reconnect']; [] — off. Events that arrived in a hidden tab are applied when you return to it */
    revalidateOn?: Array<'focus' | 'reconnect'>;
    /** polling: ms or a function of the data (0 — stop); one timer for all resources, 1 s grid, backoff on errors, sleeps in a hidden tab */
    interval?: number | ((data: any) => number);
    /** keep polling in a hidden tab (the browser throttles anyway) */
    background?: boolean;
    /** never evict the entry by cache limits */
    pin?: boolean;
    /** the entry survives a reload (IndexedDB): true | { version — a format change resets, maxBytes — storage budget (4 MB), maxAge — lifetime (7 days) } */
    persist?: boolean | { version?: number; maxBytes?: number; maxAge?: number };
    /** share data and invalidation with other tabs (BroadcastChannel, default true) */
    sync?: boolean;
}
export interface OfflineOptions {
    /** attempts per mutation before dead-letter (default 10); 4xx — immediately */
    maxAttempts?: number;
    dbName?: string;
    storeName?: string;
    staleTime?: number;
    syncTag?: string;
}
export interface LoaderSource<P, T> {
    params?: P | (() => P);
    loader: (ctx: { params: P; signal: AbortSignal }) => Promise<T> | T;
}
export interface OfflineResourceResult<T> extends ResourceResult<T> {
    /** dead-letter: mutations the server rejected or that could not be delivered */
    failed: ReadonlySignal<Array<{ mutation: { mutId: string; method: string; url: string; body: unknown }; error: unknown }>>;
    online: ReadonlySignal<boolean>;
    syncing: ReadonlySignal<boolean>;
    /** network mutation; offline or a network error → into the IndexedDB queue, sent when online / Background Sync */
    send(method: string, url: string, body?: unknown, opts?: { optimistic?: (current: T | null) => T }): Promise<unknown>;
    /** compatibility: mutate('POST', url, body, optimistic) === send(...) */
    mutate(method: string, url: string, body?: unknown, optimistic?: (current: T | null) => T): Promise<unknown>;
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
}

/**
 * Reactive data loading — one primitive:
 *   resource('/api/users')                                 GET
 *   resource(() => `/api/users?page=${page.value}`)       refetch when signals change
 *   resource({ params: () => uid.value, loader: async ({ params, signal }) => … })
 *   resource(url, { cache: true, staleTime: 30000 })       SWR cache (shared by key)
 *   resource(url, { offline: true })                       IndexedDB + mutation queue
 */
export function resource<T = unknown>(source: string | (() => string | null | false), opts: ResourceOptions<T> & { initial: T } & { cache?: boolean | CacheOptions; offline?: false }): ResourceResult<T> & { data: Signal<T> };
export function resource<T = unknown>(source: string | (() => string | null | false), opts: ResourceOptions<T> & { offline: true | OfflineOptions }): OfflineResourceResult<T>;
export function resource<T = unknown>(source: string | (() => string | null | false), opts?: ResourceOptions<T> & { cache?: boolean | CacheOptions; offline?: false }): ResourceResult<T>;
export function resource<T = unknown, P = unknown>(source: LoaderSource<P, T>, opts?: ResourceOptions<T>): ResourceResult<T>;

/** Await the completion of all resource()/mutation()/guardedFetch requests — instead of sleep(50) in tests */
export function settled(): Promise<void>;

export interface MutationOptions<A extends unknown[]> {
    /** 'validate' — signals read through ctx.read before the response are validated by version on commit (OCC): changed → the patch is dropped, the keys are refetched, E052 in dev */
    isolation?: 'validate';
    /** resources whose data is snapshotted before optimistic and rolled back on error */
    resources?: Array<{ data: { peek(): any }; mutate(v: any): void }>;
    optimistic?: (...args: A) => void;
    invalidates?: InvalidatePattern | InvalidatePattern[];
    /** wait for the invalidates refetches before clearing pending (default true) */
    awaitInvalidates?: boolean;
    /** server response → a new base of the affected resources without a refetch: (result, base, ...args) => data */
    commit?: (result: any, base: any, ...args: A) => any;
    /** update cache entries by patterns without a refetch: { '/api/users*': (data, result, ...args) => data } */
    updates?: Record<string, (data: any, result: any, ...args: A) => any>;
    /** update entities in every entry (configure({ identify })): (result, ...args) => [[entityKey, (node) => node], …] */
    patch?: (result: any, ...args: A) => Array<[string, (node: any) => any]>;
    /** 412/409 from the server: base — before the edit, local — with optimistic, server — current; return 'server' | 'client' | an object to retry the mutation with */
    onConflict?: (c: { base: any; local: any; server: any; merge(): { value: any; conflicts: string[] }; error: HttpError }) => 'server' | 'client' | object | Promise<'server' | 'client' | object>;
    /** screen-reader announcements: true — defaults (Saved / the error text / Change reverted / conflict), or your own */
    announce?: true | { pending?: A11yMsg; success?: A11yMsg<any>; error?: A11yMsg<unknown>; undone?: A11yMsg<unknown>; conflict?: A11yMsg<unknown> };
    /** 'ignore' (default, double-submit guard) | 'queue' | 'latest' | 'parallel' */
    concurrent?: 'ignore' | 'queue' | 'latest' | 'parallel';
    onSuccess?: (result: any, ...args: A) => void;
    onError?: (error: unknown, ...args: A) => void;
}
export interface Mutation<A extends unknown[], R> {
    /** run; the error is not thrown — it is in .error (run() throws) */
    (...args: A): Promise<R | undefined>;
    run(...args: A): Promise<R | undefined>;
    pending: ReadonlySignal<boolean>;
    error: ReadonlySignal<unknown>;
    data: ReadonlySignal<R | null>;
    abort(): void;
}
/**
 * A mutation with pending, double-submit guard, optimistic + rollback, invalidate.
 *   const addTodo = mutation((text, { signal }) => api.post('/api/todos', { text }, { signal }), { resources: [todos], optimistic: … });
 */
export function mutation<A extends unknown[], R>(fn: (...args: [...A, { signal: AbortSignal; /** isolation: 'validate' — read a signal and remember its version (OCC) */ read<V>(sig: Signal<V> | ReadonlySignal<V>): V; /** ETag of the affected resource for If-Match */ etag: string | null }]) => Promise<R> | R, opts?: MutationOptions<A>): Mutation<A, R>;

export interface StreamOptions<T> {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    /** 'ndjson' (default: data — an array of JSON lines), 'text' (data — a string) or a line parser */
    parse?: 'ndjson' | 'text' | ((line: string) => T);
    initial?: unknown;
    reduce?: (acc: any, item: T) => any;
    immediate?: boolean;
}
/** Stream a response into a growing signal; done — the completion signal */
export function streamResource<T = unknown>(source: string | (() => string | null), opts?: StreamOptions<T>): ResourceResult<any> & { done: ReadonlySignal<boolean> };

/** Server-Sent Events over EventSource: the "aegis-signals" event writes JSON into signals; closed on scope dispose */
export function sse(url: string, opts?: {
    signals?: Record<string, Signal<any>>;
    events?: Record<string, (data: any, e: MessageEvent) => void>;
    onMessage?: (data: any, e: MessageEvent) => void;
    withCredentials?: boolean;
}): { status: ReadonlySignal<'connecting' | 'open' | 'closed'>; close(): void; source: EventSource };

export interface WatchHandle { (): void; stop(): void; pause(): void; resume(): void }
/**
 * Watch a signal/computed for changes.
 *
 * @param source — what to track (signal, computed, or getter function)
 * @param callback — called with (newValue, oldValue) on change
 * @param opts.immediate — call immediately with current value (oldValue = undefined)
 * @param opts.debounce — debounce the callback in ms
 * @returns dispose function
 */
export function watch<T>(
    source: Signal<T> | ReadonlySignal<T> | (() => T),
    callback: (newVal: T, oldVal: T | undefined, onCleanup: (fn: () => void) => void) => void,
    opts?: { immediate?: boolean; debounce?: number; once?: boolean }
): WatchHandle;

/**
 * Reactive store from a plain definition object.
 * - Data properties → signals (get/set transparently)
 * - Getters → computed signals (lazy)
 * - Methods → bound to the proxy (auto-batched)
 *
 * Special keys on the returned proxy:
 * - `$signals` — raw signals map
 * - `$reset()` — reset all data properties to initial values
 *
 * @example
 *   const todos = store({
 *       items: [],
 *       filter: 'all',
 *       get filtered() { return this.filter === 'all' ? this.items : this.items.filter(i => i.done); },
 *       add(text) { this.items = [...this.items, { id: Date.now(), text, done: false }]; },
 *   });
 */
// ── Cached Resource (SWR) ──────────────────────────────────────

/** Warm the cache without subscribers (hover, approaching the viewport); the data is available to resource(url, { cache: true }) */
export function prefetch(url: string, opts?: { /** kind of warm-up for hit statistics (prefetchOn sets it itself) */ kind?: string; /** probability of use — warm up only when p·rtt exceeds the network cost */ p?: number; /** bypass the network budget (configure({ speculation })) */ force?: boolean; key?: string; staleTime?: number; cacheTime?: number; fetcher?: Fetcher; transform?: (d: unknown) => unknown }): Promise<void>;
/** Warm-up on intent: hover (default) | tap | visible; with saveData/2g — tap only. Returns dispose */
export function prefetchOn(el: Element, urlOrFn: string | ((target: Element) => string | null | undefined), opts?: { on?: 'hover' | 'tap' | 'visible'; /** 'auto' — horizon by scroll speed (400 / 1200 / 3000 px) */ rootMargin?: string; /** hover delay: ms | 'auto' */ delay?: number | 'auto'; /** cursor speed threshold (px/s): below it the user is “aiming”, warm up immediately */ velocity?: number; /** probability of use (or a function of the target) for the usefulness threshold */ p?: number | ((target: Element) => number); staleTime?: number; kind?: string }): () => void;

/** Cursor pagination: pages accumulate, loadMore is deduplicated */
export function infiniteResource<P = unknown, T = unknown>(urlFor: (cursor: unknown) => string | null, opts?: {
    getNext?: (page: P) => unknown;
    select?: (page: P) => T[];
    fetcher?: Fetcher;
    immediate?: boolean;
    retry?: boolean | number;
}): ResourceResult<T[]> & { pages: ReadonlySignal<P[]>; hasMore: ReadonlySignal<boolean>; loadMore(): Promise<void>; reset(): Promise<void> };

export type CacheState = 'fresh' | 'stale' | 'inflight' | 'error' | 'empty' | 'absent';
export interface CacheEvent { t: number; reason: 'mount' | 'url' | 'refresh' | 'invalidate' | 'focus' | 'reconnect' | 'prefetch' | 'seed' | string; result: 'fetch' | 'fresh' | 'joined' | 'set'; ms?: number; status?: 'ok' | 'error'; changed?: boolean }
export interface CacheExplain {
    key: string; state: CacheState; why: string;
    age?: number | null; staleTime?: number; cacheTime?: number | null; subscribers?: number;
    /** ms until garbage collection (null — there are subscribers, Infinity — cacheTime: Infinity) */
    gcIn?: number | null; fetches?: number; unchanged?: number;
    /** observed change / access interval, ms */
    changeInterval?: number | null; readInterval?: number | null;
    /** staleTime from observations (≈5% stale reads) */
    suggestedStaleTime?: number | null;
    tags?: string[] | null; prefetched?: string | null; /** ETag of the last response (If-None-Match → 304) */ etag?: string | null; staleTimeMode?: 'http' | 'auto' | string | null; history: CacheEvent[];
}
export interface CacheEntryStats { key: string; state: CacheState; age: number | null; staleTime: number; subscribers: number; inflight: boolean; error: string | null; size: number; gcIn: number | null; fetches: number; unchanged: number; suggestedStaleTime: number | null; prefetched: string | null; tags: string[] | null }
export interface CacheStats { entries: CacheEntryStats[]; prefetch: { fired: number; used: number; wasted: number; byKind: Record<string, { p: number; n: number }>; hoverDelay: number }; speculation: { inflight: number; queued: number; fired: number; skipped: number; aborted: number }; ghost: number; bytes: number; evictions: number; limits: { maxEntries: number; maxBytes: number }; now: number }
/** Public access to the resource cache — keys are normalised as in resource() */
export const cache: {
    get<T = unknown>(key: string | CacheKeyPart[] | Record<string, unknown>): T | undefined;
    has(key: string | CacheKeyPart[] | Record<string, unknown>): boolean;
    /** Logout: wipe the persist store (all principals, or only foreign ones with others: true) and the offline queue */
    purge(opts?: { persist?: boolean; queue?: boolean; others?: boolean }): Promise<void>;
    /** = seed(key, data, { age, staleTime }) */
    set(key: string | CacheKeyPart[] | Record<string, unknown>, data: unknown, opts?: { age?: number; staleTime?: number }): unknown;
    /** remove entries by pattern (no argument — all); returns the number removed */
    remove(pattern?: InvalidatePattern): number;
    keys(prefix?: string | CacheKeyPart[]): string[];
    entry(key: string | CacheKeyPart[]): { key: string; data: Signal<any>; error: Signal<unknown>; inflight: Signal<boolean>; refCount: number; age(): number | null } | null;
    /** subscribe to an entry's data (keeps it alive); returns unsubscribe */
    subscribe<T = unknown>(key: string | CacheKeyPart[], fn: (data: T | null) => void): () => void;
    /** cache decision events: fetch / fresh / joined / set — for assertions in tests */
    on(fn: (key: string, ev: CacheEvent) => void): () => void;
    /** explicit garbage collection by the clock (tests with fakeClock, low memory); returns the number removed */
    gc(now?: number): number;
    /** update an entity in every cache entry (configure({ identify })); returns the number of entries changed */
    patchEntity(entityKey: string, fn: (node: any) => any): number;
    /** three-way merge of objects */
    merge3<T = any>(base: T, local: T, server: T): { value: T; conflicts: string[] };
    /** the persist-store record (IndexedDB): { data, at, v, n } | null */
    persisted(key: string | CacheKeyPart[]): Promise<{ data: unknown; at: number; v: number; n: number; etag?: string | null } | null>;
    /** await hydration of the entry from disk: true — the data came from persist */
    hydrated(key: string | CacheKeyPart[]): Promise<boolean>;
    /** entries, bytes (with maxBytes), evictions and limits */
    size(): { entries: number; bytes: number; evictions: number; maxEntries: number; maxBytes: number };
    /** why the entry is fresh/stale, who requested it, what to recommend */
    explain(key: string | CacheKeyPart[]): CacheExplain;
    stats(): CacheStats;
};
/** Replace the cache clock (staleTime, cacheTime, explain): useClock(() => t); returns restore. See fakeClock() in aegis/test */
export function useClock(now?: (() => number) | null): () => void;
/** Key pattern: an exact key, 'prefix*', ['users'] (hierarchical prefix), a predicate or { prefix, exact, tags, refetch } */
export type InvalidatePattern = string | CacheKeyPart[] | ((key: string, entry?: unknown) => boolean) | { prefix?: string; exact?: string | CacheKeyPart[]; tags?: string | string[]; refetch?: 'active' | 'all' | 'none' };
/** Reset freshness and refetch live entries; the Promise waits for the refetches. cancel: false — wait for the in-flight request and refetch after it */
export function invalidate(pattern: InvalidatePattern, opts?: { cancel?: boolean; refetch?: 'active' | 'all' | 'none' }): Promise<void>;

/** Put data into the cachedResource() cache by hand (a mutation response, a server payload). age — the age of the data in ms */
/** Put data into the cache: age — age in ms, staleTime — how long it counts as fresh (default 0: SWR revalidation on mount) */
export function seed(key: string | CacheKeyPart[], data: unknown, opts?: { age?: number; staleTime?: number }): unknown;
/**
 * Seed the cache from server HTML:
 *   <script type="application/json" data-aegis-cache="/api/users" data-aegis-age="120">[…]</script>
 * Idempotent; hydrate() calls it itself. Returns the number of seeded entries.
 */
export function seedFrom(root?: Document | Element): number;
/** Navigation predictor: a first-order Markov chain over route patterns with forgetting (decay), a server prior (kappa pseudo-counts) and persistence in storage */
export interface Predictor {
    learn(from: string, to: string): void;
    /** rank the candidates: p = (count + kappa·prior + alpha) / (n + kappa + alpha·|candidates|) */
    next(from: string, candidates: string[]): Array<{ key: string; p: number }>;
    p(from: string, to: string): number;
    /** server prior for from: { to: p } — or <script type="application/json" data-aegis-predict="from"> via seedFrom()/hydrate() */
    prior(from: string, map: Record<string, number>): void;
    reset(): void;
}
export function predictor(opts?: { decay?: number; alpha?: number; kappa?: number; storage?: Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null; key?: string; max?: number }): Predictor;
/** Speculation Rules for server-first pages: one <script type="speculationrules"> with document rules (prefetch / prerender by eagerness); without support — <link rel="prefetch"> on intent. Returns dispose */
export function speculate(opts?: { prefetch?: boolean; prerender?: boolean | 'conservative' | 'moderate' | 'eager'; eagerness?: 'conservative' | 'moderate' | 'eager'; select?: string; exclude?: string; urls?: string[] }): () => void;
/** Leader among tabs (Web Locks): true in exactly one tab, the lock moves when it closes; .release() — hand it over; without Web Locks — a fallback */
export function leader(name?: string, opts?: { fallback?: boolean }): ReadonlySignal<boolean> & { release(): void };

// ── Form ───────────────────────────────────────────────────────

export type ValidationRule<V = unknown> = (value: V, key: string, fields: Record<string, Signal<unknown>>, ctx?: { signal: AbortSignal | null; /** true — inside the computed truth (issues): the rule must be pure */ live?: boolean }) => string | null;
/** A rule may be a Standard Schema (zod/valibot/arktype): the first issue.message; an async schema — an async rule */
export type RuleLike<V = any> = ValidationRule<V> | AsyncValidationRule<V> | StandardSchemaV1<V, any>;
export type FormStatus = 'idle' | 'validating' | 'submitting' | 'success' | 'error';
/** Field reference: bind:field=${f.field('email')} — bind + touched + aria-invalid + aria-describedby + the error container in one line */
export interface FieldRef<T = any> {
    key: string;
    value: Signal<T>;
    /** the shown error */
    error: Signal<string | null>;
    /** the truth: the result of the rules for the current value, regardless of display */
    issue: ReadonlySignal<string | null>;
    touched: Signal<boolean>;
    validating: ReadonlySignal<boolean>;
    id: string;
    errorId: string;
}
/** Form field: { value, rules } — rules are typed by the value: minLen(3) on a numeric field is a type error */
export interface FieldDef<V = any> { value: V; rules?: Array<ValidationRule<V> | AsyncValidationRule<V>> }

export interface FormResult<T extends Record<string, { value: any; rules?: any[] }>> {
    fields: { [K in keyof T]: Signal<T[K]['value']> };
    errors: { [K in keyof T]: Signal<string | null> };
    dirty: ReadonlySignal<boolean>;
    valid: ReadonlySignal<boolean>;
    validate(): boolean;
    validateField(key: keyof T): boolean;
    submit(url: string, opts?: { headers?: Record<string, string>; transform?: (body: any) => any; fetchOpts?: RequestInit }): Promise<{ ok: boolean; data?: any; status?: number; errors?: any; error?: Error }>;
    reset(): void;
    setErrors(errors: Partial<{ [K in keyof T]: string | string[] }>): void;
}

export function form<S extends Record<string, any>>(schema: { [K in keyof S]: FieldDef<S[K]> }): FormResult<{ [K in keyof S]: FieldDef<S[K]> }> & FormSubmitState & FormCore;
export interface FormSubmitState {
    submitting: ReadonlySignal<boolean>;
    submitCount: ReadonlySignal<number>;
    submitError: ReadonlySignal<unknown>;
    result: ReadonlySignal<unknown>;
}
/** Standard Schema (zod v4 / valibot / arktype / …) — no dependency */
export interface StandardSchemaV1<I = unknown, O = I> {
    readonly '~standard': {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardResult<O> | Promise<StandardResult<O>>;
    };
}
export type StandardResult<O> = { value: O; issues?: undefined } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> };
/** Rule: (value, key, fields, { signal }) → error string | null | Promise (async — with debounce, cancellation and validating[key]) */
export type AsyncValidationRule<V = any> = (value: V, key: string, fields: Record<string, Signal<any>>, ctx: { signal: AbortSignal | null }) => string | null | undefined | Promise<string | null | undefined>;
export interface FormCore {
    /** nested object of values: items[0][qty] → { items: [{ qty }] } */
    values: ReadonlySignal<any>;
    /** truth per field: the result of sync rules and the Standard Schema for the current values, recomputed reactively; $any — at least one */
    issues: Record<string, ReadonlySignal<string | null>> & { $any: ReadonlySignal<boolean>; $form: ReadonlySignal<string | null> };
    touched: Record<string, Signal<boolean>>;
    /** valid and nothing is validating/submitting — for a disabled button */
    canSubmit: ReadonlySignal<boolean>;
    /** there was at least one submit */
    submitted: ReadonlySignal<boolean>;
    /** submit lifecycle; submitting — a computed of it */
    status: Signal<FormStatus>;
    /** abort the current submit (the handler receives ctx.signal) */
    abort(): void;
    /** focus the first shown error */
    focusFirstError(): boolean;
    /** bind an input to a field (per-input layer: two-way, touched, display mode, aria, :user-invalid); f.wire('email') — a directive for html`` */
    wire(el: HTMLElement, key?: string): () => void;
    wire(key: string): Attachment<any>;
    /** field reference for bind:field=${f.field('email')} */
    field(key: string): FieldRef;
    /** bring a whole <form> to life — every [name], like wireForm */
    attach(formEl: HTMLFormElement): HTMLFormElement;
    /** field keys (reactive: the form grows) */
    keys: ReadonlySignal<string[]>;
    /** Standard Schema output (coerce / trim / default) — goes into submit instead of the raw values; null while there are issues */
    parsed: ReadonlySignal<any>;
    /** the form grows: add a field (rules — explicit or by the 'items[].qty' pattern), remove, rename (signals move along) */
    addField(key: string, initial?: unknown, rules?: RuleLike[], opts?: { initial?: unknown }): Signal<any>;
    removeField(key: string): void;
    renameField(from: string, to: string): void;
    /** GOV.UK-style error summary: role=alert, a heading with the error count, links to the fields; on a failed submit focus goes to it */
    summary(target?: string | Element, opts?: { heading?: 'h2' | 'h3' | 'p' }): Element;
    /** shown errors: [{ key, message, el }] — for your own summary */
    errorList: ReadonlySignal<Array<{ key: string; message: string; el: HTMLElement | null }>>;
    /** protection against losing edits: beforeunload + Navigation API interception with confirmation; returns dispose */
    guard(opts?: GuardOptions): () => void;
    validating: Record<string, ReadonlySignal<boolean>> & { $any: ReadonlySignal<boolean> };
    dirtyFields: ReadonlySignal<Record<string, true>>;
    /** changed fields only (for PATCH) */
    changes: ReadonlySignal<any>;
    /** sync rules + schema; async rules run in the background */
    validate(): boolean;
    validateField(key: string): boolean;
    /** sync + async + schema */
    validateAsync(): Promise<boolean>;
    /** new “initial” values (an object or a signal, e.g. resource().data) */
    setInitial(values: Record<string, any> | ReadonlySignal<any> | Signal<any>): void;
    /** the current values become the initial ones (after a successful PATCH) */
    commit(): void;
    /** beforeunload while dirty; returns dispose */
    guardUnload(): () => void;
    setErrors(errors: Record<string, any> | Array<{ path?: string | string[]; pointer?: string; message: string }>): void;
    reset(): void;
}
export interface GuardOptions {
    /** your own confirmation (a dialog) — Promise<boolean>; window.confirm by default */
    confirm?: (toUrl: string) => boolean | Promise<boolean>;
    /** treat an anchor (#) navigation as leaving */
    hash?: boolean;
}
/** Form a11y policy: field — how to announce a field error ('blur' — one polite announcement on blur, 'live' — the span becomes role=status, 'off'), summary — one announcement on a failed submit */
export interface FormA11y { field?: 'blur' | 'live' | 'off'; summary?: boolean }
export interface FormOptions {
    a11y?: FormA11y;
    /** on a failed submit focus the summary (if any) or the first field */
    focusOnError?: 'summary' | 'field' | false;
    types?: Record<string, typeof Date | typeof Number | typeof Array | typeof Boolean | typeof String>;
    rules?: Record<string, RuleLike[]>;
    schema?: StandardSchemaV1<any, any>;
    asyncDebounce?: number;
    /** when to SHOW rule errors (the truth is always in issues): blur, then live for fields with an error (default) | live | only after submit */
    mode?: 'blur-then-live' | 'live' | 'submit';
    /** false — do not touch native validation (noValidate / setCustomValidity) */
    native?: boolean;
}
/** form(defaults, { rules, schema }) — a form from default values: form({ name: '', age: 0 }) */
export function form<T extends Record<string, any>>(defaults: T & { [K in keyof T]: T[K] extends { value: any } ? never : T[K] }, opts?: FormOptions): FormResult<{ [K in keyof T]: { value: T[K] } }> & FormSubmitState & FormCore & {
    submit(handler: (values: T, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | null }) => unknown | Promise<unknown>, opts?: { submitter?: HTMLElement; event?: SubmitEvent }): Promise<unknown>;
    submit(url: string, opts?: { headers?: HeadersInit; transform?: (v: T) => unknown; fetchOpts?: RequestOptions; submitter?: HTMLElement; onRedirect?: 'assign' | 'router' | 'none' | ((r: Response) => void) }): Promise<{ ok: boolean; status?: number; data?: any; error?: unknown; aborted?: boolean; redirected?: boolean }>;
};
export const email: ValidationRule<string>;
export function min(n: number, msg?: string): ValidationRule<number | string | null>;
export function max(n: number, msg?: string): ValidationRule<number | string | null>;

export const required: ValidationRule<any>;
export function minLen(n: number): ValidationRule<string>;
export function maxLen(n: number): ValidationRule<string>;
export function pattern(re: RegExp, msg?: string): ValidationRule<string>;
export const emailRule: ValidationRule<string>;
export function matches(otherKey: string, msg?: string): ValidationRule<any>;

// ── WireForm ───────────────────────────────────────────────────

/** A fieldArray() row: key is stable across renumbering (the key for list()), index — the current position */
export interface FieldArrayRow { key: number; index: number; value(sub: string): Signal<any>; field(sub: string): FieldRef }
export interface FieldArray<R extends Record<string, any> = Record<string, any>> {
    rows: ReadonlySignal<FieldArrayRow[]>;
    length: ReadonlySignal<number>;
    push(init?: Partial<R>): FieldArrayRow;
    insert(i: number, init?: Partial<R>): FieldArrayRow;
    remove(i: number): void;
    move(from: number, to: number): void;
    swap(a: number, b: number): void;
    replace(rows: Partial<R>[]): void;
    clear(): void;
    nameOf(i: number, sub?: string): string;
}
export interface WizardStep { index: number; keys(): string[]; valid: ReadonlySignal<boolean>; dirty: ReadonlySignal<boolean>; done: ReadonlySignal<boolean> }
export interface Wizard {
    step: Signal<number>;
    steps: WizardStep[];
    count: number;
    /** validates the fields of the current step (sync + async + schema for them only) and moves on */
    next(): Promise<boolean>;
    prev(): Promise<boolean>;
    go(i: number, opts?: { validate?: boolean }): Promise<boolean>;
    validateStep(i: number): Promise<boolean>;
    first: ReadonlySignal<boolean>;
    last: ReadonlySignal<boolean>;
    progress: ReadonlySignal<number>;
    dispose(): void;
}
/**
 * A wizard on top of form()/wireForm(): steps are groups of keys ('address.*') or [data-step] in the form; focus on the new step, announce “Step n of N”,
 * [data-step-nav] children get aria-current="step"; history: true — ?step=i through the Navigation API; persist: 'key' — the step in sessionStorage
 */
export function wizard(f: FormCore | WireFormResult, opts?: { steps?: string[][]; persist?: string; history?: boolean; focus?: boolean }): Wizard;
/** A form draft in sessionStorage: changed fields without password/file, restored on creation (dirty stays), cleared on success */
export function draft(f: FormCore | WireFormResult, key: string, opts?: { storage?: Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }; debounce?: number; ttl?: number; exclude?: (key: string, value: unknown) => boolean; restore?: (values: Record<string, unknown>, apply: () => void) => void }): { restored: boolean; clear(): void; stop(): void; key: string };
/**
 * An array of fields on top of form()/wireForm(): items[i][sub] with stable row keys and name renumbering.
 *   const items = fieldArray(f, 'items', { row: { qty: 1, sku: '' } });   // form rules: { 'items[].qty': [min(1)] }
 *   list(items.rows, row => html`<input bind:field=${row.field('qty')}>`, r => r.key)
 */
export function fieldArray<R extends Record<string, any>>(f: FormCore | WireFormResult, path: string, opts?: { row?: R; rules?: { [K in keyof R]?: RuleLike[] }; name?: (i: number, sub?: string) => string; initial?: Partial<R>[] }): FieldArray<R>;
export interface WireFormResult {
    /** the <form> itself */
    el: HTMLFormElement;
    keys: ReadonlySignal<string[]>;
    parsed: ReadonlySignal<any>;
    /** attach an input that appeared after wireForm(); detach a field; rescan the form (after swap/morph/list) */
    wire(input: HTMLElement): void;
    unwire(key: string): void;
    rewire(): void;
    /** read errors from the (server) form markup into errors; true — there is at least one */
    adoptErrors(root?: ParentNode): boolean;
    addField(key: string, initial?: unknown, rules?: RuleLike[]): Signal<any>;
    removeField(key: string): void;
    renameField(from: string, to: string): void;
    field(key: string): FieldRef;
    fields: Record<string, Signal<unknown>>;
    errors: Record<string, Signal<string | null>>;
    summary(target?: string | Element, opts?: { heading?: 'h2' | 'h3' | 'p' }): Element;
    errorList: ReadonlySignal<Array<{ key: string; message: string; el: HTMLElement | null }>>;
    guard(opts?: GuardOptions): () => void;
    /** truth per field (sync rules + schema), regardless of display */
    issues: Record<string, ReadonlySignal<string | null>> & { $any: ReadonlySignal<boolean>; $form: ReadonlySignal<string | null> };
    touched: Record<string, Signal<boolean>>;
    dirty: ReadonlySignal<boolean>;
    valid: ReadonlySignal<boolean>;
    canSubmit: ReadonlySignal<boolean>;
    submitted: ReadonlySignal<boolean>;
    status: Signal<FormStatus>;
    submitting: ReadonlySignal<boolean>;
    submitCount: ReadonlySignal<number>;
    result: ReadonlySignal<unknown>;
    abort(): void;
    focusFirstError(): boolean;
    validating: Record<string, ReadonlySignal<boolean>> & { $any: ReadonlySignal<boolean> };
    validateField(key: string): boolean;
    validateAsync(): Promise<boolean>;
    validate(): boolean;
    reset(): void;
    setErrors(errors: Record<string, any> | Array<{ path?: string | string[]; pointer?: string; message: string }>): void;
    /** handler(values, { signal, submitter, event }); without a handler — a server submit (FormData, 422 → field errors, 303 → navigation) */
    submit(handler?: ((values: Record<string, unknown>, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | undefined }) => unknown | Promise<unknown>) | { as?: 'json'; headers?: HeadersInit; onSuccess?: (data: any, r: Response) => void; onRedirect?: 'assign' | 'router' | 'none' | ((r: Response) => void); announceSuccess?: boolean; html?: 'morph' | 'replace' | false; intents?: Record<string, (f: WireFormResult, e: SubmitEvent) => void> }): (e?: Event) => Promise<any>;
    step: Signal<number> | null;
    stepCount: number | null;
    next: (() => boolean) | null;
    prev: (() => void) | null;
}

/**
 * Bring a server <form> to life: signals, validation (native constraints through the Constraint Validation API with browser messages,
 * rules, Standard Schema, async rules), a11y, wizard, server submit.
 *   const f = wireForm(el, { schema: zodSchema, rules: { login: [unique] }, submit: true });   // submit: true — FormData to the form's action
 *   on(el, 'submit', f.submit(values => api.post('/save', values)));
 */
export function wireForm(formEl: HTMLFormElement, opts?: {
    schema?: Record<string, RuleLike[]> | StandardSchemaV1<any, any>;
    rules?: Record<string, RuleLike[]>;
    /** when to show errors; the truth is always in issues */
    mode?: 'blur-then-live' | 'live' | 'submit';
    native?: boolean;
    asyncDebounce?: number;
    /** 'browser' — input.validationMessage in the browser's language; 'page' — ValidityState codes → a dictionary in the page's language */
    messages?: 'browser' | 'page';
    submit?: boolean | ((values: Record<string, unknown>, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | undefined }) => unknown);
    onRedirect?: 'assign' | 'router' | 'none' | ((r: Response) => void);
    announceSuccess?: boolean;
    /** Escape during submission aborts it */
    escapeAborts?: boolean;
    /** watch fields appear/disappear (MutationObserver) */
    observe?: boolean;
    /** value coercion: { birthday: Date, qty: Number, tags: Array, agree: Boolean } */
    types?: Record<string, typeof Date | typeof Number | typeof Array | typeof Boolean | typeof String>;
    a11y?: FormA11y;
    focusOnError?: 'summary' | 'field' | false;
    /** render the error summary right away (true — a container before the form) */
    summary?: boolean | string | Element;
    /** guard() right away */
    guard?: boolean | GuardOptions;
    /** draft in sessionStorage: a key or true (the form's action + id); also data-aegis-draft on <form> */
    draft?: string | boolean;
    /** an HTML response from the server (Rails 422 render, Django form_invalid): 'morph' (default) — the form is morphed in place and errors are read from the markup; 'replace'; false — leave it */
    html?: 'morph' | 'replace' | false;
    /** <button name="intent" value="add"> or data-intent — a local action without a request; without JS the same button goes to the server */
    intents?: Record<string, (f: WireFormResult, e: SubmitEvent) => void>;
}): WireFormResult;

// ── Component ──────────────────────────────────────────────────

/**
 * Rich context passed to component setup functions.
 * All DOM helpers are pre-bound to the component's scope.
 */
export interface ComponentContext<E extends Element = HTMLElement> {
    el: E;
    /**
     * Server-rendered children of the component (a snapshot before setup). Without a selector — all remaining ones,
     * with a selector ('[slot=footer]') — only the matching ones. Nodes are moved, not copied.
     */
    slot(selector?: string): DocumentFragment;
    signal: typeof signal;
    computed: typeof computed;
    effect: typeof effect;
    batch: typeof batch;
    on: typeof on;
    delegate: typeof delegate;
    bind: typeof bind;
    text: typeof text;
    attr: typeof attr;
    cls: typeof cls;
    style: typeof style;
    styleMap: typeof styleMap;
    html: typeof html;
    show: typeof show;
    list: typeof list;
    interval: typeof interval;
    timeout: typeof timeout;
    observe: typeof observe;
    resize: typeof resize;
    mutate: typeof mutate;
    provide: typeof provide;
    inject: typeof inject;
    when: typeof when;
    selector: typeof selector;
    /** Pre-bound guardedFetch — already tied to this component's scope */
    guardedFetch: GuardedFetch;
    /** State that survives island hibernation and page-out (onSaveInstanceState): the signal is restored from the snapshot on remount */
    state<T>(key: string, init: T): Signal<T>;
    /** the same, short name */
    fetch: GuardedFetch;
    /** the component's scope (for code after await: scope.run(() => …)) */
    scope: Scope;
    /** errorBoundary without a browser extension: errors of the component's effects */
    onError(fn: (error: any) => void): () => void;
    debounced: typeof debounced;
    throttled: typeof throttled;
    poll: typeof poll;
    /** Returns unregister — remove the cleanup early */
    onDispose(fn: () => void): () => void;
}

/** The result of component(): if setup returned a template (Node) it is inserted into el and { el, destroy } is returned */
export type ComponentResult<R> = R extends Node ? { el: Element; destroy(): void } : R;

/**
 * Shorthand: mount component by CSS selector or element.
 * @param selector — CSS selector string or Element
 * @param setup — component setup function
 * @returns component API or undefined if element not found
 */
export function mount<R = void>(
    selector: string | Element,
    setup: (ctx: ComponentContext<HTMLElement>) => R
): ComponentResult<R> | undefined;

/** D — the shape of the element's data-* attributes (JSON values are parsed); the cast is unchecked, like defineProps<T>() */
/** Component = a function (ctx) => Node | api | void; ctx.props — a reactive() object of props */
export type Component<P = Record<string, any>, R = void | object | Node> = (ctx: ComponentContext & { props: P & ReactiveExtras<P> }) => R | Promise<R>;
/** An island from a component function: data-* (with types) → ctx.props */
/** ctx.props of an island: declared types are typed, other data-* — unknown */
export type IslandProps<T> = { [K in keyof T]: PropValue<{ type: T[K] }> } & Record<string, unknown>;
export function island<T extends Record<string, PropType> = {}>(name: string, component: Component<IslandProps<T>>, opts?: { types?: T }): void;
/** ctx.props of a custom element: { count: Number } → number | null, { count: { type: Number, default: 0 } } → number */
export type ElementProps<P> = { [K in keyof P]: PropValue<P[K] extends PropType ? { type: P[K] } : P[K]> };
/** A custom element from the same component: attributes → ctx.props (reactive) */
export function element<P extends Record<string, PropType | { type: PropType; default?: unknown; reflect?: boolean }> = {}>(tag: `${string}-${string}`, component: Component<ElementProps<P>>, opts?: { props?: P; shadow?: boolean; styles?: CSSStyleSheet | string; formAssociated?: boolean }): void;
export type IslandSetup<D = Record<string, unknown>> = (el: HTMLElement, data: D, ctx: ComponentContext<HTMLElement>) => void | object | Node | Promise<void | object | Node>;
export type PropType = NumberConstructor | BooleanConstructor | StringConstructor | JSON | ObjectConstructor | ArrayConstructor | ((raw: string) => unknown);
/**
 * Register a component by name; { load } — the island code is loaded with import() on mount.
 * data-* are passed as strings (JSON literals are parsed); types declares coercion: { count: Number, on: Boolean, tags: JSON }.
 * A <script type="application/json"> block inside the island (or data-aegis-props="#id") → data.props and fields of data.
 */
/** Low-level positional form. Prefer `island(name, Component, { types })`; keep `register()` for `{ load }` (lazy island modules). */
export function register<D = Record<string, unknown>>(
    name: string,
    setup: IslandSetup<D> | { load: () => Promise<IslandSetup<D> | { default: IslandSetup<D> }> },
    opts?: { types?: Record<string, PropType> }
): void;
export interface HydrateOptions {
    /** MutationObserver: inserted islands come alive, removed ones are destroyed (htmx/Turbo/jQuery) */
    watch?: boolean;
    /** remount the ones already alive */
    force?: boolean;
    /** override data-aegis-load for all (tests: 'eager'). Strategies with arguments: 'visible(300px)', 'idle(1500)', 'interaction(click,keydown)' */
    load?: 'eager' | 'visible' | 'idle' | 'interaction' | string;
    /** no warnings about unregistered components */
    quiet?: boolean;
    /** ms of synchronous work before scheduler.yield(); Infinity — everything synchronous. Default 8 */
    budget?: number;
    /** Working-set paging of visible islands: margin — how far from the screen an island is paged out with a snapshot (or data-aegis-resident), max — the resident set size (CLOCK) */
    resident?: { margin?: string; max?: number };
    /** deadline for idle islands, ms. Default 2000 */
    idleTimeout?: number;
}
export interface HydrateHandle {
    el: HTMLElement;
    name: string;
    /** undefined while the island waits for its loading strategy */
    api: unknown;
    ready: Promise<unknown>;
}
/**
 * Bring server HTML to life: [data-aegis] (including root itself). Idempotent.
 * Seeds the cache from <script type="application/json" data-aegis-cache> first.
 * Events: aegis:hydrate (cancelable), aegis:hydrated (detail: { name, api }), aegis:destroy.
 * The first chunk mounts synchronously; handles.ready — a Promise for the completion of the eager part.
 */
export function hydrate(root?: Document | Element, opts?: HydrateOptions): HydrateHandle[] & { ready: Promise<void> };
export namespace hydrate {
    /** Auto-hydrate(document) after register(). Default true */
    let auto: boolean;
}
export function destroy(el: Element): void;
export function destroyAll(root?: Document | Element): void;

/**
 * Error boundary: wraps component() in try/catch.
 * @param fallback — receives (error, el) on failure
 */
export function errorBoundary<R = void>(
    el: Element,
    setup: (ctx: ComponentContext) => R,
    fallback?: (error: Error, el: Element) => void
): ComponentResult<R> | undefined;

/**
 * Render content into a different DOM location.
 * Auto-removes on scope dispose.
 *
 * @param target — DOM element to append into (e.g. document.body)
 * @param contentFn — content factory or DocumentFragment/Element
 * @returns container div + dispose function
 */
export function portal(
    target: Element,
    contentFn: (() => DocumentFragment | Element) | DocumentFragment | Element,
    /** popover: 'auto' | 'manual' | true — the container in the top layer (light-dismiss, :popover-open); anchor + placement — CSS anchor positioning */
    opts?: { popover?: 'auto' | 'manual' | boolean; anchor?: Element; placement?: string }
): { container: HTMLDivElement; dispose(): void; /** whether the popover portal is open (toggle) */ open: ReadonlySignal<boolean> };

/**
 * CSS enter/leave transition driven by a reactive condition.
 * Applies CSS classes on enter/leave and auto-hides via `el.hidden`.
 *
 * @param el — target element
 * @param condition — signal, function, or boolean controlling visibility
 * @param opts — CSS class names and optional duration
 * @returns effect disposer
 */
/** Animated show/hide through the CSS contract `${name}-enter-*` / `${name}-leave-*` (interrupt-safe); legacy { enter, enterActive, leave, leaveActive, duration } is supported */
export function transition(
    el: Element,
    condition: Signal<boolean> | (() => boolean) | boolean,
    opts?: {
        enter?: string;
        enterActive?: string;
        leave?: string;
        leaveActive?: string;
        duration?: number;
    }
): () => void;

export function lazy(el: Element, loadFn: (el: Element) => Promise<void> | void, opts?: {
    skeleton?: (() => Element) | Element;
    rootMargin?: string;
    threshold?: number;
}): { loaded: Signal<boolean>; loading: Signal<boolean>; dispose: () => void };

// ── Animation ──────────────────────────────────────────────────

export interface SpringOptions {
    stiffness?: number;
    damping?: number;
    mass?: number;
    velocity?: number;
}

export function spring(el: Element, props: Record<string, [from: string | number, to: string | number]>, opts?: SpringOptions): Animation;
/** A spring as a value: write target, read current; velocity is kept when the target changes */
export function springSignal<T extends number | number[] | Record<string, number>>(initial: T, opts?: { stiffness?: number; damping?: number; mass?: number; precision?: number }): { target: Signal<T>; current: ReadonlySignal<T>; set(v: T, opts?: { hard?: boolean }): void };
/** A tween as a value */
export function tween<T extends number | number[] | Record<string, number>>(initial: T, opts?: { duration?: number; easing?: (t: number) => number }): { target: Signal<T>; current: ReadonlySignal<T>; set(v: T, opts?: { hard?: boolean }): void };
export function flip(nodes: ArrayLike<Element>, opts?: { stiffness?: number; damping?: number }): () => void;
export function animate(target: Element, mutate: () => void, opts?: { name?: string; cls?: string }): Promise<void>;

// ── Accessibility ──────────────────────────────────────────────

/** Native modal: open → showModal(); Esc/close → open = false */
export function modal(dialog: HTMLDialogElement, open: Signal<boolean>): () => void;
/** A register() scaffold for an island from its server markup (dev) */
export function scaffold(el: HTMLElement): string;
/**
 * Focus trap: Tab cycle, autoFocus, focus return; escape / outside (release or your own handler); inert for the background (except allow)
 */
export interface TrapOptions {
    /** true / 'first' — [data-autofocus] → the first tabbable → the container; 'container' — a static container (long text, APG); a selector — your own element */
    autoFocus?: boolean | 'first' | 'container' | string;
    /** focus that left (programmatically, from a widget) is brought back inside; default true */
    recapture?: boolean;
    /** Escape: true — release(), a function — your own handler */
    /** true — Esc/Android back/AT close request through CloseWatcher (the platform stack; <dialog>/popover do not close together with the trap); 'key' — keydown only; a function — your own handler */
    escape?: boolean | 'key' | ((e: Event) => void);
    /** a click outside the container (and outside allow) */
    outside?: boolean | ((e: PointerEvent) => void);
    /** inert for the background */
    inert?: boolean;
    allow?: string;
    /** true — to the element active before trap(); Element | () => Element — your own; if the trigger was removed (a list() row) — the nearest living neighbour */
    returnFocus?: boolean | Element | (() => Element | null);
}
export function trap(container: Element, opts?: TrapOptions): (() => void) & { dispose(): void; refresh(): void };
/** Tabbable elements in document order, including open shadow roots and <slot>; inert/hidden/disabled/tabindex<0/closed <details> are excluded */
export function tabbables(root: Element | ShadowRoot): HTMLElement[];
export interface RovingOptions {
    selector?: string;
    /** 'grid' — Left/Right by cells, Up/Down by rows, Home/End within the row, Ctrl+Home/End, PageUp/Down */
    orientation?: 'horizontal' | 'vertical' | 'both' | 'grid';
    wrap?: boolean;
    /** grid: number of columns or 'auto' (from the geometry of the first row) */
    cols?: number | 'auto';
    /** PageUp/PageDown step (rows for grid) */
    page?: number;
    /** a letter → the nearest item by text / aria-label, 500 ms buffer */
    typeahead?: boolean;
    /** horizontal inversion; 'auto' — by computed direction */
    dir?: 'ltr' | 'rtl' | 'auto';
    /** tab stop: 'selected' — [aria-selected/checked/current], 'first', an index */
    initial?: 'selected' | 'first' | number;
    /** aria-activedescendant mode (combobox): focus stays on this input, keys are listened to on it */
    virtual?: HTMLElement | null;
    /** MutationObserver: refresh when children change; a removed active item → focus the element with the same index */
    observe?: boolean;
    /** tree: ArrowRight expands (aria-expanded), ArrowLeft collapses or goes to the parent */
    tree?: boolean;
    onActivate?: (el: Element, index: number) => void;
}
export function roving(container: Element, opts?: RovingOptions): { dispose(): void; moveFocus(delta: number): void; refresh(): void; active: ReadonlySignal<number>; setActive(i: number): void };
/**
 * Screen-reader announcement: two permanent regions (polite → role=status, assertive → role=alert), a lossless queue,
 * dedup of identical text within 500 ms, auto-clear after 7 s. Returns clear(). announce.init() creates the regions in advance.
 */
export function announce(message: string, politeness?: 'polite' | 'assertive'): () => void;
export function announce(message: string, opts: { politeness?: 'polite' | 'assertive'; clearAfter?: number | false; dedupe?: number; native?: boolean }): () => void;
/** reactive form: a signal/function → the region (in the current scope); the initial value is not announced */
export function announce<T>(source: ReadonlySignal<T> | (() => T), opts?: { politeness?: 'polite' | 'assertive'; debounce?: number; format?: (v: T) => string | null | false; immediate?: boolean }): () => void;
export namespace announce { function init(): void; function clear(politeness?: 'polite' | 'assertive'): void; }
/** Reactive announcement of a signal/function with debounce: live(() => `${n.value} results`) */
export function live<T>(source: ReadonlySignal<T> | (() => T), opts?: { politeness?: 'polite' | 'assertive'; debounce?: number; format?: (v: T) => string | null | false; immediate?: boolean; clearAfter?: number | false }): () => void;
/** Busy without disabled: aria-busy + aria-disabled + data-busy, clicks/Enter are muted, focus stays on the element */
export function busy(el: Element, pending: ReadonlySignal<boolean> | (() => boolean)): () => void;

// ── CSS ────────────────────────────────────────────────────────

export function css(strings: TemplateStringsArray | string, ...values: unknown[]): CSSStyleSheet;
export function adoptStyles(root: Document | ShadowRoot, ...sheets: CSSStyleSheet[]): void;
/** Styles in a cascade layer: css.layer('components')`.card { … }` */
export namespace css { function layer(name: string): (strings: TemplateStringsArray | string, ...values: unknown[]) => CSSStyleSheet; }
/** Scoped styles without mutating id: the data-aegis-css attribute, one sheet per text (refcount), removed on scope dispose */
export function scopedStyle(el: Element, cssText: string): CSSStyleSheet;

// ── Custom Elements ────────────────────────────────────────────

export interface PropDefinition<T = unknown> {
    type?: typeof Number | typeof String | typeof Boolean | typeof Object | typeof Array;
    default?: T;
    reflect?: boolean;
    attribute?: string;
}

/** The value type of a prop from { type, default }: { type: Number } → number | null, { type: Number, default: 0 } → number */
export type PropValue<P> = P extends { type: BooleanConstructor } ? boolean
    : P extends { type: NumberConstructor } ? (P extends { default: number } ? number : number | null)
    : P extends { type: StringConstructor } ? (P extends { default: string } ? string : string | null)
    : P extends { type: ArrayConstructor } ? (P extends { default: infer D } ? D : unknown[] | null)
    : P extends { type: ObjectConstructor } ? (P extends { default: infer D } ? D : Record<string, unknown> | null)
    : P extends { type: (raw: string) => infer R } ? R
    : P extends { default: infer D } ? D : unknown;
export type PropSignals<P> = { [K in keyof P]: Signal<PropValue<P[K]>> };

export interface ElementDefinition<P extends Record<string, PropDefinition> = Record<string, PropDefinition>> {
    props?: P;
    shadow?: boolean;
    styles?: CSSStyleSheet | string;
    setup?: (el: HTMLElement, props: PropSignals<P>, ctx: {
        internals?: ElementInternals;
        shadow?: ShadowRoot;
        emit(name: string, detail?: unknown): boolean;
    }) => void | (() => DocumentFragment | Element) | Node;
    formAssociated?: boolean;
    extends?: string;
}

/** tagName must contain a hyphen (otherwise a DOMException at runtime — and a type error here) */
/** Low-level custom element from a definition object (props with reflection, shadow, formAssociated). `element(tag, Component, { props })` is the component form built on it. */
export function defineElement<P extends Record<string, PropDefinition>>(tagName: `${string}-${string}`, def: ElementDefinition<P>): typeof HTMLElement;

// ── Anchor Positioning ─────────────────────────────────────────

export function anchor(floating: Element, reference: Element, opts?: {
    placement?: 'top' | 'bottom' | 'left' | 'right';
    offset?: number;
    autoUpdate?: boolean;
}): () => void;

// ── Router ─────────────────────────────────────────────────────

export interface RouteInfo { path: string | null; params: Record<string, string>; query: Record<string, string>; search?: string }
export interface RouteContext<D = unknown> {
    /** loader result */
    data: D;
    params: Record<string, string>;
    query: Record<string, string>;
    /** the element for child routes (layout) */
    outlet: Element | null;
    signal: AbortSignal | undefined;
    route: RouteInfo;
    from: RouteInfo;
}
/** '/users/:id/posts/:postId' → { id: string; postId: string } */
export type RouteParams<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
    ? { [K in Name | keyof RouteParams<`/${Rest}`>]: string }
    : P extends `${string}:${infer Name}` ? { [K in Name]: string } : Record<string, string>;
export type RouteHandler<D = unknown, P extends string = string> = (params: RouteParams<P>, ctx: RouteContext<D>) => void | Promise<void>;
/** props of a route component: params + { data: the loader result, query } */
export type RouteComponentProps<P extends string = string, D = unknown> = RouteParams<P> & { data: D; query: Record<string, string> };
export interface RouteDef<D = unknown> {
    handler?: RouteHandler<D>;
    /** page component (the island()/mount() contract); mounted into router({ outlet }) or into the parent layout's outlet */
    component?: Component<RouteComponentProps<string, D>>;
    /** data before the old page is disposed; cancelled through signal on a new navigation */
    loader?: (params: Record<string, string>, ctx: { signal: AbortSignal | undefined; query: Record<string, string>; params: Record<string, string>; /** true — a warm-up before the navigation (hover / predict / r.preload): priority can be lowered */ speculative?: boolean }) => D | Promise<D>;
    /** true — go on; false — cancel (sync); a string — redirect; a Promise — wait */
    guard?: (to: RouteInfo, from: RouteInfo) => boolean | string | void | Promise<boolean | string | void>;
    redirect?: string | ((to: RouteInfo, from: RouteInfo) => string);
    /** lazy route: the module's default export = handler */
    load?: () => Promise<RouteHandler<D> | { default: RouteHandler<D> }>;
    /** data warm-up on hover/visible (router({ preload })) */
    preload?: (params: Record<string, string>) => void;
    /** the layout survives a change of the child route; receives a live outlet */
    layout?: (ctx: RouteContext<D>) => void | Promise<void>;
    children?: Record<string, RouteHandler | RouteDef>;
}
export interface RouterOptions {
    base?: string;
    root?: Element | Document;
    /** View Transitions between pages: true → types ['page', 'back'|'forward'] in data-vt-type on <html>; a function — your own types; false */
    transition?: boolean | ((info: { back: boolean }) => string[] | false);
    /** class of the active link (aria-current="page" is always set) */
    activeClass?: string;
    /** warm-up of the route's code and loader on intent: 'hover' (cursor slowdown or delay) | 'visible' | 'tap' | { on, delay: 80 | 'auto', velocity, rootMargin } */
    preload?: 'hover' | 'visible' | 'tap' | boolean | { on?: 'hover' | 'visible' | 'tap'; delay?: number | 'auto'; velocity?: number; rootMargin?: string };
    /** how many ms a warmed loader waits for the navigation (default 30000) */
    preloadTTL?: number;
    /** false — preload warms only the route code, not the loader */
    preloadData?: boolean;
    /** navigation predictor: learns after every route (pattern → pattern) and warms the page's top-K likely links in idle time (p ≥ minP, usefulness > 0) */
    predict?: boolean | { predictor?: Predictor; topK?: number; minP?: number };
    scroll?: 'after-transition' | 'manual';
    /** false / Promise<false> — cancel the navigation (a form with guard); a string — redirect */
    beforeEach?: (to: RouteInfo, from: RouteInfo) => void | boolean | string | Promise<void | boolean | string>;
    /** recreate the scope when only search changes (the old behaviour) */
    searchReload?: boolean;
    /** routes in location.hash ('#/users/42', links <a href="#/users/42">) — static hosting without rewrite rules */
    hash?: boolean;
    /** where to mount top-level { component } routes */
    outlet?: string | Element;
    /** focus after navigation: 'auto' — #fragment | [autofocus] | outlet/main/h1 with a temporary tabindex=-1; a selector | Element | a function | false */
    focus?: 'auto' | string | Element | ((root: Element | null) => Element | null) | false;
    /** announce the page title after navigation (dedup); a function — your own text */
    announce?: boolean | ((to: RouteInfo, from: RouteInfo | null) => string | null);
}
export interface SearchOptions<T> {
    parse?: (raw: string) => T;
    serialize?: (v: T) => string;
    default?: T;
    /** ?tag=a&tag=b → T[] */
    multi?: boolean;
    history?: 'replace' | 'push';
}
export interface Router {
    route: ReadonlySignal<string>;
    params: ReadonlySignal<Record<string, string>>;
    query: ReadonlySignal<Record<string, string>>;
    pending: ReadonlySignal<boolean>;
    error: ReadonlySignal<unknown>;
    state: ReadonlySignal<unknown>;
    transitioning: ReadonlySignal<boolean>;
    /** a search parameter as a two-way signal (URL = state); the route scope is not recreated */
    search<T = string>(name: string, opts?: SearchOptions<T>): Signal<T>;
    search<T = string>(name: string, opts: SearchOptions<T> & { multi: true }): Signal<T[]>;
    navigate(path: string, opts?: { replace?: boolean; state?: unknown }): Promise<unknown>;
    back(): void;
    forward(): void;
    /** per-entry state without navigation */
    setState(state: unknown): void;
    /** the first route has rendered */
    ready: Promise<unknown>;
    /** is there a route for the path (boost() yields to the router) */
    matches(path: string): boolean;
    /** warm a route (code + loader) before navigation within the network budget; p — the probability for the usefulness threshold */
    preload(path: string, p?: number): Promise<void>;
    cleanup(): void;
    dispose(): void;
}
/**
 * A router on top of the Navigation API (fallback: popstate + <a> interception).
 * Nested routes with layout, async handler/loader (native indicator, scroll after data, race cancellation),
 * guard/redirect as data, search parameters as signals, lazy routes through import().
 * Does not intercept: hash links, forms, download, data-aegis-reload, unmatched paths (they go to the server).
 */
export function router<R extends Record<string, unknown>>(routes: { [K in keyof R]: K extends string ? RouteHandler<any, K> | (RouteDef & { handler?: RouteHandler<any, K>; component?: Component<RouteComponentProps<K, any>> }) : never }, opts?: RouterOptions): Router;
/** The router's View Transition is in progress */
export const transitioning: ReadonlySignal<boolean>;

// ── Commands ───────────────────────────────────────────────────

export function command(root: Element, commands?: Record<string, (trigger: Element, target: Element | null) => void>): {
    dispose(): void;
    add(name: string, handler: (trigger: Element, target: Element | null) => void): void;
};

// ── Virtual Scroll ─────────────────────────────────────────────

export function virtualScroll<T>(parent: Element, items: T[] | Signal<T[]> | ReadonlySignal<T[]> | (() => T[]), opts: {
    /** 'cv' (default) — all rows in the DOM under content-visibility; 'window' — DOM recycling, only the visible rows + overscan in the DOM */
    mode?: 'cv' | 'window';
    overscan?: number;
    /** container height for mode 'window' */
    height?: number | string;
    itemHeight?: number;
    chunkSize?: number;
    /** row key ("id" by default); rows are keyed, with their own scope */
    key?: string | ((item: T, index: number) => string | number);
    renderItem: (item: T, index: number) => Element | DocumentFragment;
}): { container: HTMLElement; refresh(): void; dispose(): void; /** mode 'window' */ range?: ReadonlySignal<{ start: number; end: number; total: number }>; scrollToIndex?(i: number, opts?: { align?: 'start' | 'center' | 'end' }): void };

// ── Offline Resource ───────────────────────────────────────────


// ── Server HTML ────────────────────────────────────────────────

export type SwapMode = 'inner' | 'outer' | 'append' | 'prepend' | 'before' | 'after' | 'morph';
/**
 * Insert server HTML carefully: dispose islands in the replaced subtree, insert, hydrate new ones,
 * remove data-cloak, restore focus and caret. mode 'morph' — a targeted patch (id-aware), nodes are not recreated.
 * If the response is a whole page, the target's selector (or select) is taken from it.
 */
export function swap(target: Element, html: string | Response | Document | DocumentFragment | Element, opts?: {
    mode?: SwapMode;
    /** true — Sanitizer API (Element.setHTML) or a minimal clean-up of script/iframe/on*-attributes/javascript: with S012 in dev; an object — SanitizerConfig */
    sanitize?: boolean | object;
    select?: string;
    transition?: boolean | { name?: string; cls?: string };
    hydrate?: boolean;
}): Promise<{ inserted: Node[] }>;

/**
 * MPA navigation without a reload: fetch the page → morph root → View Transitions.
 * Islands outside root survive the navigation. Opt-out: data-no-boost; router() links are left alone (routers: [r]).
 */
export function boost(opts?: {
    root?: string | Element;
    mode?: SwapMode;
    transition?: boolean;
    prefetch?: 'hover' | 'visible' | 'tap' | boolean | { on?: 'hover' | 'visible' | 'tap'; delay?: number | 'auto'; velocity?: number; rootMargin?: string };
    /** predictor: learns from aegis:load (paths are normalised: numbers → :id), warms the HTML of the top-K likely pages in idle time */
    predict?: boolean | { predictor?: Predictor; topK?: number; minP?: number };
    scroll?: 'restore' | 'preserve';
    head?: 'title' | 'title+styles' | false;
    routers?: Router[];
    focus?: 'auto' | string | Element | false;
    announce?: boolean | ((to: { path: string }, from: null) => string | null);
}): { pending: ReadonlySignal<boolean>; visit(url: string): Promise<boolean>; /** warm a page's HTML within the network budget */ prefetch(url: string, p?: number): Promise<void>; dispose(): void };

export type SlotSpec = Reactive<Displayable> | {
    text?: Reactive<Displayable>;
    attr?: Record<string, Reactive<Displayable>>;
    cls?: ClassValue;
    style?: Record<string, Reactive<string | number | null>>;
    prop?: Record<string, Reactive<unknown>>;
    on?: Record<string, (e: Event) => void>;
};
/** A server <template> with [data-slot] slots as the markup source for list()/show(); no HTML parsing (CSP) */
export function tpl(target: string | HTMLTemplateElement, root?: Document | Element): (slots?: Record<string, SlotSpec>) => DocumentFragment;

/**
 * Bind an html`` template to DOM already rendered by the server without re-rendering (0 mutations):
 *   adopt(el)`<span class="value">${count}</span><button @click=${inc}>+</button>`
 * The element structure must match; text values are the only child of their element.
 */
export function adopt(root: Element, opts?: { trust?: boolean }): (strings: TemplateStringsArray, ...values: unknown[]) => Element;

/** JSON from <script type="application/json"> (Django json_script) — cached per element */
export function jsonScript<T = unknown>(target: string | Element, root?: Document | Element): T | undefined;

// ── i18n ───────────────────────────────────────────────────────

export type PluralForms = Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>>;
export interface I18nOptions {
    /** initial locale (default: <html lang> or 'en') */
    locale?: string;
    /** fallback locale for missing keys */
    fallback?: string;
    pluralOpts?: Intl.PluralRulesOptions;
    /** write t.locale into <html lang> */
    syncLang?: boolean;
}
/**
 * Translation function with reactive dictionary.
 */
export interface TranslationFunction<K extends string = string> {
    /** Translate a key, with optional param substitution ({name}) and plural by params.n / params.count */
    (key: K, params?: Record<string, string | number>): string;
    /** Replace entire dictionary (e.g. on locale switch) */
    load(newDict: Record<string, unknown>): void;
    /** Merge additional translations into the current dictionary */
    merge(extra: Record<string, unknown>): void;
    /** The reactive dictionary signal */
    dict: Signal<Record<string, unknown>>;
    /** reactive locale; a write switches the dictionary (lazy loading → t.loading) */
    locale: Signal<string>;
    loading: ReadonlySignal<boolean>;
    num(v: number | bigint, o?: Intl.NumberFormatOptions): string;
    date(v: Date | number, o?: Intl.DateTimeFormatOptions): string;
    rel(v: number, unit: Intl.RelativeTimeFormatUnit, o?: Intl.RelativeTimeFormatOptions): string;
    list(v: Iterable<string>, o?: Intl.ListFormatOptions): string;
    plural(n: number, forms: PluralForms): string;
}

/**
 * Create a translation function from a flat dictionary.
 * Returns a callable `t(key, params?)` with `.load()`, `.merge()`, `.dict`.
 *
 * @param dict — flat key→translation map (single language)
 */
/** Messages of the built-in validation rules: a dictionary by code or (code, params) => string; null — the default by <html lang> */
/** Rule messages: a dictionary (a string or plural forms { one, few, many, other }), a function (code, params) => string | null, or t from i18n() — keys <prefix><code>, the locale follows t.locale */
export function setValidationMessages(dict: Record<string, string | Record<string, string>> | ((code: string, params?: Record<string, unknown>) => string | null) | TranslationFunction<any> | null, prefix?: string): void;
export function maxSize(size: number | string, msg?: string): ValidationRule<any>;
export function mime(types: string | string[], msg?: string): ValidationRule<any>;
export function maxFiles(n: number, msg?: string): ValidationRule<any>;
/**
 * Translations: plural through Intl.PluralRules ({ one, few, many, other } by params.n/count), nested keys,
 * reactive locale t.locale with lazy loading (t.loading), Intl formatters t.num/t.date/t.rel/t.list.
 * i18n(flatDict) — a flat dictionary of one locale.
 */
export function i18n<D extends Record<string, string>>(dict: D, opts?: I18nOptions): TranslationFunction<keyof D & string>;
export function i18n(dicts?: Record<string, unknown>, opts?: I18nOptions): TranslationFunction;

// ── Helpers ────────────────────────────────────────────────────

export function $(selector: string, root?: Element | Document): Element | null;
export function $$(selector: string, root?: Element | Document): Element[];
export function uncloak(el?: Element): void;
export function injectStyles(): void;

// ── Version ────────────────────────────────────────────────────

export const VERSION: string;

// ── Default Export ─────────────────────────────────────────────

/**
 * Make Aegis global (window.Aegis) for inline scripts without import.
 * Not done automatically: a module-level global breaks tree-shaking.
 */
export function expose(target?: object): typeof Aegis;

declare const Aegis: {
    VERSION: string;
    signal: typeof signal;
    computed: typeof computed;
    effect: typeof effect;
    batch: typeof batch;
    untrack: typeof untrack;
    linked: typeof linked;
    persisted: typeof persisted;
    selector: typeof selector;
    until: typeof until;
    root: typeof root;
    provide: typeof provide;
    inject: typeof inject;
    createContext: typeof createContext;
    dev: typeof dev;
    onWarn: typeof onWarn;
    AegisWarning: typeof AegisWarning;
    reset: typeof reset;
    flushSync: typeof flushSync;
    cache: typeof cache;
    useClock: typeof useClock;
    flush: typeof flush;
    stats: typeof stats;
    when: typeof when;
    cssVars: typeof cssVars;
    prevent: typeof prevent;
    stop: typeof stop;
    self: typeof self;
    media: typeof media;
    reducedMotion: typeof reducedMotion;
    theme: typeof theme;
    getOwner: typeof getOwner;
    trace: typeof trace;
    island: typeof island;
    element: typeof element;
    runWithOwner: typeof runWithOwner;
    isSignal: typeof isSignal;
    reactive: typeof reactive;
    isReactive: typeof isReactive;
    createScope: typeof createScope;
    onDispose: typeof onDispose;
    html: typeof html;
    render: typeof render;
    show: typeof show;
    list: typeof list;
    bind: typeof bind;
    text: typeof text;
    attr: typeof attr;
    cls: typeof cls;
    style: typeof style;
    styleMap: typeof styleMap;
    ref: typeof ref;
    attach: typeof attach;
    clone: typeof clone;
    expose: typeof expose;
    on: typeof on;
    delegate: typeof delegate;
    interval: typeof interval;
    timeout: typeof timeout;
    observe: typeof observe;
    resize: typeof resize;
    mutate: typeof mutate;
    nextTick: typeof nextTick;
    guardedFetch: typeof guardedFetch;
    configure: typeof configure;
    request: typeof request;
    api: typeof api;
    HttpError: typeof HttpError;
    defaults: typeof defaults;
    withRetry: typeof withRetry;
    mutation: typeof mutation;
    streamResource: typeof streamResource;
    sse: typeof sse;
    settled: typeof settled;
    prefetch: typeof prefetch;
    prefetchOn: typeof prefetchOn;
    infiniteResource: typeof infiniteResource;
    debounced: typeof debounced;
    throttled: typeof throttled;
    poll: typeof poll;
    resource: typeof resource;
    watch: typeof watch;
    seed: typeof seed;
    seedFrom: typeof seedFrom;
    invalidate: typeof invalidate;
    form: typeof form;
    required: typeof required;
    minLen: typeof minLen;
    maxLen: typeof maxLen;
    pattern: typeof pattern;
    emailRule: typeof emailRule;
    matches: typeof matches;
    wireForm: typeof wireForm;
    mount: typeof mount;
    register: typeof register;
    hydrate: typeof hydrate;
    destroy: typeof destroy;
    destroyAll: typeof destroyAll;
    errorBoundary: typeof errorBoundary;
    portal: typeof portal;
    transition: typeof transition;
    lazy: typeof lazy;
    spring: typeof spring;
    flip: typeof flip;
    animate: typeof animate;
    trap: typeof trap;
    modal: typeof modal;
    scaffold: typeof scaffold;
    from: typeof from;
    history: typeof history;
    size: typeof size;
    inView: typeof inView;
    viewport: typeof viewport;
    springSignal: typeof springSignal;
    tween: typeof tween;
    setValidationMessages: typeof setValidationMessages;
    maxSize: typeof maxSize;
    mime: typeof mime;
    maxFiles: typeof maxFiles;
    roving: typeof roving;
    announce: typeof announce;
    css: typeof css;
    adoptStyles: typeof adoptStyles;
    scopedStyle: typeof scopedStyle;
    defineElement: typeof defineElement;
    anchor: typeof anchor;
    router: typeof router;
    command: typeof command;
    virtualScroll: typeof virtualScroll;
    swap: typeof swap;
    boost: typeof boost;
    tpl: typeof tpl;
    adopt: typeof adopt;
    jsonScript: typeof jsonScript;
    transitioning: typeof transitioning;
    email: typeof email;
    min: typeof min;
    max: typeof max;
    i18n: typeof i18n;
    $: typeof $;
    $$: typeof $$;
    uncloak: typeof uncloak;
    injectStyles: typeof injectStyles;
};

export default Aegis;
