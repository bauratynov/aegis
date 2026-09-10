// Shared frame runner for the playground and the example pages: builds a sandboxed srcdoc with the engine importmap, the
// console bridge, the shared stage stylesheet and the mock server, then relays console lines, errors and server requests.
const ORIGIN = location.origin;
const V = (new URL(import.meta.url).searchParams.get('v') || '');
const vq = V ? '?v=' + V : '';
const HEAD_FIXED = 14;   // lines before <body> in the srcdoc (error line numbers are shifted back by this + the html lines)

export function createRunner({ frame, consoleEl, requestsEl = null, statusEl = null, onError = null, onReady = null }) {
    let current = null;
    const line = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text; consoleEl.appendChild(el); consoleEl.scrollTop = consoleEl.scrollHeight; };
    const run = (files, { mock = true } = {}) => {
        consoleEl.textContent = ''; if (requestsEl) requestsEl.textContent = '';
        if (statusEl) statusEl.textContent = 'Running…';
        const htmlLines = (files.html || '').split('\n').length;
        current = { headLines: HEAD_FIXED + htmlLines };
        frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script type="importmap">${JSON.stringify({ imports: { aegis: ORIGIN + '/aegis.js' } })}<\/script>
<script>
window.__AEGIS_DEV__ = true;
const fmt = (a) => { try { if (a instanceof Error) return a.stack || a.message; if (a instanceof Node) return a.outerHTML || String(a); if (a && typeof a === 'object' && 'peek' in a && 'value' in a) return 'Signal(' + JSON.stringify(a.peek()) + ')'; return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); } };
const send = (level, args, line) => parent.postMessage({ pg: level, text: args.map(fmt).join(' '), line }, '*');
for (const l of ['log', 'warn', 'error', 'info', 'debug']) { const o = console[l].bind(console); console[l] = (...a) => { o(...a); send(l === 'debug' ? 'log' : l, a); }; }
console.table = (d) => console.log(d); console.dir = (d) => console.log(d);
addEventListener('error', (e) => send('error', [e.message], e.lineno ? e.lineno - ${HEAD_FIXED + htmlLines} : null));
addEventListener('unhandledrejection', (e) => send('error', [String(e.reason && e.reason.stack || e.reason)]));
addEventListener('load', () => parent.postMessage({ pg: 'ready' }, '*'));
<\/script>
<link rel="stylesheet" href="${ORIGIN}/recipe.css${vq}">
${mock ? `<script type="module" src="${ORIGIN}/mock-server.js${vq}"><\/script>` : ''}
</head>
<body>${(files.html || '').replace(/<\/script/g, '<\\/script')}
<script type="module">${(files.js || '').replace(/<\/script/g, '<\\/script')}<\/script></body></html>`;
    };
    addEventListener('message', (e) => {
        if (e.source !== frame.contentWindow || !e.data) return;
        if (e.data.mock && requestsEl) {
            const r = e.data.mock;
            const el = document.createElement('div'); el.className = 'req ' + (r.status >= 400 ? 'bad' : 'ok');
            el.innerHTML = `<span class="m">${r.method}</span> <span class="u"></span> <span class="s">${r.status}</span> <span class="t">${r.ms} ms</span>`;
            el.querySelector('.u').textContent = r.url + (r.body && Object.keys(r.body).length ? '  ' + JSON.stringify(r.body) : '') + (r.error ? '  ← ' + r.error : '');
            requestsEl.appendChild(el); requestsEl.scrollTop = requestsEl.scrollHeight;
            return;
        }
        if (!e.data.pg) return;
        if (e.data.pg === 'ready') { if (statusEl) statusEl.textContent = 'Ran at ' + new Date().toLocaleTimeString(); if (onReady) onReady(); return; }
        line(e.data.pg, (e.data.pg === 'log' || e.data.pg === 'info' ? '› ' : e.data.pg === 'warn' ? '⚠ ' : '✗ ') + e.data.text + (e.data.line > 0 ? ` (app.js:${e.data.line})` : ''));
        if (e.data.pg === 'error' && onError) onError(e.data.line > 0 ? e.data.line : null, e.data.text);
    });
    return { run };
}

// share links: gzip + base64url of { js, html }
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export const pack = async (text) => { const cs = new CompressionStream('gzip'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(text)); w.close(); return b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer())); };
export const unpack = async (s) => { const ds = new DecompressionStream('gzip'); const w = ds.writable.getWriter(); w.write(unb64u(s)); w.close(); return new Response(ds.readable).text(); };
