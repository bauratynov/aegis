// Симулятор планировщика: `npm run test:sched` (node, без зависимостей). Детерминированное виртуальное время (fakeScheduler),
// эффекты с виртуальной стоимостью, синтетический ввод через on(EventTarget). Свойства:
//   P1 под вводом синхронная часть ≤ бюджета (40 «мс») + одна компонент-группа; остальное — срезами после yield
//   P2 каждый эффект выполняется ровно один раз на поколение записи, порядок создания внутри группы сохранён
//   P3 группа (корневой scope) не разрывается: между двумя эффектами одной группы нет yield
//   P4 transition, поставленный раньше, не голодает: его дедлайн ≤ дедлайна свежего input → идёт первым, но ровно одной группой
//   INP-оракул: p98 симулированного INP для потока нажатий ≤ порога при 3 группах × N эффектов
import { existsSync } from 'node:fs';

const mod = await import(existsSync(new URL('./aegis_full.js', import.meta.url)) ? './aegis_full.js' : './aegis.js');
const { signal, effect, createScope, on, startTransition, flush, reset, useScheduler } = mod;
// локальная копия fakeScheduler из aegis-test.js (тот импортирует ./aegis.js = ядро, без on()/cache — в node не грузится)
function fakeScheduler({ cost = () => 0.5 } = {}) {
    let t = 0, pending = false, endSync = 0;
    const q = { micro: [], frame: [], idle: [], yield: [] }, trace = [];
    const restore = useScheduler({ now: () => t, micro: (f) => q.micro.push(f), frame: (f) => q.frame.push(f), idle: (f) => q.idle.push(f), yield: () => new Promise(r => q.yield.push(r)), inputPending: () => pending,
        onRun: (obs, lane) => { t += cost(obs._name); trace.push([t, lane, obs._name]); if (lane === 'sync') endSync = t; } });
    const drain = (k) => { const l = q[k]; q[k] = []; for (const f of l) f(k === 'idle' ? { timeRemaining: () => 8, didTimeout: false } : t); };
    return { now: () => t, tick: (ms) => { t += ms; }, micro: () => drain('micro'), frame: () => { t = Math.ceil(t / 16.7) * 16.7; drain('frame'); }, idle: () => drain('idle'), yields: () => { pending = false; drain('yield'); }, input: () => { pending = true; }, trace, inp: (t0) => endSync - t0 + (16.7 - ((endSync - t0) % 16.7)), restore };
}
if (typeof on !== 'function') { console.log('test-sched-sim: on() не найден (ядро без секции 3) — пропуск'); process.exit(0); }

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? +process.argv[i + 1] : def; };
const N = arg('effects', 100), GROUPS = arg('groups', 3), COST = arg('cost', 1), SEED = arg('seed', 3);
let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let fails = 0;
const step = async (s) => { s.yields(); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };   // продолжение после yield — промис: дать микрозадачам выполниться
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

function build(sched) {
    const src = signal(0); const groups = []; const runs = new Map();
    for (let g = 0; g < GROUPS; g++) {
        const sc = createScope('group' + g); groups.push(sc);
        sc.run(() => { for (let i = 0; i < N; i++) { const name = `g${g}e${i}`; effect(() => { src.value; runs.set(name, (runs.get(name) || 0) + 1); }, name); } });
    }
    runs.clear();
    const target = new EventTarget();
    const sc = createScope('handler');
    sc.run(() => on(target, 'click', () => { src.value++; }));
    return { src, groups, runs, target, dispose: () => { for (const g of groups) g.dispose(); sc.dispose(); } };
}

