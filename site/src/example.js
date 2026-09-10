// Example page: editable app.js / index.html with live re-run, result frame, console and server-request log.
import { createEditor } from '/cm.js';
import { createRunner, pack } from '/runner.js';

const data = JSON.parse(document.getElementById('ex-data').textContent);
const $ = (id) => document.getElementById(id);
const files = { js: data.js, html: data.html };
let active = 'js', timer = null;
const runner = createRunner({ frame: $('frame'), consoleEl: $('console'), requestsEl: $('requests'), statusEl: $('status'), onError: (line) => { if (line) { if (active !== 'js') showTab('js'); editor.markError(line); } } });
const run = () => { editor.markError(null); runner.run(files, { mock: data.mock !== false }); };
const editor = createEditor({ parent: $('editor'), doc: files.js, lang: 'js', onChange: (text) => { files[active] = text; clearTimeout(timer); timer = setTimeout(run, 700); $('reset').hidden = false; }, onRun: run });
const showTab = (name) => { active = name; document.querySelectorAll('.ftab[data-file]').forEach(b => { const on = b.dataset.file === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); editor.set(files[name], name); };
document.querySelectorAll('.ftab[data-file]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.file)));
document.querySelectorAll('.otab[data-out]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.otab[data-out]').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('[data-outpane]').forEach(p => { p.hidden = p.dataset.outpane !== b.dataset.out; }); }));
$('run').onclick = run;
$('reset').onclick = () => { files.js = data.js; files.html = data.html; editor.set(files[active], active); $('reset').hidden = true; run(); };
$('open-play').onclick = async (e) => { e.preventDefault(); location.href = '/play/#code=' + await pack(JSON.stringify({ js: files.js, html: files.html })); };
// the mock server's failure switch, when the example exposes it
const failToggle = $('fail-toggle');
if (failToggle) failToggle.onchange = () => { try { $('frame').contentWindow.postMessage({ setFail: failToggle.checked ? 3 : 0 }, '*'); } catch {} };
run();
