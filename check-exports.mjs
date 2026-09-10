// Сверка экспортов рантайма и aegis.d.ts — ловит забытый экспорт в любую сторону (npm test).
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync(new URL(existsSync(new URL('./aegis_full.js', import.meta.url)) ? './aegis_full.js' : './aegis.js', import.meta.url), 'utf8');
const dts = readFileSync(new URL('./aegis.d.ts', import.meta.url), 'utf8');

const runtime = new Set([...src.matchAll(/^export (?:async )?(?:function\*? |const |let |class )(\w+)/gm)].map(m => m[1]));
for (const block of src.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const name of block[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) runtime.add(name);
}
const types = new Set([...dts.matchAll(/^export (?:declare )?(?:function |const |let |class )(\w+)/gm)].map(m => m[1]));

const runtimeOnly = [...runtime].filter(n => !types.has(n));
const typesOnly = [...types].filter(n => !runtime.has(n));
if (runtimeOnly.length || typesOnly.length) {
    if (runtimeOnly.length) console.error('exported by runtime, missing in aegis.d.ts:', runtimeOnly.join(', '));
    if (typesOnly.length) console.error('declared in aegis.d.ts, missing in runtime:', typesOnly.join(', '));
    process.exit(1);
}
console.log(`exports ok: ${runtime.size} names match aegis.d.ts`);
