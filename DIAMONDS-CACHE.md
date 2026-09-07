# Aegis — Кэш 2045: 16 охотников, 111 предложений

> Оркестрация: 7 линз «видение» + 9 линз «математика». Каждый агент читал aegis_full.js (секции 4, 9, 24, offline), математики запускали симуляции в node. Все ссылки на строки — на момент прогона (aegis_full.js ~8640 строк).

## Таблица приоритетов (impact ↓, effort ↑)

| # | Impact | Effort | Size | Линза | Предложение | Критерий |
|---|---|---|---|---|---|---|
| 4 | 5 | S | +0.1 KB gzip | vision/invalidation-keys | **Починить гонку «invalidate во время in-flight»: force вытесняет летящий запрос (generation counter)** | Тест (fetcher с задержкой 30 мс и версией на сервере): старт GET → изменить версию → `invalidate(key)` → после settled() `data.v === 2` (сей |
| 9 | 5 | S | ~150 B gzip | vision/freshness-consistency | **Read-your-writes: force-refetch обгоняет летящий GET + версия-ограда для seed** | Симуляция A: показан pre-write ответ после invalidate 21.2% → 0% (цена: +1 запрос в 43.7% случаев, когда invalidate попал в in-flight GET).  |
| 22 | 5 | S | +0.1 KB gzip (одно поле, две строки в _f | vision/prefetch-prediction | **freshUntil на записи кэша: prefetch() реально экономит запрос** | test.html: убрать staleTime из теста #111 (строка 1339) — assert «запрос не повторяется» должен проходить; новый тест: prefetch → через 31 s |
| 85 | 5 | S | +120–180 B gzip | math/consistency-versions | **Fetch-эпохи: invalidate()/refresh() во время in-flight помечают запись dirty, а не присоединяются к старому промису** | sim.js B: 1000 сценариев «fetch → мутация на сервере → invalidate во время in-flight»: сейчас stale 1000/1000, с dirty-эпохой 0/1000. Тест:  |
| 99 | 5 | S | +~120 B gzip (Map-индекс + разбор опции  | math/structural-sharing-math | **Keyed structural sharing: матчить элементы массивов по id, а не по индексу** | Тест в test.html: cachedResource с ответом `[{id:1},{id:2}]` → refresh с `[{id:0},{id:1},{id:2}]` → `data.value[1] === prevData[0]` и `data. |
| 1 | 5 | M | +0.35 KB gzip (функция + замена 5 вызово | vision/invalidation-keys | **Канонические иерархические ключи: _normKey вместо «URL как есть»** | Тест: 5 перестановок одного URL → `_resourceCache.size === 1` и один вызов fetcher; `resource({params:{b:1,a:2}, loader, cache:true})` и `{a |
| 2 | 5 | M | +0.4 KB gzip | vision/invalidation-keys | **Грамматика invalidate(): prefix / glob / partial-array / tags / exact, с Promise и режимом refetch** | Тест: 3 entries `/api/users?page=1..3` + `/api/stats`; `invalidate('/api/users*')` → 3 refetch, stats не тронут; `await invalidate(...)` рез |
| 8 | 5 | M | ~0.5 KB gzip (overlay + изменения в muta | vision/freshness-consistency | **Optimistic-слои с rebase вместо snapshot-rollback** | Симуляция B: успешная правка стёрта откатом 47.0% → 0%; A: мигание optimistic до ack 29.5% → 0%. Тест: две параллельные мутации (concurrent: |
| 15 | 5 | M | ~0.5 KB gz (набросок persist: 905 B min  | vision/persistence-multitab | **persist: SWR-кэш переживает перезагрузку (IDB-слой под _resourceCache)** | Тест в test.html: `resource(k,{cache:true,persist:true})` → settled → `reset()` → новый `resource(k,…)` с `defaults.fetcher = () => Promise. |
| 24 | 5 | M | +0.35 KB gzip внутри секции 30 (tree-sha | vision/prefetch-prediction | **Прогрев данных маршрута: router preload запускает loader до клика, handleRoute забирает готовый Promise** | test.html: hover по <a href="/users/1"> → loader вызван 1 раз; click через 100 мс → handler получает те же данные, loader не вызывается повт |
| 30 | 5 | M | ~250 B gzip (esbuild min 331 B → gzip 24 | vision/http-server-first | **Метаданные ответа в CacheEntry: ETag / If-None-Match / 304 в _fetchEntry и offline** | 1) test.html: mockFetch с маршрутом, возвращающим ETag; второй `refresh()` → `net.last().headers['If-None-Match'] === '"v1"'`, ответ 304 → ` |
| 36 | 5 | M | +379 B gzip (esbuild minify + gzip -9 по | vision/dx-observability | **Публичный namespace `cache` с нормализацией ключей и явным GC** | test.html: `cache.keys()` после трёх cachedResource = 3 ключа; `cache.set({b:1,a:2}, x)` и `cache.get({a:2,b:1})` — один ключ; `cache.gc(Dat |
| 37 | 5 | M | +504 B gzip (замер); история только в de | vision/dx-observability | **`cache.explain(key)`: причина каждого решения fetch/skip/join и история записи** | Тест: mount → focus → invalidate для одного ключа даёт ровно `['mount/fetch','focus/fresh'\|'focus/fetch','invalidate/fetch']` через onCache |
| 42 | 5 | M | +0.5–0.7 KB gzip (минус три копии timer- | vision/memory-eviction | **Байтовый бюджет + GDSF-вытеснение вместо таймера cacheTime** | Бенч на трассе из sim.mjs, встроенной в test.html как детерминированный тест с mock fetcher: при budget = пик TTL-политики hit-ratio ≥ 50% ( |
| 50 | 5 | M | +0.35–0.5 КБ gzip (три поля на entry, 4  | math/eviction-theory | **Ограниченный кэш с вытеснением SIEVE вместо неограниченного TTL** | Тест: 2000 уникальных ключей через resource({cache:true}) с dispose → `stats().resourceCache <= 500`, pinned (не disposed) не вытесняются. Б |
| 57 | 5 | M | ≈ 150 B gzip (_staleFor + два вызова + т | math/staleness-ttl | **staleTime: 'auto' — TTL по формуле T* = sqrt(2k/(λ̂·μ̂)) − 1/λ̂** | Тест с fake-timers: mock меняет ответ раз в 60 с, компонент обращается раз в 5 с; после 15 обращений _staleFor(e) ∈ [10 с, 40 с] (T* при k=2 |
| 70 | 5 | M | +0.5–0.7 KB gzip (очередь ~35 строк + 4  | math/coalescing-scheduling | **Планировщик запросов: лимит параллелизма + приоритетные полосы (visible > user > background)** | Тест в test.html: 40 cachedResource с моком, задержка 100 мс, concurrency 6, 8 из них priority:'high' — все 8 high резолвятся раньше любого  |
| 78 | 5 | M | ≈ 500–600 B gzip (куча ~180 B, учёт/выте | math/memory-budget-math | **Байтовый бюджет кэша + cost-aware вытеснение GDSF по idle-записям (куча с ленивым удалением, O(log n))** | Бенч в bench.html: prefetch 2000 URL по 50 KB при maxBytes 8 MB → `cacheStats().bytes ≤ 8 MB`, `performance.memory.usedJSHeapSize` (Chrome)  |
| 84 | 5 | M | +350–450 B gzip (recompute, контекст, co | math/consistency-versions | **Patch-log вместо snapshot-rollback: data = fold(base, pendingPatches)** | sim.js, 100 000 сценариев с 2–3 конкурентными мутациями: snapshot-rollback ошибается в 43 880 (43.9%), при refetch между стартом и откатом — |
| 87 | 5 | M | +500–600 B gzip (коалесценция ≈ +150 из  | math/consistency-versions | **Офлайн-очередь как append-only лог: атомарный enqueue, Idempotency-Key, причинный порядок по cacheKey, dead-letter** | sim.js C: при 2/5/20 конкурентных enqueue сейчас выживает 1/1/1 запись, с per-record put — 2/5/20. Тесты: (а) 4xx-мутация покидает очередь п |
| 92 | 5 | M | +350-450 B gzip | math/retry-backoff | **Circuit breaker per-origin в request(): closed → open → half-open** | Тест: mock fetch → 503 ×5 подряд → 6-й request() отклоняется синхронно (fetch не вызывался, e.circuit === true); через cooldown ровно один в |
| 105 | 5 | M | +0.5–0.7 KB gzip (планировщик ~60 строк) | math/revalidation-scheduling | **Единый планировщик ревалидации `_sched` с token bucket на причину и приоритетной очередью** | 1) sim2.mjs сценарий 1: p50 времени свежести видимых entries при N=40 ≤ 300 мс (сейчас ~1020 мс), число запросов не растёт. 2) Тест в test.h |
| 19 | 5 | L | отрицательная или ~0: −~0.9 KB gz (_offl | vision/persistence-multitab | **Одна модель данных: offline = cached + persist + queue, вместо двух движков** | Все существующие тесты 💎 #17 offlineResource (test.html:3765-3800) проходят без изменений через новый путь. Новый тест: два `resource('/k', |
| 13 | 4 | S | ~300 B gzip | vision/freshness-consistency | **Offline-очередь: exactly-once между вкладками и обработка «ядовитых» мутаций** | Симуляция F: 2 вкладки, 5 мутаций в очереди — 5.0 дублей POST на flush → 0 (Web Locks) и, если lock недоступен, дубли на сервере отбрасывают |
| 16 | 4 | S | ~0.3 KB gz (набросок bc: 627 B min / 414 | vision/persistence-multitab | **BroadcastChannel-шина кэша: set/inv между вкладками** | Тест с двумя `BroadcastChannel` в одной странице (мок `_tabId`): `invalidate('/k')` в «вкладке A» → entry в B имеет `lastFetch===0` и один ` |
| 17 | 4 | S | ~0.25 KB gz (набросок locks: 532 B min / | vision/persistence-multitab | **Web Locks: мьютекс _flushOffline + примитив leader()** | Мок `navigator.locks` в test.html (очередь промисов): два параллельных `_flushOffline` с одной очередью из 5 мутаций → сервер-мок получил ро |
| 18 | 4 | S | ≈0 (набросок queue 531 B gz заменяет сущ | vision/persistence-multitab | **Очередь мутаций как записи mut:<id>, а не один массив под __aegis_mutations__** | Тест с fake-IDB (Map-обёртка `_idb` через `defaults`/`reset`): 20 параллельных `_enqueueOffline` → 20 записей (сейчас теряются); flush при о |
| 28 | 4 | S | +0.3 KB gzip (экспорт speculate + 2 стро | vision/prefetch-prediction | **speculate(): Speculation Rules для server-first MPA-страниц + корректный hydrate() в prerendered-документе** | Chrome DevTools → Application → Speculative loads показывает правила и статус «Ready» после hover ≥ 200 мс; переход по prefetched ссылке даё |
| 31 | 4 | S | ~330 B gzip (533 B min / 327 B gzip изол | vision/http-server-first | **staleTime: 'http' — Cache-Control / Age / Expires / stale-while-revalidate как источник свежести** | 1) Таблица из 5 случаев выше — юнит-тест парсера в test.html (Headers доступен в браузере). 2) Интеграция: mockFetch отдаёт `Cache-Control:  |
| 32 | 4 | S | ~170 B gzip | vision/http-server-first | **Серверная инвалидация: заголовок ответа Aegis-Invalidate (аналог HX-Trigger)** | test.html: два cached-ресурса (/api/users?page=1, /api/stats) + mockFetch, где `POST /api/users` возвращает Response с заголовком Aegis-Inva |
| 33 | 4 | S | ~250 B gzip (+ ~290 B для dev-предупрежд | vision/http-server-first | **seedFrom как нулевой уровень HTTP-кэша: data-aegis-etag / data-aegis-max-age и потребление <link rel=preload as=fetch> / 103 Early Hints** | 1) test.html: `<script data-aegis-cache data-aegis-etag='"v1"'>` → seedFrom → `refresh()` → `net.last().headers['If-None-Match'] === '"v1"'` |
| 38 | 4 | S | ≈ +600 B gzip (строки what/why/fix — осн | vision/dx-observability | **Четыре предупреждения кэша с точным what/why/fix (E038–E041) + починка дубля E035** | Сценарии C/D/E симуляции дают ровно по одному коду (E039, E040 с подсказкой '/api/todos', E038) вместо []; фокус с 8 смонтированными cached- |
| 40 | 4 | S | +49 B gzip в ядре (useClock/_now); fakeC | vision/dx-observability | **Детерминированное время: `useClock()` + `cache.gc(now)` + `fakeClock()` в aegis-test.js** | Тесты на истечение staleTime и на GC по cacheTime выполняются < 5 мс (сейчас: GC-тест невозможен, staleTime-тест — только через глобальный с |
| 56 | 4 | S | ≈ 250 B gzip (поля entry + 10 строк в _f | math/staleness-ttl | **Наблюдать μ̂ (частоту изменений) и λ̂ (частоту обращений) на CacheEntry + cacheStats() + E038 «staleTime слишком мал»** | Тест в test.html: mock-fetcher возвращает одинаковый JSON 12 раз при staleTime 0 → muHat > 0, unchanged === 11, E038 сработал ровно один раз |
| 68 | 4 | S | +0.3 KB gzip в ядре (счётчики + Beta + E | math/prefetch-prediction-math | **Учёт исхода prefetch: hit/waste в entry, Beta-калибровка P(use \| триггер), stats().prefetch, E038 и вкладка в dev-панели** | Тест с fake timers: 10 prefetch(kind:'hover') без последующего resource() + cacheTime 100 мс → после 150 мс stats().prefetch.wasted === 10,  |
| 71 | 4 | S | +0.35 KB gzip (~25 строк), tree-shakeabl | math/coalescing-scheduling | **batched(): DataLoader-склейка loader-ресурсов в одно окно (микротаск / кадр)** | Тест: 60 `resource({loader: batched(fn)})` в одном mount → fn вызван 1–2 раза (max=50), каждый ресурс получил свои данные; abort одного не л |
| 73 | 4 | S | +0.25 KB gzip (общий helper для plain и  | math/coalescing-scheduling | **debounce/maxWait для реактивного source: склейка нажатий в typeahead с гарантированной границей задержки** | Тест: 10 синхронных изменений сигнала за 500 мс при debounce 150 → 1 fetch; изменения каждые 100 мс в течение 2 с при {wait:150,maxWait:600} |
| 90 | 4 | S | +250 B gzip в dev-ветке (tree-shakeable  | math/consistency-versions | **Формальные инварианты CacheEntry: dev-проверка после каждой операции + model-based фаззинг в test.html; idempotent dispose** | sim.js D: модель текущего кода за 500×200 шагов даёт 2380 нарушений I3 (inflight), 12 303 нарушений I1 (refCount после двойного dispose), 26 |
| 91 | 4 | S | +60-90 B gzip | math/retry-backoff | **Retry-After как нижняя граница + джиттер + cap (и RateLimit-Reset)** | Тест: fetcher, 20 параллельных withRetry получают 503 c Retry-After: 1 → все повторы попадают в окно [1000, 2000) мс, а не в один тик (разбр |
| 95 | 4 | S | +120-150 B gzip | math/retry-backoff | **Джиттер и стаггер для reconnect/focus-ревалидации и офлайн-flush** | Тест: 10 cached-ресурсов, dispatch('online') → первый fetch не раньше 0 мс и не позже reconnectJitter, между fetch'ами ≥ 40 мс, всего 10 выз |
| 100 | 4 | S | +~40 B gzip | math/structural-sharing-math | **Ленивая материализация в _share: ноль аллокаций на идентичный ответ, один Object.keys** | bench.mjs раздел A: время ≤ 0.8× текущего, heapΔ на идентичный ответ 10k строк < 20 KB (сейчас ~580 KB). Тест: `_share({a:1,b:undefined},{a: |
| 106 | 4 | S | +0.25 KB gzip | math/revalidation-scheduling | **Приоритет ревалидации по видимости и возрасту через `scope.el.checkVisibility()`** | sim2.mjs сценарий 1 (видимые в случайных позициях Map): visibleFreshMax N=80 — 2820 → 500 мс. Тест: 3 cached entries, у двух host-элемент с  |
| 3 | 4 | M | +0.45 KB gzip | vision/invalidation-keys | **Теги: клиентские + серверные (Cache-Tag-подобный заголовок) с индексом Map<tag, Set<entry>>** | Тест: два ресурса с общим тегом и один без → `invalidate({tags:'users'})` перезапрашивает ровно два; мок-Response с `Aegis-Tags: users` → en |
| 5 | 4 | M | +0.4 KB gzip (BroadcastChannel-часть tre | vision/invalidation-keys | **Серверная инвалидация: заголовок Aegis-Invalidate, SSE-событие aegis-invalidate, BroadcastChannel между вкладками** | Тест: мок `_config.fetch` отдаёт Response с `Aegis-Invalidate: /t/list*` на POST → cached `/t/list?page=1` перезапрошен без опции invalidate |
| 6 | 4 | M | +0.35 KB gzip | vision/invalidation-keys | **Граф между записями: cross-seeding список → детали и mutation({ updates }) без refetch** | Тест: список из 3 пользователей с seeds → `resource('/api/users/2', {cache:true})` даёт data синхронно и fetcher вызван 0 раз до staleTime;  |
| 10 | 4 | M | ~0.6 KB gzip | vision/freshness-consistency | **Entity fan-out: причинная согласованность список ↔ элемент без refetch** | Симуляция C: 60 entries × 50 объектов, один patchEntity = 0.22 мс (6 entry затронуто, остальные сохраняют identity). Тест: правка имени в it |
| 12 | 4 | M | ~0.7 KB gzip (meta + If-Match + merge3 + | vision/freshness-consistency | **Версии и конфликты: ETag → If-Match, 412 → 3-way merge** | Симуляция E: клиент и сервер правят по 1 полю из 5 — 80% сливаются автоматически, 20% всплывают как конфликт (сегодня 100% тихий lost update |
| 23 | 4 | M | +0.4 KB gzip хелпер, −0.3 KB за счёт уда | vision/prefetch-prediction | **Единый детектор намерения _intent(): velocity-gated hover с отменой для prefetchOn, router.preload и boost.prefetch** | test.html: синтетические PointerEvent — быстрый пролёт (3 pointermove за 40 мс, 60 px) → 0 fetch; замедление (pointermove с v=100 px/s) → fe |
| 25 | 4 | M | +0.45 KB gzip (хелпер + очередь + 5 точе | vision/prefetch-prediction | **Центральный бюджет сети _netBudget(): уровни по navigator.connection, лимит одновременных спекуляций, priority hints везде** | test.html: подменить navigator.connection = { saveData: true } (Object.defineProperty) → prefetch()/prefetchOn(hover)/island warm дают 0 выз |
| 34 | 4 | M | ~280 B gzip | vision/http-server-first | **Персистентный SWR-кэш через Cache API: Response с заголовками вместо JSON в IDB** | Браузерный тест: `resource(url, { cache: { persist: true } })` → `await ready()` → `reset()` + новый `resource(url, ...)` → `data.peek() !== |
| 39 | 4 | M | +205 B gzip в ядре (снимок); UI в aegis- | vision/dx-observability | **Вкладка «cache» в dev-панели: ключи, возраст, подписчики, размер, история, действия** | Замер снимка: 200 entries × 50 объектов (555 KB JSON) — 1.92 мс на тик, 0.38 % бюджета 500 мс. На demo/admin.html после клика по «Delete» вк |
| 46 | 4 | M | +0.4 KB gzip | vision/memory-eviction | **GC согласованный со scope-деревом: tier «страница» для back-навигации** | Тест с mock router: открыть A → B → C → D → E → F (6 страниц, cacheTime=0, budget 200 KB), затем назад к B: `loading.value === false` и 0 fe |
| 48 | 4 | M | +0.4 KB gzip (в offline-секции — tree-sh | vision/memory-eviction | **Квота для offline IndexedDB: вытеснение по timestamp и storage.estimate()** | Тест (fake-indexeddb в node или test.html в браузере): 200 записей по 100 KB при quota 5 MB → после sweep ≤ 3.5 MB и остались самые новые 35 |
| 59 | 4 | M | ≈ 250 B gzip (meta в request, ttl в entr | math/staleness-ttl | **Свежесть, объявленная сервером: staleTime: 'header' (Cache-Control: max-age / Age) и data-aegis-stale в seedFrom** | Тест с _config.fetch-моком: Response с `Cache-Control: max-age=30, Age: 10` → второй resource(...,'header') через 15 с не делает запрос, чер |
| 60 | 4 | M | ≈ 200 B gzip (сентинел, заголовок, ветка | math/staleness-ttl | **ETag / If-None-Match / 304 в _fetchEntry: удешевить c_f и получить точный сигнал «не изменилось»** | Тест с _config.fetch-моком: первый ответ 200 + ETag "v1"; последующие запросы содержат If-None-Match: "v1" и получают 304 → r.data identity  |
| 62 | 4 | M | ≈ 150 B gzip (ветка в _cachedResource +  | math/staleness-ttl | **Адаптивный polling для cached-ресурсов: refetch.interval: 'auto' с интервалом sqrt(2k/μ̂)** | Тест с fake-timers: mock меняет ответ раз в 60 с виртуального времени; refetch.interval 'auto' (min 2 с, k 20) — за 30 виртуальных минут ≤ 6 |
| 65 | 4 | M | +0.3–0.4 KB gzip (замер rtt/bytes + _uti | math/prefetch-prediction-math | **Порог полезности: prefetch только если p × E[сэкономленная латентность] > cost(сеть)** | Unit-тест с fake fetcher (длительность 300 мс, navigator.connection замокан {downlink: 0.4, effectiveType: '3g'}): prefetch(url, {p: 0.2}) н |
| 67 | 4 | M | +0.5 KB gzip (idle-хук в router/boost +  | math/prefetch-prediction-math | **Идл-предвыборка следующего маршрута по предиктору с token-bucket бюджетом и abort при реальной навигации** | Тест с fake router и 3 ссылками в outlet: после 3 переходов A→B в idle-коллбеке вызывается preload только для B (p ≥ 0.3), для C/D — нет; пр |
| 76 | 4 | M | +0.3 KB gzip (gate ~12 строк + promote в | math/coalescing-scheduling | **Видимость как приоритет: resource(url, { visible: el }) и понижение приоритета для offscreen** | Тест: 40 resource с visible на элементах вне viewport (jsdom-полифилл IO) → fetchCount === 0 до триггера intersect; после intersect у 8 элем |
| 81 | 4 | M | ≈ 250–300 B gzip (WeakRef/FinalizationRe | math/memory-budget-math | **Реакция на memory pressure: бюджет от deviceMemory, WeakRef-ghost-tier для вытесненных, сброс на freeze/hidden** | Тест (Chrome, `--js-flags=--expose-gc`): вытеснить запись по бюджету, сразу запросить снова → `cacheStats().ghostHits === 1`, fetch не выпол |
| 86 | 4 | M | +400–500 B gzip | math/consistency-versions | **Межвкладочная когерентность SWR-кэша: BroadcastChannel + Lamport-метка (v, tabId) с LWW** | Тест в test.html с двумя BroadcastChannel в одном документе (второй эмулирует вкладку): после мутации в «A» запись в «B» получает data без в |
| 88 | 4 | M | +250–300 B gzip | math/consistency-versions | **Сериализуемые мутаторы для offline: base и pending-патчи хранятся раздельно и переигрываются после перезагрузки** | Тест: send() офлайн с ['add', item] → эмулировать reload (новый resource() на том же ключе, in-memory _idb-мок) → data содержит item, IDB[ke |
| 89 | 4 | M | +450–550 B gzip (merge3 ≈ 200) | math/consistency-versions | **Обнаружение конфликтов при одновременных мутациях: version/ETag + If-Match + onConflict с 3-way merge** | Тест: мок-сервер с ETag; два mutation() на одном ресурсе с разными полями name/email → после конфликта merge3 даёт объект с обоими изменения |
| 97 | 4 | M | +250-300 B gzip (в offline-секции, tree- | math/retry-backoff | **Офлайн-очередь: Idempotency-Key, dead-letter для 4xx, лимит попыток на мутацию** | Тест: mock request → 422 для одной мутации → после первого flush она в __aegis_dead__, queue пуста, _offlineBackoff сброшен в 1000, syncing= |
| 102 | 4 | M | +~450 B gzip, отдельный export (tree-sha | math/structural-sharing-math | **Дельта-ревалидация: JSON Patch / Merge Patch с сервера и immutable applyPatch** | Тест: applyPatch на 10k-массиве с 10 replace — все незатронутые строки `===` prev (9990/10000), затронутые новые; RFC 6902 test-suite (add/r |
| 109 | 4 | M | +0.5 KB gzip | math/revalidation-scheduling | **Polling для cached resource через один min-heap таймер с выравниванием к сетке и сном в фоне** | 1) sim2.mjs: пробуждения таймера за 10 мин с 12 entries ≤ 350 при G=1000 (сейчас было бы 455 при per-entry реализации), запросов не больше.  |
| 7 | 3 | S | +0.25 KB gzip (реестр + E039), devtools- | vision/invalidation-keys | **Единый реестр инвалидации для трёх движков + dev-панель «Cache» и E039 «invalidate ничего не нашёл»** | Тест: offline-ресурс + `invalidate(url)` → refresh вызван (сейчас 0); `_offlineRefreshers` удалён, тест на flush-refresh (:8014) проходит че |
| 11 | 3 | S | ~0.4 KB gzip | vision/freshness-consistency | **Свежесть как непрерывный сигнал: updatedAt/fresh + revalidateOn:'stale' через один планировщик** | Симуляция D: 40 entries, staleTime 30 с — максимальный возраст показанных данных ровно 30000 мс против 34887 мс при polling 5 с; активных та |
| 14 | 3 | S | ~350 B gzip (BroadcastChannel + применен | vision/freshness-consistency | **Cross-tab и server-push согласованность: BroadcastChannel + SSE-инвалидация** | Тест с моком BroadcastChannel: запись во вкладке A → вкладка B показывает данные через одно сообщение (≤10 мс, 0 fetch для 'set', 1 fetch дл |
| 29 | 3 | S | +0.3 KB gzip в основном модуле (счётчики | vision/prefetch-prediction | **Наблюдаемость спекуляций: hit/waste-счётчики в stats(), вкладка в dev-панели, E0xx при низком проценте попаданий** | test.html: prefetch('/a') затем resource('/a',{cache:true}) → stats().speculation.hit === 1, lead ≥ 0; prefetch('/b') + fake timers до cache |
| 41 | 3 | S | +52 B gzip | vision/dx-observability | **Типизированные ключи кэша: `cacheKey` + `CacheKey<T>` сквозь resource / seed / cache.get / invalidate** | test-types.ts: `seed(statsKey, { wrong: 1 })` — `@ts-expect-error`; `resource(statsKey, { cache: true }).data.value` имеет тип `Stats \| nul |
| 43 | 3 | S | +0.25 KB gzip | vision/memory-eviction | **Оценка размера записи: сэмплирующий обход с калибровкой, без JSON.stringify** | На фикстуре из 20 реальных ответов demo/admin.html (users, stats, страницы списка) отношение `_sizeOf / heapUsed` лежит в 0.7–1.5; время оце |
| 44 | 3 | S | +0.15 KB gzip | vision/memory-eviction | **Приоритеты записей и pin: prefetch вытесняется первым, seed/pinned — последними** | Тест: budget = 100 KB, 5 prefetch по 30 KB + 1 seed 30 KB + 1 pinned 30 KB → после _trim в кэше остаются seed, pinned и максимум один prefet |
| 45 | 3 | S | +0.2 KB gzip | vision/memory-eviction | **Реакция на фон и memory pressure: budget по deviceMemory, ужатие в hidden/freeze** | Тест в test.html: подменить `document.visibilityState` на 'hidden' + fake timers 30 с → `stats().cache.bytes ≤ 0.25 × budget`, при этом запи |
| 51 | 3 | S | ≈0 (три setTimeout-сайта → один setInter | math/eviction-theory | **cacheTime через lazy + active expiration (один sweep) вместо setTimeout на каждую entry** | Юнит-тест: 1000 seed() + 1000 release → `stats().timers === 1` (добавить счётчик в stats) вместо 2000 handles; после cacheTime + period entr |
| 58 | 3 | S | ≈ 80 B gzip поверх предложения 2 (одна в | math/staleness-ttl | **maxStale: бюджет доли устаревших чтений вместо абстрактного k (T = 2p/μ)** | Юнит: _staleFor({}, { maxStale: 0.05, changeEvery: 300_000 }) === 31000 ± 1000 (совпадает с бисекцией sim2). Сквозной тест с fake-timers: из |
| 61 | 3 | S | ≈ 120 B gzip | math/staleness-ttl | **Вероятностная ревалидация по focus/reconnect: P(changed \| age) = 1 − e^(−μ̂·age) ≥ p вместо глобального 5-секундного throttle + джиттер против «стада»** | Тест: 20 cached-ресурсов с μ̂ = 1/600 (задать через seed + принудительные наблюдения или напрямую e.muHat в тесте) и age 30 с; dispatch 'vis |
| 64 | 3 | S | +0.2 KB gzip поверх predictor (парсинг в | math/prefetch-prediction-math | **Серверный prior для предиктора: data-aegis-predict в HTML как pseudo-counts** | sim-markov.mjs: с prior top-1 в сессии 1 ≥ 35% (сейчас 39.1%) при κ=5; после дрейфа с несвежим prior κ=5 обгоняет κ=20 минимум на 4 п.п. (26 |
| 66 | 3 | S | +0.35 KB gzip (гистограммы + choose + оп | math/prefetch-prediction-math | **Адаптивная задержка hover-intent вместо фиксированных 80 мс (онлайн-гистограммы dwell)** | sim-hover2.mjs: \|U(adaptive) − U(oracle)\| ≤ 2 мс/hover во всех 12 режимах (сейчас max 1.4), и U(adaptive) ≥ U(d=80) везде. Unit-тест с fak |
| 72 | 3 | S | +0.2 KB gzip (dirty-set ~15 строк; inval | math/coalescing-scheduling | **Склейка invalidate/revalidate: dirty-set + микротаск-флаш + отправка через планировщик** | Тест: mutation с invalidates из 3 предикатов, совпадающих с одной entry → ровно 1 refetch (сейчас `_fetchEntry` с force=true и `if (e.promis |
| 74 | 3 | S | +0.3 KB gzip; poll() при этом упрощается | math/coalescing-scheduling | **Poll-хаб: выровненные тики, один таймер на интервал, polling для cached через revalidateOn** | Тест: 10 poll(fn, 100) → за 1 с все 10 fn вызваны 10 раз и каждый раз в одном макротаске (разница timestamps внутри тика < 5 мс); cached с { |
| 75 | 3 | S | +0.3 KB gzip (~18 строк) | math/coalescing-scheduling | **In-flight dedupe для plain resource: превратить E029 из предупреждения в фикс** | Тест: два `resource('/test/x')` в одном mount → fetchCount === 1, `r1.data !== r2.data` (сигналы свои), E029 не сработал; `r1.abort()` не пр |
| 77 | 3 | S | ≈ 300–350 B gzip | math/memory-budget-math | **_sizeOf(): структурная оценка байтов записи без сериализации (с выборкой на массивах)** | На 6 синтетических payload (см. algorithm) отношение est/heap в диапазоне 0.95–1.20; время оценки ≤ 0.1 мс для массива 10k строк (сейчас JSO |
| 79 | 3 | S | −50…+80 B gzip (удаление трёх таймер-сай | math/memory-budget-math | **Убрать per-entry setTimeout: ленивое истечение + один sweep; починить cacheTime: Infinity** | Тест: 1000 prefetch → в dev `stats().timers` (или мок setTimeout) = 1, не 1000. Тест: `resource(url, {cache:{cacheTime: Infinity}})`, dispos |
| 80 | 3 | S | ≈ +60–90 B gzip | math/memory-budget-math | **_share без churn: аллоцировать копию только при первом отличии + порог узлов** | Тест: `_share(a, deepClone(a)) === a` и счётчик аллокаций (мок через Proxy на Array/Object невозможен — считать через `performance.memory` d |
| 93 | 3 | S | +150-200 B gzip | math/retry-backoff | **Retry budget на клиент: усиление ≤ 1 + budget** | Тест: fetcher всегда 503, 50 resource(url_i, { retry: 3 }) в одном scope → суммарно вызовов fetcher ≤ 50 + 0.2·50 + 10 = 70 (сейчас 200). Си |
| 94 | 3 | S | +120-160 B gzip | math/retry-backoff | **Повтор по времени, не по счётчику: retry: { for } + decorrelated jitter + deadline** | Тест с fake timers: retry: { for: 5000 } при вечном 503 → resource.error выставлен не позже 5000 мс (последний сон урезан), число вызовов fe |
| 96 | 3 | S | +70-100 B gzip | math/retry-backoff | **Adaptive polling: backoff при ошибках и фазовый джиттер интервала** | Тест с fake timers: poll с backoff, fn отвергает 3 раза подряд → задержки в пределах [ms·2^k·0.9, ms·2^k·1.1] для k=1..3; после успеха следу |
| 98 | 3 | S | +90-120 B gzip | math/retry-backoff | **Намерение пользователя прерывает backoff: refresh()/invalidate() во время сна повтора** | Тест с fake timers: cached-ресурс, fetcher 503, retry: 3; после первой ошибки (спит ≤ 1 с) вызвать refresh() через 10 мс → второй вызов fetc |
| 101 | 3 | S | +~90 B gzip (WeakMap + ветка в _parseBod | math/structural-sharing-math | **Fast-path по отпечатку до обхода дерева: 304 → сырой текст → tree share** | Бенч: ревалидация 10k строк с идентичным ответом — ≤ 0.2 мс на сравнение (vs 6 мс), heapΔ ≈ 0. Тест: два fetch одного URL с одинаковым телом |
| 103 | 3 | S | +~250 B gzip в full (dev-ветка), 0 в cor | math/structural-sharing-math | **Dev-диагностика доли переиспользования: E038 «volatile field убивает identity строк»** | Тест (dev): ответ из 20 строк, во втором ответе у всех изменён только `updatedAt` → ровно одно предупреждение E038 с текстом «updatedAt»; по |
| 107 | 3 | S | +0.1 KB gzip | math/revalidation-scheduling | **Накопление причин в скрытой вкладке и flush на visible (не терять reconnect)** | Тест test.html: cached entry с `revalidateOn: ['reconnect']`, эмуляция `document.hidden = true` → dispatch 'online' → `hidden = false` + vis |
| 111 | 3 | S | +0.2 KB gzip | math/revalidation-scheduling | **Джиттер и экспоненциальный backoff ревалидации на ошибке (без вечных повторов при focus)** | Тест: fetcher бросает HttpError 503, cached entry с revalidateOn ['focus']; 10 focus-событий с шагом 6 с (bucket пропускает все) → ≤ 3 запро |
| 20 | 3 | M | ядро +~0.15 KB gz (swBridge 204 B gz отд | vision/persistence-multitab | **Service Worker как слой: aegis-sw.js с обработчиком sync и мостом в страницу** | Ручной сценарий в Chrome: admin.html + sw.js с `handleSync`; DevTools → Offline, 2 сохранения, закрыть вкладку, снять Offline → сервер-лог п |
| 21 | 3 | M | ~0.15 KB gz polling (sharedPoll 215 B gz | vision/persistence-multitab | **Лидер-вкладка держит polling и SSE, остальные получают данные по шине** | Бенч по мотивам DIAMONDS-2 #106: 5 видимых окон admin.html Dashboard с `refetch.interval: 5000`, 10 минут: сейчас 5×120 = 600 запросов /api/ |
| 26 | 3 | M | +0.35 KB gzip; −0.1 KB за замену персона | vision/prefetch-prediction | **Адаптивный горизонт прогрева по скорости скролла для visible-островов, prefetchOn(visible) и lazy()** | test.html: зафиксировать scrollY через Object.defineProperty и слать scroll-события с шагом 100px/16мс (≈6000 px/s) → элемент на 2500px ниже |
| 27 | 3 | M | +0.6 KB gzip, отдельный экспорт (tree-sh | vision/prefetch-prediction | **predict(): локальный граф переходов (Markov 1-го порядка) в localStorage → прогрев top-K следующих страниц на idle** | test.html (jsdom localStorage): 20 синтетических переходов A→B (15), A→C (5) → predict после захода на A даёт warm('B') при topK=1, warm('B' |
| 52 | 3 | M | +0.15–0.2 КБ gzip в core (счётчики под _ | math/eviction-theory | **MRC-телеметрия кэша: hit ratio, one-hit-wonders и «что даст maxEntries=N» через гистограмму reuse-distance** | Тест: реплей SPA-трассы из sim3.mjs через seed/use под dev-режимом → `stats().cache.mrc[C]` отличается от измеренного hit ratio LRU-симуляци |
| 53 | 3 | M | +0.35 КБ gzip | math/eviction-theory | **Ограничить IndexedDB-store offline-режима: lastAccess + амортизированная обрезка старейших 10 %** | Тест (test-browsers.mjs, Chrome+Firefox): 1000 разных URL через resource({offline:{maxEntries:100}}) → `await store.keys()` даёт ≤ 111 ключе |
| 63 | 3 | M | +0.7–0.9 KB gzip (модель + persist + под | math/prefetch-prediction-math | **predictor(): марковская цепь первого порядка по паттернам маршрутов с забыванием и persist** | На sim-markov.mjs (node, без зависимостей): top-1 предиктора ≥ uniform + 8 п.п. (сейчас 27.3% vs 16.7%) и монотонный рост между сессиями 1 и |
| 82 | 3 | M | ≈ +120–180 B gzip | math/memory-budget-math | **Offline-очередь: O(1) enqueue (запись на мутацию) и байтовая квота через _sizeOf + storage.estimate()** | Тест (fake-indexeddb или браузерный test.html): 1000 send() офлайн → суммарное время enqueue ≤ 50 мс (сейчас ≈ 3 с в node-модели; в IDB ещё  |
| 110 | 3 | M | +0.4 KB gzip (opt-in, tree-shakeable есл | math/revalidation-scheduling | **Лидер среди вкладок для polling/focus-revalidate через Web Locks + BroadcastChannel** | Открыть demo/admin.html в 4 вкладках с `interval: 5000, shared: true` на /api/stats: в DevTools Network суммарно ≤ 13 запросов/мин (сейчас 4 |
| 35 | 2 | S | ~150 B gzip (парсер Link + total) | vision/http-server-first | **Link: rel="next" (RFC 8288) как курсор в infiniteResource и next/prev для cached-страниц** | test.html: mockFetch отдаёт `Link: </api/feed?after=abc>; rel="next"` и `X-Total-Count: 42` → `feed.hasMore === true`, `feed.total === 42`,  |
| 47 | 2 | S | −0.1 KB gzip (удаляются три копии timer- | vision/memory-eviction | **Одна ленивая развёртка вместо setTimeout на запись и dev-only имена сигналов** | entry-cost.mjs в production-режиме: seed() ≤ 800 байт/запись (сейчас 1125), cachedResource() ≤ 3300 байт (сейчас 3896); после создания и dis |
| 49 | 2 | S | +0.2 KB gzip | vision/memory-eviction | **FinalizationRegistry как страховка от зависших refCount (dev-warning + self-heal)** | Тест в Chrome (test.html, с `--js-flags=--expose-gc` в test-browsers.mjs): создать resource(url, {cache:true}) в root без scope, обнулить сс |
| 54 | 2 | S | +0.12 КБ gzip (поверх P1) | math/eviction-theory | **Байтовый бюджет `maxBytes` тем же SIEVE — без GDSF** | Тест: 100 ответов по 100 КБ при maxBytes = 2 МБ → `stats().cache.bytes <= 2.2 МБ`, `resourceCache <= 21`; pinned entry не вытесняются даже с |
| 55 | 2 | S | +0.1 КБ gzip | math/eviction-theory | **Ghost-список для prefetchOn: не прогревать повторно то, что уже вытеснялось неиспользованным** | Тест: prefetch 600 ключей при maxEntries=500 без use() → следующие prefetch(…, {intent:'hover'}) по первым 100 ключам не вызывают fetcher (0 |
| 69 | 2 | S | 0 KB в бандле (только экспорт 2–3 внутре | math/prefetch-prediction-math | **Синтетический бенчмарк предвыборки в репозитории: test-prefetch-sim.mjs с регрессионными порогами** | Скрипт выполняется < 2 с в node без зависимостей и детерминирован (два запуска — идентичный вывод). Все четыре порога проходят на текущих ре |
| 83 | 2 | S | ≈ +100 B gzip | math/memory-budget-math | **infiniteResource: окно maxPages — O(maxPages) памяти вместо O(всех страниц)** | Тест: 30 loadMore с maxPages 10 → `feed.pages.value.length === 10`, `feed.data.value.length === 10·pageSize`, `hasPrev.value === true`, load |
| 104 | 2 | S | −~30 B (убрать no-op) / +~120 B с keyed- | math/structural-sharing-math | **infiniteResource: `_share` сейчас no-op, сделать keyed-share на reset()/refresh** | Тест: 2 страницы по 10 строк → reset() → первая страница содержит 8 старых id + 2 новых → renderFn list() вызван 2 раза, `data.value[k] ===  |
| 108 | 2 | S | +0.05 KB gzip | math/revalidation-scheduling | **Убрать trailing edge в focus-throttle plain resource: leaky bucket вместо `throttled()`** | Тест: plain resource с `refetch:{focus:true}`, 5 focus-событий за 3.2 с с моком `Date.now`, продвинуть таймеры на 6 с → 1 fetch (сейчас 2).  |


---

# 🔭 invalidation-keys

**Линза:** vision / invalidation-keys — ключи, инвалидация, теги, граф зависимостей, серверная инвалидация

**Вывод:** Сейчас кэш Aegis — плоский Map «URL-строка как есть → entry» (aegis_full.js:5736, :5980, :5913), а invalidate() — линейный скан с точным равенством или предикатом (:6055–6062), который достаёт только SWR-entries: offline-ресурсы живут в отдельном реестре _offlineRefreshers (:7955, :8100–8104), plain resource() не адресуется вообще. Поэтому демо трижды повторяет `invalidates: (k) => k.startsWith('/api/users') || k === '/api/stats'` (demo/admin.html:117,121,157), а offline-Settings (:185–186) не инвалидируется никак. Найден баг в самой семантике инвалидации: `_fetchEntry(…, force=true)` присоединяется к уже летящему запросу (:5822 стоит после проверки force), поэтому invalidate() во время focus-ревалидации возвращает данные ДО мутации (симуляция: v1 вместо v2). Главный вывод: server-first движку не нужен нормализованный граф Apollo/Relay — достаточно (1) канонических иерархических ключей, (2) тегов с индексом Map<tag, Set<entry>> (0.1–25 µs вместо 300 µs скана на 10k записей), (3) единого реестра инвалидации для трёх движков и (4) серверного канала инвалидации (заголовок ответа + SSE + BroadcastChannel). Всё вместе ~1.5 KB gzip и ложится в существующие секции 4, 9, 24.

**Отвергнуто:** Полная нормализация по сущностям (Apollo InMemoryCache / Relay store / urql graphcache с __typename+id): требует схемы или конвенций о форме JSON, +8–15 KB gzip и ломает server-first (ответ — не граф, а HTML/JSON фрагмент); предложение 6 берёт от них только «обновить кэш ответом мутации» и cross-seeding. Trie/radix-индекс ключей для prefix-инвалидации: симуляция показала 8 µs на 200 entries и 50 µs на 2000 — реальные SPA-кэши на порядок меньше, индекс не окупает +300 B; индекс нужен только для тегов (Map<tag,Set>), где он тривиален. ETag/If-None-Match/304 — зафиксировано как известный пробел, относится к линзе transport, не keys. Persist SWR-кэша в storage — известный пробел, отдельная линза. Инвалидация по времени сервера (`Aegis-Stale-At`/`Cache-Control: max-age` → staleTime) — полезно, но это уже линза «freshness», не invalidation; отмечу лишь, что WeakMap-канал заголовков из предложения 3 делает её дешёвой. Функции-паттерны через BroadcastChannel — не сериализуются, в предложении 5 шлём только строки/массивы/объекты. Инвалидация «по mutation-scope» (TanStack v5 `scope`): очередь мутаций одной сущности уже есть через `concurrent: 'queue'` (:3729), отдельной абстракции не нужно.

## 💎 #1 — Канонические иерархические ключи: _normKey вместо «URL как есть»

**Impact:** 5 · **Effort:** M · **Size:** +0.35 KB gzip (функция + замена 5 вызовов)

**Сейчас:** Ключ SWR-кэша — сырая строка: `_cacheEntry(explicitKey ?? nextUrl)` (aegis_full.js:5980), prefetch — `opts.key ?? url` (:5913), seed(key) (:5873). Для loader-формы `_keyOf` (:3525) делает JSON.stringify(a) — порядок полей объекта = порядок вставки; `_cachedResource` loader не поддерживает вовсе (:5967 resolveUrl берёт source как URL). Симуляция (scratchpad/agents/invalidation-keys/sim.mjs, блок a): 5 вариантов одного запроса (`?q=a&page=1`, `?page=1&q=a`, хвостовой `&`, пустой `sort=`, `#top`) → 5 entries, 5 запросов; `{id,page}` vs `{page,id}` → 2 ключа.

**Предложение:** Ввести в §9 одну функцию `_normKey(a)`: строка → канонический URL (query отсортирован по имени и значению, пустые значения и хвостовые `?`/`&` убраны, `#fragment` отброшен); массив → иерархический ключ `parts.join('\0')` (TanStack-style `['users', 42, 'orders']`), объект → stable-JSON с отсортированными ключами. Использовать её во всех четырёх точках (_cachedResource.use, prefetch, seed, _plainResource.key) и в invalidate(). Это одновременно чинит `resource({params, loader, cache:true})`: ключом становится `_normKey(params)`, а URL для fetch не нужен — loader вызывается из _fetchEntry. Dev-предупреждение E038, если два живых ключа совпадают после нормализации, но различались до неё (подсказка «упорядочьте query»).

**Алгоритм:**

```js
const _stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
function _normKey(a) {
    if (a == null || a === false || a === '') return null;
    if (Array.isArray(a)) return a.map(p => typeof p === 'string' ? p : _stable(p)).join('\0');
    if (typeof a !== 'string') return _stable(a);
    const q = a.indexOf('?'); if (q < 0) return a;              // fast path: 20 ns
    const h = a.indexOf('#', q);
    const pairs = a.slice(q + 1, h < 0 ? undefined : h).split('&')
        .filter(Boolean).map(p => p.split('='))
        .filter(([, v]) => v !== undefined && v !== '');
    pairs.sort((x, y) => (x[0] + x[1]) < (y[0] + y[1]) ? -1 : 1);
    return pairs.length ? a.slice(0, q) + '?' + pairs.map(p => p.join('=')).join('&') : a.slice(0, q);
}
// partial match для иерархических ключей (см. предложение 2):
const _isPrefix = (pat, key) => key === pat || key.startsWith(pat + '\0');
// Стоимость по симуляции: 1.6 µs/ключ с query, 20 ns без — вызывается только при смене URL, не на каждый рендер.
```

**API:**

```js
resource('/api/users?page=1&q=a', { cache: true })  // ключ '/api/users?page=1&q=a' == ключ '/api/users?q=a&page=1&'
resource({ params: () => ({ id: uid.value }), loader, cache: true })  // ключ '{"id":42}' стабилен
resource(url, { cache: { key: ['users', () => uid.value] } })  // иерархический ключ, реактивные части
prefetch(url, { key: ['users', 42] }); seed(['users', 42], user);
invalidate(['users'])   // partial match: все ['users', …]
```

**Критерий:** Тест: 5 перестановок одного URL → `_resourceCache.size === 1` и один вызов fetcher; `resource({params:{b:1,a:2}, loader, cache:true})` и `{a:2,b:1}` делят один entry (сейчас — TypeError/два запроса). Бенч: `_normKey` ≤ 2 µs на URL с 3 параметрами, ≤ 50 ns без query (симуляция: 1.59 µs / 20 ns).

**Источники:** TanStack Query v5 hashKey/partialMatchKey (стабильная сериализация с сортировкой ключей объектов, массив как иерархия); SWR `unstable_serialize`; RFC 3986 §6.2 (нормализация URI); Cloudflare cache-key sorting (sort query string).

## 💎 #2 — Грамматика invalidate(): prefix / glob / partial-array / tags / exact, с Promise и режимом refetch

**Impact:** 5 · **Effort:** M · **Size:** +0.4 KB gzip

**Сейчас:** `invalidate(keyOrFn)` (:6055–6062): `k === keyOrFn` или предикат; возвращает undefined, хотя каждый `_fetchEntry` отдаёт Promise. Всё, что не точное совпадение, пишется предикатом — три копии в demo/admin.html:117,121,157. `mutation()` (:3720) делает `for (const k of [].concat(invalidates)) invalidate(k)` и сразу переходит к onSuccess — `pending` снимается до прихода свежих данных, кнопка «Delete» разблокируется, пока список ещё старый. Типы: aegis.d.ts:587, :689 — только string | predicate.

**Предложение:** Расширить матчер в `invalidate()` без изменения сигнатуры: строка с `*` на конце → prefix (`'/api/users*'`), массив → partial match иерархического ключа, объект `{ prefix, tags, exact, refetch: 'active'|'all'|'none' }`. Вернуть `Promise<void>` = `Promise.allSettled` всех запущенных `_fetchEntry`. В `mutation()` — `await Promise.all(invalidates.map(invalidate))` перед снятием `pending` (opt-out `awaitInvalidates: false`). `refetch:'none'` только помечает lastFetch=0 (для больших сайдбаров, чтобы не штормить). Скан остаётся линейным — по симуляции 8 µs на 200 entries, 50 µs на 2000; индексировать нечего, реальный кэш SPA — десятки записей.

**Алгоритм:**

```js
function _matcher(pat) {
    if (typeof pat === 'function') return pat;
    if (Array.isArray(pat)) { const p = _normKey(pat); return k => _isPrefix(p, k); }
    if (typeof pat === 'string') {
        if (pat.endsWith('*')) { const p = _normKey(pat.slice(0, -1)); return k => k.startsWith(p); }
        const p = _normKey(pat); return k => k === p;
    }
    const fs = [];
    if (pat.exact) fs.push(_matcher(pat.exact));
    if (pat.prefix) fs.push(_matcher(pat.prefix + '*'));
    if (pat.tags) { const t = new Set([].concat(pat.tags)); fs.push((k, e) => e.tags && e.tags.some(x => t.has(x))); }
    return (k, e) => fs.some(f => f(k, e));
}
export function invalidate(pat) {
    const m = _matcher(pat), mode = pat && pat.refetch || 'active', ps = [];
    for (const [k, e] of _resourceCache) {
        if (!m(k, e)) continue;
        e.lastFetch = 0;
        const active = e.refCount > 0 && e.url && e.fopts;
        if (mode === 'none' || (mode === 'active' && !active)) continue;
        ps.push(_fetchEntry(e, e.url, e.fopts, true));
    }
    for (const f of _invalidators(m)) ps.push(f());        // предложение 7: plain/offline
    return Promise.allSettled(ps).then(() => {});
}
// mutation(): if (invalidates) await Promise.all([].concat(invalidates).map(invalidate));
```

**API:**

```js
invalidate('/api/users*')                        // prefix
invalidate(['users'])                            // partial: ['users'], ['users',42], ['users',42,'orders']
invalidate({ tags: ['users','stats'] })          // теги (предложение 3)
invalidate({ prefix: '/api/users', refetch: 'none' })  // только пометить stale
await invalidate('/api/stats')                   // дождаться свежих данных
mutation(fn, { invalidates: ['/api/users*', '/api/stats'] })  // pending держится до refetch
```

**Критерий:** Тест: 3 entries `/api/users?page=1..3` + `/api/stats`; `invalidate('/api/users*')` → 3 refetch, stats не тронут; `await invalidate(...)` резолвится после того, как `data` всех трёх обновлён; `mutation.pending` = true до завершения refetch (assert внутри fetcher). Бенч: `invalidate('/x*')` на 2000 entries ≤ 100 µs (симуляция: 50 µs).

**Источники:** TanStack Query `invalidateQueries({ queryKey, exact, refetchType })` и `partialMatchKey`; SWR `mutate(key => key.startsWith(…))`; TanStack docs «await invalidation in onSuccess keeps isPending true».

## 💎 #3 — Теги: клиентские + серверные (Cache-Tag-подобный заголовок) с индексом Map<tag, Set<entry>>

**Impact:** 4 · **Effort:** M · **Size:** +0.45 KB gzip

**Сейчас:** Понятия тега нет. Entry (:5741–5756) не знает, к каким сущностям относится; связь «мутация → что перезапросить» кодируется предикатом по URL, что ломается при переименовании эндпоинта или при данных из loader. `request()` (:1336–1367) возвращает только тело (`_parseBody`, :1310), заголовки ответа теряются на уровне `defaults.fetcher` (:1379) — cached-движок их не видит.

**Предложение:** (a) `cache: { tags: ['users', 'user:42'] }` (строки или fn от data) — хранятся в `e.tags`; модульный `_tagIndex: Map<string, Set<entry>>`, обновляется в `_cacheEntry`/GC-удалении. (b) Серверные теги: `request()` читает заголовок `Aegis-Tags` (или настраиваемый `configure({ tagHeader: 'Cache-Tag' })`), и складывает их в `WeakMap<parsedBody, string[]>` (`_meta`); `_fetchEntry` после получения result вызывает `_meta.get(result)` и мержит теги в entry. JSON.parse всегда даёт новый объект, WeakMap не течёт. (c) `invalidate({ tags })` идёт по индексу, а не сканом; `mutation({ invalidates: { tags: [...] } })`. Сервер, который уже умеет Surrogate-Key/Cache-Tag для CDN, получает клиентскую инвалидацию тем же механизмом.

**Алгоритм:**

```js
const _tagIndex = new Map();                       // tag → Set<entry>
function _tag(e, tags) {
    for (const t of tags) {
        if (!e.tags) e.tags = new Set();
        if (e.tags.has(t)) continue; e.tags.add(t);
        (_tagIndex.get(t) || _tagIndex.set(t, new Set()).get(t)).add(e);
    }
}
function _untag(e) { if (e.tags) for (const t of e.tags) { const s = _tagIndex.get(t); s.delete(e); if (!s.size) _tagIndex.delete(t); } }
// request(): после _parseBody, если data — объект:
const tags = response.headers.get(_config.tagHeader || 'Aegis-Tags');
if (tags && data && typeof data === 'object') _meta.set(data, tags.split(/,\s*/));
// _fetchEntry(): после result
const hdr = _meta.get(result); if (hdr) _tag(e, hdr);
if (fopts.tags) _tag(e, typeof fopts.tags === 'function' ? fopts.tags(next) : fopts.tags);
// invalidate({ tags }):
for (const t of tags) for (const e of _tagIndex.get(t) || []) hit(e);
// _resourceCache.delete(e.key) в GC → _untag(e)
// Симуляция (b): tag 'users' на 10k entries 25 µs (6667 попаданий) против 309 µs prefix-скана; tag 'user:i' 0.14 µs.
```

**API:**

```js
resource('/api/users?page=1', { cache: { tags: ['users'] } })
resource(() => `/api/users/${id.value}`, { cache: { tags: d => ['users', `user:${d.id}`] } })
// сервер: Aegis-Tags: users, user:42
mutation(v => api.put(`/api/users/${id}`, v), { invalidates: { tags: ['users', `user:${id}`] } })
invalidate({ tags: 'stats' })
configure({ tagHeader: 'Cache-Tag' })   // переиспользовать CDN-заголовок
```

**Критерий:** Тест: два ресурса с общим тегом и один без → `invalidate({tags:'users'})` перезапрашивает ровно два; мок-Response с `Aegis-Tags: users` → entry.tags содержит 'users' без клиентской опции; после GC entry исчезает из `_tagIndex` (size вернулся к 0). Бенч: 10k entries, `invalidate({tags:'users'})` ≤ 50 µs.

**Источники:** Next.js `revalidateTag` / fetch `next: { tags }`; Fastly Surrogate-Key и Cloudflare Cache-Tag; Varnish xkey; Apollo `cache.evict({ id })` по сущности; urql graphcache `__typename`-инвалидация (тег = typename).

## 💎 #4 — Починить гонку «invalidate во время in-flight»: force вытесняет летящий запрос (generation counter)

**Impact:** 5 · **Effort:** S · **Size:** +0.1 KB gzip

**Сейчас:** `_fetchEntry` (:5814–5849): проверка staleTime (:5820), затем `if (e.promise) return e.promise;` (:5822) — независимо от `force`. `invalidate()` (:6060) и `refresh()` (:5993, :6009) вызывают с force=true, но если entry уже ревалидируется (focus/reconnect через `_installRevalidate`, :5851–5866, или другой подписчик), они присоединяются к старому запросу, стартовавшему ДО мутации. Симуляция (блок c): GET стартовал, через 5 мс сервер применил мутацию, mutation → invalidate → в кэше остаётся v1. Реальный сценарий: вернуться во вкладку (focus → refetch 200 мс) и сразу нажать Delete — удалённая строка «воскресает».

**Предложение:** При `force=true` и наличии `e.promise`: abort старого контроллера, запуск нового запроса. Добавить в entry `gen` (номер поколения): каждый старт `++e.gen`, ответ применяется только если `gen` совпадает — это же защищает от прихода старого ответа, если сервер/fetch не уважает abort (моки, `_config.fetch`-прокси). Optimistic-запись из `mutation()` тоже инкрементирует `gen` через `mutate()` (:5994), чтобы ответ, стартовавший до оптимистичной записи, не затёр её. Промис для ждущих старого `e.promise` — резолвить тем же новым результатом (заменить `e.promise` до возврата).

**Алгоритм:**

```js
function _fetchEntry(e, url, fopts, force = false) {
    if (!url) return Promise.resolve();
    e.url = url; e.fopts = fopts;
    if (!force && Date.now() - e.lastFetch < (fopts.staleTime || 0)) return Promise.resolve();
    if (e.promise && !force) return e.promise;                 // dedupe только для не-force
    if (e.controller) e.controller.abort();                    // force: вытеснить старый
    const gen = ++e.gen, controller = e.controller = new AbortController();
    batch(() => { e.inflight.value = true; e.started.value = true; e.error.value = null; });
    const p = (async () => {
        try {
            const result = await withRetry(() => fetcher(url, { signal: controller.signal }), …);
            if (gen !== e.gen) return;                             // устаревшее поколение — игнор
            e.data.value = fopts.share === false ? next : _share(e.data.peek(), next);
            e.lastFetch = Date.now();
        } catch (err) { if (gen === e.gen && err?.name !== 'AbortError') e.error.value = err; }
        finally { if (gen === e.gen) { e.controller = null; e.promise = null; e.inflight.value = false; } }
    })();
    return e.promise = _trackPromise(p);
}
// mutate(fn): e.gen++ — оптимистичная запись побеждает любой запрос, стартовавший раньше неё.
// Симуляция: after mutation+invalidate: now v1 (stale) | abort-and-refetch v2.
```

**API:**

```js
// API не меняется; поведение:
const r = resource('/api/users', { cache: true });
r.refresh();            // всегда новый запрос, даже если ревалидация уже идёт
invalidate('/api/users'); // то же
r.mutate(list => list.filter(u => u.id !== id));   // ответ старого GET не откатит оптимистичное удаление
```

**Критерий:** Тест (fetcher с задержкой 30 мс и версией на сервере): старт GET → изменить версию → `invalidate(key)` → после settled() `data.v === 2` (сейчас 1); `mutate()` во время in-flight → data после ответа равна оптимистичному значению; старый промис `r.promise` резолвится (нет висящих ожиданий в `ready()`). Число запросов при спокойном focus-refetch не растёт (dedupe для force=false сохранён).

**Источники:** TanStack Query `invalidateQueries({ cancelRefetch: true })` (default) — отмена летящего запроса перед refetch; SWR «mutate() + race condition: optimistic data with startAt timestamp»; Relay «mutation ordering by request start time».

## 💎 #5 — Серверная инвалидация: заголовок Aegis-Invalidate, SSE-событие aegis-invalidate, BroadcastChannel между вкладками

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip (BroadcastChannel-часть tree-shake не отделить, но ~120 B)

**Сейчас:** Инвалидация только клиентская и явная. `request()` (:1336) после unsafe-ответа ничего не делает с заголовками; `wireForm.serverSubmit` (:6361–6395) читает только content-type; `swap()` (:8272) принимает Response, но игнорирует заголовки. `sse()` (:3848–3865) понимает только `aegis-signals`. BroadcastChannel в файле не используется — вторая вкладка после мутации в первой показывает старое до focus-ревалидации (5с throttle, :5857).

**Предложение:** Три источника, один вход `invalidate()`: (1) в `request()` после успешного unsafe-метода прочитать `Aegis-Invalidate: /api/users*, tag:users, /api/stats` (аналог htmx `HX-Trigger`) и вызвать `invalidate` на каждый элемент — работает для mutation(), wireForm.submit(), swap()/boost() автоматически; (2) в `sse()` зарегистрировать `aegis-invalidate` с тем же форматом в data — сервер после фонового джоба пушит инвалидацию; (3) `configure({ broadcast: true })` — `BroadcastChannel('aegis-cache')`: каждая локальная инвалидация постится (без refetch-результата, только паттерн), приём → `invalidate(pattern)` с флагом `local` чтобы не зациклиться; вкладка в фоне не refetch-ит (visibilityState check уже есть в `_installRevalidate`), а только помечает stale через `refetch:'none'`.

**Алгоритм:**

```js
// формат паттернов (общий для трёх каналов): 'a/b*' prefix, 'tag:x' тег, иначе точный ключ
const _parsePatterns = s => (Array.isArray(s) ? s : String(s).split(/,\s*/)).filter(Boolean)
    .map(p => p.startsWith('tag:') ? { tags: p.slice(4) } : p);
function _serverInvalidate(headerValue) { for (const p of _parsePatterns(headerValue)) invalidate(p); }
// request(): после doFetch, до raw/parse
if (_UNSAFE.has(m) && response.ok) { const inv = response.headers.get('Aegis-Invalidate'); if (inv) _serverInvalidate(inv); }
// sse():
es.addEventListener('aegis-invalidate', e => _serverInvalidate(parse(e.data)));
// BroadcastChannel:
let _bc = null;
function _broadcast(pat) { if (_config.broadcast && !_bc && 'BroadcastChannel' in self) {
    _bc = new BroadcastChannel('aegis-cache');
    _bc.onmessage = ev => invalidate({ ...(typeof ev.data === 'string' ? { exact: ev.data } : ev.data),
        refetch: document.visibilityState === 'visible' ? 'active' : 'none', _remote: true });
} if (_bc && !pat._remote) _bc.postMessage(pat); }
// invalidate(): в начале _broadcast(pat)  (паттерн — строка/массив/объект, structured-clone безопасен; функции не шлём)
```

**API:**

```js
// сервер (Django/Rails/Go) в ответе на POST /api/users:
//   Aegis-Invalidate: /api/users*, tag:stats
const create = mutation(() => api.post('/api/users', body));   // без invalidates — сервер сказал сам
const s = sse('/events');    // event: aegis-invalidate  data: "tag:orders"
configure({ broadcast: true });   // инвалидация видна всем вкладкам origin
```

**Критерий:** Тест: мок `_config.fetch` отдаёт Response с `Aegis-Invalidate: /t/list*` на POST → cached `/t/list?page=1` перезапрошен без опции invalidates; `sse` мок-EventSource с событием `aegis-invalidate` → refetch; два экземпляра через реальный BroadcastChannel в одном документе (разные имена не нужны — self-message не доставляется, тест через второй `new BroadcastChannel`) → invalidate дошёл, refetch не зациклился (счётчик fetcher = 1). Демо: убрать три предиката из admin.html, заменить одним заголовком в mock-сервере.

**Источники:** htmx `HX-Trigger` / `HX-Refresh` response headers; Turbo Streams (server-driven DOM updates); Next.js `revalidateTag` server-side; TanStack `broadcastQueryClient` (BroadcastChannel sync); Phoenix LiveView push_event; Hotwire `Turbo.cache.clear()`.

## 💎 #6 — Граф между записями: cross-seeding список → детали и mutation({ updates }) без refetch

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip

**Сейчас:** `seed(key, data)` (:5873) есть, но пользователь должен сам разбирать список и вызывать его на каждую строку; `mutation()` (:3699) умеет только `invalidates` (полный refetch) и `onSuccess`. Связь «detail-entry пришла из list-entry» нигде не хранится: после `invalidate('/api/users/42')` списки, где этот пользователь есть, остаются старыми; после PUT /api/users/42 демо делает refetch и списка, и stats (admin.html:157), хотя ответ PUT уже содержит новую сущность.

**Предложение:** Два лёгких ребра вместо нормализации: (a) `cache: { seeds: (data) => [[key, item], …] }` — после каждого ответа списка `seed()` дочерние записи с `age` родителя и записать в `child.parents.add(list.key)`; (b) `mutation({ updates: { [key]: (prev, result, ...args) => next } })` — после успеха записать в кэш напрямую (`e.data.value = fn(prev, result)`, lastFetch = now), TanStack `setQueryData`-стиль; `updates` работает и по prefix (`'/api/users*': (prev, u) => ({...prev, items: prev.items.map(x => x.id === u.id ? u : x)})`). (c) `invalidate(child)` с опцией `up: true` поднимается по `parents` — инвалидирует списки, из которых пришла деталь. Всё — в терминах существующих entry, без `__typename`/id-нормализации.

**Алгоритм:**

```js
// _fetchEntry после записи данных списка:
if (fopts.seeds) for (const [k, item] of fopts.seeds(next) || []) {
    const c = seed(_normKey(k), item, { age: 0 }); (c.parents || (c.parents = new Set())).add(e.key);
}
// mutation(): после result
if (updates) batch(() => { for (const [pat, fn] of Object.entries(updates)) {
    const m = _matcher(pat);
    for (const [k, e] of _resourceCache) if (m(k, e) && e.data.peek() != null) {
        e.data.value = _share(e.data.peek(), fn(e.data.peek(), result, ...args)); e.lastFetch = Date.now();
    }
} });
// invalidate({ exact: key, up: true }):
const seen = new Set(); const walk = e => { if (seen.has(e)) return; seen.add(e); hit(e);
    if (e.parents) for (const pk of e.parents) { const p = _resourceCache.get(pk); if (p) walk(p); } };
// Экономия: UserEdit save → 0 refetch вместо 2 (список + stats) при updates; detail-страница после списка → 0 запросов вместо 1.
```

**API:**

```js
const users = resource(() => `/api/users?page=${page.value}`, { cache: { tags: ['users'], seeds: d => d.items.map(u => [`/api/users/${u.id}`, u]) } });
const user = resource(() => `/api/users/${id.value}`, { cache: true });   // мгновенно из seeds, затем SWR
const save = mutation(v => api.put(`/api/users/${id}`, v), {
    updates: {
        [`/api/users/${id}`]: (prev, u) => u,
        '/api/users*': (list, u) => ({ ...list, items: list.items.map(x => x.id === u.id ? u : x) }),
    },
    invalidates: { tags: 'stats' },
});
invalidate({ exact: `/api/users/${id}`, up: true })   // и списки-родители
```

**Критерий:** Тест: список из 3 пользователей с seeds → `resource('/api/users/2', {cache:true})` даёт data синхронно и fetcher вызван 0 раз до staleTime; `mutation({updates})` → data двух entries обновлены, fetcher = 0 вызовов; `invalidate({exact:'/api/users/2', up:true})` перезапрашивает список. Демо admin: клик по строке списка → страница пользователя без сетевого запроса (Network tab: 0), сохранение → 1 PUT и 0 GET.

**Источники:** TanStack `queryClient.setQueryData` + `initialData` из списка («seeding detail from list»); Relay updater/`@appendNode`; Apollo `cache.modify`; urql graphcache `updates` (ручные апдейты вместо refetch); SWR `populateCache`.

## 💎 #7 — Единый реестр инвалидации для трёх движков + dev-панель «Cache» и E039 «invalidate ничего не нашёл»

**Impact:** 3 · **Effort:** S · **Size:** +0.25 KB gzip (реестр + E039), devtools-вкладка вне основного бандла

**Сейчас:** `invalidate()` итерирует только `_resourceCache` (:6056). Offline-движок держит собственный `_offlineRefreshers: Map<cacheKey, Set<refresh>>` (:7955, регистрация :8100–8104, использование :8014) — `mutation({ invalidates: '/api/settings' })` его не достигает, поэтому демо Settings (admin.html:186) обновляет данные вручную через `s.mutate(v)` в onSuccess. Plain `resource()` пишет `key` (:3640) но не регистрируется нигде. Devtools показывают одно число `resourceCache` (aegis-devtools.js:91, aegis_full.js:991). Опечатка в ключе `invalidates: ['/api/todo']` молча ничего не делает (test.html:3366 «runs without error» — это единственный тест на промах).

**Предложение:** Вынести в §9 модульный `_invalidators: Map<key, Set<() => Promise>>` с `_registerInvalidator(key, fn)` → dispose. `_plainResource` регистрирует `refresh` под своим key при каждом смене (только если `opts.key` или `cache === false` явно — чтобы plain-ресурсы без ключа не попадали в реестр случайно), `_offlineResource` заменяет `_offlineRefreshers` на него (минус ~10 строк). `invalidate()` после `_resourceCache` проходит `_invalidators` тем же `_matcher`. В dev: если ни один entry и ни один invalidator не совпал — `_warn('E039', { what: 'invalidate("/api/todo") matched nothing', why, fix: ближайший ключ по префиксу })`, дедуп по паттерну. `stats()` отдаёт `cache: [{ key, tags, refCount, age, inflight, size }]`, devtools рисует вкладку с кнопкой «invalidate» на строке.

**Алгоритм:**

```js
const _invalidators = new Map();   // key → Set<fn>
function _registerInvalidator(key, fn) {
    if (!key) return () => {};
    const s = _invalidators.get(key) || _invalidators.set(key, new Set()).get(key); s.add(fn);
    return () => { s.delete(fn); if (!s.size) _invalidators.delete(key); };
}
// _plainResource: в refresh()/auto-fetch после key.value = _normKey(a):
//   off(); off = opts.key || opts.invalidatable ? _registerInvalidator(key.peek(), refresh) : noop;  scope.onDispose(off)
// _offlineResource.load(url): off(); off = _registerInvalidator(url, refresh);  (_offlineRefreshers удалить, _flushOffline touched → invalidate(k))
// invalidate(pat): …
let hits = 0;
for (const [k, set] of _invalidators) if (m(k, null)) { hits++; for (const f of set) ps.push(f()); }
if (_dev() && !hits && !cacheHits) _warn('E039', {
    what: `invalidate(${JSON.stringify(pat)}) matched no resource.`,
    why: 'No cached, offline or keyed resource has this key — a typo, or the resource has no { cache } / { key }.',
    fix: `Closest live keys: ${_closestKeys(pat).join(', ') || '(none)'}. Use a prefix: '${String(pat).split('?')[0]}*'.`,
}, 'inv:' + String(pat));
// stats().cache: [..._resourceCache.values()].map(e => ({ key: e.key, tags: [...(e.tags||[])], refCount: e.refCount, age: Date.now() - e.lastFetch, inflight: e.inflight.peek() }))
```

**API:**

```js
const s = resource('/api/settings', { offline: true });
mutation(v => api.put('/api/settings', v), { invalidates: '/api/settings' })   // теперь доходит до offline-ресурса
resource('/api/me', { key: 'me' });  invalidate('me');                           // plain resource с явным ключом
stats().cache   // [{ key, tags, refCount, age, inflight }]
// dev-консоль: [Aegis E039] invalidate("/api/todo") matched no resource. Closest live keys: /api/todos
```

**Критерий:** Тест: offline-ресурс + `invalidate(url)` → refresh вызван (сейчас 0); `_offlineRefreshers` удалён, тест на flush-refresh (:8014) проходит через `_invalidators`; `invalidate('/nope')` в dev → ровно одно E039 через onWarn (test.html:3366 сейчас проверяет только отсутствие исключения); `stats().cache.length === _resourceCache.size`. Размер: чистый прирост ≤ 0.25 KB после удаления `_offlineRefreshers`.

**Источники:** TanStack Devtools (query explorer: key, observers, updatedAt, «Invalidate» button); SWR `useSWRConfig().cache.keys()`; RTK Query `providesTags/invalidatesTags` как единый механизм для всех эндпоинтов независимо от транспорта; практика dev-warning «no query matched» в urql devtools.


---

# 🔭 freshness-consistency

**Линза:** vision / freshness-consistency

**Вывод:** Aegis уже имеет каркас SWR (dedupe, staleTime, revalidateOn, seed, structural sharing), но модель согласованности — «побеждает тот, кто записал последним»: у cache-entry один сигнал data (aegis_full.js:5744), optimistic — побочный эффект с откатом по снапшоту (3710/3722), а force-refetch не обгоняет уже летящий GET (5821). Симуляция по семантике кода (scratchpad/agents/freshness-consistency/sim.js) даёт: после mutation+invalidate в 21% случаев показывается ответ «до записи», в 47% сценариев параллельных optimistic успешная правка стирается откатом, при двух вкладках offline-очередь дублирует 100% POST. Главный ход — сменить модель entry на «серверные данные + стек optimistic-слоёв + версия-ограда»: это закрывает read-your-writes, конфликты откатов и мигание; поверх ложатся entity fan-out (список ↔ элемент без refetch), реактивная свежесть с одним планировщиком, If-Match/412 + 3-way merge, идемпотентность offline-очереди и cross-tab синхронизация. Всё — ванильный JS, суммарно ~3 KB gzip, каждая часть tree-shakeable и opt-in.

**Отвергнуто:** CRDT-библиотеки (Yjs/Automerge) для конкурентных правок — 30-100 KB, нужен CRDT-сервер, противоречит server-first и бюджету; field-level 3-way merge с If-Match покрывает 80% случаев формы «объект-документ». Полный нормализованный граф (Apollo/Relay-стиль, схема типов, денормализация на чтение) — тяжело и требует описания схемы; вместо этого fan-out по существующим деревьям с identify. Vector clocks / Lamport-часы на каждую запись — избыточно, счётчика версий на entry и ETag достаточно. Persist SWR-кэша в localStorage/IDB — известный пробел, другая линза (durability, не consistency). ETag только ради 304/трафика — известный пробел, взят лишь как носитель версии для If-Match. Service-Worker-кэш ответов — дублирует SWR, не решает согласованность optimistic. «Rebase» offline-очереди с сериализацией optimistic-функций — функции не сериализуются, замена — refresh после flush + onSyncError. Undo/time-travel для ресурсов — уже есть history() для reactive, для сетевых данных не нужно.

## 💎 #8 — Optimistic-слои с rebase вместо snapshot-rollback

**Impact:** 5 · **Effort:** M · **Size:** ~0.5 KB gzip (overlay + изменения в mutation/_fetchEntry/_plainResource)

**Сейчас:** mutation() aegis_full.js:3699-3750: снапшот `resources.map(r => r.data.peek())` (3710), откат `r.mutate(snapshots[i])` (3722). optimistic — побочный эффект, зовущий `todos.mutate(...)` (demo/admin.html:116, test.html:1291). У cache-entry один сигнал data (5744); ответ сервера в _fetchEntry пишется поверх (5836) — optimistic-правка исчезает, пока POST не завершён, потом возвращается после invalidate (мигание). При двух параллельных мутациях снапшот второй уже содержит optimistic первой; откат первой стирает вторую.

**Предложение:** Разделить в entry (и в _plainResource) `server` (то, что пришло с сервера/seed) и `overlays` — массив чистых функций data→data. Публичный `data` = computed(server → overlays по порядку). `r.overlay(fn)` возвращает handle {commit, discard}. mutation(): если optimistic вернул handle/массив handle — при ошибке discard (только свой слой, соседние живут), при успехе — держать слой до прихода ответа refetch по invalidates (или commit сразу, если invalidates нет). Ревалидация, приземлившаяся посреди мутации, обновляет только `server`, слой перекладывается поверх — нет мигания, нет затирания. Старый API (`mutate`, `resources`) остаётся как есть.

**Алгоритм:**

```js
// entry
e.server = signal(initial); e.overlays = signal([]);
e.data = computed(() => e.overlays.value.reduce((d, f) => f(d), e.server.value));
// _fetchEntry: e.server.value = share ? _share(e.server.peek(), next) : next;   // вместо e.data
function overlay(e, fn) {
    e.overlays.value = [...e.overlays.peek(), fn];
    const drop = () => { e.overlays.value = e.overlays.peek().filter(f => f !== fn); };
    return { discard: drop, commit: drop };   // commit = слой снят, server уже содержит результат
}
// mutation.exec:
const handles = [].concat(optimistic ? batch(() => optimistic(...args)) ?? [] : []).filter(h => h && h.discard);
try { result = await fn(...args, { signal });
     if (invalidates) { await Promise.all(keys.map(k => invalidate(k, { wait: true }))); }
     handles.forEach(h => h.commit()); }
catch (e) { handles.forEach(h => h.discard()); /* legacy: snapshots только если handles пуст */ }
// invalidate(k, { wait }) возвращает промис refetch активных entry (нужно и для read-your-writes)
```

**API:**

```js
const users = resource('/api/users', { cache: true });
const remove = mutation((id) => api.delete(`/api/users/${id}`), {
    optimistic: (id) => users.overlay(d => ({ ...d, items: d.items.filter(u => u.id !== id), total: d.total - 1 })),
    invalidates: ['/api/users', '/api/stats'],
});
// несколько ресурсов: optimistic: (id) => [users.overlay(...), stats.overlay(s => ({ ...s, users: s.users - 1 }))]
// r.overlays — ReadonlySignal<number> для UI «сохраняется…»; r.data как раньше
```

**Критерий:** Симуляция B: успешная правка стёрта откатом 47.0% → 0%; A: мигание optimistic до ack 29.5% → 0%. Тест: две параллельные мутации (concurrent:'parallel'), первая падает — элемент второй остаётся; SWR-ответ с задержкой посреди мутации не убирает optimistic-элемент; list() не пересоздаёт строки (identity через _share на server).

**Источники:** TanStack Query (onMutate + cancelQueries, optimistic via variables), Relay optimistic updater stack, Apollo optimistic layers, Replicache «rebase pending mutations on server snapshot», SWR useSWRMutation optimisticData/rollbackOnError

## 💎 #9 — Read-your-writes: force-refetch обгоняет летящий GET + версия-ограда для seed

**Impact:** 5 · **Effort:** S · **Size:** ~150 B gzip

**Сейчас:** _fetchEntry aegis_full.js:5814-5849: проверка staleTime уважает force (5819), но dedupe `if (e.promise) return e.promise` (5821) — нет. invalidate() (6055-6064) после успешной мутации вызывает `_fetchEntry(e, url, fopts, true)` и присоединяется к GET, стартовавшему ДО записи (focus-ревалидация 5851-5870 стартует при возврате во вкладку — типичный момент клика). seed() (5873) и mutate (6010) не помечают entry версией — старый ответ (5836) затирает более свежий seed из ответа мутации.

**Предложение:** В entry: `e.ver` (счётчик локальных авторитетных записей: seed/патч из ответа мутации) и `e.reqAt`. Force при летящем запросе: abort controller, новый fetch (стартует после записи — сервер уже её видит). В завершении fetch: если `e.ver !== v0` (пока летел — пришли данные авторитетнее, например seed(key, result) в onSuccess) — ответ отбрасывается, `updatedAt` не трогается. invalidate возвращает Promise активных refetch (нужно mutation для commit слоя).

**Алгоритм:**

```js
function _fetchEntry(e, url, fopts, force) {
    if (!force && Date.now() - e.lastFetch < (fopts.staleTime || 0)) return Promise.resolve();
    if (e.promise) { if (!force) return e.promise; e.controller.abort(); }   // ограда: обогнать pre-write GET
    const v0 = e.ver;
    ...
    if (controller.signal.aborted || e.ver !== v0) return;   // локальная авторитетная запись случилась позже старта → ответ старее
    e.server.value = ...; e.lastFetch = Date.now();
}
export function seed(key, data, { age = 0 } = {}) { const e = _cacheEntry(key, null); e.ver++; ... }
export function invalidate(keyOrFn) {
    const ps = [];
    for (const [k, e] of _resourceCache) if (match) { e.lastFetch = 0; if (e.refCount > 0 && e.url) ps.push(_fetchEntry(e, e.url, e.fopts, true)); }
    return Promise.all(ps);
}
```

**API:**

```js
// без изменений для пользователя; invalidate теперь возвращает Promise
await invalidate('/api/users');            // данные уже отражают запись
const save = mutation((v) => api.put('/api/users/42', v), {
    onSuccess: (u) => seed('/api/users/42', u),   // ответ мутации авторитетнее любого летящего GET
    invalidates: (k) => k.startsWith('/api/users?'),
});
```

**Критерий:** Симуляция A: показан pre-write ответ после invalidate 21.2% → 0% (цена: +1 запрос в 43.7% случаев, когда invalidate попал в in-flight GET). Тест: мок-fetcher с задержкой 200 мс стартует focus-ревалидацию, мутация завершается через 50 мс, invalidate → после settled() data содержит запись; второй тест: seed() во время летящего GET — старый ответ не затирает seed.

**Источники:** TanStack Query refetchQueries({ cancelRefetch: true }) (по умолчанию), Bayou session guarantees (Terry et al., 1994: read-your-writes), SWR mutate(key, data, { revalidate }) — dedupe отменяется при явной записи

## 💎 #10 — Entity fan-out: причинная согласованность список ↔ элемент без refetch

**Impact:** 4 · **Effort:** M · **Size:** ~0.6 KB gzip

**Сейчас:** Нормализации нет. demo/admin.html:114-118 — удаление пользователя: optimistic только на список, `/api/stats` и другие страницы `/api/users?…` перезапрашиваются предикатом (N запросов); save (156) правит `/api/users/42` — список показывает старое имя до refetch. invalidate — по строке/предикату (6055). Обход дерева с copy-on-write уже есть в _share (3509-3524), но только для сравнения.

**Предложение:** Opt-in идентификация сущностей: `configure({ identify: o => … })` (глобально) или `resource(url, { cache: true, entity: 'user' })`. `patchEntity(entityKey, fn)` обходит `server` всех entry в _resourceCache (patchTree: копирует только путь к изменённому объекту — identity остальных строк сохраняется, list() их не трогает) и, при наличии overlays, применяется как слой. mutation получает `patch: (result, ...args) => [[entityKey, fn]]` на success (write-through ответа сервера во все списки) и optimistic-вариант через `patchEntity` + overlay. Авто-режим: ответ ресурса с `entity` (одиночный объект) сразу патчится во все списки, где он встречается.

**Алгоритм:**

```js
const _identify = () => _config.identify;   // (obj) => 'user:42' | null
function _patchTree(node, key, fn, id) {
    if (!node || typeof node !== 'object') return node;
    if (id(node) === key) return fn(node);
    if (Array.isArray(node)) { let out = null; for (let i = 0; i < node.length; i++) { const v = _patchTree(node[i], key, fn, id); if (v !== node[i]) { (out ??= node.slice())[i] = v; } } return out || node; }
    if (!_isPlain(node)) return node;
    let out = null; for (const k in node) { const v = _patchTree(node[k], key, fn, id); if (v !== node[k]) { (out ??= { ...node })[k] = v; } } return out || node;
}
export function patchEntity(key, fn) {
    const id = _identify(); if (!id) return 0; let n = 0;
    batch(() => { for (const e of _resourceCache.values()) { const d = e.server.peek(); const nd = _patchTree(d, key, fn, id); if (nd !== d) { e.server.value = nd; n++; } } });
    return n;
}
// в _fetchEntry после записи server: if (fopts.entity) { const k = id(next); if (k) patchEntity(k, () => next); } — одиночный ответ обновляет списки
// mutation: on success → for (const [k, f] of patch(result, ...args)) patchEntity(k, f)
```

**API:**

```js
configure({ identify: (o) => o && o.id != null && o.kind ? `${o.kind}:${o.id}` : null });
const user = resource(() => `/api/users/${id.value}`, { cache: true, entity: true });
const save = mutation((v) => api.put(`/api/users/${id.value}`, v), {
    optimistic: (v) => patchEntity(`user:${id.value}`, u => ({ ...u, ...v })),   // все списки + карточка сразу
    patch: (saved) => [[`user:${saved.id}`, () => saved]],                        // ответ сервера — во все entry
});
// 0 refetch: /api/users?page=1, /api/users?page=2, /api/team/5/members — все показывают новое имя
```

**Критерий:** Симуляция C: 60 entries × 50 объектов, один patchEntity = 0.22 мс (6 entry затронуто, остальные сохраняют identity). Тест: правка имени в item-ресурсе → 3 list-ресурса показывают новое имя синхронно, счётчик fetch = 0; строки списка (list() keyed) не пересоздаются, кроме одной. Демо Users: удаление обновляет stats.total без запроса.

**Источники:** normalizr / Apollo InMemoryCache (dataIdFromObject), RTK Query updateQueryData, urql Graphcache, SWR docs «mutate multiple keys», Relay @updatable

## 💎 #11 — Свежесть как непрерывный сигнал: updatedAt/fresh + revalidateOn:'stale' через один планировщик

**Impact:** 3 · **Effort:** S · **Size:** ~0.4 KB gzip

**Сейчас:** lastFetch — обычное число (5750, 5837), не реактивно; `stale` у статического cached — `computed(() => false)` (3546), у реактивного означает «показан предыдущий ключ» (6031). staleTime проверяется только при подписке/refresh (5819); пока компонент смонтирован, данные могут стареть неограниченно, если нет focus/reconnect. revalidateOn знает только focus/reconnect (5851-5870). Для cached нет interval (известный пробел); для plain — poll() (3678).

**Предложение:** entry получает сигнал `updatedAt` (ставится в 5837 и в seed 5876). Модульный ленивый `_now` — сигнал, тикающий раз в 1 с только пока есть подписчики fresh/age и вкладка видима. `r.fresh = computed(() => _now.value - updatedAt.value < staleTime)`, `r.age`. Новое значение `revalidateOn: ['stale']` (и `refetch.interval` для cached как алиас со staleTime=interval): один планировщик держит один setTimeout на ближайшее истечение среди entry с refCount>0; по срабатыванию — _fetchEntry просроченных, если документ видим; при скрытии — пауза, при возврате — сразу (гарантия: возраст данных на экране ≤ staleTime + RTT).

**Алгоритм:**

```js
let _tick = null, _tickSubs = 0; const _now = signal(Date.now());
const _nowRef = () => { if (!_tick) _tick = setInterval(() => { if (!document.hidden) _now.value = Date.now(); }, 1000); };
// entry: e.updatedAt = signal(0); fresh = computed(() => { _nowRef(); return _now.value - e.updatedAt.value < staleTime; });
// планировщик
let _staleTimer = null;
function _schedule() {
    clearTimeout(_staleTimer); let next = Infinity;
    for (const e of _resourceCache.values()) if (e.refCount > 0 && e.url && e.revalidateOn?.includes('stale') && e.fopts.staleTime > 0) next = Math.min(next, e.lastFetch + e.fopts.staleTime);
    if (next === Infinity) return;
    _staleTimer = setTimeout(() => {
        if (document.hidden) { document.addEventListener('visibilitychange', _schedule, { once: true }); return; }
        const now = Date.now();
        for (const e of _resourceCache.values()) if (e.refCount > 0 && e.revalidateOn?.includes('stale') && now - e.lastFetch >= e.fopts.staleTime) _fetchEntry(e, e.url, e.fopts);
        _schedule();
    }, Math.max(0, next - Date.now()));
}
// вызывать _schedule() после успешного fetch, retain/release, seed
```

**API:**

```js
const orders = resource('/api/orders', { cache: true, staleTime: 30_000, revalidateOn: ['focus', 'reconnect', 'stale'] });
html`<span class=${{ dim: () => !orders.fresh.value }}>${() => orders.data.value.length} · ${() => Math.round(orders.age.value / 1000)}s ago</span>`;
// refetch.interval для cached: resource(url, { cache: true, refetch: { interval: 10_000 } }) === staleTime:10000 + 'stale'
```

**Критерий:** Симуляция D: 40 entries, staleTime 30 с — максимальный возраст показанных данных ровно 30000 мс против 34887 мс при polling 5 с; активных таймеров всегда ≤1 независимо от числа entry. Тест с фиктивными таймерами: fresh переключается через staleTime, refetch срабатывает только для видимой вкладки; без подписчиков fresh — setInterval не создан.

**Источники:** RFC 5861 stale-while-revalidate / RFC 9111 (freshness lifetime, Age), TanStack Query staleTime/refetchInterval/refetchIntervalInBackground, SWR refreshInterval + refreshWhenHidden, Apollo pollInterval

## 💎 #12 — Версии и конфликты: ETag → If-Match, 412 → 3-way merge

**Impact:** 4 · **Effort:** M · **Size:** ~0.7 KB gzip (meta + If-Match + merge3 + ConflictError); merge3 tree-shakeable

**Сейчас:** request() (1327-1358) возвращает разобранное тело, заголовки ответа теряются; _fetchEntry идёт через fetcher (5827) — ETag/Last-Modified в entry нет. В mutation любая HttpError → откат (3722); конкурентная правка того же объекта двумя пользователями — тихий lost update. Offline send (8129) и очередь (8009) тоже без версии.

**Предложение:** request() для объектных тел кладёт метаданные ответа в WeakMap `_meta` (etag, last-modified, date) — API не меняется, fetcher остаётся. _fetchEntry читает `_meta.get(result)` → `e.etag`; на GET шлёт `If-None-Match` (304 → оставить данные, обновить updatedAt — закрывает известный пробел заодно). Мутации: `api.put(url, body, { ifMatch: key })` ставит `If-Match: e.etag`; 412/409 → mutation-опция `onConflict(local, server, base)`; по умолчанию `merge3` по полям (base = снапшот, уже снимаемый в 3710; server = refetch entry); нет конфликтных полей → автоповтор с merged и новым etag; есть → ConflictError {base, local, server, conflicts} в `.error`, слой optimistic снимается.

**Алгоритм:**

```js
const _meta = new WeakMap();
// request(): if (data && typeof data === 'object') _meta.set(data, { etag: response.headers.get('ETag'), date: response.headers.get('Date') });
// _fetchEntry: headers: e.etag ? { 'If-None-Match': e.etag } : undefined; 304 → e.lastFetch = Date.now(); return
export function merge3(base, local, server) {
    const out = { ...server }, conflicts = [];
    for (const k of new Set([...Object.keys(base ?? {}), ...Object.keys(local ?? {}), ...Object.keys(server ?? {})])) {
        const b = base?.[k], l = local?.[k], s = server?.[k];
        if (_deq(l, b)) continue;                 // клиент не трогал → серверное
        if (_deq(s, b) || _deq(s, l)) { out[k] = l; continue; }   // сервер не трогал или совпало → клиентское
        conflicts.push(k);
    }
    return { merged: out, conflicts };
}
// mutation.exec catch: if (e.status === 412 || e.status === 409) {
//   const server = await refetch(key); const { merged, conflicts } = (onConflict || merge3)(snapshot, local, server);
//   if (!conflicts.length && attempt < 2) return exec(args, merged); throw new ConflictError(...) }
```

**API:**

```js
const save = mutation((v) => api.put(`/api/users/${id}`, v, { ifMatch: `/api/users/${id}` }), {
    resources: [user],
    onConflict: (local, server, base) => merge3(base, local, server),   // по умолчанию
    onError: (e) => e.name === 'ConflictError' && showDiff(e.conflicts, e.server),
});
// сервер: ETag на GET, If-Match на PUT → 412 Precondition Failed (Rails lock_version / Django-версия в ETag)
```

**Критерий:** Симуляция E: клиент и сервер правят по 1 полю из 5 — 80% сливаются автоматически, 20% всплывают как конфликт (сегодня 100% тихий lost update). Тест: мок 412 + refetch → merged-повтор успешен; конфликт по одному полю → ConflictError с conflicts=['name'], optimistic снят. Бонус: повторный GET с 304 не меняет identity data.

**Источники:** RFC 9110 §13 conditional requests (If-Match, 412), CouchDB/PouchDB _rev и конфликты, diff3 (Khanna, Kunal, Pierce «A formal investigation of diff3»), Rails optimistic locking (lock_version), Django-REST conditional views, Google Drive/Notion field-level merge

## 💎 #13 — Offline-очередь: exactly-once между вкладками и обработка «ядовитых» мутаций

**Impact:** 4 · **Effort:** S · **Size:** ~300 B gzip

**Сейчас:** _offlineFlushing — модульный флаг per-tab (7956), очередь в IDB общая → две вкладки, получившие 'online', обе читают очередь и обе шлют POST (8009); `mutId` есть (8127), но не отправляется на сервер. В _flushOffline любая ошибка → `remaining.push(m)` (8013), включая 400/409/422 — «ядовитая» мутация крутится вечно с backoff до 60 с, а локальные данные (mutateLocal пишет IDB, 8124) никогда не сверяются с сервером → постоянное расхождение. _isNetworkError (7977) уже различает классы, но в flush не используется.

**Предложение:** (a) Заголовок `Idempotency-Key: m.mutId` в flush и в send(); (b) flush под `navigator.locks.request('aegis-sync', { ifAvailable: true })` (fallback — текущий флаг); (c) в flush: сетевые/5xx → remaining, остальные (4xx) → выбросить из очереди, положить в сигнал `failed` и вызвать `onSyncError(m, err)`, затем refresh всех ресурсов с cacheKey — сервер восстанавливает истину, optimistic-расхождение исчезает. (d) Записи очереди снабжаются `etag` (из предложения 5) → сервер отвергает устаревшие offline-правки 412 → тот же путь onSyncError.

**Алгоритм:**

```js
async function _flushOffline(store) {
    const run = async () => { ...
        for (const m of queued) {
            try { await withRetry(() => request(m.url, { method: m.method, body: m.body, headers: { 'Idempotency-Key': m.mutId, ...(m.etag && { 'If-Match': m.etag }) } }), { retries: 2 }); executed.add(m.mutId); touched.add(m.cacheKey); }
            catch (err) {
                if (_isNetworkError(err)) remaining.push(m);
                else { _failed.value = [..._failed.peek(), { m, err }]; for (const h of _syncErrHandlers) h(m, err); touched.add(m.cacheKey); }   // ядовитая: выбросить + refresh
            }
        } ... };
    if (navigator.locks) return navigator.locks.request('aegis-sync', { ifAvailable: true }, lock => lock ? run() : undefined);
    if (_offlineFlushing) return; _offlineFlushing = true; try { await run(); } finally { _offlineFlushing = false; }
}
```

**API:**

```js
const todos = resource('/api/todos', { offline: { onSyncError: (m, err) => toast(`Не сохранено: ${err.data?.message}`) } });
todos.failed   // ReadonlySignal<Array<{ m, err }>> — что сервер отверг
todos.retryFailed(i) / todos.dropFailed(i)
// сервер: принять Idempotency-Key (Stripe-стиль), вернуть сохранённый ответ на повтор
```

**Критерий:** Симуляция F: 2 вкладки, 5 мутаций в очереди — 5.0 дублей POST на flush → 0 (Web Locks) и, если lock недоступен, дубли на сервере отбрасываются по ключу. Тест: очередь [ok, 422, ok] осушается за один flush, `failed.length === 1`, ресурс с cacheKey перезапрошен, backoff-таймер не установлен.

**Источники:** IETF draft-ietf-httpapi-idempotency-key-header, Stripe Idempotent Requests, Web Locks API (navigator.locks), Workbox BackgroundSyncPlugin (maxRetentionTime, poison handling), Background Sync spec

## 💎 #14 — Cross-tab и server-push согласованность: BroadcastChannel + SSE-инвалидация

**Impact:** 3 · **Effort:** S · **Size:** ~350 B gzip (BroadcastChannel + применение сообщений; sse-хук ~60 B)

**Сейчас:** persisted() уже синхронизирует вкладки через 'storage' (4102), но SWR-кэш (_resourceCache 5736) и invalidate — per-tab. Запись во вкладке A видна в B только после focus-ревалидации (5851, throttle 5 с) — это N запросов на каждое переключение и ноль обновлений в split-screen/втором мониторе. sse() (3837-3862) умеет писать сигналы, но не связан с кэшем.

**Предложение:** `configure({ cacheSync: true })` открывает BroadcastChannel('aegis-cache'). Сообщения одного формата: `{t:'inv', keys}` (после успешной мутации/invalidate), `{t:'patch', key, value}` (patchEntity из предложения 3), `{t:'set', key, data, updatedAt}` (после fetch/seed, только если JSON ≤ 32 KB — иначе 'inv'). Приёмник: set → e.server + updatedAt (0 запросов), inv → refetch при refCount>0, patch → patchEntity локально без ре-бродкаста. Тот же формат принимает `sse(url, { cache: true })` через событие `aegis-cache` — сервер сам инвалидирует/патчит кэш клиентов после записи (server-first!). Вкладка, получившая 'set', при focus не делает лишний refetch (lastFetch обновлён).

**Алгоритм:**

```js
let _bc = null;
function _cacheSync() { if (_bc || !_config.cacheSync || typeof BroadcastChannel === 'undefined') return _bc; _bc = new BroadcastChannel('aegis-cache'); _bc.onmessage = (ev) => _applyCacheMsg(ev.data, false); return _bc; }
function _applyCacheMsg(m, rebroadcast) {
    if (m.t === 'inv') { for (const k of m.keys) _invalidateLocal(k); }
    else if (m.t === 'set') { const e = _resourceCache.get(m.key); if (e && m.updatedAt > e.lastFetch) { e.ver++; e.server.value = _share(e.server.peek(), m.data); e.lastFetch = m.updatedAt; } }
    else if (m.t === 'patch') _patchEntityLocal(m.key, () => m.value);
    if (rebroadcast) _cacheSync()?.postMessage(m);
}
// _fetchEntry после успеха: if (_config.cacheSync) { const s = JSON.stringify(next); _bc.postMessage(s.length <= 32768 ? { t: 'set', key: e.key, data: next, updatedAt: e.lastFetch } : { t: 'inv', keys: [e.key] }); }
// sse(url, { cache: true }): es.addEventListener('aegis-cache', ev => _applyCacheMsg(parse(ev.data), true));
```

**API:**

```js
configure({ cacheSync: true });
const live = sse('/events', { cache: true });   // сервер: event: aegis-cache\ndata: {"t":"inv","keys":["/api/orders"]}
// или точечно: data: {"t":"patch","key":"order:17","value":{...}}
// ничего больше не меняется: resource(url, { cache: true }) во всех вкладках видит запись
```

**Критерий:** Тест с моком BroadcastChannel: запись во вкладке A → вкладка B показывает данные через одно сообщение (≤10 мс, 0 fetch для 'set', 1 fetch для 'inv'); при последующем visibilitychange в B число запросов 0 (было N = число cached entry). SSE: событие aegis-cache 'inv' → активный ресурс перезапрошен, неактивный — помечен stale.

**Источники:** TanStack Query broadcastQueryClient (experimental), BroadcastChannel API, Aegis persisted() (тот же паттерн через storage), Phoenix LiveView / Hotwire Turbo Streams (server-push обновления), Linear sync engine (дельты по каналу)


---

# 🔭 persistence-multitab

**Линза:** vision / persistence-multitab

**Вывод:** В Aegis два несвязанных движка данных: in-memory SWR-кэш (`_resourceCache`, aegis_full.js:5736) и offline-движок с IndexedDB (`_offlineResource`, :8039), причём только второй переживает перезагрузку, а первый ничего не знает о других вкладках — `invalidate()` (:6055) и `mutation.invalidates` (:3707) действуют в одной вкладке, сеть в остальных «догоняет» лишь через focus-ревалидацию с 5-секундным троттлом (:5851). Многовкладочный offline сломан по-настоящему: очередь мутаций — один массив под ключом `__aegis_mutations__` с get→set в разных транзакциях (:7980-7985), а `_flushOffline` (:7994) защищён лишь модульным флагом `_offlineFlushing` — симуляция трёх вкладок, получивших `online` одновременно, даёт 30 POST на 10 мутаций (все 10 продублированы), а параллельный enqueue теряет записи. Background Sync регистрируется (:7986-7989), но обработчика `sync` в репозитории нет — это no-op. Предлагаемая модель: один слой entry `{data, at, etag}` с опциональным `persist` (IDB), BroadcastChannel как шина `set/inv` между вкладками, Web Locks как мьютекс flush и выбор лидера, очередь мутаций как отдельные записи `mut:<id>`, и опциональный `aegis-sw.js` для реального Background Sync. Суммарная стоимость всех набросков по esbuild+gzip отдельно — 2.2 KB, в составе бандла (общий словарь) реалистично ~1.3–1.5 KB при том, что объединение offline в cached убирает ~115 строк дублирующего движка.

**Отвергнуто:** SharedWorker как транспорт между вкладками: требует отдельного файла (или Blob-URL, который ломается под строгим CSP), нет в Chrome Android — Web Locks + BroadcastChannel покрывают выбор лидера и шину без этого. localStorage как persist-слой SWR-кэша: синхронный (блокирует main thread на больших payload), лимит ~5 MB на origin и строковая сериализация — IDB уже есть в коде (`_idb`, :7844) и хранит структурированный клон. Персистить кэш по умолчанию (как offline): персональные данные на общих машинах и рост storage без ведома разработчика — только opt-in с `version`. Cache Storage API (`caches.open`) вместо IDB для SWR: хранит Response, а не JSON, нет range-запросов и сортировки для LRU, а страница всё равно парсит тело. CRDT/конфликты мутаций между вкладками: очередь FIFO с серверной истиной достаточна для server-first приложений, слияние — задача сервера. Кэширование HTML/ассетов в aegis-sw.js: это ответственность приложения (Workbox), Aegis отвечает за данные и очередь. ETag/304 — вне линзы (известный пробел), но отмечу: поле `etag` в persist-записи даёт после reload `If-None-Match` → 304 с нулевым телом — естественное продолжение пункта 1.

## 💎 #15 — persist: SWR-кэш переживает перезагрузку (IDB-слой под _resourceCache)

**Impact:** 5 · **Effort:** M · **Size:** ~0.5 KB gz (набросок persist: 905 B min / 531 B gz отдельно; в бандле ~0.4 KB) + getAll в _idb ~0.1 KB

**Сейчас:** `_resourceCache` — чистая in-memory Map (aegis_full.js:5736); после reload каждый `resource(url, {cache:true})` стартует с `data=null` и делает запрос, единственный тёплый старт — `seed()/seedFrom()` из серверного HTML (:5873-5910). `_offlineResource` уже пишет `{data, timestamp}` в IDB-store `aegis-cache/resources` (:8087-8088, :8065-8073), но это отдельный движок без dedupe и `invalidate()`. Обёртка `_idb` (:7844-7952) умеет get/set/delete/keys — этого достаточно.

**Предложение:** Добавить в `_cachedResource` опцию `persist` (opt-in). При создании entry (`_cacheEntry`, :5738) с `persist` — асинхронно прочитать запись из IDB-store `swr` и, если entry ещё не `started`, засеять её как `seed(key, data, {age: now - at})`: staleTime уважается автоматически, а `_fetchEntry` (:5814) при просроченном `at` сразу ревалидирует — SWR из диска. При успешном ответе в `_fetchEntry` — write-behind в IDB (не блокирует сигнал). `version` в опции — несовпадение записи → удалить. Бюджет: поле `n` (длина JSON) в записи, LRU-эвикция по `at` при превышении `maxBytes` (по умолчанию 4 MB), отложенная на 2 с после записи. Через `navigator.storage.estimate()` — dev-warning при quota>80%. Не хранить по умолчанию (общие машины, персональные данные): только `persist:true` или `persist:{version, maxBytes, maxAge}`. `reset({cache:true})` (:8609) очищает и store.

**Алгоритм:**

```js
_cacheEntry(key, initial, p):
  e = new entry; if (p) _hydrateEntry(e, p)
_hydrateEntry(e, p):
  rec = await store('swr').get(e.key)
  if (!rec || e.started.peek()) return          // сеть уже ответила — диск проиграл
  if (p.version != null && rec.v !== p.version) { store.delete(e.key); return }
  batch(() => { e.data.value = rec.data; e.started.value = true })
  e.lastFetch = rec.at                          // staleTime считается от момента записи
  if (e.refCount > 0 && e.url && now - rec.at >= staleTime) _fetchEntry(e, e.url, e.fopts)   // SWR с диска
_fetchEntry success (после e.lastFetch = now):
  if (fopts.persist) store.set(e.key, { data: next, at: now, v, n: JSON.stringify(next).length })
    .then(() => _budget(store, maxBytes))
_budget (debounce 2s):
  recs = await store.getAll(); total = Σ n
  if (total <= max) return
  sort by at asc; delete until total <= 0.8*max   // LRU по времени записи
Симуляция (sim.mjs, 2000 ключей 0.5–20 KB, Zipf-доступ): hit-rate после reload
  512 KB → 18.8% (56 записей), 2 MB → 34.7% (211), 8 MB → 65.3% (810)
```

**API:**

```js
resource('/api/users?page=1', { cache: true, persist: true });                 // IDB, version 0, 4 MB
resource(url, { cache: { staleTime: 30_000, persist: { version: 3, maxBytes: 2e6, maxAge: 7 * 864e5 } } });
cache.clear({ persisted: true });   // из публичного cache API (уже в списке пробелов)
// d.ts: CacheOptions.persist?: boolean | { version?: number|string; maxBytes?: number; maxAge?: number }
```

**Критерий:** Тест в test.html: `resource(k,{cache:true,persist:true})` → settled → `reset()` → новый `resource(k,…)` с `defaults.fetcher = () => Promise.reject()` показывает данные с диска (`status==='success'`, `data` тот же JSON) без запроса; при `age >= staleTime` — ровно один запрос. Демо admin.html: reload страницы Users — 0 сетевых запросов до истечения staleTime (сейчас 2: /api/stats + /api/users). Бюджет: 3000 записей по 5 KB при maxBytes=4 MB → `storage.estimate().usage` для origin < 5 MB.

**Источники:** TanStack Query persistQueryClient / experimental_createPersister (buster/version, maxAge, LRU), SWR `provider` с localStorage-персистером, Apollo apollo3-cache-persist (maxSize), Storage Standard (navigator.storage.estimate/persist)

## 💎 #16 — BroadcastChannel-шина кэша: set/inv между вкладками

**Impact:** 4 · **Effort:** S · **Size:** ~0.3 KB gz (набросок bc: 627 B min / 414 B gz отдельно)

**Сейчас:** `invalidate()` (:6055-6062) и `mutation({invalidates})` (:3707) обходят только `_resourceCache` текущей вкладки. Соседняя вкладка узнаёт об изменении только через `_installRevalidate` (:5851-5868) при visibilitychange/focus, с троттлом 5 с — и делает свой запрос. Прецедент кросс-таб синка уже есть: `persisted()` слушает `storage`-event (:4103-4108).

**Предложение:** Один модульный `BroadcastChannel('aegis:cache')`, лениво создаваемый при первом cached-ресурсе. Два типа сообщений: `set {key, data, at}` — публикуется из `_fetchEntry` после успешного ответа и из `seed()`; `inv {key}` — из `invalidate()`. Получатель: если entry с таким ключом есть — `set` кладёт данные через `_share` (structural sharing, list() не перерисовывает) и выставляет `lastFetch=at`; `inv` обнуляет `lastFetch` и рефетчит только если вкладка видима и `refCount>0`, иначе оставляет `tick('focus')` (:5856). `tabId` в сообщении отсекает эхо. Опция `cache:{broadcast:false}` для ключей с большими payload (>64 KB структурированный клон — дорого); `inv` отправляется всегда. Fallback без BroadcastChannel (старый Safari) — ничего: поведение сегодняшнее.

**Алгоритм:**

```js
_channel():
  if (_bc !== null || !BroadcastChannel) return _bc
  _bc = new BroadcastChannel('aegis:cache')
  _bc.onmessage = ({data: m}) =>
    if (m.from === _tabId) return
    e = _resourceCache.get(m.key); if (!e) return
    if (m.t === 'set'):
      batch(() => { e.data.value = share ? _share(e.data.peek(), m.data) : m.data; e.error.value = null; e.started.value = true })
      e.lastFetch = m.at
    if (m.t === 'inv'):
      e.lastFetch = 0
      if (e.refCount > 0 && document.visibilityState === 'visible' && e.url) _fetchEntry(e, e.url, e.fopts, true)
      // hidden: подхватит tick('focus') при visibilitychange
_fetchEntry success: if (fopts.broadcast !== false) _post({t:'set', key:e.key, data:next, at:e.lastFetch})
invalidate(k): … existing …; _post({t:'inv', key:k})   // для предиката — по каждому совпавшему ключу
Арифметика (sim.mjs broadcastSavings): 4 вкладки, 10 мутаций, 40 переключений вкладок:
  сейчас ~50 запросов (1 на переключение при stale), с шиной — 10 (только источник мутации)
```

**API:**

```js
// ничего нового для типового кода: mutation({ invalidates: ['/api/todos'] }) теперь инвалидирует во всех вкладках
resource('/api/report', { cache: { broadcast: false } });   // большой payload — только inv, без пересылки data
// d.ts: CacheOptions.broadcast?: boolean (default true)
```

**Критерий:** Тест с двумя `BroadcastChannel` в одной странице (мок `_tabId`): `invalidate('/k')` в «вкладке A» → entry в B имеет `lastFetch===0` и один `_fetchEntry`; `seed('/k', data)` в A → `r.data.peek() === data` в B без запросов. Ручная проверка в admin.html: две вкладки, Save пользователя в первой → таблица во второй обновляется < 100 мс без фокуса; счётчик запросов на моке `/api/users` во второй вкладке не растёт.

**Источники:** SWR `useSWRSubscription`/broadcast-channel middleware, TanStack `broadcastQueryClient` (BroadcastChannel), RxDB/dexie liveQuery cross-tab, MDN Broadcast Channel API

## 💎 #17 — Web Locks: мьютекс _flushOffline + примитив leader()

**Impact:** 4 · **Effort:** S · **Size:** ~0.25 KB gz (набросок locks: 532 B min / 319 B gz)

**Сейчас:** `_flushOffline` (:7994-8031) защищён только модульным `_offlineFlushing` — переменной этой вкладки. Событие `online` приходит во все вкладки одновременно (:7973), `load()` каждой offline-ресурса тоже вызывает flush (:8109). Каждая вкладка читает всю очередь, отправляет все мутации и пишет свой `remaining` — дубли POST/DELETE на сервере. `_idb` уже обрабатывает `onversionchange`/`onblocked` от других вкладок (:7868, :7875), т.е. многовкладочность подразумевается.

**Предложение:** Обернуть тело `_flushOffline` в `navigator.locks.request('aegis:sync', {ifAvailable:true}, fn)`: лок не получен → другая вкладка уже шлёт, выйти. Без Web Locks (нет в очень старых WebView) — прежнее поведение. На этом же API — публичный `leader(name)`: сигнал `true` у вкладки, держащей лок `aegis:leader:<name>`; при закрытии вкладки лок освобождается и лидером становится следующая — без heartbeat и таймаутов. Лидер нужен трём вещам ниже: flush очереди, общий polling, общий SSE.

**Алгоритм:**

```js
_withLock(name, fn):
  if (!navigator.locks) return fn()
  return navigator.locks.request(name, { ifAvailable: true }, lock => lock ? fn() : undefined)
_flushOffline(store) = _withLock('aegis:sync', async () => { ...existing body... })

export function leader(name = 'aegis', { fallback = true } = {}):
  is = signal(false)
  if (!navigator.locks) { is.value = fallback; return is }
  ac = new AbortController()
  navigator.locks.request('aegis:leader:' + name, { signal: ac.signal },
      () => { is.value = true; return new Promise(() => {}) })   // держим лок до dispose/закрытия вкладки
      .catch(() => {})
  if (_currentScope) _currentScope.onDispose(() => ac.abort())
  return is

Симуляция (sim.mjs flushRace): 3 вкладки, 10 мутаций в очереди, одновременный online:
  без лока — sent: 30, duplicated: 10   (каждая мутация ушла 3 раза)
  с локом  — sent: 10, duplicated: 0
```

**API:**

```js
const isLeader = leader();                         // Signal<boolean>; лок отпускается при dispose scope
effect(() => { if (isLeader.value) startPoll(); });
// внутренне: _flushOffline, polling cached-ресурсов и sse({shared:true}) используют leader()
// d.ts: export function leader(name?: string, opts?: { fallback?: boolean }): ReadonlySignal<boolean>
```

**Критерий:** Мок `navigator.locks` в test.html (очередь промисов): два параллельных `_flushOffline` с одной очередью из 5 мутаций → сервер-мок получил ровно 5 запросов (сейчас 10). `leader()`: два вызова — ровно один `true`; `ac.abort()` первого → второй становится `true` в следующем микротике. Ручная проверка: две вкладки admin.html, offline → 3 сохранения → online: сервер-лог 3 запроса, не 6.

**Источники:** Web Locks API (W3C/WICG, navigator.locks, ifAvailable, leader election recipe в спецификации), broadcast-channel `LeaderElection` (pubkey), Workbox background-sync `Queue` (single-consumer)

## 💎 #18 — Очередь мутаций как записи mut:<id>, а не один массив под __aegis_mutations__

**Impact:** 4 · **Effort:** S · **Size:** ≈0 (набросок queue 531 B gz заменяет существующие ~500 B gz кода _enqueueOffline/_flushOffline; +0.1 KB getAll)

**Сейчас:** `_enqueueOffline` (:7980-7991): `queue = await store.get(_QUEUE_KEY)` → push → `store.set(...)` — две транзакции, read-modify-write без атомарности. `_MAX_QUEUE = 1000` с `queue.shift()` молча выбрасывает самую старую мутацию (:7982). `_flushOffline` после отправки пишет `remaining` целиком (:8016) — затирает всё, что другая вкладка добавила во время flush. Очередь лежит в том же store, что и данные ресурсов (`resources`), под спец-ключом.

**Предложение:** Каждая мутация — отдельная запись с ключом `mut:<mutId>` (mutId уже есть: :8117). Enqueue = один `put` в одной транзакции; flush = `getAll(IDBKeyRange.bound('mut:', 'mut:￿'))` (порядок ключей = порядок вставки, если mutId начинать с `Date.now()` с паддингом), после успеха — `delete` только этой записи; чужие новые записи не затираются. Лимит очереди — не shift, а отказ с ошибкой в `send()` (мутация пользователя не должна исчезать молча). В запись снимать заголовки CSRF (`_csrfToken()`, :1353) на момент enqueue — их сможет повторить Service Worker (пункт про SW), где нет `document`. Добавить `getAll(range)` в `_idb` (:7930 рядом с `keys()`).

**Алгоритм:**

```js
mutId = Date.now().toString(36).padStart(9,'0') + '_' + rand(6)   // лексикографически упорядочен
_enqueueOffline(m, store):
  m.headers = csrfHeaders()               // снимок для SW
  n = (await store.count(range))          // или getAllKeys(range).length
  if (n >= _MAX_QUEUE) throw new Error('[Aegis] offline queue is full')
  await store.set('mut:' + m.mutId, m)   // одна readwrite-транзакция
  sync.register(...)
_flushOffline: (под локом из предыдущего пункта)
  queued = await store.getAll(IDBKeyRange.bound('mut:', 'mut:￿'))
  for m of queued:
    try { await withRetry(() => request(m.url, {method, body, headers: m.headers}), {retries: 2})
          await store.delete('mut:' + m.mutId); touched.add(m.cacheKey) }
    catch { failed++ }
  for k of touched: invalidate(k)         // вместо _offlineRefreshers
  backoff как сейчас
Симуляция (sim.mjs enqueueRace): 3 вкладки × 5 параллельных enqueue при get/set в разных транзакциях —
  сохранилось 1 из 15 (худшее чередование); с атомарным add — 15 из 15
```

**API:**

```js
// публичное поведение без изменений; появляется наблюдаемость:
const q = offlineQueue();            // { size: ReadonlySignal<number>, items(): Promise<Mutation[]>, drop(id) }
html`<span ?hidden=${() => !q.size.value}>${q.size} pending</span>`
// send() при переполнении: reject с Error, а не тихий shift()
```

**Критерий:** Тест с fake-IDB (Map-обёртка `_idb` через `defaults`/`reset`): 20 параллельных `_enqueueOffline` → 20 записей (сейчас теряются); flush при одновременно добавленной записи → она остаётся в store. Миграция: при первом flush старый массив `__aegis_mutations__` перекладывается в записи и удаляется — тест «legacy queue migrated». Бенч: enqueue 1000 мутаций — время O(1) на запись вместо перезаписи растущего массива (сейчас последняя запись клонирует 1000 элементов).

**Источники:** Workbox background-sync (IDB-store `requests` по одной записи, Queue.replayRequests), Dexie Syncable, паттерн outbox (Enterprise Integration Patterns), IndexedDB spec (getAll с IDBKeyRange)

## 💎 #19 — Одна модель данных: offline = cached + persist + queue, вместо двух движков

**Impact:** 5 · **Effort:** L · **Size:** отрицательная или ~0: −~0.9 KB gz (_offlineResource + _offlineRefreshers + send) против +0.5 KB persist +0.15 KB дескриптор в mutation

**Сейчас:** `resource()` (:3578-3582) выбирает один из трёх движков; `_offlineResource` (:8039-8153, ~115 строк) — копия `_plainResource` с IDB: свои сигналы, без dedupe (два `resource('/api/settings',{offline:true})` — два запроса), без `revalidateOn`, без `keepPrevious`, `invalidate()` его не видит (обходит только `_resourceCache`), `mutation({invalidates})` его не обновляет — вместо этого параллельный реестр `_offlineRefreshers` (:7955, :8105-8110). `send()` (:8116-8135) — своя мини-`mutation()` без pending/rollback/concurrent. `cache` и `offline` взаимоисключающие (известный пробел).

**Предложение:** Сделать `offline: true` сахаром над `cache: { persist: true, offlineQueue: true }`: entry общий, SWR/dedupe/broadcast/invalidate — бесплатно. `mutate()` локальная запись при `persist` пишет в IDB (как `mutateLocal`, :8112). Сетевые мутации — через существующий `mutation()`, но с сериализуемым дескриптором вместо замыкания: `mutation(['POST', '/api/todos'], { offline: true, optimistic, invalidates })` — при оффлайне/сетевой ошибке (`_isNetworkError`, :7978) дескриптор `{method,url,body}` идёт в очередь, `pending` снимается, откат не делается (сервер догонит). `send()` оставить как тонкий alias для совместимости на один релиз. Удалить `_offlineResource`, `_offlineRefreshers`; `online`/`syncing` сигналы — на результат любого cached с persist (`extra`). `OfflineOptions` в d.ts становится `CacheOptions & { offlineQueue?: boolean }`.

**Алгоритм:**

```js
resource(src, opts):
  if (opts.offline) opts = { ...opts, cache: { persist: true, offlineQueue: true, ...(typeof opts.offline==='object' ? opts.offline : {}) } }
  if (opts.cache) return _cachedResource(src, ...)
  return _plainResource(src, opts)

_cachedResource + persist: (пункт 1) + mutate → if (persist) store.set(key, {data, at: now})

mutation(fnOrDesc, opts):
  desc = Array.isArray(fnOrDesc) ? fnOrDesc : null   // ['POST', url] | (args) => ({method,url,body})
  fn = desc ? (body, {signal}) => request(desc[1], {method: desc[0], body, signal}) : fnOrDesc
  exec(args):
    … existing optimistic/snapshots …
    try { result = await fn(...) }
    catch (e):
      if (opts.offline && desc && _isNetworkError(e)):
        await _enqueueOffline({ mutId, method: desc[0], url: desc[1], body: args[0], cacheKey: opts.invalidates?.[0] }, store)
        return undefined            // без отката: оптимистичные данные остаются, persist их сохранил
      rollback; throw
  invalidates → invalidate(k) → broadcast inv (пункт 2)
_flushOffline success → invalidate(m.cacheKey)   // вместо _offlineRefreshers
```

**API:**

```js
const settings = resource('/api/settings', { offline: true });          // = cache + persist + очередь; API прежний
const save = mutation(['PUT', '/api/settings'], {
    offline: true,
    resources: [settings],
    optimistic: (body) => settings.mutate(body),
    invalidates: ['/api/settings'],
});
save(form.values());        // онлайн — сеть; офлайн — очередь + Background Sync; pending/error как у любой mutation
// d.ts: mutation(desc: [method: string, url: string] | ((...a) => {method,url,body}), opts & { offline?: boolean })
```

**Критерий:** Все существующие тесты 💎 #17 offlineResource (test.html:3765-3800) проходят без изменений через новый путь. Новый тест: два `resource('/k',{offline:true})` — один запрос (сейчас два); `mutation(['POST','/k'],{offline:true, invalidates:['/k']})` при `defaults.fetcher` → network error: запись в очереди, `pending===false`, data не откатилась; после `_flushOffline` — `invalidate('/k')` вызвал рефетч. Размер: `aegis.min.js` gzip не растёт (удаление ~115 строк компенсирует persist).

**Источники:** TanStack Query `networkMode: 'offlineFirst'` + `MutationCache` с `persistQueryClient` и `resumePausedMutations`, RTK Query offline, Workbox BackgroundSyncPlugin, паттерн outbox

## 💎 #20 — Service Worker как слой: aegis-sw.js с обработчиком sync и мостом в страницу

**Impact:** 3 · **Effort:** M · **Size:** ядро +~0.15 KB gz (swBridge 204 B gz отдельно); aegis-sw.js вне бандла ~1 KB gz

**Сейчас:** `_enqueueOffline` регистрирует `reg.sync.register('aegis-sync')` (:7986-7989), но в репозитории нет ни SW-скрипта, ни обработчика события `sync` — Background Sync сегодня no-op: очередь уезжает только когда вкладка открыта и получила `online`. `navigator.serviceWorker.ready` без регистрации SW — вечно висящий промис (безвредно). Страница не слушает `message` от SW нигде (grep по `serviceWorker` — только :7986).

**Предложение:** Отдельный файл `aegis-sw.js` (в репо уже есть `aegis-devtools.js`, `aegis-test.js` — прецедент необязательных модулей, не в бандле), импортируемый пользователем в свой SW через `importScripts`/`import`: экспортирует `handleSync(event)` — открывает тот же IDB (`aegis-cache/resources`), читает `mut:*` записи, повторяет `fetch` с сохранёнными `headers` (CSRF снимок из пункта 4), удаляет успешные, затем `clients.matchAll()` → `postMessage({t:'aegis:synced', keys})`. В ядре — 6 строк `_installSwBridge()`: `navigator.serviceWorker.addEventListener('message')` → `invalidate(key)` для каждого ключа (что через BroadcastChannel дойдёт до всех вкладок). Лок `aegis:sync` через `navigator.locks` доступен и в SW — flush из SW и из вкладки не пересекаются. Кэширование HTML/ассетов в SW не делать — это ответственность приложения; Aegis отвечает только за данные и очередь.

**Алгоритм:**

```js
// aegis-sw.js (worker scope)
export async function handleSync(event, { dbName = 'aegis-cache', storeName = 'resources' } = {}):
  if (event.tag !== 'aegis-sync') return
  event.waitUntil(navigator.locks.request('aegis:sync', async () => {
    db = await openDB(dbName)                                 // тот же _idb, урезанный до 25 строк
    recs = await getAll(db, storeName, IDBKeyRange.bound('mut:', 'mut:￿'))
    keys = new Set()
    for m of recs:
      r = await fetch(m.url, { method: m.method, headers: { 'content-type': 'application/json', ...m.headers }, body: JSON.stringify(m.body), credentials: 'same-origin' })
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) { await del(db, storeName, 'mut:' + m.mutId); keys.add(m.cacheKey) }
      else throw new Error('retry')                           // reject → браузер повторит sync с backoff
    for c of await self.clients.matchAll({ type: 'window' }) c.postMessage({ t: 'aegis:synced', keys: [...keys] })
  }))

// ядро
_installSwBridge(): navigator.serviceWorker?.addEventListener('message', ({data: m}) =>
  m?.t === 'aegis:synced' && m.keys.forEach(invalidate))
```

**API:**

```js
// sw.js приложения
import { handleSync } from './aegis-sw.js';
self.addEventListener('sync', (e) => handleSync(e));
// страница — ничего: очередь уходит даже при закрытых вкладках, при открытии — invalidate через мост
// опционально: resource(url, { offline: { syncTag: 'orders' } }) — свой тег на очередь (уже есть syncTag, :8045)
```

**Критерий:** Ручной сценарий в Chrome: admin.html + sw.js с `handleSync`; DevTools → Offline, 2 сохранения, закрыть вкладку, снять Offline → сервер-лог получает 2 PUT без открытой вкладки; открыть вкладку → `invalidate` пришёл через `message` (лог в dev-панели). Юнит: `handleSync` с мок-`fetch` и fake-IDB (node-тест по образцу test-core.mjs): 3 записи, вторая 500 → две удалены, промис reject (браузер повторит), одна остаётся. Размер ядра: +~0.15 KB gz; aegis-sw.js ~1 KB gz отдельно.

**Источники:** Workbox background-sync (BackgroundSyncPlugin, Queue.replayRequests, SW+IDB), Background Synchronization API (WICG), MDN Client.postMessage / navigator.serviceWorker message, Web Locks в worker scope

## 💎 #21 — Лидер-вкладка держит polling и SSE, остальные получают данные по шине

**Impact:** 3 · **Effort:** M · **Size:** ~0.15 KB gz polling (sharedPoll 215 B gz отдельно) + ~0.4 KB gz shared sse

**Сейчас:** `refetch.interval` есть только в `_plainResource` (:3671-3676, через `poll()`), у cached — нет (известный пробел). `sse()` (:3835-3855) открывает `EventSource` в каждой вкладке: 6 вкладок на HTTP/1.1 исчерпывают лимит соединений на хост, и каждая держит своё соединение. `poll()` спит в фоновой вкладке (DIAMONDS-2 #106), но два видимых окна рядом опрашивают оба.

**Предложение:** Добавить `refetch.interval` в `_cachedResource`, но опрашивает только держатель `leader('poll:'+key)` (пункт 3); ответ через `_fetchEntry` → `set` по BroadcastChannel (пункт 2) попадает в те же entry в остальных вкладках — один запрос на N вкладок, данные везде обновлены одновременно. Для `sse(url, {shared:true})`: `EventSource` открывает только лидер, каждое событие ретранслируется в `BroadcastChannel('aegis:sse:'+url)`; не-лидеры получают `status:'open'` и события из канала; при закрытии лидера лок переходит следующей вкладке — она открывает своё соединение (последний `Last-Event-ID` передать через канал для восстановления). Полностью opt-in.

**Алгоритм:**

```js
// cached polling
if (refetch?.interval > 0):
  lead = leader('poll:' + (explicitKey ?? String(source)))
  poll(() => { e = current.peek(); if (lead.peek() && e && !e.inflight.peek()) return _fetchEntry(e, e.url, e.fopts, true) }, refetch.interval)
  // не-лидер: entry обновляется из 'set' сообщений; при смене лидера poll уже тикает — просто начинает слать

// sse shared
sse(url, { shared: true, ...opts }):
  ch = new BroadcastChannel('aegis:sse:' + url); lead = leader('sse:' + url)
  status = signal('connecting'); let es = null, lastId = null
  dispatch = (name, data, id) => { lastId = id; (name ? events[name] : onMessage)?.(parse(data)) ; signals-patch как сейчас }
  effect(() => {
    if (lead.value) { es = new EventSource(url + (lastId ? '?lastEventId=' + lastId : '')); es.onopen = () => { status.value = 'open'; ch.postMessage({t:'open'}) }
                      forward = (e) => { dispatch(e.type, e.data, e.lastEventId); ch.postMessage({t:'ev', name: e.type, data: e.data, id: e.lastEventId}) } … }
    else { ch.onmessage = ({data: m}) => m.t === 'open' ? status.value = 'open' : dispatch(m.name, m.data, m.id) }
  })
  close = () => { es?.close(); ch.close(); ac.abort() }
Соединений на хост: N вкладок → 1 (лимит 6 на HTTP/1.1 больше не упирается)
```

**API:**

```js
const stats = resource('/api/stats', { cache: true, refetch: { interval: 5000 } });   // опрашивает одна вкладка, видят все
const live = sse('/events', { shared: true, signals: { progress }, events: { message: onMsg } });
// d.ts: CacheOptions & { refetch?: ResourceOptions['refetch'] }; SseOptions.shared?: boolean
```

**Критерий:** Бенч по мотивам DIAMONDS-2 #106: 5 видимых окон admin.html Dashboard с `refetch.interval: 5000`, 10 минут: сейчас 5×120 = 600 запросов /api/stats, с лидером — 120 (−80%), при этом `stats.data` во всех окнах обновляется в пределах одного интервала. SSE: 8 вкладок с `sse(url,{shared:true})` — на сервере 1 открытое соединение (сейчас 8), событие доходит до всех 8 (`onMessage` вызван 8 раз); закрытие вкладки-лидера → новое соединение в течение < 1 с (лок перешёл), событий не потеряно при передаче `Last-Event-ID`.

**Источники:** SWR `refreshInterval` + `dedupingInterval`, TanStack `refetchInterval` с leader через `broadcastQueryClient`, паттерн «SharedWorker/leader для WebSocket» (Slack/Figma engineering blogs), EventSource `Last-Event-ID` (HTML spec)


---

# 🔭 prefetch-prediction

**Линза:** vision / prefetch-prediction — намерение пользователя, граф переходов, приоритеты и бюджет сети, прогрев данных маршрутов и островов до клика

**Вывод:** В Aegis уже есть все «кирпичи» предвыборки — prefetch()/prefetchOn() (aegis_full.js:5912–5952), прогрев visible-островов за 400px (3304, 3344–3349), router({ preload }) (7531–7556), boost({ prefetch }) (8429–8434), priority:'low' у prefetch (5914) и проверка saveData (5929–5930) — но они не согласованы между собой: три разных детектора hover (80 мс с отменой в prefetchOn против мгновенного срабатывания без отмены в router и boost), бюджет сети учитывается только в prefetchOn, а прогрев данных маршрута вообще не связан с loader (preload греет только код, loader выполняется после клика — 7317). Главный дефект: прогретая prefetch() запись не считается «свежей» для resource(url,{cache:true}) — _fetchEntry (5818) смотрит staleTime вызывающего (по умолчанию 0, 5963), поэтому после prefetch запрос уходит повторно; тест (test.html:1339) проходит только потому, что явно ставит staleTime: 60000. Симуляции (scratchpad/agents/prefetch-prediction/sim.mjs) показывают: velocity-gated hover снижает пустые прогревы с 4.0 до 0.13 на клик при lead ≈ 293 мс; адаптивный rootMargin по скорости скролла снижает «данные опоздали» с 25.6% до 8.7%; локальная марковская модель переходов даёт 59–63% попаданий top-2/3 после ~100 сессий. Всё реализуемо на ванильном JS, суммарный прирост ≈ 2.5–3 KB gzip при полном наборе, каждая часть tree-shakeable.

**Отвергнуто:** 1) Prerender через Speculation Rules для boost()-навигации — boost делает fetch+morph, а prefetch-кэш спекуляций доступен только реальной навигации, не fetch(); совмещать бессмысленно (оставлено как dev-warning в предложении 7). 2) <link rel=prefetch> для JSON API как замена prefetch() — попадание в HTTP-кэш зависит от Vary/Accept и заголовка X-Requested-With (1224), который Aegis шлёт всегда; ненадёжно, кэш Aegis (Map) предсказуемее. 3) Service Worker с предвыборкой — нарушает zero-build/один файл, требует отдельного SW-скрипта и регистрации; offline-секция уже пользуется Background Sync, но полноценный SW-router — другой продукт. 4) Марковская модель 2-го порядка / ML-веса (Guess.js с аналитикой) — на локальных данных одного пользователя разреженность убивает точность (в симуляции 1-й порядок уже в 3% от оракула), а серверная аналитика противоречит «никаких зависимостей и трекинга». 5) Прогрев по траектории курсора с экстраполяцией к цели (предсказание элемента до pointerover) — выигрыш в lead ≈ 30–60 мс по сравнению с velocity-gating не оправдывает ~0.5 KB и хрупкость на тачпадах. 6) Абсолютный лимит трафика (байты/сессия) — нет доступа к размеру ответа до получения (Content-Length часто отсутствует при gzip), ограничение по числу запросов (предложение 4) достаточно. 7) Автоматическое включение predict() по умолчанию — записывать граф переходов в localStorage без явного вызова противоречит принципу «не трогай то, чего не просили», и польза не доказана без метрики предложения 8.

## 💎 #22 — freshUntil на записи кэша: prefetch() реально экономит запрос

**Impact:** 5 · **Effort:** S · **Size:** +0.1 KB gzip (одно поле, две строки в _fetchEntry, правка seed/prefetch/invalidate)

**Сейчас:** aegis_full.js:5912–5920 prefetch() вызывает _fetchEntry с { staleTime: opts.staleTime ?? 30000 }, но _fetchEntry (5814–5819) проверяет `Date.now() - e.lastFetch < (fopts.staleTime || 0)` по fopts ВЫЗЫВАЮЩЕГО. _cachedResource по умолчанию staleTime = 0 (5963), значит resource(url, { cache: true }) после prefetch(url) показывает прогретые данные и сразу шлёт второй запрос. test.html:1339 маскирует это через staleTime: 60000. То же для seed() (5873): age учитывается только если у потребителя staleTime > 0. Кроме того, island warm (3304) и prefetchOn не передают staleTime → повтор запроса при монтировании острова.

**Предложение:** Хранить свежесть на записи: e.freshUntil = lastFetch + staleTime, выставляемый тем, кто ПОЛОЖИЛ данные (prefetch, seed, обычный fetch). В _fetchEntry пропускать запрос, если `now < max(e.freshUntil, e.lastFetch + fopts.staleTime)`. Прогретые данные становятся источником правды на свой staleTime независимо от опций потребителя; после истечения — обычный SWR. Добавить dev-предупреждение E0xx «prefetch(url) was followed by a refetch within N ms — pass staleTime or rely on freshUntil», чтобы регрессия была видна.

**Алгоритм:**

```js
// в _cacheEntry: freshUntil: 0
// в _fetchEntry(e, url, fopts, force):
const now = Date.now();
const fresh = Math.max(e.freshUntil, e.lastFetch + (fopts.staleTime || 0));
if (!force && now < fresh) return Promise.resolve();
...
// после успешного ответа:
e.lastFetch = now2; e.freshUntil = now2 + (fopts.staleTime || 0);
// prefetch(): fopts.staleTime = opts.staleTime ?? 30000 → freshUntil = +30s
// seed(key, data, {age, staleTime = 30000}): e.freshUntil = Date.now() - age + staleTime
// invalidate(): e.lastFetch = 0; e.freshUntil = 0;
```

**API:**

```js
Публичный API не меняется. Поведение:
  await prefetch('/api/users/42');            // freshUntil = +30 s
  resource('/api/users/42', { cache: true }); // 0 запросов в течение 30 s (сейчас — 1)
  seed('/api/list', rows, { age: 5000, staleTime: 60000 });
Опция prefetch({ staleTime }) уже есть в d.ts:676.
```

**Критерий:** test.html: убрать staleTime из теста #111 (строка 1339) — assert «запрос не повторяется» должен проходить; новый тест: prefetch → через 31 s (fake timers) resource делает 1 запрос; invalidate() сбрасывает freshUntil. В demo/admin.html при hover→click по карточке: 0 XHR при открытии (DevTools Network).

**Источники:** TanStack Query (staleTime на query, а не на observer: prefetchQuery({staleTime})), SWR (dedupingInterval), HTTP Cache-Control max-age семантика «кто положил — тот и знает срок»

## 💎 #23 — Единый детектор намерения _intent(): velocity-gated hover с отменой для prefetchOn, router.preload и boost.prefetch

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip хелпер, −0.3 KB за счёт удаления трёх дублей → ≈ +0.1–0.2 KB нетто

**Сейчас:** Три несогласованных реализации: prefetchOn (5942–5949) — таймер 80 мс, отмена на pointerout, поддержка tap/visible; router preload (7548–7552) — warm(a) на КАЖДОМ pointerover/focusin/touchstart без задержки, без отмены и без дедупа (повторный hover по одной ссылке снова зовёт node.preload); boost prefetch (8430–8433) — то же, мгновенно на pointerover; pageCache живёт 5 с (8353), поэтому hover за 6 с до клика бесполезен. Скорость курсора нигде не учитывается.

**Предложение:** Вынести один внутренний хелпер _intent(root, selector, fire, { on: 'hover'|'tap'|'visible', delay, rootMargin }) в секцию 24 и использовать его во всех трёх местах. Hover-логика: на pointerover запомнить (x,y,t); на первом pointermove над целью считать скорость; если v < 300 px/s — стрелять сразу (пользователь замедлился = целится), иначе таймер 150 мс; pointerout/blur отменяет; pointerdown стреляет всегда. Дедуп по цели: WeakSet<Element> с TTL = staleTime. Для touch (нет hover) — pointerdown (уже ~100 мс до click). Заодно поднять TTL boost.pageCache до 30 с и сделать prefetch:'visible' для boost через тот же хелпер.

**Алгоритм:**

```js
Симуляция (sim.mjs, 20k кликов, 4 «прохода мимо» на клик, ссылка 36px, v_проход ~ LN(800 px/s), v_цель ~ LN(120 px/s), hover-до-клика ~ LN(250 мс)):
  immediate (router/boost сейчас): waste/click=4.00, lead=300 ms
  delay 80ms (prefetchOn сейчас):  waste/click=0.49, missed=3.0%, lead=226 ms
  velocity<300 else 150ms:         waste/click=0.13, missed=1.2%, lead=293 ms

function _intent(root, sel, fire, { on = 'hover', delay = 150, vmax = 300, rootMargin = '200px' } = {}) {
  const seen = new WeakMap(); // el → until
  const go = (el) => { const u = seen.get(el); if (u && u > Date.now()) return; seen.set(el, Date.now() + 30000); fire(el); };
  if (on === 'visible') return observeEach(root, sel, go, rootMargin); // через _sharedIO(rootMargin)
  let t = null, el = null, px = 0, py = 0, pt = 0;
  const over = (e) => { el = e.target.closest(sel); if (!el) return; px = e.clientX; py = e.clientY; pt = e.timeStamp; clearTimeout(t); t = setTimeout(() => go(el), delay); };
  const move = (e) => { if (!el || !t) return; const dt = e.timeStamp - pt || 1; const v = Math.hypot(e.clientX - px, e.clientY - py) / dt * 1000; if (v < vmax) { clearTimeout(t); t = null; go(el); } px = e.clientX; py = e.clientY; pt = e.timeStamp; };
  const out = () => { clearTimeout(t); t = null; el = null; };
  const down = (e) => { const a = e.target.closest(sel); if (a) { clearTimeout(t); go(a); } };
  return on === 'tap' ? on(root, 'pointerdown', down, {passive:true})
    : composeDisposers(on(root,'pointerover',over,{passive:true}), on(root,'pointermove',move,{passive:true}), on(root,'pointerout',out), on(root,'focusin',over), on(root,'focusout',out), on(root,'pointerdown',down,{passive:true}));
}
```

**API:**

```js
prefetchOn(el, urlOrFn, { on: 'hover', delay: 150, velocity: 300 })   // новые опции с дефолтами
router(routes, { preload: 'hover' | 'visible' | { on, delay } })
boost({ prefetch: 'hover' | 'visible' | { on, delay }, pageCacheTime: 30000 })
Старые сигнатуры валидны без изменений.
```

**Критерий:** test.html: синтетические PointerEvent — быстрый пролёт (3 pointermove за 40 мс, 60 px) → 0 fetch; замедление (pointermove с v=100 px/s) → fetch до истечения 150 мс; pointerout → отмена; повторный hover в течение 30 с → 0 доп. вызовов node.preload. Бенч на demo/admin.html: провести курсор по меню из 8 пунктов до цели — ≤1 лишний запрос (сейчас 7).

**Источники:** instant.page (mousedown/hover 65 мс), quicklink (viewport), Guess.js, Chrome Speculation Rules eagerness:'moderate' (hover 200 мс / pointerdown) — те же пороги; работы по predicting cursor target (Fitts’ law deceleration)

## 💎 #24 — Прогрев данных маршрута: router preload запускает loader до клика, handleRoute забирает готовый Promise

**Impact:** 5 · **Effort:** M · **Size:** +0.35 KB gzip внутри секции 30 (tree-shakeable вместе с router)

**Сейчас:** router (7531–7556): warm(a) при hover резолвит только код — _resolveHandler(m.node) (7262) — и зовёт необязательный node.preload(params). loader выполняется в handleRoute после навигации (7317: `data = await leaf.loader(match.params, {signal, query, params})`) — то есть даже при preload:'hover' пользователь ждёт RTT loader-а после клика. Результат loader нигде не кэшируется, разработчику приходится дублировать логику loader в preload и в resource cache. В JSDoc-примере (7191) loader делает api.get — идеальный кандидат для прогрева.

**Предложение:** При preload (hover/visible/predict) запускать leaf.loader с signal и priority:'low' и класть Promise в _loaderCache: Map<pathKey, { p, t, params }> с TTL (opts.preloadTTL, по умолчанию 30 с). В handleRoute: если есть свежая запись для того же pathname+search — использовать её вместо нового вызова, затем удалить. При навигации на другой путь — abort всех незавершённых спекулятивных loader-ов (они держат соединения). Ошибка прогрева не показывается (запись просто удаляется, клик пойдёт обычным путём). node.preload остаётся как расширение (прогрев кода островов, картинок).

**Алгоритм:**

```js
const _loaderCache = new Map();
const warmData = (m, pathKey) => {
  if (!m.node.loader || _loaderCache.has(pathKey) || !_netBudget().speculate) return;
  const c = new AbortController();
  const p = Promise.resolve(m.node.loader(m.params, { signal: c.signal, query: m.query, params: m.params, speculative: true }));
  p.catch(() => _loaderCache.delete(pathKey));
  _loaderCache.set(pathKey, { p, c, t: Date.now() });
  setTimeout(() => { const e = _loaderCache.get(pathKey); if (e && e.p === p) { _loaderCache.delete(pathKey); } }, preloadTTL);
};
// в handleRoute (7317):
const hit = _loaderCache.get(match.pathname + match.search);
if (hit && Date.now() - hit.t < preloadTTL) { _loaderCache.delete(key); data = await hit.p; }
else data = await leaf.loader(...);
// в navigate(): for (const [k,e] of _loaderCache) if (k !== targetKey) { e.c.abort(); _loaderCache.delete(k); }
```

**API:**

```js
router({
  '/users/:id': { loader: (p, { signal, speculative }) => api.get(`/api/users/${p.id}`, { signal, priority: speculative ? 'low' : 'high' }), handler },
}, { preload: 'hover', preloadTTL: 30000 })
// preload: true теперь = код + данные; preloadData: false — только код (старое поведение)
```

**Критерий:** test.html: hover по <a href="/users/1"> → loader вызван 1 раз; click через 100 мс → handler получает те же данные, loader не вызывается повторно; hover→уход→hover другой ссылки→click → первый loader abort-нут (signal.aborted === true). Метрика в demo/admin.html: время click→aegis:load для маршрута с loader 250 мс падает с ~260 мс до ~10 мс (при hover ≥ 250 мс).

**Источники:** Remix/React Router <Link prefetch="intent"> (loader на hover, 100 мс), SvelteKit data-sveltekit-preload-data="hover" (loader + модуль), Next.js router.prefetch, Angular PreloadingStrategy

## 💎 #25 — Центральный бюджет сети _netBudget(): уровни по navigator.connection, лимит одновременных спекуляций, priority hints везде

**Impact:** 4 · **Effort:** M · **Size:** +0.45 KB gzip (хелпер + очередь + 5 точек подключения)

**Сейчас:** saveData/effectiveType проверяет только prefetchOn (5929–5930) и лишь переключает режим на tap. prefetch() (5912), island warm (3304, 3346), router preload (7531), boost prefetch (8429), predict — игнорируют экономию трафика. priority:'low' ставится только в prefetch() (5914); request() пробрасывает ...rest в fetch (1347), так что priority уже доходит до сети, но _fetchEntry (5827), _plainResource (3616), loader маршрута и offline (8084) не задают приоритет — eager-остров и спекулятивный prefetch конкурируют на равных. Нет ограничения числа одновременных спекулятивных запросов: hover по списку из 50 карточек = 50 fetch (HTTP/1.1: очередь на 6 соединений, тормозит и реальные запросы).

**Предложение:** Один внутренний хелпер _netBudget() → { speculate: boolean, lead: 1|0.5|0, maxInflight } по navigator.connection (saveData или 2g/slow-2g → speculate:false; 3g → lead 0.5, maxInflight 1; иначе lead 1, maxInflight 3) и prefers-reduced-data (media query). Все спекулятивные пути (prefetch, warm, preload, boost, predict) проходят через _speculate(fn): если speculate=false — noop (кроме tap, который и есть клик); если инфлайт ≥ maxInflight — очередь LIFO (последнее намерение важнее), очередь очищается при навигации. Приоритеты: спекулятивные — 'low'; eager-острова и route loader после клика — 'high'; остальное — 'auto'. Публичная ручка configure({ speculation }).

**Алгоритм:**

```js
function _netBudget() {
  const c = navigator.connection || {};
  if (_config.speculation === false || c.saveData || /2g/.test(c.effectiveType || '') || matchMedia?.('(prefers-reduced-data: reduce)').matches) return { speculate: false, lead: 0, max: 0 };
  if (c.effectiveType === '3g') return { speculate: true, lead: 0.5, max: 1 };
  return { speculate: true, lead: 1, max: _config.speculation?.maxInflight ?? 3 };
}
let _spec = 0; const _specQ = [];
function _speculate(run) {           // run(): Promise
  const b = _netBudget(); if (!b.speculate) return Promise.resolve();
  if (_spec >= b.max) { _specQ.push(run); if (_specQ.length > 8) _specQ.shift(); return Promise.resolve(); }
  _spec++;
  return run().finally(() => { _spec--; const n = _specQ.pop(); if (n) _speculate(n); });
}
// prefetch(): return _speculate(() => _fetchEntry(e, url, { ...fopts, priority: 'low' }));
// _fetchEntry: fetcher(url, { signal, priority: fopts.priority || 'auto' })
// navigate()/visit(): _specQ.length = 0;
// 'change' на navigator.connection → пересчёт (слушатель один, модульный)
```

**API:**

```js
configure({ speculation: 'auto' })                 // default
configure({ speculation: false })                  // никаких спекулятивных запросов
configure({ speculation: { maxInflight: 2, saveData: 'respect' | 'ignore' } })
resource(url, { priority: 'high' })                 // прокидывается в fetch
prefetch(url)                                      // всегда 'low', подчиняется бюджету
Aegis.stats().speculation → { inflight, queued, skipped }
```

**Критерий:** test.html: подменить navigator.connection = { saveData: true } (Object.defineProperty) → prefetch()/prefetchOn(hover)/island warm дают 0 вызовов fetcher, а prefetchOn(tap) — 1; с maxInflight: 2 и 10 hover подряд — не более 2 незавершённых промисов fetcher одновременно, остальные из LIFO. Проверить в DevTools Network столбец Priority: prefetch — Low, eager resource — High.

**Источники:** Network Information API (saveData, effectiveType), Priority Hints (fetch priority: 'low'|'high'|'auto', WHATWG fetch), Chrome prefetch heuristics (не спекулировать при Save-Data), quicklink (limit + throttle параметры), prefers-reduced-data media query

## 💎 #26 — Адаптивный горизонт прогрева по скорости скролла для visible-островов, prefetchOn(visible) и lazy()

**Impact:** 3 · **Effort:** M · **Size:** +0.35 KB gzip; −0.1 KB за замену персональных IO на _sharedIO

**Сейчас:** Жёсткие поля: island warm rootMargin '400px' (3347) — причём каждый visible-остров с data-aegis-prefetch создаёт СВОЙ IntersectionObserver (3347: new IntersectionObserver вместо _sharedIO(margin) из 3178), prefetchOn visible '200px' (5928), lazy '50px' (5159), router preload visible '200px' (7545). Скорость скролла не измеряется; при флике 2500 px/s 400px = 160 мс — меньше медианной латентности API, данные приходят после появления острова.

**Предложение:** Модульный измеритель скорости скролла (passive scroll listener, EWMA |Δy/Δt|, живёт только пока есть наблюдаемые элементы) и три яруса _sharedIO: 400 / 1200 / 3000 px. Элементы, ждущие прогрева, регистрируются в ярусе по текущей скорости; при смене яруса (v пересекает 600 / 2000 px/s) — переставить ожидающих через unwatch/watch (IO нельзя перенастроить, но _sharedIO уже кэширует observer по margin). Горизонт умножается на _netBudget().lead (на 3g — половина). Монтирование остаётся на прежнем margin (50px) — меняется только момент прогрева кода и данных.

**Алгоритм:**

```js
Симуляция (sim.mjs, 50k случаев; 60% чтение v~LN(250 px/s), 40% флик v~LN(2500); латентность fetch ~LN(250 мс, p90≈600); пользователь прокрутит ещё S~LN(1500 px)):
  fixed 200px:  miss(данные опоздали)=38.0%  waste(не дошёл)=9.6%
  fixed 400px:  miss=25.6%  waste=18.2%
  fixed 1200px: miss=9.1%   waste=37.6%
  tiers {400,1200,3000} по v: miss=8.7%  waste=32.8%   ← точность fixed-1200 при меньшем waste

let _sv = 0, _st = 0, _sy = 0;
function _scrollTier() { return _sv < 600 ? 400 : _sv < 2000 ? 1200 : 3000; }
function _trackScroll() { // один раз, пока _warmQueue.size > 0
  on(window, 'scroll', () => { const t = performance.now(), y = scrollY; const dt = t - _st || 16; _sv = 0.6 * _sv + 0.4 * Math.abs(y - _sy) / dt * 1000; _sy = y; _st = t; _retier(); }, { passive: true });
}
const _warmQueue = new Map(); // el → { cb, tier }
function _watchWarm(el, cb) { const tier = _scrollTier() * _netBudget().lead; _warmQueue.set(el, { cb, tier }); _sharedIO(tier + 'px').watch(el, () => { _warmQueue.delete(el); cb(); }); }
function _retier() { const tier = _scrollTier() * _netBudget().lead; for (const [el, r] of _warmQueue) if (r.tier !== tier) { _sharedIO(r.tier + 'px').unwatch(el); r.tier = tier; _sharedIO(tier + 'px').watch(el, () => { _warmQueue.delete(el); r.cb(); }); } }
```

**API:**

```js
Без нового публичного API по умолчанию (visible-острова и data-aegis-prefetch получают адаптивный прогрев автоматически).
Опции: data-aegis-load="visible(50px)" — margin монтирования как сейчас; data-aegis-warm="auto|800px|off" — горизонт прогрева;
prefetchOn(el, url, { on: 'visible', rootMargin: 'auto' });
lazy(el, fn, { warm: 'auto' }) — предзапуск loadFn не делает, но даёт el.dataset.aegisWarm hook.
```

**Критерий:** test.html: зафиксировать scrollY через Object.defineProperty и слать scroll-события с шагом 100px/16мс (≈6000 px/s) → элемент на 2500px ниже получает warm (мок IO по rootMargin); при шаге 3px/16мс → не получает. Бенч на demo/admin.html с throttled 3G Fast в DevTools: доля visible-островов, у которых data-aegis-ready наступает после входа в viewport (Performance timeline), падает с ~25% до <10%.

**Источники:** quicklink (IntersectionObserver + idle), Chrome lazy-load thresholds по effectiveType (1250px 4g / 2500px 3g для img loading=lazy), Instagram/Facebook scroll-velocity aware prefetch (публичные инженерные посты), Flutter cacheExtent по velocity

## 💎 #27 — predict(): локальный граф переходов (Markov 1-го порядка) в localStorage → прогрев top-K следующих страниц на idle

**Impact:** 3 · **Effort:** M · **Size:** +0.6 KB gzip, отдельный экспорт (tree-shakeable, не попадает в бандл без импорта)

**Сейчас:** Никакого предсказания нет: прогрев только реактивный (hover/visible/tap). Пользователь, который каждый день заходит /dashboard → /orders, каждый раз ждёт. Router и boost уже эмитят события переходов (aegis:visit 8360, aegis:load 8377, handleRoute 7270), есть persisted()/localStorage-обвязка и `idle`-планировщик островов (3352–3356) — инфраструктура для записи/чтения есть, самого счётчика нет.

**Предложение:** Экспорт predict(opts): при каждом переходе записывать пару from→to в localStorage 'aegis:nav' (сжатая Map path → {next: n, …}, с decay: раз в сутки все счётчики ×0.5, лимит 200 путей). После aegis:load / route change — на requestIdleCallback взять top-K соседей текущего пути с P ≥ threshold и прогреть их через тот же механизм, что и hover: router → warmData (предложение 3) + _resolveHandler, boost → fetchPage, чистый MPA → Speculation Rules (предложение 7). Пути с параметрами нормализуются по паттерну маршрута (/users/:id), а конкретный id прогревается только если совпадает. Только локально, никакой аналитики.

**Алгоритм:**

```js
Симуляция (sim.mjs, 40 страниц × 6 ссылок, Zipf 1.2, 300 сессий по 8 переходов, обучение с нуля):
  topK=1:           hit=43.3% (оракул top-1 = 46.4%), 0.98 prefetch/nav; кривая: 50 сессий→34%, 100→39%, 300→43%
  topK=2:           hit=59.0%, 1.95 prefetch/nav
  topK=3, P≥0.15:   hit=63.2%, 2.18 prefetch/nav; после 50 сессий уже 50.7%

function predict({ key = 'aegis:nav', topK = 2, threshold = 0.15, max = 200, warm } = {}) {
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || { t: Date.now(), g: {} }; } catch { return { t: Date.now(), g: {} }; } };
  const save = (m) => { try { localStorage.setItem(key, JSON.stringify(m)); } catch {} };
  const norm = (p) => routerPattern(p) || p.replace(/\d+/g, ':n');
  let m = load(), prev = norm(location.pathname);
  if (Date.now() - m.t > 864e5) { for (const f in m.g) for (const t in m.g[f]) m.g[f][t] = Math.round(m.g[f][t] / 2) || 0; m.t = Date.now(); }
  const onNav = (to) => { const f = prev, t = norm(to); (m.g[f] ??= {})[t] = (m.g[f][t] || 0) + 1; if (Object.keys(m.g).length > max) delete m.g[Object.keys(m.g)[0]]; save(m); prev = t; schedule(); };
  const schedule = () => (requestIdleCallback || setTimeout)(() => {
    const row = m.g[prev]; if (!row) return; const total = Object.values(row).reduce((a, b) => a + b, 0);
    Object.entries(row).map(([p, n]) => [p, n / total]).filter(([, pr]) => pr >= threshold).sort((a, b) => b[1] - a[1]).slice(0, topK)
      .forEach(([p]) => _speculate(() => warm(concretize(p, location.pathname))));
  });
  document.addEventListener('aegis:load', e => onNav(new URL(e.detail.url, location.href).pathname));
  schedule();
}
```

**API:**

```js
import { predict } from './aegis.js';
predict({ topK: 2, threshold: 0.15, warm: (path) => r.preload(path) });   // с router
predict({ warm: (path) => b.prefetch(path) });                          // с boost
predict();                                                               // MPA: вставляет speculationrules (см. предложение 7)
r.preload(path) / b.prefetch(path) — новые публичные методы-обёртки над warm()/fetchPage(), полезны и без predict.
Aegis.stats().predict → { hits, prefetched } — для оценки на реальном сайте.
```

**Критерий:** test.html (jsdom localStorage): 20 синтетических переходов A→B (15), A→C (5) → predict после захода на A даёт warm('B') при topK=1, warm('B'),warm('C') при topK=2, threshold 0.3 отсекает C; decay через 24 ч уменьшает счётчики вдвое; при заполненном localStorage (QuotaExceeded) — не бросает. Полевая метрика: stats().predict.hits / переходов ≥ 40% после недели использования admin-панели — иначе фича не оправдана и остаётся opt-in.

**Источники:** Guess.js (Markov-модель на данных аналитики, Google), Facebook/Instagram predictive prefetch, WWW-исследования next-page prediction (Markov chains on web logs), Chrome Navigation Predictor (внутренняя модель для preconnect)

## 💎 #28 — speculate(): Speculation Rules для server-first MPA-страниц + корректный hydrate() в prerendered-документе

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip (экспорт speculate + 2 строки в hydrate)

**Сейчас:** Aegis позиционируется server-first (AGENTS.md), но для страниц без boost/router предвыборки нет вообще: prefetchOn греет только JSON-кэш, а переход по <a> — полная загрузка HTML. Speculation Rules API (prefetch/prerender) в коде не упоминается (grep speculation → только комментарий 6706 про CSS @layer). document.prerendering нигде не проверяется: hydrate() (3200+) в prerendered-документе сразу монтирует eager-острова, которые запускают resource() — сетевые запросы для страницы, которую пользователь может не открыть; visible/idle-острова в prerender-е ведут себя непредсказуемо (IO не срабатывает, rIC срабатывает).

**Предложение:** (a) Экспорт speculate({ prefetch, prerender, eagerness, select, exclude }): собирает same-origin ссылки (или список от predict()) и вставляет один <script type="speculationrules"> с document-rules ({ where: { and: [{ href_matches: '/*' }, { not: { selector_matches: '[data-no-speculate]' } }] }, eagerness: 'moderate' }) — браузер сам делает hover-200мс/pointerdown-эвристику и учитывает Save-Data; в браузерах без поддержки (HTMLScriptElement.supports('speculationrules') === false) — fallback на _intent + <link rel=prefetch>. Обновлять список при aegis:load. (b) В hydrate(): если document.prerendering — отложить eager-острова и seedFrom до prerenderingchange (visible/interaction — как есть, они не тратят сеть), либо разрешить через data-aegis-load="eager(prerender)". (c) boost() не совмещается с prerender (он сам делает fetch+morph): при boost использовать только prefetch-правила через свой fetchPage — но Speculation prefetch-кэш недоступен для fetch(), поэтому boost остаётся на предложении 2, а speculate — для чистого MPA; dev-warning E0xx если вызваны оба.

**Алгоритм:**

```js
export function speculate({ prefetch = true, prerender = false, eagerness = 'moderate', select = 'a[href]', exclude = '[data-no-speculate],[download],[target]', urls } = {}) {
  if (typeof HTMLScriptElement === 'undefined' || !HTMLScriptElement.supports?.('speculationrules')) {
    // fallback: _intent(document.body, select, a => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.append(l); });
    return () => {};
  }
  const where = urls ? { href_matches: urls } : { and: [{ href_matches: '/*' }, { not: { selector_matches: exclude } }] };
  const rules = {};
  if (prefetch) rules.prefetch = [{ source: 'document', where, eagerness }];
  if (prerender) rules.prerender = [{ source: 'document', where, eagerness: typeof prerender === 'string' ? prerender : 'conservative' }];
  const s = document.createElement('script'); s.type = 'speculationrules'; s.textContent = JSON.stringify(rules);
  document.head.append(s);
  return () => s.remove();
}
// hydrate(): 
if (document.prerendering && strategy === 'eager' && !sargs.includes('prerender')) {
  document.addEventListener('prerenderingchange', mount, { once: true }); break;
}
```

**API:**

```js
speculate();                                       // prefetch всех same-origin ссылок по moderate-эвристике
speculate({ prerender: 'conservative' });          // prerender на pointerdown
speculate({ urls: predict.top(2) });               // связка с predict()
<a href="/logout" data-no-speculate>
<div data-aegis="chart" data-aegis-load="eager(prerender)">  // грузить даже в prerender
```

**Критерий:** Chrome DevTools → Application → Speculative loads показывает правила и статус «Ready» после hover ≥ 200 мс; переход по prefetched ссылке даёт TTFB ≈ 0 (Navigation Timing responseStart − requestStart < 5 мс). test.html: speculate() вставляет ровно один script[type=speculationrules] с валидным JSON, повторный вызов не дублирует; hydrate() с Object.defineProperty(document,'prerendering',{value:true}) не вызывает setup eager-острова до события prerenderingchange, а visible-остров регистрируется как обычно.

**Источники:** Speculation Rules API (WICG, Chrome 109+/121+ document rules, eagerness), Prerender2 и document.prerendering / prerenderingchange (web.dev «Prerender pages in Chrome»), Page Lifecycle рекомендация откладывать сеть в prerender, <link rel=prefetch> как fallback (Firefox/Safari)

## 💎 #29 — Наблюдаемость спекуляций: hit/waste-счётчики в stats(), вкладка в dev-панели, E0xx при низком проценте попаданий

**Impact:** 3 · **Effort:** S · **Size:** +0.3 KB gzip в основном модуле (счётчики), UI-часть — в aegis-devtools.js (не считается в бандл)

**Сейчас:** Невозможно узнать, окупается ли прогрев: _resourceCache-запись, созданная prefetch()/warm, живёт cacheTime (5920) и умирает по gcTimer молча; нет признака «спекулятивная»; _stats (694) содержит только flushes/effectRuns/slow; dev-предупреждения о сети — только дубли и штормы (E029/E030, 5786–5811). Нет способа отличить полезный data-aegis-prefetch от того, что просто греет воздух.

**Предложение:** Пометить спекулятивные записи (e.spec = true в prefetch/warm/predict/preload) и считать: prefetched, hit (первый _retainEntry или чтение e.data при refCount>0 до gc → hit, с записью lead = now − e.lastFetch), wasted (gc без hit), skipped (бюджет), aborted. Всё в _stats.speculation; stats() отдаёт его; devtools-панель (aegis-devtools.js) показывает таблицу key / kind / статус / lead. Dev-warning E0xx (один раз за сессию) когда prefetched ≥ 30 и hit/prefetched < 0.2: «prefetch hit-rate 12% — lower rootMargin / use on:'tap' / remove data-aegis-prefetch from X». Это же даёт метрику для всех предыдущих предложений.

**Алгоритм:**

```js
const _spec = { prefetched: 0, hit: 0, wasted: 0, skipped: 0, aborted: 0, lead: [] };
// prefetch()/warm: e.spec = e.spec ?? (e.refCount === 0); if (e.spec) _spec.prefetched++;
// _retainEntry(e): if (e.spec && !e.hitAt) { e.hitAt = Date.now(); _spec.hit++; _spec.lead.push(e.hitAt - e.lastFetch); if (_spec.lead.length > 50) _spec.lead.shift(); _maybeWarn(); }
// gcTimer callback: if (e.spec && !e.hitAt) _spec.wasted++;
// _speculate(): skipped++ при speculate:false; abort в navigate(): aborted++
function _maybeWarn() { if (!_dev() || _spec.prefetched < 30) return; const r = _spec.hit / _spec.prefetched; if (r < 0.2) _warn('E0xx', { what: `speculative prefetch hit-rate ${Math.round(r*100)}% (${_spec.hit}/${_spec.prefetched})`, why: 'Most warmed data is never read before it is garbage-collected.', fix: 'Narrow the trigger: prefetchOn(..., { on: "tap" }), smaller rootMargin, or remove data-aegis-prefetch from islands below the fold.' }, 'spec:hit'); }
// stats(): speculation: { ..._spec, p50lead: median(_spec.lead) }
```

**API:**

```js
Aegis.stats().speculation → { prefetched: 41, hit: 30, wasted: 9, skipped: 2, aborted: 0, p50lead: 310 }
Aegis.dev.panel() → вкладка «Cache / Speculation»: key, source (hover|visible|predict|island), status (inflight|hit|wasted), lead ms
onWarn(w => …) получает E0xx 'speculation'
```

**Критерий:** test.html: prefetch('/a') затем resource('/a',{cache:true}) → stats().speculation.hit === 1, lead ≥ 0; prefetch('/b') + fake timers до cacheTime → wasted === 1; 30 prefetch без потребителей в dev → ровно одно предупреждение E0xx. В demo/admin.html после прогулки по всем экранам hit-rate ≥ 50% — это целевое значение для дефолтов предложений 2 и 5.

**Источники:** TanStack Query Devtools (статусы fresh/stale/inactive per query), Chrome DevTools «Speculative loads» панель (статусы Ready/Failure и причины), Guess.js отчёт precision/recall


---

# 🔭 http-server-first

**Линза:** vision / http-server-first

**Вывод:** Главный структурный пробел: контракт fetcher'а `fetcher(url, { signal }) → data` (aegis_full.js:5827 в _fetchEntry, 3590 в _plainResource, 8084 в offline) выбрасывает Response целиком — кэш Aegis не видит ETag, Cache-Control, Age, Date, Link. Из-за этого staleTime дублирует серверную политику руками (demo/admin.html:94–113 — 5_000/10_000 мс, которые сервер уже знает), каждая ревалидация тянет и парсит полное тело даже при неизменных данных (5000 строк: 49.7 KB gzip + 5.2 мс JSON.parse+_share против ~0.18 KB и 0.0004 мс при 304), а `request()` считает 304 ошибкой (1361). Второй пробел — Aegis не использует то, что браузер/сервер уже умеют: `<link rel=preload as=fetch>` / 103 Early Hints, Cache API (хранит Response с заголовками), серверные подсказки об инвалидации в ответе мутации. Все шесть предложений вместе стоят ~1.5 KB gzip (оценка сверху, измерено esbuild+gzip), не требуют сборки и делают сервер источником истины для свежести, инвалидации и первого рендера.

**Отвергнуто:** 1) Vary-aware ключи кэша (Accept-Language/Authorization как часть ключа): заголовки в Aegis глобальные (`_config.headers`, 1219), смена языка = `configure()` — достаточно сбросить поколение кэша (`invalidate(() => true)`) в configure() при изменении headers; отдельный механизм Vary не окупает байты. 2) Range/206 для streamResource и докачки: streamResource (3773–3838) уже стримит NDJSON, а докачка после обрыва требует серверного контракта по байтам, что несовместимо с JSON-строками; SSE с Last-Event-ID (sse(), 3851) уже покрывает «продолжить с места». 3) Cache-Control для boost.fetchPage (8349–8354, фиксированные 5 с): HTML-навигации и так идут через браузерный HTTP-кэш с серверными заголовками; 5-секундное окно нужно только для hover→click, менять нечего. 4) Собственная реализация stale-while-revalidate «как в браузере» (фоновая ревалидация с немедленным ответом из HTTP-кэша через `cache: 'only-if-cached'`): `only-if-cached` работает лишь с `mode: 'same-origin'` и не даёт заголовков о свежести — проще положиться на P2 (Age/lastFetch) и нативную s-w-r в Chrome. 5) Автопосылка `If-Modified-Since` по Last-Modified: избыточно при ETag (серверы отдают оба; ETag сильнее), а оба заголовка сразу увеличивают запрос и код — Last-Modified оставить только как фолбэк, если ETag нет (одна строка в P1). 6) Стриминг частичного JSON (progressive JSON / `Transfer-Encoding: chunked` + инкрементальный парсер): требует ~1.5 KB парсера и серверной поддержки; NDJSON через streamResource решает 90% случаев при нулевой стоимости.

## 💎 #30 — Метаданные ответа в CacheEntry: ETag / If-None-Match / 304 в _fetchEntry и offline

**Impact:** 5 · **Effort:** M · **Size:** ~250 B gzip (esbuild min 331 B → gzip 246 B изолированно; в составе бандла меньше)

**Сейчас:** _fetchEntry (aegis_full.js:5814–5845): `attempt = () => fetcher(url, { signal })` (5827) — fetcher возвращает разобранное тело, заголовки потеряны; entry (5739–5757) хранит data/lastFetch/fopts, но не etag. request() (1339–1367): `if (!response.ok) throw HttpError` (1361) — 304 бросается как ошибка даже если вызывающий сам послал If-None-Match. offline fetchRemote (8076–8095) пишет в IDB `{ data, timestamp }` (8088) — после перезагрузки при staleTime=0 тело качается заново целиком.

**Предложение:** Ввести внутренний путь `_fetchRaw(url, fopts, e)`: если пользовательский `fopts.fetcher` не задан — идти через `request(url, { signal, raw: true, headers: e.etag ? { 'If-None-Match': e.etag } : undefined })`, сохранять в entry `etag`, `lastModified`, `headers` (или только нужные поля), при `status === 304` — не трогать data, обновить lastFetch (и timestamp в IDB для offline), вернуть `e.data.peek()`. Аналогично в offline: класть `etag` рядом с data в IDB-запись, слать If-None-Match при первом сетевом запросе после loadCached (8065–8074). В request(): 304 при наличии условного заголовка в init — не ошибка (вернуть `undefined` для parsed-режима, Response для raw). mockFetch (aegis-test.js:92) уже возвращает Response — тесты работают без изменений, handler может вернуть `new Response(null, { status: 304 })`.

**Алгоритм:**

```js
// в _fetchEntry вместо attempt:
const attempt = fopts.fetcher
  ? () => fopts.fetcher(url, { signal })
  : async () => {
      const r = await request(url, { signal, raw: true,
        headers: e.etag ? { 'If-None-Match': e.etag } : undefined });
      if (r.status === 304) return _NOT_MODIFIED;          // sentinel
      if (!r.ok) throw new HttpError(r.status, r, await _parseBody(r));
      e.etag = r.headers.get('etag'); e.hdr = r.headers;   // для P2/P7
      return _parseBody(r);
    };
// после withRetry:
if (result === _NOT_MODIFIED) { e.lastFetch = Date.now(); return; }
// offline: store.set(url, { data, timestamp, etag: e.etag });
// loadCached: e.etag = cached.etag → fetchRemote шлёт If-None-Match.
// Замер (sim.mjs, node 24): неизменённый payload
//   50 строк  7 KB: parse+_share 0.054 ms  | 304: 0.0001 ms, ~0.18 KB вместо 0.7 KB gzip
//   500 строк 68 KB: 0.497 ms              | 304: 0.0003 ms, вместо 5.1 KB gzip
//   5000 строк 699 KB: 5.248 ms            | 304: 0.0004 ms, вместо 49.7 KB gzip
```

**API:**

```js
Ничего нового для разработчика — включается само, когда сервер отдаёт ETag:
  const users = resource('/api/users?page=1', { cache: true, revalidateOn: ['focus'] });
  // фокус на вкладку → GET с If-None-Match → 304 → data не меняется, validating мигнул и погас
  const s = resource('/api/settings', { offline: true }); // после reload: IDB → data сразу, сеть → 304
Дополнительно: `users.etag` (ReadonlySignal<string|null>) в ResourceResult для отладки; `api.get(url, { headers: { 'If-None-Match': tag } })` → `undefined` при 304 вместо HttpError.
```

**Критерий:** 1) test.html: mockFetch с маршрутом, возвращающим ETag; второй `refresh()` → `net.last().headers['If-None-Match'] === '"v1"'`, ответ 304 → `users.data.peek()` тот же объект (identity), `error === null`. 2) offline: после `reset()` + повторного `resource(url,{offline:true})` первый сетевой вызов содержит If-None-Match. 3) Бенч: ревалидация неизменных 5000 строк — 5.2 мс → <0.01 мс CPU, 49.7 KB → ~0.2 KB на проводе (цифры из sim.mjs выше). 4) request(): 304 при If-None-Match не бросает.

**Источники:** RFC 9110 §13.1 (If-None-Match), RFC 9111 (HTTP caching); SWR (Vercel) не делает conditional requests — конкурентное преимущество; TanStack Query — тоже нет; Rails `fresh_when`/`stale?`, Django `ConditionalGetMiddleware`, Laravel `ETag` middleware — серверы это уже отдают бесплатно.

## 💎 #31 — staleTime: 'http' — Cache-Control / Age / Expires / stale-while-revalidate как источник свежести

**Impact:** 4 · **Effort:** S · **Size:** ~330 B gzip (533 B min / 327 B gzip изолированно)

**Сейчас:** _cachedResource: `staleTime = 0`, `cacheTime = 5 * 60 * 1000` (5962–5963) — константы клиента; проверка `Date.now() - e.lastFetch < fopts.staleTime` (5819); `e.lastFetch = Date.now()` (5837) — даже если браузерный HTTP-кэш отдал ответ с `Age: 45` (уже наполовину протухший) Aegis считает его свежим прямо сейчас. prefetch: `staleTime ?? 30000` (5916). Ту же политику разработчик дублирует в demo/admin.html:94,95,113 (5_000 / 10_000 мс), хотя сервер выставляет Cache-Control.

**Предложение:** Опция `staleTime: 'http'` (и `cacheTime: 'http'`): после успешного ответа (нужны заголовки из P1) вычислить свежесть по RFC 9111: `freshness = max-age − Age` (или Expires − Date), `cacheTime = (max-age + stale-while-revalidate)`, `no-store` → staleTime 0 и cacheTime 0 (entry не хранить дольше подписчиков), `no-cache` → всегда ревалидировать (но с If-None-Match из P1 — дёшево). `e.lastFetch = now − Age*1000`, чтобы ответ, отданный CDN/браузером как stale-while-revalidate, сразу считался устаревшим и следующий revalidateOn его обновил. Фолбэк, когда заголовков нет: число из второго аргумента `staleTime: ['http', 30000]` или дефолт 0. Тот же парсер для `seed(key, data, { headers })` и для Cache API (P5).

**Алгоритм:**

```js
function _httpFreshness(h, now) {
  const cc = h.get('cache-control') || '';
  if (/no-store/.test(cc)) return { staleTime: 0, cacheTime: 0 };
  const age = +(h.get('age') || 0);
  let maxAge = cc.match(/(?:^|,)\s*(?:s-)?max-age=(\d+)/) ? +RegExp.$1 : NaN;
  if (Number.isNaN(maxAge)) {                       // Expires − Date
    const d = Date.parse(h.get('expires') || ''), t = Date.parse(h.get('date') || '') || now;
    maxAge = d ? Math.max(0, (d - t) / 1000) : NaN;
  }
  const swr = cc.match(/stale-while-revalidate=(\d+)/) ? +RegExp.$1 : 0;
  return Number.isNaN(maxAge) ? { lastFetch: now - age * 1000 }
    : { staleTime: Math.max(0, maxAge - age) * 1000, cacheTime: (maxAge + swr) * 1000, lastFetch: now - age * 1000 };
}
// в _fetchEntry после ответа: if (fopts.staleTime === 'http') Object.assign(e, _httpFreshness(e.hdr, Date.now()));
// _releaseEntry: cacheTime берётся из e.cacheTime ?? opts.cacheTime
// Проверено (sim.mjs):
//  'private, max-age=60, stale-while-revalidate=300' → staleTime 60000, cacheTime 360000
//  'max-age=60' + Age: 45                            → staleTime 15000, cacheTime 60000, lastFetch = now−45s
//  'no-store'                                        → 0 / 0
//  'no-cache' + ETag                                 → staleTime undefined (=0), только lastFetch
//  Expires = Date+120s                               → 120000 / 120000
```

**API:**

```js
resource('/api/users?page=1', { cache: true, staleTime: 'http' });          // сервер: Cache-Control: private, max-age=30, stale-while-revalidate=300
resource(url, { cache: { staleTime: ['http', 10_000], cacheTime: 'http' } }); // фолбэк 10 с, если заголовков нет
configure({ staleTime: 'http' });   // дефолт для всех cached-ресурсов проекта (одна строка, как csrf)
prefetch(url) — тоже уважает 'http' через configure.
Типы: `staleTime?: number | 'http' | ['http', number]` в CacheOptions (aegis.d.ts:538).
```

**Критерий:** 1) Таблица из 5 случаев выше — юнит-тест парсера в test.html (Headers доступен в браузере). 2) Интеграция: mockFetch отдаёт `Cache-Control: max-age=1`; `refresh()` в течение 1 с — 0 новых вызовов (`net.calls.length` не растёт), через 1.1 с — 1 вызов. 3) `Age: 45` при max-age=60 → focus-ревалидация через 15 с, не 60. 4) demo/admin.html: убрать три ручных staleTime, поведение совпадает при серверных заголовках.

**Источники:** RFC 9111 §4.2 (freshness lifetime, Age), RFC 5861 (stale-while-revalidate); Chrome/Firefox реализуют s-w-r нативно для fetch(); Next.js `fetch(url, { next: { revalidate } })` и Remix `headers()` — та же идея «сервер владеет свежестью»; Ember Data / `@ember-data/request` CacheHandler читает Cache-Control.

## 💎 #32 — Серверная инвалидация: заголовок ответа Aegis-Invalidate (аналог HX-Trigger)

**Impact:** 4 · **Effort:** S · **Size:** ~170 B gzip

**Сейчас:** mutation() инвалидирует только клиентский список `opts.invalidates` (3696: `for (const k of [].concat(invalidates)) invalidate(k)`); wireForm (6360–6380) и boost (8349) после успешного POST не трогают _resourceCache вовсе; _flushOffline (8004) после доставки очереди обновляет только ресурсы с тем же `cacheKey`. Сервер, который знает, что POST /api/users меняет и /api/users?page=*, и /api/stats, не может этого сообщить.

**Предложение:** В request() (после `doFetch`, 1358) читать заголовок `Aegis-Invalidate: /api/users*, /api/stats` (только same-origin) и вызывать `invalidate()` для каждого паттерна: точное совпадение или префикс с `*`. Так инвалидация работает единообразно для mutation, wireForm, offline-очереди, boost-форм и прямых `api.post`. Дополнительно `Aegis-Invalidate: *` — всё. Событие `aegis:invalidate` на document с detail { keys } — для devtools.

**Алгоритм:**

```js
// request(), после получения response (до raw-return, чтобы работало и для boost/wireForm):
const inv = response.headers.get('Aegis-Invalidate');
if (inv && _sameOrigin(u)) for (const p of inv.split(',')) {
  const t = p.trim(); if (!t) continue;
  invalidate(t === '*' ? () => true : t.endsWith('*') ? (k) => k.startsWith(t.slice(0, -1)) : t);
}
// invalidate() уже умеет предикат (6055–6063): активные entry → _fetchEntry(force), неактивные → lastFetch = 0.
// Проверка (sim.mjs): '/api/users*, /api/stats' над ключами
//   ['/api/users?page=1','/api/users?page=2','/api/users/7','/api/stats','/api/settings']
//   → 4 совпадения, /api/settings не тронут.
```

**API:**

```js
Клиент — ничего: `const add = mutation((u) => api.post('/api/users', u));` без `invalidates`.
Сервер (Django): `resp['Aegis-Invalidate'] = '/api/users*, /api/stats'`; Rails: `response.headers['Aegis-Invalidate'] = ...`; Laravel: `->header('Aegis-Invalidate', ...)`.
Опционально `configure({ invalidateHeader: 'HX-Trigger' | false })` — своё имя или выключить.
```

**Критерий:** test.html: два cached-ресурса (/api/users?page=1, /api/stats) + mockFetch, где `POST /api/users` возвращает Response с заголовком Aegis-Invalidate; после `await add(); await settled()` — `net.calls` содержит по одному повторному GET на каждый ключ, /api/settings не перезапрошен; wireForm с тем же заголовком — тот же эффект. Demo: убрать `invalidates: [...]` из admin.html, поведение сохраняется.

**Источники:** htmx `HX-Trigger` / `HX-Refresh` response headers; Hotwire Turbo `Turbo-Stream` / `refresh` (Turbo 8 page refresh с `<meta name="turbo-refresh-method">`); Unpoly `X-Up-Expire-Cache` — прямой аналог; RFC 9111 §4.4 (invalidation при unsafe-методах — тот же принцип, но только для URL запроса).

## 💎 #33 — seedFrom как нулевой уровень HTTP-кэша: data-aegis-etag / data-aegis-max-age и потребление <link rel=preload as=fetch> / 103 Early Hints

**Impact:** 4 · **Effort:** S · **Size:** ~250 B gzip (+ ~290 B для dev-предупреждения E038, вырезается в prod-сборке, если предупреждения условны на _dev())

**Сейчас:** seedFrom (5889–5908) читает только `data-aegis-cache` и `data-aegis-age`; seed (5873–5885) кладёт data и lastFetch, entry без etag — первая же focus-ревалидация (5852) качает полное тело, хотя сервер уже знает его ETag в момент рендера HTML. hydrate() вызывает seedFrom (3262). Ничего не знает о `<link rel=preload as=fetch>` в <head>: если сервер (или 103 Early Hints через `Link:`) начал загрузку /api/... до прихода JS, Aegis не гарантирует совпадение (fetch() — mode 'cors', preload без `crossorigin` — 'no-cors' → браузер качает второй раз и пишет warning в консоль).

**Предложение:** (а) seedFrom: атрибуты `data-aegis-etag` и `data-aegis-max-age` (сервер зеркалит свой ETag/Cache-Control) → entry.etag и staleTime (при `'http'`); ревалидация seeded-данных идёт условной и получает 304. (б) seedFrom дополнительно сканирует `link[rel=preload][as=fetch][data-aegis-cache]` и вызывает `prefetch(href, { staleTime })`: fetch() внутри `_fetchEntry` совпадает с preload-запросом браузера (URL + credentials-mode), тело берётся из preload-кэша без второго запроса, а `resource(href, { cache: true })` присоединяется к `e.promise` (5821). Early Hints (`103` + `Link: </api/users?page=1>; rel=preload; as=fetch; crossorigin`) браузер обрабатывает сам — Aegis нужно лишь сделать fetch до истечения preload (hydrate — сразу). (в) dev-проверка E038: `link[rel=preload][as=fetch]` без `crossorigin` → предупреждение с fix.

**Алгоритм:**

```js
// seedFrom, в цикле по <script data-aegis-cache>:
const e = seed(sc.dataset.aegisCache, JSON.parse(sc.textContent), { age: +sc.dataset.aegisAge || 0 });
if (sc.dataset.aegisEtag) e.etag = sc.dataset.aegisEtag;
if (sc.dataset.aegisMaxAge) e.staleTime = +sc.dataset.aegisMaxAge * 1000; // приоритет над opts при staleTime:'http'
// preload-варминг:
for (const l of root.querySelectorAll('link[rel="preload"][as="fetch"][data-aegis-cache]')) {
  if (_dev() && !l.hasAttribute('crossorigin')) _warn('E038', { what: `preload as=fetch "${l.href}" lacks crossorigin.`,
    why: 'fetch() is mode "cors"; a preload without crossorigin is "no-cors" — not matched, downloaded twice.',
    fix: '<link rel="preload" as="fetch" href="…" crossorigin>' });
  prefetch(l.getAttribute('href'), { staleTime: +l.dataset.aegisMaxAge * 1000 || 30000 });
}
// Порядок событий на первой странице:
//  HTML head → браузер стартует /api/users?page=1 (или уже стартовал по 103)
//  → <script type=module> aegis → hydrate → seedFrom → prefetch → fetch совпадает с preload
//  → resource() в setup острова → dedupe по e.promise → data без нового сетевого запроса.
```

**API:**

```js
Сервер (Django-шаблон):
  <link rel="preload" as="fetch" href="/api/users?page=1" crossorigin data-aegis-cache>
  {{ users|json_script:"u" }} → <script type="application/json" data-aegis-cache="/api/users?page=1"
      data-aegis-etag='"{{ users_etag }}"' data-aegis-max-age="30">[…]</script>
  HTTP: 103 Early Hints / Link: </api/users?page=1>; rel=preload; as=fetch; crossorigin
Клиент: resource('/api/users?page=1', { cache: true, staleTime: 'http' }) — без изменений.
seedFrom возвращает число записей, как сейчас; `seed(key, data, { etag, maxAge })` — те же поля для ручного посева.
```

**Критерий:** 1) test.html: `<script data-aegis-cache data-aegis-etag='"v1"'>` → seedFrom → `refresh()` → `net.last().headers['If-None-Match'] === '"v1"'`. 2) Браузерный тест (test-browsers.mjs / Playwright) со страницей, где <link rel=preload as=fetch crossorigin> + resource: `performance.getEntriesByName(url).length === 1` и `initiatorType === 'link'` (или 'early-hints' при 103); без crossorigin — 2 записи и E038 в консоли. 3) Метрика demo: число сетевых GET /api/* от DOMContentLoaded до `hydrate().ready` = 0 при полном seed, = 0 «новых» при preload.

**Источники:** Preload spec (WHATWG HTML §4.6.7, as=fetch + crossorigin matching), RFC 8297 (103 Early Hints), Chrome DevRel «Preload critical fetch requests» (о несовпадении credentials-mode); Astro/Nuxt `useFetch` payload-извлечение из HTML; Django `json_script`, Rails `content_tag(:script, type: 'application/json')`.

## 💎 #34 — Персистентный SWR-кэш через Cache API: Response с заголовками вместо JSON в IDB

**Impact:** 4 · **Effort:** M · **Size:** ~280 B gzip

**Сейчас:** _resourceCache (5736) — только память: reload → все cached-ресурсы стартуют с null и полным GET. Offline-ветка (7835–8155) хранит в IDB `{ data, timestamp }` (8088) без заголовков; `cache` и `offline` взаимоисключающие (3567–3568). Персистенции для SWR нет (известный пробел) — здесь предлагается HTTP-нативная реализация вместо ещё одного JSON-хранилища.

**Предложение:** Опция `cache: { persist: true }` (или `persist: 'cache-api'`): при создании entry — `caches.open('aegis').match(key)` → если есть Response: распарсить, засеять data, взять `etag`, `lastFetch = Date(header)`, staleTime по P2; затем обычная SWR-ревалидация уже условная (P1) → 304 → 0 байт тела. После каждого 200 — `cache.put(url, response.clone())` (только GET, same-origin, не `no-store`). Cache API хранит заголовки и тело как есть — никакой повторной сериализации JSON, можно шарить с Service Worker (тот же CacheStorage), ограничение по квоте — как у IDB. GC: при открытии удалять записи, у которых `Date + cacheTime` в прошлом. Где `caches` недоступен (http:// не-localhost, приватный режим Firefox) — тихий фолбэк в память.

**Алгоритм:**

```js
async function _cachesLoad(e, url, fopts) {
  if (typeof caches === 'undefined') return;
  let r; try { r = await (await caches.open('aegis')).match(url); } catch { return; }
  if (!r) return;
  const d = await _parseBody(r);
  if (e.data.peek() === null) batch(() => { e.data.value = fopts.transform ? fopts.transform(d) : d; e.started.value = true; });
  e.etag = r.headers.get('etag');
  Object.assign(e, _httpFreshness(r.headers, Date.parse(r.headers.get('date')) || Date.now()));
}
// в _fetchEntry (P1 путь) после ok-ответа:
if (fopts.persist && r.ok && !/no-store/.test(r.headers.get('cache-control') || ''))
  caches.open('aegis').then(c => c.put(url, r.clone())).catch(() => {});
// _cachedResource.use(): if (fopts.persist && !e._loaded) { e._loaded = _cachesLoad(e, url, fopts); }
// Сеть → память → CacheStorage: три уровня, ключ один (URL), метаданные едины (Response headers).
```

**API:**

```js
const users = resource('/api/users?page=1', { cache: { persist: true, staleTime: 'http' } });
// reload: users.data — из CacheStorage за ~1–3 мс, users.validating = true, сеть → 304 → validating = false
configure({ cacheName: 'aegis-v2' });         // смена имени = сброс персистентного кэша при деплое
invalidate('/api/users*')                     // дополнительно удаляет совпадающие записи из CacheStorage
Типы: `persist?: boolean` в CacheOptions.
```

**Критерий:** Браузерный тест: `resource(url, { cache: { persist: true } })` → `await ready()` → `reset()` + новый `resource(url, ...)` → `data.peek() !== null` ДО первого ответа mockFetch (mockFetch с latency: 50) и первый сетевой вызов содержит If-None-Match. Замер: время до непустого data после reload ≤ 5 мс (Cache API match на 100 KB) против RTT сети; трафик на повторный визит — 304 (~0.2 KB) вместо полного тела. `caches` отсутствует → тест проходит с обычным поведением, без исключений.

**Источники:** Service Worker Cache API (W3C), паттерн «stale-while-revalidate» в Workbox (`workbox-strategies`), Jake Archibald «Offline Cookbook» (cache-then-network); TanStack Query `persistQueryClient` (JSON в storage — без заголовков, более тяжёлый вариант, чего здесь избегаем).

## 💎 #35 — Link: rel="next" (RFC 8288) как курсор в infiniteResource и next/prev для cached-страниц

**Impact:** 2 · **Effort:** S · **Size:** ~150 B gzip (парсер Link + total)

**Сейчас:** infiniteResource (6067–6115): `getNext = (r) => r?.next ?? null` — курсор только из тела; `fetcher(url, { signal })` (6088) не даёт заголовков. API в стиле GitHub/Drupal/Rails `pagy` отдают пагинацию в `Link: <...?page=2>; rel="next"` и `X-Total-Count`; для них приходится писать сервер-специфичный `getNext` или дублировать next в теле.

**Предложение:** На базе P1 (raw-путь) — `getNext: 'link'` (или дефолт-фолбэк, если тела нет `next`): парсить `Link` заголовок, брать `rel="next"`. Тот же парсер даёт `rel="prev"`/`"last"` и `X-Total-Count`/`Content-Range` → `feed.total` (ReadonlySignal<number|null>). Для обычного cached-ресурса `Link: rel=next` — сигнал `prefetchOn`/router: прогреть следующую страницу по hover на кнопке «Далее» без знания формата URL.

**Алгоритм:**

```js
function _linkRel(h, rel) {
  const v = h && h.get('link'); if (!v) return null;
  for (const part of v.split(',')) {
    const m = part.match(/<([^>]+)>\s*;([^,]*)/);
    if (m && new RegExp('rel="?' + rel + '"?').test(m[2])) return m[1];
  }
  return null;
}
// infiniteResource: fetcher через raw-путь → { data, headers }
const next = getNext === 'link' ? _linkRel(headers, 'next') : getNext(result, headers);
const total = +(headers.get('x-total-count') || (headers.get('content-range') || '').split('/')[1]) || null;
// URL из Link может быть абсолютным — прогонять через _sameOrigin и оставлять pathname+search.
```

**API:**

```js
const feed = infiniteResource(c => c ?? '/api/feed', { getNext: 'link' });     // курсор = URL из Link: rel="next"
feed.total   // из X-Total-Count / Content-Range, null если нет
getNext: (body, headers) => ...   // второй аргумент — Headers, обратная совместимость сохранена
Сервер (Rails pagy_headers / Django rest_framework LinkHeaderPagination / GitHub API) — без изменений.
```

**Критерий:** test.html: mockFetch отдаёт `Link: </api/feed?after=abc>; rel="next"` и `X-Total-Count: 42` → `feed.hasMore === true`, `feed.total === 42`, `loadMore()` запрашивает `/api/feed?after=abc`; ответ без Link → `hasMore === false`. Парсер: 6 форм заголовка (несколько rel в одном элементе, пробелы, абсолютный URL, кавычки/без кавычек) — таблица в тесте.

**Источники:** RFC 8288 (Web Linking), GitHub REST API pagination, Django REST Framework `LinkHeaderPagination`, Rails `pagy` headers extra, RFC 9110 §14 (Content-Range).


---

# 🔭 dx-observability

**Линза:** vision / dx-observability

**Вывод:** Кэш Aegis (§24, aegis_full.js:5733–6062) — чёрный ящик: единственная наблюдаемая величина — `stats().resourceCache` (число записей, :991), а dev-панель (aegis-devtools.js:84) показывает его одной плиткой. Решение «запросить / отдать из памяти / присоединиться к in-flight» принимается в `_fetchEntry` (:5814–5822) по булеву `force` — причина (mount, смена URL, refresh, invalidate, focus, reconnect, prefetch, истёк staleTime, seed+SWR — 9 разных) нигде не фиксируется, поэтому вопрос «почему это перезапросилось» не имеет ответа. Симуляция в node подтвердила четыре молчаливых провала без единого предупреждения: `staleTime > cacheTime` → 3 монтирования = 3 запроса; `invalidate('/api/todo')` при ключе `/api/todos` → ничего; `resource({params, loader}, {cache:true})` → ключ-объект `[object Object]`; GC-таймер (`_releaseEntry` :5770) нельзя продвинуть в тесте. Все шесть предложений вместе стоят ~1.76 KB gzip (замерено esbuild+gzip поверх реального 62 314 B), причём вкладка панели живёт в aegis-devtools.js и в бандл не входит.

**Отвергнуто:** 1) Persist SWR-кэша в localStorage/IDB и ETag/304 — не линза DX/observability, уже в списке известных пробелов. 2) Поток событий кэша в `performance.measure`/track «Aegis» (по образцу `_installProfileMark` :996) — полезно, но дублирует history в explain и панель; можно добавить позже как флажок `dev.profile` без нового API. 3) Отдельные сигналы `r.age`/`r.fresh` на результате ресурса — раздувают контракт `ResourceResult` (:503–524), которого придерживаются 5 движков; `cache.explain(key)`/`cache.entry(key)` покрывают то же без изменения формы. 4) Экспорт самого `_resourceCache` Map (как в некоторых SWR-реализациях) — ломает инкапсуляцию entry (`_shape`, `controller`, `gcTimer`), любой `map.delete` оставит висящие refCount. 5) `cache.size()` в байтах как постоянная метрика — `JSON.stringify` на каждый flush дорог для больших ответов; оставлен только в ленивом снимке панели (1.9 мс на 555 KB — приемлемо раз в 500 мс, не на каждый fetch). 6) Автоматическая сортировка query-параметров по умолчанию — меняет ключи для `seedFrom`/`data-aegis-cache`, отрендеренных сервером; сделано opt-in хуком `configure({ cacheKey })`.

## 💎 #36 — Публичный namespace `cache` с нормализацией ключей и явным GC

**Impact:** 5 · **Effort:** M · **Size:** +379 B gzip (esbuild minify + gzip -9 поверх 62 314 B; включая _ckey)

**Сейчас:** `_resourceCache` (aegis_full.js:5736) — модульный Map без публичного доступа; наружу торчат только `seed` (:5873), `prefetch` (:5911), `invalidate` (:6055). Ключ = `explicitKey ?? nextUrl` (:5980) без нормализации; `_keyOf` (:3524) есть только у plain-resource. Симуляция D: после `invalidate` с опечаткой проверить, какие ключи вообще есть, нечем. GC — `setTimeout(cacheTime)` (:5770, :5878, :5917), время до удаления в entry не хранится.

**Предложение:** Добавить экспорт `cache = { get, has, set, remove, keys, entry, subscribe, gc }` поверх `_resourceCache`, единый `_ckey()` (строка → как есть; массив → join ''; объект → JSON с сортированными ключами) применять в `_cacheEntry`, `seed`, `prefetch`, `invalidate`; хранить `e._gcAt = now + cacheTime` и `e._cacheTime` рядом с таймером, чтобы `cache.gc(now)` и панель знали срок. `configure({ cacheKey: fn })` — хук нормализации URL (сортировка query).

**Алгоритм:**

```js
function _ckey(k) {
  if (typeof k === 'string') return _config.cacheKey ? _config.cacheKey(k) : k;
  if (Array.isArray(k)) return k.map(_ckey).join('');
  if (k == null) return '';
  return JSON.stringify(k, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, kk) => (o[kk] = v[kk], o), {}) : v);
}
const cache = {
  get: (k) => _resourceCache.get(_ckey(k))?.data.peek(),
  has: (k) => _resourceCache.has(_ckey(k)),
  set: (k, d, o) => seed(_ckey(k), d, o),
  keys: (prefix) => [..._resourceCache.keys()].filter(k => !prefix || k.startsWith(prefix)),
  entry(k) { const e = _resourceCache.get(_ckey(k)); return e && { key: e.key, data: e.data, error: e.error, inflight: e.inflight, refCount: e.refCount, age: () => _now() - e.lastFetch }; },
  remove(kOrFn) { for (const [k, e] of _resourceCache) if (match(k)) { e.controller?.abort(); clearTimeout(e.gcTimer); _resourceCache.delete(k); batch(() => { e.data.value = null; e.started.value = false; }); } },
  subscribe(k, fn) { const e = _cacheEntry(_ckey(k), null); _retainEntry(e); const off = effect(() => fn(e.data.value)); return () => { off(); _releaseEntry(e, 0); }; },
  gc(now = _now()) { let n = 0; for (const e of _resourceCache.values()) if (e.refCount <= 0 && e._gcAt <= now) { clearTimeout(e.gcTimer); _resourceCache.delete(e.key); n++; } return n; },
};
// _releaseEntry: e._gcAt = _now() + cacheTime; e._cacheTime = cacheTime; (таймер остаётся)
```

**API:**

```js
import { cache } from './aegis.js';
cache.get('/api/users');                 // T | undefined, без запроса и без подписки
cache.set(['users', id], user, { age: 0 });  // массив/объект — нормализуется в строку
cache.keys('/api/users');                // ['/api/users?page=1', …]
const off = cache.subscribe('/api/stats', (v) => console.log(v)); // держит refCount
cache.remove(k => k.startsWith('/api/'));
cache.gc();                              // явная уборка (тесты, low-memory)
configure({ cacheKey: (u) => sortQuery(u) });
```

**Критерий:** test.html: `cache.keys()` после трёх cachedResource = 3 ключа; `cache.set({b:1,a:2}, x)` и `cache.get({a:2,b:1})` — один ключ; `cache.gc(Date.now()+cacheTime+1)` после dispose → `stats().resourceCache === 0` (сейчас симуляция B: 1 запись живёт 5 мин). Размер: +379 B gzip (замер).

**Источники:** TanStack Query QueryClient (getQueryData/setQueryData/getQueryCache().findAll), SWR `mutate(key)` и `cache` provider, unstorage `getKeys(prefix)`; нормализация ключа — TanStack `hashKey` (сортировка ключей объекта).

## 💎 #37 — `cache.explain(key)`: причина каждого решения fetch/skip/join и история записи

**Impact:** 5 · **Effort:** M · **Size:** +504 B gzip (замер); история только в dev, кольцо 20 × ~5 полей на entry

**Сейчас:** `_fetchEntry(e, url, fopts, force)` (aegis_full.js:5814) — три исхода: `fresh` (:5819 — return без запроса), `joined` (:5821 — вернуть e.promise), `fetch`. Причина вызова не передаётся: mount (:6005, :6035), refresh (:5993, :6009), invalidate (:6060), focus/reconnect (:5859), prefetch (:5915) — все выглядят одинаково. Симуляция F: 9 различимых причин, логируется 0. У cached-ресурса нет `site` (`_devTrackFetch(url, 'cache')` :5816 без ownerId/site, тогда как plain захватывает `_callSite()` :3596) — предупреждения без «At:».

**Предложение:** Заменить булев `force` на строковый `reason` ('mount'|'url'|'refresh'|'invalidate'|'focus'|'reconnect'|'prefetch'), в dev писать в кольцевой буфер `e.hist` (20 записей: t, reason, result, ms, status/error) и экспонировать `cache.explain(key)` → `{ state, why, age, staleTime, cacheTime, subscribers, gcIn, history }`. Захватывать `site` в `_cachedResource` как в plain. Хук `onCache(fn)` по образцу `onWarn` (:88) — поток событий для тестов и логов.

**Алгоритм:**

```js
const FORCE = new Set(['refresh', 'invalidate']);
function _fetchEntry(e, url, fopts, reason = 'mount') {
  const t = _now();
  if (!FORCE.has(reason) && t - e.lastFetch < (fopts.staleTime || 0)) return _hist(e, { t, reason, result: 'fresh' }), Promise.resolve();
  if (e.promise) return _hist(e, { t, reason, result: 'joined' }), e.promise;
  const ev = _hist(e, { t, reason, result: 'fetch' });
  … в finally: if (ev) { ev.ms = _now() - t; ev.status = e.error.peek() ? 'error' : 'ok'; }
}
function _hist(e, ev) { if (!_dev()) return null; (e.hist ||= []).push(ev); if (e.hist.length > 20) e.hist.shift(); for (const h of _cacheHandlers) h(e.key, ev); return ev; }
explain(key) {
  const e = _resourceCache.get(_ckey(key)); if (!e) return { state: 'absent', why: 'never fetched/seeded/prefetched or GC-ed after cacheTime' };
  const age = _now() - e.lastFetch, st = e.fopts?.staleTime || 0;
  const state = e.promise ? 'inflight' : e.error.peek() ? 'error' : e.data.peek() == null ? 'empty' : age < st ? 'fresh' : 'stale';
  const why = { fresh: `age ${age} ms < staleTime ${st} ms — served from memory`, stale: `age ${age} ms >= staleTime ${st} ms — next read returns data and refetches`, inflight: 'request in flight; readers join it', error: 'last fetch failed; refresh()/invalidate() retries', empty: 'no data yet' }[state];
  return { key: e.key, state, why, age, staleTime: st, cacheTime: e._cacheTime, subscribers: e.refCount, gcIn: e._gcAt ? e._gcAt - _now() : null, history: (e.hist || []).slice() };
}
```

**API:**

```js
cache.explain('/api/users?page=1')
// → { state: 'stale', why: 'age 41200 ms >= staleTime 30000 ms — next read returns data and refetches',
//     subscribers: 2, gcIn: null, history: [
//       { t: …, reason: 'mount', result: 'fetch', ms: 212, status: 'ok' },
//       { t: …, reason: 'focus', result: 'fresh' },
//       { t: …, reason: 'invalidate', result: 'fetch', ms: 180, status: 'ok' } ] }
const off = onCache((key, ev) => log.push([key, ev.reason, ev.result]));   // тесты: expect(log).toEqual([['/api/todos','invalidate','fetch']])
r.refresh() // внутри: _fetchEntry(e, url, fopts, 'refresh')
```

**Критерий:** Тест: mount → focus → invalidate для одного ключа даёт ровно `['mount/fetch','focus/fresh'|'focus/fetch','invalidate/fetch']` через onCache; `explain(k).state` проходит empty→inflight→fresh→stale при стабе Date.now. В prod `_hist` — один `if (!_dev()) return` на вызов (0 аллокаций). Размер: +504 B gzip (замер, включая explain-строки).

**Источники:** TanStack Query Devtools (fetchStatus/dataUpdatedAt/observers per query), Apollo Client devtools (watched queries + cache history), Chrome DevTools Network «Initiator»; паттерн onWarn уже в Aegis (:88–93).

## 💎 #38 — Четыре предупреждения кэша с точным what/why/fix (E038–E041) + починка дубля E035

**Impact:** 4 · **Effort:** S · **Size:** ≈ +600 B gzip (строки what/why/fix — основная часть; замер 697 B до переиспользования _lev)

**Сейчас:** Кэшу посвящены только E029/E030/E035 (aegis_full.js:5776–5812), и все про URL, а не про кэш. Блок E035 продублирован дословно (:5778 и :5784, второй без `site` — мёртвый код за дедупом `'url:'+url`). Симуляция подтвердила молчание в трёх сценариях: C) `staleTime:60000, cacheTime:0` → 3 mount = 3 fetch, warnings []; D) `invalidate('/api/todo')` при ключе `/api/todos` → 0 запросов, warnings []; E) `resource({params, loader}, {cache:true})` → key типа object, `String(key)==='[object Object]'`, warnings []. `_installRevalidate` (:5858–5860) по focus перезапрашивает ВСЕ смонтированные entry с дефолтным `revalidateOn:['focus','reconnect']` и `staleTime:0` — стадо запросов без сигнала. `_lev()` для подсказок уже есть (:2942).

**Предложение:** E038 — нестроковый ключ кэша (в `_cacheEntry`, до Map.set). E039 — `staleTime > cacheTime` (в `_cachedResource` при чтении опций). E040 — `invalidate(string)` не совпал ни с одним ключом: подсказка ближайшего ключа через существующий `_lev` (расстояние ≤3) или совет использовать предикат/`cache.keys()`. E041 — focus-ревалидация выстрелила ≥8 запросов разом (в `tick()` :5855). Удалить дубль E035. Добавить строки в ERRORS.md и в `DOCS` aegis-devtools.js:118.

**Алгоритм:**

```js
// _cacheEntry(key, initial):
if (_dev() && typeof key !== 'string') _warn('E038', { what: `resource({ cache }) got a non-string key (${Object.prototype.toString.call(key)}).`, why: 'Cache keys must be strings; an object key never matches another call, so nothing is shared and invalidate() cannot reach it.', fix: "Pass cache: { key: 'users:' + id } or serialize params." }, 'k:' + String(key));
// _cachedResource opts:
if (_dev() && staleTime > cacheTime) _warn('E039', { what: `"${key}": staleTime ${staleTime} ms > cacheTime ${cacheTime} ms.`, why: 'The entry is garbage-collected while still fresh; every remount fetches again.', fix: 'Set cacheTime >= staleTime.' }, 'sc:' + key);
// invalidate():
let matched = 0; … matched++;
if (_dev() && !matched && typeof keyOrFn === 'string') {
  let best = null, bd = 4; for (const k of _resourceCache.keys()) { const d = _lev(k, keyOrFn); if (d < bd) { bd = d; best = k; } }
  _warn('E040', { what: `invalidate("${keyOrFn}") matched no cache entry.`, why: 'Nothing was refetched — the key differs from the one resource() used (query order, trailing slash, encoding, typo).', fix: best ? `Did you mean "${best}"? Or invalidate(k => k.startsWith('/api/'))` : 'List keys with cache.keys() or use a predicate.' }, 'inv:' + keyOrFn);
}
// _installRevalidate tick(): let n = 0; … if (match) { n++; _fetchEntry(e, e.url, e.fopts, reason); }
if (n >= 8) _warn('E041', { what: `revalidateOn refetched ${n} entries at once on ${reason}.`, why: "Every mounted cached resource with the default revalidateOn: ['focus'] and staleTime 0 fires together.", fix: 'Raise staleTime on slow-changing data or set revalidateOn: [] where mutation() already invalidates.' }, 'herd');
```

**API:**

```js
// консоль (dev):
⚠ [Aegis:E040] invalidate("/api/todo") matched no cache entry.
  Why: Nothing was refetched — the key differs from the one resource() used (query order, trailing slash, encoding, typo).
  Fix: Did you mean "/api/todos"? Or invalidate(k => k.startsWith('/api/'))
  At: /js/todos.js:31:9
  Docs: Aegis.dev.explain('E040')
// тесты (strict):
globalThis.__AEGIS_DEV__ = 'strict'; expect(() => invalidate('/api/todo')).toThrow(AegisWarning /E040/)
```

**Критерий:** Сценарии C/D/E симуляции дают ровно по одному коду (E039, E040 с подсказкой '/api/todos', E038) вместо []; фокус с 8 смонтированными cached-ресурсами → один E041. `onWarn` в test.html: 4 новых assert, 0 ложных срабатываний на demo/admin.html (там invalidates — предикаты, :117/:121/:157). Размер: +697 B gzip с собственным _lev; при переиспользовании `_lev` (:2942) ≈ 600 B.

**Источники:** Elm compiler messages (what/why/fix), ESLint «did you mean» (Levenshtein), TanStack Query dev warnings о staleTime/gcTime, RFC 9111 (свежесть vs время хранения).

## 💎 #39 — Вкладка «cache» в dev-панели: ключи, возраст, подписчики, размер, история, действия

**Impact:** 4 · **Effort:** M · **Size:** +205 B gzip в ядре (снимок); UI в aegis-devtools.js (dev-only, вне 61 KB)

**Сейчас:** aegis-devtools.js:28–109 — панель с деревом компонентов и одной плиткой `cache: N` (:84, из `stats().resourceCache` :991). Сигналы entry видны только косвенно — по именам `cache:${key}:data` (aegis_full.js:5743) в списке зависимостей эффектов выбранного компонента; возраст, staleTime, refCount, ошибки, in-flight — нигде. Панель уже опрашивает `stats()` каждые 500 мс (:56).

**Предложение:** В ядре — `dev.cache()` (снимок `_cacheSnapshot()`: key, state из explain, age, staleTime, subscribers=refCount, inflight, error, size=JSON-длина данных, gcIn, fetches). В aegis-devtools.js — вкладка «cache» рядом с деревом: таблица с сортировкой, бейдж состояния (fresh/stale/inflight/error/empty), полоска age/staleTime, кнопки invalidate / remove / copy key / explain (печатает history в консоль), фильтр по префиксу, подсветка изменившихся строк (уже есть `changed()` :64). При выборе строки — history из `explain`. Панель вне бандла: стоимость ядра только `_cacheSnapshot`.

**Алгоритм:**

```js
function _cacheSnapshot() {
  const now = _now(), out = [];
  for (const e of _resourceCache.values()) {
    let size = 0; try { size = JSON.stringify(e.data.peek())?.length || 0; } catch { size = -1; }
    out.push({ key: e.key, state: cache.explain(e.key).state, age: e.lastFetch ? now - e.lastFetch : null,
      staleTime: e.fopts?.staleTime || 0, subscribers: e.refCount, inflight: !!e.promise,
      error: e.error.peek()?.message || null, size, gcIn: e._gcAt ? Math.max(0, e._gcAt - now) : null,
      fetches: (e.hist || []).filter(h => h.result === 'fetch').length });
  }
  return out;
}
// devtools: const rows = computed(() => { tick.value; return tab.value === 'cache' ? dev.cache() : []; });
// list(rows, r => html`<tr class=${r.state}><td>${r.key}</td><td><i style=${`width:${Math.min(100, r.age / r.staleTime * 100)}%`}></i> ${fmtAge(r.age)}/${r.staleTime}</td><td>${r.subscribers}</td><td>${fmtBytes(r.size)}</td><td>${r.fetches}</td>
//   <td><button @click=${() => invalidate(r.key)}>↻</button><button @click=${() => cache.remove(r.key)}>×</button><button @click=${() => console.table(cache.explain(r.key).history)}>?</button></td></tr>`, { key: 'key' })
// снимок только когда вкладка открыта — размер считается лениво (JSON.stringify)
```

**API:**

```js
Aegis.dev.panel() → вкладка «cache»:
 key                      state   age/stale   subs  size   fetches
 /api/stats               fresh   2s/5s        1    0.4K   3   ↻ × ?
 /api/users?q=&page=1     stale   41s/10s      1    12K    7   ↻ × ?
 /api/users?q=&page=2     empty   —            0    0      1   ↻ × ?   (gc in 4:12)
Aegis.dev.cache()  // тот же снимок как массив объектов (для console.table / чата с ассистентом)
```

**Критерий:** Замер снимка: 200 entries × 50 объектов (555 KB JSON) — 1.92 мс на тик, 0.38 % бюджета 500 мс. На demo/admin.html после клика по «Delete» вкладка показывает fetches+1 и history `invalidate → fetch` у `/api/stats` и `/api/users?…`; сценарий «почему список перезапрашивается при переключении вкладки» диагностируется без чтения кода (строка `focus → fetch`). Ядро: +205 B gzip.

**Источники:** TanStack Query Devtools (Query Explorer: status, observers, dataUpdatedAt, actions Refetch/Invalidate/Remove), Apollo DevTools Cache tab, Chrome Application → Cache Storage (size/age колонки).

## 💎 #40 — Детерминированное время: `useClock()` + `cache.gc(now)` + `fakeClock()` в aegis-test.js

**Impact:** 4 · **Effort:** S · **Size:** +49 B gzip в ядре (useClock/_now); fakeClock — в aegis-test.js

**Сейчас:** Время читается напрямую: `Date.now()` в `_cacheEntry` (:5747), `_fetchEntry` (:5819, :5837), `_installRevalidate` (:5857), `seed` (:5876), offline (:8071, :8088, :8116); GC — `setTimeout` (:5770, :5878, :5917). Симуляция A: стаб `Date.now` работает для staleTime (fetches 2→3 после +31 с), но симуляция B: после dispose entry живёт 5 реальных минут — ветку GC протестировать нельзя. test.html — 90 × `await wait(10)` вместо детерминизма; `reset()` (:8608) падает в node без DOM (`destroyAll(root = document)` :3454) — нужен `reset({ components:false, dom:false })`. В aegis-test.js (mockFetch :92, waitFor :71) помощников для времени/кэша нет.

**Предложение:** Единая точка `_now()` (модульная `let _nowFn = Date.now`) во всех местах §24/§33 + экспорт `useClock(fn)` (возвращает restore). GC-срок хранить как `_gcAt` (предложение 1) и давать `cache.gc(now)`. В aegis-test.js — `fakeClock()`: `{ now, advance(ms) }`, где `advance` двигает часы, зовёт `cache.gc()` и `flushAll()`. `reset()` — `if (components && typeof document !== 'undefined')`. Рецепт в llms.txt: «staleTime тестируется за 0 мс».

**Алгоритм:**

```js
// ядро
let _nowFn = Date.now;
const _now = () => _nowFn();
export function useClock(fn) { const prev = _nowFn; _nowFn = fn || Date.now; return () => { _nowFn = prev; }; }
// заменить 8 вхождений Date.now() в §24/§33 на _now()
// aegis-test.js
export function fakeClock(start = Date.now()) {
  let t = start;
  const restore = useClock(() => t);
  return {
    now: () => t,
    async advance(ms) { t += ms; cache.gc(t); await flushAll(); },
    restore,
  };
}
// тест
const clock = fakeClock();
const r = resource('/a', { cache: true, staleTime: 30_000, cacheTime: 60_000, fetcher });
await flushAll();                          // fetch #1
resource('/a', { cache: true, staleTime: 30_000, fetcher }); expect(calls).toBe(1);   // fresh
await clock.advance(31_000); resource('/a', { cache: true, staleTime: 30_000, fetcher }); await flushAll(); expect(calls).toBe(2);
r.dispose(); await clock.advance(60_001); expect(cache.has('/a')).toBe(false);   // GC детерминирован
clock.restore();
```

**API:**

```js
import { useClock, cache } from './aegis.js';
import { fakeClock, flushAll } from './aegis-test.js';
const clock = fakeClock();          // Date.now не трогается — только часы Aegis
await clock.advance(30_000);        // staleTime истёк + GC + flush
clock.restore();
```

**Критерий:** Тесты на истечение staleTime и на GC по cacheTime выполняются < 5 мс (сейчас: GC-тест невозможен, staleTime-тест — только через глобальный стаб Date.now). test-core.mjs / node: `reset()` не бросает без DOM. В test.html секции §24 — 0 × `wait(N)` (сейчас 4 в :696–706). Ядро: +49 B gzip.

**Источники:** Sinon fake timers / Vitest `vi.useFakeTimers` + `vi.setSystemTime`, Go `clock.Clock` интерфейс (benbjohnson/clock), TanStack Query `gcTime` + `queryClient.clear()` в тестах.

## 💎 #41 — Типизированные ключи кэша: `cacheKey` + `CacheKey<T>` сквозь resource / seed / cache.get / invalidate

**Impact:** 3 · **Effort:** S · **Size:** +52 B gzip

**Сейчас:** aegis.d.ts: `CacheOptions.key?: string` (:539), `seed<T>(key: string, data: T)` (:692), `invalidate(keyOrPredicate: string | (k: string) => boolean)` (:689), `MutationOptions.invalidates?: string | …` (:587). Тип данных ресурса выводится только из `initial` (:575) — `resource('/api/users', { cache: true })` даёт `ResourceResult<unknown>`, а `seed('/api/users', anything)` не связан с ним типом. Строковые ключи из разных мест приложения (`'/api/users'` в resource, `'/api/user'` в invalidates) TypeScript не сверяет.

**Предложение:** Брендированный строковый тип `CacheKey<T> = string & { readonly __t?: T }` (runtime — та же строка) и тег/функция `cacheKey` (тег с `encodeURIComponent` подстановок, либо `cacheKey<T>(s)`); overload'ы в d.ts: `resource<T>(key: CacheKey<T>, opts: {cache:true|CacheOptions})` → `ResourceResult<T>`, `seed(key: CacheKey<T>, data: T)`, `cache.get(key: CacheKey<T>): T | undefined`, `cache.set(key: CacheKey<T>, data: T)`, `invalidate(key: CacheKey<any> | string | fn)`, `MutationOptions.invalidates: Array<CacheKey<any> | string | fn>`. Ключи объявляются один раз в `keys.ts`/`keys.js` — единственный источник и для сервера-рендера `data-aegis-cache`.

**Алгоритм:**

```js
// runtime (1 строка): тег → строка с безопасной подстановкой, обычная строка — как есть
export function cacheKey(strings, ...vals) {
  return typeof strings === 'string' ? strings : String.raw({ raw: strings }, ...vals.map(v => encodeURIComponent(String(v))));
}
// aegis.d.ts
export type CacheKey<T> = string & { readonly __t?: T };
export function cacheKey<T = unknown>(key: string): CacheKey<T>;
export function cacheKey<T = unknown>(strings: TemplateStringsArray, ...vals: Array<string | number>): CacheKey<T>;
export function resource<T>(source: CacheKey<T> | (() => CacheKey<T> | null), opts: ResourceOptions<T> & { cache: true | CacheOptions }): ResourceResult<T>;
export function seed<T>(key: CacheKey<T>, data: T, opts?: { age?: number }): void;
export const cache: { get<T>(key: CacheKey<T>): T | undefined; set<T>(key: CacheKey<T>, data: T, opts?: { age?: number }): void; … };
export function invalidate(key: CacheKey<any> | string | ((key: string) => boolean)): void;
```

**API:**

```js
// keys.js — один раз
export const usersKey = (page) => cacheKey<User[]>`/api/users?page=${page}`;
export const statsKey = cacheKey<Stats>('/api/stats');
// компонент
const users = resource(() => usersKey(page.value), { cache: true });   // ResourceResult<User[]>
seed(statsKey, { total: 1 });            // ошибка компиляции, если форма не Stats
const s = cache.get(statsKey);           // Stats | undefined
mutation(addUser, { invalidates: [statsKey, usersKey(1)] });
```

**Критерий:** test-types.ts: `seed(statsKey, { wrong: 1 })` — `@ts-expect-error`; `resource(statsKey, { cache: true }).data.value` имеет тип `Stats | null` без `initial`; `cacheKey`/api/x/${'a b'}`` === '/api/x/a%20b'. Runtime: +52 B gzip.

**Источники:** TanStack Query `queryOptions()` + typed queryKey (v5), `@lukemorales/query-key-factory`, TypeScript branded types (nominal typing pattern), Zod `z.brand`.


---

# 🔭 memory-eviction

**Линза:** vision / memory-eviction — память и вытеснение в SWR-кэше (§24 CACHED RESOURCE), offline-хранилище (§33) и их согласование со scope-деревом (§2)

**Вывод:** Сейчас единственный механизм вытеснения в `_resourceCache` — таймер `cacheTime` на каждую запись после `refCount → 0` (aegis_full.js:5767-5771, дублируется в seed 5877-5879 и prefetch 5916-5918): нет ни бюджета, ни оценки размера, ни приоритетов, ни реакции на фон/нехватку памяти; offline-store в IndexedDB (8088, 8116) вообще не удаляет ничего никогда. Симуляция на Zipf-трассе SPA (3000 ключей, 60k запросов, размеры 3/40 KB) показала: при той же пиковой памяти, что даёт текущий TTL (3.4 MB), size-aware GDSF даёт 61% попаданий против 30% у TTL и 36% у LRU, а при вдвое меньшем бюджете (1.7 MB) — 49%, всё ещё выше TTL на полной памяти. Измерение в node: запись через seed() стоит 1125 байт (из них ~350 — четыре именованных сигнала `cache:${key}:…`), через cachedResource() — 3.9 KB (с `_shape`); сэмплирующая оценка размера payload в 37 раз быстрее JSON.stringify (0.005 vs 0.184 мс на 110 KB), реальная куча ≈ 1.6 × длина JSON. Главный вывод: заменить таймер на байтовый бюджет с GDSF-приоритетом (частота × приоритет / размер) и одной ленивой развёрткой, добавить tier «страница» для back-навигации, ограничить IDB квотой и использовать FinalizationRegistry не как кэш, а как страховку от зависших refCount.

**Отвергнуто:** 1) WeakRef на данные записи (кэш «пока GC не собрал»): V8 собирает цели WeakRef при любом major GC, в активном приложении это секунды, hit-ratio становится непредсказуемым; TC39 прямо не рекомендует WeakRef для кэшей. Оставлен только FinalizationRegistry как детектор утечек. 2) ARC: две ghost-списка удваивают метаданные ключей, политика не size-aware, выигрыш к LRU на UI-трассе не оправдывает ~1 KB gzip. 3) W-TinyLFU как основная политика: в симуляции даёт лучший byte-hit (38% vs 30–36%), но худший object-hit (44% vs 61% у GDSF), а для UI важнее «не показать скелетон», чем байты; плюс count-min sketch + window + SLRU — втрое больше кода, чем GDSF с выборкой. 4) Точный heap и min-heap для вытеснения: O(n) или O(log n) структуры на 3000 записей не нужны — выборка из 8 (Redis) даёт близкий результат при нулевой памяти. 5) performance.measureUserAgentSpecificMemory и Compute Pressure API как сигнал давления: первый требует cross-origin isolation (server-first приложения его не имеют), второй измеряет только CPU. 6) `maxPages` для infiniteResource (6097 pages растёт без ограничения): требует двунаправленных курсоров (getPrevious) и перезагрузки при скролле вверх; virtual scroll (§32) уже снимает DOM-стоимость, а страницы ленты обычно малы — отложено. 7) LZ-сжатие idle-записей (CompressionStream): асинхронно, ломает синхронный `data.peek()` и structural sharing. 8) Persist SWR-кэша в storage и ETag/304 — вне линзы, уже в списке известных пробелов.

## 💎 #42 — Байтовый бюджет + GDSF-вытеснение вместо таймера cacheTime

**Impact:** 5 · **Effort:** M · **Size:** +0.5–0.7 KB gzip (минус три копии timer-логики ≈ −0.1 KB)

**Сейчас:** aegis_full.js:5767-5771 `_releaseEntry`: при refCount→0 ставится setTimeout(cacheTime) и запись удаляется по времени, независимо от размера и полезности. Тот же паттерн скопирован в seed() 5877-5879 и prefetch() 5916-5918. Бюджета нет: 100 просмотренных страниц списка по 40 KB за 5 минут = 4 MB живёт в куче. stats() (985-995) отдаёт только `_resourceCache.size`, не байты.

**Предложение:** Добавить в _config (1218) `cache: { budget: bytes, cacheTime }`. У entry появляются `size`, `hits`, `pri`. `_releaseEntry` не ставит таймер, а помечает запись `idleAt = now` и зовёт `_trim()`. `_trim()` — ленивая развёртка после каждой записи данных/release: пока `_cacheBytes > budget`, вытеснять среди записей с refCount===0 минимальный `pri` (GDSF: L + hits*priority/size^0.5), плюс всё, что старше cacheTime. Выбор жертвы — по выборке из 8 записей (Redis approximated LFU), без heap и без O(n) на каждую вставку. Вариант `size^0.5` выбран как компромисс: в симуляции чистый GDSF даёт 61% object-hit / 30% byte-hit, `size^0.5` — 53% / 36%, LRU — 36% / 32%, TTL — 30% / 26% при одинаковых 3.4 MB.

**Алгоритм:**

```js
// entry: { …, size: 0, hits: 0, pri: 0, idleAt: 0 }
let _cacheBytes = 0, _L = 0;               // L — инфляция GDSF (pri вытесненной)
function _setData(e, next) {               // вызывать из _fetchEntry:5836, seed:5875, mutate
  _cacheBytes -= e.size; e.size = _sizeOf(next); _cacheBytes += e.size;
  e.data.value = next; _touch(e);
}
function _touch(e) { e.hits++; e.pri = _L + e.hits * (e.priority || 1) / Math.sqrt(e.size || 1) * 1e3; }
function _releaseEntry(e) {
  if (--e.refCount > 0) return;
  e.idleAt = Date.now(); _trim();
}
function _trim() {
  const { budget, cacheTime } = _config.cache, now = Date.now();
  if (_cacheBytes <= budget && !_sweepDue(now)) return;
  const idle = []; for (const e of _resourceCache.values()) if (e.refCount <= 0 && !e.pinned) idle.push(e);
  for (const e of idle) if (now - e.idleAt > cacheTime) _evict(e);       // жёсткий TTL сохранён
  while (_cacheBytes > budget && idle.length) {
    let v = null;                                                          // 8 случайных кандидатов → min pri
    for (let i = 0; i < 8 && idle.length; i++) { const c = idle[(Math.random() * idle.length) | 0]; if (!v || c.pri < v.pri) v = c; }
    _L = v.pri; idle.splice(idle.indexOf(v), 1); _evict(v);
  }
}
function _evict(e) { if (e.controller) e.controller.abort(); _cacheBytes -= e.size; _resourceCache.delete(e.key); }
// Симуляция (sim.mjs, Zipf α=0.9, 3000 ключей, 60k запросов):
//  budget 3441 KB: TTL 29.9% | LRU 36.4% | GDSF 61.1% | GDSF size^0.5 53.2% | W-TinyLFU 43.8%
//  budget 1721 KB: TTL —     | LRU 26.5% | GDSF 48.7% | GDSF size^0.5 42.2% | W-TinyLFU 36.1%
```

**API:**

```js
configure({ cache: { budget: 4 * 1024 * 1024, cacheTime: 5 * 60_000 } });   // default budget по deviceMemory (см. отдельное предложение)
resource(url, { cache: { cacheTime: 0 } });          // как раньше: per-resource TTL остаётся
stats().cache → { entries, bytes, budget, evictions, hits, misses }
cache.trim(0)                                          // принудительно ужать до нуля idle-записей (тесты, logout)
```

**Критерий:** Бенч на трассе из sim.mjs, встроенной в test.html как детерминированный тест с mock fetcher: при budget = пик TTL-политики hit-ratio ≥ 50% (TTL даёт 30%); `stats().cache.bytes` никогда не превышает budget более чем на размер одной записи; после 10 000 resource()/dispose с уникальными ключами heapUsed стабилен (нет роста), 0 живых таймеров вместо 10 000.

**Источники:** GDSF — Cherkasova, «Improving WWW proxies performance with Greedy-Dual-Size-Frequency caching policy» (HP Labs 1998); Redis approximated LRU/LFU (maxmemory-samples); Caffeine/TanStack Query gcTime как TTL-fallback; Squid GDSF replacement policy

## 💎 #43 — Оценка размера записи: сэмплирующий обход с калибровкой, без JSON.stringify

**Impact:** 3 · **Effort:** S · **Size:** +0.25 KB gzip

**Сейчас:** Размер данных нигде не оценивается: _cacheEntry (5738-5760) хранит только data-сигнал; `_share` (3509-3523) обходит весь ответ на каждой ревалидации, но размера не считает. В offline-store (8088) тоже только `{ data, timestamp }`.

**Предложение:** Функция `_sizeOf(v)`: рекурсивный обход, массивы длиннее 32 элементов оцениваются по 16 равномерным сэмплам с экстраполяцией; строки — 12 + len байт, числа/булевы — 8, объект — 24 + 16 на поле. Коэффициент калибровки 1.6 (замер: 110 KB JSON → 174 KB реальной кучи в V8). Для Blob/ArrayBuffer/TypedArray — `byteLength`/`size`. Пользователь может переопределить: `cache: { size: (data) => n }`. Считать один раз при записи данных (в `_setData`), не при чтении. Ту же функцию использовать для offline-квоты и вкладки кэша в dev-панели.

**Алгоритм:**

```js
function _sizeOf(v, d = 0) {
  if (v == null) return 8;
  switch (typeof v) {
    case 'string': return 12 + v.length;              // one-byte строки; two-byte редки в JSON API
    case 'number': case 'boolean': return 8;
    case 'object': {
      if (v.byteLength != null) return v.byteLength;  // ArrayBuffer / TypedArray
      if (typeof Blob !== 'undefined' && v instanceof Blob) return v.size;
      if (Array.isArray(v)) {
        const n = v.length; if (!n) return 16;
        if (n <= 32 || d > 6) { let s = 16 + n * 8; for (const x of v) s += _sizeOf(x, d + 1); return s; }
        const step = Math.floor(n / 16); let s = 0, c = 0;
        for (let i = 0; i < n; i += step, c++) s += _sizeOf(v[i], d + 1);
        return 16 + n * 8 + Math.round(s / c * n);
      }
      let s = 24; for (const k in v) s += 16 + _sizeOf(v[k], d + 1); return s;
    }
    default: return 8;
  }
}
// замер entry-cost.mjs на 500-элементном списке issue (110 KB JSON):
//   JSON.stringify(payload).length  0.184 ms
//   _sizeOf(payload) sampled        0.005 ms   (37× быстрее)
//   реальная куча                   174 KB  → коэффициент 1.6 × JSON-длина
```

**API:**

```js
resource(url, { cache: { size: (d) => d.items.length * 400 } })   // своя оценка (например, по Content-Length)
prefetch(url, { size })                                          // то же для прогрева
stats().cache.bytes                                              // сумма оценок
```

**Критерий:** На фикстуре из 20 реальных ответов demo/admin.html (users, stats, страницы списка) отношение `_sizeOf / heapUsed` лежит в 0.7–1.5; время оценки ответа 500 KB < 0.05 мс (проверять в bench.html); ошибка сэмплирования на однородных массивах < 10%.

**Источники:** Chrome DevTools «retained size» методика; Node `v8.serialize` как эталон; Caffeine `Weigher`; TanStack Query не считает размер (известная жалоба #4340) — Aegis может это выгодно отличать

## 💎 #44 — Приоритеты записей и pin: prefetch вытесняется первым, seed/pinned — последними

**Impact:** 3 · **Effort:** S · **Size:** +0.15 KB gzip

**Сейчас:** prefetch() (5912-5920) уже отправляет fetch с `priority: 'low'` (5914), но в кэше его записи неотличимы от данных, которые пользователь реально смотрит: они живут те же 5 минут и занимают память наравне с ними. seed() из SSR-HTML (5873-5904) — данные первого экрана — так же удаляются по таймеру. Пометить запись «не вытеснять» невозможно.

**Предложение:** Опция `priority: 'low' | 'normal' | 'high' | number` (0.5 / 1 / 4) и `pin: true`. Приоритет — множитель стоимости в GDSF-формуле (см. предложение 1): при равной частоте и размере low-запись вытесняется первой. prefetch/prefetchOn по умолчанию `low`, seed/seedFrom — `high` (это данные текущей страницы), явный `pin: true` исключает запись из бюджета (только invalidate/cacheTime/trim(force)). Приоритет хранится в entry и обновляется при каждом use(): максимум из запрошенных (страница, которую сначала прогрели, а потом открыли, повышается до normal).

**Алгоритм:**

```js
const _PRI = { low: 0.5, normal: 1, high: 4 };
function _use(e, opts) {                              // внутри use() 5979-5991 и seed/prefetch
  const p = typeof opts.priority === 'number' ? opts.priority : _PRI[opts.priority] || 1;
  if (p > (e.priority || 0)) e.priority = p;           // монотонно вверх
  if (opts.pin) e.pinned = true;
}
// GDSF: pri = L + hits * priority / sqrt(size) * 1e3
// prefetch: priority 0.5 → при hits=1 и 40 KB: 0.5/200 = 0.0025
// seed:     priority 4   → 4/200   = 0.02   (в 8 раз «дороже» вытеснять)
// _trim(): pinned пропускаются; если после вытеснения всех idle bytes > budget —
//   dev-warning E0xx «cache budget exceeded by pinned/active entries: N KB» (не вытеснять активные).
```

**API:**

```js
prefetchOn(list, a => a.dataset.api, { on: 'hover' })            // priority 'low' по умолчанию
resource('/api/me', { cache: { pin: true } })                     // никогда не вытесняется бюджетом
resource(() => `/api/orders/${id.value}`, { cache: { priority: 'high' } })
seedFrom(document)                                                // 'high' автоматически
<script type="application/json" data-aegis-cache="/api/me" data-aegis-pin>
```

**Критерий:** Тест: budget = 100 KB, 5 prefetch по 30 KB + 1 seed 30 KB + 1 pinned 30 KB → после _trim в кэше остаются seed, pinned и максимум один prefetch; порядок вытеснения prefetch-записей — по возрастанию hits. В симуляции с 20% «prefetch-шума» (записи, к которым больше не обращаются) hit-ratio GDSF с приоритетами выше GDSF без них на ≥ 5 п.п.

**Источники:** Chrome HTTP cache «priority hints» / fetchpriority; Caffeine Weigher + Expiry; Apollo Client `retain`/`release` (pin семантика); Next.js router cache «prefetch = low, visited = high»

## 💎 #45 — Реакция на фон и memory pressure: budget по deviceMemory, ужатие в hidden/freeze

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip

**Сейчас:** Кэш не знает о состоянии вкладки. `_installRevalidate` (5850-5866) слушает visibilitychange/focus/online только для ревалидации. Ни `navigator.deviceMemory`, ни `freeze`/`pagehide` (Page Lifecycle) нигде не используются (grep пуст). На телефоне с 2 GB и на десктопе с 32 GB поведение одинаково: 5 минут для всего.

**Предложение:** 1) Бюджет по умолчанию = clamp(deviceMemory × 1 MB, 2 MB, 16 MB) (Chrome/Edge/Opera отдают deviceMemory; Safari/Firefox — fallback 4 MB). 2) Один listener в `_installRevalidate`: при `visibilityState === 'hidden'` завести таймер 30 с → `_trim(budget × background)` (default background = 0.25) — фоновые вкладки чаще всего убивает браузер именно из-за памяти, и ужатие снижает шанс discard; при `freeze` (Page Lifecycle API) — немедленно; при `pageshow` с `persisted` (BFCache) ничего не делать. 3) Активные (refCount > 0) и pinned записи не трогаются, поэтому по возврату страница рисуется без loading, а staleTime/revalidateOn работают как раньше. 4) Публичный `cache.trim(bytes)` для приложений, которые знают свои пики (открытие тяжёлого редактора).

**Алгоритм:**

```js
function _defaultBudget() {
  const dm = typeof navigator !== 'undefined' && navigator.deviceMemory;   // 0.25..8 (GB, квантовано)
  return dm ? Math.min(16, Math.max(2, dm)) * 1024 * 1024 : 4 * 1024 * 1024;
}
function _installRevalidate() {
  …существующие tick('focus')/tick('reconnect')…
  let bgTimer = null;
  const shrink = () => _trim(_config.cache.budget * _config.cache.background);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') bgTimer = setTimeout(shrink, 30_000);
    else { clearTimeout(bgTimer); bgTimer = null; }
  });
  document.addEventListener('freeze', shrink);                 // Page Lifecycle: Chrome ≥ 68
}
// _trim(limit = budget): та же GDSF-развёртка, но с переданным лимитом;
// активные и pinned записи не вытесняются → после возврата UI не мигает.
```

**API:**

```js
configure({ cache: { budget: 8 * 1024 * 1024, background: 0.25 } })   // background: 0 — освобождать всё idle в фоне
import { cache } from './aegis.js';
cache.trim(1024 * 1024)                                                // ужать сейчас до 1 MB idle
stats().cache.budget                                                   // фактический бюджет устройства
```

**Критерий:** Тест в test.html: подменить `document.visibilityState` на 'hidden' + fake timers 30 с → `stats().cache.bytes ≤ 0.25 × budget`, при этом записи с refCount > 0 на месте и после возврата `loading.value === false` для них. На устройстве с deviceMemory=2 (Chrome DevTools emulation) budget = 2 MB, с deviceMemory=8 — 8 MB.

**Источники:** Page Lifecycle API (freeze/resume, web.dev «Page Lifecycle API»); Device Memory API (navigator.deviceMemory, W3C); Chrome «tab discarding» эвристики (memory-based); Android ComponentCallbacks2.onTrimMemory как модель уровней ужатия. Отвергнуто как база: performance.measureUserAgentSpecificMemory (нужен COOP/COEP), Compute Pressure API (только CPU)

## 💎 #46 — GC согласованный со scope-деревом: tier «страница» для back-навигации

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip

**Сейчас:** Release привязан к отдельному вызову resource(): dispose (5999-6000) регистрируется в текущем scope и при refCount→0 сразу абортит in-flight запрос (5769) и ставит таймер. Router создаёт scope `route:${pattern}` на каждую страницу (7338) и dispose'ит его при уходе (7358) — значит при навигации назад через 6 минут страница грузится с нуля, а при быстром «вперёд-назад» ответ, который уже летел, выбрасывается abort'ом. Scope знает своё имя, но кэш о scope не знает ничего.

**Предложение:** Вести `scope._held: Set<entry>` (лениво) — какие записи удерживает scope; `use()` добавляет туда entry. При dispose scope записи освобождаются одним проходом; если ближайший предок с именем `route:*` (или scope с флагом `keepAlive`) — записи получают tier 'page' и складываются в кольцо последних K страниц (`_pageRing`, K = 5): они не участвуют в бюджетном вытеснении и не абортятся, пока K новых страниц их не вытолкнут. Записи, освобождённые `list:row`/`show:*` scope'ами (виртуальный скролл, переключение вкладок), идут в обычный idle-пул. Это делает back/forward мгновенным с cacheTime=0 и ограничивает удержание ровно K страницами, а не временем.

**Алгоритм:**

```js
// Scope: this._held = null;  Scope.dispose(): if (this._held) _releaseHeld(this)
function _retainIn(scope, e) { (scope._held || (scope._held = new Set())).add(e); }
function _releaseHeld(scope) {
  let owner = scope; while (owner && !(owner.name && owner.name.startsWith('route:')) && !owner.keepAlive) owner = owner.parent;
  const page = owner ? [] : null;
  for (const e of scope._held) { if (--e.refCount > 0) continue; e.idleAt = Date.now(); if (page) page.push(e); }
  scope._held = null;
  if (page && page.length) {
    for (const e of page) e.tier = 'page';                       // не абортим in-flight, не вытесняем бюджетом
    _pageRing.push(page);
    while (_pageRing.length > _config.cache.pages) for (const e of _pageRing.shift()) { e.tier = null; }
  }
  _trim();
}
// _trim(): кандидаты — refCount<=0 && !pinned && tier !== 'page'
// use(): при повторном retain записи из ring — e.tier = null, убрать из массива страницы (лениво: проверка tier при сдвиге)
// _releaseEntry для ручного r.dispose() вне scope — прежнее поведение (idle-пул)
```

**API:**

```js
configure({ cache: { pages: 5 } })            // сколько последних страниц держать целиком; 0 — выключить tier
router(routes, { keepAlive: 3 })              // алиас на уровне роутера
createScope('modal').keepAlive = true         // любой scope может объявить себя «страницей»
stats().cache.pages → [{ route: 'route:/users/:id', entries: 3, bytes: 41200 }, …]
```

**Критерий:** Тест с mock router: открыть A → B → C → D → E → F (6 страниц, cacheTime=0, budget 200 KB), затем назад к B: `loading.value === false` и 0 fetch'ей на монтировании B; для A (выпала из кольца K=5) — fetch есть. В-flight запрос страницы, покинутой до ответа, завершается и данные лежат в ring (проверка: `settled()` затем `_resourceCache.get(key).data.peek() !== null`).

**Источники:** Back/forward cache (bfcache) как модель; Vue `<KeepAlive max>`; Angular RouteReuseStrategy; Remix/React Router «revalidation on navigation» + Next.js Router Cache (30 с/5 мин по типу); генерационный GC (young/old) как аналогия: страницы — «старое поколение»

## 💎 #47 — Одна ленивая развёртка вместо setTimeout на запись и dev-only имена сигналов

**Impact:** 2 · **Effort:** S · **Size:** −0.1 KB gzip (удаляются три копии timer-логики)

**Сейчас:** Три места ставят по таймеру на запись: `_releaseEntry` 5770, seed 5878, prefetch 5917 — 1000 записей = 1000 pending-таймеров, плюс `_retainEntry` (5762-5765) их снимает/ставит на каждом переключении URL. `_cacheEntry` (5743-5746) создаёт четыре сигнала с именами `cache:${key}:data` и т.д. — четыре новых строки по длине ключа на запись. Замер: 4 именованных сигнала = 649 байт, без имён = 300 байт; запись через seed() = 1125 байт, т.е. ~30% — строки имён, которые в production никто не читает.

**Предложение:** 1) Убрать `gcTimer` из entry; развёртка по cacheTime делается внутри `_trim()` (предложение 1), которую вызывают release/setData, плюс один «страховочный» `setTimeout(_trim, cacheTime)` на модуль, переставляемый, только если есть idle-записи (как `_netLog` ограничен 200 записями одной проверкой на вставке, 5791). 2) Имена сигналов только при `_dev()`: `const nm = _dev() ? (s) => \`cache:${key}:${s}\` : () => undefined`. inspect()/dev-панель работают как прежде, production экономит ~350 байт на запись и 4 аллокации строк. 3) `_shape` (6005-6013) с 5 computed + ready — 2.7 KB на статическую запись; создавать `key` как обычное свойство-значение вместо `computed(() => e.key)` (ключ статической записи неизменен) — минус один computed на запись.

**Алгоритм:**

```js
// _cacheEntry
const nm = _dev() ? (s) => `cache:${key}:${s}` : () => undefined;
e = { key, data: signal(initial, nm('data')), inflight: signal(false, nm('inflight')),
      started: signal(initial != null, nm('started')), error: signal(null, nm('error')),
      …, size: 0, hits: 0, pri: 0, idleAt: 0 };           // без gcTimer

// единый страховочный таймер
let _sweepTimer = null;
function _armSweep() {
  if (_sweepTimer) return;
  _sweepTimer = setTimeout(() => { _sweepTimer = null; _trim(); if (_hasIdle()) _armSweep(); }, _config.cache.cacheTime);
}
function _releaseEntry(e) { if (--e.refCount > 0) return; e.idleAt = Date.now(); _trim(); _armSweep(); }
// reset() 8612: вместо обхода gcTimer — clearTimeout(_sweepTimer)
// Замеры (names.mjs, ключ 90 символов, N=5000):
//   4 named signals   649 B/entry
//   4 unnamed signals 300 B/entry   (−54% на сигналах, −30% на seed-записи)
```

**API:**

```js
Без изменений публичного API. inspect()/devPanel по-прежнему видят `cache:<key>:data` в dev-режиме (DEV-флаг определяется как сейчас через _dev()).
```

**Критерий:** entry-cost.mjs в production-режиме: seed() ≤ 800 байт/запись (сейчас 1125), cachedResource() ≤ 3300 байт (сейчас 3896); после создания и dispose 10 000 записей — ровно 0 или 1 активный таймер (проверка через fake timers в test.html); test.html «cache» блок проходит без изменений.

**Источники:** V8 string allocation cost (flat cons-strings при template literal); Preact Signals / Solid — debug names только в dev; Redis active-expire cycle (одна периодическая развёртка вместо таймера на ключ)

## 💎 #48 — Квота для offline IndexedDB: вытеснение по timestamp и storage.estimate()

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip (в offline-секции — tree-shakeable вместе с ней)

**Сейчас:** _offlineResource пишет `{ data, timestamp }` при каждом fetch (8088) и каждом mutateLocal (8116), а `_idb` (7844-7952) умеет get/set/delete/keys, но никто и никогда не вызывает delete для данных — только очередь мутаций ограничена `_MAX_QUEUE = 1000` (7953). Хранилище растёт между сессиями бесконечно: год работы админки = сотни MB в IDB, и Safari (7-дневный eviction для не-persisted origin) или Chrome при нехватке диска удаляют всё разом, включая очередь мутаций.

**Предложение:** Опция `offline: { quota: bytes }` (default 50 MB) и индексная запись `__aegis_index__: { [key]: [timestamp, size] }`, обновляемая в тех же транзакциях, что и set (одна маленькая запись вместо getAll всего store). При старте первого offline-ресурса — в `requestIdleCallback`: если сумма size > quota или `navigator.storage.estimate()` показывает usage/quota > 0.8 — удалять самые старые по timestamp до 0.7 × quota (LRU по времени записи; данные, которые пользователь читал, обновляются `_touch`-записью timestamp раз в сутки, не чаще). Отдельно один раз запросить `navigator.storage.persist()` если в очереди есть мутации — иначе браузер может стереть неотправленные изменения.

**Алгоритм:**

```js
const _IDX = '__aegis_index__';
async function _idbPut(store, key, value) {          // вместо store.set в 8088/8116
  const idx = (await store.get(_IDX)) || {};
  idx[key] = [Date.now(), _sizeOf(value.data)];
  await store.set(key, value); await store.set(_IDX, idx);   // две put в одной readwrite-транзакции внутри _idb
  if (_idxBytes(idx) > quota) _scheduleSweep(store, idx);
}
async function _sweepIdb(store, idx, quota) {
  let est = null; try { est = await navigator.storage.estimate(); } catch {}
  const pressure = est && est.quota && est.usage / est.quota > 0.8;
  let total = _idxBytes(idx);
  if (total <= quota && !pressure) return;
  const target = quota * 0.7;
  const keys = Object.keys(idx).sort((a, b) => idx[a][0] - idx[b][0]);   // старые первыми
  for (const k of keys) {
    if (total <= target) break;
    if (k === _QUEUE_KEY) continue;                                        // очередь мутаций не трогаем
    total -= idx[k][1]; delete idx[k]; await store.delete(k);
  }
  await store.set(_IDX, idx);
}
// вызов: первый _offlineResource → requestIdleCallback(() => _sweepIdb(...), { timeout: 5000 })
// persist: if (queue.length && navigator.storage?.persist) navigator.storage.persist()
```

**API:**

```js
resource(url, { offline: { quota: 20 * 1024 * 1024 } })
configure({ offline: { quota, persist: true } })      // persist: запросить navigator.storage.persist() при первой мутации в очереди
stats().offline → { entries, bytes, quota, lastSweep }
```

**Критерий:** Тест (fake-indexeddb в node или test.html в браузере): 200 записей по 100 KB при quota 5 MB → после sweep ≤ 3.5 MB и остались самые новые 35 записей, `__aegis_mutations__` нетронута; sweep 1000 записей укладывается в < 50 мс idle-колбэка; повторный sweep без изменений — 1 чтение (индекс), 0 удалений.

**Источники:** StorageManager.estimate()/persist() (Storage Standard); Safari ITP 7-day script-writable storage eviction; Workbox `ExpirationPlugin` (maxEntries/maxAgeSeconds/purgeOnQuotaError); idb-keyval; TanStack Query `persistQueryClient` maxAge/buster

## 💎 #49 — FinalizationRegistry как страховка от зависших refCount (dev-warning + self-heal)

**Impact:** 2 · **Effort:** S · **Size:** +0.2 KB gzip

**Сейчас:** Все resource-варианты регистрируют dispose только `if (_currentScope)` (3673, 6000, 6115, 8148). Вне scope (top-level скрипт, обработчик события, promise-цепочка) объект результата живёт, пока на него ссылаются, а `refCount` записи остаётся ≥ 1 навсегда: запись никогда не удалится (5768 `if (--e.refCount > 0) return`), а `_installRevalidate` (5859) будет перезапрашивать её при каждом focus для «мёртвой» страницы. E001 предупреждает про effect вне scope, но для cachedResource с статическим ключом effect'а нет — утечка тихая.

**Предложение:** Один модульный `FinalizationRegistry` (dev и prod, ~20 строк): в `_cachedResource` регистрировать возвращаемый объект результата с токеном `{ e, disposed: false }`; dispose помечает `disposed = true` и `unregister`. Если объект собран GC, а `disposed` false — это утечка: prod молча делает `_releaseEntry(e)` (self-heal: держателя уже нет), dev дополнительно `_warn('E038', { what: 'resource("key") was garbage-collected without dispose()', fix: 'create it inside component()/mount() setup or call r.dispose()' })`. Не использовать WeakRef для самих данных (см. rejected).

**Алгоритм:**

```js
const _leakReg = typeof FinalizationRegistry === 'function'
  ? new FinalizationRegistry((tok) => {
      if (tok.disposed) return;
      const e = tok.e;
      if (e.refCount > 0) _releaseEntry(e);                   // self-heal: держателя больше нет
      if (_dev()) _warn('E038', {
        site: tok.site,
        what: `resource("${e.key}") was garbage-collected while still retained (no dispose()).`,
        why: 'Created outside a scope — nothing released the cache entry; it stayed pinned and revalidated on focus.',
        fix: 'Create resources inside component()/mount() setup, or keep the result and call r.dispose().',
      }, 'leak:' + e.key);
    })
  : null;
// в _cachedResource, перед return:
const tok = { e: current.peek(), disposed: false, site: _dev() ? _callSite() : null };
const dispose = () => { tok.disposed = true; if (_leakReg) _leakReg.unregister(res); …прежний release… };
if (_leakReg && !_currentScope) _leakReg.register(res, tok, res);   // только вне scope: внутри scope dispose гарантирован
// Замечание: колбэк приходит после major GC — задержка секунды/минуты; это страховка, не механизм кэша.
```

**API:**

```js
Публичного API нет. Новый код ошибки E038 в ERRORS.md / aegis-devtools.js DOCS; в dev-панели счётчик `leaks` рядом с `cache`.
```

**Критерий:** Тест в Chrome (test.html, с `--js-flags=--expose-gc` в test-browsers.mjs): создать resource(url, {cache:true}) в root без scope, обнулить ссылку, `gc()` + await 0 → в течение 1 с `_resourceCache.get(url).refCount === 0` и одно предупреждение E038; внутри component() — регистрации нет (0 накладных расходов). Размер: ≤ 0.2 KB gzip.

**Источники:** TC39 WeakRefs proposal — раздел «FinalizationRegistry для обнаружения утечек, не для кэшей»; Node.js `--expose-gc` тестовый паттерн; Apollo Client 3.9 «WeakCache/StrongCache» опыт; React DevTools leak detection


---

# 📐 eviction-theory

**Линза:** math / eviction-theory

**Вывод:** Сегодня _resourceCache (aegis_full.js:5736–5771) не имеет ёмкости вообще: единственный механизм вытеснения — setTimeout на cacheTime после последнего release (5770), плюс hardcoded 5 мин в seed (5878) и prefetch (5917). По аппроксимации Che это TTL-кэш, эквивалентный LRU, у которого ёмкость задаётся не памятью, а интенсивностью трафика: occupancy = Σ(1−e^{−λp_i·T}); симуляция подтверждает формулу (Zipf 0.8: теория 84 записи/26.2 % — симуляция 84/25.9 %), а при 5 req/s (typeahead) та же формула даёт 719 записей ≈ 0.7–1.8 МБ heap при измеренных 1 КБ (пустая entry) / 2.5 КБ (с 20 строками) на запись. Для SPA-трасс (85 % ключей — one-hit wonders: typeahead, детальные страницы) оптимальна не LRU, а политика с «ленивым продвижением и быстрым понижением»: SIEVE/S3-FIFO/W-TinyLFU идут кучно, дают +10–13 п.п. к LRU на Zipf, ×2 к LRU на трассе со сканами и на SPA-трассе достигают hit ratio LRU-400 при 50 записях (8× меньше памяти); до границы Белади остаётся 3–8 п.п. Cost-aware (GDSF, latency×freq) не окупается: дорогие ключи (/api/stats) и так самые частые — выигрыш ≤1 п.п. по latency-weighted hit, при O(n) вытеснении. Рекомендация: SIEVE (одна двусвязная очередь + бит visited, hit-путь = одна запись бита, 93 нс/оп в node) с maxEntries по умолчанию 500, единый sweep вместо N таймеров, MRC-телеметрия через гистограмму reuse-distance (Che предсказывает LRU на non-IRM SPA-трассе с точностью 0.5 п.п.) и, отдельно, вообще отсутствующее вытеснение в IndexedDB-store offline-режима.

**Отвергнуто:** 1) ARC/CAR (адаптивный баланс recency/frequency): 4 списка и ~120 строк; на симуляции SIEVE/S3-FIFO уже в 3–8 п.п. от OPT, адаптивность не окупает размер бандла. 2) W-TinyLFU полностью (count-min sketch + window + SLRU): hit ratio равен SIEVE (±1 п.п. на всех трассах), но sketch, doorkeeper и два сегмента — ~1 КБ gzip; для 10–10 000 записей избыточно. 3) LFU с aging: лучший или равный по hit ratio на Zipf (42.1 % при C=100), но O(n) выбор минимума или O(log n) куча; SIEVE даёт то же за O(1). 4) GDSF / latency-aware (freq × latency): дорогие ключи (/api/stats, 1.5 с) и так самые частые — выигрыш ≤ 1 п.п. по latency-weighted hit (S3-FIFO-cost 65.5 vs 64.4 при C=50), при O(n)/O(log n) вытеснении; при байтовом бюджете GDSF даёт +1.7–3.3 п.п. object-hit ценой byte-hit — не стоит кучи. 5) Батч-вытеснение «раз в C/10 вставок отсортировать по score и удалить 10 %» как универсальный механизм: работает (batchLRU теряет ≤ 0.6 п.п. от точного LRU), но LRU-семейство само на 10 п.п. хуже SIEVE, а сортировка O(C log C) при C=10k ~1–2 мс jank — SIEVE проще и лучше. 6) Ghost-hit rate S3-FIFO как оценка MRC: проверил — недооценивает выигрыш от удвоения ёмкости в 3–7 раз (0.3 % ghost-hit при реальном +2.0 п.п.), поэтому для телеметрии взята гистограмма reuse-distance + Che (точность 0.5 п.п.). 7) Sampled eviction по Redis (k случайных из Map): в JS Map нет O(1) случайного доступа — пришлось бы держать параллельный массив; SIEVE дешевле. 8) Приоритет вытеснения по «стоимости пересоздания» сигналов (entry без данных vs с данными): все entry одинаковы по структуре (1 КБ база), выделять классы бессмысленно.

## 💎 #50 — Ограниченный кэш с вытеснением SIEVE вместо неограниченного TTL

**Impact:** 5 · **Effort:** M · **Size:** +0.35–0.5 КБ gzip (три поля на entry, 4 функции)

**Сейчас:** aegis_full.js:5736 `_resourceCache = new Map()` без предела; `_cacheEntry` (5738–5760) всегда создаёт новую entry (4 сигнала + timer ≈ 1 КБ heap, измерено); вытеснение — только `_releaseEntry` (5767–5771): setTimeout(cacheTime) после refCount→0. Единственная ограниченная структура в модуле — `_netLog` (5791, FIFO 200). Ёмкость де-факто = Σ(1−e^{−λ p_i cacheTime}) — растёт линейно с частотой запросов (typeahead в demo/admin.html:113 создаёт entry на каждое нажатие).

**Предложение:** Ввести глобальную ёмкость `maxEntries` (по умолчанию 500) и политику SIEVE (Zhang et al., NSDI'24): каждая entry получает поля `_prev/_next/_v`; «обращение» = `use()` в _cachedResource (5979–5991), seed (5873), prefetch (5912) → `e._v = 1` (без перестройки структур); вставка новой entry в голову; при size > max — «рука» идёт от хвоста к голове, сбрасывает visited, удаляет первую не-visited и не-pinned (refCount>0) entry; если полный проход не нашёл жертву — мягкое превышение. cacheTime остаётся как TTL (см. P2), но перестаёт быть единственным регулятором памяти. Тот же список можно использовать для `invalidate(fn)` (6053) без изменений.

**Алгоритм:**

```js
// Che-эквивалентность текущего дизайна: TTL-кэш с T=cacheTime ≈ LRU ёмкости C(λ)=Σ_i(1−exp(−λ p_i T))
// Симуляция (100k запросов; object hit %, OPT = граница Белади):
//   Zipf N=2000 α=0.8  C=100: OPT 53.2 | LRU 28.4 | SIEVE 41.2 | S3-FIFO 39.7 | W-TinyLFU 40.7 | LFU-aging 42.1
//                      C=500: OPT 79.3 | LRU 58.6 | SIEVE 65.6 | W-TinyLFU 66.0
//   Zipf+30% scan      C=100: OPT 37.2 | LRU 16.0 | SIEVE 27.6 | S3-FIFO 28.0    C=500: LRU 33.3 | SIEVE 45.1
//   SPA-session (85% one-hit ключей)  C=50: OPT 49.5 | LRU 38.6 | SIEVE 43.9 | S3-FIFO(th2) 47.4 | W-TinyLFU 44.2
//                                     C=400: OPT 54.7 | LRU 47.8 | SIEVE 50.3 | S3-FIFO(th2) 51.6
//   Aegis-TTL 300s на SPA-трассе: hit 31.2%, occupancy avg 27 / max 126 (хуже SIEVE-50 при большей памяти)
// Скорость (node, C=1000, 500k оп): SIEVE 93 нс/оп, LRU(Map delete+set) 209, S3-FIFO 484.

let _cHead = null, _cTail = null, _cHand = null, _cSize = 0;
function _cLink(e) { e._prev = null; e._next = _cHead; if (_cHead) _cHead._prev = e; _cHead = e; if (!_cTail) _cTail = e; _cSize++; }
function _cUnlink(e) { if (e._prev) e._prev._next = e._next; else _cHead = e._next; if (e._next) e._next._prev = e._prev; else _cTail = e._prev; _cSize--; }
function _cTouch(e) { e._v = 1; }                        // hit-путь: O(1), без мутации структур
function _cEvict(max) {                                  // вызывается после _cLink новой entry
    let passes = 0;
    while (_cSize > max) {
        let o = _cHand || _cTail;
        while (o && (o._v || o.refCount > 0)) { o._v = 0; o = o._prev || _cTail; if (++passes > 2 * _cSize) return; } // всё pinned — мягкое превышение
        if (!o) return;
        _cHand = o._prev; _cUnlink(o);
        if (o.controller) o.controller.abort();
        if (o.gcTimer) clearTimeout(o.gcTimer);
        _resourceCache.delete(o.key);
    }
}
// в _cacheEntry: после _resourceCache.set(key, e) → _cLink(e); _cEvict(_config.cache.maxEntries)
// в use()/seed/prefetch при существующей entry → _cTouch(e); в _releaseEntry/reset → _cUnlink при удалении
```

**API:**

```js
configure({ cache: { maxEntries: 500 } })            // глобально; 0/Infinity — как сейчас
resource(url, { cache: true })                        // без изменений
stats().resourceCache                                 // теперь ≤ maxEntries
// пример: typeahead из demo/admin.html:113 — 2000 нажатий → ≤500 entries вместо ~2000 × 1–2.5 КБ
```

**Критерий:** Тест: 2000 уникальных ключей через resource({cache:true}) с dispose → `stats().resourceCache <= 500`, pinned (не disposed) не вытесняются. Бенч в bench.html: реплей SPA-трассы из sim.mjs через seed/use → hit ratio ≥ 43 % при maxEntries=50 (LRU даёт 38.6 %, текущий TTL 31 %); hit-путь < 200 нс. Память: 10k обращений ≤ 500 × 2.5 КБ ≈ 1.25 МБ heap вместо неограниченного роста.

**Источники:** Zhang, Yang et al. «SIEVE is Simpler than LRU» (NSDI 2024); Yang et al. «FIFO queues are all you need for cache eviction» S3-FIFO (SOSP 2023); Che, Tung, Wang «Hierarchical Web Caching Systems» (Che approximation, 2002); Belady «A study of replacement algorithms» (1966); симуляция scratchpad/agents/eviction-theory/sim.mjs, sim3.mjs

## 💎 #51 — cacheTime через lazy + active expiration (один sweep) вместо setTimeout на каждую entry

**Impact:** 3 · **Effort:** S · **Size:** ≈0 (три setTimeout-сайта → один setInterval; ожидаемо −50…+100 байт gzip)

**Сейчас:** Три независимых таймера-сайта с одним смыслом: `_releaseEntry` 5770 (`setTimeout(..., cacheTime)`), `seed` 5877–5879 и `prefetch` 5916–5918 (hardcoded 5 мин, у prefetch — opts.cacheTime). `_retainEntry` 5764 делает clearTimeout при каждом mount. `reset()` 8612 вынужден обходить все entry и чистить таймеры. Каждая entry держит handle таймера; при 10k entries — 10k таймеров в очереди событий (измерено в node: 4.66 мс на создание, 0.89 мс на clear; полный sweep 10k записей по `expiresAt` — 1.04 мс).

**Предложение:** Заменить таймеры полем `e.expiresAt` (Redis-модель «lazy + active expiration»): lazy — `_cacheEntry` при попадании проверяет `refCount<=0 && expiresAt <= now` → сбрасывает data/lastFetch (или удаляет и создаёт заново); active — один `setInterval` на модуль с периодом min(cacheTime)/2 (не чаще 30 с), который обходит список из P1 от хвоста и удаляет просроченные не-pinned entry; интервал запускается лениво при первой cached entry и останавливается, когда кэш пуст (tree-shaking и SSR не затронуты). `_releaseEntry` становится O(1) без setTimeout; seed/prefetch/cached используют одно поле.

**Алгоритм:**

```js
// Стоимость: сейчас O(log n) на insert/clear таймера + handle на entry; после — O(1) на release, O(n) раз в period,
// амортизированно O(n / (period·λ)) на операцию → при λ=5 req/s, period=30 с, n=500: ~3 сравнения/операцию.
let _sweepTimer = null, _sweepPeriod = 30000;
function _releaseEntry(e, cacheTime) {
    if (--e.refCount > 0) return;
    if (e.controller) { e.controller.abort(); e.controller = null; e.promise = null; }
    e.expiresAt = Date.now() + cacheTime;
    _sweepPeriod = Math.min(_sweepPeriod, Math.max(1000, cacheTime / 2));
    _armSweep();
}
function _armSweep() {
    if (_sweepTimer || typeof setInterval !== 'function') return;
    _sweepTimer = setInterval(() => {
        const now = Date.now();
        for (let e = _cTail, p; e; e = p) { p = e._prev; if (e.refCount <= 0 && e.expiresAt && e.expiresAt <= now) _cDrop(e); }
        if (!_resourceCache.size) { clearInterval(_sweepTimer); _sweepTimer = null; }
    }, _sweepPeriod);
}
// lazy: в _cacheEntry(key) при существующей e:
//   if (e.refCount <= 0 && e.expiresAt && e.expiresAt <= Date.now()) { e.data.value = null; e.lastFetch = 0; e.expiresAt = 0; }
// seed(): e.expiresAt = Date.now() + (opts.cacheTime ?? 300000); prefetch(): то же — вместо собственных setTimeout
// reset(): clearInterval(_sweepTimer) — вместо обхода всех gcTimer
```

**API:**

```js
seed(key, data, { age, cacheTime })                 // cacheTime появляется у seed (сейчас hardcoded 5 мин)
prefetch(url, { cacheTime })                        // без изменений
configure({ cache: { sweep: 30000 } })              // период active-expiration; для тестов — flushSync-подобный dev.sweep()
```

**Критерий:** Юнит-тест: 1000 seed() + 1000 release → `stats().timers === 1` (добавить счётчик в stats) вместо 2000 handles; после cacheTime + period entry отсутствует; pinned entry не тронута. Бенч: 10k release() < 2 мс (сейчас ≈ 5 мс на setTimeout); reset() не итерирует таймеры. Существующие тесты test.html:683–706 и 934–955 проходят без изменений.

**Источники:** Redis expire.c (lazy + active expiration, sampled); Caffeine (Ben Manes) — timer wheel вместо per-entry таймеров; Varnish «expiry thread»

## 💎 #52 — MRC-телеметрия кэша: hit ratio, one-hit-wonders и «что даст maxEntries=N» через гистограмму reuse-distance

**Impact:** 3 · **Effort:** M · **Size:** +0.15–0.2 КБ gzip в core (счётчики под _dev()), +0.4 КБ в aegis-devtools.js

**Сейчас:** `stats()` 985–995 отдаёт только `resourceCache: _resourceCache.size`; devtools-панель (aegis-devtools.js:91) показывает это число как «cache». Нет ни hits/misses, ни evictions, ни способа понять, что typeahead-ключи (`?q=…&page=1`) забивают кэш one-hit записями или что ключи нестабильны (порядок query-параметров). Настроить maxEntries/staleTime без измерения нельзя.

**Предложение:** В dev-режиме считать в `_cacheEntry`/`_cTouch`: hits, misses, evictions, oneHit (entries, вытесненные с _v=0 и одним обращением), плюс гистограмму reuse-distance в log2-корзинах (Uint32Array(32)) по `Map key→порядковый номер обращения` (bounded ghost-словарь ≤ 8×maxEntries ключей). Из гистограммы по аппроксимации Che восстанавливать кривую miss-ratio: hit(C) = P(reuse ≤ T_C), где T_C — окно, в котором среднее число различных ключей = C. Показывать в панели строку «cache: 43 % hit · 500/500 · one-hit 61 % · maxEntries 250→41 % 1000→48 %» и dev-warning E038, если one-hit ≥ 70 % и ключи содержат `?q=` (совет: debounce / `cache:false` для typeahead / нормализация ключа).

**Алгоритм:**

```js
// Проверка точности на non-IRM SPA-трассе (200k запросов): Che-оценка vs симуляция LRU
//   C=25: 35.1 / 34.6   C=50: 38.8 / 38.7   C=100: 42.4 / 42.3   C=200: 45.5 / 45.5   C=400: 48.0 / 47.9  (≤0.5 п.п.)
// SIEVE на тех же C выше на 4–9 п.п. — панель показывает оценку как нижнюю границу.
const _rd = { n: 0, last: new Map(), H: new Uint32Array(32), firsts: 0, hits: 0, misses: 0, evict: 0, oneHit: 0 };
function _rdTouch(key) {                       // O(1) на обращение
    const l = _rd.last.get(key);
    if (l == null) _rd.firsts++; else _rd.H[31 - Math.clz32(_rd.n - l)]++;   // bucket = floor(log2(d))
    _rd.last.set(key, _rd.n++);
    if (_rd.last.size > 8 * _maxEntries) _rd.last.delete(_rd.last.keys().next().value);
}
function _mrc(C) {                             // Che: occupancy(T) = (Σ_d H[d]·min(d,T) + firsts·T) / n
    const occ = (T) => { let s = _rd.firsts * T; for (let b = 0; b < 32; b++) s += _rd.H[b] * Math.min(1 << b, T); return s / _rd.n; };
    let lo = 1, hi = _rd.n; while (lo < hi) { const T = (lo + hi) >>> 1; if (occ(T) < C) lo = T + 1; else hi = T; }
    let h = 0; for (let b = 0; (1 << b) <= lo && b < 32; b++) h += _rd.H[b];
    return h / _rd.n;
}
// stats().cache = { size, max, hits, misses, hitRatio, evictions, oneHitRatio, mrc: { [C/2]: _mrc(C/2), [C]: _mrc(C), [2*C]: _mrc(2*C) } }
// Ghost-hit rate S3-FIFO как MRC-пробник проверен и отвергнут: даёт 0.2–2.4 % при реальном выигрыше 1.3–6.2 п.п. (недооценка ×3–7)
```

**API:**

```js
stats().cache   // { size: 500, max: 500, hits: 812, misses: 1090, hitRatio: 0.43, evictions: 590, oneHitRatio: 0.61, mrc: { 250: 0.41, 500: 0.43, 1000: 0.48 } }
dev.explain('E038')  // «61 % of cache entries were used once; keys look like typeahead (?q=). Debounce the URL signal or use cache:false for it»
// devtools-панель: строка cache с hit % и подсказкой «maxEntries 1000 → +5 п.п.»
```

**Критерий:** Тест: реплей SPA-трассы из sim3.mjs через seed/use под dev-режимом → `stats().cache.mrc[C]` отличается от измеренного hit ratio LRU-симуляции не более чем на 1 п.п.; счётчики hits+misses = число обращений; прирост core ≤ 0.2 КБ gzip (гистограмма и MRC — в aegis-devtools.js).

**Источники:** Mattson et al. «Evaluation techniques for storage hierarchies» (stack distance, 1970); Che approximation (Fricker, Robert, Roberts «A versatile and accurate approximation for LRU cache performance», ITC 2012); Waldspurger et al. «SHARDS» (FAST 2015) — sampled MRC; Caffeine simulator hit-rate reporting

## 💎 #53 — Ограничить IndexedDB-store offline-режима: lastAccess + амортизированная обрезка старейших 10 %

**Impact:** 3 · **Effort:** M · **Size:** +0.35 КБ gzip

**Сейчас:** `_offlineResource` пишет `store.set(url, { data, timestamp })` при каждом успешном fetch (8088) и при mutateLocal (8116); `loadCached` (8064–8074) читает и не обновляет timestamp; в обёртке `_idb` (7843–7950) есть get/set/delete/keys, но `delete` для ресурсных ключей не вызывается нигде — IDB растёт бесконечно (typeahead с `offline:true` = каждый префикс навсегда). Никакого учёта `navigator.storage.estimate()`; `OfflineOptions` в aegis.d.ts:548–553 не имеет предела.

**Предложение:** Добавить `offline: { maxEntries = 200, maxBytes? }`. Запись хранит `{ data, ts, at }` (`at` — последнее обращение, обновляется при чтении не чаще раза в час — «coarse LRU», чтобы не платить write за каждый read). В `onupgradeneeded` создавать индекс `at`; `_idb` уже умеет поднимать версию при отсутствии store — добавить проверку отсутствия индекса. После set: раз в каждые max/10 вставок (счётчик в памяти) — `count()`, и если > max, курсором по индексу `at` от старейшего удалить 10 % + перебор (амортизированно ~1 IDB-операция на вставку). Служебный ключ `__aegis_mutations__` не имеет поля `at` → в индекс не попадает и не удаляется автоматически. При `maxBytes` — оценка `JSON.stringify(data).length` только в этом режиме; дополнительно, если `storage.estimate()` даёт usage/quota > 0.8 — внеочередная обрезка.

**Алгоритм:**

```js
// Coarse-LRU в IDB ≈ CLOCK: обновление at раз в час делает порядок «примерно LRU»; на трассах с reuse-gap ≫ 1 ч
// разница с точным LRU нулевая, а write-трафик на hit падает с 1 до ~1/(λ·3600).
async function _idbPrune(store, max) {                 // O(k log n) на k удалений, вызывается раз в max/10 вставок
    const db = await store._db();
    const n = await new Promise((res, rej) => { const r = db.transaction(storeName).objectStore(storeName).count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    if (n <= max) return;
    let k = n - max + Math.ceil(max / 10);
    await new Promise((res, rej) => {
        const tx = db.transaction(storeName, 'readwrite');
        const cur = tx.objectStore(storeName).index('at').openKeyCursor();      // от старейшего at
        cur.onsuccess = () => { const c = cur.result; if (!c || k-- <= 0) return; tx.objectStore(storeName).delete(c.primaryKey); c.continue(); };
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
}
// loadCached: if (cached && Date.now() - cached.at > 3600000) store.set(k, { ...cached, at: Date.now() })  // coarse touch
// fetchRemote: store.set(url, { data: next, ts: now, at: now }); if (++_writes % Math.ceil(max/10) === 0) _idbPrune(store, max)
// onupgradeneeded: os = createObjectStore(name); os.createIndex('at', 'at')  — probe в _idb дополнительно проверяет objectStore.indexNames.contains('at')
```

**API:**

```js
resource(url, { offline: { maxEntries: 200 } })          // default 200; maxBytes: 20 * 1024 * 1024 — опционально
resource(url, { offline: true })                           // = maxEntries 200
// aegis.d.ts OfflineOptions: + maxEntries?: number; maxBytes?: number
```

**Критерий:** Тест (test-browsers.mjs, Chrome+Firefox): 1000 разных URL через resource({offline:{maxEntries:100}}) → `await store.keys()` даёт ≤ 111 ключей (100 + 10 % люфт + очередь); ключ очереди мутаций сохраняется; повторное чтение не пишет в IDB чаще раза в час (mock Date). Обрезка 10 % из 1000 записей < 50 мс.

**Источники:** CLOCK / second-chance (Corbató, 1968) — обоснование coarse-touch; Workbox ExpirationPlugin (maxEntries + maxAgeSeconds на IDB-индексе timestamp); Storage Standard `navigator.storage.estimate()`; Redis approximated LRU с 24-битным clock

## 💎 #54 — Байтовый бюджет `maxBytes` тем же SIEVE — без GDSF

**Impact:** 2 · **Effort:** S · **Size:** +0.12 КБ gzip (поверх P1)

**Сейчас:** Размер ответа нигде не учитывается: `_fetchEntry` (5836–5837) кладёт результат transform в `e.data`; `_parseBody` (1310–1322) читает `response.json()` — длина тела недоступна. Один `/api/users?page=N` в demo — десятки КБ, детальная запись — ~1 КБ, при равном счёте entries память различается на порядок.

**Предложение:** Опция `configure({ cache: { maxBytes } })`: только когда она задана, `_fetchEntry` после transform оценивает `e.bytes = JSON.stringify(next).length * 2` (UTF-16; O(size), ~0.2 мс на 50 КБ, только на miss) и суммирует в `_cBytes`; вытеснение — та же рука SIEVE из P1, пока `_cBytes > maxBytes || _cSize > maxEntries`. GDSF (priority = L + f·cost/size) осознанно не внедрять: по симуляции он даёт +1.7–3.3 п.п. object-hit при байтовом бюджете, но теряет byte-hit и равен по latency-weighted, при этом требует кучи/O(n)-скана вместо O(1).

**Алгоритм:**

```js
// Симуляция SPA-трассы с размерами (list 40 КБ, typeahead 15 КБ, detail 1.5 КБ, stats 0.5 КБ; mean 15.3 КБ):
//   B=256 КБ : SIEVE-bytes obj 36.9 / byte 39.9 / lat 60.7   LRU-bytes 31.7/35.3/52.4   GDSF(1/size) 40.2/38.8/61.4   GDSF(lat/size) 38.9/39.0/61.3
//   B=1 МБ   : SIEVE-bytes 45.2 / 53.6 / 66.7               LRU-bytes 40.7/46.1/63.4   GDSF(1/size) 46.9/47.6/65.2   GDSF(lat/size) 46.2/50.5/66.7
//   B=4 МБ   : SIEVE-bytes 50.5 / 58.3 / 69.5               LRU-bytes 47.3/55.7/67.8   GDSF(1/size) 53.2/57.3/69.8   GDSF(lat/size) 51.9/58.1/69.9
// Вывод: SIEVE-bytes ≥ LRU-bytes на 3–5 п.п. по всем метрикам; GDSF выигрывает ≤3 п.п. object-hit ценой byte-hit и O(n).
let _cBytes = 0;
function _cSetBytes(e, next) {
    if (!_maxBytes) return;
    let b = 0; try { b = JSON.stringify(next).length * 2; } catch { b = 1024; }
    _cBytes += b - (e.bytes || 0); e.bytes = b;
}
function _cOver() { return _cSize > _maxEntries || _cBytes > _maxBytes; }
// _cEvict: while (_cOver()) { ...та же рука SIEVE...; _cBytes -= o.bytes || 0; }
// _fetchEntry: после e.data.value = ... → _cSetBytes(e, e.data.peek()); if (_cOver()) _cEvict();
// mutate()/seed(): те же две строки
```

**API:**

```js
configure({ cache: { maxEntries: 500, maxBytes: 8 * 1024 * 1024 } })
stats().cache.bytes   // текущая оценка занятой памяти данными
```

**Критерий:** Тест: 100 ответов по 100 КБ при maxBytes = 2 МБ → `stats().cache.bytes <= 2.2 МБ`, `resourceCache <= 21`; pinned entry не вытесняются даже сверх бюджета. Бенч: JSON.stringify 50 КБ ответа ≤ 0.5 мс (без maxBytes — 0 накладных).

**Источники:** Cao, Irani «Cost-Aware WWW Proxy Caching Algorithms» (GreedyDual-Size, USENIX 1997); Cherkasova «Improving WWW Proxies Performance with GDSF» (1998); Caffeine weigher/maximumWeight; симуляция sim4.mjs

## 💎 #55 — Ghost-список для prefetchOn: не прогревать повторно то, что уже вытеснялось неиспользованным

**Impact:** 2 · **Effort:** S · **Size:** +0.1 КБ gzip

**Сейчас:** `prefetchOn(el, urlFn, { on: 'hover' })` (5927–5948) через 80 мс hover вызывает `prefetch` (5912–5920) для любой ссылки; в списке из 100 строк проход мышью даёт до 100 fetch и 100 entries (~1–2.5 КБ каждая), которые живут 5 мин независимо от того, был ли клик. Единственная защита — saveData/2g → 'tap'.

**Предложение:** Вытеснение из P1 записывает ключ entry, ушедшей с `_v = 0` и без единого `use()` (только prefetch/seed), в bounded ghost-Map (≤ maxEntries ключей, FIFO по вставке, как `_netLog`). `prefetch()` с `intent: 'hover' | 'visible'` пропускает ключи из ghost (тот же ключ уже прогревали и не использовали — вероятность повторного использования оценена по факту низкой); `intent: 'tap'` и явный `prefetch(url)` игнорируют ghost. Это TinyLFU-доступ «по истории» без sketch: одна Map, O(1).

**Алгоритм:**

```js
// Оценка: на SPA-трассе 85.7 % ключей — one-hit; hover-prefetch по списку из k строк при вероятности клика q≈0.1–0.3
// расходует k·(1−q) лишних запросов; ghost отсекает повтор для тех же строк при следующем проходе (списки перерисовываются часто).
const _ghost = new Map();                                // key → 1, FIFO, ≤ _maxEntries
function _cEvictOne(o) {                                 // внутри _cEvict
    if (!o.used) { _ghost.set(o.key, 1); if (_ghost.size > _maxEntries) _ghost.delete(_ghost.keys().next().value); }
    ...
}
// use() в _cachedResource: e.used = true; _ghost.delete(e.key)
export function prefetch(url, opts = {}) {
    const key = opts.key ?? url;
    if (opts.intent && opts.intent !== 'tap' && _ghost.has(key)) return Promise.resolve();   // уже грели впустую
    ...
}
// prefetchOn: fire(t) → prefetch(u, { ...opts, intent: mode })
```

**API:**

```js
prefetchOn(list, a => a.dataset.api, { on: 'hover' })       // без изменений; повторный hover по «мёртвым» строкам не шлёт запрос
prefetch(url, { intent: 'hover' })                             // новая опция; без intent — как сейчас
stats().cache.ghost                                             // размер ghost-списка (dev)
```

**Критерий:** Тест: prefetch 600 ключей при maxEntries=500 без use() → следующие prefetch(…, {intent:'hover'}) по первым 100 ключам не вызывают fetcher (0 вызовов), с intent:'tap' — вызывают; use() ключа удаляет его из ghost. Бенч: ghost-проверка ≤ 50 нс.

**Источники:** Einziger, Friedman, Manes «TinyLFU: A Highly Efficient Cache Admission Policy» (doorkeeper); Megiddo, Modha «ARC» (ghost lists B1/B2); Yang et al. S3-FIFO ghost queue


---

# 📐 staleness-ttl

**Линза:** math / staleness-ttl — пуассоновская модель свежести SWR-кэша (reads λ, changes μ), выбор и адаптация staleTime

**Вывод:** Сегодня свежесть в Aegis — это одно число staleTime (default 0 в _cachedResource, 30000 в prefetch, 0 в _offlineResource), проверяемое в _fetchEntry (aegis_full.js:5819) и loadCached (8071); движок не наблюдает ни частоту обращений λ, ни частоту изменений μ, хотя `_share` (5836) уже бесплатно сообщает «ответ не изменился» (identity сохранена). Математика простая: при SWR стоимость в единицу времени C(T) = c_f/(T+1/λ) + c_s·λ·P_stale(T), где P_stale(T) = 1 − (1−e^(−μT))/(μT) ≈ μT/2, и оптимум T* = sqrt(2k/(λμ)) − 1/λ (k = c_f/c_s). Симуляция (scratchpad/agents/staleness-ttl/sim.mjs) показывает: staleTime=0 стоит в 20–150 раз дороже оптимума, фиксированные 30 с/5 мин промахиваются в разные стороны в разных режимах, а адаптивная оценка μ̂ через identity ответа (цензурированная EWMA) сходится за 3–13 запросов и держит стоимость в пределах 10–35% от оракула; LM-factor и backoff×1.5 хуже в 3–8 раз. Предлагаю семь шагов: наблюдение μ̂/λ̂ на entry + cacheStats()/E038, `staleTime:'auto'` по формуле T*, `maxStale` как бюджет доли устаревших чтений (T = 2p/μ), серверная свежесть из Cache-Control/data-aegis-stale, ETag/304 как удешевление c_f и как идеальный сигнал «не изменилось», вероятностная ревалидация по focus вместо глобального 5-секундного throttle, и адаптивный polling для cached (закрывает пробел «нет polling для cache»). Всё — ~1.2 KB gzip суммарно, без изменения дефолтов (staleTime остаётся 0, но dev-режим подсказывает число).

**Отвергнуто:** 1) LM-factor (RFC 9111 §4.2.2: staleTime = 10% времени с последнего изменения) как основной адаптивный режим — в симуляции стоимость в 3–8 раз выше T* (2066 vs 261 при read 1/10с, change 1/10мин; 10674 vs 1390 в «живом» режиме), потому что игнорирует λ; оставлен только как fallback для 'header' без max-age. 2) Backoff ×1.5 при неизменности / сброс при изменении (как в IMAP-клиентах) — проще, но 908 vs 261 и 4950 vs 1390 в sim.mjs; проигрывает формуле везде, кроме статичных данных. 3) Полный байесовский оценщик μ (Gamma-Poisson сопряжённый prior) — статистически чище, чем цензурированная EWMA, но +~150 B и сходимость почти та же (EWMA: медиана 3–13 запросов); можно вернуться, если появится persist μ̂ между сессиями. 4) Сохранение μ̂/λ̂ в localStorage/IDB между сессиями — упирается в известный пробел «нет persist SWR-кэша»; делать вместе с ним, не отдельно. 5) Детекция «не изменилось» через хэш JSON для share:false — O(n) stringify на каждую ревалидацию; при share:false просто не собирать μ̂ (или включать через ETag/304, где сигнал бесплатный). 6) Смена дефолта staleTime с 0 на 'auto' — меняет число запросов у существующих приложений и семантику тестов (test.html:957 ждёт немедленную ревалидацию); дефолт оставить, подталкивать через E038. 7) Единая «cost-aware» модель для focus + polling + staleTime с одним k — математически красиво, но в API это три разных момента принятия решения; общее — только _staleFor и μ̂ на entry. Попутное наблюдение вне линзы: в _devTrackFetch (5777-5787) блок E035 продублирован дважды подряд (второй без site) — мёртвый код ~100 B.

## 💎 #56 — Наблюдать μ̂ (частоту изменений) и λ̂ (частоту обращений) на CacheEntry + cacheStats() + E038 «staleTime слишком мал»

**Impact:** 4 · **Effort:** S · **Size:** ≈ 250 B gzip (поля entry + 10 строк в _fetchEntry + cacheStats + текст E038; cacheStats tree-shakeable)

**Сейчас:** _cacheEntry (aegis_full.js:5738-5760) хранит только lastFetch. В _fetchEntry успех записывает `e.data.value = _share(prev, next)` (5836) — identity результата уже говорит, изменился ли ответ, но это нигде не используется. stats() (986-996) отдаёт лишь размер _resourceCache; dev-панель (aegis-devtools.js:91) показывает одно число «cache». Dev-предупреждения E029/E030 (_devTrackFetch 5772-5812) ловят дубли и штормы, но не «ревалидации впустую».

**Предложение:** Добавить на entry поля fetches, unchanged, lastChange, lastRead, muHat, lamHat. В _fetchEntry: перед проверкой staleTime (5819) обновлять lamHat по интервалу между обращениями; после _share — обновлять muHat: при изменении — EWMA от 1/(now−lastChange), при неизменности — цензурированное наблюдение (μ ≤ 1/(now−lastChange)) тянет оценку вниз. Экспортировать cacheStats() (tree-shakeable) со списком {key, age, staleTime, fetches, unchanged, muHat, lamHat, suggestedStaleTime}. В dev-режиме E038: если fetches ≥ 10, unchanged/fetches ≥ 0.9 и staleTime·μ̂ < 0.1 — предупредить с конкретным числом (T = 0.1/μ̂ ⇒ P_stale ≈ 5%). Это фундамент для остальных предложений.

**Алгоритм:**

```js
const _ewma = (old, x, a = 0.7) => old ? a * old + (1 - a) * x : x;
// _fetchEntry, до строки 5819:
const now = Date.now();
if (e.lastRead) e.lamHat = _ewma(e.lamHat, 1000 / (now - e.lastRead));   // 1/с
e.lastRead = now;
// после успешного ответа (вместо 5836-5837):
const prev = e.data.peek();
const shared = fopts.share === false ? next : _share(prev, next);
const changed = prev === null || shared !== prev;      // identity == «не изменилось»
e.data.value = shared; e.lastFetch = now; e.fetches++;
if (changed) {
    if (e.lastChange) e.muHat = _ewma(e.muHat, 1000 / (now - e.lastChange));
    e.lastChange = now;
} else {
    e.unchanged++;
    const bound = 1000 / (now - e.lastChange);          // цензура: изменений не было ≥ этого интервала
    if (bound < e.muHat) e.muHat = _ewma(e.muHat, bound);
}
if (_dev() && e.fetches >= 10 && e.unchanged / e.fetches >= 0.9 && (fopts.staleTime || 0) * e.muHat / 1000 < 0.1)
    _warn('E038', { what: `"${e.key}": ${e.unchanged}/${e.fetches} revalidations returned identical data`,
        why: `observed change interval ≈ ${Math.round(1 / e.muHat)} s, staleTime = ${fopts.staleTime || 0} ms`,
        fix: `staleTime: ${Math.round(100 / e.muHat) * 1000} (≈5% stale reads) or staleTime: 'auto'` }, 'stale:' + e.key);

export function cacheStats() {
    const now = Date.now();
    return [..._resourceCache.values()].map(e => ({ key: e.key, age: now - e.lastFetch, refs: e.refCount,
        fetches: e.fetches, unchanged: e.unchanged, muHat: e.muHat, lamHat: e.lamHat,
        staleTime: e.fopts?.staleTime ?? null, suggested: e.muHat ? Math.round(100 / e.muHat) * 1000 : null }));
}
// Симуляция (sim2.mjs, часть c): μ̂ попадает в [μ/2, 2μ] за медианные 13 запросов (p90 26) при μ=1/600с, λ=1/10с;
// за 3 (p90 13) при μ=1/30с; за 135 при μ=1/сутки (там staleTime=5мин ⇒ ~редкие наблюдения).
```

**API:**

```js
import { cacheStats } from './aegis.js';
console.table(cacheStats());
// → [{ key: '/api/stats', age: 4120, fetches: 42, unchanged: 40, muHat: 0.0016, lamHat: 0.1, staleTime: 5000, suggested: 60000 }]

// dev-консоль при staleTime: 5_000 и данных, меняющихся раз в 10 мин (demo/admin.html:94):
// [Aegis E038] "/api/stats": 40/42 revalidations returned identical data … fix: staleTime: 60000 or staleTime: 'auto'

// aegis-devtools.js: вкладка Cache — таблица cacheStats() с колонкой suggested
```

**Критерий:** Тест в test.html: mock-fetcher возвращает одинаковый JSON 12 раз при staleTime 0 → muHat > 0, unchanged === 11, E038 сработал ровно один раз (dedupe по ключу 'stale:'+key); при чередовании изменённых ответов каждые 3 запроса — muHat в пределах ×2 от 1/(3·интервал). В demo/admin.html Dashboard (staleTime 5 с, mock меняет stats редко) E038 появляется в консоли за < 1 мин кликов по вкладкам.

**Источники:** Cho & Garcia-Molina, «Synchronizing a database to improve freshness» (SIGMOD 2000) — пуассоновская модель изменений и оценка μ по наблюдениям «изменилось/нет»; Jacobson/RFC 6298 — EWMA-оценщик; TanStack Query devtools (колонки observers/updatedAt как прецедент вкладки кэша).

## 💎 #57 — staleTime: 'auto' — TTL по формуле T* = sqrt(2k/(λ̂·μ̂)) − 1/λ̂

**Impact:** 5 · **Effort:** M · **Size:** ≈ 150 B gzip (_staleFor + два вызова + типы)

**Сейчас:** staleTime — константа: default 0 в _cachedResource (5962), 30000 в prefetch (5915), 0 в _offlineResource (8043). Проверка `Date.now() − e.lastFetch < fopts.staleTime` (5819) и `< staleTime` (8071). Разработчик подбирает число вслепую; demo/admin.html использует 5_000 и 10_000 без обоснования.

**Предложение:** Принимать staleTime: 'auto' | { auto: true, k?, min?, max? }. Модель: чтения — Poisson(λ), изменения — Poisson(μ); при SWR перезапрос происходит на первом чтении после T, поэтому средний цикл = T + 1/λ, а доля устаревших чтений P_stale(T) = 1 − (1−e^(−μT))/(μT) ≈ μT/2. Стоимость C(T) = c_f/(T+1/λ) + c_s·λ·μT/2; dC/dT = 0 ⇒ T* = sqrt(2k/(λμ)) − 1/λ, k = c_f/c_s (сколько устаревших показов «стоит» один запрос; default 20). Считать T из μ̂/λ̂ entry (предложение 1), clamp в [min=1 с, max=10 мин]; пока наблюдений нет — min. Ту же функцию использовать в _offlineResource (8071) и prefetch.

**Алгоритм:**

```js
// Вывод: C(T) = c_f/(T+1/λ) + c_s·λ·(μT/2)
// C'(T) = −c_f/(T+1/λ)² + c_s·λ·μ/2 = 0  ⇒  (T+1/λ)² = 2c_f/(c_s·λ·μ)  ⇒  T* = sqrt(2k/(λμ)) − 1/λ
function _staleFor(e, st) {                         // st: number | 'auto' | {auto,k,min,max}
    if (typeof st === 'number' || !st) return st || 0;
    const { k = 20, min = 1000, max = 600000 } = st === 'auto' ? {} : st;
    const lam = e.lamHat, mu = e.muHat;             // 1/с
    if (!lam || !mu) return min;                    // нет наблюдений — консервативно
    const T = Math.sqrt(2 * k / (lam * mu)) - 1 / lam;   // секунды
    return Math.min(max, Math.max(min, T * 1000));
}
// _fetchEntry:5819 →
if (!force && Date.now() - e.lastFetch < _staleFor(e, fopts.staleTime)) return Promise.resolve();

// Симуляция sim.mjs (k=20, 200 ч, стоимость/ч = 20·fetches + staleReads):
// режим                       staleTime=0   30s     5min   T*(oracle)  'auto'(μ0=1/60с)
// read 1/10s, change 1/10min    7186      1814     308      261         346
// read 1/60s, change 1/5min     1238       819     224      126         137
// read 1/5s,  change 1/30s     14553      2356     889     1390        1573
// read 1/30s, change 1/day      2364      1195     218       16          28
// 'auto' в 10–35% от оракула во всех режимах; ни одна константа не близка к оптимуму во всех четырёх.
```

**API:**

```js
const stats = resource('/api/stats', { cache: true, staleTime: 'auto' });
const users = resource(() => `/api/users?q=${q.value}`, { cache: true, staleTime: { auto: true, k: 50, min: 2000, max: 120_000 } });
prefetch('/api/users/42', { staleTime: 'auto' });
// aegis.d.ts: CacheOptions.staleTime?: number | 'auto' | { auto: true; k?: number; min?: number; max?: number }
// k — «один запрос стоит как k устаревших показов»; больше k → реже запросы
```

**Критерий:** Тест с fake-timers: mock меняет ответ раз в 60 с, компонент обращается раз в 5 с; после 15 обращений _staleFor(e) ∈ [10 с, 40 с] (T* при k=20: sqrt(2·20/(0.2·1/60)) − 5 ≈ 105 с до clamp — проверить с max=40 с) и число запросов за 10 виртуальных минут ≤ 1/3 от режима staleTime=0. Регресс: staleTime числом — поведение и число запросов байт-в-байт как сейчас.

**Источники:** Cho & Garcia-Molina (SIGMOD 2000) — оптимальная частота обновления при пуассоновских изменениях; Bright & Raschid, «Using latency-recency profiles for data delivery on the web» (VLDB 2002) — компромисс стоимость запроса vs recency; Olston & Widom, «Best-effort cache synchronization» (SIGMOD 2002) — приоритизация обновлений по частоте изменений; RFC 5861 (stale-while-revalidate) — семантика T.

## 💎 #58 — maxStale: бюджет доли устаревших чтений вместо абстрактного k (T = 2p/μ)

**Impact:** 3 · **Effort:** S · **Size:** ≈ 80 B gzip поверх предложения 2 (одна ветка в _staleFor)

**Сейчас:** Единственный способ выразить требование к свежести — миллисекунды staleTime (5962, 8043, d.ts:540/550). Продуктовое требование обычно звучит как «не более 5% пользователей видят старые данные» или «данные меняются раз в ~5 минут», а не как число мс.

**Предложение:** Принимать staleTime: { maxStale: p, changeEvery?: ms }. Из P_stale(T) ≈ μT/2 ⇒ T = 2p/μ (точное решение через бисекцию нужно только при p > 0.15 — расхождение ≤ 15%). μ берётся из changeEvery (сервер/разработчик знает период) либо из μ̂ entry (предложение 1). Это «режим ограничения», дополняющий «режим стоимости» из предложения 2; оба живут в _staleFor.

**Алгоритм:**

```js
// P_stale(T) = 1 − (1−e^(−μT))/(μT) — доля чтений при равномерном возрасте в [0,T], видящих устаревшие данные
// малое μT: P ≈ μT/2 ⇒ T = 2p/μ
function _staleFor(e, st) {
    if (typeof st === 'number' || !st) return st || 0;
    if (st.maxStale != null) {
        const mu = st.changeEvery ? 1000 / st.changeEvery : e.muHat;   // 1/с
        if (!mu) return st.min ?? 1000;
        let T = 2 * st.maxStale / mu;                                   // с
        if (st.maxStale > 0.15) { let lo = 0, hi = T * 2;              // уточнить бисекцией
            for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; (1 - (1 - Math.exp(-mu * m)) / (mu * m)) < st.maxStale ? lo = m : hi = m; }
            T = lo; }
        return Math.min(st.max ?? 600000, Math.max(st.min ?? 1000, T * 1000));
    }
    /* … ветка 'auto' из предложения 2 … */
}
// sim2.mjs (a): μ=1/300с → p=0.01: 6 с; 0.05: 31 с; 0.1: 64 с; 0.2: 139 с (приближение 2p/μ: 6/30/60/120)
//                μ=1/3600с → p=0.05: 373 с; p=0.1: 772 с
```

**API:**

```js
resource('/api/stats', { cache: true, staleTime: { maxStale: 0.05, changeEvery: 600_000 } });   // ≤5% устаревших показов ⇒ T ≈ 60 с
resource('/api/feed', { cache: true, staleTime: { maxStale: 0.02 } });                            // μ из наблюдений, пока их нет — min
// d.ts: staleTime?: number | 'auto' | { maxStale: number; changeEvery?: number; min?: number; max?: number } | { auto: true; … }
```

**Критерий:** Юнит: _staleFor({}, { maxStale: 0.05, changeEvery: 300_000 }) === 31000 ± 1000 (совпадает с бисекцией sim2). Сквозной тест с fake-timers: изменения ответа раз в 300 с, 2000 чтений равномерно → доля чтений с устаревшим значением ≤ 6% при maxStale 0.05 (и ≥ 3%, т.е. не перестраховываемся).

**Источники:** Cohen & Kaplan, «Refreshment policies for web content caches» (INFOCOM 2001) — TTL по целевой вероятности свежести; RFC 9111 §4.2 — freshness lifetime как контракт «допустимая стейлность»; Google SRE «error budget» как аналогия бюджета устаревания.

## 💎 #59 — Свежесть, объявленная сервером: staleTime: 'header' (Cache-Control: max-age / Age) и data-aegis-stale в seedFrom

**Impact:** 4 · **Effort:** M · **Size:** ≈ 250 B gzip (meta в request, ttl в entry, seedFrom атрибут, эвристика Last-Modified)

**Сейчас:** request() (1336-1373) парсит тело и выбрасывает Response; _defaultFetcher (1379-1381) возвращает только данные — заголовки до _fetchEntry не доходят. seedFrom (5889-5906) читает data-aegis-age (возраст), но не «срок годности», поэтому засеянная запись без staleTime у ресурса ревалидируется сразу (test.html:957 подтверждает). Aegis server-first, а единственный, кто действительно знает μ, — сервер.

**Предложение:** В request() принять init.meta (объект) и заполнять его до разбора тела: status, etag, lastModified, maxAge (= max-age − Age, в мс). В _fetchEntry передавать meta и, если fopts.staleTime === 'header', сохранять e.ttl = meta.maxAge (fallback opts.fallback ?? 0; при отсутствии max-age, но наличии Last-Modified — эвристика RFC 9111 §4.2.2: 10% возраста, clamp 24 ч). _staleFor учитывает e.ttl. seedFrom: атрибут data-aegis-stale="30" → seed(key, data, { age, staleTime }) → e.ttl. Так один HTTP-заголовок на сервере задаёт μ-политику для всех клиентов без цифр в JS.

**Алгоритм:**

```js
// request():1358, после doFetch:
if (init.meta) {
    const h = response.headers, cc = h.get('cache-control') || '';
    const m = /max-age=(\d+)/.exec(cc);
    Object.assign(init.meta, { status: response.status, etag: h.get('etag'), lastModified: h.get('last-modified'),
        maxAge: m && !/no-store|no-cache/.test(cc) ? Math.max(0, +m[1] - (+h.get('age') || 0)) * 1000 : null });
}
// _fetchEntry:
const meta = {};
const attempt = () => fetcher(url, { signal: controller.signal, meta });
… после успеха:
if (fopts.staleTime === 'header') {
    e.ttl = meta.maxAge ?? (meta.lastModified ? Math.min(864e5, 0.1 * (Date.now() - Date.parse(meta.lastModified))) : (fopts.fallback ?? 0));
}
// _staleFor: if (st === 'header') return e.ttl ?? 0;
// seed(key, data, { age = 0, staleTime }) { …; if (staleTime != null) e.ttl = staleTime; }
// seedFrom: seed(k, json, { age: +sc.dataset.aegisAge || 0, staleTime: sc.dataset.aegisStale != null ? +sc.dataset.aegisStale * 1000 : undefined })
// Математика: сервер задаёт max-age = T_server; клиентская P_stale = 1 − (1−e^(−μT))/(μT) — сервер, зная μ, выбирает T по
// формуле 2p/μ (предложение 3) один раз для всех клиентов; клиент лишь вычитает Age (данные из CDN уже «старые»).
```

**API:**

```js
// Сервер: Cache-Control: max-age=60, ETag: "abc"; Age: 12  (CDN)
const stats = resource('/api/stats', { cache: true, staleTime: 'header' });  // TTL = 48 с, потом SWR

// SSR:
<script type="application/json" data-aegis-cache="/api/users?page=1" data-aegis-age="5" data-aegis-stale="60">[…]</script>
resource('/api/users?page=1', { cache: true, staleTime: 'header' });         // 0 запросов 55 с после загрузки

// Свой fetcher совместим: meta — необязательный объект в opts, можно игнорировать
// d.ts: RequestInit.meta?: ResponseMeta; seed(key, data, { age?, staleTime? })
```

**Критерий:** Тест с _config.fetch-моком: Response с `Cache-Control: max-age=30, Age: 10` → второй resource(...,'header') через 15 с не делает запрос, через 25 с — делает. seedFrom с data-aegis-stale="60" → r.data сразу из seed и fetches === 0 (сейчас в test.html:957 fetches2 === 1). Отсутствие заголовка → поведение как staleTime: fallback (0).

**Источники:** RFC 9111 §4.2.1 (freshness_lifetime), §4.2.3 (current_age с Age), §4.2.2 (heuristic freshness 10% от Last-Modified); RFC 5861 stale-while-revalidate; SWR (vercel/swr) и TanStack Query не читают max-age — здесь Aegis как server-first движок выигрывает.

## 💎 #60 — ETag / If-None-Match / 304 в _fetchEntry: удешевить c_f и получить точный сигнал «не изменилось»

**Impact:** 4 · **Effort:** M · **Size:** ≈ 200 B gzip (сентинел, заголовок, ветка 304, поле etag; offline +40 B)

**Сейчас:** Известный пробел: ETag нигде не используется (grep по aegis_full.js пуст). Каждая ревалидация _fetchEntry (5814-5849) качает полное тело; «не изменилось» определяется только после JSON.parse + _share по всему дереву (O(n)). Браузерный HTTP-кэш делает условные запросы сам только при наличии валидных Cache-Control и прозрачно превращает 304 в 200 — JS не узнаёт, что ответ старый.

**Предложение:** Хранить e.etag (из meta предложения 4). В _fetchEntry при наличии etag посылать If-None-Match; request() при init.meta и статусе 304 возвращать сентинел NOT_MODIFIED вместо разбора/HttpError. На сентинел: e.lastFetch = now, data не трогать, засчитать «unchanged» в μ̂ без парсинга. Математический эффект: c_f = c_rtt + c_bytes·P(changed) — для 50-KB JSON стоимость байтов падает в ~100 раз, поэтому k уменьшается и T* = sqrt(2k/(λμ)) сжимается пропорционально sqrt(k): ETag и адаптивный TTL не конкурируют, а дополняют друг друга (с ETag можно позволить staleTime вдвое-вчетверо меньше при той же стоимости). Для offline (_offlineResource, 8078-8095) — хранить etag в IDB рядом с timestamp.

**Алгоритм:**

```js
const NOT_MODIFIED = Symbol('304');
// request(): после doFetch
if (init.meta && response.status === 304) return NOT_MODIFIED;
// _fetchEntry:
const meta = {};
const headers = e.etag ? { 'If-None-Match': e.etag } : undefined;
const attempt = () => fetcher(url, { signal: controller.signal, meta, headers, cache: e.etag ? 'no-cache' : undefined });
… try {
    const result = await withRetry(attempt, …);
    if (controller.signal.aborted) return;
    const now = Date.now();
    if (result === NOT_MODIFIED) { e.lastFetch = now; _observe(e, false, now); }        // μ̂: цензура, парсинг не нужен
    else {
        const next = fopts.transform ? fopts.transform(result) : result;
        const prev = e.data.peek(), shared = fopts.share === false ? next : _share(prev, next);
        e.data.value = shared; e.lastFetch = now; e.etag = meta.etag || null;
        _observe(e, prev === null || shared !== prev, now);
    }
}
// Стоимость: c_f(304) ≈ c_rtt; c_f(200) ≈ c_rtt + c_bytes. Ожидаемая c_f = c_rtt + c_bytes·(1−e^(−μT)).
// Пример: RTT-эквивалент 5 «устаревших показов», байты 50-KB JSON — 50; при μT=0.1: c_f = 5 + 50·0.095 ≈ 9.8 вместо 55 ⇒ k падает в 5.6 раза,
// T* — в sqrt(5.6) ≈ 2.4 раза: та же стоимость при в 2.4 раза более свежих данных.
```

**API:**

```js
// Никакого нового API: работает автоматически, если сервер отдаёт ETag.
const users = resource('/api/users?page=1', { cache: true, staleTime: 5000 });   // ревалидации → 304, тело не качается
// cacheStats() показывает { notModified: 37, fetches: 40 }
// Отключить: resource(url, { cache: { etag: false } })
// Offline: store.set(url, { data, timestamp, etag })
```

**Критерий:** Тест с _config.fetch-моком: первый ответ 200 + ETag "v1"; последующие запросы содержат If-None-Match: "v1" и получают 304 → r.data identity не меняется, e.lastFetch обновлён, fetcher вызван, но JSON.parse — нет (мок считает вызовы .json()). Бенч в bench.html: 100 ревалидаций 50-KB JSON: байты по сети ↓ ≥ 95%, время до validating=false ↓ ≥ 50% (нет парсинга). При смене ETag на "v2" — 200, данные обновились.

**Источники:** RFC 9110 §13.1.2 (If-None-Match), §15.4.5 (304); RFC 9111 §4.3 (validation); Fetch Standard cache mode 'no-cache' (принудительная ревалидация); axios-etag-cache / apollo-link-http как прецеденты явного If-None-Match из JS.

## 💎 #61 — Вероятностная ревалидация по focus/reconnect: P(changed | age) = 1 − e^(−μ̂·age) ≥ p вместо глобального 5-секундного throttle + джиттер против «стада»

**Impact:** 3 · **Effort:** S · **Size:** ≈ 120 B gzip

**Сейчас:** _installRevalidate (5851-5866): один listener, при focus — глобальный throttle 5 с (5857), затем цикл по ВСЕМ активным entry и синхронный _fetchEntry для каждой (5858-5860). Единственный фильтр — staleTime внутри _fetchEntry; при default staleTime=0 каждое переключение вкладки запускает N запросов в один кадр (в demo/admin.html: /api/stats + /api/users одновременно). Аналогично в _plainResource refetch.focus (3667) через throttled(tick, 5000).

**Предложение:** Для каждой entry считать вероятность, что данные изменились с момента lastFetch: p = 1 − exp(−μ̂·age); ревалидировать только если p ≥ focusThreshold (default 0.2); без μ̂ — как сейчас (p = 1). Разнести запуски джиттером 0–300 мс (setTimeout со случайной задержкой), чтобы N ресурсов не били в сервер одним кадром. Глобальный 5-секундный throttle заменить на per-entry: age < 1 с ⇒ пропустить. Тот же гейт применить в _plainResource для refetch.focus (там μ̂ нет — оставить throttle).

**Алгоритм:**

```js
// _installRevalidate tick(reason):
const now = Date.now();
for (const e of _resourceCache.values()) {
    if (!(e.refCount > 0 && e.url && e.fopts && e.revalidateOn?.includes(reason))) continue;
    const age = (now - e.lastFetch) / 1000;
    if (age < 1) continue;                                          // per-entry вместо глобального 5 с
    const pChanged = e.muHat ? 1 - Math.exp(-e.muHat * age) : 1;    // Poisson: P(≥1 изменение за age)
    if (pChanged < (e.fopts.focusThreshold ?? 0.2)) continue;
    setTimeout(() => { if (e.refCount > 0) _fetchEntry(e, e.url, e.fopts); }, Math.random() * 300);   // jitter
}
// Числа: μ=1/600 с (данные меняются раз в 10 мин)
//   age 30 с  → P = 4.9 %  → пропуск
//   age 2 мин → P = 18 %   → пропуск при 0.2
//   age 5 мин → P = 39 %   → запрос
// μ=1/30 с: age 10 с → P = 28 % → запрос (живые данные ревалидируются как сейчас)
// Ожидаемая экономия: при частых переключениях вкладок (интервал τ) доля пропущенных ревалидаций = 1 при τ < −ln(1−p)/μ ⇒ для p=0.2, μ=1/600: τ < 134 с.
```

**API:**

```js
resource('/api/stats', { cache: true, revalidateOn: ['focus', 'reconnect'], focusThreshold: 0.2 });  // default
resource('/api/live', { cache: true, focusThreshold: 0 });   // как сейчас: всегда (staleTime всё ещё уважается)
// d.ts: CacheOptions.focusThreshold?: number  // 0..1, вероятность изменения, с которой стоит перезапросить
```

**Критерий:** Тест: 20 cached-ресурсов с μ̂ = 1/600 (задать через seed + принудительные наблюдения или напрямую e.muHat в тесте) и age 30 с; dispatch 'visibilitychange' → 0 запросов (сейчас: 20). Те же 20 с age 600 с → 20 запросов, распределённых по ≥ 3 разным макрозадачам (не один кадр). Ресурс без μ̂ — поведение как сейчас (регресс test.html revalidateOn-тесты зелёный).

**Источники:** Пуассоновская вероятность события за интервал; RFC 9111 §4.2.4 (serving stale) как обоснование «не всегда ревалидировать»; jitter — AWS Architecture Blog «Exponential Backoff and Jitter» (thundering herd); TanStack Query refetchOnWindowFocus + staleTime как текущий индустриальный стандарт (без вероятностного гейта).

## 💎 #62 — Адаптивный polling для cached-ресурсов: refetch.interval: 'auto' с интервалом sqrt(2k/μ̂)

**Impact:** 4 · **Effort:** M · **Size:** ≈ 150 B gzip (ветка в _cachedResource + 1 строка в poll)

**Сейчас:** refetch.interval поддержан только в _plainResource (3669: poll(() => refresh(), refetch.interval)); в _cachedResource (5952-6047) опции refetch нет вовсе — известный пробел «нет polling для cached». poll() (1515-1530) принимает только фиксированное ms. При фиксированном интервале разработчик снова выбирает число вслепую: 5 с сжигает 720 запросов/ч даже когда данные не меняются часами.

**Предложение:** Добавить в _cachedResource опцию refetch: { interval: number | 'auto', k?, min?, max?, background? } поверх общего poll(); научить poll() принимать ms как функцию (пересчёт перед каждым сном). Для 'auto' интервал — оптимум задачи «опрос без чтений»: стоимость = c_f·(1/T) + c_s·(ожидаемая стейлность ≈ μT/2 секунд на цикл) ⇒ T_poll* = sqrt(2k/μ̂). μ̂ приходит из наблюдений entry (предложение 1; каждый poll — наблюдение, поэтому оценка сходится быстро). При смене данных интервал сжимается автоматически, при затишье — растёт до max. В фоне вкладки poll() уже спит.

**Алгоритм:**

```js
// poll(): 1528 →  await new Promise(r => setTimeout(r, typeof ms === 'function' ? ms() : ms));
// _cachedResource, после установки current:
if (refetch?.interval) {
    const { k = 20, min = 2000, max = 300000 } = refetch;
    const next = () => {
        if (refetch.interval !== 'auto') return refetch.interval;
        const e = current.peek();
        if (!e || !e.muHat) return min;
        return Math.min(max, Math.max(min, Math.sqrt(2 * k / e.muHat) * 1000));   // T_poll* = sqrt(2k/μ)
    };
    poll(() => { const e = current.peek(); if (e && !e.promise) return _fetchEntry(e, e.url, e.fopts, true); }, next, { background: refetch.background });
}
// Вывод: C(T) = c_f/T + c_s·μT/2 (среднее время устаревания за цикл ≈ μT²/2, делённое на T);
// C'(T) = −c_f/T² + c_s·μ/2 = 0 ⇒ T* = sqrt(2c_f/(c_s·μ)).
// sim2.mjs (b), k=20, стоимость/ч = 20·polls + секунды устаревания:
//   μ=1/30с:  5 с → 720 polls/ч, 14683;  30 с → 120, 3734;  T*=35 с → 104, 3543;  auto → 77, 3310
//   μ=1/600с: 5 с → 720, 14415;         30 с → 120, 2487;  T*=155 с → 23, 900;   auto → 23, 915
// auto без знания μ выходит на оракул (±2%) за первые минуты.
```

**API:**

```js
const stats = resource('/api/stats', { cache: true, refetch: { interval: 'auto', min: 3000, max: 120_000 } });
const live  = resource('/api/ticker', { cache: true, refetch: { interval: 2000 } });        // фиксированный, как в plain
// d.ts: CacheOptions.refetch?: { interval?: number | 'auto'; k?: number; min?: number; max?: number; background?: boolean }
// cacheStats() показывает текущий интервал: { key, pollInterval: 41000 }
```

**Критерий:** Тест с fake-timers: mock меняет ответ раз в 60 с виртуального времени; refetch.interval 'auto' (min 2 с, k 20) — за 30 виртуальных минут ≤ 60 запросов (фикс 2 с дал бы 900), и каждое изменение замечено не позже чем через 2·sqrt(2·20·60) ≈ 98 с. Регресс: interval числом для cached ведёт себя как для plain (тест из test.html для refetch.interval, продублированный с cache:true).

**Источники:** Cho & Garcia-Molina (SIGMOD 2000) — оптимальная частота опроса при пуассоновских изменениях (та же формула для crawler'а); Olston & Widom (SIGMOD 2002); IMAP IDLE / Gmail backoff-polling как практический прецедент адаптивного интервала; TanStack Query refetchInterval как функция от данных (прецедент interval-как-функции).


---

# 📐 prefetch-prediction-math

**Линза:** math / prefetch-prediction-math

**Вывод:** Весь prefetch в Aegis сегодня — «по намерению» без вероятности и без стоимости: prefetch() (aegis_full.js:5912–5920) стреляет безусловно, prefetchOn() (5928–5952) ждёт фиксированные 80 мс, router preload (7531–7554) и boost prefetch (8410–8416) греют всё, на что навели, island warm (3304, 3344) — всё, что в 400px. Нет ни модели переходов, ни учёта исхода (использован ли прогрев), ни бюджета сети. Симуляция на синтетических пользователях (только своя история, как в браузере) показала: марковская цепь первого порядка по паттернам маршрутов даёт top-1 27% против 17% случайного выбора из 6 ссылок (потолок 48%), а серверный prior из агрегированных логов — 39–42% с первой сессии; второй порядок и подбор decay не дают ничего (данных мало). Адаптивная задержка hover по онлайн-гистограммам dwell держится в пределах 0.2–1.4 мс/hover от оракула во всех 12 режимах, тогда как фиксированные 80 мс теряют до 22–30 мс/hover. Главное: нужна не «умная нейросеть», а три дешёвых механики — счётчики переходов с забыванием (+prior от сервера), порог полезности p×E[выигрыш] > cost с бюджетом, и учёт исхода прогрева для калибровки и dev-предупреждения.

**Отвергнуто:** 1) Марковская цепь 2-го порядка / PPM / LZ-предикторы: в симуляции markov2 backoff = 27.3% = markov1 — на клиентских данных одного пользователя (десятки переходов) контекст длиннее 1 не набирает статистики; только размер. 2) Подбор decay (0.9 vs 0.95 vs 1.0): разница 0.7 п.п. — данных мало, дрейф компенсируется серверным prior, а не забыванием; оставить константу. 3) Нейросетевые/эмбеддинг-модели переходов (как в Chrome NavigationPredictor ML): противоречит бюджету 61 KB gzip и zero-build; выигрыш относительно счётчиков на малых данных не доказан. 4) Прогрев целых страниц (prerender) для boost через собственный код: это уже делает браузер через Speculation Rules API (<script type=speculationrules>) с eagerness и своим бюджетом — Aegis должен только генерировать/дополнять правила из предиктора, а не дублировать prerender; ценность Aegis — в данных для островов и loader'ов роутера. 5) Глобальное обучение «по всем пользователям» на клиенте (шаринг модели через сервер): требует бэкенда и поднимает приватность; серверный prior из логов даёт тот же эффект server-first и без утечки истории клиента. 6) Prefetch по «visible» с предиктором для island warm (3344): rootMargin 400px уже дёшев и точен (пользователь почти наверняка доскроллит); добавлять туда вероятность — усложнение без выигрыша, достаточно общего бюджета из token-bucket. 7) Персональный prefetch-предиктор, хранящий полные URL (с id): взрыв ключей и нулевая переносимость между сущностями; только паттерны маршрутов + инстанцирование ссылками из DOM.

## 💎 #63 — predictor(): марковская цепь первого порядка по паттернам маршрутов с забыванием и persist

**Impact:** 3 · **Effort:** M · **Size:** +0.7–0.9 KB gzip (модель + persist + подписка на router/boost); tree-shakeable, ноль если не импортирован

**Сейчас:** Нет никакой модели переходов. router() знает паттерн текущего маршрута (resolve() → node.pattern, aegis_full.js:7223–7231) и сигнал route (7219), boost() шлёт aegis:visit/aegis:load (8361, 8375), но никто не запоминает «откуда → куда». prefetchOn (5928) и router preload (7531–7554) греют всё подряд без ранжирования.

**Предложение:** Добавить в секцию 24 (рядом с prefetch) модуль-предиктор: counts[from][to] по ключам-паттернам (для router — node.pattern; для boost/MPA — pathname с нормализацией числовых/hex сегментов в ':id'), экспоненциальное забывание (row *= decay перед инкрементом), Лапласово сглаживание, persist в localStorage 'aegis:predict' (JSON ≈1–2 KB, запись debounce 1 с). Обучение подписывается на route-сигнал роутера и на aegis:load от boost — один раз на страницу, opt-in. Симуляция (sim-markov.mjs, 300 пользователей × 6 сессий, 12 паттернов, 6 ссылок/страница, дрейф структуры сайта после 3-й сессии): top-1 27.3% / top-2 44.6% против uniform 16.7% / 33.0%, popularity 20.8%; рост по сессиям 21.7% → 31.1%; oracle (истинная матрица) 48.4%.

**Алгоритм:**

```js
const R = new Map(); // from → Map(to → weight)
const DECAY = 0.95, ALPHA = 0.5;
const keyOf = (path) => path.replace(/\/(\d+|[0-9a-f]{8,})(?=\/|$)/g, '/:id'); // MPA без паттернов
function learn(from, to) {
  let row = R.get(from); if (!row) R.set(from, row = new Map());
  for (const [k, w] of row) row.set(k, w * DECAY);   // забывание: старые переходы теряют вес
  row.set(to, (row.get(to) || 0) + 1);
  if (row.size > 16) row.delete([...row].sort((a, b) => a[1] - b[1])[0][0]); // ограничить строку
  save();                                              // debounce → localStorage['aegis:predict']
}
function predict(from, candidates) {  // candidates: паттерны ссылок на текущей странице
  const row = R.get(from) || new Map();
  let Z = ALPHA * candidates.length; for (const c of candidates) Z += row.get(c) || 0;
  return candidates.map(c => ({ key: c, p: ((row.get(c) || 0) + ALPHA) / Z })).sort((a, b) => b.p - a.p);
}
// Симуляция (sim-markov.mjs):
// model               top1   top2 | s1    s2    s3    s4    s5    s6
// uniform             16.7%  33.0% | 16.4  16.2  16.8  17.2  16.9  16.8
// popularity          20.8%  38.6%
// markov1 no-decay    26.6%  44.4% | 21.5  25.8  29.2  25.9  27.2  30.0
// markov1 decay=0.95  27.3%  44.6% | 21.7  25.5  30.4  26.5  28.4  31.1
// markov2 backoff     27.3%  44.6%   (второй порядок — ноль прироста: данных на пользователя мало)
// oracle              48.4%  69.4%
```

**API:**

```js
import { predictor } from './aegis.js';
const pred = predictor({ decay: 0.95, storage: localStorage, key: 'aegis:predict' });
// автообучение: из роутера или boost
const r = router(routes, { predictor: pred });          // learn(prevPattern, pattern) на каждом переходе
boost({ predictor: pred });                              // learn(keyOf(from), keyOf(to)) на aegis:load
// запрос: ранжировать ссылки текущей страницы
pred.next(r.route.peek(), [...document.querySelectorAll('main a[href]')].map(a => a.pathname));
// → [{ key: '/users/:id', p: 0.42 }, { key: '/reports', p: 0.21 }, …]
pred.learn(from, to); pred.reset();
```

**Критерий:** На sim-markov.mjs (node, без зависимостей): top-1 предиктора ≥ uniform + 8 п.п. (сейчас 27.3% vs 16.7%) и монотонный рост между сессиями 1 и 3 (21.7% → 30.4%). Unit-тест в test.html: после 3 переходов A→B, 1 перехода A→C next('A', ['B','C','D']) возвращает B первым с p > 0.5; после reset() — равномерно. localStorage-запись ≤ 2 KB на 20 паттернах.

**Источники:** Guess.js (Google, марковские переходы из Analytics для prefetch), Padmanabhan & Mogul 1996 «Using predictive prefetching to improve WWW latency», PPM/Markov predictors в Chrome NavigationPredictor

## 💎 #64 — Серверный prior для предиктора: data-aegis-predict в HTML как pseudo-counts

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip поверх predictor (парсинг в seedFrom + одно слагаемое в predict)

**Сейчас:** seedFrom() (aegis_full.js:5889–5909) уже умеет читать серверные данные из <script type=application/json data-aegis-cache> и hydrate() вызывает её сама. Аналога для модели переходов нет — клиентская модель стартует с нуля (в симуляции первая сессия — 21.7%, почти как случайный выбор).

**Предложение:** Сервер (у него есть логи всех пользователей) отдаёт агрегированную матрицу переходов текущей страницы одной строкой: <script type="application/json" data-aegis-predict="/users/:id">{"/users/:id/orders":0.5,"/users":0.3}</script>. Клиент смешивает её как Дирихле-prior с весом κ (pseudo-counts): p(to) = (n_user(to) + κ·prior(to)) / (n_user + κ). Симуляция: prior из глобальной матрицы даёт 39–42% top-1 с первой сессии (против 21.7% cold-start); после дрейфа сайта устаревший prior с κ=20 проваливается до 18–20%, с κ=5 восстанавливается до 26% — значит κ должен быть маленьким (≈5), а prior — переопределяться сервером на каждой странице (он server-first, всегда свежий).

**Алгоритм:**

```js
// в seedFrom(): дополнительно
for (const sc of root.querySelectorAll('script[type="application/json"][data-aegis-predict]:not([data-aegis-seeded])')) {
  sc.dataset.aegisSeeded = '1';
  _predPrior.set(sc.dataset.aegisPredict, JSON.parse(sc.textContent)); // from → {to: p}
}
// в predict(from, candidates): κ = opts.kappa ?? 5
const prior = _predPrior.get(from) || {};
let n = 0; for (const w of row.values()) n += w;
const score = (c) => ((row.get(c) || 0) + KAPPA * (prior[c] || 0) + ALPHA) / (n + KAPPA + ALPHA * candidates.length);
// Симуляция (sim-markov.mjs): top1 по сессиям, дрейф после s3, prior НЕ обновлён
// server prior κ=5    31.6% | 39.1 39.4 41.8 | 21.0 22.6 26.1
// server prior κ=20   29.6% | 39.4 39.0 42.5 | 18.1 18.0 20.5   ← тяжёлый prior мешает переучиться
// markov1 (без prior) 27.3% | 21.7 25.5 30.4 | 26.5 28.4 31.1
// oracle              48.4%
// Сервер считает prior простым SQL: SELECT to_pattern, count(*) FROM transitions WHERE from_pattern=? GROUP BY 1
```

**API:**

```js
<!-- сервер, рядом с data-aegis-cache -->
<script type="application/json" data-aegis-predict="/users/:id">{"/users/:id/orders":0.52,"/users":0.31,"/reports":0.09}</script>

// клиент
const pred = predictor({ kappa: 5 });   // prior подхватывается hydrate() → seedFrom()
pred.prior('/users/:id', { '/users/:id/orders': 0.52 }); // или вручную (SPA-роутер после loader)
// d.ts: predictor(opts?: { decay?: number; kappa?: number; storage?: Storage | null; key?: string })
```

**Критерий:** sim-markov.mjs: с prior top-1 в сессии 1 ≥ 35% (сейчас 39.1%) при κ=5; после дрейфа с несвежим prior κ=5 обгоняет κ=20 минимум на 4 п.п. (26.1 vs 20.5). Тест seedFrom: скрипт с data-aegis-predict помечается data-aegis-seeded и next() учитывает prior при пустой истории (первый кандидат — с максимальным prior).

**Источники:** Guess.js / guess-webpack (prefetch по данным Google Analytics), Dirichlet-multinomial smoothing (Zhai & Lafferty 2001, Bayesian smoothing в LM), Speculation Rules API (сервер задаёт кандидатов в HTML — тот же server-first паттерн)

## 💎 #65 — Порог полезности: prefetch только если p × E[сэкономленная латентность] > cost(сеть)

**Impact:** 4 · **Effort:** M · **Size:** +0.3–0.4 KB gzip (замер rtt/bytes + _utility + опция p)

**Сейчас:** prefetch() (aegis_full.js:5912–5920) стреляет всегда; единственная адаптация к сети — prefetchOn переключает hover→tap при saveData/2g (5929–5930). Время ответа нигде не измеряется (в _fetchEntry 5814–5849 есть только lastFetch), размер ответа не известен, поэтому нельзя оценить ни выигрыш, ни стоимость. Из симуляции: top-2 без порога даёт precision 22% при 2 req/nav, порог p ≥ 0.3 — precision 34% при 0.58 req/nav.

**Предложение:** В _fetchEntry замерять длительность запроса и класть в entry EMA e.rtt (α=0.3); размер брать из performance.getEntriesByName(url) → transferSize (Resource Timing, доступно для same-origin) в e.bytes. Ввести функцию полезности U = p·min(rtt, horizon) − cost, где cost = bytes/downlink(мс на передачу, navigator.connection.downlink Мбит/с, fallback 5) + fixedCost (10 мс; ×4 при effectiveType 3g, бесконечность при saveData). prefetch(url, { p }) и predictor-driven вызовы стреляют только при U > 0; для неизвестного url (нет rtt/bytes) — дефолты rtt=200 мс, bytes=8 KB. Cost/benefit публично настраиваемы через configure({ prefetch: { minUtility, fixedCost } }).

**Алгоритм:**

```js
// в _fetchEntry: const t0 = performance.now(); … после ответа:
e.rtt = e.rtt ? 0.7 * e.rtt + 0.3 * (performance.now() - t0) : performance.now() - t0;
const pe = performance.getEntriesByName(url).at(-1); if (pe?.transferSize) e.bytes = pe.transferSize;

function _utility(e, p, horizon = 1500) {
  const conn = navigator.connection || {};
  if (conn.saveData) return -Infinity;
  const downlink = conn.downlink || 5;                // Мбит/с
  const bytes = e.bytes || 8192, rtt = e.rtt || 200;
  const xferMs = bytes * 8 / (downlink * 1000);       // мс на передачу
  const fixed = /3g/.test(conn.effectiveType || '') ? 40 : 10;
  return p * Math.min(rtt, horizon) - (xferMs + fixed);
}
// prefetch(url, { p = 1 }): if (_utility(e, p) <= (_config.prefetch?.minUtility ?? 0)) return Promise.resolve();
// Симуляция (sim-markov.mjs, markov1 decay=0.95) — политика по порогу p vs top-k:
// thr p≥0.2  precision 29.3%  recall 28.7%  req/nav 0.98
// thr p≥0.3  precision 34.3%  recall 20.0%  req/nav 0.58
// thr p≥0.4  precision 40.8%  recall  6.7%  req/nav 0.16
// top1       precision 27.3%  recall 27.3%  req/nav 1.00
// top2       precision 22.3%  recall 44.6%  req/nav 2.00
// hover-only precision 49.9%  recall 100%   req/nav 2.00  (но выигрыш ограничен dwell, а не rtt)
// порог U>0 ≡ p > cost/rtt: при rtt=200, cost=25 → p*>0.125; при 3g cost≈90 → p*>0.45
```

**API:**

```js
configure({ prefetch: { minUtility: 0, fixedCost: 10, horizon: 1500 } });
prefetch('/api/users/42', { p: 0.42 });        // тихо пропущен, если p·rtt < cost
prefetchOn(list, a => a.dataset.api, { on: 'hover', p: a => pred.p(a.pathname) });
// диагностика (dev):
stats().prefetch  // { fired, skipped, used, wasted, bytes }
// d.ts: prefetch(url, opts?: { …; p?: number }): Promise<void>
```

**Критерий:** Unit-тест с fake fetcher (длительность 300 мс, navigator.connection замокан {downlink: 0.4, effectiveType: '3g'}): prefetch(url, {p: 0.2}) не делает запрос, {p: 0.8} — делает; при saveData — никогда. На sim-markov.mjs порог U>0 с cost/rtt=0.3 даёт precision ≥ 34% при ≤ 0.6 req/nav (top-2 без порога: 22% при 2.0). Замер: e.rtt появляется после первого ответа и сходится к длительности fetcher (EMA) в ≤ 5 вызовах.

**Источники:** Network Information API (downlink, effectiveType, saveData), Resource Timing (transferSize), quicklink (throttle/limit/ignores по connection), Chrome Speculation Rules «eagerness» как дискретная версия того же порога, cost-benefit prefetching (Cao, Felten, Karlin, Li 1995 «Integrated prefetching and caching»)

## 💎 #66 — Адаптивная задержка hover-intent вместо фиксированных 80 мс (онлайн-гистограммы dwell)

**Impact:** 3 · **Effort:** S · **Size:** +0.35 KB gzip (гистограммы + choose + определение исхода hover)

**Сейчас:** prefetchOn (aegis_full.js:5945): setTimeout(() => fire(t), 80) — одна константа на все сайты, устройства и типы ссылок. Никакой обратной связи «привёл ли hover к клику» нет. Симуляция (sim-hover2.mjs, lognormal dwell: клик медиана 260 мс/σ 0.55, проходной hover 110 мс/σ 0.9): при дешёвых запросах (cost 10 мс, click-rate 0.35) 80 мс теряют 11 мс/hover против d=0 (50.5 vs 61.9), при дорогих (cost 80 мс, click-rate 0.1) — 30 мс/hover (−30.9 vs −0.5), т.е. лучше вообще не греть.

**Предложение:** Хранить две затухающие гистограммы dwell (12 логарифмических бинов: 0,40,65,80,100,130,170,220,300,400,550,750,1000 мс) — «hover закончился кликом» и «не закончился». Клик определяется по pointerdown/click на той же цели в течение 100 мс после pointerout. Раз в 50 hover пересчитывать d* = argmax_d Σ_bins [hC(b)·min(rtt, mid(b)−d) − hN(b)·cost] по сетке бинов. Использовать d* вместо 80 в prefetchOn (и в router preload 7548–7551, где задержки вообще нет). Хранить гистограммы в sessionStorage — ≈ 100 байт. rtt и cost — из предложения о полезности (fallback rtt=220, cost=40).

**Алгоритм:**

```js
const BINS = [0,40,65,80,100,130,170,220,300,400,550,750,1000], DECAY = 0.999;
const hC = new Float32Array(13), hN = new Float32Array(13);
let dStar = 80, n = 0;
function observe(dwellMs, clicked) {
  for (let i = 0; i < 13; i++) { hC[i] *= DECAY; hN[i] *= DECAY; }
  let b = 0; while (b < 12 && BINS[b + 1] <= dwellMs) b++;
  (clicked ? hC : hN)[b]++;
  if (++n % 50 === 0) dStar = choose();
}
function choose(rtt = 220, cost = 40) {
  let best = -Infinity, bd = 80;
  for (const d of BINS) { let u = 0;
    for (let i = 0; i < 13; i++) { const mid = i < 12 ? (BINS[i] + BINS[i + 1]) / 2 : 1300; if (mid < d) continue;
      u += hC[i] * Math.min(rtt, mid - d) - hN[i] * cost; }
    if (u > best) { best = u; bd = d; } }
  return bd;
}
// Симуляция sim-hover2.mjs (utility = мс латентности/hover минус цена лишних запросов, RTT=220):
// click=0.10 cost=40 | d=80: -7.8  | adaptive d*=300: -0.3 | oracle d=260: -0.0
// click=0.10 cost=80 | d=80: -30.9 | adaptive d*=1000: -0.5 | oracle d=600: -1.4
// click=0.18 cost=40 | d=80:  6.9  | adaptive d*=130:  8.5 | oracle d=140:  8.6
// click=0.35 cost=10 | d=80: 50.5  | adaptive d*=0:   61.9 | oracle d=0:   61.9
// click=0.35 cost=80 | d=80: 21.3  | adaptive d*=100: 22.0 | oracle d=110: 22.4
// click=0.60 cost=10 | d=80: 91.6  | adaptive d*=0:  113.6 | oracle d=0:  113.6
// адаптивный порог в пределах 0.2–1.4 мс/hover от оракула во всех 12 режимах
```

**API:**

```js
prefetchOn(list, a => a.dataset.api, { on: 'hover', delay: 'auto' });   // по умолчанию 'auto'; число — как раньше
router(routes, { preload: 'hover', preloadDelay: 'auto' });
configure({ prefetch: { hoverDelay: 'auto' | 80 } });
// dev: stats().prefetch.hoverDelay → текущий d*, stats().prefetch.hoverClickRate
```

**Критерий:** sim-hover2.mjs: |U(adaptive) − U(oracle)| ≤ 2 мс/hover во всех 12 режимах (сейчас max 1.4), и U(adaptive) ≥ U(d=80) везде. Unit-тест с fake timers: 200 синтетических hover (клики с dwell 300 мс, проходные 60 мс, cost 40) → d* ∈ [100, 220]; 200 hover при всех кликах на 30 мс → d* = 0. Размер сохранённого состояния ≤ 200 байт.

**Источники:** instant.page (65 мс, «mousedown» режим — та же дилемма), Guess.js/quicklink (без задержки), Fitts/Hick-модели наведения, empirical Bayes / survival analysis по dwell-time (hazard of click given hover duration)

## 💎 #67 — Идл-предвыборка следующего маршрута по предиктору с token-bucket бюджетом и abort при реальной навигации

**Impact:** 4 · **Effort:** M · **Size:** +0.5 KB gzip (idle-хук в router/boost + bucket + abort)

**Сейчас:** router preload (aegis_full.js:7531–7554) и boost prefetch (8410–8416) реагируют только на hover/visible; после завершения перехода никто ничего не греет в простое. У cache-entry есть controller (5748), но prefetch-запросы не помечены и не отменяются, когда пользователь реально перешёл и полоса нужна под настоящий loader. Бюджета нет: prefetchOn на списке из 50 ссылок при быстром движении мыши может выпустить десятки запросов (throttle только 80 мс).

**Предложение:** После установления маршрута (route изменился / aegis:load) в requestIdleCallback: собрать ссылки outlet'а, ранжировать предиктором, взять top-k (k=2) с p ≥ minP и U > 0, вызвать для router node.preload(params) + _resolveHandler (код), для boost — fetchPage(url), для ссылок с data-api — prefetch(). Ограничить token-bucket: ёмкость B=4 запроса/ 200 KB, пополнение r = 1 запрос/с (×downlink/5); все prefetch (включая hover) списывают токены, при пустом ведре — пропуск (dev-счётчик skipped). При начале реальной навигации (router pending=true, boost pending=true) — abort всех e.controller у entries с e.prefetched && refCount===0 (полоса под loader).

**Алгоритм:**

```js
const bucket = { tokens: 4, cap: 4, rate: 1, last: performance.now(), bytes: 0 };
function take() {
  const now = performance.now(), dl = (navigator.connection?.downlink || 5) / 5;
  bucket.tokens = Math.min(bucket.cap, bucket.tokens + (now - bucket.last) / 1000 * bucket.rate * dl); bucket.last = now;
  if (bucket.tokens < 1) return false; bucket.tokens--; return true;
}
function idleWarm(fromPattern, links) {   // links: [{ pattern, params, url }]
  const ranked = pred.next(fromPattern, links.map(l => l.pattern));
  let k = 0;
  for (const { key, p } of ranked) {
    if (k >= TOPK || p < MIN_P) break;
    const l = links.find(x => x.pattern === key);
    const e = _cacheEntry(l.url, null);
    if (_utility(e, p) <= 0 || !take()) { skipped++; continue; }
    e.prefetched = true; prefetch(l.url, { p }); k++;
  }
}
// в handleRoute при pending=true: for (const e of _resourceCache.values()) if (e.prefetched && e.refCount === 0 && e.controller) e.controller.abort();
// requestIdleCallback(() => idleWarm(...), { timeout: 2000 }) после каждого перехода
// Симуляция (sim-markov.mjs): idle top-1 попадает в 27.3% переходов с НУЛЕВОЙ ощущаемой латентностью
// (данные готовы до наведения), top-2 — 44.6% при 2 req/nav; hover-only даёт recall 100%, но экономит
// только min(rtt, dwell−d) ≈ 155 мс из 220 при precision 25% и 2.9 лишних запроса на клик.
// Комбинация: idle top-1 (по предиктору) + hover для остальных → 27% переходов мгновенны, остальные — как сейчас.
```

**API:**

```js
router(routes, {
  preload: 'hover',
  predict: { predictor: pred, topK: 2, minP: 0.3, budget: { requests: 4, perSecond: 1, maxBytes: 200_000 } },
});
boost({ prefetch: 'hover', predict: { predictor: pred, topK: 1 } });
// маршрут декларирует, что греть: { '/users/:id': { loader, preload: (p) => prefetch(`/api/users/${p.id}`) } } — уже есть (7539)
// d.ts: RouterOptions.predict?: { predictor: Predictor; topK?: number; minP?: number; budget?: {…} }
```

**Критерий:** Тест с fake router и 3 ссылками в outlet: после 3 переходов A→B в idle-коллбеке вызывается preload только для B (p ≥ 0.3), для C/D — нет; при budget.requests=1 второй кандидат пропускается (stats().prefetch.skipped === 1); при r.navigate('/x') в полёте prefetch-запрос с refCount 0 получает abort (fetcher видит signal.aborted). На sim-markov.mjs: доля переходов, чьи данные уже в кэше до наведения, ≥ 25% при 1 req/nav.

**Источники:** token bucket (RFC 2697/2698 metering), Guess.js prefetch топ-k по вероятности, quicklink {limit, throttle}, Chrome Speculation Rules eagerness: immediate/moderate/conservative, requestIdleCallback

## 💎 #68 — Учёт исхода prefetch: hit/waste в entry, Beta-калибровка P(use | триггер), stats().prefetch, E038 и вкладка в dev-панели

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip в ядре (счётчики + Beta + E038); вкладка — в aegis-devtools.js, не в бандле

**Сейчас:** Entry кэша (aegis_full.js:5738–5760) не знает, что данные положил prefetch; GC-таймер (5917, 5770) просто удаляет запись — «использована ли она» никем не фиксируется. stats() (986–996) отдаёт только resourceCache: размер Map, панель показывает одну цифру «cache» (aegis-devtools.js:91). _netLog (5772–5812) считает только дубли и штормы (E029/E030). Нет данных, чтобы понять, что prefetchOn на списке из 40 карточек греет впустую 90% запросов.

**Предложение:** Пометить e.prefetched = kind ('hover'|'visible'|'tap'|'predict'|'manual') в prefetch(); в _retainEntry (5762) при первом retain помеченной entry с данными — зачесть hit(kind); в GC-коллбеке при refCount ≤ 0 и e.prefetched — зачесть waste(kind). Хранить Beta(α,β) на kind с забыванием (α,β *= 0.99 на событие): posterior mean = P(use | kind) — это калиброванная оценка p для функции полезности (hover без предиктора получает измеренную, а не выдуманную вероятность). stats().prefetch = { fired, used, wasted, bytes, byKind: { hover: { p, n } } }; dev-предупреждение E038 при n ≥ 20 и P(use) < 0.2 с указанием site (как в E029). Вкладка «cache» в aegis-devtools.js: ключ, возраст, refCount, rtt, bytes, prefetched/used.

**Алгоритм:**

```js
const _pf = { fired: 0, used: 0, wasted: 0, bytes: 0, kinds: new Map() }; // kind → { a, b }
const beta = (k) => _pf.kinds.get(k) || (_pf.kinds.set(k, { a: 1, b: 1 }), _pf.kinds.get(k));
function _pfOutcome(kind, hit) { const s = beta(kind); s.a *= 0.99; s.b *= 0.99; if (hit) { s.a++; _pf.used++; } else { s.b++; _pf.wasted++; }
  if (_dev() && s.a + s.b >= 20 && s.a / (s.a + s.b) < 0.2) _warn('E038', {
    what: `prefetch(${kind}): only ${Math.round(100 * s.a / (s.a + s.b))}% of warmed responses were used (${_pf.wasted} wasted).`,
    why: 'The trigger fires far more often than users navigate — bandwidth and server load for nothing.',
    fix: "Use { on: 'tap' }, a predictor { p }, or raise delay/minP; check stats().prefetch." }, 'pf:' + kind); }
export const pUse = (kind) => { const s = beta(kind); return s.a / (s.a + s.b); }; // калиброванная P(use|kind)
// prefetch(): e.prefetched = opts.kind || 'manual'; _pf.fired++;
// _retainEntry(e): if (e.prefetched && e.refCount === 0) { if (e.data.peek() != null) _pfOutcome(e.prefetched, true); e.prefetched = null; }
// GC-timer: if (e.prefetched) _pfOutcome(e.prefetched, false);
// _utility(e, p ?? pUse(kind)) — hover/visible без предиктора используют измеренную вероятность
// Математика: Beta(α,β) с забыванием ≡ экспоненциально взвешенная бета-биномиальная оценка,
// эффективное окно ≈ 1/(1−0.99) = 100 последних исходов; при α=β=1 prior ≈ 50%.
```

**API:**

```js
stats().prefetch
// → { fired: 143, used: 31, wasted: 96, bytes: 1_204_331, byKind: { hover: { p: 0.21, n: 100 }, predict: { p: 0.44, n: 27 } } }
prefetch(url, { kind: 'hover' });             // prefetchOn/router/boost проставляют kind сами
onWarn(w => w.code === 'E038' && report(w)); // прод-телеметрия через dev.enable() у клиента
dev.panel()  // вкладка Cache: key | age | refs | rtt | bytes | prefetched→used
```

**Критерий:** Тест с fake timers: 10 prefetch(kind:'hover') без последующего resource() + cacheTime 100 мс → после 150 мс stats().prefetch.wasted === 10, pUse('hover') ≈ 1/12; 10 prefetch + resource(url,{cache:true}) на каждый → used === 10, wasted === 0. E038 срабатывает ровно один раз (ключ 'pf:hover') после 20-го исхода с долей < 20%; onWarn получает site. Панель: вкладка отображает entry с полями rtt/bytes после первого ответа.

**Источники:** Beta-Binomial conjugate update / Thompson-style calibration, exponential forgetting в non-stationary bandits (Garivier & Moulines 2011, discounted UCB), React Query Devtools (cache explorer), Chrome DevTools Speculations panel

## 💎 #69 — Синтетический бенчмарк предвыборки в репозитории: test-prefetch-sim.mjs с регрессионными порогами

**Impact:** 2 · **Effort:** S · **Size:** 0 KB в бандле (только экспорт 2–3 внутренних функций под _-префиксом, как уже сделано для тестов)

**Сейчас:** В репо есть test-core.mjs, test-browsers.mjs, bench.html, test.html (единственный тест prefetch — test.html:1330–1342 проверяет только «данные в кэше, запрос не повторился»). Нет ни одного способа проверить, что модель предсказания или порог hover стали лучше или хуже после правки — метрики точности/precision/полезности негде посчитать.

**Предложение:** Перенести из scratchpad два node-скрипта (sim-markov.mjs, sim-hover2.mjs; нулевые зависимости, детерминированный LCG-seed, < 1 с) в test-prefetch-sim.mjs, импортирующий predictor/choose/_utility прямо из aegis_full.js (они чистые функции; для router/DOM-части — не нужны). Скрипт печатает таблицы и падает (exit 1) при нарушении порогов: markov top-1 ≥ uniform + 8 п.п., server-prior s1 ≥ 35%, |U(adaptive) − U(oracle)| ≤ 2 мс/hover во всех режимах, U(adaptive) ≥ U(80 мс). Добавить в package.json scripts "test:prefetch". Генератор сессий параметризован (R паттернов, ссылок/страница, доля персонального поведения, момент дрейфа), чтобы автор мог воспроизвести свой сайт.

**Алгоритм:**

```js
// Генератор: LCG seed → воспроизводимо; site = R разреженных строк (2–4 сильных перехода + шум 0.01)
// truth(user, from) = (1−mix)·site[from] + mix·personal[from], mix ~ U(0.3, 0.7); дрейф: site A → B после S/2 сессий
// на каждом шаге: next ~ truth; кандидаты = {next} ∪ 5 случайных, перемешаны (иначе tie-break даёт ложные 100%)
// метрики: top1/top2 (по кандидатам), precision/recall/req-per-nav для политик thr∈{.2,.3,.4,.5}, top∈{1,2,3}, hover-only
// hover-sim: события {click, dwell}, dwell ~ lognormal; U(d) = Σ[click·min(RTT, dwell−d)·1(dwell≥d) − (1−click)·cost·1(dwell≥d)]/N
import { _predictorCore, _hoverChoose, _utility } from './aegis_full.js'; // экспорт под _ для тестов, как settled()
const assert = (cond, msg) => { if (!cond) { console.error('FAIL', msg); process.exitCode = 1; } };
const r = runMarkov({ users: 300, sessions: 6, R: 12, links: 6, seed: 7 });
assert(r.markov.top1 >= r.uniform.top1 + 0.08, 'markov ≥ uniform + 8pp');
assert(r.prior5.bySession[0] >= 0.35, 'server prior cold-start ≥ 35%');
for (const sc of runHover()) { assert(Math.abs(sc.adaptive.u - sc.oracle.u) <= 2, `adaptive≈oracle ${sc.name}`); assert(sc.adaptive.u >= sc.fixed80.u, `adaptive ≥ 80ms ${sc.name}`); }
// Текущие числа из scratchpad (для порогов):
// markov1 27.3% vs uniform 16.7% (Δ 10.6 п.п.); prior κ=5 s1 = 39.1%; oracle 48.4%
// hover: max |adaptive − oracle| = 1.4 мс (click=0.1, cost=80); adaptive ≥ d=80 во всех 12 режимах
```

**API:**

```js
npm run test:prefetch
# node test-prefetch-sim.mjs --users 1000 --routes 30 --links 10 --drift 0.5 --seed 42
# R=30 routes, 10 links/page … таблицы моделей и политик, exit 1 при провале порогов
# Файлы-прототипы: C:\Users\admin\AppData\Local\Temp\claude\C--1-aegis\ddb0dc27-2b70-43b2-99c2-472a4447b51f\scratchpad\agents\prefetch-prediction-math\sim-markov.mjs, sim-hover2.mjs
```

**Критерий:** Скрипт выполняется < 2 с в node без зависимостей и детерминирован (два запуска — идентичный вывод). Все четыре порога проходят на текущих реализациях; намеренная порча (decay=0 или d фиксированный) — падает. Включён в CI-цепочку рядом с test-core.mjs.

**Источники:** Практика Guess.js (оценка точности на логах), классические работы по оценке prefetch: precision/recall/traffic-increase (Nanopoulos, Katsaros, Manolopoulos 2003 «A data mining algorithm for generalized web prefetching»), property-based/synthetic benchmarks в стиле bench.html


---

# 📐 coalescing-scheduling

**Линза:** math / coalescing-scheduling — склейка и планирование запросов (теория очередей, приоритеты, ограничение параллелизма)

**Вывод:** В Aegis нет планировщика запросов как сущности: каждый resource()/`_fetchEntry` сразу вызывает fetcher (aegis_full.js:3608–3636, 5814–5849), дедупликация есть только внутри SWR-кэша по точному ключу (5821), а «склейка» существует лишь как dev-предупреждение E029/E030 (5793–5809) и как 16-мс буфер в streamResource. Следствие: при монтировании дашборда с 40 ресурсами браузерная очередь HTTP/1.1 (6 слотов) обслуживает их FIFO — видимые карточки ждут в среднем 655 мс (p95 1156 мс), а с приоритетом «видимое > невидимое» — 200 мс (p95 410 мс) при том же трафике (симуляция A). Списковые ресурсы `resource({params, loader})` дают N+1 запросов, хотя окно склейки 0–16 мс превращает 51 запрос в 2–5 с добавленной задержкой ≤16 мс (симуляция B). Фокус-ревалидация (5852–5866) и invalidate по предикату (6053–6062) выстреливают все K entry одновременно (K=30 → хвост 750 мс), а jitter staleTime тут не помогает — помогает только ограничитель параллелизма. Предлагаю один маленький модульный планировщик `_sched` (лимит c, три приоритетных полосы, микротаск-склейка), на который переводятся все точки fetch, плюс четыре точечных механизма склейки: batched loader, debounce/maxWait реактивного URL, in-flight dedupe для plain resource и общий poll-хаб.

**Отвергнуто:** 1) Jitter для staleTime против «thundering herd» — симуляция D показала, что при квантовании focus-тиков по 5 с (throttle 5857) ±10% не разбивают бёрст (30 → 30), ±25% дают 22; реальное лекарство — лимит параллелизма, а не случайность. 2) Автоматический HTTP-батчинг разных URL в один POST (/batch multiplexing) — требует серверного контракта, противоречит server-first/zero-config; вместо этого batched() с явной функцией. 3) Token bucket / rate limit на клиенте (N req/s) — без обратной связи от сервера это ухудшает UX, а 429 + Retry-After уже обрабатывает withRetry (1449–1462). 4) Адаптивная оценка concurrency по RTT (как TCP congestion window) — интересно, но не измеримо в браузере без Resource Timing на каждый запрос и раздувает код; c=6 как константа с override покрывает 95% случаев. 5) Приоритеты для мутаций (очередь POST) — мутации уже имеют `concurrent: 'queue'|'latest'` (3696), а офлайн-очередь — свой flush с backoff (7999–8030); добавлять третий слой не нужно. 6) Web Worker / SharedWorker как общий планировщик между вкладками — дедуп между вкладками важен, но это отдельная линза (persist/broadcast), а не coalescing внутри страницы.

## 💎 #70 — Планировщик запросов: лимит параллелизма + приоритетные полосы (visible > user > background)

**Impact:** 5 · **Effort:** M · **Size:** +0.5–0.7 KB gzip (очередь ~35 строк + 4 точки подключения)

**Сейчас:** Все точки fetch вызывают fetcher немедленно: `_plainResource._fetch` (aegis_full.js:3608–3636), `_fetchEntry` (5814–5849), `infiniteResource.loadMore` (6083–6105), `_offlineResource.fetchRemote` (8063–8083). Единственный намёк на приоритет — `priority: 'low'` в prefetch (5914), пробрасываемый в fetch init (Priority Hints). Нет ни очереди, ни лимита: при 40 ресурсах на dashboard браузер сам ставит их в FIFO по 6 на хост (HTTP/1.1) или отправляет все разом (HTTP/2), и видимые карточки ждут за невидимыми.

**Предложение:** Ввести модульный планировщик `_sched` (семафор c=6 по умолчанию, три полосы: 0=visible/user-initiated, 1=normal, 2=background — prefetch, revalidateOn focus, poll). Все четыре точки fetch идут через `_sched.run(prio, url, (signal) => fetcher(...))`. Пока запрос стоит в очереди, abort снимает его без сетевой работы (сейчас abort после отправки — сервер всё равно выполняет работу). Границы: видимый запрос ждёт не более ceil(V/c)−1 обслуживаний других видимых; невидимые получают слоты только когда полоса 0 пуста (strict priority; для защиты от голодания — aging: через 2 с из полосы 2 в 1). Little's law: L = λ·W ⇒ при c слотах и среднем сервисе S задержка k-го в очереди ≈ ⌈k/c⌉·S, что и даёт измеряемую границу.

**Алгоритм:**

```js
const _lanes = [[], [], []]; let _active = 0; let _limit = 6;
function _sched(prio, job, signal) {              // job: () => Promise
  return new Promise((res, rej) => {
    const item = { job, res, rej, t: Date.now(), prio };
    if (signal) signal.addEventListener('abort', () => {   // снять из очереди без сети
      const q = _lanes[item.prio], i = q.indexOf(item);
      if (i >= 0) { q.splice(i, 1); rej(signal.reason ?? new DOMException('Aborted','AbortError')); }
    }, { once: true });
    _lanes[prio].push(item); _pump();
  });
}
function _pump() {
  while (_active < _limit) {
    const now = Date.now();
    // aging: background старше 2 с считается normal (нет голодания)
    let q = _lanes.find((l, i) => l.length && (i < 2 || now - l[0].t > 2000)) || _lanes.find(l => l.length);
    if (!q) return;
    const it = q.shift(); _active++;
    it.job().then(it.res, it.rej).finally(() => { _active--; _pump(); });
  }
}
// в _fetchEntry: const attempt = () => _sched(fopts.priority ?? 1, () => fetcher(url, { signal, priority: PRIO_HINT[prio] }), controller.signal);
// Симуляция A (sim.mjs, 200 прогонов): 40 запросов при mount, 8 видимых, 6 слотов, сервис ~exp(180 мс)
//   fifo:     visible mean 655 ms, p95 1156 ms, invisible mean 657 ms
//   priority: visible mean 200 ms, p95  410 ms, invisible mean 772 ms  (−70% для видимого, +17% для невидимого)
```

**API:**

```js
configure({ concurrency: 6 })                       // 0/Infinity — выключить очередь (HTTP/2 + свой сервер)
resource(url, { cache: true, priority: 'high' })     // 'high' | 'normal' | 'low' → полоса 0/1/2 + fetch({priority}) hint
prefetch(url)                                          // всегда 'low' (как сейчас 5914), но теперь реально уступает
refresh() / mutation()                                 // всегда полоса 0 (user-initiated)
_installRevalidate / poll → 'low'
```

**Критерий:** Тест в test.html: 40 cachedResource с моком, задержка 100 мс, concurrency 6, 8 из них priority:'high' — все 8 high резолвятся раньше любого normal; в любой момент inflight ≤ 6 (assert по счётчику в defaults.fetcher). Бенч: симуляция даёт p95 видимого 1156 → 410 мс; повторить в bench.html с mock-сервером и замерить время до `when(s).data` первых 8 карточек.

**Источники:** Little's law; strict priority queue с aging (классика ОС-планировщиков); Fetch Priority Hints (fetch init `priority`, Chrome 101+); Chrome's ResourceScheduler (лимит 6/хост, приоритет по видимости); TanStack Query не делает этого — ниша.

## 💎 #71 — batched(): DataLoader-склейка loader-ресурсов в одно окно (микротаск / кадр)

**Impact:** 4 · **Effort:** S · **Size:** +0.35 KB gzip (~25 строк), tree-shakeable — отдельный export

**Сейчас:** `resource({ params, loader })` (aegis_full.js:3583–3585, 3610–3612) вызывает loader на каждый инстанс. В `list()` (2706) строка с собственным ресурсом → N+1 запросов; дев-режим лишь предупреждает E029 о дублях URL (5793–5801), про разные params ничего не знает. Никакого механизма «собрать N ключей → один запрос» нет.

**Предложение:** Добавить `batched(fn, { window, max, key })`: возвращает loader-совместимую функцию `({params, signal}) => Promise<T>`; вызовы, попавшие в одно окно, склеиваются в один вызов `fn(keysArray)`, результат раскладывается по порядку (или через `key`/map). Окно `0` = queueMicrotask (ловит всё, что монтируется синхронно в одном batch()/effect-flush), `'frame'` = rAF (~16 мс, ловит острова, которые hydrate разносит через `_yield` по бюджету 8 мс — 3410–3416), число = setTimeout. Abort: сигнал отдельного вызова снимает его ключ; если сняты все — общий запрос abort'ится. Ошибка общего запроса → reject всех.

**Алгоритм:**

```js
export function batched(fn, { window: w = 0, max = 50, key = (p) => _keyOf(p) } = {}) {
  let pending = [], timer = null;
  const flush = () => {
    timer = null; const batch = pending; pending = [];
    const live = batch.filter(b => !b.signal?.aborted);
    if (!live.length) return;
    const c = new AbortController();
    Promise.resolve(fn(live.map(b => b.params), { signal: c.signal })).then(
      (out) => { const byKey = out instanceof Map ? out : null;
                 live.forEach((b, i) => b.res(byKey ? byKey.get(key(b.params)) : out[i])); },
      (err) => live.forEach(b => b.rej(err)));
  };
  const schedule = () => { if (timer) return;
    timer = w === 0 ? (queueMicrotask(flush), 1) : w === 'frame' ? requestAnimationFrame(flush) : setTimeout(flush, w); };
  return ({ params, signal }) => new Promise((res, rej) => {
    pending.push({ params, signal, res, rej });
    if (pending.length >= max) flush(); else schedule();
  });
}
// Ожидаемый размер батча при пуассоновских приходах λ и окне W: E[n] = 1 + λW; добавленная задержка ≤ W.
// Симуляция B (60 строк, loader на строку, max=50):
//   sync mount:        window 0 → 2 запроса, +0 мс
//   hydrate-stagger:   window 0 → 51, window 4 → 13, window 16 (frame) → 5 запросов (+9 мс mean, +16 max)
//   scroll (40/с):     window 0 → 60, window 50 → 22 запроса (+32 мс mean)
// Вывод: default = microtask; для островов/скролла — 'frame'; окно >16 мс себя не окупает.
```

**API:**

```js
const userLoader = batched((ids, { signal }) => api.post('/api/users/bulk', { ids }, { signal }), { window: 'frame', max: 100 });
// в строке списка:
const u = resource({ params: () => ({ id: row.id }), loader: ({ params, signal }) => userLoader({ params: params.id, signal }) });
// сервер возвращает массив в порядке ids или { id: user } → key: (id) => id, результат Map/объект
```

**Критерий:** Тест: 60 `resource({loader: batched(fn)})` в одном mount → fn вызван 1–2 раза (max=50), каждый ресурс получил свои данные; abort одного не ломает остальных; bench: dashboard с list из 60 строк — число запросов в `_netLog` падает с 60 до ≤5 при window:'frame'.

**Источники:** Facebook DataLoader (batch scheduling через process.nextTick / микротаск, maxBatchSize); GraphQL batching; теория очередей — batch service с таймером (E[n]=1+λW).

## 💎 #72 — Склейка invalidate/revalidate: dirty-set + микротаск-флаш + отправка через планировщик

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip (dirty-set ~15 строк; invalidate становится короче)

**Сейчас:** `invalidate(keyOrFn)` (aegis_full.js:6053–6062) проходит весь `_resourceCache` и сразу вызывает `_fetchEntry(…, true)` для каждой активной entry; `mutation` с массивом `invalidates` делает K проходов (3717) — K×N и K бёрстов. `_installRevalidate.tick` (5852–5866) при focus/online выстреливает все активные entry одновременно; throttle 5 с (5857) ограничивает частоту тиков, но не размер бёрста. Ни там, ни там нет ограничения по числу одновременных запросов.

**Предложение:** invalidate() только помечает entry (`e.lastFetch = 0`, кладёт в `_dirty: Set`) и планирует один флаш в микротаске; флаш делает один проход, сортирует dirty-entry по «важности» (сначала те, у кого `refCount>0`, затем по возрасту `lastFetch` — самые устаревшие первыми) и отправляет через `_sched` в полосе background (focus/online) или normal (после мутации). Симуляция D показывает, что jitter staleTime бёрст не убирает (30 entry со staleTime 30 с истекают в один 5-секундный тик даже при ±10%) — единственное, что ограничивает хвост, это лимит c.

**Алгоритм:**

```js
const _dirty = new Set(); let _dirtyFlush = false;
function _markDirty(e, prio) { e.lastFetch = 0; e._prio = Math.min(e._prio ?? 9, prio); _dirty.add(e);
  if (!_dirtyFlush) { _dirtyFlush = true; queueMicrotask(_flushDirty); } }
function _flushDirty() {
  _dirtyFlush = false;
  const list = [..._dirty].filter(e => e.refCount > 0 && e.url && e.fopts)
    .sort((a, b) => (a._prio - b._prio) || (a.lastFetch - b.lastFetch));   // priority, затем самые старые
  _dirty.clear();
  for (const e of list) { const p = e._prio; e._prio = undefined; _fetchEntry(e, e.url, { ...e.fopts, priority: p }, true); }
}
export function invalidate(keyOrFn, { priority = 1 } = {}) {
  for (const [k, e] of _resourceCache)
    if (typeof keyOrFn === 'function' ? keyOrFn(k) : k === keyOrFn) _markDirty(e, priority);
}
// _installRevalidate.tick(reason): for (e of _resourceCache.values()) if (…revalidateOn.includes(reason)) _markDirty(e, 2 /*background*/);
// mutation: for (const k of [].concat(invalidates)) invalidate(k) — теперь K проходов, но ОДИН флаш и один бёрст через _sched
// Симуляция D: 30 cached entry, staleTime 30 с, focus-тики каждые 5 с:
//   без лимита: 30 параллельных, очередь 24 сверх 6 слотов, хвост ≈ ceil(30/6)*150 = 750 мс на все 30
//   jitter ±10%: тот же бёрст 30 (тики квантованы по 5 с); jitter ±25%: 22 — не решение
//   с _sched c=6 и сортировкой по возрасту: пользователь видит обновление самых старых через 150 мс, а не в случайном порядке
```

**API:**

```js
invalidate('/api/users')                          // как сейчас, но склеено в микротаск
invalidate(k => k.startsWith('/api/'), { priority: 'high' })   // после собственной мутации — полоса 0
mutation(fn, { invalidates: ['/api/a', '/api/b', k => …] })    // K предикатов → один флаш
// revalidateOn focus/reconnect автоматически идёт в 'low'
```

**Критерий:** Тест: mutation с invalidates из 3 предикатов, совпадающих с одной entry → ровно 1 refetch (сейчас `_fetchEntry` с force=true и `if (e.promise) return e.promise` даёт 1 fetch, но 3 прохода — считать вызовы `_fetchEntry`); 30 entry + focus → inflight ≤ concurrency в любой момент, порядок старта — по возрастанию lastFetch. Метрика: max одновременных запросов после focus (30 → 6).

**Источники:** SWR `revalidateOnFocus` + `focusThrottleInterval`; TanStack Query `invalidateQueries` (batch notify через notifyManager с микротаск-флашем); thundering herd / cache stampede (Facebook memcache lease) — там ответ тоже лимит, а не jitter.

## 💎 #73 — debounce/maxWait для реактивного source: склейка нажатий в typeahead с гарантированной границей задержки

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip (общий helper для plain и cached, ~15 строк)

**Сейчас:** `_plainResource` effect (aegis_full.js:3648–3656) и `_cachedResource` effect (6032–6037) перезапрашивают при каждом изменении сигнала в URL; plain-вариант abort'ит предыдущий запрос (3608), но сервер уже начал работу; cached-вариант вообще не abort'ит (entry старого URL остаётся в полёте, пока refCount>0 — 5770–5774), т.е. при вводе «hello world» в demo/admin.html:113 в полёте параллельно до 11 запросов `/api/users?q=h`, `?q=he`, …, все закэшируются, ни один не нужен. Разработчик вынужден городить `debounced()` (1474) поверх сигнала вручную.

**Предложение:** Опция `debounce` у resource(): source перечитывается реактивно (effect всё так же трекает сигналы), но `_fetch` вызывается только после `wait` мс тишины и не позже `maxWait` мс от первого изменения (границы: задержка ∈ [wait, maxWait]). Первый запрос после idle (immediate mount) — без задержки (leading). `key` при этом обновляется сразу (для `stale`/`keepPrevious` UI), а `validating` становится true только при реальном старте fetch. Для cached: abort'ить entry с refCount 0 не нужно, но не начинать fetch для промежуточных URL — они вообще не создают entry.

**Алгоритм:**

```js
// в _plainResource / _cachedResource, если opts.debounce:
const { wait, maxWait = wait * 4 } = typeof debounce === 'number' ? { wait: debounce } : debounce;
let timer = null, first = 0, lead = true;
const plan = (run) => {
  if (lead) { lead = false; return run(); }                 // первый (mount) — сразу
  const now = Date.now(); if (!first) first = now;
  clearTimeout(timer);
  const delay = Math.min(wait, first + maxWait - now);       // граница: не позже maxWait от первого изменения
  timer = setTimeout(() => { timer = null; first = 0; run(); }, Math.max(0, delay));
};
effect(() => { const a = resolveArg(); untrack(() => { key.value = _keyOf(a); if (a == null || a === '' || a === false) { abort(); return; } plan(() => _fetch(a)); }); });
// refresh() — всегда немедленно, dispose — clearTimeout.
// Симуляция C (18 нажатий «hello world search», межнажатие 80–240 мс):
//   без debounce: 18 запросов (и 17 abort'ов — для cached ни одного abort'а)
//   wait 150 / maxWait 600: 12 запросов, средняя задержка после последней клавиши 150 мс
//   wait 300 / maxWait 1000: 3 запроса (×6), задержка 171 мс mean, максимум 1000 мс гарантирован
// Для realistic 100–150 мс между клавишами wait=250 даёт ~1 запрос на слово.
```

**API:**

```js
resource(() => `/api/users?q=${q.value}`, { cache: true, debounce: 250 })
resource(src, { debounce: { wait: 250, maxWait: 1000 } })   // явные границы задержки
// d.ts: ResourceOptions.debounce?: number | { wait: number; maxWait?: number }
```

**Критерий:** Тест: 10 синхронных изменений сигнала за 500 мс при debounce 150 → 1 fetch; изменения каждые 100 мс в течение 2 с при {wait:150,maxWait:600} → ровно ⌈2000/600⌉=4 fetch, ни один не позже 600 мс от первого изменения; refresh() игнорирует debounce. В demo Users: число записей в `_resourceCache` после ввода 11 символов ≤ 3 вместо 11.

**Источники:** lodash.debounce `maxWait` (гарантия верхней границы); RxJS `debounceTime`/`auditTime`; Angular/Vue-паттерн typeahead; SWR `dedupingInterval`.

## 💎 #74 — Poll-хаб: выровненные тики, один таймер на интервал, polling для cached через revalidateOn

**Impact:** 3 · **Effort:** S · **Size:** +0.3 KB gzip; poll() при этом упрощается (−0.1 KB)

**Сейчас:** `poll()` (aegis_full.js:1515–1531) — независимый цикл setTimeout на каждый вызов; `refetch.interval` в plain resource (3669) создаёт по циклу на ресурс. Фазы стартов случайны и дрейфуют (await fn() + setTimeout ms), поэтому N ресурсов с одинаковым интервалом просыпаются в N разных моментов → N отдельных пробуждений и N одиночных запросов вместо одного бёрста, который HTTP/2 и планировщик обработали бы за один раунд. У `_cachedResource` polling отсутствует вовсе (известный пробел): revalidateOn принимает только 'focus'|'reconnect' (5859, 5949).

**Предложение:** Общий `_pollHub`: одна Map interval → { timer, fns: Set }, таймер выровнен на сетку `ceil(now/interval)*interval` (все подписчики одного интервала стреляют в один тик), в hidden-вкладке хаб спит (как сейчас poll), при возврате — один тик. `poll()` становится тонкой обёрткой над хабом (поведение и сигнатура те же), `refetch.interval` и новое `revalidateOn: [..., { interval: 30000 }]` для cached идут туда же; сами запросы отправляются через `_sched` в полосе background и естественно ограничиваются c. Дополнительно: тик пропускается для entry с `inflight` (как сейчас 3669) и для entry с `refCount === 0`.

**Алгоритм:**

```js
const _hub = new Map(); // ms → { fns: Set<fn>, timer }
function _hubAdd(ms, fn) {
  let h = _hub.get(ms);
  if (!h) { h = { fns: new Set(), timer: null }; _hub.set(ms, h); _hubArm(ms, h); }
  h.fns.add(fn);
  return () => { h.fns.delete(fn); if (!h.fns.size) { clearTimeout(h.timer); _hub.delete(ms); } };
}
function _hubArm(ms, h) {
  const now = Date.now(), next = Math.ceil((now + 1) / ms) * ms;     // сетка: все подписчики в один тик
  h.timer = setTimeout(async () => {
    if (typeof document !== 'undefined' && document.hidden) {           // спать до visible, потом один тик
      await new Promise(r => document.addEventListener('visibilitychange', r, { once: true }));
    }
    for (const fn of h.fns) { try { await fn(); } catch (e) { console.error('[Aegis] poll error:', e); } }
    if (_hub.get(ms) === h) _hubArm(ms, h);
  }, next - now);
}
export function poll(fn, ms, { background = false } = {}) { return _scoped(_hubAdd(ms, background ? fn : fn /* hidden-check в хабе */)); }
// cached: if (revalidateOn.some(r => r.interval)) dispose.push(_hubAdd(r.interval, () => e.refCount > 0 && !e.inflight.peek() && _fetchEntry(e, e.url, { ...e.fopts, priority: 2 })));
// Симуляция E: 10 poll @5 с за 10 минут → 1167 отдельных пробуждений (50-мс корзины) vs 120 тиков хаба (−90%).
// Little: при c=6 и S=150 мс бёрст из 10 в один тик обслуживается за ceil(10/6)*150 = 300 мс — единый «раунд» вместо размазанного шума.
```

**API:**

```js
resource(url, { cache: true, revalidateOn: ['focus', { interval: 30000 }] })
resource(url, { refetch: { interval: 5000 } })        // как сейчас, но через хаб
poll(fn, 5000)                                          // сигнатура не меняется
// d.ts: CacheOptions.revalidateOn?: Array<'focus' | 'reconnect' | { interval: number }>
```

**Критерий:** Тест: 10 poll(fn, 100) → за 1 с все 10 fn вызваны 10 раз и каждый раз в одном макротаске (разница timestamps внутри тика < 5 мс); cached с {interval: 100} перезапрашивает раз в 100 мс и останавливается при dispose (refCount→0). Метрика: число пробуждений таймера в 10-минутном бенче 1167 → 120.

**Источники:** Chrome timer alignment / throttling в фоновых вкладках (выравнивание на 1 с); Android JobScheduler batching; TanStack Query `refetchInterval`; SWR `refreshInterval`.

## 💎 #75 — In-flight dedupe для plain resource: превратить E029 из предупреждения в фикс

**Impact:** 3 · **Effort:** S · **Size:** +0.3 KB gzip (~18 строк)

**Сейчас:** `_devTrackFetch` (aegis_full.js:5793–5801) обнаруживает два инстанса `resource(url)` с одним URL в окне 100 мс и предлагает включить `cache: true`. Но cache меняет семантику (общие сигналы, SWR, staleTime, GC-таймер), а часто нужно просто «не слать один GET дважды одновременно». `_plainResource._fetch` (3608–3636) держит контроллер на инстанс; при двух карточках, читающих `/api/me`, уходят два запроса.

**Предложение:** Модульная `_inflight: Map<url, { p: Promise<raw>, refs: number, controller }>` для plain resource с fetcher по умолчанию и без loader: второй инстанс с тем же URL присоединяется к промису первого, получает тот же raw-результат, применяет свой `transform`/`share` и пишет в свои сигналы. Abort — refcount: abort инстанса уменьшает refs, реальный abort только когда refs === 0 (иначе отменяющий убьёт чужой запрос). Окно дедупликации — ровно время полёта (никакого кэширования данных, семантика plain сохраняется). Опция `dedupe: false` для выключения. Это разрезает E029 на два случая: одновременные (склеиваются автоматически) и разнесённые во времени (E029 остаётся — там действительно нужен кэш).

**Алгоритм:**

```js
const _inflightByUrl = new Map();
function _joinFetch(url, fetcher, signal, retryOpts) {
  let rec = _inflightByUrl.get(url);
  if (!rec) {
    const controller = new AbortController();
    rec = { refs: 0, controller, p: null };
    rec.p = withRetry((a) => fetcher(url, { signal: controller.signal }), { ...retryOpts, signal: controller.signal })
      .finally(() => { if (_inflightByUrl.get(url) === rec) _inflightByUrl.delete(url); });
    _inflightByUrl.set(url, rec);
  }
  rec.refs++;
  const leave = () => { if (--rec.refs <= 0) rec.controller.abort(); };
  signal.addEventListener('abort', leave, { once: true });
  return rec.p.finally(() => signal.removeEventListener('abort', leave));
}
// в _plainResource._fetch: const result = (dedupe && !loader && typeof arg === 'string') ? await _joinFetch(arg, fetcher, c.signal, {...}) : await withRetry(attempt, {...});
// Разница с cache:true: нет entry, нет staleTime, нет общих сигналов, данные не переживают завершение запроса.
// Граница: дедуп ловит ровно те дубли, что и E029 (окно = время полёта ≥ 100 мс на практике), т.е. 100% предупреждений «within N ms» уходят.
```

**API:**

```js
resource('/api/me')            // два инстанса → один GET, оба получают данные; ничего не настраивать
resource(url, { dedupe: false })   // нужен именно отдельный запрос (например, разный fetcher)
// d.ts: ResourceOptions.dedupe?: boolean (default true при fetcher по умолчанию)
```

**Критерий:** Тест: два `resource('/test/x')` в одном mount → fetchCount === 1, `r1.data !== r2.data` (сигналы свои), E029 не сработал; `r1.abort()` не прерывает r2 (r2.data заполнен); `r1.transform` и `r2.transform` применены независимо. Retry общий (один withRetry на URL).

**Источники:** SWR `dedupingInterval` (in-flight dedupe без кэш-семантики); Apollo `queryDeduplication`; HTTP-кэш браузера — «request coalescing» (Chrome объединяет одинаковые in-flight GET только при cacheable-ответах, поэтому на API с no-store не работает — отсюда нужда в JS).

## 💎 #76 — Видимость как приоритет: resource(url, { visible: el }) и понижение приоритета для offscreen

**Impact:** 4 · **Effort:** M · **Size:** +0.3 KB gzip (gate ~12 строк + promote в планировщике ~6), переиспользует _sharedIO

**Сейчас:** Есть `prefetchOn(el, url, { on: 'visible' })` (aegis_full.js:5928–5946) и `lazy()` (5158) — обе через `observe()` (1115), создающий отдельный IntersectionObserver на элемент; для visible-островов есть общий `_sharedIO(margin)` (3175–3191). Но сам `resource()` о DOM не знает: 40 карточек ниже сгиба стартуют fetch в момент mount с тем же приоритетом, что и первый экран (см. симуляцию A: видимое ждёт 655 мс).

**Предложение:** Опция `visible: Element | (() => Element)`: ресурс не стартует fetch, пока элемент не попал в viewport (+rootMargin 200px через `_sharedIO`), а при попадании стартует в полосе 0 планировщика; если данные уже в кэше (seedFrom/prefetch) — показываются сразу без ожидания. Вариант `visible: { el, eager: true }`: стартовать сразу, но в полосе 2 (low + fetch priority hint 'low'), а при появлении в viewport — «повысить» (переставить в очереди в полосу 0, если ещё не ушёл в сеть). Это даёт планировщику реальный сигнал «видимое > невидимое» вместо ручной расстановки priority.

**Алгоритм:**

```js
// в _cachedResource / _plainResource:
let gate = null;                                  // Promise, резолвится при появлении
if (opts.visible) {
  const el = typeof opts.visible === 'function' ? opts.visible() : opts.visible?.el ?? opts.visible;
  const io = _sharedIO(opts.rootMargin ?? '200px');
  gate = new Promise(r => io.watch(el, r));
  disposers.push(() => io.unwatch(el));
}
const start = (run) => {
  if (!gate) return run(1);
  if (opts.visible.eager) { const item = run(2); gate.then(() => _schedPromote(item, 0)); return item; }   // low → high при появлении
  return gate.then(() => run(0));                     // lazy: ждать viewport, затем полоса 0
};
// _schedPromote(item, prio): if (item ещё в _lanes[item.prio]) { splice; item.prio = prio; _lanes[prio].push(item); _pump(); }
// Границы: lazy-режим — 0 сетевых байт для offscreen; eager+promote — offscreen занимает слоты только когда полоса 0 пуста,
// а при скролле переходит в полосу 0 с задержкой ≤ 1 IntersectionObserver-callback (≈ 1 кадр).
// Ожидаемый эффект = колонка 'priority' симуляции A: visible p95 1156 → 410 мс при 40 ресурсах.
```

**API:**

```js
const stats = resource('/api/stats', { cache: true, visible: cardEl });                 // fetch при появлении, priority high
const chart = resource('/api/chart', { cache: true, visible: { el: chartEl, eager: true } });   // сразу, но low; high при скролле
// в компоненте: html`<div ${ref(el)}>${when(resource(url, { visible: () => el.value }), {...})}</div>`
```

**Критерий:** Тест: 40 resource с visible на элементах вне viewport (jsdom-полифилл IO) → fetchCount === 0 до триггера intersect; после intersect у 8 элементов → ровно 8 fetch, в полосе 0. Бенч в bench.html: страница с 40 карточками (mock 150 мс, concurrency 6): время до данных у 8 верхних карточек ≤ 2 раунда (~300 мс) вместо ~7 раундов (~1 с).

**Источники:** Chrome ResourceScheduler (приоритет изображений по viewport, `loading=lazy`); Fetch Priority Hints; `content-visibility` (у Aegis уже есть VIRTUAL SCROLL 7664); Relay/Next.js `defer`/`fetchPriority`.


---

# 📐 memory-budget-math

**Линза:** math / memory-budget-math

**Вывод:** SWR-кэш Aegis (секция 24, aegis_full.js:5736–6062) не имеет никакого бюджета: единственный механизм освобождения — per-entry setTimeout на cacheTime, а prefetch/seed создают записи с 5-минутным таймером без учёта размера. В симуляции (3000 ключей, Zipf α=0.9, 1000 req/мин) текущая схема держит в среднем 62 MB против 8 MB у бюджетного кэша, при этом GDSF (частота × стоимость / размер) сохраняет на 25 % больше латентности, чем LRU, при том же бюджете. Размер записи можно оценить структурно без сериализации с точностью ±20 % от реальной кучи V8 и в 10–300× быстрее JSON.stringify (выборка 32 элементов на массивах). Отдельные «утечки churn»: _share аллоцирует полный клон даже при равенстве (30 001 объект на 10k строк — впустую), _enqueueOffline клонирует всю очередь на каждую запись (3.1 с и 500 MB клонов на 1000 мутаций), setTimeout(Infinity/>2^31) для cacheTime срабатывает через 0–1 мс. Все предложения — ванильный JS, суммарно ≈1.4 KB gzip.

**Отвергнуто:** 1) Точный размер через JSON.stringify(data).length на каждый ответ — O(n) и аллокация строки размером с payload (8.4 мс и 2.5 MB мусора на 10k строк); Content-Length как прокси — при gzip это сжатый размер (в 5–10× меньше кучи). 2) LRU по числу записей (maxEntries только) — в симуляции 43 % hit против 61 % у GDSF при равном байтовом бюджете; записи 8 KB и 200 KB нельзя считать равными. 3) Sampled GDSF K=5 без кучи (Redis-стиль) — экономит ~150 B, но теряет 11 п.п. hit-rate (50 % vs 61 %); K=10 — 54 %. Оставил как запасной вариант, если куча покажется тяжёлой. 4) Полноценный ARC/W-TinyLFU (Caffeine) — нужны Count-Min Sketch и три списка, ~1.5 KB gzip; выигрыш над GDSF на web-API-трассах невелик, а cost-awareness они не дают. 5) Компрессия данных в кэше (CompressionStream в строку) — экономит кучу, но decompress при каждом hit ломает identity/structural sharing и стоит десятки мс; для SWR-кэша, живущего минуты, не окупается. 6) Хранить data в SharedArrayBuffer/Worker вне main-heap — требует crossOriginIsolated и сериализации, противоречит server-first/zero-build. 7) `performance.memory` как триггер давления — нестандарт, только Chrome, показывает весь heap страницы, а не долю кэша; оставил только как dev-метрику.

## 💎 #77 — _sizeOf(): структурная оценка байтов записи без сериализации (с выборкой на массивах)

**Impact:** 3 · **Effort:** S · **Size:** ≈ 300–350 B gzip

**Сейчас:** Размер данных нигде не считается. stats() (aegis_full.js:986–996) отдаёт только `resourceCache: _resourceCache.size` — число ключей. _parseBody (1310–1323) делает `response.json()`, длина тела теряется; Content-Length при gzip — это сжатый размер, как прокси не годится. CacheEntry (5741–5755) не имеет поля размера.

**Предложение:** Добавить внутренний `_sizeOf(v)` — обход структуры с константами V8 (smi 0 B, HeapNumber 16 B, строка 16+len, объект 24+8·keys, массив 48+8·n; массив double — 8·n без обхода). Для массивов > 32 элементов брать выборку: первые 16 + 16 случайных, среднее × n — обход становится O(глубина × 32) вместо O(n). Вычислять один раз в _fetchEntry после `e.data.value = …` (5836) и в seed()/mutate, хранить в `e.bytes`. Сумма по кэшу — `_cacheBytes`, обновляется инкрементально (O(1) на запись/удаление). Использовать как основу для бюджета (предложение 2), offline-квоты (6) и dev-панели.

**Алгоритм:**

```js
function _sizeOf(v, seen = new Set()) {
  if (v == null || typeof v === 'boolean') return 0;
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) < 2**30 ? 0 : 16;
  if (typeof v === 'string') return 16 + v.length;
  if (typeof v !== 'object' || seen.has(v)) return 0;
  seen.add(v);
  if (Array.isArray(v)) {
    const n = v.length, base = 48 + 8 * n;
    if (n && typeof v[0] === 'number' && !Number.isInteger(v[0])) return base; // PACKED_DOUBLE: unboxed
    if (n <= 32) { let s = base; for (const x of v) s += _sizeOf(x, seen); return s; }
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += _sizeOf(v[i], seen) + _sizeOf(v[(Math.random() * n) | 0], seen);
    return base + sum / 32 * n;            // E[size] × n
  }
  const keys = Object.keys(v); let s = 24 + 8 * keys.length;
  for (const k of keys) s += _sizeOf(v[k], seen);
  return s;
}
// Ошибка выборки: для i.i.d. элементов σ_est = σ_elem·n/√32 ≈ 18% σ_elem·n; для однородных JSON-строк (одна схема) σ_elem мала → ошибка < 5%.
// Замер (node --expose-gc, sizeof2.mjs): users×1000: heap 379 KB / est 450 KB (1.19), 59 µs vs JSON.stringify 615 µs;
// users×10000: 3777/4535 KB (1.20), 28 µs vs 8431 µs; floats×20000: 156/156 (1.00); text×2000: 439/437 (1.00); tree(5,5): 288/275 (0.95).
```

**API:**

```js
Внутренний хелпер + публичный счётчик:
  stats().cacheBytes            // ≈ байты кучи всех записей _resourceCache
  cacheStats()                  // { entries, idle, bytes, hits, misses, evictions } (см. п.2)
Опция для нестандартных payload (Blob, Map, классы):
  resource(url, { cache: { sizeOf: (data) => data.byteLength } })
По умолчанию для не-plain объектов (Date/Map/Blob) — 64 B константа.
```

**Критерий:** На 6 синтетических payload (см. algorithm) отношение est/heap в диапазоне 0.95–1.20; время оценки ≤ 0.1 мс для массива 10k строк (сейчас JSON.stringify 8.4 мс). Тест в test.html: `_sizeOf(users(1000))` в пределах 250–600 KB и не зависит от n линейно по времени (10k строк ≤ 2× времени 1k).

**Источники:** V8 object layout (Smi/HeapNumber/SeqOneByteString/FixedDoubleArray); object-sizeof (npm) — аналогичный структурный подсчёт без выборки; sampling estimator из Redis MEMORY USAGE (SAMPLES=5 для агрегатов)

## 💎 #78 — Байтовый бюджет кэша + cost-aware вытеснение GDSF по idle-записям (куча с ленивым удалением, O(log n))

**Impact:** 5 · **Effort:** M · **Size:** ≈ 500–600 B gzip (куча ~180 B, учёт/вытеснение ~250 B, configure/cacheStats ~120 B)

**Сейчас:** Единственное вытеснение — таймер cacheTime на запись: _releaseEntry (5767–5771), seed (5877–5879), prefetch (5916–5918). Ни лимита записей, ни лимита байт: prefetchOn(list, …, {on:'hover'}) (5928–5949) по списку из 500 ссылок создаёт 500 записей на 5 минут. При refCount>0 запись неудаляема (и должна быть — сигналы в UI). Стоимость запроса (латентность) нигде не фиксируется, хотя _fetchEntry (5814–5847) — единственная точка, где она измерима. Побочная ошибка учёта: в _cachedResource `prevEntry = prev` (5986) никогда не обнуляется, поэтому запись, удалённая из Map по таймеру, остаётся в куче через замыкание keepPrevious.

**Предложение:** Ввести глобальный бюджет `_cacheBudget` (байты, по умолчанию f(deviceMemory), см. п.5) и `maxEntries`. Кандидаты на вытеснение — только записи с refCount === 0 (idle). Приоритет GDSF: `pri = L + freq × cost / bytes`, где freq — число обращений (_cacheEntry hit), cost — медиана латентности fetch в мс (замеряется в _fetchEntry: performance.now() до/после withRetry), bytes — из _sizeOf, L — «инфляция» = приоритет последней жертвы (делает старые записи стареющими без таймеров). Структура: бинарная min-куча узлов {e, pri} с ленивым удалением — при hit/insert пушим новый узел, при pop пропускаем узлы с `node.pri !== e.pri || e.refCount > 0 || !в Map`; компактируем, когда heap.length > 4·idle + 64. Приоритеты только растут (L монотонна), поэтому decrease-key не нужен. Вытеснение вызывается в конце _fetchEntry/seed после обновления `_cacheBytes` (`while (_cacheBytes > budget && heap.size) evict()`). Заодно обнулять prevEntry, когда current.data стал не-null (в effect 6033–6036), чтобы учёт байт совпадал с реальной кучей.

**Алгоритм:**

```js
// в _fetchEntry: const t0 = performance.now(); … после ответа: e.cost = e.cost ? (e.cost + dt) / 2 : dt;  // EMA латентности
// в _cacheEntry при попадании: e.freq++; _touch(e)
function _touch(e) { e.pri = _L + e.freq * (e.cost || 100) / (e.bytes || 1024); _heap.push({ e, pri: e.pri }); }
function _evict() {
  while (_cacheBytes > _cacheBudget && _heap.size) {
    const n = _heap.pop();
    const e = n.e;
    if (n.pri !== e.pri || e.refCount > 0 || _resourceCache.get(e.key) !== e) continue; // stale node
    _resourceCache.delete(e.key); _cacheBytes -= e.bytes; _L = n.pri; _stats.evictions++;
    if (_ghosts) _ghosts.set(e.key, new WeakRef(e)); // п.5
  }
  if (_heap.size > 4 * _resourceCache.size + 64) _heap.rebuild(_resourceCache.values());
}
// Сложность: push/pop O(log H), H ≤ 4·n+64 → O(log n); амортизированно 1 pop на 1 вытеснение + доля stale ≤ 3.
// Симуляция evict.mjs / heap.mjs (3000 ключей, Zipf α=0.9, 60k запросов, размеры lognormal 8 KB/200 KB, латентность 90/600 мс, бюджет 8 MB, рабочее множество 130 MB):
//   Aegis сейчас (TTL 5 мин, без лимита): hit 82.4%, mean 62.4 MB, peak 72.1 MB
//   LRU exact:        hit 43.4%, saved 5774 s
//   LFU exact:        hit 55.8%, saved 6862 s
//   GDSF exact scan:  hit 61.5%, saved 7192 s (+25% к LRU)
//   GDSF heap+lazy:   hit 61.0%, saved 7164 s, maxHeap 2138 при ~500 живых, 23 компактации, 60k шагов за 25 мс
//   GDSF sampled K=10 (без кучи, O(K)): hit 54.1% — запасной вариант, если куча слишком дорога по байтам
```

**API:**

```js
configure({ cache: { maxBytes: 8 << 20, maxEntries: 2000, onEvict: (key, bytes) => {} } })
// per-resource защита от вытеснения (pinned = не idle):
resource('/api/me', { cache: { pin: true } })
// наблюдение:
cacheStats() → { entries, idle, bytes, budget, hits, misses, evictions, ghostHits }
// dev-панель: вкладка Cache — таблица key | bytes | freq | cost ms | pri | refCount, отсортирована по pri (жертвы сверху).
```

**Критерий:** Бенч в bench.html: prefetch 2000 URL по 50 KB при maxBytes 8 MB → `cacheStats().bytes ≤ 8 MB`, `performance.memory.usedJSHeapSize` (Chrome) растёт ≤ 12 MB (сейчас ≈ 100 MB на 5 минут); время вставки с вытеснением ≤ 20 µs (p99). Тест: hit-rate на Zipf-трассе ≥ LRU + 10 п.п. при равном бюджете; вытеснение никогда не трогает refCount>0 (assert в тесте).

**Источники:** GreedyDual-Size-Frequency (Cherkasova, HP Labs 1998; Arlitt et al. 2000 — web proxy caching); Redis approximated LFU/LRU (sampling K=5–10, logarithmic counter); TanStack Query gcTime — пример per-entry таймеров и их ограничений; lazy-deletion heaps (CLRS, priority queue with stale entries)

## 💎 #79 — Убрать per-entry setTimeout: ленивое истечение + один sweep; починить cacheTime: Infinity

**Impact:** 3 · **Effort:** S · **Size:** −50…+80 B gzip (удаление трёх таймер-сайтов компенсирует sweep)

**Сейчас:** Три места ставят таймер на каждую idle-запись: _releaseEntry (5770), seed (5878), prefetch (5917). 1000 префетчей = 1000 живых таймеров и 1000 замыканий. `cacheTime: Infinity` или > 2^31−1 мс (24.8 дня) — setTimeout coerces к 0/1 мс (HTML spec ToInt32; проверено в node: `setTimeout(fn, Infinity)` сработал через 0 мс, `2**31` — через 1 мс), т.е. запись удаляется сразу после dispose. В destroy (8612) приходится clearTimeout по всем записям.

**Предложение:** Хранить `e.expiresAt = Date.now() + cacheTime` (Infinity допустима как число) вместо таймера. Истечение проверять лениво: (а) в _cacheEntry при попадании — если `e.refCount === 0 && Date.now() > e.expiresAt`, считать промахом и пересоздать; (б) в _evict (п.2) просроченные — первые кандидаты независимо от pri; (в) один общий coarse-таймер `_sweep` на 60 с, запускается только пока есть idle-записи (счётчик `_idleCount`), останавливается при 0 — O(n_idle) раз в минуту вместо n таймеров. Гарантия: память просроченных записей не превышает min(бюджета, объёма за 60 с).

**Алгоритм:**

```js
function _releaseEntry(e, cacheTime) {
  if (--e.refCount > 0) return;
  if (e.controller) { e.controller.abort(); e.controller = null; e.promise = null; }
  e.expiresAt = Date.now() + cacheTime;     // Infinity ок
  _idleCount++; _armSweep();
}
function _armSweep() {
  if (_sweepTimer || !_idleCount) return;
  _sweepTimer = setTimeout(() => {
    _sweepTimer = null; const now = Date.now();
    for (const e of _resourceCache.values())
      if (e.refCount <= 0 && now > e.expiresAt) { _resourceCache.delete(e.key); _cacheBytes -= e.bytes; _idleCount--; }
    _armSweep();
  }, 60_000);
}
// _retainEntry: if (e.refCount++ === 0 && e.expiresAt) { e.expiresAt = 0; _idleCount--; }
// _cacheEntry: if (e && e.refCount <= 0 && Date.now() > e.expiresAt) { _resourceCache.delete(key); e = null; }
// Таймеров: 1 вместо n; удаление 3 setTimeout-сайтов и clearTimeout в destroy.
```

**API:**

```js
Без изменения публичного API. Документировать: `cacheTime: Infinity` — «держать до вытеснения по бюджету» (сейчас — баг, удаляет сразу). В d.ts: `cacheTime?: number` — комментарий «Infinity allowed».
```

**Критерий:** Тест: 1000 prefetch → в dev `stats().timers` (или мок setTimeout) = 1, не 1000. Тест: `resource(url, {cache:{cacheTime: Infinity}})`, dispose, через 50 мс `_resourceCache.has(url) === true` (сейчас false). Микробенч: 10k release/retain пар ≤ 1 мс (сейчас 10k setTimeout+clearTimeout ≈ 8–15 мс в Chrome).

**Источники:** Redis expire: lazy + active sampling expiry; Kafka/Netty hashed timing wheel (идея одного coarse-тика); HTML Standard timers: timeout clamped to 32-bit signed

## 💎 #80 — _share без churn: аллоцировать копию только при первом отличии + порог узлов

**Impact:** 3 · **Effort:** S · **Size:** ≈ +60–90 B gzip

**Сейчас:** _share (3509–3524) всегда создаёт `out` (3516) для каждого plain-объекта/массива и заполняет его, даже если в конце `equal` → `return prev`. На ревалидации 10k строк × 2 вложенных объекта это 30 001 временный объект и 8 мс на каждый одинаковый ответ (revalidateOn focus каждые 5 с при активной вкладке — в admin.html три cached-ресурса). Для offline (8087) и infiniteResource (6097) то же самое.

**Предложение:** Ленивая копия: обходить детей, сравнивать результат с prev[k]; `out` создаётся только когда встретился первый отличающийся ребёнок (или длина/набор ключей отличаются), с копированием уже пройденного префикса из prev. При полном равенстве — ноль аллокаций, кроме массива `Object.keys(next)`. Плюс страховка от O(n) обхода гигантских payload: `share: { maxNodes: 50_000 }` — счётчик посещённых узлов, при превышении вернуть `next` как есть (лучше потерять identity, чем тратить 50 мс main-thread на каждый ответ).

**Алгоритм:**

```js
function _share(prev, next, budget = { n: 50_000 }) {
  if (prev === next || --budget.n < 0) return next;
  const arr = Array.isArray(next);
  if (!((Array.isArray(prev) && arr) || (_isPlain(prev) && _isPlain(next)))) return next;
  const keys = arr ? null : Object.keys(next);
  const len = arr ? next.length : keys.length;
  let out = (arr ? prev.length : Object.keys(prev).length) !== len ? (arr ? new Array(len) : {}) : null;
  for (let i = 0; i < len; i++) {
    const k = arr ? i : keys[i];
    const v = _share(prev[k], next[k], budget);
    if (!out && v !== prev[k]) {                       // первое отличие → копия с префиксом
      out = arr ? new Array(len) : {};
      for (let j = 0; j < i; j++) { const kj = arr ? j : keys[j]; out[kj] = prev[kj]; }
    }
    if (out) out[k] = v;
  }
  return out || prev;
}
// share.mjs (node): n=10000 строк, diff=0: сейчас 30 001 аллокаций / 7.5 мс → lazy 0 аллокаций / 4.6 мс;
// diff=1: 30 001 → 2 аллокации; diff=1000: 30 001 → 945. n=1000: 3001 → 0 / 2 / 95 аллокаций.
// Churn-байты за ревалидацию (формула): Σ_nodes (24 + 8·keys) ≈ 10k × (24+8·8) + 20k × (24+8·2) ≈ 1.7 MB мусора на ответ → 0.
```

**API:**

```js
Без изменения сигнатуры. Новая опция:
  resource(url, { cache: true, share: { maxNodes: 20_000 } })   // или share: false как сейчас
В d.ts: `share?: boolean | { maxNodes?: number }`.
```

**Критерий:** Тест: `_share(a, deepClone(a)) === a` и счётчик аллокаций (мок через Proxy на Array/Object невозможен — считать через `performance.memory` delta в Chrome ≤ 50 KB для 10k строк; сейчас ≈ 1.7 MB) или через инструментированную копию функции в test.html. Время на 10k строк ≤ 5 мс (сейчас 7.5). Список list() при ревалидации не пересоздаёт DOM-строки — уже покрыто тестом, должен остаться зелёным.

**Источники:** TanStack Query replaceEqualDeep (тот же алгоритм, но с копией — известная жалоба на аллокации); SWR dequal; Immer structural sharing (copy-on-write, лениво)

## 💎 #81 — Реакция на memory pressure: бюджет от deviceMemory, WeakRef-ghost-tier для вытесненных, сброс на freeze/hidden

**Impact:** 4 · **Effort:** M · **Size:** ≈ 250–300 B gzip (WeakRef/FinalizationRegistry — feature-detect, без полифилла)

**Сейчас:** Единственная адаптация к устройству — prefetchOn понижает hover→tap при saveData/2g (5929–5930). Нет чтения navigator.deviceMemory, нет обработчиков `freeze`/`pagehide`, нет WeakRef/FinalizationRegistry (grep: 0 совпадений). Скрытая вкладка держит все записи 5 минут на полном бюджете; Chrome Memory Saver затем выгружает вкладку целиком — кэш теряется весь сразу.

**Предложение:** Три уровня. (1) Бюджет по умолчанию: `maxBytes = clamp(round((navigator.deviceMemory ?? 4) × 2 MB), 2 MB, 16 MB)` — на 0.5 GB-устройстве 2 MB, на 8 GB — 16 MB. (2) Ghost-tier: вытесненная по бюджету запись не исчезает, а кладётся в `_ghosts: Map<key, WeakRef<entry>>`; _cacheEntry при промахе сначала пробует `_ghosts.get(key)?.deref()` — если движок ещё не собрал объект, это мгновенное попадание (0 байт учёта: память принадлежит GC, сам GC — сигнал давления). FinalizationRegistry чистит ключ из _ghosts. (3) События: `document.addEventListener('freeze')` и `visibilitychange→hidden` + 60 с → бюджет ×0.25 (вытеснить idle до четверти), при `visible` — вернуть; на `pagehide` с `persisted=false` ничего не делать (страница умирает). Опционально в dev: `performance.measureUserAgentSpecificMemory()` (только crossOriginIsolated) для калибровки _sizeOf.

**Алгоритм:**

```js
const _ghosts = new Map();
const _reg = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(k => { if (_ghosts.get(k)?.deref() === undefined) _ghosts.delete(k); }) : null;
function _demote(e) { if (!_reg) return; _ghosts.set(e.key, new WeakRef(e)); _reg.register(e, e.key); }
function _cacheEntry(key, initial) {
  let e = _resourceCache.get(key);
  if (!e) {
    const g = _ghosts.get(key)?.deref();
    if (g) { _ghosts.delete(key); e = g; _resourceCache.set(key, e); _cacheBytes += e.bytes; _stats.ghostHits++; _evict(); }
  }
  …
}
let _budgetScale = 1;
const _pressure = (scale) => { _budgetScale = scale; _evict(); };
document.addEventListener('freeze', () => _pressure(0.25));
document.addEventListener('resume', () => _pressure(1));
document.addEventListener('visibilitychange', () => {
  clearTimeout(_hideT);
  if (document.hidden) _hideT = setTimeout(() => _pressure(0.25), 60_000); else _pressure(1);
});
// эффективный бюджет: _cacheBudget * _budgetScale
// Оценка: ghost-hit вероятность ≈ P(major GC не случился с момента вытеснения); V8 major GC в idle-вкладке — редко (минуты), в активной с 8+ MB churn — секунды; т.е. ghost спасает именно «ре-визит через 2–10 с» (назад/вперёд по страницам), стоит 0 байт бюджета.
```

**API:**

```js
configure({ cache: { maxBytes: 'auto' | number, onPressure: (scale) => {} } })   // 'auto' = f(deviceMemory), по умолчанию
cacheStats().ghostHits   // сколько промахов спасено ghost-tier
// отладка: stats().memory = performance.memory?.usedJSHeapSize (Chrome, best-effort)
```

**Критерий:** Тест (Chrome, `--js-flags=--expose-gc`): вытеснить запись по бюджету, сразу запросить снова → `cacheStats().ghostHits === 1`, fetch не выполнен (мок fetcher). После `gc()` → deref() undefined, _ghosts.size === 0 (через FinalizationRegistry; проверять с ожиданием ≤ 100 мс). Тест: dispatch `freeze` → `cacheStats().bytes ≤ 0.25·budget`. Демо admin.html в DevTools → Memory → heap snapshot скрытой вкладки через 61 с: retained size по `cache:*:data` сигналам ≤ 25 % от активного состояния.

**Источники:** Page Lifecycle API (freeze/resume, Chrome ≥ 68); Device Memory API (navigator.deviceMemory, Chrome/Edge); TC39 WeakRef + FinalizationRegistry (ES2021; паттерн «weak cache tier» из proposal-weakrefs README); performance.measureUserAgentSpecificMemory (W3C WICG)

## 💎 #82 — Offline-очередь: O(1) enqueue (запись на мутацию) и байтовая квота через _sizeOf + storage.estimate()

**Impact:** 3 · **Effort:** M · **Size:** ≈ +120–180 B gzip

**Сейчас:** _enqueueOffline (7980–7991) читает весь массив `__aegis_mutations__` из IDB, push, пишет весь массив обратно — два structured clone размера O(n·body) на каждую мутацию, лимит _MAX_QUEUE=1000 (7952) только по числу. _flushOffline (7994–8028) аналогично переписывает остаток целиком. Кэш ресурсов в IDB (`store.set(url, {data, timestamp})`, 8088) не имеет ни лимита, ни вытеснения — растёт до квоты браузера, после чего set() тихо падает (`.catch(() => {})`).

**Предложение:** Хранить каждую мутацию отдельной записью с сортируемым ключом `__m__` + seq (16-значный padStart от Date.now()·1000+счётчик) — enqueue = один put O(1); flush = `getAll(IDBKeyRange.bound('__m__', '__m__￿'))` один раз, удаление выполненных по ключу. Квота очереди — по байтам (`_sizeOf(body)`, лимит 2 MB по умолчанию) с дропом самых старых (как сейчас shift, но O(1)). Для IDB-кэша ресурсов: `{data, timestamp, bytes}` + периодический (при каждом 20-м set) прогон `navigator.storage.estimate()`; если usage/quota > 0.8 — удалить старые записи по timestamp до 0.6 (getAll ключей + сортировка по timestamp, O(k log k), k = число записей, редко).

**Алгоритм:**

```js
// enqueue: O(1)
let _mseq = 0;
async function _enqueueOffline(m, store) {
  const k = '__m__' + String(Date.now() * 1000 + (_mseq = (_mseq + 1) % 1000)).padStart(16, '0');
  m.bytes = _sizeOf(m.body);
  await store.set(k, m).catch(() => {});
  _queueBytes += m.bytes;
  if (_queueBytes > _QUEUE_MAX_BYTES) await _trimQueue(store);   // getAllKeys + delete старых, редко
  …Background Sync как сейчас
}
// flush: один getAll + point deletes
const all = await store.getAll(IDBKeyRange.bound('__m__', '__m__￿'));
for (const m of all) { try { await withRetry(...); await store.delete(m.key); } catch { /* остаётся */ } }
// Замер queue.mjs (structuredClone ×2 на enqueue, body 900 B): n=100: 29.8 мс, 5 MB клонов; n=1000: 3105 мс, 503 MB клонов
// per-record: n=1000: 6.6 мс, 1 MB — 470× меньше времени, 500× меньше клонов. Сложность: O(n²·b) → O(n·b) за всю серию.
```

**API:**

```js
resource(url, { offline: { maxQueueBytes: 2 << 20, maxStoreBytes: 20 << 20 } })
configure({ offline: { maxQueueBytes, maxStoreBytes } })   // глобально
offlineStats() → { queued, queueBytes, storeBytes, quota: { usage, quota } }   // usage/quota из storage.estimate()
// Совместимость: при первом flush мигрировать старый ключ __aegis_mutations__ (массив) в per-record формат.
```

**Критерий:** Тест (fake-indexeddb или браузерный test.html): 1000 send() офлайн → суммарное время enqueue ≤ 50 мс (сейчас ≈ 3 с в node-модели; в IDB ещё хуже из-за транзакций); после online — все 1000 отправлены, `offlineStats().queued === 0`. Тест квоты: 3 мутации по 1 MB при maxQueueBytes 2 MB → в очереди 2, самая старая удалена.

**Источники:** Workbox background-sync Queue (одна IDB-запись на request, cursor-based flush); IndexedDB IDBKeyRange.bound для префиксных сканов; StorageManager.estimate() (Storage Standard)

## 💎 #83 — infiniteResource: окно maxPages — O(maxPages) памяти вместо O(всех страниц)

**Impact:** 2 · **Effort:** S · **Size:** ≈ +100 B gzip

**Сейчас:** infiniteResource (6070–6117): `pages` копит все ответы целиком (включая конверты `{items, next}`), `data = computed(() => pages.value.flatMap(select))` (6079) пересобирает плоский массив O(N_total) на каждый loadMore, а `_share(pages, [...pages, result])` (6097) создаёт новый массив страниц. Лента на 200 страниц × 50 элементов × ~400 B = 4 MB в pages + 80 KB индексов в data, и растёт без предела; virtual scroll (секция 32) сокращает DOM, но не данные.

**Предложение:** Опция `maxPages` (по умолчанию Infinity — поведение прежнее): при превышении отбрасывать страницы с противоположного конца, запоминая курсор отброшенной головы (`firstCursor`) для `loadPrev()`. Память ограничена maxPages × размер страницы; `data` — тот же flatMap, но по окну (O(maxPages·pageSize)). Размер страницы учитывать через _sizeOf для `cacheStats()`.

**Алгоритм:**

```js
const win = (arr) => arr.length > maxPages ? arr.slice(arr.length - maxPages) : arr;
// в loadMore после ответа:
batch(() => {
  const next = [...pages.peek(), result];
  if (next.length > maxPages) { prevCursor.value = getPrevCursor(next[0]); }   // курсор для loadPrev
  pages.value = share ? _share(pages.peek(), win(next)) : win(next);
  cursor.value = getNext(result);
});
// Память: bytes ≤ maxPages × E[_sizeOf(page)]; flatMap: O(maxPages·pageSize) вместо O(N_total).
// Пример: 200 страниц × 50 × 400 B = 4 MB → maxPages 10: 200 KB (20×).
```

**API:**

```js
infiniteResource(urlFor, { maxPages: 10, getPrev: r => r.prev ?? null })
// extra: { pages, hasMore, hasPrev, loadMore, loadPrev, reset }
d.ts: `maxPages?: number` (default Infinity), `getPrev?`, `loadPrev(): Promise<void>`.
```

**Критерий:** Тест: 30 loadMore с maxPages 10 → `feed.pages.value.length === 10`, `feed.data.value.length === 10·pageSize`, `hasPrev.value === true`, loadPrev возвращает страницу 20. Бенч: 200 страниц по 50 элементов — время loadMore не растёт с числом страниц (p99 ≤ 2× p50; сейчас flatMap линейно растёт).

**Источники:** TanStack Query useInfiniteQuery maxPages (v5) + bidirectional getPreviousPageParam; Apollo relayStylePagination (окно по edges)


---

# 📐 consistency-versions

**Линза:** math / consistency-versions — версии, порядок optimistic-обновлений, согласованность кэша между вкладками и офлайн-очередью, формальные инварианты

**Вывод:** Слой данных Aegis не имеет понятия «версия»: у CacheEntry нет счётчика записей, у optimistic-обновлений — снимок-и-восстановление (стек, не граф), у офлайн-очереди — mutId, который никуда не отправляется, а invalidate() во время in-flight запроса просто присоединяется к старому промису. Симуляция (scratchpad/agents/consistency-versions/sim.js) показывает: при 2–3 конкурентных мутациях snapshot-rollback даёт неверный итог в 44% случаев (70%, если между стартом и откатом успел прийти SWR-refetch); invalidate во время in-flight оставляет кэш stale в 100% случаев; конкурентный _enqueueOffline теряет все записи кроме одной (из 20 выживает 1); фаззинг модели CacheEntry находит ~15 тыс. нарушений инвариантов на 100 тыс. шагов (inflight≠«есть запрос», refCount≠числу подписчиков, GC живой записи). Все семь предложений реализуемы в одном файле на ваниле, суммарно ≈2.5–3 KB gzip, и превращают неявные ожидания в проверяемые инварианты: data = fold(base, pending); после invalidate — данные из fetch, начатого после него; очередь — append-only с идемпотентными ключами и причинным порядком по cacheKey.

**Отвергнуто:** Vector clocks для кэша между вкладками — избыточны: ключ имеет единственный источник истины (сервер), нужен лишь total order для LWW, который даёт (Lamport v, tabId). CRDT для данных ресурса (LWW-map/OR-set поверх ответов) — размер (+2–3 KB) и семантика «слияние без сервера» противоречат server-first. Полный JSON Patch (RFC 6902) для офлайн-патчей — именованные мутаторы (предложение 5) короче и выразительнее для списков. Hash/canonicalization ключей и публичный cache API — уже в известных пробелах, не повторял. Полноценный per-key mutex (Web Locks API) для очереди — не нужен, если каждая мутация отдельная IDB-запись (put атомарен). Полный OT/операционные преобразования для конфликтов — merge3 покрывает CRUD-формы, дальше — ответственность приложения. Сохранение optimistic-патчей SWR-кэша (предложение 1) в storage — не нужно: только offline-ресурс переживает reload, для него это предложение 5.

## 💎 #84 — Patch-log вместо snapshot-rollback: data = fold(base, pendingPatches)

**Impact:** 5 · **Effort:** M · **Size:** +350–450 B gzip (recompute, контекст, commit); снимки resources.map уходят (−60 B)

**Сейчас:** aegis_full.js:3710 `const snapshots = resources.map(r => r.data.peek())` и :3722 `resources.forEach((r, i) => r.mutate(snapshots[i]))` — откат восстанавливает снимок, сделанный при старте этой мутации. Два разных mutation()-объекта на одном ресурсе (demo/admin.html:114 remove и :120 create оба трогают users) или concurrent:'parallel' образуют стек: откат M1 стирает optimistic M2; откат после SWR-revalidate (`_fetchEntry` :5836 или `_installRevalidate`) затирает свежие серверные данные снимком. Сам resource.mutate (:5996, :6010, _plainResource) пишет прямо в data.

**Предложение:** Хранить у ресурса/CacheEntry `base` (последнее серверное значение или прямой mutate) и упорядоченный список `patches: [{id, fn}]`; `data` пересчитывается как fold. mutation() перед вызовом `optimistic` выставляет модульный контекст `_optCtx = {id}`; resource.mutate(fn), увидев контекст, регистрирует патч вместо прямой записи — публичный API optimistic не меняется. Успех → патч удаляется после того, как invalidates-refetch записал новый base (или сразу, если invalidates нет: `base = fn(base)`); ошибка → патч удаляется, fold пересчитывает; приход серверных данных → base = next, патчи переигрываются поверх (rebase, как в Replicache). Плюс `mutation(fn, { optimistic, commit: (result, data) => data })` — заменить temp-элемент серверным ответом без refetch.

**Алгоритм:**

```js
// в CacheEntry / _plainResource
e.base = initial; e.patches = [];
const recompute = (e) => { let v = e.base; for (const p of e.patches) v = p.fn(v); e.data.value = v; };

// resource.mutate
let _optCtx = null;
const mutate = (fn) => {
  const f = typeof fn === 'function' ? fn : () => fn;
  if (_optCtx) { e.patches.push({ id: _optCtx.id, fn: f, res: e }); _optCtx.owned.push(e); }
  else e.base = f(e.base);
  recompute(e);
};

// _fetchEntry success (:5836)
e.base = share ? _share(e.base, next) : next; recompute(e);

// mutation.exec
const id = ++_mutSeq, ctx = { id, owned: [] };
_optCtx = ctx; try { batch(() => optimistic(...args)); } finally { _optCtx = null; }
const drop = () => ctx.owned.forEach(r => { r.patches = r.patches.filter(p => p.id !== id); recompute(r); });
try {
  const result = await fn(...args, { signal });
  if (commit) ctx.owned.forEach(r => { r.base = commit(result, r.base); });
  if (invalidates) await Promise.all([].concat(invalidates).map(invalidate)); // патч живёт до прихода base
  else ctx.owned.forEach(r => { r.base = r.patches.find(p => p.id === id).fn(r.base); });
  drop();
} catch (e) { drop(); throw e; }
// Инвариант: ∀t data(t) = fold(base(t), patches(t)); откат любого патча не влияет на остальные.
```

**API:**

```js
// без изменений в вызовах:
const remove = mutation(id => api.delete(`/api/users/${id}`), {
  optimistic: id => users.mutate(d => ({ ...d, items: d.items.filter(u => u.id !== id) })),
  invalidates: '/api/users',
});
// новое: заменить temp серверным ответом без refetch
const add = mutation(text => api.post('/api/todos', { text }), {
  optimistic: text => todos.mutate(l => [...l, { id: 'tmp', text }]),
  commit: (created, list) => list.map(t => t.id === 'tmp' ? created : t),
});
// dev: r.pending.value → число незавершённых патчей (для dimming)
```

**Критерий:** sim.js, 100 000 сценариев с 2–3 конкурентными мутациями: snapshot-rollback ошибается в 43 880 (43.9%), при refetch между стартом и откатом — в 69 711 (69.7%); patch-log — 0. Тест в test.html: два mutation() на одном cached-ресурсе, первое падает после успеха второго → data содержит элемент второго; SWR-refetch между start и fail → data === серверный ответ.

**Источники:** Replicache «rebase pending mutations on server snapshot»; TanStack Query mutation lifecycle (onMutate context / rollback per-mutation); Linear sync engine (optimistic transactions log); Apollo optimisticResponse layers (каждая мутация — отдельный слой поверх cache).

## 💎 #85 — Fetch-эпохи: invalidate()/refresh() во время in-flight помечают запись dirty, а не присоединяются к старому промису

**Impact:** 5 · **Effort:** S · **Size:** +120–180 B gzip

**Сейчас:** aegis_full.js:5821 `if (e.promise) return e.promise;` — dedupe срабатывает и при force=true. invalidate() (:6055–6059) после успешной мутации, пока идёт revalidate начатый ДО мутации, просто ждёт старый ответ: кэш получает pre-mutation данные и lastFetch = now, повторного запроса не будет до следующего focus. Плюс :5842 `e.inflight.value = false` безусловно — после abort()+refresh() (:5998 обнуляет controller/promise) finally старого запроса гасит inflight, пока новый ещё летит.

**Предложение:** Ввести `e.epoch` (счётчик стартов) и `e.dirty`. `_fetchEntry(force=true)` при in-flight: `e.dirty = true`, вернуть промис, который резолвится после ПОВТОРНОГО запроса (цепочка). В finally: `if (e.controller === controller) {...}`, `inflight = false` только если контроллер текущий; если `e.dirty` — запустить новый fetch сразу. Опция `invalidate(key, { cancel: true })` — abort in-flight и старт нового (TanStack cancelRefetch). Инвариант: после `await invalidate(k)` выполняется `e.fetchStartedAt >= t_invalidate`.

**Алгоритм:**

```js
function _fetchEntry(e, url, fopts, force = false) {
  if (!url) return Promise.resolve();
  e.url = url; e.fopts = fopts;
  if (!force && Date.now() - e.lastFetch < (fopts.staleTime || 0)) return Promise.resolve();
  if (e.promise) {
    if (!force) return e.promise;
    if (fopts.cancel) { e.controller.abort(); }                // cancelRefetch
    else { e.dirty = true; return e.promise.then(() => e.promise || Promise.resolve()); } // ждём rerun
  }
  const epoch = ++e.epoch, controller = new AbortController(); e.controller = controller;
  batch(() => { e.inflight.value = true; e.started.value = true; e.error.value = null; });
  e.promise = _trackPromise((async () => {
    try {
      const result = await withRetry(...);
      if (controller.signal.aborted || e.epoch !== epoch) return;   // устаревшая эпоха не пишет
      e.base = ...; recompute(e); e.lastFetch = Date.now();
    } catch (err) { if (e.epoch === epoch && !controller.signal.aborted) e.error.value = err; }
    finally {
      if (e.epoch === epoch) { e.controller = null; e.promise = null; e.inflight.value = false;
        if (e.dirty) { e.dirty = false; _fetchEntry(e, e.url, e.fopts, true); } }
    }
  })());
  return e.promise;
}
// invalidate возвращает Promise.all по совпавшим entry — mutation.invalidates может await
```

**API:**

```js
invalidate('/api/users');                    // как раньше; теперь Promise<void>
invalidate('/api/users', { cancel: true });  // abort in-flight, новый запрос сразу
await users.refresh();                        // гарантированно данные запроса, начатого после вызова
// d.ts: invalidate(key, opts?: { cancel?: boolean }): Promise<void>
```

**Критерий:** sim.js B: 1000 сценариев «fetch → мутация на сервере → invalidate во время in-flight»: сейчас stale 1000/1000, с dirty-эпохой 0/1000. Тест: fetcher с управляемым промисом; refresh() в полёте → ровно 2 запроса, финальный data — второй ответ; abort()+refresh() → validating.value === true до конца второго запроса (сейчас false).

**Источники:** TanStack Query invalidateQueries({ cancelRefetch }) и «fetch epoch» в QueryObserver; SWR mutate() с revalidate после in-flight; паттерн generation counter (Go sync.singleflight «forget»).

## 💎 #86 — Межвкладочная когерентность SWR-кэша: BroadcastChannel + Lamport-метка (v, tabId) с LWW

**Impact:** 4 · **Effort:** M · **Size:** +400–500 B gzip

**Сейчас:** `_resourceCache` (:5736) живёт в памяти вкладки; invalidate() (:6055) и mutation.invalidates обходят только её; `_installRevalidate` (:5851) перезапрашивает по focus каждую вкладку отдельно — N вкладок = N запросов на один ключ. Кросс-вкладочная синхронизация есть только у persisted() через событие storage (:4102), кэш ресурсов её не имеет. У CacheEntry нет счётчика версии — нечем сравнивать «чьё свежее».

**Предложение:** Добавить `e.v` (Lamport-счётчик, инкремент при каждой записи data: fetch/mutate/seed) и `_tabId` (случайная строка). Один `BroadcastChannel('aegis:cache')` (ленивый, при первом cached-ресурсе). После записи серверных данных — `post({t:'set', key, data, v, lastFetch, tab})`; после invalidate — `post({t:'inv', key})`. Приём: `set` применяется, если `(msg.v, msg.tab) > (e.v, _tabId)` лексикографически → `e.base = data; e.v = msg.v; e.lastFetch = msg.lastFetch` (без сетевого запроса, structural sharing сохраняет identity); `inv` → `e.lastFetch = 0` и refetch только если refCount>0 и текущая вкладка visible (одна видимая вкладка делает запрос, остальные получают set). Optimistic-патчи (предложение 1) не бродкастятся — только base. Опция `cache: { sync: false }` отключает.

**Алгоритм:**

```js
const _tabId = Math.random().toString(36).slice(2, 8);
let _bc = null;
const _chan = () => _bc ?? (_bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('aegis:cache') : { postMessage() {} });
const _later = (a, b) => a.v > b.v || (a.v === b.v && a.tab > b.tab);   // total order на (v, tab)

function _writeBase(e, data, lastFetch, from) {          // единственная точка записи серверных данных
  e.v = Math.max(e.v, from?.v ?? 0) + 1;                   // Lamport receive/send rule
  e.base = _share(e.base, data); e.lastFetch = lastFetch; recompute(e);
  if (!from) _chan().postMessage({ t: 'set', key: e.key, data, v: e.v, tab: _tabId, lastFetch });
}
_chan().onmessage = ({ data: m }) => {
  const e = _resourceCache.get(m.key); if (!e) return;
  if (m.t === 'set' && _later(m, { v: e.v, tab: _tabId })) _writeBase(e, m.data, m.lastFetch, m);
  if (m.t === 'inv') { e.lastFetch = 0; if (e.refCount > 0 && document.visibilityState === 'visible') _fetchEntry(e, e.url, e.fopts, true); }
};
// invalidate(): после локальной обработки → _chan().postMessage({ t: 'inv', key })
// _installRevalidate tick('focus'): если Date.now() - e.lastFetch < 1000 (только что пришёл set из другой вкладки) — пропустить
```

**API:**

```js
resource('/api/users', { cache: true });                 // sync между вкладками по умолчанию
resource('/api/me', { cache: { sync: false } });        // не делиться
invalidate('/api/users');                               // инвалидирует во всех вкладках
// dev-панель: столбец v/tab в списке entries
```

**Критерий:** Тест в test.html с двумя BroadcastChannel в одном документе (второй эмулирует вкладку): после мутации в «A» запись в «B» получает data без вызова fetcher (счётчик fetcher === 1, не 2); при одновременных set из A и B итог одинаков в обеих (LWW детерминирован по (v, tab)). Метрика в demo: 3 вкладки admin.html, переключение фокуса — запросов /api/users на focus стало 1 вместо 3.

**Источники:** Lamport «Time, Clocks, and the Ordering of Events» (1978) — счётчик + tie-break по id даёт total order; SWR/TanStack Query broadcastQueryClient (experimental, BroadcastChannel); persisted() в самом Aegis (:4102) как прецедент cross-tab. Vector clocks отвергнуты: сервер — единственный источник истины, конкурентные записи одного ключа не нуждаются в обнаружении «параллельности», достаточно LWW.

## 💎 #87 — Офлайн-очередь как append-only лог: атомарный enqueue, Idempotency-Key, причинный порядок по cacheKey, dead-letter

**Impact:** 5 · **Effort:** M · **Size:** +500–600 B gzip (коалесценция ≈ +150 из них, opt-in)

**Сейчас:** _enqueueOffline (:7980–7985): `get(_QUEUE_KEY) → push → set` — read-modify-write одного IDB-ключа, два send() в одной вкладке или из двух вкладок теряют записи. mutId (:8120) генерируется, но серверу не передаётся; при `_isNetworkError` (:8131) после того, как сервер уже применил POST, а ответ потерян, повтор из очереди создаёт дубль. _flushOffline (:8006–8013): любая ошибка → `remaining.push(m)` — 400/409/422 крутятся вечно с backoff до 60 с; после провала POST /items следующий PATCH /items/tmp всё равно отправляется (нет причинности); `executed` (:8007) — Set в пределах одного flush, реального дедупа нет.

**Предложение:** (1) Каждая мутация — своя IDB-запись `mut:<lamport-seq>:<tabId>` (put атомарен), flush читает `getAllKeys()` отсортированными; `_QUEUE_KEY`-массив читается один раз для миграции. (2) Заголовок `Idempotency-Key: mutId` в request() при повторе и в первом send (сервер Stripe-style/Django-idempotency дедуплицирует). (3) В flush — `blocked: Set<cacheKey>`: провал m блокирует все последующие с тем же cacheKey (FIFO per key, параллельно между ключами). (4) Классификация: сетевые/5xx/408/429 → остаются; 4xx → dead-letter: удалить, положить в `_offlineFailed` (сигнал-массив) и вызвать `opts.onConflict(m, err)`; счётчик `m.attempts`, лимит `maxAttempts` (default 10). (5) Коалесценция: перед flush схлопнуть подряд идущие PUT/DELETE на один (method,url) — остаётся последний; PATCH — shallow-merge тел (opt-in `coalesce: true`).

**Алгоритм:**

```js
// enqueue: атомарно, без RMW
let _mutSeq = 0;
async function _enqueueOffline(m, store) {
  m.seq = `${String(Date.now()).padStart(13,'0')}:${String(++_mutSeq).padStart(4,'0')}:${_tabId}`;
  m.attempts = 0;
  await store.set('mut:' + m.seq, m);   // IDB put — атомарен, порядок = лексикографический seq
}
// flush
const keys = (await store.keys()).filter(k => k.startsWith('mut:')).sort();
const blocked = new Set(); const touched = new Set();
for (const k of keys) {
  const m = await store.get(k); if (!m) continue;
  if (blocked.has(m.cacheKey)) continue;                       // причинность: FIFO внутри cacheKey
  try {
    await request(m.url, { method: m.method, body: m.body, headers: { 'Idempotency-Key': m.mutId } });
    await store.delete(k); touched.add(m.cacheKey);
  } catch (e) {
    if (!_isNetworkError(e) || ++m.attempts >= maxAttempts) { await store.delete(k); _offlineFailed.value = [..._offlineFailed.peek(), { m, error: e }]; onConflict?.(m, e); }
    else await store.set(k, m);
    blocked.add(m.cacheKey);
  }
}
// coalesce (opt-in): for i>0: if same (method,url) && method in PUT|DELETE → drop prev; PATCH → prev.body = {...prev.body, ...m.body}, drop m
// Инварианты: |queue| == число enqueue − число delete (нет потерь); ∀k: порядок отправки внутри cacheKey == порядок enqueue; повтор с тем же Idempotency-Key ≤ 1 side-effect на сервере.
```

**API:**

```js
const todos = resource('/api/todos', { offline: { coalesce: true, maxAttempts: 10, onConflict: (m, err) => toast(`Не удалось: ${m.method} ${m.url}`) } });
todos.send('POST', '/api/todos', item, { optimistic: l => [...l, item] });   // уходит с Idempotency-Key
todos.failed  // ReadonlySignal<Array<{ m, error }>> — dead-letter для UI «повторить/отменить»
todos.retryFailed(m); todos.dropFailed(m);
// request(): заголовок ставится только если opts.idempotencyKey задан → сервер без поддержки просто игнорирует
```

**Критерий:** sim.js C: при 2/5/20 конкурентных enqueue сейчас выживает 1/1/1 запись, с per-record put — 2/5/20. Тесты: (а) 4xx-мутация покидает очередь после первого flush и появляется в failed (сейчас — остаётся навсегда); (б) POST падает 500 → PATCH с тем же cacheKey не отправляется в этом flush (мок-fetcher фиксирует порядок вызовов); (в) мок-сервер с дедупом по Idempotency-Key: send() при «ответ потерян» + flush → 1 объект на сервере, не 2; (г) 5 PATCH одного url с coalesce → 1 запрос.

**Источники:** IETF draft-ietf-httpapi-idempotency-key-header; Stripe Idempotent Requests; PouchDB/CouchDB replication — per-document ordering; Workbox BackgroundSync Queue (по одной записи в IDB на запрос, replayRequests); AWS SQS dead-letter queue как модель для failed.

## 💎 #88 — Сериализуемые мутаторы для offline: base и pending-патчи хранятся раздельно и переигрываются после перезагрузки

**Impact:** 4 · **Effort:** M · **Size:** +250–300 B gzip

**Сейчас:** _offlineResource.mutateLocal (:8116) пишет optimistic-состояние в IDB под ключом ресурса с `timestamp: Date.now()` — после перезагрузки loadCached считает его свежими серверными данными (staleTime уважается), хотя мутация ещё в очереди и может упасть (dead-letter из предложения 4) — данные никогда не откатятся. Обратное тоже: если очередь применилась, а refresh не успел, base в IDB — устаревший. optimistic передаётся как функция (:8119), которую нельзя сохранить в IDB, поэтому пересборка состояния после reload невозможна в принципе.

**Предложение:** Ввести именованные мутаторы `offline: { mutators: { add: (list, item) => [...], toggle: (list, id) => ... } }`. `send(method, url, body, { optimistic: ['add', item] })` сохраняет в очередь `opt: ['add', item]`. В IDB под ключом ресурса лежит только base (серверный ответ). При loadCached: `data = fold(base, queue.filter(m => m.cacheKey === key).map(m => mutators[m.opt[0]](_, ...m.opt.slice(1))))`. Успешный flush удаляет запись из очереди и refresh обновляет base; dead-letter удаляет патч → fold сам «откатывает». Это та же модель, что в предложении 1 (base + patches), но патчи персистентны, потому что представлены данными, а не замыканиями. Старый вызов с функцией остаётся (E-warning в dev: «optimistic function is not persisted»).

**Алгоритм:**

```js
// resource(url, { offline: { mutators } })
const fold = (base, ms) => ms.reduce((d, m) => { const [name, ...args] = m.opt; const f = mutators[name]; return f ? f(d, ...args) : d; }, base);
const pendingFor = async (k) => (await Promise.all((await store.keys()).filter(x => x.startsWith('mut:')).sort().map(x => store.get(x)))).filter(m => m && m.cacheKey === k && m.opt);

const loadCached = async (k) => {
  const cached = await store.get(k);                      // { data: base, timestamp }
  const pend = await pendingFor(k);
  base = cached ? cached.data : initial;
  data.value = fold(base, pend);                            // optimistic восстановлен после reload
  return cached && Date.now() - cached.timestamp < staleTime;
};
const send = async (method, url, body, { optimistic } = {}) => {
  const m = { mutId, method, url, body, cacheKey, opt: Array.isArray(optimistic) ? optimistic : null };
  if (m.opt) data.value = fold(data.peek() /* уже fold */, [m]);   // применить локально
  else if (typeof optimistic === 'function') { data.value = optimistic(data.peek()); _dev() && _warn('E0xx', {...}); }
  ...enqueue / request как раньше; base в IDB НЕ трогаем
};
// fetchRemote success: base = next; store.set(url, { data: next, timestamp }); data.value = fold(base, await pendingFor(url));
// dead-letter из flush: refresh() ресурса → fold без упавшего патча = автоматический откат
// Инвариант (персистентный): IDB[key].data == последний серверный ответ; data.value == fold(IDB[key].data, queue[key])
```

**API:**

```js
const todos = resource('/api/todos', {
  offline: { mutators: {
    add:    (list, item) => [...list, item],
    toggle: (list, id) => list.map(t => t.id === id ? { ...t, done: !t.done } : t),
    remove: (list, id) => list.filter(t => t.id !== id),
  } },
});
todos.send('POST', '/api/todos', item, { optimistic: ['add', item] });
todos.send('PATCH', `/api/todos/${id}`, { done: true }, { optimistic: ['toggle', id] });
// d.ts: OfflineOptions.mutators?: Record<string, (data: T, ...args: any[]) => T>; optimistic?: [name: string, ...args] | ((d: T) => T)
```

**Критерий:** Тест: send() офлайн с ['add', item] → эмулировать reload (новый resource() на том же ключе, in-memory _idb-мок) → data содержит item, IDB[key].data — не содержит; flush с 4xx → data после refresh без item (откат без кода в приложении); flush с 200 → base обновлён, очередь пуста. Инвариант проверяется прямым сравнением JSON после каждого шага: JSON(data) === JSON(fold(idb[key].data, queue)).

**Источники:** Replicache (named mutators, `rebase` pending mutations on new server snapshot, mutations persist as {name,args}); Linear sync engine; Redux-offline (`meta.offline.effect` + rollback/commit actions, сериализуемые); Event sourcing: state = fold(events).

## 💎 #89 — Обнаружение конфликтов при одновременных мутациях: version/ETag + If-Match + onConflict с 3-way merge

**Impact:** 4 · **Effort:** M · **Size:** +450–550 B gzip (merge3 ≈ 200)

**Сейчас:** request() (:1340–1380) не знает о версиях: нет If-Match/ETag, HttpError 409/412 обрабатывается как любая ошибка → mutation() (:3720) откатывает optimistic и всё. Ресурс не хранит версию данных; в demo/admin.html:156 `save = mutation(v => api.put('/api/users/'+id, v))` — «последний PUT побеждает», правки второго админа молча теряются. В офлайн-очереди (:8006) мутация, сделанная на основе данных 3-дневной давности, применяется поверх свежих без проверки.

**Предложение:** (1) CacheEntry получает `e.etag` и `e.version`: `request({ meta: true })`/fetcher-обёртка возвращает ETag из ответа (defaults.fetcher по умолчанию кладёт его в `e.etag`; для JSON-тел — `opts.version: d => d.updated_at`). (2) mutation(fn, { resources: [r], precondition: true }) прокидывает `{ signal, etag, version }` в fn; `api.put(url, body, { ifMatch: etag })` ставит `If-Match`. (3) HttpError 409/412 → `onConflict({ local, server, base }) → 'server' | 'client' | merged` (server — берём серверные данные, дропаем патч; client — повтор с новым etag; merged — отправить результат мерджа). Дефолт — `'server'` + warning в dev. (4) Встроенная `merge3(base, local, server)` для plain-объектов: поле берётся из local, если local[k] !== base[k], иначе из server; конфликт (оба изменили по-разному) → в `conflicts[]`, побеждает server. (5) В офлайн-очередь пишется `baseVersion` при enqueue; 412 при flush → dead-letter + onConflict (не вечный retry).

**Алгоритм:**

```js
function merge3(base, local, server) {
  if (!_isPlain(base) || !_isPlain(local) || !_isPlain(server)) return local !== base ? local : server;
  const out = { ...server }, conflicts = [];
  for (const k of new Set([...Object.keys(local), ...Object.keys(base)])) {
    const lc = local[k] !== base[k], sc = server[k] !== base[k];
    if (lc && !sc) out[k] = local[k];
    else if (lc && sc && JSON.stringify(local[k]) !== JSON.stringify(server[k])) {
      if (_isPlain(local[k]) && _isPlain(server[k]) && _isPlain(base[k])) { const r = merge3(base[k], local[k], server[k]); out[k] = r.value; conflicts.push(...r.conflicts.map(c => k + '.' + c)); }
      else conflicts.push(k);                       // server wins по умолчанию
    }
  }
  return { value: out, conflicts };
}
// mutation.exec
const ctx = { signal, etag: r?.etag, version: fopts.version?.(r?.base) };
try { result = await fn(...args, ctx); }
catch (e) {
  if ((e.status === 412 || e.status === 409) && onConflict) {
    const server = e.data ?? await r.refresh().then(() => r.base);
    const verdict = onConflict({ base: snapshotBase, local: r.data.peek(), server, merge: () => merge3(snapshotBase, r.data.peek(), server) });
    if (verdict === 'client' || (verdict && verdict !== 'server')) { ctx.etag = e.response.headers.get('ETag'); return exec(verdict === 'client' ? args : [verdict.value ?? verdict]); }
  }
  throw e;
}
// request(): if (init.ifMatch) h.set('If-Match', init.ifMatch); _defaultFetcher сохраняет response.headers.get('ETag') в WeakMap(data → etag) → _fetchEntry читает
```

**API:**

```js
const user = resource(() => `/api/users/${id.value}`, { cache: true });
const save = mutation((v, { etag }) => api.put(`/api/users/${id.value}`, v, { ifMatch: etag }), {
  resources: [user],
  optimistic: v => user.mutate(d => ({ ...d, ...v })),
  onConflict: ({ base, local, server, merge }) => {
    const { value, conflicts } = merge();
    return conflicts.length ? confirm(`Поля ${conflicts} изменены другим пользователем. Перезаписать?`) ? 'client' : 'server' : value;
  },
});
// без ETag на сервере: resource(url, { cache: { version: d => d.updated_at } }) → If-Match: "<updated_at>" или body.version
```

**Критерий:** Тест: мок-сервер с ETag; два mutation() на одном ресурсе с разными полями name/email → после конфликта merge3 даёт объект с обоими изменениями, conflicts=[]; оба меняют name → conflicts=['name'], server побеждает при verdict 'server'; 412 в офлайн-flush → запись в failed за 1 попытку (сейчас — вечный retry). Property-test merge3: ∀base,local: merge3(base, local, base).value deep-equals local; merge3(base, base, server).value deep-equals server (1000 случайных объектов, 0 нарушений).

**Источники:** RFC 9110 §13.1 If-Match / 412 Precondition Failed (optimistic concurrency control); diff3 (Khanna, Kunal, Pierce «A Formal Investigation of Diff3»); Rails lock_version / Django-concurrency; CouchDB `_rev` + 409 Conflict; Firestore transactions (read version → write with precondition).

## 💎 #90 — Формальные инварианты CacheEntry: dev-проверка после каждой операции + model-based фаззинг в test.html; idempotent dispose

**Impact:** 4 · **Effort:** S · **Size:** +250 B gzip в dev-ветке (tree-shakeable под _dev()), +20 B в prod (флаг disposed)

**Сейчас:** Инварианты нигде не записаны и не проверяются. Нарушения, которые есть в коде: (а) :5842 `e.inflight.value = false` безусловно — после abort()+refresh() inflight=false при живом запросе; (б) :6016 статический путь возвращает `{ ...e._shape, dispose }` и одновременно :6000 регистрирует dispose в scope — вызов r.dispose() + dispose scope = двойной _releaseEntry (:5767), refCount уходит ниже числа подписчиков, gcTimer удаляет запись, которой пользуется другая компонента; (в) seed()/prefetch() ставят gcTimer только `if (!e.gcTimer)`, но _retainEntry обнуляет поле, не всегда clearTimeout — путь через _releaseEntry с refCount<0. Тесты #9/#56 (test.html:1281, :3362) проверяют сценарии, а не свойства.

**Предложение:** Зафиксировать инварианты как функцию `_checkCache()` (только в dev, вызывается из _retainEntry/_releaseEntry/_fetchEntry finally/seed/invalidate под `_dev()`), и добавить в test.html model-based фаззер: мок-fetcher с ручным резолвом, 2000 случайных шагов из {new cached resource, dispose, dispose повторно, refresh, invalidate, abort, resolve fetch, reject fetch, seed, gc tick}, после каждого шага — `_checkCache()` + сравнение с эталонной моделью (Set живых подписчиков, Set in-flight). Исправить: dispose идемпотентен (флаг), inflight = (controller !== null) через epoch из предложения 2, `refCount` никогда < 0 (assert), gcTimer ⇔ refCount === 0.

Инварианты (∀ e ∈ _resourceCache):
I1 e.refCount === |{живые resource() с current===e}| ≥ 0
I2 e.refCount > 0 ⇒ e.gcTimer === null; e.refCount === 0 ⇒ e.gcTimer !== null (или entry удалена)
I3 e.inflight.value === (e.controller !== null) === (e.promise !== null)
I4 e.error.value !== null ⇒ e.inflight.value === false
I5 e.lastFetch > 0 ⇒ e.started.value === true
I6 (с предложением 1) e.data.value deep-equals fold(e.base, e.patches)
I7 (с предложением 2) после await invalidate(k): e.fetchEpochStarted > epochAtInvalidate
I8 (с предложением 3) для одного key: (e.v, tab) монотонно не убывает

**Алгоритм:**

```js
function _checkCache(where) {                       // только под _dev()
  for (const e of _resourceCache.values()) {
    const bad = [];
    if (e.refCount < 0) bad.push('I1 refCount<0');
    if (e.refCount > 0 && e.gcTimer) bad.push('I2 gcTimer while retained');
    if (e.refCount === 0 && !e.gcTimer) bad.push('I2 no gcTimer at refCount 0');
    if (e.inflight.peek() !== (e.controller !== null) || (e.controller !== null) !== (e.promise !== null)) bad.push('I3 inflight/controller/promise');
    if (e.error.peek() && e.inflight.peek()) bad.push('I4 error while inflight');
    if (e.lastFetch > 0 && !e.started.peek()) bad.push('I5 lastFetch without started');
    if (bad.length) _warn('E0xx', { what: `cache invariant broken at ${where} for "${e.key}": ${bad.join(', ')}`, why: 'Internal state desync — report with steps.', fix: '' }, 'inv:' + e.key);
  }
}
// idempotent dispose (статический путь :5999)
let disposed = false;
const dispose = () => { if (disposed) return; disposed = true; const e = current.peek(); if (e) _releaseEntry(e, cacheTime); };

// test.html: model-based fuzz
const model = { subs: new Map(), inflight: new Set() }; const pend = [];
defaults.fetcher = (u) => new Promise((res, rej) => pend.push({ u, res, rej }));
for (let i = 0; i < 2000; i++) {
  const op = pick(OPS); op(model, pend);                    // каждая op обновляет и Aegis, и модель
  _checkCache('fuzz#' + i);
  for (const [key, e] of _resourceCache) assert(e.refCount === (model.subs.get(key)?.size ?? 0), 'I1 ' + key);
}
await settled();
```

**API:**

```js
// публично: ничего нового для пользователя; в dev-панели — вкладка Cache со списком entries и колонкой «invariants: ok/BROKEN»
import { _checkCache } from './aegis_full.js';   // экспорт только в dev-сборке, tree-shake в prod
// test.html: section('cache invariants — fuzz'); 2000 шагов, ожидаем 0 предупреждений E0xx
```

**Критерий:** sim.js D: модель текущего кода за 500×200 шагов даёт 2380 нарушений I3 (inflight), 12 303 нарушений I1 (refCount после двойного dispose), 262 GC живой записи; с idempotent dispose и epoch-guard — 0/0/0. В test.html: фаззер 2000 шагов × 5 сидов → 0 warning'ов; регрессионные тесты: r.dispose() дважды не меняет refCount второго подписчика; abort()+refresh() → validating === true.

**Источники:** Model-based testing (fast-check `commands`, QuickCheck state machines — Hughes «Testing the Hard Stuff and Staying Sane»); TLA+-стиль инвариантов для кэша; Alloy «small scope hypothesis» — 200 шагов достаточно, чтобы найти все три класса нарушений.


---

# 📐 retry-backoff

**Линза:** math / retry-backoff — повторы, деградация, thundering herd

**Вывод:** В Aegis один механизм повторов — withRetry (aegis_full.js:1446-1461): экспоненциальный backoff с full jitter, cap 30 с, счётчик попыток. Он корректен для одиночного клиента, но не рассчитан на массовый сбой: (а) Retry-After подставляется в delay без джиттера и без cap (1453-1457) — сервер сам синхронизирует всех клиентов в один миллисекундный пик; (б) retry:true = 3 попытки покрывают ожидаемо ~3.5 с (макс. 7 с) — при простое ≥7 с успех 0% при 4-кратном усилении нагрузки; (в) нет ни бюджета повторов, ни circuit breaker, ни джиттера на revalidateOn('reconnect')/`online`/_offlineBackoff — все клиенты, вернувшиеся в сеть, бьют сервер одновременно; (г) refresh() cached-ресурса во время backoff-сна — no-op (5821: force присоединяется к спящему promise), кнопка «Повторить» не работает; (д) офлайн-очередь ретраит POST без Idempotency-Key и вечно пересылает 4xx. Симуляция (5000 клиентов × 5 ресурсов, capacity 2000 rps, scratchpad/agents/retry-backoff/sim.mjs): текущий full jitter — пик 8.7k rps, успех 26% при простое 3 с и 0% при 10 с, усиление 4.0×; Retry-After без джиттера — пик 2.5M rps (все в один тик); circuit breaker — успех 99.9-100%, усиление 2.4×, пик 6-7k; retry budget 20% ограничивает усиление 2.2× (кап, а не замена breaker'а). Все предложения — S/M, суммарно ≈ +0.9-1.2 KB gzip.

**Отвергнуто:** 1) Server-side Retry-Budget / adaptive concurrency (Netflix concurrency-limits, Vegas/Gradient) — это серверная часть; в браузере нельзя измерить очередь сервера, только RTT, а Aegis server-first не диктует бэкенд. 2) Hedged requests (отправить дубль через p95-латентность) — увеличивает нагрузку на сервер именно в момент деградации, противоречит цели линзы; для чтения через SWR-кэш выигрыш минимален. 3) Глобальный лимит параллелизма (semaphore на 6 запросов) — браузер уже ограничивает по origin (HTTP/1.1) или мультиплексирует (HTTP/2), свой семафор добавляет размер без эффекта на сервер. 4) Retry внутри mutation() по умолчанию — небезопасно без Idempotency-Key на сервере; оставлено как opt-in через предложение 7 (заголовок) и явный withRetry в fn. 5) Полноценный retry для streamResource/sse — SSE уже переподключается сам (EventSource), NDJSON-стрим нельзя безопасно повторить без Range/offset-протокола. 6) Replace full jitter на «equal jitter» — по AWS-данным хуже full по нагрузке, не рассматривать. 7) Персистентный breaker в localStorage между вкладками (BroadcastChannel) — усложняет, per-tab breaker уже режет усиление в 1.65× (сим 4.0 → 2.4); можно вернуться, если появится общий cache API.

## 💎 #91 — Retry-After как нижняя граница + джиттер + cap (и RateLimit-Reset)

**Impact:** 4 · **Effort:** S · **Size:** +60-90 B gzip

**Сейчас:** aegis_full.js:1452-1457: delay = min(max, base·2^attempt)·random(); если есть Retry-After — delay ПОЛНОСТЬЮ заменяется на n·1000 или Date.parse(ra)-now. Джиттера нет, cap `max` не применяется (Retry-After: 3600 → withRetry спит час, resource висит в pending), 5xx без Retry-After и с ним ведут себя по-разному. Все клиенты, получившие 503 с одним Retry-After, повторяют в одну миллисекунду.

**Предложение:** Трактовать Retry-After как floor: delay = min(maxWait, ra + jitter(attempt)), где jitter — тот же full-jitter слот; при ra > max — не спать дольше `max` (сервер просил «не раньше», а не «ровно тогда»), а если ra > maxWait — сразу выйти с ошибкой (не ретраить, HttpError.retryAfter выставлен, чтобы UI показал «попробуйте через N мин»). Дополнительно читать `RateLimit-Reset` (IETF draft) как синоним. Ту же функцию использовать в _flushOffline (8009).

**Алгоритм:**

```js
// внутри withRetry, вместо 1452-1457
const slot = Math.min(max, base * 2 ** attempt);
let delay = slot * Math.random();                    // full jitter (как сейчас)
const ra = _retryAfterMs(e);                          // Retry-After | RateLimit-Reset → ms | 0
if (ra) {
  if (ra > maxWait) { e.retryAfter = ra; throw e; }   // maxWait default 60000
  delay = ra + slot * Math.random();                  // floor + jitter
}
delay = Math.min(delay, maxWait);
await _sleep(delay, signal);

function _retryAfterMs(e) {
  const h = e?.response?.headers;
  const v = h?.get?.('Retry-After') ?? h?.get?.('RateLimit-Reset');
  if (!v) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? Math.max(0, Date.parse(v) - Date.now()) : n * 1000;
}
// Матем.: N клиентов с одинаковым ra → без джиттера пик = N/tick; с равномерным джиттером на [ra, ra+slot] пик ≈ N/slot.
// Симуляция (outage 3s): ra-sync пик 2 500 000 rps, успех 0.2%; ra-jitter пик 28 200 rps, успех 70% (при 3 попытках).
```

**API:**

```js
withRetry(fn, { retries, base, max, maxWait = 60000, signal, shouldRetry })
// поведение по умолчанию меняется только для ответов с Retry-After: к нему прибавляется джиттер и он ограничен maxWait.
// HttpError получает поле retryAfter (ms) когда сервер просил ждать дольше maxWait:
bind(el, { error: (e, retry) => e.retryAfter ? html`<p>Сервер перегружен, повторим через ${Math.ceil(e.retryAfter/60000)} мин</p>` : … })
// d.ts: RetryOptions.maxWait?: number; HttpError.retryAfter?: number
```

**Критерий:** Тест: fetcher, 20 параллельных withRetry получают 503 c Retry-After: 1 → все повторы попадают в окно [1000, 2000) мс, а не в один тик (разброс ≥ 500 мс при 20 попытках, p≈1). Retry-After: 7200 → reject сразу, e.retryAfter === 7200000, resource.status === 'error' без ожидания. Сим: пик после Retry-After падает с 2.5M rps до ≤ 30k rps (N=25000 запросов).

**Источники:** AWS Architecture Blog «Exponential Backoff And Jitter» (Marc Brooker); RFC 9110 §10.2.3 Retry-After; IETF draft-ietf-httpapi-ratelimit-headers (RateLimit-Reset); Google SRE Book ch.22 «Addressing Cascading Failures» (jittered retries)

## 💎 #92 — Circuit breaker per-origin в request(): closed → open → half-open

**Impact:** 5 · **Effort:** M · **Size:** +350-450 B gzip

**Сейчас:** Нет. request() (1337-1367) и defaults.fetcher (1380) не помнят историю. Каждый resource() (3619), _fetchEntry (5830), infiniteResource (6094), offline fetchRemote (8084) ретраят независимо; при 503 на бэкенде страница с K ресурсами шлёт K·(retries+1) запросов, навигация по роутам — ещё столько же на каждый экран. dev-предупреждение E030 (5799) ловит шторм одного URL, но не деградацию бэкенда.

**Предложение:** Модульный breaker с ключом по origin (или по configure({ breaker: { key: url => … } })). Состояния: closed — считает подряд идущие retryable-ошибки (по _retryable, 1440); при ≥ threshold (5) или при 503/429 с Retry-After → open на cooldown·(1+random) (или до Retry-After). В open request() бросает HttpError(503) синхронно с e.circuit = true, e.retryAt — без сети, withRetry не ретраит его (shouldRetry видит circuit). При истечении — half-open: ПЕРВЫЙ запрос проходит как probe, остальные fail-fast; успех → closed + сигнал `_circuit` переключается → все cached-entry с refCount>0 и error!==null перезапрашиваются (как revalidateOn 'reconnect'); провал → open с удвоенным cooldown (cap 60 с). SWR-кэш при открытом breaker'е продолжает отдавать data (validating=false, error=set) — деградация мягкая.

**Алгоритм:**

```js
const _cb = new Map(); // origin → { fails, openUntil, half, cooldown }
function _cbKey(u) { try { return new URL(u, location.href).origin; } catch { return ''; } }
function _cbBefore(k) {
  const s = _cb.get(k); if (!s) return;
  const now = Date.now();
  if (s.openUntil > now) throw Object.assign(new HttpError(503, null, null), { circuit: true, retryAt: s.openUntil });
  if (s.openUntil) { if (s.half) throw Object.assign(new HttpError(503, null, null), { circuit: true, retryAt: s.openUntil }); s.half = true; } // один probe
}
function _cbAfter(k, err) {
  const c = _config.breaker; if (!c) return;
  let s = _cb.get(k) || _cb.set(k, { fails: 0, openUntil: 0, half: false, cooldown: c.cooldown ?? 5000 }).get(k);
  if (!err) { if (s.openUntil) _circuit.value++; _cb.delete(k); return; }         // closed; сигнал → ревалидация ошибочных entry
  if (!_retryable(err)) return;
  s.fails++;
  const ra = _retryAfterMs(err);
  if (s.half || s.fails >= (c.threshold ?? 5) || ra) {
    s.half = false;
    s.openUntil = Date.now() + Math.min(60000, Math.max(ra, s.cooldown * (1 + Math.random())));
    s.cooldown = Math.min(60000, s.cooldown * 2);
    if (_dev()) _warn('E038', { what: `circuit open for ${k} until +${s.openUntil - Date.now()} ms` … });
  }
}
// в request(): _cbBefore(k); try { … } catch (e) { _cbAfter(k, e); throw e; }  _cbAfter(k, null) после ok
// Матем.: во время простоя нагрузка на клиента ≈ 1 probe / cooldown вместо K·(retries+1) / (Σ backoff);
// при N=5000, K=5: сим. успех 99.9-100% при простое 1/3/10 с, усиление 2.4× (vs 4.0× и 0% успеха при 10 с), пик 6-7k rps.
```

**API:**

```js
configure({ breaker: true })                       // per-origin, threshold 5, cooldown 5000
configure({ breaker: { threshold: 3, cooldown: 3000, key: (url) => new URL(url, location.href).pathname.split('/')[2] } })  // per-service
// Ошибка fail-fast различима в UI:
bind(el, { error: (e, retry) => e.circuit ? html`<p>Сервис недоступен, повтор в ${new Date(e.retryAt).toLocaleTimeString()}</p>` : html`<button @click=${retry}>Повторить</button>` })
// dev: E038 «circuit open for https://api.x until …» ; dev.circuits() → Map состояний
// d.ts: HttpError.circuit?: boolean; HttpError.retryAt?: number; ConfigureOptions.breaker
```

**Критерий:** Тест: mock fetch → 503 ×5 подряд → 6-й request() отклоняется синхронно (fetch не вызывался, e.circuit === true); через cooldown ровно один вызов fetch (probe), 200 → следующие проходят; cached-ресурс с error и refCount>0 после закрытия перезапросился один раз. Бенч (сим): при простое 10 с усиление ≤ 2.5× и успех ≥ 99% против 4.0× и 0% сегодня. Размер: breaker tree-shakeable? Нет — живёт в request(), поэтому ~+350 B в core.

**Источники:** Nygard «Release It!» (Circuit Breaker); Netflix Hystrix / resilience4j CircuitBreaker (half-open, permitted calls); opossum и cockatiel (JS circuit breaker); Google SRE Book ch.22; Envoy outlier detection

## 💎 #93 — Retry budget на клиент: усиление ≤ 1 + budget

**Impact:** 3 · **Effort:** S · **Size:** +150-200 B gzip

**Сейчас:** Нет ограничителя. _retries (1464-1469) — фиксированное число на каждый вызов; N ресурсов на странице × (retries+1) запросов при сбое; infiniteResource и offline fetchRemote тоже ретраят. В dev E030 (5799) предупреждает только про один URL ≥10/с.

**Предложение:** Token bucket (Finagle RetryBudget): скользящее окно 10 с считает обычные запросы `reqs` и повторы `retries`; повтор разрешён, если retries ≤ ratio·reqs + minRetriesPerSec·window. Проверка внутри withRetry перед сном; исчерпан бюджет → ошибка бросается сразу с e.budget = true. Хранится модульно, tree-shakeable (пустой noop если configure не вызывали). Работает вместе с breaker'ом: breaker гасит длинные простои, бюджет — короткие «моргания» и flapping.

**Алгоритм:**

```js
const _rb = { t: [], r: [] };  // timestamps запросов и повторов (окно 10 с)
const _trim = (a, now) => { while (a.length && now - a[0] > 10000) a.shift(); };
function _budgetOk() {
  const c = _config.retryBudget; if (!c) return true;
  const now = Date.now(); _trim(_rb.t, now); _trim(_rb.r, now);
  const allowed = (c.ratio ?? 0.2) * _rb.t.length + (c.min ?? 10);   // Finagle: 20% + 10/с·10с? → min = минимум повторов за окно
  if (_rb.r.length >= allowed) return false;
  _rb.r.push(now); return true;
}
// withRetry: if (!_budgetOk()) { e.budget = true; throw e; }
// request(): _rb.t.push(Date.now()) (только когда _config.retryBudget включён)
// Матем.: за окно W сервер получает ≤ R·(1 + ratio) + min запросов от клиента, где R — «честные» запросы.
// Сим: full+budget0.2 → усиление 2.20× (вместо 4.00×), 55 000 вместо 100 000 запросов на 25 000 нужных;
// сам по себе бюджет снижает успех (гасит повторы в простое), поэтому пара «budget + breaker» = 2.43× и 100% успеха.
```

**API:**

```js
configure({ retryBudget: true })                 // ratio 0.2, min 10 за 10 с
configure({ retryBudget: { ratio: 0.1, min: 3, window: 10000 } })
// ошибка различима: e.budget === true → UI показывает «Повторить» вместо автоповтора
// dev.retryBudget() → { reqs, retries, allowed } для панели
```

**Критерий:** Тест: fetcher всегда 503, 50 resource(url_i, { retry: 3 }) в одном scope → суммарно вызовов fetcher ≤ 50 + 0.2·50 + 10 = 70 (сейчас 200). Сим: усиление 2.2× vs 4.0×; e.budget выставлен у отвергнутых. Не влияет на одиночный ресурс с тремя повторами (min=10 покрывает).

**Источники:** Twitter Finagle RetryBudget (ratio 20%, minRetriesPerSec); Envoy «retry budgets» (retry_budget в circuit_breakers); Google SRE Book ch.22 «Retry budgets»; gRPC retry throttling (A6 retry design)

## 💎 #94 — Повтор по времени, не по счётчику: retry: { for } + decorrelated jitter + deadline

**Impact:** 3 · **Effort:** S · **Size:** +120-160 B gzip

**Сейчас:** withRetry (1446): retries — счётчик; retry:true → 3 (1465). Full jitter слоты 1, 2, 4 с → E[Σ] = 3.5 с, максимум 7 с. Любой простой дольше 7 с → все 4 попытки сгорают внутри простоя (сим: успех 0% при 10 с при 4× усилении). Увеличить retries нельзя без роста усиления (retries 6 → 5.24×, сим). Общей дедлайн-опции нет; Retry-After может сделать ожидание неограниченным.

**Предложение:** Добавить в withRetry `deadline` (мс от старта) и `jitter: 'full' | 'decorrelated'`; в resource: retry: { for: 30000 } → «повторять до 30 с с capped decorrelated jitter, число попыток не фиксировано». Decorrelated (AWS): sleep = min(cap, rand(base, prev·3)) — растёт медленнее, чем 2^n, и не сбрасывается в 0 как full (у full минимальная пауза 0 мс — 1/4 клиентов повторяет почти сразу). Deadline режет последний сон: delay = min(delay, deadline − elapsed); если elapsed ≥ deadline → throw. Счётчик и время комбинируются: стоп по первому.

**Алгоритм:**

```js
export async function withRetry(fn, { retries = 3, base = 1000, max = 30000, deadline = 0, jitter = 'full', signal, shouldRetry = _retryable } = {}) {
  const t0 = Date.now(); let prev = base;
  for (let attempt = 0; ; attempt++) {
    try { return await fn(attempt); } catch (e) {
      const elapsed = Date.now() - t0;
      if (e?.name === 'AbortError' || signal?.aborted || (!deadline && attempt >= retries) || (deadline && elapsed >= deadline) || !shouldRetry(e, attempt)) throw e;
      let delay = jitter === 'decorrelated'
        ? (prev = Math.min(max, base + Math.random() * (prev * 3 - base)))
        : Math.min(max, base * 2 ** attempt) * Math.random();
      /* Retry-After floor + jitter из предложения 1 */
      if (deadline) delay = Math.min(delay, deadline - elapsed);
      await _sleep(delay, signal);
    }
  }
}
// _retries(retry): объект { for, jitter } → { retries: Infinity, deadline: for, jitter }
// Матем.: full jitter: E[delay_n] = slot_n/2, P(delay<100 мс) = 100/slot_n (10% на первом слоте — мгновенный повтор четверти клиентов);
// decorrelated: E[delay_n] ≈ base·(1+3/2+…) ограничен cap, минимум = base → нет «нулевых» повторов.
// Сим (outage 3 с, 3 попытки): full — пик 8 700 rps, успех 26%; decorr — пик 15 500 rps (шире слот), успех 82%; при outage 1 с: 41% vs 90%.
```

**API:**

```js
resource(url, { retry: true })                         // как сейчас: 3 попытки, full jitter
resource(url, { retry: { for: 30000 } })              // до 30 с, decorrelated, попытки не считаем
resource(url, { retry: { for: 30000, jitter: 'full', base: 500 } })
withRetry(fn, { deadline: 15000, jitter: 'decorrelated' })
// d.ts: RetryOptions.deadline?, .jitter?: 'full' | 'decorrelated'; ResourceOptions.retry: boolean | number | RetryPredicate | { for: number; jitter?; base?; max? }
```

**Критерий:** Тест с fake timers: retry: { for: 5000 } при вечном 503 → resource.error выставлен не позже 5000 мс (последний сон урезан), число вызовов fetcher ≤ 8; decorrelated → ни одна пауза < base. Сим: при outage 3 с успех с 26% → ≥ 80% при том же лимите 3 попыток; retry:{for:15000} + breaker → 100% при outage 10 с.

**Источники:** AWS «Exponential Backoff And Jitter» (decorrelated jitter, Brooker 2015); gRPC retry policy (maxAttempts + backoffMultiplier + perAttemptDeadline); TanStack Query retryDelay; SWR errorRetryInterval/errorRetryCount; Polly DecorrelatedJitterBackoffV2

## 💎 #95 — Джиттер и стаггер для reconnect/focus-ревалидации и офлайн-flush

**Impact:** 4 · **Effort:** S · **Size:** +120-150 B gzip

**Сейчас:** _installRevalidate (5851-5865): на `online` и `focus` синхронно проходит ВСЕ entry с refCount>0 и revalidateOn и вызывает _fetchEntry для каждой — единственный тормоз staleTime; throttle 5 с только для focus. _plainResource refetch.reconnect (3668) — то же. _installOfflineListeners (7973): `online` → _flushOffline немедленно. _offlineBackoff (7958, 8021) = 1000·2^k без джиттера, сброс в 1000 при пустой очереди. Сетевые события у всех клиентов на одном Wi-Fi/ISP/после деплоя API-шлюза приходят в одну секунду → пик N·K запросов.

**Предложение:** (1) `online`/`reconnect`: запуск через setTimeout(tick, random()·reconnectJitter) (default 0-2000 мс), затем стаггер entries внутри клиента: сначала видимые (element in viewport — если entry знает свой el, иначе порядок вставки), по одному запросу на ~30-50 мс (или через `scheduler.postTask` priority background). (2) _offlineBackoff → decorrelated jitter, и очередь не сбрасывается в 1000 при частичном успехе, а по успеху уменьшается вдвое (AIMD). (3) `focus` при hidden→visible оставить, но пропустить, если вкладка была скрыта < 1 с (переключение окон).

**Алгоритм:**

```js
// _installRevalidate
let lastFocus = 0, pending = null;
const tick = (reason) => {
  if (document.visibilityState !== 'visible') return;
  if (reason === 'focus') { const now = Date.now(); if (now - lastFocus < 5000) return; lastFocus = now; }
  const list = [..._resourceCache.values()].filter(e => e.refCount > 0 && e.url && e.fopts && e.revalidateOn?.includes(reason));
  let i = 0;
  const step = () => { const e = list[i++]; if (!e) return; _fetchEntry(e, e.url, e.fopts); if (list[i]) setTimeout(step, 40); };
  const jitter = reason === 'reconnect' ? Math.random() * (_config.reconnectJitter ?? 2000) : 0;
  clearTimeout(pending); pending = setTimeout(step, jitter);
};
// _flushOffline: retry backoff
_offlineBackoff = Math.min(60000, 1000 + Math.random() * (_offlineBackoff * 3 - 1000));   // decorrelated
// на успех: _offlineBackoff = Math.max(1000, _offlineBackoff / 2);
// Матем.: N клиентов реконнектятся в окне W (типично ~1 с); пик ≈ N·K/W. Равномерный джиттер J: пик ≈ N·K/(W+J);
// J=2 с → в 3 раза; внутриклиентный стаггер 40 мс на K=10 растягивает ещё на 0.4 с и снимает конкуренцию за 6 соединений HTTP/1.1.
```

**API:**

```js
configure({ reconnectJitter: 2000, revalidateStagger: 40 })   // по умолчанию 2000 / 40 мс; 0 — прежнее поведение
// resource(url, { cache: { revalidateOn: ['focus', 'reconnect'] } }) — без изменений
// offline: без изменений в API; dev.offline() показывает текущий backoff
```

**Критерий:** Тест: 10 cached-ресурсов, dispatch('online') → первый fetch не раньше 0 мс и не позже reconnectJitter, между fetch'ами ≥ 40 мс, всего 10 вызовов; повторный `online` через 100 мс не удваивает (pending заменён). Сим-модель: пик реконнекта N·K/(W+J) — при N=5000, K=5, W=1 с: 25 000 rps → 8 300 rps при J=2 с. Offline: последовательность _offlineBackoff у двух клиентов с одинаковым seed отличается (нет синхронных flush).

**Источники:** Google SRE Book ch.22 (jittered periodic tasks, «thundering herd»); Cloudflare blog о синхронизированных клиентах после инцидентов; Ethernet/CSMA binary exponential backoff с рандомизацией; AIMD (TCP congestion control) для офлайн-очереди

## 💎 #96 — Adaptive polling: backoff при ошибках и фазовый джиттер интервала

**Impact:** 3 · **Effort:** S · **Size:** +70-100 B gzip

**Сейчас:** poll() (1515-1533): фиксированный интервал; ошибка ловится и логируется (console.error) — следующий тик через те же ms. refetch.interval в _plainResource (3669) поверх poll; с retry:true каждый тик даёт до 4 запросов. Все вкладки, открывшие страницу после деплоя в одну минуту, тикают в фазе. При 503 нагрузка от поллеров не падает: N/интервал·(retries+1) rps постоянно.

**Предложение:** poll(fn, ms, { backoff: true, jitter: 0.1 }): при исключении/reject интервал = min(ms·2^k, maxMs=60000)·(1+U(-j,j)), при успехе — сброс к ms; первый тик со случайным сдвигом U(0, ms)·(если не immediate) или после первого успеха разфазировать; интервал перепланируется по факту завершения fn (не «каждые ms», а «ms после ответа» — уже так, 1527). В refetch.interval передавать backoff по умолчанию для cached/plain; при открытом breaker'е (предл. 2) poll спит до retryAt.

**Алгоритм:**

```js
export function poll(fn, ms, { background = false, backoff = false, max = 60000, jitter = 0.1 } = {}) {
  let active = true, cur = ms;
  const hidden = () => !background && typeof document !== 'undefined' && document.hidden;
  const wait = (d) => new Promise(r => setTimeout(r, d * (1 + (Math.random() * 2 - 1) * jitter)));
  const run = async () => {
    while (active) {
      if (hidden()) { await new Promise(r => document.addEventListener('visibilitychange', r, { once: true })); if (!active) break; }
      try { await fn(); cur = ms; }
      catch (e) { console.error('[Aegis] poll error:', e); if (backoff) cur = Math.min(max, cur * 2); }
      await wait(cur);
    }
  };
  run(); return _scoped(() => { active = false; });
}
// refetch.interval (3669): poll(() => { if (!inflight.peek()) return refresh().then(() => { if (error.peek()) throw error.peek(); }); }, refetch.interval, { backoff: true })
// Матем.: N поллеров с периодом T в фазе → импульс N каждые T; с джиттером ±10% фазы расходятся за ~10 циклов до равномерных N/T rps.
// При 503: клиент с T=5 с и retry:true даёт 0.8 rps; backoff до 60 с → 0.067 rps (12× меньше; с deadline-retry ещё ниже).
```

**API:**

```js
poll(fn, 5000, { backoff: true })                     // 5 → 10 → 20 → 40 → 60 с при ошибках, сброс при успехе
resource(url, { refetch: { interval: 5000 } })          // backoff теперь по умолчанию (BREAKING? нет: только при ошибках)
resource(url, { refetch: { interval: 5000, backoff: false } })
// d.ts: PollOptions { background?, backoff?, max?, jitter? }; ResourceOptions.refetch.backoff?: boolean
```

**Критерий:** Тест с fake timers: poll с backoff, fn отвергает 3 раза подряд → задержки в пределах [ms·2^k·0.9, ms·2^k·1.1] для k=1..3; после успеха следующая задержка ≈ ms. Нагрузка при простое от поллера: ≤ 1 запрос/60 с после 4 ошибок (сейчас 4/5 с). 100 poll'ов с одним ms, запущенные одновременно, через 20 циклов имеют дисперсию фаз ≥ 0.2·ms.

**Источники:** Google SRE Book ch.22; Brooker «Timeouts, retries and backoff with jitter» (AWS Builders' Library); Prometheus scrape jitter; SWR refreshInterval + errorRetryInterval

## 💎 #97 — Офлайн-очередь: Idempotency-Key, dead-letter для 4xx, лимит попыток на мутацию

**Impact:** 4 · **Effort:** M · **Size:** +250-300 B gzip (в offline-секции, tree-shakeable)

**Сейчас:** _flushOffline (7994-8030): каждая мутация → withRetry(request(POST/PUT/DELETE), { retries: 2 }) (8009). m.mutId генерируется в send (8113) и лежит в очереди, но НЕ отправляется на сервер → при таймауте/обрыве после того, как сервер применил запись, повтор создаёт дубликат (POST не идемпотентен). Любая ошибка (включая 400/422/409/401) кладёт мутацию в `remaining` (8014) → она пересылается каждые ≤60 с вечно (poison pill), блокируя backoff-сброс и держа syncing=true. Нет счётчика попыток на элемент, нет способа увидеть/удалить застрявшие.

**Предложение:** (1) Слать заголовок `Idempotency-Key: <mutId>` (и опционально `X-Aegis-Queued-At`), чтобы сервер дедуплицировал повторы — тогда retry для POST безопасен. (2) В flush различать ошибки: _isNetworkError (7977) → остаётся в очереди, attempts++; иначе (4xx кроме 408/429) → в dead-letter (сигнал `offline.failed`, хранится в IDB под `__aegis_dead__`), ресурс получает error, refresh() для отката оптимистичного состояния. (3) Лимит attempts (default 20 flush'ей ≈ сутки при cap 60 с) → dead-letter. (4) Дедлайн на мутацию (`ttl`, default 24 ч) — устаревшие не отправлять.

**Алгоритм:**

```js
// send(): const m = { mutId, method, url, body, cacheKey, syncTag, at: Date.now(), attempts: 0 };
// fetcher(url, { method, body, headers: { 'Idempotency-Key': mutId } })   // и в онлайне тоже — retry внутри withRetry безопасен
// _flushOffline:
for (const m of queued) {
  if (executed.has(m.mutId)) continue;
  if (Date.now() - m.at > (opts.ttl ?? 86400000) || m.attempts >= (opts.maxAttempts ?? 20)) { dead.push({ ...m, reason: 'expired' }); continue; }
  try {
    await withRetry(() => request(m.url, { method: m.method, body: m.body, headers: { 'Idempotency-Key': m.mutId } }), { retries: 2 });
    executed.add(m.mutId); if (m.cacheKey) touched.add(m.cacheKey);
  } catch (e) {
    if (_isNetworkError(e)) { m.attempts++; remaining.push(m); }
    else { dead.push({ ...m, reason: e.status, data: e.data }); if (m.cacheKey) touched.add(m.cacheKey); }   // refresh откатит optimistic
  }
}
if (dead.length) { const prev = (await store.get('__aegis_dead__')) || []; await store.set('__aegis_dead__', prev.concat(dead).slice(-100)); _failed.value = prev.length + dead.length; }
// Матем.: без dead-letter одна битая мутация даёт ≥ 1440 запросов/сутки на клиента навсегда; с лимитом 20 — ≤ 60 (с внутренними ретраями).
```

**API:**

```js
const todos = resource('/api/todos', { offline: { ttl: 6 * 3600e3, maxAttempts: 10 } });
todos.failed   // ReadonlySignal<number> — застрявших мутаций
offlineQueue.failed()  → Promise<DeadMutation[]>;  offlineQueue.retry(mutId); offlineQueue.drop(mutId)   // новый tree-shakeable экспорт
// сервер: читать Idempotency-Key (Stripe-стиль) — в recipes/ добавить пример для Django/Rails middleware
// d.ts: OfflineOptions.ttl?, .maxAttempts?; OfflineResult.failed
```

**Критерий:** Тест: mock request → 422 для одной мутации → после первого flush она в __aegis_dead__, queue пуста, _offlineBackoff сброшен в 1000, syncing=false; ресурс refresh'нулся. Mock: первый запрос «зависает» и падает по timeout после того, как сервер записал — повтор приходит с тем же Idempotency-Key (assert по заголовку). Нагрузка: битая мутация → ≤ 60 запросов всего вместо ∞.

**Источники:** IETF draft-ietf-httpapi-idempotency-key-header; Stripe «Idempotent requests»; AWS SQS dead-letter queues; Workbox BackgroundSync Queue (maxRetentionTime); Google SRE Book ch.22 (poison requests)

## 💎 #98 — Намерение пользователя прерывает backoff: refresh()/invalidate() во время сна повтора

**Impact:** 3 · **Effort:** S · **Size:** +90-120 B gzip

**Сейчас:** _fetchEntry (5814-5842): пока withRetry спит между попытками, e.promise живёт и e.inflight=true; refresh() cached-ресурса = _fetchEntry(…, force=true) (5993), но строка 5821 `if (e.promise) return e.promise` выполняется и при force → клик «Повторить» в bind(error: (e, retry)) (2624) и invalidate() (6035) во время 30-секундного сна ничего не делают, UI показывает validating без сетевой активности. В _plainResource refresh → abort() (3608) → _sleep отклоняется AbortError → корректно перезапускает. Обратная проблема: revalidateOn 'focus' (5859) во время сна тоже присоединяется — это правильно (дедуп), но для force нужно иное.

**Предложение:** Хранить в entry фазу: e.sleeping = { wake } — resolver, который withRetry вызывает при принудительном пробуждении. withRetry получает опцию `wake` (AbortSignal-подобный EventTarget или функция-регистратор): _sleep(delay, signal, wake) резолвится досрочно по wake → следующая попытка немедленно, счётчик attempt не растёт (это «попытка пользователя», а не автоповтор; можно сбросить attempt=0). В _fetchEntry: `if (e.promise) { if (force && e.wake) e.wake(); return e.promise; }`. Та же семантика для invalidate(force). Дополнительно: пока ресурс спит в backoff, публиковать `retryAt` в результат (`res.retryAt` signal) — UI может показать «повтор через 12 с», а ошибочное состояние не выглядит зависшим.

**Алгоритм:**

```js
function _sleep(ms, signal, wake) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const done = () => { clearTimeout(id); signal?.removeEventListener('abort', onAbort); resolve(); };
    const id = setTimeout(done, ms);
    const onAbort = () => { clearTimeout(id); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (wake) wake.fn = done;          // регистратор досрочного пробуждения
  });
}
// withRetry(fn, { …, wake }):  await _sleep(delay, signal, wake); wake.fn = null; if (wake?.forced) { attempt = -1; wake.forced = false; }  // ручной повтор сбрасывает счётчик
// withRetry также выставляет wake.until = Date.now() + delay (для retryAt)
// _fetchEntry: e.wake = { fn: null }; … withRetry(attempt, { …, wake: e.wake });
//   if (e.promise) { if (force && e.wake?.fn) { e.wake.forced = true; e.wake.fn(); } return e.promise; }
// _resultShape: retryAt: computed(() => o.retryAt ? o.retryAt.value : 0)  — сигнал обновляется из wake.until
```

**API:**

```js
// Без изменений в вызовах: refresh() / invalidate(key) / кнопка retry в bind(error) теперь срабатывают мгновенно во время backoff.
const users = resource('/api/users', { cache: true, retry: { for: 30000 } });
html`${() => users.retryAt.value ? `повтор через ${Math.ceil((users.retryAt.value - Date.now())/1000)} с` : ''}`
// withRetry(fn, { wake })  — низкоуровневая опция, wake: { fn?: () => void, until?: number }
```

**Критерий:** Тест с fake timers: cached-ресурс, fetcher 503, retry: 3; после первой ошибки (спит ≤ 1 с) вызвать refresh() через 10 мс → второй вызов fetcher происходит в течение 1 тика, а не через ≥ полный слот; attempt после ручного refresh начинается с 0 (ещё 3 автоповтора). invalidate(key) во время сна → то же. users.retryAt.value > Date.now() пока спит и 0 после ответа.

**Источники:** TanStack Query (refetch() во время retry сбрасывает failureCount; failureReason/errorUpdateCount в UI); SWR mutate() отменяет errorRetry; Apollo RetryLink (abort on refetch); UX-паттерн «retry countdown» (Slack/Gmail «Reconnecting in N s»)


---

# 📐 structural-sharing-math

**Линза:** math / structural-sharing-math

**Вывод:** Текущий `_share` (aegis_full.js:3509–3523) — рекурсивный обход O(N) по узлам `next`, ~50 нс/узел в node (6.1 мс на 120k узлов / 10k строк), т.е. 0.8× стоимости JSON.parse того же ответа; кривая «доля изменённых строк → время» плоская (5–7 мс при f от 0 до 1), поэтому порога «diff дороже замены» по доле изменений не существует — единственный реальный порог это перерисовка строки list() (~10–100 мкс), которая в 1000× дороже узла, так что sharing окупается всегда. Главная математическая дыра не в скорости, а в модели: массивы сравниваются по индексу, поэтому prepend/удаление/сортировка одной строки ломает identity всех сдвинутых строк (бенч: 0/10000 сохранено), а list() на строках 2831–2839 перерисовывает каждую строку с новым объектом — keyed reconciliation list() обесценивается. Второй недостаток — аллокация: `_share` строит полную копию дерева даже когда ответ идентичен (581 KB мусора на ревалидацию 10k строк) и дважды вызывает Object.keys; ленивая материализация даёт −25% времени и ~0 аллокаций. Дальше по убыванию выгоды: fast-path по отпечатку (memcmp текста 0.06 мс — в 99× быстрее обхода; 304 — 0 мс), дельта-ревалидация JSON Patch (0.05 мс и 458 байт вместо 13.9 мс и 1.35 MB), защита от глубины/циклов (RangeError с глубины ~8000, JSON.parse при этом справляется).

**Отвергнуто:** 1) Порог «share off при большой доле изменений» (`share: 'auto'`): бенч раздел C показал плоскую кривую — чистая стоимость обхода 5–7 мс на 120k узлов при f=0…1, replace экономит только эти ~50 нс/узел, а одна потерянная identity строки стоит перерисовки list() (~1000× дороже). Порога по f нет; единственный разумный порог — по абсолютному размеру, но и там выгоднее ленивый обход, чем отказ. 2) Merkle-хэши на каждом узле ответа: хэш надо считать за O(N) при каждом ответе (FNV по тексту 2 мс vs обход 4.5–6 мс — выигрыш всего 2–3×), хранить O(N) хэшей и всё равно не получить identity без обхода; для клиента без серверных хэшей дерево Меркла не окупается — его роль закрывают ETag/304 (O(1)) и JSON Patch. 3) Полностью итеративный `_share` со стеком (post-order): защищает от RangeError с глубины ~8000 и от циклов из transform, но усложняет код на ~30 строк ради данных, которых в JSON-API не бывает; вместо этого — лимит глубины в 1 строку (предложение 2). 4) Хранить полный сырой текст ответа без ограничения размера ради memcmp-fast-path — удваивает память для больших ответов; принят вариант с потолком 512 KB и WeakMap. 5) Микродифф на клиенте (microdiff/deep-diff) для генерации патчей от `mutate()` к серверу — не про sharing; отдельная линза (мутации/офлайн-очередь).

## 💎 #99 — Keyed structural sharing: матчить элементы массивов по id, а не по индексу

**Impact:** 5 · **Effort:** S · **Size:** +~120 B gzip (Map-индекс + разбор опции share)

**Сейчас:** aegis_full.js:3509–3523 `_share` — для массивов `out[i] = _share(prev[i], next[i])`, строго позиционно. list() (2831–2839) при `!Object.is(entry.item, arr[i])` вызывает `_render` заново — identity строки определяет перерисовку. Бенч (scratchpad/agents/structural-sharing-math/bench.mjs, раздел B): prepend одной строки в 10k → identity сохранена у 0/10000 строк; keyed-вариант — 10000/10000 при том же времени (14.8 мс vs 14.8 мс).

**Предложение:** В `_share` для пары массивов, чьи элементы — plain-объекты с ключевым полем, строить Map prev по ключу за O(n) и сравнивать `next[i]` с `prevById.get(key(next[i]))`. Ключ по умолчанию `id` (как `list(items, 'id')`), настраивается `share: 'uid'` или `share: item => ...`. Позиционный режим остаётся как `share: true`/fallback, когда у первого элемента нет поля-ключа. Применить во всех четырёх точках вызова (3625, 5836, 8087, 6097).

**Алгоритм:**

```js
function _share(prev, next, key = 'id') {
  if (prev === next) return prev;
  const arr = Array.isArray(next);
  if (!((Array.isArray(prev) && arr) || (_isPlain(prev) && _isPlain(next)))) return next;
  let byId = null;                                   // O(n) индекс, только для массивов keyed-объектов
  if (arr && prev.length && _isPlain(next[0]) && next[0][key] !== undefined) {
    byId = new Map();
    for (const p of prev) if (_isPlain(p) && p[key] !== undefined) byId.set(p[key], p);
  }
  const keys = arr ? null : Object.keys(next);
  const len = arr ? next.length : keys.length;
  let out = null;
  for (let i = 0; i < len; i++) {
    const k = arr ? i : keys[i];
    const pv = byId && _isPlain(next[i]) ? byId.get(next[i][key]) : prev[k];
    const v = _share(pv, next[k], key);
    if (out) { out[k] = v; continue; }
    if (v !== prev[k] || !(arr || k in prev)) {      // первое расхождение
      out = arr ? new Array(len) : {};
      for (let j = 0; j < i; j++) { const kk = arr ? j : keys[j]; out[kk] = prev[kk]; }
      out[k] = v;
    }
  }
  if (out) return out;
  return (arr ? prev.length : Object.keys(prev).length) === len ? prev : next;
}
// Сложность: O(N) узлов + O(n) на Map для каждого keyed-массива; память Map = O(n) временно.
```

**API:**

```js
resource(url, { cache: true })                      // share: 'id' по умолчанию
resource(url, { share: 'uuid' })                   // своё поле
resource(url, { share: (row) => row.type + row.id })
resource(url, { share: true })                     // старое позиционное поведение
// d.ts: share?: boolean | string | ((item: any) => unknown)
```

**Критерий:** Тест в test.html: cachedResource с ответом `[{id:1},{id:2}]` → refresh с `[{id:0},{id:1},{id:2}]` → `data.value[1] === prevData[0]` и `data.value[2] === prevData[1]`; list() над этим ресурсом создаёт ровно 1 новую строку (счётчик вызовов renderFn = 1, а не 3). Бенч: prepend в 10k строк — identity kept 10000/10000, время ≤ 1.1× текущего.

**Источники:** React Query replaceEqualDeep (тоже позиционный — известная жалоба), Relay/Apollo normalized cache by id, Vue/Inferno keyed diff, SWR compare via dequal

## 💎 #100 — Ленивая материализация в _share: ноль аллокаций на идентичный ответ, один Object.keys

**Impact:** 4 · **Effort:** S · **Size:** +~40 B gzip

**Сейчас:** aegis_full.js:3516–3522: `out` создаётся до цикла для каждого объекта/массива и выбрасывается, если `equal`; `Object.keys(prev)` вызывается на каждом объекте (второй массив ключей). Бенч раздел A (10k строк, 120k узлов): current 6.09 мс / 581 KB мусора за ревалидацию; lazy 4.54 мс / ~6 KB. Раздел C: выигрыш стабилен при любой доле изменений (f=1: 7.07 → 4.92 мс). Побочный баг: `{a:1,b:undefined}` vs `{a:1,c:undefined}` → current возвращает prev (у которого ключ b, а не c), lazy — корректно next.

**Предложение:** Копия узла создаётся только при первом расхождении (префикс копируется из prev); `Object.keys(prev).length` считается один раз в конце и только если по ключам next всё совпало; расхождение множества ключей ловится через `k in prev`. Плюс лимит глубины `d > 500 → return next` — защищает от RangeError на глубоких/циклических данных из transform (см. предложение 5).

**Алгоритм:**

```js
// см. тело в предложении 1 (lazy-часть):
let out = null;
for (let i = 0; i < len; i++) {
  const k = arr ? i : keys[i];
  const v = _share(prev[k], next[k], d + 1);
  if (out) { out[k] = v; continue; }
  if (v !== prev[k] || !(arr || k in prev)) {
    out = arr ? new Array(len) : {};
    for (let j = 0; j < i; j++) { const kk = arr ? j : keys[j]; out[kk] = prev[kk]; }
    out[k] = v;
  }
}
if (out) return out;
return (arr ? prev.length : Object.keys(prev).length) === len ? prev : next;
// Инвариант: возвращаем prev ⇔ deepEqual(prev,next) по plain/array-узлам; аллокации = O(число изменённых узлов × их ширина).
```

**API:**

```js
Без изменений API. `share: true` ведёт себя так же, только быстрее и без мусора.
```

**Критерий:** bench.mjs раздел A: время ≤ 0.8× текущего, heapΔ на идентичный ответ 10k строк < 20 KB (сейчас ~580 KB). Тест: `_share({a:1,b:undefined},{a:1,c:undefined})` возвращает объект с ключом c. Существующий тест test.html:1258 (identity после refresh) остаётся зелёным.

**Источники:** Immer (copy-on-write при первой записи), React Query replaceEqualDeep, structural sharing в persistent data structures (Okasaki)

## 💎 #101 — Fast-path по отпечатку до обхода дерева: 304 → сырой текст → tree share

**Impact:** 3 · **Effort:** S · **Size:** +~90 B gzip (WeakMap + ветка в _parseBody)

**Сейчас:** _parseBody (1310–1323) вызывает `response.json()` и теряет текст; `_fetchEntry` (5836) и _plainResource (3625) сразу идут в `_share`. Бенч: сравнение двух разных строк JSON 1.35 MB — 0.062 мс (memcmp), обход `_share` — 6.1 мс (99×); FNV-1a по тексту — 2.0 мс (3×, но без хранения текста). Известный пробел ETag/304 здесь получает конкретную роль: 304 — это O(1) share.

**Предложение:** Каскад проверок в порядке цены: (1) если fetcher вернул 304 (после добавления If-None-Match) — `data.value = prev`, обход не нужен; (2) `_parseBody` делает `text()` + `JSON.parse` и кладёт текст в `WeakMap _rawOf(data → text)` только при `text.length <= 512*1024` (память ограничена); в `_share` на корне: `if (_rawOf.get(prev) === _rawOf.get(next)) return prev`; (3) иначе обычный обход. Текст живёт ровно столько, сколько объект data (WeakMap), для ответов > 512 KB отпечаток не хранится.

**Алгоритм:**

```js
const _rawOf = new WeakMap();
async function _parseBody(r) {
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type') || '';
  const text = await r.text();
  if (ct.includes('json')) {
    try { const d = JSON.parse(text); if (d && typeof d === 'object' && text.length <= 524288) _rawOf.set(d, text); return d; }
    catch { return null; }
  }
  ...
}
function _share(prev, next, key) {
  if (prev === next) return prev;
  const a = _rawOf.get(prev), b = _rawOf.get(next);
  if (a !== undefined && a === b) return prev;   // memcmp: O(bytes), без аллокаций, ~0.05 мс/MB
  return _shareTree(prev, next, key);
}
// Порог 512 KB: ниже него текст ≤ размера уже распарсенных объектов; выше — обход дерева всё равно дешевле сети.
```

**API:**

```js
Прозрачно для пользователя. Опционально `configure({ fingerprint: false })` для отключения хранения текста. При появлении ETag: request() шлёт `If-None-Match: e.etag`, `_fetchEntry` при 304 обновляет lastFetch и не трогает data.
```

**Критерий:** Бенч: ревалидация 10k строк с идентичным ответом — ≤ 0.2 мс на сравнение (vs 6 мс), heapΔ ≈ 0. Тест: два fetch одного URL с одинаковым телом → `data.value` identity сохранена и `_shareTree` не вызывался (счётчик в dev). Память: heap после 100 ревалидаций 1 MB-ответа не растёт (WeakMap).

**Источники:** RFC 7232 (ETag/If-None-Match/304), SWR `compare` fast-path, FNV-1a, V8 string comparison (length-then-memcmp)

## 💎 #102 — Дельта-ревалидация: JSON Patch / Merge Patch с сервера и immutable applyPatch

**Impact:** 4 · **Effort:** M · **Size:** +~450 B gzip, отдельный export (tree-shakeable; в core не входит)

**Сейчас:** Ревалидация всегда тянет полный ответ и обходит всё дерево: бенч раздел D — parse(full)+_share = 13.9 мс, 1 350 005 байт. Тот же результат через JSON Patch из 10 операций: 0.05 мс, 458 байт (×2948 меньше), identity сохранена у 9990/10000 строк по построению. Server-first-модель Aegis (сервер контролирует API) делает это реалистичным; `mutate()` (3644) и `optimistic` в mutation() (3714) сегодня требуют от пользователя вручную писать иммутабельные обновления.

**Предложение:** Экспорт `applyPatch(doc, ops)` — иммутабельный RFC 6902 (add/remove/replace/move) + RFC 7386 merge-patch, копирующий только путь к изменённому узлу (O(p·depth) вместо O(N)). Использование: (a) `resource(url, { cache: true, delta: true })` шлёт `Accept: application/json-patch+json, application/json` + `If-None-Match`; при `content-type: application/json-patch+json` `_fetchEntry` применяет патч к `e.data.peek()`; (b) `r.patch(ops)` как sharing-friendly `mutate` для optimistic; (c) `sse(url, { patch: true })` / streamResource `reduce: applyPatch`.

**Алгоритм:**

```js
function _setIn(node, parts, i, fn) {              // path-copying, O(depth)
  if (i === parts.length) return fn(node);
  const arr = Array.isArray(node), k = arr ? +parts[i] : parts[i];
  const child = _setIn(node[k], parts, i + 1, fn);
  if (child === node[k]) return node;              // без изменений — без копии
  const copy = arr ? node.slice() : { ...node };
  if (child === undefined) { arr ? copy.splice(k, 1) : delete copy[k]; } else copy[k] = child;
  return copy;
}
export function applyPatch(doc, ops) {
  if (!Array.isArray(ops)) return _mergePatch(doc, ops);           // RFC 7386
  for (const op of ops) {
    const p = op.path.split('/').slice(1).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (op.op === 'remove') doc = _setIn(doc, p, 0, () => undefined);
    else if (op.op === 'add') { const last = p.pop(); doc = _setIn(doc, p, 0, n => Array.isArray(n)
      ? (a => (a.splice(last === '-' ? a.length : +last, 0, op.value), a))(n.slice()) : { ...n, [last]: op.value }); }
    else if (op.op === 'replace') doc = _setIn(doc, p, 0, () => op.value);
    else if (op.op === 'move') { const v = _getIn(doc, op.from); doc = applyPatch(doc, [{ op: 'remove', path: op.from }, { op: 'add', path: op.path, value: v }]); }
  }
  return doc;
}
// Стоимость: p операций × depth копий узлов; для 10 ops на 10k строк — 10 копий объектов + 10 копий массива(10k) ≈ 0.05 мс.
```

**API:**

```js
import { resource, applyPatch } from './aegis.js';
const users = resource('/api/users', { cache: true, delta: true }); // сервер может ответить 200 json-patch+json
users.patch([{ op: 'replace', path: '/3/name', value: 'Ann' }]);     // локально, identity остальных строк сохранена
const save = mutation(fn, { resources: [users], optimistic: (id, name) => users.patch([{ op:'replace', path:`/${idx}/name`, value:name }]) });
// d.ts: applyPatch<T>(doc: T, ops: JsonPatchOp[] | object): T; ResourceOptions.delta?: boolean; ResourceResult.patch(ops)
```

**Критерий:** Тест: applyPatch на 10k-массиве с 10 replace — все незатронутые строки `===` prev (9990/10000), затронутые новые; RFC 6902 test-suite (add/remove/replace/move, escaping ~0/~1) зелёный. Бенч: применение 10 ops ≤ 0.1 мс vs полный ответ ≥ 10 мс; трафик ревалидации ≤ 1% полного ответа на демо admin.html при 1% изменённых строк.

**Источники:** RFC 6902 JSON Patch, RFC 7386 JSON Merge Patch, fast-json-patch, Immer produce/patches, Phoenix LiveView diff-протокол, Relay @stream/@defer

## 💎 #103 — Dev-диагностика доли переиспользования: E038 «volatile field убивает identity строк»

**Impact:** 3 · **Effort:** S · **Size:** +~250 B gzip в full (dev-ветка), 0 в core/prod при tree-shake _dev

**Сейчас:** Ни одной метрики, работает ли sharing. Типичный кейс: сервер отдаёт `updatedAt`/`viewCount`/`servedAt` в каждой строке → `_share` возвращает новые объекты для всех строк → list() (2831–2839) перерисовывает всё на каждой ревалидации, пользователь этого не видит. `_devTrackFetch` (5776) ловит дубли и штормы, но не «пустой» sharing. Devtools (aegis-devtools.js) показывает resourceCache.size (991), но не hit-ratio.

**Предложение:** В dev-режиме `_share` считает reused/total узлов и для keyed-массивов собирает поля, отличающиеся у строк с совпадающим ключом. Если у ≥ 90% совпавших строк отличается одно и то же множество полей (≤ 3 поля) — `_warn('E038')` с именами полей и советом (`transform: rows => rows.map(({updatedAt, ...r}) => r)` или убрать поле с сервера). Метрика `shared: 97%` в панели ресурсов devtools.

**Алгоритм:**

```js
// только под _dev(); в prod ветка отсутствует
let _st = null;                                     // { total, reused, diffFields: Map<field, count>, rows }
function _shareDev(prev, next, key) {
  _st = { total: 0, reused: 0, diffFields: new Map(), rows: 0 };
  const out = _share(prev, next, key);              // _share инкрементит _st.total/_st.reused при _dev()
  if (Array.isArray(out) && _st.rows >= 5) {
    const bad = [..._st.diffFields].filter(([, c]) => c >= _st.rows * 0.9).map(([f]) => f);
    if (bad.length && bad.length <= 3 && _st.reused / _st.total < 0.5) _warn('E038', {
      what: `resource: ${_st.rows} rows lost identity on revalidate; field(s) ${bad.join(', ')} change in every response.`,
      why: 'Each list() row re-renders even though nothing visible changed.',
      fix: `Strip them in transform: rows => rows.map(({ ${bad.join(', ')}, ...r }) => r) — or omit on the server.`,
    }, 'share:' + bad.join(','));
  }
  return out;
}
// в keyed-ветке _share: for (const f of keys) if (!Object.is(pv[f], next[i][f])) _st.diffFields.set(f, (_st.diffFields.get(f)||0)+1); _st.rows++;
```

**API:**

```js
Ничего нового публично; E038 в ERRORS.md; devtools: колонка «shared %» рядом с key/staleTime.
```

**Критерий:** Тест (dev): ответ из 20 строк, во втором ответе у всех изменён только `updatedAt` → ровно одно предупреждение E038 с текстом «updatedAt»; после `transform`, убирающего поле, предупреждения нет и `data.value === prev`. Оверхед в prod = 0 (ветка под `_dev()`), в dev ≤ 15% времени `_share`.

**Источники:** React DevTools «why did this render», TanStack Query Devtools, why-did-you-render (highlight identical-props rerenders)

## 💎 #104 — infiniteResource: `_share` сейчас no-op, сделать keyed-share на reset()/refresh

**Impact:** 2 · **Effort:** S · **Size:** −~30 B (убрать no-op) / +~120 B с keyed-share на reset

**Сейчас:** aegis_full.js:6097 `pages.value = share ? _share(pages.peek(), [...pages.peek(), result]) : [...]` — каждый prev-элемент `===` (короткое замыкание), новая страница — `_share(undefined, result)` → возвращает result как есть. Итого O(pages) работы и всегда новый массив; опция `share` в infiniteResource ничего не меняет. При `reset()` (6110) `pages.value = []` — все строки теряют identity, list() перерисовывает весь фид при pull-to-refresh.

**Предложение:** Убрать бесполезный вызов при loadMore (дешевле и на пару десятков байт меньше), а при `reset()` не обнулять pages сразу: держать `prevPages`, и первую загруженную после reset страницу шарить keyed по `id` против `prevPages.flatMap(select)` — строки, которые «остались», сохраняют identity и DOM. Опция `share: 'id'` из предложения 1 применяется тут же.

**Алгоритм:**

```js
const reset = () => { abort(); prevRows = pages.peek().flatMap(select); batch(() => { pages.value = []; cursor.value = undefined; error.value = null; }); return immediate ? loadMore() : Promise.resolve(); };
// в loadMore после получения result:
let page = result;
if (prevRows && share) {                           // только первая страница после reset
  const items = select(result);
  const shared = _share(prevRows, items, shareKey);  // keyed: O(prev + items)
  page = items === result ? shared : { ...result, [selectKey]: shared };  // select — стандартный r.items или сам r
  prevRows = null;
}
pages.value = [...pages.peek(), page];
// Ограничение: работает, когда select — доступ к полю (`r.items`) или identity; для произвольного select оставляем как есть.
```

**API:**

```js
const feed = infiniteResource(cursor => ..., { select: r => r.items, share: 'id' });
feed.reset();  // видимые строки, оставшиеся в новой первой странице, не перерисовываются
```

**Критерий:** Тест: 2 страницы по 10 строк → reset() → первая страница содержит 8 старых id + 2 новых → renderFn list() вызван 2 раза, `data.value[k] === oldRow` для 8 совпавших. Бенч: loadMore на 100 страницах не вызывает _share (0 обходов вместо O(pages)).

**Источники:** TanStack Query useInfiniteQuery (refetch сохраняет структуру pages), Relay connection handler (edges by cursor/id)


---

# 📐 revalidation-scheduling

**Линза:** math / revalidation-scheduling

**Вывод:** В Aegis ревалидация — это два несвязанных механизма без общей модели: `_installRevalidate` (aegis_full.js:5851–5864) для cached-entries с одним глобальным `lastFocus`, без rate limit на `reconnect`, с отбрасыванием событий в скрытой вкладке (5856) и одновременным стартом всех entries; и per-instance listeners в `_plainResource` (3665–3669) на `throttled` с trailing edge и `poll()`. Формально каждая entry e — это кортеж (S_e staleTime, t_e lastFetch, R_e множество причин, refCount), а событие ev в момент t порождает кандидатов C = {e : refCount>0, ev∈R_e, t−t_e ≥ S_e, promise=null}; сейчас C выполняется целиком и мгновенно в порядке вставки в Map. Предлагаю один модульный планировщик `_sched`: token bucket на причину (не на всё приложение), очередь с приоритетом (видимость × возраст) и ограничением параллелизма k=6, накопление причин в фоне с flush на visible, min-heap таймер для interval-polling с выравниванием момента срабатывания к сетке, и Web Locks для выбора вкладки-лидера. Симуляция (scratchpad/agents/revalidation-scheduling/sim.mjs, sim2.mjs): на дашборде из 40 entries при 8 видимых p50 свежести видимых падает с 1021 мс до 250 мс без роста числа запросов; флаппинг online/offline ×6 даёт 150 запросов вместо 50; trailing `throttled` делает лишний fetch через 5 с после последнего alt-tab; heap-таймер с сеткой 2.5 с сокращает пробуждения таймера с 455 до 222 за 10 мин при −2% запросов.

**Отвергнуто:** 1) IntersectionObserver на каждый cached entry для приоритета по видимости — дороже (N наблюдателей, асинхронные callbacks, нужен host-элемент как сейчас у `observe`), а `checkVisibility()` + один `getBoundingClientRect` за тик дают то же на N ≤ 100 синхронно; сохранил как опцию через `scope.el`. 2) `requestIdleCallback`/`scheduler.postTask` для ревалидации — планирование CPU-тика, а не сети; узкое место здесь — 6 соединений на хост и RTT, idle-callback ничего не даёт (и в фоне не срабатывает). 3) Настоящий min-heap для интервалов — при N в десятках `sort()` на массиве проще и меньше по коду; вернуться, если появится сотни entries. 4) Единая глобальная rate-limit на все причины (как сейчас `lastFocus`) — теряет reconnect после focus в течение 5 с; поэтому bucket на причину. 5) Heartbeat через localStorage для лидера вкладок — гонки, таймауты, «мёртвый лидер» 10–30 с; Web Locks решает это нативно. 6) Адаптивный interval по частоте изменений данных (AIMD: удвоение при «не изменилось», сброс при изменении) — интересно математически (`_share` уже знает, изменился ли ответ), но меняет семантику interval, которую разработчик задал явно; можно потом как `interval: 'adaptive'`. 7) Приоритизация через `fetch({priority})` без очереди — браузер применяет priority только внутри своего лимита соединений, не сокращает время ожидания видимых entries, если они попали в конец Map; очередь нужна на уровне Aegis. 8) Общая переработка ключей/cache API/ETag — вне линзы, уже в списке известных пробелов.

## 💎 #105 — Единый планировщик ревалидации `_sched` с token bucket на причину и приоритетной очередью

**Impact:** 5 · **Effort:** M · **Size:** +0.5–0.7 KB gzip (планировщик ~60 строк) минус ~0.2 KB (удаление 3665–3669 и 5851–5864) ≈ +0.4 KB нетто

**Сейчас:** aegis_full.js:5851–5864 `_installRevalidate`: три `addEventListener` (visibilitychange/focus → 'focus', online → 'reconnect'), один глобальный `lastFocus` (5857) на ВСЕ entries, `reconnect` без ограничения, цикл `for (const e of _resourceCache.values())` (5858–5859) запускает `_fetchEntry` для всех подходящих сразу в порядке вставки в Map. Параллельно `_plainResource` (3665–3669) ставит свои listeners на каждый инстанс: `on(document,'visibilitychange',tick)`, `on(window,'focus',throttled(tick,5000))`, `on(window,'online',tick)`, `poll(...)`. Offline-ресурс (8039+) не имеет revalidation вообще, только `_flushOffline` на 'online' (7973).

**Предложение:** Заменить обе схемы одним модульным планировщиком: реестр `_revalidators = Set<{ fire(reason, now), prio(now), on: Set<reason> }>`, в который регистрируются cached entries (в `use()`, 5978–5981), plain resources (вместо 3665–3669) и offline. Событие → `_sched.push(reason)`; внутри: token bucket на причину (`focus`: cap 1, refill 5 с; `reconnect`: cap 1, refill 2 с; `interval`: без bucket), объединение нескольких событий одного тика через `queueMicrotask` (visibilitychange + focus приходят подряд), сбор кандидатов, сортировка по приоритету и выдача с параллелизмом k=6 (лимит HTTP/1.1 на хост; при `navigator.connection.effectiveType` 2g/3g — k=2). Остальные дренируются по мере завершения promise. Снимает per-instance listeners у plain resource (сейчас N инстансов = N listeners на window).

**Алгоритм:**

```js
const _buckets = { focus: {cap:1, refill:5000}, reconnect: {cap:1, refill:2000} };
const _regs = new Set(); let _pending = new Set(), _queued = false, _running = 0, K = 6;
function _take(reason, now) {
  const b = _buckets[reason]; if (!b) return true;
  b.tokens = Math.min(b.cap, (b.tokens ?? b.cap) + (now - (b.t ?? now)) / b.refill); b.t = now;
  if (b.tokens < 1) return false; b.tokens -= 1; return true;   // лишние события ДРОПАЮТСЯ (leaky, без trailing)
}
function _push(reason) {
  if (document.visibilityState !== 'visible') { _deferred.add(reason); return; }  // см. предложение 3
  const now = Date.now(); if (!_take(reason, now)) return;
  _pending.add(reason);
  if (!_queued) { _queued = true; queueMicrotask(_drain); }   // visibilitychange+focus → один тик
}
function _drain() {
  _queued = false; const reasons = _pending; _pending = new Set(); const now = Date.now();
  const c = [];
  for (const r of _regs) for (const reason of reasons) if (r.on.has(reason) && r.due(now)) { c.push(r); break; }
  c.sort((a, b) => b.prio(now) - a.prio(now));
  _queue.push(...c); _pump();
}
function _pump() { while (_running < K && _queue.length) { const r = _queue.shift(); _running++; Promise.resolve(r.fire()).finally(() => { _running--; _pump(); }); } }
// для cached entry: due = now - e.lastFetch >= (e.fopts.staleTime||0) && !e.promise; fire = () => _fetchEntry(e, e.url, e.fopts)
// prio = (visible ? 2 : 1) * (now - lastFetch) / max(staleTime, 1000)   — см. предложение 2
// Симуляция sim2.mjs: N=40, 8 видимых, RTT 250 мс, 6 conn/host: visibleFreshP50 1021 → 250 мс, max 1614 → 500 мс, allDone 1750 = 1750 (запросов столько же).
```

**API:**

```js
// Внутреннее — публичный API не меняется, дефолты те же:
resource(url, { cache: true, revalidateOn: ['focus', 'reconnect'] })
resource(url, { refetch: { focus: true, reconnect: true } })     // plain — теперь через тот же планировщик
// Опционально, настройка bucket'ов и параллелизма (configure уже Object.assign в _config, 1237):
configure({ revalidate: { focus: 5000, reconnect: 2000, concurrency: 6 } })
// dev: stats().revalidate → { queued, running, dropped: { focus: n, reconnect: n } }  (расширение stats(), 986–995)
```

**Критерий:** 1) sim2.mjs сценарий 1: p50 времени свежести видимых entries при N=40 ≤ 300 мс (сейчас ~1020 мс), число запросов не растёт. 2) Тест в test.html: 25 cached entries с revalidateOn ['reconnect'], 6 событий 'online' за 3 с → ≤ 50 fetch (сейчас 150, sim.mjs сценарий 3). 3) `getEventListeners(window).focus.length` на странице с 30 plain resource({refetch:{focus:true}}) = 1 (сейчас 30). 4) E030 «storm ≥10 req/s» (5806) не срабатывает на возврате во вкладку дашборда demo/admin.html.

**Источники:** SWR (focusThrottleInterval 5 с, dedupingInterval 2 с — per-hook, а не глобально), TanStack Query (focusManager/onlineManager — единые менеджеры + refetch только stale), token bucket / leaky bucket (Tanenbaum, Computer Networks), Chrome «6 connections per host» лимит HTTP/1.1

## 💎 #106 — Приоритет ревалидации по видимости и возрасту через `scope.el.checkVisibility()`

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip

**Сейчас:** Entry не знает, видна ли она: у `_cacheEntry` (5739–5757) нет ссылки на DOM. Но у каждого вызова `_cachedResource` есть `_currentScope` (5992: `_currentScope.onDispose(dispose)`), а `Scope.el` (768) заполняется в mount (2977). Порядок обхода в `_installRevalidate` (5858) — порядок вставки в Map, т.е. порядок первого монтирования, никак не связанный с тем, что сейчас на экране. `prefetch` (5915) уже использует `priority:'low'` для fetch — а для ревалидации приоритет не задаётся.

**Предложение:** При регистрации ресурса в планировщике запомнить ближайший `el` по цепочке `_currentScope → parent` (без удержания: WeakRef не нужен, scope и так живёт столько же, сколько refCount). В момент дренажа считать приоритет: `vis = el ? (el.checkVisibility?.({contentVisibilityAuto:true}) ?? true) && rectInViewport(el) : 1`; `prio = (vis ? 2 : 1) * age / max(staleTime, 1000)`. Видимые и самые старые — первыми; невидимые (display:none табы, `content-visibility:auto` за экраном, свёрнутые панели) — в хвост очереди и с `fetch(..., {priority:'low'})`. `getBoundingClientRect` один раз на entry за тик (N ≤ десятки) — один forced layout, приемлемо.

**Алгоритм:**

```js
function _hostEl() { for (let s = _currentScope; s; s = s.parent) if (s.el) return s.el; return null; }
function _visible(el) {
  if (!el || !el.isConnected) return 0.5;                       // нет DOM — среднее
  if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) return 0;
  const r = el.getBoundingClientRect();
  return (r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) ? 1 : 0.25;
}
// prio(now) для cached entry:
prio = (1 + _visible(el)) * (now - e.lastFetch) / Math.max(e.fopts.staleTime || 0, 1000);
// fire: _fetchEntry(e, e.url, { ...e.fopts, fetcher: vis ? e.fopts.fetcher : lowPriorityFetcher })
// Формально: минимизируем Σ_visible (t_fresh_e) при фиксированной пропускной способности k/RTT —
// это shortest-weighted-first: сортировка по весу оптимальна для суммы взвешенных времён завершения (правило Смита, все работы ≈ равной длины RTT).
```

**API:**

```js
resource(url, { cache: true, revalidateOn: ['focus'], priority: 'auto' | 'high' | 'low' })   // 'auto' = по видимости (default)
// dev-панель / stats(): stats().revalidate.lastTick = [{ key, prio, visible, ageMs }] — почему в таком порядке
```

**Критерий:** sim2.mjs сценарий 1 (видимые в случайных позициях Map): visibleFreshMax N=80 — 2820 → 500 мс. Тест: 3 cached entries, у двух host-элемент с display:none, focus → в `_netLog` (5765) первым идёт URL видимой entry. Измерение в demo/admin.html: `performance.mark` от visibilitychange до обновления data видимого виджета — ≤ 1 RTT.

**Источники:** Smith's rule (weighted shortest processing time, 1956), TanStack Query `refetchOnWindowFocus` + `enabled`, `Element.checkVisibility()` (Chrome 105, Firefox 106, Safari 17.4), Fetch Priority API (`priority: 'low'`), IntersectionObserver-free visibility check

## 💎 #107 — Накопление причин в скрытой вкладке и flush на visible (не терять reconnect)

**Impact:** 3 · **Effort:** S · **Size:** +0.1 KB gzip

**Сейчас:** aegis_full.js:5856 `if (document.visibilityState !== 'visible') return;` — событие 'online' в скрытой вкладке отбрасывается. Entry с `revalidateOn: ['reconnect']` (без 'focus') после возврата во вкладку остаётся со старыми данными навсегда. То же в plain: 3666 `tick` проверяет `visible` и молча выходит; `poll()` (1515–1530) правильно спит и делает запрос при visible, но это только для `refetch.interval`. `_installOfflineListeners` (7970–7975) на 'online' делает `_flushOffline` даже в фоне — тратит батарею/сеть невидимой вкладки.

**Предложение:** Ввести множество `_deferred: Set<reason>` в планировщике: любое событие в фоне (и в состоянии `navigator.onLine === false`) не отбрасывается, а помечает причину; на `visibilitychange → visible` планировщик делает `_push` для всех накопленных причин (они объединяются с 'focus' в один тик, token bucket 'focus' не мешает — reconnect отдельный bucket). Дополнительно: 'online' без подтверждения `navigator.onLine` — noop; 'offline' → сбросить bucket reconnect в 0 (чтобы первый online после реального разрыва прошёл сразу). Формально: планировщик становится автоматом с состояниями {visible, hidden} × pending⊆Reasons, переход hidden→visible = flush(pending).

**Алгоритм:**

```js
const _deferred = new Set();
function _push(reason) {
  if (document.visibilityState !== 'visible') { _deferred.add(reason); return; }
  ... // как в предложении 1
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const rs = ['focus', ..._deferred]; _deferred.clear();
  for (const r of rs) _push(r);           // один microtask-тик, один drain, одна сортировка
});
window.addEventListener('online', () => navigator.onLine && _push('reconnect'));
window.addEventListener('offline', () => { _buckets.reconnect.tokens = 1; });   // разрыв гарантирует свежий токен
// Инвариант: ∀ event ev, ∀ e с ev∈R_e и refCount>0: ∃ ревалидация e в момент ≥ max(t_ev, t_visible) — событие никогда не теряется, только откладывается.
```

**API:**

```js
// Без изменений публичного API. Документировать в JSDoc CacheOptions.revalidateOn:
// «события, пришедшие в скрытой вкладке, применяются при возврате в неё».
// Расширение: revalidateOn: ['focus', 'reconnect', 'visible'] — 'visible' = только visibilitychange, без window.focus (alt-tab между окнами не считается)
```

**Критерий:** Тест test.html: cached entry с `revalidateOn: ['reconnect']`, эмуляция `document.hidden = true` → dispatch 'online' → `hidden = false` + visibilitychange → ровно 1 fetch (сейчас 0). Второй тест: 3 'online' в фоне + возврат → 1 fetch (accumulated as Set). sim.mjs сценарий 6.

**Источники:** TanStack Query onlineManager (событие запоминается, refetchOnReconnect срабатывает при возврате), Page Lifecycle API (hidden → frozen → discarded), Chrome intensive throttling docs (2021)

## 💎 #108 — Убрать trailing edge в focus-throttle plain resource: leaky bucket вместо `throttled()`

**Impact:** 2 · **Effort:** S · **Size:** +0.05 KB gzip

**Сейчас:** aegis_full.js:3667 `on(window, 'focus', throttled(tick, 5000))`. `throttled` (1492–1508) реализует trailing edge: при вызове внутри окна ставит `setTimeout(..., remaining)` и всё равно выполняет fn по истечении окна. Для ревалидации это лишний запрос: пользователь сделал 5 alt-tab за 3 с и ушёл — через 5 с после первого focus уходит второй fetch в уже покинутую (но visible) вкладку. Одновременно 3667 `visibilitychange → tick` без throttle, так что при возврате во вкладку срабатывают и visibilitychange, и focus (второй отсекается `inflight.peek()` — но только если первый запрос ещё в полёте, при быстром ответе <RTT их два).

**Предложение:** Для ревалидации нужен drop-семантический rate limiter (leaky bucket с нулевой очередью), а не throttle с отложенным вызовом. Минимальная правка (если предложение 1 не принято): заменить `throttled(tick, 5000)` на `_dropThrottle(tick, 5000)` — фиксация `last` и выход без таймера; и объединить visibilitychange+focus через один и тот же ограничитель. При принятии предложения 1 — это автоматически: bucket 'focus' cap 1 без очереди. Полезно также экспортировать `throttled(fn, ms, { trailing: false })` — универсально для scroll/resize.

**Алгоритм:**

```js
export function throttled(fn, ms, { trailing = true } = {}) {
  let last = 0, timer = null;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const t = (...a) => {
    const now = Date.now(), rem = ms - (now - last); cancel();
    if (rem <= 0) { last = now; fn(...a); }
    else if (trailing) timer = setTimeout(() => { last = Date.now(); timer = null; fn(...a); }, rem);
  };
  t.cancel = cancel; if (_currentScope) _currentScope.onDispose(cancel); return t;
}
// 3667: const tick5 = throttled(tick, 5000, { trailing: false });
//       on(document, 'visibilitychange', tick5); on(window, 'focus', tick5);
// sim2.mjs сценарий 2: focus @ 0, 800, 1600, 2400, 3200 мс → сейчас fetches @ [0, 5000] (2), с trailing:false → [0] (1).
```

**API:**

```js
throttled(fn, ms, { trailing?: boolean })   // default true — обратная совместимость
resource(url, { refetch: { focus: true } })  // поведение: не более 1 запроса за 5 с, без хвостового
```

**Критерий:** Тест: plain resource с `refetch:{focus:true}`, 5 focus-событий за 3.2 с с моком `Date.now`, продвинуть таймеры на 6 с → 1 fetch (сейчас 2). Плюс проверка `throttled(fn, 100, {trailing:false})`: 3 вызова за 50 мс → 1 вызов fn, таймеров не создано (`setTimeout` не вызван).

**Источники:** lodash.throttle `{trailing:false}`, SWR focusThrottleInterval (drop, без trailing), leaky bucket as meter vs as queue (RFC 2697 / Turner 1986)

## 💎 #109 — Polling для cached resource через один min-heap таймер с выравниванием к сетке и сном в фоне

**Impact:** 4 · **Effort:** M · **Size:** +0.5 KB gzip

**Сейчас:** `refetch.interval` есть только у plain (3669) через `poll()` (1515–1530): per-instance async-цикл `setTimeout(ms)`, спит в фоне, при visible — запрос сразу. У `_cachedResource` (5960–6040) polling отсутствует (известный пробел), `CacheOptions` (aegis.d.ts:539–546) не имеет `interval`. Если добавить наивно — N entries = N независимых таймеров со случайными фазами: 12 entries с интервалами 5–90 с дают 455 пробуждений за 10 мин (sim2.mjs сценарий 4), в фоне Chrome троттлит цепочки таймеров до 1/мин после 5 мин, и каждое пробуждение — отдельная радиосессия на мобильном.

**Предложение:** Добавить `interval` (и `background: false`) в CacheOptions; реализовать не через `poll()` на entry, а через один модульный таймер планировщика: min-heap (или отсортированный массив — N мал) по `due_e = ceil((lastFetch + T_e) / G) * G`, где G — сетка выравнивания (default 1000 мс, `configure({revalidate:{grid}})`). Один `setTimeout` до ближайшего due; при срабатывании — все entries с due ≤ now идут в приоритетную очередь предложения 1 как reason 'interval'. В hidden: таймер снимается; на visible — пересчёт due по фактическому `lastFetch` (entries, у которых `now − lastFetch ≥ T_e`, идут сразу, в приоритетном порядке, а не «все сразу»). `_fetchEntry` уже обновляет `lastFetch` (5842), поэтому фокус-ревалидация автоматически сдвигает следующий тик polling — двойных запросов нет. Ошибка → экспоненциальный backoff интервала: `T_e * 2^errors` с потолком 5 мин и джиттером.

**Алгоритм:**

```js
const _heap = [];  // [{ e, due }], N мал — sort вместо настоящей кучи
let _timer = null;
function _arm() {
  clearTimeout(_timer); _timer = null;
  if (document.hidden || !_heap.length) return;
  _heap.sort((a, b) => a.due - b.due);
  _timer = setTimeout(_tickInterval, Math.max(0, _heap[0].due - Date.now()));
}
function _due(e, now) {
  const T = e.fopts.interval * (e.errors ? Math.min(2 ** e.errors, 60) : 1) * (e.errors ? 0.75 + Math.random() * 0.5 : 1);
  return Math.ceil((Math.max(e.lastFetch, now - T) + T) / G) * G;   // выравниваем МОМЕНТ вверх, интервал не искажаем
}
function _tickInterval() {
  const now = Date.now(), ready = [];
  for (const h of _heap) if (h.due <= now && h.e.refCount > 0) ready.push(h.e);
  for (const e of ready) _enqueue(e, 'interval');           // очередь предложения 1, prio по видимости
  for (const h of _heap) if (h.due <= now) h.due = _due(h.e, now);
  _arm();
}
// visible: for (h of _heap) h.due = _due(h.e, Date.now()); _tickInterval();
// hidden (если !background): clearTimeout(_timer)
// Числа (sim2.mjs, 12 entries, 10 мин): G=0 → 455 пробуждений/455 запросов; G=1000 → 342/454, опоздание 16 мс;
// G=2500 → 222/447, опоздание 175 мс; G=5000 → 119/419, опоздание 759 мс. Рекомендуемый default G=1000, на 2g/3g — 5000.
```

**API:**

```js
resource('/api/stats', { cache: true, interval: 10_000 })                        // спит в фоне, при visible — сразу если просрочено
resource('/api/stats', { cache: true, interval: 10_000, background: true })      // продолжать в фоне (браузер всё равно троттлит до 1/мин)
resource('/api/job/1', { cache: true, interval: (data) => data?.status === 'done' ? 0 : 2000 })   // функция от data: 0 = стоп (как TanStack)
configure({ revalidate: { grid: 1000 } })
// d.ts CacheOptions: interval?: number | ((data: T) => number); background?: boolean
```

**Критерий:** 1) sim2.mjs: пробуждения таймера за 10 мин с 12 entries ≤ 350 при G=1000 (сейчас было бы 455 при per-entry реализации), запросов не больше. 2) Тест: cached entry interval 100 мс, mock hidden 1 с → 0 fetch в фоне; visible → 1 fetch в течение 1 тика. 3) Тест: focus-ревалидация в t=50 при interval 100 → следующий polling-fetch не раньше t=150 (lastFetch сдвигает due). 4) Chrome Performance: одна `setTimeout`-запись на тик, не N.

**Источники:** TanStack Query refetchInterval / refetchIntervalInBackground (функция от data), Chrome timer throttling & intensive wake-up throttling (Chrome 88, 1/мин после 5 мин в фоне), Android AlarmManager inexact / setWindow (выравнивание пробуждений для батареи), timer coalescing в Chromium (alignment 1 с), min-heap timer wheel

## 💎 #110 — Лидер среди вкладок для polling/focus-revalidate через Web Locks + BroadcastChannel

**Impact:** 3 · **Effort:** M · **Size:** +0.4 KB gzip (opt-in, tree-shakeable если вынести в отдельный экспорт `crossTab()`)

**Сейчас:** Каждая вкладка с одним и тем же cached-ключом ревалидирует независимо: `_resourceCache` (5737) — модульная Map на документ. Пользователь админки с 3 открытыми вкладками /users → 3× запросов на каждый focus, и при polling 3× нагрузка постоянно (sim.mjs сценарий 7: 8 вкладок × interval 10 с = 48 req/мин вместо 6). `seed()` (5871) умеет класть данные в кэш извне — готовая точка входа для данных от другой вкладки. `_idb` (7844) уже учитывает multi-tab (onversionchange), но для SWR-кэша кросс-вкладочной координации нет; BroadcastChannel и navigator.locks в файле не используются.

**Предложение:** Opt-in `configure({ revalidate: { crossTab: true } })` (или `cache: { shared: true }`): 1) `navigator.locks.request('aegis:revalidate', { mode: 'exclusive' }, () => new Promise(() => {}))` — вкладка, получившая лок, становится лидером; лок автоматически освобождается при закрытии/крэше вкладки, следующая в очереди становится лидером (без heartbeat и таймаутов). 2) Лидер выполняет 'interval'-ревалидации и после успешного `_fetchEntry` шлёт `{key, data, lastFetch}` в `BroadcastChannel('aegis:cache')`; остальные вкладки принимают через `seed(key, data, {age})` — их entries обновляются реактивно без запроса. 3) 'focus' у не-лидера: если `now − lastFetch < staleTime` после broadcast — запрос не нужен (5828 уже это проверяет), иначе делает сам (пользователь смотрит именно на эту вкладку). 4) `invalidate(key)` в любой вкладке broadcast'ится — лидер перезапрашивает, остальные получают seed. Формально: система из T вкладок с общим множеством ключей K сводится к одному poll-процессу с fan-out; нагрузка O(|K|/T_i) вместо O(T·|K|/T_i).

**Алгоритм:**

```js
let _leader = false, _bc = null;
function _installCrossTab() {
  if (_bc || typeof BroadcastChannel === 'undefined') return;
  _bc = new BroadcastChannel('aegis:cache');
  _bc.onmessage = ({ data: m }) => {
    if (m.t === 'data') { const e = _resourceCache.get(m.key); if (e && m.at > e.lastFetch) seed(m.key, m.data, { age: Date.now() - m.at }); }
    else if (m.t === 'invalidate') { const e = _resourceCache.get(m.key); if (e) { e.lastFetch = 0; if (_leader && e.refCount > 0) _fetchEntry(e, e.url, e.fopts, true); } }
  };
  navigator.locks?.request('aegis:revalidate', () => { _leader = true; _arm(); return new Promise(() => {}); });  // держим до закрытия вкладки
}
// в _fetchEntry после e.data.value = ...: if (_bc && e.fopts.shared) _bc.postMessage({ t: 'data', key: e.key, data: next, at: e.lastFetch });
// в _tickInterval: if (!_leader) return;   // polling только у лидера; при получении лока _arm() запускает таймер
// в invalidate(): if (_bc) _bc.postMessage({ t: 'invalidate', key: k });
// Ограничение: data должна быть structured-cloneable (JSON от request() — да; transform, возвращающий классы/функции — нет → shared:false).
```

**API:**

```js
resource('/api/stats', { cache: true, interval: 10_000, shared: true })   // одна вкладка опрашивает, остальные получают
configure({ revalidate: { crossTab: true } })                              // включить лок/канал глобально
// ReadonlySignal: cacheStats().leader → boolean (для dev-панели)
```

**Критерий:** Открыть demo/admin.html в 4 вкладках с `interval: 5000, shared: true` на /api/stats: в DevTools Network суммарно ≤ 13 запросов/мин (сейчас 48). Тест (jsdom не имеет BroadcastChannel → мок): вкладка B получает `seed` после fetch в A, `B.data.value` обновляется без вызова fetcher; закрытие A (release lock в моке) → B становится лидером и делает следующий interval-fetch.

**Источники:** Web Locks API (navigator.locks, Chrome 69/Firefox 96/Safari 15.4), BroadcastChannel, SWR `broadcastState`/`revalidateOnFocus` per tab, TanStack Query `broadcastQueryClient` (experimental), leader election via lock (не через localStorage heartbeat — нет гонок и таймаутов)

## 💎 #111 — Джиттер и экспоненциальный backoff ревалидации на ошибке (без вечных повторов при focus)

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip

**Сейчас:** `_fetchEntry` (5827–5846): при ошибке `e.error.value = err`, `lastFetch` НЕ обновляется (5842 только в success), поэтому staleTime-гейт (5828) не работает и каждый focus/reconnect/invalidate снова шлёт запрос на сломанный endpoint — при 500/503 это synchronized retry всех вкладок и всех пользователей при каждом alt-tab. `withRetry` (1446–1460) даёт backoff только внутри одного вызова (`base*2^attempt*random`, Retry-After) и только если `retry` задан (`_retries` → 0 по умолчанию, 1464–1469). Между ревалидациями памяти об ошибках нет.

**Предложение:** Добавить в entry счётчик `errors` и `errorAt`; в `due(now)` планировщика учитывать «карантин» после ошибки: `now − errorAt ≥ min(30 с·2^(errors−1), 5 мин) · (0.5 + random)` (full jitter). Успех сбрасывает `errors = 0`. Уважать `Retry-After` из HttpError как минимальный карантин (withRetry его уже парсит — вынести в `_retryAfter(err)`). Ручной `refresh()` (force=true) и `invalidate()` карантин игнорируют — только автоматические причины (focus/reconnect/interval). В dev: ворнинг E0xx «entry X в карантине N с после M ошибок», в `stats().revalidate.quarantined`.

**Алгоритм:**

```js
// в _fetchEntry catch: e.errors = (e.errors || 0) + 1; e.errorAt = Date.now(); e.retryAfter = _retryAfter(err);
// в success: e.errors = 0; e.retryAfter = 0;
function _quarantined(e, now) {
  if (!e.errors) return false;
  const base = Math.min(30_000 * 2 ** (e.errors - 1), 300_000);
  const wait = Math.max(e.retryAfter || 0, base * (0.5 + _jitter(e)));   // _jitter: детерминированный per-entry [0,1) — чтобы вкладки одного юзера не синхронизировались
  return now - e.errorAt < wait;
}
// due(now) для авто-причин: !e.promise && now - e.lastFetch >= staleTime && !_quarantined(e, now)
// Модель: N клиентов с одинаковым staleTime и одинаковыми focus-событиями → без джиттера пик нагрузки N/RTT после восстановления;
// с full jitter пик размазывается по [0.5·base, 1.5·base] (AWS: full jitter минимизирует суммарную работу при contention).
```

**API:**

```js
resource(url, { cache: true, retry: true })                        // как сейчас: внутри одного fetch
resource(url, { cache: true, backoff: false })                     // выключить карантин (default: включён для авто-ревалидаций)
configure({ revalidate: { errorBackoff: [30_000, 300_000] } })      // [base, max]
// r.refresh() и invalidate(key) — всегда немедленно
```

**Критерий:** Тест: fetcher бросает HttpError 503, cached entry с revalidateOn ['focus']; 10 focus-событий с шагом 6 с (bucket пропускает все) → ≤ 3 запроса за 60 с (сейчас 10). С `Retry-After: 120` → 1 запрос за 60 с. После успешного ответа следующий focus через 6 с → запрос уходит (errors сброшен).

**Источники:** AWS Architecture Blog «Exponential Backoff and Jitter» (full jitter), Google SRE Book гл. 22 (thundering herd, retry budgets), SWR errorRetryInterval с `~~((random+0.5) * 2^min(count,8))`, RFC 7231 Retry-After, TanStack Query retryDelay

