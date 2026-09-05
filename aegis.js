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
const dev = {
    get on() { return _dev(); },
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
    /** Объяснение кода предупреждения (ERRORS.md) в консоль: Aegis.dev.explain('E019') */
    explain(code) { return import(/* @vite-ignore */ new URL('./aegis-devtools.js', import.meta.url).href).then(m => m.explain(code)); },
    /** dev-overlay: предупреждения всплывают в углу страницы (false — только консоль; localStorage aegis:overlay=0) */
    overlay: true,
    /** Объяснение кода предупреждения (ERRORS.md) в консоль: Aegis.dev.explain('E019') */
    explain(code) { return import(/* @vite-ignore */ new URL('./aegis-devtools.js', import.meta.url).href).then(m => m.explain(code)); },
    /** Снимок кэша ресурсов: Aegis.dev.cache() → console.table */
    cache() { return typeof cache !== 'undefined' ? cache.stats().entries : []; },
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
    if (!_dev()) return null;
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

function _warn(code, { what, why, fix, el, site, token }, onceKey) {
    if (!_dev()) return;
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
let _queue = [];             // отложенные observers (effects, subscribers), см. _queued
let _epoch = 0;              // глобальный счётчик версий
const _MAX_ROUNDS = 100;     // раундов flush до признания цикла бесконечным

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

/** Подписать текущий observer на источник; k-е чтение того же источника — без мутаций графа */
function _track(src) {
    const obs = _tracking;
    if (!obs) return;
    const deps = obs._deps || (obs._deps = []);
    const vers = obs._vers || (obs._vers = []);
    const i = obs._n;
    if (i < deps.length && deps[i] === src) {        // стабильная позиция — только версия
        vers[i] = src.version();
        obs._n = i + 1;
        return;
    }
    if (i > 0 && deps[i - 1] === src) return;         // повторное чтение подряд — no-op
    if (i < deps.length) (obs._evict || (obs._evict = [])).push(deps[i]); // вытеснили другой источник
    deps[i] = src;
    vers[i] = src.version();
    (src.subs || (src.subs = new Set())).add(obs);
    obs._n = i + 1;
}

/** Завершить запуск: обрезать непрочитанный хвост и отписать источники, которых больше нет */
function _endTrack(obs) {
    const deps = obs._deps;
    if (!deps) return;
    const n = obs._n;
    for (let i = n; i < deps.length; i++) _unsubIfGone(obs, deps[i], deps, n);
    deps.length = n;
    obs._vers.length = n;
    const ev = obs._evict;
    if (ev) {
        obs._evict = null;
        for (const s of ev) _unsubIfGone(obs, s, deps, n);
    }
}

function _unsubIfGone(obs, src, deps, n) {
    for (let i = 0; i < n; i++) if (deps[i] === src) return;
    if (src.subs) src.subs.delete(obs);
}

/** Отписать observer от всех источников */
function _unsubscribe(obs) {
    const deps = obs._deps;
    if (deps) {
        for (let i = 0; i < deps.length; i++) if (deps[i].subs) deps[i].subs.delete(obs);
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
        if (deps[i].version() !== vers[i]) out.push({ name: deps[i]._name || 'signal', value: _short(deps[i].peek()) });
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
        if (deps[i].version() !== vers[i]) return true;
    }
    return false;
}

// ---- Signal ------------------------------------------------------------------

class Signal {
    constructor(value, name, eq) {
        this._value = value;
        this._version = ++_epoch;
        this._name = name;
        this._eq = eq;
        this.subs = null;
    }
    get value() {
        _track(this);
        return this._value;
    }
    set value(v) {
        if (_tracking && _tracking._isComputed) {
            _warn('E002', {
                what: `Signal "${this._name || '?'}" written inside computed "${_tracking._name || '?'}".`,
                why: 'Computeds must be pure — writing signals causes infinite loops or glitches.',
                fix: 'Move the write into an effect() or a method/action.',
            });
        }
        if (this._eq(this._value, v)) return;
        if (this._traceSet) { console.groupCollapsed(`▸ [Aegis] signal "${this._name || '?'}" set ${_short(this._value)} → ${_short(v)}`); console.trace(); console.groupEnd(); }
        this._value = v;
        this._version = ++_epoch;
        if (this.subs) _notify(this.subs);
    }
    /** Текущая версия (для bailout зависимых) */
    version() { return this._version; }
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
export function signal(initial, nameOrOpts) {
    return new Signal(initial, _nm(nameOrOpts), _eqOf(nameOrOpts));
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

class Computed {
    constructor(fn, name, eq, initial) {
        this._fn = fn;
        this._value = initial;
        this._version = 0;
        this._name = name;
        this._eq = eq;
        this._dirty = true;
        this._computing = false;    // circular dependency guard
        this._disposed = false;
        this.subs = null;
        this._deps = null;
        this._vers = null;
        this._n = 0;
        this._evict = null;
        this._unreg = null;
    }
    get value() {
        if (this._dirty) this._recompute();
        _track(this);
        return this._value;
    }
    /** Прочитать без подписки (зависимости самого computed переподписываются как обычно) */
    peek() {
        if (this._dirty) this._recompute();
        return this._value;
    }
    version() {
        if (this._dirty) this._recompute();
        return this._version;
    }
    subscribe(fn) { return _subscribe(this, fn); }
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        _unsubscribe(this);
        if (this.subs) this.subs.clear();
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
    /** push-фаза: пометить dirty и передать дальше */
    _run() {
        if (this._dirty || this._disposed) return;
        this._dirty = true;
        if (this.subs) _notify(this.subs);
    }
    _recompute() {
        if (this._computing) {
            throw new Error(`[Aegis] Circular dependency in computed "${this._name || '?'}"`);
        }
        this._computing = true;
        const prev = _tracking;
        try {
            // Bailout: помечен dirty, но ни одна зависимость не изменила версию
            // (например, upstream computed пересчитался в то же значение)
            if (this._deps && this._deps.length > 0 && !_depsChanged(this)) {
                this._dirty = false;
                return;
            }
            this._n = 0;
            _tracking = this;
            let v;
            try {
                v = this._fn(this._value);   // computed((prev) => …, { initial }) — предыдущее значение
            } catch (e) {
                _tracking = prev;
                _unsubscribe(this);      // неполный набор deps — при следующем чтении полный пересчёт
                throw e;
            }
            _tracking = prev;
            _endTrack(this);
            if (this._version === 0 || !this._eq(this._value, v)) {
                this._value = v;
                this._version = ++_epoch;
            }
            this._dirty = false;
        } finally {
            _tracking = prev;
            this._computing = false;
        }
    }
    toJSON() { return this.peek(); }
    toString() { return `Computed(${this._name || '?'}: ${this._dirty ? '<stale>' : this._value})`; }
}
Computed.prototype[SIGNAL] = true;
Computed.prototype._isComputed = true;

/**
 * Вычисляемое значение (ленивое, кэшированное)
 * Пересчитывается только когда зависимости реально изменились (по версиям);
 * версия самого computed растёт только при изменении результата.
 */
export function computed(fn, nameOrOpts) {
    const c = new Computed(fn, _nm(nameOrOpts), _eqOf(nameOrOpts), _initialOf(nameOrOpts));
    if (_currentScope) c._unreg = _currentScope.onDispose(() => c.dispose());
    return c;
}

// ---- Effect ------------------------------------------------------------------

class Effect {
    constructor(fn, name, owner, trace, lane) {
        this._fn = fn;
        this._name = name || 'effect';
        this._owner = owner;        // scope, под которым выполняется КАЖДЫЙ запуск
        this._trace = !!trace;
        this._lane = lane || null;  // 'micro' | 'frame' — отложенная полоса; null — синхронно
        this._el = null;            // DOM-узел привязки (dev-детектор зомби-эффектов)
        this._seen = false; this._detached = 0; this._warnedZombie = false;
        this._cleanup = null;
        this._disposed = false;
        this._queued = false;
        this._deps = null;
        this._vers = null;
        this._n = 0;
        this._evict = null;
        this._unreg = null;
    }
    _run() {
        if (this._disposed) return;
        // pull-фаза: запускаться только если зависимости реально изменились
        if (this._deps && this._deps.length > 0 && !_depsChanged(this)) return;
        if (this._trace && this._deps) {
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
        this._runCleanup();
        if (!this._counted) { this._counted = true; _liveEffects++; }
        const prevT = _tracking, prevS = _currentScope;
        _tracking = this;
        _currentScope = this._owner;  // всё созданное внутри — дети владельца, а не случайного scope
        this._n = 0;
        _batchDepth++;                 // записи внутри effect откладываются до его завершения
        try {
            const r = this._fn();
            if (this._el && _dev()) _zombieCheck(this, this._name);
            if (typeof r === 'function') this._cleanup = r;
            else if (r && typeof r.then === 'function' && !this._warnedAsync) {
                this._warnedAsync = true;
                _warn('E016', {
                    site: this._site,
                    what: `effect "${this._name}" returned a Promise.`,
                    why: 'Signals read after the first await are not tracked, and the cleanup return value is lost.',
                    fix: 'Move async work into resource()/mutation()/watch(); keep effect bodies synchronous.',
                });
            }
        } finally {
            _tracking = prevT;
            _currentScope = prevS;
            _endTrack(this);           // и после ошибки: прочитанные deps остаются, эффект переживёт throw
            _batchDepth--;
            if (_batchDepth === 0) _flush();
        }
    }
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        if (this._counted) _liveEffects--;
        _unsubscribe(this);
        this._runCleanup();
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
}
Effect.prototype._isComputed = false;

export function effect(fn, nameOrOpts) {
    const owner = _currentScope;
    let name = typeof nameOrOpts === 'string' ? nameOrOpts : (nameOrOpts && nameOrOpts.name) || null;
    const trace = !!(nameOrOpts && typeof nameOrOpts === 'object' && nameOrOpts.trace);
    const lane = nameOrOpts && typeof nameOrOpts === 'object' && (nameOrOpts.flush === 'micro' || nameOrOpts.flush === 'frame') ? nameOrOpts.flush : null;
    const explicitName = !!name;                   // именованные (движок, пользователь с name) — без детектора E019
    if (!name && _dev()) name = fn.name || null;   // авто-имя в dev: function search() {…} → "search"
    const site = _dev() ? ((name && /[:@]/.test(name)) ? _curSite : _callSite()) : null;
    if (!owner) {
        _warn('E001', {
            site,
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in component(el, ({ effect }) => { ... }) or scope.run(() => effect(...))`,
        });
    }
    const node = new Effect(fn, name, owner, trace, lane);
    node._site = site;
    const dispose = () => node.dispose();
    dispose._node = node;
    // Регистрируем до первого запуска: в уже уничтоженном scope effect не стартует
    node._unreg = owner ? owner.onDispose(dispose) : null;
    if (!node._disposed) {
        node._execute();
        // Детектор потерянной реактивности: эффект, не прочитавший ни одного сигнала, больше не запустится
        if (_dev() && !explicitName && !node._disposed && (!node._deps || node._deps.length === 0)) {
            _warn('E019', {
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
        this._src = src;
        this._fn = fn;
        this._owner = owner;
        this._last = src.version();
        this._name = 'subscriber';
        this._disposed = false;
        this._queued = false;
        this._unreg = null;
    }
    _run() {
        if (this._disposed) return;
        const v = this._src.version();
        if (v === this._last) return;
        this._last = v;
        const prevS = _currentScope;
        _currentScope = this._owner;
        try { this._fn(this._src.peek()); }
        finally { _currentScope = prevS; }
    }
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        if (this._src.subs) this._src.subs.delete(this);
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
}
Subscriber.prototype._isComputed = false;

/** Ручная подписка: fn(value) при каждом реальном изменении, отложенно (после batch) */
function _subscribe(src, fn) {
    const owner = _currentScope;
    const node = new Subscriber(src, fn, owner);
    (src.subs || (src.subs = new Set())).add(node);
    const dispose = () => node.dispose();
    node._unreg = owner ? owner.onDispose(dispose) : null;
    return dispose;
}

// ---- batch / untrack / owner -------------------------------------------------

/**
 * Группировка обновлений — все изменения внутри batch
 * вызовут effects только один раз после завершения. Возвращает результат fn.
 */
export function batch(fn) {
    _batchDepth++;
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

function _notify(subs) {
    _notifyDepth++;
    try {
        for (const obs of subs) {                      // без копии: в push-фазе subs не пополняется
            if (obs._disposed) { subs.delete(obs); continue; }
            if (obs._isComputed) obs._run();           // push: dirty по цепочке
            else if (obs._lane) _enqueueLane(obs);       // отложенная полоса: microtask / кадр
            else if (!obs._queued) { obs._queued = true; _queue.push(obs); } // effects никогда не запускаются inline
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
        if (obs._lane === 'micro') queueMicrotask(() => _runLane('micro'));
        else (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16))(() => _runLane('frame'));
    }
}
function _runLane(lane) {
    _laneScheduled[lane] = false;
    const list = _lanes[lane];
    if (!list.length) return;
    _lanes[lane] = [];
    for (const obs of list) { obs._queued = false; if (obs._disposed) continue; try { obs._run(); } catch (e) { if (!_dispatchError(obs._owner, e)) console.error(`[Aegis] error in "${obs._name}":`, e); } }
}
/** Синхронно выполнить все отложенные полосы (micro/frame) и очередь эффектов */
export function flush() {
    _runLane('micro');
    _runLane('frame');
    _flush();
}

// ---- профилирование (Aegis.dev.profile(true)) и stats()
let _profiling = false;
let _profileMark = null;   // разметка Performance-панели — ставится dev.profile() (секция 3), ядро её не тянет
const _stats = { flushes: 0, effectRuns: 0, maxRounds: 0, slow: [] };
let _liveEffects = 0, _liveScopes = 0;

function _flush() {
    if (_flushing || _batchDepth > 0 || _queue.length === 0) return;
    _flushing = true;
    let rounds = 0;
    let error = null;
    const t0 = _profiling ? performance.now() : 0;
    let total = 0;
    const names = _profiling ? [] : null;
    try {
        // Записи из effects попадают в очередь и обрабатываются следующим раундом
        while (_queue.length > 0) {
            if (++rounds > _MAX_ROUNDS) {
                const names = _queue.map(o => o._name).join(', ');
                for (const o of _queue) o._queued = false;
                _queue = [];
                throw new Error(`[Aegis] Infinite reactive loop — effect writes a signal it depends on (${names})`);
            }
            const round = _queue;
            _queue = [];
            total += round.length;
            for (let i = 0; i < round.length; i++) {
                const obs = round[i];
                obs._queued = false;
                if (obs._disposed) continue;
                if (names && names.length < 30) names.push(obs._name);
                try {
                    if (_profiling) {
                        const ts = performance.now();
                        obs._run();
                        const ms = performance.now() - ts;
                        if (ms > 1) { _stats.slow.push({ name: obs._name, ms: +ms.toFixed(2) }); if (_stats.slow.length > 20) _stats.slow.shift(); }
                    } else obs._run();
                } catch (e) {
                    if (e && typeof e === 'object' && !e.aegis) {
                        e.aegis = { effect: obs._name, scope: _scopePath(obs._owner), changed: _changedDeps(obs) };
                        if (obs._site) e.aegis.site = obs._site.short;
                        try { e.message += `\n    in effect "${obs._name}"${e.aegis.scope ? ' · ' + e.aegis.scope : ''}${obs._site ? ' · at ' + obs._site.short : ''}${e.aegis.changed.length ? '\n    changed: ' + e.aegis.changed.map(d => d.name + ' → ' + d.value).join(', ') : ''}`; } catch (m) { /* readonly message */ }
                    }
                    if (_dispatchError(obs._owner, e)) continue;   // поглощена scope.onError / errorBoundary
                    // не бросать остальные effects раунда; первую ошибку пробросить после
                    if (error) console.error(`[Aegis] error in "${obs._name}":`, e);
                    else error = e;
                }
            }
        }
    } finally {
        _flushing = false;
        _stats.flushes++;
        _stats.effectRuns += total;
        if (rounds > _stats.maxRounds) _stats.maxRounds = rounds;
        if (_profiling && total && _profileMark) _profileMark(t0, total, rounds, names);
        if (rounds > 3 && total) _warn('E027', {
            what: `Flush took ${rounds} rounds — effects keep writing signals other effects depend on.`,
            why: 'Each round is an effect reacting to a write from the previous round (ping-pong).',
            fix: 'Replace the effect with a computed(), or write all values in one batch().',
        }, 'rounds');
    }
    if (error) throw error;
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
                _warn('E005', {
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
            _warn('E005', {
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
        const kids = this.children;
        this.children = null;
        if (kids) for (const child of kids) child.dispose();
        // Потом свои disposers (удаление из Set во время итерации безопасно)
        for (const d of this._disposers) {
            try { d(); } catch (e) { console.error('[Aegis] dispose error:', e); }
        }
        this._disposers.clear();
        // Убрать себя из родителя — O(1)
        const p = this.parent;
        if (p && !p._disposed && p.children) p.children.delete(this);
        this.parent = null;
    }
}
if (typeof Symbol.dispose === 'symbol') Scope.prototype[Symbol.dispose] = function () { this.dispose(); };   // using scope = createScope()
const _noop = () => {};

/** Создать scope (привязывается к родительскому автоматически). name — для диагностики */
export function createScope(name) {
    return new Scope(_currentScope, name);
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
    _warn('E017', {
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
        _warn('E022', {
            what: `inject(${String(key && key.id ? key.id.description : key)}) — nothing provided.`,
            why: 'No provide() for this key in the scope chain, DOM ancestors or globally.',
            fix: 'Call provide(key, value) in a parent setup, or pass a fallback: inject(key, fallback). Lazy parent island? Use data-aegis-load="eager".',
        });
    }
    return arguments.length >= 2 ? fallback : (key && key.default);
}

/** Зарегистрировать disposer в текущем scope и вернуть функцию, которая делает cleanup и снимает регистрацию */
function _scoped(cleanup) {
    let unreg = _currentScope ? _currentScope.onDispose(cleanup) : null;
    return () => {
        cleanup();
        if (unreg) { unreg(); unreg = null; }
    };
}


