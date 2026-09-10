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
    /** появился первый подписчик (эффект / computed / subscribe) — запустить producer, открыть соединение */
    watched?(): void;
    /** ушёл последний подписчик — остановить */
    unwatched?(): void;
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
    /** false — дети эффекта (effect/on/interval/createScope/subscribe, созданные в теле) живут до dispose владельца, а не до следующего запуска */
    own?: boolean;
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

export interface WarningInfo {
    /** путь scope, где возникло предупреждение: component:div#app ‹ list:row (null вне scope) */
    where?: string | null;
    /** элемент, к которому относится предупреждение (печатается в консоль как %o) */
    el?: Element | null;
    /** позиция в исходнике (dev): '/js/app.js:42:15' — html``-шаблон, effect() или resource(), где возникло предупреждение */
    site?: string | null;
    /** полный URL файла для site */
    url?: string | null;
    /** строка исходника с кареткой под виновным ${} (dev; файл подтягивается fetch-ем один раз) */
    snippet?: Promise<string | null>;
    /** то же после разрешения */
    snippetText?: string | null; code: string; what: string; why: string; fix: string }
/** Предупреждение движка как исключение (window.__AEGIS_DEV__ = 'strict') */
export class AegisWarning extends Error { code: string; what: string; why: string; fix: string }
/** Подписка на предупреждения (dev-режим): warnings-as-assertions в тестах. Возвращает unsubscribe */
/**
 * Ошибки эффектов, не поглощённые scope.onError / errorBoundary: fn(error, error.aegis). Без обработчиков — self.reportError(e).
 * Писатель сигнала исключение не получает (кроме __AEGIS_DEV__ = 'strict'). Возвращает unsubscribe; в scope снимается автоматически.
 */
export function onError(fn: (error: unknown, info: { effect: string; scope: string; changed: Array<{ name: string; value: string }>; site?: string } | null) => void): () => void;
export function onWarn(fn: (w: WarningInfo) => void): () => void;
/** Управление dev-режимом: dev.enable() (localStorage + reload на проде), dev.disable(), dev.resetWarnings() */
export interface ScopeInspection { scope: string | null; el: Element | null; signals: Array<{ name: string; value: string; /** сам сигнал (не-перечислимое поле) */ readonly ref?: ReadonlySignal<unknown> }>; effects: Array<{ name: string; deps: string[]; scope: string | null; /** позиция effect() в исходнике (dev) */ site?: string | null }>; children: number }
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
    /** dev-overlay: предупреждения всплывают в углу страницы; false — только консоль (или localStorage aegis:overlay=0) */
    overlay: boolean;
    /** Объяснение кода предупреждения из ERRORS.md — печатает в консоль и возвращает текст */
    explain(code: string): Promise<string>;
    /** Снимок кэша ресурсов (то же, что cache.stats().entries) — console.table(Aegis.dev.cache()) */
    cache(): CacheEntryStats[];
    /** Панель инспектора в странице (грузит aegis-devtools.js рядом с модулем); также ?aegis-devtools в URL */
    panel(): Promise<{ host: HTMLElement; shadow: ShadowRoot; close(): void; highlight(el: Element | null): void }>;
};
/** Сбросить модульные синглтоны между тестами (компоненты, реестр, кэш ресурсов, live-region) */
export function reset(opts?: { components?: boolean; cache?: boolean; registry?: boolean; dom?: boolean }): void;
/** Синхронно выполнить отложенные рендеры show()/list() и очередь эффектов */
export function flushSync(): void;
/** Синхронно выполнить отложенные полосы micro/frame и очередь эффектов */
export function flush(): void;
/** Счётчики движка: flushes, effectRuns, maxRounds, slow (top-20 по мс при dev.profile), scopes, effects, components, кэши */
export function stats(): { flushes: number; effectRuns: number; maxRounds: number; /** раундов, где порядок эффектов пришлось восстановить сортировкой (churn подписок) */ reordered: number; slow: Array<{ name: string; ms: number }>; scopes: number; effects: number; components: number; resourceCache: number; cssCache: number; queued: number; prefetch: { fired: number; used: number; wasted: number; hoverDelay: number } | null; speculation: { inflight: number; queued: number; fired: number; skipped: number; aborted: number } | null };
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
/**
 * Двусторонняя линза: чтение — computed(get), запись — set(v) в источник (без локального состояния).
 *   bind:value=${lens(() => cents.value / 100, v => cents.value = Math.round(v * 100))}   |   lens(state.address, 'city')
 */
export function lens<T>(get: () => T, set: (v: T) => void, name?: string): Signal<T>;
export function lens<O extends object, K extends keyof O>(obj: O, key: K, name?: string): Signal<O[K]>;
/** [get, set] — function binding для bind:value / bind(): то же, что lens(get, set) */
export type FunctionBinding<T = any> = [() => T, (v: T) => void];
/**
 * Именованные сигналы из ключей объекта — для E-сообщений, trace() и dev.graph(); геттер → computed.
 *   const { count, query } = signals({ count: 0, query: '' });
 */
