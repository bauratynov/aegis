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

declare const SIGNAL: unique symbol;

export interface ReadonlySignal<T> {
    readonly value: T;
    /** прочитать без подписки */
    peek(): T;
    /** ручная подписка: fn(value) при каждом реальном изменении; возвращает unsubscribe */
    subscribe(fn: (value: T) => void): () => void;
    /** бренд: только сигналы Aegis (не любой { value }) */
    readonly [SIGNAL]: true;
}
export interface Signal<T> extends ReadonlySignal<T> {
    value: T;
    /** sig.update(v => v + 1) */
    update(fn: (prev: T) => T): void;
}
/** computed(): read-only сигнал с ручным dispose (обычно не нужен — умирает со scope) */
export interface Computed<T> extends ReadonlySignal<T> {
    dispose(): void;
}

export interface SignalOptions<T> {
    name?: string;
    equals?: false | ((a: T, b: T) => boolean);
}
export interface ComputedOptions<T> extends SignalOptions<T> {
    /** computed((prev) => …, { initial }) — предыдущее значение первым аргументом */
    initial?: T;
}

/** Значение, сигнал или геттер — всё, что принимают реактивные хелперы */
export type Reactive<T> = T | Signal<T> | ReadonlySignal<T> | (() => T);
export type Displayable = string | number | boolean | null | undefined;
/** class: строка | массив | { name: reactive truthy } (clsx-семантика) */
export type ClassValue = string | null | undefined | false | ClassValue[] | Record<string, Reactive<unknown>>;

export function signal<T>(initial: T, nameOrOpts?: string | SignalOptions<T>): Signal<T>;
export function computed<T>(fn: (prev: T) => T, nameOrOpts?: string | ComputedOptions<T>): Computed<T>;
export interface EffectOptions {
    name?: string;
    /** печатать причину каждого перезапуска (dev) */
    trace?: boolean;
    /** 'sync' (default) — синхронно; 'micro' — один запуск за микротаск; 'frame' — один запуск за кадр */
    flush?: 'sync' | 'micro' | 'frame';
}
export function effect(fn: () => void | (() => void), nameOrOpts?: string | EffectOptions): () => void;
/** Отладка: печатать стек каждой записи в сигнал. trace(sig, false) — выключить */
export function trace<T extends Signal<any>>(sig: T, on?: boolean): T;
export function batch<T>(fn: () => T): T;

// ── Dev & testing ──────────────────────────────────────────────

export interface WarningInfo { code: string; what: string; why: string; fix: string }
/** Предупреждение движка как исключение (window.__AEGIS_DEV__ = 'strict') */
export class AegisWarning extends Error { code: string; what: string; why: string; fix: string }
/** Подписка на предупреждения (dev-режим): warnings-as-assertions в тестах. Возвращает unsubscribe */
export function onWarn(fn: (w: WarningInfo) => void): () => void;
/** Управление dev-режимом: dev.enable() (localStorage + reload на проде), dev.disable(), dev.resetWarnings() */
export interface ScopeInspection { scope: string | null; el: Element | null; signals: Array<{ name: string; value: string }>; effects: Array<{ name: string; deps: string[]; scope: string | null }>; children: number }
export const dev: {
    readonly on: boolean;
    enable(): void;
    disable(): void;
    resetWarnings(): void;
    /** performance.measure / console.timeStamp на каждый flush в треке «Aegis» Performance-панели */
    profile(on?: boolean): void;
    /** Реактивный мир острова по DOM-узлу: Aegis.dev.of($0) */
    of(el: Element): ScopeInspection | null;
    /** JSON-снимок компонентов (или одного scope) — для чата с ассистентом */
    inspect(root?: Document | Element | Scope): ScopeInspection[] | ScopeInspection;
    /** Граф зависимостей как Mermaid */
    graph(root?: Scope): string;
};
/** Сбросить модульные синглтоны между тестами (компоненты, реестр, кэш ресурсов, live-region) */
export function reset(opts?: { components?: boolean; cache?: boolean; registry?: boolean; dom?: boolean }): void;
/** Синхронно выполнить отложенные рендеры show()/list() и очередь эффектов */
export function flushSync(): void;
/** Синхронно выполнить отложенные полосы micro/frame и очередь эффектов */
export function flush(): void;
/** Счётчики движка: flushes, effectRuns, maxRounds, slow (top-20 по мс при dev.profile), scopes, effects, components, кэши */
export function stats(): { flushes: number; effectRuns: number; maxRounds: number; slow: Array<{ name: string; ms: number }>; scopes: number; effects: number; components: number; resourceCache: number; cssCache: number; queued: number };
/** Корневой scope для тестов: const [api, dispose] = root(dispose => …) */
export function root<T>(fn: (dispose: () => void) => T): [T, () => void];
/** Дождаться сигнала: resolve при первом значении, для которого predicate истинен; reject TimeoutError / при dispose scope */
export function until<T>(source: Reactive<T>, predicate?: (v: T) => boolean, opts?: { timeout?: number }): Promise<T> & { toBe(v: T): Promise<T>; changed(): Promise<T> };

// ── Context ────────────────────────────────────────────────────

export interface Context<T> { readonly id: symbol; readonly default: T }
export function createContext<T>(defaultValue?: T): Context<T>;
/** Положить значение в контекст текущего scope (вне scope — глобально) */
export function provide<T>(key: Context<T> | string, value: T): void;
/** Достать из контекста: scope-цепочка → DOM-предки (между островами) → глобальный. Вызывать синхронно в setup */
export function inject<T>(key: Context<T>): T;
export function inject<T>(key: Context<T> | string, fallback: T): T;
export function inject(key: string): unknown;

// ── State helpers ──────────────────────────────────────────────

