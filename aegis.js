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

const _DEV = typeof window !== 'undefined' && window.__AEGIS_DEV__;

/** Elm-style three-part warning: what → why → fix */
function _warn(code, { what, why, fix }) {
    if (!_DEV) return;
    console.warn(
        `⚠ [Aegis:${code}] ${what}\n` +
        `  Why: ${why}\n` +
        `  Fix: ${fix}`
    );
}

// Prototype pollution deny-list
const _DENIED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// ============================================================================
// 1. REACTIVE CORE — Signals, Computed, Effect, Batch
//    Version-based glitch-free propagation (TC39/Solid/Preact converged)
//    Custom equals option (TC39 Signals spec-aligned)
// ============================================================================

let _tracking = null;       // текущий effect для auto-track
let _batchDepth = 0;        // глубина batch()
const _batchQueue = new Set(); // очередь effects для flush
let _epoch = 0;             // глобальный epoch-counter для version tracking

const SIGNAL = Symbol('aegis.signal');

/**
 * Создать реактивный сигнал
 * @template T
 * @param {T} initial
 * @param {string|Object} [nameOrOpts] — имя для debug, или { name, equals }
 * @returns {{ value: T, peek: () => T, subscribe: (fn) => () => void }}
 */
export function signal(initial, nameOrOpts) {
    const opts = typeof nameOrOpts === 'string' ? { name: nameOrOpts } : (nameOrOpts || {});
    const name = opts.name || null;
    // custom equality — equals:false means "always notify"
    const _equals = opts.equals !== undefined && opts.equals !== null
        ? (opts.equals === false ? () => false : opts.equals)
        : Object.is;

    let _value = initial;
    let _version = ++_epoch;  // version counter
    const _subs = new Set();

    const sig = {
        [SIGNAL]: true,
        _name: name,

        get value() {
            if (_tracking) {
                _subs.add(_tracking);
                // track reverse dep for cleanup
                if (_tracking._deps) _tracking._deps.add(_subs);
            }
            return _value;
        },

        set value(v) {
            // Dev warning: writing signal inside computed
            if (_DEV && _tracking && _tracking._isComputed) {
                _warn('E002', {
                    what: `Signal "${name || '?'}" written inside computed "${_tracking._name || '?'}".`,
                    why: 'Computeds must be pure — writing signals causes infinite loops or glitches.',
                    fix: 'Move the write into an effect() or a method/action.',
                });
            }
            if (_equals(_value, v)) return;
            _value = v;
            _version = ++_epoch; // bump version
            _notify(_subs);
        },

        /** Прочитать без подписки */
        peek() { return _value; },

        /** Текущая версия (для computed bailout) */
        get _v() { return _version; },

        /** Ручная подписка (возвращает unsubscribe) */
        subscribe(fn) {
            _subs.add(fn);
            return () => _subs.delete(fn);
        },

        /** Обновить через функцию: sig.update(v => v + 1) */
        update(fn) {
            sig.value = fn(_value);
        },

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
 * Version-based: пересчитывается только когда зависимости реально изменились
 */
export function computed(fn, nameOrOpts) {
    const opts = typeof nameOrOpts === 'string' ? { name: nameOrOpts } : (nameOrOpts || {});
    const name = opts.name || null;
    // custom equality — equals:false means "always notify"
    const _equals = opts.equals !== undefined && opts.equals !== null
        ? (opts.equals === false ? () => false : opts.equals)
        : Object.is;

    let _value, _dirty = true;
    let _version = 0;
    let _computing = false;     // circular dependency guard
    const _subs = new Set();

    // Two-phase: push только помечает dirty, pull пересчитывает при read
    const _markDirty = () => {
        if (!_dirty) {
            _dirty = true;
            // Propagate dirty mark to subscribers (computeds downstream)
            _notify(_subs);
        }
    };
    _markDirty._disposed = false;
    _markDirty._isComputed = true; // пометка что это computed, не effect
    _markDirty._name = `computed:${name || '?'}`;
    _markDirty._deps = null;       // deps tracked during computation

    const _recompute = () => {
        if (_computing) {
            throw new Error(`[Aegis] Circular dependency in computed "${name || '?'}"`);
        }
        _computing = true;
        // unsubscribe from old deps, setup new collection
        if (_markDirty._deps) {
            for (const subs of _markDirty._deps) subs.delete(_markDirty);
        }
        _markDirty._deps = new Set();
        const prev = _tracking;
        _tracking = _markDirty;
        try {
            const newValue = fn();
            if (!_equals(_value, newValue)) {
                _value = newValue;
                _version = ++_epoch;
            }
        } finally {
            _tracking = prev;
            _computing = false;
        }
        _dirty = false;
    };

    const comp = {
        [SIGNAL]: true,
        _name: name,

        get value() {
            if (_tracking) {
                _subs.add(_tracking);
                if (_tracking._deps) _tracking._deps.add(_subs);
            }
            if (_dirty) _recompute();
            return _value;
        },

        peek() {
            if (_dirty) {
                const prevTracking = _tracking;
                _tracking = null;
                _computing = true;
                try {
                    const newValue = fn();
                    if (!_equals(_value, newValue)) {
                        _value = newValue;
                        _version = ++_epoch;
                    }
                } finally {
                    _tracking = prevTracking;
                    _computing = false;
                }
                _dirty = false;
            }
            return _value;
        },

        /** Текущая версия (для downstream bailout) */
        get _v() {
            // Ensure freshness before reporting version
            if (_dirty) comp.peek();
            return _version;
        },

        subscribe(fn) {
            _subs.add(fn);
            return () => _subs.delete(fn);
        },

        dispose() {
            _markDirty._disposed = true;
            _subs.clear();
        },

        toString() { return `Computed(${name || '?'}: ${_value})`; }
    };

    return comp;
}

/**
 * Побочный эффект — авто-трекинг зависимостей
 * Возвращает dispose-функцию
 *
 * Dev warning если вызван вне scope
 */
export function effect(fn, name) {
    // Ownership warning
    if (_DEV && !_currentScope) {
        _warn('E001', {
            what: `Effect "${name || 'anonymous'}" created outside a component scope — it will never be cleaned up.`,
            why: 'Effects created outside a scope leak subscribers forever, causing memory growth.',
            fix: `Wrap in component(el, ({ effect }) => { ... }) or scope.run(() => effect(...))`,
        });
    }

    const _effect = () => {
        if (_effect._disposed || _effect._running) return;
        _effect._running = true;
        // cleanup old subscriptions before re-tracking
        if (_effect._deps) {
            for (const subs of _effect._deps) subs.delete(_effect);
        }
        _effect._deps = new Set();
        const prev = _tracking;
        _tracking = _effect;
        try { fn(); }
        finally { _tracking = prev; _effect._running = false; }
    };
    _effect._disposed = false;
    _effect._running = false;
    _effect._deps = null;      // tracked dependency sets
    _effect._name = name || 'effect';
    _effect._isComputed = false;

    // Запуск: первый вызов сразу
    _effect();

    // Возвращаем dispose
    const dispose = () => { _effect._disposed = true; };

    // Регистрируем в текущем scope для auto-cleanup
    if (_currentScope) _currentScope._disposers.push(dispose);

    return dispose;
}

/**
 * Группировка обновлений — все изменения внутри batch
 * вызовут effects только один раз после завершения
 */
export function batch(fn) {
    _batchDepth++;
    try {
        fn();
    } finally {
        _batchDepth--;
        if (_batchDepth === 0) _flush();
    }
}

let _notifyDepth = 0;
let _notifyBatchDepth = 0;  // track nested _notify calls
const _MAX_DEPTH = 100;

function _notify(subs) {
    if (++_notifyDepth > _MAX_DEPTH) {
        _notifyDepth--;
        throw new Error('[Aegis] Maximum reactive depth exceeded — possible infinite loop');
    }
    _notifyBatchDepth++;
    try {
        const list = [...subs];
        for (const fn of list) {
            if (fn._disposed) { subs.delete(fn); continue; }
            if (fn._isComputed) {
                // propagate dirty marks immediately (push phase)
                fn();
            } else {
                // defer ALL effects — never run inline
                _batchQueue.add(fn);
            }
        }
    } finally {
        _notifyDepth--;
        _notifyBatchDepth--;
        // flush only when ALL nested _notify calls complete and not in batch
        if (_notifyBatchDepth === 0 && _batchDepth === 0) {
            _flush();
        }
    }
}

function _flush() {
    const queue = [..._batchQueue];
    _batchQueue.clear();
    // same two-phase in batch flush
    const effects = [];
    for (const fn of queue) {
        if (fn._disposed) continue;
        if (fn._isComputed) fn();
        else effects.push(fn);
    }
    for (const fn of effects) {
        if (!fn._disposed) fn();
    }
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
        if (parent) parent.children.push(this);
    }

    /** Выполнить функцию в контексте этого scope */
    run(fn) {
        const prev = _currentScope;
        _currentScope = this;
        try { return fn(); }
        finally { _currentScope = prev; }
    }

    /** Зарегистрировать cleanup-функцию */
    onDispose(fn) {
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


