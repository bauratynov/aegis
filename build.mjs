// Сборка дистрибутива: aegis.min.js (+ sourcemap) и aegis.core.js (реактивное ядро + scope).
// Пользователю сборка не нужна — это для публикации: node build.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const src = existsSync('aegis_full.js') ? 'aegis_full.js' : 'aegis.js';
const text = readFileSync(src, 'utf8');
const lines = text.split('\n');

// Ядро = секции 0–2 (dev, reactive core, scope) — до заголовка секции 3
const sec3 = lines.findIndex(l => l.startsWith('// 3. '));
if (sec3 < 0) throw new Error('section 3 header not found in ' + src);
const core = lines.slice(0, sec3 - 1).join('\n').replace(/\n+$/, '\n');
writeFileSync('aegis.core.js', core);

const kb = (buf) => (gzipSync(buf, { level: 9 }).length / 1024).toFixed(1) + ' KB gzip';

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

console.log(`${src} → aegis.min.js      ${kb(readFileSync('aegis.min.js'))}`);
console.log(`core   → aegis.core.js     ${kb(core)}  (readable)`);
console.log(`core   → aegis.core.min.js ${kb(readFileSync('aegis.core.min.js'))}`);
