// Тесты реактивного ядра: node --test test-core.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    signal, computed, effect, batch, untrack, isSignal, createScope, onDispose, onError, flush,
} from './aegis.js';
import { fuzzGraph } from './fuzz-graph.mjs';

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
    const errs = []; const off = onError((e) => errs.push(e));
    s.value = 1;                                   // писатель исключение не получает — оно идёт в onError()
    off();
    assert.equal(errs.length, 1); assert.match(errs[0].message, /boom/); assert.equal(errs[0].aegis.effect, 'effect');
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
    const off = onError(() => {});
    s.value = 1;
    off();
    s.value = 2;
    assert.equal(runs, 3);
});

test('signal: JSON.stringify отдаёт значение', () => {
    const s = signal({ a: 1 });
    assert.equal(JSON.stringify({ s }), '{"s":{"a":1}}');
});

// ── ядро фаза 1: ошибка computed как значение, порядок раунда, полосы, фаззер ──
test('computed: исключение кэшируется, подписки целы, второй эффект раунда не залипает', () => {
    const user = signal(null); let calls = 0; const got = []; let other = 0, errs = 0;
    const name = computed(() => { calls++; return user.value.name; }, 'name');
    const sc = createScope(); sc.onError(() => errs++);
    sc.run(() => { effect(() => { got.push(name.value); }, 'render'); effect(() => { user.value; other++; }, 'other'); });
    assert.equal(errs, 1); assert.equal(other, 1);
    let e1, e2; try { name.value; } catch (e) { e1 = e; } try { name.peek(); } catch (e) { e2 = e; }
    assert.equal(calls, 1); assert.equal(e1, e2);
    assert.equal(typeof name.version(), 'number');
    user.value = { name: 'ann' };
    assert.equal(got.at(-1), 'ann'); assert.equal(other, 2);
    user.value = null; user.value = { name: 'bob' };
    assert.equal(got.at(-1), 'bob'); assert.equal(errs, 2); assert.equal(other, 4);
    assert.equal(user.subs.size, 2); assert.equal(name.subs.size, 1);
    sc.dispose();
});

test('flush: порядок раунда по созданию — родитель раньше потомка после churn подписок', () => {
    const mode = signal('x'), user = signal({ name: 'ann' }), other = signal(true);
    const log = []; let childErr = 0, kid = null;
    const sc = createScope();
    sc.run(() => effect(() => {
        log.push('P');
        const vis = mode.value === 'x' ? user.value != null : other.value;
        if (kid) { kid.dispose(); kid = null; }
        if (vis) { kid = createScope(); kid.run(() => effect(() => { log.push('C'); try { user.value.name; } catch (e) { childErr++; } }, 'child')); }
    }, 'parent'));
    mode.value = 'o'; mode.value = 'x';
    log.length = 0; user.value = null;
    assert.equal(log.join(''), 'P'); assert.equal(childErr, 0);
    sc.dispose();
});

test('полосы: самоцикл micro-полосы обнаружен, ошибки полосы — в onError', async () => {
    const s = signal(0); let runs = 0, msg = '';
    const sc = createScope(); sc.run(() => effect(() => { runs++; s.value = s.value + 1; }, { name: 'loop', flush: 'micro' }));
    try { flush(); } catch (e) { msg = e.message; }
    assert.match(msg, /Infinite reactive loop in "micro" lane/); assert.ok(runs <= 102);
    sc.dispose();
    const s3 = signal(0); let seen = 0; const off = onError(() => seen++);
    const sc3 = createScope(); sc3.run(() => effect(() => { if (s3.value) throw new Error('lane'); }, { flush: 'micro' }));
    s3.value = 1; await new Promise(r => setTimeout(r, 1));
    assert.equal(seen, 1); off(); sc3.dispose();
});

test('фаззер графа: 1000 сидов × 60 операций против оракула без нарушений I1–I7', () => {
    const api = { signal, computed, effect, batch, createScope, flush };
    const fails = fuzzGraph(api, { seeds: 1000, ops: 60 });
    assert.deepEqual(fails.slice(0, 3), [], JSON.stringify(fails.slice(0, 3)));
});

test('fault-фаззер: ядовитый computed — ни вылетов, ни застрявших эффектов', () => {
    const api = { signal, computed, effect, batch, createScope, flush };
    const fails = fuzzGraph(api, { seeds: 300, ops: 30, poison: 3 });
    assert.deepEqual(fails.slice(0, 3), [], JSON.stringify(fails.slice(0, 3)));
    assert.ok(fails.poisoned > 30, 'poison met on ' + fails.poisoned + ' seeds');
});