/** Сигнал в localStorage/sessionStorage с синхронизацией между вкладками */
export function persisted<T>(key: string, initial: T, opts?: {
    storage?: Storage | null;
    serialize?: (v: T) => string;
    deserialize?: (s: string) => T;
    sync?: boolean;
    debounce?: number;
}): Signal<T> & { clear(): void };
/** Writable derived: запись живёт до следующего изменения источника */
export function linked<T>(source: () => T, name?: string): Signal<T>;
export function linked<S, T>(opts: { source: () => S; compute: (source: S, prev: { source: S; value: T } | undefined) => T }, name?: string): Signal<T>;
/** Внешний источник как сигнал: (EventTarget, event, map) | (producer(set) => unsubscribe, initial) | { subscribe } */
export function from<T, E extends EventTarget = EventTarget>(target: E, event: string, map?: (target: E) => T): ReadonlySignal<T>;
export function from<T>(producer: (set: (v: T) => void) => (() => void) | void, initial?: T): ReadonlySignal<T>;
export function from<T>(subscribable: { subscribe(fn: (v: T) => void): (() => void) | { unsubscribe(): void }; value?: T; peek?(): T }): ReadonlySignal<T>;
/** Undo/redo для сигнала, reactive() или store() */
export function history<T>(source: Signal<T> | object, opts?: { limit?: number; debounce?: number }): {
    undo(): void; redo(): void; canUndo: ReadonlySignal<boolean>; canRedo: ReadonlySignal<boolean>;
    pause(): void; resume(): void; commit(): void; clear(): void;
    past: ReadonlySignal<unknown[]>; future: ReadonlySignal<unknown[]>;
};
/** O(2) обновлений вместо N для «выбранной строки»: const isSelected = selector(selectedId) */
export function selector<K, S = K>(source: Signal<S> | ReadonlySignal<S> | (() => S), equals?: (source: S, key: K) => boolean): (key: K) => boolean;
/** Выполнить fn без подписки на прочитанные сигналы */
export function untrack<T>(fn: () => T): T;
export function isSignal(v: unknown): v is Signal<unknown>;

// ── Reactive Object ────────────────────────────────────────────

export interface ReactiveExtras<T> {
    readonly $signals: Record<string, Signal<unknown>>;
    readonly $raw: T;
    $snapshot(): T;
    $patch(patch: Partial<T>): void;
    /** effect над глубоким снимком */
    $subscribe(fn: (snapshot: T) => void): () => void;
    $reset(): void;
}
/**
 * Глубоко-реактивный объект: поля → сигналы, геттеры → computed, методы → batched actions;
 * массивы и plain-объекты реактивны глубоко, Date/Map/File/DOM — как есть. { shallow: true } = store()
 */
export function reactive<T extends object>(obj: T, opts?: { shallow?: boolean }): T & ReactiveExtras<T>;
export function isReactive(v: unknown): boolean;

// ── Scope ──────────────────────────────────────────────────────

export interface Scope {
    readonly name: string | null;
    /** элемент компонента (inject() по DOM-предкам) */
    el: Element | null;
    run<T>(fn: () => T): T;
    /** using scope = createScope() */
    [Symbol.dispose]?(): void;
    /** Возвращает unregister — снять cleanup досрочно */
    onDispose(fn: () => void): () => void;
    /** Обработчик ошибок эффектов этого scope и вложенных; ошибки несут e.aegis = { effect, scope, changed } */
    onError(fn: (error: any) => void): () => void;
    dispose(): void;
}

/** name — для сообщений об ошибках (component:div#app, list:row) */
export function createScope(name?: string): Scope;
/** Текущий scope-владелец (null вне scope). Для кода после await: runWithOwner(getOwner(), () => …) */
export function getOwner(): Scope | null;
export function runWithOwner<T>(scope: Scope | null, fn: () => T): T;
export function onDispose(fn: () => void): () => void;

// ── DOM Rendering ──────────────────────────────────────────────

/** Что можно вставить в html``: текст, узел, сигнал, функция (реактивно), ref/attach, class/style-объект, массив. Promise/Date — нет (${String(date)}, when()/resource()) */
export type HtmlValue = Displayable | Node | ReadonlySignal<any> | ((...args: any[]) => unknown) | Ref<any> | Attachment<any> | ClassValue | Record<string, Reactive<unknown>> | HtmlValue[];
export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): DocumentFragment;
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
/** cls(el, { active: sig, done: () => … }) / cls(el, ['btn', size]) — diff только своих классов */
export function cls(el: Element, classes: ClassValue): () => void;

/**
 * Bind a single CSS property reactively.
 * @param el — target element
 * @param prop — CSS property name (camelCase)
 * @param fn — string signal, function, or static value
 */
/** --custom-property идёт через setProperty; число — только для unitless-свойств */
export function style(el: HTMLElement | SVGElement, prop: string, value: Reactive<string | number | null>): () => void;
/** CSS custom properties из сигналов: cssVars(el, { x, progress }) → --x, --progress */
export function cssVars(el: HTMLElement | SVGElement, vars: Record<string, Reactive<string | number | null>>): () => void;

/**
 * Toggle multiple CSS classes via a map { className: signal/fn/bool }.
 * @returns cleanup function that disposes all class effects
 */
export function clsMap(el: Element, map: Record<string, Reactive<unknown>>): () => void;

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
/** Три состояния ресурса в html``: ${when(users, { loading, error, data })} */
export function when<T>(res: { data: { value: T | null; peek(): T | null }; loading?: { value: boolean }; error?: { value: unknown; peek(): unknown }; refresh?: () => unknown }, branches: {
    loading?: () => Node | Node[] | string;
    error?: (error: any, retry: () => void) => Node | Node[] | string;
    /** data(value, signal) — второй аргумент для реактивных list()/text() внутри ветки */
    data?: (data: T, signal: ReadonlySignal<T | null>) => Node | Node[] | string;
    empty?: () => Node | Node[] | string;
}): Comment;

