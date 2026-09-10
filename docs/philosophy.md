## Philosophy

1. **Zero build** — Drop one file, start building. No webpack, no vite, no npm required.
2. **Zero dependencies** — Everything is self-contained. No supply chain risk.
3. **Safety by architecture** — Everything created inside a scope dies with it; data never goes through `innerHTML`; attribute sinks are typed at compile time. What the architecture cannot prevent (an effect created outside any scope, a disposed computed still read, an effect cycle) the dev build reports with a code, a why and a fix, and `'strict'` mode turns into an exception.
4. **Progressive enhancement** — Use as little or as much as you need. Each API is independent.
5. **Future-ready** — Built on emerging browser standards (TC39 Signals, Navigation API, CSS Anchor Positioning, View Transitions), with fallbacks for today.

---
