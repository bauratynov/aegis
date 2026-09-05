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
//      Source   — signal или computed: { subs: Set<Observer>, version() }
//      Observer — effect, computed или subscriber:
//                 { _isComputed, _disposed, _deps: Map<Source, version>, _run() }
//
//    Распространение в две фазы:
//      push — запись сигнала синхронно помечает computed'ы dirty по цепочке
//             и кладёт effects в очередь;
//      pull — при flush каждый effect сравнивает версии своих зависимостей
//             (computed при этом лениво пересчитываются) и запускается только
//             если хотя бы одна реально изменилась. Это даёт glitch-free
//             семантику: effect никогда не видит промежуточных состояний и не
//             запускается, если computed пересчитался в то же значение.
// ============================================================================

let _tracking = null;        // текущий observer для auto-track
let _batchDepth = 0;         // глубина batch() (тело effect — тоже неявный batch)
let _notifyDepth = 0;        // вложенность _notify — flush только на выходе из внешнего
let _flushing = false;       // идёт flush — вложенные записи только пополняют очередь
const _queue = new Set();    // отложенные observers (effects, subscribers)
let _epoch = 0;              // глобальный счётчик версий
const _MAX_ROUNDS = 100;     // раундов flush до признания цикла бесконечным

const SIGNAL = Symbol('aegis.signal');

function _opts(nameOrOpts) {
    const o = typeof nameOrOpts === 'string' ? { name: nameOrOpts } : (nameOrOpts || {});
    const eq = o.equals;
    return {
        name: o.name || null,
        // equals:false означает «уведомлять всегда»
        equals: eq == null ? Object.is : (eq === false ? () => false : eq),
    };
}

/** Подписать текущий observer на источник и запомнить его версию */
function _track(src) {
    const obs = _tracking;
    if (!obs) return;
    src.subs.add(obs);
    obs._deps.set(src, src.version());
}

/** Отписать observer от всех источников */
function _unsubscribe(obs) {
    for (const src of obs._deps.keys()) src.subs.delete(obs);
    obs._deps.clear();
}

/** Изменилась ли хоть одна зависимость с момента последнего запуска */
function _depsChanged(obs) {
    for (const [src, ver] of obs._deps) {
        if (src.version() !== ver) return true;
    }
    return false;
}

/** Ручная подписка: fn(value) при каждом реальном изменении, отложенно (после batch) */
function _subscribe(src, read, fn) {
    let last = src.version();
    const node = {
        _isComputed: false,
        _disposed: false,
        _name: 'subscriber',
        _run() {
            if (node._disposed) return;
            const v = src.version();
            if (v === last) return;
            last = v;
            fn(read());
        },
    };
    src.subs.add(node);
    const unsubscribe = () => {
        node._disposed = true;
        src.subs.delete(node);
        _queue.delete(node);
    };
    if (_currentScope) _currentScope.onDispose(unsubscribe);
    return unsubscribe;
}

/**
 * Создать реактивный сигнал
 * @template T
 * @param {T} initial
 * @param {string|Object} [nameOrOpts] — имя для debug, или { name, equals }
 * @returns {{ value: T, peek: () => T, subscribe: (fn) => () => void }}
 */
export function signal(initial, nameOrOpts) {
    const { name, equals } = _opts(nameOrOpts);

    let _value = initial;
    let _version = ++_epoch;
    const src = { subs: new Set(), version: () => _version };

    const sig = {
        [SIGNAL]: true,
        _name: name,

        get value() {
            _track(src);
            return _value;
        },

        set value(v) {
            if (_tracking && _tracking._isComputed) {
                _warn('E002', {
                    what: `Signal "${name || '?'}" written inside computed "${_tracking._name || '?'}".`,
                    why: 'Computeds must be pure — writing signals causes infinite loops or glitches.',
                    fix: 'Move the write into an effect() or a method/action.',
                });
            }
            if (equals(_value, v)) return;
            _value = v;
            _version = ++_epoch;
            _notify(src.subs);
        },

        /** Прочитать без подписки */
        peek() { return _value; },

        /** Текущая версия (для bailout зависимых) */
        get _v() { return _version; },

        /** Ручная подписка (возвращает unsubscribe) */
        subscribe(fn) { return _subscribe(src, () => _value, fn); },

        /** Обновить через функцию: sig.update(v => v + 1) */
        update(fn) { sig.value = fn(_value); },

        toString() { return `Signal(${name || '?'}: ${_value})`; }
    };

    return sig;
}