export function signals<T extends Record<string, unknown>>(obj: T, opts?: { prefix?: string }): { [K in keyof T]: Signal<T[K]> };
export function linked<T>(source: () => T, name?: string): Signal<T>;
export function linked<S, T>(opts: { source: () => S; compute: (source: S, prev: { source: S; value: T } | undefined) => T }, name?: string): Signal<T>;
/** Внешний источник как сигнал: (EventTarget, event, map) | (producer(set) => unsubscribe, initial) | { subscribe } */
export function from<T, E extends EventTarget = EventTarget>(target: E, event: string, map?: (target: E) => T): ReadonlySignal<T>;
export function from<T>(producer: (set: (v: T) => void) => (() => void) | void, initial?: T, opts?: { /** producer стартует с первым подписчиком и останавливается с последним */ lazy?: boolean }): ReadonlySignal<T>;
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
export type HtmlValue = Displayable | Node | ReadonlySignal<any> | ((...args: any[]) => unknown) | Ref<any> | Attachment<any> | ClassValue | Record<string, Reactive<unknown>> | FunctionBinding | FieldRef | HtmlValue[];
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
/** @deprecated Use `cls(el, { active: sig })` — same object form, diffs only its own classes. */
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
/** Три состояния ресурса в html``: ${when(users, { loading, error, data })} */
/** Сообщение a11y: строка | функция от значения | false (молчать) */
export type A11yMsg<X = unknown> = string | ((x: X) => string | null | false) | false;
export function when<T>(res: { data: { value: T | null; peek(): T | null }; loading?: { value: boolean }; error?: { value: unknown; peek(): unknown }; refresh?: () => unknown }, branches: {
    loading?: () => Node | Node[] | string;
    error?: (error: any, retry: () => void) => Node | Node[] | string;
    /** data(value, signal) — второй аргумент для реактивных list()/text() внутри ветки */
    data?: (data: T, signal: ReadonlySignal<T | null>) => Node | Node[] | string;
    empty?: () => Node | Node[] | string;
}, opts?: { /** aria-busy на контейнере пока loading/validating (default true) */ busy?: boolean; /** объявления: error assertive (default текст ошибки), data — только после реального ожидания, loading */ announce?: false | { loading?: A11yMsg<void>; error?: A11yMsg<unknown>; data?: A11yMsg<T> } }): Comment;

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
/** show(open, () => html`…`, { transition: 'fade' }) — опции третьим аргументом, если ветки else нет */
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
    /** circuit breaker открыт — запрос не отправлялся; retryAt — когда попробовать снова (ms epoch) */
    circuit?: boolean;
    retryAt?: number;
    /** повтор отклонён retry budget */
    budget?: boolean;
    /** сервер просил ждать дольше maxWait (мс) */
    retryAfter?: number;
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
    /** делегирование событий: один listener на document для перечисленных типов (только всплывающие; capture/passive/once и @ev.direct — напрямую) */
    delegateEvents?: string[] | null;
    /** ёмкость SWR-кэша: maxEntries (default 500, SIEVE-вытеснение среди незанятых записей), maxBytes (default 0 — без лимита) */
    cache?: { maxEntries?: number; maxBytes?: number };
    /** заголовок ответа с шаблонами ключей для invalidate() — 'Aegis-Invalidate: /api/users*, /api/stats' (same-origin); false — выключить */
    invalidateHeader?: string | false;
    /** circuit breaker per origin: после threshold retryable-ошибок подряд запросы падают сразу (e.circuit, e.retryAt) на cooldown, затем один probe */
    breaker?: boolean | { threshold?: number; cooldown?: number; key?: (url: string) => string };
    /** идентификация сущностей для cache.patchEntity() и cache: { entity }: (obj) => 'user:42' | null */
    identify?: ((obj: any) => string | null) | null;
    /** спекулятивные запросы (prefetch, preload маршрута, predict, прогрев островов): 'auto' — по navigator.connection (saveData / 2g / prefers-reduced-data → выключено, 3g → один в полёте), false — никогда, { maxInflight, saveData: 'ignore' } */
    speculation?: 'auto' | false | { maxInflight?: number; saveData?: 'respect' | 'ignore' };
    /** порог полезности прогрева (p·min(rtt, horizon) − передача − fixedCost, мс) и задержка hover: 80 | 'auto' (адаптивная по dwell-гистограммам) */
    prefetch?: { minUtility?: number; fixedCost?: number; horizon?: number; hoverDelay?: number | 'auto'; rtt?: number; bytes?: number } | null;
    /** лимит повторов на клиент в скользящем окне: retries ≤ ratio × requests + min; отказ — e.budget === true */
    retryBudget?: boolean | { ratio?: number; min?: number; window?: number };
    /** планировщик ревалидации: refill token bucket на причину (мс), параллелизм, стаггер между стартами, джиттер reconnect */
    revalidate?: { focus?: number; reconnect?: number; concurrency?: number; stagger?: number; reconnectJitter?: number };
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
    /** If-Match для оптимистичной блокировки (ETag из cache.explain(key).etag или ctx.etag мутации) */
    ifMatch?: string;
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
export const defaults: { /** null → request() из движка; подмена: defaults.fetcher = mock */ fetcher: Fetcher | null; motion: 'auto' | 'reduce' | 'none' };

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
    /** structural sharing ответа: неизменённые части сохраняют identity; массивы объектов матчатся по полю 'id' (default), по своему полю или функции; false — выключить */
    share?: boolean | string | ((item: any) => unknown);
    /** один GET на URL в полёте для нескольких resource(url) (default true при fetcher по умолчанию) */
    dedupe?: boolean;
    /** повторы с backoff: true → 3, число, или предикат (err, attempt) => boolean; default 0 */
    retry?: boolean | number | ((error: unknown, attempt: number) => boolean);
    /** перезапрос по событиям — только opt-in */
    refetch?: { focus?: boolean; reconnect?: boolean; interval?: number };
}
/** Часть ключа кэша: строка, число, объект params или функция (реактивная часть) */
export type CacheKeyPart = string | number | boolean | null | Record<string, unknown> | (() => string | number | Record<string, unknown>);
export interface CacheOptions {
    /** ключ вместо URL: строка или иерархический массив ['users', () => id.value] (invalidate(['users']) матчит все) */
    key?: string | CacheKeyPart[] | (() => string | CacheKeyPart[]);
    /** теги для invalidate({ tags }) */
    tags?: string | string[];
    /** после каждого ответа списка засеять дочерние записи: (data) => [[key, item], …] — карточка открывается без запроса */
    seeds?: (data: any) => Array<[string | CacheKeyPart[], unknown]>;
    /** ответ — сущность (configure({ identify })): обновить её во всех списках */
    entity?: boolean;
    /** мс | 'http' (Cache-Control max-age / Age / Expires ответа; ['http', fallbackMs]) | 'auto' | { auto: true, k?, min?, max? } — T* = sqrt(2k/(λ̂μ̂)) − 1/λ̂ по наблюдаемым частотам */
    staleTime?: number | 'http' | ['http', number] | 'auto' | { auto: true; k?: number; min?: number; max?: number };
    /** мс до сборки незанятой записи; Infinity — держать до вытеснения по лимитам; 'http' — max-age + stale-while-revalidate из ответа */
    cacheTime?: number | 'http';
    /** держать старые данные при смене URL (default true для реактивного source) */
    keepPrevious?: boolean;
    /** default ['focus', 'reconnect']; [] — выключить. События, пришедшие в скрытой вкладке, применяются при возврате в неё */
    revalidateOn?: Array<'focus' | 'reconnect'>;
    /** polling: мс или функция от данных (0 — стоп); один таймер на все ресурсы, сетка 1 с, backoff при ошибках, сон в скрытой вкладке */
    interval?: number | ((data: any) => number);
    /** продолжать polling в скрытой вкладке (браузер всё равно троттлит) */
    background?: boolean;
    /** не вытеснять запись по лимитам кэша */
    pin?: boolean;
    /** запись переживает перезагрузку (IndexedDB): true | { version — смена формата сбрасывает, maxBytes — бюджет хранилища (4 MB), maxAge — срок (7 дней) } */
    persist?: boolean | { version?: number; maxBytes?: number; maxAge?: number };
    /** делиться данными и инвалидацией с другими вкладками (BroadcastChannel, default true) */
    sync?: boolean;
}
export interface OfflineOptions {
    /** попыток на мутацию до dead-letter (default 10); 4xx — сразу */
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
    /** dead-letter: мутации, которые сервер отверг или не удалось доставить */
    failed: ReadonlySignal<Array<{ mutation: { mutId: string; method: string; url: string; body: unknown }; error: unknown }>>;
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
    invalidates?: InvalidatePattern | InvalidatePattern[];
    /** ждать перезапросы invalidates перед снятием pending (default true) */
    awaitInvalidates?: boolean;
    /** серверный ответ → новый base затронутых ресурсов без refetch: (result, base, ...args) => data */
    commit?: (result: any, base: any, ...args: A) => any;
    /** обновить записи кэша по шаблонам без refetch: { '/api/users*': (data, result, ...args) => data } */
    updates?: Record<string, (data: any, result: any, ...args: A) => any>;
    /** обновить сущности во всех записях (configure({ identify })): (result, ...args) => [[entityKey, (node) => node], …] */
    patch?: (result: any, ...args: A) => Array<[string, (node: any) => any]>;
    /** 412/409 от сервера: base — до правки, local — с optimistic, server — актуальное; вернуть 'server' | 'client' | объект для повтора мутации с ним */
    onConflict?: (c: { base: any; local: any; server: any; merge(): { value: any; conflicts: string[] }; error: HttpError }) => 'server' | 'client' | object | Promise<'server' | 'client' | object>;
    /** объявления для скринридера: true — дефолты (Saved / текст ошибки / Change reverted / conflict), или свои */
    announce?: true | { pending?: A11yMsg; success?: A11yMsg<any>; error?: A11yMsg<unknown>; undone?: A11yMsg<unknown>; conflict?: A11yMsg<unknown> };
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
export function mutation<A extends unknown[], R>(fn: (...args: [...A, { signal: AbortSignal; /** ETag затронутого ресурса для If-Match */ etag: string | null }]) => Promise<R> | R, opts?: MutationOptions<A>): Mutation<A, R>;

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
/** @deprecated Use `reactive(obj)` — getters become computeds, methods become batched actions, plus `$patch`/`$subscribe`/`$snapshot`/`$reset`. `store()` = `reactive(obj, { shallow: true })`. */
export function store<T extends object>(definition: T): T & {
    readonly $signals: Record<string, Signal<unknown>>;
    $reset(): void;
};

// ── Cached Resource (SWR) ──────────────────────────────────────

/** = resource(source, { cache: true, ...opts }) */
/** @deprecated Use `resource(url, { cache: true, staleTime })`. */
export function cachedResource<T = unknown>(source: string | (() => string), opts?: ResourceOptions<T> & CacheOptions): ResourceResult<T>;

/** Прогреть кэш без подписчиков (hover, приближение к viewport); данные доступны resource(url, { cache: true }) */
export function prefetch(url: string, opts?: { /** вид прогрева для статистики попаданий (prefetchOn проставляет сам) */ kind?: string; /** вероятность использования — прогрев только при p·rtt выше цены сети */ p?: number; /** мимо бюджета сети (configure({ speculation })) */ force?: boolean; key?: string; staleTime?: number; cacheTime?: number; fetcher?: Fetcher; transform?: (d: unknown) => unknown }): Promise<void>;
/** Прогрев по намерению: hover (default) | tap | visible; при saveData/2g — только tap. Возвращает dispose */
export function prefetchOn(el: Element, urlOrFn: string | ((target: Element) => string | null | undefined), opts?: { on?: 'hover' | 'tap' | 'visible'; /** 'auto' — горизонт по скорости скролла (400 / 1200 / 3000 px) */ rootMargin?: string; /** задержка hover: мс | 'auto' */ delay?: number | 'auto'; /** порог скорости курсора (px/s): ниже — «целится», греем сразу */ velocity?: number; /** вероятность использования (или функция от цели) для порога полезности */ p?: number | ((target: Element) => number); staleTime?: number; kind?: string }): () => void;

/** Курсорная пагинация: страницы копятся, loadMore дедуплицируется */
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
    /** мс до сборки мусора (null — есть подписчики, Infinity — cacheTime: Infinity) */
    gcIn?: number | null; fetches?: number; unchanged?: number;
    /** наблюдаемый интервал изменений / обращений, мс */
    changeInterval?: number | null; readInterval?: number | null;
    /** staleTime по наблюдениям (≈5% устаревших чтений) */
    suggestedStaleTime?: number | null;
    tags?: string[] | null; prefetched?: string | null; /** ETag последнего ответа (If-None-Match → 304) */ etag?: string | null; staleTimeMode?: 'http' | 'auto' | string | null; history: CacheEvent[];
}
export interface CacheEntryStats { key: string; state: CacheState; age: number | null; staleTime: number; subscribers: number; inflight: boolean; error: string | null; size: number; gcIn: number | null; fetches: number; unchanged: number; suggestedStaleTime: number | null; prefetched: string | null; tags: string[] | null }
export interface CacheStats { entries: CacheEntryStats[]; prefetch: { fired: number; used: number; wasted: number; byKind: Record<string, { p: number; n: number }>; hoverDelay: number }; speculation: { inflight: number; queued: number; fired: number; skipped: number; aborted: number }; ghost: number; bytes: number; evictions: number; limits: { maxEntries: number; maxBytes: number }; now: number }
/** Публичный доступ к кэшу ресурсов — ключи нормализуются как в resource() */
export const cache: {
    get<T = unknown>(key: string | CacheKeyPart[] | Record<string, unknown>): T | undefined;
    has(key: string | CacheKeyPart[] | Record<string, unknown>): boolean;
    /** = seed(key, data, { age, staleTime }) */
    set(key: string | CacheKeyPart[] | Record<string, unknown>, data: unknown, opts?: { age?: number; staleTime?: number }): unknown;
    /** удалить записи по шаблону (без аргумента — все); возвращает число удалённых */
    remove(pattern?: InvalidatePattern): number;
    keys(prefix?: string | CacheKeyPart[]): string[];
    entry(key: string | CacheKeyPart[]): { key: string; data: Signal<any>; error: Signal<unknown>; inflight: Signal<boolean>; refCount: number; age(): number | null } | null;
    /** подписка на данные записи (держит её живой); возвращает unsubscribe */
    subscribe<T = unknown>(key: string | CacheKeyPart[], fn: (data: T | null) => void): () => void;
    /** события решений кэша: fetch / fresh / joined / set — для assertions в тестах */
    on(fn: (key: string, ev: CacheEvent) => void): () => void;
    /** явная сборка мусора по часам (тесты с fakeClock, low-memory); возвращает число удалённых */
    gc(now?: number): number;
    /** обновить сущность во всех записях кэша (configure({ identify })); возвращает число изменённых записей */
    patchEntity(entityKey: string, fn: (node: any) => any): number;
    /** трёхстороннее слияние объектов */
    merge3<T = any>(base: T, local: T, server: T): { value: T; conflicts: string[] };
    /** запись persist-хранилища (IndexedDB): { data, at, v, n } | null */
    persisted(key: string | CacheKeyPart[]): Promise<{ data: unknown; at: number; v: number; n: number; etag?: string | null } | null>;
    /** дождаться гидрации записи с диска: true — данные пришли из persist */
    hydrated(key: string | CacheKeyPart[]): Promise<boolean>;
    /** записи, байты (при maxBytes), вытеснения и лимиты */
    size(): { entries: number; bytes: number; evictions: number; maxEntries: number; maxBytes: number };
    /** почему запись свежая/устаревшая, кто её запрашивал, что рекомендовать */
    explain(key: string | CacheKeyPart[]): CacheExplain;
    stats(): CacheStats;
};
/** Подменить часы кэша (staleTime, cacheTime, explain): useClock(() => t); возвращает restore. См. fakeClock() в aegis/test */
export function useClock(now?: (() => number) | null): () => void;
/** Шаблон ключей: точный ключ, 'prefix*', ['users'] (иерархический префикс), предикат или { prefix, exact, tags, refetch } */
export type InvalidatePattern = string | CacheKeyPart[] | ((key: string, entry?: unknown) => boolean) | { prefix?: string; exact?: string | CacheKeyPart[]; tags?: string | string[]; refetch?: 'active' | 'all' | 'none' };
/** Сбросить свежесть и перезапросить живые записи; Promise ждёт перезапросы. cancel: false — дождаться летящего запроса и перезапросить после него */
export function invalidate(pattern: InvalidatePattern, opts?: { cancel?: boolean; refetch?: 'active' | 'all' | 'none' }): Promise<void>;

