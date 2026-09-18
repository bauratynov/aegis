// Когерентность версии: aegis.js — единственный источник, всё остальное обязано совпасть.
// Входит в npm test. Проверка тега включается сама, когда переменная есть (GITHUB_REF_NAME в CI, RELEASE_TAG вручную).
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fail = (msg) => { console.error('release: ' + msg); process.exitCode = 1; };

const src = read('aegis.js');
const version = (src.match(/^export const VERSION = '([^']+)';$/m) || [])[1];
if (!version) { console.error('release: в aegis.js не найден export const VERSION'); process.exit(1); }

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== version) fail(`package.json ${pkg.version} ≠ VERSION ${version}`);

for (const file of ['aegis.js', 'aegis.d.ts', 'aegis.core.js', 'aegis.core.d.ts']) {
    const at = (read(file).match(/^ \* @version (.+)$/m) || [])[1];
    if (at !== version) fail(`${file}: @version ${at} ≠ ${version}`);
}

// Собранные файлы: версия внутри — самый дешёвый признак того, что сборку не забыли
if (!read('aegis.min.js').includes(version)) fail(`aegis.min.js собран не из текущего aegis.js (нет ${version})`);

// CHANGELOG: раздел выпускаемой версии существует и датирован
const changelog = read('CHANGELOG.md');
const section = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}$`, 'm');
if (!section.test(changelog)) fail(`CHANGELOG.md: нет раздела "## [${version}] — YYYY-MM-DD"`);

// README пинит ту же версию (пины пишет build.mjs, здесь — страховка от ручной правки)
const readme = read('README.md');
const pins = [...readme.matchAll(/cdn\.jsdelivr\.net\/npm\/@?[\w./-]+@([\d.]+)\//g)].map(m => m[1]);
const stale = [...new Set(pins)].filter(v => v !== version);
if (stale.length) fail(`README.md пинит ${stale.join(', ')} вместо ${version}`);

// Тег: только когда он есть в окружении
const tag = process.env.RELEASE_TAG || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '');
if (tag && tag !== 'v' + version) fail(`тег ${tag} ≠ v${version}`);

if (!process.exitCode) console.log(`release ok: ${version}${tag ? ` (тег ${tag})` : ''} — package.json, заголовки, aegis.min.js, CHANGELOG и пины README сходятся`);
