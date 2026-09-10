## Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge / Opera / Brave / Yandex (Chromium 105+) | full; Navigation API router, View Transitions, `precommitHandler` guards from Chromium 138 |
| Firefox 101+ | full; the router uses the History API path (no Navigation API), guards run before `pushState` |
| Safari 16.4+ | full; the router uses the History API path, `css()` needs no fallback |
| Safari < 16.4 | the reactive core, templates, islands, forms and data work; `css()` needs a fallback |

The reactive core, DOM rendering, islands, forms, the cache and routing work in any browser with ES modules. Navigation API, CSS Anchor Positioning, View Transitions, `CloseWatcher`, Background Sync and `CompressionStream` are progressive: when a browser lacks one, the same call takes the older path and the behaviour is the same, minus the platform extra (one history entry instead of a pre-commit guard, a keydown listener instead of `CloseWatcher`). The suite runs in headless Chrome, Firefox and WebKit on every push ([CI](https://github.com/bauratynov/aegis/actions/workflows/ci.yml)).