/** Положить данные в кэш cachedResource() вручную (ответ мутации, серверный payload). age — возраст данных в мс */
/** Положить данные в кэш: age — возраст в мс, staleTime — сколько они считаются свежими (default 0: SWR-ревалидация при монтировании) */
export function seed(key: string | CacheKeyPart[], data: unknown, opts?: { age?: number; staleTime?: number }): unknown;
/**
 * Засеять кэш из серверного HTML:
 *   <script type="application/json" data-aegis-cache="/api/users" data-aegis-age="120">[…]</script>
 * Идемпотентна; hydrate() вызывает её сама. Возвращает число засеянных записей.
 */
export function seedFrom(root?: Document | Element): number;
/** Предиктор переходов: марковская цепь 1-го порядка по паттернам маршрутов с забыванием (decay), серверным prior (kappa pseudo-counts) и persist в storage */
export interface Predictor {
    learn(from: string, to: string): void;
    /** ранжировать кандидатов: p = (счётчик + kappa·prior + alpha) / (n + kappa + alpha·|candidates|) */
    next(from: string, candidates: string[]): Array<{ key: string; p: number }>;
    p(from: string, to: string): number;
    /** серверный prior для from: { to: p } — или <script type="application/json" data-aegis-predict="from"> через seedFrom()/hydrate() */
    prior(from: string, map: Record<string, number>): void;
    reset(): void;
}
export function predictor(opts?: { decay?: number; alpha?: number; kappa?: number; storage?: Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null; key?: string; max?: number }): Predictor;
/** Speculation Rules для server-first страниц: один <script type="speculationrules"> с document-rules (prefetch / prerender по eagerness); без поддержки — <link rel="prefetch"> по намерению. Возвращает dispose */
export function speculate(opts?: { prefetch?: boolean; prerender?: boolean | 'conservative' | 'moderate' | 'eager'; eagerness?: 'conservative' | 'moderate' | 'eager'; select?: string; exclude?: string; urls?: string[] }): () => void;
/** Лидер среди вкладок (Web Locks): true ровно в одной вкладке, лок переходит при её закрытии; .release() — отдать; без Web Locks — fallback */
export function leader(name?: string, opts?: { fallback?: boolean }): ReadonlySignal<boolean> & { release(): void };

