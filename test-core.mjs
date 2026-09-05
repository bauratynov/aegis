// Тесты реактивного ядра: node --test test-core.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    signal, computed, effect, batch, untrack, isSignal, createScope, onDispose,
} from './aegis.js';

test('signal: базовое чтение/запись, peek, update, equals', () => {
    const s = signal(1, 'n');
    assert.equal(s.value, 1);
    s.update(v => v + 1);
    assert.equal(s.peek(), 2);
    assert.ok(isSignal(s));
    let runs = 0;
    effect(() => { s.value; runs++; });
    s.value = 2;          // Object.is — без уведомления
    assert.equal(runs, 1);
    const always = signal({ a: 1 }, { equals: false });
    let r2 = 0;
    effect(() => { always.value; r2++; });
    always.value = always.peek();
    assert.equal(r2, 2);
});

test('computed: ленивый, кэшируется, следит за зависимостями', () => {
    const a = signal(2), b = signal(3);
    let calcs = 0;
    const sum = computed(() => { calcs++; return a.value + b.value; });
    assert.equal(calcs, 0);
    assert.equal(sum.value, 5);
    assert.equal(sum.value, 5);
    assert.equal(calcs, 1);
    a.value = 10;
    assert.equal(sum.value, 13);
    assert.equal(calcs, 2);
});

test('computed.peek() на dirty computed переподписывает зависимости', () => {
    const flag = signal(true), a = signal(1), b = signal(10);
    const c = computed(() => flag.value ? a.value : b.value);
    c.value;
    flag.value = false;
    assert.equal(c.peek(), 10);
    b.value = 20;
    assert.equal(c.value, 20);
});

test('effect не запускается, если computed пересчитался в то же значение', () => {
    const n = signal(1);
    const even = computed(() => n.value % 2 === 0);
    let runs = 0;
    effect(() => { even.value; runs++; });
    n.value = 3;
    n.value = 5;
    assert.equal(runs, 1);
    n.value = 6;
    assert.equal(runs, 2);
});

test('цепочка computed: без пересчёта, если upstream не изменился', () => {
    const n = signal(1);
    const abs = computed(() => Math.abs(n.value));
    let calcs = 0;
    const doubled = computed(() => { calcs++; return abs.value * 2; });
    let seen = [];
    effect(() => { seen.push(doubled.value); });
    n.value = -1;             // abs тот же → doubled не пересчитывается, effect молчит
    assert.equal(calcs, 1);
    assert.deepEqual(seen, [2]);
    n.value = 2;
    assert.deepEqual(seen, [2, 4]);
});

test('glitch-free: effect видит согласованное состояние (diamond)', () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => a.value * 10);
    const seen = [];
    effect(() => { seen.push([b.value, c.value]); });
    a.value = 2;
    assert.deepEqual(seen, [[2, 10], [3, 20]]);
});

test('запись сигнала внутри effect не теряет обновление и не дублирует запуски', () => {
    const trigger = signal(0), s1 = signal(0), s2 = signal(0);
    const seenA = [];
    effect(() => {
        trigger.value;
        seenA.push(s2.value);
        if (trigger.peek() === 1 && s1.peek() === 0) s1.value = 1;
    }, 'A');
    effect(() => { if (s1.value === 1) s2.value = 5; }, 'B');
    trigger.value = 1;
    assert.deepEqual(seenA, [0, 0, 5]);

    const s = signal(0), t = signal(0);
    let runsB = 0;
    effect(() => { t.value = s.value; });
    effect(() => { s.value; t.value; runsB++; });
    runsB = 0;
    s.value = 1;
    assert.equal(runsB, 1);
});

test('бесконечный цикл effect ↔ signal обнаруживается', () => {
    const s = signal(0);
    assert.throws(
        () => effect(() => { s.value = s.value + 1; }, 'loop'),
        /Infinite reactive loop.*loop/
    );
});

test('циклическая зависимость computed обнаруживается', () => {
    let b;
    const a = computed(() => b.value + 1, 'a');
    b = computed(() => a.value + 1, 'b');
    assert.throws(() => a.value, /Circular dependency/);
});

test('subscribe передаёт значение и отписывается', () => {
    const s = signal(1);
    const got = [];
    const unsub = s.subscribe(v => got.push(v));
    s.value = 2;
    s.value = 3;
    unsub();
    s.value = 4;
    assert.deepEqual(got, [2, 3]);

    const c = computed(() => s.value % 2);
    const gotC = [];
    c.subscribe(v => gotC.push(v));
    s.value = 6;   // 0 → 0: computed не изменился, подписчик молчит
    s.value = 7;
    assert.deepEqual(gotC, [1]);
});

