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
 * Dev-режим читается лениво при каждом предупреждении, а не один раз при
 * загрузке модуля: import'ы поднимаются наверх, поэтому
 * `window.__AEGIS_DEV__ = true` в том же модуле иначе не успевал бы сработать.
 */
function _dev() {
    return typeof globalThis !== 'undefined' && !!globalThis.__AEGIS_DEV__;
}

/** Elm-style three-part warning: what → why → fix */
function _warn(code, { what, why, fix }) {
    if (!_dev()) return;
    console.warn(
        `⚠ [Aegis:${code}] ${what}\n` +
        `  Why: ${why}\n` +
        `  Fix: ${fix}`
    );
}

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

/** Является ли объект сигналом (signal или computed) */
export function isSignal(v) {
    return v != null && v[SIGNAL] === true;
}

// ---- Computed ----------------------------------------------------------------

class Computed {
    constructor(fn, name, eq) {
        this._fn = fn;
        this._value = undefined;
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
                v = this._fn();
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
    const c = new Computed(fn, _nm(nameOrOpts), _eqOf(nameOrOpts));
    if (_currentScope) c._unreg = _currentScope.onDispose(() => c.dispose());
    return c;
}

// ---- Effect ------------------------------------------------------------------

class Effect {
    constructor(fn, name, owner) {
        this._fn = fn;
        this._name = name || 'effect';
        this._owner = owner;        // scope, под которым выполняется КАЖДЫЙ запуск
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
        const prevT = _tracking, prevS = _currentScope;
        _tracking = this;
        _currentScope = this._owner;  // всё созданное внутри — дети владельца, а не случайного scope
        this._n = 0;
        _batchDepth++;                 // записи внутри effect откладываются до его завершения
        try {
            const r = this._fn();
            if (typeof r === 'function') this._cleanup = r;
            else if (r && typeof r.then === 'function' && !this._warnedAsync) {
                this._warnedAsync = true;
                _warn('E016', {
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
        _unsubscribe(this);
        this._runCleanup();
        const u = this._unreg; this._unreg = null;
        if (u) u();
    }
}
Effect.prototype._isComputed = false;

/**
 * Побочный эффект — авто-трекинг зависимостей
 * fn может вернуть cleanup-функцию: она вызывается перед следующим запуском и при dispose.
 * Каждый запуск выполняется под scope, в котором effect был создан.
 * Возвращает dispose-функцию
 *
 * Dev warning если вызван вне scope
 */
export function effect(fn, name) {
    const owner = _currentScope;
    if (!owner) {
        _warn('E001', {
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in component(el, ({ effect }) => { ... }) or scope.run(() => effect(...))`,
        });
    }
    const node = new Effect(fn, name, owner);
    const dispose = () => node.dispose();
    // Регистрируем до первого запуска: в уже уничтоженном scope effect не стартует
    node._unreg = owner ? owner.onDispose(dispose) : null;
    if (!node._disposed) node._execute();
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
            else if (!obs._queued) { obs._queued = true; _queue.push(obs); } // effects никогда не запускаются inline
        }
    } finally {
        _notifyDepth--;
    }
    // flush только когда все вложенные _notify завершены и мы не в batch
    if (_notifyDepth === 0 && _batchDepth === 0) _flush();
}

function _flush() {
    if (_flushing || _batchDepth > 0 || _queue.length === 0) return;
    _flushing = true;
    let rounds = 0;
    let error = null;
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
            for (let i = 0; i < round.length; i++) {
                const obs = round[i];
                obs._queued = false;
                if (obs._disposed) continue;
                try {
                    obs._run();
                } catch (e) {
                    // не бросать остальные effects раунда; первую ошибку пробросить после
                    if (error) console.error(`[Aegis] error in "${obs._name}":`, e);
                    else error = e;
                }
            }
        }
    } finally {
        _flushing = false;
    }
    if (error) throw error;
}


// ============================================================================
// 2. SCOPE — Lifecycle, Auto-cleanup
// ============================================================================

let _currentScope = null;

class Scope {
    constructor(parent) {
        this.parent = null;
        this.children = null;                 // ленивый Set: бездетный scope не платит
        this._disposers = new Set();          // Set: onDispose() возвращает unregister — O(1)
        this._disposed = false;
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
    onDispose(fn) {
        if (this._disposed) { fn(); return _noop; }
        this._disposers.add(fn);
        return () => { this._disposers.delete(fn); };
    }

    /** Уничтожить scope и все вложенные */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
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
const _noop = () => {};

/** Создать scope (привязывается к родительскому автоматически) */
export function createScope() {
    return new Scope(_currentScope);
}

/** Зарегистрировать cleanup в текущем scope. Возвращает unregister */
export function onDispose(fn) {
    if (_currentScope) return _currentScope.onDispose(fn);
    console.warn('[Aegis] onDispose вызван вне scope — cleanup не будет автоматическим');
    return _noop;
}

/** Зарегистрировать disposer в текущем scope и вернуть функцию, которая делает cleanup и снимает регистрацию */
function _scoped(cleanup) {
    let unreg = _currentScope ? _currentScope.onDispose(cleanup) : null;
    return () => {
        cleanup();
        if (unreg) { unreg(); unreg = null; }
    };
}