/** Обёртки событий в стиле Svelte 5: @submit=${prevent(save)} (в html`` также @submit.prevent, .stop, .self, .once, .passive, .capture, .outside, .window, .document, .enter/.esc/…, .ctrl/.meta/.shift/.alt, .debounce.N, .throttle.N) */
export function prevent<E extends Event>(fn: (e: E) => void): (e: E) => void;
export function stop<E extends Event>(fn: (e: E) => void): (e: E) => void;
export function self<E extends Event>(fn: (e: E) => void): (e: E) => void;

/** matchMedia как сигнал (один на запрос) */
export function media(query: string): ReadonlySignal<boolean>;
/** prefers-reduced-motion как сигнал; запись перекрывает системную настройку */
export const reducedMotion: Signal<boolean>;
/** Тема: mode 'light' | 'dark' | 'system' в localStorage + атрибут на <html> + color-scheme */
export function theme(opts?: { attr?: string; storage?: string }): { mode: Signal<'light' | 'dark' | 'system'>; dark: ReadonlySignal<boolean> };

export interface ShowOptions {
    /** Ветки создаются один раз и прячутся через display:none (аналог v-show): DOM и состояние сохраняются */
    keep?: boolean;
    /** CSS-контракт `${name}-enter-from|active|to` / `${name}-leave-*` (true → 'aegis'); leave доигрывается до удаления */
    transition?: boolean | string;
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

export interface ListOptions<T = any> {
    key?: string | ((item: T, index: number) => string | number);
    /** разметка пустого списка */
    fallback?: (() => Node | DocumentFragment | string) | Node;
    /** CSS-контракт enter/leave для строк (true → 'aegis'); уходящая строка получает data-leaving */
    transition?: boolean | string;
    /** 'signal' — renderFn получает Signal<T>; замена объекта под ключом патчит сигнал вместо перерисовки */
    item?: 'signal';
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
export interface GuardedFetch {
    /** устаревший (отменённый) вызов никогда не резолвится; { stale: 'undefined' } — старое поведение */
    (url: string, opts?: RequestOptions & { stale?: 'undefined' }): Promise<any>;
    pending: ReadonlySignal<boolean>;
    error: ReadonlySignal<unknown>;
}
export function guardedFetch(scope?: Scope): GuardedFetch;

// ── HTTP layer ─────────────────────────────────────────────────

/** Ошибка HTTP-ответа: статус, Response и разобранное тело (e.data.errors из Laravel/Django) */
export class HttpError extends Error {
    name: 'HttpError';
    status: number;
    response: Response;
    data: unknown;
    constructor(status: number, response: Response, data: unknown);
}

export type CsrfPreset = 'django' | 'rails' | 'laravel' | 'go';
export interface CsrfConfig {
    header: string;
    cookie?: string;
    meta?: string;
    token?: () => string;
    /** decodeURIComponent значения cookie (Laravel) */
    decode?: boolean;
}
export interface AegisConfig {
    /** пресет или своя схема; null — выключить; без вызова — автодетект из <meta name="aegis-csrf"> / <meta name="csrf-token"> */
    csrf?: CsrfPreset | CsrfConfig | null;
    /** заголовки по умолчанию (default: X-Requested-With: XMLHttpRequest) */
    headers?: Record<string, string>;
    baseURL?: string;
    /** мс; 0 — без таймаута */
    timeout?: number;
    /** подмена fetch: прокси, логирование, моки */
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    onError?: (error: HttpError, info: { url: string; status: number }) => void;
    /** после PRG-редиректа формы: 'assign' (default) — location.assign(response.url); 'none'; или свой обработчик */
    onRedirect?: 'assign' | 'none' | ((response: Response) => void);
}
/** Настройка HTTP-слоя под свой бэкенд — одна строка на проект: configure({ csrf: 'django' }) */
export function configure(opts: AegisConfig): AegisConfig;

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method' | 'headers'> {
    method?: string;
    /** объект → JSON + Content-Type; FormData/Blob/string — как есть */
    body?: unknown;
    query?: Record<string, string | number | boolean> | URLSearchParams;
    headers?: HeadersInit;
    /** мс; default configure().timeout */
    timeout?: number;
    /** вернуть Response без разбора тела */
    raw?: boolean;
}
/**
 * Единый HTTP-запрос: baseURL, query, JSON-тело, CSRF для unsafe same-origin, timeout, HttpError с разобранным телом.
 */
export function request<T = unknown>(url: string, init?: RequestOptions & { raw?: false }): Promise<T>;
export function request(url: string, init: RequestOptions & { raw: true }): Promise<Response>;
/** Сахар над request() */
export const api: {
    get<T = unknown>(url: string, opts?: RequestOptions): Promise<T>;
    post<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    put<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    patch<T = unknown>(url: string, body?: unknown, opts?: RequestOptions): Promise<T>;
    delete<T = unknown>(url: string, opts?: RequestOptions): Promise<T>;
};
export type Fetcher = (url: string, opts: { signal?: AbortSignal; method?: string; body?: unknown }) => Promise<unknown>;
/** Точка подмены для всего движка: defaults.fetcher = mock — resource/cache/offline/guardedFetch идут через него */
export const defaults: { fetcher: Fetcher; motion: 'auto' | 'reduce' | 'none' };

export interface RetryOptions {
    retries?: number;
    base?: number;
    max?: number;
    signal?: AbortSignal;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
}
/** Повтор с exponential backoff и full jitter; уважает Retry-After; AbortError не повторяется */
export function withRetry<T>(fn: (attempt: number) => Promise<T>, opts?: RetryOptions): Promise<T>;

/** Размер элемента как сигналы (ResizeObserver) */
export function size(el: Element, opts?: { box?: 'border-box' | 'content-box' }): { width: ReadonlySignal<number>; height: ReadonlySignal<number> };
/** Видимость элемента как сигналы (IntersectionObserver) */
export function inView(el: Element, opts?: IntersectionObserverInit): { visible: ReadonlySignal<boolean>; ratio: ReadonlySignal<number> };
/** Окно как сигналы (singleton, один passive listener, запись в rAF) */
export function viewport(): { width: ReadonlySignal<number>; height: ReadonlySignal<number>; scrollX: ReadonlySignal<number>; scrollY: ReadonlySignal<number> };

export function debounced<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel(): void; /** вызвать немедленно, отменив таймер */ flush: T };
export function throttled<T extends (...args: any[]) => any>(fn: T, ms: number): T;
/** Polling с auto-stop при dispose. В фоновой вкладке спит (background: true — не спать) */
export function poll(fn: () => Promise<void> | void, ms: number, opts?: { background?: boolean }): () => void;

