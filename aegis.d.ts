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
 */

// ── Reactive Core ──────────────────────────────────────────────

export interface Signal<T> {
    value: T;
    peek(): T;
    subscribe(fn: (value: T) => void): () => void;
    readonly _type: typeof SIGNAL;
}

export interface ReadonlySignal<T> {
    readonly value: T;
    peek(): T;
    subscribe(fn: (value: T) => void): () => void;
}

declare const SIGNAL: unique symbol;

export interface SignalOptions<T> {
    name?: string;
    equals?: false | ((a: T, b: T) => boolean);
}

export function signal<T>(initial: T, nameOrOpts?: string | SignalOptions<T>): Signal<T>;
export function computed<T>(fn: () => T, nameOrOpts?: string | SignalOptions<T>): ReadonlySignal<T>;
export function effect(fn: () => void | (() => void), name?: string): () => void;
export function batch<T>(fn: () => T): T;
/** Выполнить fn без подписки на прочитанные сигналы */
export function untrack<T>(fn: () => T): T;
export function isSignal(v: unknown): v is Signal<unknown>;

// ── Reactive Object ────────────────────────────────────────────

export function reactive<T extends object>(obj: T): T;
export function isReactive(v: unknown): boolean;

// ── Scope ──────────────────────────────────────────────────────

export interface Scope {
    run<T>(fn: () => T): T;
    /** Возвращает unregister — снять cleanup досрочно */
    onDispose(fn: () => void): () => void;
    dispose(): void;
}

export function createScope(name?: string): Scope;
/** Текущий scope-владелец (null вне scope). Для кода после await: runWithOwner(getOwner(), () => …) */
export function getOwner(): Scope | null;
export function runWithOwner<T>(scope: Scope | null, fn: () => T): T;
export function onDispose(fn: () => void): () => void;

// ── DOM Rendering ──────────────────────────────────────────────

export function html(strings: TemplateStringsArray, ...values: unknown[]): DocumentFragment;
export function render(target: Element, content: DocumentFragment | Element): void;

export function text(el: Element, valueOrFn: string | Signal<string> | (() => string)): () => void;
export function attr(el: Element, name: string, valueOrFn: unknown | Signal<unknown> | (() => unknown)): () => void;

/**
 * Toggle a single CSS class reactively.
 * @param el — target element
 * @param name — class name
 * @param fn — boolean signal, function, or static value
 */
export function cls(el: Element, name: string, fn: boolean | Signal<boolean> | (() => boolean)): () => void;

/**
 * Bind a single CSS property reactively.
 * @param el — target element
 * @param prop — CSS property name (camelCase)
 * @param fn — string signal, function, or static value
 */
export function style(el: Element, prop: string, fn: string | Signal<string> | (() => string)): () => void;

/**
 * Toggle multiple CSS classes via a map { className: signal/fn/bool }.
 * @returns cleanup function that disposes all class effects
 */
export function clsMap(el: Element, classMap: Record<string, boolean | Signal<boolean> | (() => boolean)>): () => void;

/**
 * Bind multiple CSS properties via a map { prop: signal/fn/string }.
 * @returns cleanup function that disposes all style effects
 */
export function styleMap(el: Element, styles: Record<string, string | Signal<string> | (() => string)>): () => void;

/**
 * Two-way bind an input's value to a signal.
 * Handles checkbox/radio (checked), number, select.
 * @returns cleanup function
 */
export function bind(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, sig: Signal<any>): () => void;

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
export interface ShowOptions {
    /** Ветки создаются один раз и прячутся через display:none (аналог v-show): DOM и состояние сохраняются */
    keep?: boolean;
}
export function show(
    condition: Signal<boolean> | (() => boolean) | boolean,
    trueBranch: (() => DocumentFragment | Element) | DocumentFragment | Element,
    falseBranch?: (() => DocumentFragment | Element) | DocumentFragment | Element | null,
    opts?: ShowOptions
): Comment;

