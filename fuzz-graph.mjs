// Model-based фаззер реактивного графа: случайный граф сигналов/computed/эффектов против наивного оракула «пересчитать всё».
// Общий для test-core.mjs (node) и test.html (браузер): fuzzGraph(api, { seeds, ops }) → [] или список нарушений с трассой.
// Инварианты: I1 согласованность (эффект видит то же, что оракул), I2 необходимость (кортеж изменился ⇒ ровно один запуск),
// I3 нехолостость (запуск ⇒ была запись), I4 ≤ 1 вызова fn каждого computed за шаг, I5 subs ↔ deps согласованы и без уничтоженных,
// I7 канарейка утечек (effects/scopes после dispose как до). Fault-фаззер: ядовитое значение → computed бросает; граф и раунд не рвутся.

const lcg = (seed) => { let s = seed % 2147483647 || 1; return () => (s = (s * 48271) % 2147483647) / 2147483647; };
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];

export function genGraph(api, seed, { nSig = 4, nComp = 6, nEff = 4, poison = null } = {}) {
    const { signal, computed, effect, batch, createScope, flush } = api;
    const rnd = lcg(seed);
    const nodes = [], comps = [], effs = [], calls = new Map(), viol = [];
    const byId = new Map();
    const add = (n) => { nodes.push(n); byId.set(n.id, n); return n; };
    for (let i = 0; i < nSig; i++) add({ id: 's' + i, kind: 'sig', node: signal(i, 's' + i) });
    let errCount = 0;
    for (let i = 0; i < nComp; i++) {
        const [a, b, c, cond] = [0, 0, 0, 0].map(() => pick(rnd, nodes).id), dyn = rnd() < 0.5, id = 'c' + i;
        const fn = (read) => {
            const v = dyn ? (read(cond) % 2 === 0 ? read(a) + read(b) : read(c) * 3) : read(a) + read(b) - read(cond);
            if (poison != null && v === poison) throw new Error('poison ' + id);
            return v;
        };
        const node = computed(() => { calls.set(id, (calls.get(id) || 0) + 1); return fn((x) => byId.get(x).node.value); }, id);
        comps.push(add({ id, kind: 'comp', node, fn }));
    }
    // Оракул: чистый пересчёт по peek() сигналов; ошибка computed — значение-маркер, которое распространяется на читателей (как throw в графе)
    const ERR = '<error>';
    const oracle = () => {
        const m = new Map();
        const read = (id) => {
            if (m.has(id)) { const v = m.get(id); if (v === ERR) throw ERR; return v; }
            const n = byId.get(id);
            let v;
            if (n.kind === 'sig') v = n.node.peek();
            else { try { v = n.fn(read); } catch (e) { v = ERR; } }
            m.set(id, v);
            if (v === ERR) throw ERR;
            return v;
        };
        for (const n of nodes) { try { read(n.id); } catch (e) { /* маркер уже в m */ } }
        return m;
    };
    let lastErr = null;
    const readNode = (n) => { try { return n.node.value; } catch (e) { lastErr = e; return '<error>'; } };
    const scope = createScope('fuzz');
    scope.onError(() => { errCount++; });
    let written = false;
    const mk = () => {
        const deps = [...new Set([0, 0, 0].slice(0, 1 + Math.floor(rnd() * 3)).map(() => pick(rnd, nodes).id))];
        const throws = poison != null && effs.length % 2 === 0;   // fault-режим: чётные эффекты не ловят ошибку computed — она идёт в scope.onError
        const e = { id: 'e' + effs.length, deps, last: null, alive: true, runsInFlush: 0, dispose: null, throws };
        scope.run(() => {
            e.dispose = effect(() => {
                e.runsInFlush++;
                const t = deps.map(d => throws ? byId.get(d).node.value : readNode(byId.get(d)));
                const o = oracle(), exp = deps.map(d => o.get(d));
                if (t.join() !== exp.join()) viol.push(`I1 ${e.id} saw [${t}] expected [${exp}]`);
                if (e.last && e.last.join() === t.join() && !written) viol.push(`I3 ${e.id} ran without any write`);
                if (e.runsInFlush > 1) viol.push(`I2 ${e.id} ran twice in one flush`);
                e.last = t;
            }, e.id);
        });
        effs.push(e);
        return e;
    };
    for (let i = 0; i < nEff; i++) mk();
    const checkGraph = () => {
        for (const n of nodes) if (n.node.subs) for (const o of n.node.subs) {
            if (o._disposed) viol.push(`I5 ${n.id}.subs keeps disposed ${o._name}`);
            else if (!(o._deps || []).includes(n.node) && o._src !== n.node) viol.push(`I5 ${n.id}.subs has ${o._name} without back-edge`);
        }
        const observers = [...comps.map(c => c.node), ...effs.filter(e => e.alive).map(e => e.dispose._node)];
        for (const x of observers) for (const src of x._deps || []) if (!src.subs || !src.subs.has(x)) viol.push(`I5 ${x._name} → ${src._name} missing in subs`);
    };
    const sigs = () => nodes.filter(n => n.kind === 'sig');
    const step = (log) => {
        const op = rnd();
        calls.clear();
        for (const e of effs) e.runsInFlush = 0;
        written = op < 0.6;
        const before = oracle();
        if (op < 0.4) { const sg = pick(rnd, sigs()); const v = Math.floor(rnd() * 6); log.push(`${sg.id}=${v}`); sg.node.value = v; }
        else if (op < 0.6) { log.push('batch'); batch(() => { for (let j = 0; j < 3; j++) pick(rnd, sigs()).node.value = Math.floor(rnd() * 6); }); }
        else if (op < 0.7) { const e = pick(rnd, effs); log.push('dispose ' + e.id); e.alive = false; e.dispose(); e.dispose(); }
        else if (op < 0.8) { log.push('new ' + mk().id); }
        else if (op < 0.9) { const c = pick(rnd, comps); log.push('read ' + c.id); const got = readNode(c); if (got !== oracle().get(c.id)) viol.push(`I1 outside read ${c.id}: ${got} vs ${oracle().get(c.id)}`); }
        else { log.push('flush'); flush(); }
        const after = oracle();
        for (const e of effs) {
            if (!e.alive || !e.last) continue;
            let bt = e.deps.map(d => before.get(d)), at = e.deps.map(d => after.get(d));
            if (e.throws) { const i = bt.indexOf(ERR); if (i >= 0) { bt = bt.slice(0, i + 1); at = at.slice(0, i + 1); } }   // бросающий эффект прервался на первой ошибке — подписан только на прочитанное
            const b = bt.join(), a = at.join();
            if (b !== a && e.runsInFlush !== 1 && op < 0.6) viol.push(`I2 ${e.id} tuple changed, runs=${e.runsInFlush}`);
        }
        for (const [id, n] of calls) if (n > 1) viol.push(`I4 ${id} computed ${n}×`);
        checkGraph();
    };
    const beginWrite = () => { calls.clear(); for (const e of effs) e.runsInFlush = 0; written = true; };   // перед внешней записью (восстановление после яда)
    return { step, beginWrite, viol, scope, nodes, effs, errors: () => errCount, lastErr: () => lastErr };
}

