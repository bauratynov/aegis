// Сборка дистрибутива: aegis.min.js (+ sourcemap) и aegis.core.js (реактивное ядро + scope).
// Пользователю сборка не нужна — это для публикации: node build.mjs
// Сборка под своё приложение (только нужные экспорты): node build.mjs --from path/to/app.js  |  --exports signal,effect,html
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const src = existsSync('aegis_full.js') ? 'aegis_full.js' : 'aegis.js';
const text = readFileSync(src, 'utf8');
const lines = text.split('\n');
const kb = (buf) => (gzipSync(buf, { level: 9 }).length / 1024).toFixed(1) + ' KB gzip';

// ── Кастомная сборка под приложение: только нужные экспорты, tree-shaking через esbuild.
//   node build.mjs --exports signal,effect,html,mount --out dist/aegis.app.js
//   node build.mjs --from ../app/admin-aegis.js       (имена берутся из `import { … } from 'aegis'` / './aegis.js')
//   Флаги: --out <file> (default aegis.custom.js), --no-min (читаемый вывод), --map (sourcemap), --list (что вошло)
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
    await build({
        stdin: { contents: `export { ${names.join(', ')} } from './${src}';`, resolveDir: '.', sourcefile: 'aegis.custom.entry.js', loader: 'js' },
        outfile: out, bundle: true, minify, format: 'esm', target: ['es2022'], legalComments: 'none',
        sourcemap: argv.includes('--map'),
        banner: { js: `/*! Aegis — MIT — https://github.com/atynov/aegis — custom build: ${names.join(', ')} */` },
    });
    const built = readFileSync(out);
    console.log(`${src} → ${out}  ${(built.length / 1024).toFixed(1)} KB raw / ${kb(built)}  (${names.length} exports${minify ? ', min' : ''})`);
    if (argv.includes('--list')) {
        const r = await build({ stdin: { contents: `export { ${names.join(', ')} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minify: false, format: 'esm', target: ['es2022'], legalComments: 'none' });
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


await build({
    entryPoints: [src],
    outfile: 'aegis.min.js',
    bundle: false,
    minify: true,
    format: 'esm',
    target: ['es2022'],
    sourcemap: true,
    legalComments: 'none',
    banner: { js: '/*! Aegis — MIT — https://github.com/atynov/aegis */' },
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
        const r = await build({ stdin: { contents: `export { ${list} } from './${src}';`, resolveDir: '.', loader: 'js' }, write: false, bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'none' });
        console.log(`subset ${name.padEnd(28)} ${kb(Buffer.from(r.outputFiles[0].contents))}`);
    }
}

console.log(`${src} → aegis.min.js      ${kb(readFileSync('aegis.min.js'))}`);
console.log(`core   → aegis.core.js     ${kb(core)}  (readable)`);
console.log(`core   → aegis.core.min.js ${kb(readFileSync('aegis.core.min.js'))}`);
