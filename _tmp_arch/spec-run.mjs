import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
const ROOT = 'C:/1/aegis';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/aegis.js') p = '/aegis_full.js';
    if (p === '/spec-bench.html') p = '/_tmp_arch/spec-bench.html';
    const file = join(ROOT, p);
    if (!existsSync(file)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    r.end(readFileSync(file));
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'aegis-spec-'));
const dom = await new Promise((res) => {
    const cp = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--virtual-time-budget=60000', '--dump-dom', `${base}/spec-bench.html`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let o = ''; cp.stdout.setEncoding('utf8'); cp.stdout.on('data', c => { o += c; }); cp.on('close', () => res(o));
    setTimeout(() => cp.kill('SIGKILL'), 120000);
});
const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
console.log(m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : dom.slice(0, 2000));
server.close();
