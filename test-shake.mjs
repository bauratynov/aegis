// Tree-shaking guard: лёгкие подмножества не должны тянуть кэш, таблицу сообщений форм, IndexedDB и т.д.
// Запуск: node test-shake.mjs (входит в npm test). Бандлит через esbuild в памяти, ~1 с.
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const src = existsSync('aegis_full.js') ? 'aegis_full.js' : 'aegis.js';
const full = src === 'aegis_full.js';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

async function bundle(names, prod = false) {
    const define = prod ? { 'globalThis.AEGIS_PROD': 'true' } : {};
    // читаемый вариант с minifySyntax: define сворачивается, имена остаются — по нему считаем декларации
    const r = await build({ stdin: { contents: `export { ${names} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minifySyntax: prod, format: 'esm', target: ['es2022'], legalComments: 'none', define });
    const js = Buffer.from(r.outputFiles[0].contents).toString();
    const min = await build({ stdin: { contents: `export { ${names} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'none', define });
    const minJs = Buffer.from(min.outputFiles[0].contents).toString();
    const decls = new Set([...js.matchAll(/^(?:async\s+)?(?:function\*?|class|var|const|let)\s+([\w$]+)/gm)].map(m => m[1]));
    return { js, minJs, decls, gz: gzipSync(Buffer.from(minJs), { level: 9 }).length / 1024 };
}
const has = (b, ...names) => names.filter(n => b.decls.has(n));

// 1. только сигналы: ни DOM-движка, ни кэша, ни сообщений
{
    const b = await bundle('signal, computed, effect, batch, createScope');
    ok('signals only: нет кэша / форм / IDB / DOM-движка', has(b, '_cacheEntry', '_MESSAGES', '_idb', '_parseTemplate', 'request', 'announce', '_runTransition').length === 0, has(b, '_cacheEntry', '_MESSAGES', '_idb', '_parseTemplate', 'request', 'announce', '_runTransition').join(','));
    ok('signals only: ≤ 11.5 KB gzip (фаза A: Кан-порядок, heap-планировщик, контракты в dev)', b.gz <= 11.5, b.gz.toFixed(1) + ' KB');
}
// 2. DOM-подмножество админки (15 экспортов): кэш, IDB, формы, роутер не входят
if (full) {
    const b = await bundle('signal, effect, computed, component, mount, html, text, attr, cls, show, list, bind, on, debounced, batch');
    const bad = has(b, '_cacheEntry', '_fetchEntry', '_idb', '_offlineStore', '_MESSAGES', '_makeValidator', 'wireForm', 'router', '_ghostAdd', '_persistWrite', 'seedFrom', 'prefetch', '_netBudget');
    ok('admin 15 exports: нет кэша / IDB / форм / роутера', bad.length === 0, bad.join(','));
    ok('admin 15 exports: без when() нет и announce / a11y-строк', !b.decls.has('_MSG_A11Y') && !b.decls.has('announce') && !b.decls.has('_fmsg'));
    ok('admin 15 exports: request-слой не тянется через ctx.fetch / defaults.fetcher', has(b, 'request', 'HttpError', 'guardedFetch', 'withRetry').length === 0, has(b, 'request', 'HttpError', 'guardedFetch', 'withRetry').join(','));
    ok('admin 15 exports: транзишены и reducedMotion не тянутся без transition()', has(b, '_runTransition', 'reducedMotion', 'media').length === 0);
    ok('admin 15 exports: ≤ 30 KB gzip (dev)', b.gz <= 30, b.gz.toFixed(1) + ' KB');
    const w = await bundle('signal, component, when');
    ok('+ when: a11y-строки и announce подключаются, таблица форм — нет', w.decls.has('_MSG_A11Y') && w.decls.has('announce') && !w.decls.has('_fmsg'));
    // привязанная регистрация (@__PURE__ _reg): попадает в бандл только вместе со своей функцией
    const t = await bundle('signal, component, transition');
    ok('+ transition: раннер зарегистрирован для show/list', t.decls.has('_runTransition') && /_reg\("runTransition"|_reg\('runTransition'/.test(t.js));
    const a = await bundle('signal, component, api');
    ok('+ api: request и guardedFetch зарегистрированы для ctx.fetch', a.decls.has('guardedFetch') && /_reg\(\s*["']guardedFetch["']/.test(a.js));
    ok('component без api: регистрация guardedFetch выкинута', !/["']guardedFetch["']\s*,\s*guardedFetch/.test(b.js));
}
// 2b. прод-сборка: define globalThis.AEGIS_PROD=true вырезает dev-тексты и dev-ветки
if (full) {
    const p = await bundle('signal, effect, computed, component, mount, html, text, attr, cls, show, list, bind, on, debounced, batch', true);
    ok('prod admin: ни одного what/why/fix', !/\b(?:what|why|fix):\s*["'`]/.test(p.minJs), String((p.minJs.match(/\bwhat:/g) || []).length));
    ok('prod admin: dev-инспекторы выкинуты (_lev, _nearest, _snippet, _zombieCheck, _inspectScope)', has(p, '_lev', '_nearest', '_snippet', '_zombieCheck', '_inspectScope').length === 0, has(p, '_lev', '_nearest', '_snippet', '_zombieCheck', '_inspectScope').join(','));
    ok('prod admin: ≤ 18.5 KB gzip (фаза B1: committers, программа обхода, fusion)', p.gz <= 18.5, p.gz.toFixed(1) + ' KB');
    const ps = await bundle('signal, computed, effect, batch, createScope', true);
    ok('prod signals only: ≤ 6.5 KB gzip (долг фазы K: бюджеты секций)', ps.gz <= 6.5, ps.gz.toFixed(1) + ' KB');
    const pi = await bundle('island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate', true);
    ok('prod islands: ≤ 25 KB gzip', pi.gz <= 25, pi.gz.toFixed(1) + ' KB');
    // прод-бандл работает: сигналы/эффекты живут, предупреждения молчат
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'aegis-prod-'));
    const file = join(dir, 'aegis.prod.mjs');
    writeFileSync(file, ps.minJs);
    const m = await import('file://' + file.replace(/\\/g, '/'));
    const s = m.signal(1), c = m.computed(() => s.value * 2); let seen = 0;
    m.effect(() => { void c.value; seen++; });
    s.value = 5;
    ok('prod signals: бандл импортируется и работает', c.value === 10 && seen === 2, `c=${c.value} runs=${seen}`);
}
// 3. islands + hydrate: кэш подключается только вместе с resource
if (full) {
    const a = await bundle('island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate');
    const bad = has(a, '_cacheEntry', '_fetchEntry', '_idb', '_MESSAGES', 'router');
    ok('islands + hydrate: кэш не тянется без resource', bad.length === 0, bad.join(','));
    ok('islands + hydrate: ≤ 36 KB gzip', a.gz <= 36, a.gz.toFixed(1) + ' KB');
    const c = await bundle('island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate, resource');
    ok('+ resource: кэш, seedFrom и prefetch подключены (регистрация через _ext)', has(c, '_cacheEntry', 'seedFrom', 'prefetch', '_cacheReady').length === 4);
    ok('+ resource: таблица сообщений форм всё ещё не нужна', !c.decls.has('_MESSAGES'));
    const f = await bundle('form, required, minLen');
    ok('form: таблица сообщений подключается через _fmsg', f.decls.has('_MESSAGES') && f.decls.has('_fmsg') && f.decls.has('_msg'));
}
// 4. в исходнике нет верхнеуровневых side-effect-инструкций, которые бандлер обязан сохранить (кроме известных)
if (full) {
    const { readFileSync } = await import('node:fs');
    const lines = readFileSync(src, 'utf8').split('\n');
    // разрешено: декларации, комментарии, prototype-маркеры классов ядра (они в любом бандле), CSS внутри шаблонной строки секции 21
    const allowed = /^(?:export |import |async function|function|class|const|let|var|\/\/|\/\*| \*|\*\/|\}|\{|\)|\]|$)|^(?:Signal|Computed|Effect|Subscriber|Scope)\.prototype|^if \(typeof Symbol\.dispose|^(?:@layer|\[data-|\.aegis-)/;
    let inBuild = false;   // тело _buildArrayInstr() не имеет отступа — это не top-level
    const stray = lines.map((l, i) => [l, i + 1]).filter(([l]) => {
        if (l.startsWith('function _buildArrayInstr()')) inBuild = true;
        if (inBuild) { if (l.startsWith('return _ARR_INSTR')) inBuild = 'end'; else if (inBuild === 'end' && l === '}') inBuild = false; return false; }
        return l && !/^\s/.test(l) && !allowed.test(l);
    });
    ok('нет неожиданных top-level инструкций (они не выкидываются бандлером)', stray.length === 0, stray.slice(0, 5).map(([l, n]) => n + ': ' + l.slice(0, 60)).join(' | '));
}

console.log(fails ? `\n${fails} FAILED` : '\nall shake checks passed');
process.exit(fails ? 1 : 0);
