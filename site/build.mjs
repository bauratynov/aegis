// aegisjs.com — static site generator. Sources: README (repo root or _queue), ERRORS.md, llms.txt, aegis.d.ts, recipes/, demo/, playground.
//   node site/build.mjs            → site/dist/
//   node site/build.mjs --serve    → also serve site/dist on http://127.0.0.1:8093
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { marked } from 'marked';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..');
const DIST = join(SITE, 'dist');
const ORIGIN = 'https://aegisjs.com';
const read = (p) => readFileSync(p, 'utf8');
// markdown normaliser: GitHub tolerates `html\`\`` and `html``` inside code spans; CommonMark needs a longer fence around them
const normMd = (s) => s
    .replace(/`([^`\n]*?)\\`\\``/g, '``` $1`` ```')
    .replace(/(^|[^`])`([\w$][\w.()' ${}=>-]*?)```(?!`)/g, '$1``` $2`` ```');
const readme = normMd(existsSync(join(ROOT, 'README.md')) ? read(join(ROOT, 'README.md')) : read(join(ROOT, '_queue', '21_README.md')))
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/aegis-engine\/aegis\.min\.js/g, `${ORIGIN}/aegis.min.js`);
const VERSION = (read(join(ROOT, 'package.json')).match(/"version":\s*"([^"]+)"/) || [, '0.0.0'])[1];
const BUILD = Date.now().toString(36);   // cache-buster for theme.css / site.js / play.js / aegis-site.js on every build
const TESTS = (readme.match(/tests-(\d+)/) || [, '1000'])[1];
const TODAY = new Date().toISOString().slice(0, 10);
const THEME_CSS = read(join(SITE, 'src', 'theme.css')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n');   // inlined into every page: one request less before first paint
const gitDate = (file) => { try { return execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT, stdio: 'pipe' }).toString().trim() || TODAY; } catch { return TODAY; } };
const DOC_DATE = gitDate(existsSync(join(ROOT, 'README.md')) ? 'README.md' : 'aegis.d.ts');   // README lives in the queue until pushed; d.ts moves with it
const API_DATE = gitDate('aegis.d.ts');
const RECIPE_DATE = gitDate('recipes');

// ── highlighter (no dependencies) ─────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const KW = /\b(?:import|export|from|const|let|var|function|return|if|else|for|of|in|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|async|await|try|catch|finally|throw|default|yield|delete|void|null|undefined|true|false|as|type|interface|declare|readonly|keyof|extends|implements|namespace|enum|static|get|set)\b/;
const JS_RE = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\[\s\S]|[^`])*`)|('(?:\\.|[^'\n])*'|"(?:\\.|[^"\n])*")|(\b\d+(?:\.\d+)?(?:_\d+)*\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;
function hlJs(src) {
    let out = '', last = 0;
    for (const m of src.matchAll(JS_RE)) {
        out += esc(src.slice(last, m.index)); last = m.index + m[0].length;   // gaps (operators, generics like <T>) are escaped too
        const [, cm, tpl, str, num, fn, id] = m;
        if (cm) out += `<span class="cm">${esc(cm)}</span>`;
        else if (tpl) out += `<span class="tpl">${esc(tpl).replace(/\$\{[\s\S]*?\}/g, (x) => `<span class="fn">${x}</span>`)}</span>`;
        else if (str) out += `<span class="str">${esc(str)}</span>`;
        else if (num) out += `<span class="num">${num}</span>`;
        else if (fn) out += KW.test(fn) ? `<span class="kw">${fn}</span>` : `<span class="fn">${fn}</span>`;
        else if (id) out += KW.test(id) ? `<span class="kw">${id}</span>` : esc(id);
        else out += esc(m[0]);
    }
    return out + esc(src.slice(last));
}
function hlHtml(src) {
    return src.split(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g).map((part, i) => {
        if (i % 4 === 2) return hlJs(part);
        if (i % 4 === 1 || i % 4 === 3) return `<span class="tag">${esc(part)}</span>`;
        let out = '', last = 0;
        for (const m of part.matchAll(/(<!--[\s\S]*?-->)|(<\/?)([\w-]+)([^>]*)(\/?>)/g)) {
            out += esc(part.slice(last, m.index)); last = m.index + m[0].length;
            const [, cm, open, tag, attrs, close] = m;
            if (cm) { out += `<span class="cm">${esc(cm)}</span>`; continue; }
            let a = '', al = 0;
            for (const x of attrs.matchAll(/([@:.?\w][\w:.-]*)(=)?("(?:[^"]*)"|'(?:[^']*)'|\$\{[^}]*\})?/g)) {
                a += esc(attrs.slice(al, x.index)); al = x.index + x[0].length;
                const [, n, eq, v] = x;
                a += `<span class="attr">${esc(n)}</span>${eq ? '=' : ''}${v ? (v.startsWith('$') ? `<span class="fn">${esc(v)}</span>` : `<span class="str">${esc(v)}</span>`) : ''}`;
            }
            a += esc(attrs.slice(al));
            out += `<span class="tag">${esc(open)}${tag}</span>${a}<span class="tag">${esc(close)}</span>`;
        }
        return out + esc(part.slice(last));
    }).join('');
}
function hl(code, lang) {
    lang = (lang || '').toLowerCase();
    if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript' || lang === 'mjs') return hlJs(code);
    if (lang === 'html' || lang === 'xml' || lang === 'svg') return hlHtml(code);
    if (lang === 'sh' || lang === 'bash' || lang === 'shell') return esc(code).replace(/^(#[^\n]*)/gm, '<span class="cm">$1</span>').replace(/^(\$ |node |npm |npx )/gm, '<span class="kw">$1</span>');
    if (lang === 'json') return esc(code).replace(/("(?:\\.|[^"])*")(\s*:)?/g, (m, s, c) => c ? `<span class="attr">${s}</span>${c}` : `<span class="str">${s}</span>`);
    return esc(code);
}

// ── markdown ──────────────────────────────────────────────────────────────────
const slug = (s) => s.toLowerCase().replace(/[`*]/g, '').replace(/[^a-z0-9Ѐ-ӿ]+/g, '-').replace(/^-+|-+$/g, '');
const LINKS = [[/\.\/recipes\/?/, '/examples/'], [/\.\/playground\.html/, '/play/'], [/\.\/demo\/admin\.html/, '/demo/admin.html'], [/^\.\/ERRORS\.md$/, '/docs/errors/'], [/^ERRORS\.md$/, '/docs/errors/'], [/^LICENSE$/, '/docs/philosophy/#license'], [/^\.\/aegis\.d\.ts$/, '/aegis.d.ts']];
const fixHref = (h) => { for (const [re, to] of LINKS) if (re.test(h)) return h.replace(re, to); return h; };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{FE0F}]\s?/gu;
let headings = [];
marked.use({
    gfm: true,
    renderer: {
        code({ text, lang }) { return `<pre data-lang="${esc(lang || '')}"><code>${hl(text, lang)}</code></pre>`; },
        heading({ tokens, depth }) {
            const inner = this.parser.parseInline(tokens); const text = inner.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            const id = slug(text); headings.push({ depth, text, id });
            return `<h${depth} id="${id}">${inner}${depth > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to ${esc(text)}">#</a>` : ''}</h${depth}>\n`;
        },
        link({ href, tokens, title }) { return `<a href="${esc(fixHref(href))}"${title ? ` title="${esc(title)}"` : ''}${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}>${this.parser.parseInline(tokens)}</a>`; },
        hr() { return ''; },
        // raw HTML in prose (e.g. `<script type="application/json">` mentioned in a JSDoc) is shown as text, never parsed
        html({ text }) { return esc(text); },
    },
});
const md = (src) => {
    headings = [];
    let html = marked.parse(src.replace(EMOJI, ''));
    html = html.replace(/<table([^>]*)>/g, '<div class="tbl"><table$1>').replace(/<\/table>/g, '</table></div>');
    return { html, headings: headings.slice() };
};
const plain = (src) => src.replace(/```[\s\S]*?```/g, ' ').replace(/^\s*[-*]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '').replace(/\\`/g, '').replace(/[`*_>#|]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(EMOJI, '').replace(/\s+/g, ' ').trim();
const cut = (s, n) => { if (s.length <= n) return s; const i = s.lastIndexOf(' ', n); return s.slice(0, i > n / 2 ? i : n) + '…'; };

// ── README → chapters ─────────────────────────────────────────────────────────
const body = readme.slice(readme.indexOf('# ⚡ Aegis'));
const parts = body.split(/^## /m);
const intro = parts[0].replace(/^# ⚡ Aegis\s*/, '');
const sections = parts.slice(1).map(p => { const nl = p.indexOf('\n'); return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1).replace(/^---\s*$/gm, '').trim() }; });
const sec = (name) => sections.find(s => s.title.toLowerCase().startsWith(name.toLowerCase()));
const introPage = { slug: 'introduction', title: 'Introduction', group: 'Guide', md: `# What is Aegis?\n\n${intro}\n\n## Mental model — 4 rules\n\n${sec('Mental model').body}` };
const canon = sec('The canonical API');
// feature chapters: every `- **label** — text` bullet becomes an h3 section so the TOC, anchors and search work there
const promote = (body) => body.split('\n').map(l => { const m = l.match(/^- \*\*(.+?)\*\*\s+—\s+(.*)$/); return m ? `### ${m[1].replace(/\*\*/g, '')}\n\n${m[2]}` : l.replace(/^  /, ''); }).join('\n');
const features = sec('Features').body.split(/^### /m).slice(1).map(p => { const nl = p.indexOf('\n'); const t = p.slice(0, nl).trim(); return { slug: slug(t), title: t, group: 'Features', md: `# ${t}\n\n${promote(p.slice(nl + 1).trim())}` }; });
const page = (name, group, s = null, short = null) => { const x = sec(name); return { slug: s || slug(x.title), title: short || x.title.replace(/ — .*$/, ''), group, md: `# ${x.title}\n\n${x.body}` }; };
const errorsMd = normMd(read(join(ROOT, 'ERRORS.md'))).replace(/Since phase A1 the scheduler/g, 'The scheduler');
const ERROR_ROWS = [...errorsMd.matchAll(/^\| \*\*([ES]\d{3})\*\* \| (.*?) \| (.*?) \|$/gm)].map(m => ({ code: m[1], what: m[2], fix: m[3] }));
const llmsRaw = normMd(read(join(ROOT, 'llms.txt')));
const llms = llmsRaw.replace(/`ERRORS\.md`/g, '[`ERRORS.md`](/docs/errors/)').replace(/`aegis\.d\.ts`/g, '[`aegis.d.ts`](/aegis.d.ts)').replace(/`recipes\/`/g, '[`recipes/`](/examples/)').replace(/`playground\.html`/g, '[`playground.html`](/play/)').replace(/`test\.html`/g, '`test.html` (in the repository)');
const DOCS = [
    introPage,
    { slug: 'canonical-api', title: 'The canonical API', group: 'Guide', md: `# ${canon.title}\n\n${canon.body}` },
    page('Quick Start', 'Guide'),
    page('Installation', 'Guide'),
    ...features,
    page('Dev Mode', 'Reference'),
    { slug: 'errors', title: 'Warning codes', group: 'Reference', src: 'ERRORS.md', md: errorsMd.replace(/^# .*$/m, '# Warning codes (E0xx / S0xx)') },
    page('TypeScript', 'Reference'),
    page('Testing', 'Reference'),
    { slug: 'for-assistants', title: 'For AI assistants', group: 'Reference', src: 'llms.txt', md: `# For AI assistants (llms.txt)\n\nThis is the contents of [\`/llms.txt\`](/llms.txt): the rules an assistant needs to write correct Aegis code. Point your tool at that URL.\n\n${llms.replace(/^# .*$/m, '')}` },
    page('Distribution', 'Project'),
    page('Benchmarks', 'Project'),
    page('Background tabs', 'Project', 'background-tabs', 'Background tabs'),
    page('Browser Support', 'Project'),
    { ...page('Philosophy', 'Project'), md: `# Philosophy\n\n${sec('Philosophy').body}\n\n## License\n\nMIT.` },
];

// ── aegis.d.ts → API reference ────────────────────────────────────────────────
function parseDts(src) {
    const lines = src.split('\n'); const out = []; let doc = []; let i = 0;
    while (i < lines.length) {
        const l = lines[i];
        if (/^\s*\/\*\*/.test(l)) { const block = []; while (i < lines.length) { block.push(lines[i]); if (/\*\//.test(lines[i])) break; i++; } i++; if (doc.length) doc.push(''); doc.push(...block); continue; }   // stacked blocks concatenate
        const m = l.match(/^export (?:declare )?(function|const|class|interface|type|let|var|abstract class|namespace)\s+([A-Za-z_$][\w$]*)/);
        if (!m) { if (l.trim() && !/^\s*\/\//.test(l)) doc = []; i++; continue; }
        const kind = m[1].replace('abstract ', ''), name = m[2];
        let depth = 0, sig = [], j = i;
        const bodied = kind === 'interface' || kind === 'class' || kind === 'namespace';
        for (; j < lines.length; j++) {
            const s = lines[j]; sig.push(s);
            for (const ch of s.replace(/'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`/g, '')) { if (ch === '{' || ch === '(') depth++; else if (ch === '}' || ch === ')') depth--; }
            const done = depth <= 0 && (kind === 'type' ? /;\s*$/.test(s) : bodied ? /[;}]\s*$/.test(s) : (/[;}]\s*$/.test(s) || (/\)\s*:?.*;?\s*$/.test(s) && !/[({]\s*$/.test(s))));
            if (done) break;
        }
        const jsdoc = doc.map(x => x.replace(/^\s*\/\*\*\s?/, '').replace(/\s*\*\/\s*$/, '').replace(/^\s*\* ?/, '')).join('\n').trim();
        out.push({ kind, name, sig: sig.join('\n').trim(), doc: jsdoc, deprecated: /@deprecated/.test(jsdoc) });
        doc = []; i = j + 1;
    }
    return out;
}
const GROUPS = {
    'Reactive core': 'signal computed effect batch untrack startTransition deferred transaction useScheduler watch linked persisted selector until lens signals from history reactive isReactive isSignal createScope getOwner runWithOwner onDispose root flushSync flush nextTick provide inject createContext trace dev stats onError onWarn reset store AegisWarning',
    'Templates & DOM': 'html trusted sanitizeConfig render text attr cls style cssVars clsMap styleMap bind when show list ref attach clone on delegate prevent stop self portal tpl adopt swap boost hydrate uncloak destroy destroyAll jsonScript $ $$',
    'Components': 'register island mount component element defineElement errorBoundary expose scaffold',
    'Data & cache': 'resource cachedResource offlineResource mutation streamResource sse settled prefetch prefetchOn infiniteResource seed seedFrom invalidate cache request api configure defaults guardedFetch withRetry HttpError leader predictor speculate poll useClock',
    'Forms': 'form wireForm required minLen maxLen emailRule email pattern matches min max maxSize mime maxFiles fieldArray wizard draft setValidationMessages',
    'Motion': 'spring springSignal tween flip animate transition reducedMotion',
    'Routing & platform': 'router command anchor transitioning',
    'Accessibility': 'trap roving announce modal tabbables busy live',
    'CSS & theming': 'css adoptStyles scopedStyle injectStyles theme media',
    'Layout, timers, observers': 'virtualScroll lazy size inView viewport observe resize mutate interval timeout debounced throttled',
    'i18n': 'i18n',
};
const groupOf = (e) => { for (const [g, names] of Object.entries(GROUPS)) if (names.split(' ').includes(e.name)) return g; return (e.kind === 'interface' || e.kind === 'type') ? 'Types' : 'Other'; };
const api = parseDts(read(join(ROOT, 'aegis.d.ts')));
const apiByName = new Map();
for (const e of api) {
    if (!apiByName.has(e.name)) apiByName.set(e.name, { ...e, sigs: [{ sig: e.sig, doc: e.doc }] });
    else { const x = apiByName.get(e.name); x.sigs.push({ sig: e.sig, doc: e.doc }); if (!x.doc) x.doc = e.doc; x.deprecated = x.deprecated || e.deprecated; }
}
const apiEntries = [...apiByName.values()].map(e => ({ ...e, group: groupOf(e) }));
const apiGroups = [...Object.keys(GROUPS), 'Other', 'Types'].map(g => ({ name: g, items: apiEntries.filter(e => e.group === g && !e.deprecated).sort((a, b) => a.name.localeCompare(b.name)) })).filter(g => g.items.length);
const deprecatedEntries = apiEntries.filter(e => e.deprecated).sort((a, b) => a.name.localeCompare(b.name));
const API_COUNT = apiEntries.length - deprecatedEntries.length;

// ── layout ────────────────────────────────────────────────────────────────────
// the mark from logo/logo_1.webp redrawn as vectors: prompt chevron + lambda with a dot, petrol blue #184C64 (the site recolours it via CSS)
const LOGO = `<svg viewBox="0 0 603 450" aria-hidden="true"><g fill="#184C64"><path d="M0 26v62l104 47L0 182v62l160-92v-34L0 26z"/><path d="M296 0h96l211 450h-96L344 96 181 450H85L296 0z"/><circle cx="332" cy="300" r="44"/></g></svg>`;
const MARK_FILE = LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
const NAV = [['Docs', '/docs/introduction/'], ['API', '/api/'], ['Examples', '/examples/'], ['Playground', '/play/']];
// SEO: hand-written titles and descriptions for the pages Google will rank; the rest fall back to the page lead
const SEO = {
    'introduction': ['What is Aegis? Zero-build reactive UI for server-rendered pages', 'Aegis is a zero-build reactive UI engine: one ES module, no compiler, no npm. Islands, signals and templates wake up the HTML your Django, Rails, Laravel or PHP server already renders.'],
    'canonical-api': ['The canonical API: the dozen names you actually need', 'island, mount, element, signal, computed, effect, reactive, html, when, list, resource, mutation, wireForm, swap, router — which Aegis export to use for which job, and what it replaces.'],
    'quick-start': ['Quick start: an island, a todo list and data fetching', 'Add one script tag and write your first Aegis island on a server page, a todo list with list() and keyed rows, and data fetching with resource() and when().'],
    'installation': ['Installation: direct import, vendored file or npm', 'Import aegis.js straight from a URL, copy one file next to your templates, or use the exports map. No bundler, no build step.'],
    'reactive-core': ['Reactive core: signals, computeds, effects and reactive objects', 'TC39-aligned signals with glitch-free propagation, lazy computeds, auto-cleaned effects, deep reactive() objects, persisted and linked signals, context and stores.'],
    'dom': ['DOM templates: html``, events, lists and server HTML', 'Tagged html`` templates parsed once and CSP-safe: @click events, .prop and ?bool bindings, bind:value, keyed list(), show(), swap() and morph for server HTML, islands and lazy loading.'],
    'data': ['Data: resource(), mutations, cache and streaming', 'One resource() primitive for async data with SWR caching, offline IndexedDB, streaming and SSE; mutations with optimistic updates and rollback; CSRF presets, prefetch and structural sharing.'],
    'components': ['Components: islands, mount(), custom elements and hydration', 'Register islands on server HTML, mount components with a rich context, define custom elements from the same function, catch errors with errorBoundary and hydrate lazily.'],
    'forms': ['Forms: wireForm() and form() with validation', 'Progressive forms over a plain <form>: Constraint Validation, schemas, async rules, server 422 errors, wizards, drafts, dirty tracking and accessible error summaries.'],
    'animation': ['Animation: springs, FLIP, View Transitions and CSS transitions', 'Physics-based spring(), flip() for list reordering, animate() with the View Transitions API and a CSS enter/leave contract shared by show(), list() and transition().'],
    'routing-navigation': ['Routing: a Navigation API router with loaders and guards', 'Nested routes with layouts, async loaders, guards that run before the URL commits, View Transitions, URLPattern routes, search params as signals, commands and anchor positioning.'],
    'accessibility': ['Accessibility: focus traps, roving tabindex and live regions', 'trap() with restore and inert, roving() for menus, grids and trees, announce() with a lossless live-region queue, accessible dialogs and forms.'],
    'css': ['CSS: constructable stylesheets, scoped styles and layers', 'css`` templates adopted once per root, adoptStyles() deduplication, scopedStyle() with @scope and a class-prefix fallback, theme() and media() as signals.'],
    'performance': ['Performance: virtual scroll, lazy islands and effect lanes', 'virtualScroll() with content-visibility or DOM recycling for 100k rows, lazy() loading, effect lanes per microtask or frame, hydration strategies and event delegation.'],
    'debugging': ['Debugging: dev mode, errors that explain themselves, llms.txt', 'Dev mode switches on by itself on localhost, every warning carries a code with why and fix, effect errors name the effect, the component and the signals that changed, and llms.txt briefs AI assistants.'],
    'utilities': ['Utilities: guarded fetch, timers, observers and i18n', 'guardedFetch() with auto-abort, debounced and throttled helpers, scoped interval() and timeout(), observers, i18n with plural rules and nextTick().'],
    'dev-mode': ['Dev mode: warnings that explain themselves and an in-page inspector', 'Every Aegis warning has a code, a why and a fix with the source position; the DevTools panel shows the component tree, signals, effects and the cache. Zero cost in production.'],
    'errors': ['Warning codes E001–E052 and S001–S012 with fixes', 'Every Aegis dev warning and security code with what happened, why and how to fix it: leaks, purity, lost reactivity, unsafe URLs, trust zones and more.'],
    'typescript': ['TypeScript: hand-authored declarations, no build step', 'aegis.d.ts gives full IntelliSense: typed signals and resources, route params inferred from patterns, custom element props and i18n keys. Checked against the runtime on every test run.'],
    'testing': ['Testing: render, fire, waitFor and mockFetch', 'A dependency-free helper set for any browser runner: render components, fire real DOM events, wait for effects and requests, mock fetch and clean up between tests.'],
    'for-assistants': ['llms.txt: the rules AI assistants need for Aegis', 'The contract for coding assistants: live vs snapshot values, scopes, ctx helpers, no innerHTML with data, resource() for async, and the canonical island.'],
    'distribution': ['Distribution: one file, tree-shaking and custom builds', 'aegis.js, aegis.min.js and the core-only build; tree-shaking by named import with a bundler or build.mjs without one; measured sizes per subset.'],
    'benchmarks': ['Benchmarks: 1,000-row table and the reactive core', 'js-framework-benchmark-style numbers for create, replace, update, select, swap, remove and append, plus deep chains, fan-out and diamonds in the core.'],
    'background-tabs': ['Background tabs, timers and reduced motion', 'How Aegis timers, polling, transitions and offline resources behave when the tab is hidden or throttled, and how prefers-reduced-motion turns transitions into instant state changes.'],
    'browser-support': ['Browser support', 'Chromium, Firefox 101+ and Safari 16.4+ in full; every advanced API (Navigation, View Transitions, Anchor Positioning, Background Sync) has a built-in fallback.'],
    'philosophy': ['Philosophy: zero build, zero dependencies, safety by architecture', 'Why Aegis is one file with no dependencies, why scopes make leaks structurally impossible, and why it builds on emerging browser standards with fallbacks. MIT licensed.'],
};
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ORIGIN + url })) });
function layout({ title, description, path, main, extraHead = '', scripts = '', noindex = false, mainTag = true, jsonld = null }) {
    const section = NAV.find(([, href]) => path.startsWith(href.split('/').slice(0, 2).join('/') + '/'))?.[0];
    return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${ORIGIN}${path}">`}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="Aegis"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${ORIGIN}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Aegis — the reactive UI engine with zero build">${noindex ? '' : `<meta property="og:url" content="${ORIGIN}${path}">`}<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#184C64">
${jsonld ? [].concat(jsonld).map(ld).join('\n') : ''}
<link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin>
<style>${THEME_CSS}</style>
<link rel="modulepreload" href="/aegis-site.js?v=${BUILD}">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" media="print" onload="this.media='all'">
<script>try{var t=JSON.parse(localStorage.getItem('aegis:theme'));if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}</script>
${extraHead}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="in">
    <button class="icon-btn burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
    <a class="logo" href="/">${LOGO}<span>aegis<span class="js">js</span></span></a>
    <nav aria-label="Primary">${NAV.map(([n, h]) => `<a href="${h}"${n === section ? ' class="on" aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
    <div class="grow"></div>
    <div class="search" data-aegis="site-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Search docs…" aria-label="Search"><kbd>Ctrl K</kbd></div>
    <span data-aegis="theme-toggle"><button class="icon-btn" aria-label="Toggle theme"><i class="fa-solid fa-moon" aria-hidden="true"></i></button></span>
</div></header>
${mainTag ? `<main id="main" tabindex="-1">${main}</main>` : main}
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Aegis · MIT · v${VERSION} · ${TESTS} tests passing in Chrome and Firefox</span><span><a href="/llms.txt">llms.txt</a> · <a href="/aegis.d.ts">aegis.d.ts</a> · <a href="/bench.html">bench</a> · built with Aegis, no build step for you</span></div></footer>
<script type="module" src="/site.js?v=${BUILD}"></script>
${scripts}
</body>
</html>`;
}
const docsNav = (current) => {
    const groups = [...new Set(DOCS.map(d => d.group))];
    return `<aside class="side"><nav aria-label="Docs">${groups.map(g => `<div class="h5">${g}</div>${DOCS.filter(d => d.group === g).map(d => `<a href="/docs/${d.slug}/"${d.slug === current ? ' class="on" aria-current="page"' : ''}>${esc(d.title)}</a>`).join('')}`).join('')}<div class="h5">More</div><a href="/api/">API reference</a><a href="/examples/">Examples</a><a href="/play/">Playground</a></nav></aside>`;
};
const tocOf = (hs) => { const items = hs.filter(h => h.depth === 2 || h.depth === 3); const hasH2 = items.some(h => h.depth === 2); return items.length ? `<nav class="toc" aria-label="On this page"><div class="h5">On this page</div>${items.map(h => `<a href="#${h.id}" class="${h.depth === 3 && hasH2 ? 'h3' : ''}">${esc(h.text)}</a>`).join('')}</nav>` : '<div></div>'; };

// ── build ─────────────────────────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true }); mkdirSync(DIST, { recursive: true });
const write = (rel, content) => { const p = join(DIST, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content); };
const search = [];
const addSearch = (kind, title, url, hs, text) => {
    const chunks = text.split(/^#{1,3} /m);
    hs.forEach((h) => { const chunk = chunks.find(c => c.startsWith(h.text)) || ''; search.push({ k: kind, t: title, h: h.text, u: `${url}#${h.id}`, x: plain(chunk.slice(h.text.length)).slice(0, 220) }); });
    if (!hs.length || hs[0].depth !== 1) search.push({ k: kind, t: title, h: title, u: url, x: plain(text).slice(0, 220) });
};

// docs
DOCS.forEach((d, i) => {
    let src = d.md.replace(/\(\d+ names, most of them small helpers\)/, `(about ${API_COUNT} names, most of them small helpers)`).replace(/All \d+ codes with the fix for each/, `Every code (${ERROR_ROWS.length} of them) with the fix for each`);
    let { html, headings: hs } = md(src);
    html = html.replace(/(<\/h1>\n)<p>(?!<strong>)/, '$1<p class="lead">');
    if (d.slug === 'errors') html = html.replace(/<tr>\n?<td><strong>([ES]\d{3})<\/strong>/g, (m, c) => `<tr id="${c.toLowerCase()}"><td><strong>${c}</strong>`);
    const prev = DOCS[i - 1], next = DOCS[i + 1];
    const lead = cut(plain(src.split('\n').slice(1).join('\n')), 160);
    const [seoTitle, seoDesc] = SEO[d.slug] || [d.title, lead];
    const main = `<div class="wrap docs">${docsNav(d.slug)}<article class="content">${html}
        <div class="pager">${prev ? `<a href="/docs/${prev.slug}/"><small>Previous</small>← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="/docs/${next.slug}/"><small>Next</small>${esc(next.title)} →</a>` : ''}</div>
    </article>${tocOf(hs)}</div>`;
    write(`docs/${d.slug}/index.html`, layout({ title: `${seoTitle} · Aegis docs`, description: seoDesc, path: `/docs/${d.slug}/`, main, jsonld: [
        { '@context': 'https://schema.org', '@type': 'TechArticle', headline: seoTitle, description: seoDesc, url: `${ORIGIN}/docs/${d.slug}/`, dateModified: DOC_DATE, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'Aegis', url: ORIGIN }, about: { '@type': 'SoftwareApplication', name: 'Aegis' } },
        crumbs([['Aegis', '/'], ['Docs', '/docs/introduction/'], [d.group, `/docs/${DOCS.find(x => x.group === d.group).slug}/`], [d.title, `/docs/${d.slug}/`]]),
    ] }));
    if (d.slug === 'errors') { search.push({ k: 'docs', t: 'Warning codes', h: 'Warning codes', u: '/docs/errors/', x: cut(plain(src), 220) }); for (const r of ERROR_ROWS) search.push({ k: 'errors', t: 'Warning codes', h: r.code, u: `/docs/errors/#${r.code.toLowerCase()}`, x: cut(plain(r.what + ' — ' + r.fix), 220) }); }
    else addSearch('docs', d.title, `/docs/${d.slug}/`, hs.filter(h => h.depth > 1), src);
});

// api
{
    const fmtDoc = (doc) => {
        if (!doc) return '';
        const fenced = doc.replace(/((?:^ {2,}.*\n?)+)/gm, (m) => '\n```js\n' + m.replace(/^ {2}/gm, '') + (m.endsWith('\n') ? '' : '\n') + '```\n');
        return marked.parse(fenced.replace(/@param\s+([\w.]+)/g, '**`$1`**').replace(/@returns?/g, '**returns**').replace(/@example/g, '**example**').replace(/^@deprecated\s*/m, '**deprecated** '));
    };
    const entry = (e) => {
        const lead = e.sigs.some(s => s.doc && s.doc !== e.doc) ? '' : fmtDoc(e.doc);
        const sigs = e.sigs.map((s, i) => `${(lead === '' && s.doc) ? fmtDoc(s.doc) : ''}<pre data-lang="ts"><code>${hlJs(s.sig)}</code></pre>`).join('');
        return `<section class="api-entry" id="${e.name}"><h3><code>${esc(e.name)}</code> <small class="kind">${e.kind}</small><a class="anchor" href="#${e.name}" aria-label="Link to ${esc(e.name)}">#</a></h3>${lead}${sigs}</section>`;
    };
    const side = `<aside class="side"><nav aria-label="API groups">${apiGroups.map(g => `<div class="h5"><a href="#group-${slug(g.name)}">${g.name}</a></div>${g.items.map(e => `<a href="#${e.name}">${esc(e.name)}</a>`).join('')}`).join('')}<div class="h5">Deprecated</div><a href="#deprecated">Aliases (${deprecatedEntries.length})</a></nav></aside>`;
    const main = `<div class="wrap docs">${side}<article class="content"><h1>API reference</h1><p class="lead">Every export of <code>aegis.js</code>, generated from <a href="/aegis.d.ts">aegis.d.ts</a> (the same declarations your editor uses). ${API_COUNT} names in ${apiGroups.length} groups plus ${deprecatedEntries.length} deprecated aliases; the <a href="/docs/canonical-api/">canonical dozen</a> is all most apps need.</p>
        ${apiGroups.map(g => `<h2 id="group-${slug(g.name)}">${g.name}<a class="anchor" href="#group-${slug(g.name)}" aria-label="Link to ${g.name}">#</a></h2>${g.items.map(entry).join('')}`).join('')}
        <h2 id="deprecated">Deprecated aliases<a class="anchor" href="#deprecated" aria-label="Link to deprecated aliases">#</a></h2><p>These still work but are marked <code>@deprecated</code> in <code>aegis.d.ts</code>; each line names the replacement.</p><ul>${deprecatedEntries.map(e => `<li id="${e.name}"><code>${esc(e.name)}</code> — ${marked.parseInline((e.doc || '').replace(/^@deprecated\s*/, ''))}</li>`).join('')}</ul>
    </article><div></div></div>`;
    write('api/index.html', layout({ title: 'API reference: every export of aegis.js · Aegis', description: `All ${API_COUNT} exports of the Aegis reactive UI engine with TypeScript signatures and docs: signals, templates, islands, resource cache, forms, router, accessibility. Generated from aegis.d.ts.`, path: '/api/', main, jsonld: [{ '@context': 'https://schema.org', '@type': 'TechArticle', headline: 'Aegis API reference', url: `${ORIGIN}/api/`, dateModified: API_DATE, inLanguage: 'en', about: { '@type': 'SoftwareApplication', name: 'Aegis' } }, crumbs([['Aegis', '/'], ['API reference', '/api/']])], extraHead: '<style>.api-entry{margin:22px 0 30px}.api-entry h3{margin:0 0 6px}.kind{font-weight:400;color:var(--muted);font-size:var(--fs-xs);margin-left:6px}.api-entry pre{margin:8px 0}.api-entry p{max-width:var(--measure)}</style>' }));
    for (const e of apiEntries) search.push({ k: 'api', t: 'API', h: e.name, u: `/api/#${e.name}`, x: cut(plain(e.doc || e.sigs[0].sig), 200) });
}

// examples: recipes + demo + bench
const RECIPES = [
    ['island', 'Island on a server page', 'island(), typed data-* props, mutation with optimistic update', {
        notice: ['The server already rendered <code>12 likes</code>; the island replaces it with a live template without a flash.', 'Props come from <code>data-*</code> attributes and are typed once in <code>{ types }</code>.', 'The heart click writes the signal first and sends the request after; a failed request rolls the number back.'],
        try: 'Click the heart a few times, then reload: the server markup is the starting point every time.',
        api: ['island', 'mutation', 'api'],
    }],
    ['search', 'Search with debounce', 'resource() from a query signal, when() with an empty state, keepPrevious', {
        notice: ['The URL is a function of the query signal: an empty query means no request at all.', 'A new query aborts the previous request; <code>keepPrevious</code> keeps the old list on screen while the next one loads.', '<code>when()</code> renders loading, empty, error and data in one place.'],
        try: 'Type “lo” then “lon”: the list dims instead of flickering, and “xyz” shows the empty state.',
        api: ['resource', 'when', 'list'],
    }],
    ['form', 'Progressive form', 'wireForm() over a plain <form>: validation, a mock server error, submit state', {
        notice: ['The form works without JavaScript; <code>wireForm()</code> adds live validation on top of the browser\'s own rules.', 'Errors appear after you leave a field, then update live: the <code>blur-then-live</code> mode.', 'The submit handler is a mock server; a real app passes <code>submit: true</code> and lets the 422 → field-errors path do this.'],
        try: 'Register with <code>me@taken.com</code> to see a server-side error land on the email field.',
        api: ['wireForm', 'required', 'emailRule', 'minLen', 'matches'],
    }],
    ['modal', 'Modal', '<dialog> driven by a signal, focus trap, Escape and backdrop click', {
        notice: ['A native <code>&lt;dialog&gt;</code>: <code>modal()</code> calls <code>showModal()</code>/<code>close()</code> as the signal changes.', 'Escape, the backdrop and the Cancel button all write the same signal back to <code>false</code>.', 'Focus returns to the button that opened the dialog.'],
        try: 'Open it, press Escape, open it again and click outside: the status reads “Kept” both times.',
        api: ['modal', 'mount'],
    }],
    ['table', 'Sortable, filterable table', 'reactive() + list() keyed rows, computed sort', {
        notice: ['State is one <code>reactive()</code> object; the visible rows are a getter, so sorting and filtering are derived, never duplicated.', '<code>list()</code> keys rows by id: sorting moves DOM nodes instead of re-rendering 200 rows.', 'Column headers toggle the sort field and direction with a single write.'],
        try: 'Filter by “1”, then sort by price: only the matching rows move.',
        api: ['reactive', 'list', 'mount'],
    }],
];
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
{
    cpSync(join(ROOT, 'recipes'), join(DIST, 'recipes'), { recursive: true });
    rmSync(join(DIST, 'recipes', 'index.html'), { force: true });
    // the recipes are deliberately unstyled in the repo; on the site they get a small base sheet in the palette (copies only)
    const RECIPE_CSS = `<link rel="stylesheet" href="/recipe.css?v=${BUILD}">`;   // shared stage sheet, also used by the playground frame
    const NOINDEX = '<meta name="robots" content="noindex">';   // iframe stages and demos: not landing pages
    for (const f of readdirSync(join(DIST, 'recipes'))) if (f.endsWith('.html')) { const p = join(DIST, 'recipes', f); writeFileSync(p, read(p).replace('</head>', RECIPE_CSS + NOINDEX + '</head>')); }
    cpSync(join(ROOT, 'demo'), join(DIST, 'demo'), { recursive: true });
    for (const f of readdirSync(join(DIST, 'demo'))) if (f.endsWith('.html')) { const p = join(DIST, 'demo', f); writeFileSync(p, read(p).replace(/<\/head>/i, NOINDEX + '</head>')); }
    for (const f of ['aegis.min.js', 'aegis.min.js.map', 'aegis.core.js', 'aegis.core.min.js', 'aegis.d.ts', 'aegis-devtools.js', 'aegis-test.js', 'aegis-test.d.ts', 'llms.txt', 'ERRORS.md']) if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(DIST, f));
    write('bench.html', read(join(ROOT, 'bench.html')).replace('<html lang="ru">', '<html lang="en">').replace(/<\/head>/i, NOINDEX + '</head>').replace(/<body>/, '<body><p id="bench-status" style="font:14px system-ui;color:#6B7280">Running 5 rounds… numbers land below and in window.__bench</p>'));
    cpSync(join(ROOT, existsSync(join(ROOT, 'aegis_full.js')) ? 'aegis_full.js' : 'aegis.js'), join(DIST, 'aegis.js'));
    const cards = RECIPES.map(([file, title, sub, info], n) => {
        const src = read(join(ROOT, 'recipes', file + '.html'));
        const bodyPart = (src.match(/<body>([\s\S]*?)<\/body>/) || [, src])[1].replace(/^\s*\n/, '').trimEnd();
        const shown = bodyPart.split('\n').filter(l => !/recipeError/.test(l)).join('\n');
        const module = (src.match(/<script type="module">([\s\S]*?)<\/script>/) || [, ''])[1].trim().replace(/from '\.\.\/aegis\.js'/g, "from 'aegis'");
        const markup = shown.replace(/<script type="module">[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, '').trim();
        const style = (shown.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].trim();
        const packed = b64u(gzipSync(Buffer.from(JSON.stringify({ js: module, html: markup + (style ? `\n<style>${style}</style>` : '') }), 'utf8')));
        return `<figure class="ex" id="${file}"><header><div><span class="n">${String(n + 1).padStart(2, '0')}</span><b>${title}</b><span>${esc(sub)}</span></div><div class="tabs"><a href="/play/#code=${packed}" title="Edit in the playground"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Edit in playground</a><a href="/recipes/${file}.html" target="_blank" rel="noopener" title="Open in a new tab"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Open</a></div></header>
            <div class="ex-body">
                <div class="ex-stage">
                    <div class="ex-code"><div class="ex-label"><i class="fa-solid fa-code" aria-hidden="true"></i> ${file}.html · ${shown.split('\n').length} lines</div><pre data-lang="html"><code>${hlHtml(shown)}</code></pre></div>
                    <div class="ex-result"><div class="ex-label"><i class="fa-solid fa-display" aria-hidden="true"></i> Result</div><iframe src="/recipes/${file}.html" title="${title}" loading="lazy"></iframe></div>
                </div>
                <aside class="ex-notes"><h4>What to notice</h4><ul>${info.notice.map(x => `<li>${x}</li>`).join('')}</ul><p class="try"><i class="fa-solid fa-hand-pointer" aria-hidden="true"></i> ${info.try}</p><div class="chips">${info.api.map(a => `<a href="/api/#${a}"><code>${a}</code></a>`).join('')}</div></aside>
            </div></figure>`;
    }).join('');
    const main = `<div class="wrap"><h1 style="margin-top:36px">Examples</h1><p class="lead" style="color:var(--muted);max-width:720px">Every recipe is one self-contained HTML file that imports <code>aegis.js</code> directly, no build. Each card runs live: read what to notice, try the interaction, then open the source or continue in the playground.</p>
        <div class="ex-grid">${cards}</div>
        <h2 class="section-title">Bigger things</h2>
        <div class="grid3">
            <div class="card"><h3><span class="ic"><i class="fa-solid fa-table-columns" aria-hidden="true"></i></span>Admin app</h3><p>Hash router, table with search and paging, optimistic mutations, forms with server errors, a 50 000-line virtual log, offline settings, theme and i18n on a mock server. One file.</p><a class="more" href="/demo/admin.html" target="_blank" rel="noopener">Open the demo →</a></div>
            <div class="card"><h3><span class="ic"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i></span>Benchmark</h3><p>A js-framework-benchmark-style table (1 000 rows, <code>list()</code> + <code>html\`\`</code>) plus the reactive core. Numbers land in a <code>&lt;pre&gt;</code> and <code>window.__bench</code>.</p><a class="more" href="/bench.html" target="_blank" rel="noopener">Run it in your browser →</a></div>
            <div class="card"><h3><span class="ic"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>DevTools</h3><p>The in-page inspector is itself an Aegis app: component tree, signals with change marks, effects and their dependencies, cache tab. Add <code>?aegis-devtools</code> to any page.</p><a class="more" href="/demo/admin.html?aegis-devtools" target="_blank" rel="noopener">Admin demo with DevTools →</a></div>
        </div></div>`;
    write('examples/index.html', layout({ title: 'Examples: runnable Aegis recipes, an admin app and a benchmark · Aegis', description: 'Live Aegis examples to read and edit: an island on server HTML, search with debounce, a progressive form, a modal, a sortable table, plus a full admin app and a benchmark. One HTML file each, no build.', path: '/examples/', main, jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Aegis examples', url: `${ORIGIN}/examples/`, dateModified: RECIPE_DATE, hasPart: RECIPES.map(([file, title, sub]) => ({ '@type': 'SoftwareSourceCode', name: title, description: sub, programmingLanguage: 'JavaScript', codeSampleType: 'full', url: `${ORIGIN}/examples/#${file}` })) }, crumbs([['Aegis', '/'], ['Examples', '/examples/']])] }));
    RECIPES.forEach(([file, title, sub]) => search.push({ k: 'examples', t: 'Examples', h: title, u: '/examples/#' + file, x: sub }));
}

// playground
{
    const main = `<div class="play"><div class="bar"><b>Playground</b><select id="preset" title="Preset" aria-label="Preset"></select><button id="run" class="primary"><i class="fa-solid fa-play" aria-hidden="true"></i> Run <kbd>Ctrl+Enter</kbd></button><button id="share"><i class="fa-solid fa-link" aria-hidden="true"></i> Share</button><span id="msg" role="status"></span><span id="status" class="status"></span><span class="grow"></span><span class="hint">index.html is what your server renders, app.js is the module. Sandboxed frame, dev warnings on.</span></div>
        <div class="panes">
            <section class="pane-editor" aria-label="Editor"><div class="ftabs" role="tablist"><button class="ftab on" role="tab" aria-selected="true" data-file="js"><i class="fa-brands fa-js" aria-hidden="true"></i> app.js</button><button class="ftab" role="tab" aria-selected="false" data-file="html"><i class="fa-brands fa-html5" aria-hidden="true"></i> index.html</button></div><div id="editor"></div></section>
            <div id="resizer" class="resizer" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>
            <section class="out" aria-label="Result"><div class="ftabs"><span class="ftab on"><i class="fa-solid fa-display" aria-hidden="true"></i> Result</span></div><iframe id="frame" title="result" sandbox="allow-scripts allow-forms allow-modals"></iframe><div class="ftabs"><span class="ftab on"><i class="fa-solid fa-terminal" aria-hidden="true"></i> Console</span></div><pre id="console" aria-live="polite" aria-label="Console"></pre></section>
        </div></div>`;
    write('play/index.html', layout({ title: 'Playground: run Aegis code in the browser · Aegis', description: 'Edit and run Aegis code in a sandboxed frame with dev warnings on, switch between presets (counter, island, todos, resource, mutation, form, router, reactive) and share a link. No build, no account.', path: '/play/', main, jsonld: crumbs([['Aegis', '/'], ['Playground', '/play/']]), extraHead: `<link rel="modulepreload" href="/cm.js?v=${BUILD}">`, scripts: `<script type="module" src="/play.js?v=${BUILD}"></script>` }).replace('<footer>', '<footer hidden>'));
}

// landing
{
    const example = intro.match(/```html\n([\s\S]*?)```/)[1].replace(/^<!--.*-->\n/, '')
        .replace(/(return html`<button .*?\}>)(Clicked \$\{count\} times)(<\/button>`;)/, '$1\n        $2\n    $3');
    const rules = sec('Mental model').body.split('\n').filter(l => /^\d+\. /.test(l)).map(l => `<li>${marked.parseInline(l.replace(/^\d+\. /, ''))}</li>`).join('');
    const benchRows = Object.fromEntries(sec('Benchmarks').body.split('\n').filter(l => l.startsWith('|')).slice(2).map(l => l.split('|').map(x => x.trim())).flatMap(c => [[c[1], c[2]], [c[3], c[4]]]));
    const num = (k) => (benchRows[k] || '').replace(/\s*\(.*$/, '');
    const CHIPS = ['island', 'mount', 'element', 'signal', 'computed', 'effect', 'reactive', 'html', 'when', 'list', 'resource', 'mutation', 'wireForm', 'swap', 'router'];
    const main = `<div class="wrap">
    <section class="hero">
        <div>
            <h1>The reactive UI engine<br>with <em>zero build</em>.</h1>
            <p class="lead">One ES module, no compiler, no npm. Your server renders the HTML; Aegis wakes up only the parts that need to be alive.</p>
            <div class="cta"><a class="btn primary" href="/docs/introduction/">Get started</a><a class="btn" href="/play/">Try in the playground</a></div>
            <div class="install"><b>import { island } from 'https://aegisjs.com/aegis.js'</b></div>
        </div>
        <div class="demo"><div class="bar"><i></i><i></i><i></i><span>page.html — rendered by Django / Rails / Laravel / Go / PHP …</span></div><pre data-lang="html"><code>${hlHtml(example)}</code></pre>
            <div class="live" data-aegis="counter" data-start="5"><button>Clicked 5 times</button></div></div>
    </section>
    <div class="stats"><div><b>0</b><span>build steps, dependencies, config files</span></div><div><b>11–21 KB</b><span>gzip: signals alone, or signals + islands + templates; build.mjs tree-shakes the rest</span></div><div><b>${TESTS}</b><span>tests green in Chrome and Firefox</span></div><div><b>MIT</b><span>one readable file, no runtime deps</span></div></div>

    <h2 class="section-title">What you get in the one file</h2><p class="section-sub">Each part is independent. Import what you use; a bundler tree-shakes the rest, and <code>build.mjs</code> does the same without one.</p>
    <div class="grid3">
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-bolt" aria-hidden="true"></i></span>Signals</h3><p>TC39-aligned signals, computeds and effects with glitch-free propagation, scopes that clean up after themselves, deep <code>reactive()</code> objects.</p><a class="more" href="/docs/reactive-core/">Reactive core →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-layer-group" aria-hidden="true"></i></span>Islands</h3><p><code>&lt;div data-aegis="chart"&gt;</code> on a server page comes alive with typed props, lazy loading on visibility, JSON props, morph-safe swaps.</p><a class="more" href="/docs/components/">Components →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-code" aria-hidden="true"></i></span>Templates</h3><p><code>html\`\`</code> parsed once by a real tokenizer, CSP-safe, with <code>@click</code>, <code>.prop</code>, <code>?bool</code>, <code>bind:value</code> and keyed <code>list()</code>.</p><a class="more" href="/docs/dom/">DOM →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-database" aria-hidden="true"></i></span>Data &amp; cache</h3><p>One <code>resource()</code> for SWR, offline and streaming; mutations with optimistic patch logs; ETag, persistence, cross-tab sync, a circuit breaker.</p><a class="more" href="/docs/data/">Data →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-list-check" aria-hidden="true"></i></span>Forms</h3><p><code>wireForm()</code> upgrades a plain <code>&lt;form&gt;</code>: Constraint Validation, schemas, async rules, 422 mapping, wizards, drafts, accessible errors.</p><a class="more" href="/docs/forms/">Forms →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-route" aria-hidden="true"></i></span>Router</h3><p>Navigation API router with loaders, guards before the URL commits, View Transitions; plus focus traps, roving tabindex and live regions for accessibility.</p><a class="more" href="/docs/routing-navigation/">Routing →</a></div>
        <div class="card"><h3><span class="ic"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></span>Security</h3><p>Typed attribute sinks: <code>href=\${v}</code> can never become <code>javascript:</code>; Trusted Types and Sanitizer API when present; trust zones per island; headers never leak to other origins.</p><a class="more" href="/docs/errors/#s001">The S-codes →</a></div>
    </div>

    <h2 class="section-title">Works with what you have</h2><p class="section-sub">No npm required. Django, Rails, Laravel, Go, PHP, htmx, Turbo, jQuery pages: islands inserted by anyone come alive with <code>hydrate(root, { watch: true })</code>.</p>
    <pre data-lang="html"><code>${hlHtml(`<script type="importmap">{ "imports": { "aegis": "https://aegisjs.com/aegis.min.js" } }</script>
<script type="module">
import { island, resource } from 'aegis';

island('users', ({ props, html, when, list }) => {
    const users = resource(props.url, { cache: true, staleTime: 30_000 });
    const row = (u) => html\`<li>\${u.name}</li>\`;
    return when(users, {
        loading: () => html\`<p class="skeleton">Loading…</p>\`,
        error: (e, retry) => html\`<p>\${e.message} <button @click=\${retry}>Retry</button></p>\`,
        data: (rows, rowsSignal) => html\`<ul>\${list(rowsSignal, row, { key: 'id' })}</ul>\`,
    });
});
</script>`)}</code></pre>

    <h2 class="section-title">Four rules, no surprises</h2><p class="section-sub">The whole mental model fits on a card.</p>
    <ol class="rules">${rules}</ol>

    <h2 class="section-title">The canonical dozen</h2><p class="section-sub">Aegis exports a lot. You need about fifteen names; the rest are for specific jobs.</p>
    <div class="chips">${CHIPS.map(n => `<a href="/api/#${n}"><code>${n}</code></a>`).join('')}</div>
    <p class="section-sub"><a href="/docs/canonical-api/">Which name for which job →</a></p>

    <h2 class="section-title">Numbers</h2><p class="section-sub">Median of 5 runs, headless Chrome, milliseconds. <a href="/bench.html">Run bench.html yourself</a>.</p>
    <div class="stats tiles"><div><b>${num('create') || '17'} ms</b><span>create 1 000 rows</span></div><div><b>${num('update every 10th') || '0.5'} ms</b><span>update every 10th row</span></div><div><b>${num('select row') || '0.1'} ms</b><span>select a row</span></div><div><b>${num('diamond × 100,000') || '30'} ms</b><span>diamond × 100 000 in the core</span></div></div>

    <div class="cta-band"><div><h2>Add one script tag. Ship.</h2><p>No npm, no bundler, no config. Works on the pages your server already renders.</p></div><div class="cta"><a class="btn primary" href="/docs/quick-start/">Quick start</a><a class="btn" href="/examples/">Examples</a><a class="btn" href="/docs/for-assistants/">llms.txt</a></div></div>
    </div>`;
    write('index.html', layout({ title: 'Aegis — zero-build reactive UI engine for server-rendered pages', description: 'A reactive JavaScript UI engine with no build step and no dependencies: signals, islands, html`` templates, an HTTP-aware cache, forms and a router in one ES module. Works with any server stack.', path: '/', main, jsonld: [
        { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Aegis', alternateName: 'aegisjs', url: ORIGIN, inLanguage: 'en', description: 'Documentation, examples and playground for the Aegis zero-build reactive UI engine.' },
        { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Aegis', alternateName: 'aegis.js', applicationCategory: 'DeveloperApplication', applicationSubCategory: 'JavaScript UI library', operatingSystem: 'Any (web browser)', softwareVersion: VERSION, license: 'https://opensource.org/license/mit', url: ORIGIN, downloadUrl: `${ORIGIN}/aegis.js`, programmingLanguage: 'JavaScript', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Zero build step', 'No dependencies', 'TC39-style signals', 'Islands on server-rendered HTML', 'html`` templates', 'HTTP-aware SWR cache', 'Forms with Constraint Validation', 'Navigation API router', 'Accessibility helpers'] },
    ] }));
}

// static: css, js, fonts, search index, favicon, robots, sitemap, 404
cpSync(join(SITE, 'src', 'theme.css'), join(DIST, 'theme.css'));
cpSync(join(SITE, 'src', 'recipe.css'), join(DIST, 'recipe.css'));
write('site.js', read(join(SITE, 'src', 'site.js')).replace("from '/aegis-site.js'", `from '/aegis-site.js?v=${BUILD}'`));
write('play.js', read(join(SITE, 'src', 'play.js')).replace("from '/cm.js'", `from '/cm.js?v=${BUILD}'`));
// CodeMirror bundle for the playground (self-hosted, loaded only on /play/)
try { execSync(`node "${join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild')}" "${join(SITE, 'src', 'cm-entry.js')}" --bundle --format=esm --minify --outfile="${join(DIST, 'cm.js')}"`, { stdio: 'pipe' }); }
catch (e) { console.error('cm.js build failed:', String(e.stderr || e.message).slice(0, 400)); process.exit(1); }
if (existsSync(join(SITE, 'src', 'fonts'))) cpSync(join(SITE, 'src', 'fonts'), join(DIST, 'fonts'), { recursive: true });
if (existsSync(join(SITE, 'src', 'og.png'))) cpSync(join(SITE, 'src', 'og.png'), join(DIST, 'og.png'));
write('search.json', JSON.stringify(search));
write('favicon.svg', MARK_FILE);
write('logo/mark.svg', MARK_FILE);
if (existsSync(join(SITE, 'src', 'logo'))) cpSync(join(SITE, 'src', 'logo'), join(DIST, 'logo'), { recursive: true });
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const urls = [['/', TODAY], ['/api/', API_DATE], ['/examples/', RECIPE_DATE], ['/play/', TODAY], ...DOCS.map(d => [`/docs/${d.slug}/`, d.src ? gitDate(d.src) : DOC_DATE])];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('404.html', layout({ title: 'Not found · Aegis', description: 'Page not found', path: '/404', noindex: true, main: `<div class="wrap" style="padding:80px 20px;text-align:center"><h1>404</h1><p style="color:var(--muted)">No route matches this URL, and there is no <code>'*'</code> handler here (E037).</p><a class="btn primary" href="/">Home</a></div>` }));

// site chrome bundle: tree-shaken production build of exactly what site.js imports
try {
    const names = read(join(SITE, 'src', 'site.js')).match(/import\s*\{([^}]*)\}\s*from\s*'\/aegis-site\.js'/)[1].split(',').map(x => x.trim()).filter(Boolean);
    execSync(`node "${join(ROOT, 'build.mjs')}" --exports ${names.join(',')} --out "${join(DIST, 'aegis-site.js')}"`, { stdio: 'pipe' });
} catch (e) { console.error('aegis-site.js build failed:', String(e.stderr || e.message).slice(0, 400)); process.exit(1); }

const size = (p) => statSync(p).size;
console.log(`site → ${DIST}: ${DOCS.length} docs pages, ${API_COUNT} API entries (+${deprecatedEntries.length} deprecated), ${RECIPES.length} recipes, search index ${(size(join(DIST, 'search.json')) / 1024).toFixed(0)} KB (${search.length} entries), aegis-site.js ${(size(join(DIST, 'aegis-site.js')) / 1024).toFixed(1)} KB`);

if (process.argv.includes('--serve')) {
    const { createServer } = await import('node:http');
    const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', map: 'application/json', ts: 'text/plain; charset=utf-8', woff2: 'font/woff2', png: 'image/png', webp: 'image/webp' };
    createServer((req, res) => {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
        let f = join(DIST, p); if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
        if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404, { 'content-type': MIME.html }); return res.end(read(join(DIST, '404.html'))); }
        res.writeHead(200, { 'content-type': MIME[f.split('.').pop()] || 'application/octet-stream' }); res.end(readFileSync(f));
    }).listen(8093, () => console.log('serving http://127.0.0.1:8093/'));
}
