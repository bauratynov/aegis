// Run test.html in Playwright WebKit (Safari's engine): `npm run test:webkit`
// Needs playwright once: `npx playwright install --with-deps webkit` (CI does it; locally it is optional — no playwright, no run, exit 0).
// Same protocol as Firefox in test-browsers.mjs: test.html?report=1 POSTs { passed, failed, fails } to /__report.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
// no visible, focused window in a headless CI run: same list as test-browsers.mjs
const KNOWN_ENV_ONLY = new Set(['size(): реактивен', 'trap: focus moved inside (or bg tab)', 'offlineResource: data loaded', 'offlineResource: optimistic update', 'leader: лок получен']);

let pw;
try { pw = await import('playwright'); } catch (e) { console.log('webkit: skipped — playwright is not installed (npx playwright install --with-deps webkit)'); process.exit(0); }

let resolveReport = null;
const server = createServer((q, r) => {
    if (q.method === 'POST' && q.url.startsWith('/__report')) {
        let body = ''; q.on('data', c => { body += c; });
        q.on('end', () => { if (!q.url.includes('partial') && resolveReport) resolveReport(JSON.parse(body)); r.writeHead(204); r.end(); });
        return;
    }
    const p = decodeURIComponent(q.url.split('?')[0]);
    const file = join(ROOT, p);
    if (!existsSync(file)) { r.writeHead(404); r.end(); return; }
    let data = readFileSync(file);
    if (p.endsWith('test.html') && /[?&]novt/.test(q.url)) data = data.toString('utf8').replace('<head>', '<head><script>Document.prototype.startViewTransition = undefined;</script>');
    r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    r.end(data);
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await pw.webkit.launch();
const page = await browser.newPage();
const got = await Promise.race([
    new Promise(res => { resolveReport = res; page.goto(`${base}/test.html?report=1&novt=1`).catch(() => {}); }),
    new Promise(res => setTimeout(() => res(null), 240_000)),
]);
await browser.close();
server.close();
if (!got) { console.log('webkit: no report within 240 s'); process.exit(1); }
const fails = (got.fails || []).map(f => f.replace(/^\u2717\s*/, ''));
const envOnly = fails.filter(f => KNOWN_ENV_ONLY.has(f));
const real = fails.filter(f => !envOnly.includes(f));
console.log(`webkit: ${got.passed} passed, ${got.failed} failed${envOnly.length ? ` (${envOnly.length} env-only)` : ''}`);
for (const f of real) console.log(`  \u2717 ${f}`);
process.exit(real.length ? 1 : 0);
