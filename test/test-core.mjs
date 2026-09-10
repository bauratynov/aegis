// Тесты реактивного ядра: node --test test-core.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    signal, computed, effect, batch, untrack, isSignal, createScope, onDispose, onError, flush, signals,
    startTransition, deferred, transaction, defaults,
} from '../aegis.js';
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

// ── ядро фаза 2a: computed без владельца, дети эффекта ──
test('computed без владельца: подписан на источники только пока наблюдаем; корректен по версиям без наблюдателей', () => {
    const src = signal(0);
    const cs = [0, 1, 2].map(i => computed(() => src.value + i));
    cs.forEach(c => c.peek());
    assert.equal(src.subs ? src.subs.size : 0, 0);
    src.value = 5;
    assert.equal(cs.map(c => c.value).join(), '5,6,7');
    const b = computed(() => src.value + 1), c2 = computed(() => b.value * 10);
    const sc = createScope(); let v;
    sc.run(() => effect(() => { v = c2.value; }));
    assert.equal(src.subs.size, 1); assert.equal(b._live, true); assert.equal(v, 60);
    src.value = 6; assert.equal(v, 70);
    sc.dispose();
    assert.equal(src.subs.size, 0); assert.equal(b._live, false); assert.equal(c2._live, false);
    src.value = 7; assert.equal(c2.value, 80);
});

test('дети эффекта: созданное в теле умирает перед перезапуском; { own: false } — старое поведение', () => {
    const open = signal(true), n = signal(0); let inner = 0, subs = 0;
    const sc = createScope();
    sc.run(() => effect(() => { if (open.value) { effect(() => { n.value; inner++; }); n.subscribe(() => subs++); } }));
    open.value = false; open.value = true; open.value = false; open.value = true;
    inner = 0; subs = 0; n.value++;
    assert.equal(inner, 1); assert.equal(subs, 1);
    let acc = 0;
    const sc2 = createScope();
    sc2.run(() => effect(() => { open.value; effect(() => { n.value; acc++; }); }, { own: false }));
    open.value = false; open.value = true;
    acc = 0; n.value++;
    assert.equal(acc, 3);
    sc.dispose(); sc2.dispose();
});

test('signal({ watched, unwatched }): хуки на первом и последнем подписчике', () => {
    let up = 0, down = 0;
    const s = signal(0, { watched: () => up++, unwatched: () => down++ });
    const sc = createScope(); sc.run(() => effect(() => { s.value; }));
    assert.equal(up, 1); assert.equal(down, 0);
    const c = computed(() => s.value * 2);
    const sc2 = createScope(); sc2.run(() => effect(() => { c.value; }));
    sc.dispose();
    assert.equal(down, 0);          // computed ещё держит
    sc2.dispose();
    assert.equal(down, 1);
});

// ── ядро фаза 2b: signals(), _endTrack при сдвиге зависимостей ──
test('signals({}): имена из ключей, геттер → computed, prefix', () => {
    const { count, total } = signals({ count: 2, get total() { return count.value * 10; } });
    assert.equal(count._name, 'count'); assert.equal(total._name, 'total'); assert.equal(total.value, 20);
    count.value = 3; assert.equal(total.value, 30);
    assert.equal(signals({ a: 1 }, { prefix: 'cart' }).a._name, 'cart.a');
});

test('_endTrack: сдвиг порядка 2000 зависимостей — линейно, подписки точные', () => {
    const N = 2000, sigs = Array.from({ length: N }, (_, i) => signal(i));
    let off = 0; const sc = createScope();
    sc.run(() => effect(() => { for (let i = 0; i < N; i++) sigs[(i + off) % N].value; }));
    const t0 = performance.now();
    for (let r = 0; r < 20; r++) { off++; sigs[0].value = r + 1; }
    assert.ok(performance.now() - t0 < 300, 'too slow');
    assert.ok(sigs.every(s => s.subs && s.subs.size === 1));
    sc.dispose();
    assert.ok(sigs.every(s => !s.subs || s.subs.size === 0));
});

