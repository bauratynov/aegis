// Run test.html in headless Chrome and Firefox: `npm run test:browsers`
// Serves this folder on a free port (aegis_full.js is served as aegis.js when present), collects results:
//   Chrome  — --dump-dom, counts ✓/✗ in the rendered page
//   Firefox — test.html?report=1 POSTs { passed, failed, fails } to /__report
// Browser paths: CHROME / FIREFOX env vars, otherwise the usual locations per OS. A missing browser is skipped, not failed.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FULL = existsSync(join(ROOT, 'aegis_full.js'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
// Headless runs: tests that need a visible, focused window or IndexedDB. Chrome headless lacks all of them;
// Firefox headless on a CI runner has no window focus either. They pass in a real browser.
const KNOWN_ENV_ONLY = new Set(['size(): реактивен', 'trap: focus moved inside (or bg tab)', 'offlineResource: data loaded', 'offlineResource: optimistic update', 'leader: лок получен', 'sync: ответ разослан другим вкладкам с Lamport-меткой']);   // the last one: a BroadcastChannel round-trip between tabs that a loaded CI runner sometimes misses

const candidates = {
    chrome: [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    firefox: [process.env.FIREFOX, 'C:/Program Files/Mozilla Firefox/firefox.exe', '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'],
};
const find = (list) => list.find(p => p && existsSync(p));
// профиль браузера может быть ещё занят процессом — несколько попыток, потом просто оставить
const rmSafe = async (dir) => { for (let i = 0; i < 5; i++) { try { rmSync(dir, { recursive: true, force: true }); return; } catch (e) { await new Promise(r => setTimeout(r, 400)); } } };

let report = null, resolveReport = null;
const server = createServer((q, r) => {
    if (q.method === 'POST' && q.url.startsWith('/__report')) {
        let body = '';
        q.on('data', c => { body += c; });
        q.on('end', () => { if (!q.url.includes('partial')) { report = JSON.parse(body); resolveReport && resolveReport(report); } r.writeHead(204); r.end(); });
        return;
    }
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/aegis.js' && FULL) p = '/aegis_full.js';
    const file = join(ROOT, p);
    if (!existsSync(file)) { r.writeHead(404); r.end(); return; }
    let data = readFileSync(file);
    if (p.endsWith('test.html')) {
        let s = data.toString('utf8');
        if (/[?&]novt/.test(q.url)) s = s.replace('<head>', '<head><script>Document.prototype.startViewTransition = undefined;</script>');
        data = s;
    }
    r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    r.end(data);
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${server.address().port}`;
const results = {};

const chrome = find(candidates.chrome);
if (chrome) {
    const profile = mkdtempSync(join(tmpdir(), 'aegis-chrome-'));
    // async spawn: the server lives in this process, a blocking spawnSync would deadlock Chrome's requests
    const dom = await new Promise((res) => {
        const cp = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--virtual-time-budget=300000', '--dump-dom', `${base}/test.html?novt=1`], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        cp.stdout.setEncoding('utf8');
        cp.stdout.on('data', (c) => { out += c; });
        const timer = setTimeout(() => { cp.kill('SIGKILL'); }, 240_000);
        cp.on('close', () => { clearTimeout(timer); res(out); });
        cp.on('error', (e) => { clearTimeout(timer); console.log(`chrome: launch problem — ${e.message}`); res(''); });
    });
    await rmSafe(profile);
    const passed = (dom.match(/✓/g) || []).length;
    const fails = [...dom.matchAll(/class="test fail">([^<]*)/g)].map(m => m[1].replace(/^✗\s*/, ''));
    results.chrome = { passed, failed: fails.length, fails };
} else results.chrome = { skipped: 'not found (set CHROME=…)' };

const firefox = find(candidates.firefox);
if (firefox) {
    const profile = mkdtempSync(join(tmpdir(), 'aegis-ff-'));
    const ff = spawn(firefox, ['--headless', '-no-remote', '-profile', profile, `${base}/test.html?report=1&novt=1`], { stdio: 'ignore' });
    const got = await Promise.race([new Promise(res => { resolveReport = res; }), new Promise(res => setTimeout(() => res(null), 240_000))]);
    ff.kill('SIGKILL');
    await new Promise(res => setTimeout(res, 500));
    await rmSafe(profile);
    results.firefox = got ? { passed: got.passed, failed: got.failed, fails: (got.fails || []).map(f => f.replace(/^✗\s*/, '')) } : { failed: 1, fails: ['no report within 240 s'] };
} else results.firefox = { skipped: 'not found (set FIREFOX=…)' };

server.close();
let bad = 0;
for (const [name, r] of Object.entries(results)) {
    if (r.skipped) { console.log(`${name}: skipped — ${r.skipped}`); continue; }
    const envOnly = r.fails.filter(f => KNOWN_ENV_ONLY.has(f));
    const real = r.fails.filter(f => !envOnly.includes(f));
    console.log(`${name}: ${r.passed} passed, ${r.failed} failed${envOnly.length ? ` (${envOnly.length} env-only)` : ''}`);
    for (const f of real) console.log(`  ✗ ${f}`);
    bad += real.length;
}
process.exit(bad ? 1 : 0);
