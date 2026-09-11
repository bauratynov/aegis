## FAQ

**Q: Is it really zero build?** A: Yes. `aegis.js` is one ES module. Import it from a URL or copy the file next to your templates; the `html\`\`` templates are parsed by a tokenizer at runtime, once per template, and cached. A bundler is optional and only buys tree-shaking.

**Q: How is this different from htmx or Alpine?** A: htmx swaps HTML strings; Alpine adds small behaviours. Aegis does both of those (`swap()`, islands) and also has what they leave to you: signals with a dependency graph, a cache with SWR/ETag/offline, a form layer, a router. It is one file with everything, and each part is independent.

**Q: Does the server have to render with JavaScript?** A: No. Any server HTML works. An island adopts the markup that is already there; `adopt()` binds a template to existing DOM with zero mutations; `swap()` and `boost()` bring server fragments in without rewriting them on the client.

**Q: What about TypeScript?** A: Hand-authored `aegis.d.ts` ships with the file and is checked against the runtime on every test run. No build needed: `// @ts-check` in a plain `.js` file gives full IntelliSense.

**Q: How big is it really?** A: What you import. Signals and scopes alone are 7 KB gzip in a production build; islands, templates, lists and events 30 KB; everything with the cache, forms and the router 93 KB as a production build. `node build.mjs --from app.js` emits exactly the subset your app imports.

**Q: Is it production-ready?** A: It runs the admin of a commercial product with a 15-export custom build (26 KB gzip) and passes 1 085 assertions in headless Chrome, Firefox and WebKit on every push. The ten core names are stable through 0.x; five older aliases were removed in 0.8 and nothing is marked `@deprecated` any more.

**Q: Can an AI assistant write Aegis code?** A: That is a design goal. [`llms.txt`](../llms.txt) holds the rules assistants get wrong most, [`AGENTS.md`](../AGENTS.md) the working contract, [`ERRORS.md`](../ERRORS.md) every warning with its fix, and the dev build explains mistakes in the console with the source position.
