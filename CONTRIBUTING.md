# Contributing to Aegis

Thanks for taking the time. Aegis is one file with no dependencies, and the project tries to keep the contribution process the same way: small, direct, well tested.

## Before you start

- Read [`AGENTS.md`](./AGENTS.md) (the working contract) and [`llms.txt`](./llms.txt) (the rules of the engine in one page). They are short.
- Look for an existing issue. For anything larger than a bug fix, open an issue first so the design can be discussed before code exists.
- Security problems go to the address in [`SECURITY.md`](./SECURITY.md), never to a public issue.

## Development

```sh
npm install                 # esbuild, the only dev dependency
npm test                    # node --test test-core.mjs, export set vs aegis.d.ts, tsc over test-types.ts, simulations, tree-shaking budgets
npm run test:browsers       # the full suite (test.html) in headless Chrome and Firefox
npm run build               # aegis.min.js and the core builds
```

`test.html` is the browser suite; open it over HTTP (any static server) to run it interactively. Firefox must be green; Chrome may report a few environment-only failures that the runner marks as such.

## What a good change looks like

- **Tests first.** Every behaviour change comes with a test in `test.html` (DOM) or `test-core.mjs` (signals). A bug fix adds the test that would have caught it.
- **Types and docs together.** Public API changes update `aegis.d.ts` (the export set is checked), the relevant `ERRORS.md` row if a warning is involved, and the README section that documents the feature.
- **No new dependencies.** Runtime dependencies are not accepted; the engine stays one file. Dev dependencies need a strong reason.
- **Size is a feature.** `test-shake.mjs` enforces gzip budgets per subset. If a change grows a subset, say so in the PR and why it is worth it.
- **Warnings explain themselves.** New dev warnings follow the existing shape: a code, what happened, why, how to fix it, and the source position.

## Pull requests

1. Fork, branch from `main`, keep the branch focused on one change.
2. Run `npm test` and `npm run test:browsers`; both must pass.
3. Describe the change in the PR: what, why, and how it was tested. Link the issue.
4. Add a line to `CHANGELOG.md` under *Unreleased*.

Commit messages follow `type(scope): summary` (`feat`, `fix`, `docs`, `perf`, `test`, `chore`).

## Code style

Plain modern JavaScript, no transpilation. Four-space indent, single quotes, semicolons, one statement per line unless a one-liner is clearer. Comments say why, not what. Keep functions small enough to read in one screen.
