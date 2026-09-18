// Сборка дистрибутива: aegis.min.js (+ sourcemap) и aegis.core.js (реактивное ядро + scope).
// Пользователю сборка не нужна — это для публикации: node build.mjs
// Сборка под своё приложение (только нужные экспорты): node build.mjs --from path/to/app.js  |  --exports signal,effect,html
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

// Единственный источник — aegis.js (с 0.7.0; промежуточный aegis_full.js упразднён).
// Если он всё же появился в рабочей копии, сборка молча взяла бы его, а все тесты читают aegis.js — поэтому останавливаемся.
if (existsSync('aegis_full.js')) throw new Error('aegis_full.js больше не источник сборки: удалите его, единственный источник — aegis.js');
const src = 'aegis.js';
const text = readFileSync(src, 'utf8');
const lines = text.split('\n');
const kb = (buf) => (gzipSync(buf, { level: 9 }).length / 1024).toFixed(1) + ' KB gzip';

// ── Кастомная сборка под приложение: только нужные экспорты, tree-shaking через esbuild.
//   node build.mjs --exports signal,effect,html,mount --out dist/aegis.app.js
//   node build.mjs --from ../app/admin-aegis.js       (имена берутся из `import { … } from 'aegis'` / './aegis.js')
//   Флаги: --out <file> (default aegis.custom.js), --no-min (читаемый вывод), --map (sourcemap), --list (что вошло),
//          --dev (оставить тексты предупреждений what/why/fix; по умолчанию прод-сборка их вырезает: define AEGIS_PROD=true)
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--exports') || argv.includes('--from')) {
    let names = [];
    if (opt('--exports')) names = opt('--exports').split(/[,\s]+/).filter(Boolean);
    if (opt('--from')) {
        const app = readFileSync(opt('--from'), 'utf8');
        for (const m of app.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:aegis|[^'"]*aegis(?:\.js)?)['"]/g))
            names.push(...m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean));
    }
    names = [...new Set(names)];
    if (!names.length) throw new Error('--exports/--from: список имён пуст');
    const exported = new Set([...text.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/gm)].map(m => m[1]));
    for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(',')) { const a = n.trim().split(/\s+as\s+/); if (a[0]) exported.add(a[a.length - 1]); }
    const unknown = names.filter(n => !exported.has(n));
    if (unknown.length) throw new Error('нет таких экспортов в ' + src + ': ' + unknown.join(', '));
    const out = opt('--out') || 'aegis.custom.js';
    const minify = !argv.includes('--no-min');
    const define = { 'globalThis.AEGIS_PROD': argv.includes('--dev') ? 'false' : 'true' };
    await build({
        stdin: { contents: `export { ${names.join(', ')} } from './${src}';`, resolveDir: '.', sourcefile: 'aegis.custom.entry.js', loader: 'js' },
        outfile: out, bundle: true, minify, format: 'esm', target: ['es2022'], legalComments: 'none', define,
        sourcemap: argv.includes('--map'),
        banner: { js: `/*! Aegis — MIT — https://github.com/bauratynov/aegis — custom build: ${names.join(', ')} */` },
    });
    const built = readFileSync(out);
    console.log(`${src} → ${out}  ${(built.length / 1024).toFixed(1)} KB raw / ${kb(built)}  (${names.length} exports${minify ? ', min' : ''}${define['globalThis.AEGIS_PROD'] === 'true' ? ', prod: без dev-текстов' : ', dev'})`);
    if (argv.includes('--list')) {
        const r = await build({ stdin: { contents: `export { ${names.join(', ')} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minify: false, format: 'esm', target: ['es2022'], legalComments: 'none', define });
        const js = Buffer.from(r.outputFiles[0].contents).toString();
        const kept = [...js.matchAll(/^(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/gm)].map(m => m[1]);
        console.log('вошло top-level деклараций: ' + kept.length + '\n  ' + kept.join(', '));
    }
    process.exit(0);
}

// Ядро = секции 0–2 (dev, reactive core, scope) — до заголовка секции 3
const sec3 = lines.findIndex(l => l.startsWith('// 3. '));
if (sec3 < 0) throw new Error('section 3 header not found in ' + src);
const core = lines.slice(0, sec3 - 1).join('\n').replace(/\n+$/, '\n');
writeFileSync('aegis.core.js', core);

// ── Типы для ./core: те же значения, что экспортирует aegis.core.js, и все типы из aegis.d.ts.
//    Без этого подпуть отдавал полный aegis.d.ts и TS пропускал import { html } from 'aegis/core' — падало уже в браузере.
{
    const decl = [...core.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    const braced = [...core.matchAll(/^export\s*\{([^}]*)\}\s*;?\s*$/gm)]
        .flatMap(m => m[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop()).filter(Boolean));
    const names = [...new Set([...decl, ...braced])].sort();
    if (!names.length) throw new Error('aegis.core.js: не найдено ни одного экспорта');
    const pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
    writeFileSync('aegis.core.d.ts', `/**
 * Aegis core — signals, scope and context: the first sections of aegis.js, without the DOM engine.
 * Generated by build.mjs from aegis.core.js; the types themselves live in aegis.d.ts.
 *
 * @version ${pkgVersion}
 * @license MIT
 */

export type * from './aegis.js';
export {
${names.map(n => '    ' + n).join(',\n')}
} from './aegis.js';
`);
    console.log(`core   → aegis.core.d.ts   ${names.length} exports`);
}


await build({
    entryPoints: [src],
    outfile: 'aegis.min.js',
    bundle: false,
    minify: true,
    format: 'esm',
    target: ['es2022'],
    sourcemap: true,
    sourcesContent: false,   // в карте не нужен дубликат aegis.js — он лежит рядом и в пакете, и на CDN
    legalComments: 'none',
    banner: { js: '/*! Aegis — MIT — https://github.com/bauratynov/aegis */' },
});
await build({
    stdin: { contents: core, resolveDir: '.', sourcefile: 'aegis.core.js', loader: 'js' },
    outfile: 'aegis.core.min.js',
    bundle: false,
    minify: true,
    format: 'esm',
    target: ['es2022'],
    legalComments: 'none',
});

// Что стоит подмножество при сборке бандлером (tree-shaking по именованным импортам; sideEffects: false в package.json)
const SUBSETS = {
    'signals only': 'signal, computed, effect, batch, createScope',
    'islands + html`` + list': 'island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate',
    '+ resource / mutation / api': 'island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate, resource, mutation, api, settled',
    '+ forms': 'island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate, resource, mutation, api, settled, form, wireForm, required, minLen, emailRule',
    '+ router': 'island, mount, html, list, show, when, signal, computed, effect, on, bind, hydrate, resource, mutation, api, settled, form, wireForm, required, minLen, emailRule, router',
};
if (process.argv.includes('--subsets')) {
    for (const [name, list] of Object.entries(SUBSETS)) {
        const opts = { stdin: { contents: `export { ${list} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'none' };
        const r = await build(opts), p = await build({ ...opts, define: { 'globalThis.AEGIS_PROD': 'true' } });
        console.log(`subset ${name.padEnd(28)} ${kb(Buffer.from(r.outputFiles[0].contents))}   prod ${kb(Buffer.from(p.outputFiles[0].contents))}`);
    }
}


// ── SRI для zero-build/CDN: dist/importmap.json (imports + integrity), dist/importmap.html (snippet + modulepreload), dist/integrity.json
{
    const { createHash } = await import('node:crypto');
    const { mkdirSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const sri = (buf) => 'sha384-' + createHash('sha384').update(buf).digest('base64');
    const files = ['aegis.js', 'aegis.min.js', 'aegis.core.min.js', 'aegis-devtools.js', 'aegis-test.js'].filter(existsSync);
    const base = `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version}/`;
    const integrity = {};
    for (const f of files) integrity[base + f] = sri(readFileSync(f));
    const map = { imports: { aegis: base + 'aegis.min.js', 'aegis/core': base + 'aegis.core.min.js', 'aegis/test': base + 'aegis-test.js' }, integrity };
    mkdirSync('dist', { recursive: true });
    writeFileSync('dist/importmap.json', JSON.stringify(map, null, 2) + '\n');
    writeFileSync('dist/integrity.json', JSON.stringify(Object.fromEntries(files.map(f => [f, integrity[base + f]])), null, 2) + '\n');
    writeFileSync('dist/importmap.html', `<script type="importmap">${JSON.stringify(map)}</script>\n` + files.map(f => `<link rel="modulepreload" href="${base + f}" integrity="${integrity[base + f]}" crossorigin="anonymous">`).join('\n') + '\n');
    console.log(`dist/importmap.json — ${files.length} files with sha384 integrity (import maps: Chrome 127+ / Safari 18 / Firefox 138)`);

    // README пинит тот же CDN-релиз: версию в URL и sha384 для aegis.min.js держим здесь, а не руками
    const readme = readFileSync('README.md', 'utf8');
    const patched = readme
        .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@?[\w.\/-]+@[\d.]+\//g, base)
        .replace(/("(?:[^"]*)aegis\.min\.js":\s*")(?:sha384-[A-Za-z0-9+/=]+|SRI_MIN)(")/g, `$1${integrity[base + 'aegis.min.js']}$2`);
    if (patched !== readme) { writeFileSync('README.md', patched); console.log('README.md          — пины и sha384 обновлены'); }

    // Карта секций в CONTRIBUTING.md: номера строк живут в aegis.js, а не в памяти автора
    const sections = lines.map((l, i) => [l, i + 1]).filter(([l]) => /^\/\/ \d+\. /.test(l))
        .map(([l, n]) => `| \`${l.slice(3).trim()}\` | ${n} |`);
    if (sections.length) {
        const doc = readFileSync('CONTRIBUTING.md', 'utf8');
        const next = doc.replace(/(\| Section \| Line \|\n\|---\|---\|\n)(?:\|.*\n)+/, `$1${sections.join('\n')}\n`);
        if (next !== doc) { writeFileSync('CONTRIBUTING.md', next); console.log(`CONTRIBUTING.md    — карта секций (${sections.length})`); }
    }
}

console.log(`${src} → aegis.min.js      ${kb(readFileSync('aegis.min.js'))}`);
console.log(`core   → aegis.core.js     ${kb(core)}  (readable)`);
console.log(`core   → aegis.core.min.js ${kb(readFileSync('aegis.core.min.js'))}`);