// ── Form ───────────────────────────────────────────────────────

export type ValidationRule<V = unknown> = (value: V, key: string, fields: Record<string, Signal<unknown>>, ctx?: { signal: AbortSignal | null; /** true — внутри computed истины (issues): правило должно быть чистым */ live?: boolean }) => string | null;
/** Правило может быть Standard Schema (zod/valibot/arktype): первый issue.message; async-схема — async-правило */
export type RuleLike<V = any> = ValidationRule<V> | AsyncValidationRule<V> | StandardSchemaV1<V, any>;
export type FormStatus = 'idle' | 'validating' | 'submitting' | 'success' | 'error';
/** Ссылка на поле: bind:field=${f.field('email')} — bind + touched + aria-invalid + aria-describedby + контейнер ошибки одной строкой */
export interface FieldRef<T = any> {
    key: string;
    value: Signal<T>;
    /** показанная ошибка */
    error: Signal<string | null>;
    /** истина: результат правил от текущего значения, независимо от показа */
    issue: ReadonlySignal<string | null>;
    touched: Signal<boolean>;
    validating: ReadonlySignal<boolean>;
    id: string;
    errorId: string;
}
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
    /** истина по полям: результат sync-правил и Standard Schema от текущих значений, пересчитывается реактивно; $any — есть хоть одна */
    issues: Record<string, ReadonlySignal<string | null>> & { $any: ReadonlySignal<boolean>; $form: ReadonlySignal<string | null> };
    touched: Record<string, Signal<boolean>>;
    /** valid и ничего не валидируется/не отправляется — для disabled кнопки */
    canSubmit: ReadonlySignal<boolean>;
    /** был хоть один submit */
    submitted: ReadonlySignal<boolean>;
    /** жизненный цикл отправки; submitting — computed от него */
    status: Signal<FormStatus>;
    /** прервать текущий submit (handler получает ctx.signal) */
    abort(): void;
    /** фокус на первую показанную ошибку */
    focusFirstError(): boolean;
    /** привязать инпут к полю (per-input слой: two-way, touched, режим показа, aria, :user-invalid); f.wire('email') — директива для html`` */
    wire(el: HTMLElement, key?: string): () => void;
    wire(key: string): Attachment<any>;
    /** ссылка на поле для bind:field=${f.field('email')} */
    field(key: string): FieldRef;
    /** оживить <form> целиком — все [name], как wireForm */
    attach(formEl: HTMLFormElement): HTMLFormElement;
    /** ключи полей (реактивно: форма растёт) */
    keys: ReadonlySignal<string[]>;
    /** вывод Standard Schema (coerce / trim / default) — уходит в submit вместо сырых values; null при issues */
    parsed: ReadonlySignal<any>;
    /** форма растёт: добавить поле (правила — явные или по шаблону 'items[].qty'), удалить, переименовать (сигналы переезжают) */
    addField(key: string, initial?: unknown, rules?: RuleLike[], opts?: { initial?: unknown }): Signal<any>;
    removeField(key: string): void;
    renameField(from: string, to: string): void;
    /** сводка ошибок GOV.UK: role=alert, заголовок с числом ошибок, ссылки на поля; при провале submit фокус идёт на неё */
    summary(target?: string | Element, opts?: { heading?: 'h2' | 'h3' | 'p' }): Element;
    /** показанные ошибки: [{ key, message, el }] — для своей сводки */
    errorList: ReadonlySignal<Array<{ key: string; message: string; el: HTMLElement | null }>>;
    /** защита от потери правок: beforeunload + перехват Navigation API с подтверждением; возвращает dispose */
    guard(opts?: GuardOptions): () => void;
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
export interface GuardOptions {
    /** своё подтверждение (диалог) — Promise<boolean>; по умолчанию window.confirm */
    confirm?: (toUrl: string) => boolean | Promise<boolean>;
    /** считать переход по якорю (#) уходом */
    hash?: boolean;
}
/** a11y-политика формы: field — как объявлять ошибку поля ('blur' — одно polite-объявление при blur, 'live' — span становится role=status, 'off'), summary — одно объявление при провале submit */
export interface FormA11y { field?: 'blur' | 'live' | 'off'; summary?: boolean }
export interface FormOptions {
    a11y?: FormA11y;
    /** при провале submit фокус на сводку (если есть) или на первое поле */
    focusOnError?: 'summary' | 'field' | false;
    types?: Record<string, typeof Date | typeof Number | typeof Array | typeof Boolean | typeof String>;
    rules?: Record<string, RuleLike[]>;
    schema?: StandardSchemaV1<any, any>;
    asyncDebounce?: number;
    /** когда ПОКАЗЫВАТЬ ошибки правил (истина всегда в issues): blur, затем live для полей с ошибкой (default) | live | только после submit */
    mode?: 'blur-then-live' | 'live' | 'submit';
    /** false — не трогать нативную валидацию (noValidate / setCustomValidity) */
    native?: boolean;
}
/** form(defaults, { rules, schema }) — форма из значений по умолчанию: form({ name: '', age: 0 }) */
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

