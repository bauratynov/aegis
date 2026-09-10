/**
 * AEGIS — Frontend Engine
 * Zero-build, signal-based reactive UI for server-rendered pages.
 * Safety by architecture: everything created inside a scope dies with it, data never goes through innerHTML,
 * attribute sinks are typed at compile time. What the architecture cannot prevent, the dev build reports
 * with a code, a why and a fix (ERRORS.md); 'strict' mode turns those warnings into exceptions.
 *
 * @version 0.7.0
 * @license MIT
 */

// ============================================================================
// 0. DEV MODE & DIAGNOSTICS
// ============================================================================

/**
 * Dev-режим: явный window.__AEGIS_DEV__ побеждает; иначе включается сам на
 * localhost / 127.0.0.1 / file:// / *.local / *.test, при ?dev в URL модуля
 * или localStorage['aegis:dev'] = '1' (диагностика на проде у клиента без деплоя).
 * Результат кэшируется — проверка стоит одно сравнение.
 * __AEGIS_DEV__ = 'strict' — каждое предупреждение бросает AegisWarning (тесты).
 */
let _devCache;
/** Dev-режим. Вызовы обёрнуты в (!globalThis.AEGIS_PROD && _dev()) — прод-сборка с define сворачивает их в false и выкидывает dev-ветки */
function _dev() {
    if (_devCache !== undefined) return _devCache;
    const g = globalThis;
    let on;
    if (g.__AEGIS_DEV__ !== undefined) on = !!g.__AEGIS_DEV__;
    else {
        const loc = g.location;
        const h = (loc && loc.hostname) || '';
        on = (loc && loc.protocol === 'file:') || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local') || h.endsWith('.test');
        try { on = on || new URL(import.meta.url).searchParams.has('dev'); } catch (e) { /* no import.meta */ }
        try { on = on || g.localStorage?.getItem('aegis:dev') === '1'; } catch (e) { /* storage blocked */ }
        if (on && typeof console !== 'undefined') {
            console.info(`%c⚡ Aegis dev mode (${h || 'file'}). window.__AEGIS_DEV__ = false to silence.`, 'color:#58a6ff');
        }
    }
    return (_devCache = on);
}

/** Управление dev-режимом из консоли: Aegis.dev.enable() на проде + reload */
/**
 * Реестр поздней привязки между секциями. Лёгкие секции (ядро, request, DOM) не ссылаются на тяжёлые (кэш, формы)
 * по имени — иначе бандлер не может их выкинуть (tree-shaking) и вырезание секций ломается. Тяжёлая секция кладёт
 * сюда свои функции при первом реальном использовании (например, _cacheEntry), а лёгкая проверяет наличие.
 */
const _ext = {};
/**
 * Регистрация, привязанная к тяжёлой функции: const _t = _reg('x', x) с аннотацией @__PURE__ выполняется при загрузке
 * (ctx.fetch работает до первого вызова api()), но бандлер выкидывает её вместе с x, если x не нужен —
 * при условии, что _t упомянут внутри x (параметр по умолчанию).
 */
function _reg(...pairs) { for (let i = 0; i < pairs.length; i += 2) _ext[pairs[i]] = pairs[i + 1]; return pairs[1]; }
const dev = {
    get on() { return (!globalThis.AEGIS_PROD && _dev()); },
    enable() { try { localStorage.setItem('aegis:dev', '1'); } catch (e) { /* */ } _devCache = undefined; globalThis.__AEGIS_DEV__ = true; _devCache = true; },
    disable() { try { localStorage.removeItem('aegis:dev'); } catch (e) { /* */ } globalThis.__AEGIS_DEV__ = false; _devCache = false; },
    /** сбросить дедуп предупреждений (тесты) */
    resetWarnings() { _seenWarnings.clear(); },
    /** performance.measure / console.timeStamp на каждый flush в треке «Aegis» Performance-панели */
    profile(on = true) { _profiling = !!on; if (on && !_profileMark && typeof _installProfileMark === 'function') _installProfileMark(); },
    /** Реактивный мир острова по его DOM-узлу: Aegis.dev.of($0) */
    of(el) { return typeof _devTools === 'function' ? _devTools().of(el) : null; },
    /** JSON-снимок всех компонентов (или scope): для чата с ассистентом */
    inspect(root) { return typeof _devTools === 'function' ? _devTools().inspect(root) : []; },
    /** Граф зависимостей как Mermaid (graph LR) */
    graph(root) { return typeof _devTools === 'function' ? _devTools().graph(root) : 'graph LR'; },
    /** dev-overlay: предупреждения всплывают в углу страницы (false — только консоль; localStorage aegis:overlay=0) */
    overlay: true,
    /** Runtime-контракты графа/scope в dev: 'sampled' (default) | 'strict' (каждый flush — тесты) | false */
    contracts: 'sampled',
    /** Объяснение кода предупреждения (ERRORS.md) в консоль: Aegis.dev.explain('E019') */
    explain(code) { return import(/* @vite-ignore */ new URL('./aegis-devtools.js', import.meta.url).href).then(m => m.explain(code)); },
    /** EXPLAIN ANALYZE последних сверок list(): { plan: 'keyed' | 'rebuild', n, kept, lis, moves, ms } */
    plans() { return _ext.plans ? _ext.plans() : []; },
    /** Снимок кэша ресурсов: Aegis.dev.cache() → console.table */
    cache() { return _ext.cacheStats ? _ext.cacheStats() : []; },
    /** Панель инспектора в странице (aegis-devtools.js рядом с модулем): компоненты, сигналы, эффекты, stats, предупреждения */
    panel() { return import(/* @vite-ignore */ new URL('./aegis-devtools.js', import.meta.url).href).then(m => m.open()); },
};

export { dev };

const _seenWarnings = new Set();
const _warnHandlers = new Set();

/** Предупреждение движка как исключение (strict-режим) или значение для onWarn() */
export class AegisWarning extends Error {
    constructor(code, info) {
        super(`[Aegis:${code}] ${info.what}`);
        this.name = 'AegisWarning';
        this.code = code;
        this.what = info.what;
        this.why = info.why;
        this.fix = info.fix;
    }
}

/**
 * Подписка на предупреждения движка — assertions в тестах:
 *   const warns = []; const off = onWarn(w => warns.push(w.code)); …; expect(warns).toEqual([]);
 * Работает только в dev-режиме (там, где предупреждения вообще вычисляются).
 */
export function onWarn(fn) {
    _warnHandlers.add(fn);
    const off = () => { _warnHandlers.delete(fn); };
    if (_currentScope) _currentScope.onDispose(off);
    return off;
}

/** Elm-style three-part warning: what → why → fix. Каждое сообщение печатается один раз */
// Позиция в исходнике (dev): первый кадр стека вне aegis*.js — «At: /js/app.js:42:15». Chrome «at fn (url:l:c)», Firefox «fn@url:l:c».
let _curSite = null;   // позиция html``-шаблона, который сейчас разбирается/инстанцируется (наследуется его эффектами и предупреждениями)
function _callSite() {
    if (!(!globalThis.AEGIS_PROD && _dev())) return null;
    const lim = Error.stackTraceLimit;
    Error.stackTraceLimit = 16;
    const stack = new Error().stack || '';
    Error.stackTraceLimit = lim;
    for (const line of stack.split('\n')) {
        const m = /(?:^|[\s(@])((?:https?|file|blob):[^\s()]*?):(\d+):(\d+)\)?\s*$/.exec(line);
        if (!m) continue;
        const url = m[1];
        if (/\/aegis[^/]*\.(?:m?js)$/.test(url)) continue;   // aegis.js, aegis_full.js, aegis.min.js, aegis-devtools.js, aegis-test.js
        return { url, line: +m[2], col: +m[3], short: url.replace(/^[a-z]+:\/\/[^/]+/, '').replace(/\?.*$/, '') + ':' + m[2] + ':' + m[3] };   // без origin и query
    }
    return null;
}

let _curStrings = null;     // strings текущего html``-шаблона (для позиции конкретного ${})
let _curValueIndex = -1;    // индекс значения ${}, которое сейчас применяется
/** Promise<строка сниппета | null> — реализация в aegis-devtools.js (только dev, грузится один раз) */
function _snippet(at, strings, index, token) {
    if (!at || !at.url) return Promise.resolve(null);
    return _devtoolsModule().then(m => m && typeof m.snippet === 'function' ? m.snippet(at, strings, index, token) : null).catch(() => null);
}

/**
 * Dev-тексты предупреждений (what / why / fix). Прод-сборка вырезает их целиком: бандлер с define { AEGIS_PROD: 'true' }
 * (node build.mjs --from app.js делает это по умолчанию, --dev оставляет) сворачивает _DT в false, и объекты
 * в _warn('Exx', !globalThis.AEGIS_PROD && { … }) исчезают вместе с текстами. Без define (zero-build) тексты на месте.
 */
function _warn(code, details, onceKey) {
    if (!(!globalThis.AEGIS_PROD && _dev()) || !details) return;
    const { what, why, fix, el, site, token } = details;
    const key = code + '|' + (onceKey ?? what);
    if (_seenWarnings.has(key)) return;
    _seenWarnings.add(key);
    const where = typeof _scopePath === 'function' && _currentScope ? _scopePath(_currentScope) : '';
    const at = site || _curSite;
    const info = { code, what, why, fix, where: where || null, el: el || null, site: at ? at.short : null, url: at ? at.url : null, snippet: null };
    const strings = site ? null : _curStrings, vIndex = site ? -1 : _curValueIndex;
    info.snippet = _snippet(at, strings, vIndex, token);
    for (const h of _warnHandlers) h(info);
    if (globalThis.__AEGIS_DEV__ === 'strict') throw new AegisWarning(code, info);
    const msg = `⚠ [Aegis:${code}] ${what}\n` +
        `  Why: ${why}\n` +
        `  Fix: ${fix}` +
        (where ? `\n  Where: ${where}` : '') +
        (at ? `\n  At: ${at.short}` : '') +
        `\n  Docs: Aegis.dev.explain('${code}')`;
    // сниппет исходника приходит асинхронно (fetch файла один раз на URL) — печать откладывается до него
    info.snippet.then((sn) => {
        const full = sn ? msg.replace(/\n  Docs:/, '\n' + sn + '\n  Docs:') : msg;
        if (el) console.warn(full + '\n  Element:', el); else console.warn(full);
        info.snippetText = sn;
        if (dev.overlay !== false && typeof document !== 'undefined' && !_overlayOff()) _overlayNotify(info);
    });
}
const _overlayOff = () => { try { return localStorage.getItem('aegis:overlay') === '0'; } catch (e) { return false; } };
let _overlayMod = null;
const _devtoolsModule = () => _overlayMod || (_overlayMod = import(/* @vite-ignore */ new URL('./aegis-devtools.js', import.meta.url).href).catch(() => null));
function _overlayNotify(info) { _devtoolsModule().then(m => { if (m && typeof m.notify === 'function') m.notify(info); }); }
// ?aegis-devtools in the page URL loads the inspector next to the module; the module opens its panel by itself
if (typeof location !== 'undefined' && /[?&]aegis-devtools\b/.test(location.search)) _devtoolsModule();

// Prototype pollution deny-list (используется proxy-обёртками store/reactive)
const _DENIED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
/** JSON.parse с reviver: ключи __proto__/constructor/prototype выбрасываются — единственная точка разбора данных снаружи */
const _reviver = (k, v) => (_DENIED_KEYS.has(k) ? undefined : v);
function _safeParse(text) { return JSON.parse(text, _reviver); }
/** Снять опасные ключи с уже разобранного объекта (данные из сторонних парсеров) */
function _stripDenied(o, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 32) return o;
    for (const k of Object.keys(o)) { if (_DENIED_KEYS.has(k)) delete o[k]; else if (o[k] && typeof o[k] === 'object') _stripDenied(o[k], depth + 1); }
    return o;
}
const _TRUST = /*#__PURE__*/ Symbol('aegis.trusted');
/** Автор ручается за значение (URL с нестандартной схемой, TrustedHTML-подобное): trusted(v) обходит sink-проверки html`` */
export function trusted(v) { return { [_TRUST]: v }; }

// ============================================================================
// 1. REACTIVE CORE — Signals, Computed, Effect, Batch
//
//    Модель:
//      Source   — Signal или Computed: { subs: Set<Observer>|null, version() }
//      Observer — Effect, Computed или Subscriber:
//                 { _isComputed, _disposed, _deps: Source[], _vers: number[], _run() }
//
//    Классы с методами на прототипе и ленивым subs — десятки байт на сигнал,
//    а не килобайт замыканий. Зависимости — параллельные массивы deps/vers:
//    k-е чтение того же источника не трогает граф, отписывается только то,
//    что в этом запуске не читалось.
//
//    Распространение в две фазы:
//      push — запись сигнала синхронно помечает computed'ы dirty по цепочке
//             и кладёт effects в очередь (без копий Set, флаг _queued);
//      pull — при flush каждый effect сравнивает версии своих зависимостей
//             (computed при этом лениво пересчитываются) и запускается только
//             если хотя бы одна реально изменилась. Это даёт glitch-free
//             семантику: effect никогда не видит промежуточных состояний и не
//             запускается, если computed пересчитался в то же значение.
// ============================================================================

let _tracking = null;        // текущий observer для auto-track
let _batchDepth = 0;         // глубина batch() (тело effect и обработчики on() — тоже неявный batch)
let _notifyDepth = 0;        // вложенность _notify — flush только на выходе из внешнего
let _flushing = false;       // идёт flush — вложенные записи только пополняют очередь
let _qa = [], _qb = [];      // очередь эффектов: два буфера, раунд меняет их местами (без аллокаций на flush)
let _qSorted = true, _qLastOrd = 0, _qEdges = false;   // отсортированность по _ord и наличие выученных рёбер — считаются при enqueue
let _epoch = 0;              // глобальный счётчик версий
const _epochDur = [0, 0, 0, 0];   // эпоха последней записи сигнала с durability ≥ d (Salsa): неживой computed сверяется только со своим уровнем; [3] = ⊤ (константы)
let _win = 0;                // окно backdating: внешний batch / запуск эффекта / раунд flush — запись «туда и обратно» внутри окна не меняет версию
let _runSeq = 0;             // штамп запуска observer'а: k-е чтение того же источника в одном запуске — O(1) без мутаций графа
let _writer = null;          // эффект, выполняющийся сейчас: его записи становятся выученными рёбрами writer → observer для порядка раунда
const _MAX_ROUNDS = 100;     // раундов flush до признания цикла бесконечным
// ---- планировщик: время и очереди платформы через одну точку (подменяется useScheduler / fakeScheduler в тестах)
let _sched = {
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    micro: (f) => queueMicrotask(f),
    frame: (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : setTimeout(f, 16)),
    idle: (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f) : setTimeout(() => f({ timeRemaining: () => 50, didTimeout: true }), 1)),
    yield: () => (globalThis.scheduler && typeof scheduler.yield === 'function') ? scheduler.yield()
        : new Promise(r => { if (typeof setImmediate === 'function') setImmediate(r); else if (typeof MessageChannel === 'function') { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); } else setTimeout(r, 0); }),   // MessageChannel: макрозадача без 4-мс клампа; порт закрывается, чтобы не держать event loop
    inputPending: () => !!(typeof navigator !== 'undefined' && navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending({ includeContinuous: false })),
    onRun: null,             // (obs, lane) — трассировка запусков (fakeScheduler / профилировщик)
};
/** Подменить время и очереди планировщика (тесты, симуляции): useScheduler({ now, micro, frame, idle, yield, inputPending }) → restore */
export function useScheduler(impl) { const prev = _sched; _sched = { ...prev, ...impl }; return () => { _sched = prev; }; }
/**
 * Классы дедлайнов (EDF): полоса — не приоритет, а срок от причины записи. input: обработчик on() — синхронно, пока не истёк
 * бюджет long task (40 мс) и нет ожидающего ввода, остаток — продолжениями через scheduler.yield() срезами по 8 мс;
 * transition: startTransition() — никогда синхронно, latest-wins, старый UI виден; idle: effect(fn, { flush: 'idle' }).
 * Вытеснение только на границе компонент-группы (корневой scope), чтобы один компонент не рвался между кадрами.
 */
const _D = { input: 50, transition: 250, idle: 2000 };
let _cause = null;           // { lane, t0 } — причина текущей записи (on() → input, startTransition → transition)
const _heap = [];            // min-heap наблюдателей по дедлайну _dl (tie-break — порядок создания)
let _heapArmed = false, _slicing = false, _transCount = 0;
const _settleRes = [];       // ожидающие nextTick(): резолвятся, когда heap и полосы пусты
function _hless(a, b) { return a._dl < b._dl || (a._dl === b._dl && a._ord < b._ord); }
function _hpush(o) { const h = _heap; h.push(o); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!_hless(h[i], h[p])) break; [h[i], h[p]] = [h[p], h[i]]; i = p; } }
function _hpop() {
    const h = _heap, top = h[0], last = h.pop();
    if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && _hless(h[l], h[m])) m = l; if (r < h.length && _hless(h[r], h[m])) m = r; if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m; } }
    return top;
}
// флаги observer'ов — одно Smi-слово вместо девяти булевых полей (один hidden class, один and+branch)
const F_COMPUTED = 1, F_DIRTY = 2, F_COMPUTING = 4, F_DISPOSED = 8, F_LIVE = 16, F_QUEUED = 32, F_COUNTED = 64, F_TRACE = 128, F_OWN = 256, F_ASYNC = 512;
const _DUR = { low: 0, medium: 1, high: 2 };

const SIGNAL = /*#__PURE__*/ Symbol('aegis.signal');

const _alwaysFalse = () => false;
function _nm(o) { return typeof o === 'string' ? o : (o && o.name) || null; }
function _initialOf(o) { return o && typeof o === 'object' && 'initial' in o ? o.initial : undefined; }
function _eqOf(o) {
    if (typeof o === 'string' || !o) return Object.is;
    const eq = o.equals;
    return eq == null ? Object.is : (eq === false ? _alwaysFalse : eq);  // equals:false — «уведомлять всегда»
}

// ---- tracking ---------------------------------------------------------------

/** Добавить подписчика; первый подписчик оживляет computed (подписка на его источники) и зовёт watched() сигнала */
function _addSub(src, obs) {
    const st = src.subs || (src.subs = new Set());
    if (!st.size) { if (src._isComputed) { if (!src._live) src._activate(); } else if (src._w) src._w(); }
    st.add(obs);
}
/** Убрать подписчика; последний ушёл — computed отписывается от источников, сигнал зовёт unwatched() */
function _delSub(src, obs) {
    const st = src.subs;
    if (!st || !st.delete(obs) || st.size) return;
    if (src._isComputed) { if (src._live) src._deactivate(); } else if (src._u) src._u();
}

/** Подписать текущий observer на источник; k-е чтение того же источника в одном запуске — O(1) по штампу, без мутаций графа */
function _track(src) {
    const obs = _tracking;
    if (!obs) return;
    if (src._ms === obs._rs && src._mo === obs._ord) return;   // уже прочитан в этом запуске (штамп + порядковый номер читателя — без удержания объекта)
    src._ms = obs._rs; src._mo = obs._ord;
    const deps = obs._deps || (obs._deps = []);
    const vers = obs._vers || (obs._vers = []);
    const i = obs._n;
    if (i < deps.length && deps[i] === src) {        // стабильная позиция — только версия
        vers[i] = src.version();
        obs._n = i + 1;
        return;
    }
    for (let j = i > 8 ? i - 8 : 0; j < i; j++) if (deps[j] === src) return;   // штамп перебит вложенным пересчётом (c читает s, потом d, которое тоже читает s): короткий скан назад, O(1) на новый источник
    if (i < deps.length) (obs._evict || (obs._evict = [])).push(deps[i]); // вытеснили другой источник
    deps[i] = src;
    vers[i] = src.version();
    if (!obs._isComputed || (obs._f & F_LIVE)) _addSub(src, obs);   // неживой computed только запоминает dep — подпишется, когда на него подпишутся
    obs._n = i + 1;
}

/** Завершить запуск: обрезать непрочитанный хвост и отписать источники, которых больше нет */
function _endTrack(obs) {
    const deps = obs._deps;
    if (!deps) return;
    const n = obs._n, ev = obs._evict, tail = deps.length - n;
    if (!ev && !tail) return;                                    // стабильный запуск — ноль работы
    if ((ev ? ev.length : 0) + tail <= 8) {                       // 1–2 смены зависимостей: линейный скан без аллокаций
        for (let i = n; i < deps.length; i++) _unsubIfGone(obs, deps[i], deps, n);
        deps.length = n; obs._vers.length = n;
        if (ev) { obs._evict = null; for (const src of ev) _unsubIfGone(obs, src, deps, n); }
        return;
    }
    // массовый сдвиг (unshift/sort/filter в reactive-массиве): одно множество живых источников — O(n), а не O(n²)
    const gone = deps.splice(n); obs._vers.length = n;
    const live = new Set(deps);
    for (let i = 0; i < gone.length; i++) if (!live.has(gone[i])) _delSub(gone[i], obs);
    if (ev) { obs._evict = null; for (let i = 0; i < ev.length; i++) if (!live.has(ev[i])) _delSub(ev[i], obs); }
}

function _unsubIfGone(obs, src, deps, n) {
    for (let i = 0; i < n; i++) if (deps[i] === src) return;
    _delSub(src, obs);
}

/** Отписать observer от всех источников */
function _unsubscribe(obs) {
    const deps = obs._deps;
    if (deps) {
        for (let i = 0; i < deps.length; i++) _delSub(deps[i], obs);
        deps.length = 0;
        obs._vers.length = 0;
    }
    obs._n = 0;
    obs._evict = null;
}

/** Список изменившихся зависимостей (для ошибок и trace) */
function _changedDeps(obs) {
    const out = [];
    const deps = obs._deps, vers = obs._vers;
    if (!deps) return out;
    for (let i = 0; i < deps.length; i++) {
        if (deps[i].version() !== vers[i]) out.push({ name: deps[i]._name || 'signal', value: deps[i]._err ? '<error>' : _short(deps[i].peek()) });
    }
    return out;
}
function _short(v) {
    try { const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; } catch (e) { return String(v); }
}

/** Изменилась ли хоть одна зависимость с момента последнего запуска */
function _depsChanged(obs) {
    const deps = obs._deps, vers = obs._vers;
    for (let i = 0; i < deps.length; i++) {
        const src = deps[i];
        if (src._f === undefined) { if (src.version() !== vers[i]) return true; continue; }   // адаптер (lens, store, list:index) — через метод
        if ((src._f & F_COMPUTED) && src._stale()) src._recompute();
        if (src._version !== vers[i]) return true;
    }
    return false;
}

// ---- Signal ------------------------------------------------------------------

/** Общая форма источника: Signal и Computed наследуют её, чтобы deps[i]._version / .subs были мономорфны */
class _Src {
    constructor(name) {
        this.subs = null;
        this._version = 0;
        this._name = name;
        this._w = null;            // watched(): появился первый подписчик
        this._u = null;            // unwatched(): ушёл последний
        this._traceSet = false;
        this._dur = 0;             // durability: 0 low · 1 medium · 2 high (computed — минимум по источникам, 3 = константа)
        this._ms = 0; this._mo = 0;   // штамп последнего чтения и порядковый номер читателя (_track)
    }
    version() { return this._version; }
}
class Signal extends _Src {
    constructor(value, name, eq, w, u, dur) {
        super(name);
        this._value = value;
        this._version = ++_epoch;
        this._eq = eq;
        this._w = w || null;
        this._u = u || null;
        this._dur = dur | 0;
        this._bw = 0; this._bv = undefined; this._bver = 0;   // окно backdating: значение и версия на входе в окно
    }
    get value() {
        if (_tracking) _track(this); else if (_devCache === true) _noteUntracked(this);
        return this._value;
    }
    set value(v) {
        if (_tracking && _tracking._isComputed) {
            _warn('E002', !globalThis.AEGIS_PROD && {
                what: `Signal "${this._name || '?'}" written inside computed "${_tracking._name || '?'}".`,
                why: 'Computeds must be pure — writing signals causes infinite loops or glitches.',
                fix: 'Move the write into an effect() or a method/action.',
            });
        }
        if (this._eq(this._value, v)) {
            if (_devCache === true && v !== null && typeof v === 'object' && v === this._value && !(this._name && this._name.includes(':'))) _warn('E047', !globalThis.AEGIS_PROD && {
                what: `signal "${this._name || '?'}": the same object reference was written back — nothing happens.`,
                why: 'Signals compare by identity (Object.is); mutations inside the object (push / splice / prop =) are invisible.',
                fix: 'sig.update(a => [...a, x]) or sig.value = { ...o, k: v }; hold the object in reactive(), or use signal(v, { equals: false }).',
            }, 'sameRef:' + (this._name || ''));
            return;
        }
        if (this._traceSet) { console.groupCollapsed(`▸ [Aegis] signal "${this._name || '?'}" set ${_short(this._value)} → ${_short(v)}`); console.trace(); console.groupEnd(); }
        const e = ++_epoch;
        if ((_batchDepth > 0 || _flushing) && this._eq !== _alwaysFalse) {
            // value-anchored versions (Salsa backdating для входов): вернулись к значению на входе в окно — версия тоже прежняя,
            // и наблюдатели с той версией не перезапускаются (batch — транзакция: наблюдаемо только конечное состояние)
            if (this._bw !== _win) { this._bw = _win; this._bv = this._value; this._bver = this._version; }
            this._value = v;
            this._version = this._eq(v, this._bv) ? this._bver : e;
        } else { this._value = v; this._version = e; }
        for (let d = 0; d <= this._dur; d++) _epochDur[d] = e;
        if (this.subs) _notify(this.subs);
    }
    /** Прочитать без подписки */
    peek() { return this._value; }
    /** Ручная подписка: fn(value) при каждом реальном изменении (возвращает unsubscribe) */
    subscribe(fn) { return _subscribe(this, fn); }
    /** Обновить через функцию: sig.update(v => v + 1) */
    update(fn) { this.value = fn(this._value); }
    toJSON() { return this._value; }
    toString() { return `Signal(${this._name || '?'}: ${this._value})`; }
}
Signal.prototype[SIGNAL] = true;

/**
 * Создать реактивный сигнал
 * @template T
 * @param {T} initial
 * @param {string|Object} [nameOrOpts] — имя для debug, или { name, equals }
 * @returns {Signal<T>}
 */
// dev: последние сигналы, прочитанные вне tracking — html`` сверяет с ними статические значения (${count.value} — снимок, E048)
let _untracked = null, _untrackedFlush = false;
function _noteUntracked(sig) {
    const r = _untracked || (_untracked = []);
    if (r.length >= 16) r.shift();
    r.push({ s: sig, v: sig._value });
    if (!_untrackedFlush) { _untrackedFlush = true; queueMicrotask(() => { _untrackedFlush = false; _untracked = null; }); }
}
/**
 * Именованные сигналы из объекта: имена берутся из ключей — для E-сообщений, trace(), dev.graph().
 *   const { count, query } = signals({ count: 0, query: '' });                                   // signal(0, 'count'), signal('', 'query')
 *   const { items, total } = signals({ items: [], get total() { return items.value.length; } }); // геттер → computed('total')
 */
export function signals(obj, { prefix } = {}) {
    const out = {};
    const descs = Object.getOwnPropertyDescriptors(obj);
    for (const k of Object.keys(descs)) {
        const d = descs[k], nm = prefix ? prefix + '.' + k : k;
        out[k] = d.get ? computed(() => d.get.call(out), nm) : signal(d.value, nm);
    }
    return out;
}
export function signal(initial, nameOrOpts) {
    const o = nameOrOpts && typeof nameOrOpts === 'object' ? nameOrOpts : null;
    return new Signal(initial, _nm(nameOrOpts), _eqOf(nameOrOpts), o && o.watched, o && o.unwatched, o && _DUR[o.durability]);   // durability: 'low' | 'medium' | 'high' — конфиг/локаль/тема пишутся редко, их производные не перепроверяются после каждой записи
}

/** Отладка: печатать стек каждой записи в сигнал (trace(sig)) или причину перезапуска эффекта (effect(fn, { trace: true })) */
export function trace(sig, on = true) {
    if (sig && typeof sig === 'object') sig._traceSet = on;
    return sig;
}

/** Является ли объект сигналом (signal или computed) */
export function isSignal(v) {
    return v != null && v[SIGNAL] === true;
}

// ---- Computed ----------------------------------------------------------------

class Computed extends _Src {
    constructor(fn, name, eq, initial) {
        super(name);
        this._ord = ++_ordSeq;
        this._fn = fn;
        this._value = initial;
        this._eq = eq;
        this._f = F_COMPUTED | F_DIRTY;
        this._deps = null;
        this._vers = null;
        this._n = 0;
        this._evict = null;
        this._unreg = null;
        this._err = null;          // { e } — кэшированное исключение: перебрасывается при чтении, пока не изменится зависимость
        this._chk = -1;            // _epoch последней проверки: неживому push не приходит — сверяем версии при чтении
        this._rs = 0;              // штамп текущего запуска (_track)
    }
    get _dirty() { return (this._f & F_DIRTY) !== 0; }
    get _disposed() { return (this._f & F_DISPOSED) !== 0; }
    get _live() { return (this._f & F_LIVE) !== 0; }
    /** Нужен пересчёт/проверка: помечен dirty, или неживой и с прошлой проверки была запись на его уровне durability */
    _stale() { return !(this._f & F_DISPOSED) && ((this._f & F_DIRTY) !== 0 || (!(this._f & F_LIVE) && this._chk < _epochDur[this._dur])); }   // a disposed computed is frozen (E045): no recompute on read, whatever the sources did
    _activate() { this._f |= F_LIVE; _regObs(this, true); const d = this._deps; if (d) for (let i = 0; i < d.length; i++) _addSub(d[i], this); }
    _deactivate() { this._f &= ~F_LIVE; _regObs(this, false); const d = this._deps; if (d) for (let i = 0; i < d.length; i++) _delSub(d[i], this); }
    get value() {
        if (this._stale()) this._recompute();
        if ((this._f & F_DISPOSED) && _devCache === true) _deadRead(this);
        if (_tracking) _track(this); else if (_devCache === true) _noteUntracked(this);   // подписка ДО броска: читатель узнает о выздоровлении
        if (this._err) throw this._err.e;
        return this._value;
    }
    /** Прочитать без подписки (зависимости самого computed переподписываются как обычно) */
    peek() {
        if (this._stale()) this._recompute();
        if ((this._f & F_DISPOSED) && _devCache === true) _deadRead(this);
        if (this._err) throw this._err.e;
        return this._value;
    }
    /** Версия значения; никогда не бросает (ошибка — тоже версия) */
    version() {
        if (this._stale()) this._recompute();
        return this._version;
    }
    subscribe(fn) { return _subscribe(this, fn); }
    dispose() {
        if (this._f & F_DISPOSED) return;
        this._f |= F_DISPOSED;
        _regObs(this, false);
        _unsubscribe(this);
        if (this.subs) this.subs.clear();
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
    /** push-фаза: пометить dirty и передать дальше */
    _run() {
        if (this._f & (F_DIRTY | F_DISPOSED)) return;
        this._f |= F_DIRTY;
        if (this.subs) _notify(this.subs);
    }
    _recompute() {
        if (this._f & F_COMPUTING) {         // цикл — тоже кэшированная ошибка, граф не рвётся
            this._err = { e: new Error(`[Aegis] Circular dependency in computed "${this._name || '?'}"`) };
            this._version = ++_epoch;
            return;
        }
        this._f |= F_COMPUTING;
        const prev = _tracking;
        try {
            // Bailout: помечен dirty, но ни одна зависимость не изменила версию
            // (например, upstream computed пересчитался в то же значение)
            if (this._deps && this._deps.length > 0 && !_depsChanged(this)) {
                this._f &= ~F_DIRTY; this._chk = _epoch;
                return;
            }
            this._n = 0;
            this._rs = ++_runSeq;
            _tracking = this;
            let v, err = null;
            try {
                v = this._fn(this._value);   // computed((prev) => …, { initial }) — предыдущее значение
            } catch (e) {
                err = { e };
            }
            _tracking = prev;
            _endTrack(this);                 // deps, прочитанные до броска, остаются подписаны — push дойдёт при исправлении данных
            if (err) { this._err = err; this._version = ++_epoch; }
            else if (this._version === 0 || this._err || !this._eq(this._value, v)) {   // выздоровление — новая версия даже при равном значении
                this._err = null;
                this._value = v;
                this._version = ++_epoch;
            }
            // durability = минимум по источникам (meet в цепочке); без источников — ⊤: константа никогда не перепроверяется; после ошибки — 0
            const d = this._deps; let m = 3;
            if (d) for (let i = 0; i < d.length; i++) { const k = d[i]._dur | 0; if (k < m) m = k; }
            this._dur = err ? 0 : m;
            this._f &= ~F_DIRTY; this._chk = _epoch;
        } finally {
            _tracking = prev;
            this._f &= ~F_COMPUTING;
        }
    }
    toJSON() { return this.peek(); }
    toString() { return `Computed(${this._name || '?'}: ${(this._f & F_DIRTY) ? '<stale>' : this._err ? '<error>' : this._value})`; }
}
Computed.prototype[SIGNAL] = true;
Computed.prototype._isComputed = true;

/**
 * Вычисляемое значение (ленивое, кэшированное)
 * Пересчитывается только когда зависимости реально изменились (по версиям);
 * версия самого computed растёт только при изменении результата.
 */
export function computed(fn, nameOrOpts) {
    return new Computed(fn, _nm(nameOrOpts), _eqOf(nameOrOpts), _initialOf(nameOrOpts));   // scope не нужен: без подписчиков computed не подписан ни на что
}
/** dev: чтение уничтоженного computed — значение заморожено (E045) */
function _deadRead(c) {
    _warn('E045', !globalThis.AEGIS_PROD && {
        what: `computed "${c._name || '?'}" read after dispose() — its value is frozen at ${_short(c._value)}${_tracking ? ` (read by "${_tracking._name}")` : ''}.`,
        why: 'A disposed computed never recomputes; the reader keeps showing the last value while the sources change.',
        fix: 'Do not dispose a computed that is still read; computed() needs no dispose at all — it is unsubscribed while nobody observes it.',
    }, 'dead:' + (c._name || '?'));
}

// ---- Effect ------------------------------------------------------------------

/** Усыновить disposer текущим запуском эффекта: effect/on/interval/subscribe/createScope в теле эффекта живут до его перезапуска (Solid/Svelte 5) */
function _adopt(dispose) {
    const t = _tracking;
    if (t && !t._isComputed && (t._f & F_OWN)) { (t._kids || (t._kids = [])).push(dispose); if (dispose._node) dispose._node._pe = t; }   // _pe: владелец раньше усыновлённого в раунде
}
/** L1: если сейчас идёт запуск эффекта-владельца — усыновить и вернуть true (в scope не регистрировать) */
function _ownByRun(dispose) {
    const t = _tracking;
    if (!(t && !t._isComputed && (t._f & F_OWN))) return false;
    _adopt(dispose);
    return true;
}
// ---- runtime-контракты графа (dev): реестр живых наблюдателей и проверка инвариантов после flush; в проде складывается
let _obsReg = null;
function _regObs(o, on) { if (globalThis.AEGIS_PROD || !_dev()) return; if (on) (_obsReg || (_obsReg = new Set())).add(o); else if (_obsReg) _obsReg.delete(o); }
/**
 * Инварианты, которые фаззер проверяет на синтетических графах, здесь проверяются на каждом реальном flush:
 * подписки ⇔ зависимости, живой computed ⇔ есть подписчики, нет уничтоженных в subs, нет застрявших в очереди,
 * счётчики глубины в покое. dev.contracts: 'sampled' (default, ~64 проверок на сессию) | 'strict' (каждый flush; тесты) | false
 */
function _checkGraph(where) {
    if (globalThis.AEGIS_PROD || !_obsReg || !_dev()) return;
    const mode = dev.contracts;
    if (!mode || (mode !== 'strict' && Math.random() > Math.min(1, 64 / (_stats.flushes + 1)))) return;
    const bad = [];
    const idle = !_flushing && !_laneScheduled.micro && !_laneScheduled.frame && _batchDepth === 0;
    for (const o of _obsReg) {
        if (o._f & F_DISPOSED) { bad.push(`disposed "${o._name}" still registered`); continue; }
        if (o._isComputed && !(o._f & F_LIVE)) { bad.push(`inactive computed "${o._name}" registered`); continue; }
        if ((o._f & F_QUEUED) && idle) bad.push(`"${o._name}" stranded in the queue`);
        const d = o._deps;
        if (d) for (let i = 0; i < d.length; i++) {
            const src = d[i];
            if (!(src.subs && src.subs.has(o))) bad.push(`"${o._name}" → "${src._name || 'signal'}": missing back-edge`);
            if (src._isComputed && src._f !== undefined && !(src._f & F_LIVE)) bad.push(`"${o._name}" reads inactive computed "${src._name}"`);
        }
        if (o._src && !(o._src.subs && o._src.subs.has(o))) bad.push(`subscriber not in "${o._src._name || 'signal'}".subs`);
        if (o.subs) for (const x of o.subs) {
            if (x._f & F_DISPOSED) bad.push(`"${o._name}".subs keeps disposed "${x._name}"`);
            else if (x._src !== o && !(x._deps && x._deps.includes(o))) bad.push(`"${o._name}".subs has "${x._name}" without a dependency`);
        }
    }
    if (idle && (_batchDepth || _notifyDepth)) bad.push(`depth counters not at rest (${_batchDepth}/${_notifyDepth})`);
    if (bad.length) _warn('E051', !globalThis.AEGIS_PROD && {
        what: `reactive-graph invariant broken at ${where}: ${bad[0]}${bad.length > 1 ? ` (+${bad.length - 1} more)` : ''}.`,
        why: 'Internal graph state is inconsistent — this is an engine bug, not an application bug.',
        fix: 'Report it with the steps to reproduce; dev.contracts = false silences the check meanwhile.',
    }, 'inv:' + bad[0].slice(0, 48));
}
/** Дерево scope: каждый ребёнок в children живой и указывает на родителя; уничтоженный — без детей и disposers */
function _checkScopes(sc) {
    if (globalThis.AEGIS_PROD || !sc || !_dev() || !dev.contracts) return;
    const bad = [];
    const walk = (x, depth) => {
        if (depth > 64) return;
        if (x.children) for (const c of x.children) {
            if (c._disposed) bad.push(`disposed child "${c.name}" in "${x.name}".children`);
            else if (c.parent !== x) bad.push(`"${c.name}".parent is not "${x.name}"`);
            else walk(c, depth + 1);
        }
        if (x._disposed && (x.children || x._disposers.size)) bad.push(`disposed "${x.name}" keeps children/disposers`);
    };
    walk(sc, 0);
    if (bad.length) _warn('E051', !globalThis.AEGIS_PROD && { what: `scope-tree invariant broken: ${bad[0]}${bad.length > 1 ? ` (+${bad.length - 1} more)` : ''}.`, why: 'Internal scope state is inconsistent — this is an engine bug, not an application bug.', fix: 'Report it with the steps to reproduce; dev.contracts = false silences the check meanwhile.' }, 'inv:scope:' + bad[0].slice(0, 40));
}
function _killKids(node) {
    const k = node._kids; if (!k) return;
    node._kids = null;
    for (let i = k.length - 1; i >= 0; i--) { try { k[i](); } catch (e) { console.error('[Aegis] child dispose error:', e); } }
}
let _ordSeq = 0;                                   // порядок создания observers: родитель всегда раньше своих детей
const _byOrd = (a, b) => a._ord - b._ord;
function _insertByOrd(arr, o) { let i = arr.length; while (i > 0 && arr[i - 1]._ord > o._ord) i--; arr.splice(i, 0, o); }
/**
 * Порядок раунда. Быстрый путь — порядок создания (родитель раньше детей). Если в раунде есть эффекты с выученными
 * рёбрами (writer → observer: эффект W записал сигнал, который читает R), раунд сортируется по Кану с приоритетом _ord:
 * R идёт после W и не запускается дважды (stale → correct). Остаток после Кана = цикл записей в этом раунде — E027 сразу,
 * с именами, а не после 100 раундов. Рёбра переучиваются каждым запуском; корректность от них не зависит (pull решает, что бежит).
 */
function _ordered(round, sorted) {
    let mono = sorted === true, edges = _qEdges;
    if (sorted === undefined) { mono = true; edges = false; for (let i = 0; i < round.length; i++) { if (i && round[i]._ord < round[i - 1]._ord) mono = false; if (round[i]._fan) edges = true; } }
    if (!edges) { if (!mono) { _stats.reordered++; round.sort(_byOrd); } return round; }
    const inR = new Set(round), indeg = new Map(), out = new Map();
    for (let i = 0; i < round.length; i++) indeg.set(round[i], 0);
    const link = (a, b) => { if (a !== b && inR.has(a) && inR.has(b)) { let l = out.get(a); if (!l) out.set(a, l = []); l.push(b); indeg.set(b, indeg.get(b) + 1); } };
    for (const o of round) {
        if (o._fan) for (const t of o._fan) {
            if (t === o) _warn('E027', !globalThis.AEGIS_PROD && { site: o._site, what: `effect "${o._name}" writes a signal it reads — it re-runs itself every flush.`, why: 'The write invalidates the effect that made it; the loop only stops at the equality cut-off or the round limit.', fix: 'Read the signal with peek() or untrack(), or move the derivation into a computed().' }, 'self:' + o._name);
            link(o, t);
        }
        if (o._pe) link(o._pe, o);
    }
    const ready = [], res = [];
    for (const o of round) if (!indeg.get(o)) ready.push(o);
    ready.sort(_byOrd);
    while (ready.length) { const o = ready.shift(); res.push(o); const l = out.get(o); if (l) for (const t of l) { const n = indeg.get(t) - 1; indeg.set(t, n); if (n === 0) _insertByOrd(ready, t); } }
    if (res.length < round.length) {
        const done = new Set(res), cyc = round.filter(o => !done.has(o));
        _warn('E027', !globalThis.AEGIS_PROD && { what: `effect cycle: ${cyc.map(o => o._name).join(' → ')} → ${cyc[0] && cyc[0]._name} — each writes a signal the next one reads.`, why: 'The round cannot be ordered; effects keep invalidating each other until the equality cut-off or the round limit.', fix: 'Break the loop: derive one side with computed(), or write both values in one batch() outside the effects.' }, 'cycle:' + cyc.map(o => o._name).join('>'));
        cyc.sort(_byOrd); for (const o of cyc) res.push(o);
    }
    _stats.reordered++;
    return res;
}

class Effect {
    constructor(fn, name, owner, trace, lane) {
        this._ord = ++_ordSeq;
        this._fn = fn;
        this._name = name || 'effect';
        this._owner = owner;        // scope, под которым выполняется КАЖДЫЙ запуск
        this._lane = lane || null;  // 'micro' | 'frame' — отложенная полоса; null — синхронно
        this._f = (trace ? F_TRACE : 0) | F_OWN;   // F_OWN: дети запуска умирают с его перезапуском (effect(fn, { own: false }) снимает)
        this._el = null;            // DOM-узел привязки (dev-детектор зомби-эффектов)
        this._seen = false; this._detached = 0; this._warnedZombie = false;
        this._cleanup = null;
        this._deps = null;
        this._vers = null;
        this._n = 0;
        this._evict = null;
        this._unreg = null;
        this._kids = null;          // disposers детей текущего запуска (effect/on/interval/subscribe/createScope в теле)
        this._site = null;
        this._rs = 0;               // штамп запуска (_track)
        this._fan = null;           // выученные рёбра: observers, поставленные в очередь записями этого запуска
        this._pe = null;            // эффект-владелец (усыновивший запуск) — раньше в раунде
        this._dl = 0; this._dlLane = null;   // дедлайн и класс в heap (input-хвост / transition / idle)
    }
    get _disposed() { return (this._f & F_DISPOSED) !== 0; }
    get _queued() { return (this._f & F_QUEUED) !== 0; }
    set _queued(v) { if (v) this._f |= F_QUEUED; else this._f &= ~F_QUEUED; }
    get _own() { return (this._f & F_OWN) !== 0; }
    _run() {
        if (this._f & F_DISPOSED) return;
        // pull-фаза: запускаться только если зависимости реально изменились
        if (this._deps && this._deps.length > 0 && !_depsChanged(this)) return;
        if ((this._f & F_TRACE) && this._deps) {
            const changed = _changedDeps(this);
            console.groupCollapsed(`▸ [Aegis] effect "${this._name}" — changed: ${changed.map(d => `${d.name} → ${d.value}`).join(', ') || '(first run)'}`);
            console.trace();
            console.groupEnd();
        }
        this._execute();
    }
    _runCleanup() {
        const c = this._cleanup;
        if (!c) return;
        this._cleanup = null;
        try { c(); } catch (e) { console.error(`[Aegis] cleanup error in effect "${this._name}":`, e); }
    }
    _execute() {
        if (_batchDepth++ === 0) _win++;             // записи внутри effect (и в cleanup) откладываются до его завершения; запуск = окно backdating
        const prevT = _tracking, prevS = _currentScope, prevW = _writer;
        try {
            this._runCleanup();
            _killKids(this);                         // дети прошлого запуска — до нового, под тем же batch: L3 «dispose — транзакция»
            if (!(this._f & F_COUNTED)) { this._f |= F_COUNTED; _liveEffects++; }
            _tracking = this;
            _writer = this; this._fan = null;        // провенанс: рёбра переучиваются каждым запуском
            _currentScope = this._owner;  // всё созданное внутри — дети владельца, а не случайного scope
            this._n = 0;
            this._rs = ++_runSeq;
            const r = this._fn();
            if (this._el && (!globalThis.AEGIS_PROD && _dev())) _zombieCheck(this, this._name);
            if (typeof r === 'function') this._cleanup = r;
            else if (r && typeof r.then === 'function' && !(this._f & F_ASYNC)) {
                this._f |= F_ASYNC;
                _warn('E016', !globalThis.AEGIS_PROD && {
                    site: this._site,
                    what: `effect "${this._name}" returned a Promise.`,
                    why: 'Signals read after the first await are not tracked, and the cleanup return value is lost.',
                    fix: 'Move async work into resource()/mutation()/watch(); keep effect bodies synchronous.',
                });
            }
        } finally {
            _tracking = prevT;
            _writer = prevW;
            _currentScope = prevS;
            _endTrack(this);           // и после ошибки: прочитанные deps остаются, эффект переживёт throw
            _batchDepth--;
            if (_batchDepth === 0) _flush();
        }
    }
    dispose() {
        if (this._f & F_DISPOSED) return;
        this._f |= F_DISPOSED;
        _regObs(this, false);
        if (this._f & F_COUNTED) _liveEffects--;
        if (_batchDepth++ === 0) _win++;             // L3: записи из cleanup не запускают наблюдателей умирающего поддерева
        try {
            _unsubscribe(this);
            this._runCleanup();
            _killKids(this);
            const u = this._unreg; this._unreg = null;
            if (u) u();
        } finally { _batchDepth--; if (_batchDepth === 0) _flush(); }
    }
}
Effect.prototype._isComputed = false;

/**
 * Точка подмены для всего движка. fetcher: null → request() (через _ext, чтобы defaults не тянул сеть в сборку без запросов).
 * orphanEffects — что делать с effect() вне scope (E001): 'warn' (dev предупреждает, эффект живёт вечно), 'throw' (ошибка
 * и в проде), 'root' (эффект привязывается к корневому scope приложения — живёт до reset(), но учтён и виден в dev.graph()).
 */
export const defaults = { fetcher: null, motion: 'auto', orphanEffects: 'warn' };
let _orphanRoot = null;   // scope для orphanEffects: 'root'
export function effect(fn, nameOrOpts) {
    let owner = _currentScope;
    let name = typeof nameOrOpts === 'string' ? nameOrOpts : (nameOrOpts && nameOrOpts.name) || null;
    const trace = !!(nameOrOpts && typeof nameOrOpts === 'object' && nameOrOpts.trace);
    const fl = nameOrOpts && typeof nameOrOpts === 'object' ? nameOrOpts.flush : null;
    const lane = fl === 'micro' || fl === 'frame' || fl === 'transition' || fl === 'idle' ? fl : null;   // transition/idle — классы дедлайнов (heap)
    const explicitName = !!name;                   // именованные (движок, пользователь с name) — без детектора E019
    if (!name && (!globalThis.AEGIS_PROD && _dev())) name = fn.name || null;   // авто-имя в dev: function search() {…} → "search"
    const site = (!globalThis.AEGIS_PROD && _dev()) ? ((name && /[:@]/.test(name)) ? _curSite : _callSite()) : null;
    if (!owner && defaults.orphanEffects !== 'warn') {
        if (defaults.orphanEffects === 'throw') throw new Error(`[Aegis:E001] Effect "${name || 'anonymous'}" created outside a component scope (defaults.orphanEffects = 'throw'). Wrap it in island()/mount()/scope.run().`);
        owner = _orphanRoot || (_orphanRoot = new Scope(null, 'orphans'));   // 'root'
    }
    if (!owner) {
        _warn('E001', !globalThis.AEGIS_PROD && {
            site,
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in mount(el, ({ effect }) => { ... }) or scope.run(() => effect(...)).${typeof _components !== 'undefined' && _components.size ? ' After an await in setup the scope is lost — use the helpers from ctx (they stay bound) or runWithOwner(getOwner(), …).' : ''}`,
        });
    }
    const node = new Effect(fn, name, owner, trace, lane);
    node._site = site;
    if (nameOrOpts && typeof nameOrOpts === 'object' && nameOrOpts.own === false) node._f &= ~F_OWN;
    const dispose = () => node.dispose();
    dispose._node = node;
    _regObs(node, true);
    // Регистрируем до первого запуска: в уже уничтоженном scope effect не стартует.
    // L1 «ровно одно ребро владения»: создан в теле запуска эффекта — владелец только запуск (scope достигает его через родителя);
    // иначе — scope
    if (!_ownByRun(dispose)) node._unreg = owner ? owner.onDispose(dispose) : null;
    if (!node._disposed) {
        try { node._execute(); } catch (e) { if (!_dispatchError(owner, e)) throw e; }   // первый запуск: onError как у повторных; без обработчика — синхронно в setup (component/errorBoundary ловят)
        // Детектор потерянной реактивности: эффект, не прочитавший ни одного сигнала, больше не запустится
        if ((!globalThis.AEGIS_PROD && _dev()) && !explicitName && !node._disposed && (!node._deps || node._deps.length === 0)) {
            _warn('E019', !globalThis.AEGIS_PROD && {
                site: node._site,
                what: `Effect "${node._name}" read no signals — it ran once and will never run again.`,
                why: 'Effects re-run only when a signal read synchronously inside them changes (reads after await are not tracked).',
                fix: 'Read .value inside the effect (count.value, not a captured number). For a deliberate one-shot, call the function directly.',
            });
        }
    }
    return dispose;
}

// ---- Subscriber --------------------------------------------------------------

class Subscriber {
    constructor(src, fn, owner) {
        this._ord = ++_ordSeq;
        this._src = src;
        this._fn = fn;
        this._owner = owner;
        this._last = src.version();
        this._name = 'subscriber';
        this._f = 0;
        this._unreg = null;
        this._fan = null; this._pe = null;
        this._dl = 0; this._dlLane = null;
    }
    get _disposed() { return (this._f & F_DISPOSED) !== 0; }
    get _queued() { return (this._f & F_QUEUED) !== 0; }
    set _queued(v) { if (v) this._f |= F_QUEUED; else this._f &= ~F_QUEUED; }
    _run() {
        if (this._f & F_DISPOSED) return;
        const v = this._src.version();
        if (v === this._last) return;
        this._last = v;
        const prevS = _currentScope;
        _currentScope = this._owner;
        try { this._fn(this._src.peek()); }
        finally { _currentScope = prevS; }
    }
    dispose() {
        if (this._f & F_DISPOSED) return;
        this._f |= F_DISPOSED;
        _regObs(this, false);
        _delSub(this._src, this);
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
}
Subscriber.prototype._isComputed = false;

/** Ручная подписка: fn(value) при каждом реальном изменении, отложенно (после batch) */
function _subscribe(src, fn) {
    const owner = _currentScope;
    const node = new Subscriber(src, fn, owner);
    _addSub(src, node);
    _regObs(node, true);
    const dispose = () => node.dispose();
    dispose._node = node;
    if (!_ownByRun(dispose)) node._unreg = owner ? owner.onDispose(dispose) : null;   // L1: одно ребро владения
    return dispose;
}

// ---- batch / untrack / owner -------------------------------------------------

/**
 * Группировка обновлений — все изменения внутри batch
 * вызовут effects только один раз после завершения. Возвращает результат fn.
 */
export function batch(fn) {
    if (_batchDepth++ === 0) _win++;
    try {
        return fn();
    } finally {
        _batchDepth--;
        if (_batchDepth === 0) _flush();
    }
}

/** Выполнить fn без подписки на прочитанные сигналы */
export function untrack(fn) {
    const prev = _tracking;
    _tracking = null;
    try { return fn(); }
    finally { _tracking = prev; }
}

/** Текущий scope-владелец (null вне scope). Для кода после await: runWithOwner(getOwner(), …) */
export function getOwner() { return _currentScope; }

/** Выполнить fn под указанным scope (тот же scope.run) */
export function runWithOwner(scope, fn) {
    return scope ? scope.run(fn) : fn();
}

// ---- propagation -------------------------------------------------------------

/** Поставить observer в очередь: сортированность и наличие рёбер считаются здесь, а не сканом в раунде */
function _enqueue(obs) {
    obs._f |= F_QUEUED;
    if (obs._ord < _qLastOrd) _qSorted = false;
    _qLastOrd = obs._ord;
    _qa.push(obs);
    if (_writer) { (_writer._fan || (_writer._fan = new Set())).add(obs); _qEdges = true; }
}
function _notify(subs) {
    _notifyDepth++;
    try {
        for (const obs of subs) {                      // без копии: в push-фазе subs не пополняется
            if (obs._f & F_DISPOSED) { subs.delete(obs); continue; }
            if (obs._isComputed) obs._run();           // push: dirty по цепочке
            else if (obs._f & F_QUEUED) continue;
            else if (obs._lane) { if (obs._lane === 'micro' || obs._lane === 'frame') _enqueueLane(obs); else _enqueueDl(obs, obs._lane, _sched.now()); }   // явная полоса эффекта
            else if (_cause && _cause.lane !== 'input') _enqueueDl(obs, _cause.lane, _cause.t0);   // transition: никогда синхронно
            else _enqueue(obs);                         // sync и input: очередь flush (input — с бюджетом времени)
        }
    } finally {
        _notifyDepth--;
    }
    // flush только когда все вложенные _notify завершены и мы не в batch
    if (_notifyDepth === 0 && _batchDepth === 0) _flush();
}

function _scopePath(scope) {
    const parts = [];
    for (let sc = scope; sc && parts.length < 4; sc = sc.parent) if (sc.name) parts.push(sc.name);
    return parts.join(' ‹ ');
}
/** Ближайший элемент компонента вверх по scope-дереву: хост острова/mount() для пометки data-aegis-error */
function _scopeHost(scope) { for (let sc = scope; sc; sc = sc.parent) if (sc.el) return sc.el; return null; }
/** Глобальные обработчики ошибок эффектов (после scope.onError, до reportError) */
const _errHandlers = new Set();
/**
 * Ошибки эффектов, не поглощённые scope.onError / errorBoundary: onError(fn) → fn(error, error.aegis)
 *   onError((e, info) => sentry.capture(e, { extra: info }));
 * Без обработчиков — self.reportError(e) (событие 'error' на window). Писатель сигнала исключение не получает;
 * __AEGIS_DEV__ = 'strict' — бросать синхронно писателю (тесты).
 */
export function onError(fn) {
    _errHandlers.add(fn);
    const off = () => { _errHandlers.delete(fn); };
    if (_currentScope) _currentScope.onDispose(off);
    return off;
}
function _reportErrors(errors) {
    if (!errors.length) return;
    if (globalThis.__AEGIS_DEV__ === 'strict') throw errors[0];
    for (const e of errors) {
        // хост компонента получает data-aegis-error="имя эффекта": CSS показывает запасной вид, остальные острова живут
        const host = e && e.aegis && e.aegis.host;
        if (host && host.setAttribute) { try { host.setAttribute('data-aegis-error', e.aegis.effect || ''); } catch (x) { /* detached */ } }
        if (_errHandlers.size) { for (const h of _errHandlers) { try { h(e, (e && e.aegis) || null); } catch (x) { console.error('[Aegis] onError handler failed:', x); } } continue; }
        if (typeof reportError === 'function') reportError(e);
        else if (typeof window === 'undefined') console.error(e);     // node / workers without reportError: log, never kill the process over one effect
        else setTimeout(() => { throw e; });                           // browsers without reportError: surface it as an uncaught error (window 'error' event), the page keeps running
    }
}
/** Ошибка вверх по scope-дереву до первого onError; true — поглощена */
function _dispatchError(scope, e) {
    for (let sc = scope; sc; sc = sc.parent) {
        if (sc._errHandlers && sc._errHandlers.length) {
            for (const h of sc._errHandlers) { try { h(e); } catch (x) { console.error('[Aegis] onError handler failed:', x); } }
            return true;
        }
    }
    return false;
}

const _lanes = { micro: [], frame: [] };
let _laneScheduled = { micro: false, frame: false };
function _enqueueLane(obs) {
    if (obs._queued) return;
    obs._queued = true;
    _lanes[obs._lane].push(obs);
    if (!_laneScheduled[obs._lane]) {
        _laneScheduled[obs._lane] = true;
        if (obs._lane === 'micro') _sched.micro(() => _runLane('micro'));
        else _sched.frame(() => _runLane('frame'));
    }
}
/** Положить наблюдателя в heap с дедлайном класса; взвести дренаж */
function _enqueueDl(obs, lane, t0) {
    obs._f |= F_QUEUED;
    obs._dl = t0 + (_D[lane] || _D.transition); obs._dlLane = lane;
    if (lane === 'transition' && ++_transCount === 1) _transPending.value = true;
    _hpush(obs);
    _armHeap(lane);
}
function _armHeap(lane) {
    if (_heapArmed) return;
    _heapArmed = true;
    if (lane === 'idle') _sched.idle((d) => { _heapArmed = false; _runSlice(_sched.now() + Math.max(2, d && d.timeRemaining ? d.timeRemaining() : 8)); });
    else _sched.yield().then(() => { _heapArmed = false; _runSlice(_sched.now() + 8); });
}
function _rootOf(sc) { while (sc && sc.parent) sc = sc.parent; return sc; }
/** Один срез: элементы heap по дедлайну, вытеснение на границе компонент-группы по бюджету или ожидающему вводу */
function _runSlice(end) {
    if (_slicing) return;
    _slicing = true;
    let prevRoot = null, ran = 0, errors = null;
    try {
        while (_heap.length) {
            const obs = _heap[0];
            const root = _rootOf(obs._owner);
            if (ran && root !== prevRoot && (_sched.now() > end || _sched.inputPending())) { _armHeap(obs._dlLane); return; }
            _hpop(); prevRoot = root; ran++;
            obs._f &= ~F_QUEUED;
            if (obs._dlLane === 'transition' && --_transCount === 0) _transPending.value = false;
            if (obs._f & F_DISPOSED) continue;
            if (_sched.onRun) _sched.onRun(obs, obs._dlLane);
            try { obs._run(); } catch (e) { if (!_dispatchError(obs._owner, e)) (errors || (errors = [])).push(e); }
        }
    } finally {
        _slicing = false;
        if (!_heap.length) _settle();
        if (!globalThis.AEGIS_PROD && _obsReg) _checkGraph('slice');
    }
    if (errors) _reportErrors(errors);
}
function _settle() { if (_heap.length || _lanes.micro.length || _lanes.frame.length) return; const r = _settleRes.splice(0); for (const f of r) f(); }
/** Promise: heap и полосы пусты (для nextTick) */
function _whenSettled() { return (_heap.length || _lanes.micro.length || _lanes.frame.length || _heapArmed) ? new Promise(r => _settleRes.push(r)) : Promise.resolve(); }
const _transPending = /* @__PURE__ */ signal(false, 'transition:pending');
/**
 * Несрочное обновление: записи внутри не запускают эффекты синхронно — они идут в класс transition (дедлайн 250 мс) срезами
 * после текущей задачи; повторная запись до дренажа схлопывается (latest-wins без второго состояния), старый UI виден.
 *   startTransition(() => { query.value = q; });  startTransition.pending — сигнал «есть отложенная работа»
 */
export const startTransition = /* @__PURE__ */ Object.assign(function startTransition(fn) {
    const prev = _cause; _cause = { lane: 'transition', t0: _sched.now() };
    try { return batch(fn); } finally { _cause = prev; }
}, { get pending() { return _transPending; } });
/**
 * Отложенная тень сигнала (useDeferredValue / createDeferred): ввод привязан к src (срочно), тяжёлый список — к deferred(src):
 * поле отзывается мгновенно, список обновляется в transition-полосе, старый виден до готовности нового.
 */
export function deferred(src, opts = {}) {
    const out = signal(src.peek(), 'deferred');
    effect(() => { out.value = src.value; }, { flush: opts.lane || 'transition', name: 'deferred' });
    return computed(() => out.value, 'deferred');
}
/**
 * Оптимистичная транзакция для асинхронной работы (OCC: Kung & Robinson): fn({ read, write }) читает сигналы через read —
 * пары (источник, версия) запоминаются без подписки; на commit read-set валидируется по версиям, при конфликте —
 * повтор (retries) или onConflict(changed) → 'abort'; записи применяются одним batch. Защита от write skew между await.
 */
export function transaction(fn, { retries = 3, onConflict } = {}) {
    const run = async (attempt) => {
        const tx = { _isComputed: true, _f: F_COMPUTED, _ord: ++_ordSeq, _rs: ++_runSeq, _deps: null, _vers: null, _n: 0, _evict: null, _name: 'transaction', writes: new Map(), attempt };
        const read = (sig) => { const prev = _tracking; _tracking = tx; try { return sig.value; } finally { _tracking = prev; } };
        const write = (sig, v) => { tx.writes.set(sig, v); };
        const r = await fn({ read, write, attempt });
        if (tx._deps && tx._deps.length && _depsChanged(tx)) {
            const changed = _changedDeps(tx);
            if (onConflict && onConflict(changed) === 'abort') throw Object.assign(new Error('[Aegis] transaction conflict: ' + changed.map(d => d.name).join(', ') + ' changed while it was awaiting'), { changed });
            if (attempt < retries) return run(attempt + 1);
            throw Object.assign(new Error('[Aegis] transaction gave up after ' + retries + ' retries: ' + changed.map(d => d.name).join(', ')), { changed });
        }
        batch(() => { for (const [sig, v] of tx.writes) sig.value = v; });
        return r;
    };
    return run(0);
}
function _runLane(lane) {
    _laneScheduled[lane] = false;
    if (!_lanes[lane].length) return;
    _laneScheduled[lane] = true;                        // записи во время дренажа не планируют новый тик — всё попадает в этот же microtask/кадр
    let rounds = 0;
    const errors = [];
    try {
        while (_lanes[lane].length) {
            if (++rounds > _MAX_ROUNDS) {
                const list = _lanes[lane]; _lanes[lane] = [];
                for (const o of list) o._queued = false;
                throw new Error(`[Aegis] Infinite reactive loop in "${lane}" lane — effect writes a signal it depends on (${list.map(o => o._name).join(', ')})`);
            }
            const list = _ordered(_lanes[lane], undefined); _lanes[lane] = [];
            for (const obs of list) {
                obs._queued = false;
                if (obs._disposed) continue;
                try { obs._run(); } catch (e) { if (!_dispatchError(obs._owner, e)) errors.push(e); }
            }
        }
    } finally {
        _laneScheduled[lane] = false;
        _settle();
        if (!globalThis.AEGIS_PROD && _obsReg) _checkGraph(lane + ' lane');
        if (rounds > 3) _warn('E027', !globalThis.AEGIS_PROD && {
            what: `${lane} lane took ${rounds} rounds — effects keep writing signals other effects depend on.`,
            why: 'Each round is an effect reacting to a write from the previous round (ping-pong).',
            fix: 'Replace the effect with a computed(), or write all values in one batch().',
        }, 'rounds:' + lane);
    }
    _reportErrors(errors);
}
/** Синхронно выполнить все отложенные полосы (micro/frame) и очередь эффектов */
export function flush() {
    _runLane('micro');
    _runLane('frame');
    while (_heap.length) { const o = _hpop(); o._f &= ~F_QUEUED; if (o._dlLane === 'transition') _transCount--; if (!(o._f & F_DISPOSED)) o._run(); }
    if (_transCount <= 0) { _transCount = 0; if (_transPending.peek()) _transPending.value = false; }
    _flush();
    _settle();
}

// ---- профилирование (Aegis.dev.profile(true)) и stats()
let _profiling = false;
let _profileMark = null;   // разметка Performance-панели — ставится dev.profile() (секция 3), ядро её не тянет
const _stats = { flushes: 0, effectRuns: 0, maxRounds: 0, slow: [], reordered: 0, sliced: 0 };
let _liveEffects = 0, _liveScopes = 0;

function _flush() {
    if (_flushing || _batchDepth > 0 || _qa.length === 0) return;
    _flushing = true;
    let rounds = 0, errors = null, total = 0;
    const t0 = _profiling ? performance.now() : 0;
    const names = _profiling ? [] : null;
    try {
        // Записи из effects попадают в очередь и обрабатываются следующим раундом
        while (_qa.length > 0) {
            if (++rounds > _MAX_ROUNDS) {
                const list = _qa.map(o => o._name).join(', ');
                for (const o of _qa) o._f &= ~F_QUEUED;
                _qa.length = 0; _qSorted = true; _qLastOrd = 0; _qEdges = false;
                throw new Error(`[Aegis] Infinite reactive loop — effect writes a signal it depends on (${list})`);
            }
            _win++;                                          // раунд — окно backdating
            const round = _ordered(_qa, _qSorted);          // порядок создания, либо Кан по выученным рёбрам
            _qa = _qb; _qb = round; _qa.length = 0; _qSorted = true; _qLastOrd = 0; _qEdges = false;   // swap: буфер раунда переиспользуется
            total += round.length;
            let i = 0;
            try {
                for (; i < round.length; i++) {
                    const obs = round[i];
                    obs._f &= ~F_QUEUED;
                    if (obs._f & F_DISPOSED) continue;
                    if (names && names.length < 30) names.push(obs._name);
                    if (_cause && _cause.lane === 'input' && i && (_sched.now() - _cause.t0 > _D.input - 10 || ((i & 15) === 15 && _sched.inputPending()))) {
                        // бюджет long task исчерпан или ждёт ввод: остаток раунда и очереди — в класс input (дедлайн t0 + 50 мс), продолжение после yield
                        for (let j = i; j < round.length; j++) { const o = round[j]; if (o._f & F_DISPOSED) o._f &= ~F_QUEUED; else { o._dl = _cause.t0 + _D.input; o._dlLane = 'input'; _hpush(o); } }
                        for (const o of _qa) { if (o._f & F_DISPOSED) o._f &= ~F_QUEUED; else { o._dl = _cause.t0 + _D.input; o._dlLane = 'input'; _hpush(o); } }
                        _qa.length = 0; _qSorted = true; _qLastOrd = 0; _qEdges = false;
                        round.length = 0; i = 0;
                        _stats.sliced++;
                        _armHeap('input');
                        break;
                    }
                    if (_sched.onRun) _sched.onRun(obs, 'sync');
                    try {
                        if (_profiling) {
                            const ts = performance.now();
                            obs._run();
                            const ms = performance.now() - ts;
                            if (ms > 1) { _stats.slow.push({ name: obs._name, ms: +ms.toFixed(2) }); if (_stats.slow.length > 20) _stats.slow.shift(); }
                        } else obs._run();
                    } catch (e) {
                        try {
                            if (e && typeof e === 'object' && !e.aegis) {
                                e.aegis = { effect: obs._name, scope: _scopePath(obs._owner), changed: _changedDeps(obs), host: _scopeHost(obs._owner) };
                                if (obs._site) e.aegis.site = obs._site.short;
                                try { e.message += `\n    in effect "${obs._name}"${e.aegis.scope ? ' · ' + e.aegis.scope : ''}${obs._site ? ' · at ' + obs._site.short : ''}${e.aegis.changed.length ? '\n    changed: ' + e.aegis.changed.map(d => d.name + ' → ' + d.value).join(', ') : ''}`; } catch (m) { /* readonly message */ }
                            }
                        } catch (x) { /* декоратор никогда не бросает */ }
                        if (_dispatchError(obs._owner, e)) continue;   // поглощена scope.onError / errorBoundary
                        (errors || (errors = [])).push(e);             // остальные эффекты раунда продолжают; отчёт — после flush
                    }
                }
            } finally {
                for (let j = i + 1; j < round.length; j++) { const o = round[j]; if (o._f & F_DISPOSED) o._f &= ~F_QUEUED; else { o._f &= ~F_QUEUED; _enqueue(o); } }   // недобежавший хвост — в следующий раунд, а не вечный _queued=true
                round.length = 0;
            }
        }
    } finally {
        _flushing = false;
        _stats.flushes++;
        _stats.effectRuns += total;
        if (!globalThis.AEGIS_PROD && _obsReg) _checkGraph('flush');
        if (rounds > _stats.maxRounds) _stats.maxRounds = rounds;
        if (_profiling && total && _profileMark) _profileMark(t0, total, rounds, names);
        if (rounds > 3 && total) _warn('E027', !globalThis.AEGIS_PROD && {
            what: `Flush took ${rounds} rounds — effects keep writing signals other effects depend on.`,
            why: 'Each round is an effect reacting to a write from the previous round (ping-pong).',
            fix: 'Replace the effect with a computed(), or write all values in one batch().',
        }, 'rounds');
    }
    if (errors) _reportErrors(errors);   // scope.onError не было: onError() → reportError; в 'strict' — синхронно писателю
}


// ============================================================================
// 2. SCOPE — Lifecycle, Auto-cleanup
// ============================================================================

let _currentScope = null;

class Scope {
    constructor(parent, name) {
        this.parent = null;
        this.name = name || null;             // для сообщений об ошибках: component:div#app, list:row
        this.el = null;                       // элемент компонента (inject() по DOM-предкам)
        this._ctx = null;                     // provide()/inject(): Map лениво
        this.children = null;                 // ленивый Set: бездетный scope не платит
        this._disposers = new Set();          // Set: onDispose() возвращает unregister — O(1)
        this._disposed = false;
        _liveScopes++;
        this.dispose = this.dispose.bind(this); // можно передавать как callback: t.after(scope.dispose)
        if (parent) {
            if (parent._disposed) {
                _warn('E005', !globalThis.AEGIS_PROD && {
                    what: 'Scope created inside an already disposed scope.',
                    why: 'The parent will never dispose it — its effects and listeners leak.',
                    fix: 'Create scopes only while the parent is alive, or dispose this one manually.',
                });
            } else {
                this.parent = parent;
                (parent.children || (parent.children = new Set())).add(this);
            }
        }
    }

    /** Выполнить функцию в контексте этого scope */
    run(fn) {
        if (this._disposed) {
            _warn('E005', !globalThis.AEGIS_PROD && {
                what: 'scope.run() called on a disposed scope.',
                why: 'Effects created here are disposed immediately and never run again.',
                fix: 'Do not reuse a disposed scope — create a new one.',
            });
        }
        const prev = _currentScope;
        _currentScope = this;
        try { return fn(); }
        finally { _currentScope = prev; }
    }

    /**
     * Зарегистрировать cleanup-функцию. Возвращает unregister — чтобы сработавший
     * timeout/снятый listener не держал замыкание до смерти scope.
     * На уничтоженном scope — вызывается сразу.
     */
    /** Обработчик ошибок эффектов этого scope и вложенных (errorBoundary без расширения браузера) */
    onError(fn) {
        (this._errHandlers || (this._errHandlers = [])).push(fn);
        return () => { const i = this._errHandlers.indexOf(fn); if (i >= 0) this._errHandlers.splice(i, 1); };
    }

    onDispose(fn) {
        if (this._disposed) { fn(); return _noop; }
        this._disposers.add(fn);
        return () => { this._disposers.delete(fn); };
    }

    /** Уничтожить scope и все вложенные */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        _liveScopes--;
        if (_batchDepth++ === 0) _win++;   // L3 «dispose — транзакция»: записи из cleanup не запускают наблюдателей умирающего поддерева; снаружи видно одно пост-состояние
        const p = this.parent;
        try {
            const kids = this.children;
            this.children = null;
            if (kids) for (const child of kids) child.dispose();
            // Потом свои disposers (удаление из Set во время итерации безопасно)
            for (const d of this._disposers) {
                try { d(); } catch (e) { console.error('[Aegis] dispose error:', e); }
            }
            this._disposers.clear();
            // Убрать себя из родителя — O(1)
            if (p && !p._disposed && p.children) p.children.delete(this);
            this.parent = null;
        } finally {
            _batchDepth--;
            if (_batchDepth === 0) { _flush(); _checkScopes(p); }
        }
    }
}
if (typeof Symbol.dispose === 'symbol') Scope.prototype[Symbol.dispose] = function () { this.dispose(); };   // using scope = createScope()
const _noop = () => {};

/** Создать scope (привязывается к родительскому автоматически). name — для диагностики */
export function createScope(name) {
    const sc = new Scope(_currentScope, name);
    _adopt(sc.dispose);
    return sc;
}

/**
 * Корневой scope для тестов и кода вне компонентов:
 *   const [api, dispose] = root(dispose => { effect(…); return { … }; });
 */
export function root(fn) {
    const scope = new Scope(null, 'root');
    const r = scope.run(() => fn(scope.dispose));
    return [r, scope.dispose];
}

/** Зарегистрировать cleanup в текущем scope. Возвращает unregister */
export function onDispose(fn) {
    if (_currentScope) return _currentScope.onDispose(fn);
    _warn('E017', !globalThis.AEGIS_PROD && {
        what: 'onDispose() called outside a scope — the cleanup will never run.',
        why: 'Cleanups are owned by the scope that is active when they are registered.',
        fix: 'Call it inside island()/mount() setup or scope.run(() => …).',
    });
    return _noop;
}

// ---- provide / inject -----------------------------------------------------------

const _globalCtx = new Map();

/** Типизированный ключ контекста с значением по умолчанию */
export function createContext(defaultValue) {
    return { id: Symbol('aegis.context'), default: defaultValue };
}

/**
 * Положить значение в контекст текущего scope: тема, локаль, user, jQuery — один раз наверху.
 * Вне scope — глобальный контекст.
 */
export function provide(key, value) {
    const k = key && key.id ? key.id : key;
    if (_currentScope) (_currentScope._ctx || (_currentScope._ctx = new Map())).set(k, value);
    else _globalCtx.set(k, value);
}

/**
 * Достать значение из контекста: вверх по scope-дереву, затем по DOM-предкам
 * (острова без общего root), затем глобальный. Вызывать синхронно в setup, не внутри effect.
 */
export function inject(key, fallback) {
    const k = key && key.id ? key.id : key;
    let ownerEl = null;
    for (let sc = _currentScope; sc; sc = sc.parent) {
        if (!ownerEl && sc.el) ownerEl = sc.el;
        if (sc._ctx && sc._ctx.has(k)) return sc._ctx.get(k);
    }
    if (ownerEl && typeof _components !== 'undefined') {
        for (let e = ownerEl.parentElement; e; e = e.parentElement) {
            const c = _components.get(e);
            const ctx = c && c.scope._ctx;
            if (ctx && ctx.has(k)) return ctx.get(k);
        }
    }
    if (_globalCtx.has(k)) return _globalCtx.get(k);
    if (arguments.length < 2 && !(key && 'default' in key)) {
        _warn('E022', !globalThis.AEGIS_PROD && {
            what: `inject(${String(key && key.id ? key.id.description : key)}) — nothing provided.`,
            why: 'No provide() for this key in the scope chain, DOM ancestors or globally.',
            fix: 'Call provide(key, value) in a parent setup, or pass a fallback: inject(key, fallback). Lazy parent island? Use data-aegis-load="eager".',
        });
    }
    return arguments.length >= 2 ? fallback : (key && key.default);
}

/** Зарегистрировать disposer в текущем scope и вернуть функцию, которая делает cleanup и снимает регистрацию */
function _scoped(cleanup) {
    let unreg = null, done = false;
    const off = () => {
        if (done) return; done = true;
        cleanup();
        if (unreg) { unreg(); unreg = null; }
    };
    if (!_ownByRun(off)) unreg = _currentScope ? _currentScope.onDispose(off) : null;   // L1: одно ребро владения
    return off;
}


// ============================================================================
// 3. SCOPED UTILITIES — auto-cleanup обёртки
// ============================================================================

// ---- Dev-инструменты поверх ядра (Aegis.dev.of / inspect / graph, разметка Performance-панели) — вне aegis.core.js
let _devToolsCache = null;
function _devTools() {
    return _devToolsCache || (_devToolsCache = {
    of(el) {
    for (let e = el; e; e = e.parentElement) {
        const c = typeof _components !== 'undefined' && _components.get(e);
        if (c) return _inspectScope(c.scope);
    }
    return null;
    },
    inspect(root) {
    if (root && root.run) return _inspectScope(root);
    const out = [];
    if (typeof _components !== 'undefined') for (const [el, c] of _components) if (!root || root === document || (root.contains && root.contains(el))) out.push(_inspectScope(c.scope));
    return out;
    },
    graph(root) {
    const lines = ['graph LR'];
    const seen = new Set();
    const walk = (sc) => {
        if (!sc || seen.has(sc)) return;
        seen.add(sc);
                for (const d of sc._disposers) {
            const node = d._node;
            if (!node || !node._deps) continue;
            for (const src of node._deps) lines.push(`  ${(src._name || 'signal').replace(/[^\w:.-]/g, '_')} --> ${String(node._name || 'effect').replace(/[^\w:.@-]/g, '_')}`);
        }
        if (sc.children) for (const c of sc.children) walk(c);
            };
    if (root && root.run) walk(root);
    else if (typeof _components !== 'undefined') for (const [, c] of _components) walk(c.scope);
    return lines.join('\n');
    },
    });
}

function _inspectScope(sc) {
    const effects = [], signals = new Map();
    const visit = (node, scopeName, depth) => {
        if (!node || node._isComputed || depth > 32) return;
        const deps = (node._deps || []).map(x => x._name || 'signal');
        effects.push({ name: node._name, deps, scope: scopeName, site: node._site ? node._site.short : null });
        for (const x of node._deps || []) if (x._name && !signals.has(x._name)) signals.set(x._name, { value: _short(x.peek()), ref: x });
        if (node._kids) for (const k of node._kids) if (k._node) visit(k._node, scopeName, depth + 1);   // L1: дети запуска живут в _kids, не в scope
    };
    const collect = (scope) => {
        for (const d of scope._disposers) if (d._node) visit(d._node, scope.name, 0);
        if (scope.children) for (const c of scope.children) collect(c);
    };
    collect(sc);
    const sigs = [...signals].map(([name, { value, ref }]) => { const o = { name, value }; Object.defineProperty(o, 'ref', { value: ref, enumerable: false }); return o; });
    return { scope: sc.name, el: sc.el || null, signals: sigs, effects, children: sc.children ? sc.children.size : 0 };
}

/** Счётчики движка (dev): flushes, effectRuns, maxRounds, slow[], scopes, effects, components, caches */
export function stats() {
    return {
        flushes: _stats.flushes, effectRuns: _stats.effectRuns, maxRounds: _stats.maxRounds, slow: _stats.slow.slice(), reordered: _stats.reordered, sliced: _stats.sliced, deferredQueue: _heap.length,
        scopes: _liveScopes, effects: _liveEffects,
        components: typeof _components !== 'undefined' ? _components.size : 0,
        islands: typeof _resident !== 'undefined' ? { resident: _resident.size, evictions: _islandStats.evictions, hibernations: _islandStats.hibernations } : null,
        resourceCache: typeof _resourceCache !== 'undefined' ? _resourceCache.size : 0,
        prefetch: typeof _pf !== 'undefined' ? { fired: _pf.fired, used: _pf.used, wasted: _pf.wasted, hoverDelay: _hov.d } : null,
        speculation: typeof _spec !== 'undefined' ? { inflight: _spec.inflight, queued: _spec.queued.length, fired: _spec.fired, skipped: _spec.skipped, aborted: _spec.aborted } : null,
        cssCache: typeof _cssCache !== 'undefined' ? _cssCache.size : 0,
        queued: _qa.length,
    };
}

/** performance.measure / console.timeStamp на каждый flush в треке «Aegis» Performance-панели */
function _installProfileMark() {
    _profileMark = (t0, total, rounds, names) => {
        const label = `aegis:flush · ${total} effects · ${rounds} rounds`;
        const t1 = performance.now();
        if (typeof console.timeStamp === 'function' && console.timeStamp.length >= 5) console.timeStamp(label, t0, t1, 'Aegis', 'Aegis', 'primary');
        else if (typeof performance.measure === 'function') { try { performance.measure(label, { start: t0, end: t1, detail: { devtools: { dataType: 'track-entry', track: 'Aegis', color: 'primary', properties: [['rounds', rounds], ['effects', names.join(', ')]] } } }); } catch (e) { /* старый measure */ } }
    };
}

/**
 * addEventListener с авто-удалением при dispose scope.
 * Обработчик выполняется в batch(): пять записей сигналов — один flush.
 */
// Делегирование по opt-in: configure({ delegateEvents: ['click', 'input', 'change', 'keydown', 'pointerdown', 'submit'] }).
// Обработчик хранится на элементе (el._aegisH[type]), один listener на document (или ShadowRoot); порядок и
// stopPropagation как у нативного всплытия. Не-всплывающие события и listener-опции (capture/passive/once) — всегда напрямую.
// Внутри чужих виджетов, глотающих события (stopPropagation в jQuery/Bootstrap): @click.direct=${fn} или on(el, 'click', fn, { direct: true }).
let _delegated = null;
const _NO_DELEGATE = new Set(['focus', 'blur', 'scroll', 'mouseenter', 'mouseleave', 'pointerenter', 'pointerleave', 'load', 'error', 'resize']);
const _delegateRoots = new WeakMap();   // root → Set(event)
function _dispatchDelegated(e) {
    const type = e.type;
    const path = e.composedPath();
    for (let i = 0; i < path.length; i++) {
        const node = path[i];
        const map = node._aegisH;
        if (!map || !map[type]) continue;
        const list = map[type];
        Object.defineProperty(e, 'currentTarget', { configurable: true, get: () => node });
        for (let j = 0; j < list.length; j++) { list[j].call(node, e); if (e.cancelBubble) break; }
        if (e.cancelBubble) break;
        if (node === this) break;   // корень: дальше не наш
    }
    try { delete e.currentTarget; } catch (x) { /* */ }
}
function _delegateOn(el, event, h) {
    // элемент из html`` ещё лежит в DocumentFragment — корень по нему не определить; ShadowRoot — только если уже прикреплён
    const root = el.getRootNode ? el.getRootNode() : document;
    const target = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : document;
    let set = _delegateRoots.get(target);
    if (!set) _delegateRoots.set(target, set = new Set());
    if (!set.has(event)) { set.add(event); target.addEventListener(event, _dispatchDelegated); }
    const map = el._aegisH || (el._aegisH = Object.create(null));
    (map[event] || (map[event] = [])).push(h);
    return () => { const l = map[event]; if (!l) return; const i = l.indexOf(h); if (i >= 0) l.splice(i, 1); if (!l.length) delete map[event]; };
}

export function on(el, event, handler, opts) {
    let dispose;
    const h = typeof handler === 'function'
        ? function (e) {
            if (opts && typeof opts === 'object' && opts.once) dispose();
            const prev = _cause; _cause = { lane: 'input', t0: _sched.now() };   // записи обработчика — класс input: синхронно в бюджете long task, остаток срезами
            try { return batch(() => handler.call(this, e)); } finally { _cause = prev; }
        }
        : handler;   // { handleEvent } — как есть
    const canDelegate = _delegated && _delegated.has(event) && typeof handler === 'function' && el && el.nodeType === 1 && !_NO_DELEGATE.has(event)
        && (!opts || (typeof opts === 'object' && !opts.capture && !opts.passive && !opts.once && !opts.direct && !opts.signal));
    if (canDelegate) {
        const off = _delegateOn(el, event, h);
        let doneD = false;
        dispose = _scoped(() => { if (doneD) return; doneD = true; off(); });
        return dispose;
    }
    if (opts && typeof opts === 'object' && opts.direct) { const { direct, ...rest } = opts; opts = Object.keys(rest).length ? rest : undefined; }
    el.addEventListener(event, h, opts);
    let done = false;
    dispose = _scoped(() => {
        if (done) return;
        done = true;
        el.removeEventListener(event, h, opts);
    });
    return dispose;
}

/**
 * Делегирование событий — один listener на контейнер
 */
export function delegate(el, event, selector, handler) {
    const wrapper = (e) => {
        const target = e.target.closest(selector);
        if (target && el.contains(target)) {
            handler.call(target, e, target);
        }
    };
    return on(el, event, wrapper);
}

/**
 * setInterval с авто-очисткой
 */
export function interval(fn, ms) {
    const id = setInterval(fn, ms);
    return _scoped(() => clearInterval(id));
}

/**
 * setTimeout с авто-очисткой; сработавший таймер снимает себя со scope
 */
export function timeout(fn, ms) {
    let dispose;
    const id = setTimeout(() => { dispose(); fn(); }, ms);
    dispose = _scoped(() => clearTimeout(id));
    return dispose;
}

function _noObserver(api) {
    _warn('E018', !globalThis.AEGIS_PROD && {
        what: `${api} is not available in this environment — the observer is a no-op.`,
        why: 'jsdom/SSR do not implement it; the component still mounts.',
        fix: 'Polyfill it in tests, or treat the callback as optional behaviour.',
    });
    return _noop;
}

/**
 * IntersectionObserver с авто-disconnect
 */
export function observe(el, callback, opts) {
    if (typeof IntersectionObserver === 'undefined') return _noObserver('IntersectionObserver');
    const obs = new IntersectionObserver(callback, opts);
    obs.observe(el);
    return _scoped(() => obs.disconnect());
}

/**
 * ResizeObserver с авто-disconnect
 */
export function resize(el, callback) {
    if (typeof ResizeObserver === 'undefined') return _noObserver('ResizeObserver');
    const obs = new ResizeObserver(callback);
    obs.observe(el);
    return _scoped(() => obs.disconnect());
}

/**
 * MutationObserver с авто-disconnect
 */
export function mutate(el, callback, opts) {
    if (typeof MutationObserver === 'undefined') return _noObserver('MutationObserver');
    const obs = new MutationObserver(callback);
    obs.observe(el, opts);
    return _scoped(() => obs.disconnect());
}


/**
 * Размер элемента как сигналы (ResizeObserver, без чтения rect внутри effect)
 *   const { width, height } = size(card);   cls(card, 'compact', () => width.value < 320);
 */
export function size(el, { box = 'border-box' } = {}) {
    const r0 = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    const width = signal(r0.width, 'size:width'), height = signal(r0.height, 'size:height');
    if (typeof ResizeObserver === 'undefined') { _noObserver('ResizeObserver'); return { width, height }; }
    const obs = new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        const b = (box === 'content-box' ? e.contentBoxSize : e.borderBoxSize);
        const bs = b && b[0];
        batch(() => {
            width.value = bs ? Math.round(bs.inlineSize * 2) / 2 : e.contentRect.width;
            height.value = bs ? Math.round(bs.blockSize * 2) / 2 : e.contentRect.height;
        });
    });
    obs.observe(el, { box });
    _scoped(() => obs.disconnect());
    return { width, height };
}

/** Видимость элемента как сигналы (IntersectionObserver): { visible, ratio } */
export function inView(el, opts) {
    const visible = signal(false, 'inView:visible'), ratio = signal(0, 'inView:ratio');
    observe(el, (entries) => {
        const e = entries[entries.length - 1];
        batch(() => { visible.value = e.isIntersecting; ratio.value = e.intersectionRatio; });
    }, opts);
    return { visible, ratio };
}

let _viewport = null;
/** Окно как сигналы (singleton): { width, height, scrollX, scrollY } — один passive listener, запись в rAF */
export function viewport() {
    if (_viewport) return _viewport;
    const w = typeof window !== 'undefined' ? window : null;
    const width = signal(w ? w.innerWidth : 0, 'viewport:width'), height = signal(w ? w.innerHeight : 0, 'viewport:height');
    const scrollX = signal(w ? w.scrollX : 0, 'viewport:scrollX'), scrollY = signal(w ? w.scrollY : 0, 'viewport:scrollY');
    _viewport = { width, height, scrollX, scrollY };
    if (w) {
        let raf = 0;
        const update = () => { raf = 0; batch(() => { width.value = w.innerWidth; height.value = w.innerHeight; scrollX.value = w.scrollX; scrollY.value = w.scrollY; }); };
        const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
        w.addEventListener('resize', schedule, { passive: true });
        w.addEventListener('scroll', schedule, { passive: true });
    }
    return _viewport;
}


// ============================================================================
// 4. GUARD LAYER — Race protection, Smart fetch
// ============================================================================

// ---- HTTP layer: configure() / request() / HttpError / api ------------------

/** Ошибка HTTP-ответа: статус, Response и разобранное тело (e.data.errors из Laravel/Django) */
export class HttpError extends Error {
    constructor(status, response, data) {
        super(`HTTP ${status}`);
        this.name = 'HttpError';
        this.status = status;
        this.response = response;
        this.data = data;
    }
}

const _CSRF_PRESETS = {
    django:  { cookie: 'csrftoken',    header: 'X-CSRFToken' },
    rails:   { meta: 'csrf-token',     header: 'X-CSRF-Token' },
    laravel: { cookie: 'XSRF-TOKEN',   header: 'X-XSRF-TOKEN', decode: true },
    go:      { cookie: '_gorilla_csrf', header: 'X-CSRF-Token' },
};

const _config = {
    csrf: undefined,               // undefined → автодетект: <meta name="aegis-csrf"> или <meta name="csrf-token">
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    baseURL: '',
    timeout: 0,
    fetch: null,                   // (url, init) => Response — прокси/логирование/моки
    delegateEvents: null,          // ['click', 'input', …] — один listener на document вместо одного на элемент (списки 1000+ строк)
    cache: { maxEntries: 500, maxBytes: 0 },            // ёмкость SWR-кэша: записи (SIEVE-вытеснение среди незанятых) и байты (0 — без лимита)
    invalidateHeader: 'Aegis-Invalidate',                // заголовок ответа с шаблонами ключей для invalidate() (same-origin); false — выключить
    breaker: null,                                       // true | { threshold: 5, cooldown: 5000, key: (url) => origin } — circuit breaker per origin
    retryBudget: null,                                   // true | { ratio: 0.2, min: 10, window: 10000 } — лимит повторов на клиент
    speculation: 'auto',                                 // спекулятивные запросы (prefetch/preload/predict): 'auto' — по navigator.connection; false — никогда; { maxInflight, saveData: 'respect' | 'ignore' }
    prefetch: null,                                      // { minUtility: 0, fixedCost, horizon: 1500, hoverDelay: 80 | 'auto', rtt, bytes } — порог полезности и задержка hover
    identify: null,                                      // (obj) => 'user:42' | null — идентификация сущностей для cache.patchEntity() (одна запись во всех списках)
    revalidate: { focus: 5000, reconnect: 2000, concurrency: 6, stagger: 40, reconnectJitter: 2000 },   // token bucket на причину, параллелизм, стаггер и джиттер
    onError: null,                 // (HttpError, { url, status }) => void
    onRedirect: 'assign',          // после PRG-редиректа формы: 'assign' | 'none' | (response) => void
};

/**
 * Настройка HTTP-слоя под свой бэкенд — одна строка на проект:
 *   configure({ csrf: 'django' })              // или 'rails' | 'laravel' | 'go' | { header, cookie | meta | token() }
 *   configure({ baseURL: '/api', timeout: 10000, headers: { Accept: 'application/json' } })
 * Без вызова: CSRF берётся из <meta name="aegis-csrf" content="django"> или <meta name="csrf-token">.
 */
export function configure(opts = {}) {
    const { csrf, headers, delegateEvents, cache: cacheLimits, revalidate: reval, ...rest } = opts;
    Object.assign(_config, rest);
    if (cacheLimits) { _config.cache = { ..._config.cache, ...cacheLimits }; if (_ext.evict) _ext.evict(); }
    if (reval) _config.revalidate = { ..._config.revalidate, ...reval };
    if (delegateEvents !== undefined) { _config.delegateEvents = delegateEvents; _delegated = delegateEvents && delegateEvents.length ? new Set(delegateEvents) : null; }
    if (headers) _config.headers = { ..._config.headers, ...headers };
    if (rest.baseURL !== undefined || rest.origins !== undefined) _trusted = null;
    if (csrf !== undefined) _config.csrf = _csrfPreset(csrf);
    return _config;
}

function _csrfPreset(v) {
    if (v === null || v === false) return null;
    if (typeof v === 'string') {
        const p = _CSRF_PRESETS[v];
        if (!p) _warn('E015', !globalThis.AEGIS_PROD && {
            what: `configure({ csrf: "${v}" }) — unknown preset.`,
            why: 'Known presets: django, rails, laravel, go.',
            fix: 'Use one of them or pass { header, cookie } / { header, meta } / { header, token: () => string }.',
        });
        return p ? { ...p } : null;
    }
    return v;
}

function _cookie(name) {
    if (typeof document === 'undefined') return '';
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? m[1] : '';
}

/** { header, token } для unsafe-запроса или null */
function _csrfToken() {
    let c = _config.csrf;
    if (c === undefined && typeof document !== 'undefined') {
        const meta = document.querySelector('meta[name="aegis-csrf"]');
        c = _config.csrf = meta ? _csrfPreset(meta.content.trim()) : null;
    }
    if (!c) {
        // конвенция Rails/htmx: <meta name="csrf-token">
        const m = typeof document !== 'undefined' && document.querySelector('meta[name="csrf-token"]');
        return m ? { header: 'X-CSRF-Token', token: m.content } : null;
    }
    let token = '';
    if (typeof c.token === 'function') token = c.token();
    else if (c.meta) token = document.querySelector(`meta[name="${c.meta}"]`)?.content || '';
    else if (c.cookie) { token = _cookie(c.cookie); if (c.decode) try { token = decodeURIComponent(token); } catch { /* as is */ } }
    return token ? { header: c.header, token } : null;
}

const _UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function _originOf(u) { try { return new URL(u, location.href).origin; } catch (e) { return null; } }
function _sameOrigin(u) { return _originOf(u) === location.origin; }   // fail closed: неразобранный URL — чужой
let _trusted = null;
/** Доверенные origin: свой, baseURL и configure({ origins }) — только им уходят глобальные заголовки и CSRF-токен */
function _trustedOrigins() {
    if (!_trusted) {
        _trusted = new Set([location.origin]);
        const b = _config.baseURL && _originOf(_config.baseURL); if (b) _trusted.add(b);
        for (const o of _config.origins || []) { const oo = _originOf(o); if (oo) _trusted.add(oo); }
    }
    return _trusted;
}
/** Заголовки для URL: плоские — только доверенным origin; per-origin { 'https://api.example': {...} } и '*' — явно */
function _headersFor(u) {
    const o = _originOf(u), all = _config.headers || {}, h = new Headers();
    const ok = o !== null && _trustedOrigins().has(o);
    for (const k of Object.keys(all)) {
        const v = all[k];
        if (/^https?:\/\//i.test(k)) { if (v && typeof v === 'object' && _originOf(k) === o) new Headers(v).forEach((vv, kk) => h.set(kk, vv)); }
        else if (k === '*') { if (v && typeof v === 'object') new Headers(v).forEach((vv, kk) => h.set(kk, vv)); }
        else if (ok) h.set(k, v);
    }
    return h;
}

/** AbortSignal.any с полифиллом (Safari < 17.4) */
function _composeSignal(...signals) {
    const list = signals.filter(Boolean);
    if (!list.length) return undefined;
    if (list.length === 1) return list[0];
    if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
    const c = new AbortController();
    for (const s of list) {
        if (s.aborted) { c.abort(s.reason); break; }
        s.addEventListener('abort', () => c.abort(s.reason), { once: true });
    }
    return c.signal;
}

function _timeoutSignal(ms) {
    if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    const c = new AbortController();
    setTimeout(() => c.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
    return c.signal;
}

async function _parseBody(response) {   // JSON → _safeParse: __proto__ из ответа не попадает в объекты
    if (response.status === 204) return null;
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('json')) return response.text().then(_safeParse).catch(() => null);
    const text = await response.text();
    if (/^\s*[\[{]/.test(text) && !ct.includes('json')) {
        _warn('E015', !globalThis.AEGIS_PROD && {
            what: `Response from ${response.url || 'request'} looks like JSON but content-type is "${ct || 'missing'}".`,
            why: 'Only application/json responses are parsed; this one is returned as a string.',
            fix: 'Send Content-Type: application/json (new Response(body, { headers: { "Content-Type": "application/json" } }) in mocks).',
        });
    }
    return text;
}

function _isBodyInit(b) {
    return typeof b === 'string' || b instanceof FormData || b instanceof Blob || b instanceof URLSearchParams
        || b instanceof ArrayBuffer || ArrayBuffer.isView(b) || (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream);
}

/**
 * Единый HTTP-запрос: baseURL, query, JSON-тело для объектов, CSRF для unsafe same-origin,
 * timeout, композиция signal, HttpError с разобранным телом.
 *   await request('/api/todos', { method: 'POST', body: { text }, timeout: 5000 })
 *   request(url, { raw: true }) → Response без разбора
 */
export async function request(url, init = {}, _t = _gfTether) {
    const { method = 'GET', body, query, headers, signal, timeout = _config.timeout, raw = false, ifMatch, ...rest } = init;
    let u = String(url);
    if (_config.baseURL && !/^(?:[a-z]+:)?\/\//i.test(u)) u = _config.baseURL.replace(/\/$/, '') + '/' + u.replace(/^\//, '');
    if (query) {
        const qs = new URLSearchParams(query).toString();
        if (qs) u += (u.includes('?') ? '&' : '?') + qs;
    }
    const h = _headersFor(u);
    if (headers) {
        const hh = new Headers(headers);
        if ((!globalThis.AEGIS_PROD && _dev()) && !_trustedOrigins().has(_originOf(u))) for (const k of ['authorization', 'x-api-key', 'cookie', 'x-csrf-token']) if (hh.has(k)) _warn('S009', !globalThis.AEGIS_PROD && { what: `request(): "${k}" header sent to ${_originOf(u)} — not a trusted origin.`, why: 'Credentials leak to third parties this way (Axios CVE-2023-45857).', fix: 'Add the origin to configure({ origins: [...] }) if it really is yours.' }, 'cred:' + _originOf(u));
        hh.forEach((v, k) => h.set(k, v));
    }
    if (ifMatch) h.set('If-Match', ifMatch);                          // оптимистичная блокировка: сервер отвечает 412 при чужой правке
    let b = body;
    if (b != null && typeof b === 'object' && !_isBodyInit(b)) {
        b = JSON.stringify(b);
        if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
    }
    const m = method.toUpperCase();
    if (_UNSAFE.has(m) && _trustedOrigins().has(_originOf(u))) {
        const t = _csrfToken();
        if (t && !h.has(t.header)) h.set(t.header, t.token);
    }
    const sig = _composeSignal(signal, timeout > 0 ? _timeoutSignal(timeout) : null);
    const doFetch = _config.fetch || fetch;
    const cbKey = _config.breaker ? _cbKey(u) : null;
    if (cbKey !== null) _cbBefore(cbKey);
    if (_config.retryBudget) _rb.t.push(Date.now());
    let response;
    try { response = await doFetch(u, { ...rest, method: m, headers: h, body: b, signal: sig }); }
    catch (e) { if (cbKey !== null && e?.name !== 'AbortError') _cbAfter(cbKey, e); throw e; }
    if (cbKey !== null) _cbAfter(cbKey, response.ok ? null : { status: response.status, response });
    // серверная инвалидация: Aegis-Invalidate: /api/users*, /api/stats  (аналог HX-Trigger; только same-origin)
    const invName = _config.invalidateHeader;
    if (invName && _sameOrigin(u) && _ext.invalidate) {
        const inv = response.headers.get(invName);
        if (inv) for (const p of inv.split(',')) { const t = p.trim(); if (t) _ext.invalidate(t); }
    }
    if (raw) return response;
    const data = await _parseBody(response);
    if (!response.ok) {
        const err = new HttpError(response.status, response, data);
        if (_config.onError) _config.onError(err, { url: u, status: response.status });
        throw err;
    }
    return data;
}

// ---- Circuit breaker per origin: closed → open (fail-fast, e.circuit) → half-open (один probe) → closed
const _cb = new Map();
function _cbKey(u) {
    const c = _config.breaker;
    if (c && typeof c === 'object' && typeof c.key === 'function') { try { return String(c.key(u)); } catch (e) { return ''; } }
    try { return new URL(u, typeof location !== 'undefined' ? location.href : 'http://localhost/').origin; } catch (e) { return ''; }
}
function _cbBefore(k) {
    const st = _cb.get(k); if (!st) return;
    const now = Date.now();
    if (st.openUntil > now || (st.openUntil && st.half)) {
        const err = new HttpError(503, null, null);
        err.circuit = true; err.retryAt = st.openUntil;
        err.message = `HTTP 503 (circuit open for ${k} until ${new Date(st.openUntil).toISOString()})`;
        throw err;
    }
    if (st.openUntil) st.half = true;                                  // half-open: пропускаем один probe
}
function _cbAfter(k, err) {
    const c = _config.breaker; if (!c) return;
    const o = c === true ? {} : c;
    if (!err) { _cb.delete(k); return; }
    if (!_retryable(err)) return;
    let st = _cb.get(k); if (!st) { st = { fails: 0, openUntil: 0, half: false }; _cb.set(k, st); }
    st.fails++;
    const ra = _retryAfterMs(err);
    if (st.half || st.fails >= (o.threshold ?? 5) || ra) {
        st.half = false;
        const cooldown = o.cooldown ?? 5000;
        st.openUntil = Date.now() + Math.min(60000, Math.max(ra, cooldown * (1 + Math.random())));
    }
}

/** Сахар: api.get(url, opts) / api.post(url, body, opts) / put / patch / api.delete(url, opts) */
export const api = {
    get: (url, opts) => request(url, { ...opts, method: 'GET' }),
    post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
    put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body }),
    patch: (url, body, opts) => request(url, { ...opts, method: 'PATCH', body }),
    delete: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
};

/** Fetcher по умолчанию для resource(): request() + разбор тела. Подменяется через defaults.fetcher */
/** defaults объявлен в ядре (см. effect(): defaults.orphanEffects); fetcher: null → request() из этой секции */   // fetcher: null → request() из этой же секции (через _ext, чтобы defaults.motion не тянул сеть в бандл без запросов)
/** Актуальный fetcher: подмена defaults.fetcher, иначе request() — если секция запросов есть в сборке */
function _fetcher() { return defaults.fetcher || _ext.request || (() => { throw new Error('[Aegis] no request layer in this build — import { api } (or request) from aegis, or set defaults.fetcher'); }); }

/**
 * Fetch с auto-abort предыдущего запроса
 * При повторном вызове — предыдущий отменяется, пользовательский opts.signal уважается
 * При dispose scope — текущий отменяется
 */
export function guardedFetch(scope) {
    let controller = null;
    const pending = signal(false, 'guardedFetch:pending');
    const error = signal(null, 'guardedFetch:error');
    const _never = new Promise(() => {}); // устаревший вызов не резолвится вовсе — его продолжение не выполнится

    const gf = async (url, opts = {}) => {
        // Abort предыдущего
        if (controller) controller.abort();
        controller = new AbortController();
        const currentController = controller;
        const { stale, ...rest } = opts;
        batch(() => { pending.value = true; error.value = null; });
        try {
            const r = await _fetcher()(url, {
                ...rest,
                signal: _composeSignal(rest.signal, currentController.signal),
            });
            if (currentController.signal.aborted) return stale === 'undefined' ? undefined : _never;
            return r;
        } catch (e) {
            if (e.name === 'AbortError' || currentController.signal.aborted) return stale === 'undefined' ? undefined : _never;
            error.value = e;
            throw e;
        } finally {
            if (controller === currentController) { controller = null; pending.value = false; }
        }
    };
    gf.pending = pending;
    gf.error = error;

    // Auto-abort при dispose scope
    const abort = () => { if (controller) { controller.abort(); controller = null; pending.value = false; } };
    if (scope && scope.onDispose) scope.onDispose(abort);
    else if (_currentScope) _currentScope.onDispose(abort);

    return gf;
}
/** ctx.fetch в component() берёт guardedFetch отсюда; без request() в бандле его нет (см. _ctxFetch) */
const _gfTether = /* @__PURE__ */ _reg('guardedFetch', guardedFetch, 'request', request);

/** Пауза, прерываемая signal */
function _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        const id = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
        const onAbort = () => { clearTimeout(id); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

const _retryable = (e) => !e?.circuit && !e?.budget && (!e?.status || e.status === 408 || e.status === 429 || e.status >= 500);

/**
 * Повтор с exponential backoff и full jitter; уважает Retry-After; AbortError не повторяется.
 *   await withRetry(() => api.get('/x'), { retries: 3 })
 */
/** Retry-After | RateLimit-Reset → мс (0 — нет) */
function _retryAfterMs(e) {
    const h = e && e.response && e.response.headers;
    const v = h && h.get ? (h.get('Retry-After') ?? h.get('RateLimit-Reset')) : null;
    if (!v) return 0;
    const n = Number(v);
    return Number.isNaN(n) ? Math.max(0, Date.parse(v) - Date.now()) : n * 1000;
}
// Retry budget (Finagle): в окне window повторов не больше ratio × запросов + min — усиление нагрузки ≤ 1 + ratio
const _rb = { t: [], r: [] };
const _rbTrim = (a, now, w) => { while (a.length && now - a[0] > w) a.shift(); };
function _retryBudgetOk() {
    const c = _config.retryBudget; if (!c) return true;
    const o = c === true ? {} : c, w = o.window ?? 10000, now = Date.now();
    _rbTrim(_rb.t, now, w); _rbTrim(_rb.r, now, w);
    if (_rb.r.length >= (o.ratio ?? 0.2) * _rb.t.length + (o.min ?? 10)) return false;
    _rb.r.push(now); return true;
}
export async function withRetry(fn, { retries = 3, base = 1000, max = 30000, maxWait = 60000, signal, shouldRetry = _retryable } = {}) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn(attempt);
        } catch (e) {
            if (e?.name === 'AbortError' || signal?.aborted || attempt >= retries || !shouldRetry(e, attempt)) throw e;
            const slot = Math.min(max, base * 2 ** attempt);
            let delay = slot * Math.random();                              // full jitter
            const ra = _retryAfterMs(e);
            if (ra) {
                if (ra > maxWait) { try { e.retryAfter = ra; } catch (x) { /* */ } throw e; }   // сервер просит ждать дольше, чем мы готовы
                delay = ra + slot * Math.random();                         // Retry-After — нижняя граница, джиттер сверху (против «стада»)
            }
            if (!_retryBudgetOk()) { try { e.budget = true; } catch (x) { /* */ } throw e; }
            await _sleep(Math.min(delay, maxWait), signal);
        }
    }
}

/** retry-опция ресурса → число попыток */
function _retries(retry) {
    if (retry === true) return 3;
    if (typeof retry === 'number') return retry;
    if (typeof retry === 'function') return 3;
    return 0;
}

/**
 * Debounce с auto-cancel при dispose
 */
export function debounced(fn, ms) {
    let timer = null;
    let _dead = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const debounce = (...args) => {
        if (_dead) return;
        cancel();
        timer = setTimeout(() => { timer = null; fn(...args); }, ms);
    };
    debounce.cancel = cancel;
    debounce.flush = (...args) => { if (!_dead) { cancel(); fn(...args); } };
    if (_currentScope) _currentScope.onDispose(() => { cancel(); _dead = true; });
    return debounce;
}

/**
 * Throttle с auto-cancel при dispose
 */
export function throttled(fn, ms) {
    let last = 0, timer = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const throttle = (...args) => {
        const now = Date.now();
        const remaining = ms - (now - last);
        cancel();
        if (remaining <= 0) {
            last = now;
            fn(...args);
        } else {
            timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, remaining);
        }
    };
    throttle.cancel = cancel;
    if (_currentScope) _currentScope.onDispose(cancel);
    return throttle;
}

/**
 * Polling с auto-stop при dispose. В фоновой вкладке спит (background: true — не спать),
 * при возвращении во вкладку — запрос сразу.
 */
export function poll(fn, ms, { background = false } = {}) {
    let active = true;
    const hidden = () => !background && typeof document !== 'undefined' && document.hidden;
    const run = async () => {
        while (active) {
            if (hidden()) {
                await new Promise(r => document.addEventListener('visibilitychange', r, { once: true }));
                if (!active) break;
            }
            try { await fn(); } catch (e) { console.error('[Aegis] poll error:', e); }
            await new Promise(r => setTimeout(r, ms));
        }
    };
    run();
    return _scoped(() => { active = false; });
}


/** Сетевой бюджет спекуляций: configure({ speculation }), Save-Data / 2g / prefers-reduced-data → без прогрева; 3g — один запрос за раз */
function _netBudget() {
    const sp = _config.speculation;
    if (sp === false) return { speculate: false, lead: 0, max: 0 };
    const c = (typeof navigator !== 'undefined' && navigator.connection) || {};
    const respect = !(sp && typeof sp === 'object' && sp.saveData === 'ignore');
    if (respect && (c.saveData || /2g/.test(c.effectiveType || '') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-data: reduce)').matches))) return { speculate: false, lead: 0, max: 0 };
    if (c.effectiveType === '3g') return { speculate: true, lead: 0.5, max: 1 };
    return { speculate: true, lead: 1, max: (sp && typeof sp === 'object' && sp.maxInflight) || 3 };
}

// ── Горизонт прогрева по скорости скролла: 400 / 1200 / 3000 px (EWMA |Δy/Δt|), умноженный на lead бюджета ──
let _sv = 0, _st = 0, _sy = 0, _svOn = false;
function _scrollTier() { return _sv < 600 ? 400 : _sv < 2000 ? 1200 : 3000; }
function _trackScroll() {
    if (_svOn || typeof window === 'undefined') return;
    _svOn = true;
    window.addEventListener('scroll', () => { const t = performance.now(), y = window.scrollY; const dt = t - _st || 16; if (_st) _sv = 0.6 * _sv + 0.4 * Math.abs(y - _sy) / dt * 1000; _sy = y; _st = t; }, { passive: true });
}
function _warmMargin(m) { if (m !== 'auto') return m; _trackScroll(); return Math.round(_scrollTier() * (_netBudget().lead || 1)) + 'px'; }

// ============================================================================
// 5. DOM ENGINE — Tagged templates, Direct patching, Binding
// ============================================================================

const _templateCache = new WeakMap();
// ---- Trusted Types: одна passthrough-политика 'aegis' для литералов шаблона (единственный вызов — _parseTemplate), серверный HTML — через configure({ trustedTypes: { server } })
let _ttPolicy = null;
function _literalHTML(str) {
    if (_ttPolicy === null) {
        const tt = globalThis.trustedTypes;
        try { _ttPolicy = tt && typeof tt.createPolicy === 'function' ? tt.createPolicy((_config.trustedTypes && _config.trustedTypes.name) || 'aegis', { createHTML: (x) => x }) : false; } catch (e) { _ttPolicy = false; }
    }
    return _ttPolicy ? _ttPolicy.createHTML(str) : str;
}
let _ttEnforcedCache = null;
function _ttEnforced() {
    if (_ttEnforcedCache === null) { try { const t = document.createElement('template'); t.innerHTML = ''; _ttEnforcedCache = false; } catch (e) { _ttEnforcedCache = true; } }
    return _ttEnforcedCache;
}
/** Серверный HTML (swap/boost/wireForm/patch): строка → TrustedHTML политикой приложения; под enforcement без политики — S011 и null */
function _serverHTML(html, who) {
    if (typeof html !== 'string') return html;
    const p = _config.trustedTypes && _config.trustedTypes.server;
    if (p) { try { return typeof p === 'function' ? p(html, who) : (globalThis.trustedTypes && trustedTypes.getPolicy ? trustedTypes.getPolicy(p).createHTML(html) : html); } catch (e) { /* политика отказала */ } }
    if (_ttEnforced()) { _warn('S011', !globalThis.AEGIS_PROD && { what: `${who}(): Trusted Types are enforced and no server policy is configured.`, why: 'Server HTML is data; the browser refuses to parse an untyped string.', fix: "configure({ trustedTypes: { server: (html) => policy.createHTML(html) } }) — or sanitize on the server and expose that policy." }, 'tt:' + who); return null; }
    return html;
}
/** Минимальный санитайзер без Sanitizer API: script/iframe/object/embed, on*-атрибуты и javascript:-URL */
function _scrub(root) {
    for (const bad of root.querySelectorAll('script,iframe,object,embed,frame')) bad.remove();
    for (const el of root.querySelectorAll('*')) for (const a of [...el.attributes]) { if (/^on/i.test(a.name) || (_URL_ATTR.test(a.name) && /^\s*(?:javascript|vbscript|data):/i.test(a.value.replace(_C0, '')))) el.removeAttribute(a.name); }
    return root;
}
/** Полифилл Declarative Shadow DOM для путей, где парсер их не создаёт (DOMParser/innerHTML) */
function _upgradeDSD(root) {
    for (const t of root.querySelectorAll('template[shadowrootmode]')) {
        const host = t.parentNode; if (!host || host.shadowRoot || !host.attachShadow) continue;
        let sr; try { sr = host.attachShadow({ mode: t.getAttribute('shadowrootmode') === 'closed' ? 'closed' : 'open', delegatesFocus: t.hasAttribute('shadowrootdelegatesfocus') }); } catch (e) { continue; }
        sr.append(t.content); t.remove(); _upgradeDSD(sr);
    }
    return root;
}
/**
 * Единственная точка «строка → DOM» для серверного HTML: Trusted Types, Declarative Shadow DOM (parseHTMLUnsafe /
 * setHTMLUnsafe, Baseline 2024; иначе полифилл), sanitize: true | SanitizerConfig (Sanitizer API setHTML, иначе минимум + S012 в dev).
 *   whole: true → Document (страница), иначе DocumentFragment; null — Trusted Types без политики
 */
function _parseHTML(html, { whole = false, sanitize = false, who = 'swap' } = {}) {
    if (sanitize && typeof Element !== 'undefined' && typeof Element.prototype.setHTML === 'function') {
        const t = document.createElement('template');
        try { t.setHTML(html, sanitize === true ? {} : { sanitizer: sanitize }); return whole ? t.content : t.content; } catch (e) { /* → общий путь */ }
    }
    const src = _serverHTML(html, who);
    if (src == null) return null;
    let out;
    if (whole) {
        if (typeof Document !== 'undefined' && typeof Document.parseHTMLUnsafe === 'function') out = Document.parseHTMLUnsafe(src);
        else { out = new DOMParser().parseFromString(src, 'text/html'); _upgradeDSD(out); }
    } else {
        const t = document.createElement('template');
        if (typeof t.setHTMLUnsafe === 'function') t.setHTMLUnsafe(src); else { t.innerHTML = src; _upgradeDSD(t.content); }
        out = t.content;
    }
    if (sanitize) {
        _warn('S012', !globalThis.AEGIS_PROD && { what: `${who}({ sanitize }): Sanitizer API is not available — a minimal scrub was applied.`, why: 'Without Element.setHTML() only script/iframe/object, on* attributes and javascript: URLs are removed; this is not a full sanitizer.', fix: 'Sanitize on the server or ship DOMPurify for older browsers.' }, 'sanitize');
        _scrub(whole ? out.documentElement : out);
    }
    return out;
}

/**
 * Tagged template literal для CSP-safe DOM
 * Возвращает DocumentFragment с реактивными привязками
 */
export function html(strings, ...values) {
    if (!(Array.isArray(strings) && Array.isArray(strings.raw) && Object.isFrozen(strings))) {
        // подлинность: только объект шаблона из исходного кода (замороженный массив с .raw) может стать HTML — строка была бы innerHTML (XSS)
        _warn('E036', !globalThis.AEGIS_PROD && {
            what: `html() was called as a function with a ${typeof strings} — it is a template tag.`,
            why: 'Only source-code templates may become HTML; a string here would be innerHTML (XSS), so the call is refused.',
            fix: 'Write html`<p>${name}</p>` (backticks, no parentheses). For server HTML use swap(el, html) or tpl().',
        }, 'untagged');
        throw new TypeError('[Aegis] E036: html() without the template tag — see ERRORS.md');
    }
    // Кэш по strings (одинаковый шаблон = одинаковые strings по ссылке)
    let template = _templateCache.get(strings);
    const prevSite = _curSite, prevStrings = _curStrings;
    if ((!globalThis.AEGIS_PROD && _dev())) { _curSite = template ? template.site : _callSite(); _curStrings = strings; }
    try {
        if (!template) {
            template = _parseTemplate(strings);
            template.site = _curSite;
            _templateCache.set(strings, template);
        }
        const frag = _instantiate(template, values);
        frag[_RECIPE] = { template, values, nodes: _lastNodes };
        _flushAnchors(); // show()/list() внутри шаблона рендерятся сразу — без await nextTick в тестах
        return frag;
    } finally { _curSite = prevSite; _curStrings = prevStrings; }
}

// Якоря show()/list(), созданные до вставки в DOM: отложенный первый рендер.
// html`` и flushSync() выполняют их синхронно, microtask — запасной путь.
const _pendingAnchors = new Set();
function _deferAnchor(fn) {
    _pendingAnchors.add(fn);
    queueMicrotask(() => { if (_pendingAnchors.delete(fn)) fn(); });
}
function _flushAnchors() {
    if (!_pendingAnchors.size) return;
    for (const f of [..._pendingAnchors]) { if (_pendingAnchors.delete(f)) f(); }
}
/** Синхронно выполнить отложенные рендеры show()/list() и очередь эффектов (ручной parent.appendChild(list(…))) */
export function flushSync() {
    _flushAnchors();
    _flush();
}

// Маркеры для позиций динамических значений
const _MARKER = '<!--aegis-->';
const _MARKER_RE = /__aegis_(\d+)__/;

// Состояния токенизатора шаблона
const _T = {
    TEXT: 0, TAG_OPEN: 1, TAG: 2, ATTR_NAME: 3, AFTER_NAME: 4, BEFORE_VALUE: 5,
    VALUE_DQ: 6, VALUE_SQ: 7, VALUE_UNQ: 8, COMMENT: 9, CLOSE_TAG: 10, RAWTEXT: 11,
};
const _T_NAMES = ['text', 'tag name', 'tag', 'attribute name', 'tag', 'attribute value',
    'attribute value', 'attribute value', 'attribute value', 'comment', 'closing tag', 'raw text'];
const _RAWTEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const _WS = /\s/;

/**
 * Разбор шаблона конечным автоматом по HTML-грамматике.
 * Для каждой интерполяции точно известно, где она стоит:
 *   text                → comment-маркер, потом _insertDynamic
 *   attribute value     → маркер __aegis_N__ внутри значения, элемент помечается data-aegis-el
 *   внутри тега         → ref: html`<input ${inputRef}>`
 *   всё остальное       → dev warning E006, значение пропускается
 */
const _FOREIGN_RE = /\s(v-(?:if|else|for|model|show|on|bind|html|text)|x-(?:data|show|if|for|on|bind|text|model|init)|ng-[a-z]+|\*ngIf|\[\(ngModel\)\])\s*=|\{\{[^}]*\}\}/;
function _parseTemplate(strings) {
    if ((!globalThis.AEGIS_PROD && _dev())) {
        const m = _FOREIGN_RE.exec(strings.join('\0'));
        if (m) {
            const tok = m[1] || m[0];
            const fix = /^\{\{/.test(tok) ? 'Interpolate with ${}: <p>${name}</p>; reactive text is ${sig} or ${() => …}.'
                : /^(v-if|x-if|x-show|v-show|\*ngIf)/.test(tok) ? 'Use show(cond, () => html`…`) or ${() => cond ? html`…` : null}.'
                : /^(v-for|x-for)/.test(tok) ? 'Use list(items, (item) => html`<li>${item.name}</li>`, { key: \'id\' }).'
                : /^(v-model|x-model|\[\(ngModel\)\])/.test(tok) ? 'Use bind:value=${sig}.'
                : /^(v-on|x-on)/.test(tok) ? 'Use @click=${fn} (modifiers: @submit.prevent, @keydown.enter).'
                : /^(v-bind|x-bind)/.test(tok) ? 'Use attr=${sig} or :attr=${sig} for a reactive attribute.'
                : 'Aegis templates are tagged html`` with ${} values: see llms.txt "Template syntax".';
            _warn('E033', !globalThis.AEGIS_PROD && {
                token: tok,
                what: `html\`\`: "${tok}" looks like ${/^v-/.test(tok) ? 'Vue' : /^x-/.test(tok) ? 'Alpine' : /^(ng|\*ng|\[\()/.test(tok) ? 'Angular' : 'mustache'} syntax — it is inert here.`,
                why: 'html`` has no directive compiler; unknown attributes become plain attributes and {{ }} is literal text.',
                fix,
            }, 'foreign:' + tok);
        }
    }
    let out = '';
    const bindings = [];     // { index, elId, rawAttr, type, name }
    const tagBindings = [];  // { index, elId }
    const skipped = new Set();
    const textIndices = [];  // индексы значений в текстовой позиции, в порядке маркеров
    let state = _T.TEXT;
    let tagName = '', attrName = '', rawEnd = '';
    let elId = -1;           // id текущего открытого тега, если он уже помечен
    let tagNameEnd = -1;     // позиция в out сразу после имени тега
    let nextId = 0;

    const markEl = () => {
        if (elId < 0) {
            elId = nextId++;
            const ins = ` data-aegis-el="${elId}"`;
            out = out.slice(0, tagNameEnd) + ins + out.slice(tagNameEnd);
            tagNameEnd += ins.length;
        }
        return elId;
    };
    const endTag = () => {
        const t = tagName.toLowerCase();
        if (_RAWTEXT_TAGS.has(t)) { rawEnd = '</' + t; return _T.RAWTEXT; }
        return _T.TEXT;
    };
    // Префиксы (Lit/Vue/Svelte-конвенции):
    //   @click=${fn}      → addEventListener
    //   .value=${sig}     → el.value = v      (свойство, регистр имени сохранён)
    //   ?disabled=${sig}  → toggleAttribute   (булев атрибут)
    //   bind:value=${sig} → двусторонняя привязка, = bind(el, sig)
    //   :title=${sig}     → реактивный АТРИБУТ
    const attrInfo = (raw) => raw[0] === '@' ? { type: 'event', name: raw.slice(1).split('.')[0], mods: raw.slice(1).split('.').slice(1) }
        : raw[0] === '.' ? { type: 'prop', name: raw.slice(1) }
        : raw[0] === '?' ? { type: 'bool', name: raw.slice(1) }
        : raw.startsWith('bind:') ? { type: 'model', name: raw.slice(5) }
        : raw[0] === ':' ? { type: 'bind', name: raw.slice(1) }
        : { type: 'attr', name: raw };

    for (let i = 0; i < strings.length; i++) {
        const s = strings[i];
        for (let j = 0; j < s.length; j++) {
            const c = s[j];
            switch (state) {
                case _T.TEXT:
                    if (c === '<') {
                        const n = s[j + 1];
                        if (s.startsWith('!--', j + 1)) { state = _T.COMMENT; out += '<!--'; j += 3; continue; }
                        if (n === '/') state = _T.CLOSE_TAG;
                        else if (n !== undefined && /[a-zA-Z]/.test(n)) { state = _T.TAG_OPEN; tagName = ''; elId = -1; }
                    }
                    break;
                case _T.COMMENT:
                    if (s.startsWith('-->', j)) { out += '-->'; j += 2; state = _T.TEXT; continue; }
                    break;
                case _T.CLOSE_TAG:
                    if (c === '>') state = _T.TEXT;
                    break;
                case _T.TAG_OPEN:
                    if (c === '>') { tagNameEnd = out.length; state = endTag(); }
                    else if (_WS.test(c) || c === '/') { tagNameEnd = out.length; state = _T.TAG; }
                    else tagName += c;
                    break;
                case _T.TAG:
                    if (c === '>') state = endTag();
                    else if (c !== '/' && !_WS.test(c)) { state = _T.ATTR_NAME; attrName = c; }
                    break;
                case _T.ATTR_NAME:
                    if (c === '=') state = _T.BEFORE_VALUE;
                    else if (c === '>') state = endTag();
                    else if (c === '/') state = _T.TAG;
                    else if (_WS.test(c)) state = _T.AFTER_NAME;
                    else attrName += c;
                    break;
                case _T.AFTER_NAME:
                    if (c === '=') state = _T.BEFORE_VALUE;
                    else if (c === '>') state = endTag();
                    else if (c === '/') state = _T.TAG;
                    else if (!_WS.test(c)) { state = _T.ATTR_NAME; attrName = c; }
                    break;
                case _T.BEFORE_VALUE:
                    if (c === '"') state = _T.VALUE_DQ;
                    else if (c === "'") state = _T.VALUE_SQ;
                    else if (c === '>') state = endTag();
                    else if (!_WS.test(c)) state = _T.VALUE_UNQ;
                    break;
                case _T.VALUE_DQ:
                    if (c === '"') state = _T.TAG;
                    break;
                case _T.VALUE_SQ:
                    if (c === "'") state = _T.TAG;
                    break;
                case _T.VALUE_UNQ:
                    if (c === '>') state = endTag();
                    else if (_WS.test(c)) state = _T.TAG;
                    break;
                case _T.RAWTEXT:
                    if (c === '<' && s.slice(j, j + rawEnd.length).toLowerCase() === rawEnd) state = _T.CLOSE_TAG;
                    break;
            }
            out += c;
        }
        if (i === strings.length - 1) break;

        // ---- интерполяция values[i] ----
        switch (state) {
            case _T.TEXT:
                out += _MARKER;
                textIndices.push(i);
                break;
            case _T.BEFORE_VALUE:
            case _T.VALUE_DQ:
            case _T.VALUE_SQ:
            case _T.VALUE_UNQ: {
                const id = markEl();
                out += `__aegis_${i}__`;
                bindings.push({ index: i, elId: id, rawAttr: attrName, ...attrInfo(attrName) });
                if (state === _T.BEFORE_VALUE) state = _T.VALUE_UNQ;
                break;
            }
            case _T.TAG:
            case _T.AFTER_NAME: {
                tagBindings.push({ index: i, elId: markEl() });
                state = _T.TAG;
                break;
            }
            default:
                skipped.add(i);
                _curValueIndex = i;
                _warn('E006', !globalThis.AEGIS_PROD && {
                    what: `html\`\`: value #${i} is in an unsupported position (${_T_NAMES[state]}).`,
                    why: 'Values can be text content, an attribute value, or a ref inside a tag. Tag names, comments and <script>/<style> bodies are static.',
                    fix: 'Move the value into text or an attribute, e.g. <div class=${x}> or <p>${x}</p>.',
                });
        }
    }

    const tpl = document.createElement('template');
    tpl.innerHTML = _literalHTML(out);   // out собран только из strings[] (авторский код) и маркеров — значения никогда не сериализуются
    return { tpl, parts: _compileParts(tpl.content, bindings, tagBindings, textIndices) };
}

/** Элементы, чьи пробельные текстовые дети не рендерятся (CSS 2.1 §16.6.1, анонимные боксы таблиц) */
const _WS_PARENTS = /*#__PURE__*/ new Set(['ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select', 'optgroup', 'datalist', 'menu']);
const _WS_KEEP = 'pre,textarea,listing,[style*=white-space]';
/**
 * Compile-time нормализация пробелов (Svelte/Solid делают это компилятором): пробельные текстовые узлы под списками/таблицами
 * и по краям шаблона удаляются, пробельные пробеги с переводом строки схлопываются в один пробел — рендеринг под
 * white-space: normal идентичен, а узлов в клоне на 30–50 % меньше. Маркеры-части не трогаются.
 */
function _normalizeWs(root, markers) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), drop = [];
    for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (markers.has(t) || t.data.trim()) continue;
        const p = t.parentNode;
        if (p.nodeType === 1 && p.closest(_WS_KEEP)) continue;
        if (p === root ? (t === root.firstChild || t === root.lastChild) : (p.nodeType === 1 && _WS_PARENTS.has(p.localName))) drop.push(t);
        else if (t.data.includes('\n')) t.data = ' ';
    }
    for (const t of drop) t.remove();
}
/**
 * Программа обхода (Euler-tour): части отсортированы по preorder-рангу, опкоды относительно предыдущего узла части:
 * 0 emit · -1 firstChild · -2 parentNode · n>0 nextSibling×n. Один монотонный курсор вместо обхода childNodes[] от корня
 * для каждой части (lit nodeIndex / Solid firstChild.nextSibling-цепочки).
 */
function _program(paths) {
    const prog = []; let cur = [];
    for (const p of paths) {
        let c = 0; while (c < cur.length && c < p.length && cur[c] === p[c]) c++;
        if (c === cur.length && c === p.length) { prog.push(0); continue; }        // тот же узел — вторая часть (ещё один атрибут)
        for (let u = cur.length - 1; u > c; u--) prog.push(-2);           // подняться до уровня расхождения
        if (c < cur.length) { const d = p[c] - cur[c]; if (d > 0) prog.push(d); else if (d < 0) { throw new Error('unsorted parts'); } }
        else { prog.push(-1); if (p[c]) prog.push(p[c]); }
        for (let k = c + 1; k < p.length; k++) { prog.push(-1); if (p[k]) prog.push(p[k]); }
        prog.push(0); cur = p;
    }
    return Int16Array.from(prog);
}
function _resolveProg(frag, prog, out) {
    let n = frag, k = 0;
    for (let i = 0; i < prog.length; i++) {
        const op = prog[i];
        if (op === 0) out[k++] = n;
        else if (op === -1) n = n.firstChild;
        else if (op === -2) n = n.parentNode;
        else for (let j = 0; j < op; j++) n = n.nextSibling;
    }
    return out;
}
const _cmpPath = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
/**
 * Compile-проход по шаблону — один раз на strings: маркер-атрибуты снимаются, статика атрибутов разбирается,
 * comment-маркеры заменяются пустыми Text-узлами, пробелы нормализуются, для каждой привязки один раз выбирается
 * специализированный committer (по статическим фактам: тип, имя, тег), части сортируются по preorder и компилируются в программу обхода.
 * Клоны шаблона чистые (в живом DOM нет data-aegis-el и <!--aegis-->), instantiate — importNode + курсор по программе + committers.
 *   part: { kind: 0 attr | 1 ref | 2 text, path, elPath (индексы children — для adopt), tag, ic, ... }
 */
function _compileParts(root, bindings, tagBindings, textIndices) {
    const pathOf = (node) => {
        const path = [];
        for (let n = node; n !== root; n = n.parentNode) { let i = 0; for (let c = n.previousSibling; c; c = c.previousSibling) i++; path.unshift(i); }
        return path;
    };
    const elPathOf = (el) => {
        const path = [];
        for (let n = el; n !== root && n.nodeType === 1; n = n.parentNode) { let i = 0; for (let c = n.previousElementSibling; c; c = c.previousElementSibling) i++; path.unshift(i); }
        return path;
    };
    const byEl = new Map();   // elId → { attrs: Map(rawAttr → group), refs: [index] }
    const entry = (id) => { let e = byEl.get(id); if (!e) byEl.set(id, e = { attrs: new Map(), refs: [] }); return e; };
    for (const b of bindings) {
        const e = entry(b.elId);
        let g = e.attrs.get(b.rawAttr);
        if (!g) e.attrs.set(b.rawAttr, g = { rawAttr: b.rawAttr, type: b.type, name: b.name, mods: b.mods, indices: [] });
        g.indices.push(b.index);   // class="a ${x} ${y}" — одна привязка
    }
    for (const t of tagBindings) entry(t.elId).refs.push(t.index);
    const els = [];
    for (const el of root.querySelectorAll('[data-aegis-el]')) {
        const e = byEl.get(+el.getAttribute('data-aegis-el'));
        el.removeAttribute('data-aegis-el');
        if (e) els.push([el, e]);
    }
    // comment-маркеры → пустые Text-узлы (cloneNode их сохраняет; текст пишется прямо в .data без insert/remove)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const comments = [];
    let node;
    while ((node = walker.nextNode())) if (node.data === 'aegis') comments.push(node);
    const markers = new Set();
    const texts = comments.map((c) => { const t = document.createTextNode(''); c.parentNode.replaceChild(t, c); markers.add(t); return t; });
    _normalizeWs(root, markers);
    const parts = [];
    for (const [el, e] of els) {
        const path = pathOf(el), elPath = elPathOf(el), tag = el.localName;
        for (const g of e.attrs.values()) {
            const statics = (el.getAttribute(g.rawAttr) ?? '').split(_MARKER_RE);   // чётные — статика, нечётные — индекс значения
            el.removeAttribute(g.rawAttr);
            const part = { kind: 0, path, elPath, tag, rawAttr: g.rawAttr, type: g.type, name: g.name, mods: g.mods, indices: g.indices, statics, single: statics.length === 3 && statics[0] === '' && statics[2] === '', ic: { n: 0, last: undefined, folded: undefined, mega: false }, commit: null, sink: g.type === 'attr' || g.type === 'bind' ? _sink(tag, g.name, statics[0]) : 0 };
            part.commit = _committer(part);
            parts.push(part);
        }
        for (const index of e.refs) parts.push({ kind: 1, path, elPath, tag, index });
    }
    texts.forEach((t, k) => {
        const index = textIndices[k];
        if (index === undefined) return;
        const parent = t.parentNode;
        const isEl = parent !== root && parent.nodeType === 1;
        let sole = isEl;   // adopt(): маркер — единственный непробельный ребёнок элемента
        if (isEl) for (let c = parent.firstChild; c; c = c.nextSibling) if (c !== t && !(c.nodeType === 3 && !markers.has(c) && !c.data.trim())) { sole = false; break; }
        parts.push({ kind: 2, path: pathOf(t), elPath: isEl ? elPathOf(parent) : null, tag: isEl ? parent.localName : null, sole, index, ic: { n: 0, last: undefined, folded: undefined, mega: false } });
    });
    parts.sort((a, b) => _cmpPath(a.path, b.path) || a.kind - b.kind);   // preorder; части одного элемента подряд
    parts.prog = _program(parts.map(p => p.path));
    return parts;
}

// ── inline-кэш части (Self/PIC → html-шаблоны): один и тот же call-site почти всегда получает значение одного вида.
// Примитив, пришедший дважды подряд одним и тем же значением, впекается в мастер-шаблон (часть становится бесплатной:
// клон уже содержит текст/атрибут); промах guard'а — unfold мастера и переход в megamorphic (всегда общий путь).
function _icFold(template, part, v, apply) {
    const ic = part.ic;
    if (ic.mega) return false;
    if (ic.folded !== undefined) {
        if (Object.is(v, ic.folded)) return true;                       // guard: значение уже в клоне
        _icUnfold(template, part); ic.mega = true; return false;
    }
    if (ic.n++ >= 1 && Object.is(v, ic.last)) { _icDoFold(template, part, v); ic.folded = v; return false; }   // 2-й раз то же — впечь (текущий экземпляр применяет обычно)
    ic.last = v;
    return false;
}
function _icMaster(template, part) { let n = template.tpl.content; for (const i of part.path) n = n.childNodes[i]; return n; }
function _icDoFold(template, part, v) { const m = _icMaster(template, part); if (part.kind === 2) m.data = String(v); else m.setAttribute(part.name, v === true ? '' : String(v)); }
function _icUnfold(template, part) { const m = _icMaster(template, part); if (part.kind === 2) m.data = ''; else m.removeAttribute(part.name); part.ic.folded = undefined; }

/**
 * Контекст sink-а атрибута решается при компиляции по статическому префиксу: SINK_EVENT (on*), SINK_HTML (srcdoc),
 * SINK_URL — только если префикс не закрывает схему (href="/u/${id}" закрыт: '/' вне алфавита схемы → значение не может
 * выбрать javascript:). Prefix-closure над регулярным языком ^[A-Za-z][A-Za-z0-9+.-]*: — без ложных отрицаний, ноль стоимости
 * на обновление для закрытых частей.
 */
const _URL_ATTR = /^(?:href|src|action|formaction|xlink:href|data|codebase|poster|ping|background|cite|longdesc|manifest)$/i;
const _SCHEME_ALPHA = /^[A-Za-z0-9+.\-]*$/;
const _C0 = /[\u0000-\u0020]/g;
function _sink(tag, name, prefix) {
    if (/^on/i.test(name)) return 1;
    if (name === 'srcdoc') return 2;
    if (_URL_ATTR.test(name) || ((tag === 'a' || tag === 'area' || tag === 'form' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'script' || tag === 'link' || tag === 'base') && (name === 'src' || name === 'href' || name === 'action'))) {
        return _SCHEME_ALPHA.test(String(prefix || '').replace(_C0, '')) ? 3 : 0;
    }
    return 0;
}
const _SAFE_SCHEME = /^(?:https?|mailto|tel|sms|ftp|blob):/i;
/** URL-sink: значение выбрало схему → только безопасные (+ configure({ urlSchemes })), иначе about:blank + S002 */
function _safeUrl(v, el, name) {
    if (v && typeof v === 'object' && v[_TRUST] !== undefined) return String(v[_TRUST]);
    const str = String(v), t = str.replace(_C0, '');
    const m = /^([a-z][a-z0-9+.\-]*):/i.exec(t);
    if (!m || _SAFE_SCHEME.test(t) || (el.localName === 'img' && /^data:image\//i.test(t)) || (_config.urlSchemes && _config.urlSchemes.includes(m[1].toLowerCase()))) return str;
    _warn('S002', !globalThis.AEGIS_PROD && { what: `html\`\`: ${name}="${m[1]}:…" blocked on <${el.localName}>.`, why: 'The value chose the URL scheme; javascript:/data:/vbscript: URLs execute code.', fix: 'Pass a path or an https URL, wrap a vetted value in trusted(url), or allow the scheme with configure({ urlSchemes: [\'myapp\'] }).', el }, 'url:' + name);
    return 'about:blank#aegis-unsafe';
}
const _isTrustedHTML = (v) => (typeof TrustedHTML !== 'undefined' && v instanceof TrustedHTML) || (v && typeof v === 'object' && v[_TRUST] !== undefined);
/** Запись атрибута с учётом sink-а: событие строкой — никогда, srcdoc — только TrustedHTML/trusted(), URL — через _safeUrl */
function _setAttrSafe(el, name, v, sink) {
    if (sink === 1) { _warn('S003', !globalThis.AEGIS_PROD && { what: `html\`\`: ${name}=${typeof v} — inline handler as a string is refused.`, why: 'A string in an on* attribute is code injection; only functions are handlers.', fix: `Write @${name.slice(2)}=\${fn} or ${name}=\${fn}.`, el }, 'evtstr:' + name); return; }
    if (sink === 2) { if (!_isTrustedHTML(v)) { _warn('S004', !globalThis.AEGIS_PROD && { what: `html\`\`: ${name} needs TrustedHTML or trusted().`, why: 'srcdoc / innerHTML sinks parse HTML: a plain string here is XSS.', fix: 'Pass a TrustedHTML from your policy or trusted(html) for author-vetted markup.', el }, 'html:' + name); return; } v = typeof TrustedHTML !== 'undefined' && v instanceof TrustedHTML ? v : v[_TRUST]; el.setAttribute(name, String(v)); return; }
    el.setAttribute(name, sink === 3 ? _safeUrl(v, el, name) : (v === true ? '' : String(v)));
}
const _FORM_TAGS = /*#__PURE__*/ new Set(['input', 'select', 'textarea', 'option']);
const _PROP_ONLY = /*#__PURE__*/ new Set(['indeterminate', 'srcObject', 'muted', 'volume', 'currentTime', 'playbackRate']);
const _ALWAYS_ATTR = /*#__PURE__*/ new Set(['class', 'style', 'id', 'slot', 'part', 'is', 'role']);
/** Первая проекция Футамуры вручную: интерпретатор привязки специализируется на статике шаблона (тип, имя, тег) — на экземпляр остаётся только вид значения */
function _committer(p) {
    const { type, name, indices, statics, single, tag } = p;
    const i0 = indices[0];
    if (type === 'event') { const desc = _compileMods(name, p.mods); return (el, values) => { _eventCommit(el, name, desc, values[i0]); }; }
    if (type === 'prop' || type === 'bool' || type === 'model') {
        if (!single) return (el) => _warn('E006', !globalThis.AEGIS_PROD && { what: `html\`\`: ${p.rawAttr} takes exactly one value.`, why: 'Property, boolean and bind: bindings assign a single JS value, not a string.', fix: `Write ${p.rawAttr}=\${value} without surrounding text.` });
        if (type === 'model') return (el, values) => _modelCommit(el, name, values[i0]);
        if (type === 'bool') return (el, values) => { const v = values[i0]; if (typeof v === 'function' && !isSignal(v)) return { k: 2, node: el, name, get: v, last: undefined }; _bindBool(el, name, v); };
        return (el, values) => { const v = values[i0]; if (typeof v === 'function' && !isSignal(v) && name !== 'value') return { k: 3, node: el, name, get: v, last: undefined }; _bindProp(el, name, v); };
    }
    // Голые value/checked/selected на полях формы — это свойства, не атрибуты; property-only имена — тоже
    if (single && ((_FORM_PROPS.has(name) && _FORM_TAGS.has(tag)) || _PROP_ONLY.has(name))) return (el, values) => _bindProp(el, name, values[i0]);
    const join = (values) => { let str = ''; for (let k = 0; k < statics.length; k++) str += (k % 2) ? _attrPart(values[+statics[k]]) : statics[k]; return str; };
    if (type === 'bind') return single ? (el, values) => _bindAttribute(el, name, values[i0], p.sink) : (el, values) => _bindAttribute(el, name, () => join(values), p.sink);
    if (single) {
        const onName = name.startsWith('on') ? name.slice(2) : null;
        const custom = tag.includes('-') && !_ALWAYS_ATTR.has(name);
        const foldable = name !== 'class' && name !== 'style' && !onName;
        return (el, values, template) => {
            const v = values[i0];
            if (onName && typeof v === 'function') { on(el, onName, v); return; }   // onclick=${fn}
            if (custom && name in el && typeof v !== 'string' && v != null && typeof v !== 'boolean') { _bindProp(el, name, v); return; }   // кастом-элемент: объект/массив/число — свойство (правило Vue shouldSetAsProp)
            if (typeof v === 'function' && !isSignal(v)) return { k: 1, node: el, name, get: v, last: undefined, sink: p.sink };   // fused
            if (isSignal(v)) { _bindAttribute(el, name, v, p.sink); return; }
            if ((name === 'class' || name === 'style') && v && typeof v === 'object') { _bindAttribute(el, name, v); return; }
            if (v == null || v === false) return;
            if (_devCache === true) _snapshotCheck(v, 'attribute ' + name);
            if (p.sink) { _setAttrSafe(el, name, v, p.sink); return; }
            if (foldable && template && _icFold(template, p, v)) return;
            el.setAttribute(name, v === true ? '' : String(v));
        };
    }
    return (el, values) => {
        const dynamic = indices.some(i => isSignal(values[i]) || typeof values[i] === 'function' || (values[i] && typeof values[i] === 'object'));
        if (dynamic) _bindAttribute(el, name, () => join(values), p.sink);
        else if (p.sink) _setAttrSafe(el, name, join(values), p.sink);
        else el.setAttribute(name, join(values));
    };
}
function _modelCommit(el, name, v) {
    // bind:field=${f.field('email')} — весь per-input слой формы
    if (name === 'field' && v && typeof v.$wire === 'function') { v.$wire(el); return; }
    // bind:value=${sig} | ${lens(get, set)} | ${[get, set]}
    if (!isSignal(v) && !_isFnBinding(v)) {
        _warn('E009', !globalThis.AEGIS_PROD && {
            what: `html\`\`: bind:${name} needs a signal, got ${typeof v}.`,
            why: 'Two-way binding writes user input back into the signal.',
            fix: `bind:${name}=\${mySignal} — pass the signal itself, not .value; for a derived or nested value: lens(get, set) or [get, set].`,
        });
        return;
    }
    bind(el, v);
}
function _eventCommit(el, name, desc, fn) {
    if (typeof fn === 'function') {
        if ((!globalThis.AEGIS_PROD && _dev()) && !name.includes('-') && !name.includes(':') && !('on' + name in el) && !('on' + name in window) && !_KNOWN_EVENTS.has(name)) {
            const near = _nearest(name, [..._KNOWN_EVENTS]);
            _warn('E032', !globalThis.AEGIS_PROD && {
                what: `html\`\`: @${name} — "${name}" is not a DOM event on <${el.localName}>.`,
                why: 'The listener is attached, but the browser never fires that name; a typo stays silent.',
                fix: near ? `Did you mean @${near}? For custom events use a name with a dash (@item-select).` : 'Check the event name; custom events should contain a dash (@item-select).',
                el,
            }, 'event:' + name);
        }
        _onCompiled(el, name, desc, fn);
    } else if (fn !== null && fn !== false && fn !== undefined || (fn === undefined && (!globalThis.AEGIS_PROD && _dev()))) {
        _warn('E034', !globalThis.AEGIS_PROD && {
            what: `html\`\`: @${name} got ${fn === undefined ? 'undefined' : typeof fn} instead of a function.`,
            why: fn === undefined ? 'The handler is undefined — a misspelled name, a missing import, or a method read off a plain object (this is lost).' : 'A handler was probably called instead of passed: @click=${save()} runs save() once at render time.',
            fix: `Pass the function itself: @${name}=${'${'}save} or @${name}=${'${'}() => save(id)}. Use null/false to skip a handler conditionally.`,
            el,
        }, 'handler:' + name);
    }
}
/**
 * Hole fusion (Svelte template_effect в рантайме): все «чистые» дырки экземпляра — текст/атрибут/bool/prop с функцией —
 * ведёт ОДИН эффект с мемо по слотам; DOM пишется только для изменившихся слотов. Дырка, вернувшая Node/массив,
 * понижается до собственного эффекта (_insertDynamic) и дальше не участвует.
 */
function _fused(writers, owner) {
    const w = writers;
    effect(() => {
        for (let i = 0; i < w.length; i++) {
            const sl = w[i]; if (sl.demoted) continue;
            const v = sl.get();
            if (sl.k === 0 && (v instanceof Node || Array.isArray(v) || (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof URL)))) {
                sl.demoted = true;                                           // блок-дырка: свой эффект под владельцем, не под этим запуском
                const prevT = _tracking; _tracking = null;
                try { (owner ? owner.run(() => _insertDynamic(sl.node, sl.get)) : _insertDynamic(sl.node, sl.get)); } finally { _tracking = prevT; }
                continue;
            }
            if (Object.is(v, sl.last)) continue;
            sl.last = v;
            switch (sl.k) {
                case 0: { const str = v == null || v === false ? '' : String(v); if (sl.node.data !== str) sl.node.data = str; break; }
                case 1: if (v == null || v === false) sl.node.removeAttribute(sl.name); else if (sl.sink) _setAttrSafe(sl.node, sl.name, v, sl.sink); else sl.node.setAttribute(sl.name, v === true ? '' : String(v)); break;
                case 2: sl.node.toggleAttribute(sl.name, !!v); break;
                case 3: { const next = v == null ? null : v; if (sl.node[sl.name] !== next) sl.node[sl.name] = next; break; }
            }
        }
    }, 'html:fused');
}

let _lastNodes = null;   // узлы частей последнего экземпляра — для рецепта (patch на месте)
function _instantiate(template, values) {
    const parts = template.parts;
    const n = parts.length;
    const fragment = document.importNode(template.tpl.content, true);   // узлы рождаются в живом документе — без adopt при вставке
    _lastNodes = null;
    if (!n) return fragment;
    // сначала резолвим ВСЕ узлы одним курсором по программе — вставка Node вместо маркера сдвинула бы индексы соседей
    const nodes = _resolveProg(fragment, parts.prog, new Array(n));
    let writers = null;
    for (let i = 0; i < n; i++) {
        const part = parts[i];
        _curValueIndex = part.kind === 0 ? part.indices[0] : part.index;
        if (part.kind === 0) { const wr = part.commit(nodes[i], values, template); if (wr) (writers || (writers = [])).push(wr); }
        else if (part.kind === 1) _applyRef(nodes[i], values[part.index], part.index);
        else {
            const v = values[part.index];
            if (typeof v === 'function' && !isSignal(v)) (writers || (writers = [])).push({ k: 0, node: nodes[i], get: v, last: undefined, demoted: false });
            else if (v == null || typeof v !== 'object' && !isSignal(v)) {                       // примитив: inline-кэш может впечь в мастер
                if (_devCache === true) _snapshotCheck(v, 'text');
                if (!_icFold(template, part, v)) { const str = v == null || v === false ? '' : String(v); if (nodes[i].data !== str) nodes[i].data = str; }
            }
            else _insertDynamic(nodes[i], v);
        }
    }
    if (writers) _fused(writers, _currentScope);
    _curValueIndex = -1;
    _lastNodes = nodes;
    return fragment;
}
/**
 * Patch по рецепту (lit TemplateInstance): реактивная дырка вернула html`` с теми же strings — обновить существующий
 * экземпляр на месте, а не сносить и строить заново. Патчатся примитивы в текстовых частях и одиночных атрибутах;
 * всё остальное (сигналы, функции, узлы, события) должно совпадать по ссылке — иначе null (полная замена).
 */
function _patchRecipe(inst, r) {
    if (!inst || !r || inst.template !== r.template || !inst.nodes) return false;
    const parts = inst.template.parts, ov = inst.values, nv = r.values;
    // проход 1: можно ли пропатчить всё
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i], idx = p.kind === 0 ? p.indices[0] : p.index;
        if (p.kind === 0 && p.indices.length > 1) { for (const k of p.indices) if (!Object.is(ov[k], nv[k])) return false; continue; }
        const a = ov[idx], b = nv[idx];
        if (Object.is(a, b)) continue;
        const prim = (v) => v == null || (typeof v !== 'object' && typeof v !== 'function');
        if (!(prim(a) && prim(b))) return false;
        if (p.kind === 1) return false;
        if (p.kind === 0 && (p.type !== 'attr' || !p.single || p.name === 'class' || p.name === 'style' || p.name.startsWith('on') || _FORM_PROPS.has(p.name) || _PROP_ONLY.has(p.name) || p.tag.includes('-'))) return false;
    }
    // проход 2: применить
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i], idx = p.kind === 0 ? p.indices[0] : p.index;
        const a = ov[idx], b = nv[idx];
        if (Object.is(a, b) || (p.kind === 0 && p.indices.length > 1)) continue;
        const node = inst.nodes[i];
        if (p.kind === 2) { const str = b == null || b === false ? '' : String(b); if (node.data !== str) node.data = str; }
        else if (b == null || b === false) node.removeAttribute(p.name);
        else node.setAttribute(p.name, b === true ? '' : String(b));
    }
    inst.values = nv;
    return true;
}

/** html`<input ${x}>` — значение внутри тега: attach(fn), ref() или callback-ref */
function _applyRef(el, v, index) {
    if (v && v[_ATTACH]) _runAttach(el, v.fn, v.opts, _currentScope);   // attach(fn)
    else if (v && typeof v._set === 'function') v._set(el);          // ref()
    else if (typeof v === 'function') {                              // callback-ref (до монтирования)
        const cleanup = v(el);
        if (typeof cleanup === 'function' && _currentScope) _currentScope.onDispose(cleanup);
    } else _warn('E006', !globalThis.AEGIS_PROD && {
        what: `html\`\`: value #${index} inside a tag is not a ref or attach().`,
        why: 'Only ref(), attach(fn) or (el) => {} callbacks are accepted between attributes.',
        fix: 'Use <canvas ${attach(el => …)}>, <input ${myRef}> or an attribute: <input value=${x}>.',
    });
}

const _FORM_PROPS = new Set(['value', 'checked', 'selected']);

/** Прочитать значение привязки: signal → .value, функция → вызов, иначе как есть */
function _readBinding(v) {
    return isSignal(v) ? v.value : typeof v === 'function' ? v() : v;
}

/** .prop=${v} — свойство элемента; null/undefined для value → '' */
function _bindProp(el, name, v) {
    if (name === 'innerHTML' || name === 'outerHTML' || name === 'srcdoc') {   // HTML-sink через .prop — только TrustedHTML / trusted()
        _bindValue(v, (val) => { if (val == null || val === false) { el[name] = ''; return; } if (!_isTrustedHTML(val)) { _warn('S004', !globalThis.AEGIS_PROD && { what: `.${name} needs TrustedHTML or trusted().`, why: 'innerHTML/srcdoc parse HTML: a plain string here is XSS.', fix: 'Use html\`\` for markup, or pass trusted(html) / a TrustedHTML from your policy.', el }, 'html:' + name); return; } el[name] = typeof TrustedHTML !== 'undefined' && val instanceof TrustedHTML ? val : String(val[_TRUST]); });
        return;
    }
    const assign = (val) => {
        const next = val == null ? (name === 'value' ? '' : null) : val;
        if (el[name] !== next) el[name] = next;
        // <select .value>: <option> могут прийти позже (list()) — повторить после вставки
        if (name === 'value' && el.tagName === 'SELECT' && el.value !== next) {
            queueMicrotask(() => { if (el.value !== next) el.value = next; });
        }
    };
    _bindValue(v, assign);
}

/** ?attr=${v} — булев атрибут */
function _bindBool(el, name, v) {
    if (isSignal(v) || typeof v === 'function') effect(() => el.toggleAttribute(name, !!_readBinding(v)));
    else el.toggleAttribute(name, !!v);
}

const _ATTACH = /*#__PURE__*/ Symbol('aegis.attach');

/**
 * Поведение на элементе после монтирования: init + cleanup + реактивность одной функцией.
 *   html`<canvas ${attach(c => { const chart = new Chart(c, …); return () => chart.destroy(); })}>`
 *   attach(el, fn, { once: true })   — на серверный DOM, сразу в текущем scope
 * fn выполняется как effect (перезапуск при изменении прочитанных сигналов, cleanup перед
 * каждым перезапуском и при dispose); once: true — без трекинга, только init/cleanup.
 */
export function attach(a, b, c) {
    if (a instanceof Node) return _runAttach(a, b, c || {}, _currentScope);
    return { [_ATTACH]: true, fn: a, opts: b || {} };
}

function _runAttach(el, fn, opts, owner) {
    let stop = null, stopped = false;
    const start = () => {
        if (stopped) return;
        const run = () => effect(() => (opts.once ? untrack(() => fn(el)) : fn(el)), 'attach');
        stop = owner ? owner.run(run) : run();
    };
    if (el.isConnected) start();
    else {
        // элемент из html`` ещё не вставлен: ждём microtask, потом один кадр
        queueMicrotask(() => {
            if (stopped) return;
            if (el.isConnected) return start();
            requestAnimationFrame(() => {
                if (stopped) return;
                if (el.isConnected) start();
                else _warn('E014', !globalThis.AEGIS_PROD && {
                    what: 'attach(): element was never connected to the document.',
                    why: 'Third-party widgets need a rendered element (sizes, focus, document).',
                    fix: 'Insert the template into the DOM in the same task, or call attach(el, fn) after inserting.',
                });
            });
        });
    }
    const dispose = () => { stopped = true; if (stop) { stop(); stop = null; } };
    if (owner) owner.onDispose(dispose);
    return dispose;
}

/**
 * Привязка значения к узлу: сигнал — прямая подписка (без effect/deps), функция — effect, примитив — один раз.
 * apply не вызывается повторно с тем же значением.
 */
/** Dev-детектор зомби-привязок (E028): узел выпал из документа, а привязка продолжает его обновлять */
function _zombieCheck(h, name) {
    if (h._el.isConnected) { h._seen = true; h._detached = 0; return; }
    if (h._seen && (h._detached = (h._detached || 0) + 1) >= 2 && !h._warnedZombie) {
        h._warnedZombie = true;
        _warn('E028', !globalThis.AEGIS_PROD && {
            site: h._site,
            what: `binding "${name}" keeps updating <${(h._el.tagName || '').toLowerCase()}> that is no longer in the document.`,
            why: 'The node was replaced or removed while its owner scope is alive — the binding, its subscription and the detached subtree leak until the owner is disposed.',
            fix: 'Render the branch through show()/list(), or dispose the binding (const off = text(el, …); off()) before dropping the node.',
        }, 'zombie:' + name);
    }
}

/**
 * Побочный эффект — авто-трекинг зависимостей
 * fn может вернуть cleanup-функцию: она вызывается перед следующим запуском и при dispose.
 * Каждый запуск выполняется под scope, в котором effect был создан.
 * Возвращает dispose-функцию
 *
 * Dev warning если вызван вне scope
 */

/** Привязать DOM-узел к привязке для детектора зомби (E028); узел, уже стоящий в документе, считается «виденным» */
function _markEl(d, el) {
    const h = d._node && !d._node._src ? d._node : d;   // эффект — метка на узле; подписка (subscribe) — на самой функции off, её проверяет колбэк
    if (h === _noop) return;
    h._el = el;
    if (el.isConnected) h._seen = true;
}

function _bindValue(value, apply, name) {
    if (isSignal(value)) {
        let last = value.peek();
        apply(last);
        const off = value.subscribe((v) => { if (!Object.is(v, last)) { last = v; apply(v); if (off._el && (!globalThis.AEGIS_PROD && _dev())) _zombieCheck(off, name || 'binding'); } });
        return off;
    }
    if (typeof value === 'function') {
        let last, first = true;
        return effect(() => { const v = value(); if (first || !Object.is(v, last)) { first = false; last = v; apply(v); } }, name);
    }
    apply(value);
    return _noop;
}

/** Значение части атрибута → строка (signal / функция / примитив) */
function _attrPart(v) {
    if (isSignal(v)) v = v.value;
    else if (typeof v === 'function') v = v();
    if (v && typeof v === 'object') return _clsx(v);   // class="a ${{ b: sig }}" / массив
    return v == null || v === false ? '' : (v === true ? '' : String(v));
}

const _KEYS = { enter: 'Enter', esc: 'Escape', escape: 'Escape', space: ' ', tab: 'Tab', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', delete: 'Delete', backspace: 'Backspace' };
const _MOD_KEYS = { ctrl: 'ctrlKey', meta: 'metaKey', shift: 'shiftKey', alt: 'altKey' };

/** Модификаторы события разбираются один раз на шаблон: дескриптор без аллокаций на экземпляр */
function _compileMods(event, mods) {
    if (!mods || !mods.length) return null;
    const d = { opts: null, target: 0, outside: false, keys: null, modKeys: null, prevent: false, stop: false, self: false, debounce: 0, throttle: 0 };
    for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        if (m === 'prevent') d.prevent = true;
        else if (m === 'stop') d.stop = true;
        else if (m === 'self') d.self = true;
        else if (m === 'once' || m === 'passive' || m === 'capture' || m === 'direct') (d.opts || (d.opts = {}))[m] = true;
        else if (m === 'outside') d.outside = true;
        else if (m === 'window') d.target = 1;
        else if (m === 'document') d.target = 2;
        else if (m === 'debounce' || m === 'throttle') {
            const n = /^\d+$/.test(mods[i + 1] || '') ? +mods[++i] : 250;
            if (m === 'debounce') d.debounce = n; else d.throttle = n;
        } else if (_KEYS[m]) (d.keys || (d.keys = [])).push(_KEYS[m]);
        else if (_MOD_KEYS[m]) (d.modKeys || (d.modKeys = [])).push(_MOD_KEYS[m]);
        else if (/^\d+$/.test(m)) { /* число после debounce/throttle уже съедено */ }
        else _warn('E020', !globalThis.AEGIS_PROD && {
            what: `html\`\`: unknown event modifier ".${m}" on @${event}.`,
            why: 'Only prevent, stop, self, once, passive, capture, direct, outside, window, document, debounce.N, throttle.N, key names (enter, esc, space, tab, up, down, left, right, delete, backspace) and ctrl/meta/shift/alt are supported.',
            fix: `Remove ".${m}" or handle it inside the listener.`,
        });
    }
    if (d.prevent && d.opts && d.opts.passive) _warn('E020', !globalThis.AEGIS_PROD && {
        what: `@${event}.prevent.passive — preventDefault() is ignored in a passive listener.`,
        why: 'Browsers cannot cancel a passive event.',
        fix: 'Drop .passive or drop .prevent.',
    });
    return d;
}
function _onCompiled(el, event, d, fn) {
    if (!d) return on(el, event, fn);
    let handler = fn;
    if (d.debounce) handler = debounced(handler, d.debounce);
    else if (d.throttle) handler = throttled(handler, d.throttle);
    const keys = d.keys, modKeys = d.modKeys, outside = d.outside, self = d.self, prevent = d.prevent, stop = d.stop;
    const wrapped = function (e) {
        if (outside) { if (el.contains(e.target)) return; }
        else if (self && e.target !== el) return;
        if (keys && !keys.includes(e.key)) return;
        if (modKeys) for (const mk of modKeys) if (!e[mk]) return;
        if (prevent) e.preventDefault();
        if (stop) e.stopPropagation();
        return handler.call(this, e);
    };
    const target = d.target === 1 ? window : d.target === 2 || (outside && !d.target) ? document : el;
    return on(target, event, wrapped, d.opts || undefined);
}
/** Обработчик события с модификаторами (Alpine/Vue-семантика) — для вызовов вне шаблона */
function _onWithMods(el, event, mods, fn) { return _onCompiled(el, event, _compileMods(event, mods), fn); }

/** Обёртки для стиля Svelte 5: @submit=${prevent(save)} */
export const prevent = (fn) => function (e) { e.preventDefault(); return fn.call(this, e); };
export const stop = (fn) => function (e) { e.stopPropagation(); return fn.call(this, e); };
export const self = (fn) => function (e) { if (e.target === this) return fn.call(this, e); };

const _KNOWN_EVENTS = /*#__PURE__*/ new Set(['click', 'dblclick', 'input', 'change', 'submit', 'reset', 'keydown', 'keyup', 'keypress', 'focus', 'blur', 'focusin', 'focusout', 'pointerdown', 'pointerup', 'pointermove', 'pointerenter', 'pointerleave', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'contextmenu', 'wheel', 'touchstart', 'touchend', 'touchmove', 'touchcancel', 'scroll', 'scrollend', 'resize', 'load', 'error', 'abort', 'toggle', 'close', 'cancel', 'select', 'paste', 'copy', 'cut', 'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop', 'animationstart', 'animationend', 'animationiteration', 'transitionstart', 'transitionend', 'transitioncancel', 'play', 'pause', 'ended', 'timeupdate', 'volumechange', 'loadedmetadata', 'canplay', 'invalid', 'beforeinput', 'compositionstart', 'compositionend', 'hashchange', 'popstate', 'visibilitychange', 'online', 'offline', 'beforeunload', 'unload', 'pageshow', 'pagehide', 'message', 'storage', 'fullscreenchange', 'slotchange', 'formdata']);


/** Имя элемента для диагностики: button#save.btn */
const _tag = (el) => el && el.tagName
    ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList && el.classList[0] ? '.' + el.classList[0] : '')
    : String(el);

/** clsx-семантика: строка | массив | { name: truthy } (сигналы и функции читаются внутри effect) */
function _clsx(v) {
    if (v == null || v === false) return '';
    if (typeof v === 'string') return v;
    if (isSignal(v)) return _clsx(v.value);
    if (typeof v === 'function') return _clsx(v());
    if (Array.isArray(v)) { let out = ''; for (const x of v) { const c = _clsx(x); if (c) out += (out ? ' ' : '') + c; } return out; }
    if (typeof v === 'object') { let out = ''; for (const k in v) if (_readBinding(v[k])) out += (out ? ' ' : '') + k; return out; }
    return String(v);
}

/** Реактивный class: объект/массив — diff только классов, поставленных Aegis (статика и чужие классы не трогаются) */
function _bindClass(el, value) {
    const dynamic = isSignal(value) || typeof value === 'function' || (value && typeof value === 'object');
    if (!dynamic) { el.setAttribute('class', _clsx(value)); return; }
    let mine = new Set();
    effect(() => {
        const next = new Set(_clsx(value).split(/\s+/).filter(Boolean));
        for (const c of mine) if (!next.has(c)) el.classList.remove(c);
        for (const c of next) if (!mine.has(c)) el.classList.add(c);
        mine = next;
    }, (!globalThis.AEGIS_PROD && _dev()) ? `html:class@${_tag(el)}` : undefined);
}

/** Одно свойство style; --custom-property через setProperty (иначе создаётся мёртвое JS-свойство) */
function _setStyle(el, prop, v) {
    if (prop.startsWith('--')) {
        if (v == null || v === '') el.style.removeProperty(prop);
        else el.style.setProperty(prop, String(v));
    } else {
        el.style[prop] = v == null ? '' : v;
    }
}

function _bindAttribute(el, name, value, sink = 0) {
    if (name === 'class' || name === 'className') {
        _bindClass(el, value);
    } else if (name === 'style' && value && typeof value === 'object' && !isSignal(value)) {
        styleMap(el, value);                                    // style=${{ color, '--x': sig }} — per-property, cssText не трогается
    } else if (name === 'style' && (typeof value === 'function' || isSignal(value))) {
        effect(() => {
            const v = _readBinding(value);
            if (v && typeof v === 'object') { for (const k in v) _setStyle(el, k, _readBinding(v[k])); return; }
            const str = v == null || v === false ? '' : String(v);
            if (el.getAttribute('style') !== str) el.setAttribute('style', str);
        }, (!globalThis.AEGIS_PROD && _dev()) ? `html:style@${_tag(el)}` : undefined);
    } else {
        _bindValue(value, (v) => {
            if (v == null || v === false) el.removeAttribute(name);
            else if (sink) _setAttrSafe(el, name, v, sink);
            else el.setAttribute(name, v === true ? '' : String(v));
        }, (!globalThis.AEGIS_PROD && _dev()) ? `html:${name}@${_tag(el)}` : undefined);
    }
}

/** Нормализовать результат рендера в массив узлов (диапазон всегда непустой) */
function _nodesOf(v) {
    if (v instanceof DocumentFragment) {
        const nodes = [...v.childNodes];
        return nodes.length ? nodes : [document.createComment('aegis:empty')];
    }
    if (v instanceof Node) return [v];
    if (Array.isArray(v)) {
        const out = [];
        for (const item of v) for (const n of _nodesOf(item)) out.push(n);
        return out.length ? out : [document.createComment('aegis:empty')];
    }
    if (v == null || v === false) return [document.createComment('aegis:empty')];
    return [document.createTextNode(String(v))];
}

const _canMove = typeof Element !== 'undefined' && 'moveBefore' in Element.prototype;
/** Перестановка без remove+insert (Node.moveBefore, Chrome 133+/Firefox 144+/Safari 26): iframe, video, фокус, выделение, анимации и popover переживают reorder */
function _move(parent, node, ref) {
    if (_canMove && node.isConnected && node.getRootNode() === parent.getRootNode()) {
        try { parent.moveBefore(node, ref); return; } catch (e) { /* HierarchyRequestError → обычная вставка */ }
    }
    parent.insertBefore(node, ref);
}
function _insertNodes(nodes, parent, ref) {
    if (nodes.length === 1) { _move(parent, nodes[0], ref); return; }
    if (_canMove && nodes[0].isConnected) { for (const n of nodes) _move(parent, n, ref); return; }   // фрагмент нельзя moveBefore
    const f = document.createDocumentFragment();
    for (const n of nodes) f.appendChild(n);
    parent.insertBefore(f, ref);
}

/** Фокус внутри удаляемых узлов → на первый focusable соседа (следующий, затем предыдущий), иначе на fallback-контейнер (tabindex=-1) */
function _focusNeighbor(nodes, fallback, who) {
    const a = document.activeElement;
    if (!a || a === document.body || !nodes.some(n => n === a || (n.nodeType === 1 && n.contains(a)))) return;
    const pick = (start, dir) => {
        for (let sib = start; sib; sib = dir > 0 ? sib.nextSibling : sib.previousSibling) {
            if (sib.nodeType !== 1 || sib.hasAttribute('data-leaving') || nodes.includes(sib)) continue;
            const f = sib.matches(_FOCUSABLE) ? sib : sib.querySelector(_FOCUSABLE);
            if (f) return f;
        }
        return null;
    };
    let t = pick(nodes[nodes.length - 1].nextSibling, 1) || pick(nodes[0].previousSibling, -1);
    if (!t && fallback && fallback.nodeType === 1) { t = fallback; if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); }
    if (t) { t.focus({ preventScroll: true }); return; }
    if ((!globalThis.AEGIS_PROD && _dev())) _warn('E050', !globalThis.AEGIS_PROD && {
        what: `${who || 'DOM update'}: the focused <${a.localName}${a.id ? '#' + a.id : ''}> is being removed — focus falls to <body>.`,
        why: 'Keyboard and screen-reader users lose their place: the reader goes silent and the next Tab restarts from the top (WCAG 2.4.3).',
        fix: 'Move focus to a sibling or the container before removing; for list() rows re-rendered on object replacement pass { item: \'signal\' }.',
        el: a,
    }, 'focus:' + (who || 'dom'));
}
function _removeNodes(nodes, fallback, who) {
    if (fallback !== undefined && typeof document !== 'undefined') _focusNeighbor(nodes, fallback, who);
    if (nodes.length === 1) { nodes[0].remove(); return; }
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (first.parentNode && first.parentNode === last.parentNode) {
        const r = document.createRange();
        r.setStartBefore(first);
        r.setEndAfter(last);
        r.deleteContents();
    } else {
        for (const n of nodes) n.remove();
    }
}

const _RECIPE = /*#__PURE__*/ Symbol('aegis.recipe');

/**
 * Живая копия фрагмента из html``: привязки создаются заново в текущем scope.
 * cloneNode(true) копирует только DOM — эффекты остались бы на узлах оригинала.
 * Фрагмент, содержащий готовые узлы (list()/show()-якоря, элементы), не воспроизводим — тогда cloneNode + E013.
 */
export function clone(frag) {
    const r = frag && frag[_RECIPE];
    if (r && !r.values.some(v => v instanceof Node)) return _instantiate(r.template, r.values);
    _warn('E013', !globalThis.AEGIS_PROD && {
        what: 'clone(): fragment cannot be re-instantiated — falling back to cloneNode(true).',
        why: r ? 'It contains list()/show() anchors or DOM nodes; their bindings live on the original nodes.'
               : 'The fragment was not produced by html``.',
        fix: 'Pass a factory instead: show(cond, () => html`…`), portal(target, () => html`…`).',
    });
    return frag.cloneNode(true);
}

/** dev: статическое значение в html`` совпало с недавним untracked-чтением сигнала — почти наверняка ${sig.value} вместо ${sig} */
function _snapshotCheck(v, where) {
    if (!_untracked || v == null || v === '' || typeof v === 'boolean' || typeof v === 'object' || typeof v === 'function') return;
    for (let i = _untracked.length - 1; i >= 0; i--) {
        const u = _untracked[i];
        if (!Object.is(u.v, v)) continue;
        const nm = u.s._name || 'sig';
        _warn('E048', !globalThis.AEGIS_PROD && {
            what: `html\`\`: \${${nm}.value} in ${where} is a snapshot — the ${typeof v} is inserted once and never updates.`,
            why: '.value read outside an effect returns the current value; the template receives a plain value and cannot subscribe.',
            fix: `Pass the signal itself (\${${nm}}) or a getter (\${() => ${nm}.value > 3 ? 'a' : 'b'}). A deliberate one-time snapshot: \${${nm}.peek()}.`,
            token: '.value',
        }, 'snapshot:' + (_curSite ? _curSite.short : '') + ':' + _curValueIndex);
        return;
    }
}
function _insertDynamic(marker, value) {
    const parent = marker.parentNode;
    const asText = (v) => {
        if (v == null || v === false) return '';
        if (v instanceof Node || Array.isArray(v)) return '';
        if (typeof v === 'object' && (!globalThis.AEGIS_PROD && _dev()) && !(v instanceof Date) && !(v instanceof URL)) {
            const isPromise = typeof v.then === 'function';
            _warn('E031', !globalThis.AEGIS_PROD && {
                what: `html\`\`: ${isPromise ? 'a Promise' : 'an object'} was rendered as text — it shows as "${String(v)}".`,
                why: isPromise ? 'Templates are synchronous; a Promise is not awaited.' : 'Only strings, numbers, signals, functions and nodes render as text.',
                fix: isPromise ? 'Put the async work in resource() and render it with when(res, { data }), or await before rendering.' : 'Pick a field (${user.name}), JSON.stringify(), or return a node from a function.',
                el: parent && parent.nodeType === 1 ? parent : undefined,
            }, 'text-object:' + _tag(parent));
        }
        return String(v);
    };

    if (isSignal(value)) {
        // Сигнал в тексте: прямая подписка на Text-узел маркера, без effect и без вставок
        const first = value.peek();
        if (!(first instanceof Node) && !Array.isArray(first)) {
            const d = _bindValue(value, (v) => { const str = asText(v); if (marker.data !== str) marker.data = str; });
            _markEl(d, marker);
            return;
        }
    }
    if (isSignal(value) || typeof value === 'function') {
        // Реактивная «дырка»: текст, узел, фрагмент, массив, null — тип решается на каждом запуске; маркер остаётся якорем
        const owner = _currentScope;
        const vSite = _curSite, vStrings = _curStrings, vIndex = _curValueIndex;
        let nodes = [], scope = null;
        const clear = () => {
            if (scope) { scope.dispose(); scope = null; }
            if (nodes.length) _removeNodes(nodes);
            nodes = [];
        };
        let inst = null;   // рецепт текущего экземпляра: тот же шаблон с другими примитивами патчится на месте (фокус и узлы живут)
        effect(() => {
            const next = new Scope(owner);
            const v = next.run(() => isSignal(value) ? value.value : value());
            const p = marker.parentNode;
            if (vSite) { _curSite = vSite; _curStrings = vStrings; _curValueIndex = vIndex; }
            if (!p) { next.dispose(); return; }
            if (v instanceof Node || Array.isArray(v)) {
                const r = v[_RECIPE];
                if (r && inst && scope && _patchRecipe(inst, r)) { next.dispose(); if (vSite) { _curSite = null; _curStrings = null; _curValueIndex = -1; } return; }
                inst = r && r.nodes ? { template: r.template, values: r.values, nodes: r.nodes } : null;
                clear();
                if (marker.data) marker.data = '';
                nodes = _nodesOf(v);
                if (nodes.length > 20) {
                    _warn('E012', !globalThis.AEGIS_PROD && {
                        what: `html\`\`: a reactive child returned ${nodes.length} nodes.`,
                        why: 'Non-keyed re-render replaces every node — inputs lose focus and state.',
                        fix: 'Use list(items, render, key) for collections.',
                    });
                }
                _insertNodes(nodes, p, marker);
                scope = next;
            } else {
                next.dispose();
                if (nodes.length) clear();
                const str = asText(v);
                if (marker.data !== str) marker.data = str;
            }
            if (vSite) { _curSite = null; _curStrings = null; _curValueIndex = -1; }
        }, (!globalThis.AEGIS_PROD && _dev()) ? `html:child@${_tag(parent)}` : 'html:child');
        // dispose владельца: отключить привязки, но DOM оставить как есть (destroy() замораживает остров)
        if (owner) owner.onDispose(() => { if (scope) { scope.dispose(); scope = null; } });
        return;
    }

    if (value instanceof Node) {
        // элемент, фрагмент или comment-якорь list()/show()
        parent.insertBefore(value, marker);
        parent.removeChild(marker);
    } else if (Array.isArray(value)) {
        for (const item of value) parent.insertBefore(item instanceof Node ? item : document.createTextNode(String(item ?? '')), marker);
        parent.removeChild(marker);
    } else {
        if (_devCache === true) _snapshotCheck(value, 'text');
        marker.data = asText(value);   // статический текст: 0 вставок
    }
}


// ============================================================================
// 6. DOM HELPERS — bind, text, attr, cls, style, show
// ============================================================================

/**
 * Привязать текстовое содержимое к существующему DOM-узлу
 */
/** Детектор потерянной реактивности: text/cls/style с примитивом вместо сигнала */
function _staticWarn(helper, el, v) {
    if (v == null || typeof v === 'function' || isSignal(v) || (v && typeof v === 'object')) return;
    _warn('E019', !globalThis.AEGIS_PROD && {
        what: `${helper}(${_tag(el)}, ${JSON.stringify(v)}) received a plain value — it will render once and never update.`,
        why: 'A .value read outside a function is evaluated immediately; the helper cannot subscribe to it.',
        fix: `Pass the signal (${helper}(el, count)) or a function (${helper}(el, () => count.value)).`,
    }, helper + '@' + _tag(el));
}

export function text(el, fn) {
    _staticWarn('text', el, fn);
    const d = _bindValue(fn, (v) => { const str = v == null || v === false ? '' : String(v); _setText(el, str); }, (!globalThis.AEGIS_PROD && _dev()) ? `text@${_tag(el)}` : undefined);
    _markEl(d, el);
    return d;
}

/**
 * Привязать атрибут
 */
export function attr(el, name, fn) {
    const sink = _sink(el.localName || '', name, '');
    return effect(() => {
        const v = _readBinding(fn);
        if (v == null || v === false) el.removeAttribute(name);
        else if (sink) _setAttrSafe(el, name, v, sink);
        else el.setAttribute(name, v === true ? '' : String(v));
    }, (!globalThis.AEGIS_PROD && _dev()) ? `attr:${name}@${_tag(el)}` : undefined);
}

/**
 * Toggle CSS-класс
 */
export function cls(el, name, fn) {
    if (typeof name !== 'string') {
        // cls(el, { active: sig, done: () => … }) / cls(el, ['a', sig]) — diff только своих классов
        _bindClass(el, name);
        return _noop;
    }
    _staticWarn('cls', el, fn);
    const d = effect(() => {
        el.classList.toggle(name, !!_readBinding(fn));
    }, (!globalThis.AEGIS_PROD && _dev()) ? `cls:${name}@${_tag(el)}` : undefined);
    _markEl(d, el);
    return d;
}

/**
 * Привязать CSS-свойство
 */
export function style(el, prop, fn) {
    _staticWarn('style', el, fn);
    return effect(() => {
        _setStyle(el, prop, _readBinding(fn));
    }, (!globalThis.AEGIS_PROD && _dev()) ? `style:${prop}@${_tag(el)}` : undefined);
}

/** CSS custom properties из сигналов: cssVars(el, { x, progress }) → --x, --progress (дешёвая анимация: сигнал → переменная → CSS) */
export function cssVars(el, vars) {
    const map = {};
    for (const k in vars) map[k.startsWith('--') ? k : '--' + k] = vars[k];
    return styleMap(el, map);
}

/**
 * Привязать несколько CSS-свойств через map { prop: signal/fn/string }
 *
 * @example
 *   styleMap(el, {
 *       color: () => isError.value ? 'red' : 'inherit',
 *       opacity: fadeSignal,
 *       transform: 'translateY(0)',
 *   });
 */
export function styleMap(el, styles) {
    const disposers = [];
    for (const [prop, fn] of Object.entries(styles)) {
        disposers.push(style(el, prop, fn));
    }
    return () => disposers.forEach(d => d());
}

/**
 * Привязать value (input, select)
 */
export function bind(el, sig) {
    if (_isFnBinding(sig)) sig = lens(sig[0], sig[1], 'bind');           // [get, set] — function binding
    if (!isSignal(sig)) throw new Error('[Aegis] bind() requires a signal, a lens() or a [get, set] pair');

    const disposers = [];

    // Signal → DOM — handle checkbox/radio correctly
    disposers.push(effect(() => {
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!sig.value;
        } else {
            el.value = sig.value ?? '';
        }
    }));

    // DOM → Signal
    const handler = () => {
        const v = el.type === 'number' ? (el.value === '' ? null : Number(el.value))
                : el.type === 'checkbox' ? el.checked
                : el.value;
        sig.value = v;
    };
    disposers.push(on(el, 'input', handler));
    if (el.type === 'checkbox' || el.type === 'radio') disposers.push(on(el, 'change', handler));

    // return cleanup function like other DOM helpers
    return () => disposers.forEach(d => d());
}

/**
 * Условный рендер
 * — scope per branch: dispose effects/listeners при переключении ветки
 * — opts.keep: ветки создаются один раз и прячутся (аналог v-show): DOM, состояние
 *   инпутов и scope сохраняются, эффекты внутри скрытой ветки продолжают работать
 * — ветка-фрагмент из html`` воспроизводится через clone() (живые привязки);
 *   лучше передавать фабрику: show(cond, () => html`…`)
 */
/** Раннер CSS-транзишенов для show/list: регистрирует transition() (секция 13); опция { transition } без импорта transition — ошибка, не тихий пропуск */
function _tr(el, phase, name) {
    const f = _ext.runTransition;
    if (!f) throw new Error('[Aegis] { transition } option needs import { transition } from aegis — it registers the CSS transition runner');
    return f(el, phase, name);
}
export function show(condition, trueBranch, falseBranch, opts = {}, _t = _showTether) {
    // show(cond, branch, { transition }) — опции третьим аргументом, если это не ветка (не функция/узел/строка)
    if (falseBranch && typeof falseBranch === 'object' && !(falseBranch instanceof Node) && !isSignal(falseBranch)) { opts = falseBranch; falseBranch = null; }
    const tname = opts.transition === true ? 'aegis' : opts.transition || null;
    if (typeof condition === 'boolean') _warn('E019', !globalThis.AEGIS_PROD && {
        what: 'show() received a static boolean — the branch will never toggle.',
        why: 'A .value read outside a function is evaluated once (show(count.value > 3, …)).',
        fix: 'show(open, …) with the signal, or show(() => count.value > 3, …).',
    });
    const anchor = document.createComment('aegis:show');
    const keep = !!opts.keep;
    // capture parent scope at creation time
    const _parentScope = _currentScope;
    let currentNodes = [];
    let currentBranch = null;
    let _branchScope = null;
    const _kept = { true: null, false: null }; // keep-режим: { nodes, hide, scope }

    const _build = (content, scope) => scope.run(() => {
        if (typeof content === 'function') return content();
        if (content instanceof DocumentFragment) {
            if (content.childNodes.length === 0 && !content[_RECIPE]) {
                _warn('E013', !globalThis.AEGIS_PROD && {
                    what: 'show(): the fragment is empty — it was already inserted somewhere.',
                    why: 'A DocumentFragment empties on insert; the same fragment cannot be shown twice.',
                    fix: 'Pass a factory: show(cond, () => html`…`).',
                });
            }
            return clone(content);
        }
        if (content instanceof Node) return content;
        return document.createTextNode(String(content));
    });

    /** Спрятать/показать набор узлов: один элемент — display на нём, иначе обёртка */
    const _hider = (nodes, parent, ref) => {
        if (nodes.length === 1 && nodes[0].nodeType === 1) {
            const el = nodes[0];
            const prev = el.style.display;
            parent.insertBefore(el, ref);
            return (visible) => { el.style.display = visible ? prev : 'none'; };
        }
        const wrapper = document.createElement('div');
        wrapper.style.display = 'contents';
        for (const n of nodes) wrapper.appendChild(n);
        parent.insertBefore(wrapper, ref);
        return (visible) => { wrapper.style.display = visible ? 'contents' : 'none'; };
    };

    const _insertKept = (branch) => {
        const content = branch === 'true' ? trueBranch : falseBranch;
        for (const b of ['true', 'false']) {
            const k = _kept[b];
            if (!k) continue;
            const el = tname && k.nodes.length === 1 && k.nodes[0].nodeType === 1 ? k.nodes[0] : null;
            if (!el) { k.hide(b === branch); continue; }
            if (b === branch) { k.hide(true); _tr(el, 'enter', tname); }
            else _tr(el, 'leave', tname).then(ok => { if (ok) k.hide(false); });
        }
        if (_kept[branch] || content == null) return;
        const scope = new Scope(_parentScope, `show:${branch}`);
        const nodes = _nodesOf(_build(content, scope));
        const hide = _hider(nodes, anchor.parentNode, anchor);
        _kept[branch] = { nodes, hide, scope };
    };

    const _doInsert = (branch) => {
        if (branch === currentBranch) return;
        currentBranch = branch;

        if (keep) { _insertKept(branch); return; }

        // Dispose предыдущей ветки
        if (_branchScope) {
            _branchScope.dispose();
            _branchScope = null;
        }

        // Убрать предыдущие DOM-узлы (с leave-анимацией, если задана)
        if (currentNodes.length) {
            const old = currentNodes;
            const el = tname && old.length === 1 && old[0].nodeType === 1 ? old[0] : null;
            if (el) { _focusNeighbor(old, anchor.parentNode, 'show()'); _tr(el, 'leave', tname).then(ok => { if (ok) _removeNodes(old); }); }
            else _removeNodes(old, anchor.parentNode, 'show()');
        }
        currentNodes = [];

        // Вставить новые
        const content = branch === 'true' ? trueBranch : falseBranch;
        if (content != null && anchor.parentNode) {
            _branchScope = new Scope(_parentScope, `show:${branch}`);
            currentNodes = _nodesOf(_build(content, _branchScope));
            _insertNodes(currentNodes, anchor.parentNode, anchor);
            if (tname && currentNodes.length === 1 && currentNodes[0].nodeType === 1) _tr(currentNodes[0], 'enter', tname);
        }
    };

    const _read = () => isSignal(condition) ? condition.value
        : typeof condition === 'function' ? condition() : condition;
    const _peekCondition = () => isSignal(condition) ? condition.peek() : _read();

    let _pending = false;
    effect(() => {
        const branch = _read() ? 'true' : 'false';
        if (anchor.parentNode) {
            _doInsert(branch);
        } else if (!_pending) {
            // ещё не в DOM — одна отложенная вставка с актуальным значением
            _pending = true;
            _deferAnchor(() => {
                _pending = false;
                if (anchor.parentNode) _doInsert(_peekCondition() ? 'true' : 'false');
            });
        }
    });

    // cleanup branch scope when parent scope disposes
    onDispose(() => {
        if (_branchScope) _branchScope.dispose();
        if (currentNodes.length) _removeNodes(currentNodes);
        currentNodes = [];
        for (const b of ['true', 'false']) {
            const k = _kept[b];
            if (!k) continue;
            k.scope.dispose();
            const w = k.nodes[0]?.parentNode;
            if (w && w.nodeType === 1 && w.style.display === 'contents' && w.hasAttribute('style') && w.tagName === 'DIV' && !w.id) w.remove();
            else _removeNodes(k.nodes);
            _kept[b] = null;
        }
    });

    return anchor;
}
const _showTether = /* @__PURE__ */ _reg('show', show);


/**
 * Три состояния ресурса прямо в html``:
 *   ${when(users, {
 *       loading: () => html`<p class="skeleton">…</p>`,          // пока data === null и идёт запрос
 *       error:   (err, retry) => html`<p>${err.message} <button @click=${retry}>Повторить</button></p>`,
 *       data:    (rows) => html`<ul>${list(rows, …)}</ul>`,       // строится один раз; refetch поверх данных ветку не пересоздаёт
 *   })}
 * Принимает любой объект с сигналами { data, loading, error } (+ refresh).
 */
/** Сообщение a11y: строка | функция | false */
const _say = (spec, key, level, ...args) => {
    if (!spec || spec[key] === false) return;
    const f = spec === true ? _A11Y_DEFAULT[key] : spec[key];
    const m = typeof f === 'function' ? f(...args) : f;
    if (m) announce(String(m), level);
};
// ---- сообщения по кодам: a11y-строки здесь, строки форм (_MESSAGES) подключает секция форм через _ext.msgs; setValidationMessages() переопределяет и те и другие
const _MSG_A11Y = {
    en: { 'a11y.error': 'Something went wrong', 'a11y.saved': 'Saved', 'a11y.undone': 'Change reverted', 'a11y.conflict': 'Someone else changed this record', 'a11y.queued': 'Saved offline, will sync later' },
    ru: { 'a11y.error': 'Что-то пошло не так', 'a11y.saved': 'Сохранено', 'a11y.undone': 'Изменение отменено', 'a11y.conflict': 'Запись изменил кто-то другой', 'a11y.queued': 'Сохранено офлайн, отправится позже' },
};
/** Переопределения setValidationMessages(): функция (code, params) → string или объект { code: string } */
let _messages = null;
/** Локаль сообщений валидации — сигнал: issues пересчитываются при смене языка (i18n({ syncLang }) и setValidationMessages(t) синхронизируют) */
const _vLocale = /* @__PURE__ */ signal(typeof document !== 'undefined' ? (document.documentElement.lang || 'en') : 'en', 'validation:locale');

function _msg(code, params) {
    const lang = String(_vLocale.value || 'en').slice(0, 2);
    let src = (typeof _messages === 'function' && _messages(code, params)) || (_messages && typeof _messages === 'object' && _messages[code]) || (_MSG_A11Y[lang] || _MSG_A11Y.en)[code] || _MSG_A11Y.en[code] || (_ext.msgs && ((_ext.msgs[lang] || _ext.msgs.en)[code] || _ext.msgs.en[code])) || code;
    if (src && typeof src === 'object') {   // plural-формы { one, few, many, other }
        const n = params && params.n;
        let form = 'other';
        if (typeof n === 'number' || (typeof n === 'string' && n !== '' && !isNaN(+n))) { try { form = new Intl.PluralRules(lang).select(+n); } catch (e) { form = 'other'; } }
        src = src[form] ?? src.other ?? Object.values(src)[0];
    }
    return String(src).replace(/\{(\w+)\}/g, (_, k) => params && params[k] != null ? params[k] : '');
}

const _A11Y_DEFAULT = {
    error: (e) => (e && e.message) || _msg('a11y.error'),
    success: () => _msg('a11y.saved'),
    undone: () => _msg('a11y.undone'),
    conflict: () => _msg('a11y.conflict'),
    queued: () => _msg('a11y.queued'),
};
/**
 * Занятость без disabled: aria-busy + aria-disabled + data-busy, клики/Enter глушатся — фокус остаётся на кнопке (Roselli: don't disable form controls).
 *   busy(saveBtn, addTodo.pending)
 */
export function busy(el, pending) {
    const swallow = (e) => { if (el.getAttribute('aria-disabled') === 'true' && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); } };
    el.addEventListener('click', swallow, true); el.addEventListener('keydown', swallow, true);
    const stop = effect(() => {
        const on_ = isSignal(pending) ? !!pending.value : !!pending();
        el.setAttribute('aria-busy', String(on_));
        if (on_) { el.setAttribute('aria-disabled', 'true'); el.setAttribute('data-busy', ''); } else { el.removeAttribute('aria-disabled'); el.removeAttribute('data-busy'); }
    }, 'busy');
    const off = () => { stop(); el.removeEventListener('click', swallow, true); el.removeEventListener('keydown', swallow, true); el.removeAttribute('aria-busy'); el.removeAttribute('aria-disabled'); el.removeAttribute('data-busy'); };
    if (_currentScope) _currentScope.onDispose(off);
    return off;
}
export function when(res, branches = {}, wopts = {}, _t = _whenTether) {
    const { busy: markBusy = true, announce: ann = { error: _A11Y_DEFAULT.error } } = wopts;
    const state = computed(() => {
        if (res.error && res.error.value) return 'error';
        if (res.data.value === null || res.data.value === undefined) return (res.loading && res.loading.value) ? 'loading' : 'empty';
        return 'data';
    }, 'when:state');
    const retry = () => res.refresh && res.refresh();
    const anchor = document.createComment('aegis:when');
    const parentScope = _currentScope;
    let nodes = [], scope = null, shown = null;
    const clear = () => {
        if (scope) { scope.dispose(); scope = null; }
        if (nodes.length) _removeNodes(nodes);
        nodes = [];
        shown = null;
    };
    const render = () => {
        const st = state.value;
        if (markBusy) applyBusy();                                   // якорь мог появиться в DOM после создания
        if (st === shown) return;
        const p = anchor.parentNode;
        if (!p) return;
        if (st === 'error') _say(ann, 'error', 'assertive', res.error.peek());
        else if (st === 'data' && shown === 'loading') _say(ann, 'data', 'polite', res.data.peek());   // только после реального ожидания
        else if (st === 'loading' && shown !== null) _say(ann, 'loading', 'polite');
        clear();
        shown = st;
        const fn = st === 'error' ? branches.error : st === 'loading' ? branches.loading : st === 'data' ? branches.data : (branches.empty || branches.loading);
        if (!fn) return;
        scope = new Scope(parentScope, `when:${st}`);
        // data(value, dataSignal): второй аргумент — сигнал, для реактивных list()/text() внутри ветки
        const out = scope.run(() => st === 'error' ? fn(res.error.peek(), retry) : st === 'data' ? fn(res.data.peek(), res.data) : fn());
        nodes = _nodesOf(out);
        _insertNodes(nodes, p, anchor);
    };
    let pending = false;
    effect(() => {
        state.value;
        if (anchor.parentNode) render();
        else if (!pending) { pending = true; _deferAnchor(() => { pending = false; render(); }); }
    }, 'when');
    // занятость контейнера: loading или validating (refetch поверх данных) — без объявления
    let busyOn = false;
    const applyBusy = () => { const p = anchor.parentNode; if (p && p.nodeType === 1) { if (busyOn) p.setAttribute('aria-busy', 'true'); else p.removeAttribute('aria-busy'); } };
    if (markBusy) effect(() => {
        busyOn = state.value === 'loading' || !!(res.validating && res.validating.value) || !!(res.inflight && res.inflight.value && state.value !== 'data');
        applyBusy();
    }, 'when:busy');
    if (parentScope) parentScope.onDispose(() => { if (scope) { scope.dispose(); scope = null; } const p = anchor.parentNode; if (p && p.nodeType === 1) p.removeAttribute('aria-busy'); });
    return anchor;
}
const _whenTether = /* @__PURE__ */ _reg('when', when);


// ============================================================================
// 7. LIST — Keyed reconciliation
// ============================================================================

/** Индексы наибольшей возрастающей подпоследовательности (значения -1 игнорируются) — O(n log n) */
function _lis(arr) {
    const n = arr.length, tails = [], prev = new Array(n).fill(-1), tailIdx = [];
    for (let i = 0; i < n; i++) {
        const v = arr[i];
        if (v < 0) continue;
        let lo = 0, hi = tails.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < v) lo = m + 1; else hi = m; }
        tails[lo] = v;
        tailIdx[lo] = i;
        prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
    }
    const out = [];
    for (let i = tailIdx.length ? tailIdx[tailIdx.length - 1] : -1; i >= 0; i = prev[i]) out.push(i);
    return out.reverse();
}

/** Ленивый индекс строки: signal создаётся только если index.value прочитан */
class _RowIndex {
    get [SIGNAL]() { return true; }
    constructor(i) { this._i = i; this._sig = null; }
    get value() { return this._sig ? this._sig.value : (this._sig = signal(this._i, 'list:index')).value; }
    peek() { return this._i; }
    subscribe(fn) { return (this._sig || (this._sig = signal(this._i, 'list:index'))).subscribe(fn); }
    version() { return (this._sig || (this._sig = signal(this._i, 'list:index'))).version(); }
    _set(i) { this._i = i; if (this._sig) this._sig.value = i; }
}

// ---- list(): буферы LIS (без аллокаций на сверку), cost-planner, view-transition очередь, гибернация
let _lisT = new Int32Array(64), _lisP = new Int32Array(64), _lisI = new Int32Array(64), _i32buf = new Int32Array(64);
function _i32(n) { if (_i32buf.length < n) _i32buf = new Int32Array(Math.max(n * 2, 64)); return _i32buf.subarray(0, n); }
/** LIS (patience sorting, O(n log n)) → битовая карта «остаётся на месте»; pos < 0 — новая строка */
function _lisBits(pos, mid) {
    if (_lisP.length < mid) { _lisT = new Int32Array(mid * 2); _lisP = new Int32Array(mid * 2); _lisI = new Int32Array(mid * 2); }
    let len = 0;
    for (let i = 0; i < mid; i++) {
        const v = pos[i]; if (v < 0) continue;
        let lo = 0, hi = len;
        while (lo < hi) { const m = (lo + hi) >> 1; if (_lisT[m] < v) lo = m + 1; else hi = m; }
        _lisT[lo] = v; _lisI[lo] = i; _lisP[i] = lo ? _lisI[lo - 1] : -1; if (lo === len) len++;
    }
    const keep = new Uint8Array(mid);
    for (let i = len ? _lisI[len - 1] : -1; i >= 0; i = _lisP[i]) keep[i] = 1;
    return keep;
}
/** Cost-based план (System R в 40 строк): keyed — LIS-перестановки, rebuild — снять диапазон одним Range и вернуть одним фрагментом */
const _cost = { render: 0.05, move: 0.004, drop: 0.02, bulk: 0.2 };   // мс; калибруются EWMA по факту (dev)
function _planRebuild(nOld, nNew, kept, lis, moves) {
    if (kept < 50) return false;
    const keyed = (nNew - kept) * _cost.render + (nOld - kept) * _cost.drop + moves * _cost.move;
    const rebuild = (nNew - kept) * _cost.render + (nOld - kept) * _cost.drop * 0.3 + _cost.bulk + kept * _cost.move * 0.15;
    return rebuild < keyed;
}
const _plans = [];
function _planNote(plan, n, kept, lis, moves, actual) {
    _plans.push({ plan, n, kept, lis, moves, ms: +actual.toFixed(3) }); if (_plans.length > 10) _plans.shift();
    const units = plan === 'rebuild' ? kept * 0.15 + 50 : (n - kept) * 12 + moves + (n - kept) * 5;   // условные единицы работы → калибровка move
    if (units > 0 && plan === 'keyed' && moves > 20 && n - kept === 0) _cost.move = 0.8 * _cost.move + 0.2 * Math.min(0.05, actual / moves);
}
const _listReg = new WeakMap();
let _vtId = 0, _vtQ = [], _vtChain = null, _vtInside = false;
/** Одна document.startViewTransition() на flush для всех list({ transition: 'view' }); переходы сериализуются, а не отменяют друг друга */
function _vtEnqueue(fn) { _vtQ.push(fn); if (_vtQ.length === 1) _sched.micro(_vtRun); }
function _vtRun() {
    const run = () => { const l = _vtQ; _vtQ = []; _vtInside = true; try { for (const f of l) f(); } finally { _vtInside = false; } };
    if (_vtInside || typeof document === 'undefined' || !document.startViewTransition || document.visibilityState === 'hidden' || (_ext.motionOff && _ext.motionOff())) return run();
    _vtChain = (_vtChain || Promise.resolve()).then(() => { const t = document.startViewTransition(run); t.ready.catch(() => {}); return t.finished.catch(() => {}); });
}
const _CV = typeof ContentVisibilityAutoStateChangeEvent === 'function';   // Chrome 108+/Firefox 125+; on*-атрибута у события нет, детектим по конструктору
/** Наблюдение «поддерево пропущено рендером»: contentvisibilityautostatechange (Chrome 108+/Firefox 125+), иначе IntersectionObserver */
function _hibernateWatch(container, onSkip) {
    if (_CV) {
        const st = container.style;
        if (!st.contentVisibility) st.contentVisibility = 'auto';
        if (!st.containIntrinsicSize) st.containIntrinsicSize = 'auto 1px';   // auto — последний измеренный размер, макет не прыгает
        return on(container, 'contentvisibilityautostatechange', (e) => onSkip(e.skipped));
    }
    if (typeof IntersectionObserver === 'undefined') return null;
    const io = new IntersectionObserver((es) => { for (const en of es) onSkip(!en.isIntersecting); }, { rootMargin: '200px' });
    io.observe(container);
    return () => io.disconnect();
}

/**
 * Реактивный список с keyed diffing
 * — строка = ровно те узлы, что вернул renderFn (`<tr>`, несколько `<option>`, `<dt>+<dd>`) — без обёрток
 * — DocumentFragment batch insert, bulk clear, prefix/suffix trim
 * — строка перерисовывается, если объект под её ключом заменён на другой
 *   (иммутабельные обновления не оставляют строку со старыми данными)
 * — index — сигнал (ленивый): после сортировки/удаления номера строк актуальны
 * — дубликаты и undefined-ключи не схлопывают строки (dev warning E004)
 * — строки принадлежат scope, в котором вызван list(), кто бы ни писал в сигнал
 *
 * @param {Signal<Array>|Array|Function} items — сигнал с массивом, reactive-массив или функция
 * @param {Function} renderFn — (item, index: ReadonlySignal<number>) => DOM
 * @param {string|Function} key — ключ для reconciliation
 */
export function list(items, renderFn, keyOrOpts = 'id', _t = _listTether) {
    const lopts = keyOrOpts && typeof keyOrOpts === 'object' ? keyOrOpts : { key: keyOrOpts };
    const key = lopts.key ?? 'id';
    const viewT = lopts.transition === 'view';                      // View Transitions API: перестановки/вставки анимируются платформой (FLIP)
    const tname = viewT ? null : lopts.transition === true ? 'aegis' : lopts.transition || null;
    const asSignal = lopts.item === 'signal';
    const hibernate = !!lopts.hibernate;                            // строки вне экрана замораживаются (scope disposed, DOM — снимок)
    const anchor = document.createComment('aegis:list');
    const keyFn = typeof key === 'function' ? key : (item) => item?.[key];
    const owner = _currentScope;
    let _fallback = null; // { nodes, scope } для пустого списка
    let _nodes = new Map(); // key → { nodes, scope, item, index, gen, pos, keep, frozen }
    let _order = [];        // текущий порядок ключей
    let _lastArr = null;    // прошлый массив (иммутабельные обновления → identity-trim до вычисления ключей)
    let _warnedKeys = false;
    let _gen = 0, _fillGen = 0, _missing = null;
    let _hib = null;        // { off, skipped }
    const pendingRows = lopts.pending || null;                     // signal: строки ещё создаются срезами
    const _statsOf = { keyed: 0, rebuild: 0, delta: 0, trimmed: 0 };

    const _keysOf = (arr, from = 0, to = arr.length, out = null) => {
        const keys = out || new Array(arr.length);
        const seen = new Map(); // key → count
        let bad = null;
        for (let i = from; i < to; i++) {
            let k = keyFn(arr[i], i);
            if (k === undefined || k === null) { bad = bad || 'missing'; k = '__aegis_nokey__'; }
            const n = seen.get(k) || 0;
            seen.set(k, n + 1);
            if (n > 0) { bad = bad || 'duplicate'; k = `${k}#${n}`; }
            keys[i] = k;
        }
        if (bad && (!globalThis.AEGIS_PROD && _dev()) && !_warnedKeys) {
            _warnedKeys = true;
            _warn('E004', !globalThis.AEGIS_PROD && {
                what: bad === 'missing'
                    ? `list(): key "${typeof key === 'string' ? key : 'fn'}" is undefined for some items.`
                    : 'list(): duplicate keys in items.',
                why: 'Rows are matched by key. Without a unique key the list falls back to positional matching — rows get re-rendered and lose state on reorder.',
                fix: 'Pass a unique key: list(items, render, "uuid") or list(items, render, item => item.uuid).',
            });
        }
        return keys;
    };
    /** Ключи с identity-trim: голова/хвост, где Object.is(arr[i], old[i]), берут ключи из _order — keyFn только для середины */
    const _keysTrimmed = (arr) => {
        const old = _lastArr, n = arr.length;
        if (!old || old === arr || !_order.length || _order.length !== old.length) return _keysOf(arr);
        let h = 0; const lim = Math.min(n, old.length);
        while (h < lim && Object.is(arr[h], old[h])) h++;
        if (h === n && n === old.length) { _statsOf.trimmed++; return _order.slice(); }
        let t = 0; while (t < lim - h && Object.is(arr[n - 1 - t], old[old.length - 1 - t])) t++;
        if (h + t < n * 0.75) return _keysOf(arr);            // середина большая — общий путь
        const keys = new Array(n);
        for (let i = 0; i < h; i++) keys[i] = _order[i];
        for (let i = 0; i < t; i++) keys[n - 1 - i] = _order[old.length - 1 - i];
        if (h + t < n) {
            _keysOf(arr, h, n - t, keys);
            // ключ середины совпал с ключом головы/хвоста → дубликат: суффикс, как в _keysOf
            for (let i = h; i < n - t; i++) { const e = _nodes.get(keys[i]); if (e && (e.pos < h || e.pos >= old.length - t)) keys[i] = keys[i] + '#' + (++e.dups || 1); }
        }
        _statsOf.trimmed++;
        return keys;
    };

    const _first = (e) => e.nodes[0];
    const _last = (e) => e.nodes[e.nodes.length - 1];

    const _render = (item, i) => {
        const scope = new Scope(owner, 'list:row');
        const index = new _RowIndex(i);
        const itemSig = asSignal ? signal(item, 'list:item') : null;
        // renderFn не должен подписывать effect списка на сигналы строки
        const prevTracking = _tracking;
        _tracking = null;
        let nodes;
        try {
            nodes = _nodesOf(scope.run(() => renderFn(itemSig || item, index)));
        } finally {
            _tracking = prevTracking;
        }
        if (tname && nodes.length === 1 && nodes[0].nodeType === 1) queueMicrotask(() => { if (nodes[0].isConnected && !nodes[0].hasAttribute('data-leaving')) _tr(nodes[0], 'enter', tname); });
        if (viewT && nodes.length === 1 && nodes[0].nodeType === 1) { const st = nodes[0].style; st.viewTransitionName = 'ag' + (++_vtId).toString(36); st.viewTransitionClass = lopts.viewClass || 'aegis-row'; }
        return { nodes, scope, item, index, itemSig, gen: 0, pos: i, keep: 0, frozen: false, leaving: false, dups: 0 };
    };

    const _dropEntry = (entry) => {
        const el = tname && entry.nodes.length === 1 && entry.nodes[0].nodeType === 1 ? entry.nodes[0] : null;
        if (el) {
            entry.leaving = true;
            el.setAttribute('data-leaving', '');
            _focusNeighbor(entry.nodes, anchor.parentNode, 'list()');                          // фокус уходит к соседу до leave-анимации
            _tr(el, 'leave', tname).then(ok => { if (ok) { entry.scope.dispose(); _removeNodes(entry.nodes); } else el.removeAttribute('data-leaving'); });
            return;
        }
        entry.scope.dispose();
        _removeNodes(entry.nodes, anchor.parentNode, 'list()');
    };

    const _showFallback = (parent, on) => {
        if (on && !_fallback && lopts.fallback) {
            const scope = new Scope(owner, 'list:fallback');
            const nodes = _nodesOf(scope.run(() => typeof lopts.fallback === 'function' ? lopts.fallback() : lopts.fallback));
            _insertNodes(nodes, parent, anchor.nextSibling);
            _fallback = { nodes, scope };
        } else if (!on && _fallback) {
            _fallback.scope.dispose();
            _removeNodes(_fallback.nodes);
            _fallback = null;
        }
    };

    // ── гибернация: строки чанка/контейнера вне экрана → scope disposed, DOM остаётся снимком; при возврате — перерисовка на месте
    const _freeze = (e) => { if (e.frozen || e.leaving) return; if (typeof document !== 'undefined' && e.nodes.some(n => n.nodeType === 1 && n.contains(document.activeElement))) return; e.frozen = true; e.scope.dispose(); };
    const _thaw = (e, i, parent) => { if (!e.frozen) return; const fresh = _render(e.item, i); _insertNodes(fresh.nodes, parent, _first(e)); _removeNodes(e.nodes); e.nodes = fresh.nodes; e.scope = fresh.scope; e.index = fresh.index; e.itemSig = fresh.itemSig; e.frozen = false; };
    const _hibernateOn = (parent) => {
        if (_hib || !hibernate) return;
        _hib = { off: null, skipped: false };
        _hib.off = _hibernateWatch(parent, (skipped) => {
            _hib.skipped = skipped;
            if (skipped) { for (const [, e] of _nodes) _freeze(e); }
            else { for (let i = 0; i < _order.length; i++) { const e = _nodes.get(_order[i]); if (e) _thaw(e, i, parent); } }
        });
    };

    // ── тень-ссылка на последний присутствующий узел (для стриминговой досборки и хвостовых вставок)
    const _tailRef = (parent) => {
        for (let i = _order.length - 1; i >= 0; i--) { const e = _nodes.get(_order[i]); if (e) { let n = _last(e).nextSibling; if (tname) while (n && n.nodeType === 1 && n.hasAttribute('data-leaving')) n = n.nextSibling; return n; } }
        return anchor.nextSibling;
    };
    /** Стриминговая досборка: недостающие строки создаются сверху вниз срезами (под причиной input/transition), поколение отменяет устаревшую работу */
    const _fill = (gen, arr, parent, end) => {
        while (_missing && _missing.length) {
            if (gen !== _fillGen) return;
            if (_sched.now() > end || _sched.inputPending()) { _sched.yield().then(() => { if (gen === _fillGen && anchor.parentNode) _fill(gen, arr, anchor.parentNode, _sched.now() + 8); }); return; }
            const i = _missing.shift(), k = _order[i];
            if (_nodes.has(k)) continue;
            const e = _render(arr[i], i); _nodes.set(k, e);
            let j = i + 1, ref = null;
            while (j < _order.length) { const nx = _nodes.get(_order[j]); if (nx && !nx.leaving) { ref = _first(nx); break; } j++; }
            _insertNodes(e.nodes, parent, ref || _tailRef(parent));
        }
        _missing = null;
        if (pendingRows) pendingRows.value = false;
        if (parent.getAttribute && parent.getAttribute('aria-busy') === 'true' && parent._aegisBusyByList) { parent.removeAttribute('aria-busy'); parent._aegisBusyByList = false; }
    };

    /** Дельта reactive-массива: splice-операции применяются напрямую, без ключей всего массива и LIS */
    const _applySplices = (arr, ops, parent) => batch(() => {
        for (const op of ops) {
            const { i, del, ins } = op;
            for (let k = 0; k < del; k++) { const key = _order[i]; const e = _nodes.get(key); if (e) { _dropEntry(e); _nodes.delete(key); } _order.splice(i, 1); }
            if (ins) {
                let ref = null;
                for (let j = i; j < _order.length; j++) { const nx = _nodes.get(_order[j]); if (nx && !nx.leaving) { ref = _first(nx); break; } }
                if (!ref) ref = _tailRef(parent);
                const slice = arr.slice(i, i + ins), keys = _keysOf(slice);
                const frag = ins > 1 ? document.createDocumentFragment() : null;
                for (let k = 0; k < ins; k++) {
                    let kk = keys[k]; if (_nodes.has(kk)) { const d = _nodes.get(kk); kk = kk + '#' + (++d.dups); }
                    const e = _render(slice[k], i + k); _nodes.set(kk, e); _order.splice(i + k, 0, kk);
                    if (frag) for (const nd of e.nodes) frag.appendChild(nd); else _insertNodes(e.nodes, parent, ref);
                }
                if (frag) parent.insertBefore(frag, ref);
            }
        }
        for (let i = 0; i < _order.length; i++) { const e = _nodes.get(_order[i]); if (e && e.pos !== i) { e.pos = i; e.index._set(i); } }
        _showFallback(parent, _order.length === 0);
        _statsOf.delta++;
    });

    const _reconcile = (arr) => {
        const parent = anchor.parentNode;
        if (!parent || !Array.isArray(arr)) return;
        _hibernateOn(parent);
        const gen = ++_gen; _fillGen = gen;
        if (_missing) { _order = _order.filter(k => _nodes.has(k)); _missing = null; }   // прерванная досборка: истина — только созданное
        const newKeys = _keysTrimmed(arr);
        _lastArr = arr;
        const n = newKeys.length;

        _showFallback(parent, n === 0);
        // Fast path: bulk clear when new array is empty
        if (n === 0 && _nodes.size > 0 && !tname) {
            const lastEntry = _nodes.get(_order[_order.length - 1]);
            const lastNode = lastEntry && _last(lastEntry);
            if (typeof document !== 'undefined' && parent.contains(document.activeElement) && document.activeElement !== parent) _focusNeighbor([...parent.childNodes].filter(nd => nd !== anchor), parent, 'list()');
            if (lastNode && lastNode.parentNode === parent) {
                const range = document.createRange();
                range.setStartAfter(anchor);
                range.setEndAfter(lastNode);
                range.deleteContents();
            } else {
                for (const [, entry] of _nodes) _removeNodes(entry.nodes);
            }
            for (const [, entry] of _nodes) entry.scope.dispose();
            _nodes.clear();
            _order = [];
            return;
        }

        batch(() => {
            const t0 = _devCache === true ? _sched.now() : 0;
            // 1. touch: штамп поколения, замена объекта → перерисовка/патч на месте
            let kept = 0;
            for (let i = 0; i < n; i++) {
                const entry = _nodes.get(newKeys[i]);
                if (!entry) continue;
                entry.gen = gen; kept++;
                if (entry.leaving) { entry.leaving = false; if (entry.nodes[0].nodeType === 1) { entry.nodes[0].removeAttribute('data-leaving'); if (entry.nodes[0]._aegisCancel) entry.nodes[0]._aegisCancel(); } }
                if (entry.frozen) { entry.item = arr[i]; continue; }                      // замороженная: актуальный item применится при оттаивании
                if (!Object.is(entry.item, arr[i]) && entry.itemSig) {
                    entry.item = arr[i];
                    entry.itemSig.value = arr[i];
                } else if (!Object.is(entry.item, arr[i])) {
                    const fresh = _render(arr[i], i);
                    _insertNodes(fresh.nodes, parent, _first(entry));
                    _dropEntry(entry);
                    fresh.gen = gen; fresh.pos = entry.pos;
                    _nodes.set(newKeys[i], fresh);
                }
            }
            // 2. sweep: всё, что не тронуто — удалить (без newKeySet)
            for (const [k, entry] of _nodes) if (entry.gen !== gen) { _dropEntry(entry); _nodes.delete(k); }
            // строки в leave-анимации остаются в DOM, но не участвуют в порядке
            const skipLeaving = (nd) => { while (nd && nd.nodeType === 1 && nd.hasAttribute('data-leaving')) nd = nd.nextSibling; return nd; };

            // 3. prefix / suffix trim
            let start = 0;
            while (start < n && start < _order.length && newKeys[start] === _order[start]) start++;
            let endNew = n - 1, endOld = _order.length - 1;
            while (endNew > start && endOld > start && newKeys[endNew] === _order[endOld]) { endNew--; endOld--; }

            // 4. середина: позиции по entry.pos (без Map), LIS в типизированных буферах
            const mid = endNew - start + 1;
            const pos = _i32(mid);
            let missing = 0;
            for (let i = 0; i < mid; i++) { const e = _nodes.get(newKeys[start + i]); if (e) pos[i] = e.pos; else { pos[i] = -1; missing++; } }
            const keepBits = _lisBits(pos, mid);
            let lisLen = 0; for (let i = 0; i < mid; i++) lisLen += keepBits[i];
            const moves = (mid - missing) - lisLen;

            // 5. план: keyed (LIS) или rebuild (снять диапазон, собрать фрагмент в новом порядке, одна вставка)
            const pinned = tname || viewT || hibernate || (typeof document !== 'undefined' && parent.contains(document.activeElement) && document.activeElement !== parent);
            const plan = !pinned && _planRebuild(_order.length, n, kept, lisLen, moves) ? 'rebuild' : 'keyed';

            // стриминговая досборка: недостающих строк много и есть причина (ввод/переход) — создать только видимое, остальное срезами
            const stream = missing > 32 && _cause && !tname && !viewT;
            if (stream) {
                _missing = [];
                for (let i = 0; i < n; i++) if (!_nodes.has(newKeys[i])) _missing.push(i);
                if (lopts.viewport && lopts.itemHeight) { const top = lopts.viewport.scrollTop || 0, ih = lopts.itemHeight; _missing.sort((a, b) => Math.abs(a * ih - top) - Math.abs(b * ih - top)); }
                if (pendingRows) pendingRows.value = true;
                if (parent.setAttribute && !parent.hasAttribute('aria-busy')) { parent.setAttribute('aria-busy', 'true'); parent._aegisBusyByList = true; }
            }

            if (plan === 'rebuild') {
                // все узлы диапазона [start..endOld] снимаются одним Range и возвращаются одним фрагментом в новом порядке — scope строк не трогаются
                const firstOld = _nodes.get(_order[start]), lastOld = _nodes.get(_order[endOld]);
                if (firstOld && lastOld && _first(firstOld).parentNode === parent) {
                    const r = document.createRange(); r.setStartBefore(_first(firstOld)); r.setEndAfter(_last(lastOld));
                    const afterEnd = _last(lastOld).nextSibling;
                    r.extractContents();
                    const f = document.createDocumentFragment();
                    for (let i = start; i <= endNew; i++) {
                        const k = newKeys[i]; let e = _nodes.get(k);
                        if (!e) { if (stream) continue; e = _render(arr[i], i); e.gen = gen; _nodes.set(k, e); }
                        for (const nd of e.nodes) f.appendChild(nd);
                    }
                    parent.insertBefore(f, afterEnd);
                    _statsOf.rebuild++;
                } else _placeKeyed(arr, newKeys, start, endNew, endOld, keepBits, parent, skipLeaving, gen, stream);
            } else _placeKeyed(arr, newKeys, start, endNew, endOld, keepBits, parent, skipLeaving, gen, stream);

            _order = newKeys;
            // 6. индексы: только сдвинувшиеся строки
            for (let i = 0; i < n; i++) { const e = _nodes.get(newKeys[i]); if (e && e.pos !== i) { e.pos = i; if (!e.frozen) e.index._set(i); } }
            if (t0) _planNote(plan, n, kept, lisLen, moves, _sched.now() - t0);
            if (stream) _fill(gen, arr, parent, _sched.now() + 8);
            else _statsOf.keyed++;
        });
    };

    /** Размещение по LIS: новые строки — фрагментами-пробегами (одна вставка на пробег), перемещаемые — moveBefore (состояние узла живёт) */
    const _placeKeyed = (arr, newKeys, start, endNew, endOld, keepBits, parent, skipLeaving, gen, stream) => {
        // afterEnd — узел сразу после середины (первый узел суффикса или чужой узел), фиксируем ДО перестановок
        let afterEnd = endNew + 1 < newKeys.length ? (_nodes.get(newKeys[endNew + 1]) ? _first(_nodes.get(newKeys[endNew + 1])) : null) : null;
        if (!afterEnd) {
            // последний ВЫЖИВШИЙ старый узел середины
            let lastOld = null;
            for (let i = endOld; i >= start && !lastOld; i--) lastOld = _nodes.get(_order[i]) || null;
            if (!lastOld && start > 0) lastOld = _nodes.get(newKeys[start - 1]) || null;
            afterEnd = lastOld ? _last(lastOld).nextSibling : anchor.nextSibling;
            if (tname) afterEnd = skipLeaving(afterEnd);
        }
        let next = afterEnd, frag = null;
        const flushRun = () => { if (frag) { const f = frag.firstChild; parent.insertBefore(frag, next); next = f; frag = null; } };   // пробег новых строк встаёт перед next, и сам становится next
        for (let i = endNew - start; i >= 0; i--) {
            const k = newKeys[start + i];
            let entry = _nodes.get(k);
            if (!entry) {
                if (stream) continue;                                   // создастся в _fill
                entry = _render(arr[start + i], start + i); entry.gen = gen;
                _nodes.set(k, entry);
                if (!frag) frag = document.createDocumentFragment();
                for (let j = entry.nodes.length - 1; j >= 0; j--) frag.prepend(entry.nodes[j]);
                continue;                                               // next не двигаем: пробег вставится перед next
            }
            flushRun();
            if (!keepBits[i]) _insertNodes(entry.nodes, parent, next);   // перемещение: moveBefore, если есть
            next = _first(entry);
        }
        flushRun();
    };

    const _read = () => isSignal(items) ? items.value : typeof items === 'function' ? items() : items;
    const _peekItems = () => isSignal(items) ? items.peek() : _read();

    let _pending = false, _seenV = -1, _seenRaw = null;
    const _run = () => {
        const arr = _read();
        if (Array.isArray(arr)) arr.length; // reactive-массив: подписаться на его версию ещё до монтирования
        if (anchor.parentNode) {
            // reactive-массив со splice-логом: применить дельту вместо полной сверки
            const raw = Array.isArray(arr) ? (arr.$raw || arr) : null;
            const d = raw && _ext.arrayOps ? _ext.arrayOps(arr, raw === _seenRaw ? _seenV : -1) : null;   // дельта только для того же массива
            if (d) { _seenRaw = raw; _seenV = d.v; if (d.ops && _order.length === _nodes.size && !_missing) { _applySplices(arr, d.ops, anchor.parentNode); _lastArr = null; return; } }
            _reconcile(arr);
        } else if (!_pending) {
            // ещё не в DOM — одна отложенная сверка с актуальным массивом
            _pending = true;
            _deferAnchor(() => {
                _pending = false;
                if (anchor.parentNode) untrack(_run);   // отложенный первый рендер идёт внутри чужого html``/эффекта — чтение массива не должно подписать его
            });
        }
    };
    effect(viewT ? () => { _read(); _vtEnqueue(_run); } : _run, viewT ? { flush: 'micro', name: 'list' } : 'list');

    if (owner) owner.onDispose(() => {
        _fillGen++;
        if (_hib && _hib.off) _hib.off();
        for (const [, entry] of _nodes) _dropEntry(entry);
        _nodes.clear();
        _order = [];
    });
    if (_devCache === true) _listReg.set(anchor, _statsOf);

    return anchor;
}
const _listTether = /* @__PURE__ */ _reg('list', list, 'plans', () => _plans.slice());


// ============================================================================
// 8. COMPONENT — Mount, Hydrate, Destroy
// ============================================================================

const _components = new Map(); // el → { scope, api }

/**
 * Создать компонент на DOM-элементе
 * setup получает утилиты с привязкой к scope компонента
 */
/** Ближайшее слово по расстоянию Левенштейна (≤ 2, регистронезависимо) */
function _nearest(word, candidates) {
    const w = word.toLowerCase();
    let best = null, bestD = 3;
    for (const c of candidates) {
        const cl = c.toLowerCase();
        if (Math.abs(cl.length - w.length) > 2) continue;
        const d = _lev(w, cl);
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}
function _lev(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}

/** Dev: опечатка в деструктуризации ctx → did-you-mean (или «импортируйте из aegis.js») */
/** Хелперы ctx, чувствительные к владельцу: после await в setup _currentScope потерян — вернуть его */
const _OWNED = ['effect', 'computed', 'on', 'delegate', 'bind', 'text', 'attr', 'cls', 'style', 'styleMap', 'html', 'show', 'list', 'when', 'selector', 'provide', 'inject', 'interval', 'timeout', 'observe', 'resize', 'mutate', 'debounced', 'throttled', 'poll', 'guardedFetch', 'fetch'];
function _bindCtx(ctx, scope) {
    for (const k of _OWNED) {
        const f = ctx[k];
        if (typeof f !== 'function') continue;
        ctx[k] = function (...a) {
            if (_currentScope || scope._disposed) return f.apply(this, a);
            return scope.run(() => f.apply(this, a));   // код после await: владельца нет — вернуть scope компонента
        };
    }
    return ctx;
}
/** ctx.show / ctx.list / ctx.when из _ext: регистрируются самими функциями при загрузке, в бандле есть только при импорте */
function _ctxLazy(name) {
    return (...a) => { const f = _ext[name]; if (!f) throw new Error('[Aegis] ctx.' + name + ' needs import { ' + name + ' } from aegis'); return f(...a); };
}
/** Ленивый ctx.fetch / ctx.guardedFetch: создаётся при первом вызове из _ext.guardedFetch (регистрирует секция request) */
function _ctxFetch(scope) {
    let gf = null;
    const get = () => gf || (gf = (_ext.guardedFetch || (() => { throw new Error('[Aegis] ctx.fetch: the request layer is not in this build — import { api } (or request) from aegis somewhere in the app, or use fetch()'); }))(scope));
    const f = (url, opts) => get()(url, opts);
    Object.defineProperties(f, { pending: { get: () => get().pending }, error: { get: () => get().error } });
    return f;
}
function _ctxProxy(ctx) {
    if (!(!globalThis.AEGIS_PROD && _dev()) || typeof Proxy === 'undefined') return ctx;
    return new Proxy(ctx, {
        get(t, key) {
            if (key in t || typeof key !== 'string') return t[key];
            const keys = Object.keys(t);
            const known = ['resource', 'mutation', 'router', 'reactive', 'watch', 'linked', 'persisted', 'until', 'transition', 'spring', 'trap', 'swap', 'tpl', 'adopt', 'ref', 'untrack', 'when', 'selector', 'cachedResource', 'streamResource', 'form', 'wireForm', 'attach', 'clone', 'media', 'theme'];
            const nearCtx = _nearest(key, keys), nearMod = _nearest(key, known);
            _warn('E026', !globalThis.AEGIS_PROD && {
                what: `setup ctx has no "${key}".`,
                why: 'ctx holds only what is specific to this component; everything else is a module export.',
                fix: nearCtx ? `Did you mean "${nearCtx}"?` : nearMod ? `import { ${nearMod} } from './aegis.js' (did you mean "${nearMod}"?)` : 'Check the name.',
            }, 'ctx:' + key);
            return undefined;
        },
    });
}

function _component(el, setup) {
    // Если уже есть компонент — уничтожить
    if (_components.has(el)) destroy(el);
    if (typeof _liveInit === 'function') _liveInit();   // live-регионы должны существовать до первого announce()

    const scope = createScope(`component:${el.dataset && el.dataset.aegis ? el.dataset.aegis : _tag(el)}`);
    scope.el = el;
    // Серверные дети — снимок ДО setup: slot() раздаёт их шаблону
    const kids = [...el.childNodes];
    const taken = new Set();
    const usedSelectors = new Set();
    const slot = (selector) => {
        const frag = document.createDocumentFragment();
        const key = selector || '';
        if (usedSelectors.has(key)) {
            _warn('E008', !globalThis.AEGIS_PROD && {
                what: `slot(${selector ? `'${selector}'` : ''}) called twice in one component.`,
                why: 'Server-rendered children can be placed only once — they are moved, not copied.',
                fix: 'Call slot() once per selector and keep the returned fragment.',
            });
            return frag;
        }
        usedSelectors.add(key);
        for (const k of kids) {
            if (taken.has(k)) continue;
            if (selector && !(k.nodeType === 1 && k.matches(selector))) continue;
            taken.add(k);
            frag.appendChild(k);
        }
        return frag;
    };

    let api = scope.run(() => {
        const gf = _ctxFetch(scope);
        return setup(_ctxProxy(_bindCtx({
            el, slot, signal, computed, effect, batch, provide, inject, when: _ctxLazy('when'), selector,
            /** Состояние, переживающее гибернацию/page-out острова (onSaveInstanceState): ctx.state('zoom', 1) → сигнал */
            state: (key, init) => { const saved = _swap.get(el); const sig = signal(saved && key in saved ? saved[key] : init, 'state:' + key); (scope._state || (scope._state = new Map())).set(key, sig); return sig; },
            on: on, delegate, bind,
            text: (target, fn) => text(target, fn),
            attr: (target, name, fn) => attr(target, name, fn),
            cls: (target, name, fn) => cls(target, name, fn),
            style: (target, prop, fn) => style(target, prop, fn),
            styleMap: (target, map) => styleMap(target, map),
            html, show: _ctxLazy('show'), list: _ctxLazy('list'),
            interval, timeout, observe, resize, mutate,
            guardedFetch: gf,
            debounced, throttled, poll,
            onDispose: (fn) => scope.onDispose(fn),
            onError: (fn) => scope.onError(fn),
            fetch: gf,
            scope,
        }, scope)));
    });

    // setup вернул шаблон (html`` / элемент) — это и есть содержимое компонента
    const place = (r) => {
        if (r instanceof Node) { el.replaceChildren(r); return { el, destroy: () => destroy(el) }; }
        return r;
    };
    if (api && typeof api.then === 'function') api = api.then(r => scope._disposed ? r : scope.run(() => place(r)));  // async setup
    else api = place(api);

    _components.set(el, { scope, api });
    // Маркер живого острова: hydrate(…, { watch: true }) уничтожает его при удалении из DOM
    el.setAttribute('data-aegis-live', '');
    scope.onDispose(() => {
        if (_components.get(el)?.scope === scope) _components.delete(el);
        el.removeAttribute('data-aegis-live');
        el.dispatchEvent(new CustomEvent('aegis:destroy', { bubbles: true }));
    });
    return api;
}

/**
 * Shorthand: mount component by CSS selector
 *
 * @example
 *   mount('#app', ({ signal, html, effect }) => {
 *       const count = signal(0);
 *       effect(() => { el.textContent = count.value; });
 *   });
 *
 * @param {string|Element} selector — CSS-селектор или DOM-элемент
 * @param {Function} setup — component setup function
 * @returns component API (return value of setup)
 */
export function mount(selector, setup) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) {
        if ((!globalThis.AEGIS_PROD && _dev())) {
            _warn('E003', !globalThis.AEGIS_PROD && {
                what: `mount("${selector}") — element not found.`,
                why: 'querySelector returned null. The element may not exist in the DOM yet.',
                fix: 'Check the selector, or call mount() after DOMContentLoaded.',
            });
        }
        return undefined;
    }
    return _component(el, setup);
}

/**
 * Оживить серверный HTML — найти все [data-aegis] и вызвать setup
 */
const _registry = new Map();
const _pending = new WeakSet();       // ждут visible/idle/interaction/media
const _cancelPending = new WeakMap(); // el → отмена ожидания
const _watched = new WeakSet();       // корни с MutationObserver
let _autoScheduled = false;

/**
 * Зарегистрировать компонент по имени. После регистрации острова [data-aegis]
 * в документе оживают сами (один отложенный hydrate(document) на пачку register()).
 * Выключить: hydrate.auto = false.
 */
const _islandTypes = new Map(); // name → { key: Number|Boolean|String|JSON|Array|Object }

/** Привести data-* к объявленному типу (register(name, setup, { types })) */
function _coerceProp(raw, type) {
    if (raw === undefined) return type === Boolean ? false : undefined;
    if (type === Number) return raw === '' ? null : Number(raw);
    if (type === Boolean) return raw !== 'false' && raw !== '0';   // data-on="" (наличие) = true
    if (type === String) return raw;
    if (type === JSON || type === Object || type === Array) { try { return _safeParse(raw); } catch (e) { return raw; } }
    if (typeof type === 'function') return type(raw);
    return raw;
}

/** data-* → значение: JSON-литералы ({, [, true, false, null) парсятся, числовые строки остаются строками (ID не теряют точность) */
function _guessProp(raw, key, name) {
    if (/^\s*[\[{]/.test(raw) || raw === 'true' || raw === 'false' || raw === 'null') {
        try { return _safeParse(raw); } catch (e) { return raw; }
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        _warn('E025', !globalThis.AEGIS_PROD && {
            what: `data-${key} on "${name}" looks numeric ("${raw}") but is passed as a string.`,
            why: 'Numbers are no longer guessed: IDs like 9007199254740993 would lose precision.',
            fix: `register('${name}', setup, { types: { ${key}: Number } })`,
        }, name + ':' + key);
    }
    return raw;
}

/** Props острова: data-* (+ types) и JSON-блок <script type="application/json" data-aegis-props> или data-aegis-props="#id" */
/** Политика origin для data-aegis-src: 'same-origin' (default) | функция | RegExp | список префиксов */
function _srcAllowed(src) {
    const p = (_config.islands && _config.islands.src) || 'same-origin';
    let u; try { u = new URL(src, location.href); } catch (e) { return false; }
    if (p === 'same-origin') return u.origin === location.origin;
    if (typeof p === 'function') return !!p(u.href);
    if (p instanceof RegExp) return p.test(u.href);
    return [].concat(p).some(prefix => u.href.startsWith(prefix));
}
/** Конфиг DOMPurify для зон пользовательского HTML: без data-aegis*, on*, script/template/iframe */
export const sanitizeConfig = /*#__PURE__*/ Object.freeze({ FORBID_ATTR: ['data-aegis', 'data-aegis-src', 'data-aegis-props', 'data-aegis-load', 'data-aegis-cache', 'data-aegis-integrity', 'data-aegis-resident', 'data-aegis-hibernate', 'data-aegis-warm', 'data-aegis-prefetch'], FORBID_TAGS: ['script', 'template', 'iframe', 'object', 'embed'] });
const _swap = new WeakMap();    // el → снимок (page-out / гибернация); переживает destroy()
const _resident = new Map();   // el → { v } — резидентные visible-острова (CLOCK: бит v ставится при пересечении)
const _islandStats = { evictions: 0, hibernations: 0 };
const _serverKids = new WeakMap();   // el → клоны серверных детей до первого mount (для повторного mount после гибернации/page-out)
function _islandProps(el, name) {
    const types = _islandTypes.get(name) || {};
    const data = {};
    if (_swap.has(el)) { data.snapshot = _swap.get(el); data.resume = true; }   // page-in / оттаивание: снимок предыдущей жизни
    for (const [k, v] of Object.entries(el.dataset)) {
        if (k === 'aegis' || k === 'aegisLoad' || k === 'aegisState' || k === 'aegisLive' || k === 'aegisSrc' || k === 'aegisPrefetch' || k === 'aegisReady' || k === 'aegisProps') continue;
        data[k] = k in types ? _coerceProp(v, types[k]) : _guessProp(v, k, name);
    }
    for (const k of Object.keys(types)) if (!(k in data)) data[k] = _coerceProp(undefined, types[k]);
    const ref = el.dataset.aegisProps;
    let scriptEl = ref ? document.querySelector(ref) : el.querySelector(':scope > script[type="application/json"]');
    if (scriptEl && ref && !(el.contains(scriptEl) || (el.parentElement && el.parentElement.contains(scriptEl)))) {   // props только из острова или его родителя — не из произвольного места документа
        _warn('S008', !globalThis.AEGIS_PROD && { what: `data-aegis-props="${ref}" points outside the island — ignored.`, why: 'An injected island could read any JSON on the page (tokens, config) as its props.', fix: 'Put the <script type="application/json"> inside the island or next to it.', el }, 'props:' + ref);
        scriptEl = null;
    }
    if (scriptEl) {
        const props = jsonScript(scriptEl);
        if (props && typeof props === 'object') { data.props = props; for (const k of Object.keys(props)) if (!_DENIED_KEYS.has(k)) data[k] = props[k]; }
    }
    return data;
}

export function register(name, setup, ropts) {
    if (ropts && ropts.types) _islandTypes.set(name, ropts.types);
    if (setup && typeof setup === 'object' && typeof setup.load !== 'function') {
        _warn('E010', !globalThis.AEGIS_PROD && { what: `register("${name}"): expected a setup function or { load }.`, why: 'The value will never mount.', fix: "register(name, (el, data, ctx) => …) or register(name, { load: () => import('./island.js') })." });
    }
    if (_registry.has(name)) {
        _warn('E010', !globalThis.AEGIS_PROD && {
            what: `Component "${name}" registered twice.`,
            why: 'The second setup silently replaces the first — usually a duplicated <script> or import.',
            fix: 'Register each component once; use a different name for a different component.',
        });
    }
    _registry.set(name, setup);
    _scheduleAutoHydrate();
}

/** Каркас register() для острова по его серверной разметке (dev): имена из data-*, селекторы из id/name/class */
export function scaffold(el) {
    const name = el.dataset.aegis || 'island';
    const lines = [`register('${name}', (el, data, { signal, effect, on, html }) => {`];
    for (const [k, v] of Object.entries(el.dataset)) {
        if (k.startsWith('aegis')) continue;
        lines.push(`    const ${k} = signal(data.${k}); // ${JSON.stringify(v)}`);
    }
    let i = 0;
    for (const n of el.querySelectorAll('[id],[name],[class]')) {
        if (i++ >= 8) break;
        const sel = n.id ? '#' + CSS.escape(n.id) : n.getAttribute('name') ? `[name="${n.getAttribute('name')}"]` : '.' + CSS.escape(n.classList[0]);
        const varName = (n.id || n.getAttribute('name') || n.classList[0] || 'el').replace(/[^\w]/g, '_');
        lines.push(`    const ${varName} = el.querySelector('${sel}'); // <${n.localName}>`);
    }
    lines.push('    // TODO: on(button, \'click\', …); text(el.querySelector(\'.value\'), count);', '});');
    return lines.join('\n');
}

function _scheduleAutoHydrate() {
    if (_autoScheduled || typeof document === 'undefined') return;
    _autoScheduled = true;
    const run = () => { _autoScheduled = false; if (hydrate.auto !== false) hydrate(document, { quiet: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else queueMicrotask(run);
}

const _ioByMargin = new Map(); // rootMargin → { io, cbs: WeakMap<el, fn>, watch, unwatch }
/** Один IntersectionObserver на rootMargin для всех visible-островов */
function _sharedIO(margin) {
    let rec = _ioByMargin.get(margin);
    if (rec) return rec;
    const cbs = new WeakMap();
    const io = new IntersectionObserver((entries) => {
        for (const en of entries) {
            if (!en.isIntersecting) continue;
            const cb = cbs.get(en.target);
            if (cb) { cbs.delete(en.target); io.unobserve(en.target); cb(); }
        }
    }, { rootMargin: margin });
    rec = { io, watch(el, cb) { cbs.set(el, cb); io.observe(el); }, unwatch(el) { cbs.delete(el); io.unobserve(el); } };
    _ioByMargin.set(margin, rec);
    return rec;
}

const _ioExitByMargin = new Map();
/** IntersectionObserver на выход: колбэк, когда цель ушла дальше margin от экрана (после того как была видна); onEnter — бит обращения */
function _sharedIOExit(margin) {
    let rec = _ioExitByMargin.get(margin);
    if (rec) return rec;
    const cbs = new WeakMap();
    const io = new IntersectionObserver((entries) => {
        for (const en of entries) {
            const r = cbs.get(en.target); if (!r) continue;
            if (en.isIntersecting) { r.seen = true; if (r.onEnter) r.onEnter(); }
            else if (r.seen) { r.seen = false; r.cb(); }
        }
    }, { rootMargin: margin });
    rec = { io, watch(el, cb, onEnter) { cbs.set(el, { cb, onEnter, seen: false }); io.observe(el); }, unwatch(el) { cbs.delete(el); io.unobserve(el); } };
    _ioExitByMargin.set(margin, rec);
    return rec;
}
const _yield = () => _sched.yield();

/** Похожее имя для подсказки в E011 */
function _nearestName(name) {
    let best = null, bestScore = 0;
    for (const k of _registry.keys()) {
        let same = 0;
        for (let i = 0; i < Math.min(k.length, name.length); i++) if (k[i] === name[i]) same++;
        const score = same / Math.max(k.length, name.length);
        if (score > bestScore && score >= 0.5) { best = k; bestScore = score; }
    }
    return best;
}

/**
 * Один контракт компонента для острова и custom element: Component = (ctx) => Node | api | void,
 * ctx.props — reactive()-объект (из data-* с types или из атрибутов CE — реактивно).
 *   const Counter = ({ props, html }) => { const n = signal(props.count ?? 0); return html`<button @click=${() => n.value++}>${n}</button>`; };
 *   island('counter', Counter, { types: { count: Number } });     // <div data-aegis="counter" data-count="5">
 *   element('x-counter', Counter, { props: { count: Number } });   // <x-counter count="5">
 */
export function island(name, Component, iopts = {}) {
    register(name, (el, data, ctx) => Component({ ...ctx, props: reactive({ ...data }, { shallow: true }) }), iopts);
}

export function element(tag, Component, eopts = {}) {
    const propDefs = {};
    for (const [k, v] of Object.entries(eopts.props || {})) propDefs[k] = (v && typeof v === 'object' && 'type' in v) ? v : { type: v };
    defineElement(tag, {
        ...eopts,
        props: propDefs,
        setup(el, sigs, extra) {
            // props — реактивный объект поверх сигналов custom element: чтение/запись идут в те же сигналы, что и атрибуты
            const raw = {};
            for (const k of Object.keys(sigs)) raw[k] = sigs[k].peek();
            const props = reactive(raw, { shallow: true, signals: { ...sigs } });
            const scope = _currentScope;
            const ctx = _ctxProxy(_bindCtx({
                el, props, signal, computed, effect, batch, provide, inject, when, selector, on, delegate, bind, html, show, list,
                onDispose: (fn) => scope.onDispose(fn), onError: (fn) => scope.onError(fn), scope, ...extra,
            }, scope));
            return Component(ctx);
        },
    });
}

/**
 * Оживить серверный HTML: найти [data-aegis] (включая сам root) и смонтировать компоненты.
 * Идемпотентна: уже живые и ожидающие острова пропускаются.
 *
 * data-aegis-load="visible|idle|interaction|media(query)" — стратегия загрузки (default: eager)
 * data-aegis-ignore — поддерево чужого виджета, не трогать
 * События: aegis:hydrate (cancelable, до), aegis:hydrated (после, detail: { name, api }), aegis:destroy
 * Атрибуты: data-aegis-state="pending|hydrated", data-cloak снимается после монтирования
 *
 * @param {Document|Element} [root]
 * @param {Object} [opts]
 * @param {boolean} [opts.watch] — MutationObserver: вставленные острова оживают, удалённые уничтожаются (htmx/Turbo/jQuery)
 * @param {boolean} [opts.force] — перемонтировать уже живые
 * @param {string}  [opts.load] — переопределить стратегию для всех (тесты: 'eager')
 * @param {boolean} [opts.quiet] — без предупреждений о незарегистрированных
 * @param {number}  [opts.budget=8] — мс синхронной работы до scheduler.yield(); Infinity — всё синхронно
 * @param {number}  [opts.idleTimeout=2000] — дедлайн для idle-островов
 * @returns {Array<{ el, name, api, ready: Promise }>} handles; handles.ready — Promise завершения eager-части
 */
export function hydrate(root = document, opts = {}) {
    const { watch = false, force = false, load, quiet = false, budget = 8, idleTimeout = 2000, resident = null } = opts;
    if (_ext.seedFrom) _ext.seedFrom(root); else (_ext.seedRoots || (_ext.seedRoots = [])).push(root);   // кэш подключён — сеять сразу, иначе при первом обращении к кэшу
    const handles = [];
    const eager = [], idle = [];

    const mountIsland = (el) => {
        if ((_components.has(el) && !force) || _pending.has(el)) return;
        if (el.closest('[data-aegis-ignore]')) return;
        const name = el.dataset.aegis;
        // Ленивый остров: register(name, { load }) или data-aegis-src="/js/islands/x.js" (zero-JS регистрация)
        let setup = _registry.get(name);
        if (!setup && el.dataset.aegisSrc) {
            const src = el.dataset.aegisSrc, integ = el.dataset.aegisIntegrity;
            if (!_srcAllowed(src)) { _warn('S006', !globalThis.AEGIS_PROD && { what: `data-aegis-src="${src}" refused by the origin policy.`, why: 'An injected element could load and run arbitrary code with the page\'s authority.', fix: 'Serve islands same-origin, or configure({ islands: { src: [\'https://cdn.example/\'] } }).', el }, 'src:' + src); return; }
            setup = { load: async () => {
                if (integ) { const r = await fetch(src, { integrity: integ, cache: 'force-cache' }); if (!r.ok) throw Object.assign(new Error('[Aegis] S010: integrity check failed for ' + src), { code: 'S010' }); }   // SRI для динамического import: проверенное тело остаётся в HTTP-кэше
                return import(/* @vite-ignore */ src);
            } };
            _registry.set(name, setup);
        }
        // зона недоверенной разметки: внутри [data-aegis-untrusted] монтируются только острова из configure({ islands: { allow } })
        const zone = el.closest && el.closest('[data-aegis-untrusted]');
        if (zone && !((_config.islands && _config.islands.allow) || []).includes(name)) { _warn('S007', !globalThis.AEGIS_PROD && { what: `island "${name}" inside an untrusted zone was not mounted.`, why: 'Markup in a sanitized/user zone must not instantiate arbitrary islands with attacker-chosen props.', fix: `configure({ islands: { allow: ['${name}'] } }) if this island is safe to expose there.`, el }, 'zone:' + name); return; }
        if (!setup) {
            if (!quiet) {
                const near = _nearestName(name);
                _warn('E011', !globalThis.AEGIS_PROD && {
                    what: `Component "${name}" is not registered.`,
                    why: 'hydrate() found <… data-aegis="' + name + '"> but no register() for it.',
                    fix: near ? `Did you mean "${near}"?` : 'Paste this and fill the TODO:\n' + scaffold(el),
                });
            }
            return;
        }
        // Собрать data-* атрибуты как конфиг
        const data = _islandProps(el, name);
        // Код острова грузится один раз на имя, второй остров того же типа не ждёт
        const loadSetup = () => {
            const s = _registry.get(name) || setup;
            if (typeof s === 'function') return s;
            if (!s._promise) {
                s._promise = Promise.resolve(s.load()).then(m => {
                    const fn = typeof m === 'function' ? m : m && m.default;
                    if (typeof fn !== 'function') throw new Error(`[Aegis] register("${name}", { load }): module has no setup function (default export)`);
                    _registry.set(name, fn);
                    return fn;
                });
            }
            return s._promise;
        };
        const warm = () => { if (el.dataset.aegisPrefetch && _ext.prefetch) _ext.prefetch(el.dataset.aegisPrefetch); if (typeof setup !== 'function') loadSetup(); };
        if (!el.dispatchEvent(new CustomEvent('aegis:hydrate', { bubbles: true, cancelable: true, detail: { name } }))) return;

        // working-set paging: data-aegis-resident="2000px" / hydrate(root, { resident: { margin, max } }) — остров, ушедший дальше margin
        // от экрана (или вытесненный CLOCK при resident > max), выгружается со снимком (page-out) и монтируется заново при возврате
        // (page-in: data.snapshot / data.resume). Ни фокус, ни permanent, ни играющее медиа, ни несохранённый ввод не выгружаются.
        const resMargin = el.dataset.aegisResident || (resident && resident.margin) || null;
        const maxRes = resident && resident.max ? resident.max : Infinity;
        const pageOut = (target) => {
            if (!_freezeIsland(target, 'swapped')) return false;
            if (resMargin) _sharedIOExit(resMargin).unwatch(target);
            _sharedIO((sargs && sargs[0]) || '50px').watch(target, () => hydrate(target, { quiet: true, force: true, load: 'eager', resident }));   // page-in при приближении
            return true;
        };
        const arm = () => {
            if (!resMargin && !(resident && resident.max)) return;
            _resident.set(el, { v: 1 });
            if (resMargin && typeof IntersectionObserver === 'function') _sharedIOExit(resMargin).watch(el, () => pageOut(el), () => { const r = _resident.get(el); if (r) r.v = 1; });
            _clockIslands(maxRes, pageOut);
        };
        let resolve;
        const h = { el, name, api: undefined, ready: new Promise(r => { resolve = r; }) };
        const finish = (fn) => {
            if (!el.isConnected) { resolve(undefined); return; }
            if (force && _components.has(el)) destroy(el);
            if (el.dataset.aegisHibernate !== undefined || el.dataset.aegisResident || (opts.resident && opts.resident.margin)) {
                if (!_serverKids.has(el)) _serverKids.set(el, [...el.childNodes].map(n => n.cloneNode(true)));   // первый mount: запомнить серверную разметку
                else el.replaceChildren(..._serverKids.get(el).map(n => n.cloneNode(true)));                       // повторный mount: вернуть её, чтобы setup не дублировал свой рендер
            }
            const api = _component(el, (ctx) => fn(el, data, ctx));
            const done = (a) => {
                h.api = a;
                el.removeAttribute('aria-busy');
                el.dataset.aegisState = 'hydrated';
                if (el.dataset.aegisHibernate !== undefined && !el._aegisHib) {   // data-aegis-hibernate: заморозка, когда рендер пропускает поддерево (content-visibility)
                    el._aegisHib = _hibernateWatch(el, (skipped) => {
                        if (skipped) { if (_components.has(el)) _freezeIsland(el, 'hibernated'); }
                        else if (!_components.has(el) && el.dataset.aegisState === 'hibernated' && el.isConnected) hydrate(el, { quiet: true, force: true, load: 'eager' });
                    });
                }
                el.setAttribute('data-aegis-ready', '');
                el.removeAttribute('data-cloak');
                resolve(a);
                el.dispatchEvent(new CustomEvent('aegis:hydrated', { bubbles: true, composed: true, detail: { name, api: a } }));
                arm();
            };
            if (api && typeof api.then === 'function') return api.then(done, (e) => { console.error(`[Aegis] island "${name}" failed:`, e); el.dataset.aegisState = 'error'; el.removeAttribute('aria-busy'); resolve(undefined); });
            done(api);
        };
        const mount = () => {
            _pending.delete(el);
            _cancelPending.delete(el);
            el.setAttribute('aria-busy', 'true');                                          // загрузка кода + монтирование: остров занят
            if (typeof _liveInit === 'function') _liveInit();
            const fn = loadSetup();
            if (typeof fn === 'function') return finish(fn);
            return fn.then(finish, (e) => { console.error(`[Aegis] island "${name}" failed to load:`, e); el.dataset.aegisState = 'error'; el.removeAttribute('aria-busy'); resolve(undefined); });
        };
        _pending.add(el);
        el.dataset.aegisState = 'pending';
        handles.push(h);

        const rawStrategy = load ?? el.dataset.aegisLoad ?? 'eager';
        const sm = String(rawStrategy).match(/^(\w+)(?:\((.*)\))?$/);
        const strategy = sm ? sm[1] : rawStrategy;
        const sargs = sm && sm[2] ? sm[2].split(',').map(x => x.trim()).filter(Boolean) : [];
        switch (strategy) {
            case 'visible': {
                const margin = sargs[0] || '50px';
                const obs = _sharedIO(margin);
                obs.watch(el, () => mount());
                // прогрев за 400px: код острова и data-aegis-prefetch — до того, как остров стал видимым
                let pre = null;
                if ((el.dataset.aegisPrefetch || typeof setup !== 'function') && el.dataset.aegisWarm !== 'off' && _netBudget().speculate) {
                    const wio = _sharedIO(_warmMargin(el.dataset.aegisWarm || 'auto'));   // data-aegis-warm="auto|800px|off"
                    wio.watch(el, warm);
                    pre = () => wio.unwatch(el);
                }
                _cancelPending.set(el, () => { obs.unwatch(el); if (pre) pre(); });
                break;
            }
            case 'idle': {
                const timeoutMs = sargs[0] ? +sargs[0] : null;
                idle.push(mount);
                if (timeoutMs) setTimeout(() => { const i = idle.indexOf(mount); if (i >= 0) { idle.splice(i, 1); mount(); } }, timeoutMs);
                _cancelPending.set(el, () => { const i = idle.indexOf(mount); if (i >= 0) idle.splice(i, 1); });
                break;
            }
            case 'interaction': {
                const events = sargs.length ? sargs : ['click', 'keydown', 'focusin', 'touchstart', 'pointerenter'];
                const handler = async (ev) => {
                    off();
                    const r = mount();
                    if (r && typeof r.then === 'function') await r;
                    // переиграть событие, из-за которого остров проснулся (Enter, click) — слушатели внутри уже живы
                    if (ev.type !== 'pointerenter' && ev.type !== 'mouseenter' && ev.type !== 'touchstart' && ev.type !== 'focusin' && ev.target) {
                        // цель могла быть заменена рендером острова — тогда переигрываем на корне
                        const target = ev.target.isConnected ? ev.target : el;
                        try { target.dispatchEvent(new ev.constructor(ev.type, ev)); } catch (e) { /* не воспроизводимое событие */ }
                    }
                };
                const off = () => { for (const evt of events) el.removeEventListener(evt, handler); };
                for (const evt of events) el.addEventListener(evt, handler, { passive: evt === 'touchstart' || evt === 'pointerenter' });
                _cancelPending.set(el, off);
                break;
            }
            default:
                if (strategy.startsWith('media(')) {
                    const mql = window.matchMedia(strategy.slice(6, -1));
                    if (mql.matches) { eager.push(mount); break; }
                    const handler = (e) => { if (e.matches) { mql.removeEventListener('change', handler); mount(); } };
                    mql.addEventListener('change', handler);
                    _cancelPending.set(el, () => mql.removeEventListener('change', handler));
                } else if (document.prerendering && !sargs.includes('prerender')) {
                    const h = () => mount();
                    document.addEventListener('prerenderingchange', h, { once: true });
                    _cancelPending.set(el, () => document.removeEventListener('prerenderingchange', h));
                } else {
                    eager.push(mount);
                }
        }
    };

    if (root.nodeType === 1 && root.matches('[data-aegis]')) mountIsland(root);
    root.querySelectorAll('[data-aegis]').forEach(mountIsland);

    // idle: ОДИН requestIdleCallback, дренаж по deadline, дедлайн через idleTimeout
    if (idle.length) {
        const drain = (dl) => {
            while (idle.length && (dl.timeRemaining() > 1 || dl.didTimeout)) idle.shift()();
            if (idle.length) requestIdleCallback(drain, { timeout: idleTimeout });
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(drain, { timeout: idleTimeout });
        else setTimeout(() => drain({ timeRemaining: () => 50, didTimeout: true }), 200);
    }

    // eager: синхронно до бюджета, дальше — по кусочкам между задачами (первый кусок всегда синхронный)
    handles.ready = (async () => {
        let t0 = performance.now();
        for (const job of eager) {
            const r = job();
            if (r && typeof r.then === 'function') await r;   // ленивый остров: ждём import()
            if (performance.now() - t0 > budget) { await _yield(); t0 = performance.now(); }
        }
    })();

    if (watch) _watchIslands(root);
    return handles;
}

/** MutationObserver на root: новые острова оживают, удалённые из DOM — уничтожаются (перемещение ≠ удаление) */
function _watchIslands(root) {
    const target = root === document ? document.documentElement : root;
    if (_watched.has(target)) return;
    _watched.add(target);
    const obs = new MutationObserver((records) => {
        const removed = new Set();
        for (const r of records) {
            for (const n of r.addedNodes) if (n.nodeType === 1) hydrate(n, { quiet: true });
            for (const n of r.removedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.matches('[data-aegis-live]')) removed.add(n);
                n.querySelectorAll('[data-aegis-live]').forEach(c => removed.add(c));
            }
        }
        if (removed.size) queueMicrotask(() => { for (const el of removed) if (!el.isConnected) destroy(el); });
    });
    obs.observe(target, { childList: true, subtree: true });
}

/**
 * Уничтожить компонент — auto-cleanup всего
 */
/** Снимок состояния острова: ctx.state(...) + api.snapshot?.() */
function _snapshotIsland(el, c) {
    const out = c.scope._state ? Object.fromEntries([...c.scope._state].map(([k, sg]) => [k, sg.peek()])) : {};
    if (c.api && typeof c.api.snapshot === 'function') { try { Object.assign(out, c.api.snapshot() || {}); } catch (e) { /* */ } }
    return out;
}
/** Можно ли выгрузить остров: не в фокусе, не permanent, без играющего медиа, без несохранённого ввода */
function _evictable(el) {
    if (el.matches('[data-aegis-permanent]')) return false;
    if (typeof document !== 'undefined' && el.contains(document.activeElement) && document.activeElement !== el) return false;
    if (el.querySelector('video:not([paused]),audio:not([paused])')) { for (const m of el.querySelectorAll('video,audio')) if (!m.paused) return false; }
    for (const f of el.querySelectorAll('input,textarea,select')) { if (f.type === 'checkbox' || f.type === 'radio') { if (f.checked !== f.defaultChecked) return false; } else if (f.tagName === 'SELECT') { /* пропуск */ } else if (f.value !== f.defaultValue) return false; }
    return true;
}
/** Заморозить остров: снимок → destroy (DOM остаётся) → data-aegis-state="hibernated"; вернуть true, если заморожен */
function _freezeIsland(el, state = 'hibernated') {
    const c = _components.get(el);
    if (!c || !_evictable(el)) return false;
    _swap.set(el, _snapshotIsland(el, c));
    destroy(el);
    el.dataset.aegisState = state;
    _resident.delete(el);
    _islandStats[state === 'swapped' ? 'evictions' : 'hibernations']++;
    return true;
}
/** CLOCK (second chance) по резидентным островам: при превышении max выгружается первый без бита обращения */
function _clockIslands(max, pageOut) {
    let guard = _resident.size * 2;
    while (_resident.size > max && guard-- > 0) {
        const [el, r] = _resident.entries().next().value;
        _resident.delete(el);
        if (r.v) { r.v = 0; _resident.set(el, r); } else if (!pageOut(el)) _resident.set(el, r);
    }
}
export function destroy(el) {
    const cancel = _cancelPending.get(el);
    if (cancel) { cancel(); _cancelPending.delete(el); _pending.delete(el); delete el.dataset.aegisState; }
    const entry = _components.get(el);
    if (entry) {
        entry.scope.dispose();
        _components.delete(el);
    }
}

/**
 * Уничтожить все компоненты внутри элемента
 */
export function destroyAll(root = document) {
    for (const [el, entry] of _components) {
        if (root === document || root.contains(el)) {
            entry.scope.dispose();
            _components.delete(el);
        }
    }
}


// ============================================================================
// 9. RESOURCE — Async data primitive (THE killer feature)
//
//    Один resource() на все случаи: fetch → SWR-кэш → offline переключаются
//    опциями { cache, offline }, контракт результата один:
//      { data, loading, validating, stale, status, error, key, refresh, mutate,
//        abort, promise, ready(), dispose, [Symbol.dispose] }
//    loading    — идёт запрос и данных ещё нет (скелетон один раз)
//    validating — идёт запрос поверх данных (dimming, не мигание)
//    status     — 'idle' | 'pending' | 'success' | 'error'
// ============================================================================

// ---- settled(): дождаться всей асинхронщины движка ---------------------------

const _inflightAll = new Set();

function _trackPromise(p) {
    _inflightAll.add(p);
    const done = () => _inflightAll.delete(p);
    p.then(done, done);
    return p;
}

/**
 * Дождаться завершения всех запросов resource()/mutation()/guardedFetch — вместо sleep(50) в тестах.
 * Ловит цепочки «ответ → запись сигнала → effect → новый fetch».
 */
export async function settled() {
    let rounds = 0;
    while (_inflightAll.size) {
        if (++rounds > 100) throw new Error('[Aegis] settled(): requests never settle (a resource refetches itself?)');
        await Promise.allSettled([..._inflightAll]);
    }
}

// ---- structural sharing -------------------------------------------------------

const _isPlain = (o) => o !== null && typeof o === 'object'
    && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);

/**
 * Structural sharing: неизменённые части ответа сохраняют identity предыдущих —
 * list() не пересоздаёт строки на SWR-ревалидации с тем же JSON.
 * Сравниваются только массивы и plain-объекты (Date/Map/File — как есть).
 */
/**
 * Структурное разделение: неизменённые узлы ответа сохраняют identity (list() не перерисовывает строки).
 * Массивы plain-объектов матчатся по ключу (share: 'id' по умолчанию, строка поля или функция), не по индексу —
 * prepend/удаление строки не ломает identity остальных. Копия узла создаётся только при первом расхождении.
 */
function _share(prev, next, key = 'id', depth = 0) {
    if (prev === next) return prev;
    const arr = Array.isArray(next);
    if (!((Array.isArray(prev) && arr) || (_isPlain(prev) && _isPlain(next))) || depth > 40) return next;
    const kf = typeof key === 'function' ? key : (o) => o[key === true ? 'id' : key];
    let byId = null;
    if (arr && prev.length && next.length && _isPlain(next[0]) && kf(next[0]) !== undefined) {
        byId = new Map();
        for (let i = 0; i < prev.length; i++) { const p = prev[i]; if (_isPlain(p)) { const k = kf(p); if (k !== undefined && !byId.has(k)) byId.set(k, p); } }
    }
    const keys = arr ? null : Object.keys(next);
    const len = arr ? next.length : keys.length;
    let out = null;
    for (let i = 0; i < len; i++) {
        const k = arr ? i : keys[i];
        const nv = next[k];
        let pv = prev[k];
        if (byId && _isPlain(nv)) { const id = kf(nv); if (id !== undefined) pv = byId.get(id); }
        const v = _share(pv, nv, key, depth + 1);
        if (out) { out[k] = v; continue; }
        if (v !== prev[k] || !(arr || k in prev)) {          // первое расхождение — материализовать копию
            out = arr ? new Array(len) : {};
            for (let j = 0; j < i; j++) { const kk = arr ? j : keys[j]; out[kk] = prev[kk]; }
            out[k] = v;
        }
    }
    if (out) return out;
    return (arr ? prev.length : Object.keys(prev).length) === len ? prev : next;
}

/** Стабильная сериализация: ключи объектов отсортированы (порядок полей params не меняет ключ кэша) */
const _stableJSON = (v) => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) && _isPlain(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
/**
 * Канонический ключ кэша: строка-URL → query отсортирован, пустые значения/хвостовой '&'/'#fragment' убраны;
 * массив → иерархический ключ ['users', 42] (invalidate(['users']) матчит все ['users', …]); объект → stable JSON.
 */
function _normKey(a) {
    if (a == null || a === false || a === '') return null;
    if (Array.isArray(a)) return a.map(p => typeof p === 'function' ? p() : p).map(p => typeof p === 'string' ? p : _stableJSON(p)).join('\0');
    if (typeof a !== 'string') return _stableJSON(a);
    const q = a.indexOf('?');
    if (q < 0) { const h = a.indexOf('#'); return h < 0 ? a : a.slice(0, h); }
    const h = a.indexOf('#', q);
    const pairs = a.slice(q + 1, h < 0 ? undefined : h).split('&').filter(Boolean).map(p => { const i = p.indexOf('='); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; }).filter(([, v]) => v !== '');
    const red = _config.cache && _config.cache.redact;
    if (red) for (const p of pairs) { let nm = p[0]; try { nm = decodeURIComponent(nm); } catch (x) { /* */ } if (red.includes(nm)) p[1] = '*'; }   // токены не попадают в ключи, BroadcastChannel и историю
    pairs.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0);
    return pairs.length ? a.slice(0, q) + '?' + pairs.map(p => p[0] + '=' + p[1]).join('&') : a.slice(0, q);
}
const _keyOf = _normKey;

// Optimistic updates как лог патчей: data = fold(base, patches). Патч мутации живёт до её завершения — откат одной мутации
// не трогает патчи других, серверный ответ (base) не стирает ещё не подтверждённые правки.
let _optCtx = null, _mutSeq = 0;
function _recompute(o) { let v = o.base; for (let i = 0; i < o.patches.length; i++) v = o.patches[i].fn(v); o.data.value = v; }
function _applyMutate(o, fn) {
    const f = typeof fn === 'function' ? fn : () => fn;
    if (_optCtx) { o.patches.push({ id: _optCtx.id, fn: f }); if (!_optCtx.owned.includes(o)) _optCtx.owned.push(o); _recompute(o); }
    else { o.base = f(o.base); _recompute(o); }
}
/** Трёхстороннее слияние: поле берётся у клиента, если менял только он; у сервера, если только сервер; конфликт — сервер побеждает, ключ в conflicts */
function _merge3(base, local, server) {
    if (!_isPlain(base) || !_isPlain(local) || !_isPlain(server)) return { value: local !== base ? local : server, conflicts: [] };
    const out = { ...server }, conflicts = [];
    const eq = (a, b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
    for (const k of new Set([...Object.keys(local), ...Object.keys(base)])) {
        const lc = !eq(local[k], base[k]), scg = !eq(server[k], base[k]);
        if (lc && !scg) out[k] = local[k];
        else if (lc && scg && !eq(local[k], server[k])) {
            if (_isPlain(local[k]) && _isPlain(server[k]) && _isPlain(base[k])) { const r = _merge3(base[k], local[k], server[k]); out[k] = r.value; conflicts.push(...r.conflicts.map(c => k + '.' + c)); }
            else conflicts.push(k);
        }
    }
    return { value: out, conflicts };
}

// Часы кэша: подменяются useClock() в тестах (fakeClock из aegis/test) — staleTime и GC становятся детерминированными
let _nowFn = Date.now;
const _now = () => _nowFn();
/** Подменить часы кэша (staleTime, cacheTime, explain): useClock(() => t); возвращает restore */
export function useClock(fn) { const prev = _nowFn; _nowFn = fn || Date.now; return () => { _nowFn = prev; }; }

// Один GET на URL в полёте для plain resource(): второй инстанс присоединяется (свои transform/share/сигналы)
const _inflightByUrl = new Map();
function _joinFetch(url, fetcher, signal, retryOpts) {
    let rec = _inflightByUrl.get(url);
    if (!rec) {
        const controller = new AbortController();
        rec = { refs: 0, controller, p: null };
        rec.p = withRetry(() => fetcher(url, { signal: controller.signal }), { ...retryOpts, signal: controller.signal })
            .finally(() => { if (_inflightByUrl.get(url) === rec) _inflightByUrl.delete(url); });
        _inflightByUrl.set(url, rec);
    }
    rec.refs++;
    const leave = () => { if (--rec.refs <= 0) rec.controller.abort(); };
    signal.addEventListener('abort', leave, { once: true });
    return rec.p.finally(() => signal.removeEventListener('abort', leave));
}


/** Общая форма результата: computed loading/validating/status + ready() */
function _resultShape(o) {
    const loading = computed(() => o.inflight.value && o.data.value === null, 'resource:loading');
    const validating = computed(() => o.inflight.value && o.data.value !== null, 'resource:validating');
    const status = computed(() => o.error.value ? 'error'
        : o.inflight.value ? 'pending'
        : (o.data.value !== null || o.started.value) ? 'success' : 'idle', 'resource:status');
    const ready = async () => {
        let p;
        while ((p = o.promise())) {
            await p;
            if (o.promise() === p) break;
        }
        const err = o.error.peek();
        if (err) throw err;
        return o.data.peek();
    };
    const res = {
        data: o.data, loading, validating, status, error: o.error, key: o.key,
        stale: o.stale || computed(() => false),
        refresh: o.refresh, mutate: o.mutate, abort: o.abort,
        get promise() { return o.promise(); },
        ready, dispose: o.dispose,
    };
    if (typeof Symbol.dispose === 'symbol') res[Symbol.dispose] = o.dispose;
    if (o.extra) Object.assign(res, o.extra);
    return res;
}

// ---- resource() ----------------------------------------------------------------

/**
 * Реактивная загрузка данных.
 *   resource('/api/users')                                     — GET, refresh(), mutate()
 *   resource(() => `/api/users?page=${page.value}`)            — перезапрос при изменении сигналов, abort старого
 *   resource({ params: () => ({ id: uid.value }), loader: async ({ params, signal }) => db.get(params.id) })
 *   resource(url, { cache: true, staleTime: 30000 })           — SWR-кэш, общий между вызовами с тем же ключом
 *   resource(url, { offline: true })                           — IndexedDB-кэш + очередь мутаций
 *
 * @param {string|Function|{params?, loader}} source
 * @param {Object} [opts]
 * @param {*} [opts.initial=null]
 * @param {Function} [opts.transform]
 * @param {Function} [opts.fetcher] — по умолчанию defaults.fetcher (request())
 * @param {boolean} [opts.immediate=true]
 * @param {boolean} [opts.share=true] — structural sharing ответа
 * @param {boolean|number|Function} [opts.retry=0] — повторы с backoff (true → 3)
 * @param {{focus?:boolean, reconnect?:boolean, interval?:number}} [opts.refetch] — перезапрос по событиям (opt-in)
 * @param {boolean|Object} [opts.cache] — SWR-движок (см. cachedResource)
 * @param {boolean|Object} [opts.offline] — offline-движок (см. offlineResource)
 */
export function resource(source, opts = {}) {
    if (opts.offline) return _offlineResource(source, typeof opts.offline === 'object' ? { ...opts, ...opts.offline } : opts);
    if (opts.cache) return _cachedResource(source, typeof opts.cache === 'object' ? { ...opts, ...opts.cache } : opts);
    return _plainResource(source, opts);
}

function _plainResource(source, opts) {
    const {
        initial = null,
        transform = (d) => d,
        immediate = true,
        share = true,
        retry,
        refetch,
        dedupe = true,
    } = opts;
    const fetcher = opts.fetcher || _fetcher();
    const loader = source && typeof source === 'object' && typeof source.loader === 'function' ? source.loader : null;
    const paramsFn = loader ? (typeof source.params === 'function' ? source.params : () => source.params) : null;

    const data = signal(initial, 'resource:data');
    const inflight = signal(false, 'resource:inflight');
    const started = signal(false, 'resource:started');
    const error = signal(null, 'resource:error');
    const key = signal(null, 'resource:key');
    const pe = { base: initial, patches: [], data, etag: null };       // patch-log (см. _applyMutate)
    let controller = null;
    let last = null;

    const abort = () => { if (controller) { controller.abort(); controller = null; } };

    const resId = ++_resId;
    const site = (!globalThis.AEGIS_PROD && _dev()) ? _callSite() : null;
    const _fetch = (arg) => {
        abort();
        if (!loader) _devTrackFetch(typeof arg === 'string' ? arg : null, 'resource', resId, site);
        const c = controller = new AbortController();
        batch(() => { inflight.value = true; started.value = true; error.value = null; });
        const attempt = () => loader
            ? loader({ params: arg, signal: c.signal })
            : fetcher(arg, { signal: c.signal });
        const p = (async () => {
            try {
                const retryOpts = { retries: _retries(retry), shouldRetry: typeof retry === 'function' ? retry : undefined };
                const result = (dedupe && !loader && typeof arg === 'string' && !opts.fetcher)
                    ? await _joinFetch(arg, fetcher, c.signal, retryOpts)          // второй resource(url) в полёте → один GET
                    : await withRetry(attempt, { ...retryOpts, signal: c.signal });
                if (c.signal.aborted) return;
                const next = transform(result);
                pe.base = share === false ? next : _share(pe.base, next, share);
                _recompute(pe);
            } catch (e) {
                if (e?.name === 'AbortError' || c.signal.aborted) return;
                error.value = e;
            } finally {
                if (controller === c) { controller = null; inflight.value = false; }
            }
        })();
        last = _trackPromise(p);
        return p;
    };

    const resolveArg = () => loader ? paramsFn() : (typeof source === 'function' ? source() : source);
    const refresh = () => {
        const a = resolveArg();
        key.value = _keyOf(a);
        if (a == null || a === false || a === '') return Promise.resolve();
        return _fetch(a);
    };
    /** Optimistic update: меняет data немедленно; внутри mutation({ optimistic }) — как патч, который откатывается сам */
    const mutate = (fn) => _applyMutate(pe, fn);

    if (immediate) {
        if (loader || typeof source === 'function') {
            effect(() => {
                const a = resolveArg();           // auto-track сигналов внутри
                untrack(() => {
                    key.value = _keyOf(a);
                    if (a == null || a === false || a === '') { abort(); return; }
                    _fetch(a);
                });
            }, 'resource:auto-fetch');
        } else {
            refresh();
        }
    }

    // Перезапрос по событиям — только opt-in
    if (refetch && typeof document !== 'undefined') {
        const on_ = new Set(); if (refetch.focus) on_.add('focus'); if (refetch.reconnect) on_.add('reconnect');
        if (on_.size) {
            const el = _hostEl();
            const unreg = _schedRegister({ on: on_, due: () => !inflight.peek(), prio: () => 1 + _visibility(el), fire: () => refresh() });
            if (_currentScope) _currentScope.onDispose(unreg);
        }
        if (refetch.interval > 0) poll(() => { if (!inflight.peek()) return refresh(); }, refetch.interval);
    }

    const dispose = () => abort();
    if (_currentScope) _currentScope.onDispose(dispose);

    return _resultShape({ data, inflight, started, error, key, refresh, mutate, abort, promise: () => last, dispose });
}

// ---- mutation() ----------------------------------------------------------------

/**
 * Мутация с pending, double-submit guard, optimistic + rollback, invalidate.
 *   const addTodo = mutation((text, { signal }) => api.post('/api/todos', { text }, { signal }), {
 *       resources: [todos],                                    // снимок data → откат при ошибке
 *       optimistic: (text) => todos.mutate(l => [...l, { id: 'tmp', text }]),
 *       invalidates: ['/api/todos'],
 *   });
 *   html`<button @click=${() => addTodo(text)} ?disabled=${addTodo.pending}>Add</button>`
 * Ошибка не бросается наружу (обработчики кликов не получают unhandled rejection) — она в addTodo.error;
 * addTodo.run(...) — то же, но с throw.
 *
 * @param {Function} fn — (...args, { signal }) => Promise
 * @param {Object} [opts]
 * @param {Array} [opts.resources] — ресурсы для отката
 * @param {Function} [opts.optimistic]
 * @param {string|Function|Array} [opts.invalidates]
 * @param {'ignore'|'queue'|'latest'|'parallel'} [opts.concurrent='ignore']
 * @param {Function} [opts.onSuccess], [opts.onError]
 */
export function mutation(fn, opts = {}) {
    const { resources = [], optimistic, invalidates, concurrent = 'ignore', onSuccess, onError, awaitInvalidates = true, commit, updates, patch, onConflict, announce: ann = null, isolation = null } = opts;
    const pending = signal(false, 'mutation:pending');
    const error = signal(null, 'mutation:error');
    const data = signal(null, 'mutation:data');
    let controller = null;
    let chain = Promise.resolve();

    const exec = async (args, attempt = 0, prevCtx = null) => {
        if (concurrent === 'latest' && controller) controller.abort();
        const c = controller = new AbortController();
        const ctx = prevCtx || { id: ++_mutSeq, owned: [] };
        batch(() => { pending.value = true; error.value = null; });
        const snapshots = resources.map(r => r.data.peek());               // legacy: снимки до optimistic
        // optimistic → патчи поверх base у затронутых записей (mutate() внутри optimistic регистрирует их сам)
        _optCtx = ctx;
        try { if (optimistic && attempt === 0) batch(() => optimistic(...args)); } finally { _optCtx = null; }
        const owned = ctx.owned;
        const baseSnap = owned.map(o => o.base);
        const drop = () => { for (const o of owned) { o.patches = o.patches.filter(p => p.id !== ctx.id); _recompute(o); } };
        const fold = () => { for (const o of owned) { let v = o.base; for (const p of o.patches) if (p.id === ctx.id) v = p.fn(v); o.base = v; } drop(); };
        try {
            const etag = owned.find(o => o.etag)?.etag || null;
            let result;
            if (isolation === 'validate') {
                // OCC: сигналы, прочитанные через read до ответа сервера, валидируются по версиям — тело построило запрос из устаревшего состояния → патч снимается, ключи перечитываются
                try { result = await transaction(({ read }) => fn(...args, { signal: c.signal, etag, read }), { retries: 0, onConflict: () => 'abort' }); }
                catch (e) {
                    if (e && e.changed && !c.signal.aborted) {
                        _warn('E052', !globalThis.AEGIS_PROD && { what: `mutation: ${e.changed.map(d => d.name).join(', ')} changed while the request was in flight — the request was built from stale state.`, why: 'isolation: "validate" checks the signals read through ctx.read against their versions at commit; the optimistic patch is dropped and the touched keys are refetched.', fix: 'Read everything the request needs through ctx.read (not sig.value after an await), or accept last-writer-wins by removing isolation.' }, 'mut:stale');
                        drop();
                        for (const o of owned) if (o.url != null) invalidate(o.key);
                        error.value = null;
                        return undefined;
                    }
                    throw e;
                }
            } else result = await fn(...args, { signal: c.signal, etag });
            if (c.signal.aborted) return undefined;
            data.value = result;
            batch(() => {
                fold();                                                          // оптимистичное состояние становится base; refetch (invalidates) заменит его серверным
                if (commit) for (const o of owned) { o.base = commit(result, o.base, ...args); _recompute(o); }
                if (updates) for (const [pat, f] of Object.entries(updates)) { const m = _keyMatcher(pat); for (const [k, e] of _resourceCache) if (m(k, e) && e.base != null) { _setData(e, f(e.base, result, ...args)); e.lastFetch = _now(); } }
                if (patch) for (const [ek, f] of (patch(result, ...args) || [])) cache.patchEntity(ek, f);
            });
            if (ann) _say(ann, 'success', 'polite', result, ...args);
            if (invalidates) { const ps = [].concat(invalidates).map(k => invalidate(k)); if (awaitInvalidates) await Promise.all(ps); }   // pending снимается, когда списки уже свежие
            if (onSuccess) onSuccess(result, ...args);
            return result;
        } catch (e) {
            if (e?.name === 'AbortError' || c.signal.aborted) return undefined;
            // конфликт версий (If-Match → 412 / 409): спросить onConflict с base/local/server и merge()
            if ((e?.status === 412 || e?.status === 409) && onConflict && owned.length && attempt === 0) {
                const o = owned[0];
                const local = o.data.peek();
                let server = e.data && typeof e.data === 'object' && !Array.isArray(e.data) && !('message' in e.data && Object.keys(e.data).length === 1) ? e.data : null;
                if (server == null && o.fopts && o.url != null) { try { await _fetchEntry(o, o.url, o.fopts, 'refresh'); } catch (x) { /* */ } server = o.base; }
                const base = baseSnap[0];
                let verdict;
                try { verdict = await onConflict({ base, local, server, merge: () => _merge3(base, local, server), error: e }); } catch (x) { verdict = 'server'; }
                if (ann) _say(ann, 'conflict', 'assertive', e, ...args);
                if (verdict === 'server' || verdict == null) { drop(); if (server != null) _setData(o, server); error.value = null; return undefined; }
                const merged = verdict === 'client' ? local : verdict;
                drop();
                _optCtx = ctx; try { _applyMutate(o, () => merged); } finally { _optCtx = null; }
                return exec([merged, ...args.slice(1)], attempt + 1, ctx);
            }
            const hadOptimistic = owned.length > 0;
            drop();                                                              // откат только патчей этой мутации
            if (!owned.length) batch(() => resources.forEach((r, i) => { if (r.mutate) r.mutate(snapshots[i]); }));   // legacy: optimistic менял данные мимо mutate()
            error.value = e;
            if (ann) { _say(ann, 'error', 'assertive', e, ...args); if (hadOptimistic) _say(ann, 'undone', 'polite', e, ...args); }
            if (onError) onError(e, ...args);
            throw e;
        } finally {
            if (controller === c) { controller = null; pending.value = false; }
        }
    };

    const run = (...args) => {
        let p;
        if (pending.peek() && concurrent === 'ignore') return Promise.resolve(undefined);
        if (concurrent === 'queue') { p = chain = chain.catch(() => {}).then(() => exec(args)); }
        else p = exec(args);
        return _trackPromise(p);
    };
    const call = (...args) => run(...args).catch(() => undefined);
    call.run = run;
    call.pending = pending;
    call.error = error;
    call.data = data;
    call.abort = () => { if (controller) controller.abort(); };
    if (_currentScope) _currentScope.onDispose(call.abort);
    return call;
}

// ---- streamResource() / sse() ---------------------------------------------------

/**
 * Стриминг ответа (NDJSON / текст) в растущий сигнал.
 *   const rows   = streamResource('/api/export.ndjson');                            // data: массив распарсенных строк
 *   const answer = streamResource('/ai/chat', { method: 'POST', body: { q }, parse: 'text', initial: '' });
 *   streamResource(url, { parse: line => JSON.parse(line).text, initial: '', reduce: (acc, t) => acc + t })
 * Буфер сбрасывается пачкой не чаще раза в 16 мс. done — сигнал; validating = true до done.
 */
export function streamResource(source, opts = {}) {
    const { method = 'GET', body, headers, parse = 'ndjson', reduce, immediate = true } = opts;
    const isText = parse === 'text';
    const initial = opts.initial !== undefined ? opts.initial : (isText ? '' : []);
    const data = signal(initial, 'stream:data');
    const inflight = signal(false, 'stream:inflight');
    const started = signal(false, 'stream:started');
    const error = signal(null, 'stream:error');
    const done = signal(false, 'stream:done');
    const key = signal(null, 'stream:key');
    let controller = null, last = null;
    let pendingItems = [], timer = null;

    const flush = () => {
        timer = null;
        if (!pendingItems.length) return;
        const items = pendingItems;
        pendingItems = [];
        const prev = data.peek();
        data.value = reduce ? items.reduce(reduce, prev)
            : isText ? prev + items.join('')
            : [...prev, ...items];
    };
    const push = (item) => {
        pendingItems.push(item);
        if (!timer) timer = setTimeout(flush, 16);
    };
    const abort = () => { if (controller) { controller.abort(); controller = null; } };

    const _run = (url) => {
        abort();
        const c = controller = new AbortController();
        batch(() => { inflight.value = true; started.value = true; error.value = null; done.value = false; data.value = initial; });
        const p = (async () => {
            try {
                const response = await request(url, { method, body, headers, signal: c.signal, raw: true });
                if (!response.ok) throw new HttpError(response.status, response, await _parseBody(response));
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buf = '';
                for (;;) {
                    const { value, done: end } = await reader.read();
                    if (end) break;
                    const chunk = decoder.decode(value, { stream: true });
                    if (isText) { push(chunk); continue; }
                    buf += chunk;
                    let nl;
                    while ((nl = buf.indexOf('\n')) >= 0) {
                        const line = buf.slice(0, nl).trim();
                        buf = buf.slice(nl + 1);
                        if (line) push(typeof parse === 'function' ? parse(line) : _safeParse(line));
                    }
                }
                buf += decoder.decode();
                if (!isText && buf.trim()) push(typeof parse === 'function' ? parse(buf.trim()) : _safeParse(buf.trim()));
                if (timer) { clearTimeout(timer); flush(); }
                done.value = true;
            } catch (e) {
                if (e?.name === 'AbortError' || c.signal.aborted) return;
                error.value = e;
            } finally {
                if (controller === c) { controller = null; inflight.value = false; }
            }
        })();
        last = _trackPromise(p);
        return p;
    };

    const resolveUrl = () => typeof source === 'function' ? source() : source;
    const refresh = () => { const u = resolveUrl(); key.value = u; return u ? _run(u) : Promise.resolve(); };
    const mutate = (fn) => { data.value = typeof fn === 'function' ? fn(data.peek()) : fn; };

    if (immediate) {
        if (typeof source === 'function') effect(() => { const u = source(); untrack(() => { key.value = u; if (u) _run(u); else abort(); }); }, 'stream:auto');
        else refresh();
    }
    const dispose = () => { abort(); if (timer) { clearTimeout(timer); timer = null; } };
    if (_currentScope) _currentScope.onDispose(dispose);

    return _resultShape({ data, inflight, started, error, key, refresh, mutate, abort, promise: () => last, dispose, extra: { done } });
}

/**
 * Server-Sent Events поверх EventSource (свой lifecycle: авто-reconnect, только GET).
 *   const s = sse('/events', {
 *       signals: { progress },                      // event: aegis-signals   data: {"progress": 42}
 *       events: { message: (data, e) => … },        // именованные события (data — строка или JSON, если парсится)
 *       onMessage: (data) => …,                     // события без имени
 *   });
 *   s.status — 'connecting' | 'open' | 'closed'; s.close(); закрывается при dispose scope
 */
export function sse(url, opts = {}) {
    const { signals = {}, events = {}, onMessage, withCredentials = false } = opts;
    const status = signal('connecting', 'sse:status');
    const es = new EventSource(url, { withCredentials });
    const parse = (d) => { try { return _safeParse(d); } catch { return d; } };
    es.onopen = () => { status.value = 'open'; };
    es.onerror = () => { status.value = es.readyState === 2 ? 'closed' : 'connecting'; };
    es.addEventListener('aegis-signals', (e) => {
        const patch = parse(e.data);
        if (!patch || typeof patch !== 'object') return;
        batch(() => { for (const [k, v] of Object.entries(patch)) if (signals[k]) signals[k].value = v; });
    });
    for (const [name, fn] of Object.entries(events)) es.addEventListener(name, (e) => fn(parse(e.data), e));
    if (onMessage) es.onmessage = (e) => onMessage(parse(e.data), e);
    const close = () => { es.close(); status.value = 'closed'; };
    if (_currentScope) _currentScope.onDispose(close);
    return { status, close, source: es };
}


// ============================================================================
// 10. WATCH — Explicit dependency watching
// ============================================================================

/**
 * Наблюдение за конкретным сигналом/computed с oldValue/newValue.
 * В отличие от effect — не запускается сразу (immediate: true — запускается), вызов только при изменении.
 *   const w = watch(query, (q, prev, onCleanup) => { const c = new AbortController(); onCleanup(() => c.abort()); … }, { debounce: 300 });
 *   w.pause(); w.resume(); w.stop(); w();   // dispose-функция с методами
 *   watch(ready, init, { once: true });
 * Источник-массив: watch(() => [a.value, b.value], ([a, b], [pa, pb]) => …) — сравнение по элементам.
 */
/** Источник watch()/until(): сигнал или геттер; примитив и reactive-объект — E046 (никогда не сработает) */
function _sourceGetter(source, api) {
    if (isSignal(source)) return () => source.value;
    if (typeof source === 'function') return source;
    if ((!globalThis.AEGIS_PROD && _dev()) && (source === null || typeof source !== 'object' || '$raw' in source)) _warn('E046', !globalThis.AEGIS_PROD && {
        what: `${api}() got ${source !== null && typeof source === 'object' ? 'a reactive object' : 'a ' + typeof source} as source — it will never fire.`,
        why: 'Only a signal or a getter can be observed; a plain value was read once at the call site.',
        fix: `${api}(() => state.count, cb) or ${api}(sig, cb); for a whole reactive object: ${api}(() => state.$snapshot(), cb).`,
    }, api + ':' + typeof source);
    return () => source;
}
export function watch(source, callback, opts = {}) {
    const { immediate: imm = false, debounce: debMs, once = false } = opts;
    const getter = _sourceGetter(source, 'watch');

    let oldValue;
    let initialized = false;
    let paused = false;
    let cleanup = null;
    const runCleanup = () => { const c = cleanup; cleanup = null; if (c) c(); };
    const onCleanup = (fn) => { cleanup = fn; };
    let cb = (v, prev) => {
        runCleanup();
        callback(v, prev, onCleanup);
        if (once) stop();
    };
    if (debMs > 0) cb = debounced(cb, debMs);

    const same = (x, y) => Object.is(x, y) || (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, i) => Object.is(v, y[i])));

    const disposeEffect = effect(() => {
        const newValue = getter();
        if (!initialized) {
            initialized = true;
            oldValue = newValue;
            if (imm) cb(newValue, undefined);
            return;
        }
        if (paused) { oldValue = newValue; return; }
        if (!same(newValue, oldValue)) {
            const prev = oldValue;
            oldValue = newValue;
            cb(newValue, prev);
        }
    }, 'watch');

    const stop = () => { disposeEffect(); runCleanup(); if (cb.cancel) cb.cancel(); };
    stop.stop = stop;
    stop.pause = () => { paused = true; };
    stop.resume = () => { paused = false; };
    return stop;
}

/**
 * Дождаться сигнала: resolve при первом значении, для которого predicate истинен (проверяется сразу).
 *   await until(() => user.value);                         // truthy
 *   await until(loading, v => v === false, { timeout: 5000 });   // reject TimeoutError
 *   await until(count).toBe(10);   await until(list).changed();
 * При dispose scope — reject, чтобы await не завис навсегда.
 */
export function until(source, predicate = (v) => !!v, { timeout: ms } = {}) {
    const getter = _sourceGetter(source, 'until');
    const make = (pred, skipFirst) => new Promise((resolve, reject) => {
        let done = false, first = true, dispose = null, timer = null;
        const finish = (fn, v) => { if (done) return; done = true; if (dispose) dispose(); if (timer) clearTimeout(timer); fn(v); };
        dispose = effect(() => {
            const v = getter();
            if (first) { first = false; if (!skipFirst && pred(v)) queueMicrotask(() => finish(resolve, v)); return; }
            if (pred(v)) finish(resolve, v);
        }, 'until');
        if (done) return;
        if (ms > 0) timer = setTimeout(() => finish(reject, new DOMException(`until(): timed out after ${ms} ms`, 'TimeoutError')), ms);
        if (_currentScope) _currentScope.onDispose(() => finish(reject, new Error('[Aegis] until(): scope disposed')));
    });
    const p = make(predicate, false);
    p.toBe = (expected) => make((v) => Object.is(v, expected), false);
    p.changed = () => make(() => true, true);
    return p;
}


/**
 * Внешний источник как сигнал (отписка в текущем scope):
 *   from(matchMedia('(prefers-color-scheme: dark)'), 'change', mq => mq.matches)   // (EventTarget, event, map)
 *   from(set => { const h = () => set(navigator.onLine); addEventListener('online', h); return () => removeEventListener('online', h); }, navigator.onLine)   // producer
 *   from(preactSignal) / from(svelteStore) / from(rxObservable)                        // { subscribe }
 */
export function from(source, a, b) {
    if (source && typeof source.addEventListener === 'function' && typeof a === 'string') {
        const map = typeof b === 'function' ? b : (t) => t;
        const sig = signal(map(source), 'from:' + a);
        on(source, a, () => { sig.value = map(source); });
        return sig;
    }
    if (typeof source === 'function') {
        const lazy = b && typeof b === 'object' && b.lazy;
        let stop = null;
        const start = () => { if (stop) return; const r = source((v) => { sig.value = v; }); stop = typeof r === 'function' ? r : _noop; };
        const halt = () => { if (stop) { stop(); stop = null; } };
        const sig = lazy ? signal(a, { name: 'from:producer', watched: start, unwatched: halt }) : signal(a, 'from:producer');   // lazy: producer живёт, пока есть подписчики
        if (!lazy) { start(); if (stop !== _noop) _scoped(halt); }
        return sig;
    }
    if (source && typeof source.subscribe === 'function') {
        let initial = typeof source.peek === 'function' ? source.peek() : ('value' in source ? source.value : undefined);
        let first = true;
        const sig = signal(initial, 'from:subscribe');
        const sub = source.subscribe((v) => { if (first) { first = false; sig.value = v; return; } sig.value = v; });
        first = false;
        const stop = typeof sub === 'function' ? sub : (sub && typeof sub.unsubscribe === 'function' ? () => sub.unsubscribe() : null);
        if (stop) _scoped(stop);
        return sig;
    }
    return signal(source, 'from:value');
}

/**
 * Сигнал, сохранённый в localStorage/sessionStorage, с синхронизацией между вкладками.
 *   const theme = persisted('theme', 'light');
 *   const draft = persisted('draft:42', { title: '' }, { storage: sessionStorage, debounce: 200 });
 *   draft.clear();   // removeItem + вернуть initial
 * Нет storage / битый JSON / QuotaExceeded — сигнал продолжает работать в памяти (dev warning E021).
 */
export function persisted(key, initial, opts = {}) {
    const {
        storage = typeof localStorage !== 'undefined' ? localStorage : null,
        serialize = JSON.stringify,
        deserialize = JSON.parse,
        sync = storage === (typeof localStorage !== 'undefined' ? localStorage : null),
        debounce: debMs = 0,
    } = opts;
    const read = () => {
        if (!storage) return undefined;
        try { const raw = storage.getItem(key); return raw === null ? undefined : deserialize(raw); }
        catch (e) { _warn('E021', !globalThis.AEGIS_PROD && { what: `persisted("${key}"): stored value could not be read.`, why: String(e && e.message), fix: 'Clear the key or fix serialize/deserialize.' }); return undefined; }
    };
    const stored = read();
    const sig = signal(stored === undefined ? initial : stored, `persisted:${key}`);
    let writing = false, clearing = false;
    const write = (v) => {
        if (!storage || clearing) return;
        try { writing = true; storage.setItem(key, serialize(v)); }
        catch (e) { _warn('E021', !globalThis.AEGIS_PROD && { what: `persisted("${key}"): could not write to storage.`, why: String(e && e.message), fix: 'Storage is full or blocked (private mode) — the signal keeps working in memory.' }); }
        finally { writing = false; }
    };
    const writer = debMs > 0 ? debounced(write, debMs) : write;
    sig.subscribe(writer);
    if (sync && storage && typeof window !== 'undefined') {
        on(window, 'storage', (e) => {
            if (e.key !== key || e.storageArea !== storage || writing) return;
            try { sig.value = e.newValue === null ? initial : deserialize(e.newValue); } catch (err) { /* чужое значение */ }
        });
    }
    sig.clear = () => {
        try { storage && storage.removeItem(key); } catch (e) { /* */ }
        clearing = true;
        try { sig.value = initial; } finally { clearing = false; }
    };
    return sig;
}

/**
 * Undo/redo для сигнала, reactive() или store():
 *   const h = history(doc, { limit: 100, debounce: 300 });
 *   h.undo(); h.redo(); h.canUndo.value; h.canRedo.value; h.pause(); h.resume(); h.commit(); h.clear();
 * Снимки — structuredClone (fallback JSON). Без глобального Ctrl+Z (coexist с нативным undo в полях).
 */
export function history(source, { limit = 100, debounce: debMs = 0 } = {}) {
    const isSig = isSignal(source);
    const clone = (v) => { try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } };
    const snapshot = () => clone(isSig ? source.peek() : (typeof source.toJSON === 'function' ? source.toJSON() : source));
    const apply = (snap) => {
        applying = true;
        try {
            if (isSig) source.value = clone(snap);
            else batch(() => {
                const cur = source;
                for (const k of Object.keys(snap)) cur[k] = clone(snap[k]);
                for (const k of Object.keys(typeof cur.toJSON === 'function' ? cur.toJSON() : cur)) if (!(k in snap)) delete cur[k];
            });
        } finally { applying = false; }
    };
    const past = signal([], 'history:past'), future = signal([], 'history:future');
    let current = snapshot(), applying = false, paused = false;
    const push = () => {
        if (applying || paused) return;
        const next = snapshot();
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        batch(() => {
            past.value = [...past.peek().slice(-(limit - 1)), current];
            future.value = [];
        });
        current = next;
    };
    const track = debMs > 0 ? debounced(push, debMs) : push;
    const deepRead = (v, depth = 0) => {
        if (depth > 20 || v == null || typeof v !== 'object') return;
        if (Array.isArray(v)) { v.length; for (let i = 0; i < v.length; i++) deepRead(v[i], depth + 1); return; }
        for (const k of Object.keys(v)) deepRead(v[k], depth + 1);
    };
    if (isSig) source.subscribe(track);
    else effect(() => { deepRead(source); untrack(track); }, 'history');
    const undo = () => { const p = past.peek(); if (!p.length) return; if (track.flush) track.flush(); const prev = p[p.length - 1]; batch(() => { past.value = p.slice(0, -1); future.value = [current, ...future.peek()]; }); current = prev; apply(prev); };
    const redo = () => { const f = future.peek(); if (!f.length) return; const next = f[0]; batch(() => { future.value = f.slice(1); past.value = [...past.peek(), current]; }); current = next; apply(next); };
    return {
        undo, redo,
        canUndo: computed(() => past.value.length > 0, 'history:canUndo'),
        canRedo: computed(() => future.value.length > 0, 'history:canRedo'),
        pause: () => { paused = true; },
        resume: () => { paused = false; current = snapshot(); },
        commit: () => { if (track.cancel) track.cancel(); push(); },
        clear: () => { batch(() => { past.value = []; future.value = []; }); current = snapshot(); },
        past, future,
    };
}

/**
 * Writable derived: значение вычисляется из источника, запись переопределяет его до следующего изменения источника.
 *   const selected = linked(() => items.value[0]?.id ?? null);   selected.value = 42;   // сбросится, когда items изменится
 *   const page = linked({ source: () => filter.value, compute: (f, prev) => prev && prev.source === f ? prev.value : 1 });
 * Без эффектов и второго раунда flush — glitch-free через версии.
 */
/** Writable-обёртка над computed: единая для linked() и lens() — update(), имя для dev, live-прокси для ленивой подписки */
function _writable(out, setter, disposeExtra, name) {
    return {
        [SIGNAL]: true, _name: name || out._name,
        get value() { return out.value; },
        set value(v) { setter(v); },
        update(fn) { setter(fn(out.peek())); },
        peek() { return out.peek(); },
        version() { return out.version(); },
        subscribe(fn) { return out.subscribe(fn); },
        get subs() { return out.subs; }, set subs(v) { out.subs = v; },
        _isComputed: true, get _live() { return out._live; }, _activate() { out._activate(); }, _deactivate() { out._deactivate(); },
        dispose() { out.dispose(); if (disposeExtra) disposeExtra(); },
        toJSON() { return out.peek(); },
        toString() { return `${name || 'Writable'}(${_short(out.peek())})`; },
    };
}
/**
 * Двусторонняя линза: чтение — computed(get), запись — set(v) в источник (никакого локального состояния).
 *   bind:value=${lens(() => cents.value / 100, v => cents.value = Math.round(v * 100))}
 *   bind:value=${lens(state.address, 'city')}          // reactive()/store()/plain по ключу
 *   bind:value=${[() => state.city, v => state.city = v]}   // то же коротко — function bindings
 */
export function lens(get, set, name) {
    if (typeof get === 'object' && get !== null) { const obj = get, key = set; name = name || 'lens:' + String(key); get = () => obj[key]; set = (v) => { obj[key] = v; }; }
    const out = computed(get, name || 'lens');
    return _writable(out, (v) => batch(() => set(v)), null, name || 'lens');
}
const _isFnBinding = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'function' && typeof v[1] === 'function';
export function linked(sourceOrOpts, nameOrOpts) {
    const isObj = sourceOrOpts && typeof sourceOrOpts === 'object';
    const sourceFn = isObj ? sourceOrOpts.source : sourceOrOpts;
    const computeFn = isObj ? sourceOrOpts.compute : null;
    const src = computed(sourceFn, 'linked:source');
    const override = signal(undefined, 'linked:override');
    let overrideVersion = -1;
    let prev = undefined;   // { source, value } для compute
    const out = computed(() => {
        const s = src.value;
        const o = override.value;
        const v = src.version() === overrideVersion ? o : (computeFn ? computeFn(s, prev) : s);
        prev = { source: s, value: v };
        return v;
    }, nameOrOpts || 'linked');
    return _writable(out, (v) => { overrideVersion = src.version(); override.value = v; }, () => src.dispose(), _nm(nameOrOpts) || 'linked');
}

/**
 * O(2) обновлений вместо N: «выбранная строка» без подписки каждой строки на selectedId.
 *   const isSelected = selector(selectedId);
 *   list(rows, r => html`<tr class=${{ active: () => isSelected(r.id) }}>…`);
 *   const isChecked = selector(checkedIds, (set, key) => set.has(key));
 */
export function selector(source, equals = Object.is) {
    const keys = new Map(); // key → { subs, _version, version() }
    let current = isSignal(source) ? source.peek() : source();
    const srcFor = (k) => {
        let e = keys.get(k);
        if (!e) { e = { subs: null, _version: ++_epoch, version() { return this._version; } }; keys.set(k, e); }
        return e;
    };
    effect(() => {
        const next = isSignal(source) ? source.value : source();
        const prev = current;
        current = next;
        untrack(() => {
            for (const [k, e] of keys) {
                if (!e.subs || !e.subs.size) { keys.delete(k); continue; }
                const was = equals(prev, k), now = equals(next, k);
                if (was !== now) { e._version = ++_epoch; _notify(e.subs); }
            }
        });
    }, 'selector');
    return (key) => {
        if (_tracking) _track(srcFor(key));
        return equals(current, key);
    };
}


// ============================================================================
// 12. PORTAL — Render to different DOM location
// ============================================================================

/**
 * Рендерит контент в другое место DOM (body, overlay-container, etc.)
 * При dispose scope — автоматически удаляет.
 *
 * @example
 *   portal(document.body, () => html`<div class="modal">${content}</div>`);
 */
export function portal(target, contentFn, popts = {}) {
    const container = document.createElement('div');
    container.setAttribute('data-aegis-portal', '');
    const usePop = popts.popover && 'popover' in container;   // top layer + light-dismiss без z-index-войн (Popover API, Baseline 2024)
    if (usePop) container.popover = popts.popover === true ? 'auto' : popts.popover;
    target.appendChild(container);
    const open = signal(true, 'portal:open');
    if (usePop) {
        if (popts.anchor && _ext.anchor) _ext.anchor(container, popts.anchor, { placement: popts.placement });
        container.addEventListener('toggle', (e) => { open.value = e.newState === 'open'; });
        try { container.showPopover(); } catch (e) { /* уже показан */ }
    }

    const scope = createScope();
    scope.run(() => {
        const content = typeof contentFn === 'function' ? contentFn() : contentFn;
        if (content instanceof DocumentFragment || content instanceof HTMLElement) {
            container.appendChild(content);
        }
    });

    const dispose = () => {
        scope.dispose();
        if (usePop) { try { container.hidePopover(); } catch (e) { /* */ } }
        container.remove();
    };

    if (_currentScope) _currentScope.onDispose(dispose);
    return { container, dispose, open };
}


// ============================================================================
// 13. TRANSITION — CSS animation helpers
//     Один контракт для transition()/show()/list()/animate():
//       .${name}-enter-from  .${name}-enter-active  .${name}-enter-to
//       .${name}-leave-from  .${name}-leave-active  .${name}-leave-to     (name по умолчанию 'aegis')
//     Reduced motion / defaults.motion = false → без классов, сразу.
// ============================================================================

const _parseDur = (v) => Math.max(...String(v).split(',').map(x => parseFloat(x) || 0)) * 1000;

/** Следующий кадр: requestAnimationFrame, но не позже 40 мс (скрытая вкладка/headless кадров не дают) */
function _frame(cb) {
    let done = false;
    const run = (t) => { if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(timer); cb(t ?? performance.now()); };
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : 0;
    const timer = setTimeout(run, 40);
    return () => { done = true; cancelAnimationFrame(raf); clearTimeout(timer); };
}

/**
 * Проиграть enter/leave по CSS-контракту. Promise → true (доиграл) | false (прерван новой фазой).
 * Двойной rAF вместо чтения offsetHeight (нет forced reflow); токен на элементе отменяет предыдущую фазу.
 * classes — переопределение { from, active, to } (legacy-опции transition()).
 */
function _runTransition(el, phase, name = 'aegis', classes, fallbackMs) {
    if (_motionOff()) return Promise.resolve(true);
    const from = (classes && classes.from) || `${name}-${phase}-from`;
    const active = (classes && classes.active) || `${name}-${phase}-active`;
    const to = (classes && classes.to) || `${name}-${phase}-to`;
    const token = (el._aegisT = (el._aegisT || 0) + 1);
    if (el._aegisCancel) el._aegisCancel();
    return new Promise((resolve) => {
        let done = false, timer = 0;
        const onEnd = (e) => { if (e.target === el) finish(true); };
        const finish = (ok) => {
            if (done) return;
            done = true;
            el.classList.remove(from, active, to);
            el.removeEventListener('transitionend', onEnd);
            el.removeEventListener('animationend', onEnd);
            clearTimeout(timer);
            if (el._aegisCancel === cancel) el._aegisCancel = null;
            resolve(ok);
        };
        const cancel = () => finish(false);
        el._aegisCancel = cancel;
        el.classList.add(from, active);
        if (fallbackMs) timer = setTimeout(() => finish(true), fallbackMs);   // явная длительность — от начала фазы
        _frame(() => _frame(() => {
            if (token !== el._aegisT || done) return;
            el.classList.remove(from);
            el.classList.add(to);
            if (fallbackMs) return;
            const cs = getComputedStyle(el);
            const dur = Math.max(_parseDur(cs.transitionDuration) + _parseDur(cs.transitionDelay), _parseDur(cs.animationDuration) + _parseDur(cs.animationDelay));
            if (dur <= 0) { finish(true); return; }
            el.addEventListener('transitionend', onEnd);
            el.addEventListener('animationend', onEnd);
            timer = setTimeout(() => finish(true), dur + 100);
        }));
    });
}
/** show()/list() берут раннер отсюда: в бандл он попадает только вместе с transition() / animate() */
const _trTether = /* @__PURE__ */ _reg('runTransition', _runTransition, 'motionOff', _motionOff);

/**
 * Анимированный show/hide через CSS-контракт (быстрые переключения безопасны: leave прерывается enter'ом).
 *   transition(el, open);                        // классы .aegis-enter-… и .aegis-leave-… (injectStyles() даёт дефолт)
 *   transition(el, open, { name: 'fade' });      // .fade-enter-from … .fade-leave-to
 * Legacy-опции { enter, enterActive, leave, leaveActive, duration } продолжают работать.
 */
export function transition(el, condition, opts = {}, _t = _trTether) {
    const { name = 'aegis', duration } = opts;
    const enterCls = opts.enter || opts.enterActive ? { from: opts.enter, active: opts.enterActive } : null;
    const leaveCls = opts.leave || opts.leaveActive ? { from: opts.leave, active: opts.leaveActive } : null;
    let isFirst = true;
    return effect(() => {
        const visible = isSignal(condition) ? condition.value : typeof condition === 'function' ? condition() : condition;
        if (isFirst || _motionOff()) {
            isFirst = false;
            if (el._aegisCancel) el._aegisCancel();
            el.hidden = !visible;
            return;
        }
        if (visible) {
            el.hidden = false;
            _runTransition(el, 'enter', name, enterCls, duration);
        } else {
            _runTransition(el, 'leave', name, leaveCls, duration).then(ok => { if (ok) el.hidden = true; });
        }
    }, 'transition');
}


// ============================================================================
// 14. ERROR BOUNDARY — Catch errors in component trees
// ============================================================================

/**
 * Обёртка для безопасного рендера.
 * Если setup бросает ошибку — показывает fallback.
 *
 * @example
 *   errorBoundary(el, ctx => {
 *       // risky code
 *   }, (error, el) => {
 *       el.textContent = `Ошибка: ${error.message}`;
 *   });
 */
export function errorBoundary(el, setup, fallback) {
    const handle = (e) => {
        console.error('[Aegis] Error boundary caught:', e);
        if (typeof fallback === 'function') {
            fallback(e, el);
        } else {
            el.textContent = `[Error] ${e.message}`;
            el.style.color = '#f85149';
        }
    };
    try {
        const r = _component(el, (ctx) => { ctx.onError(handle); return setup(ctx); });
        return r && typeof r.then === 'function' ? r.catch(e => { handle(e); return undefined; }) : r;
    } catch (e) {
        handle(e);
    }
}


// ============================================================================
// 15. CONVENIENCE — mount helpers, ref
// ============================================================================

/**
 * Ссылка на DOM-элемент. Устанавливается при mount.
 *
 * @example
 *   const inputRef = ref();
 *   html`<input ${inputRef}>`;
 *   effect(() => inputRef.el?.focus());
 */
export function ref() {
    const r = {
        el: null,
        /** Callback для установки — вызывается движком */
        _set(el) { r.el = el; },
    };
    if (_currentScope) {
        _currentScope.onDispose(() => { r.el = null; });
    }
    return r;
}

/**
 * Рендер html`` в контейнер.
 * dispose previous components/effects before clearing
 */
const _renderScopes = new WeakMap();

export function render(container, templateResult) {
    const prev = _renderScopes.get(container);
    if (prev) prev.dispose();
    destroyAll(container);
    container.replaceChildren();

    const scope = createScope();
    _renderScopes.set(container, scope);
    scope.run(() => {
        if (templateResult instanceof DocumentFragment) {
            container.appendChild(templateResult);
        } else if (templateResult instanceof HTMLElement) {
            container.appendChild(templateResult);
        }
    });
}

/**
 * $ — быстрый querySelector внутри элемента
 */
export function $(selector, root = document) {
    return root.querySelector(selector);
}

export function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
}


// ============================================================================
// 16. REACTIVE OBJECT — Deep reactive proxy (как Vue reactive())
// ============================================================================

const _REACTIVE = Symbol('aegis.reactive');

const _ARRAY_MUTATORS = new Set([
    'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
]);

/** Обернуть вложенное значение (объект или массив) в reactive */
function _wrapReactive(v) {
    if (v === null || typeof v !== 'object' || v[_REACTIVE]) return v;
    if (Array.isArray(v) || _isPlain(v)) return reactive(v, undefined, true);
    return v;   // Date, Map, Set, File, DOM-узлы — не оборачиваем
}

/** Снять proxy: хранить в массивах сырые значения, чтобы $raw был живым */
function _unwrapReactive(v) {
    return (v !== null && typeof v === 'object' && v[_REACTIVE]) ? v.$raw : v;
}

/**
 * Глубоко-реактивный объект. Каждое свойство — signal под капотом.
 * Мутации (obj.x = v) автоматически триггерят effects.
 * Массивы реактивны целиком: push/splice/sort, запись по индексу, length.
 * Добавление и удаление ключей тоже отслеживается (`in`, Object.keys, for...in).
 * Идеально для форм, вложенных конфигов, таблиц.
 *
 * @example
 *   const state = reactive({ name: '', items: [], address: { city: '' } });
 *   effect(() => console.log(state.name));          // auto-track
 *   state.name = 'John';                             // triggers effect
 *   state.address.city = 'Almaty';                   // глубокая реактивность
 *   state.items.push({ id: 1 });                     // массивы тоже
 *   state.items[0].done = true;                      // и их элементы
 */
export function reactive(obj, ropts, _nested, _t = _reactiveTether) {
    if (obj === null || typeof obj !== 'object' || obj[_REACTIVE]) return obj;
    if (!ropts) { const m = _metas.get(obj); if (m) return m.proxy; }   // один объект = один proxy
    return Array.isArray(obj) ? _reactiveArray(obj) : _reactiveObject(obj, ropts, _nested);
}

// raw → meta. Сигнал ключа создаётся при первом чтении под tracking (или записи в уже созданный); один модульный handler на все
// объекты, никаких замыканий на объект; цель Proxy — сам объект, поэтому $raw всегда живой. Все словари — {} (быстрые hidden
// classes, общие для строк одной формы), а не Object.create(null): ключи проверяются через hasOwn.
const _metas = new WeakMap();
const KIND_DATA = 1, KIND_ACCESSOR = 2, KIND_METHOD = 3;
const _hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Мелкий снимок собственного target при первой записи в ЭТОТ объект/массив — без всплытия и без клонирования поддерева */
function _capture(m, target) {
    if (m.captured) return;
    m.captured = true;
    if (Array.isArray(target)) { m.initial = target.slice(); return; }
    const init = {};
    for (const k of Object.keys(target)) { const d = Object.getOwnPropertyDescriptor(target, k); if (d && 'value' in d && typeof d.value !== 'function') init[k] = d.value; }
    m.initial = init;
}
/** Рекурсивное восстановление: свой снимок (если был), затем вложенные reactive со снимками — identity вложенных сохраняется */
function _restore(target, m) {
    if (m.captured) {
        const init = m.initial;
        if (Array.isArray(target)) { target.length = 0; for (let i = 0; i < init.length; i++) target.push(init[i]); m.version.value++; }
        else {
            for (const k of Object.keys(target)) if (_kindOf(m, target, k) === KIND_DATA && !_hasOwn(init, k)) delete m.proxy[k];
            for (const k of Object.keys(init)) m.proxy[k] = init[k];                    // через proxy → сигналы ключей уведомляются
        }
    }
    for (const k of Object.keys(target)) {
        const v = target[k];
        if (v === null || typeof v !== 'object') continue;
        const cm = _metas.get(v);
        if (cm) _restore(v, cm);               // спуск и без своего снимка: снимок может быть у элемента глубже
    }
}
function _classify(m, target, key) {
    const d = Object.getOwnPropertyDescriptor(target, key);
    const kinds = m.kinds || (m.kinds = {});
    if (d.get || d.set) { (m.accessors || (m.accessors = {}))[key] = d; return kinds[key] = KIND_ACCESSOR; }
    return kinds[key] = typeof d.value === 'function' ? KIND_METHOD : KIND_DATA;
}
const _kindOf = (m, target, key) => (m.kinds && _hasOwn(m.kinds, key) && m.kinds[key]) || _classify(m, target, key);
const _keysOf = (m) => m.keys || (m.keys = signal(0, 'reactive:keys'));
const _wrapFor = (m, v) => m.shallow ? v : _wrapReactive(v);
const _sigOf = (m, target, key, create) => {
    const sigs = m.signals;
    let sg = sigs && _hasOwn(sigs, key) ? sigs[key] : null;
    if (!sg && create) sg = (sigs || (m.signals = {}))[key] = signal(_wrapFor(m, target[key]), (!globalThis.AEGIS_PROD && _dev()) ? 'reactive:' + key : key);
    return sg;
};
function _reactiveJSON(target, m) {
    const result = {};
    for (const k of Object.keys(target)) {
        if (_kindOf(m, target, k) !== KIND_DATA) continue;
        const sg = _sigOf(m, target, k, false);
        const v = sg ? sg.peek() : target[k];
        result[k] = v && v[_REACTIVE] ? v.toJSON() : v;
    }
    return result;
}
function _deepRead(v, depth = 0) {
    if (depth > 20 || v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.length; for (let i = 0; i < v.length; i++) _deepRead(v[i], depth + 1); return; }
    for (const k of Object.keys(v)) _deepRead(v[k], depth + 1);
}
const _OBJ_SPECIALS = {
    $raw: (t) => t,
    $signals: (t, m) => { for (const k of Object.keys(t)) if (_kindOf(m, t, k) === KIND_DATA) _sigOf(m, t, k, true); return m.signals || (m.signals = {}); },
    $snapshot: (t, m) => () => _reactiveJSON(t, m),
    $patch: (t, m) => (patch) => batch(() => { for (const [k, v] of Object.entries(patch)) m.proxy[k] = v; }),
    $subscribe: (t, m) => (fn) => effect(() => { _deepRead(m.proxy); untrack(() => fn(_reactiveJSON(t, m))); }, 'reactive:$subscribe'),
    $reset: (t, m) => () => batch(() => _restore(t, m)),
};

// Ловушки с явной meta: общий handler берёт её из _metas, вариант с опциями (shallow/signals) — из замыкания
const _objTraps = {
    get(m, target, key) {
        if (typeof key === 'string' && _DENIED_KEYS.has(key)) return undefined;
        if (key === _REACTIVE) return true;
        if (key === 'toJSON') return () => _reactiveJSON(target, m);
        if (typeof key === 'string' && key[0] === '$' && _hasOwn(_OBJ_SPECIALS, key)) return _OBJ_SPECIALS[key](target, m);
        if (!_hasOwn(target, key)) {
            // toString/valueOf/Symbol.toPrimitive — от обычного объекта, иначе String(proxy) падает
            if (typeof key === 'symbol' || key in target) return Reflect.get(target, key);
            if (_tracking) _keysOf(m).value;   // чтение отсутствующего ключа подписывает на его появление
            return undefined;
        }
        const kind = _kindOf(m, target, key);
        if (kind === KIND_DATA) {
            const sg = _sigOf(m, target, key, !!_tracking);
            return sg ? sg.value : _wrapFor(m, target[key]);
        }
        if (kind === KIND_ACCESSOR) {
            const c = m.computeds || (m.computeds = {});
            if (!_hasOwn(c, key)) { const get = m.accessors[key].get; c[key] = get ? computed(() => get.call(m.proxy), 'reactive:' + key) : null; }
            return c[key] ? c[key].value : undefined;
        }
        const b = m.bound || (m.bound = {});
        return _hasOwn(b, key) ? b[key] : (b[key] = (...args) => batch(() => target[key].apply(m.proxy, args)));   // action: this = proxy, один flush
    },
    set(m, target, key, value) {
        // Prototype pollution defense
        if (typeof key === 'string' && _DENIED_KEYS.has(key)) {
            _warn('S001', !globalThis.AEGIS_PROD && {
                what: `Attempted to set "${key}" on reactive object — blocked.`,
                why: 'Prototype pollution via __proto__/constructor/prototype is a known XSS vector (CVE-2024-6783).',
                fix: 'Use a regular property name instead.',
            });
            return true; // silently reject
        }
        const isNew = !_hasOwn(target, key);
        if (!isNew && _kindOf(m, target, key) === KIND_ACCESSOR) {
            const set = m.accessors[key].set;
            if (set) set.call(m.proxy, value);
            return true;
        }
        _capture(m, target);   // снимок до первой записи в этот объект
        const raw = _unwrapReactive(value);
        target[key] = raw;
        if (isNew) {
            if (m.kinds) m.kinds[key] = typeof raw === 'function' ? KIND_METHOD : KIND_DATA;
            if (m.keys) m.keys.value++;
        } else {
            if (m.kinds && (typeof raw === 'function') !== (m.kinds[key] === KIND_METHOD)) { delete m.kinds[key]; if (m.bound) delete m.bound[key]; }
            const sg = _sigOf(m, target, key, false);
            if (sg) sg.value = _wrapFor(m, raw);
        }
        return true;
    },
    deleteProperty(m, target, key) {
        if (!_hasOwn(target, key)) return true;
        _capture(m, target);
        delete target[key];
        if (m.signals) delete m.signals[key];
        if (m.kinds) delete m.kinds[key];
        if (m.bound) delete m.bound[key];
        if (m.keys) m.keys.value++;
        return true;
    },
    has(m, target, key) {
        if (typeof key === 'string' && _DENIED_KEYS.has(key)) return false;
        if (key === _REACTIVE || key === 'toJSON' || (typeof key === 'string' && key[0] === '$' && _hasOwn(_OBJ_SPECIALS, key))) return true;
        if (_tracking) _keysOf(m).value;
        return _hasOwn(target, key);
    },
    ownKeys(m, target) {
        if (_tracking) _keysOf(m).value;
        return Reflect.ownKeys(target).filter(k => typeof k === 'symbol' || _kindOf(m, target, k) !== KIND_METHOD);
    },
    getOwnPropertyDescriptor(m, target, key) {
        if (!_hasOwn(target, key) || _kindOf(m, target, key) === KIND_METHOD) return undefined;
        return Reflect.getOwnPropertyDescriptor(target, key);
    },
};
const _OBJ_HANDLER = {
    get: (t, k) => _objTraps.get(_metas.get(t), t, k),
    set: (t, k, v) => _objTraps.set(_metas.get(t), t, k, v),
    deleteProperty: (t, k) => _objTraps.deleteProperty(_metas.get(t), t, k),
    has: (t, k) => _objTraps.has(_metas.get(t), t, k),
    ownKeys: (t) => _objTraps.ownKeys(_metas.get(t), t),
    getOwnPropertyDescriptor: (t, k) => _objTraps.getOwnPropertyDescriptor(_metas.get(t), t, k),
    defineProperty: (t, k, d) => (typeof k === 'string' && _DENIED_KEYS.has(k)) ? false : Reflect.defineProperty(t, k, d),
};
const _boundHandler = (m) => ({
    get: (t, k) => _objTraps.get(m, t, k),
    set: (t, k, v) => _objTraps.set(m, t, k, v),
    deleteProperty: (t, k) => _objTraps.deleteProperty(m, t, k),
    has: (t, k) => _objTraps.has(m, t, k),
    ownKeys: (t) => _objTraps.ownKeys(m, t),
    getOwnPropertyDescriptor: (t, k) => _objTraps.getOwnPropertyDescriptor(m, t, k),
    defineProperty: (t, k, d) => (typeof k === 'string' && _DENIED_KEYS.has(k)) ? false : Reflect.defineProperty(t, k, d),
});

/** @param {{ shallow?: boolean, signals?: Object }} [ropts] — с опциями proxy не кэшируется (store, props custom element) */
function _reactiveObject(obj, ropts, nested = false) {
    const m = { proxy: null, shallow: !!(ropts && ropts.shallow), kinds: null, signals: (ropts && ropts.signals) || null, keys: null, initial: null, captured: false, accessors: null, computeds: null, bound: null };
    // снимок для $reset — лениво, при первой записи в каждый объект (мелкий, без structuredClone дерева): reactive(await res.json()) стоит 0
    if (ropts) return m.proxy = new Proxy(obj, _boundHandler(m));
    _metas.set(obj, m);
    return m.proxy = new Proxy(obj, _OBJ_HANDLER);
}

/**
 * Реактивный массив: одна версия на весь массив.
 * Любое чтение (индекс, length, итерация, map/filter) подписывает на версию — один _track на вызов метода,
 * любая мутация (push/splice/sort, запись по индексу, length) её поднимает.
 * Элементы-объекты оборачиваются лениво; результаты filter/slice/toSorted/… — реактивные массивы над сырыми элементами.
 */
const _ARR_PROTO = Array.prototype;
const _rawOf = (self) => self[_REACTIVE] ? self.$raw : self;
const _trackArr = (t) => { const m = _metas.get(t); if (m) m.version.value; };
function _buildArrayInstr() {
const _ARR_INSTR = Object.create(null);
for (const k of ['map', 'filter', 'forEach', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'flatMap']) {
    _ARR_INSTR[k] = function (cb, thisArg) {
        const t = _rawOf(this); _trackArr(t);
        const r = _ARR_PROTO[k].call(t, (v, i) => cb.call(thisArg, _wrapReactive(v), i, this));
        return (k === 'filter' || k === 'find') ? _wrapReactive(r) : r;   // map/flatMap — значения пользователя, как есть
    };
}
for (const k of ['reduce', 'reduceRight']) {
    _ARR_INSTR[k] = function (cb, ...rest) {
        const t = _rawOf(this); _trackArr(t);
        return _ARR_PROTO[k].call(t, (acc, v, i) => cb(acc, _wrapReactive(v), i, this), ...rest);
    };
}
for (const k of ['includes', 'indexOf', 'lastIndexOf']) {
    _ARR_INSTR[k] = function (v, ...rest) { const t = _rawOf(this); _trackArr(t); return _ARR_PROTO[k].call(t, _unwrapReactive(v), ...rest); };
}
for (const k of ['slice', 'concat', 'flat', 'toSorted', 'toReversed', 'toSpliced', 'with']) {
    if (!_ARR_PROTO[k]) continue;
    _ARR_INSTR[k] = function (...args) { const t = _rawOf(this); _trackArr(t); return _wrapReactive(_ARR_PROTO[k].apply(t, args.map(_unwrapReactive))); };
}
for (const k of ['join', 'at', 'keys']) {
    _ARR_INSTR[k] = function (...args) { const t = _rawOf(this); _trackArr(t); const r = _ARR_PROTO[k].apply(t, args); return k === 'at' ? _wrapReactive(r) : r; };
}
_ARR_INSTR.values = _ARR_INSTR[Symbol.iterator] = function* () {
    const t = _rawOf(this); _trackArr(t);
    for (let i = 0; i < t.length; i++) yield _wrapReactive(t[i]);
};
_ARR_INSTR.entries = function* () {
    const t = _rawOf(this); _trackArr(t);
    for (let i = 0; i < t.length; i++) yield [i, _wrapReactive(t[i])];
};
_ARR_INSTR.toJSON = function () { return _rawOf(this).map(v => v && v[_REACTIVE] ? v.toJSON() : v); };
for (const k of _ARRAY_MUTATORS) {
    _ARR_INSTR[k] = function (...args) {
        const t = _rawOf(this);
        const m = _metas.get(t); if (m) _capture(m, t);
        const before = t.length;
        const r = _ARR_PROTO[k].apply(t, args.map(_unwrapReactive));
        if (m) {
            // дельта для list()/virtualScroll: мутатор знает, ЧТО изменилось — потребитель применяет splice за O(|Δ|) вместо диффа O(n)
            if (k === 'push') _logOp(m, before, 0, args.length);
            else if (k === 'pop') { if (before) _logOp(m, before - 1, 1, 0); }
            else if (k === 'shift') { if (before) _logOp(m, 0, 1, 0); }
            else if (k === 'unshift') _logOp(m, 0, 0, args.length);
            else if (k === 'splice') { const st = _normStart(args[0], before); const del = args.length > 1 ? Math.max(0, Math.min(args[1] | 0, before - st)) : before - st; _logOp(m, st, del, Math.max(0, args.length - 2)); }
            else _logOp(m, -1, 0, 0);   // sort/reverse/fill/copyWithin — сброс лога
            m.version.value++;
        }
        return r;
    };
}
return _ARR_INSTR;
}
const _ARR_INSTR = /* @__PURE__ */ _buildArrayInstr();

const _ARR_HANDLER = {
    get(target, key) {
        if (key === _REACTIVE) return true;
        if (key === '$raw') return target;
        const inst = _ARR_INSTR[key];
        if (inst && (typeof key === 'symbol' || key === 'toJSON' || _ARR_PROTO[key] === target[key])) return inst;
        _metas.get(target).version.value; // track любое чтение
        const v = target[key];
        return (typeof key === 'string' && v !== null && typeof v === 'object') ? _wrapReactive(v) : v;
    },
    defineProperty(target, key, desc) { if (typeof key === 'string' && _DENIED_KEYS.has(key)) return false; return Reflect.defineProperty(target, key, desc); },
    set(target, key, value) {
        if (typeof key === 'string' && _DENIED_KEYS.has(key)) return false;
        const raw = _unwrapReactive(value);
        if (Object.is(target[key], raw) && key in target) return true;
        const m = _metas.get(target); _capture(m, target);
        const wasLen = Array.isArray(target) ? target.length : -1;
        target[key] = raw;
        if (wasLen >= 0) {   // массив: запись по индексу — replace/append, length — сброс
            const idx = typeof key === 'string' && /^\d+$/.test(key) ? +key : -1;
            if (idx >= 0 && idx < wasLen) _logOp(m, idx, 1, 1); else if (idx === wasLen) _logOp(m, wasLen, 0, 1); else _logOp(m, -1, 0, 0);
        }
        m.version.value++;
        return true;
    },
    deleteProperty(target, key) {
        if (key in target) { const m = _metas.get(target); _capture(m, target); delete target[key]; m.version.value++; }
        return true;
    },
    has(target, key) {
        if (key === _REACTIVE) return true;
        _metas.get(target).version.value;
        return key in target;
    },
    ownKeys(target) {
        _metas.get(target).version.value;
        return Reflect.ownKeys(target);
    },
};

const _normStart = (st, len) => { st = st | 0; return st < 0 ? Math.max(0, len + st) : Math.min(st, len); };
/** Кольцевой splice-лог массива (64 записи): { v, i, del, ins }; i < 0 — сброс (sort/reverse/length) */
function _logOp(m, i, del, ins) {
    const L = m.log || (m.log = []);
    L.push({ v: m.version.peek() + 1, i, del, ins });
    if (L.length > 64) L.shift();
}
/** Дельта с версии since: { v, ops } — ops null = полная сверка (первый рендер, переполнение, сброс) */
function _arrayOps(arr, since) {
    const m = arr && arr[_REACTIVE] ? _metas.get(arr.$raw) : null;
    if (!m) return null;
    const v = m.version.peek();
    if (since < 0 || since === v) return { v, ops: since === v ? [] : null };
    const L = m.log;
    if (!L || !L.length || L[0].v > since + 1) return { v, ops: null };
    const out = [];
    for (const o of L) { if (o.v <= since) continue; if (o.i < 0) return { v, ops: null }; out.push(o); }
    return { v, ops: out };
}
function _reactiveArray(arr) {
    const m = { proxy: null, version: signal(0, 'reactive:array'), initial: null, captured: false, log: null };
    _metas.set(arr, m);
    return m.proxy = new Proxy(arr, _ARR_HANDLER);
}

/** list() берёт дельты массива отсюда: в бандл без reactive() лог не попадает */
const _reactiveTether = /* @__PURE__ */ _reg('arrayOps', _arrayOps);
/** Проверка: является ли объект reactive-прокси */
export function isReactive(v) {
    return v != null && v[_REACTIVE] === true;
}


// ============================================================================
// 17. FORM — Form state management with validation
// ============================================================================

/**
 * Управление формой: поля, валидация, dirty-tracking, submit.
 * Заменяет паттерн reactive(errors) + ручная валидация из KindWatch.
 *
 * @example
 *   const { fields, errors, dirty, valid, validate, submit, reset } = form({
 *       name:  { value: '', rules: [required, minLen(3)] },
 *       email: { value: '', rules: [required, emailRule] },
 *       phone: { value: '' },
 *   });
 *
 *   // fields.name — signal
 *   // errors.name — signal (строка ошибки или null)
 *   // dirty — signal<boolean>
 *   // valid — computed<boolean>
 *
 *   // Встроенные правила:
 *   import { required, minLen, maxLen, pattern, emailRule } from './aegis.js';
 */
// ---- Общее ядро форм -------------------------------------------------------------

/** 'items[0][qty]' | 'items.0.qty' | 'address.city' → ['items', '0', 'qty'] */
function _parsePath(name) {
    const segs = String(name).replace(/\]/g, '').split(/[.[]/).filter(Boolean);
    for (const sg of segs) if (_DENIED_KEYS.has(sg)) { _warn('S001', !globalThis.AEGIS_PROD && { what: `field path "${name}" contains "${sg}".`, why: 'Writing through __proto__ / constructor / prototype pollutes Object.prototype for the whole page.', fix: 'Rename the field.' }, 'path:' + sg); throw new TypeError('[Aegis] S001: denied key in path "' + name + '"'); }
    return segs;
}
const _normPath = (name) => _parsePath(name).join('.');

function _setPath(obj, segs, value) {
    let cur = obj;
    for (const sg of segs) if (_DENIED_KEYS.has(sg)) throw new TypeError('[Aegis] S001: denied key "' + sg + '"');
    for (let i = 0; i < segs.length - 1; i++) {
        const k = segs[i], nextIsIndex = /^\d+$/.test(segs[i + 1]);
        if (cur[k] == null) cur[k] = nextIsIndex ? [] : {};
        cur = cur[k];
    }
    cur[segs[segs.length - 1]] = value;
    return obj;
}

/** Вложенный объект значений: { items: [{ qty }], address: { city } } */
function _nestValues(fields) {
    const out = {};
    for (const key of Object.keys(fields)) _setPath(out, _parsePath(key), fields[key].peek());
    return out;
}

const _isStandardSchema = (v) => !!(v && typeof v === 'object' && v['~standard'] && typeof v['~standard'].validate === 'function');

/** Путь issue Standard Schema → нормализованная строка 'items.0.qty' */
function _issuePath(issue) {
    if (!issue || !issue.path || !issue.path.length) return null;
    return issue.path.map(p => (p && typeof p === 'object' && 'key' in p) ? String(p.key) : String(p)).join('.');
}

const _sameValue = (a, b) => Object.is(a, b)
    || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));

/** Элемент массива правил может быть Standard Schema — оборачиваем в правило (первый issue.message; async-схема → async-правило) */
const _asRule = (r) => !_isStandardSchema(r) ? r : (v) => {
    const pick = (x) => x && x.issues && x.issues.length ? x.issues[0].message : null;
    const res = r['~standard'].validate(v);
    return res && typeof res.then === 'function' ? res.then(pick) : pick(res);
};

/**
 * Валидатор для form()/wireForm(). Два слоя:
 *   issues[key] — computed «истина»: sync-правила + issues Standard Schema по пути поля, пересчитываются от значений (и от локали сообщений);
 *   errors[key] — сигнал «показа» (то, что видит пользователь: правило по режиму, серверная ошибка, setErrors).
 * valid = нет issues, нет async-ошибок, нет показанных ошибок, нет $form. Правило: (value, key, fields, { signal, live }) => string | null | Promise.
 */
function _makeValidator({ fields, errors, rules, touched, asyncDebounce = 0, schema, keyOf, shape }) {
    const keys = () => { if (shape) shape.value; return Object.keys(fields); };   // shape: форма растёт — computed пересчитываются
    const validating = {}, asyncErr = {}, issues = {}, shownFrom = {}, shownEff = {};
    validating.$any = computed(() => keys().some(k => validating[k].value), 'form:validating');
    // Standard Schema: один прогон на изменение любого поля (computed мемоизирует), issues раздаются по полям, value → parsed
    const schemaRes = schema ? computed(() => {
        for (const k of keys()) fields[k].value;
        const r = schema['~standard'].validate(_nestValues(fields));
        return r && typeof r.then === 'function' ? null : (r || { issues: [] });
    }, 'form:schema') : null;
    const asyncParsed = signal(undefined, 'form:parsed:async');
    const parsed = computed(() => {
        if (asyncParsed.value !== undefined) return asyncParsed.value;
        const r = schemaRes ? schemaRes.value : null;
        return r && !(r.issues && r.issues.length) && 'value' in r ? r.value : null;
    }, 'form:parsed');
    const schemaIssueFor = (key) => {
        const r = schemaRes ? schemaRes.value : null;
        if (!r || !r.issues) return null;
        for (const issue of r.issues) { const p = _issuePath(issue); if (p && keyOf(p) === key) return issue.message; }
        return null;
    };
    const makeIssue = (key) => computed(() => {
        const val = fields[key].value;
        for (const r of rules[key] || []) {
            if (r._async || (r.constructor && r.constructor.name === 'AsyncFunction')) continue;   // async — только в validateField
            const m = r(val, key, fields, { signal: null, live: true });
            if (m && typeof m.then === 'function') { r._async = true; continue; }
            if (m) return m;
        }
        return schemaIssueFor(key);
    }, `form:${key}:issue`);
    const track = (key) => {
        validating[key] = signal(false, `form:${key}:validating`); asyncErr[key] = signal(null, `form:${key}:asyncError`);
        rules[key] = (rules[key] || []).map(_asRule);
        issues[key] = makeIssue(key);
    };
    for (const key of Object.keys(fields)) track(key);
    issues.$any = computed(() => keys().some(k => issues[k].value), 'form:issues');
    issues.$form = computed(() => {
        const r = schemaRes ? schemaRes.value : null;
        if (!r || !r.issues) return null;
        for (const issue of r.issues) { const p = _issuePath(issue); if (!p || !keyOf(p)) return issue.message; }
        return null;
    }, 'form:issues:$form');
    const valid = computed(() => !errors.$form.value && !issues.$any.value && !issues.$form.value && keys().every(k => !asyncErr[k].value && !errors[k].value), 'form:valid');

    const versions = {}, controllers = {}, timers = {};
    let pendingAsync = new Map();
    const show = (key, msg, from) => { errors[key].value = msg; shownFrom[key] = msg ? from : null; };
    const runAsync = (key, rest, val) => {
        const ver = versions[key] = (versions[key] || 0) + 1;
        if (controllers[key]) controllers[key].abort();
        const c = controllers[key] = new AbortController();
        validating[key].value = true;
        const p = (async () => {
            try {
                if (asyncDebounce > 0) await new Promise((r, j) => { timers[key] = setTimeout(r, asyncDebounce); c.signal.addEventListener('abort', () => { clearTimeout(timers[key]); j(new DOMException('aborted', 'AbortError')); }); });
                for (const rule of rest) {
                    const msg = await rule(val, key, fields, { signal: c.signal, live: false });
                    if (versions[key] !== ver) return null;
                    if (msg) { asyncErr[key].value = msg; show(key, msg, 'rule'); return false; }
                }
                if (versions[key] === ver) { asyncErr[key].value = null; if (shownFrom[key] === 'rule') show(key, null); }
                return true;
            } catch (e) {
                if (e && e.name === 'AbortError') return null;
                if (versions[key] === ver) { const msg = e && e.message ? e.message : String(e); asyncErr[key].value = msg; show(key, msg, 'rule'); }
                return false;
            } finally {
                if (versions[key] === ver) { validating[key].value = false; controllers[key] = null; }
                if (pendingAsync.get(key) === p) pendingAsync.delete(key);
            }
        })();
        pendingAsync.set(key, p);
        return p;
    };

    /** Показать истину поля: sync-issue → errors[key]; async-правила — в фоне (validating[key]) */
    const validateField = (key) => {
        const val = fields[key].peek();
        const list = rules[key] || [];
        const sync = issues[key].peek();
        if (sync) { show(key, sync, 'rule'); if (controllers[key]) controllers[key].abort(); asyncErr[key].value = null; return false; }
        for (let i = 0; i < list.length; i++) {
            const r = list[i](val, key, fields, { signal: null, live: false });
            if (r && typeof r.then === 'function') { runAsync(key, [() => r].concat(list.slice(i + 1)), val); if (shownFrom[key] === 'rule' && !asyncErr[key].peek()) show(key, null); return true; }
        }
        asyncErr[key].value = null;
        show(key, null);
        return true;
    };

    /** Standard Schema (zod/valibot/arktype): полный прогон (async тоже) → показ по полям / $form; boolean | Promise<boolean> */
    const runSchema = (values) => {
        if (!schema) return true;
        const apply = (result) => {
            const list = result && result.issues;
            const seen = new Set();
            asyncParsed.value = (!list || !list.length) && result && 'value' in result ? result.value : (list && list.length ? null : undefined);
            batch(() => {
                if (!list || !list.length) return;
                for (const issue of list) {
                    const p = _issuePath(issue);
                    const key = p ? keyOf(p) : null;
                    if (key && fields[key]) { if (seen.has(key)) continue; seen.add(key); show(key, issue.message, 'rule'); }
                    else if (errors.$form) errors.$form.value = errors.$form.peek() || issue.message;
                }
            });
            return !list || !list.length;
        };
        const res = schema['~standard'].validate(values);
        return res && typeof res.then === 'function' ? res.then(apply) : apply(res);
    };

    const validateAll = (subset) => { let ok = true; for (const key of subset || keys()) if (!validateField(key)) ok = false; if (schema && !subset) { const f = issues.$form.peek(); if (f) { errors.$form.value = f; ok = false; } } return ok; };
    /** subset — только эти ключи (шаг мастера): schema-issues чужих полей не показываются */
    const validateAsync = async (subset) => {
        let ok = validateAll(subset);
        if (!subset) { const sr = runSchema(_nestValues(fields)); if ((sr && typeof sr.then === 'function' ? await sr : sr) === false) ok = false; }
        else if (schema) { const r = schema['~standard'].validate(_nestValues(fields)); const res = r && typeof r.then === 'function' ? await r : r; for (const issue of (res && res.issues) || []) { const p = _issuePath(issue), k = p ? keyOf(p) : null; if (k && subset.includes(k)) { show(k, issue.message, 'rule'); ok = false; } } }
        const results = await Promise.all([...pendingAsync.entries()].filter(([k]) => !subset || subset.includes(k)).map(([, p]) => p));
        if (results.some(r => r === false)) ok = false;
        return ok && !(subset || keys()).some(k => errors[k] && errors[k].peek());
    };
    const abortAll = () => { for (const k in controllers) if (controllers[k]) controllers[k].abort(); };
    /** Политика показа: ошибка правила исчезает, как только истина стала null (reward early), и обновляет текст при смене локали/значения */
    const watchShown = (key) => effect(() => {
        const i = issues[key].value;
        const shown = errors[key].peek();
        if (shownFrom[key] !== 'rule' || !shown || validating[key].peek()) return;
        if (i === null) { if (!asyncErr[key].peek()) show(key, null); }
        else if (i !== shown) show(key, i, 'rule');
    }, `form:${key}:show`);
    for (const key of Object.keys(fields)) shownEff[key] = watchShown(key);
    const markServer = (key) => { if (errors[key] && errors[key].peek()) shownFrom[key] = 'server'; };
    const clearServer = (key) => { if (shownFrom[key] === 'server') show(key, null); };
    /** форма растёт: подключить/отключить/переименовать поле в валидаторе */
    const addField = (key) => { if (validating[key]) return; track(key); shownEff[key] = watchShown(key); };
    const removeField = (key) => {
        if (controllers[key]) { controllers[key].abort(); controllers[key] = null; }
        if (shownEff[key]) { shownEff[key](); delete shownEff[key]; }
        for (const m of [validating, asyncErr, issues, shownFrom, versions, timers]) delete m[key];
        pendingAsync.delete(key);
    };
    const renameField = (from, to) => {
        for (const m of [validating, asyncErr, shownFrom, versions, controllers, timers, rules]) if (from in m) { m[to] = m[from]; delete m[from]; }
        if (shownEff[from]) { shownEff[from](); delete shownEff[from]; }
        issues[to] = makeIssue(to); delete issues[from];
        shownEff[to] = watchShown(to);
    };
    return { validating, issues, asyncErr, valid, parsed, validateField, validateAll, validateAsync, runSchema, abortAll, show, markServer, clearServer, shownFrom, addField, removeField, renameField };
}
/** Правила по ключу с поддержкой шаблонов: 'items[].qty' покрывает items[0][qty], items[1][qty] … */
function _rulesFor(key, rs) {
    if (!rs) return [];
    return rs[key] || rs[_normPath(key)] || rs[_normPath(key).replace(/\.\d+\./g, '[].').replace(/\.\d+$/, '[]')] || [];
}

/** Значение инпута для сигнала формы: radio (группа), checkbox, number/range, file, select multiple */
const _fmtDate = (d, type) => {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const l = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString();
    return type === 'datetime-local' ? l.slice(0, 16) : type === 'month' ? l.slice(0, 7) : type === 'time' ? l.slice(11, 16) : l.slice(0, 10);
};
function _readValue(input, formEl, T) {
    if (T === Date) return input.value === '' ? null : (input.type === 'datetime-local' || !input.valueAsDate ? new Date(input.value) : input.valueAsDate);
    if (T === Number) return input.value === '' ? null : (isNaN(input.valueAsNumber) ? Number(input.value) : input.valueAsNumber);
    if (T === Array) return String(input.value).split(',').map(x => x.trim()).filter(Boolean);
    if (T === Boolean) return input.type === 'checkbox' ? input.checked : input.value === 'true' || input.value === '1' || input.value === 'on';
    if (input.type === 'radio') { const root = formEl || input.form || document; const c = root.querySelector(`[name="${CSS.escape(input.name)}"]:checked`); return c ? c.value : ''; }
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number' || input.type === 'range') return input.value === '' ? null : Number(input.value);
    if (input.type === 'file') return input.multiple ? [...input.files] : (input.files[0] || null);
    if (input.tagName === 'SELECT' && input.multiple) return [...input.selectedOptions].map(o => o.value);
    return input.value;
}
/** aria-describedby как множество токенов: подсказка автора остаётся, id ошибки добавляется/убирается */
function _describe(el, id, onOff) {
    const set = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    onOff ? set.add(id) : set.delete(id);
    if (set.size) el.setAttribute('aria-describedby', [...set].join(' ')); else el.removeAttribute('aria-describedby');
}
/** Хозяин ошибки для группы radio/checkbox — fieldset (ошибка после legend), иначе сам input */
function _groupOf(input, key, root) {
    const all = root && root.querySelectorAll ? [...root.querySelectorAll(`[name="${CSS.escape(key)}"]`)] : [input];
    const fs = all.length > 1 ? input.closest('fieldset') : null;
    return { all: all.length ? all : [input], host: fs || input, fieldset: fs };
}
/** Контейнер текста ошибки: #key-error | [data-error-for] | .error рядом | создаётся span (описание поля, не live-регион); aria-describedby дописывается */
function _errorElFor(input, key, root, live) {
    const g = _groupOf(input, key, root);
    let errorEl = (root && root.querySelector && root.querySelector(`#${CSS.escape(key + '-error')}, [data-error-for="${CSS.escape(key)}"]`)) || (g.fieldset || input.parentElement)?.querySelector('.error, .field-error, [data-error]');
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = `${key.replace(/[^\w-]/g, '_')}-error`;
        errorEl.className = 'aegis-field-error';
        if (live) errorEl.setAttribute('role', 'status');
        if (g.fieldset) { const legend = g.fieldset.querySelector('legend'); legend ? legend.insertAdjacentElement('afterend', errorEl) : g.fieldset.prepend(errorEl); }
        else input.parentNode?.insertBefore(errorEl, input.nextSibling);
        const created = errorEl;
        if (_currentScope) _currentScope.onDispose(() => created.remove());
    }
    _describe(g.host, errorEl.id, true);
    return errorEl;
}
/** ValidityState → код сообщения и параметры (сообщения на языке страницы, а не браузера) */
const _VALIDITY = [['valueMissing', 'required'], ['tooShort', 'minLen', i => ({ n: i.minLength })], ['tooLong', 'maxLen', i => ({ n: i.maxLength })], ['patternMismatch', 'pattern'], ['typeMismatch', i => i.type === 'email' ? 'email' : 'url'], ['rangeUnderflow', 'min', i => ({ n: i.min })], ['rangeOverflow', 'max', i => ({ n: i.max })], ['stepMismatch', 'step', i => ({ n: i.step })], ['badInput', 'badInput']];
/**
 * Один per-input слой для form() и wireForm(): two-way (radio/checkbox/file/select multiple/text), DOM → signal по режиму показа,
 * blur → touched, контейнер ошибки, aria-invalid / aria-describedby, setCustomValidity (:user-invalid совпадает с UI). Возвращает dispose.
 * C: { fields, errors, touched, mode, native, validateField, formEl, submitCount, extra }
 */
function _wireInput(input, key, C) {
    const { fields, errors, touched, mode } = C;
    const own = new Scope(_currentScope, `field:${key}`);
    own.run(() => {
        const formEl = C.formEl || input.form || null;
        if (C.extra) {                                                          // второй radio той же группы
            on(input, 'input', () => { if (input.checked) fields[key].value = input.value; });
            effect(() => { input.checked = (input.value === String(fields[key].value)); }, `form:${key}`);
            return;
        }
        if (input.type === 'radio') effect(() => { input.checked = (input.value === String(fields[key].value)); }, `form:${key}`);
        else if (input.type === 'checkbox') effect(() => { input.checked = !!fields[key].value; }, `form:${key}`);
        else if (input.type === 'file') { /* файлы — только DOM → signal */ }
        else if (input.tagName === 'SELECT' && input.multiple) effect(() => { const v = fields[key].value; for (const opt of input.options) opt.selected = Array.isArray(v) && v.includes(opt.value); }, `form:${key}`);
        else {
            const T = C.types && C.types[key];
            effect(() => { const v = fields[key].value; if (document.activeElement !== input) input.value = T === Date ? _fmtDate(v, input.type) : (T === Array && Array.isArray(v)) ? v.join(', ') : (v ?? ''); }, `form:${key}`);
        }
        const onInput = () => {
            fields[key].value = _readValue(input, formEl, C.types && C.types[key]);
            const shown = touched[key].peek() && errors[key].peek();
            if (mode === 'live' || (shown && (mode === 'blur-then-live' || (C.submitCount && C.submitCount.peek() > 0)))) C.validateField(key);
        };
        on(input, 'input', onInput);
        if (input.type === 'file' || input.type === 'checkbox' || input.type === 'radio' || input.tagName === 'SELECT') on(input, 'change', onInput);
        on(input, 'blur', () => {
            touched[key].value = true;
            if (mode === 'submit') return;
            const was = errors[key].peek(); C.validateField(key); const now = errors[key].peek();
            if (a11y.field !== 'off' && a11y.field !== 'live' && now && now !== was && typeof announce === 'function') announce(_labelOf(input) + ': ' + now);   // одно поле — одно объявление
        });
        const a11y = C.a11y || {};
        let errorEl = _errorElFor(input, key, formEl, a11y.field === 'live');
        effect(() => {
            const err = errors[key].value;
            const g = _groupOf(input, key, formEl);
            if (err && (!errorEl.isConnected || !(g.host.getAttribute('aria-describedby') || '').split(/\s+/).includes(errorEl.id))) errorEl = _errorElFor(input, key, formEl, a11y.field === 'live');   // после morph — заново
            _describe(g.host, errorEl.id, !!err);                                                    // id ошибки в describedby только пока ошибка показана; подсказка автора остаётся
            for (const i of g.all) {                                                     // ARIA: invalid/errormessage только при ошибке, на всех кнопках группы
                if (err) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-errormessage', errorEl.id); }
                else { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-errormessage'); }
                if (C.native !== false && typeof i.setCustomValidity === 'function') i.setCustomValidity(err || '');   // мост с Constraint Validation API
            }
            errorEl.textContent = err || '';
            errorEl.hidden = !err;
        }, `form:${key}:a11y`);
    });
    return () => own.dispose();
}
/** Видимое имя поля для объявлений: <label> | aria-label | name */
const _labelOf = (input) => (input.labels && input.labels[0] && input.labels[0].textContent.replace(/\s+/g, ' ').trim()) || input.getAttribute('aria-label') || input.name;
/** Фокус на первую показанную ошибку (или на сводку); одно объявление «N ошибок. Поле: текст» вместо хора */
function _focusFirstError(formEl, inputs, errors, o = {}) {
    const bad = inputs ? Object.keys(inputs).filter(k => errors[k] && errors[k].peek()) : [];
    const first = bad.length ? inputs[bad[0]] : ((formEl && formEl.querySelector && formEl.querySelector('[aria-invalid="true"]')) || null);
    const smooth = typeof _motionOff === 'function' && _motionOff() ? 'auto' : 'smooth';
    if (o.announce !== false && bad.length && typeof announce === 'function') announce(_fmsg('formErrors', { n: bad.length }) + (first ? '. ' + _labelOf(first) + ': ' + errors[bad[0]].peek() : ''), 'assertive');
    const target = o.summaryEl && o.focusOnError !== 'field' ? o.summaryEl : first;
    if (target) { target.focus(); target.scrollIntoView?.({ behavior: smooth, block: 'center' }); }
    return !!target;
}
/** Сводка ошибок (GOV.UK): role=alert, заголовок, ссылки на поля; обновляется реактивно */
function _errorSummary(box, formEl, fields, errors, inputs, o = {}) {
    box.setAttribute('role', 'alert'); box.tabIndex = -1; if (!box.className) box.className = 'aegis-error-summary';
    effect(() => {
        const items = Object.keys(fields).filter(k => errors[k] && errors[k].value).map(k => ({ k, msg: errors[k].value, el: inputs[k] }));
        const form = errors.$form.value;
        box.hidden = !items.length && !form;
        box.replaceChildren();
        if (box.hidden) return;
        const h = document.createElement(o.heading || 'h2');
        h.textContent = form || _fmsg('formErrors', { n: items.length });
        box.append(h);
        if (items.length) {
            const ul = document.createElement('ul');
            for (const it of items) {
                const a = document.createElement('a');
                if (it.el) { if (!it.el.id) it.el.id = 'f-' + it.k.replace(/[^\w-]/g, '_'); a.href = '#' + it.el.id; }
                a.textContent = (it.el ? _labelOf(it.el) + ': ' : '') + it.msg;
                a.addEventListener('click', (e) => { e.preventDefault(); if (it.el) { it.el.focus(); it.el.scrollIntoView?.({ block: 'center' }); } });
                const li = document.createElement('li'); li.append(a); ul.append(li);
            }
            box.append(ul);
        }
    }, 'form:summary');
    return box;
}
/** Жизненный цикл отправки: status-машина, AbortSignal, submitter (aria-disabled + data-pending, фокус не теряется), ошибки статусов */
function _submitLifecycle({ status, errors, setErrors, submitError, submitCount, announceFn }) {
    let ctl = null;
    const abort = () => { if (ctl) ctl.abort(); };
    const applyError = (err) => {
        const data = err && (err.data || err);
        if (data && data.errors) { setErrors(data.errors); return; }
        const st = err && err.status;
        let msg = null;
        if (st === 429 || st === 503) { const ra = err.retryAfter ?? (err.response && err.response.headers && err.response.headers.get && err.response.headers.get('Retry-After')); msg = _fmsg('retryAfter', { s: ra != null && !isNaN(+ra) ? +ra : '' }).trim(); }
        else if (st === 401) msg = _fmsg('unauthorized');
        else if (st === 413) msg = _fmsg('tooLarge');
        else if (data && (data.detail || data.message)) msg = data.detail || data.message;
        else msg = err && err.message ? err.message : String(err);
        batch(() => { submitError.value = err; errors.$form.value = msg; });
        if (announceFn && msg) announceFn(msg, 'assertive');
    };
    const setBtn = (submitter, onOff) => {
        if (!submitter || !submitter.setAttribute) return;
        submitter.toggleAttribute('data-pending', onOff);
        submitter.setAttribute('aria-disabled', onOff ? 'true' : 'false');
        if (onOff && submitter.dataset && submitter.dataset.pendingText) { submitter._aegisText = submitter.textContent; submitter.textContent = submitter.dataset.pendingText; }
        else if (!onOff && submitter._aegisText != null) { submitter.textContent = submitter._aegisText; submitter._aegisText = null; }
    };
    const begin = () => { ctl = new AbortController(); batch(() => { status.value = 'validating'; submitError.value = null; errors.$form.value = null; submitCount.value++; }); return ctl; };
    const end = (st) => { status.value = st; ctl = null; };
    return { abort, applyError, setBtn, begin, end, get signal() { return ctl ? ctl.signal : null; }, get aborted() { return !!(ctl && ctl.signal.aborted); } };
}
/** PRG-редирект после отправки: 'assign' | 'none' | 'router' (Navigation API, same-origin) | функция */
function _followRedirect(response, r) {
    if (typeof r === 'function') return r(response);
    if (r === 'none') return;
    if (r === 'router' && typeof navigation !== 'undefined' && typeof navigation.navigate === 'function') { try { if (new URL(response.url).origin === location.origin) { navigation.navigate(response.url); return; } } catch (e) { /* */ } }
    location.assign(response.url);
}

/** setInitial/commit/dirtyFields/changes для форм редактирования поверх resource() */
function _initialsApi(fields, initials, errors, touched, shape) {
    const setInitial = (values) => {
        if (isSignal(values)) {
            effect(() => { const v = values.value; if (v != null) untrack(() => setInitial(v)); }, 'form:setInitial');
            return;
        }
        batch(() => {
            for (const key of Object.keys(fields)) {
                if (!(key in values) && !(_normPath(key) in values)) continue;
                const v = key in values ? values[key] : values[_normPath(key)];
                initials[key].value = v;
                fields[key].value = v;
                errors[key].value = null;
                if (touched && touched[key]) touched[key].value = false;
            }
        });
    };
    const commit = () => batch(() => { for (const key of Object.keys(fields)) initials[key].value = fields[key].peek(); });
    const dirtyFields = computed(() => {
        if (shape) shape.value;
        const out = {};
        for (const key of Object.keys(fields)) if (!_sameValue(fields[key].value, initials[key].value)) out[key] = true;
        return out;
    }, 'form:dirtyFields');
    const dirty = computed(() => Object.keys(dirtyFields.value).length > 0, 'form:dirty');
    const changes = computed(() => {
        const out = {};
        for (const key of Object.keys(dirtyFields.value)) _setPath(out, _parsePath(key), fields[key].value);
        return out;
    }, 'form:changes');
    /**
     * Защита от потери правок: beforeunload при dirty + перехват навигации Navigation API с подтверждением (свой <dialog> через confirm).
     *   f.guard({ confirm: (toUrl) => myDialog.ask() })   // Promise<boolean>; по умолчанию window.confirm(_fmsg('unsaved'))
     */
    let _skipOnce = false;
    const guard = (o = {}) => {
        const busy = o.busy || (() => false);
        const ask = o.confirm || ((to) => Promise.resolve(typeof confirm === 'function' ? confirm(_fmsg('unsaved')) : true));
        const offs = [on(window, 'beforeunload', (e) => { if (dirty.peek() && !busy()) { e.preventDefault(); e.returnValue = ''; } })];
        if (typeof navigation !== 'undefined' && typeof navigation.addEventListener === 'function') offs.push(on(navigation, 'navigate', (e) => {
            if (_skipOnce) { _skipOnce = false; return; }
            if (!dirty.peek() || busy() || !e.cancelable || e.formData || e.downloadRequest !== null) return;
            let dest; try { dest = new URL(e.destination.url); } catch (x) { return; }
            if (dest.href === location.href || (dest.pathname === location.pathname && dest.search === location.search && dest.hash !== location.hash && !o.hash)) return;   // якорь — не уход
            e.preventDefault();
            Promise.resolve(ask(dest.href)).then((ok) => { if (ok) { _skipOnce = true; navigation.navigate(dest.href, { history: e.navigationType === 'replace' ? 'replace' : 'push' }); } });
        }));
        const stop = () => { for (const f of offs.splice(0)) f(); };
        if (_currentScope) _currentScope.onDispose(stop);
        return stop;
    };
    return { setInitial, commit, dirtyFields, dirty, changes, guardUnload: guard, guard };
}

/**
 * Управление формой: поля, валидация, dirty-tracking, submit.
 *   const f = form({ name: { value: '', rules: [required, minLen(3)] }, email: { value: '' } });
 *   const f = form({ name: '', email: '' }, { rules: { email: [required, email] }, schema: zodSchema });   // defaults + rules / Standard Schema
 *   f.fields.name — signal, f.errors.name — signal (строка | null), f.dirty, f.valid, f.values (вложенный объект)
 *   f.validate() — sync-правила; await f.validateAsync() — плюс async-правила и schema
 *   await f.submit(async values => api.post('/api/save', values))   // или f.submit('/api/save') — JSON POST через request()
 *   f.setInitial(user.data); f.commit(); f.changes.value; f.guardUnload()
 */
export function form(schemaOrDefaults, opts = {}) {
    const fields = {};
    const errors = {};
    const touched = {};
    const _rules = {};
    const _initials = {};
    const _inputs = {};
    const _wires = {};
    const shape = signal(0, 'form:shape');
    const mode = opts.mode || 'blur-then-live';
    let _formEl = null;
    const isLegacy = !opts.rules && !opts.schema && Object.values(schemaOrDefaults).every(d => d && typeof d === 'object' && !Array.isArray(d) && ('value' in d || 'rules' in d));

    for (const [key, def] of Object.entries(schemaOrDefaults)) {
        const initial = isLegacy ? (def.value !== undefined ? def.value : '') : def;
        _initials[key] = signal(initial, `form:${key}:initial`);
        fields[key] = signal(initial, `form:${key}`);
        errors[key] = signal(null, `form:${key}:error`);
        touched[key] = signal(false, `form:${key}:touched`);
        _rules[key] = (isLegacy ? def.rules : (opts.rules && opts.rules[key])) || [];
    }
    errors.$form = signal(null, 'form:$form');
    const keyOf = (p) => { const n = _normPath(p); return Object.keys(fields).find(k => k === p || _normPath(k) === n) || null; };
    const schema = _isStandardSchema(opts.schema) ? opts.schema : null;
    const V = _makeValidator({ fields, errors, rules: _rules, touched, asyncDebounce: opts.asyncDebounce, schema, keyOf, shape });
    const I = _initialsApi(fields, _initials, errors, touched, shape);

    const validateField = V.validateField;
    const validate = () => { for (const k of Object.keys(fields)) touched[k].value = true; const ok = V.validateAll(); return ok; };
    const valid = V.valid;
    const values = computed(() => { shape.value; for (const k of Object.keys(fields)) fields[k].value; return _nestValues(fields); }, 'form:values');
    const parsed = V.parsed;
    const keys = computed(() => { shape.value; return Object.keys(fields); }, 'form:keys');

    /** Форма растёт: добавить поле (правила — явные или по шаблону 'items[].qty'), удалить, переименовать (сигналы переезжают) */
    const addField = (key, value = '', rules, o) => {
        const initial = o && typeof o === 'object' && 'initial' in o ? o.initial : value;
        if (fields[key]) return fields[key];
        _initials[key] = signal(initial, `form:${key}:initial`);
        fields[key] = signal(value, `form:${key}`);
        errors[key] = signal(null, `form:${key}:error`);
        touched[key] = signal(false, `form:${key}:touched`);
        _rules[key] = rules || (isLegacy ? [] : _rulesFor(key, opts.rules));
        V.addField(key);
        watch(fields[key], () => V.clearServer(key));
        shape.value++;
        return fields[key];
    };
    const removeField = (key) => {
        if (!fields[key]) return;
        V.removeField(key);
        if (_wires[key]) { for (const d of _wires[key]) d(); delete _wires[key]; }
        for (const m of [fields, errors, touched, _initials, _rules, _inputs]) delete m[key];
        shape.value++;
    };
    const renameField = (from, to) => {
        if (from === to || !fields[from]) return;
        for (const m of [fields, errors, touched, _initials, _rules, _inputs, _wires]) if (from in m) { m[to] = m[from]; delete m[from]; }
        V.renameField(from, to);
        shape.value++;
    };

    const reset = () => {
        batch(() => {
            for (const key of Object.keys(fields)) {
                fields[key].value = _initials[key].peek();
                errors[key].value = null;
                touched[key].value = false;
            }
            errors.$form.value = null;
        });
        V.abortAll();
    };

    const status = signal('idle', 'form:status');
    const submitting = computed(() => status.value === 'validating' || status.value === 'submitting', 'form:submitting');
    const submitCount = signal(0, 'form:submitCount');
    const submitted = computed(() => submitCount.value > 0, 'form:submitted');
    const submitError = signal(null, 'form:submitError');
    const result = signal(null, 'form:result');
    const canSubmit = computed(() => valid.value && !V.validating.$any.value && !submitting.value, 'form:canSubmit');
    const setErrors = (serverErrors) => { _applyServerErrors(serverErrors, errors, touched, keyOf); for (const k of Object.keys(fields)) V.markServer(k); };
    const L = _submitLifecycle({ status, errors, setErrors, submitError, submitCount, announceFn: null });

    /** Серверная ошибка снимается при изменении поля; ошибки правил живут по политике показа (reward early) */
    for (const key of Object.keys(fields)) watch(fields[key], () => V.clearServer(key));

    /** Привязать инпут к полю: f.wire(el, key = el.name) | директива для html``: <input name="email" ${f.wire('email')}> */
    const wire = (el, key) => {
        if (typeof el === 'string') { const k = el; return attach((node) => { wire(node, k); }, { once: true }); }
        key = key || el.name;
        if (!fields[key]) { _warn('E019', !globalThis.AEGIS_PROD && { what: `form.wire(): unknown field "${key}".`, why: 'The form has no field with that name.', fix: 'Add the field to form() or pass the key: f.wire(el, "email").' }, 'wire:' + key); return () => {}; }
        const extra = !!_inputs[key];
        if (!extra) _inputs[key] = el;
        if (el.form && opts.native !== false) { el.form.noValidate = true; _formEl = _formEl || el.form; }
        const d = _wireInput(el, key, { fields, errors, touched, mode, native: opts.native, validateField, formEl: el.form || _formEl, submitCount, extra, types: opts.types, a11y: opts.a11y });
        (_wires[key] || (_wires[key] = [])).push(d);
        return d;
    };
    /** Оживить <form> целиком (все [name]) — то же, что делает wireForm при обнаружении */
    const attachForm = (formEl) => {
        _formEl = formEl;
        for (const input of formEl.querySelectorAll('[name]')) if (fields[input.name]) wire(input, input.name);
        on(formEl, 'reset', (e) => { e.preventDefault(); reset(); });   // нативный <button type=reset> сбрасывает сигналы, не только DOM
        return formEl;
    };
    let _summaryEl = null;
    /** Сводка ошибок GOV.UK: f.summary(target?) — role=alert со ссылками на поля; при провале submit фокус идёт на неё */
    const summary = (target, so = {}) => {
        const box = typeof target === 'string' ? document.querySelector(target) : target || (() => { const d = document.createElement('div'); (_formEl || document.body).prepend(d); return d; })();
        _summaryEl = _errorSummary(box, _formEl, fields, errors, _inputs, so);
        return box;
    };
    const errorList = computed(() => { shape.value; return Object.keys(fields).filter(k => errors[k].value).map(k => ({ key: k, message: errors[k].value, el: _inputs[k] || null })); }, 'form:errorList');
    /** Ссылка на поле для bind:field=${f.field('email')} и шаблонов: сигналы + id контейнера ошибки */
    const field = (key) => ({
        key, value: fields[key], error: errors[key], issue: V.issues[key], touched: touched[key], validating: V.validating[key],
        get id() { return _inputs[key] && _inputs[key].id || 'f-' + key.replace(/[^\w-]/g, '_'); },
        get errorId() { return key.replace(/[^\w-]/g, '_') + '-error'; },
        $wire: (el) => wire(el, key),
    });
    const focusFirstError = () => _focusFirstError(_formEl, _inputs, errors, { summaryEl: _summaryEl, focusOnError: opts.focusOnError, announce: opts.a11y && opts.a11y.summary === false ? false : undefined });

    /**
     * submit(handler) — валидация (sync + async + schema), затем handler(values); ошибки из err.data.errors / err.errors → поля.
     * submit(url, opts) — JSON POST через request(): CSRF, HttpError, PRG-редирект.
     */
    const submit = async (target, sopts = {}) => {
        if (submitting.peek()) return { ok: false, errors: 'submitting' };   // double-submit guard
        const ctl = L.begin();
        const submitter = sopts.submitter || null;
        L.setBtn(submitter, true);
        if (_formEl) { _formEl.dataset.status = 'validating'; _formEl.setAttribute('aria-busy', 'true'); }
        try {
            for (const k of Object.keys(fields)) touched[k].value = true;
            if (!(await V.validateAsync())) { L.end('error'); focusFirstError(); return { ok: false, errors: 'validation' }; }
            status.value = 'submitting';
            if (_formEl) _formEl.dataset.status = 'submitting';
            const body = schema && parsed.peek() != null ? parsed.peek() : values.peek();   // вывод схемы (coerce/trim/default) — в handler и на сервер
            if (typeof target === 'function') {
                const r = await target(body, { signal: ctl.signal, submitter, event: sopts.event || null });
                if (ctl.signal.aborted) { L.end('idle'); return undefined; }
                result.value = r;
                L.end('success');
                return r;
            }
            const response = await request(target, {
                method: 'POST',
                headers: sopts.headers,
                body: sopts.transform ? sopts.transform(body) : body,
                raw: true,
                signal: ctl.signal,
                ...sopts.fetchOpts,
            });
            const ct = response.headers.get('content-type') || '';
            if (response.redirected && ct.includes('text/html')) {
                _followRedirect(response, sopts.onRedirect || _config.onRedirect);
                L.end('success');
                return { ok: response.ok, redirected: true, status: response.status, data: null };
            }
            const data = await _parseBody(response);
            if (!response.ok || (data && data.errors)) {
                if (data?.errors) setErrors(data.errors);
                else L.applyError(Object.assign(new HttpError(response.status, response, data), { data }));
                L.end('error');
                return { ok: false, status: response.status, data };
            }
            result.value = data;
            L.end('success');
            return { ok: true, data };
        } catch (e) {
            if (e && e.name === 'AbortError') { L.end('idle'); return typeof target === 'function' ? undefined : { ok: false, aborted: true }; }
            L.applyError(e);
            L.end('error');
            if (typeof target === 'function') return undefined;
            return { ok: false, error: e };
        } finally {
            L.setBtn(submitter, false);
            if (_formEl) { _formEl.dataset.status = status.peek(); _formEl.removeAttribute('aria-busy'); }
        }
    };

    if (_currentScope) _currentScope.onDispose(() => { V.abortAll(); L.abort(); });

    return {
        fields, errors, issues: V.issues, touched, values, parsed, keys, dirty: I.dirty, dirtyFields: I.dirtyFields, changes: I.changes, valid, canSubmit, validating: V.validating,
        validate, validateField, validateAsync: V.validateAsync, submit, reset, setErrors, focusFirstError,
        wire, field, attach: attachForm, addField, removeField, renameField, summary, errorList,
        setInitial: I.setInitial, commit: I.commit, guardUnload: I.guard, guard: I.guard,
        status, abort: L.abort, submitting, submitted, submitCount, submitError, result,
    };
}

/**
 * Массив полей поверх form()/wireForm(): строки с устойчивыми ключами, имена items[i][sub] перенумеровываются без коллизий.
 *   const items = fieldArray(f, 'items', { row: { qty: 1, sku: '' } });   // правила: rules: { 'items[].qty': [min(1)] } на форме
 *   items.push({ qty: 2 }); items.remove(0); items.move(0, 1);
 *   list(items.rows, row => html`<input bind:field=${row.field('qty')}>`, r => r.key)   // ключ строки стабилен при перенумерации
 * row.field(sub) — FieldRef; row.value(sub) — сигнал значения.
 */
export function fieldArray(f, path, aopts = {}) {
    const base = _normPath(path);
    const subs = Object.keys(aopts.row || {});
    const nameOf = aopts.name || ((i, sub) => `${base}[${i}]` + (sub ? `[${sub}]` : ''));
    let seq = 0;
    const rows = signal([], `array:${base}`);
    const mkRow = () => { const row = { key: ++seq, index: -1 }; row.value = (sub) => f.fields[nameOf(row.index, sub)]; row.field = (sub) => f.field(nameOf(row.index, sub)); return row; };
    const renum = (list, order) => { for (const i of order) { const r = list[i]; if (r.index === i) continue; for (const sub of subs) f.renameField(nameOf(r.index, sub), nameOf(i, sub)); r.index = i; } };
    const insert = (i, init = {}) => batch(() => {
        const list = rows.peek().slice();
        i = Math.max(0, Math.min(i, list.length));
        const row = mkRow();
        list.splice(i, 0, row);
        renum(list, [...list.keys()].reverse().filter(j => j > i));          // хвост — с конца: имён-коллизий нет
        for (const sub of subs) f.addField(nameOf(i, sub), init[sub] !== undefined ? init[sub] : aopts.row[sub], aopts.rules && aopts.rules[sub], initialRows ? undefined : { initial: undefined });   // начальные строки не dirty, добавленные — dirty
        row.index = i;
        rows.value = list;
        return row;
    });
    const remove = (i) => batch(() => {
        const list = rows.peek().slice();
        if (i < 0 || i >= list.length) return;
        const [row] = list.splice(i, 1);
        for (const sub of subs) f.removeField(nameOf(row.index, sub));
        renum(list, [...list.keys()].filter(j => j >= i));                   // голова — с начала
        rows.value = list;
    });
    const move = (from, to) => batch(() => {
        const list = rows.peek().slice();
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
        // через временные имена, чтобы не столкнуться
        for (const r of list) for (const sub of subs) f.renameField(nameOf(r.index, sub), `${base}.__tmp${r.key}.${sub}`);
        const [row] = list.splice(from, 1); list.splice(to, 0, row);
        list.forEach((r, i) => { for (const sub of subs) f.renameField(`${base}.__tmp${r.key}.${sub}`, nameOf(i, sub)); r.index = i; });
        rows.value = list;
    });
    const swapRows = (a, b) => { if (a !== b) { const lo = Math.min(a, b), hi = Math.max(a, b); move(hi, lo); move(lo + 1, hi); } };
    let initialRows = false;
    const replace = (data) => batch(() => { while (rows.peek().length) remove(rows.peek().length - 1); (data || []).forEach((r, i) => insert(i, r)); });
    const clear = () => replace([]);
    // начальные строки: из значения поля-массива формы или aopts.initial
    const init = aopts.initial || (f.fields[path] && Array.isArray(f.fields[path].peek()) ? f.fields[path].peek() : null);
    if (init) { if (f.fields[path]) f.removeField(path); initialRows = true; replace(init); initialRows = false; }
    return { rows, length: computed(() => rows.value.length, `array:${base}:length`), push: (init) => insert(rows.peek().length, init), insert, remove, move, swap: swapRows, replace, clear, nameOf };
}

/**
 * Раскладка серверных ошибок по полям. Понимает:
 *   { email: 'msg' | ['msg'] }, { non_field_errors | _form | base | detail | message | $form: 'msg' },
 *   [{ path?: string | string[], pointer?: '/data/attributes/email', message }] (RFC 9457 / JSON:API).
 * Неизвестный ключ → errors.$form (в dev — предупреждение).
 */
function _applyServerErrors(serverErrors, errors, touched, keyOf = (k) => (errors[k] ? k : null)) {
    const FORM_KEYS = new Set(['$form', '_form', 'base', 'non_field_errors', '__all__', 'detail', 'message', 'error']);
    const first = (m) => Array.isArray(m) ? m[0] : (m && typeof m === 'object' && m.message) ? m.message : m;
    batch(() => {
        if (Array.isArray(serverErrors)) {
            for (const item of serverErrors) {
                const raw = item.path ? (Array.isArray(item.path) ? item.path.join('.') : item.path)
                    : item.pointer ? String(item.pointer).replace(/^\/data\/attributes\//, '').replace(/^\//, '').replace(/\//g, '.') : (item.source && item.source.pointer ? String(item.source.pointer).replace(/^\/data\/attributes\//, '').replace(/\//g, '.') : null);
                const path = raw ? keyOf(raw) : null;
                const msg = item.message || item.detail || String(item);
                if (path && errors[path]) { errors[path].value = msg; if (touched && touched[path]) touched[path].value = true; }
                else if (errors.$form) errors.$form.value = errors.$form.peek() || msg;
            }
            return;
        }
        for (const [rawKey, msg] of Object.entries(serverErrors || {})) {
            const key = rawKey === '$form' ? null : keyOf(rawKey);
            if (key && errors[key]) {
                // Laravel/DRF вложенные: { 'items.0.qty': [...] } или { address: { city: [...] } }
                errors[key].value = first(msg);
                if (touched && touched[key]) touched[key].value = true;
            } else if (msg && typeof msg === 'object' && !Array.isArray(msg) && !msg.message && !FORM_KEYS.has(rawKey)) {
                // вложенный объект ошибок → развернуть по путям
                const flat = {};
                (function walk(o, prefix) { for (const [k, v] of Object.entries(o)) { const p = prefix ? prefix + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v) && !v.message) walk(v, p); else flat[p] = v; } })(msg, rawKey);
                _applyServerErrors(flat, errors, touched, keyOf);
            } else if (errors.$form) {
                if (!FORM_KEYS.has(rawKey)) _warn('E019', !globalThis.AEGIS_PROD && {
                    what: `setErrors(): unknown field "${rawKey}" — shown as a form-level error.`,
                    why: 'The form has no field with that name.',
                    fix: 'Rename the field, or return the message under detail/non_field_errors.',
                }, 'setErrors:' + rawKey);
                errors.$form.value = first(msg);
            }
        }
    });
}

// Встроенные правила валидации
export const required = (v) => (v == null || v === '' || (Array.isArray(v) && v.length === 0)) ? _fmsg('required') : null;
export const minLen = (n, msg) => (v) => (typeof v === 'string' && v.length < n) ? (msg || _fmsg('minLen', { n })) : null;
export const maxLen = (n, msg) => (v) => (typeof v === 'string' && v.length > n) ? (msg || _fmsg('maxLen', { n })) : null;
export const pattern = (re, msg) => (v) => (typeof v === 'string' && !re.test(v)) ? (msg || _fmsg('pattern')) : null;
export const emailRule = (v) => (typeof v === 'string' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? _fmsg('email') : null;
export const email = emailRule;
export const min = (n, msg) => (v) => (v != null && v !== '' && Number(v) < n) ? (msg || _fmsg('min', { n })) : null;
export const max = (n, msg) => (v) => (v != null && v !== '' && Number(v) > n) ? (msg || _fmsg('max', { n })) : null;
// ---- файлы (#94)
const _bytes = (s) => typeof s === 'number' ? s : parseFloat(s) * ({ b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[String(s).replace(/[\d.\s]/g, '').toLowerCase()] || 1);
const _files = (v) => v == null ? [] : Array.isArray(v) ? v : (typeof FileList !== 'undefined' && v instanceof FileList) ? [...v] : [v];
export const maxSize = (size, msg) => (v) => _files(v).some(f => f && f.size > _bytes(size)) ? (msg || _fmsg('maxSize', { size })) : null;
export const mime = (types, msg) => (v) => {
    const list = [].concat(types);
    const ok = (f) => list.some(t => t.endsWith('/*') ? (f.type || '').startsWith(t.slice(0, -1)) : t.startsWith('.') ? (f.name || '').toLowerCase().endsWith(t.toLowerCase()) : f.type === t);
    return _files(v).some(f => f && !ok(f)) ? (msg || _fmsg('mime')) : null;
};
export const maxFiles = (n, msg) => (v) => _files(v).length > n ? (msg || _fmsg('maxFiles', { n })) : null;


// ============================================================================
// 18. LAZY — Viewport-based lazy loading
// ============================================================================

/**
 * Ленивая загрузка: контент рендерится только когда виден.
 * Заменяет useLazySection из vue-utils.js.
 *
 * @example
 *   lazy(containerEl, async () => {
 *       const data = await fetch('/api/stats').then(r => r.json());
 *       containerEl.innerHTML = buildStatsHtml(data);
 *   }, {
 *       skeleton: () => html`<div class="skeleton-block" style="height:200px"></div>`,
 *       rootMargin: '100px',
 *   });
 */
export function lazy(el, loadFn, opts = {}) {
    const { skeleton, rootMargin = '50px', threshold = 0 } = opts;
    const loaded = signal(false, 'lazy:loaded');
    const loading = signal(false, 'lazy:loading');

    // Показать скелетон пока не загружен
    if (skeleton) {
        const skel = typeof skeleton === 'function' ? skeleton() : skeleton;
        if (skel instanceof DocumentFragment || skel instanceof HTMLElement) {
            el.appendChild(skel);
        }
    }

    const dispose = observe(el, (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !loaded.peek() && !loading.peek()) {
            loading.value = true;
            // Убрать скелетон
            Promise.resolve(loadFn(el)).then(() => {
                loaded.value = true;
                loading.value = false;
            }).catch((e) => {
                console.error('[Aegis] lazy load error:', e);
                loading.value = false;
            });
        }
    }, { rootMargin, threshold });

    return { loaded, loading, dispose };
}


// ============================================================================
// 19. NEXTICK — Post-render callback
// ============================================================================

/**
 * Выполнить callback после того, как DOM обновится.
 * Эквивалент Vue.nextTick().
 *
 * @example
 *   name.value = 'John';
 *   await nextTick();
 *   // DOM уже обновлён
 */
export function nextTick(fn) {
    const p = new Promise(resolve => _sched.micro(() => { _flushAnchors(); _runLane('micro'); _whenSettled().then(resolve); }));   // DOM обновлён, включая frame/transition-полосы
    return fn ? p.then(fn) : p;
}


// ============================================================================
// 20. I18N — Translation helper
// ============================================================================

/**
 * Переводы с plural через Intl.PluralRules, реактивной локалью и Intl-форматтерами.
 *   const t = i18n({ ru: ruDict, kk: () => fetch('/i18n/kk.json').then(r => r.json()) }, { locale: 'ru', fallback: 'ru', syncLang: true });
 *   t('items', { n: 3 });              // ru: { items: { one: '{n} товар', few: '{n} товара', many: '{n} товаров' } }
 *   t.num(1234.5, { style: 'currency', currency: 'KZT' }); t.date(d, { dateStyle: 'medium' }); t.rel(-3, 'day'); t.list(['a', 'b']);
 *   t.locale.value = 'kk';             // подгрузка (t.loading), <html lang>, перерисовка
 *   i18n(flatDict)                     // старая форма: плоский словарь одной локали
 */
export function i18n(dicts = {}, opts = {}) {
    const isFlat = Object.values(dicts).every(v => typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'string')) && !Object.keys(v).some(k => ['zero', 'one', 'two', 'few', 'many', 'other'].includes(k)))
        && !Object.keys(dicts).some(k => /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(k) && dicts[k] && typeof dicts[k] === 'object');
    const initialLocale = opts.locale || (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
    const locale = signal(initialLocale, 'i18n:locale');
    const loading = signal(false, 'i18n:loading');
    const _dict = signal(isFlat ? dicts : (typeof dicts[initialLocale] === 'object' ? dicts[initialLocale] : {}), 'i18n');
    const loaded = new Map();
    if (!isFlat) for (const [k, v] of Object.entries(dicts)) if (v && typeof v === 'object') loaded.set(k, v);
    const fallback = opts.fallback || initialLocale;
    const fmtCache = new Map();
    const fmt = (Ctor, o) => { const k = Ctor.name + locale.value + JSON.stringify(o || {}); let f = fmtCache.get(k); if (!f) { f = new Ctor(locale.value, o); fmtCache.set(k, f); } return f; };
    const plural = (n, forms) => {
        const cat = fmt(Intl.PluralRules, opts.pluralOpts).select(n);
        return forms[cat] ?? forms.other ?? forms.many ?? Object.values(forms)[0] ?? '';
    };
    const interpolate = (tpl, params) => params ? String(tpl).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`) : String(tpl);
    const lookup = (dict, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict) ?? dict[key];

    const t = (key, params) => {
        let entry = lookup(_dict.value, key);
        if (entry === undefined && !isFlat && loaded.get(fallback)) entry = lookup(loaded.get(fallback), key);
        if (entry === undefined) return key;
        if (entry && typeof entry === 'object') {
            const n = params && (params.n ?? params.count);
            entry = typeof n === 'number' ? plural(n, entry) : (entry.other ?? Object.values(entry)[0]);
        }
        return interpolate(entry, params);
    };
    t.load = (newDict) => { _dict.value = newDict; };
    t.merge = (extra) => { _dict.value = { ..._dict.peek(), ...extra }; };
    t.dict = _dict;
    t.locale = locale;
    t.loading = loading;
    t.num = (v, o) => fmt(Intl.NumberFormat, o).format(v);
    t.date = (v, o) => fmt(Intl.DateTimeFormat, o).format(v);
    t.rel = (v, unit, o) => fmt(Intl.RelativeTimeFormat, { numeric: 'auto', ...(o || {}) }).format(v, unit);
    t.list = (v, o) => fmt(Intl.ListFormat, o).format(v);
    t.plural = (n, forms) => plural(n, forms);

    if (!isFlat) {
        const owner = _currentScope || new Scope(null, 'i18n');   // синглтон приложения: без E001 вне scope
        owner.run(() => effect(() => {
            const loc = locale.value;
            untrack(async () => {
                if (opts.syncLang !== false && typeof document !== 'undefined') document.documentElement.lang = loc;
                let d = loaded.get(loc);
                if (!d && typeof dicts[loc] === 'function') {
                    loading.value = true;
                    try { d = await dicts[loc](); loaded.set(loc, d); } catch (e) { console.error('[Aegis] i18n: failed to load', loc, e); }
                    finally { loading.value = false; }
                    if (locale.peek() !== loc) return;
                }
                if (d) _dict.value = d;
            });
        }, 'i18n:locale'));
    }
    return t;
}

// ---- сообщения встроенных правил валидации: коды → строки (локализуемо)
const _MESSAGES = {
    en: { required: 'This field is required', minLen: 'At least {n} characters', maxLen: 'At most {n} characters', pattern: 'Invalid format', email: 'Invalid email', matches: 'Must match {field}', min: 'Minimum {n}', max: 'Maximum {n}', maxSize: 'File is larger than {size}', mime: 'Unsupported file type', maxFiles: 'At most {n} files', url: 'Invalid URL', step: 'Must be a multiple of {n}', badInput: 'Invalid value', saved: 'Saved', retryAfter: 'Too many requests — try again in {s} s', unauthorized: 'Please sign in again', tooLarge: 'The request is too large', formErrors: { one: 'There is {n} error in the form', other: 'There are {n} errors in the form' }, stepOf: 'Step {n} of {total}', unsaved: 'You have unsaved changes. Leave the page?', draftRestored: 'Draft restored', formReset: 'Form reset' },
    ru: { required: 'Обязательное поле', minLen: { one: 'Минимум {n} символ', few: 'Минимум {n} символа', many: 'Минимум {n} символов', other: 'Минимум {n} символов' }, maxLen: { one: 'Максимум {n} символ', few: 'Максимум {n} символа', many: 'Максимум {n} символов', other: 'Максимум {n} символов' }, pattern: 'Неверный формат', email: 'Неверный email', matches: 'Должно совпадать с {field}', min: 'Минимум {n}', max: 'Максимум {n}', maxSize: 'Файл больше {size}', mime: 'Неподдерживаемый тип файла', maxFiles: 'Не больше {n} файлов', url: 'Неверный URL', step: 'Должно быть кратно {n}', badInput: 'Недопустимое значение', saved: 'Сохранено', retryAfter: 'Слишком много запросов — повторите через {s} с', unauthorized: 'Войдите снова', tooLarge: 'Слишком большой запрос', formErrors: { one: 'В форме {n} ошибка', few: 'В форме {n} ошибки', many: 'В форме {n} ошибок', other: 'В форме {n} ошибок' }, stepOf: 'Шаг {n} из {total}', unsaved: 'Есть несохранённые изменения. Уйти со страницы?', draftRestored: 'Черновик восстановлен', formReset: 'Форма сброшена' },
};
/** Сообщение формы: подключает таблицу _MESSAGES к _msg при первом использовании (в бандле без форм её нет) */
function _fmsg(code, params) { if (!_ext.msgs) _ext.msgs = _MESSAGES; return _msg(code, params); }
let _vLocaleEff = null;
/**
 * Сообщения встроенных правил: словарь { required: '…', minLen: 'At least {n}' | { one, few, many, other } }, функция (code, params) => string | null,
 * или t из i18n() — ключи validation.<code> из словаря приложения (plural через t), локаль следует за t.locale.
 */
export function setValidationMessages(dict, prefix = 'validation.') {
    if (_vLocaleEff) { _vLocaleEff(); _vLocaleEff = null; }
    if (typeof dict === 'function' && dict.locale && isSignal(dict.locale)) {
        const t = dict;
        _messages = (code, params) => { const k = prefix + code, str = t(k, params); return str === k ? null : str; };
        _vLocaleEff = new Scope(null, 'validation').run(() => effect(() => { _vLocale.value = t.locale.value; }, 'validation:locale'));
        return;
    }
    _messages = dict;
    if (dict === null && typeof document !== 'undefined') _vLocale.value = document.documentElement.lang || 'en';
}


// ============================================================================
// 21. CLOAK — Hide until hydrated
// ============================================================================

/**
 * CSS-класс для скрытия неинициализированного контента.
 * Эквивалент v-cloak. Вызывать после hydrate/component.
 *
 * @example
 *   // CSS: [data-cloak] { display: none !important; }
 *   // HTML: <div id="app" data-cloak>...</div>
 *   component(el, setup);
 *   uncloak(el); // убирает data-cloak
 */
export function uncloak(el) {
    el?.removeAttribute('data-cloak');
}

/**
 * Инъекция глобальных стилей Aegis (вызвать один раз).
 * Добавляет: [data-cloak] { display: none !important; }
 * + CSS-классы для transition enter/leave.
 */
export function injectStyles() {
    if (document.getElementById('aegis-styles')) return;
    const style = document.createElement('style');
    style.id = 'aegis-styles';
    // @layer aegis объявлен первым и потому самый слабый: Tailwind/Open Props/пользовательский CSS побеждают без !important
    style.textContent = `@layer aegis;
@layer aegis {
[data-cloak]{display:none}
[data-aegis-state="pending"]{visibility:hidden}
.aegis-enter-from{opacity:0;translate:0 -8px}
.aegis-enter-active{transition:opacity .25s ease,translate .25s ease}
.aegis-enter-to{opacity:1;translate:0 0}
.aegis-leave-from{opacity:1}
.aegis-leave-active{transition:opacity .2s ease,translate .2s ease}
.aegis-leave-to{opacity:0;translate:0 8px}
.aegis-enter{opacity:0;transform:translateY(-8px)}
.aegis-leave-active.aegis-leave{opacity:0}
[data-aegis-portal]{position:relative;z-index:1000}
}`;
    document.head.prepend(style);
}


// ============================================================================
// 22. SPRING — Physics-based animation via WAAPI
// ============================================================================

/**
 * Damped harmonic oscillator solver.
 * Returns progress function: solver(t) → value [0..~1+overshoot]
 */
function _springSolver({ stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));

    if (zeta < 1) {
        // Under-damped (bouncy)
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        // correct velocity sign in under-damped formula
        const B = (zeta * w0 + velocity) / wd;
        return (t) => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + B * Math.sin(wd * t));
    }
    if (zeta === 1) {
        // correct velocity sign in critically damped formula
        return (t) => 1 - Math.exp(-w0 * t) * (1 + (w0 + velocity) * t);
    }
    // Over-damped
    const wd = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + wd, r2 = -zeta * w0 - wd;
    const A = (velocity - r2) / (r1 - r2), B = 1 - A;
    return (t) => 1 - (A * Math.exp(r1 * t) + B * Math.exp(r2 * t));
}

/** Determine when spring is "settled" (for animation duration) */
function _springDuration(opts, threshold = 0.004) {
    const solver = _springSolver(opts);
    const dt = 1 / 60;
    let rest = 0;
    for (let t = 0; t < 10; t += dt) {
        if (Math.abs(1 - solver(t)) < threshold) { if (++rest > 8) return Math.max(t, 0.15); }
        else rest = 0;
    }
    return 1;
}

/** Interpolate numbers within a CSS value string */
function _lerpNums(start, end, p) {
    if (typeof start === 'number' && typeof end === 'number') return start + (end - start) * p;
    const sN = String(start).match(/-?[\d.]+/g)?.map(Number) || [];
    const eN = String(end).match(/-?[\d.]+/g)?.map(Number) || [];
    if (sN.length && sN.length === eN.length) {
        let i = 0;
        return String(end).replace(/-?[\d.]+/g, () => {
            const v = sN[i] + (eN[i] - sN[i]) * p;
            i++;
            return Math.round(v * 1000) / 1000;
        });
    }
    return p < 1 ? start : end;
}

/**
 * Physics-based spring animation via native WAAPI.
 * Runs on compositor thread (transform/opacity), interrupt-safe.
 *
 * @example
 *   spring(el, { transform: ['translateY(20px)', 'translateY(0)'] });
 *   spring(el, { opacity: [0, 1] }, { stiffness: 300, damping: 30 });
 *
 * @param {Element} el
 * @param {Object} props — { cssProperty: [from, to] }
 * @param {Object} [opts] — { stiffness, damping, mass, velocity }
 * @returns {Animation}
 */
const _firstNum = (v) => typeof v === 'number' ? v : (parseFloat(String(v).match(/-?[\d.]+/)?.[0]) || 0);
const _linearOk = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)');

/** Сэмплы для CSS linear(): гуще там, где кривая изгибается сильнее */
function _sampleLinear(solver, dur, n = 40) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(Math.round(solver((i / n) * dur) * 1000) / 1000);
    // добавить середины между точками с большим изгибом
    const out = [pts[0]];
    for (let i = 1; i <= n; i++) {
        const prev = pts[i - 1], cur = pts[i], next = pts[i + 1] ?? cur;
        if (Math.abs(next - 2 * cur + prev) > 0.01) out.push(Math.round(solver(((i - 0.5) / n) * dur) * 1000) / 1000);
        out.push(cur);
    }
    out[out.length - 1] = 1;
    return out;
}

export function spring(el, props, opts = {}) {
    props = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, [...v]]));   // не мутировать вход
    if (_motionOff()) {
        for (const name of Object.keys(props)) el.style[name] = props[name][1];
        return { finished: Promise.resolve(), cancel() {}, _aegisSpring: true };
    }
    // Interrupt: продолжить из текущей позиции с текущей скоростью (в нормировке новой траектории)
    const prev = el.getAnimations ? el.getAnimations().find(a => a._aegisSpring && a._aegisSpring.solver) : null;
    if (prev) {
        const { solver: ps, dur: pd, from: pf, to: pt } = prev._aegisSpring;
        const timing = prev.effect && prev.effect.getComputedTiming ? prev.effect.getComputedTiming() : null;
        const p = timing && timing.progress != null ? timing.progress : 1;
        const t = p * pd, eps = 1e-3, x = ps(t), vNorm = (ps(t + eps) - x) / eps;
        let vel = opts.velocity;
        for (const k in props) {
            if (!(k in pf)) continue;
            const cur = _lerpNums(pf[k], pt[k], x);
            const oldSpan = _firstNum(pt[k]) - _firstNum(pf[k]);
            const newSpan = _firstNum(props[k][1]) - _firstNum(cur);
            if (vel == null && newSpan) vel = vNorm * oldSpan / newSpan;
            props[k][0] = cur;
        }
        opts = { ...opts, velocity: Number.isFinite(vel) ? vel : 0 };
        prev.cancel();
    }
    el.getAnimations?.().forEach(a => { if (a._aegisSpring) a.cancel(); });

    const solver = _springSolver(opts);
    const dur = _springDuration(opts);
    const names = Object.keys(props);
    const from = {}, to = {};
    for (const n of names) { from[n] = props[n][0]; to[n] = props[n][1]; }
    const timing = { duration: dur * 1000, fill: 'forwards', easing: 'linear' };
    let keyframes;
    if (_linearOk) {
        // два keyframe + linear() easing: без 60 кадров/с в памяти
        timing.easing = `linear(${_sampleLinear(solver, dur).join(', ')})`;
        keyframes = [{ ...from }, { ...to }];
    } else {
        const steps = Math.max(2, Math.round(dur * 60));
        keyframes = [];
        for (let i = 0; i <= steps; i++) {
            const p = solver((i / steps) * dur);
            const frame = {};
            for (const n of names) frame[n] = _lerpNums(from[n], to[n], p);
            keyframes.push(frame);
        }
    }
    if (opts.timeline) timing.timeline = opts.timeline;

    const anim = el.animate(keyframes, timing);
    anim._aegisSpring = { solver, dur, from, to };
    // fill:'forwards' навсегда перекрывает обычные стили — после финиша фиксируем
    // конечное состояние в inline-style и снимаем анимацию
    anim.finished.then(() => {
        try { anim.commitStyles(); } catch (e) { /* элемент не отрисован */ }
        anim.cancel();
    }).catch(() => {});
    return anim;
}

/**
 * Пружина как значение: target пишем, current читаем; скорость сохраняется при смене цели.
 *   const x = springSignal(0, { stiffness: 300, damping: 24 });
 *   on(track, 'pointermove', e => { x.target.value = e.offsetX; });   cssVars(knob, { x: () => x.current.value + 'px' });
 * T = number | number[] | Record<string, number>. Reduced motion → current = target сразу.
 */
export function springSignal(initial, opts = {}) {
    const { stiffness = 170, damping = 26, mass = 1, precision = 0.01 } = opts;
    const target = signal(initial, 'spring:target');
    const current = signal(initial, 'spring:current');
    const shape = Array.isArray(initial) ? 'array' : (initial && typeof initial === 'object') ? 'object' : 'number';
    const keys = shape === 'object' ? Object.keys(initial) : null;
    const toArr = (v) => shape === 'number' ? [v] : shape === 'array' ? v.slice() : keys.map(k => v[k]);
    const fromArr = (a) => shape === 'number' ? a[0] : shape === 'array' ? a : Object.fromEntries(keys.map((k, i) => [k, a[i]]));
    let pos = toArr(initial), vel = pos.map(() => 0), raf = 0, last = 0;
    const step = (now) => {
        raf = 0;
        const dt = Math.min(1 / 30, last ? Math.max(1 / 240, (now - last) / 1000) : 1 / 60);
        last = now;
        const goal = toArr(target.peek());
        let settled = true;
        for (let i = 0; i < pos.length; i++) {
            const a = (-stiffness * (pos[i] - goal[i]) - damping * vel[i]) / mass;
            vel[i] += a * dt;
            pos[i] += vel[i] * dt;
            if (Math.abs(vel[i]) > precision || Math.abs(pos[i] - goal[i]) > precision) settled = false;
        }
        if (settled) { pos = goal.slice(); vel = vel.map(() => 0); last = 0; }
        current.value = fromArr(pos.slice());
        if (!settled) raf = _frame(step);
    };
    const kick = () => { if (!raf) raf = _frame(step); };
    effect(() => {
        const t = target.value;
        if (_motionOff()) { untrack(() => { pos = toArr(t); vel = vel.map(() => 0); current.value = t; }); return; }
        kick();
    }, 'springSignal');
    const set = (v, { hard = false } = {}) => { if (hard) { pos = toArr(v); vel = vel.map(() => 0); current.value = v; } target.value = v; };
    if (_currentScope) _currentScope.onDispose(() => { if (raf) { raf(); raf = 0; } });
    return { target, current, set };
}

/** Твин как значение: target пишем, current читаем; duration/easing (функция t → [0,1]) */
export function tween(initial, { duration = 300, easing = (t) => 1 - Math.pow(1 - t, 3) } = {}) {
    const target = signal(initial, 'tween:target');
    const current = signal(initial, 'tween:current');
    let raf = 0, t0 = 0, from = initial;
    const shape = Array.isArray(initial) ? 'array' : (initial && typeof initial === 'object') ? 'object' : 'number';
    const lerp = (a, b, p) => shape === 'number' ? a + (b - a) * p
        : shape === 'array' ? a.map((x, i) => x + (b[i] - x) * p)
        : Object.fromEntries(Object.keys(b).map(k => [k, a[k] + (b[k] - a[k]) * p]));
    const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        current.value = lerp(from, target.peek(), easing(p));
        raf = p < 1 ? _frame(step) : 0;
    };
    effect(() => {
        const t = target.value;
        untrack(() => {
            if (_motionOff()) { current.value = t; return; }
            from = current.peek(); t0 = performance.now();
            if (raf) raf();
            raf = _frame(step);
        });
    }, 'tween');
    if (_currentScope) _currentScope.onDispose(() => { if (raf) { raf(); raf = 0; } });
    return { target, current, set: (v, { hard = false } = {}) => { if (hard) current.value = v; target.value = v; } };
}

/**
 * FLIP snapshot for list reorder animations.
 * Call before DOM mutation, returns a play function to call after.
 *
 * @example
 *   const play = flip(listContainer.children);
 *   // ... mutate DOM ...
 *   play();
 */
export function flip(nodes, opts = {}) {
    const { stiffness = 500, damping = 34 } = opts;
    const rects = new Map();
    for (const n of nodes) {
        if (n.nodeType === 1 && n.isConnected) {
            rects.set(n, n.getBoundingClientRect());
        }
    }
    return () => {
        if (_motionOff()) return;
        for (const [node, from] of rects) {
            if (!node.isConnected) continue;
            const to = node.getBoundingClientRect();
            const dx = from.left - to.left;
            const dy = from.top - to.top;
            if (!dx && !dy) continue;
            spring(node, {
                transform: [`translate(${dx}px,${dy}px)`, 'translate(0,0)'],
            }, { stiffness, damping });
        }
    };
}


// ============================================================================
// 23. ANIMATE — View Transitions + CSS fallback
// ============================================================================

const _mediaSignals = new Map();

/** matchMedia как сигнал (один на запрос): media('(max-width: 600px)').value */
export function media(query) {
    let sig = _mediaSignals.get(query);
    if (sig) return sig;
    if (typeof matchMedia === 'undefined') { sig = signal(false, `media:${query}`); _mediaSignals.set(query, sig); return sig; }
    const mql = matchMedia(query);
    sig = signal(mql.matches, `media:${query}`);
    mql.addEventListener('change', (e) => { sig.value = e.matches; });
    _mediaSignals.set(query, sig);
    return sig;
}

/** prefers-reduced-motion как сигнал; запись перекрывает системную настройку (кнопка в настройках, тесты) */
export const reducedMotion = /* @__PURE__ */ (() => {
    const override = signal(null, 'reducedMotion:override');
    const sys = media('(prefers-reduced-motion: reduce)');
    const out = computed(() => override.value ?? sys.value, 'reducedMotion');
    return {
        [SIGNAL]: true,
        get value() { return out.value; },
        set value(v) { override.value = v; },
        peek() { return out.peek(); },
        version() { return out.version(); },
        subscribe(fn) { return out.subscribe(fn); },
        get subs() { return out.subs; },
        set subs(v) { out.subs = v; },
        _isComputed: true, get _live() { return out._live; }, _activate() { out._activate(); }, _deactivate() { out._deactivate(); },
        toJSON() { return out.peek(); },
    };
})();

/** Анимации выключены: defaults.motion === false, reduced motion при 'auto', или нет WAAPI (jsdom) */
function _motionOff() {
    if (defaults.motion === false) return true;
    if (defaults.motion === true) return false;
    return reducedMotion.peek() || typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function';
}
const _reducedMotion = () => _motionOff();

/**
 * Тема: mode 'light' | 'dark' | 'system' в localStorage, атрибут на <html>, color-scheme для скроллбаров и контролов.
 *   const { mode, dark } = theme();   on(btn, 'click', () => mode.value = dark.value ? 'light' : 'dark');
 *   CSS: :root { color-scheme: light dark; --bg: light-dark(#fff, #121212); }  [data-theme="dark"] { … }
 * Anti-FOUC inline-скрипт до первой отрисовки — обязанность сервера.
 */
export function theme({ attr = 'data-theme', storage: key = 'aegis-theme' } = {}) {
    const html = typeof document !== 'undefined' ? document.documentElement : null;
    let initial = 'system';
    try { initial = localStorage.getItem(key) || (html && html.getAttribute(attr)) || 'system'; } catch (e) { /* */ }
    const mode = signal(initial, 'theme:mode');
    const dark = computed(() => mode.value === 'system' ? media('(prefers-color-scheme: dark)').value : mode.value === 'dark', 'theme:dark');
    // синглтон уровня приложения: вне scope живёт в собственном root-scope (без E001)
    const owner = _currentScope || new Scope(null, 'theme');
    owner.run(() => effect(() => {
        const m = mode.value, d = dark.value;
        if (html) {
            if (m === 'system') html.removeAttribute(attr); else html.setAttribute(attr, m);
            html.style.colorScheme = d ? 'dark' : 'light';
        }
        try { if (m === 'system') localStorage.removeItem(key); else localStorage.setItem(key, m); } catch (e) { /* */ }
    }, 'theme'));
    return { mode, dark };
}

/**
 * Unified transition: native View Transitions API with CSS-class fallback.
 * One API, one CSS contract, auto-detects engine.
 *
 * @example
 *   // Animate a DOM swap
 *   await animate(container, () => { container.innerHTML = newContent; });
 *
 *   // Named element transition
 *   await animate(card, () => card.remove(), { name: 'card-1' });
 *
 * @param {Element} target
 * @param {Function} mutate — DOM mutation callback
 * @param {Object} [opts]
 * @returns {Promise}
 */
export function animate(target, mutate, opts = {}, _t = _trTether) {
    const { name, cls = 'aegis' } = opts;

    // Respect prefers-reduced-motion
    if (_reducedMotion()) { mutate(); return Promise.resolve(); }

    // Скрытый документ: переход всё равно пропускается — не ждём его
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { mutate(); return Promise.resolve(); }

    // Native View Transitions API (Baseline since Oct 2025)
    if (document.startViewTransition) {
        if (name) target.style.viewTransitionName = name;
        const vt = document.startViewTransition(() => mutate());
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch(() => {});
        // abort/timeout перехода — не ошибка для вызывающего: DOM уже обновлён
        return vt.finished.catch(() => {}).finally(() => {
            if (name) target.style.viewTransitionName = '';
        });
    }

    // CSS-class fallback for older browsers / opts.transition — единый контракт
    return _classFallback(target, mutate, typeof opts.transition === 'string' ? opts.transition : cls);
}

async function _classFallback(el, mutate, cls) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || (cs.transitionDuration === '0s' && cs.animationDuration === '0s')) { mutate(); return; }
    await _runTransition(el, 'leave', cls);
    mutate();
    if (el.isConnected) await _runTransition(el, 'enter', cls);
}

// compute actual animation duration instead of hardcoded 1s
function _onAnimEnd(el, cb) {
    let done = false;
    const fire = () => { if (!done) { done = true; cb(); } };
    el.addEventListener('transitionend', fire, { once: true });
    el.addEventListener('animationend', fire, { once: true });
    // Dynamic safety timeout based on computed style
    const cs = getComputedStyle(el);
    const parseDur = (s) => Math.max(
        ...String(s).split(',').map(v => parseFloat(v) || 0)
    ) * 1000;
    const dur = Math.max(
        parseDur(cs.transitionDuration) + parseDur(cs.transitionDelay),
        parseDur(cs.animationDuration) + parseDur(cs.animationDelay),
        300
    );
    setTimeout(fire, dur + 100);
}


// ============================================================================
// 24. CACHED RESOURCE — Dedup + SWR + Cache
// ============================================================================

const _resourceCache = new Map(); // key → CacheEntry

// ---- оценка размера ответа в байтах без сериализации (массивы — по выборке из 16 элементов)
function _sizeOf(v, depth = 0) {
    if (v == null) return 8;
    const t = typeof v;
    if (t === 'string') return 16 + v.length * 2;
    if (t !== 'object') return 8;
    if (depth > 6) return 64;
    if (Array.isArray(v)) { const n = v.length; if (!n) return 32; const k = Math.min(n, 16); let sum = 0; for (let i = 0; i < k; i++) sum += _sizeOf(v[i], depth + 1); return 32 + sum * n / k; }
    let sum = 40;
    for (const k in v) sum += 16 + k.length * 2 + _sizeOf(v[k], depth + 1);
    return sum;
}
let _cacheBytes = 0, _cacheEvictions = 0;
function _setData(e, v) {
    _cacheBytes -= e.bytes || 0;
    e.bytes = _config.cache.maxBytes ? _sizeOf(v) : 0;
    _cacheBytes += e.bytes;
    e.base = v;
    _recompute(e);
    _evictCache();
}
// SIEVE (Zhang et al., NSDI'24): один бит «посещена» на запись, «стрелка» идёт от хвоста; живые (refCount > 0) и pinned не трогаем
let _cHead = null, _cTail = null, _cHand = null, _justAdded = null;
function _cLink(e) { e._prev = null; e._next = _cHead; if (_cHead) _cHead._prev = e; _cHead = e; if (!_cTail) _cTail = e; }
function _cUnlink(e) { if (_cHand === e) _cHand = e._prev; if (e._prev) e._prev._next = e._next; else _cHead = e._next; if (e._next) e._next._prev = e._prev; else _cTail = e._prev; e._prev = e._next = null; }
function _evictCache() {
    const { maxEntries, maxBytes } = _config.cache;
    const over = () => (maxEntries > 0 && _resourceCache.size > maxEntries) || (maxBytes > 0 && _cacheBytes > maxBytes);
    if (!over()) return;
    let scanned = 0;
    const limit = _resourceCache.size * 2 + 2;
    while (over() && scanned++ < limit) {
        let e = _cHand || _cTail;
        if (!e) break;
        const prev = e._prev || _cTail;
        if (e.refCount > 0 || e.pin || e === _justAdded) { _cHand = e._prev; }
        else if (e._v) { e._v = 0; _cHand = e._prev; }
        else { _cHand = e._prev; if (e.prefetched) _ghostAdd(e.key); _dropEntry(e); _cacheEvictions++; }
        if (_cHand === null && prev === e) break;
    }
}
let _sweepTimer = null;
function _armSweep() {
    if (_sweepTimer || typeof setTimeout !== 'function') return;
    _sweepTimer = setTimeout(() => { _sweepTimer = null; if (cache.gc() || _resourceCache.size) { for (const e of _resourceCache.values()) if (e.refCount <= 0 && e._gcAt !== Infinity) { _armSweep(); break; } } }, 60000);
}

/** Кэш подключён к лёгким секциям (dev, request, hydrate) при первом использовании; корни, собранные hydrate() до этого, засеваются здесь */
function _cacheReady() {
    if (_ext.cacheStats) return;
    _ext.cacheStats = () => cache.stats().entries; _ext.evict = _evictCache; _ext.invalidate = invalidate; _ext.prefetch = prefetch; _ext.seedFrom = seedFrom;
    const roots = _ext.seedRoots;
    if (roots) { _ext.seedRoots = null; for (const r of roots) seedFrom(r); }
}
function _cacheEntry(key, initial) {
    _cacheReady();
    let e = _resourceCache.get(key);
    if (e && e.refCount <= 0 && e._gcAt && e._gcAt <= _now()) { _dropEntry(e); e = null; }   // ленивое истечение по cacheTime
    if (e) e._v = 1;
    if (!e) {
        e = {
            key,
            data: signal(initial, `cache:${key}:data`),
            inflight: signal(false, `cache:${key}:inflight`),
            started: signal(initial != null, `cache:${key}:started`),
            error: signal(null, `cache:${key}:error`),
            lastFetch: initial != null ? _now() : 0, // initial — это данные "сейчас", staleTime их уважает
            promise: null,
            controller: null,
            url: null,
            fopts: null,        // последние опции запроса (для invalidate/revalidateOn)
            revalidateOn: null,
            refCount: 0,
            gcTimer: null,
            gen: 0,             // поколение запроса: ответ применяется, только если поколение не сменилось (refresh/invalidate/mutate)
            freshUntil: 0,      // свежесть, выставленная тем, кто положил данные (prefetch/seed/fetch): resource без staleTime её уважает
            tags: null,
            fetches: 0, unchanged: 0, lastChange: 0, lastRead: 0, muHat: 0, lamHat: 0,   // наблюдаемые частоты: изменений (μ̂) и обращений (λ̂), 1/с
            hist: null,         // dev: кольцевой буфер решений { t, reason, result, ms, status }
            prefetched: null,   // вид прогрева ('hover' | 'visible' | 'tap' | 'manual'), пока запись не использована
            _gcAt: 0, _cacheTime: 0,
            bytes: 0, pin: false, _v: 1, _prev: null, _next: null, _el: null, errors: 0, interval: 0,
            etag: null, hdr: null, httpStale: null,
            base: initial, patches: [], parents: null,
            v: 0, sync: true, persist: null, _hydrated: null, _persisted: null,
            _shape: null,       // memo computed'ов для статического ключа (общие между вызовами)
        };
        if ((!globalThis.AEGIS_PROD && _dev()) && typeof key !== 'string') _warn('E038', !globalThis.AEGIS_PROD && {
            what: `resource({ cache }) got a non-string cache key (${Object.prototype.toString.call(key)}).`,
            why: 'Cache keys are canonical strings; an object key never matches another call, so nothing is shared and invalidate() cannot reach it.',
            fix: "Pass a URL, an array key (cache: { key: ['users', id] }) or params — they are normalized for you.",
        }, 'k:' + String(key));
        _resourceCache.set(key, e);
        _cLink(e);
        _justAdded = e; _evictCache(); _justAdded = null;
    }
    return e;
}

function _retainEntry(e) {
    if (e.refCount === 0 && e.prefetched) { if (e.data.peek() != null) _pfOutcome(e.prefetched, true); e.prefetched = null; }   // прогрев пригодился
    if (e.refCount === 0 && _ghost.size) _ghost.delete(e.key);
    e.refCount++;
    e._gcAt = 0;
    if (e.gcTimer) { clearTimeout(e.gcTimer); e.gcTimer = null; }
}

function _dropEntry(e) {
    if (e.prefetched) { _pfOutcome(e.prefetched, false); e.prefetched = null; }   // прогрев пропал зря
    if (e.gcTimer) { clearTimeout(e.gcTimer); e.gcTimer = null; }
    _cacheBytes -= e.bytes || 0; e.bytes = 0;
    _pollUnregister(e);
    if (e._unreg) { e._unreg(); e._unreg = null; }
    if (_resourceCache.get(e.key) === e) { _resourceCache.delete(e.key); _cUnlink(e); }
}
/** Срок жизни незанятой записи: ленивая проверка в _cacheEntry + один sweep-таймер на весь кэш; Infinity — до вытеснения по лимитам */
function _scheduleGC(e, cacheTime) {
    e._cacheTime = cacheTime;
    e._gcAt = cacheTime === Infinity ? Infinity : _now() + cacheTime;
    if (cacheTime !== Infinity) _armSweep();
}

function _releaseEntry(e, cacheTime) {
    if (--e.refCount > 0) return;
    if (e.controller) { e.controller.abort(); e.controller = null; e.promise = null; e.inflight.value = false; }
    _checkCache('release');
    _scheduleGC(e, Math.max(e._cacheTime || 0, cacheTime || 0) || 5 * 60 * 1000);
}

// ---- исходы prefetch: Beta(α,β) с забыванием на вид прогрева — калиброванная P(use | kind) для бюджета предвыборки
const _pf = { fired: 0, used: 0, wasted: 0, kinds: new Map() };
const _pfBeta = (k) => _pf.kinds.get(k) || (_pf.kinds.set(k, { a: 1, b: 1 }), _pf.kinds.get(k));
function _pfOutcome(kind, hit) {
    const st = _pfBeta(kind);
    st.a *= 0.99; st.b *= 0.99;
    if (hit) { st.a++; _pf.used++; } else { st.b++; _pf.wasted++; }
    if ((!globalThis.AEGIS_PROD && _dev()) && st.a + st.b >= 20 && st.a / (st.a + st.b) < 0.2) _warn('E043', !globalThis.AEGIS_PROD && {
        what: `prefetch(${kind}): only ${Math.round(100 * st.a / (st.a + st.b))}% of warmed responses were used (${_pf.wasted} wasted so far).`,
        why: 'The trigger fires far more often than users actually navigate — bandwidth and server load for nothing.',
        fix: "Use { on: 'tap' } instead of hover, raise the hover delay, or prefetch only from a predictor; see cache.stats().prefetch.",
    }, 'pf:' + kind);
}
/** Калиброванная вероятность, что прогрев вида kind пригодится */
const _pUse = (kind) => { const st = _pfBeta(kind); return st.a / (st.a + st.b); };

// dev: история решений записи (кольцевой буфер) + подписчики cache.on()
const _cacheHandlers = new Set();
function _hist(e, ev) {
    if (!(!globalThis.AEGIS_PROD && _dev()) && !_cacheHandlers.size) return null;
    (e.hist || (e.hist = [])).push(ev);
    if (e.hist.length > 20) e.hist.shift();
    for (const h of _cacheHandlers) h(e.key, ev);
    return ev;
}
const _ewma = (old, x, a = 0.7) => old ? a * old + (1 - a) * x : x;

const _netLog = new Map(); // url → { t: number[], owners: Map<id, t> }
let _resId = 0;
/** Dev: дубли одного URL из разных инстансов resource() (окно 100 мс) и штормы (≥10 запросов/с) */
function _devTrackFetch(url, kind, ownerId, site) {
    if (!(!globalThis.AEGIS_PROD && _dev()) || !url) return;
    if (/\/(undefined|null|NaN|\[object)(?=[/?#]|$)|[?&][^=&]*=(undefined|null|NaN|\[object)(?=&|$)/.test(url)) _warn('E035', !globalThis.AEGIS_PROD && {
        site,
        what: `${kind}("${url}") — the URL contains "${RegExp.$1 || RegExp.$2}".`,
        why: 'A parameter was interpolated before it had a value (a missing prop, an unset signal, an object instead of an id).',
        fix: 'Return null from the URL function until the value is ready: () => id.value ? `/api/users/${id.value}` : null — a null URL skips the request.',
    }, 'url:' + url);
    if (/\/(undefined|null|NaN|\[object)(?=[/?#]|$)|[?&][^=&]*=(undefined|null|NaN|\[object)(?=&|$)/.test(url)) _warn('E035', !globalThis.AEGIS_PROD && {
        what: `${kind}("${url}") — the URL contains "${RegExp.$1 || RegExp.$2}".`,
        why: 'A parameter was interpolated before it had a value (a missing prop, an unset signal, an object instead of an id).',
        fix: 'Return null from the URL function until the value is ready: () => id.value ? `/api/users/${id.value}` : null — a null URL skips the request.',
    }, 'url:' + url);
    const now = performance.now();
    let rec = _netLog.get(url);
    if (!rec) { rec = { t: [], owners: new Map() }; _netLog.set(url, rec); if (_netLog.size > 200) _netLog.delete(_netLog.keys().next().value); }
    rec.t.push(now);
    while (rec.t.length && now - rec.t[0] > 1000) rec.t.shift();
    if (kind === 'resource') {
        for (const [id, t] of rec.owners) if (id !== ownerId && now - t < 100) {
            _warn('E029', !globalThis.AEGIS_PROD && {
        site,
                what: `resource("${url}") fetched by two instances within ${Math.round(now - t)} ms.`,
                why: 'resource() has no cache; each instance sends its own request.',
                fix: 'resource(url, { cache: true }) — same signals for the same key, one request.',
            }, 'dup:' + url);
            break;
        }
        rec.owners.set(ownerId, now);
    }
    if (rec.t.length >= 10) _warn('E030', !globalThis.AEGIS_PROD && {
        site,
        what: `"${url}" fetched ${rec.t.length} times in the last second.`,
        why: 'A reactive URL depends on a signal the response writes back (async loop), or a poll() interval is too small.',
        fix: 'Read that signal via untrack()/peek(), or increase the interval.',
    }, 'storm:' + url);
}

/**
 * Запрос для записи кэша. url — URL-строка или params для fopts.loader.
 * Свежесть: max(e.freshUntil, lastFetch + staleTime) — данные, положенные prefetch()/seed(), не перезапрашиваются.
 * force (refresh/invalidate) вытесняет летящий запрос: старый ответ отбрасывается по поколению — invalidate()
 * после мутации никогда не вернёт данные, полученные до неё.
 */
/** staleTime записи: число | 'http' (Cache-Control / Age / Expires ответа; ['http', fallback]) | 'auto' | { auto, k, min, max } (T* = sqrt(2k/(λ̂μ̂)) − 1/λ̂) */
function _staleMs(e, st) {
    if (st == null || st === false) return 0;
    if (typeof st === 'number') return st;
    if (st === 'http' || (Array.isArray(st) && st[0] === 'http')) return e.httpStale != null ? e.httpStale : (Array.isArray(st) ? st[1] || 0 : 0);
    if (st === 'auto' || (typeof st === 'object' && st.auto)) {
        const { k = 20, min = 1000, max = 600000 } = st === 'auto' ? {} : st;
        const lam = e.lamHat, mu = e.muHat;
        if (!lam || !mu) return min;
        const T = Math.sqrt(2 * k / (lam * mu)) - 1 / lam;      // секунды: баланс цены запроса и цены устаревшего чтения
        return Math.min(max, Math.max(min, T * 1000));
    }
    return 0;
}
/** RFC 9111: свежесть из заголовков ответа — max-age (s-maxage) − Age, или Expires − Date; stale-while-revalidate продлевает cacheTime */
function _httpFreshness(h, now) {
    if (!h || !h.get) return null;
    const cc = h.get('cache-control') || '';
    if (/no-store/.test(cc)) return { staleTime: 0, cacheTime: 0, age: 0 };
    const age = +(h.get('age') || 0);
    let maxAge = NaN;
    const m = cc.match(/(?:^|,)\s*(?:s-)?max-age=(\d+)/);
    if (m) maxAge = +m[1];
    else { const d = Date.parse(h.get('expires') || ''), t = Date.parse(h.get('date') || '') || now; if (d) maxAge = Math.max(0, (d - t) / 1000); }
    if (Number.isNaN(maxAge)) return { age };
    const swr = cc.match(/stale-while-revalidate=(\d+)/);
    return { staleTime: maxAge * 1000, cacheTime: (maxAge + (swr ? +swr[1] : 0)) * 1000, age };
}
const _NOT_MODIFIED = /*#__PURE__*/ Symbol('aegis.304');
/** Dev-проверка инвариантов записей кэша после операций (E044) — ловит рассинхрон состояния */
function _checkCache(where) {
    if (!(!globalThis.AEGIS_PROD && _dev())) return;
    {   // бухгалтерия: список SIEVE ⇔ Map, Σ bytes === _cacheBytes, стрелка внутри списка — точный оракул дешевле любого выходного теста
        const bad = []; let n = 0, bytes = 0, handSeen = !_cHand;
        for (let x = _cHead; x; x = x._next) { n++; bytes += x.bytes || 0; if (x === _cHand) handSeen = true; if (_resourceCache.get(x.key) !== x) bad.push('sieve node not in map'); if (x._next && x._next._prev !== x) bad.push('sieve link broken'); if (n > _resourceCache.size + 1) { bad.push('sieve list longer than map (cycle?)'); break; } }
        if (n !== _resourceCache.size) bad.push(`sieve list ${n} ≠ map ${_resourceCache.size}`);
        if (bytes !== _cacheBytes) bad.push(`bytes ledger ${_cacheBytes} ≠ Σ ${bytes}`);
        if (!handSeen) bad.push('sieve hand outside the list');
        if (bad.length) _warn('E044', !globalThis.AEGIS_PROD && { what: `cache ledger broken at ${where}: ${bad.join(', ')}.`, why: 'Internal cache bookkeeping is inconsistent — this is an engine bug, not an application bug.', fix: 'Report it with the steps to reproduce.' }, 'ledger:' + bad[0]);
    }
    for (const e of _resourceCache.values()) {
        const bad = [];
        if (e.refCount < 0) bad.push('refCount < 0');
        if ((e.controller !== null) !== (e.promise !== null)) bad.push('controller/promise desync');
        if (e.inflight.peek() && !e.promise) bad.push('inflight without promise');
        if (e.error.peek() && e.inflight.peek()) bad.push('error while inflight');
        if (e.lastFetch > 0 && !e.started.peek()) bad.push('lastFetch without started');
        if (e.patches.some(p => !p.fn)) bad.push('patch without fn');
        if (bad.length) _warn('E044', !globalThis.AEGIS_PROD && { what: `cache invariant broken at ${where} for "${e.key}": ${bad.join(', ')}.`, why: 'Internal cache state is inconsistent — this is an engine bug.', fix: 'Please report with the steps; cache.remove(key) clears the entry meanwhile.' }, 'inv:' + e.key + ':' + bad[0]);
    }
}
// ---- persist: SWR-запись переживает перезагрузку (IDB store 'swr'), бюджет по байтам, version для инвалидации формата
const _persistStore = () => _offlineStore('aegis-cache', 'swr');
let _persistBudgetTimer = null;
function _persistOpts(p) { return p === true ? { version: 0, maxBytes: 4 << 20, maxAge: 7 * 864e5 } : { version: 0, maxBytes: 4 << 20, maxAge: 7 * 864e5, ...p }; }
const _canZ = typeof CompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function';
async function _zip(str) { return new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
async function _unzip(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
/** Принципал персиста: configure({ cache: { scope: () => userId } }) — записи другого пользователя не гидрируются и не воспроизводятся */
const _scopeId = () => { const f = _config.cache && _config.cache.scope; const v = typeof f === 'function' ? f() : f; return v == null ? '' : String(v); };
const _pk = (key) => _scopeId() + '\0' + key;
const _isPrivate = (hdr) => { if (!hdr || typeof hdr.get !== 'function') return false; const cc = (hdr.get('cache-control') || '').toLowerCase(), vary = (hdr.get('vary') || '').toLowerCase(); return /no-store|private/.test(cc) || /cookie|authorization/.test(vary); };
function _hydrateEntry(e, p) {
    const o = _persistOpts(p);
    return e._hydrated || (e._hydrated = _trackPromise((async () => {
        let rec = null;
        try { rec = await _persistStore().get(_pk(e.key)); } catch (x) { return false; }
        if (!rec || e.started.peek() || e.lastFetch) return false;                  // сеть уже ответила — диск проиграл
        if ((rec.scope || '') !== _scopeId()) { _persistStore().delete(_pk(e.key)).catch(() => {}); return false; }   // чужой принципал
        if (rec.z) { try { rec.data = _safeParse(await _unzip(rec.data)); } catch (x) { _persistStore().delete(_pk(e.key)).catch(() => {}); return false; } }
        if (rec.v !== o.version || (o.maxAge && _now() - rec.at > o.maxAge)) { _persistStore().delete(_pk(e.key)).catch(() => {}); return false; }
        batch(() => { _setData(e, rec.data); e.started.value = true; e.error.value = null; });
        e.lastFetch = rec.at; e.freshUntil = rec.at + (rec.stale || 0); e.etag = rec.etag || null;
        _hist(e, { t: _now(), reason: 'persist', result: 'set' });
        if (e.refCount > 0 && e.url != null && e.fopts && !e.promise && _now() >= Math.max(e.freshUntil, e.lastFetch + _staleMs(e, e.fopts.staleTime))) _fetchEntry(e, e.url, e.fopts, 'mount');
        return true;
    })()));   // settled() ждёт и гидрацию, и запущенный ею первый fetch
}
function _persistWrite(e, p, data) {
    const o = _persistOpts(p);
    if (!o.private && _isPrivate(e.hdr)) { _hist(e, { t: _now(), reason: 'persist', result: 'skipped:private' }); return; }   // Cache-Control: private / no-store / Vary: Cookie — на диск не пишем
    let str; try { str = JSON.stringify(data); } catch (x) { return; }
    const base = { at: e.lastFetch, stale: Math.max(0, e.freshUntil - e.lastFetch), v: o.version, etag: e.etag || null, scope: _scopeId() };
    // CompressionStream (Baseline 2023): gzip 5–10× на JSON-списках, put() как memcpy вместо structured clone дерева; n — байты, не символы
    const write = (_canZ && str.length > 2048)
        ? _zip(str).then(u8 => _persistStore().set(_pk(e.key), { ...base, z: 1, data: u8, n: u8.byteLength }))
        : _persistStore().set(_pk(e.key), { ...base, z: 0, data, n: typeof Blob === 'function' ? new Blob([str]).size : str.length });
    e._persisted = write.then(() => { if (o.maxBytes && !_persistBudgetTimer) _persistBudgetTimer = setTimeout(() => { _persistBudgetTimer = null; _persistBudget(o.maxBytes); }, 2000); }).catch(() => {});
}
async function _persistBudget(maxBytes) {
    try {
        const all = (await _persistStore().getAll()).filter(([k]) => typeof k === 'string' && !k.startsWith('mut:') && k !== _QUEUE_KEY);
        for (const [k, r] of all) if (k.includes('\0') && (r && r.scope || '') !== k.split('\0')[0]) await _persistStore().delete(k);   // инвариант: scope записи = префикс ключа
        let total = 0; for (const [, r] of all) total += (r && r.n) || 0;
        if (total <= maxBytes) return;
        all.sort((a, b) => ((a[1] && a[1].at) || 0) - ((b[1] && b[1].at) || 0));
        for (const [k, r] of all) { if (total <= maxBytes * 0.8) break; await _persistStore().delete(k); total -= (r && r.n) || 0; }
    } catch (x) { /* нет IDB */ }
}

// ---- шина между вкладками: set/inv с Lamport-меткой (v, tab) — LWW, data едет только если fopts.sync !== false
const _tabId = /* @__PURE__ */ Math.random().toString(36).slice(2, 8);
let _bc = null;
function _chan() {
    if (_bc !== null) return _bc;
    if (typeof BroadcastChannel !== 'function') return (_bc = false);
    _bc = new BroadcastChannel('aegis:cache');
    _bc.onmessage = (ev) => {
        const m = ev.data; if (!m || m.tab === _tabId) return;
        const e = _resourceCache.get(m.key); if (!e) return;
        if (m.t === 'set') {
            if (m.v > e.v || (m.v === e.v && m.tab > _tabId)) {
                e.v = m.v; e.gen++;
                batch(() => { _setData(e, m.data); e.error.value = null; e.started.value = true; });
                e.lastFetch = m.lastFetch; e.freshUntil = m.freshUntil || 0; e.etag = m.etag || null;
                _hist(e, { t: _now(), reason: 'tab', result: 'set' });
            }
        } else if (m.t === 'inv') {
            e.lastFetch = 0; e.freshUntil = 0;
            _hist(e, { t: _now(), reason: 'tab', result: 'inv' });
            if (e.refCount > 0 && e.url != null && e.fopts && (typeof document === 'undefined' || document.visibilityState === 'visible')) _fetchEntry(e, e.url, e.fopts, 'invalidate');
        }
    };
    return _bc;
}
function _bcPost(msg) { const c = _chan(); if (c) { try { c.postMessage({ ...msg, tab: _tabId }); } catch (x) { /* не клонируется */ } } }
const _FORCE = new Set(['refresh', 'invalidate']);
function _fetchEntry(e, url, fopts, reason = 'mount') {
    if (reason === true) reason = 'refresh'; else if (reason === false) reason = 'mount';
    const force = _FORCE.has(reason);
    if (url == null || url === false || url === '') return Promise.resolve();
    if (typeof url === 'string') _devTrackFetch(url, 'cache', undefined, fopts.site);
    e.url = url;
    e.fopts = fopts;
    const now = _now();
    if (e.lastRead) e.lamHat = _ewma(e.lamHat, 1000 / Math.max(1, now - e.lastRead));   // частота обращений
    e.lastRead = now;
    if (!force && now < Math.max(e.freshUntil, e.lastFetch + _staleMs(e, fopts.staleTime))) { _hist(e, { t: now, reason, result: 'fresh' }); return Promise.resolve(); }
    if (e.promise && !force) { _hist(e, { t: now, reason, result: 'joined' }); return e.promise; }   // dedupe: присоединяемся к летящему
    if (e.controller) e.controller.abort();                           // force: вытеснить летящий
    const ev = _hist(e, { t: now, reason, result: 'fetch' });

    batch(() => { e.inflight.value = true; e.started.value = true; e.error.value = null; });
    const controller = new AbortController();
    const gen = ++e.gen;
    e.controller = controller;
    const fetcher = fopts.fetcher || _fetcher();
    // без своего fetcher/loader идём через request() с raw-ответом: ETag → If-None-Match → 304 (тело не качается, свежесть продлевается), заголовки → staleTime: 'http'
    const viaHttp = !fopts.fetcher && !fopts.loader && !defaults.fetcher && typeof url === 'string';
    const attempt = fopts.loader ? () => fopts.loader({ params: url, signal: controller.signal })
        : viaHttp ? async () => {
            const r = await request(url, { signal: controller.signal, raw: true, headers: e.etag ? { 'If-None-Match': e.etag } : undefined });
            if (r.status === 304) return _NOT_MODIFIED;
            const body = await _parseBody(r);
            if (!r.ok) { const err = new HttpError(r.status, r, body); if (_config.onError) _config.onError(err, { url, status: r.status }); throw err; }
            e.etag = r.headers.get('etag') || null;
            e.hdr = r.headers;
            return body;
        }
        : () => fetcher(url, { signal: controller.signal });
    e.promise = _trackPromise((async () => {
        try {
            const result = await withRetry(attempt, {
                retries: _retries(fopts.retry), signal: controller.signal,
                shouldRetry: typeof fopts.retry === 'function' ? fopts.retry : undefined,
            });
            if (controller.signal.aborted || gen !== e.gen) return;     // устаревшее поколение — игнор
            if (result === _NOT_MODIFIED) {                                 // 304: данные те же, продлить свежесть
                const t3 = _now();
                e.lastFetch = t3; e.fetches++; e.unchanged++;
                const hf = fopts.staleTime === 'http' || (Array.isArray(fopts.staleTime) && fopts.staleTime[0] === 'http') ? _httpFreshness(e.hdr, t3) : null;
                if (hf && hf.staleTime != null) e.httpStale = hf.staleTime;
                e.freshUntil = t3 - (hf ? hf.age * 1000 : 0) + _staleMs(e, fopts.staleTime);
                if (ev) { ev.ms = t3 - ev.t; ev.status = '304'; ev.changed = false; }
                return;
            }
            const next = fopts.transform ? fopts.transform(result) : result;
            const prev = e.base;
            const shared = fopts.share === false ? next : _share(prev, next, fopts.share);
            const t1 = _now();
            _setData(e, shared);
            e.errors = 0;
            e.lastFetch = t1;
            const hf = e.hdr && (fopts.staleTime === 'http' || fopts.cacheTime === 'http' || (Array.isArray(fopts.staleTime) && fopts.staleTime[0] === 'http')) ? _httpFreshness(e.hdr, t1) : null;
            if (hf) { if (hf.staleTime != null) e.httpStale = hf.staleTime; if (hf.age) e.lastFetch = t1 - hf.age * 1000; if (fopts.cacheTime === 'http' && hf.cacheTime != null) e._cacheTime = hf.cacheTime; }
            e.freshUntil = e.lastFetch + _staleMs(e, fopts.staleTime);
            e.fetches++;
            e.rtt = e.rtt ? 0.7 * e.rtt + 0.3 * (t1 - now) : (t1 - now);       // EMA длительности запроса — для порога полезности прогрева
            if (prev == null || shared !== prev) {                          // identity == «не изменилось»
                if (e.lastChange) e.muHat = _ewma(e.muHat, 1000 / Math.max(1, t1 - e.lastChange));
                e.lastChange = t1;
            } else {
                e.unchanged++;
                if (e.lastChange && t1 - e.lastChange >= 1000) { const bound = 1000 / (t1 - e.lastChange); if (!e.muHat || bound < e.muHat) e.muHat = _ewma(e.muHat, bound); }
            }
            if (ev) { ev.ms = t1 - ev.t; ev.status = 'ok'; ev.changed = shared !== prev; }
            e.v++;
            if (e.persist) _persistWrite(e, e.persist, shared);
            if (e.sync && fopts.sync !== false) _bcPost({ t: 'set', key: e.key, data: shared, v: e.v, lastFetch: e.lastFetch, freshUntil: e.freshUntil, etag: e.etag });
            if (fopts.seeds) { let list = null; try { list = fopts.seeds(shared); } catch (x) { /* */ } if (list) for (const [ck, item] of list) { const c = seed(ck, item, { age: 0, staleTime: _staleMs(e, fopts.staleTime) }); if (c) { c.etag = null; (c.parents || (c.parents = new Set())).add(e.key); } } }
            if (fopts.entity && _config.identify) { const ek = _config.identify(shared); if (ek) cache.patchEntity(ek, () => shared, e); }
            if ((!globalThis.AEGIS_PROD && _dev()) && e.fetches >= 10 && e.unchanged / e.fetches >= 0.9 && typeof fopts.staleTime === 'number' && fopts.staleTime < 30000) _warn('E042', !globalThis.AEGIS_PROD && {
                what: `"${e.key}": ${e.unchanged} of ${e.fetches} revalidations returned identical data.`,
                why: `Observed change interval ≈ ${e.muHat ? Math.round(1 / e.muHat) : '∞'} s, but staleTime is ${fopts.staleTime || 0} ms — the client keeps asking for what it already has.`,
                fix: `staleTime: ${Math.max(30000, e.muHat ? Math.round(100 / e.muHat) * 1000 : 60000)} (≈5% stale reads) or staleTime: 'auto'; see cache.explain(key).`,
            }, 'stale:' + e.key);
        } catch (err) {
            if (ev) { ev.ms = _now() - ev.t; ev.status = 'error'; }
            if (err?.name !== 'AbortError' && !controller.signal.aborted && gen === e.gen) { e.error.value = err; e.errors++; }
        } finally {
            if (e.controller === controller) { e.controller = null; e.promise = null; e.inflight.value = false; }
            _checkCache('fetch');
        }
    })());
    return e.promise;
}

// ---- revalidateOn: один модульный listener на все cached-ресурсы -------------------

// ---- Планировщик ревалидации: одна точка для focus / reconnect / interval / visible ----------------------------
// token bucket на причину (лишние события дропаются без trailing), склейка в один microtask, приоритет по видимости
// и возрасту (правило Смита: сначала то, что видно и давно не обновлялось), ограничение параллелизма, стаггер между
// стартами, джиттер на reconnect (защита сервера от «стада»), накопление причин в скрытой вкладке и flush на visible.
let _revalidateInstalled = false;
const _regs = new Set();            // { on: Set<reason>, due(now), prio(now), fire(reason) } — cached entries и plain resources
const _buckets = {};
const _deferred = new Set();
let _pendingReasons = new Set(), _drainQueued = false, _running = 0;
const _runQueue = [];
function _take(reason, now) {
    const refill = _config.revalidate[reason];
    if (!refill) return true;
    const b = _buckets[reason] || (_buckets[reason] = { tokens: 1, t: now });
    b.tokens = Math.min(1, b.tokens + (now - b.t) / refill); b.t = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
}
function _hostEl() { for (let sc = _currentScope; sc; sc = sc.parent) if (sc.el) return sc.el; return null; }
function _visibility(el) {
    if (!el || !el.isConnected) return 0.5;
    if (el.checkVisibility && !el.checkVisibility()) return 0;
    const r = el.getBoundingClientRect();
    return (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) ? 1 : 0.25;
}
function _schedule(reason) {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') { _deferred.add(reason); return; }
    const now = _now();
    if (!_take(reason, now)) return;
    _pendingReasons.add(reason);
    if (!_drainQueued) {
        _drainQueued = true;
        const delay = reason === 'reconnect' ? Math.random() * (_config.revalidate.reconnectJitter || 0) : 0;
        if (delay) setTimeout(_drain, delay); else queueMicrotask(_drain);
    }
}
function _drain() {
    _drainQueued = false;
    const reasons = _pendingReasons; _pendingReasons = new Set();
    const now = _now();
    const cands = [];
    for (const r of _regs) for (const reason of reasons) if (r.on.has(reason) && r.due(now, reason)) { cands.push([r, reason, r.prio(now)]); break; }
    cands.sort((a, b) => b[2] - a[2]);
    if ((!globalThis.AEGIS_PROD && _dev()) && cands.length >= 20) _warn('E041', !globalThis.AEGIS_PROD && {
        what: `revalidation: ${cands.length} resources queued at once on "${[...reasons].join(', ')}".`,
        why: 'Every mounted resource with revalidateOn/refetch and an expired staleTime fires together — the scheduler paces them, but the server still gets all of them.',
        fix: 'Raise staleTime on slow-changing data, or set revalidateOn: [] where mutation({ invalidates }) already keeps it fresh.',
    }, 'herd');
    for (const c of cands) _runQueue.push(c);
    _pump();
}
function _pump() {
    const K = _config.revalidate.concurrency || 6, stagger = _config.revalidate.stagger || 0;
    while (_running < K && _runQueue.length) {
        const [r, reason] = _runQueue.shift();
        _running++;
        Promise.resolve().then(() => r.fire(reason)).catch(() => {}).finally(() => { _running--; if (_runQueue.length) { if (stagger) setTimeout(_pump, stagger); else _pump(); } });
        if (stagger && _runQueue.length) { setTimeout(_pump, stagger); return; }
    }
}
function _installRevalidate() {
    if (_revalidateInstalled || typeof document === 'undefined') return;
    _revalidateInstalled = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const rs = ['focus', ..._deferred]; _deferred.clear();
        for (const r of rs) _schedule(r);
        _pollWake();
    });
    window.addEventListener('focus', () => _schedule('focus'));
    window.addEventListener('online', () => { if (navigator.onLine !== false) _schedule('reconnect'); });
    window.addEventListener('offline', () => { if (_buckets.reconnect) _buckets.reconnect.tokens = 1; });   // разрыв гарантирует свежий токен
}
/** Регистрация участника планировщика; возвращает unregister */
function _schedRegister(reg) { _installRevalidate(); _regs.add(reg); return () => { _regs.delete(reg); }; }
/** Cached entry как участник: due = свежесть истекла и нет запроса; prio = (1 + видимость) × возраст / staleTime */
function _entryReg(e) {
    return e._reg || (e._reg = {
        on: new Set(e.revalidateOn || []),
        due: (now) => e.refCount > 0 && e.url != null && !!e.fopts && !e.promise && now >= Math.max(e.freshUntil, e.lastFetch + _staleMs(e, e.fopts.staleTime)),
        prio: (now) => (1 + _visibility(e._el)) * (now - e.lastFetch) / Math.max(e.fopts ? _staleMs(e, e.fopts.staleTime) : 0, 1000),
        fire: (reason) => _fetchEntry(e, e.url, e.fopts, reason),
    });
}

// ---- poll-хаб: один таймер на все cached-ресурсы с interval, выравнивание к сетке 1 с, сон в скрытой вкладке, backoff при ошибках
const _polls = [];                  // { e, due }
let _pollTimer = null;
const _POLL_GRID = 1000;
function _pollInterval(e) {
    const iv = typeof e.interval === 'function' ? e.interval(e.data.peek()) : e.interval;
    if (!iv || iv <= 0) return 0;
    const back = e.errors ? Math.min(2 ** e.errors, 60) * (0.75 + Math.random() * 0.5) : 1;
    return iv * back;
}
function _pollDue(e, now) {
    const T = _pollInterval(e);
    if (!T) return Infinity;
    return Math.ceil((Math.max(e.lastFetch, now - T) + T) / _POLL_GRID) * _POLL_GRID;
}
function _pollArm() {
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
    if (!_polls.length) return;
    if (typeof document !== 'undefined' && document.hidden && !_polls.some(p => p.e.background)) return;
    _polls.sort((a, b) => a.due - b.due);
    const wait = Math.max(0, _polls[0].due - _now());
    if (wait === Infinity) return;
    _pollTimer = setTimeout(_pollTick, Math.min(wait, 2147483647));
}
function _pollTick() {
    _pollTimer = null;
    const now = _now();
    for (const p of _polls) {
        if (p.due <= now) {
            if (p.e.refCount > 0 && !p.e.promise && p.e.url != null && p.e.fopts && (!document.hidden || p.e.background)) _runQueue.push([_entryReg(p.e), 'interval', 0]);
            p.due = _pollDue(p.e, now + 1);
        }
    }
    if (_runQueue.length) _pump();
    _pollArm();
}
function _pollWake() { const now = _now(); for (const p of _polls) p.due = _pollDue(p.e, now); _pollTick(); }
function _pollRegister(e) { if (!_polls.some(p => p.e === e)) { _polls.push({ e, due: _pollDue(e, _now()) }); _pollArm(); } }
function _pollUnregister(e) { const i = _polls.findIndex(p => p.e === e); if (i >= 0) { _polls.splice(i, 1); _pollArm(); } }

/**
 * Положить данные в кэш вручную — ответ мутации, серверный payload.
 * @param {string} key — ключ (обычно URL)
 * @param {*} data
 * @param {{ age?: number }} [opts] — возраст данных в мс (для staleTime)
 */
export function seed(key, data, { age = 0, staleTime = 0 } = {}) {
    const e = _cacheEntry(_normKey(key), null);
    e.gen++;                                                           // seed побеждает летящий запрос
    batch(() => { _setData(e, data); e.error.value = null; e.started.value = true; });
    e.lastFetch = _now() - age;
    e.freshUntil = e.lastFetch + staleTime;
    _hist(e, { t: _now(), reason: 'seed', result: 'set' });
    if (e.refCount <= 0 && !e.gcTimer) _scheduleGC(e, 5 * 60 * 1000);
    return e;
}

/**
 * Засеять кэш из серверного HTML — ноль запросов на первом рендере:
 *   <script type="application/json" data-aegis-cache="/api/users?page=1" data-aegis-age="120">[…]</script>
 * Идемпотентна (помечает data-aegis-seeded); hydrate() вызывает её сама.
 * @returns {number} сколько записей засеяно
 */
export function seedFrom(root = document) {
    _cacheReady();
    let n = 0;
    const sel = 'script[type="application/json"][data-aegis-cache]:not([data-aegis-seeded])';
    for (const sc of root.querySelectorAll(sel)) {
        sc.dataset.aegisSeeded = '1';
        try {
            const en = seed(sc.dataset.aegisCache, _safeParse(sc.textContent), { age: +sc.dataset.aegisAge || 0, staleTime: sc.dataset.aegisMaxAge != null ? +sc.dataset.aegisMaxAge * 1000 : 0 });
            if (sc.dataset.aegisEtag && en) en.etag = sc.dataset.aegisEtag;
            n++;
        } catch (e) {
            _warn('E007', !globalThis.AEGIS_PROD && {
                what: `seedFrom: invalid JSON in data-aegis-cache="${sc.dataset.aegisCache}".`,
                why: 'The payload could not be parsed, so the resource will fetch instead.',
                fix: 'Serialize with JSON and escape "</script" as "<\\/script".',
            });
        }
    }
    // prior предиктора: <script type="application/json" data-aegis-predict="/users/:id">{"/users/:id/orders":0.52,…}</script>
    for (const sc of root.querySelectorAll('script[type="application/json"][data-aegis-predict]:not([data-aegis-seeded])')) {
        sc.dataset.aegisSeeded = '1';
        try { _predPrior.set(sc.dataset.aegisPredict, _safeParse(sc.textContent)); n++; } catch (e) { /* невалидный prior — игнор */ }
    }
    return n;
}

// ── Бюджет сети: одна точка правды для всех спекуляций (prefetch, preload маршрута, predict, острова) ──
const _spec = { inflight: 0, queued: [], fired: 0, skipped: 0, aborted: 0 };
/** Выполнить спекулятивный запрос в рамках бюджета: сверх лимита — очередь (≤ 8, LIFO-вытеснение старых), без бюджета — пропуск */
function _speculate(run) {
    const b = _netBudget();
    if (!b.speculate) { _spec.skipped++; return Promise.resolve(); }
    if (_spec.inflight >= b.max) { _spec.queued.push(run); if (_spec.queued.length > 8) { _spec.queued.shift(); _spec.skipped++; } return Promise.resolve(); }
    _spec.inflight++; _spec.fired++;
    const done = () => { _spec.inflight--; const n = _spec.queued.shift(); if (n) _speculate(n); };
    let p; try { p = Promise.resolve(run()); } catch (e) { p = Promise.reject(e); }
    return p.then((v) => { done(); return v; }, () => { done(); });
}
/** Полезность прогрева (мс сэкономленной латентности минус цена сети): p·min(rtt, horizon) − (передача + фикс) */
function _utility(e, p) {
    const pf = _config.prefetch || {};
    const c = (typeof navigator !== 'undefined' && navigator.connection) || {};
    if (c.saveData) return -Infinity;
    const bytes = (e && e.bytes) || pf.bytes || 8192, rtt = (e && e.rtt) || pf.rtt || 200;
    const xfer = bytes * 8 / ((c.downlink || 5) * 1000);
    const fixed = pf.fixedCost ?? (/3g/.test(c.effectiveType || '') ? 40 : 10);
    return p * Math.min(rtt, pf.horizon ?? 1500) - (xfer + fixed);
}
const _idle = (fn) => typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 1);

// ── Ghost-список: ключи, вытесненные так и не использованными после прогрева — hover по тем же строкам не греет повторно ──
const _ghost = new Map();
function _ghostAdd(key) { _ghost.set(key, 1); if (_ghost.size > (_config.cache.maxEntries || 500)) _ghost.delete(_ghost.keys().next().value); }

// ── Адаптивная задержка hover: две затухающие гистограммы dwell (клик / не клик), d* максимизирует p·min(rtt, dwell−d) − (1−p)·cost ──
const _HB = [0, 40, 65, 80, 100, 130, 170, 220, 300, 400, 550, 750, 1000];
const _hov = { c: new Float32Array(13), n: new Float32Array(13), k: 0, d: 80 };
function _hoverObserve(dwell, clicked) {
    for (let i = 0; i < 13; i++) { _hov.c[i] *= 0.999; _hov.n[i] *= 0.999; }
    let b = 0; while (b < 12 && _HB[b + 1] <= dwell) b++;
    (clicked ? _hov.c : _hov.n)[b]++;
    if (++_hov.k % 50 === 0) _hov.d = _hoverChoose();
}
function _hoverChoose(rtt = 220, cost = 40) {
    let best = -Infinity, bd = 80;
    for (const d of _HB) {
        let u = 0;
        for (let i = 0; i < 13; i++) { const mid = i < 12 ? (_HB[i] + _HB[i + 1]) / 2 : 1300; if (mid < d) continue; u += _hov.c[i] * Math.min(rtt, mid - d) - _hov.n[i] * cost; }
        if (u > best) { best = u; bd = d; }
    }
    return bd;
}

/**
 * Единый детектор намерения для prefetchOn / router preload / boost prefetch / speculate():
 *   hover — pointerover запоминает (x, y, t); замедление курсора (< vmax px/s) стреляет сразу, иначе через delay; pointerout отменяет
 *   tap — pointerdown; visible — общий IntersectionObserver (rootMargin 'auto' — по скорости скролла)
 * Один элемент не греется чаще раза в 30 с. self: true — если ничего не совпало с sel, целью считается сам root.
 */
function _intent(root, sel, fire, { on: mode = 'hover', delay = 80, vmax = 300, rootMargin = '200px', self = false } = {}) {
    const seen = new WeakMap();
    const go = (el) => { const u = seen.get(el), t = Date.now(); if (u && u > t) return; seen.set(el, t + 30000); fire(el); };
    const pick = (e) => (e.target && e.target.closest ? e.target.closest(sel) : null) || (self ? root : null);
    if (mode === 'visible') {
        if (typeof IntersectionObserver === 'undefined') return () => {};
        const io = _sharedIO(_warmMargin(rootMargin));
        const els = root.matches && root.matches(sel) ? [root] : [...(root.querySelectorAll ? root.querySelectorAll(sel) : [])];
        if (!els.length && self) els.push(root);
        for (const el of els) io.watch(el, () => go(el));
        return () => { for (const el of els) io.unwatch(el); };
    }
    if (mode === 'tap') return on(root, 'pointerdown', (e) => { const el = pick(e); if (el) go(el); }, { passive: true });
    let timer = null, cur = null, px = 0, py = 0, pt = 0, t0 = 0;
    const now = (e) => e.timeStamp || performance.now();
    const dl = () => delay === 'auto' ? _hov.d : delay;
    const arm = (e) => {
        const el = pick(e); if (!el) return;
        if (el === cur && timer) return;
        cur = el; px = e.clientX || 0; py = e.clientY || 0; pt = t0 = now(e);
        clearTimeout(timer); timer = setTimeout(() => { timer = null; go(el); }, dl());
    };
    const move = (e) => {
        if (!cur || !timer) return;
        const t = now(e), dt = t - pt || 1;
        const v = Math.hypot((e.clientX || 0) - px, (e.clientY || 0) - py) / dt * 1000;
        px = e.clientX || 0; py = e.clientY || 0; pt = t;
        if (v < vmax && t - t0 >= 20) { clearTimeout(timer); timer = null; go(cur); }   // замедлился — целится
    };
    const out = (e) => {
        if (!cur) return;
        if (e.relatedTarget && cur.contains && cur.contains(e.relatedTarget)) return;
        if (delay === 'auto' && t0) _hoverObserve(now(e) - t0, false);
        clearTimeout(timer); timer = null; cur = null;
    };
    const down = (e) => { const el = pick(e); if (!el) return; if (delay === 'auto' && cur === el && t0) _hoverObserve(now(e) - t0, true); clearTimeout(timer); timer = null; go(el); };
    const ds = [on(root, 'pointerover', arm, { passive: true }), on(root, 'pointermove', move, { passive: true }), on(root, 'pointerout', out), on(root, 'focusin', arm), on(root, 'focusout', out), on(root, 'pointerdown', down, { passive: true })];
    return () => ds.forEach(d => d());
}

// ── Предиктор переходов: марковская цепь 1-го порядка по паттернам маршрутов, забывание, серверный prior, localStorage ──
const _predPrior = new Map();   // pattern → { pattern: p } — из <script data-aegis-predict> или pred.prior()
/**
 * predictor({ decay, alpha, kappa, storage, key, max }) → { learn(from, to), next(from, candidates), p(from, to), prior(from, map), reset() }
 *   const pred = predictor(); router(routes, { predict: { predictor: pred, topK: 2, minP: 0.3 } });
 * next() ранжирует кандидатов: (счётчик·decay^age + kappa·prior + alpha) / (n + kappa + alpha·|cand|).
 */
export function predictor({ decay = 0.95, alpha = 0.5, kappa = 5, storage = typeof localStorage !== 'undefined' ? localStorage : null, key = 'aegis:predict', max = 200 } = {}) {
    const R = new Map();
    const P = new Map();          // prior этого инстанса; глобальный _predPrior (seedFrom) — запасной
    let saveT = null;
    if (storage) { try { const raw = _safeParse(storage.getItem(key) || 'null'); if (raw && raw.g) for (const f in raw.g) R.set(f, new Map(Object.entries(raw.g[f]))); } catch (e) { /* пусто */ } }
    const save = () => {
        if (!storage || saveT) return;
        saveT = setTimeout(() => { saveT = null; const g = {}; for (const [f, row] of R) g[f] = Object.fromEntries(row); try { storage.setItem(key, JSON.stringify({ t: Date.now(), g })); } catch (e) { /* квота */ } }, 50);
    };
    const learn = (from, to) => {
        if (!from || !to || from === to) return;
        let row = R.get(from);
        if (!row) { R.set(from, row = new Map()); if (R.size > max) R.delete(R.keys().next().value); }
        for (const [k, w] of row) row.set(k, w * decay);
        row.set(to, (row.get(to) || 0) + 1);
        if (row.size > 16) { let mk = null, mw = Infinity; for (const [k, w] of row) if (w < mw) { mw = w; mk = k; } row.delete(mk); }
        save();
    };
    const next = (from, candidates) => {
        const row = R.get(from) || new Map(), prior = P.get(from) || _predPrior.get(from) || {};
        let n = 0; for (const w of row.values()) n += w;
        const Z = n + kappa + alpha * candidates.length;
        return candidates.map(c => ({ key: c, p: ((row.get(c) || 0) + kappa * (prior[c] || 0) + alpha) / Z })).sort((a, b) => b.p - a.p);
    };
    return {
        learn, next,
        p: (from, to) => next(from, [to])[0].p,
        prior: (from, m) => { P.set(from, m); },
        reset: () => { R.clear(); P.clear(); if (storage) { try { storage.removeItem(key); } catch (e) { /* */ } } },
        rows: () => R,
    };
}
/** Нормализация путей без роутера (boost / MPA): числа и хэши → :id */
const _predKey = (p) => String(p).replace(/\/(\d+|[0-9a-f]{8,})(?=\/|$)/g, '/:id');

/**
 * Прогреть кэш без подписчиков: hover по ссылке, приближение к viewport.
 * Данные лежат cacheTime (5 мин) и достаются resource(url, { cache: true }) мгновенно.
 * Подчиняется бюджету сети (configure({ speculation })); { p } — вероятность использования: прогрев только при положительной полезности;
 * { kind } — вид триггера для статистики; { force: true } — мимо бюджета.
 */
export function prefetch(url, opts = {}) {
    const key = _normKey(opts.key ?? url);
    const kind = opts.kind || 'manual';
    if ((kind === 'hover' || kind === 'visible' || kind === 'predict') && _ghost.has(key)) { _spec.skipped++; return Promise.resolve(); }   // уже грели впустую
    const e = _cacheEntry(key, null);
    if (opts.p != null && _utility(e, opts.p) <= ((_config.prefetch && _config.prefetch.minUtility) ?? 0)) { _spec.skipped++; _hist(e, { t: _now(), reason: 'prefetch', result: 'skip' }); return Promise.resolve(); }
    const fetcher = opts.fetcher || ((u, o) => _fetcher()(u, { ...o, priority: 'low' }));
    const run = () => {
        if (e.refCount <= 0 && e.data.peek() == null) { e.prefetched = kind; _pf.fired++; }
        const p = _fetchEntry(e, url, { fetcher, transform: opts.transform, staleTime: opts.staleTime ?? 30000, share: opts.share, retry: opts.retry }, 'prefetch');
        if (e.refCount <= 0 && !e.gcTimer) _scheduleGC(e, opts.cacheTime ?? 5 * 60 * 1000);
        return p;
    };
    return opts.force ? run() : _speculate(run);
}

/**
 * Прогрев по намерению пользователя: hover (pointerover/focusin, 80 мс задержки), tap (pointerdown), visible.
 *   prefetchOn(link, '/api/users/42', { on: 'hover' })
 *   prefetchOn(list, (a) => a.dataset.api, { on: 'hover' })     — делегирование: el содержит много ссылок
 * При saveData / 2g — только tap. Возвращает dispose, регистрируется в scope.
 */
export function prefetchOn(el, urlOrFn, { on: mode = 'hover', rootMargin = '200px', delay, velocity, p, ...opts } = {}) {
    if (mode !== 'tap' && !_netBudget().speculate) mode = 'tap';           // saveData / 2g / reduced-data → только явное намерение
    const urlFor = (target) => typeof urlOrFn === 'function' ? urlOrFn(target) : urlOrFn;
    const fire = (target) => { const u = urlFor(target); if (u) prefetch(u, { ...opts, kind: opts.kind || mode, p: typeof p === 'function' ? p(target) : p, force: mode === 'tap' }); };
    return _intent(el, 'a,[data-api],[data-prefetch]', fire, { on: mode, delay: delay ?? ((_config.prefetch && _config.prefetch.hoverDelay) ?? 80), vmax: velocity ?? 300, rootMargin, self: true });
}

/**
 * SWR-движок: вызовы с одним ключом делят ОДИН fetch и ОДИН набор сигналов.
 * Ключ по умолчанию — URL. Для реактивного source у каждого URL своя entry,
 * data/loading/error — computed поверх текущей; keepPrevious держит старые данные,
 * пока грузятся новые (stale = true — dimming вместо мигания).
 */
function _cachedResource(source, opts = {}) {
    const {
        key: explicitKey,
        initial = null,
        transform,
        fetcher,
        immediate = true,
        staleTime = 0,
        cacheTime = 5 * 60 * 1000,
        revalidateOn = ['focus', 'reconnect'],
        retry,
        share,
        interval = 0,
        background = false,
        pin = false,
        persist = null,
        sync = true,
    } = opts;
    const hostEl = _hostEl();
    const loader = source && typeof source === 'object' && typeof source.loader === 'function' ? source.loader : null;
    const paramsFn = loader ? (typeof source.params === 'function' ? source.params : () => source.params) : null;
    const keyIsReactive = typeof explicitKey === 'function' || (Array.isArray(explicitKey) && explicitKey.some(p => typeof p === 'function'));
    const isStatic = !keyIsReactive && (explicitKey != null || (loader ? typeof source.params !== 'function' : typeof source !== 'function'));
    const keepPrevious = opts.keepPrevious ?? !isStatic;
    if ((!globalThis.AEGIS_PROD && _dev()) && typeof staleTime === 'number' && typeof cacheTime === 'number' && staleTime > cacheTime && cacheTime !== Infinity) _warn('E039', !globalThis.AEGIS_PROD && {
        what: `resource({ cache }): staleTime ${staleTime} ms > cacheTime ${cacheTime} ms.`,
        why: 'The entry is garbage-collected while it is still fresh, so every remount fetches again.',
        fix: 'Set cacheTime >= staleTime (or cacheTime: Infinity for reference data).',
    }, 'sc:' + String(explicitKey ?? source));

    const resolveUrl = () => loader ? paramsFn() : (typeof source === 'function' ? source() : source);
    const keyFor = (arg) => _normKey(explicitKey == null ? arg : (typeof explicitKey === 'function' ? explicitKey() : explicitKey));
    const fopts = { fetcher, transform, staleTime, cacheTime, retry, share, loader, seeds: opts.seeds, entity: opts.entity, sync, site: (!globalThis.AEGIS_PROD && _dev()) ? _callSite() : null };
    const current = signal(null, 'cachedResource:entry');
    let prevEntry = null;
    let url = null;

    /** Переключиться на entry для URL (refCount старой уменьшается) */
    const use = (nextUrl) => {
        const e = _cacheEntry(keyFor(nextUrl), initial);
        e.revalidateOn = revalidateOn;
        if (opts.tags) e.tags = [].concat(opts.tags);
        if (pin) e.pin = true;
        if (!sync) e.sync = false;
        if (persist) { e.persist = persist; if (typeof indexedDB !== 'undefined') _hydrateEntry(e, persist); }
        if (hostEl) e._el = hostEl;
        if (revalidateOn && revalidateOn.length) { _entryReg(e); for (const r of revalidateOn) e._reg.on.add(r); e._unreg = e._unreg || _schedRegister(e._reg); }
        if (interval) { e.interval = interval; e.background = background; e._v = 1; _pollRegister(e); }
        const prev = current.peek();
        if (e !== prev) {
            _retainEntry(e);
            e._cacheTime = Math.max(e._cacheTime || 0, cacheTime);   // запись живёт столько, сколько просил самый долгий подписчик
            if (prev) _releaseEntry(prev, cacheTime);
            prevEntry = prev;
            current.value = e;
        }
        url = nextUrl;
        return e;
    };

    const refresh = () => _fetchEntry(use(resolveUrl()), url, fopts, 'refresh');
    const mutate = (fn) => {
        const e = current.peek() || use(resolveUrl());
        e.gen++;                                                       // оптимистичная запись побеждает запрос, стартовавший раньше
        _applyMutate(e, fn);
    };
    const abort = () => { const e = current.peek(); if (e && e.controller) { e.controller.abort(); e.controller = null; e.promise = null; e.inflight.value = false; } };
    const dispose = () => { const e = current.peek(); if (e) { _releaseEntry(e, cacheTime); } };
    if (_currentScope) _currentScope.onDispose(dispose);

    const start = (e, u) => {
        if (e.persist && e._hydrated && !e.started.peek() && !e.lastFetch) e._hydrated.then((hyd) => { if (!hyd && current.peek() === e) _fetchEntry(e, u, fopts, 'mount'); });
        else _fetchEntry(e, u, fopts, 'mount');
    };
    if (isStatic) {
        // Сигналы entry напрямую: r1.data === r2.data при одном ключе
        const e = use(resolveUrl());
        if (immediate) start(e, url);
        if (!e._shape) {
            e._shape = _resultShape({
                data: e.data, inflight: e.inflight, started: e.started, error: e.error,
                key: computed(() => e.key), refresh: () => _fetchEntry(e, e.url || url, e.fopts || fopts, 'refresh'),
                mutate: (fn) => { e.gen++; _applyMutate(e, fn); },
                abort: () => { if (e.controller) { e.controller.abort(); e.controller = null; e.promise = null; e.inflight.value = false; } },
                promise: () => e.promise, dispose: () => {},
            });
        }
        // dispose привязан к этому вызову (refCount), остальное — общее
        return { ...e._shape, dispose, [Symbol.dispose]: dispose };
    }

    // Реактивный URL → computed поверх текущей entry
    const data = computed(() => {
        const e = current.value;
        const v = e ? e.data.value : initial;
        if (v !== null || !keepPrevious || !prevEntry) return v;
        return prevEntry.data.peek();
    }, 'cachedResource:data');
    const stale = computed(() => keepPrevious && !!prevEntry && current.value?.data.value === null, 'cachedResource:stale');
    const inflight = computed(() => current.value ? current.value.inflight.value : false);
    const started = computed(() => current.value ? current.value.started.value : false);
    const error = computed(() => current.value ? current.value.error.value : null);
    const key = computed(() => current.value ? current.value.key : null);

    if (immediate) {
        effect(() => {
            const u = resolveUrl();                   // auto-track сигналов в URL / params
            if (keyIsReactive) keyFor(u);             // …и в реактивных частях ключа
            untrack(() => { const e = use(u); if (e.persist && e._hydrated && !e.started.peek() && !e.lastFetch) start(e, u); else _fetchEntry(e, u, fopts, current.peek() === e ? 'mount' : 'url'); });
        }, 'cachedResource:auto');
    }

    return _resultShape({
        data, inflight, started, error, key, stale, refresh, mutate, abort,
        promise: () => current.peek()?.promise || null, dispose,
    });
}

/**
 * Инвалидировать кэш по ключу или предикату.
 * Активные ресурсы (с подписчиками) перезапрашиваются сразу (stale-while-revalidate),
 * неактивные — при следующем обращении.
 */
/**
 * Публичный доступ к кэшу ресурсов — без запроса и без подписки, ключи нормализуются как в resource():
 *   cache.get('/api/users')                 данные | undefined
 *   cache.set(['users', 42], user)          = seed()
 *   cache.keys('/api/users')                ключи по префиксу
 *   cache.explain(key)                      состояние (fresh | stale | inflight | error | empty | absent), почему, история решений
 *   cache.stats()                           снимок всех записей (возраст, подписчики, μ̂/λ̂, рекомендуемый staleTime) + статистика prefetch
 *   cache.on((key, ev) => …)                события fetch/fresh/joined/set — assertions в тестах
 *   cache.gc(now)                           явная уборка (тесты с fakeClock, low-memory)
 */
export const cache = {
    get(key) { _cacheReady(); const e = _resourceCache.get(_normKey(key)); if (e) e._v = 1; return e ? e.data.peek() : undefined; },   // чтение = «посещена» для SIEVE
    has(key) { _cacheReady(); return _resourceCache.has(_normKey(key)); },
    /** Logout: снести персист (все принципалы или только чужие) и офлайн-очередь */
    async purge({ persist: doPersist = true, queue = true, others = false } = {}) {
        try {
            const st = _persistStore(); const keys = await st.keys();
            for (const k of keys) {
                if (typeof k !== 'string') continue;
                if (k.startsWith('mut:')) { if (queue) await st.delete(k); continue; }
                if (!doPersist) continue;
                if (!others || (k.includes('\0') && k.split('\0')[0] !== _scopeId())) await st.delete(k);
            }
        } catch (e) { /* нет IDB */ }
    },
    set(key, data, opts) { return seed(key, data, opts); },
    remove(pattern) {
        const m = pattern == null ? () => true : _keyMatcher(pattern);
        let n = 0;
        for (const [k, e] of _resourceCache) if (m(k, e)) { if (e.controller) { e.controller.abort(); e.controller = null; e.promise = null; e.inflight.value = false; } e.gen++; e.prefetched = null; if (e.persist) _persistStore().delete(_pk(k)).catch(() => {}); _dropEntry(e); batch(() => { e.data.value = null; e.started.value = false; e.inflight.value = false; }); n++; }
        return n;
    },
    keys(prefix) { const p = prefix == null ? null : _normKey(prefix); return [..._resourceCache.keys()].filter(k => !p || k === p || k.startsWith(p)); },
    entry(key) {
        const e = _resourceCache.get(_normKey(key));
        return e ? { key: e.key, data: e.data, error: e.error, inflight: e.inflight, refCount: e.refCount, age: () => e.lastFetch ? _now() - e.lastFetch : null } : null;
    },
    subscribe(key, fn) {
        const e = _cacheEntry(_normKey(key), null);
        _retainEntry(e);
        const off = effect(() => fn(e.data.value), 'cache:subscribe');
        return () => { off(); _releaseEntry(e, e._cacheTime || 5 * 60 * 1000); };
    },
    on(fn) { _cacheHandlers.add(fn); return () => { _cacheHandlers.delete(fn); }; },
    gc(now = _now()) { let n = 0; for (const e of [..._resourceCache.values()]) if (e.refCount <= 0 && e._gcAt && e._gcAt <= now) { _dropEntry(e); n++; } return n; },
    /** Обновить сущность во всех записях кэша (списки, карточки): ключ из configure({ identify }); возвращает число изменённых записей */
    patchEntity(entityKey, fn, except) {
        const id = _config.identify; if (!id) return 0;
        let n = 0;
        batch(() => { for (const e of _resourceCache.values()) { if (e === except || e.base == null) continue; const nd = _patchTree(e.base, entityKey, fn, id); if (nd !== e.base) { _setData(e, nd); e.lastFetch = _now(); n++; } } });
        return n;
    },
    /** Трёхстороннее слияние объектов: { value, conflicts } */
    merge3: (base, local, server) => _merge3(base, local, server),
    /** запись из persist-хранилища (IndexedDB) — для тестов и отладки: { data, at, v, n } | null */
    persisted(key) { const e = _resourceCache.get(_normKey(key)); return Promise.resolve(e && e._persisted).then(() => _persistStore().get(_pk(_normKey(key)))).then(async (r) => { if (r && r.z) { try { r = { ...r, data: _safeParse(await _unzip(r.data)) }; } catch (x) { /* */ } } return r; }).then(r => r || null).catch(() => null); },
    /** дождаться гидрации записи из persist-хранилища: true — данные пришли с диска */
    hydrated(key) { const e = _resourceCache.get(_normKey(key)); return e && e._hydrated ? e._hydrated : Promise.resolve(false); },
    /** число записей и байт, лимиты, вытеснения */
    size() { return { entries: _resourceCache.size, bytes: _cacheBytes, evictions: _cacheEvictions, ..._config.cache }; },
    explain(key) {
        const k = _normKey(key);
        const e = _resourceCache.get(k);
        if (!e) return { key: k, state: 'absent', why: 'never fetched, seeded or prefetched — or already garbage-collected after cacheTime', history: [] };
        const now = _now(), age = e.lastFetch ? now - e.lastFetch : null, st = e.fopts ? _staleMs(e, e.fopts.staleTime) : 0;
        const freshFor = Math.max(e.freshUntil, (e.lastFetch || 0) + st) - now;
        const state = e.promise ? 'inflight' : e.error.peek() ? 'error' : e.data.peek() == null ? 'empty' : freshFor > 0 ? 'fresh' : 'stale';
        const why = {
            inflight: 'a request is in flight; readers join it (refresh()/invalidate() would replace it)',
            error: `the last fetch failed (${e.error.peek() && e.error.peek().message}); refresh()/invalidate() retries`,
            empty: 'no data yet — nothing has been fetched or seeded',
            fresh: `age ${age} ms, fresh for ${freshFor} ms more (staleTime ${st} ms${e.freshUntil > (e.lastFetch || 0) + st ? ', extended by prefetch/seed' : ''}) — served from memory, no request`,
            stale: `age ${age} ms ≥ staleTime ${st} ms — the next reader gets these data and a background refetch`,
        }[state];
        return {
            key: k, state, why, age, staleTime: st, cacheTime: e._cacheTime || null, subscribers: e.refCount,
            gcIn: e.refCount > 0 ? null : e._gcAt === Infinity ? Infinity : e._gcAt ? Math.max(0, e._gcAt - now) : null,
            fetches: e.fetches, unchanged: e.unchanged, changeInterval: e.muHat ? Math.round(1000 / e.muHat) : null, readInterval: e.lamHat ? Math.round(1000 / e.lamHat) : null,
            suggestedStaleTime: e.fetches < 3 ? null : e.muHat ? Math.max(1000, Math.round(100 / e.muHat) * 1000) : e.unchanged >= 3 ? 60000 : null,
            tags: e.tags, prefetched: e.prefetched, etag: e.etag || null, v: e.v, tab: _tabId, persist: !!e.persist, sync: e.sync, staleTimeMode: e.fopts && typeof e.fopts.staleTime !== 'number' && e.fopts.staleTime ? (Array.isArray(e.fopts.staleTime) ? e.fopts.staleTime[0] : (e.fopts.staleTime === 'auto' || e.fopts.staleTime.auto ? 'auto' : String(e.fopts.staleTime))) : null, history: (e.hist || []).slice(),
        };
    },
    stats() {
        _cacheReady();
        const now = _now();
        const entries = [..._resourceCache.values()].map(e => {
            const x = cache.explain(e.key);
            let size = 0; try { const d = e.data.peek(); size = d == null ? 0 : JSON.stringify(d).length; } catch (err) { size = -1; }
            return { key: e.key, state: x.state, age: x.age, staleTime: x.staleTime, subscribers: e.refCount, inflight: !!e.promise, error: e.error.peek() ? String(e.error.peek().message || e.error.peek()) : null, size, gcIn: x.gcIn, fetches: e.fetches, unchanged: e.unchanged, suggestedStaleTime: x.suggestedStaleTime, prefetched: e.prefetched, tags: e.tags };
        });
        const byKind = {}; for (const [k, st] of _pf.kinds) byKind[k] = { p: +(st.a / (st.a + st.b)).toFixed(2), n: Math.round(st.a + st.b - 2) };
        return { entries, prefetch: { fired: _pf.fired, used: _pf.used, wasted: _pf.wasted, byKind, hoverDelay: _hov.d }, speculation: { inflight: _spec.inflight, queued: _spec.queued.length, fired: _spec.fired, skipped: _spec.skipped, aborted: _spec.aborted }, ghost: _ghost.size, bytes: _cacheBytes, evictions: _cacheEvictions, limits: { ..._config.cache }, now };
    },
};

/** Обход дерева данных: узлы, которые identify() относит к entityKey, заменяются fn(node); неизменённые ветки сохраняют identity */
function _patchTree(node, key, fn, id, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 12) return node;
    if (!Array.isArray(node) && _isPlain(node)) { let k = null; try { k = id(node); } catch (x) { /* */ } if (k === key) return fn(node); }
    if (Array.isArray(node)) { let out = null; for (let i = 0; i < node.length; i++) { const v = _patchTree(node[i], key, fn, id, depth + 1); if (v !== node[i]) { if (!out) out = node.slice(); out[i] = v; } } return out || node; }
    if (!_isPlain(node)) return node;
    let out = null; for (const k in node) { const v = _patchTree(node[k], key, fn, id, depth + 1); if (v !== node[k]) { if (!out) out = { ...node }; out[k] = v; } } return out || node;
}
/** Матчер ключей: строка (точно; '*' в конце — префикс), массив (иерархический префикс), предикат, { prefix, exact, tags } */
function _keyMatcher(pat) {
    if (typeof pat === 'function') return pat;
    if (Array.isArray(pat)) { const p = _normKey(pat); return (k) => k === p || k.startsWith(p + '\0'); }
    if (typeof pat === 'string') {
        if (pat.endsWith('*')) { const p = _normKey(pat.slice(0, -1)) || ''; return (k) => k.startsWith(p); }
        const p = _normKey(pat); return (k) => k === p;
    }
    const fs = [];
    if (pat.exact != null) fs.push(_keyMatcher(pat.exact));
    if (pat.prefix != null) fs.push(_keyMatcher(pat.prefix + '*'));
    if (pat.tags) { const t = new Set([].concat(pat.tags)); fs.push((k, e) => !!(e.tags && e.tags.some(x => t.has(x)))); }
    return (k, e) => fs.some(f => f(k, e));
}
/**
 * Инвалидация: сбрасывает свежесть и перезапрашивает живые записи (refetch: 'active' | 'all' | 'none').
 *   invalidate('/api/users')           точный ключ (после нормализации)
 *   invalidate('/api/users*')          префикс — все страницы и фильтры
 *   invalidate(['users'])              иерархический ключ — ['users'], ['users', 42], …
 *   invalidate({ tags: ['users'] })    теги из resource(url, { cache: { tags } })
 * Возвращает Promise, который ждёт перезапросы; mutation({ invalidates }) ждёт его перед снятием pending.
 */
export function invalidate(pattern, { cancel = true, refetch } = {}) {
    const m = _keyMatcher(pattern);
    const mode = refetch || (pattern && typeof pattern === 'object' && !Array.isArray(pattern) && pattern.refetch) || 'active';
    const ps = [];
    let matched = 0;
    for (const [k, e] of _resourceCache) {
        if (!m(k, e)) continue;
        matched++;
        e.lastFetch = 0; e.freshUntil = 0;
        if (e.sync) _bcPost({ t: 'inv', key: k });
        const active = e.refCount > 0 && e.url != null && e.fopts;
        if (mode === 'none' || (mode === 'active' && !active) || !e.fopts || e.url == null) continue;
        if (!cancel && e.promise) { ps.push(e.promise.then(() => _fetchEntry(e, e.url, e.fopts, 'invalidate'))); continue; }
        ps.push(_fetchEntry(e, e.url, e.fopts, 'invalidate'));
    }
    if ((!globalThis.AEGIS_PROD && _dev()) && !matched && typeof pattern === 'string') {
        let best = null, bd = 4;
        for (const k of _resourceCache.keys()) { const d = _lev(k, pattern); if (d < bd) { bd = d; best = k; } }
        _warn('E040', !globalThis.AEGIS_PROD && {
            what: `invalidate("${pattern}") matched no cache entry.`,
            why: 'Nothing was refetched — the key differs from the one resource() used (query order, trailing slash, encoding, a typo), or the entry was never created.',
            fix: best ? `Did you mean "${best}"? Prefix form: invalidate('${pattern}*').` : "Check the key; prefix form invalidate('/api/…*') or a predicate invalidate(k => k.startsWith('/api/'))",
        }, 'inv:' + pattern);
    }
    return Promise.allSettled(ps).then(() => {});
}

/**
 * Курсорная пагинация: страницы копятся, loadMore дедуплицируется, abort при dispose.
 *   const feed = infiniteResource(cursor => cursor ? `/api/feed?after=${cursor}` : '/api/feed',
 *       { getNext: r => r.next ?? null, select: r => r.items });
 *   observe(sentinel, ([e]) => e.isIntersecting && feed.loadMore());
 */
export function infiniteResource(urlFor, opts = {}) {
    const { getNext = (r) => r?.next ?? null, select = (r) => r?.items ?? r, immediate = true, retry, share = true } = opts;
    const fetcher = opts.fetcher || _fetcher();
    const pages = signal([], 'infinite:pages');
    const cursor = signal(undefined, 'infinite:cursor'); // undefined — не начинали, null — конец
    const inflight = signal(false, 'infinite:inflight');
    const started = signal(false, 'infinite:started');
    const error = signal(null, 'infinite:error');
    const key = computed(() => urlFor(cursor.value === undefined ? null : cursor.value));
    const data = computed(() => pages.value.flatMap(select), 'infinite:data');
    const hasMore = computed(() => cursor.value !== null, 'infinite:hasMore');
    let controller = null, last = null;

    const abort = () => { if (controller) { controller.abort(); controller = null; } };
    const loadMore = () => {
        if (last) return last;                         // дедуп: уже грузим
        const c = cursor.peek();
        if (c === null) return Promise.resolve();
        const url = urlFor(c === undefined ? null : c);
        if (!url) { cursor.value = null; return Promise.resolve(); }
        const ctl = controller = new AbortController();
        batch(() => { inflight.value = true; started.value = true; error.value = null; });
        const p = (async () => {
            try {
                const result = await withRetry(() => fetcher(url, { signal: ctl.signal }), { retries: _retries(retry), signal: ctl.signal });
                if (ctl.signal.aborted) return;
                batch(() => {
                    pages.value = share ? _share(pages.peek(), [...pages.peek(), result]) : [...pages.peek(), result];
                    cursor.value = getNext(result);
                });
            } catch (e) {
                if (e?.name === 'AbortError' || ctl.signal.aborted) return;
                error.value = e;
            } finally {
                if (controller === ctl) { controller = null; inflight.value = false; }
                last = null;
            }
        })();
        last = _trackPromise(p);
        return p;
    };
    const reset = () => { abort(); batch(() => { pages.value = []; cursor.value = undefined; error.value = null; }); return immediate ? loadMore() : Promise.resolve(); };
    const mutate = (fn) => { pages.value = typeof fn === 'function' ? fn(pages.peek()) : fn; };
    if (immediate) loadMore();
    const dispose = () => abort();
    if (_currentScope) _currentScope.onDispose(dispose);
    return _resultShape({ data, inflight, started, error, key, refresh: reset, mutate, abort, promise: () => last, dispose, extra: { pages, hasMore, loadMore, reset } });
}


// ============================================================================
// 25. WIREFORM — Auto-wired server-rendered forms
// ============================================================================

/** Cross-field validation rule: field must match another field */
export const matches = (otherKey, msg) => (val, key, fields) => {
    const other = fields[otherKey];
    if (!other) return null;
    const ov = 'value' in other ? other.value : other.peek();   // .value: смена другого поля пересчитывает issue
    return val !== ov ? (msg || _fmsg('matches', { field: otherKey })) : null;
};

/**
 * Wire an existing server-rendered <form> with signals, validation, a11y.
 * Auto-discovers [name] inputs, reads native constraints, manages touched/errors.
 *
 * @example
 *   const f = wireForm(document.querySelector('#login'), {
 *       schema: {
 *           email: [required, emailRule],
 *           password: [required, minLen(8)],
 *       },
 *       mode: 'blur-then-live',  // validate on blur first, then live after error
 *   });
 *
 *   f.fields.email       // signal
 *   f.errors.email       // signal (string | null)
 *   f.touched.email      // signal (boolean)
 *   f.valid              // computed
 *   f.dirty              // computed
 *   f.submit(handler)    // returns event handler
 *
 * @param {HTMLFormElement} formEl
 * @param {Object} [opts]
 */
export function wireForm(formEl, opts = {}) {
    const {
        mode = 'blur-then-live',  // 'blur-then-live' | 'live' | 'submit' — когда ПОКАЗЫВАТЬ; истина всегда в issues
        native = true,            // noValidate + setCustomValidity + :user-invalid; false — не трогать нативную валидацию
        asyncDebounce = 0,
        messages = 'browser',     // 'browser' — input.validationMessage; 'page' — коды + словарь на языке страницы
    } = opts;
    // schema: { key: [rules] } | Standard Schema (zod/valibot/arktype) + rules: { key: [rules] } поверх
    const stdSchema = _isStandardSchema(opts.schema) ? opts.schema : null;
    const ruleSchema = stdSchema ? (opts.rules || {}) : (opts.schema || opts.rules || {});

    const fields = {};
    const errors = {};
    const touched = {};
    const _rules = {};
    const _initials = {};
    const _inputs = {};
    const _wires = {};
    const shape = signal(0, 'wireForm:shape');
    const submitCount = signal(0, 'wireForm:submitCount');
    const types = opts.types || {};
    let V = null;   // валидатор — после обнаружения полей

    if (native !== false) formEl.noValidate = true;   // иначе браузерный пузырь перекрывает ошибку и submit не доходит до JS

    const readValue = (input) => _readValue(input, formEl, types[input.name]);
    const pageMessages = messages === 'page' || (messages !== 'browser' && typeof _messages === 'function');
    const wireCtx = { fields, errors, touched, mode, native, validateField: (k) => V && V.validateField(k), formEl, submitCount, types, a11y: opts.a11y };
    /** элементы формы, которые являются полями: form.elements (учитывает form="id" снаружи) без кнопок */
    const isField = (c) => !!c.name && !/^(submit|button|reset|image)$/.test(c.type || '') && !/^(BUTTON|FIELDSET|OUTPUT|OBJECT)$/.test(c.tagName);
    const controls = () => [...formEl.elements].filter(isField);
    const nativeRuleFor = (input) => () => {
        if (typeof input.setCustomValidity === 'function') input.setCustomValidity('');
        const v = input.validity;
        if (!v || v.valid) return null;
        if (!pageMessages) return input.validationMessage;
        for (const [flag, code, p] of _VALIDITY) if (v[flag]) return _fmsg(typeof code === 'function' ? code(input) : code, p ? p(input) : null);
        return input.validationMessage;
    };
    /** Подключить один input: сигналы, правила (нативные + схема по шаблону), per-input слой */
    const wire = (input) => {
        const key = input.name;
        if (!key || !isField(input)) return;
        if (fields[key]) {
            if (!_wires[key] || !_wires[key].some(w => w.el === input)) { const d = _wireInput(input, key, { ...wireCtx, extra: true }); d.el = input; (_wires[key] || (_wires[key] = [])).push(d); }   // второй radio той же группы
            return;
        }
        _inputs[key] = input;
        const initial = readValue(input);
        _initials[key] = signal(initial, `wireForm:${key}:initial`);
        fields[key] = signal(initial, `wireForm:${key}`);
        errors[key] = signal(null, `wireForm:${key}:error`);
        touched[key] = signal(false, `wireForm:${key}:touched`);
        const nativeRules = [];
        if (native !== false && typeof input.checkValidity === 'function') nativeRules.push(nativeRuleFor(input));
        else {
            if (input.required) nativeRules.push(required);
            if (input.minLength > 0) nativeRules.push(minLen(input.minLength));
            if (input.maxLength > 0 && input.maxLength < 524288) nativeRules.push(maxLen(input.maxLength));
            if (input.pattern) nativeRules.push(pattern(new RegExp(`^(?:${input.pattern})$`)));
            if (input.type === 'email') nativeRules.push(emailRule);
        }
        _rules[key] = [...nativeRules, ..._rulesFor(key, ruleSchema)];
        if (V) { V.addField(key); watch(fields[key], () => V.clearServer(key)); }
        const d = _wireInput(input, key, wireCtx); d.el = input;
        _wires[key] = [d];
        shape.value++;
    };
    /** Отключить поле: слушатели/эффекты/контейнер ошибки снимаются */
    const unwire = (key) => {
        if (!fields[key]) return;
        if (V) V.removeField(key);
        if (_wires[key]) { for (const d of _wires[key]) d(); delete _wires[key]; }
        for (const m of [fields, errors, touched, _initials, _rules, _inputs]) delete m[key];
        shape.value++;
    };
    /** Пересканировать форму: новые поля подключить, пропавшие отключить (после swap/morph/list) */
    const rewire = () => batch(() => {
        const present = new Set();
        for (const c of controls()) { present.add(c.name); if (!fields[c.name]) wire(c); else if (_inputs[c.name] !== c && !_inputs[c.name].isConnected) { unwire(c.name); wire(c); } }
        for (const k of Object.keys(fields)) if (!present.has(k)) unwire(k);
    });
    for (const c of controls()) wire(c);
    if (opts.observe) {
        const mo = new MutationObserver(() => rewire());
        mo.observe(formEl, { childList: true, subtree: true });
        if (_currentScope) _currentScope.onDispose(() => mo.disconnect());
    }
    errors.$form = signal(null, 'wireForm:$form');

    const keyOf = (p) => { const n = _normPath(p); return Object.keys(fields).find(k => k === p || _normPath(k) === n) || null; };
    V = _makeValidator({ fields, errors, rules: _rules, touched, asyncDebounce, schema: stdSchema, keyOf, shape });
    const I = _initialsApi(fields, _initials, errors, touched, shape);
    const validating = V.validating;
    const keys = computed(() => { shape.value; return Object.keys(fields); }, 'wireForm:keys');

    // Validation
    const _validateField = V.validateField;
    for (const key of Object.keys(fields)) watch(fields[key], () => V.clearServer(key));   // серверная ошибка живёт до изменения поля

    const validate = () => {
        let ok = true;
        for (const key of Object.keys(fields)) {
            touched[key].value = true;
            if (!_validateField(key)) ok = false;
        }
        if (stdSchema && V.issues.$form.peek()) { errors.$form.value = V.issues.$form.peek(); ok = false; }
        if (!ok) focusErr();   // фокус на первую показанную ошибку (или сводку) + одно объявление
        return ok;
    };
    let _summaryEl = null;
    const focusErr = () => _focusFirstError(formEl, _inputs, errors, { summaryEl: _summaryEl, focusOnError: opts.focusOnError, announce: opts.a11y && opts.a11y.summary === false ? false : undefined });
    /** Сводка ошибок GOV.UK: f.summary(target?) — role=alert со ссылками на поля */
    const summary = (target, so = {}) => {
        const box = typeof target === 'string' ? (formEl.querySelector(target) || document.querySelector(target)) : target || (() => { const d = document.createElement('div'); formEl.prepend(d); return d; })();
        _summaryEl = _errorSummary(box, formEl, fields, errors, _inputs, so);
        return box;
    };
    const errorList = computed(() => { shape.value; return Object.keys(fields).filter(k => errors[k].value).map(k => ({ key: k, message: errors[k].value, el: _inputs[k] || null })); }, 'wireForm:errorList');
    if (opts.summary) summary(opts.summary === true ? undefined : opts.summary);

    const valid = V.valid;
    const values = computed(() => { shape.value; for (const k of Object.keys(fields)) fields[k].value; return _nestValues(fields); }, 'wireForm:values');
    const parsed = V.parsed;

    const reset = () => {
        batch(() => {
            for (const key of Object.keys(fields)) {
                fields[key].value = _initials[key].peek();
                errors[key].value = null;
                touched[key].value = false;
            }
            errors.$form.value = null;
        });
        V.abortAll();
    };

    const status = signal('idle', 'wireForm:status');
    const submitting = computed(() => status.value === 'validating' || status.value === 'submitting', 'wireForm:submitting');
    const submitted = computed(() => submitCount.value > 0, 'wireForm:submitted');
    const submitError = signal(null, 'wireForm:submitError');
    const result = signal(null, 'wireForm:result');
    const canSubmit = computed(() => valid.value && !validating.$any.value && !submitting.value, 'wireForm:canSubmit');
    const setErrors = (serverErrors) => {
        _applyServerErrors(serverErrors, errors, touched, keyOf);
        for (const k of Object.keys(fields)) V.markServer(k);
        if (errors.$form.peek()) announce(errors.$form.peek(), 'assertive');
        // Focus first error
        const firstKey = Array.isArray(serverErrors) ? null : Object.keys(serverErrors || {}).map(keyOf).find(k => k && errors[k] && errors[k].peek());
        if (firstKey && _inputs[firstKey]) _inputs[firstKey].focus();
    };

    /** FormData формы (файлы и bracket-имена — как их ждёт PHP/Rails) */
    const formData = () => new FormData(formEl);
    /** objectURL превью для файла: сигнал, URL отзывается при смене и dispose */
    const previews = {};
    const preview = (key) => {
        if (previews[key]) return previews[key];
        const url = signal(null, `preview:${key}`);
        let last = null;
        const revoke = () => { if (last) { URL.revokeObjectURL(last); last = null; } };
        effect(() => {
            const v = fields[key] ? fields[key].value : null;
            const f = Array.isArray(v) ? v[0] : v;
            revoke();
            url.value = f && typeof File !== 'undefined' && f instanceof File ? (last = URL.createObjectURL(f)) : null;
        }, `preview:${key}`);
        if (_currentScope) _currentScope.onDispose(revoke);
        previews[key] = url;
        return url;
    };

    /** Текст ошибки поля из серверной разметки: #key-error | [data-error-for] | aria-describedby | .errorlist/.invalid-feedback/.error рядом */
    const _errorText = (root, key, input) => {
        const byId = root.querySelector('#' + CSS.escape(key + '-error') + ', [data-error-for="' + CSS.escape(key) + '"]')
            || (input && (input.getAttribute('aria-describedby') || '').split(/\s+/).map(id => id && root.querySelector('#' + CSS.escape(id))).find(el => el && !el.classList.contains('hint') && el.textContent.trim()));
        const near = byId || (input && input.closest('label, .field, .form-group, .form-row, [data-field], li, p, div')?.querySelector('.error, .field-error, [data-error], .errorlist, .invalid-feedback, .help-block.error, .field_with_errors ~ .error'));
        const t = near && near.textContent.replace(/\s+/g, ' ').trim();
        return t || null;
    };
    /** Ошибки из (серверной) разметки формы → сигналы показа; true — есть хоть одна */
    const adoptErrors = (root = formEl) => {
        let any = false;
        batch(() => {
            for (const key of Object.keys(fields)) {
                const inp = _inputs[key];
                const msg = _errorText(root, key, inp);
                V.show(key, msg, msg ? 'server' : null);
                if (msg) { touched[key].value = true; any = true; }
            }
            const g = root.querySelector('.errorlist.nonfield, .non-field-errors, [data-error-for="$form"], .form-error, .alert-danger, [role="alert"]:not([id$="-error"]):not(.aegis-error-summary)');
            const gt = g && g.textContent.replace(/\s+/g, ' ').trim();
            errors.$form.value = gt || null;
            if (gt) any = true;
        });
        return any;
    };

    /** Отправить как браузер: action/method/enctype формы, formaction/formmethod кнопки, FormData с файлами */
    const serverSubmit = async (e, sopts = {}) => {
        const submitter = e && e.submitter;
        const action = (submitter && submitter.getAttribute('formaction')) || formEl.getAttribute('action') || location.href;
        const method = ((submitter && submitter.getAttribute('formmethod')) || formEl.getAttribute('method') || 'POST').toUpperCase();
        const asJson = sopts.as === 'json';
        const sent = {}; for (const k of Object.keys(fields)) sent[k] = fields[k].peek();   // что ушло: после morph правки пользователя во время запроса берут верх над серверной разметкой
        const body = asJson ? (stdSchema && parsed.peek() != null ? parsed.peek() : values.peek()) : new FormData(formEl, submitter || undefined);
        const response = await request(action, {
            method: method === 'GET' ? 'POST' : method,
            body,
            raw: true,
            signal: sopts.signal,
            headers: { Accept: 'application/json, text/html;q=0.9', ...(sopts.headers || {}) },
        });
        const ct = response.headers.get('content-type') || '';
        if (response.redirected && ct.includes('text/html')) {
            _followRedirect(response, sopts.onRedirect || opts.onRedirect || _config.onRedirect);
            return { ok: response.ok, redirected: true, status: response.status, data: null };
        }
        if (ct.includes('text/html') && (sopts.html ?? opts.html) !== false) {
            // Rails render :new 422 / Django form_invalid 200 / Laravel без JSON: форма пришла перерисованной — morph на место, ошибки из разметки
            const doc = _parseHTML(await response.text(), { whole: true, who: 'wireForm' });
            if (!doc) { L.applyError(new HttpError(response.status, response, null)); return { ok: false, status: response.status, data: null, html: true }; }
            const act = formEl.getAttribute('action');
            const next = doc.querySelector(_selectorFor(formEl)) || (act && doc.querySelector(`form[action="${CSS.escape(act)}"]`)) || doc.querySelector('form');
            if (!next) { L.applyError(new HttpError(response.status, response, null)); return { ok: false, status: response.status, data: null, html: true }; }
            await swap(formEl, next, { mode: (sopts.html ?? opts.html) === 'replace' ? 'outer' : 'morph', hydrate: false });
            rewire();
            batch(() => { for (const k of Object.keys(fields)) { const inp = _inputs[k]; if (!inp || inp.type === 'file') continue; if (!_sameValue(fields[k].peek(), sent[k])) { const v = fields[k].peek(); if (inp.type === 'checkbox') inp.checked = !!v; else if (inp.type !== 'radio') inp.value = v ?? ''; } else fields[k].value = readValue(inp); } });   // печатал во время запроса — оставить; иначе значение с сервера (нормализация)
            const bad = adoptErrors(formEl);
            if (bad) focusErr();
            else if (!response.ok) L.applyError(new HttpError(response.status, response, null));
            const ok = response.ok && !bad;
            if (ok && sopts.onSuccess) sopts.onSuccess(null, response);
            return { ok, status: response.status, data: null, html: true };
        }
        const data = await _parseBody(response);
        if (!response.ok || (data && typeof data === 'object' && data.errors)) {
            if (data && typeof data === 'object' && (data.errors || response.status === 422 || response.status === 400)) {
                // DRF: { field: [...] } на верхнем уровне; Rails: { errors }; Laravel: { message, errors }
                const errs = data.errors || data;
                setErrors(errs);
                if (data.message && !errors.$form.peek() && !data.errors) errors.$form.value = data.message;
            } else if (!response.ok) L.applyError(Object.assign(new HttpError(response.status, response, data), { data }));
            return { ok: false, status: response.status, data };
        }
        if (sopts.onSuccess) sopts.onSuccess(data, response);
        return { ok: true, status: response.status, data };
    };

    /**
     * submit(handler) → event-обработчик: валидация (sync + async + schema) → handler(values).
     * submit() без handler — серверный submit формы (FormData, 422 → ошибки по полям, 303 → переход).
     * submit({ as: 'json', onSuccess }) — то же, но JSON-телом.
     */
    const L = _submitLifecycle({ status, errors, setErrors, submitError, submitCount, announceFn: announce });
    const submit = (handler) => {
        const sopts = handler && typeof handler === 'object' ? handler : {};
        const fn = typeof handler === 'function' ? handler : null;
        return async (e) => {
            e?.preventDefault();
            if (submitting.peek()) return;                  // double-submit guard
            const submitter = (e && e.submitter) || formEl.querySelector('button:not([type=button]):not([type=reset]), input[type=submit]');
            // intents: <button name="intent" value="add"> — локальное действие без запроса (Conform); без JS та же кнопка уходит на сервер
            const intents = sopts.intents || opts.intents;
            const intentName = submitter && (submitter.dataset && submitter.dataset.intent || (submitter.name === 'intent' ? submitter.value : null));
            if (intents && intentName && typeof intents[intentName] === 'function') { intents[intentName](api, e); return; }
            const ctl = L.begin();
            formEl.setAttribute('aria-busy', 'true');
            formEl.dataset.submitting = '';
            formEl.dataset.status = 'validating';
            L.setBtn(submitter, true);
            try {
                const skipValidation = !!(submitter && submitter.formNoValidate);   // <button formnovalidate> — HTML-семантика: черновик без проверки
                if (!skipValidation) {
                    for (const key of Object.keys(fields)) touched[key].value = true;
                    if (!(await V.validateAsync())) { L.end('error'); focusErr(); return; }
                }
                status.value = 'submitting'; formEl.dataset.status = 'submitting';
                const body = stdSchema && parsed.peek() != null ? parsed.peek() : values.peek();
                const r = fn ? await fn(body, { signal: ctl.signal, submitter, event: e }) : await serverSubmit(e, { ...sopts, signal: ctl.signal });
                if (ctl.signal.aborted) { L.end('idle'); return; }
                result.value = r;
                L.end(r && r.ok === false ? 'error' : 'success');
                if (status.peek() === 'success' && !(r && r.redirected) && sopts.announceSuccess !== false && opts.announceSuccess !== false) announce(_fmsg('saved'));
                return r;
            } catch (err) {
                if (err && err.name === 'AbortError') { L.end('idle'); return; }
                L.applyError(err);
                L.end('error');
            } finally {
                L.setBtn(submitter, false);
                formEl.dataset.status = status.peek();
                formEl.removeAttribute('aria-busy');
                delete formEl.dataset.submitting;
            }
        };
    };
    if (opts.submit) on(formEl, 'submit', submit(opts.submit === true ? undefined : opts.submit));
    if (opts.escapeAborts) on(formEl, 'keydown', (e) => { if (e.key === 'Escape' && submitting.peek()) { e.preventDefault(); L.abort(); } });
    on(formEl, 'reset', (e) => { e.preventDefault(); reset(); if (typeof announce === 'function') announce(_fmsg('formReset')); });   // нативный reset сбрасывает и сигналы
    if (_currentScope) _currentScope.onDispose(() => { V.abortAll(); L.abort(); });

    // Wizard: auto-detect [data-step] sections
    const stepEls = formEl.querySelectorAll('[data-step]');
    let step = null, stepCount = null, nextStep = null, prevStep = null;

    if (stepEls.length > 1) {
        step = signal(0, 'wireForm:step');
        stepCount = stepEls.length;

        // Show/hide steps
        effect(() => {
            const current = step.value;
            stepEls.forEach((el, i) => { el.hidden = i !== current; });
        });

        nextStep = () => {
            // Validate only current step's fields
            const currentStepEl = stepEls[step.peek()];
            const stepInputs = currentStepEl.querySelectorAll('[name]');
            let ok = true;
            for (const input of stepInputs) {
                touched[input.name].value = true;
                if (!_validateField(input.name)) ok = false;
            }
            if (ok && step.peek() < stepCount - 1) step.value++;
            return ok;
        };

        prevStep = () => {
            if (step.peek() > 0) step.value--;
        };
    }

    const api = {
        el: formEl,
        fields, errors, issues: V.issues, touched, values, parsed, keys, validating,
        dirty: I.dirty, dirtyFields: I.dirtyFields, changes: I.changes, valid, canSubmit,
        validate, validateField: _validateField, validateAsync: V.validateAsync, reset, setErrors, submit, formData, preview,
        focusFirstError: focusErr, summary, errorList,
        wire, unwire, rewire, adoptErrors,
        addField: (key, value, rules, o) => { if (fields[key]) return fields[key]; const initial = o && typeof o === 'object' && 'initial' in o ? o.initial : value; _initials[key] = signal(initial, `wireForm:${key}:initial`); fields[key] = signal(value, `wireForm:${key}`); errors[key] = signal(null, `wireForm:${key}:error`); touched[key] = signal(false, `wireForm:${key}:touched`); _rules[key] = rules || _rulesFor(key, ruleSchema); V.addField(key); watch(fields[key], () => V.clearServer(key)); shape.value++; return fields[key]; },
        removeField: unwire,
        renameField: (from, to) => { if (from === to || !fields[from]) return; for (const m of [fields, errors, touched, _initials, _rules, _inputs, _wires]) if (from in m) { m[to] = m[from]; delete m[from]; } V.renameField(from, to); shape.value++; },
        field: (key) => ({ key, value: fields[key], error: errors[key], issue: V.issues[key], touched: touched[key], validating: V.validating[key], get id() { return _inputs[key] && _inputs[key].id || key; }, get errorId() { return key.replace(/[^\w-]/g, '_') + '-error'; }, $wire: (el) => wire(el) }),
        setInitial: I.setInitial, commit: I.commit, guardUnload: I.guard, guard: (o) => I.guard({ busy: () => submitting.peek(), ...(o || {}) }),
        status, abort: L.abort, submitting, submitted, submitCount, submitError, result,
        step, stepCount, next: nextStep, prev: prevStep,
    };
    if (opts.guard) api.guard(opts.guard === true ? {} : opts.guard);
    const draftKey = opts.draft === true ? (formEl.getAttribute('action') || location.pathname) + '#' + (formEl.id || formEl.getAttribute('name') || '') : (opts.draft || formEl.dataset.aegisDraft);
    if (draftKey) draft(api, draftKey);
    return api;
}

/**
 * Черновик формы в sessionStorage: только изменённые поля (без password/file), debounce, восстановление при создании
 * (dirty остаётся true — guard() работает), очистка при успешном submit / commit() / reset().
 *   const d = draft(f, 'user:42'); d.restored; d.clear()
 */
export function draft(f, key, o = {}) {
    const store = o.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (!store) return { restored: false, clear: () => {}, stop: () => {} };
    const typeOf = (k) => { const el = f.el && f.el.elements ? f.el.elements[k] : null; const i = el && el.length ? el[0] : el; return i && i.type; };
    const pick = () => { const c = { ...f.changes.peek() }; for (const k of Object.keys(c)) { const t = typeOf(k); if (t === 'password' || t === 'file' || (o.exclude && o.exclude(k, c[k]))) delete c[k]; } return c; };
    const write = () => { try { const v = pick(); Object.keys(v).length ? store.setItem(key, JSON.stringify({ t: Date.now(), v })) : store.removeItem(key); } catch (e) { /* квота */ } };
    let saved = null; try { saved = _safeParse(store.getItem(key)); } catch (e) { /* */ }
    let restored = false;
    if (saved && saved.v && (!o.ttl || Date.now() - saved.t < o.ttl)) {
        const apply = () => batch(() => { for (const [k, v] of Object.entries(saved.v)) if (f.fields[k]) f.fields[k].value = v; if (typeof announce === 'function') announce(_fmsg('draftRestored')); });
        if (o.restore) o.restore(saved.v, apply); else apply();
        restored = true;
    }
    const deb = debounced(write, o.debounce ?? 300);
    const stopEff = effect(() => { f.changes.value; untrack(() => deb()); }, 'form:draft');
    const offHide = on(window, 'pagehide', () => deb.flush());
    const clear = () => { deb.cancel(); try { store.removeItem(key); } catch (e) { /* */ } };
    const stopStatus = f.status ? effect(() => { if (f.status.value === 'success') untrack(clear); }, 'form:draft:clear') : null;
    const stop = () => { stopEff(); offHide(); if (stopStatus) stopStatus(); };
    if (_currentScope) _currentScope.onDispose(stop);
    return { restored, clear, stop, key };
}

/**
 * Мастер поверх form()/wireForm(): шаги — группы ключей ('address.*' допустим) или [data-step] у f.el; next() ждёт async-правила и схему
 * только для полей шага; go(i) вперёд — через валидацию промежуточных, назад — свободно; фокус на новый шаг, announce «Шаг n из N»,
 * [data-step-nav] дети получают aria-current="step"; history: true — ?step=i через Navigation API (Back = предыдущий шаг).
 */
export function wizard(f, wopts = {}) {
    const el = f.el || null;
    const stepEls = el ? [...el.querySelectorAll('[data-step]')] : [];
    const groups = wopts.steps || stepEls.map(sEl => [...sEl.querySelectorAll('[name]')].map(i => i.name).filter(Boolean));
    const count = groups.length;
    const matches = (k, p) => p.endsWith('*') ? _normPath(k).startsWith(_normPath(p.slice(0, -1))) : _normPath(k) === _normPath(p);
    const keysOf = (i) => Object.keys(f.fields).filter(k => groups[i].some(p => matches(k, p)));
    const step = wopts.persist ? persisted(wopts.persist + ':step', 0, { storage: typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, sync: false }) : signal(0, 'wizard:step');
    if (step.peek() >= count) step.value = 0;
    const visited = signal(new Set([step.peek()]), 'wizard:visited');
    const steps = groups.map((_, i) => ({
        index: i, keys: () => keysOf(i),
        valid: computed(() => keysOf(i).every(k => !f.errors[k].value && !(f.issues && f.issues[k] && f.issues[k].value)), `wizard:${i}:valid`),
        dirty: computed(() => keysOf(i).some(k => f.dirtyFields.value[k]), `wizard:${i}:dirty`),
        done: computed(() => visited.value.has(i) && steps[i].valid.value, `wizard:${i}:done`),
    }));
    const validateStep = async (i) => { const ks = keysOf(i); if (f.touched) for (const k of ks) if (f.touched[k]) f.touched[k].value = true; return f.validateAsync(ks); };
    const focusStep = (i) => queueMicrotask(() => {
        if (wopts.focus === false || !stepEls[i]) return;
        const target = stepEls[i].querySelector('h1,h2,h3,legend,[autofocus],input:not([type=hidden]),select,textarea');
        if (!target) return;
        if (!/INPUT|SELECT|TEXTAREA/.test(target.tagName)) target.tabIndex = -1;
        target.focus();
    });
    const show = (i) => {
        stepEls.forEach((sEl, j) => { sEl.hidden = j !== i; if (j === i) { sEl.setAttribute('role', 'group'); const h = sEl.querySelector('h1,h2,h3,legend'); if (h) { if (!h.id) h.id = 'step-' + j + '-title'; sEl.setAttribute('aria-labelledby', h.id); } } });
        if (el) for (const nav of el.querySelectorAll('[data-step-nav]')) [...nav.children].forEach((c, j) => { if (j === i) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
    };
    let navigating = false;
    const go = async (i, { validate = i > step.peek(), nav = true } = {}) => {
        if (i < 0 || i >= count) return false;
        if (validate) for (let j = step.peek(); j < i; j++) if (!(await validateStep(j))) { batch(() => { step.value = j; }); focusStep(j); return false; }
        const dir = i > step.peek() ? 'push' : 'replace';
        batch(() => { step.value = i; visited.value = new Set([...visited.peek(), i]); });
        if (nav && wopts.history && typeof navigation !== 'undefined' && typeof navigation.navigate === 'function' && !navigating) {
            const u = new URL(location.href); u.searchParams.set('step', i);
            navigating = true;
            try { const r = navigation.navigate(u.href, { history: dir, state: { aegisStep: i } }); (r && r.finished ? r.finished : Promise.resolve()).catch(() => {}).finally(() => { navigating = false; }); } catch (e) { navigating = false; }
        }
        focusStep(i);
        if (typeof announce === 'function') announce(_fmsg('stepOf', { n: i + 1, total: count }));
        return true;
    };
    const eff = effect(() => show(step.value), 'wizard:show');
    let offNav = null;
    if (wopts.history && typeof navigation !== 'undefined' && typeof navigation.addEventListener === 'function') {
        offNav = on(navigation, 'navigate', (e) => {
            if (e.navigationType !== 'traverse' || !e.canIntercept) return;
            const st = e.destination.getState && e.destination.getState();
            if (!st || st.aegisStep === undefined) return;
            e.intercept({ handler: () => { navigating = true; go(st.aegisStep, { validate: false, nav: false }).finally(() => { navigating = false; }); } });
        });
    }
    const api = {
        step, steps, count, visited,
        next: () => go(step.peek() + 1),
        prev: () => go(step.peek() - 1, { validate: false }),
        go, validateStep,
        first: computed(() => step.value === 0, 'wizard:first'),
        last: computed(() => step.value === count - 1, 'wizard:last'),
        progress: computed(() => count ? (step.value + 1) / count : 1, 'wizard:progress'),
        dispose: () => { eff(); if (offNav) offNav(); },
    };
    return api;
}


// ============================================================================
// 26. ACCESSIBILITY — trap, roving, announce
// ============================================================================

const _FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const _TABBABLE = 'a[href],area[href],button,input,select,textarea,iframe,summary,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]';
const _trapStack = [];
/** Активный элемент с учётом открытых shadow root */
const _deepActive = () => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; };
const _visible = (el) => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) : (el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
/**
 * Tabbable-элементы в порядке документа, включая открытые shadow root и <slot>; inert/hidden/disabled/tabindex<0/закрытые <details> исключены.
 *   tabbables(dialog)[0].focus()
 */
export function tabbables(root) {
    const out = [];
    const walk = (node) => {
        for (let el = node.firstElementChild; el; el = el.nextElementSibling) {
            if (el.inert || el.hidden) continue;
            if (el.tagName === 'DETAILS' && !el.open) { const sm = el.querySelector(':scope > summary'); if (sm && sm.tabIndex >= 0 && _visible(sm)) out.push(sm); continue; }
            if (el.matches(_TABBABLE) && !el.disabled && (el.tabIndex >= 0 || (el.isContentEditable && el.getAttribute('tabindex') !== '-1')) && _visible(el)) out.push(el);   // contenteditable без tabindex: tabIndex = -1, но фокусируем
            if (el.shadowRoot) walk(el.shadowRoot);
            else if (el.tagName === 'SLOT') { for (const a of el.assignedElements()) { if (a.matches(_TABBABLE) && !a.disabled && a.tabIndex >= 0 && _visible(a)) out.push(a); walk(a); } }
            else walk(el);
        }
    };
    walk(root);
    return out;
}
let _uidN = 0;
const _uid = (p) => p + '-' + (++_uidN).toString(36);
/** Доступное имя диалога/региона: aria-label | aria-labelledby | первый заголовок внутри (id генерируется); иначе E049 в dev */
function _ensureName(el, kind) {
    if (!el || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return true;
    const h = el.querySelector('h1,h2,h3,h4,h5,h6,[data-title]');
    if (h) { if (!h.id) h.id = _uid('aegis-title'); el.setAttribute('aria-labelledby', h.id); return true; }
    _warn('E049', !globalThis.AEGIS_PROD && {
        what: `${kind} has no accessible name.`,
        why: 'Screen readers announce just "dialog" / "region" with no context; APG requires aria-labelledby or aria-label.',
        fix: 'Put a heading (h1–h6) inside, or set aria-label="…" / aria-labelledby="id".',
        el,
    }, 'name:' + _tag(el));
    return false;
}

/**
 * Focus trap for modals/dialogs/drawers.
 * Traps Tab/Shift+Tab inside container, restores focus on release.
 *
 * @example
 *   const release = trap(modalEl);
 *   // ... user interacts with modal ...
 *   release(); // focus returns to trigger element
 *
 * @param {Element} container
 * @param {Object} [opts]
 * @returns {Function} release — call to release the trap and restore focus
 */
export function trap(container, opts = {}) {
    const { autoFocus = true, escape, outside, inert = false, allow = '[aria-live],[data-aegis-portal],[data-aegis-live]', returnFocus = true, recapture = true } = opts;
    const previousFocus = document.activeElement;
    const prevChain = []; for (let n = previousFocus && previousFocus.parentNode; n && n !== document.body; n = n.parentNode) prevChain.push(n);   // если триггер удалят — фокус ближайшему живому соседу
    const extra = [];
    const rec = { container, lastFocused: null };
    _trapStack.push(rec);
    const top = () => _trapStack[_trapStack.length - 1] === rec;                    // Escape/recapture обрабатывает только верхняя ловушка
    const inside = (t) => !!t && (container.contains(t) || (t.closest && !!t.closest(allow)) || (container.shadowRoot && container.shadowRoot.contains(t)));
    // Escape → release() или свой обработчик (только верхняя ловушка стека)
    let escAt = 0;
    const onEsc = (e) => { escAt = Date.now(); typeof escape === 'function' ? escape(e) : release(); };
    if (escape) extra.push(on(document, 'keydown', (e) => { if (e.key === 'Escape' && top()) { e.stopPropagation(); e.preventDefault(); onEsc(e); } }));
    if (escape && escape !== 'key' && typeof CloseWatcher === 'function') {   // CloseWatcher: Android back, VoiceOver «закрыть», стек close-requests платформы (dialog/popover не закрываются вместе с ловушкой)
        try {
            const ac = new AbortController();
            const mk = () => {
                const cw = new CloseWatcher({ signal: ac.signal });
                cw.addEventListener('cancel', (e) => { if (typeof escape === 'function') escape(e); });
                cw.addEventListener('close', (e) => { if (!top() || Date.now() - escAt < 100) { if (!ac.signal.aborted) mk(); return; } onEsc(e); });
            };
            mk();
            extra.push(() => ac.abort());
        } catch (e) { /* без user activation в некоторых средах — остаётся keydown */ }
    }
    // клик вне контейнера (и вне allow: portal-datepicker внутри модалки не закрывает её)
    if (outside) extra.push(on(document, 'pointerdown', (e) => { if (top() && !inside(e.composedPath ? e.composedPath()[0] : e.target)) typeof outside === 'function' ? outside(e) : release(); }));
    // recapture: фокус ушёл наружу (программно, из виджета) — вернуть на последний внутренний или первый tabbable
    if (recapture) extra.push(on(document, 'focusin', (e) => {
        if (!top()) return;
        const t = e.composedPath ? e.composedPath()[0] : e.target;
        if (inside(t)) { rec.lastFocused = t; return; }
        const back = (rec.lastFocused && rec.lastFocused.isConnected ? rec.lastFocused : null) || tabbables(container)[0] || container;
        if (back === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
        setTimeout(() => { if (top() && !inside(_deepActive())) back.focus(); }, 0);   // после завершения текущей смены фокуса (Firefox игнорирует focus() внутри focusin)
    }));
    // inert для фона: siblings по цепочке до body, кроме allow
    const inerted = [];
    if (inert) {
        for (let node = container; node && node !== document.body; node = node.parentElement) {
            for (const sib of node.parentElement ? node.parentElement.children : []) {
                if (sib === node || sib.inert || (sib.matches && sib.matches(allow))) continue;
                sib.inert = true; inerted.push(sib);
            }
        }
    }

    // Auto-apply ARIA if not present
    if (!container.hasAttribute('role')) container.setAttribute('role', 'dialog');
    if (!container.hasAttribute('aria-modal')) container.setAttribute('aria-modal', 'true');
    _ensureName(container, 'dialog');

    // Фокус: [data-autofocus] → первый tabbable → контейнер; 'container' — статичный контейнер (длинный текст, APG); селектор — свой
    if (autoFocus) {
        let target = null;
        if (typeof autoFocus === 'string' && autoFocus !== 'first' && autoFocus !== 'container') target = container.querySelector(autoFocus);
        else if (autoFocus !== 'container') target = container.querySelector('[data-autofocus]') || tabbables(container)[0];
        if (!target) target = container;
        if (target === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
        target.focus();
        rec.lastFocused = target;
    }

    const onKeyDown = (e) => {
        if (e.key !== 'Tab') return;
        const tabs = tabbables(container);
        if (!tabs.length) { e.preventDefault(); return; }
        const first = tabs[0], last = tabs[tabs.length - 1];
        const a = _deepActive();
        const idx = tabs.indexOf(a);
        if (e.shiftKey && (a === first || a === container || idx < 0)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || idx < 0)) { e.preventDefault(); first.focus(); }
    };

    container.addEventListener('keydown', onKeyDown);

    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        container.removeEventListener('keydown', onKeyDown);
        for (const d of extra) d();
        for (const el of inerted) el.inert = false;
        const i = _trapStack.indexOf(rec); if (i >= 0) _trapStack.splice(i, 1);
        if (!returnFocus) return;
        const rf = typeof returnFocus === 'function' ? returnFocus() : returnFocus instanceof Element ? returnFocus : previousFocus;
        if (rf && rf.isConnected && rf.focus) rf.focus();
        else {                                                                              // триггер удалён (строка list()) — первый живой предок, ближайший focusable в нём
            const host = prevChain.find(n => n.isConnected && !container.contains(n));
            if (!host) return;
            const near = host.querySelector(_FOCUSABLE) || host;
            if (near === host && !host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
            if (near.focus) near.focus({ preventScroll: true });
        }
    };
    release.dispose = release;
    release.refresh = () => { rec.lastFocused = null; };

    if (_currentScope) _currentScope.onDispose(release);
    return release;
}

/**
 * Нативная модалка: open.value = true → dialog.showModal(); Esc/close → open.value = false.
 * Trap, top-layer и light-dismiss даёт браузер.
 */
export function modal(dialog, open) {
    effect(() => {
        const v = open.value;
        if (v && !dialog.open) { _ensureName(dialog, '<dialog>'); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
        else if (!v && dialog.open) dialog.close('');
    }, 'modal');
    on(dialog, 'close', () => { if (open.peek()) open.value = false; });
    on(dialog, 'toggle', (e) => { if (e.newState === 'closed' && open.peek()) open.value = false; });
    on(dialog, 'cancel', (e) => { e.preventDefault(); open.value = false; });
    on(dialog, 'click', (e) => { if (e.target === dialog) open.value = false; });   // backdrop click: the dialog element itself is the target, its content never is
    return () => { if (dialog.open) dialog.close(); };
}

/**
 * Roving tabindex for composite widgets (menus, tablists, toolbars).
 * Arrow keys move focus, only one item has tabindex=0.
 *
 * @example
 *   roving(tablistEl, { orientation: 'horizontal', selector: '[role="tab"]' });
 *
 * @param {Element} container
 * @param {Object} [opts]
 */
export function roving(container, opts = {}) {
    const {
        selector = ':scope > *',
        orientation = 'horizontal', // 'horizontal' | 'vertical' | 'both' | 'grid'
        wrap = true,
        onActivate,
        cols = 'auto',              // grid: число колонок или 'auto' (по геометрии первой строки)
        page = 10,                  // PageUp/PageDown
        typeahead = false,          // буква → ближайший элемент по тексту (буфер 500 мс)
        dir = 'auto',               // 'ltr' | 'rtl' | 'auto' — инверсия горизонтали
        initial = 'selected',       // tab-stop: [aria-selected/checked/current] | 'first' | индекс
        virtual = null,             // aria-activedescendant-режим: фокус остаётся на этом input
        observe = false,            // MutationObserver: refresh при смене детей, фокус переживает удаление
        tree = false,               // ArrowRight/Left раскрывают/сворачивают aria-expanded, Left — к родителю
    } = opts;

    const getItems = () => [...container.querySelectorAll(selector)].filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.hidden && !el.closest('[inert]'));
    // ориентация композита — SR подсказывает верные клавиши (APG)
    if (orientation !== 'both' && orientation !== 'grid' && /^(tablist|toolbar|menubar|menu|listbox|tree|radiogroup)$/.test(container.getAttribute('role') || '') && !container.hasAttribute('aria-orientation')) container.setAttribute('aria-orientation', orientation);
    const active = signal(-1, 'roving:active');
    const rtl = () => dir === 'rtl' || (dir === 'auto' && typeof getComputedStyle === 'function' && getComputedStyle(container).direction === 'rtl');
    const colCount = (arr) => {
        if (cols !== 'auto') return Math.max(1, cols | 0);
        if (arr.length < 2) return 1;
        const t = arr[0].getBoundingClientRect().top; let n = 0;
        while (n < arr.length && Math.abs(arr[n].getBoundingClientRect().top - t) < 1) n++;
        return Math.max(1, n);
    };
    const setActive = (arr, i, { focus: doFocus = true } = {}) => {
        if (i < 0 || i >= arr.length) return;
        if (virtual) {
            arr.forEach((el, k) => { if (!el.id) el.id = _uid('aegis-opt'); el.toggleAttribute('data-active', k === i); if (k === i) el.setAttribute('aria-selected', 'true'); else if (el.getAttribute('aria-selected') === 'true') el.removeAttribute('aria-selected'); });
            virtual.setAttribute('aria-activedescendant', arr[i].id);
            arr[i].scrollIntoView?.({ block: 'nearest' });
        } else {
            arr.forEach((el, k) => el.setAttribute('tabindex', k === i ? '0' : '-1'));
            if (doFocus) arr[i].focus();
        }
        active.value = i;
        if (onActivate) onActivate(arr[i], i);
    };
    const init = () => {
        const arr = getItems();
        if (!arr.length) return;
        let i = typeof initial === 'number' ? initial : initial === 'selected' ? arr.findIndex(el => el.matches('[aria-selected="true"],[aria-checked="true"],[aria-current]')) : 0;
        if (i < 0) i = Math.min(Math.max(active.peek(), 0), arr.length - 1);
        if (virtual) setActive(arr, i, { focus: false }); else { arr.forEach((el, k) => el.setAttribute('tabindex', k === i ? '0' : '-1')); active.value = i; }
    };
    init();

    const moveFocus = (delta) => {
        const arr = getItems();
        const current = virtual ? active.peek() : arr.indexOf(_deepActive());
        if (current < 0) return;
        let next;
        if (delta === -Infinity) next = 0;                          // Home
        else if (delta === Infinity) next = arr.length - 1;         // End
        else if (wrap && orientation !== 'grid') next = (current + delta + arr.length) % arr.length;
        else next = Math.max(0, Math.min(arr.length - 1, current + delta));
        setActive(arr, next);
    };

    let buf = '', bufT = 0;
    const lookup = (arr, from, text) => {
        const q = text.toLowerCase();
        for (let k = 1; k <= arr.length; k++) { const el = arr[(from + k) % arr.length]; if (((el.getAttribute('aria-label') || el.textContent) || '').trim().toLowerCase().startsWith(q)) return (from + k) % arr.length; }
        return -1;
    };
    const onKeyDown = (e) => {
        const arr = getItems();
        if (!arr.length) return;
        const cur = virtual ? active.peek() : arr.indexOf(_deepActive());
        const h = rtl() ? -1 : 1;
        let next;
        if (orientation === 'grid') {
            const c = colCount(arr), row = Math.floor(Math.max(cur, 0) / c);
            const map = { ArrowRight: cur + h, ArrowLeft: cur - h, ArrowDown: cur + c, ArrowUp: cur - c, Home: e.ctrlKey ? 0 : row * c, End: e.ctrlKey ? arr.length - 1 : Math.min(arr.length - 1, row * c + c - 1), PageDown: Math.min(arr.length - 1, cur + page * c), PageUp: Math.max(0, cur - page * c) };
            next = map[e.key];
        } else {
            const axis = { horizontal: { ArrowRight: h, ArrowLeft: -h }, vertical: { ArrowDown: 1, ArrowUp: -1 }, both: { ArrowRight: h, ArrowLeft: -h, ArrowDown: 1, ArrowUp: -1 } }[orientation] || {};
            if (tree && cur >= 0) {                                   // tree: Right раскрывает / к первому ребёнку, Left сворачивает / к родителю
                const el = arr[cur];
                if (e.key === 'ArrowRight') { if (el.getAttribute('aria-expanded') === 'false') { e.preventDefault(); el.setAttribute('aria-expanded', 'true'); return; } }
                if (e.key === 'ArrowLeft') {
                    if (el.getAttribute('aria-expanded') === 'true') { e.preventDefault(); el.setAttribute('aria-expanded', 'false'); return; }
                    const parent = el.parentElement && el.parentElement.closest(selector.replace(/^:scope\s*>\s*/, ''));
                    if (parent && parent !== el && arr.includes(parent)) { e.preventDefault(); setActive(arr, arr.indexOf(parent)); return; }
                }
            }
            const d = axis[e.key];
            if (d !== undefined && cur >= 0) next = wrap ? (cur + d + arr.length) % arr.length : Math.max(0, Math.min(arr.length - 1, cur + d));
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = arr.length - 1;
            else if (e.key === 'PageDown') next = Math.min(arr.length - 1, Math.max(cur, 0) + page);
            else if (e.key === 'PageUp') next = Math.max(0, cur - page);
        }
        if (next !== undefined && next >= 0 && next < arr.length) { e.preventDefault(); if (next !== cur) setActive(arr, next); return; }
        if (typeahead && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
            const now = Date.now();
            buf = now - bufT < 500 ? buf + e.key : e.key; bufT = now;
            let idx = lookup(arr, cur, buf);
            if (idx < 0 && buf.length > 1) { buf = e.key; idx = lookup(arr, cur, buf); }
            if (idx >= 0) { e.preventDefault(); setActive(arr, idx); }
        }
    };

    const keyHost = virtual || container;
    keyHost.addEventListener('keydown', onKeyDown);
    let mo = null;
    if (observe && typeof MutationObserver === 'function') {
        mo = new MutationObserver(() => {
            const arr = getItems();
            if (!arr.length) return;
            const a = _deepActive();
            const had = active.peek();
            if (!virtual && a && !arr.includes(a) && !container.contains(a) && had >= 0) setActive(arr, Math.min(had, arr.length - 1));   // активный удалён — фокус ближайшему по индексу
            else init();
        });
        mo.observe(container, { childList: true, subtree: true });
    }

    const dispose = () => { keyHost.removeEventListener('keydown', onKeyDown); if (mo) mo.disconnect(); };
    if (_currentScope) _currentScope.onDispose(dispose);
    return { dispose, moveFocus, refresh: init, active, setActive: (i) => setActive(getItems(), i) };
}

/**
 * Singleton live region for screen reader announcements.
 * Pre-exists in DOM; messages are written then cleared.
 *
 * @example
 *   announce('3 результата найдено');
 *   announce('Ошибка сохранения', 'assertive');
 *
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness='polite']
 */
const _SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0';
let _live = null;   // { polite: region, assertive: region }; region = { wrap, nodes: [a, b], i, last, lastT, q: [], busy, timer }
function _liveInit() {
    if (_live || typeof document === 'undefined' || !document.body) return _live;
    const mk = (level) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = _SR_ONLY; wrap.setAttribute('data-aegis-live', level);
        const node = () => { const d = document.createElement('div'); d.setAttribute('role', level === 'assertive' ? 'alert' : 'status'); d.setAttribute('aria-live', level); d.setAttribute('aria-atomic', 'true'); wrap.appendChild(d); return d; };
        const r = { wrap, nodes: [node(), node()], i: 1, last: '', lastT: 0, q: [], busy: false, timer: null };   // первое сообщение — в nodes[0]
        document.body.appendChild(wrap);
        return r;
    };
    _live = { polite: mk('polite'), assertive: mk('assertive') };   // регионы живут в DOM ДО первого сообщения — иначе AT часто молчат
    return _live;
}
function _liveReset() { if (_live) { for (const k of ['polite', 'assertive']) { const r = _live[k]; clearTimeout(r.timer); r.wrap.remove(); } _live = null; } }
function _speak(r, message, clearAfter) {
    const node = r.nodes[r.i = 1 - r.i];                       // чередование двух узлов: одинаковый текст объявляется повторно без пустого кадра
    r.nodes[1 - r.i].textContent = '';
    node.textContent = message;
    if (clearAfter) setTimeout(() => { if (node.textContent === message) node.textContent = ''; }, clearAfter);   // виртуальный курсор не натыкается на старое
}
/**
 * Объявление для скринридера. Два постоянных региона (polite: role=status, assertive: role=alert), очередь без потерь
 * (polite-сообщения разносятся ≥ 150 мс, assertive — сразу), дедуп одинакового текста в течение 500 мс, авто-очистка через 7 с.
 *   announce('3 результата'); announce('Ошибка', 'assertive'); announce(msg, { clearAfter: false, dedupe: 0 })
 *   announce(() => res.loading.value ? 'Загрузка' : `${res.data.value.length} результатов`)   // реактивно, в текущем scope
 * Возвращает clear(). announce.init() создаёт регионы заранее (component()/hydrate() зовут сами).
 */
export const announce = /* @__PURE__ */ Object.assign(function announce(message, opts = 'polite') {
    const o = typeof opts === 'string' ? { politeness: opts } : (opts || {});
    if (isSignal(message) || typeof message === 'function') return live(message, o);
    if (typeof document === 'undefined') return () => {};
    const level = o.politeness === 'assertive' ? 'assertive' : 'polite';
    const { clearAfter = 7000, dedupe = 500 } = o;
    const msg = message == null ? '' : String(message);
    if (o.native && typeof document.ariaNotify === 'function') { document.ariaNotify(msg, { priority: level === 'assertive' ? 'high' : 'normal' }); return () => {}; }
    const L = _liveInit(); if (!L) return () => {};
    const r = L[level], now = Date.now();
    if (dedupe && msg === r.last && now - r.lastT < dedupe) return () => {};
    r.last = msg; r.lastT = now;
    const clear = () => { for (const n of r.nodes) if (n.textContent === msg) n.textContent = ''; r.q = r.q.filter(m => m !== msg); };
    if (level === 'assertive') { _speak(r, msg, clearAfter); return clear; }
    r.q.push(msg);
    const pump = () => {
        if (!r.q.length) { r.busy = false; return; }
        r.busy = true;
        _speak(r, r.q.shift(), clearAfter);
        r.timer = setTimeout(pump, 150);                        // следующее сообщение — отдельной мутацией через ≥ 150 мс (CDK LiveAnnouncer)
    };
    if (!r.busy) pump();
    return clear;
}, {
    init: () => { _liveInit(); },
    clear: (level) => { if (!_live) return; for (const k of level ? [level] : ['polite', 'assertive']) { const r = _live[k]; r.q.length = 0; clearTimeout(r.timer); r.timer = null; r.busy = false; r.last = ''; for (const n of r.nodes) n.textContent = ''; } },
});
/**
 * Реактивное объявление: сигнал или функция → регион. Начальное значение не объявляется (это не изменение), равные пропускаются,
 * debounce склеивает поток при вводе; отвязывается со scope. format(v) → строка | null (молчать).
 *   live(() => `${results.value.length} результатов`, { debounce: 300 })
 */
export function live(source, o = {}) {
    const { politeness = 'polite', debounce: ms = 300, format, immediate = false } = o;
    let first = true, timer = null, lastSaid = null;
    const say = (v) => { const m = format ? format(v) : v; if (m == null || m === false || m === '' || String(m) === lastSaid) return; lastSaid = String(m); announce(lastSaid, { politeness, clearAfter: o.clearAfter, dedupe: 0 }); };
    const stop = effect(() => {
        const v = isSignal(source) ? source.value : source();
        if (first) { first = false; if (!immediate) return; }
        untrack(() => { clearTimeout(timer); if (ms > 0) timer = setTimeout(() => say(v), ms); else say(v); });
    }, 'live');
    const off = () => { clearTimeout(timer); stop(); };
    return off;
}


// ============================================================================
// 27. CSS — Constructable Stylesheets + @scope
// ============================================================================

const _cssCache = new Map(); // hash → CSSStyleSheet

/** Simple string hash for cache key */
function _cssHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return 'css' + (h >>> 0).toString(36);
}

/**
 * Scoped CSS via Constructable Stylesheets.
 * Parse once, cache forever, adopt to any root (document or shadowRoot).
 * Auto-generates unique scope class when @scope not natively supported.
 *
 * @example
 *   // Component-scoped styles — parsed once, zero <style> tags
 *   const sheet = css`
 *       .card { padding: 1rem; border: 1px solid var(--border); }
 *       .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.1); }
 *   `;
 *
 *   // With @layer for priority control
 *   const base = css`@layer base { :root { --gap: 8px; } }`;
 *
 * @param {TemplateStringsArray|string} strings
 * @param {...any} values
 * @returns {CSSStyleSheet}
 */
const _cssValue = (v) => {
    if (v == null || v === false) return '';
    if (typeof CSSStyleSheet !== 'undefined' && v instanceof CSSStyleSheet) return [...v.cssRules].map(r => r.cssText).join('\n');
    if (isSignal(v) || typeof v === 'function') {
        _warn('E019', !globalThis.AEGIS_PROD && { what: 'css``: a signal/function inside a stylesheet is static.', why: 'Stylesheets are parsed once and cached.', fix: 'Use cssVars(el, { x }) or styleMap() for reactive values.' });
        return String(isSignal(v) ? v.peek() : v());
    }
    return String(v);
};

function _css(strings, ...values) {
    const raw = typeof strings === 'string'
        ? strings
        : strings.reduce((acc, s, i) => acc + s + (i < values.length ? _cssValue(values[i]) : ''), '');

    const hash = _cssHash(raw);
    if (_cssCache.has(hash)) return _cssCache.get(hash);

    let sheet;
    if (typeof CSSStyleSheet !== 'undefined' && CSSStyleSheet.prototype.replaceSync) {
        // Modern: Constructable Stylesheets (Chrome 73+, FF 101+, Safari 16.4+)
        sheet = new CSSStyleSheet();
        sheet.replaceSync(raw);
    } else {
        // Fallback: <style> element, API-compatible shim
        const style = document.createElement('style');
        style.textContent = raw;
        document.head.appendChild(style);
        sheet = style.sheet;
        sheet._fallbackStyle = style; // для cleanup если нужно
    }
    _cssCache.set(hash, sheet);
    return sheet;
}

/** css.layer('components')`.card{…}` — стили в каскадном слое (Tailwind utilities их перебивают) */
export const css = /* @__PURE__ */ Object.assign(_css, { layer: (name) => (strings, ...values) => {
    const raw = typeof strings === 'string' ? strings : strings.reduce((acc, s, i) => acc + s + (i < values.length ? _cssValue(values[i]) : ''), '');
    return _css(`@layer ${name} { ${raw} }`);
} });

/**
 * Adopt stylesheets onto a root (document or shadowRoot).
 * Deduplicates — same sheet adopted twice is a no-op.
 *
 * @example
 *   const s1 = css`...`;
 *   const s2 = css`...`;
 *   adoptStyles(document, s1, s2);
 *   adoptStyles(myShadowRoot, s1);
 *
 * @param {Document|ShadowRoot} root
 * @param {...CSSStyleSheet} sheets
 */
export function adoptStyles(root, ...sheets) {
    if ('adoptedStyleSheets' in (root || {})) {
        // Modern: adoptedStyleSheets (Chrome 73+, FF 101+, Safari 16.4+)
        const existing = new Set(root.adoptedStyleSheets);
        const toAdd = sheets.filter(s => !existing.has(s));
        if (toAdd.length) {
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...toAdd];
        }
    } else {
        // Fallback: clone <style> into root (document.head or shadowRoot)
        const target = root === document ? document.head : root;
        for (const sheet of sheets) {
            if (sheet._fallbackStyle && !target.contains(sheet._fallbackStyle)) {
                target.appendChild(sheet._fallbackStyle.cloneNode(true));
            }
        }
    }
}

/**
 * Scoped styles for a specific element — auto-wraps in @scope if supported,
 * otherwise adds a unique class and rewrites selectors.
 *
 * @example
 *   scopedStyle(cardEl, `
 *       .title { font-size: 1.5rem; }
 *       .body { padding: 1rem; }
 *   `);
 *
 * @param {Element} el
 * @param {string} cssText
 * @returns {CSSStyleSheet}
 */
const _scopedRef = new Map(); // hash → { sheet, count }

export function scopedStyle(el, cssText, { layer } = {}) {
    const h = _cssHash(cssText);
    el.setAttribute('data-aegis-css', h);          // не трогаем el.id и классы
    const sel = `[data-aegis-css="${h}"]`;
    let e = _scopedRef.get(h);
    if (!e) {
        const body = typeof CSSScopeRule !== 'undefined'
            ? `@scope (${sel}) { ${cssText} }`
            : cssText.replace(/(^|\})\s*([^@{}][^{]*)\{/g, (_, before, s2) => `${before} ${s2.split(',').map(x => `${sel} ${x.trim()}`).join(', ')} {`);
        e = { sheet: css(layer ? `@layer ${layer} { ${body} }` : body), count: 0 };
        _scopedRef.set(h, e);
    }
    const root = el.getRootNode?.() || document;
    if (e.count++ === 0) adoptStyles(root, e.sheet);
    if (_currentScope) _currentScope.onDispose(() => {
        el.removeAttribute('data-aegis-css');
        if (--e.count === 0 && 'adoptedStyleSheets' in root) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sh => sh !== e.sheet);
    });
    return e.sheet;
}


// ============================================================================
// 28. CUSTOM ELEMENTS — Web Components adapter
// ============================================================================

/**
 * Define a Custom Element powered by Aegis reactivity.
 * Bridges signals ↔ attributes ↔ properties, optional Shadow DOM.
 *
 * @example
 *   defineElement('x-counter', {
 *       props: {
 *           count: { type: Number, default: 0, reflect: true },
 *           label: { type: String, default: 'Count' },
 *       },
 *       shadow: true,
 *       styles: css`.host { display: block; padding: 1rem; }`,
 *       setup(el, props) {
 *           const doubled = computed(() => props.count.value * 2);
 *           return () => html`
 *               <span>${() => props.label.value}: ${() => props.count.value}</span>
 *               <span>(×2 = ${doubled})</span>
 *               <button onclick=${() => props.count.value++}>+1</button>
 *           `;
 *       },
 *   });
 *
 * @param {string} tagName — must contain a dash
 * @param {Object} def
 */
export function defineElement(tagName, def) {
    const {
        props: propDefs = {},
        shadow = false,
        styles,
        setup,
        formAssociated = false,
        extends: extendsTag,
    } = def;

    // Build observed attributes list
    const attrToProp = new Map();
    const propToAttr = new Map();
    for (const [prop, cfg] of Object.entries(propDefs)) {
        const attr = cfg.attribute ?? prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        attrToProp.set(attr, { prop, ...cfg });
        propToAttr.set(prop, attr);
    }

    const BaseClass = extendsTag
        ? Object.getPrototypeOf(document.createElement(extendsTag)).constructor
        : HTMLElement;

    class AegisElement extends BaseClass {
        static observedAttributes = [...attrToProp.keys()];
        static formAssociated = formAssociated;

        constructor() {
            super();
            this._aegisScope = createScope();
            this._aegisProps = {};
            this._aegisConnected = false;

            // Create signal for each prop
            for (const [prop, cfg] of Object.entries(propDefs)) {
                // значение, записанное в свойство до upgrade элемента, сохраняем
                const preUpgrade = Object.prototype.hasOwnProperty.call(this, prop) ? this[prop] : undefined;
                if (preUpgrade !== undefined) delete this[prop];
                const fallback = cfg.default ?? (cfg.type === Boolean ? false : null);
                const s = signal(preUpgrade !== undefined ? preUpgrade : fallback, `${tagName}:${prop}`);
                this._aegisProps[prop] = s;

                // Property accessor on element
                Object.defineProperty(this, prop, {
                    get: () => s.value,
                    set: (v) => {
                        s.value = v;
                        // Reflect to attribute
                        if (cfg.reflect) {
                            const attr = propToAttr.get(prop);
                            if (v === false || v == null) this.removeAttribute(attr);
                            else if (v === true) this.setAttribute(attr, '');
                            else this.setAttribute(attr, String(v));
                        }
                    },
                    configurable: true,
                });
            }

            // Shadow DOM
            if (shadow) {
                this.attachShadow({ mode: 'open' });
                if (styles) {
                    const sheet = styles instanceof CSSStyleSheet ? styles : css(styles);
                    this.shadowRoot.adoptedStyleSheets = [sheet];
                }
            }

            // Form internals
            if (formAssociated && this.attachInternals) {
                this._internals = this.attachInternals();
            }
        }

        connectedCallback() {
            this._aegisConnected = true;
            const root = this.shadowRoot || this;

            // синхронное перемещение (disconnect → connect в одном тике): всё живо, ничего не делаем
            if (this._aegisSetupRan && this._aegisAlive) return;

            // clear old DOM on reconnect to prevent duplication
            if (this._aegisSetupRan) {
                while (root.firstChild) root.removeChild(root.firstChild);
            }

            this._aegisScope.run(() => {
                if (setup) {
                    const renderFn = setup(this, this._aegisProps, {
                        internals: this._internals,
                        shadow: this.shadowRoot,
                    });
                    // setup вернул render-функцию или сразу шаблон (как в component())
                    const content = typeof renderFn === 'function' ? renderFn() : renderFn;
                    if (content instanceof Node) root.appendChild(content);
                }
            });
            this._aegisSetupRan = true;
            this._aegisAlive = true;
        }

        disconnectedCallback() {
            this._aegisConnected = false;
            queueMicrotask(() => {
                if (this.isConnected) return;         // это было перемещение, не удаление
                this._aegisScope.dispose();
                this._aegisAlive = false;
                this._aegisScope = createScope();     // fresh for reconnect
            });
        }

        attributeChangedCallback(attr, oldVal, newVal) {
            const cfg = attrToProp.get(attr);
            if (!cfg) return;
            const s = this._aegisProps[cfg.prop];
            if (!s) return;

            // Coerce to declared type
            const typed = _coerceAttr(newVal, cfg.type);
            s.value = typed ?? cfg.default ?? (cfg.type === Boolean ? false : null);   // атрибут снят → default
        }

        // Form-associated: report value
        get form() { return this._internals?.form; }
        get name() { return this.getAttribute('name'); }
        get type() { return this.localName; }
        get validity() { return this._internals?.validity; }
        get validationMessage() { return this._internals?.validationMessage; }
        checkValidity() { return this._internals?.checkValidity(); }
        reportValidity() { return this._internals?.reportValidity(); }
    }

    // Register
    const opts = extendsTag ? { extends: extendsTag } : undefined;
    if (!customElements.get(tagName)) {
        customElements.define(tagName, AegisElement, opts);
    }

    return AegisElement;
}

function _coerceAttr(val, type) {
    if (type === Boolean) return val !== null && val !== 'false';
    if (val === null) return null;
    if (type === Number) return Number(val);
    if (type === Object || type === Array) {
        try { return _safeParse(val); } catch { return val; }
    }
    return val; // String default
}


// ============================================================================
// 29. ANCHOR — CSS Anchor Positioning helper
// ============================================================================

/**
 * Position a floating element relative to an anchor using CSS Anchor Positioning.
 * Falls back to manual JS positioning when native API unavailable.
 *
 * @example
 *   // Position tooltip relative to button
 *   const cleanup = anchor(tooltipEl, buttonEl, {
 *       placement: 'top',
 *       offset: 8,
 *   });
 *   // cleanup() to remove positioning
 *
 * @param {Element} floating — element to position
 * @param {Element} reference — anchor element
 * @param {Object} [opts]
 * @returns {Function} cleanup
 */
export function anchor(floating, reference, opts = {}, _t = _anchorTether) {
    const {
        placement = 'bottom',
        offset = 4,
        autoUpdate = true,
    } = opts;

    // Native CSS Anchor Positioning (Chrome 125+)
    if (CSS.supports?.('anchor-name: --a')) {
        const anchorName = `--aegis-${_cssHash('' + Math.random())}`;
        reference.style.anchorName = anchorName;
        floating.style.positionAnchor = anchorName;
        floating.style.position = 'fixed';

        const positions = {
            top:    { bottom: 'anchor(top)',   left: 'anchor(center)', translate: '-50% 0', marginBottom: `${offset}px` },
            bottom: { top: 'anchor(bottom)',   left: 'anchor(center)', translate: '-50% 0', marginTop: `${offset}px` },
            left:   { right: 'anchor(left)',   top: 'anchor(center)',  translate: '0 -50%', marginRight: `${offset}px` },
            right:  { left: 'anchor(right)',   top: 'anchor(center)',  translate: '0 -50%', marginLeft: `${offset}px` },
        };
        const pos = { ...(positions[placement] || positions.bottom), positionTryFallbacks: 'flip-block, flip-inline', positionVisibility: 'anchors-visible' };
        Object.assign(floating.style, pos);

        const cleanup = () => {
            reference.style.anchorName = '';
            floating.style.positionAnchor = '';
            floating.style.position = '';
            for (const k of Object.keys(pos)) floating.style[k] = '';
        };
        if (_currentScope) _currentScope.onDispose(cleanup);
        return cleanup;
    }

    // JS fallback — manual positioning: measure → write, не чаще кадра (10 scroll-событий → один update)
    let raf = 0;
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; update(); }); };
    const update = () => {
        const refRect = reference.getBoundingClientRect();
        floating.style.position = 'fixed';
        floating.style.zIndex = '9999';

        const fl = floating.getBoundingClientRect();
        let top, left;

        switch (placement) {
            case 'top':
                top = refRect.top - fl.height - offset;
                left = refRect.left + (refRect.width - fl.width) / 2;
                break;
            case 'bottom':
                top = refRect.bottom + offset;
                left = refRect.left + (refRect.width - fl.width) / 2;
                break;
            case 'left':
                top = refRect.top + (refRect.height - fl.height) / 2;
                left = refRect.left - fl.width - offset;
                break;
            case 'right':
                top = refRect.top + (refRect.height - fl.height) / 2;
                left = refRect.right + offset;
                break;
            default:
                top = refRect.bottom + offset;
                left = refRect.left;
        }

        // Clamp to viewport
        top = Math.max(0, Math.min(top, window.innerHeight - fl.height));
        left = Math.max(0, Math.min(left, window.innerWidth - fl.width));

        floating.style.top = `${top}px`;
        floating.style.left = `${left}px`;
    };

    update();
    const resetStyle = () => {
        floating.style.position = '';
        floating.style.top = '';
        floating.style.left = '';
        floating.style.zIndex = '';
    };
    let cleanup;

    if (autoUpdate) {
        const onScroll = () => schedule();
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        window.addEventListener('resize', onScroll, { passive: true });
        // следим за размером и плавающего, и якоря
        const stopFloating = resize(floating, schedule);
        const stopReference = resize(reference, schedule);
        cleanup = () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
            stopFloating?.();
            stopReference?.();
            resetStyle();
        };
    } else {
        cleanup = resetStyle;
    }

    if (_currentScope) _currentScope.onDispose(cleanup);
    return cleanup;
}
const _anchorTether = /* @__PURE__ */ _reg('anchor', anchor);


// ============================================================================
// 30. ROUTER — Navigation API router
// ============================================================================

/** Сигнал «идёт переход с View Transition» (общий для всех роутеров) */
export const transitioning = /* @__PURE__ */ signal(false, 'router:transitioning');

function _compileRoutes(routes, base, parentPattern, depth) {
    const out = [];
    for (const [pattern, def] of Object.entries(routes)) {
        const full = pattern === '*' ? '*' : (parentPattern + pattern).replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
        const node = typeof def === 'function' ? { handler: def } : { ...def };
        node.pattern = full;
        node.depth = depth;
        node.keys = [];
        if (_UP && full !== '*') {   // URLPattern (Baseline 2025): :id(\\d+), {/:lang}?, .json-суффиксы — грамматика платформы, группы уже декодированы
            try {
                const up = new URLPattern({ pathname: base + full });
                node.match = (p) => { const r = up.exec({ pathname: p }); return r ? _groups(r.pathname.groups) : null; };
                if (def && typeof def === 'object' && def.children) { const pre = new URLPattern({ pathname: (base + full).replace(/\/$/, '') + '{/*}?' }); node.prefixMatch = (p) => { const r = pre.exec({ pathname: p }); return r ? _groups(r.pathname.groups) : null; }; }
            } catch (e) { node.match = null; }
        }
        node.regex = full === '*' ? /.*/ : new RegExp(
            '^' + (base + full)
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/:(\w+)/g, (_, k) => { node.keys.push(k); return '([^/]+)'; })
                .replace(/\\\*/g, '.*') + '$'
        );
        if (node.children) {
            node.childRoutes = _compileRoutes(node.children, base, full === '/' ? '' : full, depth + 1);
            // родитель с children матчит и сам (если есть handler/layout), и как префикс для детей
            node.prefix = full === '*' ? /.*/ : new RegExp('^' + (base + full).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '([^/]+)') + '(?:/|$)');
        }
        out.push(node);
    }
    return out;
}

const _UP = typeof URLPattern === 'function';
const _groups = (g) => { const out = {}; for (const k in g) if (!/^\d+$/.test(k) && g[k] !== undefined) out[k] = g[k]; return out; };
/** Найти цепочку уровней [level0, level1, …] для pathname */
function _matchChain(compiled, pathname) {
    for (const node of compiled) {
        if (node.childRoutes) {
            let params = null;
            if (node.prefixMatch) params = node.prefixMatch(pathname);
            else { const pm = pathname.match(node.prefix); if (pm) { params = {}; node.keys.forEach((k, i) => { params[k] = decodeURIComponent(pm[i + 1]); }); } }
            if (params) {
                const rest = _matchChain(node.childRoutes, pathname);
                if (rest) return [{ node, params }, ...rest];
            }
        }
        if (node.match) {
            const params = node.match(pathname);
            if (params && (node.handler || node.load || node.redirect || node.layout || node.component)) return [{ node, params }];
            continue;
        }
        const m = pathname.match(node.regex);
        if (m && (node.handler || node.load || node.redirect || node.layout || node.component)) {
            const params = {};
            node.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
            return [{ node, params }];
        }
    }
    return null;
}

/**
 * Minimal client-side router using Navigation API (modern) or popstate (fallback).
 *
 *   const r = router({
 *       '/':            () => renderHome(),
 *       '/users/:id':   { loader: (p, { signal }) => api.get(`/api/users/${p.id}`, { signal }), handler: (p, { data }) => renderUser(data) },
 *       '/admin':       { guard: () => auth.value || '/login', layout: ({ outlet }) => renderShell(outlet),
 *                         children: { '/': () => renderDashboard(), '/users': () => renderUsers() } },
 *       '/profile':     { redirect: '/me' },
 *       '/report':      { load: () => import('./pages/report.js') },       // default export = handler
 *       '*':            () => render404(),
 *   }, { transition: true, activeClass: 'is-active', preload: 'hover' });
 *
 *   r.route / r.params / r.query / r.pending / r.state — сигналы
 *   const page = r.search('page', { parse: Number, default: 1 });   // двусторонний сигнал ⇄ URL, scope маршрута не пересоздаётся
 *   await r.navigate('/users/42', { state: { scrollTop } });
 *
 * Handler/loader могут быть async: браузер показывает индикатор загрузки, scroll восстанавливается
 * после данных, гонки отменяются через signal. Старая страница видна, пока грузится новая.
 *
 * @param {Object} routes — pattern → handler | { handler | component, loader, guard, redirect, load, layout, children, transition }
 *   component: Page — компонент-функция (тот же контракт, что island()/mount()), монтируется в opts.outlet или outlet layout'а; props = params + { data, query }
 * @param {Object} [opts] — { base, root, transition, activeClass, preload, scroll, beforeEach, searchReload, hash }
 *   hash: true — маршруты в location.hash ('#/users/42'): статический хостинг без rewrite, ссылки <a href="#/users/42">
 *   outlet: '#app' | Element — куда монтировать маршруты-компоненты верхнего уровня
 */
/** После смены страницы: фокус на #fragment | [autofocus] | outlet/main/h1 (tabindex=-1 временно), затем объявление заголовка после кадра (дедуп) */
let _lastRouteMsg = null;
function _afterNav(rootEl, { focus = 'auto', announce: ann = true } = {}, to, from) {
    if (typeof document === 'undefined') return;
    if (focus !== false) {
        const frag = location.hash.length > 1 && !location.hash.startsWith('#/') ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
        let target = frag;
        if (!target) {
            if (typeof focus === 'function') target = focus(rootEl);
            else if (typeof focus === 'string' && focus !== 'auto') target = document.querySelector(focus);
            else if (focus instanceof Element) target = focus;
            else {
                const scopeEl = rootEl && rootEl.nodeType === 1 ? rootEl : (rootEl === document ? document.body : null);
                target = (scopeEl && scopeEl.querySelector('[data-autofocus],[autofocus]')) || (scopeEl && scopeEl !== document.body ? scopeEl : null) || document.querySelector('[data-aegis-outlet],main,[role="main"]') || document.querySelector('h1');
            }
        }
        const a = document.activeElement;
        if (target && !(a && a !== document.body && target !== a && target.contains(a))) {   // handler уже сфокусировал что-то внутри — не мешаем
            if (!target.hasAttribute('tabindex')) {
                target.setAttribute('tabindex', '-1'); target.setAttribute('data-aegis-focus', '');
                target.addEventListener('blur', () => { if (target.hasAttribute('data-aegis-focus')) { target.removeAttribute('tabindex'); target.removeAttribute('data-aegis-focus'); } }, { once: true });
            }
            target.focus({ preventScroll: true });
        }
    }
    if (ann !== false) _frame(() => {                                                          // заголовок часто ставится в handler/effect после рендера
        const msg = typeof ann === 'function' ? ann(to, from) : (document.title || (to && to.path) || '');
        if (msg && msg !== _lastRouteMsg) { _lastRouteMsg = msg; announce(msg, 'polite'); }
    });
}
export function router(routes, opts = {}) {
    const { base = '', root, activeClass = null, preload = false, preloadTTL = 30000, preloadData = true, predict = null, beforeEach, searchReload = false, hash = false } = opts;
    // outlet для маршрутов-компонентов верхнего уровня ({ component }); внутри layout — его живой outlet
    const outletEl = typeof opts.outlet === 'string' ? document.querySelector(opts.outlet) : (opts.outlet || null);
    const rootEl = root || (typeof document !== 'undefined' ? document : null);
    const hasNav = typeof navigation !== 'undefined' && typeof navigation.navigate === 'function';
    // hash-режим: путь и query живут в location.hash ('#/users/42?tab=x') — статический хостинг без rewrite-правил
    const _loc = () => hash ? (location.hash.slice(1) || '/') : location.pathname + location.search;
    const _locPath = () => _loc().split('?')[0];
    const _pathOfUrl = (u) => hash ? (u.hash.slice(1) || '/').split('?')[0] : u.pathname;
    const _fullOfUrl = (u) => hash ? (u.hash.slice(1) || '/') : u.pathname + u.search;

    const route = signal(_locPath(), 'router:route');
    const params = signal({}, 'router:params');
    const query = signal({}, 'router:query');
    const pending = signal(false, 'router:pending');
    const error = signal(null, 'router:error');
    const state = signal(hasNav ? (navigation.currentEntry && navigation.currentEntry.getState()) ?? null : history.state, 'router:state');
    const _search = signal(new URLSearchParams(hash ? (_loc().split('?')[1] || '') : location.search), 'router:search');

    const compiled = _compileRoutes(routes, base, '', 0);

    const resolve = (path) => {
        const [pathname, search] = path.split('?');
        const chain = _matchChain(compiled, pathname);
        if (!chain) return null;
        const merged = {};
        for (const lvl of chain) Object.assign(merged, lvl.params);
        const leaf = chain[chain.length - 1].node;
        return { chain, node: leaf, handler: leaf.handler, params: merged, search: search || '', pathname };
    };

    // Уровни: scope на уровень URL; layout переживает смену дочернего маршрута
    const _parentScope = _currentScope;
    let levels = [];            // [{ node, params, scope, outlet }]
    let currentPath = null;     // pathname текущего маршрута
    let currentPattern = null;
    let navController = null;   // отмена гонок в fallback-ветке
    let _onRoute = null;        // predict: обучение и idle-прогрев после установления маршрута
    // Прогретые loader'ы: fullPath → { p, c, t }; handleRoute забирает готовый Promise, остальные abort-ятся при навигации
    const _loaderCache = new Map();
    const _fullKey = (m) => m.pathname + (m.search ? '?' + m.search : '');
    const warmData = (m) => {
        const full = _fullKey(m);
        if (!preloadData || !m.node.loader || _loaderCache.has(full)) return null;
        const c = new AbortController();
        let p;
        try { p = Promise.resolve(m.node.loader(m.params, { signal: c.signal, query: Object.fromEntries(new URLSearchParams(m.search)), params: m.params, speculative: true })); } catch (e) { p = Promise.reject(e); }
        const rec = { p, c, t: Date.now() };
        p.catch(() => { if (_loaderCache.get(full) === rec) _loaderCache.delete(full); });
        _loaderCache.set(full, rec);
        setTimeout(() => { if (_loaderCache.get(full) === rec) { _loaderCache.delete(full); } }, preloadTTL);
        return p;
    };
    /** r.preload(path, p?) — код + данные маршрута до перехода (hover, predict, вручную); p — вероятность для порога полезности */
    const warmPath = (path, p) => {
        let m;
        try { m = resolve(typeof path === 'string' ? path : _fullOfUrl(path)); } catch (e) { return Promise.resolve(); }
        if (!m || m.node.pattern === currentPattern) return Promise.resolve();
        if (p != null && _utility(null, p) <= ((_config.prefetch && _config.prefetch.minUtility) ?? 0)) { _spec.skipped++; return Promise.resolve(); }
        return _speculate(() => { _resolveHandler(m.node); if (m.node.preload) m.node.preload(m.params); const wp = warmData(m); return wp ? wp.catch(() => {}) : Promise.resolve(); });
    };

    const _disposeFrom = (i) => {
        for (let k = levels.length - 1; k >= i; k--) levels[k].scope.dispose();
        levels.length = i;
    };

    const _sameParams = (a, b) => {
        const ka = Object.keys(a), kb = Object.keys(b);
        return ka.length === kb.length && ka.every(k => a[k] === b[k]);
    };

    /** Ленивый маршрут: { load } → handler из default export (кэш на узле) */
    const _resolveHandler = async (node) => {
        if (node.handler || !node.load) return node.handler;
        if (!node._loaded) node._loaded = Promise.resolve(node.load()).then(m => (typeof m === 'function' ? m : m && m.default));
        node.handler = await node._loaded;
        return node.handler;
    };

    /** Основной переход: guard → loader (старая страница жива) → dispose изменившихся уровней → render */
    /** true | 'blocked' | 'aborted' | '/redirect' — без побочных навигаций (их делает вызывающий: handleRoute или precommitHandler) */
    const runGuards = (match, to, from, signal) => {   // синхронно, пока guard-ы синхронны: промис только при первом await
        const steps = [];
        for (const lvl of match.chain) {
            const n = lvl.node;
            if (n.redirect) steps.push(() => typeof n.redirect === 'function' ? n.redirect(to, from) : n.redirect);
            else if (n.guard) steps.push(() => n.guard(to, from));
        }
        if (beforeEach) steps.push(() => beforeEach(to, from));
        const judge = (g) => (signal && signal.aborted) ? 'aborted' : g === false ? 'blocked' : typeof g === 'string' ? g : null;
        const run = (i) => {
            for (; i < steps.length; i++) {
                const g = steps[i]();
                if (g && typeof g.then === 'function') return g.then((r) => { const j = judge(r); return j !== null ? j : run(i + 1); });
                const j = judge(g); if (j !== null) return j;
            }
            return true;
        };
        return run(0);
    };
    const _hrefOf = (p) => (hash ? location.pathname + location.search + '#' + p : (base || '') + p);
    const handleRoute = async (path, signal, info = {}) => {
        const match = resolve(path);
        if (!match) {
            _warn('E037', !globalThis.AEGIS_PROD && {
                what: `router: no route matches "${path.split('?')[0]}".`,
                why: 'Nothing was rendered for this URL and there is no "*" route to catch it.',
                fix: `Add '*': () => render404() or a redirect, or check the pattern (params are :name, base is "${base || '/'}").`,
            }, 'route:' + path.split('?')[0]);
            return false;
        }
        const from = { path: currentPath, params: params.peek(), query: query.peek() };
        const to = { path: match.pathname, params: match.params, query: Object.fromEntries(new URLSearchParams(match.search)), search: match.search };

        // guard / redirect на любом уровне, до dispose и до loader (при precommitHandler уже выполнены до коммита URL)
        if (!info.guarded) {
            let v = runGuards(match, to, from, signal); if (v && typeof v.then === 'function') v = await v;
            if (v === 'aborted') return false;
            if (v === 'blocked') { if (from.path && from.path !== to.path) navigate(from.path + (from.search || ''), { replace: true }); return 'blocked'; }
            if (typeof v === 'string') { navigate(v, { replace: true }); return 'redirect'; }
        }

        // Только search изменился на том же маршруте → обновить сигналы, scope не трогать
        const sameRoute = currentPattern === match.node.pattern && levels.length === match.chain.length
            && match.chain.every((lvl, i) => levels[i] && levels[i].node === lvl.node && _sameParams(levels[i].params, lvl.params));
        if (sameRoute && !searchReload) {
            batch(() => {
                route.value = match.pathname;
                _search.value = new URLSearchParams(match.search);
                query.value = to.query;
                state.value = hasNav ? (navigation.currentEntry && navigation.currentEntry.getState()) ?? null : history.state;
            });
            return true;
        }

        pending.value = true;
        error.value = null;
        try {
            // loader/load — пока старая страница жива
            const leaf = match.node;
            const handler = await _resolveHandler(leaf);
            let data;
            const fk = _fullKey(match);
            for (const [k, x] of _loaderCache) if (k !== fk) { x.c.abort(); _loaderCache.delete(k); _spec.aborted++; }   // чужие спекуляции — отменить
            if (leaf.loader) {
                const hit = _loaderCache.get(fk);
                if (hit && Date.now() - hit.t < preloadTTL) { _loaderCache.delete(fk); data = await hit.p; }
                else data = await leaf.loader(match.params, { signal, query: to.query, params: match.params });
            }
            if (signal && signal.aborted) return false;

            batch(() => {
                route.value = match.pathname;
                _search.value = new URLSearchParams(match.search);
                query.value = to.query;
                params.value = match.params;
                state.value = hasNav ? (navigation.currentEntry && navigation.currentEntry.getState()) ?? null : history.state;
            });

            // первый изменившийся уровень — точка dispose
            let keep = 0;
            while (keep < levels.length && keep < match.chain.length - 1
                && levels[keep].node === match.chain[keep].node && _sameParams(levels[keep].params, match.chain[keep].params)) keep++;
            _disposeFrom(keep);

            let outlet = keep > 0 ? levels[keep - 1].outlet : null;
            for (let i = keep; i < match.chain.length; i++) {
                const { node, params: lp } = match.chain[i];
                const parent = i > 0 ? levels[i - 1].scope : _parentScope;
                const scope = new Scope(parent, `route:${node.pattern}`);
                const isLeaf = i === match.chain.length - 1;
                const ctx = { data, query: to.query, params: match.params, outlet, signal, route: to, from };
                let nextOutlet = null;
                if (node.layout) {
                    // layout получает живой outlet-элемент (или серверный [data-aegis-outlet])
                    nextOutlet = (outlet && outlet.querySelector && outlet.querySelector('[data-aegis-outlet]')) || document.createElement('div');
                    nextOutlet.setAttribute('data-aegis-outlet', '');
                    ctx.outlet = nextOutlet;
                    await scope.run(() => node.layout(ctx));
                }
                if (isLeaf) {
                    const h = handler || node.handler;
                    if (h) await scope.run(() => h(match.params, { ...ctx, outlet }));
                    else if (node.component) {
                        // { component: Page } — тот же контракт, что island()/mount(): props = params + { data, query }
                        const target = outlet || outletEl;
                        if (!target) throw new Error(`[Aegis] router: route "${node.pattern}" has a component but no outlet — router(routes, { outlet: '#app' }) or a parent layout`);
                        scope.run(() => {
                            const mounted = mount(target, (c) => node.component({ ...c, props: reactive({ ...match.params, data, query: to.query }, { shallow: true }) }));
                            scope.onDispose(() => { if (mounted && typeof mounted.destroy === 'function') mounted.destroy(); if (target.isConnected) target.replaceChildren(); });   // страница ушла — outlet пуст
                        });
                    }
                } else if (!node.layout && node.handler) {
                    await scope.run(() => node.handler(lp, ctx));
                }
                levels.push({ node, params: lp, scope, outlet: nextOutlet || outlet });
                outlet = nextOutlet || outlet;
            }
            currentPath = match.pathname;
            currentPattern = match.node.pattern;
            if (_onRoute) _onRoute();
            if (info.type !== 'initial' || opts.focus === 'initial') _afterNav(outlet || outletEl || (rootEl === document ? document.body : rootEl), opts, to, from);   // первый рендер — фокус браузера не трогаем
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
            error.value = e;
            throw e;
        } finally {
            pending.value = false;
        }
    };

    /** Переход с View Transition (opts.transition), направление back/forward в data-vt-type */
    const _withTransition = (run, info) => {
        const t = opts.transition;
        if (!t || _motionOff() || typeof document === 'undefined' || !document.startViewTransition || info.uaTransition || document.visibilityState === 'hidden') return run();
        const types = typeof t === 'function' ? t(info) : ['page', info.back ? 'back' : 'forward'];
        if (!types) return run();
        const html = document.documentElement;
        html.dataset.vtType = [].concat(types).join(' ');
        transitioning.value = true;
        const supportsTypes = typeof ViewTransition !== 'undefined' && 'types' in ViewTransition.prototype;
        const vt = supportsTypes ? document.startViewTransition({ update: run, types: [].concat(types) }) : document.startViewTransition(run);
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch(() => {});
        return vt.finished.catch(() => {}).finally(() => { transitioning.value = false; delete html.dataset.vtType; });
    };

    const _full = (path) => hash ? '#' + path : (base && path.startsWith(base)) ? path : base + path;

    const navigate = (path, { replace = false, state: st } = {}) => {
        const fullPath = _full(path);
        if (hasNav) {
            const r = navigation.navigate(fullPath, { history: replace ? 'replace' : 'push', state: st });
            return r.finished.catch(() => {});
        }
        if (navController) navController.abort();
        const c = navController = new AbortController();
        if (replace) history.replaceState(st ?? null, '', fullPath);
        else history.pushState(st ?? null, '', fullPath);
        return _withTransition(() => handleRoute(hash ? path : fullPath, c.signal), { back: false }).then(r => {
            if (r === true && (hash || !location.hash)) window.scrollTo(0, 0);
            return r;
        });
    };

    const back = () => history.back();
    const forward = () => history.forward();
    const setState = (st) => {
        if (hasNav && navigation.updateCurrentEntry) navigation.updateCurrentEntry({ state: st });
        else history.replaceState(st, '', location.href);
        state.value = st;
    };

    /** Search-параметр как двусторонний сигнал: r.search('page', { parse: Number, default: 1 }) */
    const search = (name, { parse = (v) => v, serialize = (v) => String(v), default: def, multi = false, history: hist = 'replace' } = {}) => {
        const read = () => {
            const sp = _search.value;
            if (multi) return sp.getAll(name).map(parse);
            const raw = sp.get(name);
            return raw === null ? def : parse(raw);
        };
        const c = computed(read, `search:${name}`);
        const sig = {
            [SIGNAL]: true,
            get value() { return c.value; },
            set value(v) {
                const sp = new URLSearchParams(_search.peek());
                sp.delete(name);
                if (multi) { for (const x of v || []) sp.append(name, serialize(x)); }
                else if (v !== undefined && v !== null && !(def !== undefined && Object.is(v, def))) sp.set(name, serialize(v));
                const qs = sp.toString();
                navigate(_locPath() + (qs ? '?' + qs : ''), { replace: hist !== 'push' });
            },
            peek() { return c.peek(); },
            version() { return c.version(); },
            subscribe(fn) { return c.subscribe(fn); },
            get subs() { return c.subs; },
            set subs(v) { c.subs = v; },
            _isComputed: true, get _live() { return c._live; }, _activate() { c._activate(); }, _deactivate() { c._deactivate(); },
            toJSON() { return c.peek(); },
        };
        return sig;
    };

    // ---- Listen for navigation --------------------------------------------------
    const disposers = [];

    if (hasNav && navigation.addEventListener) {
        const onNavigate = (e) => {
            if (!e.canIntercept || (e.hashChange && !hash) || e.downloadRequest !== null || e.formData) return;
            const src = e.sourceElement && e.sourceElement.closest ? e.sourceElement.closest('a') : null;
            if (src && src.hasAttribute('data-aegis-reload')) return;
            const url = new URL(e.destination.url);
            if (url.origin !== location.origin) return;
            if (hash && (url.pathname !== location.pathname || !url.hash.startsWith('#/'))) return;   // обычная ссылка/якорь — не наш
            const path = _fullOfUrl(url);
            if (!resolve(path)) {                             // несовпавший путь → сервер (server-first); в hash-режиме сервера нет
                if (hash) _warn('E037', !globalThis.AEGIS_PROD && {
                    what: `router: no route matches "${path.split('?')[0]}".`,
                    why: 'Nothing was rendered for this hash and there is no "*" route to catch it.',
                    fix: `Add '*': () => render404() or a redirect, or check the pattern (params are :name).`,
                }, 'route:' + path.split('?')[0]);
                return;
            }
            const back = e.navigationType === 'traverse' && navigation.currentEntry && e.destination.index < navigation.currentEntry.index;
            // Guards ДО коммита URL. Синхронные guard-ы решают прямо в событии navigate: блок = preventDefault (URL не тронут),
            // redirect = отмена + navigate(цель) с тем же видом истории — одна запись, без флика адреса. Асинхронные — через
            // двухфазный intercept (precommitHandler, Chromium 138+); где его нет, handler ждёт тот же промис (guard не выполняется дважды).
            const m0 = resolve(path);
            const from = { path: currentPath, params: params.peek(), query: query.peek() };
            const to = { path: m0.pathname, params: m0.params, query: Object.fromEntries(new URLSearchParams(m0.search)), search: m0.search };
            const gv = runGuards(m0, to, from, e.signal);
            const io = { scroll: opts.scroll || 'after-transition', focusReset: opts.focus === false ? 'after-transition' : 'manual' };   // фокус ставит _afterNav
            const go = (p, guarded) => _withTransition(() => handleRoute(p, e.signal, { back, guarded }), { back, uaTransition: e.hasUAVisualTransition });
            const hist = e.navigationType === 'replace' ? 'replace' : 'push';
            if (!gv || typeof gv.then !== 'function') {
                if (gv === true) { e.intercept({ ...io, handler: () => go(path, true) }); return; }
                if (!e.cancelable) { e.intercept({ ...io, handler: () => go(path, false) }); return; }   // traverse без отмены — старый путь (navigate назад/на redirect)
                e.preventDefault();
                if (typeof gv === 'string') { try { navigation.navigate(new URL(_hrefOf(gv), location.href).href, { history: hist }); } catch (x) { navigate(gv, { replace: hist === 'replace' }); } }
                return;
            }
            let pre = false, target = path;
            e.intercept({
                ...io,
                precommitHandler: async (controller) => {
                    pre = true;
                    const v = await gv;
                    if (v === 'blocked' || v === 'aborted') throw new DOMException('navigation blocked by guard', 'AbortError');
                    if (typeof v === 'string') { target = v; try { controller.redirect(new URL(_hrefOf(v), location.href).href, { history: hist }); } catch (x) { /* redirect недоступен — handleRoute догонит navigate() */ pre = false; } }
                },
                handler: async () => {
                    if (pre) return go(target, true);
                    const v = await gv;                                   // без precommitHandler: URL уже закоммичен — как раньше, navigate назад/на redirect
                    if (v === 'aborted') return false;
                    if (v === 'blocked') { if (from.path && from.path !== to.path) navigate(from.path + (from.search || ''), { replace: true }); return 'blocked'; }
                    if (typeof v === 'string') { navigate(v, { replace: true }); return 'redirect'; }
                    return go(path, true);
                },
            });
        };
        navigation.addEventListener('navigate', onNavigate);
        disposers.push(() => navigation.removeEventListener('navigate', onNavigate));
    } else {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        const onPopState = () => {
            if (navController) navController.abort();
            const c = navController = new AbortController();
            _withTransition(() => handleRoute(_loc(), c.signal), { back: true });
        };
        window.addEventListener('popstate', onPopState);
        disposers.push(() => window.removeEventListener('popstate', onPopState));

        // Intercept <a> clicks — только те, что мы умеем обслужить
        const onClick = (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            const a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-aegis-reload')) return;
            const href = a.getAttribute('href');
            if (!href || (href.startsWith('#') && !(hash && href.startsWith('#/'))) || /^[a-z]+:/i.test(href)) return;
            const url = new URL(href, location.href);
            if (url.origin !== location.origin) return;
            const path = _fullOfUrl(url);
            if (!resolve(path)) return;                       // не наш — уходит на сервер
            e.preventDefault();
            navigate(path);
        };
        (rootEl || document).addEventListener('click', onClick);
        disposers.push(() => (rootEl || document).removeEventListener('click', onClick));
    }

    // Активные ссылки: aria-current="page" (+ activeClass) при каждом изменении route и после первого маршрута
    // (ссылки, отрендеренные после router(), иначе ждали бы следующей навигации)
    let markLinks = null;
    if (rootEl) {
        const scopeForLinks = new Scope(_parentScope, 'router:links');
        markLinks = (cur) => {
            const links = (rootEl === document ? document.body : rootEl);
            if (!links || !links.querySelectorAll) return;
            for (const a of links.querySelectorAll('a[href]')) {
                let href;
                try { href = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
                if (href.origin !== location.origin) continue;
                const p = _pathOfUrl(href);
                const exact = p === '/' || a.getAttribute('data-aegis-active') === 'exact';
                const active = exact ? p === cur : (cur === p || cur.startsWith(p.replace(/\/$/, '') + '/'));
                if (active) { a.setAttribute('aria-current', 'page'); if (activeClass) a.classList.add(activeClass); }
                else { if (a.getAttribute('aria-current') === 'page') a.removeAttribute('aria-current'); if (activeClass) a.classList.remove(activeClass); }
            }
        };
        scopeForLinks.run(() => effect(() => markLinks(route.value), 'router:active-links'));
        disposers.push(scopeForLinks.dispose);
    }

    // Preload ленивых маршрутов/данных по намерению: hover | visible
    if (preload && rootEl) {
        const po = typeof preload === 'object' ? preload : { on: preload === true ? 'hover' : preload };
        const warm = (a) => {
            const href = a.getAttribute('href');
            if (!href || a.getAttribute('data-aegis-preload') === 'off') return;
            let u; try { u = new URL(href, location.href); } catch (e) { return; }
            if (u.origin !== location.origin) return;
            warmPath(_fullOfUrl(u));
        };
        const target = rootEl === document ? document.body : rootEl;
        disposers.push(_intent(target, 'a[href]', warm, { on: po.on || 'hover', delay: po.delay ?? ((_config.prefetch && _config.prefetch.hoverDelay) ?? 80), vmax: po.velocity ?? 300, rootMargin: po.rootMargin ?? '200px' }));
    }
    // Предиктор: после каждого перехода учимся (pattern → pattern) и в idle греем top-K вероятных следующих маршрутов из ссылок страницы
    if (predict) {
        const pd = typeof predict === 'object' ? predict : {};
        const pred = pd.predictor || predictor();
        const topK = pd.topK ?? 2, minP = pd.minP ?? 0.3;
        let prevPat = null;
        const candidates = () => {
            const scope = outletEl || (rootEl === document ? document.body : rootEl);
            const out = [];
            if (!scope || !scope.querySelectorAll) return out;
            for (const a of scope.querySelectorAll('a[href]')) {
                if (a.getAttribute('data-aegis-preload') === 'off') continue;
                let u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
                if (u.origin !== location.origin) continue;
                const full = _fullOfUrl(u), m = resolve(full);
                if (m && m.node.pattern !== currentPattern && !out.some(c => c.pattern === m.node.pattern)) out.push({ pattern: m.node.pattern, full });
            }
            return out;
        };
        _onRoute = () => {
            const pat = currentPattern;
            if (prevPat && prevPat !== pat) pred.learn(prevPat, pat);
            prevPat = pat;
            _idle(() => {
                if (currentPattern !== pat) return;
                const cs = candidates(); if (!cs.length) return;
                let k = 0;
                for (const { key, p } of pred.next(pat, cs.map(c => c.pattern))) {
                    if (k >= topK || p < minP) break;
                    const c = cs.find(x => x.pattern === key);
                    if (c) { warmPath(c.full, p); k++; }
                }
            });
        };
    }

    const cleanup = () => {
        for (const d of disposers) d();
        disposers.length = 0;
        _disposeFrom(0);
        if (navController) navController.abort();
    };
    if (_currentScope) _currentScope.onDispose(cleanup);

    // outlet занят на время pending (loader/lazy-код)
    if (outletEl) disposers.push(effect(() => { if (pending.value) outletEl.setAttribute('aria-busy', 'true'); else outletEl.removeAttribute('aria-busy'); }, 'router:busy'));
    // Initial route
    const ready = Promise.resolve(handleRoute(_loc(), undefined, { type: 'initial' })).catch(() => false);
    if (markLinks) ready.then(() => markLinks(route.peek()));

    const matches = (path) => !!resolve(path);
    return { route, params, query, pending, error, state, transitioning, search, navigate, back, forward, setState, matches, preload: warmPath, cleanup, dispose: cleanup, ready };
}


// ============================================================================
// 31. COMMAND — Invoker Commands pattern
// ============================================================================

/**
 * Declarative command system — binds [data-command] triggers to handlers.
 * Progressive enhancement: works with native invoker commands (commandfor)
 * or falls back to click/keydown delegation.
 *
 * @example
 *   command(appEl, {
 *       'open-dialog':  (trigger, target) => target.showModal(),
 *       'close-dialog': (trigger, target) => target.close(),
 *       'toggle-menu':  (trigger) => menuOpen.value = !menuOpen.peek(),
 *       'delete-item':  (trigger) => deleteItem(trigger.dataset.itemId),
 *   });
 *
 *   // HTML: <button data-command="open-dialog" data-target="#my-dialog">Open</button>
 *
 * @param {Element} root
 * @param {Object} commands — { commandName: handler(trigger, target?) }
 * @returns {{ dispose: Function, add: Function }}
 */
const _openState = (t) => t.tagName === 'DIALOG' ? t.open : (t.matches && t.matches(':popover-open')) ? true : !t.hidden;
const _syncTrigger = (trigger, target, before) => {
    if (!trigger || !trigger.setAttribute) return;
    if (!target.id) target.id = _uid('aegis-target');
    if (!trigger.hasAttribute('aria-controls')) trigger.setAttribute('aria-controls', target.id);
    queueMicrotask(() => { const after = _openState(target); if (after !== before || trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', String(after)); });
};
export function command(root, commands = {}) {
    const handlers = new Map(Object.entries(commands));

    const _cmdName = (c) => (c || '').replace(/^--/, '');
    const execute = (trigger) => {
        const cmd = _cmdName(trigger.dataset.command || trigger.getAttribute('command'));
        if (!cmd) return;

        const handler = handlers.get(cmd);
        if (!handler) {
            if ((!globalThis.AEGIS_PROD && _dev())) _warn('CMD', !globalThis.AEGIS_PROD && {
                what: `Unknown command: "${cmd}"`,
                why: 'No handler registered for this command name',
                fix: `Add "${cmd}" to your command() handlers`,
            });
            return;
        }

        // Resolve target
        const targetSel = trigger.dataset.target || trigger.getAttribute('commandfor');
        const target = targetSel ? root.querySelector(targetSel) || document.querySelector(targetSel) : null;

        const before = target ? _openState(target) : null;
        handler(trigger, target);
        if (target) _syncTrigger(trigger, target, before);   // aria-controls + aria-expanded, если цель открылась/закрылась
    };

    // Try native invoker commands (commandfor attribute + command event)
    const onCommand = (e) => {
        const cmd = _cmdName(e.command);   // спека: кастомные команды — "--name", e.command возвращает с префиксом
        const h = handlers.get(cmd);
        const before = e.target ? _openState(e.target) : null;
        if (h) { e.preventDefault(); h(e.source, e.target); if (e.target) _syncTrigger(e.source, e.target, before); }
        else if (e.command && !e.command.startsWith('--') && e.target) queueMicrotask(() => _syncTrigger(e.source, e.target, before));   // встроенные (show-modal, toggle-popover…): только aria
        else if (cmd && (!globalThis.AEGIS_PROD && _dev())) _warn('CMD', !globalThis.AEGIS_PROD && { what: `Unknown command: "${e.command}"`, why: 'No handler registered for this command name; custom commands must start with "--".', fix: `Add "${cmd}" to your command() handlers and write command="--${cmd}" in the markup` });
    };

    // Fallback: delegate click + Enter/Space
    const onClick = (e) => {
        const trigger = e.target.closest('[data-command]');
        if (trigger) execute(trigger);
    };
    const onKeyDown = (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const trigger = e.target.closest('[data-command]');
        if (!trigger) return;
        // нативно активируемые элементы сами генерируют click — не дублировать
        if (trigger.matches('button, a[href], input, summary, [role="button"]:is(button)')) return;
        e.preventDefault();
        execute(trigger);
    };

    root.addEventListener('command', onCommand);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);

    const dispose = () => {
        root.removeEventListener('command', onCommand);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeyDown);
    };

    const add = (name, handler) => handlers.set(name, handler);

    if (_currentScope) _currentScope.onDispose(dispose);
    return { dispose, add };
}


// ============================================================================
// 32. VIRTUAL SCROLL — content-visibility virtualization
// ============================================================================

/** Оконная виртуализация (DOM recycling): фиксированная высота строки, ~(видимые + 2·overscan) узлов на любой размер массива */
function _windowScroll(container, items, { itemHeight, key, renderItem, overscan, height }) {
    if (height) container.style.height = typeof height === 'number' ? height + 'px' : height;
    const spacer = document.createElement('div');
    spacer.style.cssText = 'position:relative;width:100%;';
    const viewport = document.createElement('div');
    viewport.style.cssText = 'position:absolute;left:0;right:0;top:0;';
    spacer.appendChild(viewport);
    container.appendChild(spacer);

    const read = () => { const v = isSignal(items) ? items.value : typeof items === 'function' ? items() : items; return Array.isArray(v) ? v : []; };
    const scrollTop = signal(0, 'virtual:scrollTop');
    const clientHeight = signal(container.clientHeight || (typeof height === 'number' ? height : 400), 'virtual:height');
    let raf = 0;
    const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; scrollTop.value = container.scrollTop; }); };
    on(container, 'scroll', onScroll, { passive: true });
    resize(container, () => { clientHeight.value = container.clientHeight || clientHeight.peek(); });
    on(document, 'visibilitychange', () => { if (!document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } scrollTop.value = container.scrollTop; } });   // в фоне rAF не идёт

    const range = computed(() => {
        const arr = read();
        const total = arr.length;
        const start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan);
        const end = Math.min(total, Math.ceil((scrollTop.value + clientHeight.value) / itemHeight) + overscan);
        return { start, end, total };
    }, 'virtual:range');
    const slice = computed(() => { const r = range.value; return read().slice(r.start, r.end); }, 'virtual:slice');

    effect(() => {
        const r = range.value;
        spacer.style.height = (r.total * itemHeight) + 'px';
        viewport.style.transform = `translateY(${r.start * itemHeight}px)`;
    }, 'virtual:layout');

    const keyFn = typeof key === 'function' ? key : (item) => item?.[key];
    viewport.appendChild(list(slice, (row, i) => {
        const index = { [SIGNAL]: true, get value() { return range.value.start + i.value; }, peek: () => range.peek().start + i.peek(), subscribe: (fn) => i.subscribe(fn), version: () => i.version() + range.version() };
        return renderItem(row, index);
    }, { key: keyFn }));
    _flushAnchors();

    const scrollToIndex = (i, { align = 'start' } = {}) => {
        const total = read().length;
        const idx = Math.max(0, Math.min(total - 1, i));
        let top = idx * itemHeight;
        if (align === 'center') top -= (clientHeight.peek() - itemHeight) / 2;
        else if (align === 'end') top -= clientHeight.peek() - itemHeight;
        container.scrollTop = Math.max(0, top);
        scrollTop.value = container.scrollTop;
    };
    const dispose = () => { if (raf) cancelAnimationFrame(raf); container.remove(); };
    if (_currentScope) _currentScope.onDispose(dispose);
    return { container, range, scrollToIndex, refresh: () => { scrollTop.value = container.scrollTop; }, dispose };
}

/**
 * Virtual scroll using content-visibility: auto for native browser virtualization.
 * Строки keyed и живут в своём scope: при изменении массива рендерятся только
 * новые/заменённые элементы, остальные узлы переставляются; чанк, чей состав
 * не изменился, не трогается вовсе.
 *
 * @example
 *   const { container } = virtualScroll(parentEl, items, {
 *       itemHeight: 48,
 *       chunkSize: 20,
 *       key: 'id',
 *       renderItem: (item, index) => html`<div class="row">${item.name}</div>`,
 *   });
 *
 * @param {Element} parent
 * @param {Array|Signal|Function} items — массив, сигнал, reactive-массив или функция
 * @param {Object} opts
 */
export function virtualScroll(parent, items, opts = {}) {
    const {
        itemHeight = 40,
        chunkSize = 50,
        renderItem,
        key = 'id',
    } = opts;
    const keyFn = typeof key === 'function' ? key : (item) => item?.[key];

    const container = document.createElement('div');
    container.style.cssText = 'position:relative;overflow:auto;';
    parent.appendChild(container);

    // ---- режим окна: в DOM только видимые + overscan строк, spacer держит высоту, узлы переиспользуются по ключу
    if (opts.mode === 'window') return _windowScroll(container, items, { itemHeight, key, renderItem, overscan: opts.overscan ?? 8, height: opts.height });

    const rows = new Map(); // key → { node, scope, item }
    const parentScope = _currentScope;

    const read = () => {
        const v = isSignal(items) ? items.value : typeof items === 'function' ? items() : items;
        return Array.isArray(v) ? v : [];
    };

    const renderRow = (item, i) => {
        const scope = new Scope(parentScope);
        const prevTracking = _tracking;
        _tracking = null; // сигналы строки не должны перезапускать весь список
        try {
            const nodes = _nodesOf(scope.run(() => renderItem(item, i)));
            return { nodes, scope, item };
        } finally {
            _tracking = prevTracking;
        }
    };

    const render = (arr) => {
        // ключи: дубликаты и undefined → позиционные, как в list()
        const seen = new Map();
        const keys = arr.map((it, i) => {
            let k = keyFn(it, i);
            if (k == null) k = '__aegis_nokey__';
            const n = seen.get(k) || 0;
            seen.set(k, n + 1);
            return n ? `${k}#${n}` : k;
        });
        const keep = new Set(keys);
        for (const [k, r] of rows) {
            if (!keep.has(k)) { r.scope.dispose(); _removeNodes(r.nodes); rows.delete(k); }
        }
        const entries = keys.map((k, i) => {
            let r = rows.get(k);
            if (!r || !Object.is(r.item, arr[i])) {
                if (r) { r.scope.dispose(); _removeNodes(r.nodes); }
                r = renderRow(arr[i], i);
                rows.set(k, r);
            }
            return r;
        });

        const totalChunks = Math.ceil(entries.length / chunkSize);
        for (let c = 0; c < totalChunks; c++) {
            let chunk = container.children[c];
            if (!chunk) { chunk = document.createElement('div'); container.appendChild(chunk); }
            const slice = [];
            for (const e of entries.slice(c * chunkSize, (c + 1) * chunkSize)) for (const n of e.nodes) slice.push(n);
            // content-visibility: auto — браузер не рендерит чанки вне экрана
            const n = Math.min(entries.length - c * chunkSize, chunkSize);
            if (chunk._n !== n) { chunk._n = n; chunk.style.cssText = `content-visibility:auto;contain-intrinsic-size:auto 100% ${n * itemHeight}px;`; }
            let same = chunk.childNodes.length === slice.length;
            for (let i = 0; same && i < slice.length; i++) same = chunk.childNodes[i] === slice[i];
            if (same) continue;
            for (const n of slice) _move(chunk, n, null); // moveBefore: строка переезжает между чанками, сохраняя состояние
        }
        while (container.children.length > totalChunks) container.lastElementChild.remove();
    };

    effect(() => {
        const arr = read();
        arr.length; // reactive-массив: подписка на его версию
        render(arr);
    }, 'virtualScroll');

    const dispose = () => {
        for (const r of rows.values()) r.scope.dispose();
        rows.clear();
        container.remove();
    };

    if (_currentScope) _currentScope.onDispose(dispose);
    return { container, refresh: () => render(read()), dispose };
}


// ============================================================================
// 33. OFFLINE RESOURCE — IDB cache + Background Sync
// ============================================================================

/**
 * IDB wrapper with proper version management.
 * Tracks known stores per dbName; bumps version when a new store is needed.
 */
const _idbRegistry = new Map(); // dbName → { db, stores: Set }

function _idb(dbName, storeName) {
    let _db = null;
    const getDB = () => {
        if (_db) return Promise.resolve(_db);

        const reg = _idbRegistry.get(dbName);
        if (reg?.db && reg.stores.has(storeName)) {
            _db = reg.db;
            return Promise.resolve(_db);
        }

        return new Promise((resolve, reject) => {
            // Open first to get current version
            const probe = indexedDB.open(dbName);
            probe.onsuccess = () => {
                const currentVersion = probe.result.version;
                const hasStore = probe.result.objectStoreNames.contains(storeName);
                probe.result.close();

                if (hasStore) {
                    // Reopen at same version
                    const req2 = indexedDB.open(dbName, currentVersion);
                    req2.onsuccess = () => {
                        _db = req2.result;
                    _db.onversionchange = () => { try { _db.close(); } catch (e) { /* */ } _db = null; _idbRegistry.delete(dbName); };   // другая вкладка повышает версию — уступить
                        if (!_idbRegistry.has(dbName)) _idbRegistry.set(dbName, { db: _db, stores: new Set() });
                        _idbRegistry.get(dbName).stores.add(storeName);
                        _idbRegistry.get(dbName).db = _db;
                        resolve(_db);
                    };
                    req2.onerror = () => reject(req2.error);
                    req2.onblocked = () => reject(new Error(`[Aegis] IndexedDB "${dbName}" is blocked by another tab holding an old connection — reload that tab`));
                } else {
                    // Need upgrade — bump version
                    const req2 = indexedDB.open(dbName, currentVersion + 1);
                    req2.onupgradeneeded = () => {
                        if (!req2.result.objectStoreNames.contains(storeName)) {
                            req2.result.createObjectStore(storeName);
                        }
                    };
                    req2.onsuccess = () => {
                        _db = req2.result;
                    _db.onversionchange = () => { try { _db.close(); } catch (e) { /* */ } _db = null; _idbRegistry.delete(dbName); };   // другая вкладка повышает версию — уступить
                        if (!_idbRegistry.has(dbName)) _idbRegistry.set(dbName, { db: _db, stores: new Set() });
                        _idbRegistry.get(dbName).stores.add(storeName);
                        _idbRegistry.get(dbName).db = _db;
                        resolve(_db);
                    };
                    req2.onerror = () => reject(req2.error);
                    req2.onblocked = () => reject(new Error(`[Aegis] IndexedDB "${dbName}" is blocked by another tab holding an old connection — reload that tab`));
                }
            };
            probe.onerror = () => {
                // DB doesn't exist yet — create with version 1
                const req2 = indexedDB.open(dbName, 1);
                req2.onupgradeneeded = () => req2.result.createObjectStore(storeName);
                req2.onsuccess = () => {
                    _db = req2.result;
                    _db.onversionchange = () => { try { _db.close(); } catch (e) { /* */ } _db = null; _idbRegistry.delete(dbName); };   // другая вкладка повышает версию — уступить
                    _idbRegistry.set(dbName, { db: _db, stores: new Set([storeName]) });
                    resolve(_db);
                };
                req2.onerror = () => reject(req2.error);
                    req2.onblocked = () => reject(new Error(`[Aegis] IndexedDB "${dbName}" is blocked by another tab holding an old connection — reload that tab`));
            };
        });
    };

    return {
        async get(key) {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const req = tx.objectStore(storeName).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },
        async set(key, value) {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },
        async delete(key) {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },
        async keys() {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },
        async getAll() {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const st = db.transaction(storeName, 'readonly').objectStore(storeName);
                const rk = st.getAllKeys(), rv = st.getAll();
                rv.onsuccess = () => resolve(rk.result.map((k, i) => [k, rv.result[i]]));
                rv.onerror = () => reject(rv.error);
            });
        },
    };
}

const _MAX_QUEUE = 1000; // limit queue size
const _QUEUE_KEY = '__aegis_mutations__';
const _offlineStores = new Map();       // dbName/storeName → idb wrapper
const _offlineRefreshers = new Map();   // cacheKey → Set<refresh>
let _offlineFlushing = false;
let _offlineFlushTimer = null;
let _offlineBackoff = 1000;
const _syncing = /* @__PURE__ */ signal(false, 'offline:syncing');
const _online = /* @__PURE__ */ signal(typeof navigator !== 'undefined' ? navigator.onLine : true, 'offline:online');
let _offlineListeners = false;

function _offlineStore(dbName = 'aegis-cache', storeName = 'resources') {
    const k = dbName + '/' + storeName;
    let s = _offlineStores.get(k);
    if (!s) { s = _idb(dbName, storeName); _offlineStores.set(k, s); }
    return s;
}

function _installOfflineListeners() {
    if (_offlineListeners || typeof window === 'undefined') return;
    _offlineListeners = true;
    window.addEventListener('online', () => { _online.value = true; _flushOffline(); });
    window.addEventListener('offline', () => { _online.value = false; });
}

const _isNetworkError = (e) => e?.name !== 'AbortError' && (!e?.status || e.status === 408 || e.status === 429 || e.status >= 500);

/** Положить мутацию в IDB-очередь (одна на приложение) и попросить Background Sync */
let _offSeq = 0;
async function _enqueueOffline(m, store) {
    m.seq = String(Date.now()).padStart(13, '0') + ':' + String(++_offSeq).padStart(4, '0') + ':' + _tabId;
    m.attempts = 0;
    m.scope = _scopeId();   // принципал: чужая мутация не воспроизводится под текущей сессией
    await store.set('mut:' + m.seq, m).catch(() => {});             // put атомарен; порядок = лексикографический seq
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(reg => { if (reg.sync) return reg.sync.register(m.syncTag || 'aegis-sync'); })
            .catch(() => {});
    }
}

/** Отправить очередь: каждая мутация с retry; оставшиеся — следующий flush с backoff, не только по online */
/** Эксклюзивный участок между вкладками (Web Locks); без API — просто выполнить */
function _withLock(name, fn) {
    if (typeof navigator === 'undefined' || !navigator.locks) return fn();
    return navigator.locks.request(name, { ifAvailable: true }, (lock) => lock ? fn() : undefined);
}
/**
 * Лидер среди вкладок (Web Locks): Signal<boolean> — true в одной вкладке, при её закрытии лок переходит следующей.
 *   const isLeader = leader(); effect(() => { if (isLeader.value) startSSE(); });
 * Без Web Locks — fallback (default true: каждая вкладка считает себя лидером).
 */
export function leader(name = 'aegis', { fallback = true } = {}) {
    const is = signal(false, 'leader:' + name);
    if (typeof navigator === 'undefined' || !navigator.locks) { is.value = fallback; return is; }
    const ac = new AbortController();
    let grantDone = null;
    navigator.locks.request('aegis:leader:' + name, { signal: ac.signal }, () => { is.value = true; return new Promise((res) => { grantDone = res; }); }).catch(() => {});
    const off = () => { ac.abort(); if (grantDone) { grantDone(); grantDone = null; } is.value = false; };   // выданный лок отпускает только завершение callback
    if (_currentScope) _currentScope.onDispose(off);
    is.release = off;
    return is;
}
let _flushAgain = false;
async function _flushOffline(store = _offlineStore()) {
    if (_offlineFlushing) { _flushAgain = true; return; }                       // идёт наш проход — повторить после него (записи, добавленные во время прохода, и потерянный online)
    return _withLock('aegis:sync', () => _flushOfflineBody(store));
}
const _offlineFailed = /* @__PURE__ */ signal([], 'offline:failed');
async function _flushOfflineBody(store) {
    if (_offlineFlushing) return;
    _offlineFlushing = true;
    if (_offlineFlushTimer) { clearTimeout(_offlineFlushTimer); _offlineFlushTimer = null; }
    try {
        // миграция старого формата (один массив) в записи mut:<seq>
        try { const legacy = await store.get(_QUEUE_KEY); if (legacy && legacy.length) { for (const m of legacy) await _enqueueOffline(m, store); await store.delete(_QUEUE_KEY); } } catch (x) { /* */ }
        let keys;
        try { keys = (await store.keys()).filter(k => typeof k === 'string' && k.startsWith('mut:')).sort(); } catch (x) { return; }
        if (!keys.length) return;
        _syncing.value = true;
        const blocked = new Set();                                       // причинность: FIFO внутри cacheKey
        const touched = new Set();
        let remaining = 0;
        for (const k of keys) {
            let m = null; try { m = await store.get(k); } catch (x) { /* */ }
            if (!m) continue;
            if (m.cacheKey && blocked.has(m.cacheKey)) { remaining++; continue; }
            if ((m.scope || '') !== _scopeId()) {   // мутация другого принципала: не отправлять с текущими cookie/CSRF — в failed с кодом
                await store.delete(k).catch(() => {});
                _offlineFailed.value = [..._offlineFailed.peek(), { mutation: m, error: Object.assign(new Error('[Aegis] offline mutation belongs to another session'), { code: 'scope-mismatch' }) }];
                continue;
            }
            try {
                await request(m.url, { method: m.method, body: m.body, headers: { 'Idempotency-Key': m.mutId } });   // одна попытка за проход: повторы — следующим проходом с backoff, лок не держим
                await store.delete(k).catch(() => {});
                if (m.cacheKey) touched.add(m.cacheKey);
            } catch (err) {
                m.attempts = (m.attempts || 0) + 1;
                if (!_isNetworkError(err) || m.attempts >= (m.maxAttempts || 10)) {   // 4xx или исчерпаны попытки → dead-letter; следующие по ключу идут дальше
                    await store.delete(k).catch(() => {});
                    _offlineFailed.value = [..._offlineFailed.peek(), { mutation: m, error: err }];
                } else {
                    await store.set(k, m).catch(() => {}); remaining++;
                    if (m.cacheKey) blocked.add(m.cacheKey);                          // FIFO: пока эта не ушла, следующие по ключу ждут
                    if (!err || !err.status) { remaining += keys.length - keys.indexOf(k) - 1; break; }   // сети нет — остальное не пробуем, ждём backoff/online
                }
            }
        }
        _syncing.value = false;
        // сервер применил мутации — обновить данные ресурсов
        for (const k of touched) for (const refresh of (_offlineRefreshers.get(k) || [])) refresh();
        if (remaining) {
            _offlineBackoff = Math.min(60000, 1000 + Math.random() * Math.max(0, _offlineBackoff * 3 - 1000));   // decorrelated jitter
            _offlineFlushTimer = setTimeout(() => _flushOffline(store), _offlineBackoff);
        } else {
            _offlineBackoff = 1000;
        }
    } finally {
        _offlineFlushing = false;
        if (_flushAgain) { _flushAgain = false; setTimeout(() => _flushOffline(store), 0); }   // после освобождения лока
        _syncing.value = false;
    }
}

/**
 * Offline-first ресурс: IndexedDB-кэш + оптимистичные мутации + очередь на время оффлайна + Background Sync.
 * Источник реактивен (функция от сигналов), ключ кэша — URL.
 *   const todos = resource('/api/todos', { offline: true });
 *   todos.mutate(list => [...list, item]);                          // локально + в IDB
 *   todos.send('POST', '/api/todos', item, { optimistic: l => [...l, item] });   // сеть; офлайн → в очередь
 */
function _offlineResource(source, opts = {}) {
    const {
        dbName = 'aegis-cache',
        storeName = 'resources',
        staleTime = 0,
        transform = (d) => d,
        syncTag = 'aegis-sync',
        initial = null,
        immediate = true,
        share = true,
        retry,
    } = opts;
    const fetcher = opts.fetcher || _fetcher();
    const store = _offlineStore(dbName, storeName);
    _installOfflineListeners();

    const resolveUrl = () => typeof source === 'function' ? source() : source;
    const data = signal(initial, 'offline:data');
    const inflight = signal(false, 'offline:inflight');
    const started = signal(false, 'offline:started');
    const error = signal(null, 'offline:error');
    const key = signal(null, 'offline:key');
    let controller = null, last = null, cacheKey = null;

    const abort = () => { if (controller) { controller.abort(); controller = null; } };

    const loadCached = async (k) => {
        try {
            const cached = await store.get(k);
            if (cached && key.peek() === k) {
                data.value = cached.data;
                started.value = true;
                return Date.now() - cached.timestamp < staleTime;
            }
        } catch { /* нет кэша */ }
        return false;
    };

    const fetchRemote = (url = resolveUrl()) => {
        if (!url) return Promise.resolve();
        abort();
        const c = controller = new AbortController();
        batch(() => { inflight.value = true; started.value = true; error.value = null; });
        const p = (async () => {
            try {
                const result = await withRetry(() => fetcher(url, { signal: c.signal }), { retries: _retries(retry), signal: c.signal });
                if (c.signal.aborted) return;
                const next = transform(result);
                data.value = share ? _share(data.peek(), next) : next;
                await store.set(url, { data: next, timestamp: Date.now() }).catch(() => {});
            } catch (e) {
                if (e?.name === 'AbortError' || c.signal.aborted) return;
                error.value = e;
            } finally {
                if (controller === c) { controller = null; inflight.value = false; }
            }
        })();
        last = _trackPromise(p);
        return p;
    };

    const load = async (url) => {
        if (cacheKey) { const set = _offlineRefreshers.get(cacheKey); if (set) { set.delete(refresh); if (!set.size) _offlineRefreshers.delete(cacheKey); } }
        cacheKey = url;
        key.value = url;
        if (!url) { abort(); return; }
        (_offlineRefreshers.get(url) || _offlineRefreshers.set(url, new Set()).get(url)).add(refresh);
        const fresh = await loadCached(url);
        if (key.peek() !== url) return;
        if (!fresh && _online.peek()) await fetchRemote(url);
        if (_online.peek()) _flushOffline(store);   // мутации прошлой сессии — сразу
    };

    const refresh = () => fetchRemote(resolveUrl());
    /** Локальная запись (оптимистичная) — и в IDB, чтобы пережить перезагрузку */
    const mutateLocal = (fn) => {
        data.value = typeof fn === 'function' ? fn(data.peek()) : fn;
        if (cacheKey) store.set(cacheKey, { data: data.peek(), timestamp: Date.now() }).catch(() => {});
    };
    /** Сетевая мутация; при сетевой ошибке или оффлайне — в очередь (без отката: сервер догонит) */
    const send = async (method, url, body, { optimistic } = {}) => {
        const mutId = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (optimistic) mutateLocal(optimistic);
        const m = { mutId, method, url, body, cacheKey, syncTag, maxAttempts: opts.maxAttempts };
        if (!_online.peek()) { await _enqueueOffline(m, store); return undefined; }
        try {
            _syncing.value = true;
            const result = await request(url, { method, body, headers: { 'Idempotency-Key': mutId } });   // как и повтор из очереди: fetcher ресурса — только для чтения
            _syncing.value = false;
            return result;
        } catch (err) {
            _syncing.value = false;
            if (_isNetworkError(err)) { await _enqueueOffline(m, store); return undefined; }
            error.value = err;
            throw err;
        }
    };
    // Совместимость: mutate('POST', url, body, optimistic) — сетевая отправка
    const mutate = (a, b, c, d) => typeof a === 'string' ? send(a, b, c, { optimistic: d }) : mutateLocal(a);

    if (immediate) {
        if (typeof source === 'function') effect(() => { const u = source(); untrack(() => { load(u); }); }, 'offline:auto');
        else load(source);
    }

    const dispose = () => {
        abort();
        if (cacheKey) { const set = _offlineRefreshers.get(cacheKey); if (set) { set.delete(refresh); if (!set.size) _offlineRefreshers.delete(cacheKey); } }
    };
    if (_currentScope) _currentScope.onDispose(dispose);

    return _resultShape({
        data, inflight, started, error, key, refresh, mutate, abort, promise: () => last, dispose,
        extra: { online: _online, syncing: _syncing, send , failed: _offlineFailed },
    });
}


// ============================================================================
// 34. SERVER HTML — swap, morph, boost, tpl, adopt, jsonScript
//     Единственное место, где серверный HTML попадает в DOM (доверенный, как первая страница)
// ============================================================================

/** JSON из <script type="application/json"> (Django json_script, Rails content_tag) — кэш по элементу */
const _jsonScriptCache = new WeakMap();
export function jsonScript(target, root = document) {
    const el = typeof target === 'string' ? root.querySelector(target) : target;
    if (!el) return undefined;
    if (_jsonScriptCache.has(el)) return _jsonScriptCache.get(el);
    let v;
    try { v = _safeParse(el.textContent); }
    catch (e) {
        _warn('E007', !globalThis.AEGIS_PROD && { what: `jsonScript(${typeof target === 'string' ? target : '<script>'}): invalid JSON.`, why: String(e && e.message), fix: 'Serialize with JSON and escape "</script" as "<\\/script".' });
        v = undefined;
    }
    _jsonScriptCache.set(el, v);
    return v;
}

const _selectorFor = (el) => el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase();

/** Снимок фокуса: id/name активного поля, позиция курсора — восстановить после swap/morph */
function _focusSnapshot() {
    const a = document.activeElement;
    if (!a || a === document.body || !(a.id || a.name)) return null;
    const snap = { id: a.id, name: a.name, tag: a.tagName, value: 'value' in a ? a.value : undefined };
    try { snap.start = a.selectionStart; snap.end = a.selectionEnd; } catch (e) { /* не текстовое поле */ }
    return snap;
}
function _focusRestore(snap, root) {
    if (!snap) return;
    const sel = snap.id ? '#' + CSS.escape(snap.id) : `${snap.tag.toLowerCase()}[name="${CSS.escape(snap.name)}"]`;
    const el = (root && root.querySelector && root.querySelector(sel)) || document.querySelector(sel);
    if (!el || el === document.activeElement) return;
    el.focus({ preventScroll: true });
    if (snap.start != null && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(snap.start, snap.end); } catch (e) { /* type=email и т.п. */ } }
}

/**
 * Morph: точечно привести `from` к `to` (id-aware): атрибуты, текст, дети по id/позиции.
 * Фокус, value активного поля, видео, CSS-переходы сохраняются — узлы не пересоздаются без нужды.
 */
function _morph(from, to) {
    if (from.nodeType !== to.nodeType || (from.nodeType === 1 && from.tagName !== to.tagName)) {
        destroyAll(from);
        from.replaceWith(to);
        return to;
    }
    if (from.nodeType === 3 || from.nodeType === 8) { if (from.data !== to.data) from.data = to.data; return from; }
    if (from.nodeType !== 1) return from;
    // Живой остров: DOM принадлежит компоненту — сервер прислал только его исходную разметку.
    // Синхронизируем data-* (props); если они изменились — перемонтировать с новыми props.
    if (from.hasAttribute('data-aegis-live') && to.getAttribute('data-aegis') === from.getAttribute('data-aegis')) {
        let changed = false;
        for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) { from.setAttribute(name, value); if (name.startsWith('data-')) changed = true; }
        for (const { name } of [...from.attributes]) {
            if (to.hasAttribute(name) || name === 'data-aegis-live' || name === 'data-aegis-state' || name === 'data-aegis-ready') continue;
            from.removeAttribute(name);
            if (name.startsWith('data-')) changed = true;
        }
        if (changed) { destroy(from); from.replaceChildren(...to.childNodes); hydrate(from, { quiet: true }); }
        return from;
    }
    // атрибуты
    for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
    for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
    // живые свойства полей: не затирать то, что пользователь печатает
    if (from === document.activeElement && ('value' in from)) { /* value сохраняем */ }
    else if ('value' in from && 'value' in to && from.tagName !== 'SELECT' && from.value !== to.value && from.type !== 'file') from.value = to.value;
    if ('checked' in from && 'checked' in to && (from.type === 'checkbox' || from.type === 'radio')) {
        const ae = document.activeElement;
        // активный элемент решает: сам чекбокс в фокусе, или radio его группы (запись в соседа сняла бы выбор пользователя)
        const userOwned = ae === from || (from.type === 'radio' && ae && ae.type === 'radio' && ae.name === from.name && ae.name && ae.form === from.form);
        if (!userOwned && from.checked !== to.checked) from.checked = to.checked;
    }
    if (from.tagName === 'SELECT' && from !== document.activeElement && to.value !== undefined && from.value !== to.value) from.value = to.value;
    if (to.shadowRoot) {   // Declarative Shadow DOM из swap/boost: морфим и теневое дерево (закрытый корень недоступен — только дети)
        const sr = from.shadowRoot || (from.attachShadow ? (() => { try { return from.attachShadow({ mode: to.shadowRoot.mode || 'open' }); } catch (e) { return null; } })() : null);
        if (sr) _morphChildren(sr, to.shadowRoot);
    }
    _morphChildren(from, to);
    return from;
}

/** Отпечаток ребёнка для якорей Heckel: тег | id/key/name/href | первые 40 символов текста. Ошибка отпечатка стоит лишний morph, не корректность */
function _fp(n) {
    if (n.nodeType === 3) return '#' + n.data.trim().slice(0, 40);
    if (n.nodeType !== 1) return '';
    const f = n.firstChild;
    return n.localName + '|' + (n.id || n.getAttribute('data-key') || n.getAttribute('name') || n.getAttribute('href') || '') + '|' +
        (f && f.nodeType === 3 ? f.data.trim().slice(0, 40) : n.firstElementChild ? n.firstElementChild.localName : '');
}
const _idSet = (el) => { const st = new Set(); if (el.nodeType !== 1) return st; if (el.id) st.add(el.id); for (const c of el.querySelectorAll('[id]')) st.add(c.id); return st; };
/**
 * Сопоставление детей (Heckel 1978 + LIS): 1) id / data-aegis-permanent — авторские ключи всегда сильнее; 2) отпечатки,
 * уникальные с обеих сторон — якоря; 3) якоря расширяются на соседей того же типа/тега вперёд и назад; 4) остаток —
 * ближайший несопоставленный старый узел того же тега (soft-match idiomorph: предпочесть кандидата с пересечением id-множеств);
 * 5) порядок — LIS по старым позициям, двигаются только узлы вне LIS (moveBefore), несопоставленные новые вставляются,
 * старые удаляются с dispose островов. Вставка одного <li> в начало 1000 больше не морфит все 1000.
 */
function _morphChildren(from, to) {
    const A = [], B = [];
    for (let c = from.firstChild; c; c = c.nextSibling) A.push(c);
    for (let c = to.firstChild; c; c = c.nextSibling) B.push(c);
    const na = A.length, nb = B.length;
    if (!na) { for (const n of B) from.appendChild(n); return; }
    if (!nb) { for (const n of A) { if (n.nodeType === 1) destroyAll(n); n.remove(); } return; }
    // план replace: большой уровень без пересечения id и без живых островов — дешевле заменить поддерево, чем морфить каждый узел
    if (na >= 30 && nb >= 30) {
        const ia = new Set(), ib = new Set(); let hit = 0;
        for (const n of A) if (n.nodeType === 1 && n.id) ia.add(n.id);
        for (const n of B) if (n.nodeType === 1 && n.id) ib.add(n.id);
        for (const id of ib) if (ia.has(id)) hit++;
        if (ia.size && ib.size && hit / Math.max(ia.size, ib.size) < 0.3 && !from.querySelector('[data-aegis-live]') && !(from.contains(document.activeElement) && document.activeElement !== from)) {
            for (const n of A) { if (n.nodeType === 1) destroyAll(n); n.remove(); }
            for (const n of B) from.appendChild(n);
            return;
        }
    }
    const mA = new Int32Array(na).fill(-1), mB = new Int32Array(nb).fill(-1);
    const same = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.localName === b.localName);
    // 1. авторские ключи: id и data-aegis-permanent
    const byId = new Map();
    for (let i = 0; i < na; i++) { const n = A[i]; if (n.nodeType === 1 && n.id) byId.set(n.id, i); }
    for (let j = 0; j < nb; j++) { const n = B[j]; if (n.nodeType === 1 && n.id && byId.has(n.id)) { const i = byId.get(n.id); if (mA[i] < 0 && same(A[i], n)) { mA[i] = j; mB[j] = i; } } }
    // 2. якоря по уникальным отпечаткам
    const cnt = new Map();
    for (let i = 0; i < na; i++) if (mA[i] < 0) { const f = _fp(A[i]); let r = cnt.get(f); if (!r) cnt.set(f, r = { a: 0, b: 0, ai: -1, bi: -1 }); r.a++; r.ai = i; }
    for (let j = 0; j < nb; j++) if (mB[j] < 0) { const f = _fp(B[j]); let r = cnt.get(f); if (!r) cnt.set(f, r = { a: 0, b: 0, ai: -1, bi: -1 }); r.b++; r.bi = j; }
    for (const r of cnt.values()) if (r.a === 1 && r.b === 1 && mA[r.ai] < 0 && mB[r.bi] < 0) { mA[r.ai] = r.bi; mB[r.bi] = r.ai; }
    // 3. расширение якорей на соседей (вперёд, потом назад)
    for (const dir of [1, -1]) for (let j = dir > 0 ? 0 : nb - 1; j >= 0 && j < nb; j += dir) {
        const i = mB[j]; if (i < 0) continue;
        const jj = j + dir, ii = i + dir;
        if (jj >= 0 && jj < nb && ii >= 0 && ii < na && mB[jj] < 0 && mA[ii] < 0 && same(A[ii], B[jj])) { mB[jj] = ii; mA[ii] = jj; }
    }
    // 4. остаток: ближайший несопоставленный старый узел того же тега; при нескольких кандидатах — с общим id внутри (soft-match)
    let c = 0;
    for (let j = 0; j < nb; j++) {
        if (mB[j] >= 0) continue;
        const nj = B[j];
        while (c < na && mA[c] >= 0) c++;
        let pick = -1;
        for (let i = c; i < na; i++) { if (mA[i] >= 0 || !same(A[i], nj)) continue; pick = i; break; }
        if (pick >= 0 && nj.nodeType === 1 && nj.firstElementChild) {   // soft-match: среди ближайших 8 кандидатов предпочесть общий id
            const ids = _idSet(nj); if (ids.size) { let seen = 0; for (let i = pick; i < na && seen < 8; i++) { if (mA[i] >= 0 || !same(A[i], nj)) continue; seen++; let inter = false; for (const id of _idSet(A[i])) if (ids.has(id)) { inter = true; break; } if (inter) { pick = i; break; } } }
        }
        if (pick >= 0) { mB[j] = pick; mA[pick] = j; }
    }
    // 5. порядок: LIS по старым позициям сопоставленных; двигаются только узлы вне LIS
    const pos = _i32(nb); for (let j = 0; j < nb; j++) pos[j] = mB[j];
    const keep = _lisBits(pos, nb);
    let next = null;
    for (let j = nb - 1; j >= 0; j--) {
        const i = mB[j];
        if (i < 0) { from.insertBefore(B[j], next); next = B[j]; continue; }
        const node = A[i];
        if (!keep[j]) _move(from, node, next);
        _morph(node, B[j]);
        next = node;
    }
    for (let i = 0; i < na; i++) if (mA[i] < 0) { const n = A[i]; if (n.nodeType === 1) destroyAll(n); n.remove(); }
}

/**
 * Вставить серверный HTML аккуратно: dispose островов в заменяемом поддереве, вставка, hydrate новых,
 * снятие data-cloak, восстановление фокуса и курсора.
 *   await swap(el, response, { mode: 'morph', select: '#cart', transition: true });
 * @param {Element} target
 * @param {string|Response|Document|DocumentFragment|Element} htmlOrResponse
 * @param {Object} [opts] — mode: 'inner'|'outer'|'append'|'prepend'|'before'|'after'|'morph' (default 'inner');
 *   select — CSS-селектор в ответе (по умолчанию селектор target, если ответ — целая страница); transition — через animate()
 * @returns {Promise<{ inserted: Node[] }>}
 */
export async function swap(target, htmlOrResponse, opts = {}) {
    const { mode = 'inner', select, transition = false, hydrate: doHydrate = true } = opts;
    let html = htmlOrResponse;
    if (typeof Response !== 'undefined' && html instanceof Response) html = await html.text();
    let source;
    if (typeof html === 'string') {
        if (select || /<(?:html|body)[\s>]/i.test(html)) {
            const doc = _parseHTML(html, { whole: true, sanitize: opts.sanitize, who: 'swap' });
            if (!doc) return { inserted: [] };
            const sel = select || _selectorFor(target);
            const found = doc.querySelector(sel);
            if (!found) { _warn('E023', !globalThis.AEGIS_PROD && { what: `swap(): "${sel}" not found in the response.`, why: 'Nothing was swapped.', fix: 'Return the fragment itself, or pass { select } matching the response.' }); return { inserted: [] }; }
            source = (mode === 'outer' || mode === 'morph') ? found : Array.from(found.childNodes);
            if (doc.title && (mode === 'outer' || mode === 'morph') && !select) document.title = doc.title;
        } else {
            source = _parseHTML(html, { sanitize: opts.sanitize, who: 'swap' });
            if (!source) return { inserted: [] };
        }
    } else source = html;

    const nodes = source instanceof DocumentFragment ? [...source.childNodes]
        : Array.isArray(source) ? source
        : source && source.nodeType === 9 ? [...source.body.childNodes]
        : [source];
    const focus = _focusSnapshot();
    const apply = () => {
        let inserted = nodes;
        switch (mode) {
            case 'outer': {
                destroyAll(target);
                const f = document.createDocumentFragment();
                for (const n of nodes) f.appendChild(n);
                target.replaceWith(f);
                break;
            }
            case 'append': for (const n of nodes) target.appendChild(n); break;
            case 'prepend': { const ref = target.firstChild; for (const n of nodes) target.insertBefore(n, ref); break; }
            case 'before': for (const n of nodes) target.parentNode.insertBefore(n, target); break;
            case 'after': { const ref = target.nextSibling; for (const n of nodes) target.parentNode.insertBefore(n, ref); break; }
            case 'morph': {
                const el = nodes.length === 1 && nodes[0].nodeType === 1 ? nodes[0] : null;
                if (el) { _morph(target, el); inserted = [target]; }
                else { const wrap = target.cloneNode(false); for (const n of nodes) wrap.appendChild(n); _morph(target, wrap); inserted = [target]; }
                break;
            }
            default: {
                destroyAll(target);
                target.replaceChildren(...nodes);
            }
        }
        for (const n of inserted) if (n.nodeType === 1) { n.removeAttribute('data-cloak'); n.querySelectorAll('[data-cloak]').forEach(c => c.removeAttribute('data-cloak')); }
        if (doHydrate) for (const n of inserted) if (n.nodeType === 1) hydrate(n, { quiet: true });
        _focusRestore(focus, inserted[0] && inserted[0].nodeType === 1 ? inserted[0] : target);
        return inserted;
    };
    let inserted;
    if (transition) await animate(target, () => { inserted = apply(); }, typeof transition === 'object' ? transition : {});
    else inserted = apply();
    target.dispatchEvent?.(new CustomEvent('aegis:swap', { bubbles: true, detail: { mode, inserted } }));
    return { inserted };
}

/**
 * MPA-навигация без перезагрузки: fetch страницы → morph <main> → View Transitions.
 * Сервер рендерит всё; острова вне root (плеер, панели, SSE) переживают переход.
 *   boost({ root: 'main', mode: 'morph', transition: true, prefetch: 'hover' });
 * Не перехватывает: чужой origin, target/download, data-no-boost, ссылки, которые обслуживает router(),
 * modifier-клики. Формы: только GET и POST с FormData (data-no-boost — opt-out).
 */
export function boost(opts = {}) {
    const { root = 'main', mode = 'morph', transition = true, prefetch: pre = false, scroll = 'restore', head = 'title', routers = [] } = opts;
    const rootEl = () => typeof root === 'string' ? document.querySelector(root) : root;
    const pending = signal(false, 'boost:pending');
    const pageCache = new Map();
    const disposers = [];
    const hasNav = typeof navigation !== 'undefined' && typeof navigation.navigate === 'function';

    const fetchPage = async (url, init = {}) => {
        const key = init.method ? null : url;
        if (key && pageCache.has(key)) return pageCache.get(key);
        const p = request(url, { ...init, raw: true, headers: { Accept: 'text/html', ...(init.headers || {}) } }).then(r => r.text());
        if (key) { pageCache.set(key, p); setTimeout(() => pageCache.delete(key), 5000); }
        return p;
    };

    const visit = async (url, { init, signal, replace = false } = {}) => {
        const el = rootEl();
        if (!el) return false;
        pending.value = true;
        document.dispatchEvent(new CustomEvent('aegis:visit', { detail: { url } }));
        try {
            const html = await fetchPage(url, init);
            if (signal && signal.aborted) return false;
            const doc = _parseHTML(html, { whole: true, who: 'boost' });
            if (!doc) { location.assign(url); return false; }
            const next = doc.querySelector(typeof root === 'string' ? root : _selectorFor(el));
            if (!next) { location.assign(url); return false; }
            const run = async () => {
                if (head === 'title' || head === 'title+styles') document.title = doc.title;
                if (head === 'title+styles') {
                    for (const l of doc.querySelectorAll('link[rel="stylesheet"]')) if (!document.querySelector(`link[href="${CSS.escape(l.getAttribute('href'))}"]`)) document.head.appendChild(l.cloneNode(true));
                }
                await swap(el, next, { mode, hydrate: true });
                if (scroll !== 'preserve' && !replace) window.scrollTo(0, 0);
                _afterNav(el, { focus: opts.focus, announce: opts.announce }, { path: url }, null);
                document.dispatchEvent(new CustomEvent('aegis:load', { detail: { url } }));
            };
            if (transition && !_motionOff() && document.startViewTransition && document.visibilityState !== 'hidden') {
                const vt = document.startViewTransition(run);
                vt.ready.catch(() => {}); vt.updateCallbackDone.catch(() => {});
                await vt.finished.catch(() => {});
            } else await run();
            return true;
        } catch (e) {
            console.error('[Aegis] boost:', e);
            location.assign(url);
            return false;
        } finally {
            pending.value = false;
        }
    };

    const handled = (url) => routers.some(r => r && typeof r.matches === 'function' && r.matches(url.pathname + url.search));

    if (hasNav && navigation.addEventListener) {
        const onNavigate = (e) => {
            if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) return;
            const url = new URL(e.destination.url);
            if (url.origin !== location.origin || handled(url)) return;
            const src = e.sourceElement;
            if (src && src.closest && src.closest('[data-no-boost]')) return;
            let init;
            if (e.formData) {
                const form = src && src.closest ? src.closest('form') : null;
                const method = ((form && form.getAttribute('method')) || 'get').toUpperCase();
                if (method === 'GET') { /* обычный переход по URL с query */ }
                else init = { method, body: e.formData };
            }
            e.intercept({ scroll: 'manual', handler: () => visit(url.pathname + url.search, { init, signal: e.signal }) });
        };
        navigation.addEventListener('navigate', onNavigate);
        disposers.push(() => navigation.removeEventListener('navigate', onNavigate));
    } else {
        const onClick = (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            const a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target || a.hasAttribute('download') || a.closest('[data-no-boost]')) return;
            const url = new URL(a.getAttribute('href'), location.href);
            if (url.origin !== location.origin || url.hash && url.pathname === location.pathname || handled(url)) return;
            e.preventDefault();
            history.pushState(null, '', url.href);
            visit(url.pathname + url.search);
        };
        const onPop = () => visit(location.pathname + location.search, { replace: true });
        document.addEventListener('click', onClick);
        window.addEventListener('popstate', onPop);
        disposers.push(() => { document.removeEventListener('click', onClick); window.removeEventListener('popstate', onPop); });
    }
    /** b.prefetch(url, p?) — прогреть HTML страницы в рамках бюджета сети */
    const prefetchPage = (url, p) => {
        let u; try { u = new URL(url, location.href); } catch (e) { return Promise.resolve(); }
        if (u.origin !== location.origin || handled(u)) return Promise.resolve();
        if (p != null && _utility(null, p) <= ((_config.prefetch && _config.prefetch.minUtility) ?? 0)) { _spec.skipped++; return Promise.resolve(); }
        return _speculate(() => fetchPage(u.pathname + u.search).catch(() => {}));
    };
    if (pre) {
        const po = typeof pre === 'object' ? pre : { on: pre === true ? 'hover' : pre };
        const warm = (a) => { const h = a.getAttribute('href'); if (!h || a.closest('[data-no-boost]')) return; prefetchPage(h); };
        disposers.push(_intent(document.body, 'a[href]', warm, { on: po.on || 'hover', delay: po.delay ?? ((_config.prefetch && _config.prefetch.hoverDelay) ?? 80), vmax: po.velocity ?? 300, rootMargin: po.rootMargin ?? '200px' }));
    }
    if (opts.predict) {
        const pd = typeof opts.predict === 'object' ? opts.predict : {};
        const pred = pd.predictor || predictor();
        const topK = pd.topK ?? 1, minP = pd.minP ?? 0.3;
        let prevKey = _predKey(location.pathname);
        const onLoad = () => {
            const cur = _predKey(location.pathname);
            if (cur !== prevKey) pred.learn(prevKey, cur);
            prevKey = cur;
            _idle(() => {
                if (_predKey(location.pathname) !== cur) return;
                const el = rootEl(); if (!el) return;
                const cs = [];
                for (const a of el.querySelectorAll('a[href]')) {
                    if (a.closest('[data-no-boost]')) continue;
                    let u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
                    if (u.origin !== location.origin || handled(u)) continue;
                    const k = _predKey(u.pathname);
                    if (k !== cur && !cs.some(c => c.key === k)) cs.push({ key: k, url: u.pathname + u.search });
                }
                let n = 0;
                for (const { key, p } of pred.next(cur, cs.map(c => c.key))) { if (n >= topK || p < minP) break; const c = cs.find(x => x.key === key); if (c) { prefetchPage(c.url, p); n++; } }
            });
        };
        document.addEventListener('aegis:load', onLoad);
        disposers.push(() => document.removeEventListener('aegis:load', onLoad));
        onLoad();
    }
    const dispose = () => { for (const d of disposers) d(); disposers.length = 0; };
    if (_currentScope) _currentScope.onDispose(dispose);
    return { pending, visit, prefetch: prefetchPage, dispose };
}

/**
 * Speculation Rules для server-first страниц: один <script type="speculationrules"> с document-rules —
 * браузер сам греет (prefetch) или полностью рендерит (prerender) same-origin ссылки по эвристике eagerness.
 *   speculate();                                  // prefetch всех ссылок по 'moderate' (hover ≈ 200 мс / pointerdown)
 *   speculate({ prerender: 'conservative' });     // prerender на pointerdown
 *   speculate({ urls: ['/orders', '/reports'] }); // явный список (например, из predictor)
 *   <a href="/logout" data-no-speculate>          // исключить
 * Без поддержки API — fallback: <link rel="prefetch"> по намерению (тот же детектор, что у prefetchOn). Возвращает dispose.
 */
export function speculate({ prefetch: pf = true, prerender = false, eagerness = 'moderate', select = 'a[href]', exclude = '[data-no-speculate],[download],[target]', urls } = {}) {
    if (typeof document === 'undefined') return () => {};
    if (typeof HTMLScriptElement === 'undefined' || typeof HTMLScriptElement.supports !== 'function' || !HTMLScriptElement.supports('speculationrules')) {
        const done = new Set();
        return _intent(document.body, select, (a) => {
            let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
            if (u.origin !== location.origin || done.has(u.href) || (a.matches && a.matches(exclude))) return;
            done.add(u.href);
            const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u.href; document.head.appendChild(l);
        }, { on: 'hover' });
    }
    const where = urls ? { href_matches: urls } : { and: [{ href_matches: '/*' }, { not: { selector_matches: exclude } }] };
    const rules = {};
    if (pf) rules.prefetch = [{ source: 'document', where, eagerness }];
    if (prerender) rules.prerender = [{ source: 'document', where, eagerness: typeof prerender === 'string' ? prerender : 'conservative' }];
    const sc = document.createElement('script');
    sc.type = 'speculationrules';
    sc.textContent = JSON.stringify(rules);
    document.head.appendChild(sc);
    return () => sc.remove();
}

/**
 * Серверный <template> как источник разметки для list()/show(): одна разметка на сервере и на клиенте.
 *   <template id="card"><li class="card"><b data-slot="name"></b><span data-slot="price"></span></li></template>
 *   const card = tpl('#card');
 *   list(items, item => card({ name: () => item.name, price: { text: () => fmt(item.price), attr: { title: item.price }, cls: { sale: item.sale } } }));
 * Значение слота — реактивный текст (text()) или { text, attr, cls, style, prop, on }. HTML никогда не парсится (CSP).
 */
export function tpl(target, root = document) {
    const t = typeof target === 'string' ? root.querySelector(target) : target;
    if (!t || !t.content) throw new Error(`[Aegis] tpl(): <template> "${target}" not found`);
    return (slots = {}) => {
        const frag = t.content.cloneNode(true);
        const owner = _currentScope;
        for (const el of frag.querySelectorAll('[data-slot]')) {
            const name = el.getAttribute('data-slot');
            if (!(name in slots)) continue;
            const spec = slots[name];
            const run = () => {
                if (spec && typeof spec === 'object' && !isSignal(spec)) {
                    if ('text' in spec) text(el, spec.text);
                    if (spec.attr) for (const [k, v] of Object.entries(spec.attr)) attr(el, k, v);
                    if (spec.cls) cls(el, spec.cls);
                    if (spec.style) styleMap(el, spec.style);
                    if (spec.prop) for (const [k, v] of Object.entries(spec.prop)) _bindProp(el, k, v);
                    if (spec.on) for (const [k, v] of Object.entries(spec.on)) on(el, k, v);
                } else text(el, spec);
            };
            owner ? owner.run(run) : run();
        }
        return frag;
    };
}

/** Текст элемента без пересоздания узла: обновляем data единственного текстового ребёнка */
function _setText(el, str) {
    const t = el.firstChild;
    if (t && t.nodeType === 3 && t === el.lastChild) { if (t.data !== str) t.data = str; }
    else if (el.textContent !== str) el.textContent = str;
}

/**
 * Привязать html``-шаблон к уже отрендеренному сервером DOM без перерисовки:
 *   adopt(el)`<span class="value">${count}</span><button @click=${() => count.value++}>+</button>`
 * Структура элементов должна совпадать (пробелы не важны): текстовые значения — единственный
 * непробельный ребёнок элемента (иначе оберните в <span>). 0 DOM-мутаций: фокус, выделение и
 * CSS-анимации серверной разметки остаются. Первый проход перезаписывает серверный текст
 * ({ trust: true } — не перезаписывать, пока значение не изменится).
 */
export function adopt(rootEl, aopts = {}) {
    return (strings, ...values) => {
        let template = _templateCache.get(strings);
        if (!template) { template = _parseTemplate(strings); _templateCache.set(strings, template); }
        const resolveEl = (path, tag) => {
            let n = rootEl;
            for (const i of path) { n = n.children[i]; if (!n) break; }
            if (!n || (tag && n.localName !== tag)) {
                _warn('E024', !globalThis.AEGIS_PROD && {
                    what: `adopt(): expected <${tag}> at ${path.join('/')}, found ${n ? '<' + n.localName + '>' : 'nothing'}.`,
                    why: 'Server HTML must match the template structure (elements only, whitespace ignored).',
                    fix: 'Keep the server partial and the adopt() template in sync.',
                });
                return null;
            }
            return n;
        };
        for (const part of template.parts) {
            if (part.kind === 2) {
                // текст: маркер должен быть единственным непробельным ребёнком элемента
                if (!part.sole) {
                    _warn('E024', !globalThis.AEGIS_PROD && { what: `adopt(): text value #${part.index} is not the only child of its element.`, why: 'adopt() binds text by element, not by position.', fix: 'Wrap the value in <span>${…}</span>.' });
                    continue;
                }
                const real = resolveEl(part.elPath, part.tag);
                if (!real) continue;
                const v = values[part.index];
                if (isSignal(v) || typeof v === 'function') {
                    let first = true;
                    effect(() => {
                        const val = isSignal(v) ? v.value : v();
                        if (first && aopts.trust) { first = false; return; }
                        first = false;
                        _setText(real, val == null || val === false ? '' : String(val));
                    }, (!globalThis.AEGIS_PROD && _dev()) ? `adopt:text@${_tag(real)}` : undefined);
                } else if (!aopts.trust) {
                    _setText(real, v == null || v === false ? '' : String(v));
                }
                continue;
            }
            const real = resolveEl(part.elPath, part.tag);
            if (!real) continue;
            if (part.kind === 0) { real.removeAttribute(part.rawAttr); const wr = part.commit(real, values); if (wr) _fused([wr], _currentScope); }   // атрибуты / события / props
            else _applyRef(real, values[part.index], part.index);                                                  // refs / attach
        }
        return rootEl;
    };
}


// ============================================================================
// 35. VERSION & EXPORT
// ============================================================================

export const VERSION = '0.7.0';

// Пространство имён (default export / Aegis.expose()) строится лениво: объект со всеми экспортами
// удерживал бы весь модуль при tree-shaking подмножеств (import { signal } from 'aegis/core')
let _ns = null;
function _namespace() {
    if (_ns) return _ns;
    _ns = {
    VERSION,
    // Reactive
    signal, computed, effect, batch, untrack, isSignal, getOwner, runWithOwner, trace,
    reactive, isReactive, linked, persisted, selector, until, from, history,
    // Scope
    createScope, onDispose, root, provide, inject, createContext,
    // Dev
    dev, onWarn, AegisWarning, reset, flushSync, flush, stats,
    // DOM
    html, render, show, when, list, bind, text, attr, cls, style, styleMap, cssVars, ref, attach, clone, prevent, stop, self,
    // Events
    on, delegate,
    // Utilities
    interval, timeout, observe, resize, mutate, nextTick, size, inView, viewport,
    // Guard / HTTP
    guardedFetch, debounced, throttled, poll,
    configure, request, api, HttpError, defaults, withRetry,
    // Data
    resource, mutation, streamResource, sse, settled, watch,
    invalidate, seed, seedFrom, prefetch, prefetchOn, infiniteResource, cache, useClock,
    // Form
    form, required, minLen, maxLen, pattern, emailRule, email, min, max, matches, maxSize, mime, maxFiles, setValidationMessages,
    wireForm,
    // Component
    mount, register, island, element, hydrate, destroy, destroyAll,
    errorBoundary, portal, transition, lazy,
    // Animation
    spring, springSignal, tween, flip, animate, media, reducedMotion, theme,
    // Accessibility
    trap, modal, roving, announce, scaffold,
    // CSS
    css, adoptStyles, scopedStyle,
    // Custom Elements
    defineElement,
    // Positioning
    anchor,
    // Router
    router, transitioning,
    // Commands
    command,
    // Virtual Scroll
    virtualScroll,
    // Offline
    // Server HTML
    swap, boost, tpl, adopt, jsonScript,
    // i18n
    i18n,
    // Helpers
    $, $$, uncloak, injectStyles,
        expose,
    };
    return _ns;
}

/**
 * Сбросить модульные синглтоны между тестами: компоненты, реестр островов, кэш ресурсов,
 * live-region, кэш CSS, состояние планировщика. beforeEach(() => reset()).
 */
export function reset({ components = true, cache: clearCache = true, registry = true, dom = true } = {}) {
    if (components) destroyAll();
    if (clearCache) { _cb.clear(); _rb.t.length = 0; _rb.r.length = 0; _pf.fired = 0; _pf.used = 0; _pf.wasted = 0; _pf.kinds.clear(); _regs.clear(); _runQueue.length = 0; _running = 0; _polls.length = 0; if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; } _cHead = _cTail = _cHand = null; _cacheBytes = 0; _cacheEvictions = 0; _deferred.clear(); _pendingReasons.clear();
        for (const e of _resourceCache.values()) { if (e.controller) e.controller.abort(); if (e.gcTimer) clearTimeout(e.gcTimer); }
        _resourceCache.clear();
        for (const { db } of _idbRegistry.values()) { try { db && db.close(); } catch (e) { /* */ } }
        _idbRegistry.clear();
        _offlineStores.clear();
        _offlineRefreshers.clear();
    }
    if (registry) _registry.clear();
    if (dom) {
        _liveReset();
        _cssCache.clear();
        _mediaSignals.clear();
    }
    _globalCtx.clear();
    _seenWarnings.clear();
    for (const o of _qa) o._f &= ~F_QUEUED;
    _qa.length = 0; _qb.length = 0; _qSorted = true; _qLastOrd = 0; _qEdges = false; _writer = null;
    if (_obsReg) _obsReg.clear();
    _heap.length = 0; _heapArmed = false; _slicing = false; _transCount = 0; _cause = null; _settleRes.length = 0;
    _batchDepth = 0; _notifyDepth = 0; _flushing = false; _currentScope = null; _tracking = null;
    if (typeof _offlineFailed !== 'undefined') _offlineFailed.value = [];
    if (typeof _liveReset === 'function') _liveReset();
    if (typeof _lastRouteMsg !== 'undefined') _lastRouteMsg = null;
}

/**
 * Сделать Aegis глобальным (window.Aegis) для inline-скриптов без import.
 * Не делается автоматически: модуль-левел глобал ломает tree-shaking у бандлеров.
 *   import { expose } from './aegis.js'; expose();
 */
export function expose(target = globalThis) {
    target.Aegis = _namespace();
    return _ns;
}

export default /* @__PURE__ */ _namespace();
