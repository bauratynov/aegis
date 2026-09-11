# Security policy

## Supported versions

The latest release on `main` receives security fixes. Older tags do not.

## Reporting a vulnerability

Please do not open a public issue for security problems. Email **baurzhanatinov@gmail.com** with:

- what you found and where (file, function, warning code if any),
- a minimal reproduction (an HTML page that imports `aegis.js` is ideal),
- the impact as you see it.

You will get an answer within 72 hours. Confirmed issues are fixed on `main`, released, and credited in `CHANGELOG.md` unless you prefer to stay anonymous.

## What Aegis does to stay safe by construction

- Data never goes through `innerHTML`: `${}` in `html\`\`` creates text nodes, and server HTML goes through `swap()` / `adopt()`.
- Attribute sinks are typed at compile time from the template's static prefix: `href=${v}` can never become `javascript:`, `srcdoc` and `on*` need an explicit `trusted()`.
- Trusted Types and the Sanitizer API are used when the browser has them; `swap(…, { sanitize })` scrubs untrusted fragments.
- Islands have trust zones: `data-aegis-src` obeys an origin policy, `[data-aegis-untrusted]` needs an allow-list, JSON props are read only from inside the island.
- Headers and CSRF tokens never leave the page's origin unless the origin is listed in `configure({ origins })`.
- Prototype pollution is blocked in `reactive()`, form field names and JSON props.

Every security warning is an `S0xx` code in [`ERRORS.md`](./ERRORS.md) with what, why and fix.