/** Строка fieldArray(): key стабилен при перенумерации (ключ для list()), index — текущая позиция */
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
/**
 * Массив полей поверх form()/wireForm(): items[i][sub] с устойчивыми ключами строк и перенумерацией имён.
 *   const items = fieldArray(f, 'items', { row: { qty: 1, sku: '' } });   // правила формы: { 'items[].qty': [min(1)] }
 *   list(items.rows, row => html`<input bind:field=${row.field('qty')}>`, r => r.key)
 */
export interface WizardStep { index: number; keys(): string[]; valid: ReadonlySignal<boolean>; dirty: ReadonlySignal<boolean>; done: ReadonlySignal<boolean> }
export interface Wizard {
    step: Signal<number>;
    steps: WizardStep[];
    count: number;
    /** валидирует поля текущего шага (sync + async + схема только для них) и идёт дальше */
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
 * Мастер поверх form()/wireForm(): шаги — группы ключей ('address.*') или [data-step] у формы; фокус на новый шаг, announce «Шаг n из N»,
 * [data-step-nav] дети получают aria-current="step"; history: true — ?step=i через Navigation API; persist: 'key' — шаг в sessionStorage
 */
export function wizard(f: FormCore | WireFormResult, opts?: { steps?: string[][]; persist?: string; history?: boolean; focus?: boolean }): Wizard;
/** Черновик формы в sessionStorage: изменённые поля без password/file, восстановление при создании (dirty остаётся), очистка при успехе */
export function draft(f: FormCore | WireFormResult, key: string, opts?: { storage?: Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }; debounce?: number; ttl?: number; exclude?: (key: string, value: unknown) => boolean; restore?: (values: Record<string, unknown>, apply: () => void) => void }): { restored: boolean; clear(): void; stop(): void; key: string };
export function fieldArray<R extends Record<string, any>>(f: FormCore | WireFormResult, path: string, opts?: { row?: R; rules?: { [K in keyof R]?: RuleLike[] }; name?: (i: number, sub?: string) => string; initial?: Partial<R>[] }): FieldArray<R>;
export interface WireFormResult {
    /** сама <form> */
    el: HTMLFormElement;
    keys: ReadonlySignal<string[]>;
    parsed: ReadonlySignal<any>;
    /** подключить input, появившийся после wireForm(); отключить поле; пересканировать форму (после swap/morph/list) */
    wire(input: HTMLElement): void;
    unwire(key: string): void;
    rewire(): void;
    /** прочитать ошибки из (серверной) разметки формы в errors; true — есть хоть одна */
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
    /** истина по полям (sync-правила + схема), независимо от показа */
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
    /** handler(values, { signal, submitter, event }); без handler — серверный submit (FormData, 422 → ошибки полей, 303 → переход) */
    submit(handler?: ((values: Record<string, unknown>, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | undefined }) => unknown | Promise<unknown>) | { as?: 'json'; headers?: HeadersInit; onSuccess?: (data: any, r: Response) => void; onRedirect?: 'assign' | 'router' | 'none' | ((r: Response) => void); announceSuccess?: boolean; html?: 'morph' | 'replace' | false; intents?: Record<string, (f: WireFormResult, e: SubmitEvent) => void> }): (e?: Event) => Promise<any>;
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
    schema?: Record<string, RuleLike[]> | StandardSchemaV1<any, any>;
    rules?: Record<string, RuleLike[]>;
    /** когда показывать ошибки; истина всегда в issues */
    mode?: 'blur-then-live' | 'live' | 'submit';
    native?: boolean;
    asyncDebounce?: number;
    /** 'browser' — input.validationMessage на языке браузера; 'page' — коды ValidityState → словарь на языке страницы */
    messages?: 'browser' | 'page';
    submit?: boolean | ((values: Record<string, unknown>, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | undefined }) => unknown);
    onRedirect?: 'assign' | 'router' | 'none' | ((r: Response) => void);
    announceSuccess?: boolean;
    /** Escape во время отправки прерывает её */
    escapeAborts?: boolean;
    /** следить за появлением/удалением полей (MutationObserver) */
    observe?: boolean;
    /** приведение значений: { birthday: Date, qty: Number, tags: Array, agree: Boolean } */
    types?: Record<string, typeof Date | typeof Number | typeof Array | typeof Boolean | typeof String>;
    a11y?: FormA11y;
    focusOnError?: 'summary' | 'field' | false;
    /** сразу отрендерить сводку ошибок (true — контейнер перед формой) */
    summary?: boolean | string | Element;
    /** guard() сразу */
    guard?: boolean | GuardOptions;
    /** черновик в sessionStorage: ключ или true (action + id формы); также data-aegis-draft на <form> */
    draft?: string | boolean;
    /** HTML-ответ сервера (Rails 422 render, Django form_invalid): 'morph' (default) — форма морфится на место и ошибки читаются из разметки; 'replace'; false — не трогать */
    html?: 'morph' | 'replace' | false;
    /** <button name="intent" value="add"> или data-intent — локальное действие без запроса; без JS та же кнопка уходит на сервер */
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