export function fuzzGraph(api, { seeds = 300, ops = 60, seed: only = 0, poison = null } = {}) {
    const fails = [];
    const first = only || 1, last = only || seeds;
    for (let seed = first; seed <= last; seed++) {
        const st0 = api.stats ? api.stats() : null;   // ядро без секции 3 — без канарейки утечек
        const g = genGraph(api, seed, { poison });
        const log = [];
        try {
            for (let k = 0; k < ops && !g.viol.length; k++) g.step(log);
        } catch (e) {
            g.viol.push('escaped exception: ' + (e && e.message));
        }
        if (poison != null && !g.viol.length) {
            // уход от яда: все сигналы в безопасные значения — каждый живой эффект обязан выздороветь и увидеть оракул
            g.beginWrite();
            try { api.batch(() => { let i = 1000; for (const n of g.nodes) if (n.kind === 'sig') n.node.value = (i += 1000); }); } catch (e) { g.viol.push('escaped exception on recovery: ' + (e && e.message)); }   // кратные 1000: суммы/разности/утроения не дают яд
            const o = (() => { const m = new Map(); const read = (id) => { if (m.has(id)) { const v = m.get(id); if (v === '<error>') throw v; return v; } const n = g.nodes.find(x => x.id === id); let v; if (n.kind === 'sig') v = n.node.peek(); else { try { v = n.fn(read); } catch (e) { v = '<error>'; } } m.set(id, v); if (v === '<error>') throw v; return v; }; for (const n of g.nodes) { try { read(n.id); } catch (e) { /* */ } } return m; })();
            for (const e of g.effs) if (e.alive && e.last && e.last.join() !== e.deps.map(d => o.get(d)).join()) g.viol.push(`stuck after poison: ${e.id} last [${e.last}] oracle [${e.deps.map(d => o.get(d))}]`);
            fails.poisoned = (fails.poisoned || 0) + (g.errors() > 0 ? 1 : 0);   // на скольких сидах яд реально встретился (ошибка дошла до onError)
        }
        g.scope.dispose();
        const st1 = st0 ? api.stats() : null;
        if (st1 && (st1.effects !== st0.effects || st1.scopes !== st0.scopes)) g.viol.push(`I7 leak after dispose: effects ${st0.effects}→${st1.effects}, scopes ${st0.scopes}→${st1.scopes}`);
        if (g.nodes.some(n => n.node.subs && [...n.node.subs].some(o => !o._disposed && !o._isComputed))) g.viol.push('I7 live effect subscription after dispose');
        if (st1 && st1.queued) g.viol.push('queue not drained: ' + st1.queued);
        if (g.viol.length) fails.push({ seed, log: log.join(' '), viol: g.viol[0], err: g.lastErr() ? String(g.lastErr().message).split(String.fromCharCode(10))[0] : null });
    }
    return fails;
}