/** Является ли объект сигналом */
export function isSignal(v) {
    return v != null && v[SIGNAL] === true;
}

/**
 * Вычисляемое значение (ленивое, кэшированное)
 * Пересчитывается только когда зависимости реально изменились (по версиям);
 * версия самого computed растёт только при изменении результата.
 */
export function computed(fn, nameOrOpts) {
    const { name, equals } = _opts(nameOrOpts);

    let _value;
    let _version = 0;
    let _dirty = true;
    let _computing = false;     // circular dependency guard

    const src = {
        subs: new Set(),
        version() {
            if (_dirty) _recompute();
            return _version;
        },
    };

    const node = {
        _isComputed: true,
        _disposed: false,
        _name: `computed:${name || '?'}`,
        _deps: new Map(),
        /** push-фаза: пометить dirty и передать дальше */
        _run() {
            if (_dirty || node._disposed) return;
            _dirty = true;
            _notify(src.subs);
        },
    };

    function _recompute() {
        if (_computing) {
            throw new Error(`[Aegis] Circular dependency in computed "${name || '?'}"`);
        }
        _computing = true;
        const prev = _tracking;
        try {
            // Bailout: помечен dirty, но ни одна зависимость не изменила версию
            // (например, upstream computed пересчитался в то же значение)
            if (node._deps.size > 0 && !_depsChanged(node)) {
                _dirty = false;
                return;
            }
            _unsubscribe(node);
            _tracking = node;
            let newValue;
            try {
                newValue = fn();
            } catch (e) {
                // неполный набор deps — при следующем чтении пересчитать полностью
                _unsubscribe(node);
                throw e;
            }
            if (_version === 0 || !equals(_value, newValue)) {
                _value = newValue;
                _version = ++_epoch;
            }
            _dirty = false;
        } finally {
            _tracking = prev;
            _computing = false;
        }
    }

    const comp = {
        [SIGNAL]: true,
        _name: name,

        get value() {
            if (_dirty) _recompute();
            _track(src);
            return _value;
        },

        /** Прочитать без подписки (зависимости самого computed переподписываются как обычно) */
        peek() {
            if (_dirty) _recompute();
            return _value;
        },

        /** Текущая версия (для bailout зависимых) */
        get _v() { return src.version(); },

        subscribe(fn) { return _subscribe(src, () => _value, fn); },

        dispose() {
            node._disposed = true;
            _unsubscribe(node);
            src.subs.clear();
        },

        toString() { return `Computed(${name || '?'}: ${_dirty ? '<stale>' : _value})`; }
    };

    if (_currentScope) _currentScope.onDispose(comp.dispose);

    return comp;
}

/**
 * Побочный эффект — авто-трекинг зависимостей
 * fn может вернуть cleanup-функцию: она вызывается перед следующим запуском и при dispose.
 * Возвращает dispose-функцию
 *
 * Dev warning если вызван вне scope
 */