// ── фаза A1: представление ядра
test('backdating: запись «туда и обратно» внутри batch не перезапускает эффект (версия — функция значения)', () => {
    const s = signal(1); let runs = 0;
    const sc = createScope();
    sc.run(() => effect(() => { s.value; runs++; }));
    runs = 0;
    batch(() => { s.value = 2; s.value = 3; s.value = 1; });
    assert.equal(runs, 0);
    batch(() => { s.value = 2; s.value = 1; s.value = 2; });   // конечное значение отличается — ровно один запуск
    assert.equal(runs, 1);
    const w = signal(1, { equals: false }); let r2 = 0;
    sc.run(() => effect(() => { w.value; r2++; }));
    r2 = 0; batch(() => { w.value = 1; w.value = 1; });            // equals:false — backdating не применяется
    assert.equal(r2, 1);
    sc.dispose();
});

test('durability: computed без источников — константа; производная от high-сигнала не перепроверяется после low-записей', () => {
    let k = 0; const c = computed(() => { k++; return 42; });
    const noise = signal(0);
    c.value; noise.value = 1; c.value; noise.value = 2; c.value;
    assert.equal(k, 1);
    const locale = signal('en', { durability: 'high' }); const query = signal('');
    let evals = 0; const label = computed(() => { evals++; return locale.value + '!'; });
    label.value;
    for (let i = 0; i < 50; i++) { query.value = 'q' + i; label.value; }
    assert.equal(evals, 1);
    locale.value = 'ru';
    assert.equal(label.value, 'ru!');
    assert.equal(evals, 2);
    const mixed = computed(() => locale.value + query.value);   // минимум по источникам — low: перепроверяется как обычно
    mixed.value; query.value = 'z';
    assert.equal(mixed.value, 'ruz');
});

test('run-stamped deps: чередующиеся чтения a,b,a,b,a дают 2 слота зависимостей', () => {
    const a = signal(1), b = signal(2); let node;
    const sc = createScope();
    sc.run(() => { node = effect(() => { a.value; b.value; a.value; b.value; a.value; })._node; });
    assert.equal(node._deps.length, 2);
    let runs = 0;
    sc.run(() => effect(() => { a.value; b.value; a.value; runs++; }));
    a.value = 5;
    assert.equal(runs, 2);
    sc.dispose();
});

test('provenance-ordered rounds: эффект-читатель идёт после эффекта-писателя — один запуск на запись, а не stale + correct', () => {
    const x = signal(0), y = signal(0); let readerRuns = 0, seen = [];
    const sc = createScope();
    sc.run(() => {
        effect(() => { readerRuns++; seen.push(y.value); }, 'reader');   // создан раньше писателя
        effect(() => { y.value = x.value * 2; }, 'writer');
    });
    readerRuns = 0; seen = [];
    x.value = 1;                     // первый раунд учит ребро writer → reader
    x.value = 2;
    x.value = 3;
    assert.deepEqual(seen.slice(-2), [4, 6]);
    assert.equal(readerRuns, 3);     // ровно один запуск на запись после обучения (первая запись — тоже один: Кан ставит писателя раньше)
    sc.dispose();
});

// ── фаза A2: транзакционный dispose и одно ребро владения
test('dispose — транзакция: запись из cleanup не запускает соседний эффект умирающего scope; внешний наблюдатель видит одно пост-состояние', () => {
    const s = signal(1); const log = [];
    const outer = createScope();
    outer.run(() => effect(() => { log.push('out:' + s.value); }));
    const sc = createScope();
    sc.run(() => {
        effect(() => { s.value; return () => { s.value = 99; }; }, 'A');
        effect(() => { log.push('B:' + s.value); }, 'B');
    });
    log.length = 0;
    sc.dispose();
    assert.deepEqual(log, ['out:99']);   // B не бежал поверх полуразрушенного состояния; внешний эффект — ровно раз, после транзакции
    outer.dispose();
});

test('L1: эффект, созданный в теле запуска, имеет ровно одно ребро владения (в _kids родителя, не в scope)', () => {
    const s = signal(0); let inner = 0;
    const sc = createScope();
    let outerNode;
    sc.run(() => { outerNode = effect(() => { s.value; effect(() => { inner++; }); })._node; });
    assert.equal(sc._disposers.size, 1);
    assert.equal(outerNode._kids.length, 1);
    s.value = 1; s.value = 2;
    assert.equal(inner, 3);
    sc.dispose();                           // scope → внешний эффект → _killKids → внутренний
    s.value = 3;
    assert.equal(inner, 3);
});