/** @deprecated Use `mount(el, Component)` — the same setup contract, accepts an element or a selector. `component()` stays as an alias. */
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
/** Low-level positional form. Prefer `island(name, Component, { types })`; keep `register()` for `{ load }` (lazy island modules). */
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
export interface TrapOptions {
    /** true / 'first' — [data-autofocus] → первый tabbable → контейнер; 'container' — статичный контейнер (длинный текст, APG); селектор — свой элемент */
    autoFocus?: boolean | 'first' | 'container' | string;
    /** фокус, ушедший наружу (программно, из виджета), возвращается внутрь; default true */
    recapture?: boolean;
    /** Escape: true — release(), функция — свой обработчик */
    escape?: boolean | ((e: KeyboardEvent) => void);
    /** клик вне контейнера (и вне allow) */
    outside?: boolean | ((e: PointerEvent) => void);
    /** inert для фона */
    inert?: boolean;
    allow?: string;
    /** true — на элемент, активный до trap(); Element | () => Element — свой; если триггер удалён (строка list()) — ближайший живой сосед */
    returnFocus?: boolean | Element | (() => Element | null);
}
export function trap(container: Element, opts?: TrapOptions): (() => void) & { dispose(): void; refresh(): void };
/** Tabbable-элементы в порядке документа, включая открытые shadow root и <slot>; inert/hidden/disabled/tabindex<0/закрытые <details> исключены */
export function tabbables(root: Element | ShadowRoot): HTMLElement[];
export interface RovingOptions {
    selector?: string;
    /** 'grid' — Left/Right по ячейкам, Up/Down по строкам, Home/End в строке, Ctrl+Home/End, PageUp/Down */
    orientation?: 'horizontal' | 'vertical' | 'both' | 'grid';
    wrap?: boolean;
    /** grid: число колонок или 'auto' (по геометрии первой строки) */
    cols?: number | 'auto';
    /** шаг PageUp/PageDown (строк для grid) */
    page?: number;
    /** буква → ближайший элемент по тексту / aria-label, буфер 500 мс */
    typeahead?: boolean;
    /** инверсия горизонтали; 'auto' — по computed direction */
    dir?: 'ltr' | 'rtl' | 'auto';
    /** tab-stop: 'selected' — [aria-selected/checked/current], 'first', индекс */
    initial?: 'selected' | 'first' | number;
    /** aria-activedescendant-режим (combobox): фокус остаётся на этом input, клавиши слушаются на нём */
    virtual?: HTMLElement | null;
    /** MutationObserver: refresh при смене детей; удалённый активный → фокус на элемент с тем же индексом */
    observe?: boolean;
    /** tree: ArrowRight раскрывает (aria-expanded), ArrowLeft сворачивает или идёт к родителю */
    tree?: boolean;
    onActivate?: (el: Element, index: number) => void;
}
export function roving(container: Element, opts?: RovingOptions): { dispose(): void; moveFocus(delta: number): void; refresh(): void; active: ReadonlySignal<number>; setActive(i: number): void };
/**
 * Объявление для скринридера: два постоянных региона (polite → role=status, assertive → role=alert), очередь без потерь,
 * дедуп одинакового текста 500 мс, авто-очистка 7 с. Возвращает clear(). announce.init() создаёт регионы заранее.
 */
