## Background tabs, timers and reduced motion

Browsers throttle hidden tabs: `setTimeout`/`setInterval` fire at most once per second (once per minute after 5 minutes in Chrome), `requestAnimationFrame` does not fire at all, and the whole tab may be frozen. Signals, effects and DOM updates keep working synchronously; only time-based helpers are affected:

- `debounced()`, `throttled()`, `interval()`, `timeout()`, `@input.debounce.N` — fire late, in order, never twice.
- `poll()` sleeps in a hidden tab by default (`{ background: true }` to keep polling); `resource({ refetch: { focus } })` refetches when the tab becomes visible.
- Transitions and `spring()`/`tween()` are rAF-driven; a 40 ms timer fallback finishes the CSS contract so `hidden` and classes never get stuck.
- `virtualScroll({ mode: 'window' })` recomputes its window on `visibilitychange`.
- `resource({ offline: true })` yields its IndexedDB connection when another tab upgrades the database and reports a blocked upgrade instead of hanging.

`prefers-reduced-motion` (an OS setting) turns every transition into an instant state change (`defaults.motion === 'auto'`). Tests and demos should pin `defaults.motion = true` or `false` explicitly.