// ── Data ───────────────────────────────────────────────────────

export type ResourceStatus = 'idle' | 'pending' | 'success' | 'error';

/** Единый контракт resource() / resource({ cache }) / resource({ offline }) / streamResource / infiniteResource */
export interface ResourceResult<T> {
    data: ReadonlySignal<T | null> | Signal<T | null>;
    /** идёт запрос и данных ещё нет (скелетон один раз) */
    loading: ReadonlySignal<boolean>;
    /** идёт запрос поверх данных (dimming, не мигание) */
    validating: ReadonlySignal<boolean>;
    /** keepPrevious: показаны данные предыдущего ключа, пока грузятся новые */
    stale: ReadonlySignal<boolean>;
    status: ReadonlySignal<ResourceStatus>;
    error: ReadonlySignal<HttpError | Error | null>;
    /** текущий URL / сериализованные params */
    key: ReadonlySignal<string | null>;
    refresh(): Promise<void>;
    /** Optimistic update: локальная запись (для offline — ещё и в IndexedDB) */
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
    abort(): void;
    /** последний запрос этого ресурса (для await в тестах) */
    readonly promise: Promise<void> | null;
    /** дождаться данных: resolve(data) или reject(error) */
    ready(): Promise<T | null>;
    dispose(): void;
}

export interface ResourceOptions<T> {
    initial?: T;
    transform?: (data: unknown) => T;
    fetcher?: Fetcher;
    immediate?: boolean;
    /** structural sharing ответа: неизменённые части сохраняют identity (default true) */
    share?: boolean;
    /** повторы с backoff: true → 3, число, или предикат (err, attempt) => boolean; default 0 */
    retry?: boolean | number | ((error: unknown, attempt: number) => boolean);
    /** перезапрос по событиям — только opt-in */
    refetch?: { focus?: boolean; reconnect?: boolean; interval?: number };
}
export interface CacheOptions {
    key?: string;
    staleTime?: number;
    cacheTime?: number;
    /** держать старые данные при смене URL (default true для реактивного source) */
    keepPrevious?: boolean;
    /** default ['focus', 'reconnect']; [] — выключить */
    revalidateOn?: Array<'focus' | 'reconnect'>;
}
export interface OfflineOptions {
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
    online: ReadonlySignal<boolean>;
    syncing: ReadonlySignal<boolean>;
    /** сетевая мутация; офлайн или сетевая ошибка → в IndexedDB-очередь, отправка при online / Background Sync */
    send(method: string, url: string, body?: unknown, opts?: { optimistic?: (current: T | null) => T }): Promise<unknown>;
    /** совместимость: mutate('POST', url, body, optimistic) === send(...) */
    mutate(method: string, url: string, body?: unknown, optimistic?: (current: T | null) => T): Promise<unknown>;
    mutate(fnOrValue: T | ((prev: T | null) => T)): void;
}

/**
 * Реактивная загрузка данных — один примитив:
 *   resource('/api/users')                                 GET
 *   resource(() => `/api/users?page=${page.value}`)       перезапрос при изменении сигналов
 *   resource({ params: () => uid.value, loader: async ({ params, signal }) => … })
 *   resource(url, { cache: true, staleTime: 30000 })       SWR-кэш (общий по ключу)
 *   resource(url, { offline: true })                       IndexedDB + очередь мутаций
 */
export function resource<T = unknown>(source: string | (() => string | null | false), opts: ResourceOptions<T> & { initial: T } & { cache?: boolean | CacheOptions; offline?: false }): ResourceResult<T> & { data: Signal<T> };
export function resource<T = unknown>(source: string | (() => string | null | false), opts: ResourceOptions<T> & { offline: true | OfflineOptions }): OfflineResourceResult<T>;
export function resource<T = unknown>(source: string | (() => string | null | false), opts?: ResourceOptions<T> & { cache?: boolean | CacheOptions; offline?: false }): ResourceResult<T>;
export function resource<T = unknown, P = unknown>(source: LoaderSource<P, T>, opts?: ResourceOptions<T>): ResourceResult<T>;

/** Дождаться завершения всех запросов resource()/mutation()/guardedFetch — вместо sleep(50) в тестах */
export function settled(): Promise<void>;