export function effect(fn, name) {
    if (!_currentScope) {
        _warn('E001', {
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in component(el, ({ effect }) => { ... }) or scope.run(() => effect(...))`,
        });
    }

    let _cleanup = null;

    const node = {
        _isComputed: false,
        _disposed: false,
        _name: name || 'effect',
        _deps: new Map(),
        _run() {
            if (node._disposed) return;
            // pull-фаза: запускаться только если зависимости реально изменились
            if (node._deps.size > 0 && !_depsChanged(node)) return;
            _execute();
        },
    };

    function _runCleanup() {
        if (!_cleanup) return;
        const c = _cleanup;
        _cleanup = null;
        try { c(); } catch (e) { console.error(`[Aegis] cleanup error in effect "${node._name}":`, e); }
    }

    function _execute() {
        _runCleanup();
        _unsubscribe(node);
        const prev = _tracking;
        _tracking = node;
        _batchDepth++;  // записи внутри effect откладываются до его завершения
        try {
            const r = fn();
            if (typeof r === 'function') _cleanup = r;
        } finally {
            _tracking = prev;
            _batchDepth--;
            if (_batchDepth === 0) _flush();
        }
    }

    const dispose = () => {
        if (node._disposed) return;
        node._disposed = true;
        _queue.delete(node);
        _unsubscribe(node);
        _runCleanup();
    };

    // Регистрируем до первого запуска: в уже уничтоженном scope effect не стартует
    if (_currentScope) _currentScope.onDispose(dispose);

    if (!node._disposed) _execute();

    return dispose;
}

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

function _notify(subs) {
    _notifyDepth++;
    try {
        for (const obs of [...subs]) {
            if (obs._disposed) { subs.delete(obs); continue; }
            if (obs._isComputed) obs._run();   // push: dirty по цепочке
            else _queue.add(obs);              // effects никогда не запускаются inline
        }
    } finally {
        _notifyDepth--;
    }
    // flush только когда все вложенные _notify завершены и мы не в batch
    if (_notifyDepth === 0 && _batchDepth === 0) _flush();
}

function _flush() {
    if (_flushing || _batchDepth > 0 || _queue.size === 0) return;
    _flushing = true;
    let rounds = 0;
    let error = null;
    try {
        // Записи из effects попадают в очередь и обрабатываются следующим раундом
        while (_queue.size > 0) {
            if (++rounds > _MAX_ROUNDS) {
                const names = [..._queue].map(o => o._name).join(', ');
                _queue.clear();
                throw new Error(`[Aegis] Infinite reactive loop — effect writes a signal it depends on (${names})`);
            }
            const round = [..._queue];
            _queue.clear();
            for (const obs of round) {
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
        this.parent = parent;
        this.children = [];
        this._disposers = [];
        this._disposed = false;
        if (parent) {
            if (parent._disposed) {
                _warn('E005', {
                    what: 'Scope created inside an already disposed scope.',
                    why: 'The parent will never dispose it — its effects and listeners leak.',
                    fix: 'Create scopes only while the parent is alive, or dispose this one manually.',
                });
                this.parent = null;
            } else {
                parent.children.push(this);
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

    /** Зарегистрировать cleanup-функцию (на уничтоженном scope — вызывается сразу) */
    onDispose(fn) {
        if (this._disposed) { fn(); return; }
        this._disposers.push(fn);
    }

    /** Уничтожить scope и все вложенные */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        // copy array — child.dispose() splices parent.children
        const children = this.children.slice();
        for (const child of children) child.dispose();
        this.children.length = 0;
        // Потом свои disposers
        for (const d of this._disposers) {
            try { d(); } catch (e) { console.error('[Aegis] dispose error:', e); }
        }
        this._disposers.length = 0;
        // Убрать себя из родителя
        if (this.parent && !this.parent._disposed) {
            const i = this.parent.children.indexOf(this);
            if (i >= 0) this.parent.children.splice(i, 1);
        }
    }
}

/** Создать scope (привязывается к родительскому автоматически) */
export function createScope() {
    return new Scope(_currentScope);
}

/** Зарегистрировать cleanup в текущем scope */
export function onDispose(fn) {
    if (_currentScope) _currentScope.onDispose(fn);
    else console.warn('[Aegis] onDispose вызван вне scope — cleanup не будет автоматическим');
}