export function announce(message: string, politeness?: 'polite' | 'assertive'): () => void;
export function announce(message: string, opts: { politeness?: 'polite' | 'assertive'; clearAfter?: number | false; dedupe?: number; native?: boolean }): () => void;
/** реактивная форма: сигнал/функция → регион (в текущем scope); начальное значение не объявляется */
export function announce<T>(source: ReadonlySignal<T> | (() => T), opts?: { politeness?: 'polite' | 'assertive'; debounce?: number; format?: (v: T) => string | null | false; immediate?: boolean }): () => void;
export namespace announce { function init(): void; function clear(politeness?: 'polite' | 'assertive'): void; }
/** Реактивное объявление сигнала/функции с debounce: live(() => `${n.value} результатов`) */
export function live<T>(source: ReadonlySignal<T> | (() => T), opts?: { politeness?: 'polite' | 'assertive'; debounce?: number; format?: (v: T) => string | null | false; immediate?: boolean; clearAfter?: number | false }): () => void;
/** Занятость без disabled: aria-busy + aria-disabled + data-busy, клики/Enter глушатся, фокус остаётся на элементе */
export function busy(el: Element, pending: ReadonlySignal<boolean> | (() => boolean)): () => void;

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
/** @deprecated Use `element(tag, Component, { props })` — the same component function as islands and mount(). `defineElement()` stays as the low-level form. */
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
/** props маршрута-компонента: params + { data: результат loader, query } */
export type RouteComponentProps<P extends string = string, D = unknown> = RouteParams<P> & { data: D; query: Record<string, string> };
export interface RouteDef<D = unknown> {
    handler?: RouteHandler<D>;
    /** компонент-страница (контракт island()/mount()); монтируется в router({ outlet }) или в outlet родительского layout */
    component?: Component<RouteComponentProps<string, D>>;
    /** данные до dispose старой страницы; отменяется через signal при новой навигации */
    loader?: (params: Record<string, string>, ctx: { signal: AbortSignal | undefined; query: Record<string, string>; params: Record<string, string>; /** true — прогрев до перехода (hover / predict / r.preload): можно снизить priority */ speculative?: boolean }) => D | Promise<D>;
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
    /** прогрев кода и loader маршрута по намерению: 'hover' (замедление курсора или delay) | 'visible' | 'tap' | { on, delay: 80 | 'auto', velocity, rootMargin } */
    preload?: 'hover' | 'visible' | 'tap' | boolean | { on?: 'hover' | 'visible' | 'tap'; delay?: number | 'auto'; velocity?: number; rootMargin?: string };
    /** сколько мс прогретый loader ждёт перехода (default 30000) */
    preloadTTL?: number;
    /** false — preload греет только код маршрута, не loader */
    preloadData?: boolean;
    /** предиктор переходов: после каждого маршрута учится (pattern → pattern) и в idle греет top-K вероятных ссылок страницы (p ≥ minP, полезность > 0) */
    predict?: boolean | { predictor?: Predictor; topK?: number; minP?: number };
    scroll?: 'after-transition' | 'manual';
    /** false / Promise<false> — отменить переход (форма с guard); строка — редирект */
    beforeEach?: (to: RouteInfo, from: RouteInfo) => void | boolean | string | Promise<void | boolean | string>;
    /** пересоздавать scope при изменении только search (старое поведение) */
    searchReload?: boolean;
    /** маршруты в location.hash ('#/users/42', ссылки <a href="#/users/42">) — статический хостинг без rewrite-правил */
    hash?: boolean;
    /** куда монтировать маршруты { component } верхнего уровня */
    outlet?: string | Element;
    /** фокус после перехода: 'auto' — #fragment | [autofocus] | outlet/main/h1 с временным tabindex=-1; селектор | Element | функция | false */
    focus?: 'auto' | string | Element | ((root: Element | null) => Element | null) | false;
    /** объявление заголовка страницы после перехода (дедуп); функция — свой текст */
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
    /** прогреть маршрут (код + loader) до перехода в рамках бюджета сети; p — вероятность для порога полезности */
    preload(path: string, p?: number): Promise<void>;
    cleanup(): void;
    dispose(): void;
}
/**
 * Роутер поверх Navigation API (fallback: popstate + перехват <a>).
 * Вложенные маршруты с layout, async handler/loader (нативный индикатор, scroll после данных, отмена гонок),
 * guard/redirect как данные, search-параметры как сигналы, ленивые маршруты через import().
 * Не перехватывает: hash-ссылки, формы, download, data-aegis-reload, несовпавшие пути (уходят на сервер).
 */
