// Синтетический бенчмарк предиктора переходов: `npm run test:prefetch` (node, без зависимостей, детерминированный LCG, < 1 с).
// Сайт из R маршрутов с L ссылками на странице; у каждого маршрута 2–3 «сильных» перехода, у пользователя — личная примесь.
// Метрика: top-1 точность предсказания следующей страницы среди кандидатов (ссылок текущей страницы) по сессиям.
// Регрессионные пороги: markov ≥ uniform + 8 п.п.; серверный prior на холодном старте (сессия 1) ≥ 30 %; рост между сессиями 1 и 3.
import { existsSync } from 'node:fs';

const mod = await import('../aegis.js');
if (typeof mod.predictor !== 'function') { console.log('test-prefetch-sim: predictor() не найден (ядро без секции кэша) — пропуск'); process.exit(0); }
const { predictor } = mod;

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? +process.argv[i + 1] : def; };
const R = arg('routes', 12), L = arg('links', 6), USERS = arg('users', 300), SESSIONS = arg('sessions', 6), STEPS = 8, SEED = arg('seed', 7);

const rng = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const rnd = rng(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const sample = (weights) => { let t = 0; for (const w of weights) t += w; let x = rnd() * t; for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; } return weights.length - 1; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Сайт: ссылки страницы и «истинное» распределение переходов (разреженное: 2–3 сильных + шум)
const key = (i) => '/r' + i;
const links = [], site = [];
for (let r = 0; r < R; r++) {
    const others = shuffle([...Array(R).keys()].filter(x => x !== r)).slice(0, L);
    links.push(others);
    const strong = shuffle(others.slice()).slice(0, 2 + Math.floor(rnd() * 2));
    const w = new Map(others.map(o => [o, 0.01]));
    const parts = strong.length === 2 ? [0.6, 0.4] : [0.5, 0.3, 0.2];
    strong.forEach((o, i) => w.set(o, parts[i]));
    site.push(w);
}
const personalRow = (r) => { const w = new Map(links[r].map(o => [o, 0.02])); const fav = shuffle(links[r].slice()).slice(0, 2); w.set(fav[0], 0.7); w.set(fav[1], 0.3); return w; };
const serverPrior = (r) => { const m = {}; let t = 0; for (const w of site[r].values()) t += w; for (const [o, w] of site[r]) m[key(o)] = w / t; return m; };

const acc = { uniform: [], popularity: [], markov: [], prior: [] };
for (let s = 0; s < SESSIONS; s++) for (const k in acc) acc[k].push({ hit: 0, n: 0 });
const pop = new Map();   // глобальная популярность страниц (baseline)

for (let u = 0; u < USERS; u++) {
    const mix = 0.3 + rnd() * 0.4;
    const personal = [...Array(R).keys()].map(personalRow);
    const markov = predictor({ storage: null });
    const withPrior = predictor({ storage: null, kappa: 5 });
    for (let r = 0; r < R; r++) withPrior.prior(key(r), serverPrior(r));
    for (let s = 0; s < SESSIONS; s++) {
        let cur = Math.floor(rnd() * R);
        for (let step = 0; step < STEPS; step++) {
            const cands = shuffle(links[cur].slice());
            const truth = cands.map(c => (1 - mix) * site[cur].get(c) + mix * personal[cur].get(c));
            const next = cands[sample(truth)];
            const ckeys = cands.map(key);
            const score = (name, guess) => { const a = acc[name][s]; a.n++; if (guess === key(next)) a.hit++; };
            score('uniform', pick(ckeys));
            score('popularity', ckeys.slice().sort((a, b) => (pop.get(b) || 0) - (pop.get(a) || 0))[0]);
            score('markov', markov.next(key(cur), ckeys)[0].key);
            score('prior', withPrior.next(key(cur), ckeys)[0].key);
            markov.learn(key(cur), key(next));
            withPrior.learn(key(cur), key(next));
            pop.set(key(next), (pop.get(key(next)) || 0) + 1);
            cur = next;
        }
    }
}

const pct = (a) => a.hit / a.n;
const total = (name) => { let h = 0, n = 0; for (const a of acc[name]) { h += a.hit; n += a.n; } return h / n; };
const fmt = (x) => (100 * x).toFixed(1).padStart(5) + '%';
console.log(`routes=${R} links/page=${L} users=${USERS} sessions=${SESSIONS} steps=${STEPS} seed=${SEED}`);
console.log('model        top-1 | ' + [...Array(SESSIONS).keys()].map(i => ('s' + (i + 1)).padStart(6)).join(''));
for (const name of Object.keys(acc)) console.log(name.padEnd(12) + fmt(total(name)) + ' | ' + acc[name].map(a => fmt(pct(a)).padStart(6)).join(''));

let fail = 0;
const check = (cond, msg) => { if (!cond) { fail++; console.error('FAIL ' + msg); } else console.log('ok   ' + msg); };
check(total('markov') >= total('uniform') + 0.08, `markov top-1 ≥ uniform + 8 п.п. (${fmt(total('markov'))} vs ${fmt(total('uniform'))})`);
check(pct(acc.prior[0]) >= 0.30, `серверный prior на холодном старте ≥ 30 % (${fmt(pct(acc.prior[0]))})`);
check(pct(acc.markov[2]) > pct(acc.markov[0]), `markov учится: сессия 3 > сессия 1 (${fmt(pct(acc.markov[2]))} > ${fmt(pct(acc.markov[0]))})`);
check(total('prior') >= total('markov'), `prior не хуже чистого markov (${fmt(total('prior'))} ≥ ${fmt(total('markov'))})`);
process.exit(fail ? 1 : 0);