// ── P1–P3: одно нажатие
{
    const sched = fakeScheduler({ cost: () => COST });
    const w = build(sched);
    const t0 = sched.now();
    w.target.dispatchEvent(new Event('click'));
    const syncRuns = sched.trace.filter(x => x[1] === 'sync').length;
    const total = GROUPS * N;
    ok('P1: синхронная часть под вводом ≤ 40 «мс» + одна группа', syncRuns * COST <= 40 + N * COST && syncRuns < total, `sync ${syncRuns}/${total} эффектов (${syncRuns * COST} мс)`);
    let slices = 0;
    while (w.runs.size < total && slices < 100) { await step(sched); slices++; }
    ok('P2: каждый эффект ровно один раз после всех срезов', w.runs.size === total && [...w.runs.values()].every(n => n === 1), `${w.runs.size}/${total}, срезов ${slices}`);
    // P3: группы не разрываются — в трассе после sync-части имена идут блоками по группам
    const tail = sched.trace.filter(x => x[1] !== 'sync').map(x => x[2].slice(0, 2));
    let switches = 0; for (let i = 1; i < tail.length; i++) if (tail[i] !== tail[i - 1]) switches++;
    ok('P3: между срезами группа не разрезана (переключений ≤ групп)', switches <= GROUPS, `переключений ${switches}`);
    // порядок создания внутри группы
    const order = sched.trace.map(x => x[2]).filter(n => n.startsWith('g0e')).map(n => +n.slice(3));
    ok('P2: порядок создания внутри группы сохранён', order.every((v, i) => !i || v > order[i - 1]));
    ok('INP-оракул одного нажатия ≤ 60 «мс» (40 + presentation)', sched.inp(t0) <= 60, sched.inp(t0).toFixed(1) + ' мс');
    w.dispose(); sched.restore();
}

// ── P4: transition раньше input — не голодает, но уступает после одной группы
{
    const sched = fakeScheduler({ cost: () => COST });
    const w = build(sched);
    startTransition(() => { w.src.value = 100; });        // t = 0, дедлайн 250
    sched.tick(240);
    w.target.dispatchEvent(new Event('click'));           // input в t = 240: синхронная часть ≤ 40, хвост в heap с дедлайном 290
    await step(sched);                                    // первый срез: transition-элементы (dl 250) раньше input-хвоста (dl 290)
    const firstSlice = sched.trace.filter(x => x[1] === 'transition');
    ok('P4: transition с истёкшим дедлайном идёт в первом срезе', firstSlice.length > 0, `transition-запусков в срезе ${firstSlice.length}`);
    let n = 0; while (n++ < 200 && (sched.trace.length < 2 * GROUPS * N)) await step(sched);
    ok('P4: всё выполнено, ничего не потеряно', w.runs.size === GROUPS * N);
    w.dispose(); sched.restore();
}

// ── INP-оракул для потока нажатий (Пуассон): p98 ≤ порога
{
    const sched = fakeScheduler({ cost: () => COST });
    const w = build(sched);
    const inps = [];
    for (let k = 0; k < 40; k++) {
        const gap = -Math.log(1 - rnd()) * 120;            // средний интервал 120 «мс»
        sched.tick(gap);
        const t0 = sched.now();
        w.target.dispatchEvent(new Event('click'));
        inps.push(sched.inp(t0));
        let m = 0; while (m++ < 50 && w.runs.size < GROUPS * N) await step(sched);
        w.runs.clear();
    }
    inps.sort((a, b) => a - b);
    const p = (q) => inps[Math.min(inps.length - 1, Math.floor(q * inps.length))];
    console.log(`INP (${GROUPS}×${N} эффектов по ${COST} мс): p50 ${p(0.5).toFixed(1)}  p75 ${p(0.75).toFixed(1)}  p98 ${p(0.98).toFixed(1)}  без срезов было бы ${(GROUPS * N * COST + 16.7).toFixed(1)}`);
    ok('INP p98 ≤ 100 «мс» при потоке нажатий', p(0.98) <= 100);
    w.dispose(); sched.restore();
}

console.log(fails ? `\n${fails} FAILED` : '\nall scheduler checks passed');
process.exit(fails ? 1 : 0);