export interface MutationOptions<A extends unknown[]> {
    /** ресурсы, чьи data снимаются перед optimistic и откатываются при ошибке */
    resources?: Array<{ data: { peek(): any }; mutate(v: any): void }>;
    optimistic?: (...args: A) => void;
    invalidates?: string | ((key: string) => boolean) | Array<string | ((key: string) => boolean)>;
    /** 'ignore' (default, double-submit guard) | 'queue' | 'latest' | 'parallel' */
    concurrent?: 'ignore' | 'queue' | 'latest' | 'parallel';
    onSuccess?: (result: any, ...args: A) => void;
    onError?: (error: unknown, ...args: A) => void;
}
export interface Mutation<A extends unknown[], R> {
    /** запуск; ошибка не бросается — она в .error (run() бросает) */
    (...args: A): Promise<R | undefined>;
    run(...args: A): Promise<R | undefined>;
    pending: ReadonlySignal<boolean>;
    error: ReadonlySignal<unknown>;
    data: ReadonlySignal<R | null>;
    abort(): void;
}
/**
 * Мутация с pending, double-submit guard, optimistic + rollback, invalidate.
 *   const addTodo = mutation((text, { signal }) => api.post('/api/todos', { text }, { signal }), { resources: [todos], optimistic: … });
 */
export function mutation<A extends unknown[], R>(fn: (...args: [...A, { signal: AbortSignal }]) => Promise<R> | R, opts?: MutationOptions<A>): Mutation<A, R>;

export interface StreamOptions<T> {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    /** 'ndjson' (default: data — массив строк JSON), 'text' (data — строка) или парсер строки */
    parse?: 'ndjson' | 'text' | ((line: string) => T);
    initial?: unknown;
    reduce?: (acc: any, item: T) => any;
    immediate?: boolean;
}
/** Стриминг ответа в растущий сигнал; done — сигнал завершения */
export function streamResource<T = unknown>(source: string | (() => string | null), opts?: StreamOptions<T>): ResourceResult<any> & { done: ReadonlySignal<boolean> };

/** Server-Sent Events поверх EventSource: event "aegis-signals" пишет JSON в сигналы; закрывается при dispose scope */
export function sse(url: string, opts?: {
    signals?: Record<string, Signal<any>>;
    events?: Record<string, (data: any, e: MessageEvent) => void>;
    onMessage?: (data: any, e: MessageEvent) => void;
    withCredentials?: boolean;
}): { status: ReadonlySignal<'connecting' | 'open' | 'closed'>; close(): void; source: EventSource };

/**
 * Watch a signal/computed for changes.
 *
 * @param source — what to track (signal, computed, or getter function)
 * @param callback — called with (newValue, oldValue) on change
 * @param opts.immediate — call immediately with current value (oldValue = undefined)
 * @param opts.debounce — debounce the callback in ms
 * @returns dispose function
 */
export interface WatchHandle { (): void; stop(): void; pause(): void; resume(): void }
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
export function store<T extends object>(definition: T): T & {
    readonly $signals: Record<string, Signal<unknown>>;
    $reset(): void;
};

// ── Cached Resource (SWR) ──────────────────────────────────────

/** = resource(source, { cache: true, ...opts }) */
export function cachedResource<T = unknown>(source: string | (() => string), opts?: ResourceOptions<T> & CacheOptions): ResourceResult<T>;

/** Прогреть кэш без подписчиков (hover, приближение к viewport); данные доступны resource(url, { cache: true }) */
export function prefetch(url: string, opts?: { key?: string; staleTime?: number; cacheTime?: number; fetcher?: Fetcher; transform?: (d: unknown) => unknown }): Promise<void>;
/** Прогрев по намерению: hover (default) | tap | visible; при saveData/2g — только tap. Возвращает dispose */
export function prefetchOn(el: Element, urlOrFn: string | ((target: Element) => string | null | undefined), opts?: { on?: 'hover' | 'tap' | 'visible'; rootMargin?: string; staleTime?: number }): () => void;

/** Курсорная пагинация: страницы копятся, loadMore дедуплицируется */
export function infiniteResource<P = unknown, T = unknown>(urlFor: (cursor: unknown) => string | null, opts?: {
    getNext?: (page: P) => unknown;
    select?: (page: P) => T[];
    fetcher?: Fetcher;
    immediate?: boolean;
    retry?: boolean | number;
}): ResourceResult<T[]> & { pages: ReadonlySignal<P[]>; hasMore: ReadonlySignal<boolean>; loadMore(): Promise<void>; reset(): Promise<void> };

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

