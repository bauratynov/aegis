/**
 * AEGIS — Frontend Engine
 * Zero-build, zero-footgun, signal-based reactive UI.
 * Categories of bugs impossible by design.
 * Safety by Architecture — bugs impossible, not just harder to make.
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
    _stale() { return (this._f & F_DIRTY) !== 0 || (!(this._f & F_LIVE) && this._chk < _epochDur[this._dur]); }
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

export function effect(fn, nameOrOpts) {
    const owner = _currentScope;
    let name = typeof nameOrOpts === 'string' ? nameOrOpts : (nameOrOpts && nameOrOpts.name) || null;
    const trace = !!(nameOrOpts && typeof nameOrOpts === 'object' && nameOrOpts.trace);
    const fl = nameOrOpts && typeof nameOrOpts === 'object' ? nameOrOpts.flush : null;
    const lane = fl === 'micro' || fl === 'frame' || fl === 'transition' || fl === 'idle' ? fl : null;   // transition/idle — классы дедлайнов (heap)
    const explicitName = !!name;                   // именованные (движок, пользователь с name) — без детектора E019
    if (!name && (!globalThis.AEGIS_PROD && _dev())) name = fn.name || null;   // авто-имя в dev: function search() {…} → "search"
    const site = (!globalThis.AEGIS_PROD && _dev()) ? ((name && /[:@]/.test(name)) ? _curSite : _callSite()) : null;
    if (!owner) {
        _warn('E001', !globalThis.AEGIS_PROD && {
            site,
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in component(el, ({ effect }) => { ... }) or scope.run(() => effect(...)).${typeof _components !== 'undefined' && _components.size ? ' After an await in setup the scope is lost — use the helpers from ctx (they stay bound) or runWithOwner(getOwner(), …).' : ''}`,
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
        if (_errHandlers.size) { for (const h of _errHandlers) { try { h(e, (e && e.aegis) || null); } catch (x) { console.error('[Aegis] onError handler failed:', x); } } continue; }
        if (typeof reportError === 'function') reportError(e);
        else setTimeout(() => { throw e; });
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
                                e.aegis = { effect: obs._name, scope: _scopePath(obs._owner), changed: _changedDeps(obs) };
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
        fix: 'Call it inside component()/mount() setup or scope.run(() => …).',
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
/** Точка подмены для всего движка: defaults.fetcher = mock — resource/cache/offline/guardedFetch идут через него */
export const defaults = { fetcher: null, motion: 'auto' };   // fetcher: null → request() из этой же секции (через _ext, чтобы defaults.motion не тянул сеть в бандл без запросов)
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

