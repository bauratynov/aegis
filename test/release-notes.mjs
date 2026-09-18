// Раздел CHANGELOG для текущей версии — тело GitHub Release: node test/release-notes.mjs > notes.md
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;
const md = read('CHANGELOG.md');

const start = md.indexOf(`## [${version}] — `);
if (start < 0) { console.error(`release-notes: в CHANGELOG.md нет раздела [${version}]`); process.exit(1); }
const body = md.slice(md.indexOf('\n', start) + 1);
const end = body.indexOf('\n## [');

process.stdout.write((end < 0 ? body : body.slice(0, end)).trim() + '\n');