export type ValidationRule<V = unknown> = (value: V, key: string, fields: Record<string, Signal<unknown>>) => string | null;
/** Поле формы: { value, rules } — правила типизированы значением: minLen(3) на числовом поле — ошибка типов */
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
/** Standard Schema (zod v4 / valibot / arktype / …) — без зависимости */
export interface StandardSchemaV1<I = unknown, O = I> {
    readonly '~standard': {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardResult<O> | Promise<StandardResult<O>>;
    };
}
export type StandardResult<O> = { value: O; issues?: undefined } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> };
/** Правило: (value, key, fields, { signal }) → строка ошибки | null | Promise (async — с debounce, отменой и validating[key]) */
export type AsyncValidationRule<V = any> = (value: V, key: string, fields: Record<string, Signal<any>>, ctx: { signal: AbortSignal | null }) => string | null | undefined | Promise<string | null | undefined>;
export interface FormCore {
    /** вложенный объект значений: items[0][qty] → { items: [{ qty }] } */
    values: ReadonlySignal<any>;
    validating: Record<string, ReadonlySignal<boolean>> & { $any: ReadonlySignal<boolean> };
    dirtyFields: ReadonlySignal<Record<string, true>>;
    /** только изменённые поля (для PATCH) */
    changes: ReadonlySignal<any>;
    /** sync-правила + schema; async-правила запускаются в фоне */
    validate(): boolean;
    validateField(key: string): boolean;
    /** sync + async + schema */
    validateAsync(): Promise<boolean>;
    /** новые «начальные» значения (объект или сигнал, например resource().data) */
    setInitial(values: Record<string, any> | ReadonlySignal<any> | Signal<any>): void;
    /** текущие значения становятся начальными (после успешного PATCH) */
    commit(): void;
    /** beforeunload при dirty; возвращает dispose */
    guardUnload(): () => void;
    setErrors(errors: Record<string, any> | Array<{ path?: string | string[]; pointer?: string; message: string }>): void;
    reset(): void;
}
export interface FormOptions {
    rules?: Record<string, AsyncValidationRule[]>;
    schema?: StandardSchemaV1<any, any>;
    asyncDebounce?: number;
}
/** form(defaults, { rules, schema }) — форма из значений по умолчанию: form({ name: '', age: 0 }) */
export function form<T extends Record<string, any>>(defaults: T & { [K in keyof T]: T[K] extends { value: any } ? never : T[K] }, opts?: FormOptions): FormResult<{ [K in keyof T]: { value: T[K] } }> & FormSubmitState & FormCore & {
    submit(handler: (values: T) => unknown | Promise<unknown>): Promise<unknown>;
    submit(url: string, opts?: { headers?: HeadersInit; transform?: (v: T) => unknown; fetchOpts?: RequestOptions }): Promise<{ ok: boolean; status?: number; data?: any; error?: unknown }>;
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

/**
 * Оживить серверную <form>: signals, валидация (нативные ограничения через Constraint Validation API с сообщениями браузера,
 * правила, Standard Schema, async-правила), a11y, wizard, серверный submit.
 *   const f = wireForm(el, { schema: zodSchema, rules: { login: [unique] }, submit: true });   // submit: true — FormData на action формы
 *   on(el, 'submit', f.submit(values => api.post('/save', values)));
 */
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
    provide: typeof provide;
    inject: typeof inject;
    when: typeof when;
    selector: typeof selector;
    /** Pre-bound guardedFetch — already tied to this component's scope */
    guardedFetch: GuardedFetch;
    /** то же, короткое имя */
    fetch: GuardedFetch;
    /** scope компонента (для кода после await: scope.run(() => …)) */
    scope: Scope;
    /** errorBoundary без расширения браузера: ошибки эффектов компонента */
    onError(fn: (error: any) => void): () => void;
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
/** Компонент = функция (ctx) => Node | api | void; ctx.props — reactive()-объект props */
export type Component<P = Record<string, any>, R = void | object | Node> = (ctx: ComponentContext & { props: P & ReactiveExtras<P> }) => R | Promise<R>;
/** Остров из компонента-функции: data-* (с types) → ctx.props */
/** ctx.props острова: объявленные types → типизированы, остальные data-* — unknown */
export type IslandProps<T> = { [K in keyof T]: PropValue<{ type: T[K] }> } & Record<string, unknown>;
export function island<T extends Record<string, PropType> = {}>(name: string, component: Component<IslandProps<T>>, opts?: { types?: T }): void;
/** ctx.props custom element: { count: Number } → number | null, { count: { type: Number, default: 0 } } → number */
export type ElementProps<P> = { [K in keyof P]: PropValue<P[K] extends PropType ? { type: P[K] } : P[K]> };
/** Custom element из того же компонента: атрибуты → ctx.props (реактивно) */
export function element<P extends Record<string, PropType | { type: PropType; default?: unknown; reflect?: boolean }> = {}>(tag: `${string}-${string}`, component: Component<ElementProps<P>>, opts?: { props?: P; shadow?: boolean; styles?: CSSStyleSheet | string; formAssociated?: boolean }): void;
export type IslandSetup<D = Record<string, unknown>> = (el: HTMLElement, data: D, ctx: ComponentContext<HTMLElement>) => void | object | Node | Promise<void | object | Node>;
/**
 * Зарегистрировать компонент по имени; { load } — код острова грузится import()-ом при монтировании
 * (для visible — за 400px до viewport). Без регистрации работает data-aegis-src="/js/islands/x.js".
 */
export type PropType = NumberConstructor | BooleanConstructor | StringConstructor | JSON | ObjectConstructor | ArrayConstructor | ((raw: string) => unknown);
/**
 * Зарегистрировать компонент по имени; { load } — код острова грузится import()-ом при монтировании.
 * data-* передаются строками (JSON-литералы парсятся); types объявляет приведение: { count: Number, on: Boolean, tags: JSON }.
 * JSON-блок <script type="application/json"> внутри острова (или data-aegis-props="#id") → data.props и поля data.
 */
export function register<D = Record<string, unknown>>(
    name: string,
    setup: IslandSetup<D> | { load: () => Promise<IslandSetup<D> | { default: IslandSetup<D> }> },
    opts?: { types?: Record<string, PropType> }
): void;
export interface HydrateOptions {
    /** MutationObserver: вставленные острова оживают, удалённые уничтожаются (htmx/Turbo/jQuery) */
    watch?: boolean;
    /** перемонтировать уже живые */
    force?: boolean;
    /** переопределить data-aegis-load для всех (тесты: 'eager'). Стратегии с аргументами: 'visible(300px)', 'idle(1500)', 'interaction(click,keydown)' */
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
/** Анимированный show/hide через CSS-контракт `${name}-enter-*` / `${name}-leave-*` (interrupt-safe); legacy { enter, enterActive, leave, leaveActive, duration } поддерживаются */
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
/** Пружина как значение: target пишем, current читаем; скорость сохраняется при смене цели */
export function springSignal<T extends number | number[] | Record<string, number>>(initial: T, opts?: { stiffness?: number; damping?: number; mass?: number; precision?: number }): { target: Signal<T>; current: ReadonlySignal<T>; set(v: T, opts?: { hard?: boolean }): void };
/** Твин как значение */
export function tween<T extends number | number[] | Record<string, number>>(initial: T, opts?: { duration?: number; easing?: (t: number) => number }): { target: Signal<T>; current: ReadonlySignal<T>; set(v: T, opts?: { hard?: boolean }): void };
export function flip(nodes: ArrayLike<Element>, opts?: { stiffness?: number; damping?: number }): () => void;
export function animate(target: Element, mutate: () => void, opts?: { name?: string; cls?: string }): Promise<void>;

// ── Accessibility ──────────────────────────────────────────────

/** Нативная модалка: open → showModal(); Esc/close → open = false */
export function modal(dialog: HTMLDialogElement, open: Signal<boolean>): () => void;
/** Каркас register() для острова по его серверной разметке (dev) */
export function scaffold(el: HTMLElement): string;
/**
 * Focus trap: Tab-цикл, autoFocus, возврат фокуса; escape / outside (release или свой обработчик); inert для фона (кроме allow)
 */
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
/** Стили в каскадном слое: css.layer('components')`.card { … }` */
export namespace css { function layer(name: string): (strings: TemplateStringsArray | string, ...values: unknown[]) => CSSStyleSheet; }
/** Scoped-стили без мутации id: атрибут data-aegis-css, один sheet на текст (refcount), снятие при dispose scope */
export function scopedStyle(el: Element, cssText: string): CSSStyleSheet;

// ── Custom Elements ────────────────────────────────────────────

export interface PropDefinition<T = unknown> {
    type?: typeof Number | typeof String | typeof Boolean | typeof Object | typeof Array;
    default?: T;
    reflect?: boolean;
    attribute?: string;
}

/** Тип значения prop из { type, default }: { type: Number } → number | null, { type: Number, default: 0 } → number */
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

/** tagName должен содержать дефис (иначе DOMException в рантайме — и ошибка типов здесь) */
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
    /** результат loader */
    data: D;
    params: Record<string, string>;
    query: Record<string, string>;
    /** элемент для дочерних маршрутов (layout) */
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
export interface RouteDef<D = unknown> {
    handler?: RouteHandler<D>;
    /** данные до dispose старой страницы; отменяется через signal при новой навигации */
    loader?: (params: Record<string, string>, ctx: { signal: AbortSignal | undefined; query: Record<string, string>; params: Record<string, string> }) => D | Promise<D>;
    /** true — идём; false — отменить (sync); строка — redirect; Promise — ждём */
    guard?: (to: RouteInfo, from: RouteInfo) => boolean | string | void | Promise<boolean | string | void>;
    redirect?: string | ((to: RouteInfo, from: RouteInfo) => string);
    /** ленивый маршрут: default export модуля = handler */
    load?: () => Promise<RouteHandler<D> | { default: RouteHandler<D> }>;
    /** прогрев данных при hover/visible (router({ preload })) */
    preload?: (params: Record<string, string>) => void;
    /** layout переживает смену дочернего маршрута; получает живой outlet */
    layout?: (ctx: RouteContext<D>) => void | Promise<void>;
    children?: Record<string, RouteHandler | RouteDef>;
}
export interface RouterOptions {
    base?: string;
    root?: Element | Document;
    /** View Transitions между страницами: true → types ['page', 'back'|'forward'] в data-vt-type на <html>; функция — свои types; false */
    transition?: boolean | ((info: { back: boolean }) => string[] | false);
    /** класс активной ссылки (aria-current="page" ставится всегда) */
    activeClass?: string;
    /** прогрев ленивых маршрутов/данных: 'hover' | 'visible' | false */
    preload?: 'hover' | 'visible' | false;
    scroll?: 'after-transition' | 'manual';
    beforeEach?: (to: RouteInfo, from: RouteInfo) => void;
    /** пересоздавать scope при изменении только search (старое поведение) */
    searchReload?: boolean;
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
    /** search-параметр как двусторонний сигнал (URL = state); scope маршрута не пересоздаётся */
    search<T = string>(name: string, opts?: SearchOptions<T>): Signal<T>;
    search<T = string>(name: string, opts: SearchOptions<T> & { multi: true }): Signal<T[]>;
    navigate(path: string, opts?: { replace?: boolean; state?: unknown }): Promise<unknown>;
    back(): void;
    forward(): void;
    /** per-entry state без навигации */
    setState(state: unknown): void;
    /** первый маршрут отрендерен */
    ready: Promise<unknown>;
    /** есть ли маршрут для пути (boost() уступает роутеру) */
    matches(path: string): boolean;
    cleanup(): void;
    dispose(): void;
}
/**
 * Роутер поверх Navigation API (fallback: popstate + перехват <a>).
 * Вложенные маршруты с layout, async handler/loader (нативный индикатор, scroll после данных, отмена гонок),
 * guard/redirect как данные, search-параметры как сигналы, ленивые маршруты через import().
 * Не перехватывает: hash-ссылки, формы, download, data-aegis-reload, несовпавшие пути (уходят на сервер).
 */
export function router<R extends Record<string, unknown>>(routes: { [K in keyof R]: K extends string ? RouteHandler<any, K> | (RouteDef & { handler?: RouteHandler<any, K> }) : never }, opts?: RouterOptions): Router;
/** Идёт View Transition роутера */
export const transitioning: ReadonlySignal<boolean>;

// ── Commands ───────────────────────────────────────────────────

export function command(root: Element, commands?: Record<string, (trigger: Element, target: Element | null) => void>): {
    dispose(): void;
    add(name: string, handler: (trigger: Element, target: Element | null) => void): void;
};

// ── Virtual Scroll ─────────────────────────────────────────────

export function virtualScroll<T>(parent: Element, items: T[] | Signal<T[]> | ReadonlySignal<T[]> | (() => T[]), opts: {
    /** 'cv' (default) — все строки в DOM под content-visibility; 'window' — DOM recycling, в DOM только видимые + overscan */
    mode?: 'cv' | 'window';
    overscan?: number;
    /** высота контейнера для mode 'window' */
    height?: number | string;
    itemHeight?: number;
    chunkSize?: number;
    /** ключ строки (по умолчанию "id"); строки keyed, со своим scope */
    key?: string | ((item: T, index: number) => string | number);
    renderItem: (item: T, index: number) => Element | DocumentFragment;
}): { container: HTMLElement; refresh(): void; dispose(): void; /** mode 'window' */ range?: ReadonlySignal<{ start: number; end: number; total: number }>; scrollToIndex?(i: number, opts?: { align?: 'start' | 'center' | 'end' }): void };

// ── Offline Resource ───────────────────────────────────────────

/** = resource(source, { offline: true, ...opts }) */
export function offlineResource<T = unknown>(source: string | (() => string), opts?: ResourceOptions<T> & OfflineOptions): OfflineResourceResult<T>;

// ── Server HTML ────────────────────────────────────────────────

export type SwapMode = 'inner' | 'outer' | 'append' | 'prepend' | 'before' | 'after' | 'morph';
/**
 * Вставить серверный HTML аккуратно: dispose островов в заменяемом поддереве, вставка, hydrate новых,
 * снятие data-cloak, восстановление фокуса и курсора. mode 'morph' — точечный патч (id-aware), узлы не пересоздаются.
 * Если ответ — целая страница, берётся селектор target (или select).
 */
export function swap(target: Element, html: string | Response | Document | DocumentFragment | Element, opts?: {
    mode?: SwapMode;
    select?: string;
    transition?: boolean | { name?: string; cls?: string };
    hydrate?: boolean;
}): Promise<{ inserted: Node[] }>;

/**
 * MPA-навигация без перезагрузки: fetch страницы → morph root → View Transitions.
 * Острова вне root переживают переход. Opt-out: data-no-boost; ссылки router()-а не трогаются (routers: [r]).
 */
export function boost(opts?: {
    root?: string | Element;
    mode?: SwapMode;
    transition?: boolean;
    prefetch?: 'hover' | false;
    scroll?: 'restore' | 'preserve';
    head?: 'title' | 'title+styles' | false;
    routers?: Router[];
}): { pending: ReadonlySignal<boolean>; visit(url: string): Promise<boolean>; dispose(): void };

export type SlotSpec = Reactive<Displayable> | {
    text?: Reactive<Displayable>;
    attr?: Record<string, Reactive<Displayable>>;
    cls?: ClassValue;
    style?: Record<string, Reactive<string | number | null>>;
    prop?: Record<string, Reactive<unknown>>;
    on?: Record<string, (e: Event) => void>;
};
/** Серверный <template> со слотами [data-slot] как источник разметки для list()/show(); HTML не парсится (CSP) */
export function tpl(target: string | HTMLTemplateElement, root?: Document | Element): (slots?: Record<string, SlotSpec>) => DocumentFragment;

/**
 * Привязать html``-шаблон к уже отрендеренному сервером DOM без перерисовки (0 мутаций):
 *   adopt(el)`<span class="value">${count}</span><button @click=${inc}>+</button>`
 * Структура элементов должна совпадать; текстовые значения — единственный ребёнок элемента.
 */
export function adopt(root: Element, opts?: { trust?: boolean }): (strings: TemplateStringsArray, ...values: unknown[]) => Element;

/** JSON из <script type="application/json"> (Django json_script) — кэш по элементу */
export function jsonScript<T = unknown>(target: string | Element, root?: Document | Element): T | undefined;

// ── i18n ───────────────────────────────────────────────────────

/**
 * Translation function with reactive dictionary.
 */
export type PluralForms = Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>>;
export interface I18nOptions {
    /** начальная локаль (default: <html lang> или 'en') */
    locale?: string;
    /** локаль-запас для отсутствующих ключей */
    fallback?: string;
    pluralOpts?: Intl.PluralRulesOptions;
    /** писать t.locale в <html lang> */
    syncLang?: boolean;
}
export interface TranslationFunction<K extends string = string> {
    /** Translate a key, with optional param substitution ({name}) and plural by params.n / params.count */
    (key: K, params?: Record<string, string | number>): string;
    /** Replace entire dictionary (e.g. on locale switch) */
    load(newDict: Record<string, unknown>): void;
    /** Merge additional translations into the current dictionary */
    merge(extra: Record<string, unknown>): void;
    /** The reactive dictionary signal */
    dict: Signal<Record<string, unknown>>;
    /** реактивная локаль; запись переключает словарь (ленивая подгрузка → t.loading) */
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
/** Сообщения встроенных правил валидации: словарь по кодам или (code, params) => string; null — дефолт по <html lang> */
export function setValidationMessages(dict: Record<string, string> | ((code: string, params?: Record<string, unknown>) => string) | null): void;
export function maxSize(size: number | string, msg?: string): ValidationRule<any>;
export function mime(types: string | string[], msg?: string): ValidationRule<any>;
export function maxFiles(n: number, msg?: string): ValidationRule<any>;
/**
 * Переводы: plural через Intl.PluralRules ({ one, few, many, other } по params.n/count), вложенные ключи,
 * реактивная локаль t.locale с ленивой подгрузкой (t.loading), Intl-форматтеры t.num/t.date/t.rel/t.list.
 * i18n(flatDict) — плоский словарь одной локали.
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
    offlineResource: typeof offlineResource;
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