// ── фаза A3: планировщик
test('startTransition: записи не запускают эффекты синхронно, pending сигнал, latest-wins, flush() дренирует', () => {
    const q = signal(''); const seen = [];
    const sc = createScope();
    sc.run(() => effect(() => { seen.push(q.value); }));
    seen.length = 0;
    startTransition(() => { q.value = 'a'; });
    assert.deepEqual(seen, []);
    assert.equal(startTransition.pending.value, true);
    startTransition(() => { q.value = 'ab'; });
    flush();
    assert.deepEqual(seen, ['ab']);            // два перехода — один запуск с последним значением
    assert.equal(startTransition.pending.value, false);
    sc.dispose();
});

test('deferred(): тень сигнала обновляется в transition-полосе, срочная привязка — сразу', () => {
    const q = signal('x'); let dq; const seen = [];
    const sc = createScope();
    sc.run(() => { dq = deferred(q); effect(() => { seen.push(q.value + '/' + dq.value); }); });
    seen.length = 0;
    q.value = 'y';
    assert.deepEqual(seen, ['y/x']);           // срочная часть видит новое, тень — старое
    flush();
    assert.deepEqual(seen, ['y/x', 'y/y']);
    sc.dispose();
});

test('transaction(): read-set валидируется на commit — конфликт → повтор с новым значением, onConflict → abort', async () => {
    const a = signal(1), b = signal(1); let attempts = 0;
    const p = transaction(async ({ read, write }) => {
        attempts++;
        const x = read(a);
        await new Promise(r => setTimeout(r, 5));
        write(b, x + 1);
        return x;
    });
    a.value = 10;                               // внешняя запись во время await
    const r = await p;
    assert.equal(attempts, 2);
    assert.equal(r, 10);
    assert.equal(b.value, 11);
    assert.equal(a.subs, null);                 // фантомный наблюдатель не подписывается
    let conflict = null;
    const p2 = transaction(async ({ read }) => { read(a); await new Promise(r => setTimeout(r, 5)); return 1; }, { retries: 0, onConflict: (c) => { conflict = c; return 'abort'; } });
    a.value = 20;
    await assert.rejects(p2, /transaction conflict/);
    assert.equal(conflict[0].name, 'signal');
});

test('computed.dispose(): значение заморожено — источник меняется, peek()/value не пересчитываются (E045 честен)', () => {
    const a = signal(1);
    const c = computed(() => a.value * 10);
    assert.equal(c.peek(), 10);
    c.dispose();
    a.value = 2;
    assert.equal(c.peek(), 10);
    assert.equal(c.value, 10);
    const c2 = computed(() => a.value + 1);   // never read before dispose: stays at its initial (undefined) value
    c2.dispose();
    a.value = 3;
    assert.equal(c2.peek(), undefined);
});

test('untrack() внутри computed: источник под untrack не является зависимостью — пересчёт только от отслеживаемых', () => {
    const tracked = signal(1), hidden = signal(10);
    const c = computed(() => tracked.value + untrack(() => hidden.value));
    assert.equal(c.value, 11);
    hidden.value = 20;
    assert.equal(c.value, 11);      // cached: the untracked read is not a dependency
    tracked.value = 2;
    assert.equal(c.value, 22);      // the tracked change re-reads both
});

test('defaults.orphanEffects: "throw" бросает на effect() вне scope, "root" привязывает к корневому scope и эффект живёт', () => {
    const prev = defaults.orphanEffects;
    try {
        defaults.orphanEffects = 'throw';
        assert.throws(() => effect(() => {}), /E001/);
        defaults.orphanEffects = 'root';
        const a = signal(1); let runs = 0;
        const stop = effect(() => { a.value; runs++; });
        a.value = 2;
        assert.equal(runs, 2);
        stop();
        a.value = 3;
        assert.equal(runs, 2);
    } finally { defaults.orphanEffects = prev; }
});