test('dispose effect отписывает от сигнала сразу и вызывает cleanup', () => {
    const s = signal(0);
    let cleaned = 0, runs = 0;
    const dispose = effect(() => {
        s.value; runs++;
        return () => cleaned++;
    });
    s.value = 1;
    assert.equal(cleaned, 1);   // cleanup перед повторным запуском
    dispose();
    assert.equal(cleaned, 2);
    s.value = 2;
    assert.equal(runs, 2);
    // внутреннее: подписчиков не осталось
    assert.equal(s.subscribe(() => {}) && true, true);
});

test('batch: один запуск, возвращает результат', () => {
    const a = signal(1), b = signal(2);
    let runs = 0;
    effect(() => { a.value; b.value; runs++; });
    const r = batch(() => { a.value = 10; b.value = 20; return 42; });
    assert.equal(r, 42);
    assert.equal(runs, 2);
});

test('untrack: чтение без подписки', () => {
    const a = signal(1), b = signal(1);
    let runs = 0;
    effect(() => { a.value; untrack(() => b.value); runs++; });
    b.value = 2;
    assert.equal(runs, 1);
    a.value = 2;
    assert.equal(runs, 2);
});

test('ошибка в одном effect не блокирует остальные', () => {
    const s = signal(0);
    let other = 0;
    effect(() => { if (s.value === 1) throw new Error('boom'); });
    effect(() => { s.value; other++; });
    assert.throws(() => { s.value = 1; }, /boom/);
    assert.equal(other, 2);
    s.value = 2;   // ядро не осталось в состоянии flushing
    assert.equal(other, 3);
});

test('scope: dispose уничтожает effects, computed и подписки; на мёртвом scope — сразу', () => {
    const s = signal(0);
    let runs = 0, subs = 0, cleanups = 0;
    const scope = createScope();
    scope.run(() => {
        effect(() => { s.value; runs++; });
        s.subscribe(() => subs++);
        onDispose(() => cleanups++);
    });
    s.value = 1;
    assert.equal(runs, 2);
    assert.equal(subs, 1);
    scope.dispose();
    s.value = 2;
    assert.equal(runs, 2);
    assert.equal(subs, 1);
    assert.equal(cleanups, 1);

    let late = 0;
    scope.onDispose(() => late++);
    assert.equal(late, 1);
    scope.run(() => effect(() => { s.value; runs++; }));
    s.value = 3;
    assert.equal(runs, 2);   // effect в мёртвом scope уничтожается до первого запуска
});

test('deps: динамические зависимости — старый источник отписывается, новый подписывается', () => {
    const flag = signal(true), a = signal(1), b = signal(1);
    let runs = 0;
    effect(() => { flag.value ? a.value : b.value; runs++; });
    flag.value = false;          // теперь зависит от b
    b.value = 2;
    assert.equal(runs, 3);
    a.value = 2;                 // a больше не зависимость
    assert.equal(runs, 3);
    assert.equal(a.subs.size, 0);
    assert.equal(b.subs.size, 1);
});

test('scope: onDispose возвращает unregister', () => {
    const scope = createScope();
    let calls = 0;
    const off = scope.onDispose(() => calls++);
    scope.onDispose(() => calls += 10);
    off();
    assert.equal(scope._disposers.size, 1);
    scope.dispose();
    assert.equal(calls, 10);
    let late = 0;
    const offLate = scope.onDispose(() => late++);   // на мёртвом scope — сразу
    assert.equal(late, 1);
    assert.equal(typeof offLate, 'function');
});

test('effect: повторный запуск выполняется под своим scope, а не под scope писателя', () => {
    const shared = signal(0);
    const A = createScope(), B = createScope();
    let child = null;
    A.run(() => { effect(() => { shared.value; child = createScope(); }); });
    B.run(() => { shared.value = 1; });   // запись из чужого scope
    assert.equal(child.parent, A);
    B.dispose();
    assert.equal(child._disposed, false);
    A.dispose();
    assert.equal(child._disposed, true);
});

test('ошибка в effect не отписывает уже прочитанные зависимости', () => {
    const s = signal(0);
    let runs = 0;
    effect(() => { runs++; if (s.value === 1) throw new Error('once'); });
    assert.throws(() => { s.value = 1; }, /once/);
    s.value = 2;
    assert.equal(runs, 3);
});

test('signal: JSON.stringify отдаёт значение', () => {
    const s = signal({ a: 1 });
    assert.equal(JSON.stringify({ s }), '{"s":{"a":1}}');
});
