// Сверка экспортов рантайма и aegis.d.ts — ловит забытый экспорт в любую сторону (npm test).
import { readFileSync, existsSync } from 'node:fs';

const src = readFileSync(new URL('../aegis.js', import.meta.url), 'utf8');
const dts = readFileSync(new URL('../aegis.d.ts', import.meta.url), 'utf8');

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

// ── ./core — отдельный подпуть со своим срезом экспортов: aegis.core.js ↔ aegis.core.d.ts.
//    Раньше он отдавал полный aegis.d.ts, и `import { html } from 'aegis/core'` проходил tsc, а падал в браузере.
const coreSrc = readFileSync(new URL('../aegis.core.js', import.meta.url), 'utf8');
const coreDts = readFileSync(new URL('../aegis.core.d.ts', import.meta.url), 'utf8');

const coreRuntime = new Set([...coreSrc.matchAll(/^export (?:async )?(?:function\*? |const |let |class )(\w+)/gm)].map(m => m[1]));
for (const block of coreSrc.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const name of block[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) coreRuntime.add(name);
}
const coreTypes = new Set();
for (const block of coreDts.matchAll(/^export \{([^}]*)\} from/gms)) {
    for (const name of block[1].split(',').map(s => s.trim()).filter(Boolean)) coreTypes.add(name);
}

const coreRuntimeOnly = [...coreRuntime].filter(n => !coreTypes.has(n));
const coreTypesOnly = [...coreTypes].filter(n => !coreRuntime.has(n));
const coreNotInFull = [...coreRuntime].filter(n => !runtime.has(n));
if (coreRuntimeOnly.length || coreTypesOnly.length || coreNotInFull.length) {
    if (coreRuntimeOnly.length) console.error('exported by aegis.core.js, missing in aegis.core.d.ts:', coreRuntimeOnly.join(', '));
    if (coreTypesOnly.length) console.error('declared in aegis.core.d.ts, missing in aegis.core.js:', coreTypesOnly.join(', '));
    if (coreNotInFull.length) console.error('exported by aegis.core.js, missing in aegis.js:', coreNotInFull.join(', '));
    process.exit(1);
}

// default: он есть в aegis.d.ts и в aegis.js, но его не должно быть у ./core — там объекта Aegis нет
const fullHasDefault = /^export default /m.test(src), dtsHasDefault = /^export default /m.test(dts);
if (fullHasDefault !== dtsHasDefault) {
    console.error(`export default: aegis.js ${fullHasDefault ? 'есть' : 'нет'}, aegis.d.ts ${dtsHasDefault ? 'есть' : 'нет'}`);
    process.exit(1);
}
if (/^export default /m.test(coreDts)) {
    console.error('aegis.core.d.ts объявляет export default, которого в aegis.core.js нет');
    process.exit(1);
}

// ── ./devtools и ./test — подпути с собственными .d.ts
for (const [js, dtsFile] of [['../aegis-devtools.js', '../aegis-devtools.d.ts'], ['../aegis-test.js', '../aegis-test.d.ts']]) {
    const code = readFileSync(new URL(js, import.meta.url), 'utf8');
    const decl = readFileSync(new URL(dtsFile, import.meta.url), 'utf8');
    const names = new Set([...code.matchAll(/^export (?:async )?(?:function\*? |const |let |class )(\w+)/gm)].map(m => m[1]));
    const declared = new Set([...decl.matchAll(/^export (?:declare )?(?:function |const |let |class )(\w+)/gm)].map(m => m[1]));
    const missing = [...names].filter(n => !declared.has(n)), extra = [...declared].filter(n => !names.has(n));
    if (missing.length || extra.length) {
        if (missing.length) console.error(`exported by ${js.slice(3)}, missing in ${dtsFile.slice(3)}:`, missing.join(', '));
        if (extra.length) console.error(`declared in ${dtsFile.slice(3)}, missing in ${js.slice(3)}:`, extra.join(', '));
        process.exit(1);
    }
}

console.log(`exports ok: ${runtime.size} names match aegis.d.ts, ${coreRuntime.size} in ./core, devtools and test declared`);
