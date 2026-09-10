// A small in-frame server for the examples and the playground. Every request goes through defaults.fetcher, gets a
// realistic delay, and is reported to the page ("Server requests" panel). No network is involved.
import { defaults, HttpError } from 'aegis';

const names = ['Ada Lovelace', 'Linus Torvalds', 'Grace Hopper', 'Dennis Ritchie', 'Margaret Hamilton', 'Ken Thompson', 'Barbara Liskov', 'Bjarne Stroustrup', 'Radia Perlman', 'Guido van Rossum', 'Frances Allen', 'Brendan Eich', 'Anders Hejlsberg', 'Yukihiro Matsumoto', 'Leslie Lamport', 'Donald Knuth'];
const db = {
    users: names.map((name, i) => ({ id: i + 1, name, email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', role: i % 4 === 0 ? 'admin' : 'member' })),
    todos: [{ id: 1, text: 'Read the docs', done: true }, { id: 2, text: 'Ship an island', done: false }, { id: 3, text: 'Delete the bundler', done: false }],
    cities: ['Berlin', 'Boston', 'Lisbon', 'London', 'Los Angeles', 'Lyon', 'Madrid', 'Milan', 'Munich', 'Oslo', 'Paris', 'Prague', 'Rome', 'Tokyo', 'Toronto', 'Vienna'],
    likes: 12,
    stats: { requests: 0, startedAt: Date.now() },
    taken: ['admin', 'ada', 'root'],
    comments: ['This is exactly the pattern I needed.', 'Swapping server HTML keeps the markup in one place.', 'The morph mode kept my open <details> open.'],
};
let nextTodo = 4, likeCalls = 0;
export const server = { db, latency: 350, failEvery: 0, calls: 0 };
window.__server = server;

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const q = (url) => Object.fromEntries(new URL(url, 'http://mock').searchParams);
const path = (url) => new URL(url, 'http://mock').pathname;
const fail = (status, data, msg) => { throw new HttpError(status, new Response(null, { status }), data ?? { message: msg || 'error' }); };
const html = (s) => s.trim();

const routes = [
    ['GET', /^\/api\/users$/, (u) => { const { q: query = '' } = q(u); return db.users.filter(x => x.name.toLowerCase().includes(query.toLowerCase())); }],
    ['GET', /^\/api\/users\/paged$/, (u) => { const { cursor = '0', size = '5' } = q(u); const start = +cursor, n = +size; const items = db.users.slice(start, start + n); return { items, next: start + n < db.users.length ? start + n : null, total: db.users.length }; }],
    ['GET', /^\/api\/users\/(\d+)$/, (u, m) => db.users.find(x => x.id === +m[1]) || fail(404, { message: 'no such user' })],
    ['GET', /^\/api\/cities$/, (u) => { const { q: query = '' } = q(u); return db.cities.filter(c => c.toLowerCase().includes(query.toLowerCase())); }],
    ['GET', /^\/api\/todos$/, () => db.todos.map(t => ({ ...t }))],
    ['POST', /^\/api\/todos$/, (u, m, body) => { const t = { id: nextTodo++, text: String(body?.text || '').trim() || 'Untitled', done: false }; db.todos.push(t); return { ...t }; }],
    ['PATCH', /^\/api\/todos\/(\d+)$/, (u, m, body) => { const t = db.todos.find(x => x.id === +m[1]) || fail(404); Object.assign(t, body || {}); return { ...t }; }],
    ['DELETE', /^\/api\/todos\/(\d+)$/, (u, m) => { const i = db.todos.findIndex(x => x.id === +m[1]); if (i < 0) fail(404); db.todos.splice(i, 1); return { ok: true }; }],
    ['GET', /^\/api\/likes$/, () => ({ count: db.likes })],
    ['POST', /^\/api\/likes$/, () => { likeCalls++; if (server.failEvery && likeCalls % server.failEvery === 0) fail(500, { message: 'the server dropped this one on purpose' }); return { count: ++db.likes }; }],
    ['GET', /^\/api\/stats$/, () => ({ users: db.users.length, todos: db.todos.length, requests: server.calls, uptime: Math.round((Date.now() - db.stats.startedAt) / 1000) + ' s', at: new Date().toLocaleTimeString() })],
    ['GET', /^\/api\/check-username$/, (u) => { const { u: name = '' } = q(u); return { available: !db.taken.includes(name.toLowerCase()) }; }],
    ['POST', /^\/api\/signup$/, (u, m, body) => { const errors = {}; if (db.taken.includes(String(body?.username || '').toLowerCase())) errors.username = 'This username is taken'; if (String(body?.email || '').endsWith('@taken.com')) errors.email = 'This email is already registered'; if (Object.keys(errors).length) fail(422, { errors }); return { ok: true, id: 42 }; }],
    ['GET', /^\/fragments\/comments\.html$/, (u) => { const { page = '1' } = q(u); const p = +page; return html(`<ul class="comments">${db.comments.map((c, i) => `<li><b>User ${p * 10 + i}</b> ${c}</li>`).join('')}</ul>${p < 3 ? `<button data-page="${p + 1}">Load more</button>` : '<p class="muted">No more comments.</p>'}`); }],
    ['GET', /^\/fragments\/profile\.html$/, (u) => { const { id = '1' } = q(u); const user = db.users[(+id - 1) % db.users.length]; return html(`<article class="profile"><h3>${user.name}</h3><p>${user.email} · ${user.role}</p><details open><summary>Details</summary><p>Member #${user.id}. This fragment came from the server; swap() with mode "morph" patched only what changed.</p></details></article>`); }],
];

defaults.fetcher = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const t0 = performance.now(); server.calls++;
    await wait(server.latency);
    const p = path(url);
    let body = opts.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} } if (body instanceof FormData) body = Object.fromEntries(body);
    try {
        for (const [m, re, handler] of routes) { const match = m === method && p.match(re); if (match) { const data = handler(url, match, body); report({ method, url, status: 200, ms: Math.round(performance.now() - t0), body }); return data; } }
        fail(404, { message: 'no route for ' + method + ' ' + p });
    } catch (e) {
        report({ method, url, status: e.status || 500, ms: Math.round(performance.now() - t0), body, error: e.data && e.data.message || e.data && e.data.errors && 'validation errors' || e.message });
        throw e;
    }
};
function report(r) { try { parent.postMessage({ mock: r }, '*'); } catch {} }
addEventListener('message', (e) => { if (e.data && typeof e.data.setFail === 'number') server.failEvery = e.data.setFail; if (e.data && typeof e.data.setLatency === 'number') server.latency = e.data.setLatency; });
// server HTML helpers for the examples: fetch a fragment as text
window.fragment = (url) => defaults.fetcher(url);