/** Ленивый индекс строки list(): сигнал создаётся при первом чтении .value */
export interface RowIndex {
    readonly value: number;
    peek(): number;
    subscribe(fn: (i: number) => void): () => void;
}

export interface ListOptions {
    enter?: (el: Element) => void;
    exit?: (el: Element) => Promise<void> | void;
}
export function list<T>(
    items: Signal<T[]> | ReadonlySignal<T[]> | (() => T[]) | T[],
    /** index — сигнал: актуален после сортировки/удаления. Строка перерисовывается, если объект под ключом заменён */
    /** renderFn может вернуть один узел, фрагмент из нескольких (<tr>+<tr>, <dt>+<dd>) или массив — обёрток нет */
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

/** Маркер attach() для html``: <canvas ${attach(el => …)}> */
export interface Attachment<E extends Element = Element> {
    readonly fn: (el: E) => void | (() => void);
    readonly opts: AttachOptions;
}
export interface AttachOptions {
    /** только init + cleanup, без реактивного перезапуска (карты, редакторы) */
    once?: boolean;
}
/**
 * Поведение на элементе после монтирования: init + cleanup + реактивность одной функцией.
 * fn выполняется как effect: перезапуск при изменении прочитанных сигналов, cleanup перед перезапуском и при dispose.
 */
export function attach<E extends Element = Element>(fn: (el: E) => void | (() => void), opts?: AttachOptions): Attachment<E>;
export function attach<E extends Element>(el: E, fn: (el: E) => void | (() => void), opts?: AttachOptions): () => void;

/**
 * Живая копия фрагмента из html``: привязки создаются заново в текущем scope.
 * Фрагмент с готовыми узлами (list()/show()-якоря) не воспроизводим — cloneNode + dev warning E013.
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
export function guardedFetch(scope?: Scope): (url: string, opts?: RequestInit) => Promise<any>;

export function debounced<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel(): void };
export function throttled<T extends (...args: any[]) => any>(fn: T, ms: number): T;
export function poll(fn: () => Promise<void> | void, ms: number): () => void;

// ── Data ───────────────────────────────────────────────────────

export interface ResourceResult<T> {
    data: Signal<T | null>;
    loading: Signal<boolean>;
    error: Signal<Error | null>;
    refresh(): Promise<void> | void;
    /** Optimistic update: set data immediately */
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
    /** Abort inflight request */
    abort(): void;
}

export function resource<T = unknown>(source: string | (() => string), opts?: {
    initial?: T;
    transform?: (data: unknown) => T;
    fetcher?: (url: string, opts?: any) => Promise<unknown>;
    immediate?: boolean;
}): ResourceResult<T>;

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
    callback: (newVal: T, oldVal: T | undefined) => void,
    opts?: { immediate?: boolean; debounce?: number }
): () => void;

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
export function store<T extends object>(definition: T): T & {
    readonly $signals: Record<string, Signal<unknown>>;
    $reset(): void;
};

// ── Cached Resource (SWR) ──────────────────────────────────────

export interface CachedResourceResult<T> {
    data: Signal<T | null>;
    loading: Signal<boolean>;
    validating: Signal<boolean>;
    error: Signal<Error | null>;
    refresh(): Promise<void> | void;
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
}

export function cachedResource<T = unknown>(source: string | (() => string), opts?: {
    key?: string;
    initial?: T;
    transform?: (data: unknown) => T;
    fetcher?: (url: string, opts?: any) => Promise<unknown>;
    immediate?: boolean;
    staleTime?: number;
    cacheTime?: number;
}): CachedResourceResult<T>;

export function invalidate(keyOrPredicate: string | ((key: string) => boolean)): void;

/** Положить данные в кэш cachedResource() вручную (ответ мутации, серверный payload). age — возраст данных в мс */
export function seed<T = unknown>(key: string, data: T, opts?: { age?: number }): void;
/**
 * Засеять кэш из серверного HTML:
 *   <script type="application/json" data-aegis-cache="/api/users" data-aegis-age="120">[…]</script>
 * Идемпотентна; hydrate() вызывает её сама. Возвращает число засеянных записей.
 */