export function router<R extends Record<string, unknown>>(routes: { [K in keyof R]: K extends string ? RouteHandler<any, K> | (RouteDef & { handler?: RouteHandler<any, K>; component?: Component<RouteComponentProps<K, any>> }) : never }, opts?: RouterOptions): Router;
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
/** @deprecated Use `resource(url, { offline: true })`. */
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
    prefetch?: 'hover' | 'visible' | 'tap' | boolean | { on?: 'hover' | 'visible' | 'tap'; delay?: number | 'auto'; velocity?: number; rootMargin?: string };
    /** предиктор: учится на aegis:load (пути нормализуются: числа → :id), в idle греет HTML top-K вероятных страниц */
    predict?: boolean | { predictor?: Predictor; topK?: number; minP?: number };
    scroll?: 'restore' | 'preserve';
    head?: 'title' | 'title+styles' | false;
    routers?: Router[];
    focus?: 'auto' | string | Element | false;
    announce?: boolean | ((to: { path: string }, from: null) => string | null);
}): { pending: ReadonlySignal<boolean>; visit(url: string): Promise<boolean>; /** прогреть HTML страницы в рамках бюджета сети */ prefetch(url: string, p?: number): Promise<void>; dispose(): void };

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
/** Сообщения правил: словарь (строка или plural-формы { one, few, many, other }), функция (code, params) => string | null, или t из i18n() — ключи <prefix><code>, локаль следует за t.locale */
export function setValidationMessages(dict: Record<string, string | Record<string, string>> | ((code: string, params?: Record<string, unknown>) => string | null) | TranslationFunction<any> | null, prefix?: string): void;
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
