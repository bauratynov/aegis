# Aegis — фреймворк будущего: план на все 165 предложений

> Раунд 1 (R1 #1–93) и раунд 2 (R2 #1–72) — нумерация журналов агентов в порядке линз (полный текст по номеру: `node scratchpad/show-props.cjs R1 52,53 R2 67`). LLM-синтезы `DIAMONDS-FUTURE.md` (80 карточек после дедупликации) и `DIAMONDS-FUTURE-2.md` (66 карточек) нумеруют предложения по-своему; ориентир — названия. Правило владельца: пробовать всё, практика рассудит. Одна фаза = один коммит с зелёными тестами (node + Chrome + Firefox) и отчётом-чекпоинтом; то, что на практике не даёт выигрыша, откатывается внутри фазы с записью «измерено и отклонено».

## Порядок фаз и зависимости

| Фаза | Тема | Предложения | Зависит от |
|---|---|---|---|
| A | Ядро графа и планировщик | R1 52, 53, 55, 57, 43, 38, 54, 49, 51, 45; R2 67, 45, 2, 1, 4 | — |
| B | DOM-движок, list, morph, дельты | R1 39, 40, 87, 88, 93, 42, 19, 89, 21, 91, 56, 92; R2 51, 52, 53, 68, 56, 3, 71, 48, 72 | A |
| C | Безопасность и фронтир платформы | R1 9, 10, 11, 12, 13, 14, 15; R2 54, 58, 33, 57, 59, 60, 61 | B |
| D | Сеть, кэш, распределённая корректность, предикторы | R1 1, 2, 3, 4, 5, 6, 8, 16, 17, 18, 20, 22, 58, 59, 60, 61, 62, 63, 64, 65, 73, 81, 82, 83, 84, 85, 86; R2 70, 13, 69, 7, 32, 34 | A |
| E | Local-first: сущностный граф, живые запросы, протокол синхронизации | R2 8, 9, 10, 11; R1 79 | D |
| F | Стриминг, серверный HTML, resumability | R2 29, 30, 31, 40, 41, 42, 43, 44, 6; R1 74, 90 | B, D |
| G | Формы как система ограничений | R2 35, 36, 37, 38, 39 | A |
| H | Наука взаимодействия и движение | R2 12, 14, 15, 16; R1 80 | B |
| I | DX, причинная диагностика, наблюдаемость, AI-native | R1 23, 24, 25, 26, 27, 28, 29, 30, 75, 76; R2 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 5, 46, 47 | A, B |
| J | Типы и алгебра API | R1 31, 32, 33, 34, 35, 36, 37; R2 49, 50 | A, D |
| K | Архитектура, верификация, экономика внедрения | R1 66, 67, 68, 69, 70, 71, 72, 77, 78, 44, 46, 47, 48, 50, 7; R2 62, 63, 64, 65, 66, 55 | все |

## Чекпоинты

- [x] A — ядро (коммиты 8090d32, d0fdef6 + A3): сделано всё, кроме R1 #45 (program-as-data фаззер с ddmin → фаза K) и I9/I11 из R1 #54 (оракул read-set и дифференциальный batch → фаза K); найден и исправлен баг list() при вставке в хвост; цена: signals-only prod 4.3 → 6.2 KB gzip (heap-планировщик + Кан) — долг фазы K
- [x] B — DOM (коммиты d392aea, 14d61bc, 16ef8ae + B4): сделано всё из списка; bench: create 1000 19.7 → 13.8 мс, create 10000 162 → 113–119, html`` ×1000 6.0 → 2.8; цена: prod admin 14.4 → 20.2 KB gzip, prod islands 21 → 28 KB — долг фазы K
- [x] C — безопасность и платформа (коммиты bc73313 C1, fc95ff2 C2): всё из списка; синхронные guard-ы решают в самом событии navigate (без микротика), precommitHandler — только для асинхронных; `d` в URLPattern — escape, писать `[0-9]`; размерные пороги подняты (+~1 KB gzip, долг фазы K), кроме seeds-по-глубине из R1 #11 (пропущено сознательно: скрипты режут санитайзеры) и Static Routing API/router.patterns() из R2 #60 (нет анкора, отложено в фазу K)
- [ ] D — сеть/кэш: write-epoch fence, HLC для вкладок, session high-water mark, cross-tab single-flight, WAL офлайн-лога, join-semilattice merge, адаптивный троттлинг, decayed statistics, SIEVE cold insert, time-to-viewport gating, Fenwick virtual scroll, PPM-предиктор, token-bucket retry, Gradient2, RTT-оценщик, hedged revalidation, AoI-индекс, backpressure спекуляций, компакция лога, keepalive flush, «одна кэш-дверь», aim-ahead intent, Thompson sampling, Poisson MLE, Kalman scroll, LEDBAT, WAL, сущности, единая политика навигации, Early Hints
- [ ] E — local-first: entity graph, `query()` с IVM, лог намерений с rebase, Sync Protocol v1, shapes, server-written signals
- [ ] F — стриминг/resumability: streaming morph, Merkle-morph, `fragment()`, aegis-loader + QRL-обработчики, сериализованный граф подписок, checkpoint/restore, durable setup, измеритель гидрации, приоритетная гидрация, HTML-addressed handlers, skeleton Merkle hash
- [ ] G — формы: применимость как ограничение, multi-way constraints (DeltaBlue), JSON Schema IR, журнал операций undo/redo, `flow()` statechart
- [ ] H — взаимодействие: `pace()`, вестибулярная таксономия reduced motion, perceptual motion tokens, `progress()`, spring closed-form
- [ ] I — DX/наблюдаемость/AI: `why()`, diagnostics as data/SARIF, единый реестр ошибок, flight recorder, `dev.plan()`, `dev.check()`, dev/prod parity, devtools timeline, explain-by-construction, observational lint, `dev.diagnostics()` с CodeAction, conformance-eval, `describe()`+manifest, WebMCP-мост, генерация llms.txt, scaffold 2.0, `_tel`/telemetry, Web Vitals attribution, SLO-сигналы, sampling profiler, network health, INP-атрибуция, dev.leaks, heap-gate
- [ ] J — типы: executable API algebra, shadow ADT ресурсов, resource algebra, phantom keys, RouteParams, Form<S>, Context<T>, аффинный detach/adopt, реклайм сигналов reactive()
- [ ] K — архитектура/верификация/внедрение: ARCH.json + test-graph, resource без имён стратегий, cap-примитив, бюджеты секций, multi-file distribution, plugin contract, instance identity, morph-фаззер, tether lattice, perf-инварианты CI, TLA+ планировщика, DST через `_rt`, метаморфные тесты, mutation testing, TLA+ кэша, js-framework-benchmark, слой совместимости, политика стабильности, fitness-function CI, матрица 7GUIs, токенизатор O(n)