export function seedFrom(root?: Document | Element): number;

// ── Form ───────────────────────────────────────────────────────

export type ValidationRule = (value: unknown, key: string, fields: Record<string, Signal<unknown>>) => string | null;

export interface FormResult<T extends Record<string, { value: any; rules?: ValidationRule[] }>> {
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

export function form<T extends Record<string, { value: any; rules?: ValidationRule[] }>>(schema: T): FormResult<T>;

export const required: ValidationRule;
export function minLen(n: number): ValidationRule;
export function maxLen(n: number): ValidationRule;
export function pattern(re: RegExp, msg?: string): ValidationRule;
export const emailRule: ValidationRule;
export function matches(otherKey: string, msg?: string): ValidationRule;

// ── WireForm ───────────────────────────────────────────────────

export interface WireFormResult {
    fields: Record<string, Signal<unknown>>;
    errors: Record<string, Signal<string | null>>;
    touched: Record<string, Signal<boolean>>;
    dirty: ReadonlySignal<boolean>;
    valid: ReadonlySignal<boolean>;
    validate(): boolean;
    reset(): void;
    setErrors(errors: Record<string, string | string[]>): void;
    submit(handler: (values: Record<string, unknown>) => Promise<void> | void): (e?: Event) => Promise<void>;
    step: Signal<number> | null;
    stepCount: number | null;
    next: (() => boolean) | null;
    prev: (() => void) | null;
}

export function wireForm(formEl: HTMLFormElement, opts?: {
    schema?: Record<string, ValidationRule[]>;
    mode?: 'blur-then-live' | 'live' | 'submit';
}): WireFormResult;

// ── Component ──────────────────────────────────────────────────

/**
 * Rich context passed to component setup functions.
 * All DOM helpers are pre-bound to the component's scope.
 */
export interface ComponentContext<E extends Element = HTMLElement> {
    el: E;
    /**
     * Серверные дети компонента (снимок до setup). Без селектора — все оставшиеся,
     * с селектором ('[slot=footer]') — только совпадающие. Узлы переносятся, не копируются.
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
    clsMap: typeof clsMap;
    styleMap: typeof styleMap;
    html: typeof html;
    show: typeof show;
    list: typeof list;
    interval: typeof interval;
    timeout: typeof timeout;
    observe: typeof observe;
    resize: typeof resize;
    mutate: typeof mutate;
    /** Pre-bound guardedFetch — already tied to this component's scope */
    guardedFetch: (url: string, opts?: RequestInit) => Promise<any>;
    debounced: typeof debounced;
    throttled: typeof throttled;
    poll: typeof poll;
    /** Возвращает unregister — снять cleanup досрочно */
    onDispose(fn: () => void): () => void;
}

/** Результат component(): если setup вернул шаблон (Node) — он вставлен в el, наружу отдаётся { el, destroy } */
export type ComponentResult<R> = R extends Node ? { el: Element; destroy(): void } : R;

export function component<E extends Element = HTMLElement, R = void>(
    el: E,
    setup: (ctx: ComponentContext<E>) => R
): ComponentResult<R>;

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

/** D — форма data-* атрибутов элемента (JSON-значения парсятся); каст непроверяемый, как defineProps<T>() */
export function register<D = Record<string, unknown>>(
    name: string,
    setup: (el: HTMLElement, data: D, ctx: ComponentContext<HTMLElement>) => void | object | Node
): void;
export interface HydrateOptions {
    /** MutationObserver: вставленные острова оживают, удалённые уничтожаются (htmx/Turbo/jQuery) */
    watch?: boolean;
    /** перемонтировать уже живые */
    force?: boolean;
    /** переопределить data-aegis-load для всех (тесты: 'eager') */
    load?: 'eager' | 'visible' | 'idle' | 'interaction' | string;
    /** без предупреждений о незарегистрированных компонентах */
    quiet?: boolean;
    /** мс синхронной работы до scheduler.yield(); Infinity — всё синхронно. Default 8 */
    budget?: number;
    /** дедлайн для idle-островов, мс. Default 2000 */
    idleTimeout?: number;
}
export interface HydrateHandle {
    el: HTMLElement;
    name: string;
    /** undefined, пока остров ждёт своей стратегии загрузки */
    api: unknown;
    ready: Promise<unknown>;
}
/**
 * Оживить серверный HTML: [data-aegis] (включая сам root). Идемпотентна.
 * Сначала засевает кэш из <script type="application/json" data-aegis-cache>.
 * События: aegis:hydrate (cancelable), aegis:hydrated (detail: { name, api }), aegis:destroy.
 * Первый кусок монтируется синхронно; handles.ready — Promise завершения eager-части.
 */
export function hydrate(root?: Document | Element, opts?: HydrateOptions): HydrateHandle[] & { ready: Promise<void> };
export namespace hydrate {
    /** Авто-hydrate(document) после register(). Default true */
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
    contentFn: (() => DocumentFragment | Element) | DocumentFragment | Element
): { container: HTMLDivElement; dispose(): void };

/**
 * CSS enter/leave transition driven by a reactive condition.
 * Applies CSS classes on enter/leave and auto-hides via `el.hidden`.
 *
 * @param el — target element
 * @param condition — signal, function, or boolean controlling visibility
 * @param opts — CSS class names and optional duration
 * @returns effect disposer
 */
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
export function flip(nodes: ArrayLike<Element>, opts?: { stiffness?: number; damping?: number }): () => void;
export function animate(target: Element, mutate: () => void, opts?: { name?: string; cls?: string }): Promise<void>;

// ── Accessibility ──────────────────────────────────────────────

export function trap(container: Element, opts?: { autoFocus?: boolean }): () => void;
export function roving(container: Element, opts?: {
    selector?: string;
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    onActivate?: (el: Element, index: number) => void;
}): { dispose(): void; moveFocus(delta: number): void; refresh(): void };
export function announce(message: string, politeness?: 'polite' | 'assertive'): void;

// ── CSS ────────────────────────────────────────────────────────

export function css(strings: TemplateStringsArray | string, ...values: unknown[]): CSSStyleSheet;
export function adoptStyles(root: Document | ShadowRoot, ...sheets: CSSStyleSheet[]): void;
export function scopedStyle(el: Element, cssText: string): CSSStyleSheet;

// ── Custom Elements ────────────────────────────────────────────

export interface PropDefinition<T = unknown> {
    type?: typeof Number | typeof String | typeof Boolean | typeof Object | typeof Array;
    default?: T;
    reflect?: boolean;
    attribute?: string;
}

export interface ElementDefinition {
    props?: Record<string, PropDefinition>;
    shadow?: boolean;
    styles?: CSSStyleSheet | string;
    setup?: (el: HTMLElement, props: Record<string, Signal<unknown>>, ctx: {
        internals?: ElementInternals;
        shadow?: ShadowRoot;
    }) => void | (() => DocumentFragment | Element);
    formAssociated?: boolean;
    extends?: string;
}

export function defineElement(tagName: string, def: ElementDefinition): typeof HTMLElement;

// ── Anchor Positioning ─────────────────────────────────────────

export function anchor(floating: Element, reference: Element, opts?: {
    placement?: 'top' | 'bottom' | 'left' | 'right';
    offset?: number;
    autoUpdate?: boolean;
}): () => void;

// ── Router ─────────────────────────────────────────────────────

export interface RouterResult {
    route: Signal<string>;
    params: Signal<Record<string, string>>;
    query: Signal<Record<string, string>>;
    navigate(path: string, opts?: { replace?: boolean }): void;
    back(): void;
    forward(): void;
    cleanup(): void;
}

export function router(routes: Record<string, (params: Record<string, string>, search?: string) => void>, opts?: {
    base?: string;
    root?: Element;
}): RouterResult;

// ── Commands ───────────────────────────────────────────────────

export function command(root: Element, commands?: Record<string, (trigger: Element, target: Element | null) => void>): {
    dispose(): void;
    add(name: string, handler: (trigger: Element, target: Element | null) => void): void;
};

// ── Virtual Scroll ─────────────────────────────────────────────

export function virtualScroll<T>(parent: Element, items: T[] | Signal<T[]> | ReadonlySignal<T[]> | (() => T[]), opts: {
    itemHeight?: number;
    chunkSize?: number;
    /** ключ строки (по умолчанию "id"); строки keyed, со своим scope */
    key?: string | ((item: T, index: number) => string | number);
    renderItem: (item: T, index: number) => Element | DocumentFragment;
}): { container: HTMLElement; refresh(): void; dispose(): void };

// ── Offline Resource ───────────────────────────────────────────

export interface OfflineResourceResult<T> {
    data: Signal<T | null>;
    loading: Signal<boolean>;
    error: Signal<Error | null>;
    online: Signal<boolean>;
    syncing: Signal<boolean>;
    refresh(): Promise<void>;
    mutate(method: string, url: string, body: unknown, optimistic?: (current: T) => T): Promise<void>;
    dispose(): void;
}

export function offlineResource<T = unknown>(source: string | (() => string), opts?: {
    dbName?: string;
    storeName?: string;
    staleTime?: number;
    transform?: (data: unknown) => T;
    fetcher?: (url: string, opts?: any) => Promise<unknown>;
    syncTag?: string;
}): OfflineResourceResult<T>;

// ── i18n ───────────────────────────────────────────────────────

/**
 * Translation function with reactive dictionary.
 */
export interface TranslationFunction {
    /** Translate a key, with optional param substitution */
    (key: string, params?: Record<string, string>): string;
    /** Replace entire dictionary (e.g. on locale switch) */
    load(newDict: Record<string, string>): void;
    /** Merge additional translations into the current dictionary */
    merge(extra: Record<string, string>): void;
    /** The reactive dictionary signal */
    dict: Signal<Record<string, string>>;
}

/**
 * Create a translation function from a flat dictionary.
 * Returns a callable `t(key, params?)` with `.load()`, `.merge()`, `.dict`.
 *
 * @param dict — flat key→translation map (single language)
 */
export function i18n(dict?: Record<string, string>): TranslationFunction;

// ── Helpers ────────────────────────────────────────────────────

export function $(selector: string, root?: Element | Document): Element | null;
export function $$(selector: string, root?: Element | Document): Element[];
export function uncloak(el?: Element): void;
export function injectStyles(): void;

// ── Version ────────────────────────────────────────────────────

export const VERSION: string;

// ── Default Export ─────────────────────────────────────────────

/**
 * Сделать Aegis глобальным (window.Aegis) для inline-скриптов без import.
 * Не делается автоматически: модуль-левел глобал ломает tree-shaking.
 */
export function expose(target?: object): typeof Aegis;

declare const Aegis: {
    VERSION: string;
    signal: typeof signal;
    computed: typeof computed;
    effect: typeof effect;
    batch: typeof batch;
    untrack: typeof untrack;
    getOwner: typeof getOwner;
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
    clsMap: typeof clsMap;
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
    debounced: typeof debounced;
    throttled: typeof throttled;
    poll: typeof poll;
    resource: typeof resource;
    watch: typeof watch;
    store: typeof store;
    cachedResource: typeof cachedResource;
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
    component: typeof component;
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
    offlineResource: typeof offlineResource;
    i18n: typeof i18n;
    $: typeof $;
    $$: typeof $$;
    uncloak: typeof uncloak;
    injectStyles: typeof injectStyles;
};

export default Aegis;
