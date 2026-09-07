# Aegis — четыре столпа: 14 линз, 81 предложений

> Оркестрация: по 4 агента на реактивность и гидрацию, по 3 на формы и доступность, плюс синтезатор. Каждый агент читал aegis_full.js (свои секции), test.html, aegis.d.ts, ERRORS.md и сравнивал с движками и стандартами 2026 года. Нумерация 💎 сквозная.

## Вывод синтезатора

81 предложение после дедупликации сжимаются примерно до 55 самостоятельных единиц: 14 линз независимо пришли к одним и тем же «бриллиантам», и это сильный сигнал, что именно они — настоящие дыры. В реактивности три сходящихся темы: ошибка computed как значение (1≡19), ленивая подписка computed без владельца (3≡7≡20) и владение эффектом созданных в теле детей (12≡21) — все три чинят реальные утечки и застывающие геттеры store/reactive, и они должны идти первыми, под защитой model-based фаззера (18), потому что дальше меняется раскладка памяти (8, 9) и итерация reactive (10). В формах все линзы разошлись на две оси, которые надо реализовать как один фундамент: «правда vs показ» (issues/valid/canSubmit, 23≡29) и единый per-input слой `_wireInput` (28≡31), из которого потом растут field arrays (35+27), HTML-422-morph (75≡38), wizard/draft (37+32) и GOV.UK-сводка (30+50). В доступности фундамент — announce 2.0 с двумя предсозданными регионами (34≡46≡47): без него route announcer (41≡48), сетевые состояния (49) и серверные объявления (51⊂71) будут строить хор; вторая опора — непрерывность фокуса при удалении узлов (42+E050 из 56) и после навигации. В гидрации первично поведение «до монтирования»: стриминг-безопасность (60⊂70), очередь событий для всех стратегий (61⊃68), parent-first порядок (64), затем серверный контракт §34 (71⊃51, 72, 75, 73, 74, 76⊃78.permanent) и только потом claim-гидрация (77≡59) и планировщик (65→66→67). Инструменты (54, 40, 55, 58, 53, 57, 69) идут последними и живут вне 75 KB. Ядро вырастет с 6.1 до ≈7.0 KB gzip (неизбежно: фазы 1–2 меняют семантику Computed/Effect), всё остальное — tree-shakeable или в отдельных модулях; полная сборка ≈ 75 → 82 KB при включении всего.

## Топ по соотношению impact/effort

| # | Impact | Effort | Область | Предложение | Почему |
|---|---|---|---|---|---|
| 19 | 5 | S | ⚛️ Реактивность | **Fault-injection: computed, бросивший исключение, не должен рвать граф и убивать раунд** | Объединено с 1. Impact 5 / S, +0.18 KB ядра. Сейчас исключение в computed рвёт подписки и убивает раунд flush — самый дорогой класс багов «граф молча перестал обновляться». Семантика TC39/Preact (ошибка — кэшированное значение, deps сохраняются через _endTrack, version() не бросает) проверена индустрией; тесты из 1 и 19 покрывают выздоровление и exception-safe _changedDeps. |
| 7 | 5 | M | ⚛️ Реактивность | **Unowned computed: подписка на источники только пока есть свои подписчики (чинит застывающие геттеры store/reactive)** | Объединено с 3 и 20. Impact 5 / M, +0.2 KB (частично компенсируется снятием регистрации computed() в scope). Чинит застывающие геттеры store()/reactive() после dispose владельца и утечку `b.subs.size === 2000` у одноразовых computed. _epoch fast-path из 3 даёт O(1) чтение неживого computed; критерии из 20 (subs.size === 0 после цикла) — регрессионный страж. |
| 21 | 4 | S | ⚛️ Реактивность | **Дети эффекта: всё созданное в теле эффекта умирает при его перезапуске (семантика Solid/Svelte 5)** | Объединено с 12 (взята более лёгкая реализация — ленивый _kids на Effect вместо полного Scope duck-type, +0.15 вместо +0.3 KB). Impact 5 / S. Даёт семантику Solid/Svelte «созданное в теле эффекта живёт до следующего запуска», убирает целый класс утечек on()/effect() внутри эффекта. onDispose внутри эффекта = cleanup (из 12). |
| 2 | 4 | S | ⚛️ Реактивность | **Ошибка эффекта не бросается писателю сигнала: onError → defaults.onError → reportError** | Impact 4 / S, +0.12 KB. Единая политика ошибок эффектов (defaults.onError → reportError) — без неё бриллиант 19 неполон: ошибка эффекта всё равно летит писателю сигнала и ломает resource/mutation атрибуцию. Strict-режим сохраняет throw для тестов. |
| 18 | 5 | M | ⚛️ Реактивность | **Model-based фаззер графа сигналов с оракулом «пересчитать всё»** | Impact 5 / M, 0 KB в сборке. Фаззер «случайный граф vs пересчитать всё» — единственная защита при последующих правках раскладки памяти (8), _endTrack (9), ленивой подписки (7) и детей эффекта (21). Тесты из 22 (цепочка 2000, ширина) вливаются сюда как стресс-подсекция. |
| 23 | 5 | M | 📝 Формы | **Валидность как производная от значений: issues/valid/canSubmit + живые cross-field правила** | Объединено с 29. Impact 5 / M, +0.35 KB в блоке form. «Правда vs показ»: issues[key] как computed, errors[key] — показ, valid честный, canSubmit — то, чего не хватает всем recipes. Cross-field правила через .value становятся живыми бесплатно. Основа для 24, 26, 30, 37. |
| 28 | 5 | M | 📝 Формы | **form().wire(el): один per-input слой для виртуальных форм — touched, blur-then-live, aria, :user-invalid** | Объединено с 31. Impact 5 / M, почти нулевой чистый размер (перенос цикла wireForm 7071–7182 в общий _wireInput). f.wire(el) / f.field(key) / bind:field закрывают провал «виртуальная form() без a11y и touched» и являются обязательным фундаментом для 35, 75, 37, 30. |
| 47 | 4 | M | ♿ Доступность | **announce 2.0 — два предсозданных региона, очередь без потерь, ariaNotify, реактивный live()** | Объединено с 46 и 34 (announce-часть). Impact 4 / M, +0.4 KB. Два предсозданных региона, очередь, дедуп, ariaNotify-детект. Без этого route announcer (41), сетевые состояния (49), сводка форм (30) и Aegis-Announce (71) построят хор конфликтующих live-регионов. |
| 41 | 5 | M | ♿ Доступность | **Route announcer + focus reset после навигации (router, boost, swap)** | Объединено с 48. Impact 5 / M, +0.45 KB tree-shakeable с router/boost. Сброс фокуса и объявление после навигации — самый заметный a11y-провал любого SPA-роутера; логика выбора цели (fragment → [autofocus] → h1 → outlet) берётся из 48, e.intercept({ focusReset: 'manual' }) — из 41. |
| 42 | 5 | S | ♿ Доступность | **Непрерывность фокуса при удалении узла: list()/show()/virtualScroll/trap.release** | Объединено с E050 из 56. Impact 5 / S, +0.3 KB (в ядре ~120 B). Фокус при удалении строки list()/show()/trap.release уходит на соседа, а не в body; E050 остаётся dev-стражем на случаях, где движок не знает соседей. |
| 61 | 5 | M | 🏝️ Гидрация и server-first | **Replay 2.0: очередь событий до гидрации для всех стратегий, без двойной активации, с submit/input** | Объединено с 68. Impact 5 / M, +0.45 KB в §8. Один capture-рекордер click/keydown/input/change/submit для всех стратегий заменяет частный replay в interaction; hover-прогрев и aria-busy из 68 включаются как режим той же очереди. Устраняет потерю кликов/submit до гидрации — главный UX-баг островов. |
| 75 | 5 | M | 🏝️ Гидрация и server-first | **wireForm: HTML-ответ 422/200 с перерисованной формой — morph формы на место и сбор ошибок из DOM (контракт Django/Rails без JSON)** | Объединено с 38. Impact 5 / M, +0.4 KB внутри wireForm. HTML-422 → morph формы + harvestErrors из разметки (Django .errorlist, Bootstrap .invalid-feedback, Rails) делает wireForm честным progressive-enhancement без JSON-контракта; formnovalidate/intent-кнопки/formEl.elements из 38 — в тот же коммит. |

## Фазовый план

### Фаза 1 — Фаза 1 — Ядро: корректность графа под фаззером

Ошибки перестают рвать граф и раунд; порядок flush детерминирован; полосы дренируются в тике; появляется model-based фаззер и стресс-секция как страж для всех последующих фаз. Ядро 6.1 → ~6.6 KB. Тесты: секции «ошибки не рвут граф», «ошибка эффекта не становится ошибкой resource», «родитель раньше потомка», «полосы flush», «фаззер vs наивная модель» (300 сидов браузер / 2000 node), «стресс: цепочка 2000». Правка 2 тестов test-core.mjs (:179, :256) под новую политику ошибок; __AEGIS_DEV__='strict' в test.html сохраняет throw где нужно.

**Размер:** +0.5 KB gzip ядро; ~600 строк тестов; 1 коммит, M

- 💎 #19 Fault-injection: computed, бросивший исключение, не должен рвать граф и убивать раунд (⚛️ Реактивность, impact 5, effort S)
- 💎 #1 Кэшированная ошибка computed: граф не рвётся (TC39/Preact семантика) (⚛️ Реактивность, impact 5, effort S)
- 💎 #2 Ошибка эффекта не бросается писателю сигнала: onError → defaults.onError → reportError (⚛️ Реактивность, impact 4, effort S)
- 💎 #4 Детерминированный порядок раунда flush по порядку создания (_ord): родитель раньше потомка (⚛️ Реактивность, impact 3, effort S)
- 💎 #5 Полосы micro/frame: дренаж в одном тике и защита от самоцикла (⚛️ Реактивность, impact 3, effort S)
- 💎 #18 Model-based фаззер графа сигналов с оракулом «пересчитать всё» (⚛️ Реактивность, impact 5, effort M)
- 💎 #22 Стресс глубины и ширины: итеративный push + измеримые границы pull-рекурсии (⚛️ Реактивность, impact 3, effort S)

### Фаза 2 — Фаза 2 — Ядро: владение, ленивая подписка, память и эргономика сигналов

Computed живёт только при наблюдателях (чинит store/reactive геттеры, утечки subs), эффект владеет детьми, async setup не теряет scope, тихие no-op становятся предупреждениями; затем — раскладка памяти (единый deps-массив, узлы-disposers) и O(n) _endTrack под защитой фаззера; поверх — lens(), signals(), E-снимок в html``, ленивый снимок $reset и coarse-итерация reactive. Порядок внутри фазы обязателен: 7 → 21 → 13/16 → 8 → 9 → 15/14/17 → 11 → 10. Ядро ~6.6 → ~7.0 KB (7 и 8 частично компенсируют: −40 B регистрация computed, −40 B _unreg-замыкания). Тесты: «computed без владельца», «GC», «дети эффекта», «async setup», «E045–E047», heap-probe ≤ 400 B/effect в node --expose-gc, bench «reactive heap delta».

**Размер:** +0.4 KB ядро (чистыми), +0.9 KB tree-shakeable (lens, signals, reactive-правки); 2–3 коммита, L

- 💎 #7 Unowned computed: подписка на источники только пока есть свои подписчики (чинит застывающие геттеры store/reactive) (⚛️ Реактивность, impact 5, effort M)
- 💎 #3 Ленивая подписка computed (watched/unwatched) + _epoch fast-path + хуки watched/unwatched для signal/from() (⚛️ Реактивность, impact 4, effort M)
- 💎 #20 GC: computed без подписчиков отцепляется от источников (TC39 unwatched / Preact targets-empty) (⚛️ Реактивность, impact 4, effort M)
- 💎 #21 Дети эффекта: всё созданное в теле эффекта умирает при его перезапуске (семантика Solid/Svelte 5) (⚛️ Реактивность, impact 4, effort S)
- 💎 #12 Владение по запуску: эффект — владелец всего, что создано в его теле (⚛️ Реактивность, impact 5, effort M)
- 💎 #13 Async setup без потери владельца: ctx-хелперы привязаны к scope компонента, E001 подсказывает про await (⚛️ Реактивность, impact 4, effort S)
- 💎 #16 Три тихих no-op → предупреждения: watch(plain), запись того же объекта назад, чтение уничтоженного computed (⚛️ Реактивность, impact 3, effort S)
- 💎 #6 E045 — чтение уничтоженного computed: тихо замороженное значение становится предупреждением (⚛️ Реактивность, impact 3, effort S)
- 💎 #8 Memory-diet ядра: effect с одной зависимостью 902 B → ≤ 400 B, строка list() с реактивными ячейками ×2 меньше (⚛️ Реактивность, impact 4, effort M)
- 💎 #9 _endTrack за O(n): массовый сдвиг зависимостей без квадратичного скана (⚛️ Реактивность, impact 3, effort S)
- 💎 #15 lens() и function-bindings для bind: — двусторонняя привязка к любому геттеру/сеттеру (Svelte 5.9) (⚛️ Реактивность, impact 4, effort S)
- 💎 #14 E045 «снимок вместо сигнала»: `${count.value}` в html`` ловится через кольцо untracked-чтений (аналог Svelte state_referenced_locally) (⚛️ Реактивность, impact 4, effort S)
- 💎 #17 signals({}) — именованные сигналы из ключей: каждое предупреждение, граф и трасса называют переменную (⚛️ Реактивность, impact 3, effort S)
- 💎 #11 Ленивый снимок для $reset: reactive({ rows: 100k }) без structuredClone на входе (⚛️ Реактивность, impact 3, effort S)
- 💎 #10 Coarse-итерация reactive-массивов: deep-версия вместо сигнала на каждый ключ каждого элемента (⚛️ Реактивность, impact 4, effort M)

### Фаза 3 — Фаза 3 — Формы: правда vs показ и единый per-input слой

issues/valid/canSubmit как computed, политика «reward early, punish late», _wireInput вынесен и переиспользуется form().wire/field и bind:field, Standard Schema по полям на blur с мемоизацией, реактивная локаль сообщений, status-машина submit с AbortSignal и submitter aria-disabled. Тесты: секции «issues/valid/canSubmit», «f.wire / bind:field», «schema on blur», «i18n ошибок», «status submit + abort». Существующие тесты на errors[key] не меняются (показ остаётся записываемым сигналом).

**Размер:** +1.2 KB gzip в блоке form (tree-shakeable); 2 коммита, M-L

- 💎 #23 Валидность как производная от значений: issues/valid/canSubmit + живые cross-field правила (📝 Формы, impact 5, effort M)
- 💎 #29 Правда vs показ: eager `issues`, честный `valid`, политика «reward early, punish late» (📝 Формы, impact 5, effort M)
- 💎 #28 form().wire(el): один per-input слой для виртуальных форм — touched, blur-then-live, aria, :user-invalid (📝 Формы, impact 5, effort M)
- 💎 #31 Единый a11y-контракт для виртуальной form(): `f.field(key)` + директива `bind:field` (📝 Формы, impact 4, effort M)
- 💎 #24 Standard Schema по полям на blur: issue-фильтрация по пути, один прогон на тик, схема как правило поля (📝 Формы, impact 4, effort S)
- 💎 #26 i18n ошибок: реактивная локаль, plural через i18n().t, нативные ValidityState → коды на языке страницы (📝 Формы, impact 4, effort M)
- 💎 #33 Жизненный цикл отправки: `status`-машина, отменяемый submit, управление submitter, PRG через router (📝 Формы, impact 4, effort M)

### Фаза 4 — Фаза 4 — Формы: рост, серверный контракт, типизация, черновики

Форма становится растущей (shape-сигнал, addField/removeField/renameField, wireForm observe) → fieldArray(); HTML-422/200 → morph формы + harvestErrors + formnovalidate/intents; guard() через Navigation API (guardUnload — deprecated-алиас) и нативный reset; wizard()+draft() как отдельные экспорты (шаги с фокусом и «Шаг n из m» из 34); parsed-значения по схеме, types для date/number/array, InferOutput в d.ts; GOV.UK-сводка и слияние aria-describedby/aria-errormessage (30+50) — здесь, потому что зависит от _wireInput и announce из фазы 5 (в тестах announce мокается; при желании 30 переносится в фазу 5). Тесты: «field arrays», «PE — HTML 422», «guard/draft», «wizard», «parsed/types», «сводка ошибок».

**Размер:** +2.2 KB gzip (fieldArray 0.9, wizard/draft 0.9 — отдельные экспорты; остальное в form/wireForm); 3 коммита, L

- 💎 #35 Field arrays: fieldArray(f, 'items') с устойчивыми ключами строк и перенумерацией имён (📝 Формы, impact 5, effort L)
- 💎 #27 Динамические поля: wireForm({ observe }) и form().add/remove с правилами по шаблону items[].qty (📝 Формы, impact 4, effort M)
- 💎 #75 wireForm: HTML-ответ 422/200 с перерисованной формой — morph формы на место и сбор ошибок из DOM (контракт Django/Rails без JSON) (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #38 Progressive enhancement уровня Conform/Turbo: HTML-ответ 422 → morph формы и ошибки из разметки; formnovalidate; intent-кнопки; formEl.elements (📝 Формы, impact 4, effort M)
- 💎 #32 Черновики и защита от потери: `f.guard()` через Navigation API и router, `f.draft()`, нативный reset (📝 Формы, impact 5, effort M)
- 💎 #37 wizard() и draft(): мастер для form() и wireForm с async-валидацией шага, историей, a11y и черновиком в sessionStorage (📝 Формы, impact 4, effort M)
- 💎 #25 Типизированные значения: вывод Standard Schema в parsed/submit, types для date/number/array, InferOutput в d.ts (📝 Формы, impact 4, effort M)
- 💎 #30 Сводка ошибок GOV.UK: `f.summary()`, фокус на сводку, слияние aria-describedby, ошибки групп на fieldset (📝 Формы, impact 5, effort M)
- 💎 #50 Формы без хора live-регионов: сводка при submit, aria-errormessage, aria-invalid только при ошибке, шаги wizard с фокусом, smooth-scroll под reduced motion (♿ Доступность, impact 4, effort S)

### Фаза 5 — Фаза 5 — Доступность: живые регионы, фокус, авто-ARIA, клавиатура

announce 2.0 (два предсозданных региона, очередь, дедуп, live()) → route announcer + focus reset в router/boost → непрерывность фокуса при удалении (list/show/virtualScroll/trap.release) с E050 как dev-стражем → сетевые состояния (aria-busy в when/resource, mutation({announce}), busy()) → авто-ARIA (имя диалога, aria-controls/expanded в command(), aria-orientation) → trap 3.0 (checkVisibility, shadow DOM, стек ловушек) → roving 2.0 (без grid в первом коммите: typeahead, RTL, aria-activedescendant, живые элементы) → E051/E052. Тесты: обновление секции 💎 #13 announce (4528–4540), «route announcer», «фокус при удалении», «состояния сети», «авто-ARIA», «trap 3.0», «roving 2.0».

**Размер:** +2.4 KB gzip, всё tree-shakeable с §26/§30/§34; 3–4 коммита, L

- 💎 #47 announce 2.0 — два предсозданных региона, очередь без потерь, ariaNotify, реактивный live() (♿ Доступность, impact 4, effort M)
- 💎 #46 announce 2.0: два постоянных live-региона, очередь, дедуп, интеграция со status resource/pending (♿ Доступность, impact 4, effort S)
- 💎 #34 Гигиена живых регионов и wizard: две aria-live зоны, дедуп, шаги с фокусом и «Шаг 2 из 3» (📝 Формы, impact 3, effort S)
- 💎 #41 Route announcer + focus reset после навигации (router, boost, swap) (♿ Доступность, impact 5, effort M)
- 💎 #48 Маршрут слышен: сброс фокуса и route announcer в router() и boost() (♿ Доступность, impact 5, effort M)
- 💎 #42 Непрерывность фокуса при удалении узла: list()/show()/virtualScroll/trap.release (♿ Доступность, impact 5, effort S)
- 💎 #56 Дозорный фокуса E050 и структурные проверки E051/E052 в list()/show()/trap()/roving() (♿ Доступность, impact 4, effort S)
- 💎 #49 Состояния сети слышны: aria-busy и объявления в when()/resource, mutation({ announce }), busy() вместо disabled, offline-очередь (♿ Доступность, impact 5, effort M)
- 💎 #52 Авто-ARIA там, где движок знает семантику: имя диалога в trap()/modal() + E045, aria-controls/aria-expanded в command(), aria-orientation в roving(), aria-busy острова при загрузке (♿ Доступность, impact 4, effort S)
- 💎 #43 trap 3.0: стек ловушек, recapture на focusin, честные focusables (checkVisibility, shadow DOM, contenteditable) (♿ Доступность, impact 4, effort M)
- 💎 #44 roving 2.0: grid/tree, typeahead, RTL, aria-activedescendant, выбранный tab-stop, живые элементы (♿ Доступность, impact 4, effort M)

### Фаза 6 — Фаза 6 — Гидрация: корректность до и во время монтирования

Остров не монтируется, пока парсер не закрыл тег (правая ветвь дерева), потоковая гидрация до DOMContentLoaded с MutationObserver-коалесценцией; единая очередь событий для всех стратегий с корректной переигровкой submit/input и hover-прогревом; parent-first порядок и уничтожение выброшенных детей (E-код); props островов по Standard Schema; Declarative Shadow DOM обход; контекст из HTML (data-aegis-provide, <script data-aegis-state>). Тесты: «readyState=loading через defineProperty», «стрим через d.write», «replay 2.0 (change/submit/input)», «вложенные острова», «props schema», «DSD», «data-aegis-provide».

**Размер:** +1.6 KB gzip в §8 (tree-shakeable с hydrate); 3 коммита, L

- 💎 #60 Стриминг-безопасная гидрация: остров не монтируется, пока парсер не закрыл его тег (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #70 Потоковая гидрация: острова оживают по мере прихода HTML, до DOMContentLoaded (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #80 Стриминг и out-of-order острова: ранняя гидрация во время загрузки, data-aegis-defer + <template data-aegis-for>, поздние seed-скрипты (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #61 Replay 2.0: очередь событий до гидрации для всех стратегий, без двойной активации, с submit/input (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #68 interaction 2.0: hover греет, клик монтирует, очередь событий во время загрузки, aria-busy (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #64 Порядок гидрации вложенных островов: parent-first, дети ждут родителя, выброшенные шаблоном дети уничтожаются (E047) (🏝️ Гидрация и server-first, impact 3, effort S)
- 💎 #63 Props островов по Standard Schema: island(name, C, { props: schema }) — валидация, defaults, required, вывод типов (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #62 Declarative Shadow DOM: hydrate() обходит shadow root, element() не дублирует серверный DSD-контент (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #79 Контекст из HTML: data-aegis-provide и <script data-aegis-state> → inject() без смонтированного родителя (TransferState) (🏝️ Гидрация и server-first, impact 4, effort S)

### Фаза 7 — Фаза 7 — Гидрация: серверный контракт §34, планировщик, claim, непрерывность

Один диспетчер Aegis-* заголовков (Retarget/Reswap/Redirect/Location/Push-Url/Trigger/Announce/Focus; Aegis-Invalidate из кэш-фазы 4 переезжает в него); patch() многофрагментный OOB + режим 'delete' + sse({html}); morph 2.0 с idSet-матчингом и единым data-aegis-permanent (76 ⊃ 78.2); props-patch островов в morph и ctx.state стэш (78); boost: e.scroll() при back, redirect через response.url, head-merge и data-aegis-track=reload (73, 74); Page Lifecycle хаб (81); планировщик монтирования postTask + стратегия auto + параллельная загрузка/modulepreload (65 → 66 → 67); в конце — claim-гидрация как opt-in (77 ⊃ 59: skeleton-проверка, splitText, E-mismatch с диффом). Тесты: «Aegis-* директивы», «patch OOB», «morph idSet/permanent», «boost redirect/scroll/head», «BFCache», «планировщик», «auto», «claim».

**Размер:** +4.0 KB gzip, всё tree-shakeable со swap/boost/hydrate; 4 коммита, L

- 💎 #71 Заголовки как канал управления: Aegis-* в обе стороны (Target/Boosted → сервер; Redirect/Location/Retarget/Reswap/Trigger/Announce/Focus/Push-Url ← сервер) (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #51 swap(): объявление от сервера — заголовок Aegis-Announce, <template data-aegis-announce>, aria-busy в boost (♿ Доступность, impact 4, effort S)
- 💎 #72 patch(): многофрагментный HTML по id (out-of-band) + HTML-патчи по SSE (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #76 morph 2.0: id-set матчинг детей (idiomorph) + data-aegis-permanent для видео/карт/виджетов + фикс приоритета для checkbox (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #78 Непрерывность острова: props-patch вместо remount, data-aegis-permanent и стэш состояния по записи истории (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #73 boost(): честный контракт Navigation API — e.scroll() при «назад», редирект коммитит response.url, types для View Transitions (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #74 head-merge и дрейф ассетов: data-aegis-track="reload" → полная перезагрузка после деплоя, upsert <meta>, seedFrom(doc) для новой страницы (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #81 Page Lifecycle: BFCache-совместимость (suspend/resume SSE, стримов, poll) и кросс-документные View Transitions через pageswap/pagereveal (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #65 Единый планировщик монтирования: postTask-приоритеты, cost-aware нарезка, isInputPending (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #66 Стратегия auto и порядок eager по положению во viewport (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #67 Параллельная загрузка кода островов + modulepreload по data-aegis-src (🏝️ Гидрация и server-first, impact 4, effort S)
- 💎 #77 Claim-гидрация: html`` захватывает серверный DOM без перерисовки (🏝️ Гидрация и server-first, impact 5, effort M)
- 💎 #59 Гидрация вместо замены: hydrating html`` острова адоптирует серверный DOM (каркас + splitText), E045 mismatch с диффом (🏝️ Гидрация и server-first, impact 5, effort M)

### Фаза 8 — Фаза 8 — Инструменты: aegis-a11y.js, aegis/test, линтер, метрики

Новый модуль aegis-a11y.js (name/role/tabOrder/ariaSnapshot/audit) → render().byRole/a11y(), fire.tab/press/keyboard, ariaSnapshot в Playwright-формате → формы в aegis/test (fill с bracket-путями, fire.files/drop, FormData в mockFetch) → a11y-линтер html`` в aegis-devtools.js с кареткой → метрики островов (stats().islands, трек Performance, LoAF под dev) → вкладка a11y в панели (при наличии ресурса). Тесты: «byRole/name/a11y», «tabOrder/fire.keyboard», «ariaSnapshot», «aegis/test — формы», «линтер E05x», «islands stats», «панель a11y».

**Размер:** 0 KB в aegis.js (+0.15 хук линтера); aegis-a11y.js ≈3.5 KB, aegis-test.js +2 KB, aegis-devtools.js +5.5 KB — всё вне 75 KB; 3 коммита, L

- 💎 #54 aegis-a11y.js: accessible name/role, audit() и testing-library-стиль render().byRole()/a11y() в aegis-test.js (♿ Доступность, impact 5, effort L)
- 💎 #55 Клавиатурные автотесты: fire.tab(), fire.press(), fire.keyboard('{Tab}{ArrowRight}{Enter}'), tabOrder() (♿ Доступность, impact 4, effort M)
- 💎 #58 ARIA-снимки в формате Playwright: ariaSnapshot() / t.matchAria() — регресс-тест «что услышит скринридер» (♿ Доступность, impact 4, effort S)
- 💎 #40 aegis/test для форм: fill() по именам с bracket-путями, fire.files/fire.drop, декодирование FormData в mockFetch, renderForm() и fieldState() (📝 Формы, impact 3, effort S)
- 💎 #53 Compile-time a11y-линтер шаблонов html`` (E045–E049) с кареткой в исходнике (♿ Доступность, impact 5, effort M)
- 💎 #69 Метрики островов: трек в Performance, stats().islands, LoAF-атрибуция и E045 (🏝️ Гидрация и server-first, impact 4, effort M)
- 💎 #57 Вкладка a11y в aegis-devtools.js: порядок табуляции на странице, журнал фокуса и невидимого outline, монитор live-регионов, контраст, audit (♿ Доступность, impact 4, effort L)

## Риски и совместимость

1) Коды предупреждений: восемь предложений (6, 14, 16, 22, 52, 53, 59, 69) независимо заняли E045 — при слиянии выделить единую таблицу, начиная с первого свободного после E043 (кэш-фаза 4): E044 disposed-computed read, E045 watch(plain), E046 same-reference write, E047 snapshot в html``, E048 deep computed chain, E049 dialog без имени, E050 focus lost, E051/E052 структура list/show, E053 island props schema, E054 выброшенный дочерний остров, E055 slow island (LoAF), E056 hydration mismatch, E057–E061 a11y-линтер. Зафиксировать в одном месте aegis_full.js и в aegis.d.ts (WarnCode union). 2) Размер ядра: фазы 1–2 неизбежно растят aegis.core.js 6.1 → ≈7.0 KB gzip — это семантика Computed/Effect, не tree-shakeable. Смягчение: тексты предупреждений (E044–E048) вынести под _devCache/aegis-devtools.js; 7 снимает регистрацию computed в scope (−40 B), 8 убирает _unreg-замыкания (−40 B); зафиксировать новый порог в size-тесте bench/finalize (≤ 7.0 KB) осознанно, а не «как получится». 3) Ломающие изменения поведения (aegis.d.ts сигнатуры не ломаются, но семантика — да): (a) #2 — ошибка эффекта больше не летит писателю сигнала синхронно; смягчение: defaults.onError по умолчанию → reportError, __AEGIS_DEV__==='strict' сохраняет throw, test.html и test-core.mjs под strict; отметить в CHANGELOG как behavior change. (b) #21 — on()/effect()/interval внутри эффекта теперь умирают при перезапуске; код, полагавшийся на утечку, сломается; смягчение: effect(fn, { own: false }) opt-out + dev-предупреждение при первом «повторно созданном» ребёнке одинакового имени. (c) #7/#20 — computed() не регистрируется в scope, scope.dispose() не убивает computed (он сам отцепляется при потере подписчиков); stats().computeds меняет смысл — задокументировать; Computed.dispose() остаётся. (d) #23/#29 — f.valid становится false до касания полей (раньше — true до validate()); recipes/form.html:26 и demo/admin.html:161 читают errors — не ломаются; добавить `f.canSubmit`, а старую семантику оставить как `f.validShown` (@deprecated в d.ts) на один минор. (e) #32 — guardUnload() остаётся @deprecated-алиасом guard(); (f) #41/#48 — router по умолчанию переносит фокус и объявляет заголовок: у приложений со своим announcer будет двойное объявление; смягчение: opts.focus/announce: false и молчание, если outlet уже внутри [aria-live]; (g) #47 — вместо одного live-узла два предсозданных: тест 💎 #13 (test.html:4528) и любой CSS на старый узел переписать; (h) #61 — submit до гидрации теперь preventDefault-ится: если остров не смонтировался (ошибка/таймаут 5 с) — формы теряют нативную отправку; смягчение: при state='error' или таймауте вызвать form.requestSubmit(); (i) #75 — serverSubmit на text/html раньше отдавал сырой текст; теперь morph — opt-out `html: false`; (j) #65 — планировщик меняет тайминг hydrate(): тесты, ждущие синхронного монтирования eager без `await hs.ready`, могут упасть — первый кусок eager остаётся синхронным; (k) #71 — общий префикс Aegis-* пересекается с уже существующим Aegis-Invalidate: заголовок обрабатывает тот же диспетчер, чтобы не читать response.headers дважды. 4) Конфликты между предложениями: 8 (единый deps-массив) и 7 (хранить _deps/_vers у неживого computed) трогают одни поля — порядок 7 → 8 → 9 строго, фаззер (18) обязателен до 8; 10 (coarse-итерация) меняет гранулярность reactive(): observer, читающий и массив целиком, и конкретный ключ, может пропустить точечное обновление — фиксировать правило «любое per-key чтение внутри coarse-observer снимает coarse-флаг» отдельным тестом, при сомнениях отложить 10; 12 и 21 — взаимоисключающие реализации одного, взят 21; 76.2 и 78.2 — одна реализация data-aegis-permanent; 34/46/47 — одна реализация announce, wizard-часть 34 уходит в 37; 60/70/80.1 — одна проверка «остров закрыт парсером»; 41/48 — одна _afterNav; 61/68 — одна очередь событий; 59/77 — один claim/adopt (тесты обоих); 51 ⊂ 71; 27 ⊂ 35 (observe остаётся опцией wireForm); 56.E050 ⊂ 42; 6 ⊂ 16; 22-тесты ⊂ 18. 5) Zero-build: ничего из плана не требует компилятора; a11y-линтер (53) и «снимок в html``» (14) работают в рантайме на dev-ветке — но 14 держит кольцо untracked-чтений в горячем getter Signal: ветка должна быть под одним булевым _dev, замеренная в bench («signal read ×1M» не хуже 2%). 6) Firefox: checkVisibility (43) появился в 106 — оставить offsetParent-фолбэк; scheduler.postTask (65) — фолбэк rIC/setTimeout; ariaNotify (47) — только детект; Navigation API (32, 73) — все тесты в fallback-пути с моком, как сейчас. 7) Порядок фаз задан зависимостями: 28 → 35/75/37/30; 47 → 41/49/30/71.Announce; 60/70 → 61; 65 → 66/67; 54 → 55/58/57.

## Не делать

- 💎 #36 upload(): прогресс, tus-resumable чанки, direct upload в hidden-поле; form().submit с File → multipart: upload() с tus-протоколом — 1.4 KB и L-усилие ради нишевого протокола, требующего серверную поддержку; логичнее отдельный пакет/рецепт. Из предложения взять только _toFormData() для form().submit с File (входит в 25/75) и XHR-прогресс как рецепт.
- 💎 #39 dropzone(): drag-drop/paste/папки в тот же <input type=file> (FormData видит файлы), удаление по одному, мульти-превью с миниатюрами: dropzone() — удобство, а не столп: пишется рецептом в 40 строк поверх существующего mime() и DataTransfer; в ядро форм не тянуть. Вернуться, если 35/37 покажут спрос.
- 💎 #45 hotkeys(): декларативные data-hotkey → click(), автоматический aria-keyshortcuts, чорды и mod: hotkeys() — самостоятельный модуль (+0.6 KB), не связан с корректностью четырёх столпов; выпустить как отдельный экспорт/рецепт после фазы 5, когда trap/roving стабилизируются. Автоматический aria-keyshortcuts — единственная a11y-часть, её можно добавить в command() из 52.
- 💎 #12 Владение по запуску: эффект — владелец всего, что создано в его теле: Не делать как полный Scope duck-type Effect (+0.3 KB, provide() внутри эффекта): взята более лёгкая реализация 21 (_kids, +0.15 KB) с тем же пользовательским контрактом; provide() внутри эффекта — сомнительная семантика (контекст, живущий один запуск).
- 💎 #22 Стресс глубины и ширины: итеративный push + измеримые границы pull-рекурсии: Итеративный _notify (часть a) не делать: глубина 2000 проходит в обоих браузерах, рекурсивный DFS проще и того же размера; оставить только тест-страж «цепочка 2000» и dev-счётчик глубины (часть b/c) — они вливаются в фаззер-секцию 18.
- 💎 #57 Вкладка a11y в aegis-devtools.js: порядок табуляции на странице, журнал фокуса и невидимого outline, монитор live-регионов, контраст, audit: Вкладка a11y в devtools (L, +3 KB) — ценна, но целиком зависит от 54/55 и не имеет тестируемого критерия кроме «h4 появился»; делать в последнюю очередь и только при наличии ресурса после фазы 8; блоки контраста и монитора live-регионов — вовсе отложить.
- 💎 #10 Coarse-итерация reactive-массивов: deep-версия вместо сигнала на каждый ключ каждого элемента: Условно: coarse-итерация reactive-массивов меняет гранулярность реактивности и создаёт класс «пропущенное точечное обновление»; оставлена в фазе 2 последней и делается только если тест на смешанное coarse/per-key чтение проходит без исключений из правила — иначе заменить на дешёвую альтернативу (кэш ключевых сигналов элемента).
- 💎 #44 roving 2.0: grid/tree, typeahead, RTL, aria-activedescendant, выбранный tab-stop, живые элементы: Частично: grid-режим roving (cols/'auto' по getBoundingClientRect) не делать — layout-зависимая эвристика, хрупкая в тестах и при ресайзе; оставить typeahead, RTL, aria-activedescendant, живые элементы (MutationObserver), Ctrl+Home/End.
- 💎 #26 i18n ошибок: реактивная локаль, plural через i18n().t, нативные ValidityState → коды на языке страницы: Частично: карту ValidityState → коды (150 B) и plural через i18n().t делать, а автоматический перевод уже показанных ошибок при смене локали — получается бесплатно из 23 (issues как computed), отдельный effect на _vLocale не писать.

## Таблица приоритетов (impact ↓, effort ↑)

| # | Impact | Effort | Size | Область/линза | Предложение | Критерий |
|---|---|---|---|---|---|---|
| 1 | 5 | S | +0.15 KB gzip (ядро), без tree-shaking — | reactivity/glitch-free-ordering | **Кэшированная ошибка computed: граф не рвётся (TC39/Preact семантика)** | test.html, section('computed: ошибка кэшируется, граф не рвётся'): {   const user = signal(null); let calls = 0, seen = [], other = 0, errs  |
| 19 | 5 | S | +~0.18 KB gzip в ядре (6.1 → ~6.3 KB), н | reactivity/verification-property-tests | **Fault-injection: computed, бросивший исключение, не должен рвать граф и убивать раунд** | test.html, секция «ядро — ошибки не рвут граф»: (1) a=1, c=computed(() => { if (a.value===2) throw …; return a.value }), sc.onError(h), два  |
| 42 | 5 | S | +0.3 KB gzip (один хелпер _focusNeighbor | a11y/focus-keyboard | **Непрерывность фокуса при удалении узла: list()/show()/virtualScroll/trap.release** | test.html, секция 'фокус при удалении': (1) list(items) из 3 строк с <button>; фокус на кнопке строки 2; items.value = без строки 2 → docume |
| 7 | 5 | M | +0.2 KB gzip в ядре (≈ +250 B _addSub/_d | reactivity/perf-memory | **Unowned computed: подписка на источники только пока есть свои подписчики (чинит застывающие геттеры store/reactive)** | test.html, section('computed без владельца'): (1) const S = store({ n: 1, get twice() { return this.n * 2; } }); sc.run(() => effect(() => { |
| 12 | 5 | M | +0.3 KB gzip в ядре (aegis.core.js 6.1 → | reactivity/ergonomics-failure-modes | **Владение по запуску: эффект — владелец всего, что создано в его теле** | test.html, секция 'Effect — владение по запуску': `const sc = createScope(); const open = signal(true), n = signal(0); let inner = 0, clicks |
| 18 | 5 | M | 0 KB в aegis_full.js (только test.html + | reactivity/verification-property-tests | **Model-based фаззер графа сигналов с оракулом «пересчитать всё»** | test.html: `fuzzGraph({ seeds: 300, ops: 60 })` возвращает [] в Chrome и Firefox (≤ 150 мс); test-core.mjs: 2000 сидов в node ≤ 1 с. Регресс |
| 23 | 5 | M | +0.35 KB gzip в блоке form (tree-shakeab | forms/validation-model | **Валидность как производная от значений: issues/valid/canSubmit + живые cross-field правила** | test.html: `const f = form({ pw: '', rep: '' }, { rules: { pw: [required, minLen(3)], rep: [matches('pw')] } })` → `f.valid.value === false` |
| 28 | 5 | M | +0.15 KB gzip (в основном перенос кода и | forms/validation-model | **form().wire(el): один per-input слой для виртуальных форм — touched, blur-then-live, aria, :user-invalid** | test.html: `const f = form({ email: '' }, { rules: { email: [required] } }); const el = document.createElement('input'); el.name = 'email';  |
| 29 | 5 | M | +0.3 KB gzip внутри form/wireForm (tree- | forms/form-ux-a11y | **Правда vs показ: eager `issues`, честный `valid`, политика «reward early, punish late»** | test.html: `<input name="e" required>` → сразу после wireForm `f.valid.value === false`, `f.issues.e.value` — строка, `f.errors.e.value ===  |
| 30 | 5 | M | +0.6 KB gzip (summary ~0.3, merge/группы | forms/form-ux-a11y | **Сводка ошибок GOV.UK: `f.summary()`, фокус на сводку, слияние aria-describedby, ошибки групп на fieldset** | test.html: форма с `<input id="pw" aria-describedby="pw-hint">` → после ошибки `getAttribute('aria-describedby') === 'pw-hint pw-error'`, по |
| 32 | 5 | M | +0.5 KB gzip (guard ~0.2, draft ~0.25, r | forms/form-ux-a11y | **Черновики и защита от потери: `f.guard()` через Navigation API и router, `f.draft()`, нативный reset** | test.html: (1) wireForm + f.draft('t1') с sessionStorage-моком; изменить поле, `await wait(350)` → в storage `{v:{email:'x'}}`; поле passwor |
| 41 | 5 | M | +0.45 KB gzip (общий хелпер _focusAfterN | a11y/focus-keyboard | **Route announcer + focus reset после навигации (router, boost, swap)** | test.html, секция 'router: фокус и объявление после навигации': (1) hash-router с двумя маршрутами, <a id="l1" href="#/a"> внутри outlet; l1 |
| 48 | 5 | M | +0.35 KB gzip (общий _afterNav в §30, вы | a11y/aria-live-patterns | **Маршрут слышен: сброс фокуса и route announcer в router() и boost()** | test.html, section('💎 a11y — route announcer'): router с outlet '#app', handler ставит document.title = 'Users'; r.navigate('/r-a11y/users' |
| 49 | 5 | M | +0.5 KB gzip (when +0.15, mutation +0.1, | a11y/aria-live-patterns | **Состояния сети слышны: aria-busy и объявления в when()/resource, mutation({ announce }), busy() вместо disabled, offline-очередь** | test.html, section('💎 a11y — состояния сети'): (1) when(res, …) внутри <div id="host">: пока fetcher висит — host.getAttribute('aria-busy') |
| 53 | 5 | M | +0.15 KB gzip в aegis.js (хук + 1 строка | a11y/a11y-dev-tooling | **Compile-time a11y-линтер шаблонов html`` (E045–E049) с кареткой в исходнике** | test.html, section('a11y-линтер E045–E049'): после прогрева (await html`<i></i>`; await wait(0)) при onWarn: html`<img src="a.png">` → E045; |
| 59 | 5 | M | +0.5 KB gzip в hydrate/adopt (skeleton-п | hydration/hydration-correctness | **Гидрация вместо замены: hydrating html`` острова адоптирует серверный DOM (каркас + splitText), E045 mismatch с диффом** | test.html: register('likes', …html`<li>${count} likes <button @click=…>♥</button></li>`); host.innerHTML = '<ul data-aegis="likes"><li>12 li |
| 61 | 5 | M | +0.45 KB gzip в ядре hydrate (рекордер 5 | hydration/hydration-correctness | **Replay 2.0: очередь событий до гидрации для всех стратегий, без двойной активации, с submit/input** | test.html: (1) register('cb-island', (el,_,{on}) => { on(el.querySelector('input'), 'change', () => changes++); }); host.innerHTML = '<div d |
| 65 | 5 | M | +0.55 KB gzip в секции 8 (не в ядре 6.1  | hydration/island-strategies-perf | **Единый планировщик монтирования: postTask-приоритеты, cost-aware нарезка, isInputPending** | test.html, секция «планировщик островов»: (1) register('sched', тяжёлый setup: busy-loop 6 мс); root с 12 visible-островами, у которых IO ср |
| 71 | 5 | M | +0.6 KB gzip (таблица директив в §34 — t | hydration/server-contract-html-wire | **Заголовки как канал управления: Aegis-* в обе стороны (Target/Boosted → сервер; Redirect/Location/Retarget/Reswap/Trigger/Announce/Focus/Push-Url ← сервер)** | test.html: (1) `swap(cart, new Response('<ul id="other">x</ul>', { headers: { 'Aegis-Retarget': '#other-host', 'Aegis-Reswap': 'outer', 'Aeg |
| 72 | 5 | M | +0.5 KB gzip (patch ~350 B в §34; sse({  | hydration/server-contract-html-wire | **patch(): многофрагментный HTML по id (out-of-band) + HTML-патчи по SSE** | test.html: (1) страница с #rows, #badge, #flash; `patch('<tbody id="rows"><tr id="r1">A</tr></tbody><span id="badge">3</span><template data- |
| 75 | 5 | M | +0.4 KB gzip (внутри wireForm §25, tree- | hydration/server-contract-html-wire | **wireForm: HTML-ответ 422/200 с перерисованной формой — morph формы на место и сбор ошибок из DOM (контракт Django/Rails без JSON)** | test.html: (1) форма #signup с email/password; mockFetch на POST отвечает 422 text/html: `<form id="signup" …><input name="email" id="id_ema |
| 77 | 5 | M | +0.5 KB gzip (расширение adopt() и 15 ст | hydration/resumability-serialization | **Claim-гидрация: html`` захватывает серверный DOM без перерисовки** | test.html: (1) server = '<div data-aegis="cl" data-aegis-claim><span class="v">SSR</span><button>+</button></div>', island('cl', ({html, sig |
| 78 | 5 | M | +0.7 KB gzip (стэш ~30 строк, morph-ветк | hydration/resumability-serialization | **Непрерывность острова: props-patch вместо remount, data-aegis-permanent и стэш состояния по записи истории** | test.html: (1) island('cnt', ({props, signal, html}) => { const open = signal(true); return html`<b>${() => props.count}</b>`; }, { types: { |
| 35 | 5 | L | +0.25 KB gzip в ядре form/wireForm (shap | forms/files-wizards-arrays | **Field arrays: fieldArray(f, 'items') с устойчивыми ключами строк и перенумерацией имён** | test.html, section('💎 field arrays'): const f = form({ title: '' }, { rules: { 'items[].qty': [min(1)] } }); const items = fieldArray(f, 'i |
| 36 | 5 | L | +1.4 KB gzip upload() — отдельный export | forms/files-wizards-arrays | **upload(): прогресс, tus-resumable чанки, direct upload в hidden-поле; form().submit с File → multipart** | test.html, section('💎 upload — tus, прогресс, resume'): configure({ fetch }) с мок-сервером tus: POST /files → 201 + Location: /files/1; PA |
| 54 | 5 | L | 0 KB в aegis.js; новый модуль aegis-a11y | a11y/a11y-dev-tooling | **aegis-a11y.js: accessible name/role, audit() и testing-library-стиль render().byRole()/a11y() в aegis-test.js** | test.html, section('aegis/test — byRole, name(), a11y()'): 1) name(): <label>Email <input value="x"></label> → input 'Email'; <button><img a |
| 2 | 4 | S | +0.12 KB gzip (ядро); правка 2 тестов te | reactivity/glitch-free-ordering | **Ошибка эффекта не бросается писателю сигнала: onError → defaults.onError → reportError** | test.html, section('ошибка эффекта не становится ошибкой resource'): {   const caught = []; const onErr = (e) => { caught.push(e.error); e.p |
| 13 | 4 | S | +0.2 KB gzip (одна обёртка `_bindCtx` на | reactivity/ergonomics-failure-modes | **Async setup без потери владельца: ctx-хелперы привязаны к scope компонента, E001 подсказывает про await** | test.html: `const codes=[]; onWarn(w=>codes.push(w.code)); let ran=0; const api = component(host, async ({ effect, on, html }) => { await wa |
| 14 | 4 | S | +0.05 KB в ядре (ветка в getter Signal), | reactivity/ergonomics-failure-modes | **E045 «снимок вместо сигнала»: `${count.value}` в html`` ловится через кольцо untracked-чтений (аналог Svelte state_referenced_locally)** | test.html, секция 'предупреждения — E045 снимок в html``': `dev.resetWarnings(); const codes=[]; const off=onWarn(w=>codes.push(w.code)); co |
| 15 | 4 | S | +0.15 KB gzip (общий `_writable` для lin | reactivity/ergonomics-failure-modes | **lens() и function-bindings для bind: — двусторонняя привязка к любому геттеру/сеттеру (Svelte 5.9)** | test.html, секция 'lens() и function bindings': `const cents = signal(250); const inp = html\`<input type=number bind:value=${lens(() => cen |
| 21 | 4 | S | +~0.15 KB gzip в ядре (Effect._kids + ху | reactivity/verification-property-tests | **Дети эффекта: всё созданное в теле эффекта умирает при его перезапуске (семантика Solid/Svelte 5)** | test.html «ядро — дети эффекта»: (1) сценарий из «сейчас»: после 3 записей в a и одной в b `inner === 1`, `b.subs.size === 1`, `stats().effe |
| 24 | 4 | S | +0.2 KB gzip в блоке form | forms/validation-model | **Standard Schema по полям на blur: issue-фильтрация по пути, один прогон на тик, схема как правило поля** | test.html (расширение теста test.html:1700–1724): wireForm(formEl, { schema, mode: 'blur-then-live' }); `email` input → dispatch 'blur' → `f |
| 46 | 4 | S | +0.2 KB gzip в секции 26 (второй регион  | a11y/focus-keyboard | **announce 2.0: два постоянных live-региона, очередь, дедуп, интеграция со status resource/pending** | test.html, обновить секцию 💎 #13 announce (4528-4540): (1) после первого mount() в документе есть [data-aegis-live="polite"] и [data-aegis- |
| 50 | 4 | S | +0.25 KB gzip (перестановка в wireForm + | a11y/aria-live-patterns | **Формы без хора live-регионов: сводка при submit, aria-errormessage, aria-invalid только при ошибке, шаги wizard с фокусом, smooth-scroll под reduced motion** | test.html, section('💎 a11y — формы без хора'): форма из 3 required-полей с <label>; submit()(fakeEvent) на пустых → formEl.querySelectorAll |
| 51 | 4 | S | +0.3 KB gzip (в §34, tree-shakeable со s | a11y/aria-live-patterns | **swap(): объявление от сервера — заголовок Aegis-Announce, <template data-aegis-announce>, aria-busy в boost** | test.html, section('💎 a11y — swap объявляет'): (1) new Response('<b>ok</b>', { headers: { 'Aegis-Announce': 'Cart updated' } }) → swap(el,  |
| 52 | 4 | S | +0.3 KB gzip (распределено по §26, §31,  | a11y/aria-live-patterns | **Авто-ARIA там, где движок знает семантику: имя диалога в trap()/modal() + E045, aria-controls/aria-expanded в command(), aria-orientation в roving(), aria-busy острова при загрузке** | test.html, section('💎 a11y — авто-ARIA'): (1) trap() на <div><h2>Title</h2><button/></div> → container.getAttribute('aria-labelledby') ===  |
| 56 | 4 | S | +0.4 KB gzip в aegis.js (все ветки под _ | a11y/a11y-dev-tooling | **Дозорный фокуса E050 и структурные проверки E051/E052 в list()/show()/trap()/roving()** | test.html, section('E050–E052 — фокус и семантика'): 1) list() на items=[{id:1,v:'a'}]; строка html`<li><input value=${item.v}></li>`; фокус |
| 58 | 4 | S | 0 KB в aegis.js; +0.7 KB gzip в aegis-a1 | a11y/a11y-dev-tooling | **ARIA-снимки в формате Playwright: ariaSnapshot() / t.matchAria() — регресс-тест «что услышит скринридер»** | test.html, section('aegis/test — ariaSnapshot'): render(html`<h1>Users</h1><button aria-label="New user">+</button><ul><li><a href="/u/1">Al |
| 60 | 4 | S | +0.15 KB gzip (одна функция _parsed и об | hydration/hydration-correctness | **Стриминг-безопасная гидрация: остров не монтируется, пока парсер не закрыл его тег** | test.html (по образцу теста prerendering, где document.prerendering подменяется через Object.defineProperty): Object.defineProperty(document |
| 63 | 4 | S | +0.25 KB gzip внутри island()/_coercePro | hydration/hydration-correctness | **Props островов по Standard Schema: island(name, C, { props: schema }) — валидация, defaults, required, вывод типов** | test.html: рукописная схема без зависимостей: const S = { '~standard': { version: 1, vendor: 'test', validate: (v) => (typeof v.count === 'n |
| 66 | 4 | S | +0.3 KB gzip в секции 8 | hydration/island-strategies-perf | **Стратегия auto и порядок eager по положению во viewport** | test.html (хост в document.body, как в тесте virtualScroll :2251 — sandbox скрыт): host position:relative; height:4000px; три острова 'auto- |
| 67 | 4 | S | +0.25 KB gzip в секции 8 | hydration/island-strategies-perf | **Параллельная загрузка кода островов + modulepreload по data-aegis-src** | test.html: register('par-a', { load: () => wait(25).then(() => (el, d, { html }) => html`<b>a</b>`) }), register('par-b', { load: () => wait |
| 73 | 4 | S | +0.25 KB gzip (внутри boost, tree-shakea | hydration/server-contract-html-wire | **boost(): честный контракт Navigation API — e.scroll() при «назад», редирект коммитит response.url, types для View Transitions** | test.html (fallback-путь, Navigation API мокается объектом с navigate/addEventListener): (1) мок _config.fetch отдаёт Response с Object.defi |
| 74 | 4 | S | +0.3 KB gzip (внутри boost.visit; head:  | hydration/server-contract-html-wire | **head-merge и дрейф ассетов: data-aegis-track="reload" → полная перезагрузка после деплоя, upsert <meta>, seedFrom(doc) для новой страницы** | test.html: (1) в sandbox-документе head содержит <script data-aegis-track="reload" src="/app.v1.js">; мок страницы отдаёт тот же скрипт с /a |
| 79 | 4 | S | +0.35 KB gzip (ветка в inject ~8 строк,  | hydration/resumability-serialization | **Контекст из HTML: data-aegis-provide и <script data-aegis-state> → inject() без смонтированного родителя (TransferState)** | test.html: (1) host = '<div data-aegis-provide=\'{"theme":"dark"}\'><div data-aegis="lazy-p" data-aegis-load="visible"><div data-aegis="chil |
| 3 | 4 | M | +0.35 KB gzip (ядро: _track/_drop/_watch | reactivity/glitch-free-ordering | **Ленивая подписка computed (watched/unwatched) + _epoch fast-path + хуки watched/unwatched для signal/from()** | test.html, section('computed: подписка только при наблюдателях'): {   const a = signal(1); const cs = [0,1,2].map(i => computed(() => a.valu |
| 8 | 4 | M | ≈ +0.13 KB gzip в ядре (единый массив de | reactivity/perf-memory | **Memory-diet ядра: effect с одной зависимостью 902 B → ≤ 400 B, строка list() с реактивными ячейками ×2 меньше** | node --expose-gc (probe в стиле #107): effect с 1 dep в scope ≤ 400 B (сейчас 902), signal + subscribe() ≤ 200 B (сейчас 369), Scope без dis |
| 10 | 4 | M | +0.3 KB gzip в §16 (tree-shakeable вмест | reactivity/perf-memory | **Coarse-итерация reactive-массивов: deep-версия вместо сигнала на каждый ключ каждого элемента** | bench.html: «reactive heap delta MB» 61.5 → ≤ 30 (с #5 — ≤ 22), «reactive push ×20» 372 → ≤ 300 мс (снимаются 100k _track + 100k version() н |
| 20 | 4 | M | +~0.12 KB gzip в ядре (не tree-shakeable | reactivity/verification-property-tests | **GC: computed без подписчиков отцепляется от источников (TC39 unwatched / Preact targets-empty)** | test.html «ядро — GC»: (1) b=signal(1); 2000 × { c=computed(() => b.value+i); c.value } → `b.subs.size === 0` сразу после цикла (сейчас 2000 |
| 25 | 4 | M | +0.35 KB gzip в блоке form (карта типов  | forms/validation-model | **Типизированные значения: вывод Standard Schema в parsed/submit, types для date/number/array, InferOutput в d.ts** | test.html: схема с coerce (`validate: v => ({ value: { age: Number(v.age), name: String(v.name).trim() } })`), `form({ age: '42', name: ' a  |
| 26 | 4 | M | +0.3 KB gzip (карта ValidityState ~150 B | forms/validation-model | **i18n ошибок: реактивная локаль, plural через i18n().t, нативные ValidityState → коды на языке страницы** | test.html: `const t = i18n({ ru: { validation: { minLen: { one: 'Минимум {n} символ', few: 'Минимум {n} символа', many: 'Минимум {n} символо |
| 27 | 4 | M | +0.45 KB gzip в блоке form (MutationObse | forms/validation-model | **Динамические поля: wireForm({ observe }) и form().add/remove с правилами по шаблону items[].qty** | test.html: `wireForm(formEl, { observe: true, rules: { 'items[].qty': [required] } })` с одним `items[0][qty]`; `formEl.insertAdjacentHTML(' |
| 31 | 4 | M | +0.35 KB gzip; −0.2 KB за счёт выноса об | forms/form-ux-a11y | **Единый a11y-контракт для виртуальной form(): `f.field(key)` + директива `bind:field`** | test.html: `mount(() => html\`<form><input bind:field=${f.field('email')}><p id="f-email-error"></p></form>\`)`; ввод 'x' + blur → `f.touche |
| 33 | 4 | M | +0.4 KB gzip внутри form/wireForm | forms/form-ux-a11y | **Жизненный цикл отправки: `status`-машина, отменяемый submit, управление submitter, PRG через router** | test.html: (1) handler с `await wait(50)`; submit → `f.status.value === 'submitting'`, `submitter.getAttribute('aria-disabled') === 'true'`, |
| 37 | 4 | M | +0.6 KB gzip wizard(), +0.3 KB draft() — | forms/files-wizards-arrays | **wizard() и draft(): мастер для form() и wireForm с async-валидацией шага, историей, a11y и черновиком в sessionStorage** | test.html, section('💎 wizard / draft'): const schema = Standard Schema с issue на city; const f = form({ name: '', login: '', city: '' }, { |
| 38 | 4 | M | +0.5 KB gzip внутри wireForm (подключает | forms/files-wizards-arrays | **Progressive enhancement уровня Conform/Turbo: HTML-ответ 422 → morph формы и ошибки из разметки; formnovalidate; intent-кнопки; formEl.elements** | test.html, section('💎 PE — HTML 422, formnovalidate, intents'): formEl = <form id="pe" action="/pe/save"><label>Email<input name="email" va |
| 39 | 4 | M | +0.7 KB gzip dropzone() — отдельный expo | forms/files-wizards-arrays | **dropzone(): drag-drop/paste/папки в тот же <input type=file> (FormData видит файлы), удаление по одному, мульти-превью с миниатюрами** | test.html, section('💎 dropzone / preview'): formEl = <form><input type=file name=docs multiple accept="image/*" hidden><div class=zone></di |
| 43 | 4 | M | +0.35 KB gzip внутри секции 26 (tree-sha | a11y/focus-keyboard | **trap 3.0: стек ловушек, recapture на focusin, честные focusables (checkVisibility, shadow DOM, contenteditable)** | test.html, секция 'trap 3.0': (1) контейнер с <button>, <div contenteditable>, <x-el> (defineElement с <button> в shadow), position:fixed <b |
| 44 | 4 | M | +0.7 KB gzip внутри секции 26 (grid ~150 | a11y/focus-keyboard | **roving 2.0: grid/tree, typeahead, RTL, aria-activedescendant, выбранный tab-stop, живые элементы** | test.html, секция 'roving 2.0': (1) grid 3×3 кнопок (orientation:'grid', cols:3): фокус [0], ArrowDown → [3], ArrowRight → [4], End → [5], C |
| 45 | 4 | M | +0.6 KB gzip как отдельный экспорт (парс | a11y/focus-keyboard | **hotkeys(): декларативные data-hotkey → click(), автоматический aria-keyshortcuts, чорды и mod** | test.html, секция 'hotkeys()': (1) <button data-hotkey="mod+k"> + hotkeys(root): getAttribute('aria-keyshortcuts') === (_APPLE ? 'Meta+K' :  |
| 47 | 4 | M | +0.4 KB gzip (announce ≈ +0.15, live() + | a11y/aria-live-patterns | **announce 2.0 — два предсозданных региона, очередь без потерь, ariaNotify, реактивный live()** | test.html, section('💎 a11y — announce 2.0 / live()'): (1) после mount() и до любого announce() document.querySelectorAll('[data-aegis-live] |
| 55 | 4 | M | 0 KB в aegis.js; +0.8 KB gzip в aegis-te | a11y/a11y-dev-tooling | **Клавиатурные автотесты: fire.tab(), fire.press(), fire.keyboard('{Tab}{ArrowRight}{Enter}'), tabOrder()** | test.html: 1) tabOrder(): контейнер <input tabindex=2><button disabled><a href><span tabindex=0><input tabindex=1><details><button>hidden</b |
| 62 | 4 | M | +0.3 KB gzip (обход хостов ~0.1, _closes | hydration/hydration-correctness | **Declarative Shadow DOM: hydrate() обходит shadow root, element() не дублирует серверный DSD-контент** | test.html: (1) const host = document.createElement('div'); host.attachShadow({ mode: 'open' }).innerHTML = '<div data-aegis="h2-island" data |
| 68 | 4 | M | +0.35 KB gzip в секции 8 | hydration/island-strategies-perf | **interaction 2.0: hover греет, клик монтирует, очередь событий во время загрузки, aria-busy** | test.html: register('int2', { load: () => wait(20).then(() => (el, d, { on }) => { on(el, 'keydown', () => keys++); on(el.querySelector('for |
| 69 | 4 | M | +0.25 KB gzip в секции 8 (счётчики) + ~0 | hydration/island-strategies-perf | **Метрики островов: трек в Performance, stats().islands, LoAF-атрибуция и E045** | test.html: (1) dev.profile(true); hydrate одного острова → performance.getEntriesByType('measure').some(e => e.name.startsWith('aegis:island |
| 70 | 4 | M | +0.3 KB gzip в секции 8; tree-shakeable  | hydration/island-strategies-perf | **Потоковая гидрация: острова оживают по мере прихода HTML, до DOMContentLoaded** | test.html: (1) юнит: const d = document.implementation.createHTMLDocument(); d.open(); d.write('<body><div data-aegis="st" data-n="1"><p>a</ |
| 76 | 4 | M | +0.4 KB gzip (внутри _morph §34, tree-sh | hydration/server-contract-html-wire | **morph 2.0: id-set матчинг детей (idiomorph) + data-aegis-permanent для видео/карт/виджетов + фикс приоритета для checkbox** | test.html: (1) `<ul id="l"><li><input id="a"></li><li><input id="b"></li></ul>`, фокус в #a с набранным 'typed'; morph в `<ul id="l"><li>new |
| 80 | 4 | M | +0.6 KB gzip (observer во время loading  | hydration/resumability-serialization | **Стриминг и out-of-order острова: ранняя гидрация во время загрузки, data-aegis-defer + <template data-aegis-for>, поздние seed-скрипты** | test.html (эмуляция стрима через appendChild с wait): root пуст → hydrate(root, { watch: true }); append '<div data-aegis="hdr"></div>' → че |
| 81 | 4 | M | +0.5 KB gzip (lifecycle-хаб ~25 строк +  | hydration/resumability-serialization | **Page Lifecycle: BFCache-совместимость (suspend/resume SSE, стримов, poll) и кросс-документные View Transitions через pageswap/pagereveal** | test.html: (1) мок EventSource (класс с close-спаем) → sse('/ev') → `window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: t |
| 57 | 4 | L | 0 KB в aegis.js; +3 KB gzip в aegis-devt | a11y/a11y-dev-tooling | **Вкладка a11y в aegis-devtools.js: порядок табуляции на странице, журнал фокуса и невидимого outline, монитор live-регионов, контраст, audit** | test.html, section('dev.panel() — вкладка a11y') рядом с существующим тестом панели (2583): открыть панель, переключить вкладку — в shadowRo |
| 4 | 3 | S | +0.08 KB gzip (ядро) | reactivity/glitch-free-ordering | **Детерминированный порядок раунда flush по порядку создания (_ord): родитель раньше потомка** | test.html, section('flush: родитель раньше потомка после churn зависимостей'): {   const mode = signal('x'), user = signal({ name: 'ann' }), |
| 5 | 3 | S | +0.10 KB gzip (ядро; часть кода общая с  | reactivity/glitch-free-ordering | **Полосы micro/frame: дренаж в одном тике и защита от самоцикла** | test.html, дополнение section('💎 #122 … полосы flush'): {   const s = signal(0); let runs = 0, msg = '';   const sc = createScope(); sc.run |
| 6 | 3 | S | +0.12 KB gzip (ядро, текст предупреждени | reactivity/glitch-free-ordering | **E045 — чтение уничтоженного computed: тихо замороженное значение становится предупреждением** | test.html, section('E045 — чтение уничтоженного computed'): {   const codes = []; const off = onWarn(w => codes.push(w.code)); dev.resetWarn |
| 9 | 3 | S | +40 B gzip в ядре | reactivity/perf-memory | **_endTrack за O(n): массовый сдвиг зависимостей без квадратичного скана** | test.html, section('_endTrack: сдвиг зависимостей без O(n²)'): const N = 2000, sigs = Array.from({ length: N }, (_, i) => signal(i)); let of |
| 11 | 3 | S | +0.1 KB gzip в §16 (tree-shakeable); −60 | reactivity/perf-memory | **Ленивый снимок для $reset: reactive({ rows: 100k }) без structuredClone на входе** | node --expose-gc / bench.html: reactive({ rows: mk(100000) }) ≤ 1 мс (сейчас 59) и heap Δ < 0.2 MB (сейчас 9.1); первая запись st.rows[0].do |
| 16 | 3 | S | +0.25 KB gzip (dev-ветки; E046/E047 в яд | reactivity/ergonomics-failure-modes | **Три тихих no-op → предупреждения: watch(plain), запись того же объекта назад, чтение уничтоженного computed** | test.html, секция 'тихие no-op — E046/E047/E048': `const st = reactive({ count: 0 }); watch(st.count, () => {})` → E046; `watch(() => st.cou |
| 17 | 3 | S | +0.1 KB gzip, tree-shakeable (отдельный  | reactivity/ergonomics-failure-modes | **signals({}) — именованные сигналы из ключей: каждое предупреждение, граф и трасса называют переменную** | test.html: `const { count, total } = signals({ count: 2, get total() { return count.value * 10; } }); assert(count._name === 'count' && tota |
| 22 | 3 | S | +~0.12 KB gzip в ядре (итеративный _noti | reactivity/verification-property-tests | **Стресс глубины и ширины: итеративный push + измеримые границы pull-рекурсии** | test.html «ядро — стресс»: (1) цепочка 2000 — верное значение в Chrome и Firefox (сейчас в node 5000 падает; 2000 — страж, чтобы граница не  |
| 34 | 3 | S | +0.2 KB gzip (announce ~0.1, wizard ~0.1 | forms/form-ux-a11y | **Гигиена живых регионов и wizard: две aria-live зоны, дедуп, шаги с фокусом и «Шаг 2 из 3»** | test.html: `announce('a'); announce('b')` в одном тике → после кадра+60 мс polite-узел содержит 'b', вызовов записи textContent (spy через M |
| 40 | 3 | S | 0 в aegis_full.js; aegis-test.js +0.9 KB | forms/files-wizards-arrays | **aegis/test для форм: fill() по именам с bracket-путями, fire.files/fire.drop, декодирование FormData в mockFetch, renderForm() и fieldState()** | test.html, section('aegis/test — формы'): const m = mockFetch({ 'POST /t/save': (body, { headers }) => { seen = body; hdr = headers; return  |
| 64 | 3 | S | +0.2 KB gzip (проверка pending-предка в  | hydration/hydration-correctness | **Порядок гидрации вложенных островов: parent-first, дети ждут родителя, выброшенные шаблоном дети уничтожаются (E047)** | test.html: (1) register('outer-p', (el, d, { html, slot }) => { provide('theme', 'dark'); return html`<section>${slot('[data-aegis]')}</sect |


---

# ⚛️ Реактивность

## 🔭 glitch-free-ordering

**Линза:** Корректность реактивного графа: glitch-freedom, порядок эффектов, топологический/версионный push-pull, диамант-зависимости, циклы, повторный запуск, поведение при ошибке в computed/effect. Сравни алгоритм секций 1–2 (Signal/Computed/Effect/_flush/_depsChanged/версии/_epoch) с Solid 2 (transitions, async), Preact Signals, Vue 3.5, TC39 Signals proposal (watcher/pull semantics). Ищи расхождения семантики, случаи двойного запуска, потери обновлений, «залипания» dirty-флагов.

**Вывод:** Ядро Aegis (aegis_full.js:161–757) на «счастливом пути» уже на уровне Preact Signals / Vue 3.5: push-dirty + pull-verify по глобальным версиям (_epoch), bailout computed при неизменившемся результате, стабильные параллельные массивы deps/vers без переподписки, один запуск effect на diamond — всё это подтверждено симуляцией в node (diamond, batch, «тот же результат computed → effect молчит»). Отставание сосредоточено в трёх местах, которые конкуренты закрыли: (1) путь ошибки — бросивший computed делает _unsubscribe(this) (:410) и бросает ДО _track (:361–363), поэтому эффект-читатель отписывается от него навсегда, а в catch-блоке _flush (:733) _changedDeps() повторно вызывает version() бросающего computed и исключение вылетает из _flush мимо scope.onError, оставляя остальные эффекты раунда с «залипшим» _queued=true (подтверждено: E2 больше никогда не запускается); в TC39 Signals и Preact исключение кэшируется, подписки сохраняются; (2) политика «первую ошибку эффекта бросить писателю сигнала» (:756) в асинхронном коде движка превращает TypeError шаблона в «ошибку загрузки»: resource(:3790–3801) ловит её и ставит error.value при успешном fetch (симуляция: status 'error', data заполнена), mutation (:3897–3928) откатывает успешную мутацию; Vue/Angular/React отдают ошибки эффектов в errorHandler/reportError, а не писателю; (3) нет watched/unwatched: computed подписывается на источники при первом peek() навсегда (3 неотслеживаемых computed → a.subs.size===3), тогда как TC39/Preact/Vue 3.5 держат подписки только при живых наблюдателях. Дополнительно: порядок раунда flush зависит от порядка вставки в Set — после «churn» зависимостей родителя дочерний биндинг бежит раньше родителя (симуляция: C C-ERR P), у Solid (runTop) и Vue (queueJob по id) порядок гарантирован; полосы micro/frame не имеют защиты от самоцикла (5000 запусков без ошибки) и растягивают связанные записи на несколько микротасков/кадров.

**Отвергнуто:** 1) Двухфазный flush «пользовательские эффекты → DOM-биндинги» (устранил бы двойной прогон подписчика при effect-as-derivation, симуляция T12b: 2 запуска вместо 1) — меняет документированную синхронную модель, DIAMONDS-2 уже отвергли перенос биндингов на micro; Solid делает наоборот (render first), однозначного выигрыша нет; effect-производные — анти-паттерн, покрытый E027 и linked(). 2) Топологические высоты/heights (reactively, Angular consumerMarkDirty) — Aegis уже glitch-free за счёт pull-verify по версиям; высоты экономили бы только лишние version()-обходы в глубоких diamond, эффект на DOM невидим, а #127 (alien-links) уже стоит с критерием входа. 3) Транзакции/async computed Solid 2 (createAsync, startTransition) — L-усилие, +1–2 KB в ядро; resource()/keepPrevious/when() закрывают 90 % сценариев; оставить до появления запроса. 4) Рёбра-Link как в alien-signals — уже предложение #127 в DIAMONDS-2 с критерием входа по DOM-бенчмарку. 5) Утечка подписки при self-dispose эффекта внутри собственного запуска (чтения после dispose() снова подписывают) — _notify лениво удаляет _disposed при следующей записи, самоизлечивается, отдельного бриллианта не заслуживает. 6) `equals` для ошибок computed (не бампать версию при «той же» ошибке) — усложняет семантику, TC39 не сравнивает исключения. 7) Отдельная пометка «pre/post» как у Vue watch flush — уже есть полосы sync/micro/frame (#122). 8) Синхронный throw из effect() при первом запуске оставить как есть — частично: включено в бриллиант 2 как диспетчеризация через scope.onError; полный перенос в reportError без onError не предлагается, чтобы errorBoundary и setup продолжали видеть ошибку синхронно.

### 💎 #1 — Кэшированная ошибка computed: граф не рвётся (TC39/Preact семантика)

**Impact:** 5 · **Effort:** S · **Size:** +0.15 KB gzip (ядро), без tree-shaking — правка Computed

**Сейчас:** aegis_full.js:390–425 `_recompute`: при исключении из `_fn` вызывается `_unsubscribe(this)` (:410) — computed теряет ВСЕ подписки на источники, `_dirty` остаётся true, и исключение вылетает из `get value()` (:361–365) ДО `_track(this)` — читающий эффект не подписывается на computed. Итог (симуляция node, сборка секций 0–2): `user=signal(null); name=computed(()=>user.value.name); effect(()=>name.value)` → после `user.value={name:'ok'}` эффект не запускается никогда (`user.subs=[]`, `name.subs=[]`). Хуже: если computed сначала работал, а потом бросил, эффект уже подписан на него; в `_flush` catch (:731–741) вычисляется `_changedDeps(obs)` (:733) → `deps[i].version()` (:371–374) → повторный `_recompute` → исключение бросается ИЗ catch-блока: `_dispatchError` (:737) не вызывается, `scope.onError` молчит, остальные эффекты раунда пропускаются и остаются с `_queued=true` вне `_queue` — «залипание»: подтверждено, второй эффект (`effect(()=>{a.value; runs++})`) после этого не запускается ни при одной последующей записи. Также `Subscriber` конструктор (:565) `src.version()` бросает при `computed.subscribe()`. Каждый повторный `version()`/`peek()` заново выполняет бросающую функцию (нет мемоизации ошибки).

**Предложение:** Как в TC39 Signals и Preact (`HAS_ERROR`): исключение — это ЗНАЧЕНИЕ computed. `_recompute` не бросает: ловит, сохраняет `this._err = { e }`, бампает `_version`, вызывает `_endTrack(this)` (прочитанные до броска deps остаются → push дойдёт при исправлении данных). Бросает только читатель (`value`/`peek`) и только ПОСЛЕ `_track(this)`. `version()` никогда не бросает → `_depsChanged`, `_changedDeps`, `Subscriber` безопасны. При выздоровлении версия бампается даже если новое значение равно старому до ошибки (иначе зависимые остаются в «ошибочном» состоянии). Циклическая зависимость — тот же механизм: `_computing` → `_err = Circular…`.

**Алгоритм:**

```js
class Computed {
    constructor(fn, name, eq, initial) { /* … */ this._err = null; }   // { e } — закэшированное исключение до смены deps
    get value() {
        if (this._dirty) this._recompute();
        _track(this);                              // подписка ДО броска: читатель узнает о выздоровлении
        if (this._err) throw this._err.e;
        return this._value;
    }
    peek() { if (this._dirty) this._recompute(); if (this._err) throw this._err.e; return this._value; }
    version() { if (this._dirty) this._recompute(); return this._version; }   // никогда не бросает
    _recompute() {
        if (this._computing) { this._err = { e: new Error(`[Aegis] Circular dependency in computed "${this._name || '?'}"`) }; this._version = ++_epoch; return; }
        this._computing = true;
        const prev = _tracking;
        try {
            if (this._deps && this._deps.length > 0 && !_depsChanged(this)) { this._dirty = false; return; }
            this._n = 0;
            _tracking = this;
            let v, err = null;
            try { v = this._fn(this._value); } catch (e) { err = { e }; }
            _tracking = prev;
            _endTrack(this);                       // deps, прочитанные до броска, остаются подписаны
            if (err) { this._err = err; this._version = ++_epoch; }
            else if (this._version === 0 || this._err || !this._eq(this._value, v)) { this._err = null; this._value = v; this._version = ++_epoch; }
            this._dirty = false;
        } finally { _tracking = prev; this._computing = false; }
    }
}
// toString: this._err ? '<error>' : …; _changedDeps: value: deps[i]._err ? '<error>' : _short(deps[i].peek())
```

**API:**

```js
Публичные сигнатуры не меняются: `computed<T>(fn, nameOrOpts): Computed<T>`. Документируемая семантика (d.ts JSDoc + README): «Если fn бросает, исключение кэшируется и повторно бросается при каждом чтении `.value`/`.peek()`, пока не изменится хотя бы одна зависимость; подписки не теряются; `version()` не бросает». ERRORS.md: уточнить E054-контекст (`changed:` показывает `<error>`).
```

**Критерий:** test.html, section('computed: ошибка кэшируется, граф не рвётся'):
{
  const user = signal(null); let calls = 0, seen = [], other = 0, errs = 0;
  const name = computed(() => { calls++; return user.value.name; }, 'name');
  const sc = createScope(); sc.onError(() => errs++);
  sc.run(() => { effect(() => { seen.push(name.value); }, 'render'); effect(() => { user.value; other++; }, 'other'); });
  assert('ошибка первого запуска дошла до onError, второй эффект жив', errs === 1 && other === 1);
  try { name.value; } catch (e) {} try { name.peek(); } catch (e) {}
  assert('исключение кэшируется: fn не перезапускается', calls === 1);
  assert('version() не бросает', typeof name.version() === 'number');
  user.value = { name: 'ann' };
  assert('после исправления данных эффект выздоравливает', seen.at(-1) === 'ann' && errs === 1);
  assert('второй эффект раунда не «залип» (_queued)', other === 2);
  user.value = null; user.value = { name: 'bob' };
  assert('повторный цикл ошибка→выздоровление', seen.at(-1) === 'bob' && errs === 2 && other === 4);
  assert('подписки целы', user.subs.size === 2 && name.subs.size === 1);
  sc.dispose();
}
Плюс test-core.mjs: `assert.throws(() => a.value, /Circular dependency/)` (:117) остаётся зелёным.

**Источники:** TC39 proposal-signals README, Signal.Computed: «If the callback throws, the exception is cached and rethrown on subsequent reads until a dependency changes»; Preact Signals `Computed._refresh` (флаг HAS_ERROR, `_value = err`, `this._version++`), `Computed.value` getter — `addDependency` до `_refresh`; Vue 3.5 `refreshComputed` + `callWithErrorHandling`; Solid `handleError`/`ErrorBoundary`; Bainomugisha et al., «A Survey on Reactive Programming» (glitch avoidance).

### 💎 #2 — Ошибка эффекта не бросается писателю сигнала: onError → defaults.onError → reportError

**Impact:** 4 · **Effort:** S · **Size:** +0.12 KB gzip (ядро); правка 2 тестов test-core.mjs (:179, :256) и test.html (2085, 2728 — уже через onError)

**Сейчас:** aegis_full.js:756 `_flush` бросает первую непоглощённую ошибку эффекта ИЗ сеттера сигнала (`set value` :293–306 → `_notify` :635–652 → `_flush`). Для обработчика `on()` это ок, но для асинхронного кода движка — ловушка: resource `_run` (:3785–3805) пишет данные через `_recompute(pe)` (:3798 → `o.data.value = v` :3651) внутри `try`, чей `catch` (:3799–3801) ставит `error.value = e`. Симуляция на полной сборке: fetcher успешно вернул `{items:null}`, эффект-шаблон бросил TypeError → `res.status.value === 'error'`, `res.error.value` = TypeError шаблона, `res.data.value` заполнена — `when(res,{error})` показывает «не удалось загрузить» при успешной загрузке, ошибка в UI никогда не выглядит как ошибка кода. В `mutation` (:3897 `data.value = result` → catch :3907 → `drop()` :3924 откат оптимистичных патчей, `error.value = e` :3926, `throw e` :3928) успешная мутация на сервере откатывается локально и промис отвергается из-за ошибки рендера. Также `effect()` (:544 `node._execute()`) на первом запуске бросает в setup, минуя `scope.onError` — второй запуск того же эффекта пошёл бы в onError (:737): несогласованно.

**Предложение:** Единая политика ошибок эффектов, как у Vue (`app.config.errorHandler`), Angular (`ErrorHandler`), React 19 (`reportError`): `_flush`/`_runLane`/первый запуск `effect()` → `_dispatchError(owner)` → `defaults.onError(e, info)` → `self.reportError(e)` (WHATWG: событие `error` на window, Sentry/console видят как uncaught) — но НЕ исключение в писателя. Для тестов и отладки `__AEGIS_DEV__ === 'strict'` сохраняет синхронный throw (текущее поведение). Секция 9 при этом получает корректную атрибуцию бесплатно: `error.value` — только ошибки fetch.

**Алгоритм:**

```js
// ядро (после _dispatchError)
function _reportError(e) {
    if (globalThis.__AEGIS_DEV__ === 'strict') throw e;                       // тесты: как сейчас
    const h = typeof defaults !== 'undefined' && defaults.onError;            // configure({ onError })
    if (h) { try { h(e, e.aegis || null); return; } catch (x) { e = x; } }
    if (typeof reportError === 'function') reportError(e);                    // WHATWG self.reportError → window 'error'
    else setTimeout(() => { throw e; });
}
// _flush (:756): вместо `if (error) throw error;` → `if (error) _reportError(error);`
// остальные ошибки раунда (:739) — тоже _reportError вместо console.error
// _runLane (:684): `if (!_dispatchError(obs._owner, e)) _reportError(e);`
// effect() (:544): try { node._execute(); } catch (e) { if (!_dispatchError(owner, e)) throw e; }   // первый запуск: onError как у повторных; без обработчика — синхронно в setup (errorBoundary/component ловят)
// defaults (:1444): { fetcher: _defaultFetcher, motion: 'auto', onError: null }
```

**API:**

```js
`configure({ onError?: (e: unknown, ctx: { effect: string; scope: string | null; changed: Array<{name: string; value: string}>; site?: string } | null) => void })` и `defaults.onError`; d.ts: `export interface Defaults { onError?: … }`. Семантика в README/ERRORS.md: «Ошибка эффекта: scope.onError → configure({ onError }) → window 'error' (reportError). Писатель сигнала исключение не получает. В `__AEGIS_DEV__='strict'` — бросается синхронно».
```

**Критерий:** test.html, section('ошибка эффекта не становится ошибкой resource'):
{
  const caught = []; const onErr = (e) => { caught.push(e.error); e.preventDefault(); }; addEventListener('error', onErr);
  const sc = createScope(); let res;
  sc.run(() => { res = resource('/render-boom', { fetcher: async () => ({ items: null }) }); effect(() => { const d = res.data.value; if (d) d.items.length; }, 'render'); });
  await settled();
  assert('resource успешен, несмотря на TypeError шаблона', res.status.value === 'success' && res.error.value === null && res.data.value.items === null);
  assert('ошибка ушла в window error (reportError) с контекстом', caught.length === 1 && caught[0] instanceof TypeError && caught[0].aegis && caught[0].aegis.effect === 'render');
  removeEventListener('error', onErr); sc.dispose();
  let viaDefaults = 0; configure({ onError: () => viaDefaults++ });
  const s = signal(0); const sc2 = createScope(); sc2.run(() => effect(() => { if (s.value) throw new Error('x'); }));
  let threw = false; try { s.value = 1; } catch (e) { threw = true; }
  assert('писатель не получает исключение, defaults.onError получает', !threw && viaDefaults === 1);
  configure({ onError: null }); sc2.dispose();
}
И: `mutation` с бросающим эффектом — промис `run()` резолвится результатом, оптимистичный патч не откатывается. test-core.mjs:179/:256 — обернуть в `globalThis.__AEGIS_DEV__ = 'strict'` либо заменить на onError-ассерты.

**Источники:** WHATWG HTML §8.1.4.3 `self.reportError()` (Baseline 2022); Vue 3 `app.config.errorHandler` / `handleError` (ошибка watcher'а не бросается в `ref.value = …`); Angular `ErrorHandler` для `effect()`; React 19 «errors in effects are reported via `reportError`»; Svelte 5 `handle_error` (ошибка эффекта → boundary или `reportError` из микротаска); Solid `handleError` + `ErrorBoundary`; Preact Signals — контрпример (бросает после batch), именно он даёт описанную ловушку.

### 💎 #3 — Ленивая подписка computed (watched/unwatched) + _epoch fast-path + хуки watched/unwatched для signal/from()

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip (ядро: _track/_drop/_watch/_unwatch, хуки); from({lazy}) ещё ~+0.1 KB в секции 11 (tree-shakeable)

**Сейчас:** aegis_full.js:205–223 `_track`: любой observer — в т.ч. Computed без собственных подписчиков — при первом же вычислении добавляется в `src.subs` навсегда (`(src.subs || (src.subs = new Set())).add(obs)`). `computed()` (:436–440) компенсирует это регистрацией `dispose` в scope, но вне scope (утилиты, `arr.map(x => computed(…))`, playground, `Aegis.dev` в консоли) — вечная утечка: симуляция — три `computed(() => a.value + i).peek()` → `a.subs.size === 3` (Preact/TC39: 0); каждая запись в `a` делает push по мёртвым computed (`_run` :385–389). Также нет способа узнать «на сигнал кто-то смотрит»: `from(producer)` (:4247–4270) стартует producer (WebSocket, matchMedia, IntersectionObserver) при создании, а не при первом наблюдателе — TC39 `Signal.subtle.watched/unwatched` и RxJS refCount решают это.

**Предложение:** Как Preact (`_subscribe/_unsubscribe` + `globalVersion`) и Vue 3.5 (`globalVersion` в `refreshComputed`): Computed подписывается на источники только пока `subs.size > 0` (`_live`). Неживой computed валидируется при чтении сам: если `_epoch` не изменился с прошлого чтения — O(1) возврат; иначе `_depsChanged` (рекурсивно через `version()`) → пересчёт или просто обновить `_seen`. При появлении первого подписчика — `_watch()` (рекурсивно подписать себя на deps), при уходе последнего — `_unwatch()`. Точка счётчика уже есть: `subs` создаётся лениво, `Set.size` бесплатен. Те же переходы 0→1/1→0 вызывают `watched/unwatched` у Signal → `from(producer, initial, { lazy: true })` подключается по первому наблюдателю. Побочный эффект: неотслеживаемые computed становятся GC-able, `computed()` вне scope перестаёт быть утечкой (E001-подобное предупреждение не нужно).

**Алгоритм:**

```js
// Signal: this._w = opts.watched, this._u = opts.unwatched (из _eqOf-подобного разбора опций)
function _gain(src) {           // появился первый подписчик
    if (src._isComputed) src._watch(); else if (src._w) src._w();
}
function _drop(src, obs) {      // O(1) удаление + реакция на уход последнего
    const s = src.subs; if (!s) return;
    s.delete(obs);
    if (!s.size) { if (src._isComputed) src._unwatch(); else if (src._u) src._u(); }
}
function _track(src) {
    const obs = _tracking; if (!obs) return;
    /* … стабильная позиция как сейчас … */
    deps[i] = src; vers[i] = src.version();
    if (!obs._isComputed || obs._live) _sub(src, obs);   // неживой computed только запоминает dep
    obs._n = i + 1;
}
function _sub(src, obs) { if (!src.subs) { src.subs = new Set([obs]); _gain(src); } else src.subs.add(obs); }
// _unsubIfGone/_unsubscribe/_notify(disposed): src.subs.delete(obs) → _drop(src, obs)
Computed.prototype._watch = function () { this._live = true; if (this._deps) for (const d of this._deps) _sub(d, this); };
Computed.prototype._unwatch = function () { this._live = false; if (this._deps) for (const d of this._deps) _drop(d, this); };
// чтение неживого computed: некому было пометить dirty — проверяем сами
get value() {
    if (this._dirty || (!this._live && this._seen !== _epoch)) this._refresh();
    _track(this); if (this._err) throw this._err.e; return this._value;
}
_refresh() {
    if (!this._dirty && this._deps && this._deps.length && !_depsChanged(this)) { this._seen = _epoch; return; }
    this._recompute(); this._seen = _epoch;
}
// Computed.dispose(): _unwatch() вместо _unsubscribe; linked() (:4400–4401) проксирует subs — оставить, но dispose → out.dispose(); selector() (:4415) — псевдо-источники без _isComputed, не затронуты.
// from(producer, initial, { lazy: true }): const sig = signal(initial, { name, watched: () => { stop = producer(set); }, unwatched: () => { stop && stop(); stop = null; } });
```

**API:**

```js
`signal<T>(initial, { name?, equals?, watched?(): void, unwatched?(): void })` (SignalOptions в d.ts); `from(producer, initial?, { lazy?: boolean })` и `from(target, event, map, { lazy })`; `stats()` дополнить `watched: <число сигналов с подписчиками>`; JSDoc `computed()`: «подписан на источники только пока на него подписаны; чтение без наблюдателей — по версиям».
```

**Критерий:** test.html, section('computed: подписка только при наблюдателях'):
{
  const a = signal(1); const cs = [0,1,2].map(i => computed(() => a.value + i));
  cs.forEach(c => c.peek());
  assert('неотслеживаемые computed не держат источник', (a.subs ? a.subs.size : 0) === 0);
  a.value = 5;
  assert('и при этом корректны по версиям', cs.map(c => c.value).join() === '5,6,7');
  const sc = createScope(); let v; sc.run(() => effect(() => { v = cs[0].value; }));
  assert('появился эффект — computed ожил и подписался на a', a.subs.size === 1 && v === 5);
  a.value = 6; assert('push через живой computed', v === 6);
  sc.dispose(); assert('ушёл последний подписчик — отписка каскадом', a.subs.size === 0);
  let started = 0, stopped = 0;
  const live = from((set) => { started++; set(1); return () => stopped++; }, 0, { lazy: true });
  assert('lazy from: producer не стартует без наблюдателей', started === 0 && live.peek() === 0);
  const sc2 = createScope(); sc2.run(() => effect(() => live.value));
  assert('первый наблюдатель запускает producer', started === 1 && live.peek() === 1);
  sc2.dispose(); assert('последний наблюдатель останавливает', stopped === 1);
}
Измерение (bench.html): 10 000 `computed(() => a.value * 2).peek()` вне scope → `a.subs.size === 0`, heap после GC не растёт (было ~660 B × N); js-reactivity-benchmark «unwatched computed read» не медленнее текущего ×1.2.

**Источники:** TC39 proposal-signals: `Signal.subtle.watched`/`unwatched`, «computeds that are not watched do not hold references from their sources» (GC-ability); Preact Signals `Computed._subscribe`/`_unsubscribe`, `globalVersion` fast-path в `_refresh`; Vue 3.5 `computed` — `globalVersion` + подписка только при наличии subs (`refreshComputed`); alien-signals `checkDirty`; RxJS `share({ refCount })`; Angular `computed` (producerMustRecompute/consumerIsLive).

### 💎 #4 — Детерминированный порядок раунда flush по порядку создания (_ord): родитель раньше потомка

**Impact:** 3 · **Effort:** S · **Size:** +0.08 KB gzip (ядро)

**Сейчас:** aegis_full.js:699–757 `_flush`: раунд = `_queue` в порядке попадания, а порядок попадания = порядок итерации `Set` `src.subs` (:635–652 `_notify`) = порядок ПЕРВОЙ подписки. При «churn» зависимостей (:225–243 `_endTrack`/`_unsubIfGone` удаляют observer из Set, `_track` :219 добавляет заново в конец) родитель оказывается ПОЗЖЕ ребёнка. Симуляция: `parent` = effect-условие `mode.value === 'x' ? user.value != null : other.value` (владеет дочерним scope с биндингом `user.value.name`), после `mode='o'; mode='x'` порядок `user.subs` = [child, parent]; `user.value = null` → лог `C C-ERR P`: дочерний биндинг падает на null раньше, чем родитель успел уничтожить его scope. Vue сортирует очередь по `job.id` (findInsertionIndex), Solid поднимается к верхнему STALE-владельцу (`runTop`/`lookUpstream`), Svelte 5 обходит дерево эффектов сверху вниз. Также недетерминизм: один и тот же баг воспроизводится или нет в зависимости от истории подписок.

**Предложение:** Каждому Effect/Subscriber — монотонный `_ord` при создании (родители создаются раньше своих динамических детей — это инвариант scope-модели Aegis: дети рождаются внутри запуска родителя). В `_flush` и `_runLane` раунд перед выполнением проверяется на монотонность за O(n) и сортируется только при нарушении (редко). Родитель, уничтожив дочерний scope, оставляет ребёнку `_disposed=true` → пропуск (:723). Порядок становится независимым от внутренностей Set → воспроизводимые баги, стабильный `trace()`.

**Алгоритм:**

```js
let _ordSeq = 0;
const _byOrd = (a, b) => a._ord - b._ord;
class Effect { constructor(...) { /* … */ this._ord = ++_ordSeq; } }
class Subscriber { constructor(...) { /* … */ this._ord = ++_ordSeq; } }
function _ordered(round) {             // O(n) проверка, сортировка только при нарушении
    for (let i = 1; i < round.length; i++) if (round[i]._ord < round[i - 1]._ord) return round.sort(_byOrd);
    return round;
}
// _flush (:719): const round = _ordered(_queue); _queue = [];
// _runLane (:683): const list = _ordered(_lanes[lane]);
// dev-детектор (по желанию): если сортировка что-то переставила — счётчик в _stats.reordered для stats()
```

**API:**

```js
Публичный API не меняется. README/раздел «Reactivity»: «Эффекты одного раунда выполняются в порядке создания: родительский эффект всегда раньше эффектов, созданных внутри него; уничтоженные им дети в этом раунде не запускаются». `stats()` → `reordered: number` (диагностика churn).
```

**Критерий:** test.html, section('flush: родитель раньше потомка после churn зависимостей'):
{
  const mode = signal('x'), user = signal({ name: 'ann' }), other = signal(true);
  const log = []; let childErr = 0, kid = null;
  const sc = createScope();
  sc.run(() => effect(() => {
    log.push('P');
    const vis = mode.value === 'x' ? user.value != null : other.value;   // churn: user выпадает при mode='o'
    if (kid) { kid.dispose(); kid = null; }
    if (vis) { kid = createScope(); kid.run(() => effect(() => { log.push('C'); try { user.value.name; } catch (e) { childErr++; } }, 'child')); }
  }, 'parent'));
  mode.value = 'o'; mode.value = 'x';          // parent переподписался на user ПОСЛЕ child
  log.length = 0; user.value = null;
  assert('родитель первым, дочерний биндинг не бежит по null', log.join('') === 'P' && childErr === 0);
  assert('порядок раунда детерминирован', stats().reordered >= 1);
  sc.dispose();
}
Бенчмарк bench.html «fan-out 1000 эффектов, одна запись»: время раунда не хуже ×1.02 (проверка монотонности без сортировки).

**Источники:** Vue 3 scheduler `queueJob`/`findInsertionIndex` (сортировка по `job.id`, «parent before child»); Solid `runTop` + `lookUpstream` (обновление начинается с самого верхнего STALE-владельца); Svelte 5 `flush_queued_root_effects` (обход дерева эффектов сверху вниз); Angular `EffectScheduler` (порядок регистрации); S.js «owner-before-owned».

### 💎 #5 — Полосы micro/frame: дренаж в одном тике и защита от самоцикла

**Impact:** 3 · **Effort:** S · **Size:** +0.10 KB gzip (ядро; часть кода общая с _flush)

**Сейчас:** aegis_full.js:669–685 `_enqueueLane`/`_runLane`: `_runLane` снимает `_laneScheduled[lane] = false` (:680), берёт список и выполняет его один раз; запись сигнала из эффекта полосы снова проходит `_enqueueLane` → `queueMicrotask`/`requestAnimationFrame` на СЛЕДУЮЩИЙ тик. Следствия: (1) самоцикл `effect(() => { s.value = s.value + 1 }, { flush: 'micro' })` бесконечен — симуляция: 5000 запусков за 50 мс и дальше без ошибки (синхронный вариант ловится `_MAX_ROUNDS` :189 на 101-м раунде с понятным сообщением :721–725), страница «замерзает» в microtask-голодании без единой ошибки в консоли; (2) glitch между полосами: frame-эффект A пишет сигнал, от которого зависит frame-эффект B → B перерисуется на СЛЕДУЮЩЕМ кадре — один кадр разорванного состояния на экране (для 'micro' — состояние, наблюдаемое `await`-кодом между микротасками); (3) ошибки полосы уходят в `console.error` (:684) мимо политики ошибок ядра.

**Предложение:** `_runLane` дренирует полосу до опустошения в том же тике (раунды как в `_flush`), пока дренаж идёт — `_laneScheduled[lane] = true`, чтобы записи не планировали новый microtask/кадр; после `_MAX_ROUNDS` — тот же `Infinite reactive loop` с именами эффектов; E027 (:749–753) считает раунды полосы тоже. Ошибки — через `_dispatchError` → `_reportError` (бриллиант 2). Семантика для пользователя: «всё, что frame-эффекты вычислили и записали, попадает в тот же кадр».

**Алгоритм:**

```js
function _runLane(lane) {
    _laneScheduled[lane] = false;
    if (!_lanes[lane].length) return;
    _laneScheduled[lane] = true;                        // записи во время дренажа не планируют новый тик
    let rounds = 0;
    try {
        while (_lanes[lane].length) {
            if (++rounds > _MAX_ROUNDS) {
                const list = _lanes[lane]; _lanes[lane] = [];
                for (const o of list) o._queued = false;
                throw new Error(`[Aegis] Infinite reactive loop in "${lane}" lane — effect writes a signal it depends on (${list.map(o => o._name).join(', ')})`);
            }
            const list = _ordered(_lanes[lane]); _lanes[lane] = [];
            for (const obs of list) {
                obs._queued = false;
                if (obs._disposed) continue;
                try { obs._run(); } catch (e) { if (!_dispatchError(obs._owner, e)) _reportError(e); }
            }
        }
    } finally {
        _laneScheduled[lane] = false;
        if (rounds > 3) _warn('E027', { what: `${lane} lane took ${rounds} rounds — effects keep writing signals other effects depend on.`, why: 'Each round is an effect reacting to a write from the previous round (ping-pong).', fix: 'Replace the effect with a computed(), or write all values in one batch().' }, 'rounds:' + lane);
    }
}
// flush() (:687–691) без изменений: _runLane('micro'); _runLane('frame'); _flush();
```

**API:**

```js
API прежний: `effect(fn, { flush: 'micro' | 'frame' })`, `flush()`. d.ts JSDoc к `EffectOptions.flush`: «полоса дренируется целиком в одном микротаске/кадре; самоцикл бросает `Infinite reactive loop in "micro" lane` после 100 раундов». ERRORS.md: E027 — «в т.ч. для полос micro/frame».
```

**Критерий:** test.html, дополнение section('💎 #122 … полосы flush'):
{
  const s = signal(0); let runs = 0, msg = '';
  const sc = createScope(); sc.run(() => effect(() => { runs++; s.value = s.value + 1; }, { name: 'loop', flush: 'micro' }));   // первый запуск синхронный, пишет s → в полосу
  try { flush(); } catch (e) { msg = e.message; }
  assert('самоцикл micro-полосы обнаружен, а не вечный микротаск', /Infinite reactive loop in "micro" lane/.test(msg) && runs <= 102);
  sc.dispose();
  const a = signal(0), b = signal(0); const seen = [];
  const sc2 = createScope(); sc2.run(() => { effect(() => { seen.push([a.value, b.value]); }, { flush: 'frame' }); effect(() => { b.value = a.value * 10; }, { flush: 'frame' }); });
  seen.length = 0; a.value = 1;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  assert('frame-полоса дренируется в одном кадре: без кадра с разорванным состоянием', JSON.stringify(seen) === '[[1,0],[1,10]]' && seen.length === 2 /* оба в одном кадре */);
  sc2.dispose();
}
(Второй ассерт формулируется точнее через счётчик кадров: обёртка rAF считает кадры между первой и последней записью в `seen` — должен быть 0.)

**Источники:** Solid `runUpdates`/`completeUpdates` (Effects дренируются до пустой очереди в одном тике); Vue `flushJobs` (`RECURSION_LIMIT = 100`, `checkRecursiveUpdates` — «Maximum recursive updates exceeded»); Svelte 5 `flush_queued_root_effects` + `infinite_loop_guard` (1000 итераций → `effect_update_depth_exceeded`); Preact Signals `batch` — все эффекты до опустошения, `Cycle detected` при повторном входе; TC39 Signals Watcher: notify один раз за тик, pull всей полосы.

### 💎 #6 — E045 — чтение уничтоженного computed: тихо замороженное значение становится предупреждением

**Impact:** 3 · **Effort:** S · **Size:** +0.12 KB gzip (ядро, текст предупреждения; в проде одна проверка поля)

**Сейчас:** aegis_full.js:376–383 `Computed.dispose()` ставит `_disposed=true`, отписывает от источников и чистит `subs`; `_run` (:385–389) после этого никогда не помечает dirty. Но `get value()`/`peek()` (:361–370) читаются как обычно и `_track(this)` подписывает нового читателя на мёртвый источник. Итог — класс тихих багов «UI не обновляется»: computed, созданный внутри scope ветки `show()` (:2553, `_branchScope.dispose()`), строки `list()` или компонента, захвачен более долгоживущим эффектом. Симуляция: `sc.run(() => c = computed(() => a.value*2)); effect(() => last = c.value); sc.dispose(); a.value = 10` → `last === 2` навсегда, ни одного предупреждения; в dev-панели computed выглядит живым. Аналогичный детектор для эффектов есть (E005 «scope.run() on disposed scope», E028 зомби-биндинг), для computed — нет.

**Предложение:** Dev-предупреждение E045 при чтении `.value`/`.peek()` уничтоженного computed (один раз на имя), с подсказкой Where/At и именем читающего эффекта (`_tracking._name`). В проде — одна проверка уже существующего булева поля на хвосте getter'а (после `_dirty`-ветки). Опционально: `Aegis.dev.inspect()` помечает такие computed `disposed: true`.

**Алгоритм:**

```js
class Computed {
    get value() {
        if (this._dirty) this._recompute();
        if (this._disposed && _dev()) _deadRead(this);
        _track(this);
        if (this._err) throw this._err.e;
        return this._value;
    }
    peek() { if (this._dirty) this._recompute(); if (this._disposed && _dev()) _deadRead(this); /* … */ }
}
function _deadRead(c) {
    _warn('E045', {
        what: `computed "${c._name || '?'}" read after its scope was disposed — value is frozen at ${_short(c._value)}${_tracking ? ` (read by "${_tracking._name}")` : ''}.`,
        why: 'A disposed computed never recomputes; the reader keeps showing the last value while the source signals change.',
        fix: 'Create the computed in the scope of the reader (or higher), or pass a function (() => …) instead of the computed.',
    }, c._name || 'anon');
}
// ERRORS.md: строка E045; aegis-devtools.js explain(): текст
```

**API:**

```js
API не меняется. ERRORS.md: `E045 | A disposed computed() was read — its value is frozen. | Create it in the reader's scope or pass a function.` d.ts: JSDoc к `Computed.dispose()`: «после dispose чтение выдаёт E045 в dev».
```

**Критерий:** test.html, section('E045 — чтение уничтоженного computed'):
{
  const codes = []; const off = onWarn(w => codes.push(w.code)); dev.resetWarnings();
  const a = signal(1); let c, last;
  const inner = createScope(); inner.run(() => { c = computed(() => a.value * 2, 'dead'); });
  const outer = createScope(); outer.run(() => effect(() => { last = c.value; }, 'reader'));
  assert('до dispose предупреждений нет', codes.length === 0 && last === 2);
  inner.dispose(); a.value = 10;
  outer.run(() => effect(() => { c.value; }, 'reader2'));   // новое чтение мёртвого computed
  assert('E045 при чтении уничтоженного computed', codes.includes('E045'));
  off(); outer.dispose();
}
Измерение: bench.html «read computed ×1e6» — разница в пределах шума (одна проверка `this._disposed`).

**Источники:** Solid dev-warning «computed created outside a reactive root»/`DEV.hooks`; Vue 3 `effectScope` — `onScopeDispose` вызывается на inactive scope с предупреждением «onScopeDispose() is called when there is no active effect scope»; Angular signals: чтение уничтоженного `effect` — `NG0953`-класс ошибок жизненного цикла; Aegis ERRORS.md E005/E028 (тот же паттерн детектора).

## 🔭 perf-memory

**Линза:** Производительность и память реактивного ядра: структуры подписок (массивы/Set, _deps/_vers), стоимость _endTrack, батчинг и очередь, полосы (lanes micro/frame), утечки через scope/onDispose, WeakRef/FinalizationRegistry, крупные списки (list() + reactive() 3.0), стоимость dev-режима в проде, аллокации в горячем пути html``-парсера и compiled parts. Предлагай измеримые оптимизации с бенчмарком (bench.html есть в репо).

**Вывод:** Реактивное ядро Aegis после #107/#108/#116 архитектурно на уровне 2026 года: классы с прототипами, параллельные deps/vers с O(1) стабильным трекингом, glitch-free по версиям, ленивые subs, очередь без копий; на DOM-бенче (Chrome headless, bench.html) create 1000 = 18 мс, swap = 2 insertBefore, select = 0.1 мс — ядро не является узким местом по времени. Отстаёт оно в трёх местах, и все три измерены. (1) Память на привязку: effect с одной зависимостью стоит 902 B (два массива _deps/_vers вырастают до capacity 17 = 386 B, замыкания dispose/_unreg = 250 B, 6 dev-полей в прод-shape), строка list() с двумя реактивными ячейками — 2032 B против 450 B статической; 10k строк = 30k effects ≈ 27 MB. (2) Семантика computed: он подписывается на источники навсегда и требует scope-владельца (Preact/Angular/TC39 Signals отписывают ненаблюдаемый computed); это не только класс утечек (1000 computed без scope навсегда в src.subs), но и подтверждённый баг — геттер store()/аксессор reactive() создаётся под scope первого читателя и после его dispose застывает навсегда (S.twice === 2 при n = 7, новые effects не перезапускаются). (3) Алгоритмическая яма: _endTrack при массовом сдвиге зависимостей квадратичен — 20× при 1000 deps, 187× (14 мс/запуск) при 5000 — ровно сценарий unshift/sort в reactive-массиве. Отдельно reactive() на 100k строк: 525 B/строку трекинга, 100 023 deps у одного effect, +9 MB и 59 мс на eager structuredClone ради $reset, 61.5 MB heap в бенче — Vue 3.5 закрыл аналогичную дыру ARRAY_ITERATE_KEY, Aegis может пойти дальше (coarse deep-версия для вложенных записей). Ниже 5 бриллиантов: unowned computed (impact 5), memory-diet ядра до ≤400 B/effect, O(n) _endTrack, coarse-итерация reactive-массивов, ленивый снимок $reset.

**Отвергнуто:** 1) Рёбра графа как связный список Link (alien-signals/Preact) — уже DIAMONDS-2 #127 с критерием входа; на DOM-масштабе доля §1 в профиле мала (create 1000 = 18 мс, из них ядро ≈ 1–2 мс), а бриллиант #2 ниже даёт бóльшую часть выигрыша по памяти без смены структуры. 2) Оптимизация bookkeeping в list()._reconcile (Map seen + Set(newKeys) + oldIdx): замерено — пустая сверка 10k строк 1.5 мс, Map-проход 0.6 мс, Set 0.5 мс, при create 10k = 168 мс это <1%; не окупает код. 3) Дедуп резолва путей в _instantiate (childNodes[p[k]] по одинаковым path): ~14 индексаций на строку ≈ 0.6 мкс против 18 мкс на строку — 3%. 4) selector() O(1) вместо скана всех ключей при Object.is: бенч «select row» уже 0.1 мс при 1000 строках, скан 10k ключей ≈ 0.1–0.2 мс — нечего выигрывать; при custom equals скан обязателен. 5) WeakRef/FinalizationRegistry как «канарейка утечек» островов: _components держит el сильно намеренно (inspect/hydrate), E028 уже ловит зомби-привязки, а недетерминизм GC делает тест flaky. 6) micro-lane по умолчанию для DOM-привязок — отвергнуто ещё в DIAMONDS-2 (синхронная модель, ~32 assert'а). 7) «Стоимость dev-режима в проде» как отдельный бриллиант: _dev() — кэшированный boolean, _callSite/_snippet только в dev; единственная прод-цена — 6 dev-полей в shape Effect (48 B) и `_site/_counted`, добавляемые после конструктора (map transitions) — включено пунктом в #2. 8) Ленивый Set в Scope и транзитный Scope в _insertDynamic как отдельный бриллиант: 161 B/scope = 8% строки, 20k транзитных scope при create 10k ≈ 4 мс из 70 — включено пунктом в #2. 9) shallow/markRaw для больших reactive-массивов как «решение» 100k строк — это ответ Vue, перекладывающий цену на пользователя; #4 даёт ту же память при сохранении реактивности записей. 10) Инкрементальные производные коллекции (не перезапускать filter при одном toggle) — вне 2026-мейнстрима (ни Solid, ни Vue), отдельная библиотека, не ядро. 11) Замена массива-очереди `_queue = []` на кольцевой буфер — аллокация одного массива на раунд, невидимо.

### 💎 #7 — Unowned computed: подписка на источники только пока есть свои подписчики (чинит застывающие геттеры store/reactive)

**Impact:** 5 · **Effort:** M · **Size:** +0.2 KB gzip в ядре (≈ +250 B _addSub/_delSub/_activate/_deactivate/_chk, −40 B за снятие регистрации computed() в scope)

**Сейчас:** _track (aegis_full.js:205-222) добавляет любой observer в src.subs безусловно; computed() (:436-440) регистрирует dispose в текущем scope; Computed._run (:386) при _disposed выходит до пометки dirty, а get value/peek/version (:361-374) _disposed не проверяют — уничтоженный computed вечно отдаёт старое _value. Геттеры создаются лениво под scope ПЕРВОГО читателя: store() (:4203) и аксессоры reactive() (:4776-4779). Подтверждено в node на aegis_full.js: store({ n: 1, get twice() { return this.n * 2 } }), чтение в effect строки, dispose этого scope, S.n = 7 → S.twice === 2 (ожидалось 14); новый effect на S.twice запускается 1 раз и больше никогда (runs = 1 из 3). Утечка: 1000 computed без scope, прочитанных один раз, навсегда остаются в src.subs (size = 1000), каждая запись в src тратит на них 5 мкс push-фазы; computed с 1 dep стоит 596 B, из них ~170 B — замыкание _unreg + запись в Set владельца. Preact Signals, Angular signals (consumerIsLive), TC39 Signal.Computed и Solid 2 живут иначе: ненаблюдаемый computed не подписан ни на что и валидируется по версиям при чтении.

**Предложение:** Computed становится «живым» (_live) только пока у него ≥ 1 подписчик: первый _addSub активирует его (подписывает на записанные deps), удаление последнего — деактивирует (отписывает, оставляя _deps/_vers для проверки версий). Неживой computed при чтении сверяет версии зависимостей (это уже делает bailout в _recompute) с fast-path по глобальному _epoch: если с момента последней проверки не менялся ни один сигнал в системе — ответ из кэша за O(1). computed() перестаёт регистрироваться в scope (dispose() остаётся ручным методом) — исчезает и баг геттеров, и класс утечек, и требование «computed только внутри scope»; в _track неживой computed как observer только записывает deps/vers, не подписываясь. Effect/Subscriber всегда живые — их путь не меняется.

**Алгоритм:**

```js
// ---- live/unowned computed --------------------------------------------------
function _addSub(src, obs) {
    const s = src.subs || (src.subs = new Set());
    if (!s.size && src._isComputed && !src._live) src._activate();   // первый подписчик — computed оживает
    s.add(obs);
}
function _delSub(src, obs) {
    const s = src.subs;
    if (!s || !s.delete(obs) || s.size) return;
    if (src._isComputed) src._deactivate();                           // последний ушёл — отписаться от источников
}
// _track: вместо (src.subs || (src.subs = new Set())).add(obs)
//     if (obs._live !== false) _addSub(src, obs);   // Effect/Subscriber: _live undefined; неживой computed — только deps/vers
// _unsubIfGone / _unsubscribe / _notify(disposed): _delSub(src, obs) вместо src.subs.delete(obs)

class Computed {
    constructor(fn, name, eq, initial) { /* как сейчас */ this._live = false; this._chk = -1; }
    _activate()   { this._live = true;  const d = this._deps; if (d) for (let i = 0; i < d.length; i++) _addSub(d[i], this); }
    _deactivate() { this._live = false; const d = this._deps; if (d) for (let i = 0; i < d.length; i++) _delSub(d[i], this); }
    /** неживому dirty не приходит push'ем — сверяем версии по требованию; _chk === _epoch → в системе ничего не менялось */
    _stale() { return this._dirty || (!this._live && this._chk !== _epoch); }
    get value() { if (this._stale()) this._recompute(); _track(this); return this._value; }
    peek()      { if (this._stale()) this._recompute(); return this._value; }
    version()   { if (this._stale()) this._recompute(); return this._version; }
    _recompute() {
        // … существующий код: bailout через _depsChanged, _n = 0, _tracking = this, fn, _endTrack …
        this._dirty = false; this._chk = _epoch;
    }
    dispose() { if (this._disposed) return; this._disposed = true; this._deactivate(); if (this.subs) this.subs.clear(); }
}
export function computed(fn, nameOrOpts) {
    return new Computed(fn, _nm(nameOrOpts), _eqOf(nameOrOpts), _initialOf(nameOrOpts));   // без onDispose: владелец не нужен
}
// Инвариант: computed ∈ src.subs ⇔ computed._live ⇔ computed.subs.size > 0. Цепочка c2→c1→s: пока c2 никто не читает в effect, ни c1, ни c2 не подписаны; effect читает c2 → c2 оживает → _addSub(c1, c2) оживляет c1 → подписка на s.
```

**API:**

```js
Публичные сигнатуры не меняются: computed(fn, nameOrOpts): Computed<T> с .value/.peek()/.version()/.subscribe()/.dispose(). aegis.d.ts: JSDoc «computed() не требует scope и не утекает без подписчиков; dispose() — по желанию». ERRORS.md: E001 остаётся только для effect (computed вне scope — норма). dev.inspect(): у computed поле live: boolean. Внутренний контракт для §16/§11: геттеры store()/reactive() можно создавать под любым scope.
```

**Критерий:** test.html, section('computed без владельца'): (1) const S = store({ n: 1, get twice() { return this.n * 2; } }); sc.run(() => effect(() => { S.twice; })); sc.dispose(); S.n = 7; assert(S.twice === 14); let runs = 0; sc2.run(() => effect(() => { S.twice; runs++; })); S.n = 8; S.n = 9; assert(runs === 3). (2) const src = signal(0); for (i<100) computed(() => src.value + 1).value; assert(!src.subs || src.subs.size === 0). (3) const c = computed(() => src.value * 2); sc3.run(() => effect(() => c.value)); assert(src.subs.size === 1); sc3.dispose(); assert(src.subs.size === 0); src.value = 5; assert(c.value === 10). (4) то же для reactive({ a: 1, get double() {…} }) — st.double === 10 после dispose первого читателя. Регресс-бенч bench.html: diamond × 100k ≤ 50 мс (сейчас 46.1), deep chain 100 × 1000 ≤ 10 мс (сейчас 9). Память (node --expose-gc): computed с 1 dep, прочитанный один раз ≤ 450 B (сейчас 596). Все секции Computed/FIX C1/linked зелёные.

**Источники:** Preact Signals (Computed._unsubscribe: отписка от источников при потере последнего target; «computeds are lazy and detach when unobserved»); Angular signals core: REACTIVE_NODE.consumerIsLive / producerMustRecompute — non-live consumers валидируют producers по version при чтении; TC39 Signals proposal (Signal.Computed «unwatched», global version для валидации без подписки); alien-signals checkDirty/unlink; Solid 2.0 createMemo без owner; Vue 3.5 «computed: no longer needs effect scope to be GC'd» (PR #10397).

### 💎 #8 — Memory-diet ядра: effect с одной зависимостью 902 B → ≤ 400 B, строка list() с реактивными ячейками ×2 меньше

**Impact:** 4 · **Effort:** M · **Size:** ≈ +0.13 KB gzip в ядре (единый массив deps −20 B, disposers-узлы −40 B, _dbg +40 B, inline single-subscriber +150 B)

**Сейчас:** Замеры node --expose-gc на aegis_full.js: effect с 1 dep в scope — 902 B, без scope — 772, только объект Effect в scope — 508 B. Разложение: _deps и _vers (:208-209, :218-219) создаются как [] и растут первым же deps[i] = src до capacity 17 → 193 B каждый = 386 B (43% эффекта); dispose-замыкание + свойство _node (:539-540) = 145 B; замыкание unregister из Scope.onDispose (:817) + поле _unreg (:542) = 113 B; 19 own-полей Effect (:445-460 плюс _site/_counted, добавляемые ПОСЛЕ конструктора :482, :538 — map transitions), из них 6 dev-only (_el/_seen/_detached/_warnedZombie/_trace/_site) = 48 B в проде; src.subs = new Set() даже при одном подписчике (:220) = 161 B + 68 B за запись. Scope (:773, :776): eager Set + bind = 297 B; _insertDynamic создаёт транзитный new Scope(owner) на КАЖДЫЙ запуск реактивного ребёнка (:2365) и отдельное замыкание owner.onDispose на каждого ребёнка (:2392). Итог в Chrome (lens-бенч, performance.memory): строка list() с двумя ${() => row.value.x} — 2032 B, статическая — 450 B; 10k строк = 30 002 effects ≈ 27 MB из 32.

**Предложение:** Пять согласованных правок структуры без изменения API: (a) deps и версии в ОДНОМ массиве через шаг 2 [src0, ver0, src1, ver1, …], первая зависимость — литерал из двух слотов (73 B вместо 386); (b) Scope._disposers хранит сами узлы (Effect/Computed/Subscriber), а не замыкания: dispose узла вычёркивает себя из владельца напрямую — исчезают _unreg и два замыкания; Set создаётся лениво; (c) внутренний _effect(fn, name, lane) возвращает узел — все DOM-привязки (_bindValue, _bindClass, _insertDynamic, attr/cls/style) не платят за dispose-обёртку с _node, публичный effect() оборачивает как сейчас; (d) dev-поля Effect уезжают в this._dbg = _dev() ? {} : null, _counted/_site объявляются в конструкторе — один стабильный hidden class на 12 полей; (e) subs: null | Observer | Set — Set только со второго подписчика (per-key сигналы reactive(), list:index, size/inView сигналы почти всегда имеют одного). Плюс _insertDynamic возвращает cleanup из тела effect вместо owner.onDispose-замыкания на ребёнка.

**Алгоритм:**

```js
// (a) единый массив deps/vers, _n — индекс слота источника (кратен 2)
function _track(src) {
    const obs = _tracking; if (!obs) return;
    const d = obs._deps, i = obs._n;
    if (d) {
        if (i < d.length && d[i] === src) { d[i + 1] = src.version(); obs._n = i + 2; return; }   // стабильная позиция
        if (i > 0 && d[i - 2] === src) return;                                                   // повтор подряд
        if (i < d.length) (obs._evict || (obs._evict = [])).push(d[i]);
        d[i] = src; d[i + 1] = src.version();
    } else obs._deps = [src, src.version()];                                                     // 73 B, не 2 × 193
    _addSub(src, obs); obs._n = i + 2;
}
function _depsChanged(obs) { const d = obs._deps; for (let i = 0; i < d.length; i += 2) if (d[i].version() !== d[i + 1]) return true; return false; }
// (b) владелец хранит узлы; узел сам вычёркивается
class Scope { constructor() { /* … */ this._disposers = null; }   // лениво
    _own(node) { (this._disposers || (this._disposers = new Set())).add(node); }
    onDispose(fn) { if (this._disposed) { fn(); return _noop; } this._own(fn); return () => { this._disposers && this._disposers.delete(fn); }; }
    dispose() { /* … */ if (this._disposers) for (const d of this._disposers) { try { typeof d === 'function' ? d() : d.dispose(); } catch (e) { console.error('[Aegis] dispose error:', e); } } }
}
class Effect {
    constructor(fn, name, owner, lane) {   // 12 полей, все в конструкторе
        this._fn = fn; this._name = name || 'effect'; this._owner = owner; this._lane = lane || null;
        this._cleanup = null; this._disposed = false; this._queued = false; this._counted = false;
        this._deps = null; this._n = 0; this._evict = null; this._dbg = _dev() ? { el: null, seen: false, detached: 0, site: null, trace: false } : null;
    }
    dispose() { if (this._disposed) return; this._disposed = true; if (this._counted) _liveEffects--; _unsubscribe(this); this._runCleanup();
        const o = this._owner; if (o && o._disposers) o._disposers.delete(this); }
}
// (c) внутренний конструктор без обёртки — для привязок DOM
function _effect(fn, name, lane) { const node = new Effect(fn, name, _currentScope, lane); if (node._owner) node._owner._own(node); node._execute(); return node; }
export function effect(fn, nameOrOpts) { /* dev-проверки E001/E019 как сейчас */ const node = _effect(fn, name, lane); node._dbg && (node._dbg.site = site); const dispose = () => node.dispose(); dispose._node = node; return dispose; }
// (e) subs: null | Observer | Set
function _addSub(src, obs) { const s = src.subs; if (!s) src.subs = obs; else if (s instanceof Set) s.add(obs); else if (s !== obs) src.subs = new Set([s, obs]); }
function _delSub(src, obs) { const s = src.subs; if (s === obs) src.subs = null; else if (s instanceof Set) { s.delete(obs); if (s.size === 1) for (const o of s) src.subs = o; } }
function _notify(subs) { if (!(subs instanceof Set)) { _notifyOne(subs); if (_notifyDepth === 0 && _batchDepth === 0) _flush(); return; } /* … цикл как сейчас через _notifyOne */ }
// _insertDynamic: вместо owner.onDispose(() => …) — тело effect возвращает () => { if (scope) { scope.dispose(); scope = null; } }; при перезапуске clear() уже обнулил scope → cleanup no-op
```

**API:**

```js
Публичный API без изменений: effect() возвращает функцию с ._node, onDispose() возвращает unregister, computed/signal как прежде. Внутренний: _effect(fn, name, lane): Effect для §5/§6/§7; Scope._own(node). Dev-хелпер для тестов/devtools вместо прямого a.subs.size: dev.subsOf(sig): Observer[] (нормализует null | Observer | Set). aegis-devtools.js/_inspectScope: обход _disposers принимает узлы (d._node || d) и deps по шагу 2 (_depsOf(node)).
```

**Критерий:** node --expose-gc (probe в стиле #107): effect с 1 dep в scope ≤ 400 B (сейчас 902), signal + subscribe() ≤ 200 B (сейчас 369), Scope без disposers ≤ 140 B (сейчас 297). bench.html — новая метрика «heap per row» (performance.memory при --enable-precise-memory-info): строка с двумя ${() => row.value.x} ≤ 1100 B (сейчас 2032), «create 10000» ≤ 145 мс (сейчас 168 в lens-бенче, 142 в bench.html) за счёт меньшего числа аллокаций. test.html: заменить три assert на a.subs.size (:2121-2126) на dev.subsOf(a).length; все секции Effect/Scope/list/show/reactive зелёные; stats().effects/scopes не меняются; dev.inspect()/graph() показывают те же deps.

**Источники:** V8: рост элементов JSObject::NewElementsCapacity = old + old/2 + 16 (первый push в [] → capacity 17); Preact Signals Node (одно ребро = один объект ~48 B, без Set), alien-signals Link; Svelte 5 внутренности (`reactions: null` inline, массивы вместо Set); Vue 3.5 «reactivity: −56% memory» (версии + двусвязные списки вместо Set<Dep>); DIAMONDS-2 #107 (цель effect ≤ 350 B, «не достигнута из-за двух массивов capacity 17»).

### 💎 #9 — _endTrack за O(n): массовый сдвиг зависимостей без квадратичного скана

**Impact:** 3 · **Effort:** S · **Size:** +40 B gzip в ядре

**Сейчас:** _track при несовпадении позиции кладёт вытесненный источник в obs._evict (aegis_full.js:217); _endTrack (:225-237) для каждого вытесненного и каждого хвостового источника зовёт _unsubIfGone (:239-242), который линейно ищет его среди n живых deps → O(evicted × n). При сдвиге порядка чтения на одну позицию (unshift/sort/filter элементов reactive-массива, _deepRead в $subscribe/history() после вставки в начало, f.array().prepend) вытесняется КАЖДАЯ позиция. Замер node на aegis_full.js: effect над 1000 сигналами, 50 запусков — стабильный порядок 1.37 мс, сдвинутый 27.6 мс (20×); 5000 сигналов, 10 запусков — 0.75 мс против 140 мс (187×, 14 мс на один запуск); при 10k → ~56 мс на запуск, что уже дольше самого рендера.

**Предложение:** Пороговая стратегия: при ≤ 8 сменах зависимостей (типичный effect с условным чтением) — нынешний линейный скан без аллокаций; при большем числе вытеснений/хвоста — один Set живых источников и проверка членства за O(1): суммарно O(n) вместо O(n²), одна аллокация Set только в патологическом случае. Инвариант «источник отписывается, только если его нет ни на одной живой позиции» сохраняется.

**Алгоритм:**

```js
function _endTrack(obs) {
    const deps = obs._deps;
    if (!deps) return;
    const n = obs._n, ev = obs._evict, tail = deps.length - n;
    if (!ev && !tail) return;                                    // стабильный запуск — ноль работы
    if ((ev ? ev.length : 0) + tail <= 8) {                       // 1–2 смены зависимостей: линейный скан, как сейчас
        for (let i = n; i < deps.length; i++) _unsubIfGone(obs, deps[i], deps, n);
        deps.length = n; obs._vers.length = n;
        if (ev) { obs._evict = null; for (const s of ev) _unsubIfGone(obs, s, deps, n); }
        return;
    }
    // массовый сдвиг (unshift/sort/filter в reactive-массиве): одно множество живых источников — O(n) вместо O(n²)
    const gone = deps.splice(n); obs._vers.length = n;
    const live = new Set(deps);
    for (let i = 0; i < gone.length; i++) if (!live.has(gone[i])) _delSub(gone[i], obs);
    if (ev) { obs._evict = null; for (let i = 0; i < ev.length; i++) if (!live.has(ev[i])) _delSub(ev[i], obs); }
}
// (при едином массиве из #2 — шаг 2: live добавляет deps[i] для чётных i, splice(n) режет по слоту)
```

**API:**

```js
Без изменений публичного API; внутренняя функция _endTrack. Опционально в stats() (dev): evictions — счётчик массовых сдвигов для диагностики «effect перечитывает коллекцию в другом порядке».
```

**Критерий:** test.html, section('_endTrack: сдвиг зависимостей без O(n²)'): const N = 2000, sigs = Array.from({ length: N }, (_, i) => signal(i)); let off = 0; sc.run(() => effect(() => { for (let i = 0; i < N; i++) sigs[(i + off) % N].value; })); t0 = performance.now(); for (r < 20) { off++; sigs[0].value = r + 1; } assert('20 сдвигов × 2000 deps < 40 мс', performance.now() - t0 < 40) — сейчас ≈ 20 × (2000²/…) > 200 мс; assert('после сдвигов у каждого сигнала ровно один подписчик', sigs.every(s => dev.subsOf(s).length === 1)); sc.dispose(); assert('dispose отписывает все', sigs.every(s => dev.subsOf(s).length === 0)). Бенч node: «effect 5000 deps, сдвинутый порядок ×10» ≤ 3 мс (сейчас 140), стабильный порядок не медленнее 0.75 мс (порог не задействован). Существующая секция FIX H1 «Stale subs» (условная зависимость отписывается) остаётся зелёной.

**Источники:** Preact Signals cleanupSources (пометка version = −1 и один проход по списку — O(deps)); alien-signals purgeDeps/unlink; Angular signals consumerAfterComputation (обрезка producerNode по индексу за O(n)); Milo Mighdoll, «Super Charging Fine-Grained Reactive Performance» (reactively) — сравнение стратегий переподписки.

### 💎 #10 — Coarse-итерация reactive-массивов: deep-версия вместо сигнала на каждый ключ каждого элемента

**Impact:** 4 · **Effort:** M · **Size:** +0.3 KB gzip в §16 (tree-shakeable вместе с reactive())

**Сейчас:** Инструментированные методы итерации (aegis_full.js:4876-4906) трекают одну версию массива (m.version), но затем оборачивают каждый элемент _wrapReactive (:4672) и отдают его callback'у; чтение r.done внутри callback'а под tracking идёт в _objTraps.get → _sigOf(m, target, key, !!_tracking) (:4773) и СОЗДАЁТ Signal на ключ на элемент. Для effect(() => state.rows.filter(r => r.done)) при 100k строк: 100k Signal + 100k signals{} + 100k kinds{} + 100k Set подписчиков + 100 023 записей в _deps одного effect. Замеры node: +236 B/строка за Proxy+meta (нужны для записи) и ещё +291 B/строка за трекинг; первый запуск 36 мс; переключение одного rows[5].done → перезапуск 37 мс (_depsChanged по 100k версий + 100k _track); dispose такого effect — 25 мс (100k Set.delete). Chrome bench.html: «reactive heap delta MB» 61.5, «reactive push ×20» 372 мс. _deepRead (:4739-4743) для $subscribe/history() обходит массивы по индексу — та же лавина сигналов. При этом list(state.rows, …) читает через index-get и трекает только version — структура и содержимое смешаны в одном сигнале. Vue 3.5 ввёл ARRAY_ITERATE_KEY ровно против первой части этой проблемы, но per-key deps для вложенных чтений остались.

**Предложение:** У meta массива появляется вторая ленивая версия deep («что-то внутри изменилось»); version остаётся структурной (length/индексы/порядок). Итерационные методы и _deepRead под tracking читают deep и помечают текущий observer как coarse для этого массива (_tracking._coarse = m). Элементы получают ссылку на родителя (m.up) при оборачивании; в get-ловушке объекта, если у элемента есть массив-предок, чью deep-версию читает текущий observer, сигнал на ключ НЕ создаётся — значение отдаётся напрямую. Любая запись (set/deleteProperty объекта, set/мутаторы массива) после изменения всплывает по цепочке up и инкрементирует deep у всех массивов-предков. Чтения вне итерации (ячейки list(), effect на state.rows[0].label) по-прежнему создают per-key сигналы — для них гранулярность не меняется; reconcile list() не перезапускается от вложенных записей (version не трогается). Объект под двумя родителями: m.up становится массивом родителей, всплытие идёт по всем — корректность сохраняется. Итог: итерация под tracking не аллоцирует ничего сверх proxy+meta, у observer'а 2 зависимости, dispose O(1).

**Алгоритм:**

```js
// meta массива: version — структура, deep — «внутри что-то изменилось» (лениво, только под tracking-итерацией)
function _reactiveArray(arr, up) {
    const m = { proxy: null, version: signal(0, 'reactive:array'), deep: null, up: up || null };
    _metas.set(arr, m);
    return m.proxy = new Proxy(arr, _ARR_HANDLER);
}
const _deepOf = (m) => m.deep || (m.deep = signal(0, 'reactive:deep'));
function _wrapReactive(v, up) {   // третий аргумент reactive(v, undefined, up) — родительская meta вместо true
    if (v === null || typeof v !== 'object' || v[_REACTIVE]) return v;
    if (Array.isArray(v) || _isPlain(v)) return reactive(v, undefined, up || true);
    return v;
}
// _reactiveObject(obj, ropts, nested): m.up = nested && nested !== true ? nested : null;
//   если у уже существующей meta другой родитель: m.up = [].concat(m.up, up)  (shared-объект — всплываем ко всем)
/** есть ли у элемента массив-предок, deep которого трекает текущий observer */
function _coarse(m) {
    for (let x = m.up; x; x = x.up) {
        if (Array.isArray(x)) { for (const p of x) if (_coarse({ up: p }) ) return true; return false; }
        if (x.version && _tracking._coarse === x) return true;
    }
    return false;
}
/** после записи: поднять deep у всех массивов-предков */
function _bubble(m) { for (let x = m.up; x; x = x.up) { if (Array.isArray(x)) { for (const p of x) _bubble({ up: p }); return; } if (x.deep) x.deep.value++; } }
// инструментированные методы итерации (:4876, :4884, :4898, :4903):
_ARR_INSTR[k] = function (cb, thisArg) {
    const t = _rawOf(this), m = _metas.get(t);
    if (m) { m.version.value; if (_tracking) { _deepOf(m).value; _tracking._coarse = m; } }
    const r = _ARR_PROTO[k].call(t, (v, i) => cb.call(thisArg, _wrapReactive(v, m), i, this));
    return (k === 'filter' || k === 'find') ? _wrapReactive(r) : r;
};
// Effect._execute / Computed._recompute: this._n = 0; this._coarse = null;
// _objTraps.get, ветка KIND_DATA (:4772-4774):
//   const sg = _sigOf(m, target, key, !!_tracking && !(m.up && _coarse(m)));
//   return sg ? sg.value : _wrapFor(m, target[key], m);
// _objTraps.set / deleteProperty (:4795-4830): после target[key] = raw → _bubble(m)
// _ARR_HANDLER.set / deleteProperty / мутаторы (:4912-4943): version++ и, если m.deep, deep++; затем _bubble(m)
// _deepRead (:4739): для массивов — v.forEach(x => _deepRead(x, depth + 1)) вместо индексов → $subscribe/history() идут coarse-путём
```

**API:**

```js
Публичный API reactive() не меняется; поведение effects остаётся корректным (filter/map/some/for..of перезапускаются при записи в поле элемента). Новое в dev.inspect(): у зависимостей имя 'reactive:deep'. Документировать в llms.txt: «итерация массива внутри effect — одна зависимость; читайте поля элементов через методы массива или for..of, а не по индексу в цикле, если хотите coarse-режим». Опция для явного контроля не нужна (авто), но при желании reactive(arr, { deep: false }) может отключить всплытие.
```

**Критерий:** bench.html: «reactive heap delta MB» 61.5 → ≤ 30 (с #5 — ≤ 22), «reactive push ×20» 372 → ≤ 300 мс (снимаются 100k _track + 100k version() на запуск; сама proxy-итерация ~17 мс/100k остаётся), dispose effect-фильтра < 1 мс (сейчас 25). node-probe: после effect(() => st.rows.filter(r => r.done)) у узла _deps.length ≤ 4 (сейчас 100 023), прирост heap на трекинг ≤ 5 B/строка (сейчас 291). test.html, section('reactive: coarse-итерация'): (1) effect n = st.rows.filter(r => r.done).length; st.rows[3].done = !st.rows[3].done → n изменилось (перезапуск); (2) list(st.rows, …) — счётчик вызовов renderFn/reconcile не растёт после этого toggle; (3) effect A читает st.rows[0].label, effect B — st.rows[1].label вне итерации; toggle rows[1].done → A и B не перезапускаются, фильтр — да; (4) один объект в двух reactive-массивах: запись через один перезапускает filter-effects над обоими; (5) $subscribe на { rows: 1000 } срабатывает один раз на rows[7].done = true и не создаёт per-key сигналов (dev.inspect: deps ≤ 4). Все секции reactive()/store()/history() зелёные.

**Источники:** Vue 3.5 reactivity: ARRAY_ITERATE_KEY и arrayInstrumentations — одна зависимость на итерацию вместо dep на индекс (PR #9511, skirtle); Vue docs shallowReactive/markRaw («для больших списков»); Svelte 5 $state.raw (документация рекомендует raw для больших массивов — обходной путь, который coarse-режим делает ненужным); MobX observable.shallow/deep; Solid createStore (path-based tracking, per-key); Immer (структурное разделение); Angular signals: linkedSignal/computed над массивами без deep proxy.

### 💎 #11 — Ленивый снимок для $reset: reactive({ rows: 100k }) без structuredClone на входе

**Impact:** 3 · **Effort:** S · **Size:** +0.1 KB gzip в §16 (tree-shakeable); −60 B за упрощение _cloneInitial-цепочки

**Сейчас:** _reactiveObject для верхнего уровня (aegis_full.js:4858) сразу делает m.initial = _cloneInitial(obj) — structuredClone всего дерева ради возможного $reset; вложенные объекты клонируются при первой записи (:4800, :4815), но глубоко (вместе со всем своим поддеревом). Замер node: reactive({ rows: mk(100000) }) — 59 мс и +9.1 MB heap до единого чтения; bench.html «reactive heap delta MB» 61.5 включает эти 9 MB. Типичный серверный сценарий reactive(await res.json()) платит удвоенной памятью за фичу форм; store() (:4176) при этом не клонирует вовсе — непоследовательно. Первая запись в rows[0] сегодня клонирует только строку, но если добавить всплытие к корню (наивный вариант ленивости), первая запись снова стоила бы 59 мс.

**Предложение:** Снимки становятся per-object и мелкими: meta захватывает НЕГЛУБОКУЮ копию своего target ({ ...target } / target.slice()) при первой записи в этот объект/массив — без всплытия и без клонирования поддерева. $reset на корне — рекурсивное восстановление: сначала свой мелкий снимок (если он есть), затем обход текущих значений — каждый вложенный reactive с захваченным снимком восстанавливается сам. Семантика «состояние на момент reactive()» сохраняется (снимок делается до первой мутации каждого объекта), read-only данные не стоят ничего, первая запись в строку клонирует только строку (десятки байт), push в массив — slice() ссылок (100k × 8 B ≈ 0.3 мс). Бонус: identity вложенных объектов после $reset сохраняется (list() по объекту-ключу не перерисовывает строки).

**Алгоритм:**

```js
// мелкий снимок при первой записи в ЭТОТ объект; без всплытия и без глубокого клона
function _capture(m, target) {
    if (m.captured) return;
    m.captured = true;
    m.initial = Array.isArray(target) ? target.slice() : Object.assign({}, target);   // ссылки на вложенные — как есть: у них свои снимки
}
// _reactiveObject (:4855-4862): убрать eager clone; m.target = obj; m.captured = false для любого уровня
// _objTraps.set (:4800) и deleteProperty (:4815): _capture(m, target) вместо локальной проверки
// _ARR_HANDLER.set/deleteProperty и мутаторы (:4912-4943): _capture(m, target) перед мутацией
/** рекурсивное восстановление: свой снимок, затем вложенные reactive со снимками */
function _restore(target, m) {
    if (m.captured) {
        const init = m.initial;
        if (Array.isArray(target)) { target.length = 0; for (let i = 0; i < init.length; i++) target.push(init[i]); m.version.value++; if (m.deep) m.deep.value++; }
        else {
            for (const k of Object.keys(target)) if (!_hasOwn(init, k)) m.proxy && (delete m.proxy[k]);
            for (const k of Object.keys(init)) m.proxy[k] = init[k];             // через proxy → сигналы ключей уведомляются
        }
    }
    for (const k of Object.keys(target)) {                                        // вложенные: у кого есть снимок — восстановить
        const v = target[k]; if (v === null || typeof v !== 'object') continue;
        const cm = _metas.get(v); if (cm && (cm.captured || cm.signals || cm.version)) _restore(v, cm);
    }
}
// _OBJ_SPECIALS.$reset (:4759): (t, m) => () => batch(() => _restore(t, m))
// Отличие от сегодня: Date/Map/Set внутри снимка — по ссылке (их мутации и раньше не отслеживались); $reset не создаёт новых identity
```

**API:**

```js
Публичный API без изменений: state.$reset(). d.ts/JSDoc: «снимок делается лениво при первой записи в каждый объект; $reset восстанавливает состояние на момент reactive(), сохраняя identity вложенных объектов». history() (:4292) не затронут — у него собственный clone.
```

**Критерий:** node --expose-gc / bench.html: reactive({ rows: mk(100000) }) ≤ 1 мс (сейчас 59) и heap Δ < 0.2 MB (сейчас 9.1); первая запись st.rows[0].done = true < 0.1 мс и без роста heap на мегабайты; «reactive heap delta MB» в bench.html минус ≥ 8 MB. test.html, section('reactive: $reset без eager clone'): (1) const s = reactive({ a: { b: 1 }, list: [1], x: 1 }); s.a.b = 2; s.list.push(2); s.$reset(); assert(s.a.b === 1 && s.list.length === 1 && s.x === 1) — вложенная запись без записи в корень восстанавливается; (2) const a0 = s.a; s.a = { b: 9 }; s.a.b = 10; s.$reset(); assert(s.a === a0 && s.a.b === 1); (3) s.list.push(3); s.$reset(); assert(JSON.stringify(s.list) === '[1]'); (4) effect на s.a.b перезапускается при $reset (уведомление через proxy); существующие тесты $reset/$patch/$snapshot в секциях reactive()/#110/#55 зелёные.

**Источники:** Pinia $reset (повторный вызов state-фабрики, без клона); Vue reactive() — снимков не делает; Angular FormControl.defaultValue / FormGroup.reset() — одна копия начального значения на контрол, не всего дерева; Immer — copy-on-write: копируется только изменённый узел; MDN structuredClone / V8 blog о стоимости structured clone на больших графах.

## 🔭 ergonomics-failure-modes

**Линза:** Эргономика и режимы отказа реактивности для разработчика: что путает (чтение .value vs peek, untrack, эффекты с async, потеря владельца, порядок onDispose, writable computed, signal в props островов, reactive() vs signal()), какие ошибки движок сейчас не ловит (см. ERRORS.md E001–E044 и dev-детекторы), какие API-сахары дали бы «падение в успех». Сравни с Svelte 5 runes ($state/$derived/$effect и их предупреждения), Solid, Angular signals (linkedSignal, resource), React Compiler lint.

**Вывод:** Ядро Aegis (aegis_full.js:161–757) — pull-версии, glitch-free, дешёвые узлы — на уровне Preact Signals/Solid 2, а система предупреждений what/why/fix + site + caret-сниппет (E001–E044) по охвату runtime-режимов отказа уже сильнее того, что Svelte 5 даёт компилятором (E019 на text()/show(), E028 зомби, E027 пинг-понг, E016 async effect, E002 запись в computed). Отстаёт модель владения: владелец эффекта — scope, а не запуск (aegis_full.js:485), поэтому effect/computed/on(), созданные внутри эффекта, накапливаются и дублируют работу при каждом перезапуске — проверено в node (4 переключения → 4 живых эффекта, 3 запуска на одну запись); Solid/Svelte/Vue делают вложенное владение автоматически, а сам движок вынужден вручную создавать `new Scope(owner)` в реактивном ребёнке html`` (:2365). Второй провал — асинхронный setup (официально поддержан, :3110): после `await` теряется `_currentScope`, ctx-хелперы `effect/on/html` не привязаны к scope (:3092–3107), и всё созданное после await получает бесполезный E001 и течёт — Vue решает это компилятором (`withAsyncContext`), для zero-build нужен рантайм-эквивалент. Третий — главный footgun сигналов `${count.value}` внутри html`` (первичный API) не ловится вообще, тогда как text()/show() ловятся; аналог Svelte `state_referenced_locally` реализуем без компилятора через кольцо untracked-чтений. Нет function-bindings (Svelte 5.9) — `bind:value` требует Signal (E009), и с reactive()/производными полями остаётся только `$signals`. Есть несколько тихих no-op (watch(plain), запись того же объекта назад, чтение уничтоженного computed).

**Отвергнуто:** 1) LIFO-порядок disposers (как DisposableStack/`using`): Scope.dispose (:827–843) идёт FIFO; смена ломает существующие тесты и рецепты, а ошибки dispose уже ловятся (console.error), выигрыш маргинальный. 2) E001 для computed()/subscribe() вне scope (как Solid «computations created outside a createRoot»): модульные производные (`export const isAdmin = computed(…)`) легитимны и часты, предупреждение Solid известно как раздражающее; проблема async-setup решается привязкой ctx (#2). 3) Запрет записи сигналов внутри effect (Angular allowSignalWrites): Angular убрал его в v19; в Aegis есть 100-раундовый guard (:714) и E027 (:750); ранний детектор «эффект пишет собственную зависимость» шумит на легитимных clamp-паттернах. 4) Vue-style `computed({get,set})` как отдельный API — покрывается `linked()` (:4379) + предлагаемым `lens()`. 5) Автоимена сигналов через захват стека в `signal()`: `_callSite()` (:102) на тысячи сигналов строк списка сделает dev-режим медленным; вместо этого `signals({})` (#6). 6) `AsyncContext.Variable` для `_currentScope` сейчас: TC39 stage 2, `.get()` в горячем пути каждого `_track`; отмечено как будущее направление в #2. 7) Глубокий proxy внутри `signal()` (Svelte $state): `reactive()` уже есть, две модели — осознанный выбор, детектор same-ref (#5) закрывает главный симптом. 8) `$inspect`-аналог: `trace(sig)` (:332), `effect(fn,{trace:true})`, `dev.graph` уже есть. 9) Унификация store() и reactive({shallow}) — вопрос поверхности API, не режим отказа реактивности. 10) `effect.async` с AbortSignal: E016 + resource()/watch(onCleanup) закрывают; добавлять третий async-примитив — размывание. 11) Предупреждение о чтении устаревшего computed после dispose как отдельный бриллиант — слишком мелко, включено в #5.

### 💎 #12 — Владение по запуску: эффект — владелец всего, что создано в его теле

**Impact:** 5 · **Effort:** M · **Size:** +0.3 KB gzip в ядре (aegis.core.js 6.1 → ~6.4 KB), не tree-shakeable — это семантика Effect

**Сейчас:** Effect._execute (aegis_full.js:480–508) ставит `_currentScope = this._owner` (:485) — scope, а не текущий запуск. Всё, что тело эффекта создаёт (`effect()`, `computed()` через `_currentScope.onDispose` :438/:542, `on()`/`interval()`/`observe()` через `_scoped` :920–926, `resource()` :3860), регистрируется на scope компонента и живёт до его смерти, а перезапуск эффекта создаёт дубликат. Проверено в node: `effect(() => { if (open.value) effect(() => n.value) })` после 4 переключений — 4 живых эффекта (stats().effects), одна запись `n` → 3 запуска внутреннего. Слушатели `on()` внутри эффекта множатся, обработчик срабатывает N раз. Сам движок знает о проблеме и обходит её вручную: реактивный ребёнок html`` создаёт `new Scope(owner)` на каждый запуск (:2365), list — `new Scope(owner,'list:row')` (:2828), show — scope на ветку (:2613). Пользовательский код такого костыля не имеет; никакой E-код это не ловит.

**Предложение:** Сделать Effect duck-type Scope: `parent` → `_owner`, ленивые `children`/`_disposers`, `run()`, `onDispose()`. В `_execute` ставить `_currentScope = this`. `_runCleanup` перед каждым перезапуском и при dispose: сначала дети-scope, затем disposers, затем возвращённый cleanup. Семантика Solid/Svelte: «созданное в теле эффекта живёт до следующего запуска». `onDispose(fn)` внутри эффекта становится эквивалентом возврата cleanup (как Solid onCleanup). `provide()` внутри эффекта попадает в `_ctx` эффекта, `inject()` идёт вверх через `parent` без изменений; `_scopePath` начинает печатать `effect:name ‹ component:…` в Where. Побочный бонус: реактивный ребёнок :2355–2395 может убрать ручной `new Scope(owner)`. Escape hatch для намеренно долгоживущего: `runWithOwner(getOwner().parent, () => on(...))`. `_inspectScope` (:970) рекурсивно проходит `node._disposers`, чтобы devtools видели вложенные эффекты.

**Алгоритм:**

```js
class Effect {
    constructor(fn, name, owner, trace, lane) {
        /* …как сейчас… */
        this.children = null; this._disposers = null; this._ctx = null; this.el = null; this._errHandlers = null;
    }
    get parent() { return this._owner; }                 // inject()/provide()/_scopePath идут вверх как по Scope
    get name() { return 'effect:' + this._name; }
    run(fn) { const prev = _currentScope; _currentScope = this; try { return fn(); } finally { _currentScope = prev; } }
    /** всё, что создано в теле запуска, живёт до следующего запуска (или dispose) */
    onDispose(fn) {
        if (this._disposed) { fn(); return _noop; }
        (this._disposers || (this._disposers = new Set())).add(fn);
        return () => { if (this._disposers) this._disposers.delete(fn); };
    }
    _runCleanup() {
        const kids = this.children, ds = this._disposers, c = this._cleanup;
        this.children = null; this._disposers = null; this._cleanup = null;
        if (kids) for (const k of kids) k.dispose();
        if (ds) for (const d of ds) { try { d(); } catch (e) { console.error(`[Aegis] cleanup error in effect "${this._name}":`, e); } }
        if (c) { try { c(); } catch (e) { console.error(`[Aegis] cleanup error in effect "${this._name}":`, e); } }
    }
    _execute() {
        this._runCleanup();
        /* … */
        _currentScope = this;          // было: this._owner (:485)
        /* … */
    }
}
// Scope.dispose (:838–840) уже делает p.children.delete(this) — работает с Effect как родителем.
// _dispatchError(obs._owner, e) (:737) — без изменений: ошибки идут в scope-цепочку.
// _inspectScope: collect(scope) → для d._node с _disposers — collect(d._node).
```

**API:**

```js
// Публичная сигнатура effect() не меняется. Уточняются контракты (aegis.d.ts):
export function effect(fn: () => void | (() => void), nameOrOpts?: string | EffectOptions): () => void;
// Документируемая семантика: effect/computed/on/interval/observe/resource/onDispose, созданные внутри тела,
// уничтожаются перед каждым перезапуском и при dispose (как Solid createEffect / Svelte $effect).
export function getOwner(): Scope | null;      // внутри эффекта возвращает владельца-запуск; .parent — scope компонента
// Namespaced escape hatch для долгоживущего внутри эффекта:
runWithOwner(getOwner().parent, () => on(window, 'resize', h));
```

**Критерий:** test.html, секция 'Effect — владение по запуску': `const sc = createScope(); const open = signal(true), n = signal(0); let inner = 0, clicks = 0; const btn = document.createElement('button'); sc.run(() => effect(() => { if (open.value) { effect(() => { n.value; inner++; }); on(btn, 'click', () => clicks++); onDispose(() => log.push('cleanup')); } }));` → после `open.value=false; open.value=true;` ×2: `stats().effects === 2` (сейчас 5), `inner=0; n.value++` → `inner === 1` (сейчас 3), `btn.click()` → `clicks === 1`, `log.length === 4` (cleanup перед каждым перезапуском). `inject()` внутри вложенного эффекта находит `provide()` компонента. Регрессия: весь существующий сьют (~770) зелёный в Chrome и Firefox headless; `dev.graph()` и `dev.inspect()` показывают вложенные эффекты. Бенч: 10k `text(el, () => s.value)` создание/обновление — без замедления >3 % (поля инициализируются null, Set — лениво).

**Источники:** Solid `createEffect`/`onCleanup` — owner = computation, вложенные computations уничтожаются при перезапуске (S.js «computation owner tree»); Svelte 5 `$effect` teardown вложенных эффектов и `$effect.root`; Vue `effectScope`/`onScopeDispose`, `watchEffect(onCleanup)`; Angular `effect()` + `onCleanup`; Solid 2.0 design notes «ownership graph».

### 💎 #13 — Async setup без потери владельца: ctx-хелперы привязаны к scope компонента, E001 подсказывает про await

**Impact:** 4 · **Effort:** S · **Size:** +0.2 KB gzip (одна обёртка `_bindCtx` на component()/element()); tree-shake не применим, но вне ядра

**Сейчас:** component() поддерживает async setup (aegis_full.js:3110: `api.then(r => scope.run(() => place(r)))`) и errorBoundary тестирует его (test.html:1370). Но `_currentScope` восстанавливается только для `place(r)`, а не для кода после `await`: `effect`, `computed`, `on`, `html`, `show`, `list` в ctx (:3092–3107) — сырые модульные функции, привязаны только `onDispose`/`onError` (:3105–3106). Шаблон `const data = await load(); return html\`<p>${() => data.title}</p>\`` строится вне scope → каждая функция-привязка получает E001 «Wrap in component(...)» (:530–535) — пользователь и так внутри component() — и никогда не уничтожается при destroy(el). `on(el,…)` после await через `_scoped` (:920) молча не регистрируется — утечка без предупреждения. Тот же дефект в element() (:3312–3316). Спасение `runWithOwner(getOwner(), …)` требует знать про проблему заранее.

**Предложение:** В component()/element() оборачивать функции ctx, чувствительные к владельцу, в `own(f)`: если `_currentScope !== scope` и scope жив — выполнить под `scope.run`. Деструктурированные из ctx `{ effect, on, html, show, list, computed, when, interval, … }` продолжают работать после любого `await` — «падение в успех». Дополнительно E001: если в момент предупреждения `_components.size > 0` или есть pending-острова, добавить в fix строку «After an `await` in setup the scope is lost: use the helpers from ctx (they stay bound) or runWithOwner(getOwner(), …)». В `_ctxProxy` (dev) — не менять. Задел на будущее: при наличии `globalThis.AsyncContext` можно хранить `_currentScope` в `AsyncContext.Variable` (тогда даже модульные импорты переживают await); пока — только ctx.

**Алгоритм:**

```js
/** Привязать функции ctx к scope компонента: после await в setup _currentScope потерян, а ctx — нет */
const _OWNED = ['effect', 'computed', 'on', 'delegate', 'bind', 'text', 'attr', 'cls', 'style', 'clsMap', 'styleMap', 'html', 'show', 'list', 'when', 'selector', 'provide', 'inject', 'interval', 'timeout', 'observe', 'resize', 'mutate', 'debounced', 'throttled', 'poll'];
function _bindCtx(ctx, scope) {
    for (const k of _OWNED) {
        const f = ctx[k];
        if (typeof f !== 'function') continue;
        ctx[k] = function (...a) {
            if (_currentScope === scope || scope._disposed) return f.apply(this, a);
            return scope.run(() => f.apply(this, a));   // после await: вернуть владельца
        };
    }
    return ctx;
}
// component() (:3092): return setup(_ctxProxy(_bindCtx({ el, slot, signal, computed, effect, … }, scope)));
// element() (:3312): const ctx = _ctxProxy(_bindCtx({ el, props, … }, scope));
// E001 (:530): fix: `Wrap in component(el, ({ effect }) => …) or scope.run(() => effect(...)).` +
//   (typeof _components !== 'undefined' && _components.size ? ' After an await in setup the scope is lost — use ctx helpers (they stay bound) or runWithOwner(getOwner(), …).' : '')
// html тоже в списке: html`` с функциями-детьми и attach() регистрирует эффекты на _currentScope (:2356, :1937).
```

**API:**

```js
// Сигнатуры ctx не меняются; уточняется контракт в aegis.d.ts SetupContext:
/** Хелперы ctx привязаны к scope компонента и остаются валидными после `await` в async setup */
interface SetupContext { effect: typeof effect; on: typeof on; html: typeof html; /* … */ }
// Пример, который теперь «просто работает»:
component(el, async ({ effect, html, on }) => {
    const user = await api.get('/me');
    on(window, 'online', sync);                 // снимется при destroy(el)
    return html`<p>${() => user.name}</p>`;      // без E001, привязки умирают со scope
});
```

**Критерий:** test.html: `const codes=[]; onWarn(w=>codes.push(w.code)); let ran=0; const api = component(host, async ({ effect, on, html }) => { await wait(1); effect(() => { s.value; ran++; }); on(window, 'resize', h); return html\`<b>${() => s.value}</b>\`; }); await api;` → `!codes.includes('E001')`, `host.textContent === '1'`; `s.value = 2` → `host.textContent === '2' && ran === 2`; `destroy(host); s.value = 3` → `ran === 2`, `stats().effects` вернулся к исходному, `window.dispatchEvent(new Event('resize'))` не вызывает `h`. Отдельно: сырой `effect()` из импорта после await всё ещё даёт E001, и текст fix содержит «await».

**Источники:** Vue 3 `<script setup>` + top-level await: компилятор оборачивает в `withAsyncContext` для восстановления `currentInstance` (RFC #227); Solid `runWithOwner`/`getOwner` (та же ручная модель, но с предупреждением «computations created outside a createRoot»); TC39 AsyncContext (stage 2, Chrome origin trial) — `AsyncContext.Variable` как будущий носитель `_currentScope`; React 19 `use()` — асинхронность в рендере с сохранением владельца.

### 💎 #14 — E045 «снимок вместо сигнала»: `${count.value}` в html`` ловится через кольцо untracked-чтений (аналог Svelte state_referenced_locally)

**Impact:** 4 · **Effort:** S · **Size:** +0.05 KB в ядре (ветка в getter Signal), +0.25 KB gzip проверка в html`` (полная сборка; dev-only код, в prod ветка мёртвая через _devCache)

**Сейчас:** E019 ловит потерю реактивности для `text(el, count.value)` (`_staticWarn`, aegis_full.js:2417–2424), `show(count.value > 3)` (:2557) и эффекта без deps (:547). Но главный API — html`` — не защищён: `html\`<b>${count.value}</b>\`` вставляет число (`_insertDynamic` :2328 → `marker.data`), `class=${flag.value ? 'on' : ''}` — статичную строку; ни одного предупреждения. Это самый частый footgun сигнал-движков (Svelte 5 завёл для него компиляторное `state_referenced_locally`, Preact Signals — ESLint-правило), а в zero-build линтера нет. Значения `${}` вычисляются до вызова тега, поэтому «просто проверить тип» невозможно — нужен след чтения.

**Предложение:** В dev getter Signal при `_tracking === null` пишет `{ s, v }` в кольцо `_untracked` (16 записей). В `_instantiate` (:1908–1929), где уже выставлен `_curValueIndex` для caret-сниппета, для примитивных значений в текстовой позиции (kind 2) и одиночных примитивных атрибутов (kind 0, `single`, type не event/prop/model) искать `Object.is(u.v, v)` в кольце → E045 с именем сигнала и подсказкой «${count} или ${() => …}; для намеренного снимка — .peek()». `peek()` не идёт через getter — намеренные снимки не шумят (это и есть семантическая граница value/peek). Кольцо очищается после каждого html`` и по microtask, чтобы чтения в обработчиках событий не «прилипали». Исключить boolean-значения и `''`/`null` из сравнения ради низкого false-positive; дедуп по site+index через onceKey.

**Алгоритм:**

```js
// ядро (dev): последние сигналы, прочитанные вне tracking
let _untracked = null, _untrackedFlush = false;
function _noteUntracked(s) {
    const r = _untracked || (_untracked = []);
    if (r.length >= 16) r.shift();
    r.push({ s, v: s._value });
    if (!_untrackedFlush) { _untrackedFlush = true; queueMicrotask(() => { _untrackedFlush = false; _untracked = null; }); }
}
class Signal { get value() { if (_tracking) _track(this); else if (_devCache === true) _noteUntracked(this); return this._value; } }
// Computed.get value (:361): та же ветка после _recompute.

// html`` (полная сборка): _instantiate → для kind 2 и одиночных атрибутов
function _snapshotCheck(v, where) {
    if (!_untracked || v == null || v === '' || typeof v === 'boolean' || typeof v === 'object' || typeof v === 'function') return;
    for (let i = _untracked.length - 1; i >= 0; i--) {
        const u = _untracked[i];
        if (!Object.is(u.v, v)) continue;
        const nm = u.s._name || 'count';
        _warn('E045', {
            what: `html\`\`: \${${nm}.value} in ${where} is a snapshot — the ${typeof v} is inserted once and never updates.`,
            why: '.value read outside an effect returns the current value; the template receives a plain value and cannot subscribe.',
            fix: `Pass the signal itself (\${${nm}}) or a getter (\${() => ${nm}.value > 3 ? 'a' : 'b'}). A deliberate one-time snapshot: \${${nm}.peek()}.`,
            token: '.value',
        }, 'snapshot:' + (_curSite ? _curSite.short : '') + ':' + _curValueIndex);
        return;
    }
}
// в _instantiate: if (_devCache) { if (part.kind === 2) _snapshotCheck(values[part.index], 'text'); else if (part.kind === 0 && part.single && (part.type === 'attr' || part.type === 'bind')) _snapshotCheck(values[part.indices[0]], `attribute ${part.name}`); }
// после цикла: _untracked = null;   // чтения при построении этого шаблона не должны влиять на следующий
```

**API:**

```js
// Новых экспортов нет. ERRORS.md:
// | E045 | `${count.value}` / `class=${flag.value ? … : …}` inside html`` — a snapshot, never updates. | Pass `${count}` or `${() => …}`; use `.peek()` for a deliberate snapshot. |
// onWarn(w) получает { code: 'E045', site, snippet } с кареткой под конкретным ${} (существующая инфраструктура _curValueIndex/_snippet).
```

**Критерий:** test.html, секция 'предупреждения — E045 снимок в html``': `dev.resetWarnings(); const codes=[]; const off=onWarn(w=>codes.push(w.code)); const count = signal(7,'count'), on_ = signal(true,'on'); html\`<b>${count.value}</b>\`;` → `codes.includes('E045')`; `const n=codes.length; html\`<b>${count.peek()}</b><i class=${() => on_.value ? 'x' : ''}>${count}</i>\`; html\`<b>${7}</b>\`;` (без предшествующего чтения) → `codes.length === n`; `html\`<span title=${count.value}></span>\`` → E045 с where 'attribute title'; в strict-режиме AegisWarning имеет `code === 'E045'`. Прогон полного сьюта и demo/admin.html без ложных E045 (проверка по onWarn в тестах: список кодов без E045 в существующих секциях).

**Источники:** Svelte 5 предупреждение `state_referenced_locally` («state is referenced locally — it will not be reactive») и `$state.snapshot`; eslint-plugin-react-hooks / React Compiler lint (reads of stale values); Preact Signals docs «pass the signal itself into JSX for text bindings»; Solid docs «don't destructure props / read signal at top level»; TC39 Signals proposal — `Signal.State#get()` vs `untrack` как явная граница.

### 💎 #15 — lens() и function-bindings для bind: — двусторонняя привязка к любому геттеру/сеттеру (Svelte 5.9)

**Impact:** 4 · **Effort:** S · **Size:** +0.15 KB gzip (общий `_writable` для linked() и lens(), ветка в bind/_applyAttrBinding); tree-shakeable как отдельный экспорт

**Сейчас:** `bind:value` требует именно Signal: `_applyAttrBinding` type 'model' (aegis_full.js:2172–2180) даёт E009 для всего, что не isSignal; `bind()` (:2517–2518) бросает Error. Для reactive()-объектов остаётся `bind:value=${state.$signals.city}` — `$signals` (:4737) эагерно создаёт сигналы на все ключи и выглядит как внутренность; для производных полей (цена в тенге ↔ в тиынах, °C ↔ °F, `Date` ↔ ISO-строка, элемент массива `items[i].qty`) двусторонней привязки нет вовсе — пишут effect + on('input') руками, теряя авто-batch и порядок. `linked()` (:4379–4404) — единственный writable-derived, но его запись живёт до смены источника, а не транслируется в источник; его объект-обёртка (:4391–4403) не имеет `update()` и `_name` (dev.graph показывает 'signal').

**Предложение:** Экспорт `lens(get, set, name?)` и `lens(obj, key)` — writable-сигнал, чтение которого — computed(get), запись — `set(v)` (транслируется в источник, никакого локального состояния). `bind:value` и `bind()` принимают кортеж `[get, set]` (function bindings Svelte 5.9) и любой writable (`'value' in v && set-аксессор`). Общий помощник `_writable(out, setter, dispose, name)` заменяет литерал в linked() — оба получают `update()`, `_name`, `[SIGNAL]`, `toJSON`. E009 расширяется: «got a function — pass [get, set] or lens(get, set)».

**Алгоритм:**

```js
/** Writable-обёртка над computed: единая для linked() и lens() */
function _writable(out, setter, disposeExtra, name) {
    return {
        [SIGNAL]: true, _name: name || out._name,
        get value() { return out.value; },
        set value(v) { setter(v); },
        update(fn) { setter(fn(out.peek())); },
        peek() { return out.peek(); }, version() { return out.version(); },
        subscribe(fn) { return out.subscribe(fn); },
        get subs() { return out.subs; }, set subs(v) { out.subs = v; },
        dispose() { out.dispose(); if (disposeExtra) disposeExtra(); },
        toJSON() { return out.peek(); }, toString() { return `${name || 'Writable'}(${_short(out.peek())})`; },
    };
}
/**
 * Двусторонняя линза: чтение — computed(get), запись — set(v) в источник.
 *   bind:value=${lens(() => cents.value / 100, v => cents.value = Math.round(v * 100))}
 *   bind:value=${lens(state.address, 'city')}          // reactive()/store()/plain по ключу
 */
export function lens(get, set, name) {
    if (typeof get === 'object' && get !== null) { const obj = get, key = set; name = name || `lens:${String(key)}`; get = () => obj[key]; set = (v) => { obj[key] = v; }; }
    const out = computed(get, name || 'lens');
    return _writable(out, (v) => batch(() => set(v)), null, name);
}
// linked(): return _writable(out, (v) => { overrideVersion = src.version(); override.value = v; }, () => src.dispose(), _nm(nameOrOpts) || 'linked');
// bind(el, sig) (:2517): if (Array.isArray(sig) && typeof sig[0] === 'function') sig = lens(sig[0], sig[1]);
//                      if (!isSignal(sig)) throw …
// _applyAttrBinding model (:2172): const v0 = values[indices[0]]; const v = Array.isArray(v0) && typeof v0[0] === 'function' ? lens(v0[0], v0[1]) : v0; if (!isSignal(v)) E009 (текст fix дополнить: «or bind:value=${[() => x, v => x = v]}»)
```

**API:**

```js
export function lens<T>(get: () => T, set: (v: T) => void, name?: string): Signal<T>;
export function lens<O extends object, K extends keyof O>(obj: O, key: K, name?: string): Signal<O[K]>;
// html``:  bind:value=${lens(...)}   |   bind:value=${[() => state.city, v => state.city = v]}
// bind(el, lens(...)) / bind(el, [get, set])
// HtmlValue расширяется: | [() => unknown, (v: any) => void]
// linked() возвращает тот же Writable-контракт: появляется update(fn), имя для dev.graph/E-сообщений.
```

**Критерий:** test.html, секция 'lens() и function bindings': `const cents = signal(250); const inp = html\`<input type=number bind:value=${lens(() => cents.value / 100, v => cents.value = Math.round(v * 100))}>\`.firstChild;` → `inp.value === '2.5'`; `inp.value = '3.75'; fire(inp,'input')` → `cents.value === 375`; `cents.value = 100` → `inp.value === '1'`. `const st = reactive({ addr: { city: '' } }); const i2 = html\`<input bind:value=${[() => st.addr.city, v => st.addr.city = v]}>\`` → ввод 'Almaty' → `st.addr.city === 'Almaty'`; `st.addr.city = 'Astana'` → `i2.value === 'Astana'`; `lens(st.addr, 'city')` — то же; `bind:value=${() => x.value}` → E009 с упоминанием `[get, set]`; `linked(...)` имеет `update` и `String(l)` начинается с 'linked('. Размер: `gzip(aegis.min.js)` вырос ≤ 0.2 KB.

**Источники:** Svelte 5.9 function bindings `bind:value={() => value, (v) => value = v}` (RFC «function bindings», sveltejs/svelte#9241); Vue `computed({ get, set })` + `v-model` c `get/set` модификаторами; Angular Signal Forms (`Field`/`linkedSignal` write-through); Solid `createWritableMemo` (solid-primitives/memo); optics/lenses (Monocle, partial.lenses) как источник имени и семантики get/set-пары.

### 💎 #16 — Три тихих no-op → предупреждения: watch(plain), запись того же объекта назад, чтение уничтоженного computed

**Impact:** 3 · **Effort:** S · **Size:** +0.25 KB gzip (dev-ветки; E046/E047 в ядре ≈ 0.1 KB, E048 в полной сборке)

**Сейчас:** (а) `watch(source)`/`until(source)` с не-сигналом и не-функцией превращают источник в константу (`() => source`, aegis_full.js:4085–4087, :4135) — `watch(state.count, cb)` для reactive() передаёт число и никогда не сработает; проверено в node (fired 0). Vue здесь печатает «Invalid watch source». (б) `sig.value = sig.value` после `sig.value.push(x)` — `Object.is` (:301) молча гасит запись; это стандартная «попытка починить» невидимую мутацию, проверено (0 перезапусков). (в) После `scope.dispose()` computed теряет подписки (`_unsubscribe` :379), но `_dirty` остаётся false — `c.value` возвращает замороженное значение навсегда (проверено: после `s2=5` computed остаётся 2), без единого предупреждения — типичная утечка замыкания в таймер/обработчик после destroy(el).

**Предложение:** E046: в `watch()`/`until()` — если источник не сигнал/функция и является примитивом или reactive-proxy → предупреждение с fix `watch(() => state.count, …)`. E047 (dev): в Signal setter — если `v === this._value`, `typeof v === 'object'`, `v !== null` и имя сигнала без ':' (пользовательский, не resource:data со structural sharing) → «same reference written back — mutations inside are invisible; use update(a => [...a, x]), reactive([]), or { equals: false }». E048 (dev): в Computed.get value/peek — если `_disposed` → «computed read after its scope was disposed — the value is frozen» с именем и scope-путём (взять `_scopePath` владельца при dispose — сохранить строку в `_diedIn`).

**Алгоритм:**

```js
// (а) watch/until
function _sourceGetter(source, api) {
    if (isSignal(source)) return () => source.value;
    if (typeof source === 'function') return source;
    if (_dev() && (source === null || typeof source !== 'object' || source[_REACTIVE])) _warn('E046', {
        what: `${api}() got a ${source && source[_REACTIVE] ? 'reactive object' : typeof source} as source — it will never fire.`,
        why: 'Only a signal or a getter can be observed; a plain value was read once at the call site.',
        fix: `${api}(() => state.count, cb) or ${api}(sig, cb); for a whole reactive object use ${api}(() => state.$snapshot(), cb).`,
    });
    return () => source;
}
// (б) Signal setter (:301)
set value(v) {
    /* E002 как сейчас */
    if (this._eq(this._value, v)) {
        if (_devCache === true && v !== null && typeof v === 'object' && v === this._value && !(this._name && this._name.includes(':'))) _warn('E047', {
            what: `signal "${this._name || '?'}": the same object reference was written back — nothing happens.`,
            why: 'Signals compare by identity (Object.is); mutations inside the object (push/splice/prop =) are invisible.',
            fix: 'sig.update(a => [...a, x]) / sig.value = { ...o, k } — or hold the object in reactive(), or signal(v, { equals: false }).',
        }, 'sameRef:' + (this._name || ''));
        return;
    }
    /* … */
}
// (в) Computed (:361, :367)
dispose() { /* … */ if (_devCache) this._diedIn = _scopePath(_currentScope) || 'scope'; }
get value() {
    if (this._disposed && _devCache === true) _warn('E048', { what: `computed "${this._name || '?'}" read after dispose (${this._diedIn}) — its value is frozen.`, why: 'dispose() unsubscribed it from its sources; it will never recompute.', fix: 'Do not keep computeds in closures that outlive the component (timers, global handlers); read them inside the scope or recreate.' }, 'dead:' + (this._name || ''));
    if (this._dirty) this._recompute(); _track(this); return this._value;
}
```

**API:**

```js
// Новых экспортов нет. ERRORS.md:
// | E046 | `watch()`/`until()` got a plain value or a reactive object as source — it never fires. | `watch(() => state.count, cb)` or pass the signal. |
// | E047 | The same object reference was written back into a signal — inner mutations are invisible. | `sig.update(a => [...a, x])`, `reactive()`, or `{ equals: false }`. |
// | E048 | A computed was read after its scope was disposed — the value is frozen. | Do not keep computeds in closures that outlive the component. |
```

**Критерий:** test.html, секция 'тихие no-op — E046/E047/E048': `const st = reactive({ count: 0 }); watch(st.count, () => {})` → E046; `watch(() => st.count, …)` и `watch(sig, …)` → без E046; `until(st)` (reactive-proxy) → E046. `const list = signal([1], 'list'); list.value.push(2); list.value = list.value;` → E047 ровно один раз (дедуп); `resource()`-сигнал `resource:data` при structural sharing (тот же ref после refresh) → E047 нет (прогон секции '💎 #29' с onWarn-фильтром). `const sc = createScope(); let c; sc.run(() => { c = computed(() => s.value * 2, 'dbl'); c.value; }); sc.dispose(); s.value = 5; c.value` → E048 с текстом, содержащим 'dbl'; в strict — AegisWarning.code === 'E048'. Полный сьют без новых предупреждений.

**Источники:** Vue 3 warn «Invalid watch source … A watch source can only be a getter/effect function, a ref, a reactive object, or an array»; Svelte 5 `state_referenced_locally` и `$state` deep proxy (мутации видимы); Preact Signals FAQ «why doesn't my array update? — signals compare by identity»; Solid `createStore` vs `createSignal` docs; Angular `computed` docs — «destroyed injector → computed frozen» (ошибки после destroy).

### 💎 #17 — signals({}) — именованные сигналы из ключей: каждое предупреждение, граф и трасса называют переменную

**Impact:** 3 · **Effort:** S · **Size:** +0.1 KB gzip, tree-shakeable (отдельный экспорт)

**Сейчас:** Все dev-сообщения ядра опираются на `_name`: E002 `Signal "?" written inside computed "?"` (aegis_full.js:296), trace `signal "?" set` (:302), `_changedDeps` → 'signal' (:262), `dev.graph` → узлы `signal` (:953), `_inspectScope` пропускает безымянные (:977 `if (x._name …)`), `linked`/`selector` дают имена только служебные. Пользователь пишет `const count = signal(0)` и все инструменты показывают «?». Svelte/Solid получают имена от компилятора, у Aegis компилятора нет; захват стека в `signal()` (`_callSite`) для тысяч сигналов строк списка неприемлем по цене. Сейчас единственный способ — второй аргумент `signal(0, 'count')`, который никто не пишет.

**Предложение:** Экспорт `signals(obj)`: `const { count, name } = signals({ count: 0, name: '' })` → `{ count: signal(0, 'count'), name: signal('', 'name') }`; опции — `signals(obj, { prefix: 'cart' })` → 'cart.count'. Геттеры в объекте → `computed(get, key)` (как store(), но без proxy и с нативной деструктуризацией); `equals` через `signal(initial, { equals })`-значение? — нет: просто значения; для equals использовать явный `signal()`. Плюс `component()` в dev: ctx.signal получает имя из `data-aegis` компонента как префикс, если имя не задано (`component:counter/signal#3`) — дёшево (счётчик), даёт хотя бы адрес. `scaffold()` (:3240) генерирует `const { count } = signals({ count: data.count })`.

**Алгоритм:**

```js
/**
 * Именованные сигналы из объекта: имена берутся из ключей — для E-сообщений, trace(), dev.graph().
 *   const { count, query } = signals({ count: 0, query: '' });          // signal(0,'count'), signal('','query')
 *   const { items, total } = signals({ items: [], get total() { return items.value.length; } });   // геттер → computed('total')
 */
export function signals(obj, { prefix } = {}) {
    const out = {};
    const descs = Object.getOwnPropertyDescriptors(obj);
    for (const k of Object.keys(descs)) {
        const d = descs[k], nm = prefix ? `${prefix}.${k}` : k;
        out[k] = d.get ? computed(() => d.get.call(out), nm) : signal(d.value, nm);
    }
    return out;
}
// component() dev-адрес для безымянных: в ctx signal: (v, o) => signal(v, o ?? (_dev() ? `${scope.name}#${++n}` : undefined))
// (n — счётчик на компонент; в prod ветка не выполняется, имя undefined как сейчас)
```

**API:**

```js
export function signals<T extends Record<string, unknown>>(obj: T, opts?: { prefix?: string }): { [K in keyof T]: T[K] extends (...a: any[]) => any ? never : Signal<T[K]> };
// геттеры → ReadonlySignal<ReturnType>; ctx.signal(initial) в dev получает имя `component:name#N`, если не задано.
```

**Критерий:** test.html: `const { count, total } = signals({ count: 2, get total() { return count.value * 10; } }); assert(count._name === 'count' && total._name === 'total' && total.value === 20)`; `signals({ a: 1 }, { prefix: 'cart' }).a._name === 'cart.a'`; `dev.resetWarnings(); onWarn(...); computed(() => { count.value = 5; }).value` → сообщение E002 содержит `"count"`; `dev.graph(scope)` содержит `count -->`; внутри `component(host, ({ signal }) => { const s = signal(0); … })` в dev `s._name` начинается с 'component:'. Тип-тест в test.html (@ts-check блок): деструктуризация типизируется как Signal<number>.

**Источники:** Svelte 5/Solid — имена из компилятора для devtools; Preact Signals Devtools (`signal.name` option, preactjs/signals#… naming proposal); MobX `observable({ … })` с именами свойств в spy/trace; Angular `signal(0, { debugName })` (v19+); TC39 Signals proposal — `Signal.State(value, { [Symbol.toStringTag] })`/debug name обсуждение; Zustand devtools naming по ключам.

## 🔭 verification-property-tests

**Линза:** Верификация реактивного ядра: property-based и model-based тесты графа сигналов (случайные графы, случайные записи, сравнение с эталонной наивной моделью «пересчитать всё»), инварианты (каждый computed читается не более раза за flush, эффект не видит промежуточных состояний, dispose идемпотентен), детерминированный фаззер как в фазе 5 кэша (см. test.html секцию «кэш фаза 5» и «инварианты»), stress на глубокие цепочки и широкие вееры, тесты на сборку мусора. Принеси конкретные генераторы и оракулы.

**Вывод:** Ядро на «счастливом пути» выдерживает model-based проверку: прототип фаззера (случайные графы 4 сигнала/6 computed/4+ эффекта с динамическими ветками, 2000 сидов × 60 операций = 120 000 операций: записи, batch с ABA, dispose/создание эффектов, чтения снаружи) не нашёл ни одного расхождения с наивной моделью «пересчитать всё» — значения консистентны, ни один computed не считался дважды за flush, subs↔deps согласованы. Здесь Aegis не уступает Preact Signals/Solid, а версионный pull-bailout (aegis_full.js:399, :465) даёт glitch-free минимальные запуски. Отставание — в путях, которых сценарные тесты не касаются: (1) ошибки: computed, бросивший исключение, отписывается от источников (:410), а декоратор ошибки в _flush (:733) сам вызывает _changedDeps → повторный throw из catch — ошибка минует scope.onError/errorBoundary, остальные эффекты раунда остаются с _queued=true навсегда (437/500 сидов фаззера с «ядовитым» значением: onError вызван 0 раз, эффекты мертвы после восстановления); Preact/TC39 Signals кэшируют ошибку и не рвут граф. (2) GC: computed без подписчиков остаётся в subs источника (2000 unowned computed → b.subs.size 2000, FinalizationRegistry собрала 0/2000; после dispose единственного эффекта — тоже 0/2000), тогда как Preact и TC39 `unwatched` отцепляют его. (3) Вложенные эффекты/слушатели накапливаются при каждом перезапуске родителя (3 живых inner-эффекта после 3 запусков) — Solid и Svelte 5 их сносят. (4) Рекурсия push (_notify→_run→_notify) и pull (version→_recompute→_fn): цепочка 5000 computed — RangeError уже в node с дефолтным стеком; alien-signals (Vue Vapor) итеративен. Все четыре дефекта находит один детерминированный фаззер с оракулом — его и предлагается положить в test.html и test-core.mjs.

**Отвергнуто:** • «Каждый computed читается не более раза за flush» как отдельный тест — уже выполняется (фаззер: 0 нарушений на 120k операций); входит инвариантом I4 в предложение 1, отдельного бриллианта не заслуживает.
• Diamond/glitch-free тесты — уже есть (test.html:4127 FIX C1, test-core.mjs «цепочка computed без пересчёта»); фаззер их обобщает.
• Дедупликация повторных непоследовательных чтений в _deps (aegis_full.js:205: чтение b, a, b даёт _deps=[b,a,b]) — лишь лишний version() в _depsChanged, Set subs дедуплицирует; Set-проверка в _track дороже выигрыша. Инвариант «уникальные deps» из фаззера убран осознанно.
• Считать «запуск эффекта при ABA-записи в batch (s=3; s=4 при старом 4)» дефектом — нет: Aegis, Preact и Solid сравнивают версии, а не значения; оракул должен требовать лишь «запуск ⇒ была запись в транзитивный источник». Фиксируется как исполняемая спецификация в предложении 1.
• Замена _MAX_ROUNDS=100 (:189) на счётчик по эффекту — Preact Signals использует тот же лимит 100 итераций batch; линейный каскад из >100 эффектов, пишущих друг другу, — антипаттерн, который и должен падать.
• Стабильный порядок эффектов в раунде по id создания (обнаружено: после динамической переподписки порядок становится E2,E3,E1) — Preact ведёт себя так же; при статических deps порядок естественно = порядку создания, дети создаются после родителей; выигрыш — только отсутствие «зомби-запусков» в редком случае условного чтения родителем. Оставлено метрикой zombieRuns в фаззере, а не изменением ядра.
• Полностью итеративный pull (alien-signals-style) — effort L, переписывает Computed.value/_recompute/_depsChanged; UI-графы глубже 1000 не встречаются. Предложен только итеративный push + dev-предупреждение о глубине.
• Тест на «dispose идемпотентен» — тривиально выполнен (Effect.dispose :509, Computed.dispose :376, Scope.dispose :824 проверяют _disposed); включён в фаззер как операция «повторный dispose», отдельный бриллиант не нужен.

### 💎 #18 — Model-based фаззер графа сигналов с оракулом «пересчитать всё»

**Impact:** 5 · **Effort:** M · **Size:** 0 KB в aegis_full.js (только test.html + test-core.mjs); опционально checkGraph() в aegis-test.js +0.3 KB gzip там, не в ядре

**Сейчас:** Ядро (aegis_full.js:161–760) покрыто только сценарными тестами: Signal/Computed/Effect/Batch (test.html:76–153), diamond (test.html:4127), stale subs (:4161), test-core.mjs — десяток фиксированных графов. Фаззеры в сьюте есть только для кэша (test.html:3142 «инварианты: 300 случайных операций без E044», :3536 очередь/persist/шина). Нет ни одного теста, который случайно комбинировал бы динамические зависимости (_track/_endTrack/_evict, :205–243), dispose внутри flush, вложенные batch и чтения снаружи — именно там сидят дефекты из предложений 2–4, и ни один из них сьют не ловит. Нет и проверки согласованности графа (для каждого obs в src.subs ⇒ src ∈ obs._deps, и наоборот).

**Предложение:** Добавить в test.html секцию «ядро — фаззер графа vs наивная модель» и зеркальный тест в test-core.mjs (node --test, ~100 мс): детерминированный LCG-генератор (тот же 48271, что в кэш-фаззере), генератор случайного графа (сигналы; computed со статической или динамической веткой по чётности «условного» узла; эффекты, читающие 1–3 узла), генератор операций (запись, batch из 3 записей включая ABA, dispose эффекта, повторный dispose, создание эффекта в scope, чтение computed снаружи, untrack-чтение, flush()), оракул — мемоизированный чистый пересчёт по peek() сигналов — и семь инвариантов: I1 консистентность (кортеж, увиденный эффектом, == оракул в момент запуска); I2 необходимость (кортеж изменился ⇒ эффект запустился ровно один раз за flush); I3 нехолостость (запустился ⇒ с прошлого запуска была запись в сигнал); I4 ≤1 вызова fn каждого computed за flush; I5 subs↔deps двунаправленно согласованы, уничтоженные observers отсутствуют во всех subs; I6 детерминизм (тот же seed ⇒ идентичная трасса запусков); I7 канарейка утечек (stats().effects/scopes до и после равны, subs.size источников после dispose scope == 0). При провале — delta-debugging: повторно проигрывать, выбрасывая операции по одной, пока нарушение сохраняется; печатать seed и минимальный лог операций в имени assert.

**Алгоритм:**

```js
// test.html / test-core.mjs — стиль сьюта (LCG как в кэш-фаззере :3200)
const lcg = (seed) => { let s = seed; return () => (s = (s * 48271) % 2147483647) / 2147483647; };
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
function genGraph(seed, { nSig = 4, nComp = 6, nEff = 4 } = {}) {
    const rnd = lcg(seed), nodes = [], comps = [], effs = [], calls = new Map(), viol = [];
    for (let i = 0; i < nSig; i++) nodes.push({ id: 's' + i, kind: 'sig', node: signal(i, 's' + i) });
    const byId = () => new Map(nodes.map(n => [n.id, n]));
    for (let i = 0; i < nComp; i++) {
        const [a, b, c, cond] = [0, 0, 0, 0].map(() => pick(rnd, nodes).id), dyn = rnd() < 0.5, id = 'c' + i;
        const fn = (read) => dyn ? (read(cond) % 2 === 0 ? read(a) + read(b) : read(c) * 3) : read(a) + read(b) - read(cond);   // динамическая ветка → evict/переподписка
        const node = computed(() => { calls.set(id, (calls.get(id) || 0) + 1); return fn(x => byId().get(x).node.value); }, id);
        const e = { id, kind: 'comp', node, fn }; nodes.push(e); comps.push(e);
    }
    const oracle = () => { const m = new Map(), B = byId(); const read = (id) => { if (m.has(id)) return m.get(id); const n = B.get(id); const v = n.kind === 'sig' ? n.node.peek() : n.fn(read); m.set(id, v); return v; }; for (const n of nodes) read(n.id); return m; };
    const scope = createScope('fuzz'); let written = false;
    const mk = () => { const deps = [...new Set([1, 2, 3].slice(0, 1 + Math.floor(rnd() * 3)).map(() => pick(rnd, nodes).id))]; const e = { id: 'e' + effs.length, deps, last: null, alive: true, runsInFlush: 0 };
        scope.run(() => { e.dispose = effect(() => { const B = byId(); const t = e.deps.map(d => B.get(d).node.value), o = oracle(), exp = e.deps.map(d => o.get(d));
            if (t.join() !== exp.join()) viol.push(`I1 ${e.id} saw ${t} expected ${exp}`);
            if (e.last && e.last.join() === t.join() && !written) viol.push(`I3 ${e.id} ran without any write`);
            if (++e.runsInFlush > 1) viol.push(`I2 ${e.id} ran twice in one flush`); e.last = t; }, e.id); });
        effs.push(e); return e; };
    for (let i = 0; i < nEff; i++) mk();
    const checkGraph = () => {
        for (const n of nodes) if (n.node.subs) for (const o of n.node.subs) if (!o._disposed && !(o._deps || []).includes(n.node) && o._src !== n.node) viol.push(`I5 ${n.id}.subs has ${o._name} without back-edge`);
        for (const x of [...comps.map(c => c.node), ...effs.filter(e => e.alive).map(e => e.dispose._node)]) for (const s of x._deps || []) if (!s.subs || !s.subs.has(x)) viol.push(`I5 ${x._name} → ${s._name} missing in subs`);
        for (const e of effs) if (!e.alive) for (const n of nodes) if (n.node.subs && n.node.subs.has(e.dispose._node)) viol.push(`I5 disposed ${e.id} still in ${n.id}.subs`);
    };
    const step = (log) => { const op = rnd(); calls.clear(); for (const e of effs) e.runsInFlush = 0; written = op < 0.6; const before = oracle();
        if (op < 0.4) { const s = pick(rnd, nodes.filter(n => n.kind === 'sig')); const v = Math.floor(rnd() * 6); log.push(`${s.id}=${v}`); s.node.value = v; }
        else if (op < 0.6) { log.push('batch'); batch(() => { for (let j = 0; j < 3; j++) pick(rnd, nodes.filter(n => n.kind === 'sig')).node.value = Math.floor(rnd() * 6); }); }   // ABA возможна нарочно
        else if (op < 0.7) { const e = pick(rnd, effs); log.push('dispose ' + e.id); e.alive = false; e.dispose(); e.dispose(); }   // идемпотентность
        else if (op < 0.8) log.push('new ' + mk().id);
        else if (op < 0.9) { const c = pick(rnd, comps); log.push('read ' + c.id); if (c.node.value !== oracle().get(c.id)) viol.push(`I1 outside read ${c.id}`); }
        else { log.push('flush'); flush(); }
        const after = oracle();   // I2: изменившийся кортеж ⇒ ровно один запуск
        for (const e of effs) if (e.alive && e.last && e.deps.map(d => before.get(d)).join() !== e.deps.map(d => after.get(d)).join() && e.runsInFlush !== 1) viol.push(`I2 ${e.id} tuple changed, runs=${e.runsInFlush}`);
        for (const [id, n] of calls) if (n > 1) viol.push(`I4 ${id} computed ${n}×`);
        checkGraph(); };
    return { step, viol, scope, nodes };
}
function fuzzGraph({ seeds = 300, ops = 60, seed: only } = {}) {
    const fails = [];
    for (let seed = only || 1; seed <= (only || seeds); seed++) {
        const e0 = stats().effects, s0 = stats().scopes;
        const g = genGraph(seed), log = [];
        for (let k = 0; k < ops && !g.viol.length; k++) g.step(log);
        g.scope.dispose();
        if (stats().effects !== e0 || stats().scopes !== s0 || g.nodes.some(n => n.node.subs && [...n.node.subs].some(o => !o._disposed))) g.viol.push('I7 leak after scope.dispose');
        if (g.viol.length) fails.push({ seed, log: shrink(seed, log), viol: g.viol[0] });
    }
    return fails;
}
// shrink: delta-debugging по seed — переигрывать без i-й операции, пока нарушение воспроизводится (операции детерминированы seed'ом, пропуски маской)
assert(`фаззер графа: 300 сидов × 60 операций без нарушений I1–I7 ${fails.map(f => `seed ${f.seed}: ${f.viol} [${f.log}]`).join('; ')}`, fails.length === 0);
```

**API:**

```js
// только тестовый код; в aegis-test.js (в git, не в _queue — флаг владельцу) можно экспортировать оракул-утилиты:
export function checkGraph(roots: Array<Signal<any> | Computed<any>>): string[];   // нарушения subs↔deps, оставшиеся уничтоженные observers
export function fuzzGraph(opts?: { seeds?: number; ops?: number; seed?: number; nSig?: number; nComp?: number; nEff?: number }): Array<{ seed: number; log: string[]; viol: string }>;
// test.html: section('ядро — фаззер графа vs наивная модель'); test-core.mjs: test('фаззер графа', () => assert.deepEqual(fuzzGraph({ seeds: 2000 }), []))
```

**Критерий:** test.html: `fuzzGraph({ seeds: 300, ops: 60 })` возвращает [] в Chrome и Firefox (≤ 150 мс); test-core.mjs: 2000 сидов в node ≤ 1 с. Регрессионная сила: при искусственной поломке bailout (закомментировать :399) фаззер даёт нарушение I4 на первых 10 сидах; при поломке _endTrack (:225) — I5. Прототип в этой охоте: 2000 × 60 = 120 000 операций, 0 нарушений на текущем ядре (aegis.js) — это и есть базовая линия.

**Источники:** Hypothesis (stateful/rule-based testing), fast-check model-based testing (`fc.commands`), Reactively benchmark harness (случайные DAG для сравнения Solid/Preact/S.js), Solid test «createEffect ordering / dynamic dependencies», Preact Signals `signal.test.tsx` invariants, TC39 Signals proposal §«Algorithms» (глitch-free, consistent reads), Jepsen/delta-debugging (Zeller, «Simplifying failure-inducing input»).

### 💎 #19 — Fault-injection: computed, бросивший исключение, не должен рвать граф и убивать раунд

**Impact:** 5 · **Effort:** S · **Size:** +~0.18 KB gzip в ядре (6.1 → ~6.3 KB), не tree-shakeable — это исправление Computed/_flush

**Сейчас:** Три сцеплённых дефекта. (a) Computed._recompute при исключении вызывает _unsubscribe(this) (aegis_full.js:410) и оставляет _dirty=true: computed больше не в subs своих источников, поэтому запись в источник не помечает его и не ставит в очередь его подписчиков — эффект, читавший computed, никогда не перезапустится (push-цепочка разорвана), хотя комментарий обещает «при следующем чтении полный пересчёт» — читать некому. (b) В _flush catch (:733) декоратор ошибки вызывает _changedDeps(obs) (:257), который делает deps[i].version() → для computed это _recompute → повторный throw уже из catch-блока: ошибка вылетает из _flush мимо _dispatchError (:737), scope.onError и errorBoundary (:4583). (c) При вылете из цикла раунда (:716–721) элементы round после текущего остаются с _queued=true, но их нет в _queue — _notify (:640) их больше никогда не поставит: эффекты мертвы до перезагрузки. Фаззер с «ядовитым» значением: 437 из 500 сидов — ошибка вылетела из `a.value = x` при наличии sc.onError, onError вызван 0 раз, после ухода от ядовитого значения оба эффекта не сходятся к оракулу. Ни один тест сьюта не бросает из computed.

**Предложение:** Семантика как в Preact Signals/TC39: computed кэширует ошибку как значение (поле _err), сохраняет зависимости (через _endTrack, не _unsubscribe) и получает новую версию; чтение value/peek/version перебрасывает _err до тех пор, пока источники не изменятся; push _run очищает _err вместе с dirty. _changedDeps становится exception-safe (читает кэшированные _version/_dirty, не пересчитывает). _flush: тело catch обёрнуто так, что ничего не может вылететь; плюс защитный finally, снимающий _queued с оставшихся в раунде и возвращающий их в _queue. Добавить фаззер fault-injection в test.html и test-core.mjs.

**Алгоритм:**

```js
// aegis_full.js:390 _recompute — ошибка как кэшированный результат
_recompute() {
    if (this._computing) throw new Error(`[Aegis] Circular dependency in computed "${this._name || '?'}"`);
    this._computing = true;
    const prev = _tracking;
    try {
        if (this._deps && this._deps.length > 0 && !_depsChanged(this)) { this._dirty = false; return; }
        this._n = 0; _tracking = this;
        let v, err = null;
        try { v = this._fn(this._value); } catch (e) { err = e; }
        _tracking = prev;
        _endTrack(this);                       // deps сохраняются и при ошибке — push-цепочка цела
        if (err) { this._err = err; this._version = ++_epoch; }   // ошибка — новое «значение»: подписчики перезапустятся и увидят throw
        else { this._err = null; if (this._version === 0 || !this._eq(this._value, v)) { this._value = v; this._version = ++_epoch; } }
        this._dirty = false;
    } finally { _tracking = prev; this._computing = false; }
}
get value() { if (this._dirty) this._recompute(); _track(this); if (this._err) throw this._err; return this._value; }
peek() { if (this._dirty) this._recompute(); if (this._err) throw this._err; return this._value; }
// version() НЕ бросает — _depsChanged/_run должны работать при ошибке; toString: this._err ? '<error>' : …

// :257 _changedDeps — только кэш, без пересчёта
function _changedDeps(obs) {
    const out = [], deps = obs._deps, vers = obs._vers;
    if (!deps) return out;
    for (let i = 0; i < deps.length; i++) {
        const d = deps[i];
        if (d._version !== vers[i] || d._dirty) out.push({ name: d._name || 'signal', value: d._err ? '<throws>' : d._dirty ? '<stale>' : _short(d._value) });
    }
    return out;
}

// :716 _flush — раунд не может «утечь»
const round = _queue; _queue = []; total += round.length;
let i = 0;
try {
    for (; i < round.length; i++) { const obs = round[i]; obs._queued = false; if (obs._disposed) continue;
        try { obs._run(); }
        catch (e) {
            try { if (e && typeof e === 'object' && !e.aegis) { e.aegis = { effect: obs._name, scope: _scopePath(obs._owner), changed: _changedDeps(obs) }; /* …message… */ } } catch (x) { /* декоратор никогда не бросает */ }
            if (_dispatchError(obs._owner, e)) continue;
            if (error) console.error(`[Aegis] error in "${obs._name}":`, e); else error = e;
        }
    }
} finally {
    for (let j = i + 1; j < round.length; j++) { const o = round[j]; if (!o._disposed) _queue.push(o); else o._queued = false; }   // недобежавший хвост — в следующий раунд, а не в вечный _queued=true
}
```

**API:**

```js
// Публичный API не меняется. Уточнение контракта в d.ts/README:
// Computed<T>.value — «если fn бросил, ошибка кэшируется и перебрасывается при каждом чтении до изменения зависимостей; эффекты-подписчики перезапускаются и получают её; scope.onError/errorBoundary ловят её, как любую ошибку эффекта».
// Диагностика: e.aegis.changed[i].value === '<throws>' для упавшего computed.
```

**Критерий:** test.html, секция «ядро — ошибки не рвут граф»: (1) a=1, c=computed(() => { if (a.value===2) throw …; return a.value }), sc.onError(h), два эффекта в sc (один читает c, другой a) → `a.value = 2` не бросает наружу, h вызван 1 раз, второй эффект запустился; `a.value = 3` → первый эффект видит 3, второй запустился (сейчас: throw наружу, h 0 раз, оба эффекта мертвы). (2) `c.value` после ошибки дважды бросает один и тот же объект ошибки без вызова fn (кэш). (3) stats().queued === 0 после каждого сценария. (4) Fault-фаззер: 300 сидов, ядовитое значение 1..4, 20 случайных записей, затем batch ухода от яда: 0 вылетов, 0 застрявших эффектов, onError ≥ 1 на каждом сиде, где яд встречался (сейчас 437/500 сидов — вылет и застревание). test-core.mjs — тот же фаззер на 2000 сидов.

**Источники:** Preact Signals `Computed._refresh` (HAS_ERROR флаг, ошибка хранится в _value и перебрасывается; источники не отписываются); TC39 Signals proposal — Computed «stores the thrown exception and rethrows on read until dependencies change»; Solid `runComputation` → `handleError` (граф остаётся, ошибка идёт владельцу); Vue 3 `callWithErrorHandling` для computed getter; Angular signals `computed` ERRORED state (Angular core `computed.ts`: `ERRORED` sentinel value).

### 💎 #20 — GC: computed без подписчиков отцепляется от источников (TC39 unwatched / Preact targets-empty)

**Impact:** 4 · **Effort:** M · **Size:** +~0.12 KB gzip в ядре (не tree-shakeable — _unsubIfGone/_unsubscribe/Subscriber.dispose); тесты 0 KB

**Сейчас:** Computed подписывается на источники при первом чтении (_track :205 → src.subs.add) и остаётся в src.subs до явного dispose() (:376) — его снимает только scope (computed() :436 регистрирует onDispose). Если computed создан вне scope (модульный store, derived в утилите) или живёт в долгом scope, а все его потребители ушли, он висит в subs источника навсегда и держит замыкание fn. Измерено (node --expose-gc, FinalizationRegistry): 2000 unowned computed после потери ссылок — b.subs.size === 2000, собрано 0/2000; 2000 computed в живом scope, чей единственный эффект был dispose()-нут — собрано 0/2000, b.subs.size 4000. Для сравнения, dispose()-нутые эффекты собираются 2000/2000. Каждая запись в b пробегает эти 2000 мёртвых observers в _notify (:638). В сьюте нет ни одного теста на сборку мусора или на subs.size после ухода потребителей computed (только «${sig}: dispose отписывает» для Subscriber, test.html:2126).

**Предложение:** Когда последний observer покидает subs computed'а (в _unsubIfGone, _unsubscribe, Subscriber.dispose, Computed.dispose subs.clear), computed сам отписывается от своих источников и помечается dirty — ровно поведение Preact Signals (`_unsubscribe` при `_targets === undefined`) и TC39 `unwatched`. Следующее чтение делает полный пересчёт (deps пусты → bailout не применяется) и переподписку; версия растёт только если значение реально изменилось (eq), поэтому downstream не получает холостых запусков. Рекурсивно: отписка computed от computed-источника может освободить и его. Добавить тесты: subs.size, FinalizationRegistry под `--js-flags=--expose-gc` в test-browsers.mjs (skip, если нет globalThis.gc), канарейки утечек в фаззерах.

**Алгоритм:**

```js
// aegis_full.js:233 — единая точка удаления из subs
function _drop(src, obs) {
    const s = src.subs;
    if (!s || !s.delete(obs) || s.size) return;
    if (src._isComputed && !src._disposed) { _unsubscribe(src); src._dirty = true; }   // никто не смотрит — отцепиться и забыть кэш (Preact: targets empty → unsubscribe from sources; TC39: unwatched)
}
function _unsubIfGone(obs, src, deps, n) {
    for (let i = 0; i < n; i++) if (deps[i] === src) return;
    _drop(src, obs);
}
function _unsubscribe(obs) {
    const deps = obs._deps;
    if (deps) { for (let i = 0; i < deps.length; i++) _drop(deps[i], obs); deps.length = 0; obs._vers.length = 0; }
    obs._n = 0; obs._evict = null;
}
// Subscriber.dispose (:581): if (this._src.subs) this._src.subs.delete(this)  →  _drop(this._src, this)
// Computed.dispose (:376): subs.clear() остаётся — сам computed уже _unsubscribe'нут строкой выше.
// _notify (:638): if (obs._disposed) { subs.delete(obs); continue; } — оставить subs.delete (не _drop): мы внутри итерации по этому же Set; сирота отцепится при следующем чтении/отписке.
// Инвариант для фаззера (I8): для каждого computed c: (c.subs && c.subs.size > 0) ⇔ c подписан на свои источники (c._deps.length > 0 после хотя бы одного чтения при живых подписчиках); c без подписчиков ⇒ ни один сигнал не содержит c в subs.
```

**API:**

```js
// API не меняется. Документировать в README/d.ts у computed():
// «computed без подписчиков не держит источники: следующее чтение пересчитывает его заново (как Preact Signals). Для горячего кэша без подписчиков — держите его в effect/subscribe».
// stats(): добавить `orphans` (число computed, отцепленных с момента старта) — 1 счётчик в _drop, дёшево.
```

**Критерий:** test.html «ядро — GC»: (1) b=signal(1); 2000 × { c=computed(() => b.value+i); c.value } → `b.subs.size === 0` сразу после цикла (сейчас 2000). (2) c=computed(() => a.value*2), d=effect(() => c.value); d() → `a.subs.size === 0`; затем `c.value` верен и `a.subs.has(c) === false`; новый effect на c → `a.subs.has(c) && c.subs.size === 1`. (3) если `globalThis.gc` есть (test-browsers.mjs: `--js-flags=--expose-gc`): FinalizationRegistry на 2000 unowned computed → после двух gc() и 2 макротасков собрано ≥ 1800/2000 (сейчас 0). (4) Семантика: computed с eq после отцепления и повторного чтения с тем же результатом не бампает версию — эффект-подписчик downstream не перезапускается (runs === 1). (5) Канарейка в фаззерах предложения 1 и в конце секций кэш-фазы 5/6: `stats().effects`, `stats().scopes` и `Σ subs.size` тестовых сигналов равны значениям до секции. test-core.mjs: пункты 1, 2, 4 + `node --expose-gc` для 3.

**Источники:** Preact Signals `Computed._unsubscribe` (отписка от источников, когда `_targets` пустеет — «unowned computeds are garbage-collectable»); TC39 Signals proposal `Signal.subtle.watched/unwatched` и «computed with no watchers is unlinked from sources»; alien-signals `unlink`/`checkDirty` (отсоединение при потере последнего подписчика); Reactively (Milo Mighdoll) — обсуждение GC ленивых computed; MDN FinalizationRegistry, V8 `--expose-gc`.

### 💎 #21 — Дети эффекта: всё созданное в теле эффекта умирает при его перезапуске (семантика Solid/Svelte 5)

**Impact:** 4 · **Effort:** S · **Size:** +~0.15 KB gzip в ядре (Effect._kids + хук в effect()/_subscribe/_scoped)

**Сейчас:** Effect._execute (aegis_full.js:480–485) ставит `_currentScope = this._owner` — «всё созданное внутри — дети владельца». Поэтому effect()/computed()/on()/interval(), вызванные в теле эффекта, регистрируются на scope компонента и живут до его смерти, накапливаясь при каждом перезапуске родителя. Измерено: effect(() => { a.value; effect(() => { b.value; inner++ }) }); a изменена 3 раза → после одной записи b `inner === 3`, b.subs.size 3 (Solid: 1). Ни один детектор (E001/E019/E027/E028) этого не ловит, ERRORS.md не упоминает; E030 предупреждает только о resource() внутри effect. Типичный след: обработчик on(el,'click') внутри эффекта срабатывает N раз после N перезапусков. Сьют не проверяет число живых эффектов/слушателей после перезапусков родителя.

**Предложение:** Сделать Effect владельцем того, что создано в его теле, не создавая Scope на каждый запуск: ленивый массив _kids на эффекте. Все точки регистрации, которые сегодня смотрят на _currentScope (effect() :521, _subscribe :590, computed() :436, _scoped :915, createScope :843 через parent), при `_tracking && !_tracking._isComputed` дополнительно кладут свой dispose в `_tracking._kids`. _execute перед запуском (после _runCleanup) и dispose() вызывают _kids. Регистрация на scope владельца сохраняется (если родитель не перезапускается — чистит scope), а unregister (_unreg) уже снимает запись из scope при dispose — двойной вызов безопасен (идемпотентность :509). Плюс инвариант в фаззер: число живых эффектов не растёт при перезапусках родителя.

**Алгоритм:**

```js
// aegis_full.js:444 — поле и утилита
function _adopt(dispose) {                     // владелец момента: запущенный эффект (не computed — тот чистый)
    const t = _tracking;
    if (t && !t._isComputed) (t._kids || (t._kids = [])).push(dispose);
}
function _killKids(node) {
    const k = node._kids; if (!k) return; node._kids = null;
    for (let i = k.length - 1; i >= 0; i--) { try { k[i](); } catch (e) { console.error('[Aegis] child dispose error:', e); } }   // в обратном порядке, как Scope
}
// Effect._execute (:480): после this._runCleanup() → _killKids(this);   Effect.dispose (:509): после _runCleanup() → _killKids(this)
// effect() (:521): после создания dispose → _adopt(dispose);   (важно: до node._execute(), чтобы вложенный effect, созданный при первом запуске, уже был усыновлён)
// _subscribe() (:590): _adopt(dispose);   computed() (:436): if (c._unreg) _adopt(() => c.dispose());
// _scoped() (:915, on/interval/timeout/debounced): const off = () => { cleanup(); if (unreg) { unreg(); unreg = null; } }; _adopt(off); return off;
// createScope() (:843): const sc = new Scope(_currentScope, name); _adopt(sc.dispose); return sc;
// Инвариант фаззера (I9): после K перезапусков родителя stats().effects == baseline + число эффектов, созданных ОДНИМ запуском.
```

**API:**

```js
// API не меняется; контракт документируется в README «Эффекты»:
// «effect(), computed(), on(), interval(), createScope(), созданные синхронно в теле эффекта, уничтожаются перед каждым его перезапуском и при dispose — как в Solid/Svelte 5. Код после await владельца не имеет — используйте runWithOwner(getOwner(), …)».
// d.ts: EffectOptions без изменений.
```

**Критерий:** test.html «ядро — дети эффекта»: (1) сценарий из «сейчас»: после 3 записей в a и одной в b `inner === 1`, `b.subs.size === 1`, `stats().effects` вырос ровно на 2. (2) on(btn,'click',h) внутри эффекта, 5 перезапусков, один click → h вызван 1 раз (сейчас 5). (3) createScope() в теле эффекта: onDispose ребёнка срабатывает при перезапуске родителя. (4) computed внутри эффекта после перезапуска: старый computed `_disposed === true` и отсутствует в subs источника. (5) Порядок: cleanup родителя (возвращённая функция) выполняется раньше dispose детей — записать порядок в массив. (6) Фаззер предложения 1 с операцией «эффект, создающий вложенный эффект»: stats().effects после dispose scope == baseline. test-core.mjs: 1, 3, 4.

**Источники:** Solid `createComputation`/`cleanNode` (каждое вычисление — owner; owned очищаются при повторном запуске); Svelte 5 `$effect` docs: «effects created inside an effect are destroyed when the parent re-runs»; Vue 3 `effectScope` gotcha (вложенные watchEffect привязаны к активному scope, не к эффекту — известная утечка); Angular `effect()` внутри effect требует явного Injector (NG0203); TC39 Signals proposal — Watcher без ownership (обоснование, почему это фреймворк-уровень).

### 💎 #22 — Стресс глубины и ширины: итеративный push + измеримые границы pull-рекурсии

**Impact:** 3 · **Effort:** S · **Size:** +~0.12 KB gzip в ядре (итеративный _notify ≈ тот же размер, +счётчик глубины и E045 в dev-ветке)

**Сейчас:** Push-фаза рекурсивна: _notify (aegis_full.js:635) → obs._run() (Computed :383) → _notify(this.subs) — глубина стека = длине цепочки computed. Pull тоже рекурсивен: version() (:372) → _recompute (:390) → _fn → get value (:362) → version() … по 4 кадра на уровень. Измерено (node, стек по умолчанию): цепочка 1000 computed — 0.8 мс, ок; 5000/10000/20000 — RangeError: Maximum call stack size exceeded уже на записи в корень. Веер 20 000 эффектов — 4.7 мс, веер-вход 5000 сигналов с ротацией deps — 12 мс (ок, но не измеряется). В сьюте нет ни стресса, ни бенчмарка ядра — регресс сложности (например, копия Set в _notify) пройдёт незамеченным. Aegis и Preact рекурсивны, alien-signals/Vue Vapor — итеративны именно ради этого.

**Предложение:** (a) Итеративный _notify с явным стеком множеств — убирает рекурсию push полностью и не меняет семантику (порядок постановки в _queue — DFS, как сейчас). (b) Pull оставить рекурсивным, но измерить и зафиксировать границу: dev-счётчик глубины вложенных _recompute; при > 1000 — предупреждение E045 «цепочка computed глубже 1000 — разбейте на store/эффекты» до того, как браузер бросит RangeError без контекста. (c) Секция стресса в test.html и test-core.mjs: цепочка 2000 (должна проходить в обоих браузерах — регрессионный страж), линейность t(2000)/t(200) < 15, веер 20k эффектов < 50 мс, веер-вход 5000 с ротацией deps < 50 мс, 1000 записей в сигнал с 1 подписчиком < 5 мс (микробенч _track/_flush).

**Алгоритм:**

```js
// aegis_full.js:635 — push без рекурсии
function _notify(subs) {
    _notifyDepth++;
    const stack = [subs];
    try {
        while (stack.length) {
            const set = stack.pop();
            for (const obs of set) {                        // без копии: в push-фазе subs не пополняется
                if (obs._disposed) { set.delete(obs); continue; }
                if (obs._isComputed) { if (!obs._dirty) { obs._dirty = true; if (obs.subs && obs.subs.size) stack.push(obs.subs); } }
                else if (obs._lane) _enqueueLane(obs);
                else if (!obs._queued) { obs._queued = true; _queue.push(obs); }
            }
        }
    } finally { _notifyDepth--; }
    if (_notifyDepth === 0 && _batchDepth === 0) _flush();
}
// Computed._run (:383) остаётся для внешних вызовов, но _notify его не использует.
// pull: счётчик глубины (dev)
let _pullDepth = 0;
_recompute() { … this._computing = true; if (_dev() && ++_pullDepth === 1000) _warn('E045', { what: `computed chain deeper than 1000 ("${this._name || '?'}")`, why: 'Each level costs ~4 stack frames; browsers throw RangeError around 2–3k levels.', fix: 'Flatten: derive from the source signals directly, or materialise intermediate steps into a store()/effect().' }); try { … } finally { if (_dev()) _pullDepth--; _tracking = prev; this._computing = false; } }
// test.html — стресс
const chain = (N) => { const root = signal(0); let p = root; for (let i = 0; i < N; i++) { const q = p; p = computed(() => q.value + 1); } let last; const sc = createScope(); sc.run(() => effect(() => { last = p.value; })); const t0 = performance.now(); root.value = 1; return { ms: performance.now() - t0, last, sc }; };
const c200 = chain(200), c2000 = chain(2000);
assert('стресс: цепочка 2000 computed проходит и линейна', c2000.last === 2001 && c2000.ms / Math.max(c200.ms, 0.05) < 15);
c200.sc.dispose(); c2000.sc.dispose();
```

**API:**

```js
// API не меняется. ERRORS.md: E045 — «computed chain deeper than 1000». d.ts без изменений.
// stats(): опционально `maxPullDepth` (dev) — максимальная глубина pull за сессию, для DevTools-панели.
```

**Критерий:** test.html «ядро — стресс»: (1) цепочка 2000 — верное значение в Chrome и Firefox (сейчас в node 5000 падает; 2000 — страж, чтобы граница не сдвинулась вниз); (2) после итеративного push — цепочка 20 000 computed с записью в корень в режиме без чтения эффектом (только Subscriber на конце? нет — pull тоже нужен) → оставить как тест на push: 20 000 computed, у каждого subs, но конечный эффект под `flush: 'micro'` — сама запись (push) не бросает RangeError (сейчас бросает); (3) t(2000)/t(200) < 15; (4) веер 20k эффектов одна запись < 50 мс; веер-вход 5000 с ротацией < 50 мс; (5) dev: цепочка 1200 → onWarn получает E045 один раз, значение всё равно верно. test-core.mjs: 1–4 с `node --stack-size` по умолчанию.

**Источники:** alien-signals (Johnson Chu) — `propagate` с явным стеком, обоснование для Vue Vapor: «no recursion → no stack overflow on deep chains»; Reactively/S.js обсуждения глубины; Preact Signals issue «Maximum call stack size exceeded with long computed chains»; V8: лимит стека ~1 MB (~10k простых кадров), Firefox SpiderMonkey ~ аналогично; js-framework-benchmark/`reactively` bench (fan-out/fan-in формы графов).


---

# 📝 Формы

## 🔭 validation-model

**Линза:** Модель валидации форм (секции 17 FORM и 25 WIREFORM): sync/async/schema-правила, Standard Schema (zod/valibot/arktype без адаптеров), серверные ошибки на поля (422 → field errors, RFC 9457 problem details), i18n сообщений (secция 20), зависимые поля и cross-field правила, debounce async-валидации и отмена устаревших проверок, HTML-constraint validation API (setCustomValidity, :user-invalid), типизация значений (числа/даты/массивы) и трансформации. Сравни с Angular Signal Forms (2025), React 19 Actions/useActionState, TanStack Form, Conform, Remix/React Router form actions, Vue vee-validate.

**Вывод:** Aegis уже закрывает то, чем хвастаются TanStack Form/Conform/vee-validate: единый валидатор `_makeValidator` (aegis_full.js:5030–5122) с версионированием, AbortSignal и debounce для async-правил, Standard Schema без адаптеров, мост с Constraint Validation API (`noValidate` + `setCustomValidity`, aegis_full.js:7062, 7157), раскладка серверных ошибок из Laravel/DRF/Rails/RFC 9457/JSON:API (aegis_full.js:5253–5300), вложенные имена и `setInitial/commit/changes`. Отстаёт в самой модели валидности: `valid` (aegis_full.js:5192, 7206) — это «нет показанных ошибок», а не «значения корректны»: до первого `validate()` пустая обязательная форма валидна, а `watch` авто-очистки (aegis_full.js:5183) делает её валидной при каждом нажатии; cross-field `matches` читает `.peek()` (aegis_full.js:7027) и не перепроверяется при смене зависимого поля — Angular Signal Forms и TanStack держат валидность как производную от значений. Standard Schema запускается только целиком на submit (`onlyTouched` в `runSchema` никто не передаёт), в режиме blur-then-live zod-поля молчат до отправки, а вывод схемы (`result.value`) выбрасывается — сигнал `parsed` (aegis_full.js:5197) объявлен и никогда не пишется. i18n сообщений заморожена на момент вычисления правила (`_msg` читает `<html lang>`, aegis_full.js:5492), без plural и без связи с `t.locale`; нативные сообщения браузера приходят на языке UI браузера, а не страницы. Наконец, `form()` (виртуальная форма) лишена всего, что даёт `wireForm`: touched, blur-then-live, aria-invalid, `:user-invalid` — и набор полей у обеих статичен (нет field arrays / позднего появления инпутов).

**Отвергнуто:** 1) Серверные ошибки 422 → поля (RFC 9457 `errors[]` с `pointer`, JSON:API `source.pointer`, Laravel `{message, errors}`, DRF плоские, вложенные объекты, `non_field_errors` → `$form`) — уже реализовано в `_applyServerErrors` aegis_full.js:5253–5300 и покрыто тестами (test.html:1606–1608, 1739). 2) Debounce/отмена устаревших async-проверок — сделано (`runAsync` версии+AbortController, aegis_full.js:5037–5060, тест test.html:1735–1738). 3) Адаптеры под zod/valibot/arktype — не нужны, Standard Schema принимается напрямую (`_isStandardSchema`, aegis_full.js:5013). 4) Double-submit guard, PRG/303, `aria-busy`, фокус на первую ошибку, `announce` — сделано (aegis_full.js:5209, 7304–7330). 5) `errors[key]` как массив всех сообщений поля — UX-норма показывает одно; `first()` (aegis_full.js:5262) достаточно, а множественные issue лучше отдавать через `explain`-подобный debug, не менять тип сигнала. 6) `reportValidity()`/нативные пузыри — противоречит принятому решению `noValidate` (aegis_full.js:7062), пузырь перекрывает inline-ошибку. 7) Form-associated custom elements — есть `element(tag, C, { formAssociated })` (секция 28). 8) `guardUnload`, `dirtyFields`, `changes` для PATCH — есть (aegis_full.js:5127–5160). 9) Режим `revalidate: 'change'` vs `'input'` — тривиальная опция без рычага. 10) useActionState-подобный `[state, action, pending]` — эквивалент уже есть: `submitting/submitCount/submitError/result` (aegis_full.js:5204–5207). 11) Правила уровня формы через `refine` — issue без path уже падает в `errors.$form` (aegis_full.js:5097).

### 💎 #23 — Валидность как производная от значений: issues/valid/canSubmit + живые cross-field правила

**Impact:** 5 · **Effort:** M · **Size:** +0.35 KB gzip в блоке form (tree-shakeable вместе с form/wireForm)

**Сейчас:** `valid` — computed по `errors[]` (aegis_full.js:5192–5196 для form(), 7206–7210 для wireForm): «нет показанных ошибок». До первого `validate()` форма с пустыми `required`-полями валидна; в form() `watch(fields[key], () => errors[key].value = null)` (aegis_full.js:5183) обнуляет ошибку при любом изменении без перепроверки — набрав 'a' при `minLen(3)`, получаем `valid === true`. Поэтому demo/admin.html:170 блокирует кнопку по `!f.dirty`, а не по `valid`. Cross-field `matches` читает `fields[otherKey].peek()` (aegis_full.js:7027): при смене password ошибка/отсутствие ошибки на repeat устаревает, перепроверка происходит только по событиям самого repeat (aegis_full.js:7127–7140). Нет `canSubmit` (валидно, не отправляется, async не в полёте) — в admin.html это собирают вручную.

**Предложение:** Разделить «состояние» и «показ». В `_makeValidator` для каждого поля завести `issues[key] = computed(...)` — результат sync-правил от текущего значения, вычисляемый реактивно и независимо от touched. `errors[key]` остаётся записываемым сигналом показа (серверные ошибки, setErrors, тесты не ломаются). `valid` = нет issues, нет async-ошибок, нет `$form`, нет errors. `canSubmit = valid && !validating.$any && !submitting`. Правила читают другие поля через `.value` (в `matches` — `fields[otherKey].value`), поэтому реактивное ядро само трекает зависимости: смена password пересчитывает `issues.repeat`, а в wireForm effect переносит `issues` в `errors`, если поле уже touched (blur-then-live/live). Авто-очистка в form() заменяется на «показывать issues, пока поле было показано с ошибкой».

**Алгоритм:**

```js
// _makeValidator({ fields, errors, rules, touched, mode, ... })
const issues = {};
for (const key of Object.keys(fields)) issues[key] = computed(() => {
    const val = fields[key].value;                                  // своё поле
    for (const r of rules[key] || []) {
        const m = r(val, key, fields, { signal: null, live: true });  // matches → fields[other].value: зависимость трекается ядром
        if (m && typeof m.then === 'function') return null;          // async — не здесь
        if (m) return m;
    }
    return null;
}, `form:${key}:issue`);
issues.$any = computed(() => Object.keys(fields).some(k => issues[k].value), 'form:issues');
const asyncErr = {};   // signal per key — сюда пишет runAsync вместо errors[key]; errors[key] = показ
const valid = computed(() => !errors.$form.value && !issues.$any.value
    && Object.keys(fields).every(k => !asyncErr[k].value && !errors[k].value), 'form:valid');
const canSubmit = computed(() => valid.value && !validating.$any.value && !submitting.value, 'form:canSubmit');
// показ: validateField(key) → errors[key].value = issues[key].peek(); затем async как сейчас
// wireForm: живой показ после первого касания
effect(() => {
    const i = issues[key].value;
    if (touched[key].peek() && (mode === 'live' || errors[key].peek() != null || i == null)) errors[key].value = i ?? asyncErr[key].peek();
}, `form:${key}:show`);
// matches (7027): fields[otherKey] && val !== fields[otherKey].value ? … : null
```

**API:**

```js
FormCore += { issues: Record<string, ReadonlySignal<string|null>> & { $any: ReadonlySignal<boolean> }; canSubmit: ReadonlySignal<boolean> }
ValidationRule ctx += { live: boolean }   // true внутри computed, правило не должно иметь side effects
// поведение: f.valid теперь false для пустых required до validate(); f.errors — только показанные
// setValidationMessages/matches без изменений сигнатур; matches читает .value
```

**Критерий:** test.html: `const f = form({ pw: '', rep: '' }, { rules: { pw: [required, minLen(3)], rep: [matches('pw')] } })` → `f.valid.value === false` и `f.errors.pw.value === null` (не показано); `f.fields.pw.value = 'abc'; f.fields.rep.value = 'abc'` → `valid === true`; `f.fields.pw.value = 'abcd'` → `f.issues.rep.value !== null`, `valid === false` без вызова validate; `f.validate()` → `errors.rep` показан; `f.fields.pw.value = 'abc'` → `errors.rep.value === null` (перепроверка по зависимости). wireForm: после blur на rep с ошибкой изменить pw через input-событие → `errors.rep` обновляется; `canSubmit === false` пока `validating.$any`. Существующие тесты 'form valid computed = …' (test.html:3961, 3969) проходят.

**Источники:** Angular Signal Forms (v21, 2025): validators как реактивные функции, `valid()/invalid()/pending()` производные от модели, зависимости трекаются автоматически; TanStack Form `canSubmit`, `isValid` vs `errors` (display), `validators.onChangeListenTo` для зависимых полей; Vue vee-validate `meta.valid` vs `errors`; TC39 Signals proposal (Computed как единая модель производного состояния).

### 💎 #24 — Standard Schema по полям на blur: issue-фильтрация по пути, один прогон на тик, схема как правило поля

**Impact:** 4 · **Effort:** S · **Size:** +0.2 KB gzip в блоке form

**Сейчас:** `runSchema` (aegis_full.js:5081–5105) вызывается только целиком из `validateAsync` (5115), `form().validate` (5189) и `wireForm.validate` (7199), всегда с `onlyTouched = false` — параметр и ветка `touched[key].peek()` (5093) мертвы. `validateField` (5062) гоняет только `rules[key]`. В wireForm с zod-схемой в режиме 'blur-then-live' (recipes/form.html:24 — режим по умолчанию) blur ничего не показывает, все schema-ошибки вываливаются на submit — противоположно полям с правилами. Ветка «issues пусты» (5087) — no-op с пустым телом, поэтому schema-ошибка снимается только за счёт `validateField` другого происхождения. Нельзя дать Standard Schema на одно поле (`rules: { email: [z.string().email()] }`) — только объект на всю форму.

**Предложение:** (a) `validateField(key)` дополнительно прогоняет схему на `_nestValues(fields)` и применяет только issues, чей `_issuePath` → `keyOf` === key (Standard Schema не умеет partial — валидируем целиком и фильтруем); отсутствие issue для key снимает ошибку, если она была schema-owned (Set). (b) Мемоизация: один прогон схемы на ревизию значений (счётчик, инкрементируется в per-field watch) — пять blur подряд без изменений = один validate. (c) Любой элемент массива правил, проходящий `_isStandardSchema`, оборачивается в правило: первый issue.message; async-схема → async-правило со всем существующим debounce/abort. Убрать мертвый `onlyTouched`.

**Алгоритм:**

```js
const schemaOwned = new Set(); let rev = 0, memoRev = -1, memoRes = null;
for (const k of Object.keys(fields)) watch(fields[k], () => { rev++; });
const schemaResult = () => { if (memoRev !== rev) { memoRev = rev; memoRes = schema['~standard'].validate(_nestValues(fields)); } return memoRes; };
const runSchemaFor = (key) => {
    if (!schema) return true;
    const apply = (res) => {
        const mine = (res && res.issues || []).filter(i => keyOf(_issuePath(i) || '') === key);
        if (mine.length) { errors[key].value = mine[0].message; schemaOwned.add(key); return false; }
        if (schemaOwned.delete(key)) errors[key].value = null;
        return true;
    };
    const r = schemaResult();
    return r && typeof r.then === 'function' ? r.then(apply) : apply(r);
};
// validateField: после sync-правил, если ok → const s = runSchemaFor(key); return s === true ? true : (s && s.then ? true /* фон */ : false);
// схема как правило поля
const _asRule = (r) => !_isStandardSchema(r) ? r : (v) => {
    const pick = (x) => x && x.issues && x.issues.length ? x.issues[0].message : null;
    const res = r['~standard'].validate(v);
    return res && typeof res.then === 'function' ? res.then(pick) : pick(res);
};
_rules[key] = [...nativeRules, ...schemaRules].map(_asRule);   // wireForm 7102; form() 5177
```

**API:**

```js
wireForm(el, { schema: StandardSchemaV1, rules: { [key]: Array<ValidationRule | AsyncValidationRule | StandardSchemaV1> } })
form(defaults, { rules: { [key]: Array<… | StandardSchemaV1> }, schema })
validateField(key): boolean   // теперь включает schema-issues этого поля (sync); async-схема — в фоне через validating[key]
// d.ts: type RuleLike<V> = ValidationRule<V> | AsyncValidationRule<V> | StandardSchemaV1<V, any>
```

**Критерий:** test.html (расширение теста test.html:1700–1724): wireForm(formEl, { schema, mode: 'blur-then-live' }); `email` input → dispatch 'blur' → `f.errors.email.value === 'bad email'` без `validate()`; поправить value на 'a@b' + 'input' + 'blur' → `null`; счётчик вызовов `validate` схемы: три blur без изменений → +1 вызов. Правило-схема: `form({ email: '' }, { rules: { email: [required, miniSchema] } })`, `validate()` → `errors.email` из `issues[0].message`; async-схема → `validating.email.value === true`, затем сообщение.

**Источники:** Standard Schema spec v1 (`~standard.validate`, issues[].path с `{ key }`), zod v4 / valibot / arktype (нет partial-валидации — TanStack Form тоже гоняет целиком и раскладывает по `path`); TanStack Form `validators.onBlur` со Standard Schema на поле; Conform `parseWithZod` + `shouldRevalidate: 'onBlur'`; Angular Signal Forms `validateStandardSchema()`.

### 💎 #25 — Типизированные значения: вывод Standard Schema в parsed/submit, types для date/number/array, InferOutput в d.ts

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip в блоке form (карта типов ~120 B)

**Сейчас:** `parsed = signal(null)` (aegis_full.js:5197) возвращается из form() (5257) и никогда не записывается; `runSchema.apply` читает только `result.issues` (5083), `result.value` (coerce/trim/transform/default из zod) выбрасывается; `submit` шлёт сырой `values.peek()` (5218, 7263 `values.peek()` при `as: 'json'`). `readValue` (7069–7076) приводит number/range → Number, checkbox → boolean, файлы, select multiple; `type=date|datetime-local|month|time|week` остаются строками, `valueAsDate/valueAsNumber` не используются; обратное направление (7113–7118) пишет `v ?? ''` — Date в сигнале даст '[object Date]'-подобный мусор. `bind()` (2517–2540) приводит только number. d.ts: `form(defaults, { schema })` не выводит тип значений из схемы, `wireForm.fields` — `Signal<unknown>`.

**Предложение:** (1) `apply` пишет `parsed.value = 'value' in result ? result.value : null` при отсутствии issues (и null при issues); `submit(handler)`/`submit(url)` передают `parsed.peek() ?? values.peek()` когда есть схема; `wireForm` получает `parsed` и `serverSubmit({ as: 'json' })` шлёт parsed. (2) `types` в опциях wireForm по аналогии с island `types` (E025): `{ birthday: Date, qty: Number, tags: Array }` — `readValue` использует `valueAsDate`/`valueAsNumber`, обратный effect форматирует Date под `input.type`; `Array` для `name="tags[]"`/comma-строк. Дефолт без types — как сейчас (совместимость). (3) d.ts: перегрузка `form<T, S extends StandardSchemaV1>(defaults: T, opts: { schema: S })` с `parsed: ReadonlySignal<InferOutput<S> | null>` и `submit(handler: (values: InferOutput<S>) => …)`.

**Алгоритм:**

```js
// _makeValidator получает parsed; runSchema.apply:
if (!issues || !issues.length) { if (parsed) parsed.value = result && 'value' in result ? result.value : null; return true; }
if (parsed) parsed.value = null;
// form().submit / wireForm.submit:
const body = schema && parsed.peek() != null ? parsed.peek() : values.peek();
// wireForm types
const { types = {} } = opts;
const _fmtDate = (d, type) => { if (!(d instanceof Date) || isNaN(d)) return ''; const l = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString(); return type === 'datetime-local' ? l.slice(0, 16) : type === 'month' ? l.slice(0, 7) : type === 'time' ? l.slice(11, 16) : l.slice(0, 10); };
const readValue = (input) => {
    const T = types[input.name];
    if (T === Date) return input.value === '' ? null : (input.type === 'datetime-local' ? new Date(input.value) : input.valueAsDate || new Date(input.value));
    if (T === Number) return input.value === '' ? null : input.valueAsNumber;
    if (T === Array) return input.value.split(',').map(s => s.trim()).filter(Boolean);
    /* …существующие ветки… */
};
// signal → DOM (7113): input.value = types[key] === Date ? _fmtDate(v, input.type) : Array.isArray(v) && types[key] === Array ? v.join(', ') : (v ?? '');
```

**API:**

```js
form<T, S extends StandardSchemaV1<any, any>>(defaults: T, opts: FormOptions & { schema: S }): … & { parsed: ReadonlySignal<StandardSchemaV1.InferOutput<S> | null>; submit(handler: (values: StandardSchemaV1.InferOutput<S>) => unknown): Promise<unknown>; submit(url: string, opts?: { raw?: boolean; … }) }
wireForm(el, { types?: Record<string, typeof Date | typeof Number | typeof Array | typeof Boolean | typeof String> })
WireFormResult += { parsed: ReadonlySignal<unknown> }
// namespace StandardSchemaV1 { type InferOutput<S> = S extends { '~standard': { types?: { output: infer O } } } ? O : unknown }
```

**Критерий:** test.html: схема с coerce (`validate: v => ({ value: { age: Number(v.age), name: String(v.name).trim() } })`), `form({ age: '42', name: ' a ' }, { schema })`; `await f.submit(v => (got = v))` → `got.age === 42 && got.name === 'a'` и `f.parsed.value.age === 42`; при issues → `f.parsed.value === null`. wireForm: `<input type=date name=d value=2026-09-05>` с `types: { d: Date }` → `f.fields.d.value instanceof Date && f.values.value.d.getUTCDate() === 5`; `f.fields.d.value = new Date(2026, 8, 6)` → после nextTick `input.value === '2026-09-06'`; тип-тест в test.html/aegis.d.ts: `f.parsed.value.age` — number.

**Источники:** Standard Schema `types.output`/`InferOutput`; zod v4 `z.coerce`, `.transform()`, `.default()`; Conform `coerceFormValue` / `parseWithZod` (формы отдают строки — коэрция обязанность слоя форм); HTML Living Standard `valueAsDate`, `valueAsNumber`, форматы `type=date|datetime-local|month|time|week`; Angular Signal Forms типизированная модель `form(signal<T>)`; React Router / Remix `formData` + zod-парсинг в action.

### 💎 #26 — i18n ошибок: реактивная локаль, plural через i18n().t, нативные ValidityState → коды на языке страницы

**Impact:** 4 · **Effort:** M · **Size:** +0.3 KB gzip (карта ValidityState ~150 B, plural в _msg ~80 B); словари ru/en уже есть

**Сейчас:** `_msg` (aegis_full.js:5492–5496) берёт `document.documentElement.lang.slice(0,2)` в момент вызова правила: показанные ошибки не переводятся при `t.locale.value = 'kk'`, при `syncLang: false` (test.html:2030) всегда английский. `setValidationMessages` (5491) — глобальный словарь/функция без связи с `i18n()` и его `plural` (5433); `_MESSAGES.ru.minLen: 'Минимум {n} символов'` (5485) неверно для n=1,2,3 («1 символов»). Нативное правило wireForm (7091–7095) возвращает `input.validationMessage` — язык UI браузера: страница ru/kk, браузер en → смешанные языки на одной форме (типично для Казахстана); маппинга ValidityState → коды нет.

**Предложение:** (1) Модульный сигнал `_vLocale`, который `_msg` читает через `.value`; `i18n()` с `syncLang` и `setValidationMessages(t)` синхронизируют его. Вместе с «валидность как computed» (бриллиант 1) перевод ошибок при смене локали получается бесплатно — issues пересчитываются; без него — effect на `_vLocale`, перепроверяющий поля с показанной ошибкой. (2) `setValidationMessages(t, prefix = 'validation.')` принимает функцию `t` из `i18n()` (распознаётся по `isSignal(t.locale)`): сообщения берутся из словаря приложения с plural-формами `{ one, few, many }` и `params.n`. `_msg` сам понимает объект plural-форм через `Intl.PluralRules` для встроенных словарей. (3) `wireForm(el, { messages: 'browser' | 'page' })` (default 'browser' — совместимость; 'page' автоматически, если зарегистрирован `t`): нативные ограничения переводятся в коды `required/minLen/maxLen/pattern/email/url/min/max/step/badInput` с параметрами из атрибутов; `setCustomValidity` — мост с `:user-invalid` сохраняется.

**Алгоритм:**

```js
const _vLocale = signal(typeof document !== 'undefined' ? (document.documentElement.lang || 'en') : 'en', 'validation:locale');
export function setValidationMessages(dict, prefix = 'validation.') {
    if (typeof dict === 'function' && dict.locale && isSignal(dict.locale)) {
        const t = dict;
        _messages = (code, params) => { const k = prefix + code, s = t(k, params); return s === k ? null : s; };
        (_currentScope || new Scope(null, 'validation')).run(() => effect(() => { _vLocale.value = t.locale.value; }, 'validation:locale'));
    } else _messages = dict;
}
function _msg(code, params) {
    const lang = _vLocale.value.slice(0, 2);
    let src = (typeof _messages === 'function' && _messages(code, params)) || (_messages && _messages[code]) || (_MESSAGES[lang] || _MESSAGES.en)[code] || _MESSAGES.en[code] || code;
    if (src && typeof src === 'object') { const n = params && params.n; src = src[typeof n === 'number' ? new Intl.PluralRules(lang).select(n) : 'other'] ?? src.other ?? Object.values(src)[0]; }
    return String(src).replace(/\{(\w+)\}/g, (_, k) => params && params[k] != null ? params[k] : '');
}
// _MESSAGES.ru.minLen = { one: 'Минимум {n} символ', few: 'Минимум {n} символа', many: 'Минимум {n} символов' }
// wireForm: нативное правило
const _VALIDITY = [['valueMissing', 'required'], ['tooShort', 'minLen', i => ({ n: i.minLength })], ['tooLong', 'maxLen', i => ({ n: i.maxLength })], ['patternMismatch', 'pattern'], ['typeMismatch', i => i.type === 'email' ? 'email' : 'url'], ['rangeUnderflow', 'min', i => ({ n: i.min })], ['rangeOverflow', 'max', i => ({ n: i.max })], ['stepMismatch', 'step', i => ({ n: i.step })], ['badInput', 'badInput']];
nativeRules.push(() => {
    input.setCustomValidity('');
    const v = input.validity; if (!v || v.valid) return null;
    if (messages === 'browser') return input.validationMessage;
    for (const [flag, code, p] of _VALIDITY) if (v[flag]) return _msg(typeof code === 'function' ? code(input) : code, p ? p(input) : null);
    return input.validationMessage;
});
```

**API:**

```js
setValidationMessages(dict: Record<string, string | PluralForms> | ((code: string, params?: Record<string, unknown>) => string | null) | I18n, prefix?: string): void
wireForm(el, { messages?: 'browser' | 'page' })   // 'page' — коды + словарь приложения/встроенный по локали
// новые коды: url, step, badInput; d.ts: ValidationMessageCode = 'required' | 'minLen' | 'maxLen' | 'pattern' | 'email' | 'url' | 'min' | 'max' | 'step' | 'badInput' | 'matches' | 'maxSize' | 'mime' | 'maxFiles'
```

**Критерий:** test.html: `const t = i18n({ ru: { validation: { minLen: { one: 'Минимум {n} символ', few: 'Минимум {n} символа', many: 'Минимум {n} символов' } } }, en: { validation: { minLen: 'At least {n} characters' } } }, { locale: 'ru', syncLang: false }); setValidationMessages(t);` → `minLen(1)('') === 'Минимум 1 символ'`, `minLen(3)('') === 'Минимум 3 символа'`; форма с показанной ошибкой `errors.name`, `t.locale.value = 'en'`, `await nextTick()` → `errors.name.value === 'At least 3 characters'`. wireForm `<input name=x required minlength=3 value=ab>` с `messages: 'page'` при `document.documentElement.lang='ru'` → после validate `errors.x.value === 'Минимум 3 символа'` и `!input.validity.valid` (мост сохранён) независимо от navigator.language. Восстановить `setValidationMessages(null)` в конце (как test.html:2045).

**Источники:** HTML Living Standard — ValidityState флаги (valueMissing, tooShort, typeMismatch, stepMismatch, badInput) и `setCustomValidity`; Unicode CLDR plural rules / `Intl.PluralRules`; Angular Signal Forms — ошибки как `{ kind, message }` с ключами для i18n; vee-validate `localize()` + `@vee-validate/i18n`; TanStack Form — ошибки произвольного типа (объекты с кодом) для перевода в UI; ARIA APG — сообщение об ошибке на языке страницы (`lang`).

### 💎 #27 — Динамические поля: wireForm({ observe }) и form().add/remove с правилами по шаблону items[].qty

**Impact:** 4 · **Effort:** M · **Size:** +0.45 KB gzip в блоке form (MutationObserver ~150 B, per-field scope и keys-сигнал ~300 B)

**Сейчас:** wireForm находит `[name]` один раз при вызове (aegis_full.js:7081 `formEl.querySelectorAll('[name]')`); инпуты, добавленные позже (`list()` строк «ещё телефон», серверный `swap()` фрагмента) — без сигналов, валидации, a11y; `formData()` (7239) их отправит непроверенными. Поиск правил уже понимает шаблон `items[].qty` (7101) — но применить его к новому индексу некому. `form()` — статичный набор ключей (5169–5178): `items[0][qty]` нельзя добавить после создания; `values`/`valid`/`dirtyFields` итерируют `Object.keys(fields)` (5192, 5196, 5150) — нереактивно, новые ключи не попадут. Нет ни `fieldArray`, ни `add/remove`.

**Предложение:** Вынести тело цикла wireForm (7081–7160) в `_wireInput(input, key)` с собственным `Scope` на поле (эффекты, слушатели, error-элемент отменяются вместе). `keys = signal([...])` вместо `Object.keys(fields)` в `values/valid/dirtyFields/validateAll/validating.$any`. `wireForm(el, { observe: true })` — `MutationObserver({ childList, subtree })`: добавленные `[name]` → `_wireInput`, удалённые (когда `formEl.elements[name]` больше нет) → `_unwire(key)`. `form().add(key, initial?, rules?)` / `remove(key)` — правила по шаблону из `opts.rules` (`'items[].qty'`), сигналы создаются лениво; `f.array('items')` — computed индексов для рендера строк. Одна и та же функция `_rulesFor(key, ruleSchema)` для form() и wireForm.

**Алгоритм:**

```js
const keys = signal([], 'wireForm:keys'), fieldScopes = {};
const _rulesFor = (key, rs) => rs[key] || rs[_normPath(key)] || rs[_normPath(key).replace(/\.\d+\./g, '[].').replace(/\.\d+$/, '[]')] || [];
const _wireInput = (input) => {
    const key = input.name; if (!key) return;
    if (fields[key]) { /* radio/checkbox к тому же сигналу — как сейчас (7085–7091) */ return; }
    const s = new Scope(_currentScope, `wireForm:${key}`); fieldScopes[key] = s;
    s.run(() => { /* тело 7093–7160: сигналы, правила, two-way, blur, a11y */ });
    keys.value = [...keys.peek(), key];
};
const _unwire = (key) => {
    if (!fieldScopes[key]) return;
    fieldScopes[key].dispose(); delete fieldScopes[key];
    delete fields[key]; delete errors[key]; delete touched[key]; delete _rules[key]; delete _initials[key]; delete _inputs[key];
    keys.value = keys.peek().filter(k => k !== key);
};
for (const input of formEl.querySelectorAll('[name]')) _wireInput(input);
if (opts.observe) {
    const mo = new MutationObserver((recs) => batch(() => {
        for (const r of recs) {
            for (const n of r.addedNodes) if (n.nodeType === 1) for (const i of (n.matches('[name]') ? [n] : n.querySelectorAll('[name]'))) _wireInput(i);
            for (const n of r.removedNodes) if (n.nodeType === 1) for (const i of (n.matches('[name]') ? [n] : n.querySelectorAll('[name]'))) if (!formEl.elements[i.name]) _unwire(i.name);
        }
    }));
    mo.observe(formEl, { childList: true, subtree: true });
    if (_currentScope) _currentScope.onDispose(() => mo.disconnect());
}
// values/valid: for (const k of keys.value) …  (вместо Object.keys(fields))
// form(): add = (key, initial = '', rules) => { …создать сигналы; _rules[key] = rules || _rulesFor(key, opts.rules || {}); keys.value = [...] }
```

**API:**

```js
wireForm(el, { observe?: boolean })   // следить за появлением/удалением [name]
WireFormResult += { keys: ReadonlySignal<string[]>; wire(input: HTMLElement): void; unwire(key: string): void }
FormCore += { keys: ReadonlySignal<string[]>; add(key: string, initial?: unknown, rules?: RuleLike[]): Signal<unknown>; remove(key: string): void; array(prefix: string): ReadonlySignal<number[]> }
FormOptions.rules: Record<string, RuleLike[]>   // ключи-шаблоны 'items[].qty' допускаются
```

**Критерий:** test.html: `wireForm(formEl, { observe: true, rules: { 'items[].qty': [required] } })` с одним `items[0][qty]`; `formEl.insertAdjacentHTML('beforeend', '<input name="items[1][qty]">')`; `await nextTick()` → `'items[1][qty]' in f.fields`, `f.keys.value.length === 2`, `f.validate() === false` и `errors['items[1][qty]']` из `required`, у нового инпута `aria-describedby`; удалить инпут → после nextTick ключ исчез, `f.values.value.items.length === 1`, слушатели сняты (проверка через число вызовов правила при input на отсоединённом элементе). form(): `f.add('items[0][qty]', 2)` → `f.values.value.items[0].qty === 2`, `f.remove(...)` → `valid` пересчитан.

**Источники:** Angular Signal Forms — модель `signal<T[]>` с автоматическим набором полей-массивов; TanStack Form `mode: 'array'` / `pushValue/removeValue`; Conform `useFieldList` + intents insert/remove; React Hook Form `useFieldArray`; DOM Standard MutationObserver; HTML Living Standard `form.elements` (RadioNodeList по имени); паттерн Enhance/HTMX «добавить строку сервером» — фрагмент прилетает через swap() и должен подхватываться.

### 💎 #28 — form().wire(el): один per-input слой для виртуальных форм — touched, blur-then-live, aria, :user-invalid

**Impact:** 5 · **Effort:** M · **Size:** +0.15 KB gzip (в основном перенос кода из wireForm в общий _wireInput; touched в form() ~60 B)

**Сейчас:** `form()` (aegis_full.js:5165–5258) не имеет `touched`, режимов показа и моста с Constraint Validation: ошибки только в сигналах, `bind:value` (2173) пишет значение и всё. В demo/admin.html:164–168 приходится вручную писать `novalidate`, `:aria-invalid=${…}` на каждом инпуте, `show()` для ошибки — и нет `aria-describedby`, `:user-invalid`, blur-логики, авто-фокуса на первую ошибку. Вся эта работа уже написана внутри wireForm (7113–7160), но недоступна как функция. Побочный дефект там же: `input.setAttribute('aria-describedby', errorEl.id)` (7148) затирает существующий `aria-describedby` подсказки поля.

**Предложение:** Вынести per-input проводку wireForm в `_wireInput(input, key, ctx)` (two-way с учётом radio/checkbox/file/select, DOM→signal с режимом, blur → touched, error-элемент, `aria-invalid`, `aria-describedby` дописывается, `setCustomValidity`) и вернуть dispose. `form()` получает `touched`, `mode` в opts и метод `wire`: `f.wire(el, key = el.name)` привязывает инпут; `f.wire('email')` без элемента возвращает `attach()`-директиву для `html`` — `<input name="email" ${f.wire('email')}>` (aegis_full.js:1981 `attach(fn, opts)` уже умеет ждать вставки узла). `f.focusFirstError()` общий для обеих форм. wireForm становится `form()` + автопоиск + serverSubmit — единая модель валидации с одним кодом.

**Алгоритм:**

```js
function _wireInput(input, key, C) {   // C: { fields, errors, touched, mode, native, validateField, readValue, formEl }
    const { fields, errors, touched, mode } = C;
    const own = new Scope(_currentScope, `field:${key}`);
    own.run(() => {
        /* signal → DOM: ветки radio/checkbox/file/select-multiple/text из 7113–7124 */
        const onInput = () => { fields[key].value = C.readValue(input); if (mode === 'live' || (mode === 'blur-then-live' && touched[key].peek() && errors[key].peek())) C.validateField(key); };
        on(input, 'input', onInput); if (/^(file|checkbox|radio)$/.test(input.type) || input.tagName === 'SELECT') on(input, 'change', onInput);
        on(input, 'blur', () => { touched[key].value = true; if (mode !== 'submit') C.validateField(key); });
        const errorEl = _errorElFor(input, key, C.formEl || input.form || input.parentElement);   // 7142–7153
        const prev = input.getAttribute('aria-describedby');
        input.setAttribute('aria-describedby', prev && !prev.split(/\s+/).includes(errorEl.id) ? prev + ' ' + errorEl.id : errorEl.id);
        effect(() => { const err = errors[key].value; input.setAttribute('aria-invalid', err ? 'true' : 'false'); errorEl.textContent = err || ''; errorEl.hidden = !err; if (C.native !== false && input.setCustomValidity) input.setCustomValidity(err || ''); }, `form:${key}:a11y`);
    });
    return () => own.dispose();
}
// form():
const touched = {}; for (const key of Object.keys(fields)) touched[key] = signal(false, `form:${key}:touched`);
const wire = (el, key) => {
    if (typeof el === 'string') return attach((node) => wire(node, el), { once: true });   // директива для html``
    key = key || el.name;
    if (!fields[key]) { _warn('E019', { what: `form.wire(): unknown field "${key}".`, why: 'The form has no field with that name.', fix: 'Add the field to form() or pass the key: f.wire(el, "email").' }, 'wire:' + key); return () => {}; }
    if (el.form && opts.native !== false) el.form.noValidate = true;
    return _wireInput(el, key, { fields, errors, touched, mode: opts.mode || 'blur-then-live', native: opts.native, validateField, readValue: _readValue, formEl: el.form });
};
// _readValue — вынесенный readValue из wireForm (7069–7076), общий
```

**API:**

```js
form(defaults, { rules, schema, asyncDebounce, mode?: 'blur-then-live' | 'live' | 'submit', native?: boolean })
FormCore += { touched: Record<string, Signal<boolean>>; wire(el: HTMLElement, key?: string): () => void; wire(key: string): AttachDirective; focusFirstError(): void }
// html`<input name="email" type="email" ${f.wire('email')}>`  — вместо bind:value + :aria-invalid + show(errors)
// WireFormResult без изменений; внутри wireForm — тот же _wireInput
```

**Критерий:** test.html: `const f = form({ email: '' }, { rules: { email: [required] } }); const el = document.createElement('input'); el.name = 'email'; formEl.append(el); sandbox.append(formEl); f.wire(el);` → `formEl.noValidate === true`; dispatch 'blur' → `f.touched.email.value === true`, `f.errors.email.value !== null`, `el.getAttribute('aria-invalid') === 'true'`, `el.validity.customError === true`, `el.matches(':invalid')`, `formEl.querySelector('#email-error').textContent === f.errors.email.value`; `el.value = 'a@b.c'; el.dispatchEvent(new Event('input'))` → ошибка снята (blur-then-live), `el.validity.valid`. `aria-describedby` с существующим `hint-id` → `'hint-id email-error'`. Директива: `html\`<input name="pw" ${f.wire('pw')}>\`` в sandbox → после `await nextTick()` blur даёт `touched.pw === true`. wireForm-тесты (test.html:4361–4470, 1700–1745) проходят без изменений.

**Источники:** HTML Living Standard — Constraint Validation API (`setCustomValidity`, `validity.customError`), CSS Selectors 4 `:user-invalid`/`:user-valid`; WAI-ARIA 1.3 / APG «Form validation»: `aria-invalid`, `aria-describedby` как список idref (дописывать, не затирать), `aria-errormessage`; Angular Signal Forms `[field]` directive — единый слой привязки для любой модели; TanStack Form `field.handleBlur/handleChange` + `state.meta.isTouched`; vee-validate `useField` meta.touched/dirty; Conform `getInputProps()` — генерирует aria-атрибуты из одной модели.

## 🔭 form-ux-a11y

**Линза:** UX и доступность форм: когда показывать ошибки (touched/dirty/submitted, «reward early, punish late»), фокус на первую ошибку и aria-describedby/aria-invalid, живые регионы для сводки ошибок, состояние отправки (pending, disabled, double-submit защита, optimistic submit с откатом), PRG-редиректы (секция 25 wireForm, configure onRedirect), автосохранение черновиков и защита от потери несохранённых изменений (beforeunload + Navigation API), reset/undo, работа с Enter/Escape. Сравни с GOV.UK Design System, APG, Angular/Adobe React Spectrum формами, HTMX-формами.

**Вывод:** Формы Aegis по механике уже на уровне 2026: Constraint Validation API как источник сообщений (aegis_full.js:7099–7106), Standard Schema и async-правила с отменой (5044–5140), server submit с 422→поля и PRG (7261–7297), double-submit guard и aria-busy (7304–7307), автоматические aria-invalid/aria-describedby (7161–7182) — этого нет ни у HTMX, ни у Datastar, а у Angular Signal Forms и React Spectrum нет серверного FormData-пути. Отстаёт же слой «когда и как человек видит ошибку»: (1) `valid` истинен для нетронутой невалидной формы, потому что errors заполняются только валидацией (7209–7213), — паттерн `?disabled=${!f.valid}` не работает, а параметр `onlyTouched` в runSchema мёртв (5093, вызывается всегда с false: 5189, 7199); (2) нет сводки ошибок GOV.UK, фокус идёт на первое поле, а не на сводку, `aria-describedby` перезаписывает hint (7172), каждое поле — свой `role="status"` (7167), группы radio/checkbox без ошибки на fieldset (7076–7081); (3) виртуальная `form()` не имеет никакого a11y-контракта — demo/admin.html:161–166 руками рисует aria-invalid и span.err без describedby и фокуса; (4) `guardUnload` (5155) закрывает только beforeunload — SPA-переход через router/Navigation API теряет черновик молча, нативный `<button type=reset>` рассинхронизирует сигналы (нет обработчика 'reset'); (5) состояние отправки — булев `submitting` без abort, без status-машины, без озвучивания успеха, PRG всегда `location.assign` (5246, 7277). Предложения ниже закрывают ровно эти пробелы, суммарно ≈ +2 KB gzip, всё внутри секций 17/25/26 и tree-shakeable вместе с form/wireForm.

**Отвергнуто:** 1) Полная React-Hook-Form/TanStack-Form-подобная система полевых массивов (`useFieldArray`, append/remove/move с перенумерацией `items[i][qty]`) — вложенные имена уже парсятся (`_parsePath` 4990, `_nestValues` 5010), а динамические строки в server-first формах делает сервер/`list()`; +1.5 KB ради редкого случая. 2) Полифилл/эмуляция `:user-invalid` — уже есть мост через `setCustomValidity` (7181) и `noValidate` (7063); Safari 16.5+/Firefox 88+/Chrome 119+ поддерживают нативно. 3) Отдельная библиотека сообщений/локализаций браузерных ошибок — `validationMessage` уже локализован браузером, `setValidationMessages` (5491) покрывает свои правила. 4) `aria-errormessage` как замена `aria-describedby` — поддержка в NVDA/JAWS/VoiceOver до сих пор неполная (a11ysupport.io), APG рекомендует describedby; предлагаю только добавлять errormessage параллельно, не заменять. 5) Оптимистичный submit с откатом значений формы — уже есть `mutation({ optimistic, resources })` (3872–3937) и patch-log из фазы 5 кэша; `f.submit(save)` с mutation-функцией уже работает (demo/admin.html:164), дублировать откат в форме нечего. 6) Автосохранение через IndexedDB/офлайн-очередь — избыточно для черновиков (sessionStorage достаточно, `persisted()` 4280 уже умеет debounce и storage-событие); офлайн-отправка формы — задача offlineResource, не формы. 7) `inputmode`/`autocomplete`-подсказки (E0xx «у поля email нет autocomplete») — полезно, но это линтер разметки, а не UX-механика; вынести в aegis-devtools аудит. 8) Глобальный Ctrl+Z для формы через `history()` — конфликтует с нативным undo в полях (комментарий на 4318 это уже осознанно исключает). 9) Отдельный компонент `<aegis-form>` custom element — противоречит server-first: wireForm оживляет существующую `<form>`, обёртка ломает FormData/enctype без JS. 10) HX-Redirect-подобный заголовок на 200-ответе — fetch и так следует 303, `response.redirected` (5243) покрывает PRG; заголовок нужен только если бэкенд не умеет 303 — оставлено как опция внутри 💎 #5, не отдельный бриллиант.

### 💎 #29 — Правда vs показ: eager `issues`, честный `valid`, политика «reward early, punish late»

**Impact:** 5 · **Effort:** M · **Size:** +0.3 KB gzip внутри form/wireForm (tree-shakeable вместе с ними)

**Сейчас:** В wireForm errors[key] заполняется только при валидации (onBlur 7151–7157, onInput 7138–7149 лишь для blur-then-live/live, validate 7193, submit 7309), а `valid` (7209–7213) — computed «нет errors». Итог: у нетронутой формы с пустым required `f.valid.value === true`, кнопка `?disabled=${!f.valid}` активна, и первое нажатие «Сохранить» превращается в вспышку ошибок. То же в form() (5190). В `mode: 'submit'` после провала errors висят до следующего submit — исправление поля не снимает ошибку (onInput не валидирует). Параметр `onlyTouched` в runSchema (5093) мёртв: оба вызова передают false (5189, 7199). Angular (`invalid` всегда актуален, `touched/dirty` гейтят показ), Adobe React Spectrum (`validationBehavior`, realtime after commit), GOV.UK («не валидировать до submit, после — реагировать на исправления») разделяют истину и показ; Aegis смешивает их в одном сигнале.

**Предложение:** Разделить два слоя. `f.issues[key]` — computed истины: синхронные правила + `input.validity` пересчитываются при каждом изменении fields[key], ничего не показывая. `f.errors[key]` остаётся «показанной ошибкой» (обратная совместимость с recipes/form.html:26, demo/admin.html:161). `f.valid` = нет issues и нет errors.$form; `f.canSubmit = computed(valid && !submitting)`. Политика показа одна на все режимы: ошибка появляется по правилу режима (blur / live / submit), а исчезает мгновенно, как только issues[key] стал null (reward early); при показанной ошибке ввод ревалидирует и может заменить текст (punish late — только по blur/submit). `mode: 'submit'` после первого провала переходит в «live для полей с ошибкой». `f.submitted` (computed submitCount > 0) экспортируется; runSchema(values, true) используется в live-режимах — параметр оживает. Native-мост: `setCustomValidity` только для показанной ошибки, чтобы `:user-invalid` совпадал с UI.

**Алгоритм:**

```js
// в цикле по inputs (после _rules[key] = [...]) :
issues[key] = computed(() => {
    const v = fields[key].value;
    for (const r of _rules[key]) { const m = r(v, key, fields, { signal: null }); if (m && typeof m.then !== 'function') return m; }
    return null;
}, `wireForm:${key}:issue`);
// авто-снятие показанной ошибки (reward early) — одна подписка на поле:
effect(() => { if (issues[key].value === null && errors[key].peek() && !validating[key].peek()) errors[key].value = null; }, `form:${key}:reward`);
// onInput — единая политика:
const onInput = () => {
    fields[key].value = readValue(input);
    const shown = touched[key].peek() && errors[key].peek();
    if (mode === 'live' || (shown && (mode === 'blur-then-live' || submitCount.peek() > 0))) _validateField(key);
};
const valid = computed(() => !errors.$form.value && Object.keys(fields).every(k => !issues[k].value && !errors[k].value), 'wireForm:valid');
const canSubmit = computed(() => valid.value && !submitting.value, 'wireForm:canSubmit');
// form(): issues строятся так же из _rules[key]; watch(fields[key]) на 5217 заменяется тем же reward-эффектом.
```

**API:**

```js
interface WireFormResult { issues: Record<string, ReadonlySignal<string|null>>; errors: Record<string, Signal<string|null>>; valid: ReadonlySignal<boolean>; canSubmit: ReadonlySignal<boolean>; submitted: ReadonlySignal<boolean>; }
wireForm(el, { mode?: 'blur-then-live' | 'live' | 'submit' })   // семантика: когда ПОКАЗЫВАТЬ; истина всегда в issues
form(defaults, opts) → то же: issues, canSubmit, submitted
```

**Критерий:** test.html: `<input name="e" required>` → сразу после wireForm `f.valid.value === false`, `f.issues.e.value` — строка, `f.errors.e.value === null`, `input.matches(':user-invalid') === false`; blur → errors.e показана; ввод 'x' → errors.e === null синхронно (без blur); mode:'submit': submit с пустым полем → ошибка; ввод символа → ошибка снята без повторного submit. Regression: все 30 существующих assert'ов wireForm (test.html:4361–4430, 1699–1779) проходят без изменений.

**Источники:** Angular Reactive/Signal Forms (`invalid` vs `touched`/`dirty`, `updateOn`); Adobe React Spectrum/React Aria `validationBehavior`, «realtime validation after first commit»; GOV.UK Design System «Validation» (не валидировать до отправки, показывать при исправлении); Luke Wroblewski «Inline Validation in Web Forms» (reward early, punish late, 2009); WHATWG HTML §4.10.20 Constraint validation (`validity`, `setCustomValidity`); CSS Selectors 4 `:user-invalid`.

### 💎 #30 — Сводка ошибок GOV.UK: `f.summary()`, фокус на сводку, слияние aria-describedby, ошибки групп на fieldset

**Impact:** 5 · **Effort:** M · **Size:** +0.6 KB gzip (summary ~0.3, merge/группы/prefix ~0.3), tree-shakeable с wireForm

**Сейчас:** При провале submit фокус уходит на первое `[aria-invalid="true"]` (7311, 7202) — пользователь скринридера узнаёт про одну ошибку из пяти; сводки нет, число ошибок не объявляется (announce только для $form: 7234, 7321). `input.setAttribute('aria-describedby', errorEl.id)` (7172) затирает уже стоящий describedby с подсказкой (`<span id="pw-hint">`) — hint пропадает для SR, что нарушает WCAG 3.3.2. Каждое поле получает свой `role="status"` (7167): пять live-регионов в форме дают хор объявлений при submit и повтор текста (describedby + live). Radio/checkbox с одним name: доп. кнопки подключаются к сигналу (7076–7081), но aria-invalid и errorEl ставятся только на первый input; GOV.UK/APG требуют ошибку на `fieldset` c `aria-describedby` группы. Нет id у input без id — некуда ссылаться из сводки.

**Предложение:** (a) `f.summary(target?, opts)` — рендерит/обновляет контейнер `role="alert" tabindex="-1"` со заголовком и `<ul>` ссылок `href="#<inputId>"` на каждое показанное поле (клик — focus + scroll на поле; для группы — на первый radio). Порядок — как поля в DOM. (b) Политика фокуса `focusOnError: 'summary' | 'field' | false` (по умолчанию 'summary', если сводка есть, иначе 'field'); после фокуса — `announce(_msg('summaryTitle', {n}))` один раз, вместо хора. (c) `_describe(el, id)` — merge токенов aria-describedby (hint остаётся первым, error последним; при снятии ошибки токен убирается), плюс `aria-errormessage=id` параллельно. (d) Убрать `role="status"` с полевого span; текст ошибки получает визуально скрытый префикс из `_msg('errorPrefix')` («Ошибка: »), чтобы SR отличал ошибку от подсказки. (e) Группы: если у name > 1 input или input внутри `fieldset`, errorEl вставляется после `legend`, `aria-describedby` — на fieldset, `aria-invalid` — на все inputs группы. (f) Авто-id: `input.id ||= 'f-' + key.replace(/[^\w-]/g,'_')`. Тот же `_describe` использовать в 💎 #3 для form().

**Алгоритм:**

```js
const _describe = (el, id, onOff) => {
    const set = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    onOff ? set.add(id) : set.delete(id);
    set.size ? el.setAttribute('aria-describedby', [...set].join(' ')) : el.removeAttribute('aria-describedby');
};
// wireForm: группа = все inputs с этим name; host = fieldset или первый input
const group = [...formEl.querySelectorAll(`[name="${CSS.escape(key)}"]`)];
const host = group.length > 1 ? (input.closest('fieldset') || input) : input;
...
effect(() => {
    const err = errors[key].value, shown = !!err;
    for (const i of group) i.setAttribute('aria-invalid', shown ? 'true' : 'false');
    _describe(host, errorEl.id, shown); if (shown) host.setAttribute('aria-errormessage', errorEl.id); else host.removeAttribute('aria-errormessage');
    errorEl.replaceChildren(); if (shown) { const p = document.createElement('span'); p.className = 'aegis-vh'; p.textContent = _msg('errorPrefix'); errorEl.append(p, err); }
    errorEl.hidden = !shown;
});
// summary
const summary = (target, o = {}) => {
    const box = typeof target === 'string' ? formEl.querySelector(target) || document.querySelector(target) : target || (() => { const d = document.createElement('div'); formEl.prepend(d); return d; })();
    box.setAttribute('role', 'alert'); box.tabIndex = -1; box.className ||= 'aegis-error-summary';
    effect(() => {
        const items = Object.keys(fields).filter(k => errors[k].value).map(k => ({ k, msg: errors[k].value, id: _inputs[k].id }));
        box.hidden = !items.length && !errors.$form.value;
        box.innerHTML = '';
        if (box.hidden) return;
        const h = document.createElement(o.heading || 'h2'); h.textContent = errors.$form.value || _msg('summaryTitle', { n: items.length }); box.append(h);
        const ul = document.createElement('ul');
        for (const it of items) { const a = document.createElement('a'); a.href = '#' + it.id; a.textContent = it.msg; a.onclick = (e) => { e.preventDefault(); _inputs[it.k].focus(); _inputs[it.k].scrollIntoView({ block: 'center' }); }; const li = document.createElement('li'); li.append(a); ul.append(li); }
        box.append(ul);
    }, 'wireForm:summary');
    _summaryEl = box; return box;
};
// в submit/validate при провале:
const focusErr = () => { const n = Object.keys(fields).filter(k => errors[k].peek()).length;
    if (_summaryEl && focusOnError !== 'field') _summaryEl.focus({ preventScroll: false });
    else formEl.querySelector('[aria-invalid="true"]')?.focus();
    announce(_msg('summaryTitle', { n }), 'assertive'); };
```

**API:**

```js
wireForm(el, { focusOnError?: 'summary' | 'field' | false; summary?: string | Element | true })
f.summary(target?: string | Element, opts?: { heading?: 'h2' | 'h3' | 'p' }): Element
setValidationMessages({ errorPrefix: 'Error: ', summaryTitle: 'There is a problem ({n})' })
// d.ts: WireFormResult.summary; опция focusOnError
```

**Критерий:** test.html: форма с `<input id="pw" aria-describedby="pw-hint">` → после ошибки `getAttribute('aria-describedby') === 'pw-hint pw-error'`, после исправления — `'pw-hint'`; radio-группа в fieldset: `fieldset.getAttribute('aria-describedby')` содержит id ошибки и оба radio имеют aria-invalid="true"; `f.summary()` + submit с 2 ошибками → `document.activeElement === summaryEl`, в сводке 2 `<a href="#id">`, клик по второй ссылке фокусирует соответствующий input; `formEl.querySelectorAll('[role=status]').length === 0`; announce вызван 1 раз (мок через onWarn/spy на _announcer). Ручная проверка NVDA+Firefox: один анонс «Есть проблема (2)», tab — читает ссылки.

**Источники:** GOV.UK Design System «Error summary» и «Error message» (focus на summary, префикс «Error:», ссылки на поля, ошибка группы на fieldset); WAI-ARIA APG «Form validation» (aria-describedby + focus, без live-регионов на полях); WCAG 2.2 SC 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion; ARIA 1.2 `aria-errormessage`, `aria-invalid`; Adrian Roselli «Avoid Default Field Validation» / «Multiple errors and live regions»; a11ysupport.io aria-errormessage.

### 💎 #31 — Единый a11y-контракт для виртуальной form(): `f.field(key)` + директива `bind:field`

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip; −0.2 KB за счёт выноса общего `_wireInput` из wireForm (сейчас цикл 7071–7182 не переиспользуется)

**Сейчас:** form() (5168–5278) даёт только сигналы; всё a11y — на пользователе. demo/admin.html:161–166: `:aria-invalid=${() => f.errors.name.value ? 'true' : null}` руками, `<span class="err">` без id/describedby, нет touched, нет фокуса на первую ошибку, нет объявления. Пользователи, начавшие с `html``` + form(), получают форму хуже, чем wireForm на серверной разметке, хотя правила, схема и submit — общие (_makeValidator 5044). В wireForm логика «input ↔ signal ↔ a11y» зашита в цикл обнаружения (7071–7182) и недоступна отдельно.

**Предложение:** Извлечь из wireForm функцию `_wireInput(input, ref, ctx)` (readValue, двусторонняя привязка, onInput/onBlur по режиму, errorEl/describedby/aria-invalid через `_describe` из 💎 #2). form() получает `f.field(key)` → FieldRef `{ value, error, issue, touched, validating, id, errorId, key }` и `f.attach(formEl, opts)` (оживить `<form>`, отрендеренную html``, по [name] — тот же цикл, что в wireForm). В html`` добавить модель `bind:field=${f.field('email')}` (парсер уже различает `bind:*` как type 'model' — 1743): она вызывает `_wireInput(el, ref, ctx)`, т.е. bind + touched + a11y одной строкой. Тогда wireForm = form(значения из DOM) + attach — одна реализация вместо двух копий fields/errors/touched/reset/submit (5168–5278 vs 7053–7372).

**Алгоритм:**

```js
// общий обработчик поля (вынос из wireForm)
function _wireInput(input, ref, ctx) {              // ref: { value, error, touched, key }, ctx: { mode, native, formEl, validateField, submitCount }
    const read = () => _readValue(input, ctx.formEl);
    if (ref.value.peek() === undefined || ref.value.peek() === '') ref.value.value = read();   // virtual form: начальное из DOM, если пусто
    effect(() => { if (document.activeElement !== input) _writeValue(input, ref.value.value); }, `field:${ref.key}`);
    on(input, 'input', () => { ref.value.value = read(); ctx.onInput(ref.key); });
    on(input, 'blur', () => { ref.touched.value = true; ctx.onBlur(ref.key); });
    input.id ||= 'f-' + ref.key.replace(/[^\w-]/g, '_');
    const errorEl = _errorElFor(input, ref.key);    // существующий поиск #key-error / .error / создание span
    effect(() => { const err = ref.error.value; input.setAttribute('aria-invalid', err ? 'true' : 'false'); _describe(input, errorEl.id, !!err); errorEl.textContent = err || ''; errorEl.hidden = !err; if (ctx.native && input.setCustomValidity) input.setCustomValidity(err || ''); });
}
// form():
const touched = {}; for (const key of keys) touched[key] = signal(false, `form:${key}:touched`);
const field = (key) => ({ key, value: fields[key], error: errors[key], issue: issues[key], touched: touched[key], validating: V.validating[key], get id() { return 'f-' + key; }, get errorId() { return 'f-' + key + '-error'; } });
const attach = (formEl, o = {}) => { for (const input of formEl.querySelectorAll('[name]')) if (fields[input.name]) _wireInput(input, field(input.name), { ...ctx, formEl }); _form = formEl; };
// html``: в _applyBinding для type 'model' с name === 'field':
if (name === 'field') { _wireInput(el, v, v.$ctx); return; }   // v — FieldRef с ссылкой на контекст формы
```

**API:**

```js
interface FieldRef<T> { key: string; value: Signal<T>; error: Signal<string|null>; issue: ReadonlySignal<string|null>; touched: Signal<boolean>; validating: ReadonlySignal<boolean>; id: string; errorId: string }
form(...).field(key): FieldRef;  form(...).attach(formEl: HTMLFormElement, opts?: { mode?, native? }): void
html`<input bind:field=${f.field('email')} type="email">`   // = bind + touched + aria-invalid + aria-describedby + error span
html`<p id=${f.field('email').errorId}></p>`                  // свой контейнер ошибки, если не хочется авто-span
```

**Критерий:** test.html: `mount(() => html\`<form><input bind:field=${f.field('email')}><p id="f-email-error"></p></form>\`)`; ввод 'x' + blur → `f.touched.email.value === true`, `input.getAttribute('aria-invalid') === 'true'`, `input.getAttribute('aria-describedby') === 'f-email-error'`, `p.textContent === f.errors.email.value`; `f.reset()` → aria-invalid="false", p пуст. Замер: gzip aegis_full после выноса `_wireInput` не больше текущего + 0.2 KB (dedupe wireForm). demo/admin.html:161–166 переписывается в 3 строки без ручных aria-атрибутов.

**Источники:** Svelte 5 `bind:value` + `aria-*` паттерны в sveltekit-superforms (`constraints`, `errors` store per field); Angular Signal Forms (`[field]` directive, единая модель для template- и model-driven); React Aria `useTextField` (возвращает `inputProps`/`errorMessageProps` с описанием); Conform (progressive enhancement: `getInputProps(field)`); WAI-ARIA APG Form validation.

### 💎 #32 — Черновики и защита от потери: `f.guard()` через Navigation API и router, `f.draft()`, нативный reset

**Impact:** 5 · **Effort:** M · **Size:** +0.5 KB gzip (guard ~0.2, draft ~0.25, reset ~0.05), tree-shakeable

**Сейчас:** `guardUnload()` (5155) слушает только `beforeunload` — переход внутри SPA (клик по `<a href="#/users">` в demo/admin.html:172, `r.navigate`, кнопка «назад») уничтожает scope формы и черновик без вопроса. Router имеет `beforeEach(to, from)` (8221), но его результат игнорируется — отменить переход нельзя; `navigate`-событие (8388–8411) не проверяет `e.cancelable`. Черновиков нет: `persisted()` (4280) существует, но с формой не связан — нет `f.draft(key)`, нет очистки при успешном submit, нет восстановления. Нативный `<button type="reset">` сбрасывает DOM к defaultValue без input-событий: эффекты 7124–7135 пишут только signal→DOM, поэтому сигналы и `dirty` остаются старыми (обработчика 'reset' в файле нет).

**Предложение:** (a) `f.guard(opts)` заменяет guardUnload (тот остаётся алиасом): `beforeunload` при dirty; в Navigation API — `navigate`-слушатель, который при `dirty && e.cancelable && !e.formData` вызывает `opts.confirm(to)` (Promise<boolean> — свой `<dialog>`; по умолчанию `confirm(_msg('unsaved'))`) и `e.preventDefault()` при отказе; для traverse (back) Chrome ≥ 116 разрешает preventDefault при user activation — иначе fallback: переход разрешён, но черновик уже сохранён (b). Router: `beforeEach` может вернуть `false | Promise<boolean>` — `handleRoute` (8209–8221) ждёт и блокирует как guard. (b) `f.draft(key, { storage = sessionStorage, debounce = 300, ttl, restore })`: сохраняет `changes` (только изменённые поля, без файлов и паролей — `input.type === 'password'|'file'` исключаются) на каждый input и на `pagehide`; при монтировании, если черновик есть и отличается от initial — `restore(draft, apply)` (по умолчанию применяет и `announce(_msg('draftRestored'))`); `commit()`/успешный submit/`reset()` → `clear()`. wireForm: атрибут `data-aegis-draft="key"` включает автоматически. (c) `on(formEl, 'reset', () => { e.preventDefault(); reset(); announce(_msg('formReset')); })` + Escape в поле возвращает значение поля к initial (opt-in `escapeResets: true`).

**Алгоритм:**

```js
const guard = (o = {}) => {
    const ask = o.confirm || ((to) => Promise.resolve(confirm(_msg('unsaved'))));
    const offs = [on(window, 'beforeunload', (e) => { if (dirty.peek() && !submitting.peek()) { e.preventDefault(); e.returnValue = ''; } })];
    if (typeof navigation !== 'undefined') offs.push(on(navigation, 'navigate', (e) => {
        if (!dirty.peek() || submitting.peek() || !e.cancelable || e.formData || e.downloadRequest !== null) return;
        if (new URL(e.destination.url).href === location.href) return;
        e.preventDefault();                                   // синхронно; решение — асинхронно
        ask(e.destination.url).then(ok => { if (ok) { _skipOnce = true; navigation.navigate(e.destination.url, { history: e.navigationType === 'replace' ? 'replace' : 'push' }); } });
    }));
    if (_currentScope) _currentScope.onDispose(() => offs.forEach(f => f()));
    return () => offs.forEach(f => f());
};
// _skipOnce проверяется первой строкой слушателя и сбрасывается.
const draft = (key, o = {}) => {
    const store = o.storage || sessionStorage;
    const pick = () => { const c = changes.peek(); for (const k of Object.keys(c)) { const i = _inputs && _inputs[k]; if (i && (i.type === 'password' || i.type === 'file')) delete c[k]; } return c; };
    const write = debounced(() => { try { Object.keys(pick()).length ? store.setItem(key, JSON.stringify({ t: Date.now(), v: pick() })) : store.removeItem(key); } catch (e) { _warn('E021', ...); } }, o.debounce ?? 300);
    let saved = null; try { saved = JSON.parse(store.getItem(key)); } catch (e) {}
    if (saved && (!o.ttl || Date.now() - saved.t < o.ttl)) {
        const apply = () => batch(() => { for (const [k, v] of Object.entries(saved.v)) { const fk = keyOf(k); if (fk) fields[fk].value = v; } announce(_msg('draftRestored')); });
        o.restore ? o.restore(saved.v, apply) : apply();
    }
    const stop = effect(() => { changes.value; untrack(write); }, 'form:draft');
    on(window, 'pagehide', () => write.flush ? write.flush() : write());
    const clear = () => { try { store.removeItem(key); } catch (e) {} };
    _onCommit.push(clear);                                   // commit()/reset()/успешный submit
    return { clear, stop };
};
// router.handleRoute (8221): if (beforeEach) { const b = await beforeEach(to, from); if (b === false) return 'blocked'; }
```

**API:**

```js
f.guard(opts?: { confirm?: (toUrl: string) => boolean | Promise<boolean> }): () => void    // guardUnload остаётся алиасом guard()
f.draft(key: string, opts?: { storage?: Storage; debounce?: number; ttl?: number; restore?: (values, apply: () => void) => void }): { clear(): void; stop(): void }
wireForm(el, { draft?: string | true; guard?: boolean | GuardOpts; escapeResets?: boolean })   // true → key = action + name
<form data-aegis-draft="user:42">                        // авто для island-форм
router(routes, { beforeEach?: (to, from) => void | boolean | Promise<boolean> })
```

**Критерий:** test.html: (1) wireForm + f.draft('t1') с sessionStorage-моком; изменить поле, `await wait(350)` → в storage `{v:{email:'x'}}`; поле password изменено — в storage его нет; новый wireForm на такой же форме → `fields.email.value === 'x'` и announce вызван; успешный submit → ключ удалён. (2) Нативный reset: `formEl.reset()` (диспатч 'reset') → `f.fields.email.value` = initial, `f.dirty.value === false`. (3) guard: мок `navigation` (объект с addEventListener и navigate-спаем) → dispatch NavigateEvent-подобного объекта с `cancelable: true` при dirty → `preventDefault` вызван, confirm-мок вернул false → navigate не вызван; вернул true → navigate вызван 1 раз. (4) router: `beforeEach: () => false` → `r.navigate('/b')` оставляет `r.route.value === '/a'`. Ручная проверка Chrome 128: кнопка «назад» на грязной форме показывает диалог.

**Источники:** WHATWG HTML Navigation API: `NavigateEvent.cancelable`, `preventDefault()` для same-document навигаций (Chrome 116+ разрешил для traverse при user activation); MDN `beforeunload` (Chrome игнорирует текст, требует preventDefault); Page Lifecycle API — `pagehide` вместо `unload` для bfcache; React Router `useBlocker`/`unstable_usePrompt`; Remix/Conform «unsaved changes»; GOV.UK «Save and come back later» паттерн; WCAG 2.2 SC 3.3.7 Redundant Entry.

### 💎 #33 — Жизненный цикл отправки: `status`-машина, отменяемый submit, управление submitter, PRG через router

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip внутри form/wireForm

**Сейчас:** Состояние отправки — булев `submitting` (5222, 7229) + `aria-busy`/`data-submitting` на форме (7306–7307). Нет: (a) отмены — handler не получает `{ signal }`, уход со страницы/dispose scope не прерывает fetch (V.abortAll на dispose касается только валидации: 7331), Escape ничем не занят; (b) управления кнопкой — GOV.UK и React 19 `useFormStatus` дают submitter'у pending-состояние, у нас пользователь сам пишет `?disabled=${save.pending}` (demo/admin.html:170), а `disabled` на кнопке в фокусе выбрасывает фокус на body — SR теряет контекст; (c) успеха — `result` заполняется, но ничего не объявляется, `status` для CSS нет; (d) PRG: `response.redirected` → `location.assign(response.url)` (5246, 7277) — полная перезагрузка даже в SPA с router, хотя рядом Navigation API; `onRedirect` глобален, а не на форму (form(): только _config.onRedirect, 5244); (e) 429/503 с `Retry-After` — уже парсится в request() (фаза 4 кэша), но форма показывает `HTTP 429` (5255, 7292) без времени ожидания.

**Предложение:** `f.status: Signal<'idle'|'validating'|'submitting'|'success'|'error'>` + `formEl.dataset.status` для CSS; `submitting` остаётся computed от status. Handler получает второй аргумент `{ signal, submitter, event }`; `f.abort()`; `abort` на dispose и в `guard()` при подтверждённом уходе; opt-in `escapeAborts: true`. Submitter: на время submit `aria-disabled="true"` + `data-pending` (не `disabled` — фокус сохраняется), повторный клик игнорируется double-submit guard (7304); `f.pendingText` — текст кнопки из `data-pending-text`. Успех: `announce(_msg('saved'))` при `status='success'`, если результат не редирект (opt-out `announceSuccess: false`). PRG: `onRedirect: 'router'` — `navigation.navigate(response.url)` если есть Navigation API и router перехватит, иначе `location.assign`; опция на форму `wireForm(el, { onRedirect })`. Ошибки статусов: 429/503 → `$form = _msg('retryAfter', { s })` из `e.retryAfter` HttpError, 401 → `_msg('unauthorized')`, 413 → `_msg('tooLarge')`, остальное — как сейчас.

**Алгоритм:**

```js
const status = signal('idle', 'form:status');
const submitting = computed(() => status.value === 'submitting' || status.value === 'validating');
let ctl = null;
const abort = () => { if (ctl) ctl.abort(); };
const submit = (handler) => { ...; return async (e) => {
    e?.preventDefault();
    if (submitting.peek()) return;
    ctl = new AbortController();
    const submitter = e && e.submitter || formEl.querySelector('button:not([type=button]),input[type=submit]');
    const setBtn = (onOff) => { if (!submitter) return; submitter.toggleAttribute('data-pending', onOff); submitter.setAttribute('aria-disabled', onOff ? 'true' : 'false'); if (onOff && submitter.dataset.pendingText) { submitter._t = submitter.textContent; submitter.textContent = submitter.dataset.pendingText; } else if (!onOff && submitter._t != null) { submitter.textContent = submitter._t; submitter._t = null; } };
    batch(() => { status.value = 'validating'; submitError.value = null; errors.$form.value = null; submitCount.value++; });
    formEl.dataset.status = 'validating'; formEl.setAttribute('aria-busy', 'true'); setBtn(true);
    try {
        for (const k of Object.keys(fields)) touched[k].value = true;
        if (!(await V.validateAsync())) { status.value = 'error'; focusErr(); return; }
        status.value = 'submitting'; formEl.dataset.status = 'submitting';
        const r = fn ? await fn(values.peek(), { signal: ctl.signal, submitter, event: e }) : await serverSubmit(e, { ...sopts, signal: ctl.signal });
        if (ctl.signal.aborted) { status.value = 'idle'; return; }
        result.value = r; status.value = 'success';
        if (!(r && r.redirected) && sopts.announceSuccess !== false) announce(_msg('saved'));
        return r;
    } catch (err) {
        if (err?.name === 'AbortError') { status.value = 'idle'; return; }
        _applySubmitError(err);                                  // 422→setErrors, 429/503→retryAfter, 401, 413, иначе message
        status.value = 'error';
    } finally { formEl.dataset.status = status.peek(); formEl.removeAttribute('aria-busy'); setBtn(false); ctl = null; }
}; };
if (opts.escapeAborts) on(formEl, 'keydown', (e) => { if (e.key === 'Escape' && submitting.peek()) { e.preventDefault(); abort(); } });
if (_currentScope) _currentScope.onDispose(() => { V.abortAll(); abort(); });
// PRG:
const _redirect = (response, r) => { if (typeof r === 'function') return r(response);
    if (r === 'none') return; if (r === 'router' && typeof navigation !== 'undefined' && new URL(response.url).origin === location.origin) return navigation.navigate(response.url, { history: 'replace' });
    location.assign(response.url); };
```

**API:**

```js
f.status: Signal<'idle'|'validating'|'submitting'|'success'|'error'>;  f.abort(): void
f.submit((values, ctx: { signal: AbortSignal; submitter: HTMLElement | null; event: SubmitEvent | undefined }) => Promise<R>)
wireForm(el, { onRedirect?: 'assign' | 'router' | 'none' | (r: Response) => void; announceSuccess?: boolean; escapeAborts?: boolean })
configure({ onRedirect: 'router' })          // глобально; форма может переопределить
<button data-pending-text="Сохраняем…">Сохранить</button>   // текст на время submit; [data-pending] / form[data-status="submitting"] для CSS
setValidationMessages({ saved: 'Saved', retryAfter: 'Try again in {s} s', unauthorized: 'Please sign in again', tooLarge: 'File is too large' })
```

**Критерий:** test.html: (1) handler с `await wait(50)`; submit → `f.status.value === 'submitting'`, `submitter.getAttribute('aria-disabled') === 'true'`, `document.activeElement === submitter` (фокус не потерян), textContent === data-pending-text; `f.abort()` → handler получил `signal.aborted === true`, status 'idle', кнопка восстановлена, announce не вызван. (2) успешный submit → status 'success', announce('Saved') 1 раз. (3) mockFetch 429 с `Retry-After: 7` → `errors.$form.value` содержит '7'. (4) configure({ onRedirect: 'router' }) + мок navigation.navigate → Response с redirected:true и text/html → navigate вызван с response.url, location.assign не вызван. (5) scope.dispose() во время submit → fetch-мок увидел abort.

**Источники:** React 19 `useFormStatus`/`useActionState` (pending, data, submitter), React Router `useNavigation().state` ('idle'|'submitting'|'loading'); GOV.UK «Button — prevent double clicks» (не disabled, а игнор в течение 1 с); HTMX `hx-disabled-elt`, `hx-indicator`, `HX-Redirect`; WAI-ARIA APG «aria-disabled vs disabled» (сохранение фокуса); RFC 9110 §10.2.3 Retry-After; WHATWG HTML `SubmitEvent.submitter`, `form.requestSubmit(submitter)`; Navigation API `navigation.navigate()`.

### 💎 #34 — Гигиена живых регионов и wizard: две aria-live зоны, дедуп, шаги с фокусом и «Шаг 2 из 3»

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip (announce ~0.1, wizard ~0.1)

**Сейчас:** `announce()` (7563–7580) держит один узел и переключает на нём `aria-live` между polite/assertive (7574) — VoiceOver и NVDA часто не подхватывают смену политики на уже существующем регионе, а запись через `setTimeout(0)` (7579) после очистки в том же тике иногда теряется в Safari/VoiceOver (нужна пауза ~50–100 мс или отдельный узел). Нет дедупа: 5 ошибок → 5 `announce(...,'assertive')` подряд (7234, 7321 + 💎 #2) — читается последняя. Wizard (7335–7360): `next()` скрывает/показывает `[data-step]`, но фокус остаётся на нажатой кнопке (или пропадает, если она внутри скрытого шага), шаг не объявляется, нет `aria-current="step"`/индикатора прогресса, `firstInvalid` (7311) может выбрать поле скрытого шага (hidden не фильтруется), Enter в поле последнего шага отправляет форму, а в промежуточном — тоже отправляет вместо `next()`.

**Предложение:** announce: два постоянных узла (`role="status"` polite и `role="alert"` assertive), созданных лениво; запись через `requestAnimationFrame` + `setTimeout(50)`; очередь с коалесценцией в одном тике — последнее сообщение каждого уровня побеждает, одинаковый текст дважды подряд повторяется через zero-width-space (уже есть «clear then write»). Wizard: `next()`/`prev()` фокусируют первый focusable нового шага (или заголовок шага с `tabindex=-1`), объявляют `_msg('step', { n, total })`, ставят `aria-current="step"` на `[data-step-indicator] li`/сам шаг, `firstInvalid` фильтрует `:not([hidden] *)`; Enter в поле не последнего шага → `next()` (opt-out `enterAdvances: false`); при провале `next()` — та же focusErr из 💎 #2 в пределах шага. `f.progress: computed<{ step, total, percent }>` для полосы прогресса.

**Алгоритм:**

```js
const _live = {};
let _q = null;
export function announce(message, politeness = 'polite') {
    const node = _live[politeness] || (_live[politeness] = (() => { const d = document.createElement('div'); d.setAttribute('aria-live', politeness); d.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status'); d.setAttribute('aria-atomic', 'true'); d.className = 'aegis-vh'; Object.assign(d.style, _VH); document.body.appendChild(d); return d; })());
    (_q || (_q = new Map())).set(politeness, message);
    if (_q.size === 1) requestAnimationFrame(() => { const q = _q; _q = null; for (const [p, m] of q) { const n = _live[p]; n.textContent = ''; setTimeout(() => { n.textContent = n._last === m ? m + '​' : m; n._last = m; }, 50); } });
}
// wizard
const goto = (i) => {
    step.value = i;                                            // effect на 7343 скрывает/показывает
    queueMicrotask(() => { const el = stepEls[i]; const t = el.querySelector('[data-autofocus]') || el.querySelector(_FOCUSABLE) || el; if (t === el && !el.hasAttribute('tabindex')) el.tabIndex = -1; t.focus(); });
    stepEls.forEach((el, k) => k === i ? el.setAttribute('aria-current', 'step') : el.removeAttribute('aria-current'));
    announce(_msg('step', { n: i + 1, total: stepCount }));
};
nextStep = () => { ...; if (!ok) { focusErr(stepEls[step.peek()]); return false; } if (step.peek() < stepCount - 1) goto(step.peek() + 1); return ok; };
on(formEl, 'keydown', (e) => { if (e.key === 'Enter' && enterAdvances && step && step.peek() < stepCount - 1 && e.target.tagName === 'INPUT' && e.target.type !== 'submit') { e.preventDefault(); nextStep(); } });
const firstInvalidIn = (root) => [...root.querySelectorAll('[aria-invalid="true"]')].find(el => !el.closest('[hidden]'));
const progress = step && computed(() => ({ step: step.value + 1, total: stepCount, percent: Math.round((step.value + 1) / stepCount * 100) }), 'wireForm:progress');
```

**API:**

```js
announce(message: string, politeness?: 'polite' | 'assertive'): void   // сигнатура прежняя; поведение — 2 узла, коалесценция в кадре
wireForm(el, { enterAdvances?: boolean })   // по умолчанию true при stepCount > 1
f.progress: ReadonlySignal<{ step: number; total: number; percent: number }> | null
f.goto(i: number): void
<ol data-step-indicator><li>…</li></ol>      // получает aria-current="step" на активном li
setValidationMessages({ step: 'Step {n} of {total}' })
```

**Критерий:** test.html: `announce('a'); announce('b')` в одном тике → после кадра+60 мс polite-узел содержит 'b', вызовов записи textContent (spy через MutationObserver) ≤ 2; `announce('x','assertive')` пишет в отдельный узел с role="alert", polite-узел не тронут; `announce('a'); await 70; announce('a')` → второй текст отличается от первого (zero-width space). Wizard: `f.next()` → `document.activeElement` внутри steps[1], `steps[1].getAttribute('aria-current') === 'step'`, `f.progress.value.percent === 67` при 3 шагах; невалидный шаг 0 → фокус на поле шага 0, `f.step.value === 0`; Enter в input шага 0 → `f.step.value === 1`, submit-событие не диспатчено. Существующие тесты wizard (test.html:4430–4462) и announce (4528) проходят.

**Источники:** WAI-ARIA APG «Live regions» и «Alert pattern»; Scott O'Hara «Are we live?» (проблемы смены aria-live и тайминга, два региона); Sarah Higley «Live regions» (throttle/дедуп); GOV.UK «Question pages» (один вопрос на страницу, фокус на заголовок после перехода); WAI-ARIA 1.2 `aria-current="step"`; WCAG 2.2 SC 2.4.3 Focus Order, 4.1.3 Status Messages.

## 🔭 files-wizards-arrays

**Линза:** Сложные формы: массивы полей (field arrays: добавить/удалить/переставить с сохранением состояния и ключей), вложенные объекты и точечные пути, многошаговые мастера с сохранением шагов, файлы (секция 17: maxSize/mime/maxFiles, прогресс загрузки, resumable/chunked, превью, drag-drop), серверно-отрендеренные формы (wireForm) и их прогрессивное улучшение, тестирование форм через aegis-test.js (render/fire/mockFetch). Сравни с TanStack Form arrays, Formik FieldArray, Angular FormArray, Uppy/tus для файлов, Conform для progressive enhancement.

**Вывод:** Aegis сильнее конкурентов там, где форма живёт на сервере: мост с Constraint Validation API (noValidate + setCustomValidity + сообщения браузера, aegis_full.js:7062, 7100–7107, 7180), Standard Schema и async-правила с версионированием/AbortSignal/debounce (5027–5121), вложенные имена items[0][qty]/address.city в values и setErrors (4989–5010, 5285–5325), разбор серверных ошибок DRF/Laravel/RFC 9457, поток редактирования setInitial(resource.data)/commit/changes (5126–5160) — этого нет ни у Formik, ни у TanStack Form, и это на уровне Conform. Отстаёт в четырёх местах. (1) Форма — фиксированной формы: поля создаются один раз (5175, 7082), values/valid/dirtyFields итерируют статический Object.keys(fields) (5195, 7214) — нет field arrays уровня TanStack pushValue/removeValue/moveValue, Formik FieldArray, Angular FormArray, хотя wildcard-правила items[].qty уже частично распознаются (7115). (2) Файлы заканчиваются на валидации и превью первого файла (5333–5341, 7244–7259): нет прогресса, resumable/chunked (tus), direct upload → hidden id, drag-drop/paste/папок; form().submit(url) с File в values теряет файлы через JSON.stringify (5236 → 1372). (3) Мастер (7334–7365) есть только в wireForm, проверяет только sync-правила (7354), без сохранения шагов, истории, a11y. (4) Progressive enhancement ломается на HTML-ответе 422 (Rails/Django/Laravel по умолчанию) — пользователь видит только «HTTP 422» (7284), formnovalidate игнорируется (7311), кнопки с name становятся полями (7082). Тестирование форм через aegis-test.js требует ручного DataTransfer и парсинга FormData (test.html:1748, 2052).

**Отвергнуто:** 1) Standard Schema, async-правила с отменой, вложенные пути, setInitial/commit/changes/guardUnload, серверный submit FormData + 422 JSON + PRG, focus первого невалидного, файловые правила maxSize/mime/maxFiles, preview(), formData(), мост с Constraint Validation — всё уже сделано (5027–5160, 5333–5341, 7100–7107, 7201–7205, 7241–7291). 2) Черновик через persisted() + setInitial вручную — возможно сегодня, но setInitial сбрасывает initials и dirty=false, что для черновика неверно; поэтому draft() в п.3, а не «рецепт». 3) form() как reactive()-прокси values (Vue-стиль) — два контракта на одно и то же; сигнал на поле — контракт Aegis, values computed уже есть. 4) XHR внутри request() ради прогресса — request() построен на fetch (композиция signal, streams, breaker, Aegis-Invalidate); прогресс — только в upload(). 5) Параллельные чанки (Uppy) — ядро tus 1.0.0 требует последовательных offset, расширение Concatenation усложняет v1. 6) Сжатие изображений перед отправкой по умолчанию — молчаливая потеря качества; даунскейл только для превью (thumb). 7) Встроенный DSL схем (zod-lite) — Standard Schema покрывает, размер. 8) fields как Proxy с ленивым созданием полей — скрывает форму данных, ломает Object.keys; явный addField/fieldArray лучше. 9) Виртуализация огромных форм — редкий случай, virtualScroll уже есть. 10) form-level rules validate(values) → $form — мелочь, легко делается schema; не бриллиант. 11) Интеграция шага мастера с router() — покрыто опцией history в wizard() через Navigation API без зависимости от router.

### 💎 #35 — Field arrays: fieldArray(f, 'items') с устойчивыми ключами строк и перенумерацией имён

**Impact:** 5 · **Effort:** L · **Size:** +0.25 KB gzip в ядре form/wireForm (shape-сигнал, addField/removeField/renameField, wireInput()); +0.9 KB gzip fieldArray() — отдельный export, tree-shakeable

**Сейчас:** form() создаёт поля один раз из Object.entries(schemaOrDefaults) (aegis_full.js:5175), wireForm — из formEl.querySelectorAll('[name]') (7082); values/valid/dirtyFields/validating.$any итерируют статический Object.keys(fields) (5029, 5145, 5190, 5195, 7214), поэтому поле, добавленное позже, невидимо для валидации, dirty и values. Массив по умолчанию form({ items: [{qty:1}] }) превращается в ОДИН сигнал с массивом — правило на items[].qty применить нельзя (rules ключуются точным именем, 5181), хотя wireForm уже распознаёт wildcard items[].qty (7115) — половина намерения без реализации. Тело цикла подключения input (7083–7186) — inline, переиспользовать для новых элементов нельзя. Удаление строки в серверной форме требует ручной перенумерации name, иначе FormData(formEl) (7241, 7266) и setErrors('items.1.qty') расходятся. Мастер обращается к touched[input.name] (7354) — для поля, добавленного после wireForm, это TypeError.

**Предложение:** Ядро: форма становится растущей — приватный сигнал shape и три операции addField(key, initial, rules)/removeField(key)/renameField(from, to), которые двигают один и тот же объект сигнала между ключами (fields, errors, _initials, _rules, touched, _inputs, validating) и инкрементируют shape; values/valid/dirtyFields/validating.$any читают shape.value. В wireForm тело цикла 7083–7186 выносится в wireInput(input) и публикуется как f.wire(el)/f.rewire(). Поверх — export fieldArray(f, path, { row, rules, name, template, container }): строки с внутренними монотонными ключами (key = ++seq), push/insert/remove/move/swap/replace, rows — сигнал [{ key, index, field(sub) }]; имена items[i][sub] перенумеровываются при insert с конца, при remove — с начала (нет коллизий); для wireForm — клон <template> с плейсхолдером [] или __i__ в name, вставка в container, f.wire() на новые input, при remove — el.remove() + переименование name/id error-элементов в DOM, чтобы FormData(formEl) был верен. reset() возвращает исходное число строк; setErrors('items.1.qty') попадает в актуальную строку через keyOf. Рендер в html``: list(items.rows, row => html`<input bind:value=${row.field('qty')}>`, 'key') — ключ строки стабилен, DOM переиспользуется (list 2786). Совместимость: fieldArray на существующем поле-массиве забирает его значение как начальные строки и удаляет плоский сигнал.

**Алгоритм:**

```js
// ядро form()/wireForm() — форма растёт
const shape = signal(0, 'form:shape');
const addField = (key, initial, rules = []) => {
    if (fields[key]) return fields[key];
    _initials[key] = signal(initial, `form:${key}:initial`); fields[key] = signal(initial, `form:${key}`);
    errors[key] = signal(null, `form:${key}:error`); _rules[key] = rules;
    if (touched) touched[key] = signal(false, `form:${key}:touched`);
    V.track(key);                                   // validating[key] = signal(false)
    watch(fields[key], () => { errors[key].value = null; });
    shape.value++;
    return fields[key];
};
const removeField = (key) => { if (!fields[key]) return; V.abort(key); for (const m of [fields, errors, _initials, _rules, touched, _inputs, V.validating]) if (m) delete m[key]; shape.value++; };
const renameField = (from, to) => { if (from === to) return; for (const m of [fields, errors, _initials, _rules, touched, _inputs, V.validating]) if (m && from in m) { m[to] = m[from]; delete m[from]; } shape.value++; };
const values = computed(() => { shape.value; for (const k of Object.keys(fields)) fields[k].value; return _nestValues(fields); }, 'form:values');

// отдельный export
export function fieldArray(f, path, aopts = {}) {
    const base = _normPath(path), subs = Object.keys(aopts.row || {});
    const nameOf = aopts.name || ((i, sub) => `${base}[${i}]` + (sub ? `[${sub}]` : ''));
    const rulesOf = (sub) => (aopts.rules && aopts.rules[sub]) || f._wildcardRules(`${base}[].${sub}`) || [];
    let seq = 0;
    const rows = signal([], `array:${base}`);       // [{ key, index }]
    const renum = (list, order) => { for (const i of order) { const r = list[i]; if (r.index === i) continue; for (const s of subs) f.renameField(nameOf(r.index, s), nameOf(i, s)); r.index = i; } };
    const insert = (i, init = aopts.row) => batch(() => {
        const list = rows.peek().slice(); const row = { key: ++seq, index: -1, field: (s) => f.fields[nameOf(row.index, s)] };
        list.splice(i, 0, row);
        renum(list, [...list.keys()].reverse().filter(j => j > i));        // хвост — с конца, без коллизий имён
        for (const s of subs) f.addField(nameOf(i, s), init[s], rulesOf(s));
        row.index = i;
        if (aopts.template) _mountRow(row, i);                                 // wireForm: клон <template>, name с [] → [i], затем f.wire(el)
        rows.value = list;
    });
    const remove = (i) => batch(() => {
        const list = rows.peek().slice(); const [row] = list.splice(i, 1);
        row.el?.remove(); for (const s of subs) f.removeField(nameOf(i, s));
        renum(list, [...list.keys()].filter(j => j >= i));                    // голова — с начала
        rows.value = list;
    });
    const move = (from, to) => batch(() => { const list = rows.peek().slice(); const [r] = list.splice(from, 1); list.splice(to, 0, r);
        const tmp = {}; for (const s of subs) f.renameField(nameOf(from, s), `${base}[__tmp]`); /* через временное имя, затем renum всех */ renum(list, from < to ? [...list.keys()].filter(j => j >= from && j <= to).reverse() : [...list.keys()].filter(j => j >= to && j <= from)); rows.value = list; });
    const push = (init) => insert(rows.peek().length, init);
    const replace = (arr) => batch(() => { while (rows.peek().length) remove(rows.peek().length - 1); arr.forEach(push); });
    if (Array.isArray(f.fields[base]?.peek())) { const seed = f.fields[base].peek(); f.removeField(base); replace(seed); }   // совместимость
    return { rows, push, insert, remove, move, swap: (a, b) => { move(a, b); if (Math.abs(a - b) > 1) move(b + (a < b ? -1 : 1), a); }, replace, length: computed(() => rows.value.length) };
}
```

**API:**

```js
// aegis.d.ts
interface FormCore { addField(key: string, initial?: unknown, rules?: AsyncValidationRule[]): Signal<unknown>; removeField(key: string): void; renameField(from: string, to: string): void }
interface WireFormResult { wire(el: Element): void; rewire(): void }   // подключить input/контейнер, добавленные после wireForm()
export interface FieldArrayRow { key: number; index: number; field(sub: string): Signal<any>; el?: Element }
export interface FieldArray<R> { rows: ReadonlySignal<FieldArrayRow[]>; length: ReadonlySignal<number>; push(init?: Partial<R>): void; insert(i: number, init?: Partial<R>): void; remove(i: number): void; move(from: number, to: number): void; swap(a: number, b: number): void; replace(rows: R[]): void }
export function fieldArray<R extends Record<string, any>>(f: FormCore | WireFormResult, path: string, opts?: { row?: R; rules?: { [K in keyof R]?: AsyncValidationRule[] }; name?: (i: number, sub?: string) => string; template?: string | HTMLTemplateElement; container?: Element }): FieldArray<R>;
// HTML-сахар для wireForm: <template data-array="items"> … name="items[][qty]" … </template> <button data-array-add="items"> <button data-array-remove>
```

**Критерий:** test.html, section('💎 field arrays'): const f = form({ title: '' }, { rules: { 'items[].qty': [min(1)] } }); const items = fieldArray(f, 'items', { row: { qty: 1, sku: '' } }); items.push({ qty: 2, sku: 'a' }); items.push({ qty: 0, sku: 'b' }); items.push({ qty: 5, sku: 'c' }); assert(f.values.value.items.length === 3 && f.fields['items[1][qty]'].value === 0 && f.dirty.value === true); const sigB = f.fields['items[1][sku]']; items.remove(0); assert(f.fields['items[0][sku]'] === sigB && f.values.value.items.map(r => r.sku).join() === 'b,c'); assert(f.validate() === false && f.errors['items[0][qty]'].value !== null); items.move(0, 1); assert(f.values.value.items[1].sku === 'b' && f.errors['items[1][qty]'].value !== null); f.setErrors({ 'items.0.qty': ['x'] }); assert(f.errors['items[0][qty]'].value === 'x'); DOM: const ul = list(items.rows, r => html`<li>${text(r.field('sku'))}</li>`, 'key'); const li1 = ul.children[1]; items.remove(0); assert(ul.children[0] === li1). wireForm: <form><template data-array="items"><input name="items[][qty]" required></template><div data-array-container="items"></div></form>; items.push(); items.push(); assert([...new FormData(formEl).keys()].join() === 'items[0][qty],items[1][qty]'); items.remove(0); assert([...new FormData(formEl).keys()].join() === 'items[0][qty]' && formEl.querySelectorAll('[data-array-row]').length === 1); f.reset() → rows.length === 0. Регресс: старые тесты 3945–3985, 4361–4470 без изменений.

**Источники:** TanStack Form — field arrays (pushValue/insertValue/removeValue/moveValue/swapValue, mode='array'); Formik <FieldArray> helpers; Angular FormArray (push/removeAt/insert/clear); Conform.js intent.insert/remove/reorder с server round-trip; React Hook Form useFieldArray (keyName 'id', стабильные ключи строк); HTML Living Standard §4.10.21 Form submission — имена с [] как их ждут PHP/Rails/Laravel (parse_str / Rack::Utils.parse_nested_query).

### 💎 #36 — upload(): прогресс, tus-resumable чанки, direct upload в hidden-поле; form().submit с File → multipart

**Impact:** 5 · **Effort:** L · **Size:** +1.4 KB gzip upload() — отдельный export, tree-shakeable; +0.2 KB f.upload() в wireForm; +0.15 KB _toFormData() в form().submit; _prep() — вынос из request(), ±0

**Сейчас:** request() (aegis_full.js:1350) — fetch без прогресса отправки; serverSubmit (7261–7266) шлёт весь FormData одним запросом: 200 МБ видео на мобильной сети = ни прогресса, ни паузы, ни повторной попытки с середины, при 502 всё с нуля. form().submit(url) кладёт values.peek() в body (5236) → request() делает JSON.stringify для не-BodyInit объектов (1372–1375) → File сериализуется в {} — файлы виртуальной формы молча теряются. Нет direct-upload паттерна (ActiveStorage/Shrine/S3 presigned: файл уходит отдельно, форма несёт id) — большой файл держит форму занятой и повторно отправляется при 422. preview() существует (7244), но прогресса/скорости/ETA — сигналов нет.

**Предложение:** Export upload(file, url, opts) → объект с сигналами progress/loaded/speed/eta/status/error/result/location и методами start/pause/resume/abort (thenable). Два протокола: 'multipart' (один POST, прогресс через XHR upload.onprogress; при configure({ fetch }) — через fetch, чтобы тесты и моки работали) и 'tus' (chunk задан): POST с Upload-Length/Upload-Metadata → Location; PATCH application/offset+octet-stream по чанкам с Upload-Offset; при обрыве/resume — HEAD → Upload-Offset и продолжение; fingerprint name-size-lastModified → localStorage['aegis:tus:…'] = Location, так что перезагрузка страницы продолжает загрузку (как tus-js-client/Uppy); повтор чанка с backoff через существующий _retryable/_retryAfterMs; Retry-After уважается. Подготовка url/baseURL/CSRF-заголовков выносится из request() в _prep(url, init), чтобы upload() не дублировал логику. Интеграция с формами: f.upload(key, { url, chunk, as }) — на выбор файла стартует загрузка, по завершении вставляет <input type="hidden" name="${key}_id"> с ответом сервера (id/url), файловый input отключается на время serverSubmit (disabled не попадает в FormData); f.submit ждёт uploads.$any === false; <progress data-upload="avatar"> биндится автоматически. form().submit(url): если в values есть File/Blob или sopts.as === 'formdata' — тело собирается _toFormData(values) с bracket-именами items[0][file] вместо JSON.

**Алгоритм:**

```js
export function upload(file, url, uopts = {}) {
    const { chunk = 0, protocol = chunk ? 'tus' : 'multipart', field = 'file', headers = {}, retries = 3, meta = {}, fingerprint = `${file.name}-${file.size}-${file.lastModified}` } = uopts;
    const size = _bytes(chunk), total = file.size;
    const loaded = signal(0, 'upload:loaded'), status = signal('idle', 'upload:status'), error = signal(null), result = signal(null), location = signal(null, 'upload:location');
    const progress = computed(() => total ? loaded.value / total : 1);
    let t0 = 0, ctrl = null;
    const speed = computed(() => { const dt = (performance.now() - t0) / 1000; return dt > 0.5 ? loaded.value / dt : 0; });
    const eta = computed(() => speed.value ? (total - loaded.value) / speed.value : null);
    const send = (u, init, onProgress) => {                          // XHR ради прогресса; при _config.fetch — fetch (тесты/моки)
        const { url: fu, headers: fh } = _prep(u, init);              // baseURL + CSRF как в request()
        if (_config.fetch) return _config.fetch(fu, { ...init, headers: fh, signal: ctrl.signal }).then(r => (onProgress(init.body.size || 0), r));
        return new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open(init.method, fu); fh.forEach((v, k) => x.setRequestHeader(k, v));
            x.upload.onprogress = (e) => onProgress(e.loaded); x.onload = () => res(new Response(x.response, { status: x.status, headers: _xhrHeaders(x) })); x.onerror = () => rej(new TypeError('network')); ctrl.signal.addEventListener('abort', () => x.abort(), { once: true }); x.onabort = () => rej(new DOMException('aborted', 'AbortError')); x.send(init.body); });
    };
    const withRetry = async (fn) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (e.name === 'AbortError' || i >= retries || !_retryable(e)) throw e; await new Promise(r => setTimeout(r, Math.max(_retryAfterMs(e), 300 * 2 ** i))); } } };
    const tusHeaders = { 'Tus-Resumable': '1.0.0', ...headers };
    const create = () => withRetry(async () => { const r = await send(url, { method: 'POST', headers: { ...tusHeaders, 'Upload-Length': String(total), 'Upload-Metadata': Object.entries({ filename: file.name, filetype: file.type, ...meta }).map(([k, v]) => `${k} ${btoa(unescape(encodeURIComponent(v)))}`).join(',') } }, () => {}); if (r.status !== 201) throw new HttpError(r.status, r, null); return new URL(r.headers.get('Location'), url).href; });
    const offsetOf = (loc) => withRetry(async () => { const r = await send(loc, { method: 'HEAD', headers: tusHeaders }, () => {}); if (r.status === 404 || r.status === 410) return null; return Number(r.headers.get('Upload-Offset')) || 0; });
    const patch = (loc, off) => withRetry(async () => { const blob = file.slice(off, off + size); const r = await send(loc, { method: 'PATCH', headers: { ...tusHeaders, 'Upload-Offset': String(off), 'Content-Type': 'application/offset+octet-stream' }, body: blob }, (n) => { loaded.value = off + n; }); if (r.status !== 204) throw new HttpError(r.status, r, null); return Number(r.headers.get('Upload-Offset')); });
    const run = async () => {
        ctrl = new AbortController(); status.value = 'uploading'; error.value = null; t0 = performance.now();
        try {
            if (protocol === 'multipart') { const fd = new FormData(); fd.append(field, file, file.name); for (const [k, v] of Object.entries(meta)) fd.append(k, v); const r = await withRetry(() => send(url, { method: 'POST', headers, body: fd }, (n) => { loaded.value = n; })); if (!r.ok) throw new HttpError(r.status, r, await _parseBody(r)); result.value = await _parseBody(r); }
            else {
                let loc = location.peek() || (fingerprint && _lsGet('aegis:tus:' + fingerprint)) || null;
                let off = loc ? await offsetOf(loc) : null;
                if (off == null) { loc = await create(); off = 0; if (fingerprint) _lsSet('aegis:tus:' + fingerprint, loc); }
                location.value = loc; loaded.value = off;
                while (off < total) off = await patch(loc, off);
                if (fingerprint) _lsDel('aegis:tus:' + fingerprint);
                result.value = { location: loc };
            }
            status.value = 'done'; return result.peek();
        } catch (e) { if (e.name === 'AbortError') { status.value = status.peek() === 'uploading' ? 'paused' : 'idle'; return null; } status.value = 'error'; error.value = e; throw e; }
    };
    const up = { progress, loaded, speed, eta, status, error, result, location, start: run, pause: () => ctrl?.abort(), resume: run, abort: () => { ctrl?.abort(); status.value = 'idle'; }, then: (a, b) => run().then(a, b) };
    if (_currentScope) _currentScope.onDispose(() => ctrl?.abort());
    return up;
}

// wireForm: f.upload(key, { url, chunk, as = key + '_id', auto = true })
const uploads = {};
const uploadField = (key, uo) => {
    const st = uploads[key] = { list: signal([]), $any: null };
    st.$any = computed(() => st.list.value.some(u => u.status.value === 'uploading'));
    watch(fields[key], (v) => { if (!uo.auto) return; st.list.value = _files(v).map(f => upload(f, uo.url, uo)); Promise.all(st.list.peek().map(u => u.then(r => r))).then(rs => {
        formEl.querySelectorAll(`input[type=hidden][data-upload-for="${key}"]`).forEach(h => h.remove());
        for (const r of rs) { const h = document.createElement('input'); h.type = 'hidden'; h.name = uo.as || `${key}_id`; h.dataset.uploadFor = key; h.value = typeof r === 'object' ? (r.id ?? r.location ?? JSON.stringify(r)) : r; formEl.appendChild(h); }
    }).catch(e => { errors[key].value = e.message; }); });
    return st;
};
// serverSubmit: перед new FormData(formEl) — for (k in uploads) if (uploads[k].list.peek().length) _inputs[k].disabled = true; … finally — вернуть

// form().submit(url): тело
const hasFile = (o) => o && typeof o === 'object' && (o instanceof Blob || Object.values(o).some(hasFile));
const body = sopts.as === 'formdata' || hasFile(values.peek()) ? _toFormData(values.peek()) : values.peek();
function _toFormData(obj, fd = new FormData(), prefix = '') { for (const [k, v] of Object.entries(obj)) { const name = prefix ? `${prefix}[${k}]` : k; if (v instanceof Blob) fd.append(name, v, v.name); else if (v && typeof v === 'object' && !(v instanceof Date)) _toFormData(v, fd, name); else if (v != null) fd.append(name, v instanceof Date ? v.toISOString() : String(v)); } return fd; }
```

**API:**

```js
export function upload(file: File | Blob, url: string, opts?: { chunk?: number | string; protocol?: 'tus' | 'multipart'; field?: string; headers?: Record<string, string>; meta?: Record<string, string>; retries?: number; fingerprint?: string | false }): Upload;
export interface Upload extends PromiseLike<any> { progress: ReadonlySignal<number>; loaded: ReadonlySignal<number>; speed: ReadonlySignal<number>; eta: ReadonlySignal<number | null>; status: ReadonlySignal<'idle' | 'uploading' | 'paused' | 'done' | 'error'>; error: ReadonlySignal<unknown>; result: ReadonlySignal<any>; location: ReadonlySignal<string | null>; start(): Promise<any>; pause(): void; resume(): Promise<any>; abort(): void }
interface WireFormResult { upload(key: string, opts: Parameters<typeof upload>[2] & { url: string; as?: string; auto?: boolean }): { list: ReadonlySignal<Upload[]>; $any: ReadonlySignal<boolean> } }
// form(): submit(url, { as?: 'json' | 'formdata' }) — File в values → multipart автоматически
// HTML: <progress data-upload="avatar"> — value/max из f.upload('avatar').list
```

**Критерий:** test.html, section('💎 upload — tus, прогресс, resume'): configure({ fetch }) с мок-сервером tus: POST /files → 201 + Location: /files/1; PATCH /files/1 — читает init.body (Blob).size, проверяет Upload-Offset, копит offset, отвечает 204 + Upload-Offset; HEAD /files/1 → 200 + Upload-Offset; счётчик calls. const file = new File([new Uint8Array(10 * 1024)], 'v.bin'); const u = upload(file, '/files', { chunk: '1KB' }); const p = u.start(); await until(u.loaded, v => v >= 3 * 1024); u.pause(); await p; assert(u.status.value === 'paused' && Math.abs(u.progress.value - 0.3) < 0.11); const before = calls.filter(c => c.method === 'PATCH').length; await u.resume(); assert(calls.some(c => c.method === 'HEAD') && u.status.value === 'done' && u.progress.value === 1 && server.received === file.size && calls.filter(c => c.method === 'PATCH').length === before + 7 (без повторной отправки первых 3 КБ)); 502 на одном PATCH → retry, итог done, calls PATCH на 1 больше. Multipart: upload(file, '/up') → тело FormData с полем 'file', progress.value === 1, result.value.id === 1. wireForm: <input type=file name=avatar>; f.upload('avatar', { url: '/up' }); fire.files(input, [png]) → после settled formEl.querySelector('input[type=hidden][name=avatar_id]').value === '1'; await f.submit()(evt) → POST /save с FormData, где 'avatar' отсутствует, а 'avatar_id' === '1'. form(): const f2 = form({ title: 't', doc: null }); f2.fields.doc.value = png; await f2.submit('/save') → init.body instanceof FormData && body.get('doc') instanceof File && body.get('title') === 't'. Регресс: тест 1748 (formdata:email,address[city]) без изменений.

**Источники:** tus resumable upload protocol 1.0.0 (Upload-Offset, Upload-Length, Upload-Metadata, PATCH application/offset+octet-stream, HEAD); tus-js-client (fingerprint → localStorage urlStorage); Uppy (@uppy/tus, retryDelays, pause/resume); Rails ActiveStorage Direct Uploads (hidden signed_id + disabled file input при submit); Shrine upload endpoint; XMLHttpRequest Living Standard §4.5.6 upload progress events; Fetch Standard — request body streams (duplex: 'half', Chrome 105+, только HTTP/2) как будущая замена XHR; RFC 9110 §10.2.3 Retry-After; HTML Living Standard §4.10.18.6 — disabled элементы не участвуют в constructing the entry list.

### 💎 #37 — wizard() и draft(): мастер для form() и wireForm с async-валидацией шага, историей, a11y и черновиком в sessionStorage

**Impact:** 4 · **Effort:** M · **Size:** +0.6 KB gzip wizard(), +0.3 KB draft() — отдельные export, tree-shakeable; +0.1 KB в ядре: validateAsync(keys) и touched в form(); в wireForm [data-step]-сахар превращается в вызов wizard() (−0.15 KB)

**Сейчас:** Мастер (aegis_full.js:7334–7365) есть только в wireForm: step-сигнал, hidden на [data-step], next() гоняет ТОЛЬКО sync-правила через _validateField (7354) — async-правило «логин занят» и Standard Schema на шаг не влияют, пользователь узнаёт об ошибке шага 1 на финальном submit; нет goTo/visited/canGo, перезагрузка страницы теряет всё (типовая жалоба на мастеры), кнопка «Назад» браузера уводит со страницы вместо предыдущего шага, нет aria-current="step", фокус не переносится на новый шаг, announce не вызывается; form() (5168) мастера не имеет вовсе, и у form() нет touched (5185 передаёт null), поэтому «показывать ошибки schema только для затронутых полей» для виртуальной формы невозможно. persisted() (4280) + setInitial для черновика непригоден: setInitial делает initials = values → dirty=false и guardUnload молчит; File в JSON не сериализуем.

**Предложение:** Export wizard(f, { steps, persist, history, focus }) для обоих видов форм: steps — массив групп ключей (поддержка 'address.*' и items[]) или автодетект [data-step] у f.el; каждый шаг — { index, keys, valid, dirty, done } computed'ы; next() отмечает поля шага touched и ждёт f.validateAsync(keys) (новая опция _makeValidator.validateAsync(keys) — только эти ключи + runSchema(values, onlyTouched=true), 5111–5119), при провале фокус на первое невалидное; go(i) вперёд — только через валидацию промежуточных шагов, назад — свободно; history: true — Navigation API navigate(?step=i) push/replace и перехват traverse, чтобы Back вёл на предыдущий шаг (fallback popstate); persist: 'key' — шаг хранится через persisted() в sessionStorage; a11y: aria-current="step" на детях [data-step-nav], фокус на заголовок/первое поле нового шага, announce(_msg('step', { n, total })). Export draft(f, key, { storage = sessionStorage, debounce = 300, exclude }) — сохраняет values (без File и type=password) при dirty, восстанавливает при создании БЕЗ смены initials (dirty остаётся true, guardUnload работает), чистит при успешном submit (watch result), даёт restored/savedAt/clear для баннера «Восстановлен черновик от 12:40». wireForm [data-step] остаётся сахаром — вызывает wizard() внутри, API step/stepCount/next/prev сохраняется.

**Алгоритм:**

```js
export function wizard(f, wopts = {}) {
    const el = f.el || null;
    const stepEls = el ? [...el.querySelectorAll('[data-step]')] : [];
    const groups = wopts.steps || stepEls.map(s => [...s.querySelectorAll('[name]')].map(i => i.name).filter(Boolean));
    const matches = (k, p) => p.endsWith('*') ? _normPath(k).startsWith(_normPath(p.slice(0, -1))) : _normPath(k) === _normPath(p);
    const keysOf = (i) => Object.keys(f.fields).filter(k => groups[i].some(p => matches(k, p)));
    const step = wopts.persist ? persisted(wopts.persist + ':step', 0, { storage: sessionStorage, sync: false }) : signal(0, 'wizard:step');
    const visited = signal(new Set([step.peek()]), 'wizard:visited');
    const steps = groups.map((_, i) => ({ index: i, keys: () => keysOf(i),
        valid: computed(() => keysOf(i).every(k => !f.errors[k].value)),
        dirty: computed(() => keysOf(i).some(k => f.dirtyFields.value[k])),
        done: computed(() => visited.value.has(i) && steps[i].valid.value) }));
    const validateStep = async (i) => { const ks = keysOf(i); if (f.touched) for (const k of ks) f.touched[k].value = true; return f.validateAsync(ks); };
    const focusStep = (i) => queueMicrotask(() => { const target = stepEls[i]?.querySelector('h1,h2,h3,[autofocus],input:not([type=hidden]),select,textarea'); if (target && wopts.focus !== false) { if (!/INPUT|SELECT|TEXTAREA/.test(target.tagName)) target.tabIndex = -1; target.focus({ preventScroll: false }); } });
    let navigating = false;
    const go = async (i, { validate = i > step.peek(), nav = true } = {}) => {
        if (i < 0 || i >= groups.length) return false;
        for (let j = step.peek(); validate && j < i; j++) if (!(await validateStep(j))) { batch(() => { step.value = j; }); focusStep(j); return false; }
        const dir = i > step.peek() ? 'push' : 'replace';
        batch(() => { step.value = i; visited.value = new Set([...visited.peek(), i]); });
        if (nav && wopts.history && typeof navigation !== 'undefined') { const u = new URL(location.href); u.searchParams.set('step', i); navigating = true; navigation.navigate(u.href, { history: dir, state: { aegisStep: i } }).finished.finally(() => { navigating = false; }); }
        focusStep(i);
        announce(_msg('step', { n: i + 1, total: groups.length }), 'polite');
        return true;
    };
    effect(() => { const cur = step.value; stepEls.forEach((s, j) => { s.hidden = j !== cur; }); el?.querySelectorAll('[data-step-nav] > *').forEach((n, j) => { if (j === cur) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current'); }); }, 'wizard:dom');
    if (wopts.history && typeof navigation !== 'undefined') on(navigation, 'navigate', (e) => { if (navigating || e.navigationType !== 'traverse') return; const s = e.destination.getState()?.aegisStep; if (s == null) return; e.intercept({ handler: async () => { await go(s, { validate: false, nav: false }); } }); });
    return { step, steps, count: groups.length, next: () => go(step.peek() + 1), prev: () => go(step.peek() - 1), go, validateStep,
        first: computed(() => step.value === 0), last: computed(() => step.value === groups.length - 1), progress: computed(() => (step.value + 1) / groups.length) };
}

export function draft(f, key, dopts = {}) {
    const { storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null, debounce: ms = 300 } = dopts;
    const exclude = dopts.exclude || ((k, v) => v instanceof Blob || (Array.isArray(v) && v.some(x => x instanceof Blob)) || (f.el && f.el.elements[k] && f.el.elements[k].type === 'password'));
    const store = persisted(key, null, { storage, debounce: ms, sync: false });
    const restored = signal(false, 'draft:restored');
    const saved = store.peek();
    if (saved && saved.v) { batch(() => { for (const [k, v] of Object.entries(saved.v)) if (f.fields[k] && !exclude(k, v)) f.fields[k].value = v; }); restored.value = true; }   // initials не трогаем → dirty === true
    effect(() => { const out = {}; for (const k of Object.keys(f.fields)) { const v = f.fields[k].value; if (!exclude(k, v)) out[k] = v; } untrack(() => { if (f.dirty.peek()) store.value = { v: out, t: Date.now() }; }); }, 'draft:save');
    const clear = () => { store.clear(); restored.value = false; };
    watch(f.result, (r) => { if (r && (r.ok !== false)) clear(); });
    return { restored, clear, savedAt: computed(() => store.value?.t ?? null) };
}

// ядро: _makeValidator.validateAsync(keys) — const ks = keys || Object.keys(fields); ok = ks.every(validateField); runSchema(values, !!keys) — issues чужих шагов не показываются
// form(): touched[key] = signal(false) добавляется наравне с wireForm, _initialsApi(fields, _initials, errors, touched)
```

**API:**

```js
export function wizard(f: FormCore | WireFormResult, opts?: { steps?: string[][]; persist?: string; history?: boolean; focus?: boolean }): Wizard;
export interface WizardStep { index: number; keys(): string[]; valid: ReadonlySignal<boolean>; dirty: ReadonlySignal<boolean>; done: ReadonlySignal<boolean> }
export interface Wizard { step: Signal<number>; steps: WizardStep[]; count: number; next(): Promise<boolean>; prev(): Promise<boolean>; go(i: number, opts?: { validate?: boolean }): Promise<boolean>; validateStep(i: number): Promise<boolean>; first: ReadonlySignal<boolean>; last: ReadonlySignal<boolean>; progress: ReadonlySignal<number> }
export function draft(f: FormCore | WireFormResult, key: string, opts?: { storage?: Storage; debounce?: number; exclude?: (key: string, value: unknown) => boolean }): { restored: ReadonlySignal<boolean>; savedAt: ReadonlySignal<number | null>; clear(): void };
interface FormCore { touched: Record<string, Signal<boolean>>; validateAsync(keys?: string[]): Promise<boolean> }
// wireForm: step/stepCount/next/prev остаются (сахар над wizard); добавляется f.wizard: Wizard | null
```

**Критерий:** test.html, section('💎 wizard / draft'): const schema = Standard Schema с issue на city; const f = form({ name: '', login: '', city: '' }, { rules: { name: [required], login: [async v => (await wait(5), v === 'taken' ? 'Занят' : null)] }, schema }); const w = wizard(f, { steps: [['name', 'login'], ['city']], history: false }); assert(await w.next() === false && w.step.value === 0 && f.errors.name.value !== null && f.errors.city.value === null (issue чужого шага скрыт)); f.fields.name.value = 'A'; f.fields.login.value = 'taken'; assert(await w.next() === false && f.errors.login.value === 'Занят' (async-правило блокирует шаг)); f.fields.login.value = 'ok'; assert(await w.next() === true && w.step.value === 1 && w.steps[0].done.value && w.progress.value === 1); await w.prev() → 0 без валидации. wireForm: старый тест 4430–4470 проходит без изменений; плюс <ol data-step-nav><li><li><li></ol>: после f.next() второй li имеет aria-current="step", document.activeElement — первый input шага 1. history: при typeof navigation !== 'undefined' после w.next() new URL(location).searchParams.get('step') === '1', navigation.back() → await until(w.step, v => v === 0). draft: sessionStorage.clear(); const f1 = form({ title: '', doc: null }); const d1 = draft(f1, 'draft:t', { debounce: 0 }); f1.fields.title.value = 'hello'; f1.fields.doc.value = new File(['x'], 'a.txt'); await settled(); assert(JSON.parse(sessionStorage.getItem('draft:t')).v.title === 'hello' && !('doc' in JSON.parse(...).v)); const f2 = form({ title: '', doc: null }); const d2 = draft(f2, 'draft:t'); assert(f2.fields.title.value === 'hello' && f2.dirty.value === true && d2.restored.value === true && typeof d2.savedAt.value === 'number'); await f2.submit(async () => ({ ok: true })); assert(sessionStorage.getItem('draft:t') === null).

**Источники:** WAI-ARIA 1.3 aria-current="step"; WAI-ARIA APG — multi-step form / focus management при смене вида; Navigation API (WICG, Chrome 102+) navigate/intercept/traverse; HTML Living Standard — sessionStorage per top-level browsing context как хранилище черновиков; Angular Reactive Forms touched/markAllAsTouched; TanStack Form validators.onSubmitAsync и field-level meta.isTouched; Conform.js — валидация подмножества полей (validate({ name })); GOV.UK Design System «Question pages» (one thing per page, Back link).

### 💎 #38 — Progressive enhancement уровня Conform/Turbo: HTML-ответ 422 → morph формы и ошибки из разметки; formnovalidate; intent-кнопки; formEl.elements

**Impact:** 4 · **Effort:** M · **Size:** +0.5 KB gzip внутри wireForm (подключается только вместе с wireForm; swap/morph уже в сборке); ядро не растёт

**Сейчас:** serverSubmit (aegis_full.js:7261–7291) объявляет Accept: application/json, text/html;q=0.9, но если сервер ответил HTML (Rails render :new, status: :unprocessable_entity; Django form_invalid; Laravel без Accept: json — стандартный PE-контракт), _parseBody (1324) вернёт строку, data.errors нет → errors.$form = 'HTTP 422' (7284): пользователь не видит ни одной ошибки поля, хотя они есть в разметке. submit() (7311) валидирует всегда — HTML-атрибут formnovalidate на кнопке «Сохранить черновик» игнорируется, чего не делает ни один браузер. Обнаружение полей через querySelectorAll('[name]') (7082) подключает <button name="intent" value="add"> и <input type=submit name> как поля формы (readValue → button.value, dirty, values), и не видит элементы с атрибутом form="id" вне <form> (стандартная связь — формируется через formEl.elements). boost() (9411) умеет POST-формы, но морфит весь root и не знает про сигналы формы.

**Предложение:** 1) serverSubmit: при content-type text/html — DOMParser, поиск формы-ответа по _selectorFor(formEl) (9195) или по action/data-aegis; await swap(formEl, next, { mode: 'morph' }) — фокус и каретка сохраняются (_focusSnapshot 9198), file input не трогается (9243); затем rewire(): подключить новые поля через wireInput() (из п.1), снять пропавшие; ошибки читаются из разметки: #${key}-error, [aria-describedby], ближайшие .error/.field-error/[data-error]/.errorlist/.invalid-feedback/.help-block.error → errors[key], touched[key]=true; форменные — [role=alert], .form-error, .nonfield, .alert-danger → errors.$form + announce; фокус на первое aria-invalid. 200 text/html (Django без redirect) — тот же morph, result. Опция submit: { html: 'morph' | 'replace' | false }. 2) e.submitter?.formNoValidate === true → пропуск клиентской валидации (HTML-семантика), touched не трогается. 3) intents: { 'add-item': (f, e) => … } — если submitter.name === 'intent' (или data-intent) и есть обработчик — вызвать его, preventDefault, без запроса; без JS та же кнопка уходит на сервер (Conform-паттерн для field arrays). 4) Обнаружение через formEl.elements с фильтром: пропускать BUTTON, input[type=submit|button|reset|image], FIELDSET, OUTPUT, OBJECT; учитывать элементы с form="id" снаружи; для radio-групп — RadioNodeList.

**Алгоритм:**

```js
// wireForm: обнаружение
const controls = [...formEl.elements].filter(c => c.name && !/^(submit|button|reset|image)$/.test(c.type) && !/^(BUTTON|FIELDSET|OUTPUT|OBJECT)$/.test(c.tagName));
for (const input of controls) wireInput(input);

// ошибки из серверной разметки
const _errorText = (root, key, input) => {
    const byId = root.querySelector('#' + CSS.escape(key + '-error')) || (input?.getAttribute('aria-describedby') || '').split(/\s+/).map(id => id && root.querySelector('#' + CSS.escape(id))).find(Boolean);
    const near = byId || input?.closest('label, .field, .form-group, [data-field], li, p')?.querySelector('.error, .field-error, [data-error], .errorlist, .invalid-feedback, .help-block.error, [role=alert]');
    const t = near && near.textContent.replace(/\s+/g, ' ').trim();
    return t || null;
};
const adoptErrors = (root) => batch(() => {
    for (const key of Object.keys(fields)) { const input = root.elements ? root.elements[key] : root.querySelector(`[name="${CSS.escape(key)}"]`); const msg = _errorText(root, key, input && input.length ? input[0] : input); if (msg) { errors[key].value = msg; touched[key].value = true; } }
    const g = root.querySelector('[role=alert]:not([id$="-error"]), .form-error, .nonfield, .non-field-errors, .alert-danger');
    if (g) errors.$form.value = g.textContent.trim();
});
const rewire = () => { for (const c of [...formEl.elements]) if (c.name && !fields[c.name] && !/^(submit|button|reset|image)$/.test(c.type) && !/^(BUTTON|FIELDSET|OUTPUT|OBJECT)$/.test(c.tagName)) wireInput(c); for (const k of Object.keys(fields)) if (!formEl.elements[k]) removeField(k); };

// serverSubmit — ветка text/html
if (ct.includes('text/html') && sopts.html !== false) {
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const next = doc.querySelector(_selectorFor(formEl)) || doc.querySelector(`form[action="${CSS.escape(formEl.getAttribute('action') || '')}"]`) || doc.querySelector('form');
    if (!next) { errors.$form.value = `HTTP ${response.status}`; return { ok: false, status: response.status, data: null }; }
    await swap(formEl, next, { mode: sopts.html === 'replace' ? 'replace' : 'morph', hydrate: false });   // фокус/каретка сохранены, type=file не трогаем
    rewire(); adoptErrors(formEl);
    if (errors.$form.peek()) announce(errors.$form.peek(), 'assertive');
    formEl.querySelector('[aria-invalid="true"]')?.focus();
    return { ok: response.ok, status: response.status, data: null, html: true };
}

// submit(): formnovalidate + intents
return async (e) => {
    e?.preventDefault();
    const sub = e && e.submitter;
    const intent = sub && (sub.dataset.intent || (sub.name === 'intent' && sub.value));
    if (intent && sopts.intents && sopts.intents[intent]) { sopts.intents[intent](self, e); return; }   // JS есть — локально; нет — сервер
    if (submitting.peek()) return;
    …
    const skipValidation = !!(sub && sub.formNoValidate);
    if (!skipValidation) { for (const key of Object.keys(fields)) touched[key].value = true; if (!(await V.validateAsync())) { … return; } }
    …
};
```

**API:**

```js
export function wireForm(formEl: HTMLFormElement, opts?: {
    schema?: Record<string, ValidationRule[]> | StandardSchemaV1; rules?: Record<string, AsyncValidationRule[]>; mode?: 'blur-then-live' | 'live' | 'submit'; native?: boolean; asyncDebounce?: number;
    submit?: true | ((values: any, e: SubmitEvent) => unknown) | { as?: 'json' | 'formdata'; html?: 'morph' | 'replace' | false; onSuccess?(data: unknown, r: Response): void; onRedirect?: 'follow' | 'none' | ((r: Response) => void); intents?: Record<string, (f: WireFormResult, e: SubmitEvent) => void> };
}): WireFormResult;
interface WireFormResult { rewire(): void; adoptErrors(root?: ParentNode): void; el: HTMLFormElement }
// HTML: <button formnovalidate>Сохранить черновик</button> — без клиентской валидации; <button name="intent" value="add-item"> — локальный обработчик при JS, серверный без него
```

**Критерий:** test.html, section('💎 PE — HTML 422, formnovalidate, intents'): formEl = <form id="pe" action="/pe/save"><label>Email<input name="email" value="a@b.c"></label><button name="intent" value="add">+</button><button formnovalidate name="draft">Draft</button><button>Save</button></form> + <input form="pe" name="outside" value="1"> рядом. const f = wireForm(formEl, { rules: { email: [emailRule] }, submit: { intents: { add: () => added++ } } }); assert(!('intent' in f.fields) && !('draft' in f.fields) && 'outside' in f.fields && f.values.value.outside === '1'). configure({ fetch: () => new Response('<form id="pe" action="/pe/save"><label>Email<input name="email" value="a@b.c" aria-invalid="true"><span class="error" id="email-error">Taken</span></label><label>Phone<input name="phone"></label><div role="alert">Fix 1 error</div></form>', { status: 422, headers: { 'Content-Type': 'text/html' } }) }); input.focus(); input.setSelectionRange(2, 2); await f.submit()(new SubmitEvent('submit', { submitter: saveBtn })); assert(f.errors.email.value === 'Taken' && f.errors.$form.value === 'Fix 1 error' && 'phone' in f.fields && document.activeElement === formEl.elements.email && formEl.elements.email.selectionStart === 2 && f.result.value?.html === true). formnovalidate: f.fields.email.value = 'bad'; calls = 0; await f.submit()(new SubmitEvent('submit', { submitter: draftBtn })) → запрос ушёл (calls === 1), f.errors.email.value === null (валидация пропущена); с submitter: saveBtn → calls не растёт, f.errors.email.value !== null. intents: await handler(new SubmitEvent('submit', { submitter: addBtn })) → added === 1 и calls не растёт. Регресс: тесты 1699–1779 (JSON 422) без изменений.

**Источники:** Conform.js — progressive enhancement, intent buttons (form.insert/remove), server-first validation; Hotwire Turbo — «form submissions must redirect or render 422», morph-рендер ответа с ошибками; HTMX hx-swap outerHTML для форм с ошибками; HTML Living Standard §4.10.21.2 form submission algorithm (formnovalidate, submitter), §4.10.3 form.elements и form="" owner attribute, §4.10.18.3 — кнопки как submittable но не «настоящие» поля; Rails form_with + render :new status: :unprocessable_entity; Django FormView.form_invalid; Laravel FormRequest redirect back withErrors; idiomorph (focus-preserving morph).

### 💎 #39 — dropzone(): drag-drop/paste/папки в тот же <input type=file> (FormData видит файлы), удаление по одному, мульти-превью с миниатюрами

**Impact:** 4 · **Effort:** M · **Size:** +0.7 KB gzip dropzone() — отдельный export, tree-shakeable; +0.25 KB preview(key, { all, thumb }) внутри wireForm

**Сейчас:** Файлы попадают в форму только через change на <input type=file> (aegis_full.js:7148); перетаскивание, вставка из буфера (скриншот Ctrl+V), папки — не поддержаны. preview() (7244–7259) отдаёт objectURL только первого файла (Array.isArray(v) ? v[0] : v, 7250) и в полном размере — <img> с 12-мегапиксельным HEIC/JPEG декодируется целиком, 20 превью = сотни МБ декодированных битмапов. У input multiple нельзя убрать один файл без DataTransfer-трюка (test.html:2052 делает это руками). Проверка accept при drop не выполняется браузером (только в диалоге выбора) — mime()-правило сработает лишь при валидации, а не в момент броска. Зона без role/tabindex недоступна с клавиатуры.

**Предложение:** Export dropzone(el, target, opts): target — <input type=file> (тогда файлы пишутся в input.files через DataTransfer и диспатчится change → wireForm-сигнал, FormData(formEl), serverSubmit и f.upload() видят их без изменений) или сигнал (для form()). Счётчик dragenter/dragleave → over-сигнал и data-dragover на зоне (для CSS без JS-классов), dropEffect='copy', accept-фильтр через существующий mime() на бросок с rejected-сигналом, multiple/max, append при повторном броске, remove(i)/clear(), paste из clipboardData.files, папки через DataTransferItem.webkitGetAsEntry/getAsFileSystemHandle рекурсивно, клавиатура: role=button, tabindex=0, Enter/Space → input.showPicker() (input можно скрыть визуально, не display:none). preview(key, { all: true, thumb: 256 }) → сигнал массива { file, url, kind }, миниатюры через createImageBitmap(file, { resizeWidth: thumb, resizeQuality: 'low' }) → OffscreenCanvas.convertToBlob({ type: 'image/webp', quality: .8 }) → objectURL (отзыв при смене/dispose как сейчас), fallback — полный objectURL; не-изображения — url: null + kind по mime.

**Алгоритм:**

```js
export function dropzone(el, target, dopts = {}) {
    const input = target instanceof HTMLInputElement ? target : (dopts.input || null);
    const sig = isSignal(target) ? target : null;
    const { accept = input?.accept || '', multiple = input ? input.multiple : true, max = Infinity, paste = true, dirs = true } = dopts;
    const over = signal(false, 'dropzone:over'), rejected = signal([], 'dropzone:rejected');
    const okType = accept ? (f) => mime(accept.split(',').map(s => s.trim()))(f) == null : () => true;
    const current = () => sig ? _files(sig.peek()) : [...(input?.files || [])];
    const commit = (list) => {
        if (input) { const dt = new DataTransfer(); for (const f of list) dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
        else sig.value = multiple ? list : (list[0] || null);
    };
    const add = (incoming) => { const ok = [], bad = []; for (const f of incoming) (okType(f) ? ok : bad).push(f); rejected.value = bad;
        commit(multiple ? [...current(), ...ok].slice(0, max) : ok.slice(0, 1)); dopts.onAdd?.(ok, bad); };
    const remove = (i) => commit(current().filter((_, j) => j !== i));
    const walk = async (items) => {                      // папки: webkitGetAsEntry → readEntries рекурсивно
        const out = [];
        const readDir = (dir) => new Promise((res) => { const r = dir.createReader(), acc = []; const step = () => r.readEntries(async (es) => { if (!es.length) return res(acc); for (const e of es) acc.push(...(e.isFile ? [await new Promise(ok => e.file(ok))] : await readDir(e))); step(); }, () => res(acc)); step(); });
        for (const it of items) { if (it.kind !== 'file') continue; const entry = dirs && it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; if (entry && entry.isDirectory) out.push(...await readDir(entry)); else { const f = it.getAsFile(); if (f) out.push(f); } }
        return out;
    };
    let depth = 0;
    const setOver = (v) => { over.value = v; el.toggleAttribute('data-dragover', v); };
    on(el, 'dragenter', (e) => { e.preventDefault(); if (++depth === 1) setOver(true); });
    on(el, 'dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    on(el, 'dragleave', () => { if (--depth <= 0) { depth = 0; setOver(false); } });
    on(el, 'drop', async (e) => { e.preventDefault(); depth = 0; setOver(false); add(await walk(e.dataTransfer.items || [])); });
    if (paste) on(el, 'paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); add(fs); } });
    if (input) {
        if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        const open = () => (input.showPicker ? input.showPicker() : input.click());
        on(el, 'click', (e) => { if (!e.target.closest('input,button,a,label')) open(); });
        on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
    return { over, rejected, add, remove, clear: () => commit([]), open: () => input?.click() };
}

// wireForm.preview(key, { all = false, thumb = 0 })
const thumbUrl = async (f) => {
    if (!thumb || !f.type.startsWith('image/') || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return URL.createObjectURL(f);
    try { const bmp = await createImageBitmap(f, { resizeWidth: thumb, resizeQuality: 'low' }); const c = new OffscreenCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close(); return URL.createObjectURL(await c.convertToBlob({ type: 'image/webp', quality: 0.8 })); }
    catch (e) { return URL.createObjectURL(f); }
};
// effect: список файлов → для каждого thumbUrl (версионирование ver, revoke всех прежних); url.value = all ? [{ file, url, kind }] : first
```

**API:**

```js
export function dropzone(el: Element, target: HTMLInputElement | Signal<File | File[] | null>, opts?: { accept?: string; multiple?: boolean; max?: number; paste?: boolean; dirs?: boolean; input?: HTMLInputElement; onAdd?(accepted: File[], rejected: File[]): void }): { over: ReadonlySignal<boolean>; rejected: ReadonlySignal<File[]>; add(files: Iterable<File>): void; remove(i: number): void; clear(): void; open(): void };
interface WireFormResult {
    preview(key: string): ReadonlySignal<string | null>;
    preview(key: string, opts: { all: true; thumb?: number }): ReadonlySignal<Array<{ file: File; url: string | null; kind: 'image' | 'video' | 'audio' | 'pdf' | 'file' }>>;
    preview(key: string, opts: { thumb: number }): ReadonlySignal<string | null>;
}
// CSS: .zone[data-dragover] { outline: 2px dashed } — без классов и JS
```

**Критерий:** test.html, section('💎 dropzone / preview'): formEl = <form><input type=file name=docs multiple accept="image/*" hidden><div class=zone></div></form>; f = wireForm(formEl); dz = dropzone(zone, formEl.docs); const png = new File([bytes], 'a.png', { type: 'image/png' }), txt = new File(['x'], 'a.txt', { type: 'text/plain' }); dt = new DataTransfer(); dt.items.add(png); dt.items.add(txt); zone.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true })); assert(dz.over.value && zone.hasAttribute('data-dragover')); zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await settled(); assert(!dz.over.value && formEl.docs.files.length === 1 && f.fields.docs.value.length === 1 && dz.rejected.value[0].name === 'a.txt' && f.formData().getAll('docs').length === 1); второй drop с png2 → files.length === 2 (append); dz.remove(0) → f.fields.docs.value[0].name === 'b.png'; paste: zone.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dtWithPng, bubbles: true, cancelable: true })) → length 2; клавиатура: zone.getAttribute('role') === 'button' && zone.tabIndex === 0. preview: const pv = f.preview('docs', { all: true, thumb: 64 }); const big = PNG 1200×800 из OffscreenCanvas.convertToBlob; fire change → await until(pv, v => v.length === 1 && v[0].url); const img = new Image(); img.src = pv.value[0].url; await img.decode(); assert(img.naturalWidth <= 64 && pv.value[0].kind === 'image'); f.fields.docs.value = []; assert(pv.value.length === 0) и прежний blob: URL отозван (fetch(url) отклоняется). Измерение: 20 фото по 4000×3000 — decoded image memory в Performance monitor ≤ 5 МБ против ≥ 900 МБ при полноразмерных objectURL.

**Источники:** HTML Living Standard §6.11 Drag and drop (DataTransfer, DataTransferItem.webkitGetAsEntry), §4.10.5.1.18 file upload state (input.files setter принимает FileList, showPicker); File System Access API getAsFileSystemHandle; Clipboard API paste → clipboardData.files; createImageBitmap resizeWidth/resizeQuality (HTML §8.12) + OffscreenCanvas.convertToBlob; WAI-ARIA APG Button pattern (role=button, Enter/Space) для зон загрузки; react-dropzone (useDropzone accept/maxFiles/onDrop rejections), Uppy Dashboard/Drag-drop/thumbnail-generator (@uppy/thumbnail-generator даунскейл превью); FilePond (пер-файловое удаление, превью).

### 💎 #40 — aegis/test для форм: fill() по именам с bracket-путями, fire.files/fire.drop, декодирование FormData в mockFetch, renderForm() и fieldState()

**Impact:** 3 · **Effort:** S · **Size:** 0 в aegis_full.js; aegis-test.js +0.9 KB gzip (dev-only, не попадает в прод)

**Сейчас:** aegis-test.js даёт fire.input(el, value) / fire.change / fire.submit (69–77) — заполнить серверную форму с radio/checkbox/select multiple/file/items[0][qty] означает написать по 3–4 строки на поле и вручную собирать DataTransfer (как test.html:2052–2054). mockFetch (108–140) распознаёт тело только если это строка (121–122): FormData остаётся сырым объектом, тесты проверяют его как [...init.body.keys()].join(',') (test.html:1748) — вложенные items[0][qty] и File не разобрать одним assert; Blob-тела (чанки upload) не измеряются. render() (35) требует компонент — для теста wireForm-острова нужен обёрточный компонент с opts.html и ручным querySelector формы. Нет способа спросить «что видит пользователь/скринридер у поля»: aria-invalid + текст элемента из aria-describedby собирается вручную.

**Предложение:** В aegis-test.js: fill(root, values) — плоские ('items[0][qty]') или вложенные ({ items: [{ qty: 2 }] }) значения, поиск по formEl.elements[name] (учитывает form="id" и RadioNodeList), правильные события по типу поля (radio/checkbox → input+change, select multiple, file → DataTransfer, остальное → focus, input, change), flushSync в конце; fire.files(input, files) и fire.drop(el, files) (DragEvent с DataTransfer), file(name, { size, type, content }) — фабрика File; mockFetch: тело FormData → объект с раскладкой bracket/dot-имён в вложенную структуру (повторные ключи → массив), File сохраняется, body.$raw — исходный FormData; Blob/ArrayBuffer тела → { $bytes, $type }, ctx.headers — Headers; renderForm(html, setup) → { el, form, f, fill(values), submit(submitter?) (fire.submit + flushAll + ожидание f.submitting === false), errors() (карта key → текст из DOM), unmount }; fieldState(input) → { invalid, error, described, touched, nativeValid, value }.

**Алгоритм:**

```js
// aegis-test.js
const _parse = (n) => String(n).replace(/\]/g, '').split(/[.[]/).filter(Boolean);
const _set = (o, segs, v) => { let c = o; for (let i = 0; i < segs.length - 1; i++) { const k = segs[i]; if (c[k] == null) c[k] = /^\d+$/.test(segs[i + 1]) ? [] : {}; c = c[k]; } const last = segs[segs.length - 1]; if (last in c) c[last] = [].concat(c[last], v); else c[last] = v; return o; };
const _flat = (v, p = '', out = {}) => { if (v instanceof Blob || v == null || typeof v !== 'object' || (Array.isArray(v) && v.every(x => x instanceof Blob || typeof x !== 'object'))) { out[p] = v; return out; } for (const [k, x] of Object.entries(v)) _flat(x, p ? `${p}[${k}]` : k, out); return out; };

export const file = (name = 'a.txt', { size = 3, type = 'text/plain', content, lastModified } = {}) => new File([content ?? new Uint8Array(size)], name, { type, lastModified });
fire.files = (input, files) => { const dt = new DataTransfer(); for (const f of [].concat(files)) dt.items.add(f); input.files = dt.files; return _event(input, 'change'); };
fire.drop = (el, files, init = {}) => { const dt = new DataTransfer(); for (const f of [].concat(files)) dt.items.add(f); const E = typeof DragEvent === 'function' ? DragEvent : Event; el.dispatchEvent(new E('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt })); el.dispatchEvent(new E('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); const ev = new E('drop', { bubbles: true, cancelable: true, dataTransfer: dt, ...init }); el.dispatchEvent(ev); return ev; };

export function fill(root, values) {
    const formEl = root.tagName === 'FORM' ? root : root.querySelector('form') || root.closest?.('form') || root;
    for (const [name, v] of Object.entries(_flat(values))) {
        let el = formEl.elements ? formEl.elements[name] : null;
        const group = el && typeof el.length === 'number' && !el.tagName ? [...el] : el ? [el] : [...formEl.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
        if (!group.length) throw new Error(`fill(): no field "${name}" in\n${formEl.outerHTML.slice(0, 400)}`);
        el = group[0];
        if (el.type === 'radio') { const r = group.find(x => x.value === String(v)) || el; r.checked = true; _event(r, 'input'); _event(r, 'change'); }
        else if (el.type === 'checkbox') { if (group.length > 1) group.forEach(c => { c.checked = [].concat(v).map(String).includes(c.value); _event(c, 'input'); _event(c, 'change'); }); else { el.checked = !!v; _event(el, 'input'); _event(el, 'change'); } }
        else if (el.type === 'file') fire.files(el, v || []);
        else if (el.tagName === 'SELECT') { const want = [].concat(v).map(String); for (const o of el.options) o.selected = want.includes(o.value); _event(el, 'input'); _event(el, 'change'); }
        else { el.focus(); el.value = v ?? ''; _event(el, 'input'); _event(el, 'change'); }
    }
    flushSync();
}

// mockFetch: тело
if (body instanceof FormData) { const o = {}; for (const [k, v] of body.entries()) _set(o, _parse(k), v); Object.defineProperty(o, '$raw', { value: body }); body = o; }
else if (body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) body = { $bytes: body.size ?? body.byteLength, $type: body.type || '' };
calls.push({ method, url: …, body, headers: new Headers(init.headers || {}) });
… await r.h(body, { url, params, query, method, init, headers: new Headers(init.headers || {}) })

export function renderForm(html, setup) {
    let f = null;
    const h = render(({ el }) => { const formEl = el.querySelector('form'); f = setup ? setup(formEl) : wireForm(formEl); return formEl; }, { html });
    const form = h.find('form');
    return { ...h, form, f,
        fill: (values) => fill(form, values),
        async submit(submitter) { const ev = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: submitter || form.querySelector('button:not([type=button]),input[type=submit]') }); form.dispatchEvent(ev); await flushAll(); if (f && f.submitting) await waitFor(() => !f.submitting.value); return ev; },
        errors() { const out = {}; for (const c of form.elements) { if (!c.name) continue; const s = fieldState(c); if (s.error) out[c.name] = s.error; } const g = form.querySelector('[role=alert]:not([id$="-error"]), .form-error'); if (g && g.textContent.trim()) out.$form = g.textContent.trim(); return out; } };
}
export function fieldState(input) {
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const described = ids.map(id => document.getElementById(id)).filter(Boolean).map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { invalid: input.getAttribute('aria-invalid') === 'true', error: described[0] || null, described, nativeValid: input.validity ? input.validity.valid : true, value: input.type === 'checkbox' ? input.checked : input.value };
}
```

**API:**

```js
// aegis-test.d.ts
export function fill(root: Element, values: Record<string, unknown>): void;
export function file(name?: string, opts?: { size?: number; type?: string; content?: BlobPart; lastModified?: number }): File;
export namespace fire { function files(input: HTMLInputElement, files: File | File[]): Event; function drop(el: Element, files: File | File[], init?: EventInit): Event }
export function renderForm<F = WireFormResult>(html: string, setup?: (form: HTMLFormElement) => F): RenderHandle & { form: HTMLFormElement; f: F; fill(values: Record<string, unknown>): void; submit(submitter?: Element): Promise<SubmitEvent>; errors(): Record<string, string> };
export function fieldState(input: Element): { invalid: boolean; error: string | null; described: string[]; nativeValid: boolean; value: unknown };
// mockFetch: handler(body, ctx) — body для FormData: вложенный объект (File сохранён, body.$raw: FormData); для Blob: { $bytes, $type }; ctx.headers: Headers
```

**Критерий:** test.html, section('aegis/test — формы'): const m = mockFetch({ 'POST /t/save': (body, { headers }) => { seen = body; hdr = headers; return { status: 422, body: { errors: { 'items.0.qty': ['Мало'] } } }; } }); const t = renderForm('<form action="/t/save"><input name="items[0][qty]" type="number"><input type="radio" name="r" value="a"><input type="radio" name="r" value="b"><select name="tags" multiple><option>x</option><option>y</option></select><input type="checkbox" name="ok"><input type="file" name="doc" multiple><button>Go</button></form>', el => wireForm(el, { submit: true })); t.fill({ items: [{ qty: 2 }], r: 'b', tags: ['x', 'y'], ok: true, doc: [file('a.png', { type: 'image/png' })] }); assert(t.f.values.value.items[0].qty === 2 && t.f.values.value.r === 'b' && t.f.values.value.tags.join() === 'x,y' && t.f.values.value.ok === true && t.f.values.value.doc[0].name === 'a.png'); await t.submit(); assert(seen.items[0].qty === '2' && seen.tags.join() === 'x,y' && seen.doc[0] instanceof File && seen.$raw instanceof FormData && hdr.get('X-Requested-With') === 'XMLHttpRequest'); assert(t.errors()['items[0][qty]'] === 'Мало' && fieldState(t.form.elements['items[0][qty]']).invalid === true && document.activeElement === t.form.elements['items[0][qty]']); fire.drop на зону из п.5 → f.fields.doc.value.length === 1; Blob-тело: request('/c', { method: 'PATCH', body: new Blob([new Uint8Array(1024)]) }) → m.last().body.$bytes === 1024. Существующий раздел 2489–2534 и тест 1748 проходят без изменений (строковые JSON-тела как прежде).

**Источники:** Testing Library user-event (upload(), selectOptions(), type()) и @testing-library/dom (ByRole/ByLabelText, aria-describedby → accessible description); Playwright locator.setInputFiles / dragTo; MSW (Mock Service Worker) — await request.formData() в обработчиках; WAI-ARIA 1.3 aria-invalid/aria-describedby (accessible description computation, accname 1.2); HTML Living Standard §4.10.3 form.elements + RadioNodeList, §4.10.21.4 constructing the entry list (порядок и дубли ключей FormData); Rack::Utils.parse_nested_query / PHP parse_str — семантика bracket-имён, которую воспроизводит декодер.


---

# ♿ Доступность

## 🔭 focus-keyboard

**Линза:** Управление фокусом и клавиатурой (секция 26: trap, roving, command; секция 30 роутер; секция 34 swap/boost; modal/scaffold): фокус после навигации и swap (куда уходит фокус, объявление смены страницы), восстановление фокуса после закрытия модалей и удаления элемента из list(), inert для фона, skip links, roving tabindex в гридах/деревьях, сочетания клавиш и их объявление, поведение при prefers-reduced-motion, фокус-видимость (:focus-visible), клавиатура в virtualScroll. Сравни с WAI-ARIA APG, Adobe React Aria, Radix, GOV.UK, Inclusive Components.

**Вывод:** Aegis в фокусе/клавиатуре сильнее большинства «сервер-first» конкурентов в двух местах: swap()/morph() сохраняют фокус, value и каретку активного поля (aegis_full.js:9197-9210, 9242), а trap() уже умеет inert для фона, escape/outside и возврат фокуса (7397-7462) — у HTMX/Datastar этого нет вовсе. Но всё, что происходит с фокусом «между» этими точками, движок не видит: после router()/boost()-навигации фокус остаётся на исчезнувшей ссылке или падает в body, смена страницы не объявляется (8341, 9385 — только scrollTo(0,0) и title), list()/show()/virtualScroll молча удаляют сфокусированный узел (2844, 2635, 8658), trap() возвращает фокус на элемент, которого уже нет в DOM (7459), announce() создаёт live-region лениво и переключает politeness на одном узле (7562-7578) — паттерн, который NVDA/VoiceOver воспроизводят ненадёжно. roving() — уровень APG-2019: одна ось, без grid/typeahead/RTL/aria-activedescendant, первый tab-stop всегда item[0], а не выбранный (7504-7509), удаление активного элемента делает виджет недостижимым по Tab. Сочетаний клавиш нет ни в каком виде, кроме модификаторов @keydown.ctrl.enter (2074-2100). По сравнению с React Aria (FocusScope с restoreFocus-fallback, useSelectableCollection, LiveAnnouncer с двумя регионами), SvelteKit/Next (route announcer + focus reset) и GOV.UK (фокус на заголовок после смены содержимого) отставание — именно в «непрерывности фокуса», а не в отдельных виджетах; закрыть его можно ~2 KB gzip tree-shakeable-кода, потому что все точки удаления/вставки DOM уже проходят через 3–4 внутренних функции (_removeNodes, handleRoute, visit, swap).

**Отвергнуто:** 1) «Уважать prefers-reduced-motion» — уже сделано системно: reducedMotion-сигнал с override (5816-5830), _motionOff() в _runTransition (4501), spring/tween (5729-5782), router _withTransition (8315), boost (9388). Единственная дыра — wireForm scrollIntoView({behavior:'smooth'}) на 7204 без проверки _motionOff(); это однострочник, включён бонусом в бриллиант №2, отдельного предложения не заслуживает. 2) «inert для фона модалки» — есть (trap({ inert: true }), 7405-7414, тест test.html:1982-1985); modal() на нативном <dialog> получает top-layer и inert от браузера. 3) «Skip links» — чисто серверная разметка <a href="#main">; router и boost правильно не перехватывают якорные ссылки (8388: e.hashChange → return; 8434: href.startsWith('#') → return; 9430: url.hash && same pathname → return), браузер сам переносит sequential focus navigation starting point. Движку делать нечего. 4) «Инъекция CSS для :focus-visible» — UA-стили :focus-visible есть во всех браузерах с 2022, движок не должен владеть темой; injectStyles() (5522) оставляем только для cloak/transition. 5) «aria-hidden фон вместо inert» — inert поддерживается во всех evergreen с 2023 (Safari 15.5+), polyfill не нужен. 6) «Полный WAI-ARIA-набор виджетов (combobox, menu, tree как компоненты)» — это библиотека компонентов, а не ядро; вместо этого усиливаем примитив roving() до уровня, на котором такие виджеты собираются в 10 строк. 7) «Автоматический role=dialog в trap()» — уже есть (7419-7420). 8) «Возврат фокуса на кнопку после закрытия <dialog>» — нативный showModal()/close() делает это сам; modal() (7468) не нуждается в дополнении. 9) «Автотест a11y (axe) в aegis-test.js» — полезно, но вне линзы focus-keyboard и вне бюджета размера ядра.

### 💎 #41 — Route announcer + focus reset после навигации (router, boost, swap)

**Impact:** 5 · **Effort:** M · **Size:** +0.45 KB gzip (общий хелпер _focusAfterNav ~25 строк + 2 опции в router/boost + 1 в swap); tree-shakeable вместе с секциями 30/34

**Сейчас:** router.navigate() после успешного handleRoute делает только window.scrollTo(0,0) (aegis_full.js:8341); в Navigation-API-ветке e.intercept({ scroll }) (8406) оставляет focusReset браузера по умолчанию 'after-transition' — фокус летит в body или на [autofocus], но никакого объявления. В popstate/click-ветке (8422-8437) фокус остаётся на ссылке, которую только что disposed уровень маршрута удалил из DOM → document.activeElement === body, SR молчит, Tab начинает с начала документа. boost.visit() (9380-9386) ставит document.title и scrollTo(0,0), но _focusSnapshot (9197) восстанавливает фокус только если у активного элемента был id/name — нажатая ссылка меню обычно без них. Смена страницы не объявляется ни в одном пути; aria-current на ссылках ставится (8455), но это не сообщает пользователю, что страница сменилась. Именно эту проблему решают SvelteKit ($app/navigation: фокус на body + svelte-announcer с title), Next.js (next-route-announcer), Nuxt (<NuxtRouteAnnouncer>), Angular Router (LiveAnnouncer) и исследование Gatsby/Marcy Sutton 2019.

**Предложение:** Единый хелпер _focusAfterNav(root, opts, title) после успешного handleRoute (и в fallback-ветке, и внутри Navigation-API-handler с e.intercept({ focusReset: 'manual' })) и после swap() в boost.visit(). Порядок выбора цели: [data-autofocus] или [autofocus] в новом контенте → первый h1 внутри root → сам root (outletEl / rootEl boost) с временным tabindex=-1 и outline: none только на время фокуса (атрибут data-aegis-focus-sink, чтобы автор мог стилизовать). Фокус ставится с { preventScroll: true }, скролл остаётся ответственностью scroll-опции. Затем announce(`${title}`) через polite-регион (сообщение настраивается: 'Страница: {title}'). Для traverse (back/forward) при opts.focus === 'restore' — попытка вернуть фокус на элемент по сохранённому селектору из history.state/navigation entry state (сохраняем при уходе через _selectorFor + data-aegis-focus-id). Отключаемо: focus: false, announce: false. Для swap() добавить opts.focus: 'restore' (текущее) | 'content' | false — при 'content' после неудачного _focusRestore фокус идёт по той же цепочке в inserted[0]; это закрывает случай «кнопка “Удалить” внутри карточки, карточка заменена ответом сервера».

**Алгоритм:**

```js
/** Куда уходит фокус после смены содержимого: autofocus → h1 → сам root (tabindex=-1) */
function _focusAfterNav(root, mode, title) {
    if (mode === false || typeof document === 'undefined' || !root) return;
    const inRoot = (el) => el && root.contains(el);
    if (mode === 'keep' && inRoot(document.activeElement) && document.activeElement !== document.body) return;
    let target = typeof mode === 'function' ? mode(root) : null;
    if (!target) target = root.querySelector('[data-autofocus],[autofocus]') || (mode !== 'root' && root.querySelector('h1')) || root;
    if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    if (target.tagName === 'H1' && !target.hasAttribute('tabindex')) { target.setAttribute('tabindex', '-1'); target.setAttribute('data-aegis-focus-sink', ''); }
    target.focus({ preventScroll: true });
    if (title != null) announce(typeof title === 'function' ? title() : title);
}

// router(): const { focus: focusMode = 'auto', announce: ann = true } = opts;
// в handleRoute после currentPattern = match.node.pattern; (8290):
//   if (info.type !== 'search') _focusAfterNav(outletEl || (rootEl === document ? document.body : rootEl), focusMode, ann === true ? document.title : ann && ann(to));
// в onNavigate (8405): e.intercept({ scroll: ..., focusReset: focusMode === false ? 'after-transition' : 'manual', handler })
// boost.visit() после await swap(el, next, …) (9384):
//   _focusAfterNav(el, opts.focus ?? 'auto', opts.announce === false ? null : doc.title);
// swap(): после _focusRestore (9335): if (opts.focus === 'content' && !inserted.some(n => n.nodeType === 1 && n.contains(document.activeElement))) _focusAfterNav(inserted[0] || target, 'auto', null);
```

**API:**

```js
router(routes, { focus?: 'auto' | 'root' | 'keep' | false | ((root: Element) => Element | null); announce?: boolean | ((to: RouteInfo) => string) })
boost({ focus?: 'auto' | 'root' | 'keep' | false; announce?: boolean })
swap(target, html, { focus?: 'restore' | 'content' | false })   // default 'restore' — текущее поведение
// d.ts: RouterOptions.focus, RouterOptions.announce, BoostOptions.focus/announce, SwapOptions.focus
// CSS-хук: [data-aegis-focus-sink]:focus { outline: none } — по желанию автора (GOV.UK оставляет outline видимым)
```

**Критерий:** test.html, секция 'router: фокус и объявление после навигации': (1) hash-router с двумя маршрутами, <a id="l1" href="#/a"> внутри outlet; l1.focus(); r.navigate('/b'); await r.ready/nextTick → document.activeElement === outlet.querySelector('h1') && h1.getAttribute('tabindex') === '-1' (или в фоновой вкладке !document.hasFocus()); (2) через 20 мс [aria-live="polite"].textContent === document.title; (3) router(..., { focus: false, announce: false }) — activeElement не меняется, регион пуст; (4) boost: mockFetch страницы с <main><h1>Next</h1></main>, b.visit('/next') → activeElement === main.querySelector('h1'); (5) swap(el, '<div><button>x</button></div>', { focus: 'content' }) при фокусе на удаляемой кнопке без id → activeElement внутри inserted[0]. Ручная проверка: NVDA+Firefox после клика по ссылке произносит заголовок страницы.

**Источники:** Navigation API (WHATWG HTML §7.11: NavigateEvent.intercept focusReset 'after-transition' | 'manual'); Marcy Sutton, «What we learned from user testing of accessible client-side routing» (Gatsby, 2019); SvelteKit src/runtime/client/client.js (announcer + focus body); Next.js RouteAnnouncer; Nuxt <NuxtRouteAnnouncer>; Angular CDK LiveAnnouncer; GOV.UK Design System «Focus management after content change»; WAI-ARIA APG «Developing a Keyboard Interface» (Focus Management); React Aria useFocusRing/useLandmark.

### 💎 #42 — Непрерывность фокуса при удалении узла: list()/show()/virtualScroll/trap.release

**Impact:** 5 · **Effort:** S · **Size:** +0.3 KB gzip (один хелпер _focusNeighbor ~20 строк, 4 вызова в существующих ветках удаления); в ядро попадает ~120 B, остальное в list/trap

**Сейчас:** _removeNodes (aegis_full.js:2296-2307) удаляет узлы через Range.deleteContents без проверки, где фокус. list()._dropEntry (2844-2853) и show() (2635-2636) вызывают его для сфокусированной строки — типичный сценарий «кнопка Удалить внутри строки»: после клика/Enter строка исчезает, document.activeElement становится body, следующий Tab начинается с начала страницы, SR теряет контекст. В _windowScroll (8658) list(slice) удаляет строки, ушедшие за overscan, — сфокусированную строку тоже, значит стрелки/Tab по виртуальному списку ломаются при обычном скролле. trap.release (7459) делает previousFocus.focus() даже если previousFocus уже отсоединён (меню-пункт, открывший модалку, был удалён list()) — фокус молча уходит в body. React Aria FocusScope restoreFocus решает ровно этот случай: если узел не connected, берёт следующий tabbable после его бывшей позиции; Inclusive Components («A Todo List») и GOV.UK требуют переносить фокус на соседний элемент или заголовок списка.

**Предложение:** Хелпер _focusNeighbor(nodes, fallback): перед удалением проверить, что document.activeElement внутри nodes; если да — фокус на первый focusable следующего сиблинга после последнего узла, иначе предыдущего сиблинга перед первым, иначе на fallback (родитель с tabindex=-1). Подключить в _removeNodes только по флагу (чтобы не платить за querySelector в горячем пути): _dropEntry передаёт соседей (у list() они известны: _order и _nodes) — цена одна проверка contains на удаление. В trap.release: если previousFocus не isConnected — искать ближайший tabbable около сохранённой позиции (запоминаем в момент trap() пару { parent, nextSibling } и селектор), иначе opts.returnFocus как Element | () => Element. В _windowScroll: слушать focusin на viewport и держать focusedIndex; в range-computed расширять окно так, чтобы сфокусированная строка не выпадала (pin), а при programmatic scrollToIndex далеко — переносить фокус на container (tabindex=-1) с сохранением focusedIndex для roving (см. бриллиант №5). Бонус той же категории: wireForm scrollIntoView({ behavior: _motionOff() ? 'auto' : 'smooth' }) (7204).

**Алгоритм:**

```js
/** Фокус внутри удаляемых узлов → на соседа, иначе на fallback (родитель, tabindex=-1) */
function _focusNeighbor(nodes, fallback) {
    const a = document.activeElement;
    if (!a || a === document.body || !nodes.some(n => n === a || (n.nodeType === 1 && n.contains(a)))) return;
    const pick = (start, dir) => {
        for (let s = start; s; s = dir > 0 ? s.nextSibling : s.previousSibling) {
            if (s.nodeType !== 1 || s.hasAttribute('data-leaving')) continue;
            const f = s.matches(_FOCUSABLE) ? s : s.querySelector(_FOCUSABLE);
            if (f) return f;
        }
        return null;
    };
    const t = pick(nodes[nodes.length - 1].nextSibling, 1) || pick(nodes[0].previousSibling, -1) || fallback;
    if (!t) return;
    if (t === fallback && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
}
// list()._dropEntry: перед entry.scope.dispose(); _removeNodes(entry.nodes) → _focusNeighbor(entry.nodes, anchor.parentNode);
// (и в ветке leave-анимации — до _runTransition, чтобы фокус не висел на уходящей строке)
// show(): перед _removeNodes(old) (2636) → _focusNeighbor(old, anchor.parentNode);
// trap(): const prev = document.activeElement, prevParent = prev && prev.parentNode, prevNext = prev && prev.nextSibling;
//   release: const rf = typeof returnFocus === 'function' ? returnFocus() : returnFocus instanceof Element ? returnFocus : prev;
//            if (rf && rf.isConnected) rf.focus();
//            else if (prevParent && prevParent.isConnected) { const n = (prevNext && prevNext.isConnected ? prevNext : prevParent).matches?.(_FOCUSABLE) ? prevNext : prevParent.querySelector(_FOCUSABLE); (n || prevParent).focus?.(); }
// _windowScroll: const focusedIdx = signal(-1); on(viewport, 'focusin', e => { const row = e.target.closest('[data-aegis-index]'); focusedIdx.value = row ? +row.dataset.aegisIndex : -1; });
//   range: start = Math.min(start, focusedIdx.value >= 0 ? focusedIdx.value : Infinity) … end = Math.max(end, focusedIdx.value + 1) — строка с фокусом всегда в окне
```

**API:**

```js
trap(container, { returnFocus?: boolean | Element | (() => Element | null) })   // было только boolean
list(items, render, { key, focus?: 'neighbor' | false })          // default 'neighbor'
show(cond, branch, { focus?: 'neighbor' | false })
virtualScroll(parent, items, { mode: 'window', pinFocus?: boolean })   // default true
// d.ts: расширить TrapOptions.returnFocus; ListOptions.focus; ShowOptions.focus; VirtualScrollOptions.pinFocus
```

**Критерий:** test.html, секция 'фокус при удалении': (1) list(items) из 3 строк с <button>; фокус на кнопке строки 2; items.value = без строки 2 → document.activeElement === кнопка строки 3 (или !document.hasFocus()); (2) удалить последнюю строку при фокусе на ней → фокус на кнопке строки 1 (предыдущий сосед); (3) удалить единственную строку → activeElement === родитель списка, tabindex="-1"; (4) show(open, () => html`<button>`) при фокусе внутри и open=false → activeElement не body; (5) trap: кнопка-триггер в list(), trap(modal) → удалить триггер из items → release() → activeElement === соседняя кнопка, не body; (6) virtualScroll mode:'window', itemHeight 20, 1000 строк с кнопками: focus на строке 5, container.scrollTop = 5000; await nextTick → строка 5 всё ещё в DOM и в фокусе (pinFocus). Замер: 10 000 удалений строк без фокуса в них — время list() reconcile не изменилось более чем на 2% (одна проверка contains на строку).

**Источники:** React Aria FocusScope (restoreFocus: «if the element to restore is no longer in the DOM, focus the next tabbable after its previous position», packages/@react-aria/focus/src/FocusScope.tsx); Radix UI FocusScope; Heydon Pickering, Inclusive Components — «A Todo List» (фокус после удаления); GOV.UK Design System, «Notification banner: focus management»; WAI-ARIA APG «Developing a Keyboard Interface» §Managing Focus in Composites; WCAG 2.2 SC 2.4.3 Focus Order, 3.2.1 On Focus; TanStack Virtual/React Aria Virtualizer (persisted focused key при recycling).

### 💎 #43 — trap 3.0: стек ловушек, recapture на focusin, честные focusables (checkVisibility, shadow DOM, contenteditable)

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip внутри секции 26 (tree-shakeable вместе с trap)

**Сейчас:** _FOCUSABLE (aegis_full.js:7381) не включает [contenteditable]:not([contenteditable="false"]), audio/video[controls], iframe, summary, details и не исключает элементы внутри inert/[hidden]/closed <details>; фильтр el.offsetParent !== null (7416) не отсекает visibility:hidden (комментарий на 7415 утверждает обратное — offsetParent для visibility:hidden не null) и отсекает position:fixed (offsetParent === null у fixed-элементов в большинстве движков → фиксированная кнопка «закрыть» выпадает из цикла). querySelectorAll не заходит в shadow DOM — focusables внутри defineElement()-компонентов внутри модалки невидимы для ловушки, Tab с последнего light-DOM элемента перескочит их или выйдет из ловушки. Escape-обработчик вешается на document (7401) без стека: два вложенных trap() (модалка + datepicker в портале) закрываются одним Escape оба. Нет recapture: если фокус ушёл наружу не через Tab (клик по адресной строке и обратно, programmatic focus из resource-колбэка, SR-навигация по виртуальному курсору при inert: false) — ловушка не возвращает его. Первый Tab внутри контейнера, когда activeElement вне списка (например, на самом container с tabindex=-1), не перехватывается: onKeyDown (7433-7447) сравнивает только с first/last. React Aria FocusScope и Radix FocusScope делают стек, recapture по focusin и обход shadow root'ов через getActiveElement/ shadow-aware tree walker.

**Предложение:** (a) _tabbables(root): обход через TreeWalker с заходом в открытые shadowRoot и <slot>.assignedElements, фильтр el.checkVisibility?.({ visibilityProperty: true, contentVisibilityAuto: true }) ?? offsetParent-фолбэк, исключение el.closest('[inert]') (через composedPath-совместимый подъём), tabindex >= 0, для <details> без open — только summary. Расширенный селектор: + [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls], iframe, summary, [tabindex]. Активный элемент берём как _deepActive() — спускаемся по shadowRoot.activeElement. (b) Стек _trapStack: только верхняя ловушка обрабатывает Escape и recapture; trap() пушит, release() снимает, при снятии верхней — фокус возвращается ей, а не глобально. (c) recapture: on(document, 'focusin') — если верхняя ловушка и e.target вне container и вне allow → focus на lastFocused (запоминаем на focusin внутри) или на первый tabbable; Shift+Tab с container самого → last. (d) autoFocus: 'first' | 'container' | selector — APG рекомендует для диалогов с длинным текстом фокусировать статический элемент; сейчас это возможно только через data-autofocus.

**Алгоритм:**

```js
const _trapStack = [];
const _deepActive = () => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; };
const _FOCUSABLE = 'a[href],area[href],button,input,select,textarea,iframe,summary,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]';
/** tabbable-элементы в порядке документа, включая открытые shadow root'ы; inert/hidden/tabindex<0 исключены */
function _tabbables(root) {
    const out = [];
    const visible = (el) => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) : el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
    const walk = (node) => {
        for (let el = node.firstElementChild; el; el = el.nextElementSibling) {
            if (el.inert || el.hidden || (el.tagName === 'DETAILS' && !el.open && (walk(el.querySelector(':scope > summary') || el), true))) { if (el.tagName !== 'DETAILS') continue; else continue; }
            if (el.matches(_FOCUSABLE) && !el.disabled && el.tabIndex >= 0 && visible(el)) out.push(el);
            if (el.shadowRoot) walk(el.shadowRoot); else if (el.tagName === 'SLOT') el.assignedElements().forEach(walk);
            walk(el);
        }
    };
    walk(root);
    return out;
}
// внутри trap():
const rec = { container, allow, lastFocused: null, escape, release };
_trapStack.push(rec);
const top = () => _trapStack[_trapStack.length - 1] === rec;
extra.push(on(document, 'focusin', (e) => {
    if (!top()) return;
    const t = e.composedPath()[0];
    if (container.contains(t) || (t.closest && t.closest(allow))) { rec.lastFocused = t; return; }
    (rec.lastFocused && rec.lastFocused.isConnected ? rec.lastFocused : (_tabbables(container)[0] || container)).focus();
}));
// onKeyDown: const tabs = _tabbables(container); const a = _deepActive(); const i = tabs.indexOf(a);
//   if (e.shiftKey && (i <= 0)) { e.preventDefault(); tabs[tabs.length - 1].focus(); }
//   else if (!e.shiftKey && (i === tabs.length - 1 || i < 0)) { e.preventDefault(); tabs[0].focus(); }
// Escape: if (e.key === 'Escape' && top()) { … }
// release: _trapStack.splice(_trapStack.indexOf(rec), 1); … затем возврат фокуса (с фолбэком из бриллианта №2)
```

**API:**

```js
trap(container, {
    autoFocus?: boolean | 'first' | 'container' | string;     // селектор или стратегия; default true === 'first' (с [data-autofocus] приоритетом)
    escape?: boolean | ((e: KeyboardEvent) => void);
    outside?: boolean | ((e: PointerEvent) => void);
    inert?: boolean; allow?: string;
    returnFocus?: boolean | Element | (() => Element | null);
    recapture?: boolean;                                        // default true
}): (() => void) & { dispose(): void; refresh(): void }
// новый экспорт для авторов виджетов: export function tabbables(root: Element): HTMLElement[]
// d.ts: TrapOptions полностью (сейчас объявлен только autoFocus — aegis.d.ts:1150)
```

**Критерий:** test.html, секция 'trap 3.0': (1) контейнер с <button>, <div contenteditable>, <x-el> (defineElement с <button> в shadow), position:fixed <button>, <button style="visibility:hidden"> → tabbables(container).length === 4 и включает кнопку из shadow root; (2) фокус на последнем light-DOM элементе, keydown Tab → activeElement === x-el (или x-el.shadowRoot.activeElement — кнопка); (3) два trap(): внешний с escape: () => a++, внутренний с escape: () => b++; Escape → b === 1 && a === 0; release внутреннего; Escape → a === 1; (4) recapture: outsideBtn.focus() при активной ловушке → через nextTick activeElement внутри container (или !document.hasFocus()); (5) фокус на container (tabindex=-1), Tab → первый tabbable, Shift+Tab → последний; (6) trap(..., { autoFocus: 'container' }) → activeElement === container. Все существующие тесты 💎 #13 trap (test.html:4475-4497) и trap 2.0 (1979-1988) проходят без правок.

**Источники:** WAI-ARIA APG Dialog (Modal) pattern — keyboard interaction и «initial focus placement»; WHATWG HTML §6.6 Focus (tabindex-ordered focus navigation scope, shadow trees); CSSOM View Element.checkVisibility() (Chrome 105, Firefox 106, Safari 17.4); React Aria FocusScope (packages/@react-aria/focus: focusScopeTree, getFocusableTreeWalker с shadow DOM); Radix UI FocusScope (focusScopesStack); focus-trap (focus-trap/tabbable — tabbable.js критерии: visibility, details/summary, contenteditable, audio/video controls, position fixed); Inclusive Components «Modal dialogs».

### 💎 #44 — roving 2.0: grid/tree, typeahead, RTL, aria-activedescendant, выбранный tab-stop, живые элементы

**Impact:** 4 · **Effort:** M · **Size:** +0.7 KB gzip внутри секции 26 (grid ~150 B, typeahead ~150 B, activedescendant ~120 B, MutationObserver ~100 B, RTL/Page/selected ~180 B); tree-shakeable вместе с roving

**Сейчас:** roving() (aegis_full.js:7492-7548): одна ось или обе с одинаковым шагом (keyMap 7530-7534) — для grid (APG: Right/Left по ячейкам, Up/Down по строкам, Ctrl+Home/End, PageUp/Down) и tree (Right раскрывает, Left сворачивает/на родителя, * раскрывает уровень) не подходит; нет typeahead (первая буква в listbox/menu/tree — обязательное APG-требование); ArrowLeft/Right не инвертируются при dir="rtl"; init() (7504-7509) всегда даёт tabindex=0 items[0], а APG для tablist/listbox требует tab-stop на выбранном ([aria-selected="true"]/[aria-checked]/[aria-current]); getItems фильтрует только .disabled (7501), не [aria-disabled="true"] и не hidden; нет режима aria-activedescendant (combobox: фокус остаётся в <input>, «виртуальный» фокус движется по options) — сейчас такой виджет собрать нельзя без ручного кода; при удалении элемента с tabindex=0 через list() у виджета не остаётся ни одного tab-stop — недостижим с клавиатуры до refresh(); moveFocus (7511-7526) молча выходит, если activeElement не среди items (фокус был на контейнере). Radix RovingFocusGroup (dir, loop, currentTabStopId, orientation), React Aria useSelectableCollection (typeahead, layout: grid, virtual focus), Zag.js — базовый уровень 2024+.

**Предложение:** Расширить roving() без изменения текущей сигнатуры: orientation: 'grid' с cols: number | 'auto' (авто — по getBoundingClientRect().top групп) или layout по DOM ([role=row] > ячейки); Ctrl+Home/End, PageUp/PageDown (шаг page ?? 10 или клиентская высота / высота элемента); typeahead: true — буфер символов 500 мс (как APG), поиск по textContent/aria-label начиная со следующего элемента, циклически; dir: 'auto' — читаем getComputedStyle(container).direction, инвертируем горизонталь; initial: 'selected' | 'first' | number — tab-stop на [aria-selected="true"],[aria-checked="true"],[aria-current]; virtual: inputEl — режим aria-activedescendant: элементам гарантируем id (генерируем aegis-opt-N), фокус остаётся на inputEl, keydown слушаем на нём, активный элемент получает data-active + aria-activedescendant на input; observe: true — MutationObserver(childList) на container → refresh() с сохранением активного (если удалён — ближайший по индексу получает tabindex=0, а если фокус был на удалённом — фокус на него, стыкуется с бриллиантом №2); фильтр [aria-disabled="true"], hidden, inert; tree: true — Right/Left раскрывают/сворачивают через aria-expanded и переходят к первому ребёнку/родителю, '*' раскрывает уровень (selector '[role=treeitem]', иерархия по aria-level или вложенности [role=group]). Возвращаем активный индекс как сигнал active для интеграции с show()/list().

**Алгоритм:**

```js
export function roving(container, opts = {}) {
    const { selector = ':scope > *', orientation = 'horizontal', wrap = true, onActivate, cols = 'auto', typeahead = false, dir = 'auto', initial = 'selected', virtual = null, observe = false, page = 10, tree = false } = opts;
    const items = () => [...container.querySelectorAll(selector)].filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.hidden && !el.closest('[inert]'));
    const active = signal(-1, 'roving:active');
    const rtl = () => dir === 'rtl' || (dir === 'auto' && getComputedStyle(container).direction === 'rtl');
    const colCount = (arr) => cols !== 'auto' ? cols : (() => { const t = arr[0]?.getBoundingClientRect().top; let n = 0; while (n < arr.length && Math.abs(arr[n].getBoundingClientRect().top - t) < 1) n++; return n || 1; })();
    const setActive = (arr, i) => {
        if (i < 0 || i >= arr.length) return;
        if (virtual) { arr.forEach((el, k) => { if (!el.id) el.id = 'aegis-opt-' + (_uid++); el.toggleAttribute('data-active', k === i); }); virtual.setAttribute('aria-activedescendant', arr[i].id); arr[i].scrollIntoView?.({ block: 'nearest' }); }
        else { arr.forEach((el, k) => el.setAttribute('tabindex', k === i ? '0' : '-1')); arr[i].focus({ preventScroll: false }); }
        active.value = i; if (onActivate) onActivate(arr[i], i);
    };
    const init = () => { const arr = items(); if (!arr.length) return; let i = typeof initial === 'number' ? initial : initial === 'selected' ? arr.findIndex(el => el.matches('[aria-selected="true"],[aria-checked="true"],[aria-current]')) : 0; if (i < 0) i = Math.min(Math.max(active.peek(), 0), arr.length - 1); virtual ? setActive(arr, i) : arr.forEach((el, k) => el.setAttribute('tabindex', k === i ? '0' : '-1')); active.value = i; };
    let buf = '', bufT = 0;
    const onKeyDown = (e) => {
        const arr = items(); if (!arr.length) return;
        let cur = virtual ? active.peek() : arr.indexOf(_deepActive()); if (cur < 0) cur = Math.max(active.peek(), 0);
        const h = rtl() ? -1 : 1, n = arr.length, c = orientation === 'grid' ? colCount(arr) : 1;
        const step = { ArrowRight: orientation === 'vertical' ? 0 : h, ArrowLeft: orientation === 'vertical' ? 0 : -h, ArrowDown: orientation === 'horizontal' ? 0 : c, ArrowUp: orientation === 'horizontal' ? 0 : -c, PageDown: page * c, PageUp: -page * c }[e.key];
        let next;
        if (e.key === 'Home') next = e.ctrlKey || orientation !== 'grid' ? 0 : cur - cur % c;
        else if (e.key === 'End') next = e.ctrlKey || orientation !== 'grid' ? n - 1 : Math.min(n - 1, cur - cur % c + c - 1);
        else if (tree && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { /* aria-expanded toggle / parent via aria-level */ }
        else if (step) { if (!step) return; next = wrap && orientation !== 'grid' ? (cur + step + n) % n : Math.max(0, Math.min(n - 1, cur + step)); }
        else if (typeahead && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const now = Date.now(); buf = now - bufT < 500 ? buf + e.key : e.key; bufT = now;
            const q = buf.toLowerCase(); const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
            next = [...Array(n).keys()].map(k => (cur + 1 + k) % n).find(k => label(arr[k]).startsWith(q));
            if (next === undefined) return;
        } else return;
        e.preventDefault(); setActive(arr, next);
    };
    (virtual || container).addEventListener('keydown', onKeyDown);
    const mo = observe && typeof MutationObserver !== 'undefined' ? new MutationObserver(() => { const arr = items(); if (!arr.some(el => el.getAttribute('tabindex') === '0') || virtual) init(); }) : null;
    mo?.observe(container, { childList: true, subtree: true });
    init();
    // dispose снимает слушатель, mo.disconnect(), aria-activedescendant
    return { dispose, moveFocus: (d) => onKeyDown({ key: d > 0 ? 'ArrowDown' : 'ArrowUp', preventDefault() {} }), refresh: init, active, setActive: (i) => setActive(items(), i) };
}
```

**API:**

```js
roving(container, {
    selector?: string; orientation?: 'horizontal' | 'vertical' | 'both' | 'grid'; wrap?: boolean;
    cols?: number | 'auto'; page?: number;
    typeahead?: boolean; dir?: 'ltr' | 'rtl' | 'auto';
    initial?: 'selected' | 'first' | number;
    virtual?: HTMLElement | null;      // aria-activedescendant-режим: фокус остаётся на этом input
    observe?: boolean; tree?: boolean;
    onActivate?: (el: Element, index: number) => void;
}): { dispose(): void; moveFocus(delta: number): void; refresh(): void; active: ReadonlySignal<number>; setActive(i: number): void }
// Совместимость: все старые вызовы работают без изменений (test.html:710-725, 4499-4526)
```

**Критерий:** test.html, секция 'roving 2.0': (1) grid 3×3 кнопок (orientation:'grid', cols:3): фокус [0], ArrowDown → [3], ArrowRight → [4], End → [5], Ctrl+End → [8], Home → [6], PageUp → [0]; (2) listbox с текстами Apple/Banana/Cherry, typeahead:true: keydown 'c' → активен Cherry; 'b' в пределах 500 мс → 'cb' ничего не находит → активен остаётся Cherry; через fakeClock +600 мс 'b' → Banana; (3) container style direction:rtl, horizontal: ArrowRight с [1] → [0]; (4) initial:'selected': второй tab с aria-selected="true" получает tabindex="0", первый — "-1"; (5) virtual: input — после ArrowDown input остаётся activeElement, input.getAttribute('aria-activedescendant') === options[1].id, options[1].hasAttribute('data-active'); (6) observe:true + list(): удалить элемент с tabindex=0 → после MutationObserver-микротаска ровно один элемент с tabindex="0"; (7) tree: treeitem с aria-expanded="false", ArrowRight → aria-expanded="true", второй ArrowRight → фокус на первом дочернем treeitem, ArrowLeft → обратно на родителя. Ручная проверка APG-примеров Grid/Listbox/Tree со всеми действиями из таблиц Keyboard Interaction.

**Источники:** WAI-ARIA APG: Grid (Data Grid, Layout Grid) Keyboard Interaction, Listbox (type-ahead), Tree View, Tabs (tab-stop на выбранной вкладке), «Developing a Keyboard Interface» §Keyboard Navigation Inside Components (roving tabindex vs aria-activedescendant, RTL); ARIA 1.3 aria-activedescendant; Radix UI RovingFocusGroup (dir, loop, currentTabStopId); React Aria useSelectableCollection / useTypeSelect (500 ms buffer) / useGridList; Zag.js listbox/tree machines; Angular CDK FocusKeyManager (withTypeAhead, withHorizontalOrientation('rtl'), withWrap).

### 💎 #45 — hotkeys(): декларативные data-hotkey → click(), автоматический aria-keyshortcuts, чорды и mod

**Impact:** 4 · **Effort:** M · **Size:** +0.6 KB gzip как отдельный экспорт (парсер ~200 B, диспетчер ~250 B, aria-keyshortcuts ~100 B); tree-shakeable, ядро не растёт

**Сейчас:** Единственный механизм клавиатуры — модификаторы события @keydown.ctrl.enter на конкретном элементе (aegis_full.js:2074-2100): работают только когда фокус на этом элементе, нет глобальных/страничных сочетаний, нет чордов (g i), нет платформенного mod (Cmd на macOS / Ctrl иначе), нет защиты от срабатывания в input/textarea/contenteditable, и ничего не объявляется SR — ARIA 1.3 aria-keyshortcuts никем не проставляется. Для server-first HTML естественный API — атрибут на кнопке/ссылке, как @github/hotkey (data-hotkey), Datastar/HTMX-стиль; tinykeys даёт компактный парсер последовательностей (~400 B) без ARIA-части. Сейчас разработчику приходится писать on(document,'keydown',…) вручную в каждом острове, дублируя логику и забывая про поля ввода.

**Предложение:** export function hotkeys(root = document, map?) — единый диспетчер keydown на root: (a) декларативно: элементы с data-hotkey="mod+k" / "g i" (чорд через пробел, альтернативы через запятую) — при совпадении trigger.click() (для ссылок — navigate через click, для <button commandfor> — нативный invoker), фокус переносится, если data-hotkey-focus; (b) императивно: map { 'mod+k': (e) => …, 'g i': fn } с приоритетом над атрибутами; (c) парсер: токены mod|ctrl|meta|shift|alt + ключ (e.key в нижнем регистре, спец-имена esc/space/enter/up/down/left/right), mod → metaKey на Apple (navigator.userAgentData?.platform ?? navigator.platform), иначе ctrlKey; чорды — буфер 1000 мс; (d) не срабатывать, когда e.target редактируемый (input/textarea/select/contenteditable/[role=textbox]) и сочетание без модификаторов, кроме Escape и data-hotkey-scope="global"; (e) a11y: при регистрации ставить на trigger aria-keyshortcuts в формате ARIA («Control+K» / «Meta+K», для чордов «g i»), а title дополнять (опция hint: true); (f) видимость: если trigger не connected/скрыт (checkVisibility) или inert — не срабатывает (сочетание всплывающей панели не должно работать, пока она скрыта); (g) dev: hotkeys.list() — таблица активных сочетаний для панели DevTools, конфликты дублей → предупреждение E045.

**Алгоритм:**

```js
const _APPLE = /Mac|iPhone|iPad/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
const _KEYNAMES = { esc: 'escape', space: ' ', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', plus: '+' };
/** 'mod+k' → { ctrl, meta, shift, alt, key }; 'g i' → [step, step] */
function _parseHotkey(str) {
    return str.trim().split(/\s+/).map(chord => {
        const s = { ctrl: false, meta: false, shift: false, alt: false, key: '' };
        for (let t of chord.toLowerCase().split('+')) {
            if (t === 'mod') t = _APPLE ? 'meta' : 'ctrl';
            if (t in s) s[t] = true; else s.key = _KEYNAMES[t] || t;
        }
        return s;
    });
}
const _ariaOf = (steps) => steps.map(s => [s.ctrl && 'Control', s.alt && 'Alt', s.shift && 'Shift', s.meta && 'Meta', s.key.length === 1 ? s.key.toUpperCase() : s.key.replace(/^./, c => c.toUpperCase())].filter(Boolean).join('+')).join(' ');
const _editable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'textbox');

export function hotkeys(root = document, map = {}) {
    const seqs = new Map();   // строка → { steps, run, el }
    let pos = 0, last = 0, cands = null;
    const reg = (str, run, el) => { const steps = _parseHotkey(str); seqs.set(str, { steps, run, el }); if (el && !el.hasAttribute('aria-keyshortcuts')) el.setAttribute('aria-keyshortcuts', _ariaOf(steps)); };
    for (const [k, fn] of Object.entries(map)) for (const alt of k.split(',')) reg(alt, fn);
    const scan = () => { for (const el of (root.querySelectorAll ? root : document).querySelectorAll('[data-hotkey]')) for (const alt of el.dataset.hotkey.split(',')) if (!seqs.has(alt)) reg(alt, () => { if (el.matches('[data-hotkey-focus]')) el.focus(); el.click(); }, el); };
    scan();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(scan) : null; mo?.observe(root === document ? document.body : root, { childList: true, subtree: true });
    const match = (s, e) => s.ctrl === e.ctrlKey && s.meta === e.metaKey && s.shift === e.shiftKey && s.alt === e.altKey && s.key === e.key.toLowerCase();
    const onKey = (e) => {
        if (e.repeat || e.isComposing) return;
        const now = Date.now(); if (now - last > 1000) { pos = 0; cands = null; } last = now;
        const pool = cands || [...seqs.values()];
        const hit = pool.filter(h => h.steps[pos] && match(h.steps[pos], e));
        if (!hit.length) { pos = 0; cands = null; return; }
        const plain = !(e.ctrlKey || e.metaKey || e.altKey) && e.key !== 'Escape';
        const usable = hit.filter(h => !(plain && _editable(e.target) && !(h.el && h.el.dataset.hotkeyScope === 'global')) && (!h.el || (h.el.isConnected && !h.el.closest('[inert]') && (h.el.checkVisibility ? h.el.checkVisibility() : true))));
        if (!usable.length) return;
        const done = usable.find(h => h.steps.length === pos + 1);
        e.preventDefault();
        if (done) { pos = 0; cands = null; done.run(e, done.el); }
        else { pos++; cands = usable; }
    };
    root.addEventListener('keydown', onKey);
    const dispose = () => { root.removeEventListener('keydown', onKey); mo?.disconnect(); };
    if (_currentScope) _currentScope.onDispose(dispose);
    return { dispose, add: (k, fn) => reg(k, fn), list: () => [...seqs].map(([k, h]) => ({ keys: k, aria: _ariaOf(h.steps), el: h.el })) };
}
```

**API:**

```js
export function hotkeys(root?: Element | Document, map?: Record<string, (e: KeyboardEvent, trigger?: HTMLElement) => void>): { dispose(): void; add(keys: string, fn: (e: KeyboardEvent) => void): void; list(): Array<{ keys: string; aria: string; el?: HTMLElement }> }
// HTML: <button data-hotkey="mod+k" data-hotkey-focus>Search</button>   <a href="/inbox" data-hotkey="g i">Inbox</a>
//       data-hotkey-scope="global" — срабатывает и в полях ввода (для сочетаний без модификаторов)
// Грамматика: 'mod+k' | 'ctrl+shift+p' | 'g i' (чорд) | 'esc' | 'mod+k, ctrl+/' (альтернативы)
// SetupContext: ctx.hotkeys?(map) — авто-root = el острова, dispose со scope
// ERRORS.md: E045 — два триггера с одним сочетанием в одном root
```

**Критерий:** test.html, секция 'hotkeys()': (1) <button data-hotkey="mod+k"> + hotkeys(root): getAttribute('aria-keyshortcuts') === (_APPLE ? 'Meta+K' : 'Control+K'); keydown {key:'k', ctrlKey/metaKey по платформе} на root → click зафиксирован, e.defaultPrevented; (2) чорд 'g i': keydown 'g' затем 'i' → сработало 1 раз; 'g', fakeClock +1500 мс, 'i' → 0; (3) keydown 'k' без модификаторов внутри <input> при hotkeys(root, { k: fn }) → fn не вызван; тот же с data-hotkey-scope="global" → вызван; Escape в input → вызван; (4) триггер с hidden → не срабатывает; снять hidden → срабатывает без повторной регистрации; (5) элемент добавлен через list() после hotkeys() → зарегистрирован (MutationObserver) и получил aria-keyshortcuts; (6) dispose() снимает слушатель. Размер: esbuild --minify + gzip -9 функции hotkeys ≤ 650 B.

**Источники:** ARIA 1.3 aria-keyshortcuts (формат «Control+Shift+P», разделитель пробел для альтернатив); WHATWG HTML KeyboardEvent.key names (UI Events KeyboardEvent key Values); @github/hotkey (data-hotkey, чорды, платформенный Mod); tinykeys (парсер последовательностей, ~400 B); WCAG 2.2 SC 2.1.4 Character Key Shortcuts (одиночные символы — только при фокусе/с возможностью отключить — отсюда фильтр редактируемых полей и data-hotkey-scope); Gmail/GitHub/Linear keyboard conventions (g i, ?); React Aria useKeyboard; Angular CDK не покрывает — сравнение в пользу Aegis.

### 💎 #46 — announce 2.0: два постоянных live-региона, очередь, дедуп, интеграция со status resource/pending

**Impact:** 4 · **Effort:** S · **Size:** +0.2 KB gzip в секции 26 (второй регион + очередь ~15 строк)

**Сейчас:** announce() (aegis_full.js:7561-7580) создаёт регион лениво при первом вызове (7562-7572) — вопреки комментарию «Pre-exists in DOM»: VoiceOver/NVDA часто не озвучивают контент региона, вставленного в DOM в том же тике, что и сообщение (регион должен существовать заранее — требование WAI-ARIA 1.2 §live region и практики Angular CDK/React Aria). Один узел с переключаемым aria-live (7576): смена politeness на живом регионе NVDA/JAWS кэшируется ненадёжно; одновременно role="status" (7566) фиксирует polite — конфликт с 'assertive'. Очистка textContent + setTimeout(0) (7577-7579) при двух announce() подряд теряет первое сообщение (второй вызов затирает до озвучки). Нет возврата/очистки, нет отложенного удаления текста (сообщение висит навсегда и повторно читается при виртуальном обходе), нет привязки к resource(): loading → «Загрузка…» / error, что все современные фреймворки делают через useAnnounce/LiveAnnouncer. В router 2.0 (бриллиант №1) и в бриллианте №2 announce() становится системным механизмом — он должен быть надёжен.

**Предложение:** Два постоянных региона (polite: role=status; assertive: role=alert, aria-live=assertive), создаваемых один раз в момент первого import-side-effect безопасным способом — announce.init() вызывается из hydrate()/mount() (там document гарантированно есть) или явно; каждый регион — пара чередующихся <div> (как в React Aria LiveAnnouncer), чтобы одинаковый текст объявлялся повторно без хака «очистить-и-записать». Очередь: сообщения одного уровня ставятся с интервалом ≥ 150 мс (Angular CDK duration), assertive не ждёт; авто-очистка через clearAfter (default 7 с — как CDK), чтобы виртуальный курсор не натыкался на старое. Дедуп: одинаковое сообщение в течение 500 мс — один раз (быстрые обновления счётчиков). Возврат { clear() }. Реактивная форма: announce(signalOrFn, { politeness, format }) — эффект в текущем scope: объявляет при изменении; удобно для resource().status: announce(() => res.loading.value ? 'Загрузка' : res.error.value ? 'Ошибка' : `${res.data.value.length} результатов`). Опция region: Element — свой регион (для islands внутри shadow DOM, где глобальный регион не виден).

**Алгоритм:**

```js
const _live = { polite: null, assertive: null };
const _SR_ONLY = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
function _region(level) {
    if (_live[level]) return _live[level];
    const wrap = document.createElement('div'); wrap.style.cssText = _SR_ONLY; wrap.setAttribute('data-aegis-live', level);
    const mk = () => { const d = document.createElement('div'); d.setAttribute('role', level === 'assertive' ? 'alert' : 'status'); d.setAttribute('aria-live', level); d.setAttribute('aria-atomic', 'true'); wrap.appendChild(d); return d; };
    const r = { nodes: [mk(), mk()], i: 0, q: [], busy: false, last: '', lastT: 0 };
    document.body.appendChild(wrap);
    return (_live[level] = r);
}
announce.init = () => { if (typeof document !== 'undefined' && document.body) { _region('polite'); _region('assertive'); } };
export function announce(message, opts = 'polite') {
    const o = typeof opts === 'string' ? { politeness: opts } : (opts || {});
    const { politeness = 'polite', clearAfter = 7000, dedupe = 500 } = o;
    if (isSignal(message) || typeof message === 'function') {   // реактивная форма — в текущем scope
        let first = true;
        return effect(() => { const v = isSignal(message) ? message.value : message(); if (first) { first = false; if (!o.immediate) return; } if (v) announce(String(v), o); }, 'announce');
    }
    if (typeof document === 'undefined') return () => {};
    const r = _region(politeness), now = Date.now();
    if (message === r.last && now - r.lastT < dedupe) return () => {};
    r.last = message; r.lastT = now;
    const speak = () => {
        const node = r.nodes[r.i = 1 - r.i];
        r.nodes[1 - r.i].textContent = '';
        node.textContent = message;
        if (clearAfter) setTimeout(() => { if (node.textContent === message) node.textContent = ''; }, clearAfter);
        r.busy = true; setTimeout(() => { r.busy = false; const n = r.q.shift(); if (n) n(); }, politeness === 'assertive' ? 0 : 150);
    };
    if (r.busy && politeness !== 'assertive') r.q.push(speak); else speak();
    return () => { for (const n of r.nodes) if (n.textContent === message) n.textContent = ''; };
}
// hydrate()/mount(): в первом вызове — announce.init() (регион существует до первого сообщения)
```

**API:**

```js
announce(message: string, politeness?: 'polite' | 'assertive'): () => void   // совместимо; возвращает clear()
announce(message: string, opts: { politeness?: 'polite' | 'assertive'; clearAfter?: number; dedupe?: number; region?: Element }): () => void
announce(source: Signal<string | null> | (() => string | null), opts?: { politeness?; immediate?: boolean }): () => void   // реактивно, в текущем scope
announce.init(): void   // создать регионы заранее (вызывается из hydrate/mount)
// SetupContext: ctx.announce — привязан к scope
```

**Критерий:** test.html, обновить секцию 💎 #13 announce (4528-4540): (1) после первого mount() в документе есть [data-aegis-live="polite"] и [data-aegis-live="assertive"] ещё до вызова announce(); (2) announce('A'); announce('B') подряд → через 50 мс один из polite-узлов === 'A', через 250 мс другой === 'B' (оба объявлены, ничего не потеряно); (3) announce('X'); announce('X') в течение 500 мс → текст 'X' ровно в одном узле; announce('X') через 600 мс → в другом узле (чередование); (4) assertive: узел с role="alert" получает текст немедленно, polite-регион не тронут, aria-live polite-региона не менялся; (5) fakeClock +7000 → узлы пусты; (6) announce(() => res.loading.value ? 'Загрузка' : null) внутри scope → смена loading → текст 'Загрузка'; scope.dispose() → дальнейшие смены не объявляются; (7) возвращённый clear() обнуляет текст. Ручная проверка: NVDA 2024 + Firefox и VoiceOver + Safari произносят оба быстрых сообщения и повторное одинаковое.

**Источники:** WAI-ARIA 1.2/1.3 §Live Region Roles и «aria-live: регион должен присутствовать до обновления»; ARIA APG «Alert» и «Status» patterns; Angular CDK LiveAnnouncer (a11y/live-announcer: два региона по politeness, duration/clear, 100 мс задержка); React Aria LiveAnnouncer (@react-aria/live-announcer: пары чередующихся узлов, clearAnnouncer); Radix/Chakra useLiveRegion; Scott O'Hara «Are we live?» (ненадёжность смены aria-live на существующем узле, dedupe); Sarah Higley «Playing with state» (aria-live тесты NVDA/JAWS/VO).

## 🔭 aria-live-patterns

**Линза:** ARIA-паттерны и живые регионы: announce() (секция 26), aria-busy/aria-live при загрузке resource и list-изменениях, автоматический синтез атрибутов там, где движок знает семантику (show/when — состояния загрузки, list — count/position, router — aria-current уже есть, формы — aria-invalid/describedby, swap — role=status), reduced motion в transition/spring/animate, поддержка screen reader для оптимистичных обновлений и ошибок сети, доступные имена для островов. Сравни с APG Live Region Practices, ARIA 1.3, Sara Soueidan, Adrian Roselli, TPGi заметки, React Aria announce, Angular CDK LiveAnnouncer.

**Вывод:** Aegis уже закрывает то, что у большинства движков 2026 года лежит на плечах автора: trap() с inert-фоном и исключением [aria-live] (aegis_full.js:7397–7429), aria-current в router (8440–8458), aria-invalid/aria-describedby и aria-busy на форме в wireForm (7159–7181, 7306), и — редкость — единая точка reduced motion _motionOff() (5834), которую честно уважают transition/list/show/spring/flip/animate/boost/router (4501, 5885, 9394). Отстаёт он в «слышимости» динамики: announce() (7562–7580) — один ленивый div, у которого переключается aria-live на лету (AT кэшируют роль/live при вставке), два вызова за тик теряют первое сообщение, нет реактивной формы; router()/boost() не сбрасывают фокус и не объявляют заголовок страницы — то, что SvelteKit, Next, Nuxt и Astro делают из коробки; resource/when/mutation/optimistic/offline полностью немы для screen reader (здесь молчат и конкуренты — TanStack, React 19 Actions, HTMX, — это шанс уйти вперёд, а не догнать); wireForm ставит role="status" на каждое поле (7167) — N live-регионов хором при submit; swap() вставляет серверный HTML без единого слова для AT (9283–9342); диалоги trap()/modal() получают role="dialog" без имени (7419) — прямое нарушение APG/axe aria-dialog-name. Шесть предложений ниже закрывают WCAG 2.2 SC 4.1.3 Status Messages и 2.4.3 Focus Order на уровне движка, суммарно ≈ +2.1 KB gzip, всё tree-shakeable вместе со своими секциями.

**Отвергнуто:** 1) Автоматические обёртки role="alert"/aria-live вокруг веток when() или строк list() — нарушает контракт «строка = ровно узлы renderFn, без обёрток» (2765) и перекрывает семантику автора; вместо этого — общий announcer. 2) Объявлять каждое изменение list() (количество строк) по умолчанию — «болтливые» live-регионы (Soueidan, APG) хуже тишины; количество — семантика приложения, покрывается одной строкой live(() => t('results', { n })) из #1. 3) aria-busy на <body>/<html> во время router.pending — AT вправе подавить все обновления страницы; в #2 busy ставится только на outlet. 4) Режим defaults.motion = 'reduce' (crossfade вместо мгновенного переключения) — текущее мгновенное переключение уже удовлетворяет WCAG 2.3.3, а третий вариант CSS-контракта (4477–4483) усложняет контракт ради вкусового улучшения; автор может выставить defaults.motion = true и сам сузить анимацию в @media (prefers-reduced-motion). 5) Синтез aria-label островов из data-aegis/data-* — угаданные имена нарушают 2.5.3 Label in Name и не локализуются; правильнее dev-предупреждение E045 (#6). 6) speechSynthesis как fallback для пользователей без AT — не ассистивная технология, страницы не должны «говорить». 7) Полифилл озвучки aria-errormessage при фокусе — поддержка в JAWS/NVDA/VoiceOver уже нативная, не маскировать. 8) toast()/уведомления как компонент движка — UI, место в recipes/. 9) Инъекция skip-link/focus-visible-стилей — авторское решение по дизайну; сброс фокуса из #2 делает существующий skip-link достижимым, этого достаточно. 10) <output> вместо div для announcer (Roselli) — implicit role=status, но нестабильность в Safari/VoiceOver; остаёмся на div с явной ролью. 11) Отдельный «Aegis-Focus» заголовок сервера для управления фокусом после swap — фокус уже восстанавливается снимком (9327–9335), а серверу нечего добавить сверх [autofocus] во фрагменте.

### 💎 #47 — announce 2.0 — два предсозданных региона, очередь без потерь, ariaNotify, реактивный live()

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip (announce ≈ +0.15, live() +0.2 tree-shakeable, ariaNotify-детект +0.05)

**Сейчас:** aegis_full.js:7562–7580: один <div role="status"> создаётся лениво при ПЕРВОМ announce() — AT (VoiceOver, NVDA) часто не озвучивают первое сообщение региона, вставленного одновременно с текстом; на каждый вызов переписывается aria-live (7576) — читатели кэшируют live/role при вставке, а role="status" + aria-live="assertive" противоречат друг другу (status подразумевает polite). «Очистить, затем setTimeout(0)» (7578–7579): два announce() в одном тике → первый затирается до того, как a11y-дерево его увидит; wireForm так и делает — 7234 и 7320 подряд. Нет clear(), нет таймера очистки (текст висит вечно и перечитывается при навигации виртуальным курсором), нет дедупа. Реактивной формы нет: чтобы объявить сигнал, автор пишет effect + announce сам и получает поток «3 результата», «4 результата», «5…» на каждый ввод. Тест test.html:4528–4540 проверяет только создание и атрибут. reset() (9696) чистит один регион.

**Предложение:** (a) _liveInit(): два региона сразу — <div role="status" aria-live="polite"> и <div role="alert" aria-live="assertive">, aria-atomic, sr-only через clip-path; создаются при первом component()/hydrate() (3004/3340), а не при первом сообщении, чтобы к моменту announce() уже жили в дереве. (b) Запись без пустого кадра: одинаковый текст подряд чередуется невидимым суффиксом   — AT видит мутацию, глаз нет; сообщения в один регион разносятся ≥ 80 мс, чтобы каждое стало отдельной мутацией. (c) announce(msg, politeness | { politeness, clearAfter = 7000, dedupe }) → { clear() }; announce.clear(pol?); announce.init(). (d) Progressive enhancement: если есть document.ariaNotify (Chromium AriaNotify, origin trial 2025) — объявляем через него без DOM-региона. (e) live(source, { politeness, debounce = 300, format, immediate }) — сигнал/функция → регион: начальное значение не объявляется (это не «изменение»), равные значения пропускаются, дебаунс склеивает поток при вводе, отвязывается со scope. (f) reset() удаляет оба региона.

**Алгоритм:**

```js
// 26. ACCESSIBILITY
let _live = null;   // { polite, assertive, last: Map<el, string>, at: Map<el, ms>, timers: Map<el, id> }
const _SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
function _liveInit() {
    if (_live || typeof document === 'undefined') return _live;
    const mk = (role, pol) => { const d = document.createElement('div'); d.setAttribute('role', role); d.setAttribute('aria-live', pol); d.setAttribute('aria-atomic', 'true'); d.setAttribute('data-aegis-live', ''); d.style.cssText = _SR_ONLY; (document.body || document.documentElement).appendChild(d); return d; };
    _live = { polite: mk('status', 'polite'), assertive: mk('alert', 'assertive'), last: new Map(), at: new Map(), timers: new Map() };
    return _live;
}
// регионы должны жить в DOM ДО первого сообщения: component() и hydrate() зовут _liveInit() один раз
export function announce(message, opts = 'polite') {
    const o = typeof opts === 'string' ? { politeness: opts } : (opts || {});
    const pol = o.politeness === 'assertive' ? 'assertive' : 'polite';
    const msg = message == null ? '' : String(message);
    if (typeof document !== 'undefined' && typeof document.ariaNotify === 'function' && o.native !== false) { document.ariaNotify(msg, { priority: pol === 'assertive' ? 'high' : 'normal' }); return { clear() {} }; }
    const L = _liveInit(), el = L[pol];
    const prev = L.last.get(el), same = prev != null && prev.replace(/ $/, '') === msg;
    if (o.dedupe && same) return { clear: () => announce.clear(pol) };
    // одинаковый текст подряд: чередуем NBSP-хвост — AT видит изменение, без пустого кадра и setTimeout(0)
    const text = same && !prev.endsWith(' ') ? msg + ' ' : msg;
    // два сообщения в один регион за один тик — второе пишем отдельной мутацией через ≥ 80 мс
    const wait = Math.max(0, 80 - (performance.now() - (L.at.get(el) || -1e9)));
    const write = () => {
        L.last.set(el, text); L.at.set(el, performance.now()); el.textContent = text;
        clearTimeout(L.timers.get(el));
        if (o.clearAfter !== false) L.timers.set(el, setTimeout(() => { if (L.last.get(el) === text) { el.textContent = ''; L.last.delete(el); } }, o.clearAfter ?? 7000));
    };
    wait ? setTimeout(write, wait) : write();
    return { clear: () => { if (L.last.get(el) === text) { el.textContent = ''; L.last.delete(el); } } };
}
announce.clear = (pol) => { const L = _liveInit(); if (!L) return; for (const k of pol ? [pol] : ['polite', 'assertive']) { L[k].textContent = ''; L.last.delete(L[k]); } };
announce.init = () => { _liveInit(); };

/** Реактивное объявление: сигнал/функция → live-регион; начальное значение и повторы не объявляются, поток склеивается дебаунсом */
export function live(source, { politeness = 'polite', debounce = 300, format = (v) => v, immediate = false } = {}) {
    let first = !immediate, timer = 0, lastMsg;
    const d = effect(() => {
        const v = isSignal(source) ? source.value : source();
        untrack(() => {
            const msg = format(v);
            if (first) { first = false; lastMsg = msg; return; }
            if (msg == null || msg === false || msg === lastMsg) return;
            lastMsg = msg;
            clearTimeout(timer);
            timer = setTimeout(() => announce(String(msg), politeness), debounce);
        });
    }, 'live');
    if (_currentScope) _currentScope.onDispose(() => clearTimeout(timer));
    return d;
}
// reset(): if (_live) { _live.polite.remove(); _live.assertive.remove(); _live = null; }
```

**API:**

```js
export function announce(message: string, politeness?: 'polite' | 'assertive'): { clear(): void };
export function announce(message: string, opts: { politeness?: 'polite' | 'assertive'; clearAfter?: number | false; dedupe?: boolean; native?: boolean }): { clear(): void };
export namespace announce { function clear(politeness?: 'polite' | 'assertive'): void; function init(): void; }
export function live<T>(source: Signal<T> | (() => T), opts?: { politeness?: 'polite' | 'assertive'; debounce?: number; format?: (v: T) => string | null | false; immediate?: boolean }): () => void;
// пример: live(() => t('results', { n: rows.value.length }));  live(saveState, { format: s => s === 'saved' ? t('saved') : null })
```

**Критерий:** test.html, section('💎 a11y — announce 2.0 / live()'): (1) после mount() и до любого announce() document.querySelectorAll('[data-aegis-live]').length === 2, роли status/alert; (2) MutationObserver на polite-регион: announce('a'); announce('b') в одном тике → через 200 мс records.length === 2 и textContent === 'b' (сейчас — 1 запись); (3) announce('x'); announce('x') → вторая запись заканчивается на ' ', визуально текст тот же; (4) announce('err', 'assertive') → в alert-регионе, polite не тронут; (5) live(count, { debounce: 50 }): 5 присваиваний за 10 мс → ровно 1 мутация с последним значением, начальное значение не объявлено; (6) scope.dispose() → дальнейшие изменения count молчат; (7) announce('x', { clearAfter: 30 }) → через 60 мс textContent === ''; (8) reset() → регионов нет. Старые asserts 4528–4540 переписать под alert-регион.

**Источники:** WAI-ARIA 1.2 §aria-live, role=status/alert; WAI-ARIA APG «Live Regions»; WCAG 2.2 SC 4.1.3 Status Messages; Sara Soueidan «Accessible notifications with ARIA Live Regions» (Part 1/2, 2023 — матрица поддержки: регион должен существовать до изменения, переключение aria-live не читается); Scott O'Hara «Are we live?» (2022); Adrian Roselli, TPGi — live region test results; Angular CDK LiveAnnouncer (announce(message, politeness, duration), clear(), предсозданный элемент через LIVE_ANNOUNCER_ELEMENT_TOKEN); React Aria @react-aria/live-announcer (два региона polite+assertive, таймаут 7000 мс, clearAnnouncer); Microsoft/Chromium «AriaNotify» explainer и origin trial (2025): element.ariaNotify(message, { priority, interrupt }).

### 💎 #48 — Маршрут слышен: сброс фокуса и route announcer в router() и boost()

**Impact:** 5 · **Effort:** M · **Size:** +0.35 KB gzip (общий _afterNav в §30, вызовы в router/boost; tree-shakeable с ними)

**Сейчас:** router() (aegis_full.js:8114–8517) после handleRoute делает aria-current (8440–8458), scrollTo(0,0) (8341) или Navigation API scroll: 'after-transition' (8406), View Transitions с data-vt-type (8311–8325) — но фокус остаётся на ссылке старой страницы (которую dispose уровня (8256) удаляет из DOM → фокус молча падает на body, виртуальный курсор SR стоит на старом месте), заголовок новой страницы не объявляется; pending (8236–8307) не отражён в aria-busy. boost() (9352–9470): visit() меняет document.title (9380), делает swap (9384) и scrollTo (9385) — тоже молча. Это классическая проблема SPA-роутинга (Marcy Sutton/Gatsby 2019), которую SvelteKit, Next (RouteAnnouncer), Nuxt (<NuxtRouteAnnouncer>) и Astro (<ClientRouter>) решают из коробки; в тестах router 2.0 (test.html:1632, 2424) нет ни одного assert про activeElement.

**Предложение:** Общий _afterNav(rootEl, opts, to, from) в §30, вызываемый из handleRoute после currentPattern = … (кроме sameRoute-обновлений search) и из boost.visit после swap. Фокус (opts.focus = 'auto' | selector | Element | false): если в URL есть #fragment и цель существует — фокус на неё; иначе outlet текущего уровня / [data-aegis-outlet] / main / h1; элементу без tabindex временно даётся tabindex="-1" + data-aegis-focus (снимается при blur), focus({ preventScroll: true }) — скроллом уже управляют router/Navigation API. Не трогаем фокус, если handler сам сфокусировал что-то внутри новой страницы ([autofocus], поле поиска). Объявление (opts.announce = true | (to, from) => string | false): после кадра (заголовок часто ставится в handler/effect уже после рендера) announce(document.title || to.path, 'polite') с дедупом по последнему сообщению; смена только search не объявляется. aria-busy="true" на outlet/root на время pending (и на root boost на время fetch). Опция default: focus 'auto', announce true — для зрячих поведение не меняется (программный фокус на не-интерактивном элементе после клика мышью не рисует :focus-visible).

**Алгоритм:**

```js
// 30. ROUTER — общий пост-навигационный шаг
let _lastRouteMsg = null;   // reset() обнуляет
function _afterNav(rootEl, { focus = 'auto', announce: ann = true } = {}, to, from) {
    if (typeof document === 'undefined') return;
    if (focus !== false) {
        const frag = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
        const target = frag || (focus === 'auto'
            ? (rootEl && rootEl.nodeType === 1 ? rootEl : null) || document.querySelector('[data-aegis-outlet],main,[role="main"]') || document.querySelector('h1')
            : typeof focus === 'string' ? document.querySelector(focus) : focus);
        const a = document.activeElement;
        // handler уже сфокусировал что-то внутри новой страницы ([autofocus], поиск) — не мешаем
        if (target && !(a && a !== document.body && target.contains(a))) {
            if (!target.hasAttribute('tabindex')) {
                target.setAttribute('tabindex', '-1'); target.setAttribute('data-aegis-focus', '');
                target.addEventListener('blur', () => { if (target.hasAttribute('data-aegis-focus')) { target.removeAttribute('tabindex'); target.removeAttribute('data-aegis-focus'); } }, { once: true });
            }
            target.focus({ preventScroll: true });
        }
    }
    // заголовок успевает измениться в handler/effect — читаем после кадра
    if (ann !== false) _frame(() => {
        const msg = typeof ann === 'function' ? ann(to, from) : (document.title || to.path);
        if (msg && msg !== _lastRouteMsg) { _lastRouteMsg = msg; announce(msg, 'polite'); }
    });
}
// router(): в handleRoute после `currentPattern = match.node.pattern;`
//     _afterNav(levels.length ? levels[levels.length - 1].outlet || outletEl : outletEl, opts, to, from);
// router(): занятость outlet на время pending
//     effect(() => { const o = outletEl || (rootEl && rootEl.nodeType === 1 ? rootEl : null); if (!o) return; pending.value ? o.setAttribute('aria-busy', 'true') : o.removeAttribute('aria-busy'); }, 'router:busy');
// boost.visit(): el.setAttribute('aria-busy', 'true') перед fetchPage, removeAttribute в finally;
//     после `await swap(el, next, …)`: _afterNav(el, { focus: opts.focus, announce: opts.announce }, { path: url }, { path: prevPath });
```

**API:**

```js
router(routes, { …, focus?: 'auto' | string | Element | false; announce?: boolean | ((to: RouteInfo, from: RouteInfo) => string | null) });
boost({ …, focus?: 'auto' | string | Element | false; announce?: boolean | ((to, from) => string | null) });
// d.ts: RouterOptions.focus / RouterOptions.announce, BoostOptions.focus / BoostOptions.announce
```

**Критерий:** test.html, section('💎 a11y — route announcer'): router с outlet '#app', handler ставит document.title = 'Users'; r.navigate('/r-a11y/users') → после resolve: document.activeElement === outlet (или outlet.contains(activeElement)), outlet.getAttribute('tabindex') === '-1', polite-регион textContent === 'Users' (ждать 2 кадра); r.navigate('/r-a11y/users?page=2') (sameRoute) → количество мутаций региона не изменилось; r.navigate('/r-a11y/users#sec') с <section id="sec"> → activeElement === section; router(..., { focus: false }) → activeElement не изменился; во время медленного loader outlet.getAttribute('aria-busy') === 'true', после — атрибут снят; handler с input[autofocus] → фокус остаётся на input. boost(): mockFetch страницы с <title>Cart</title> → после visit: activeElement === main, объявлено 'Cart'.

**Источники:** Marcy Sutton «What we learned from user testing of accessible client-side routing techniques» (Gatsby, 2019) и Gatsby RouteAnnouncer; Next.js RouteAnnouncer (title → h1 → pathname); Nuxt 3.12 <NuxtRouteAnnouncer>; SvelteKit «Accessibility» docs (сброс фокуса + live-регион с <title> после каждой навигации); Astro <ClientRouter> route announcer (ожидание заголовка ~60 мс); Navigation API intercept({ scroll: 'after-transition' }); WCAG 2.2 SC 2.4.3 Focus Order, 2.4.2 Page Titled, 4.1.3 Status Messages; WAI-ARIA 1.2 aria-busy.

### 💎 #49 — Состояния сети слышны: aria-busy и объявления в when()/resource, mutation({ announce }), busy() вместо disabled, offline-очередь

**Impact:** 5 · **Effort:** M · **Size:** +0.5 KB gzip (when +0.15, mutation +0.1, busy() +0.15 tree-shakeable, коды сообщений en/ru +0.1)

**Сейчас:** _resultShape (aegis_full.js:3698–3730) даёт loading/validating/error/status, но ни один DOM-хелпер их не озвучивает. when() (2698–2740) меняет ветки loading→data→error молча: контейнер не помечается aria-busy, ошибка появляется без role/announce, приход данных после скелетона для SR неотличим от тишины. mutation() (3873–3963): pending/error — сигналы; откат оптимистичных патчей (3924–3926) и конфликт 412 (3910–3921) молчат — зрячий видит, как строка исчезла и вернулась, SR-пользователь — ничего. Документированный паттерн `?disabled=${addTodo.pending}` (3847) отключает сфокусированную кнопку → фокус выпадает на body, SR теряет место (Roselli «Don't Disable Form Controls»), хотя double-submit уже гарантирован concurrent: 'ignore' (3947). offlineResource: online/syncing/_offlineFailed (8992, 9163) — молча. Единственный aria-busy в движке — на форме в wireForm (7306). Здесь молчат и конкуренты (TanStack Query, React 19 useOptimistic/Actions, HTMX hx-indicator — только класс), это WCAG 4.1.3 в чистом виде.

**Предложение:** (a) when(res, branches, { busy = true, announce }) — третий аргумент: aria-busy на anchor.parentElement пока state === 'loading' или res.validating (без объявления — refetch поверх данных не событие); announce: по умолчанию { error: e => e.message || _msg('a11y.error') } assertive; data: rows => … объявляется polite только при переходе loading→data (не при первом рендере с готовыми данными); loading: опционально (по APG не объявлять короткие ожидания). (b) mutation(fn, { announce: true | { pending?, success?, error?, conflict? } }) — строки или (result|error, ...args) => string; true → дефолты из _MESSAGES: saved / failed (+ «изменение отменено», если были откачены патчи) / conflict; error/conflict — assertive. (c) busy(el, pending, { label? }) — aria-busy + aria-disabled + data-busy, клики/Enter глушатся capture-слушателем, disabled никогда не ставится → фокус остаётся, стиль через [data-busy]. (d) offlineResource: announce true → «Сохранено офлайн, отправится позже» при постановке в очередь, assertive при попадании в failed. (e) _MESSAGES расширяется кодами a11y.* (en/ru), setValidationMessages получает алиас setMessages.

**Алгоритм:**

```js
// 20. I18N — коды a11y (en/ru)
// _MESSAGES.en: 'a11y.error': 'Something went wrong', 'a11y.saved': 'Saved', 'a11y.undone': 'Change reverted', 'a11y.conflict': 'Someone else changed this record', 'a11y.queued': 'Saved offline, will sync later', 'a11y.formErrors': '{n} errors in the form', 'a11y.step': 'Step {n} of {total}'
const _errText = (e) => (e && e.message) || _msg('a11y.error');
const _say = (spec, key, pol, ...args) => {
    if (!spec || spec[key] === false) return;
    const f = spec === true ? _A11Y_DEFAULT[key] : spec[key];
    const m = typeof f === 'function' ? f(...args) : f;
    if (m) announce(String(m), pol);
};
const _A11Y_DEFAULT = { error: (e) => _errText(e), success: () => _msg('a11y.saved'), conflict: () => _msg('a11y.conflict'), queued: () => _msg('a11y.queued') };

// 6. when(): третий аргумент { busy, announce }
export function when(res, branches = {}, wopts = {}) {
    const { busy = true, announce: ann = { error: _errText } } = wopts;
    …
    const render = () => {
        const st = state.value; if (st === shown) return;
        const p = anchor.parentNode; if (!p) return;
        if (st === 'error') _say(ann, 'error', 'assertive', res.error.peek());
        else if (st === 'data' && shown === 'loading') _say(ann, 'data', 'polite', res.data.peek());   // только после реального ожидания
        else if (st === 'loading') _say(ann, 'loading', 'polite');
        clear(); shown = st; …
    };
    // занятость контейнера: loading или validating (refetch поверх данных) — без объявления
    if (busy) effect(() => {
        const on_ = state.value === 'loading' || !!(res.validating && res.validating.value);
        const p = anchor.parentNode; if (p && p.nodeType === 1) on_ ? p.setAttribute('aria-busy', 'true') : p.removeAttribute('aria-busy');
    }, 'when:busy');
    if (parentScope) parentScope.onDispose(() => { const p = anchor.parentNode; if (p && p.nodeType === 1) p.removeAttribute('aria-busy'); });
}

// 9. mutation(): в exec
//   успех (после invalidates): _say(announce, 'success', 'polite', result, ...args);
//   catch, конфликт 412/409 (перед onConflict): _say(announce, 'conflict', 'assertive', e);
//   catch, обычная ошибка (после drop()): _say(announce, 'error', 'assertive', e, { rolledBack: owned.length > 0 });
//   _A11Y_DEFAULT.error = (e, m) => _errText(e) + (m && m.rolledBack ? '. ' + _msg('a11y.undone') : '');

// 6. busy(): занятость без disabled — фокус остаётся, клики глушатся
export function busy(el, pending) {
    const block = (e) => { if (_readBinding(pending)) { e.preventDefault(); e.stopImmediatePropagation(); } };
    const offs = [on(el, 'click', block, { capture: true }), on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') block(e); }, { capture: true })];
    const d = effect(() => {
        const p = !!_readBinding(pending);
        el.toggleAttribute('data-busy', p);
        if (p) { el.setAttribute('aria-busy', 'true'); el.setAttribute('aria-disabled', 'true'); }
        else { el.removeAttribute('aria-busy'); el.removeAttribute('aria-disabled'); }
    }, _dev() ? `busy@${_tag(el)}` : undefined);
    return () => { d(); for (const f of offs) f(); };
}
// 33. offlineResource: при постановке мутации в очередь (offline) — _say(opts.announce, 'queued', 'polite'); при записи в _offlineFailed — _say(opts.announce, 'error', 'assertive', err)
```

**API:**

```js
when(res, branches, opts?: { busy?: boolean; announce?: false | { loading?: Msg; error?: Msg<Error>; data?: Msg<T> } });   // Msg<X> = string | ((x: X) => string | null | false) | false
mutation(fn, { …, announce?: true | { pending?: Msg; success?: Msg<R>; error?: Msg<Error>; conflict?: Msg<Error> } });
resource(url, { …, offline: { announce?: true | { queued?: Msg; error?: Msg<Error> } } });
export function busy(el: Element, pending: Signal<boolean> | (() => boolean)): () => void;
export function setMessages(dict: Record<string, string> | ((code: string, params?: object) => string)): void;   // алиас setValidationMessages, коды a11y.*
// html``: <button ${attach(el => busy(el, save.pending))}>Save</button>
```

**Критерий:** test.html, section('💎 a11y — состояния сети'): (1) when(res, …) внутри <div id="host">: пока fetcher висит — host.getAttribute('aria-busy') === 'true'; после ответа — атрибут снят; refresh() поверх данных → aria-busy снова 'true', мутаций polite-региона 0; (2) fetcher reject(new Error('boom')) → alert-регион textContent === 'boom'; announce: false → регион пуст; (3) announce: { data: rows => rows.length + ' rows' } → polite 'N rows' ровно один раз, а when() с уже готовыми данными (initial) — ни одного объявления; (4) mutation с optimistic и падающим fn, announce: true → alert содержит 'Change reverted' (lang=en) / 'изменение отменено' (lang=ru), data откатилась; (5) busy(btn, m.pending): во время pending btn.disabled === false, btn.getAttribute('aria-disabled') === 'true', document.activeElement === btn, второй click не вызывает handler; после — атрибуты сняты; (6) offlineResource с navigator.onLine-моком false: send() → polite 'Saved offline…'.

**Источники:** WCAG 2.2 SC 4.1.3 Status Messages (примеры в Understanding: результаты поиска, индикатор занятости, ошибка); WAI-ARIA 1.2 aria-busy; APG Feed pattern (aria-busy на контейнере во время загрузки); Adrian Roselli «Don't Disable Form Controls» (2024) и Axess Lab «Disabled buttons suck»; Angular Material MatSnackBar через CDK LiveAnnouncer (politeness per message); React Aria ProgressBar/useProgressBar (aria-busy, live); GOV.UK Design System Notification banner (role=alert для ошибок); сравнение: TanStack Query, React 19 useOptimistic, HTMX hx-indicator (класс htmx-request, без aria-busy) — a11y отсутствует.

### 💎 #50 — Формы без хора live-регионов: сводка при submit, aria-errormessage, aria-invalid только при ошибке, шаги wizard с фокусом, smooth-scroll под reduced motion

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip (перестановка в wireForm + errorList + 2 кода сообщений)

**Сейчас:** wireForm (aegis_full.js:7159–7181): созданный span ошибки получает role="status" (7167) — каждое поле становится live-регионом; validate() (7195–7207) и submit (7311–7315) выставляют все ошибки разом → N одновременных polite-объявлений сталкиваются (AT читает последнее или мешанину), причём текст меняется вместе с hidden (7178) — регион, который «появляется» одновременно с текстом, по матрице Soueidan часто не читается вовсе. aria-invalid="false" пишется на все поля при подключении (7176) — шум, ARIA считает отсутствие атрибута = false. Нет aria-errormessage (ARIA 1.2). В mode: 'live' каждое нажатие переписывает текст ошибки → болтовня. При провале submit фокус идёт на первое невалидное (7313), но сколько ошибок и где — не сказано. aria-describedby перезаписывается (7172) — авторский hint-элемент теряется. Wizard (7343–7362): смена шага прячет секции через hidden, фокус остаётся на скрытой кнопке «Далее» → выпадает на body; «Шаг 2 из 3» не объявляется. scrollIntoView({ behavior: 'smooth' }) (7204) игнорирует reducedMotion — спецификация не сводит smooth к auto автоматически.

**Предложение:** Политика a11y: { field: 'blur' | 'live' | 'off' = 'blur', summary = true }. Span ошибки — описание, не live-регион (без role; role="status" — только при field: 'live' для совместимости). aria-describedby дополняется, а не заменяется; aria-invalid и aria-errormessage ставятся только при ошибке и снимаются вместе (ARIA 1.2: errormessage валиден лишь при invalid=true). Blur с новой ошибкой → одно polite-объявление «<label>: <ошибка>»; ввод в live-режиме — молча (текст обновляется в describedby). Провал submit/validate → одно assertive «N ошибок в форме. <label первой>: <текст>» + фокус на первое поле (уже есть) с behavior: _motionOff() ? 'auto' : 'smooth'. f.errorList — computed [{ key, message, el }] для GOV.UK-style error summary автора. Wizard: активный шаг получает role="group" + aria-labelledby от заголовка/legend, фокус на первый focusable шага или заголовок (tabindex=-1), объявление _msg('a11y.step', { n, total }) + заголовок; [data-step-nav] индикаторы получают aria-current="step".

**Алгоритм:**

```js
// 25. WIREFORM
const { a11y = {} } = opts;   // { field: 'blur' | 'live' | 'off', summary: boolean }
const _labelOf = (input) => (input.labels && input.labels[0] && input.labels[0].textContent.trim()) || input.getAttribute('aria-label') || input.name;
…
if (!errorEl) { errorEl = document.createElement('span'); errorEl.id = …; errorEl.className = 'aegis-field-error'; /* без role: это описание поля, не live-регион */ … }
if (a11y.field === 'live') errorEl.setAttribute('role', 'status');           // старое поведение — opt-in
const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
if (!ids.includes(errorEl.id)) input.setAttribute('aria-describedby', [...ids, errorEl.id].join(' '));   // не затирать hint автора
effect(() => {
    const err = errors[key].value;
    if (err) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-errormessage', errorEl.id); }
    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-errormessage'); }   // ARIA 1.2: errormessage только при invalid=true
    errorEl.textContent = err || ''; errorEl.hidden = !err;
    if (native !== false && typeof input.setCustomValidity === 'function') input.setCustomValidity(err || '');
}, `form:${key}:a11y`);
const onBlur = () => {
    touched[key].value = true;
    if (mode === 'submit') return;
    const was = errors[key].peek(); _validateField(key); const now = errors[key].peek();
    if (a11y.field !== 'off' && now && now !== was) announce(_labelOf(input) + ': ' + now);   // одно поле — одно объявление
};
// провал validate()/submit: сводка вместо N регионов
const _failed = () => {
    const bad = Object.keys(fields).filter(k => errors[k].peek());
    const first = bad.length ? _inputs[bad[0]] : null;
    if (a11y.summary !== false && bad.length) announce(_msg('a11y.formErrors', { n: bad.length }) + '. ' + (first ? _labelOf(first) + ': ' : '') + errors[bad[0]].peek(), 'assertive');
    if (first) { first.focus(); first.scrollIntoView?.({ behavior: _motionOff() ? 'auto' : 'smooth', block: 'center' }); }
};
// validate(): if (!ok) _failed();   submit(): if (!(await V.validateAsync())) { _failed(); return; }   setErrors(): вместо announce($form) + focus → _failed() (плюс $form assertive, если только он)
const errorList = computed(() => Object.keys(fields).filter(k => errors[k].value).map(k => ({ key: k, message: errors[k].value, el: _inputs[k] })), 'wireForm:errorList');

// wizard: шаг сменился → группа, имя, фокус, объявление
let firstStep = true;
effect(() => {
    const cur = step.value;
    stepEls.forEach((el, i) => { el.hidden = i !== cur; });
    const s = stepEls[cur];
    if (!s.hasAttribute('role')) s.setAttribute('role', 'group');
    const h = s.querySelector('h1,h2,h3,h4,h5,h6,legend,[data-step-title]');
    if (h) { if (!h.id) h.id = `${formEl.id || 'aegis-form'}-step-${cur}`; s.setAttribute('aria-labelledby', h.id); }
    formEl.querySelectorAll('[data-step-nav]').forEach((n, i) => i === cur ? n.setAttribute('aria-current', 'step') : n.removeAttribute('aria-current'));
    if (firstStep) { firstStep = false; return; }
    const f = s.querySelector(_FOCUSABLE) || h || s;
    if (f === h || f === s) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: false });
    announce(_msg('a11y.step', { n: cur + 1, total: stepCount }) + (h ? ': ' + h.textContent.trim() : ''));
});
```

**API:**

```js
wireForm(formEl, { …, a11y?: { field?: 'blur' | 'live' | 'off'; summary?: boolean } });
// возвращаемое: + errorList: ReadonlySignal<Array<{ key: string; message: string; el: HTMLElement }>>
// DOM-контракт: <span class="aegis-field-error"> без role; input[aria-invalid][aria-errormessage] только при ошибке; шаги: [data-step] → role=group + aria-labelledby, [data-step-nav] → aria-current="step"
// сообщения: setMessages({ 'a11y.formErrors': '{n} ошибок в форме', 'a11y.step': 'Шаг {n} из {total}' })
```

**Критерий:** test.html, section('💎 a11y — формы без хора'): форма из 3 required-полей с <label>; submit()(fakeEvent) на пустых → formEl.querySelectorAll('[role="status"]').length === 0; у каждого invalid input aria-invalid === 'true' и aria-errormessage === span.id; у валидного поля hasAttribute('aria-invalid') === false; alert-регион получил ровно 1 мутацию с текстом, соответствующим /^3 /; activeElement === первый input; f.errorList.value.length === 3. Blur одного поля с ошибкой → polite-регион 'Email: …' (1 мутация); mode: 'live' и 5 keydown/input → мутаций регионов не добавилось. Поле с готовым aria-describedby="hint" → после wireForm атрибут === 'hint <id ошибки>'. Wizard: f.next() → activeElement внутри stepEls[1], stepEls[1].getAttribute('role') === 'group', polite 'Step 2 of 3: …'. defaults.motion = false + стаб input.scrollIntoView → вызван с { behavior: 'auto' }.

**Источники:** WCAG 2.2 SC 3.3.1 Error Identification, 3.3.3 Error Suggestion, 4.1.3 Status Messages, 2.3.3 Animation from Interactions; WAI-ARIA 1.2 aria-errormessage («authors MUST use aria-invalid with aria-errormessage»), aria-invalid; a11ysupport.io — таблица поддержки aria-errormessage (JAWS/NVDA/VoiceOver); GOV.UK Design System «Error summary» / «Error message» (валидация на submit, фокус на сводку, один канал объявления); Sara Soueidan «Accessible notifications» (регион, появляющийся вместе с текстом, не читается) и «Accessible form validation» заметки; Angular Signal Forms (2025): aria-invalid только для touched; React Aria useTextField (описание ошибки через aria-describedby + aria-invalid); CSSOM View scrollIntoView behavior и обсуждение prefers-reduced-motion в CSSWG.

### 💎 #51 — swap(): объявление от сервера — заголовок Aegis-Announce, <template data-aegis-announce>, aria-busy в boost

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip (в §34, tree-shakeable со swap/boost)

**Сейчас:** swap() (aegis_full.js:9283–9342) — единственная дверь для серверного HTML: dispose островов, вставка, hydrate, снятие data-cloak, восстановление фокуса/каретки (9327–9335), событие aegis:swap (9341) — и ни слова для AT. Частичные обновления в стиле HTMX («в корзине 3 товара», «сохранено») — классический немой апдейт (WCAG 4.1.3), и HTMX/Turbo тоже его не решают. Response передаётся в swap целиком (9286), но читается только .text() — заголовки, где сервер мог бы сказать, что изменилось, выбрасываются; при этом прецедент есть: _config.invalidateHeader 'Aegis-Invalidate' (1230) — сервер уже управляет кэшем через заголовок. boost.visit (9367–9391): pending — сигнал, root не помечается aria-busy на время fetch; fetchPage (9361–9366) возвращает только текст, заголовки теряются.

**Предложение:** Три источника объявления в порядке приоритета, молчание — если target уже внутри [aria-live]/role=status|alert|log (браузер объявит сам): (1) opts.announce: string | (inserted) => string | false; (2) во фрагменте <template data-aegis-announce[="assertive"]>Корзина: 3 товара</template> — забирается и удаляется, либо обычный элемент [data-aegis-announce] — объявляется его textContent, остаётся в DOM; (3) заголовок ответа Aegis-Announce: <текст>[;assertive] (имя настраивается configure({ announceHeader }), false — выключить; не-ASCII — percent-encoding, декодируем). boost: fetchPage возвращает { html, res }, после swap объявляется заголовок, иначе срабатывает _afterNav из #2 (title); root получает aria-busy на время fetch. Сервер (Django/Rails/Laravel/Go) добавляет одну строку в ответ фрагмента — и каждый partial update становится слышимым без клиентского кода.

**Алгоритм:**

```js
// 4. _config: announceHeader: 'Aegis-Announce',   // заголовок ответа с текстом для announce(); false — выключить
function _headerAnnounce(res) {
    const h = _config.announceHeader && res && res.headers && res.headers.get(_config.announceHeader);
    if (!h) return null;
    const i = h.lastIndexOf(';'), pol = i > 0 && h.slice(i + 1).trim() === 'assertive' ? 'assertive' : 'polite';
    let msg = (i > 0 && /^\s*(assertive|polite)\s*$/.test(h.slice(i + 1)) ? h.slice(0, i) : h).trim();
    try { msg = decodeURIComponent(msg); } catch (e) { /* не закодировано */ }
    return msg ? { msg, pol } : null;
}
// 34. swap()
export async function swap(target, htmlOrResponse, opts = {}) {
    const { mode = 'inner', select, transition = false, hydrate: doHydrate = true, announce: ann } = opts;
    let html = htmlOrResponse, fromHeader = null;
    if (typeof Response !== 'undefined' && html instanceof Response) { fromHeader = _headerAnnounce(html); html = await html.text(); }
    …
    const queued = [];
    const apply = () => {
        … (вставка как сейчас)
        // <template data-aegis-announce> внутри фрагмента — забрать и убрать; элемент [data-aegis-announce] — прочитать и оставить
        for (const n of inserted) if (n.nodeType === 1) {
            const found = n.matches('[data-aegis-announce]') ? [n] : [...n.querySelectorAll('[data-aegis-announce]')];
            for (const t of found) {
                const m = (t.content ? t.content.textContent : t.textContent).trim();
                if (m) queued.push({ msg: m, pol: t.getAttribute('data-aegis-announce') === 'assertive' ? 'assertive' : 'polite' });
                if (t.tagName === 'TEMPLATE') t.remove();
            }
        }
        … (data-cloak, hydrate, _focusRestore)
    };
    …
    // приоритет: opts.announce → фрагмент → заголовок; молчим, если target уже живой регион
    const inLive = target.closest && target.closest('[aria-live],[role="status"],[role="alert"],[role="log"]');
    if (ann !== false && !inLive) {
        const explicit = typeof ann === 'function' ? ann(inserted) : typeof ann === 'string' ? ann : null;
        if (explicit) announce(explicit);
        else for (const q of (queued.length ? queued : fromHeader ? [fromHeader] : [])) announce(q.msg, q.pol);
    }
    target.dispatchEvent?.(new CustomEvent('aegis:swap', { bubbles: true, detail: { mode, inserted, announced: queued.length ? queued : fromHeader ? [fromHeader] : [] } }));
    return { inserted };
}
// boost(): fetchPage → request(...).then(async r => ({ html: await r.text(), ann: _headerAnnounce(r) }));
//   visit(): el.setAttribute('aria-busy', 'true') перед fetchPage; в finally el.removeAttribute('aria-busy');
//   после swap: if (page.ann) announce(page.ann.msg, page.ann.pol); else _afterNav(el, opts, …)   // из #2
```

**API:**

```js
swap(target, htmlOrResponse, { …, announce?: string | ((inserted: Node[]) => string | null) | false });
configure({ announceHeader?: string | false });   // default 'Aegis-Announce'
// сервер: `Aegis-Announce: Item added to cart` или `Aegis-Announce: %D0%9E%D1%88%D0%B8%D0%B1%D0%BA%D0%B0;assertive`
// фрагмент: <template data-aegis-announce>Cart: 3 items</template>  |  <p data-aegis-announce="assertive">Payment failed</p>
// событие aegis:swap → detail.announced: Array<{ msg, pol }>
```

**Критерий:** test.html, section('💎 a11y — swap объявляет'): (1) new Response('<b>ok</b>', { headers: { 'Aegis-Announce': 'Cart updated' } }) → swap(el, resp) → polite-регион 'Cart updated'; с ';assertive' — alert-регион; (2) строка '<p>x</p><template data-aegis-announce>3 items</template>' → объявлено '3 items', el.querySelector('template') === null, <p> вставлен; (3) '<p data-aegis-announce="assertive">Failed</p>' → alert 'Failed', элемент остался; (4) target с aria-live="polite" + заголовок → мутаций регионов announcer 0; (5) { announce: false } → 0 мутаций при заголовке; { announce: n => n.length + ' nodes' } → 'N nodes' перекрывает заголовок; (6) configure({ announceHeader: false }) → заголовок игнорируется; (7) boost с mockFetch, задержка 30 мс: во время visit main.getAttribute('aria-busy') === 'true', после — снят, страница с заголовком Aegis-Announce объявляет его вместо title.

**Источники:** WCAG 2.2 SC 4.1.3 Status Messages; HTMX response headers HX-Trigger/HX-Location (прецедент «сервер управляет клиентом заголовками») и обсуждения a11y немых swap'ов в issue-трекере htmx; Hotwire Turbo Streams (нет a11y-канала — пробел на рынке); Datastar SSE-события; собственный прецедент Aegis-Invalidate (aegis_full.js:1230); RFC 8187 / percent-encoding для не-ASCII в заголовках; Sara Soueidan «Accessible notifications» Part 2 (уведомления о фоновых изменениях); GOV.UK Notification banner.

### 💎 #52 — Авто-ARIA там, где движок знает семантику: имя диалога в trap()/modal() + E045, aria-controls/aria-expanded в command(), aria-orientation в roving(), aria-busy острова при загрузке

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip (распределено по §26, §31, §8; предупреждение — только текст)

**Сейчас:** trap() (aegis_full.js:7419–7420) ставит role="dialog" и aria-modal="true", но не даёт диалогу имени — SR произносит «диалог» без контекста; это нарушение APG Dialog (Modal) и правило axe aria-dialog-name; modal() (7471) на <dialog> тоже не проверяет имя. roving() (7493–7548) управляет только tabindex: для вертикальных tablist/toolbar/menubar APG требует aria-orientation="vertical", иначе SR подсказывает неверные клавиши. command() (8552–8613) знает и триггер (data-command, data-target, 8573), и цель, но не связывает их aria-controls и не отражает состояние toggle через aria-expanded — нативные popovertarget/commandfor делают это неявно, data-command-fallback — нет. hydrate(): остров с data-aegis-state="pending" (3412) скрыт CSS visibility:hidden (5530) — для eager это верно, но для visible/interaction/idle между началом mount() и done() (import + монтирование, 3387–3410) остров виден, интерактивен на вид и не помечен aria-busy; состояние 'error' (3401, 3409) для AT неотличимо от готового.

**Предложение:** (a) _ensureName(el, kind): если нет aria-label/aria-labelledby — взять первый h1–h6/[data-title] внутри, дать ему id, поставить aria-labelledby; иначе dev-предупреждение E045 «dialog has no accessible name» (what/why/fix, один раз на элемент). Вызывать в trap() после role и в modal() при первом открытии; в hydrate.done — для островов с ролью landmark (region/dialog/navigation/complementary/form) без имени. (b) roving(): при orientation !== 'both' и роли контейнера из {tablist, toolbar, menubar, menu, listbox, tree, radiogroup} — aria-orientation, если не задан автором. (c) command(): при execute/onCommand — target.id (генерируется при отсутствии) → aria-controls на триггере; состояние цели (hidden / dialog.open / :popover-open) снимается до handler и в микротаске после — если изменилось или aria-expanded уже стоит, обновить aria-expanded. (d) hydrate(): el.setAttribute('aria-busy','true') в начале mount() (загрузка кода + монтирование), снятие в done() и в обоих catch; при ошибке — data-aegis-state="error" остаётся, aria-busy снимается.

**Алгоритм:**

```js
// 26. ACCESSIBILITY
let _uidN = 0;
const _uid = (p) => `${p}-${(++_uidN).toString(36)}`;
function _ensureName(el, kind) {
    if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return true;
    const h = el.querySelector('h1,h2,h3,h4,h5,h6,[data-title]');
    if (h) { if (!h.id) h.id = _uid('aegis-title'); el.setAttribute('aria-labelledby', h.id); return true; }
    _warn('E045', {
        what: `${kind} has no accessible name.`,
        why: 'Screen readers announce just "dialog"/"region" with no context; APG requires aria-labelledby or aria-label.',
        fix: 'Put a heading (h1–h6) inside, or set aria-label="…" / aria-labelledby="id".',
    }, 'name:' + _tag(el));
    return false;
}
// trap(): после setAttribute('role','dialog') / aria-modal:   _ensureName(container, 'dialog');
// modal(): в effect при v && !dialog.open перед showModal():   _ensureName(dialog, '<dialog>');

// roving(): ориентация композита
const role = container.getAttribute('role') || '';
if (orientation !== 'both' && /^(tablist|toolbar|menubar|menu|listbox|tree|radiogroup)$/.test(role) && !container.hasAttribute('aria-orientation')) container.setAttribute('aria-orientation', orientation);

// 31. COMMAND — связь и состояние триггера
const _openState = (t) => t.tagName === 'DIALOG' ? t.open : (t.matches && t.matches(':popover-open')) ? true : !t.hidden;
const _syncTrigger = (trigger, target, before) => {
    if (!target || !trigger || !trigger.setAttribute) return;
    if (!target.id) target.id = _uid('aegis-target');
    if (!trigger.hasAttribute('aria-controls')) trigger.setAttribute('aria-controls', target.id);
    queueMicrotask(() => { const after = _openState(target); if (after !== before || trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', String(after)); });   // hidden/open изменился → это toggle
};
// execute(): const before = target ? _openState(target) : null; handler(trigger, target); if (target) _syncTrigger(trigger, target, before);
// onCommand(): const before = e.target ? _openState(e.target) : null; handlers.get(cmd)(e.source, e.target); if (e.target) _syncTrigger(e.source, e.target, before);

// 8. hydrate(): занятость острова между началом mount() и done()
const mount = () => {
    _pending.delete(el); _cancelPending.delete(el);
    el.setAttribute('aria-busy', 'true');
    const fn = loadSetup(); …
};
// done(): el.removeAttribute('aria-busy'); if (_dev() && /^(region|dialog|navigation|complementary|form)$/.test(el.getAttribute('role') || '')) _ensureName(el, `island "${name}"`);
// оба catch (3401, 3409): el.removeAttribute('aria-busy'); el.dataset.aegisState = 'error';
```

**API:**

```js
// Без новых сигнатур. DOM-контракт:
// trap(el) / modal(dialog): el[aria-labelledby] ← первый h1–h6/[data-title] внутри (id генерируется); иначе E045 в dev
// roving(el, { orientation }): el[aria-orientation] для ролей tablist/toolbar/menubar/menu/listbox/tree/radiogroup
// command(): trigger[aria-controls]=target.id; trigger[aria-expanded] синхронизируется с hidden / dialog.open / :popover-open после каждого выполнения
// hydrate(): остров [aria-busy="true"] от начала загрузки кода до aegis:hydrated; снимается и при ошибке
// ERRORS.md: E045 — «Диалог/регион без доступного имени» (what/why/fix)
```

**Критерий:** test.html, section('💎 a11y — авто-ARIA'): (1) trap() на <div><h2>Title</h2><button/></div> → container.getAttribute('aria-labelledby') === h2.id, h2.id непустой; повторный trap() не меняет id; (2) trap() на <div><button/></div> → onWarn ловит E045 ровно один раз, второй trap того же элемента — молча (дедуп по ключу); контейнер с aria-label → без E045; (3) roving(role="tablist", { orientation: 'vertical' }) → aria-orientation === 'vertical'; role="toolbar" horizontal → 'horizontal'; div без role → атрибута нет; автор задал aria-orientation → не перезаписан; (4) command(root, { 'toggle-menu': (t, m) => m.hidden = !m.hidden }); click по [data-command="toggle-menu"][data-target="#menu"] → после микротаска trigger.aria-controls === 'menu', aria-expanded === 'true'; второй клик → 'false'; команда без изменения hidden → aria-expanded не появляется; (5) register('slow', { load: () => new Promise(r => setTimeout(() => r(() => {}), 30)) }); hydrate(host) → сразу host.firstElementChild.getAttribute('aria-busy') === 'true', после handles.ready — атрибут снят, data-aegis-state === 'hydrated'; load reject → aria-busy снят, data-aegis-state === 'error'.

**Источники:** WAI-ARIA APG Dialog (Modal) pattern («The dialog has aria-labelledby or aria-label»); axe-core правило aria-dialog-name; WAI-ARIA APG Tabs / Toolbar / Menubar (aria-orientation для вертикальных композитов); WAI-ARIA 1.2 aria-controls, aria-expanded, aria-busy; HTML Living Standard: popovertarget-инвокеры получают неявный aria-expanded (браузер) — Aegis повторяет для data-command; Invoker Commands API (commandfor/command, Chromium 135+, 2025); Deque «aria-expanded on disclosure buttons»; Adrian Roselli «Dialog Focus in Screen Readers»; сравнение: Qwik/Astro islands не помечают гидрируемый остров aria-busy.

## 🔭 a11y-dev-tooling

**Линза:** Инструменты доступности в dev-режиме: предупреждения движка об a11y-дефектах, которые он может обнаружить сам (кнопка без имени в html``, интерактивный div без role/tabindex, @click на не-фокусируемом, изображение без alt, label без связи, modal без aria-modal, list() без семантического контейнера), вкладка a11y в aegis-devtools.js (дерево фокуса, порядок табуляции, live-регионы, контраст), axe-подобные проверки в aegis-test.js (render().a11y()), автотесты клавиатурной навигации. Сравни с axe-core правилами, eslint-plugin-jsx-a11y, Chrome Accessibility tree, @testing-library/jest-dom, Storybook a11y.

**Вывод:** Aegis уже сильнее большинства движков 2026 в рантайм-a11y: trap() с inert/escape/outside (aegis_full.js:7396–7465), modal() на нативном <dialog> (:7471), roving() (:7493), announce() (:7563), aria-current в роутере (:8455), aria-invalid/aria-describedby/setCustomValidity в wireForm (:7159–7181), снимок фокуса при swap/morph (:9197–9210). Но в части ОБНАРУЖЕНИЯ дефектов он на нуле: 44 dev-предупреждения (E001–E044) не содержат ни одного про доступность, хотя _parseTemplate (:1689) — это фактически компилятор, работающий один раз на strings и умеющий ставить каретку под токен в исходнике (_warn token → aegis-devtools.js snippet). Svelte даёт ~30 a11y-предупреждений в компиляторе, Astro — Audit в dev-toolbar, Storybook — axe; у Vue/Solid/Preact/Qwik/HTMX этого нет — Aegis может занять нишу «zero-build движок с compile-time a11y-линтером и кареткой в исходнике», причём с нулевой стоимостью в проде (линтер живёт в лениво загружаемом aegis-devtools.js). Реальные дефекты в собственном demo (admin.html:221 — кнопка «☰» без имени) подтверждают нужду. aegis-test.js (154 строки) не имеет ни accessible name, ни byRole, ни Tab-эмуляции — тесты trap()/roving() в test.html:4474–4525 проверяют только атрибуты tabindex, а не движение фокуса. Предлагаемая связка: E045–E049 линтер шаблонов (ядро +150 B), общий модуль aegis-a11y.js (name/role/audit/tabOrder/ariaSnapshot, 0 KB в бандле), render().a11y()/byRole()/fire.tab(), детектор потери фокуса E050 (реальный footgun list(): замена объекта строки уничтожает строку с полем, в котором печатает пользователь), вкладка a11y в devtools с порядком табуляции, монитором live-регионов и контрастом.

**Отвергнуто:** 1) Встраивание axe-core (≈500 KB) в aegis-test.js/devtools — противоречит zero-dep и размеру; вместо этого лёгкий движок (~3.5 KB gzip) + адаптер: если в globalThis есть axe, render().a11y({ engine: axe }) делегирует ему. 2) Авто-исправление разметки в проде (авто role=button+tabindex на div с @click, авто aria-label из title) — маскирует дефект, ломает семантику; trap() уже спорно ставит role/aria-modal сам (:7419–7420), расширять это не стоит. 3) ESLint-плагин для html`` (аналог eslint-plugin-lit-a11y) — движок zero-build, целевая аудитория без линтера; runtime-линтер видит реальный DOM (role по факту, label по факту) и даёт каретку тем же механизмом, что E031–E034. 4) Симуляция речи скринридера (guidepup / @guidepup/virtual-screen-reader) — тяжело и хрупко; aria-снимок в стиле Playwright даёт 80 % пользы. 5) Только APCA (WCAG 3 draft) для контраста — WCAG 2.x остаётся нормативом до 2027+; в devtools показываем оба, в ядро не тащим. 6) Page-level правила (landmark-one-main, heading-order, html-has-lang, document-title) в compile-time линтере — шаблон не знает страницу; они только в runtime-audit при root === document. 7) E047 на любой <div @click> — ложные срабатывания на контейнерах делегирования (`@click` на <ul> с e.target.closest('li')); правило исключает элементы с интерактивными потомками в шаблоне и контейнеры ul/ol/table/form. 8) Найдено вне линзы, не предлагается здесь, но стоит починить: _FOCUSABLE (:7381) не знает summary, [contenteditable], audio/video[controls], iframe и details; фильтр offsetParent !== null (:7416) выбрасывает position:fixed-элементы внутри модалки; aegis.d.ts:1150 типизирует trap только { autoFocus } при реальных escape/outside/inert/allow/returnFocus; announce() (:7563) при двух вызовах подряд в одном тике теряет первое сообщение (общий setTimeout без очереди).

### 💎 #53 — Compile-time a11y-линтер шаблонов html`` (E045–E049) с кареткой в исходнике

**Impact:** 5 · **Effort:** M · **Size:** +0.15 KB gzip в aegis.js (хук + 1 строка в _warn); +2.5 KB gzip в aegis-devtools.js (dev-only, лениво, не входит в 75 KB)

**Сейчас:** _parseTemplate (aegis_full.js:1689–1849) разбирает шаблон один раз на strings и уже делает три статических проверки: E033 чужой синтаксис (:1700–1708), E006 позиция значения (:1826), E032/E034 события (:2142–2160). Ни одной проверки доступности нет: html`<button @click=${f}><svg/></button>`, html`<img src=${u}>`, html`<div @click=${f}>`, html`<input>` без label, aria-lable проходят молча. Собственное demo/admin.html:221 содержит кнопку «☰» без имени. Единственный инструмент — внешний axe в e2e, без привязки к строке шаблона. При этом инфраструктура для каретки под токеном (_warn token → snippet() в aegis-devtools.js) готова.

**Предложение:** После tpl.innerHTML = out (:1846) в dev-режиме передать клон tpl.content (до _compileParts — там ещё видны <!--aegis--> и __aegis_N__, то есть известно, что динамично) в функцию lint() из aegis-devtools.js (лениво через _devtoolsModule, :154; после первой загрузки — синхронно, чтобы strict-режим бросал на месте вызова html``). Пять правил с нулём ложных срабатываний по замыслу «предупреждать только о доказуемом»: E045 <img> без атрибута alt (alt=${x} и alt="" — ок); E046 button / a[href] / [role=button|link|dialog] / <dialog> без имени: нет aria-label(ledby)/title, нет непустого текста, нет <!--aegis--> внутри (динамичное имя — не трогаем), нет img[alt]/svg>title; E047 @click/@pointerdown/@dblclick на неинтерактивном элементе без role+tabindex, если внутри нет интерактивных потомков (делегирование) и это не ul/ol/table/form; также tabindex>0 и role=button без tabindex; E048 input/select/textarea (кроме hidden/submit/button/reset/image) без id, не внутри <label>, без aria-label/labelledby/title — с id проверка уходит в runtime-audit (label может быть серверным); E049 aria-* не из списка ARIA 1.3 / неизвестная role — с did-you-mean через _nearest (:3011). В _warn (:126) разрешить info.strings, чтобы асинхронный вызов с site мог позиционировать токен. Коды документируются в ERRORS.md и DOCS в devtools.

**Алгоритм:**

```js
// aegis_full.js, _parseTemplate после :1846
const tpl = document.createElement('template');
tpl.innerHTML = out;
if (_dev()) _lint(tpl.content.cloneNode(true), strings, _curSite);   // клон: _compileParts снимет маркеры
return { tpl, parts: _compileParts(tpl.content, bindings, tagBindings, textIndices) };

// dev: a11y-линтер живёт в aegis-devtools.js; первый шаблон — асинхронно, дальше синхронно (strict бросает на месте)
let _lintMod;
function _lint(root, strings, site) {
    const run = (m) => { if (m && m.lint) for (const v of m.lint(root)) _warn(v.code, { ...v, site, strings }, v.code + ':' + v.token + ':' + (site ? site.short : '')); };
    if (_lintMod) run(_lintMod); else _devtoolsModule().then(m => run(_lintMod = m || {}));
}
// _warn (:126): const strings = info.strings || (site ? null : _curStrings);

// aegis-devtools.js
const DYN = /__aegis_\d+__/, ARIA = new Set(['label','labelledby','describedby','hidden','expanded','controls','current','live','atomic','relevant','busy','modal','selected','checked','pressed','disabled','invalid','required','readonly','haspopup','owns','activedescendant','level','posinset','setsize','valuenow','valuemin','valuemax','valuetext','orientation','multiselectable','sort','placeholder','roledescription','keyshortcuts','details','errormessage','colcount','colindex','rowcount','rowindex','autocomplete','multiline','flowto','dropeffect','grabbed','description','braillelabel','brailleroledescription']);
const ROLES = new Set('alert alertdialog application article banner button cell checkbox columnheader combobox complementary contentinfo definition dialog directory document feed figure form grid gridcell group heading img link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio navigation none note option presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status switch tab table tablist tabpanel term textbox timer toolbar tooltip tree treegrid treeitem comment mark suggestion image'.split(' '));
const INTER = 'a[href],button,input,select,textarea,summary,[contenteditable],[tabindex],[role=button],[role=link],[role=menuitem],[role=tab],[role=option],[role=checkbox],[role=switch],[role=radio],[role=slider]';
const dyn = (el) => !!document.createTreeWalker(el, NodeFilter.SHOW_COMMENT).nextNode();   // <!--aegis--> внутри — имя динамическое
const named = (el) => ['aria-label','aria-labelledby','title'].some(a => el.hasAttribute(a)) || dyn(el) || el.textContent.trim() || el.querySelector('img[alt]:not([alt=""]),svg>title,[aria-label]');
export function lint(root) {
    const out = [], push = (code, el, what, why, fix) => out.push({ code, token: '<' + el.localName, what: `html\`\`: ${what}`, why, fix, el: null });
    for (const el of root.querySelectorAll('img:not([alt])')) push('E045', el, '<img> has no alt attribute.', 'Screen readers read the file name; axe rule image-alt, WCAG 1.1.1.', 'alt="…" describing the image, or alt="" for a decorative one.');
    for (const el of root.querySelectorAll('button,a[href],[role=button],[role=link],[role=dialog],[role=alertdialog],dialog')) if (!named(el)) push('E046', el, `<${el.localName}> has no accessible name.`, 'An icon-only control is announced as just "button"; axe button-name/link-name, WCAG 4.1.2.', 'Add aria-label="Close", visually-hidden text, or <svg><title>.');
    for (const el of root.querySelectorAll('*')) {
        const ti = el.getAttribute('tabindex');
        if (ti && +ti > 0) push('E047', el, `tabindex="${ti}" — positive tabindex breaks the natural tab order.`, 'axe tabindex; focus jumps ahead of the reading order.', 'Use tabindex="0" and DOM order.');
        const click = [...el.attributes].some(a => /^@(click|dblclick|pointerdown|pointerup|mousedown)\b/.test(a.name));
        if (click && !el.matches(INTER) && !el.matches('ul,ol,table,tbody,form,menu') && !el.querySelector(INTER)) push('E047', el, `@click on <${el.localName}> that is not focusable.`, 'Keyboard users cannot reach it; axe/jsx-a11y no-static-element-interactions, click-events-have-key-events.', 'Use <button>, or add role="button" tabindex="0" and @keydown.enter/.space.');
        if (el.getAttribute('role') === 'button' && !el.matches('button,[tabindex]')) push('E047', el, 'role="button" without tabindex.', 'The role alone does not make the element focusable.', 'Add tabindex="0" (or use <button>).');
        for (const a of el.attributes) {
            if (a.name.startsWith('aria-') && !ARIA.has(a.name.slice(5))) { const near = nearest(a.name.slice(5), [...ARIA]); push('E049', el, `"${a.name}" is not an ARIA attribute.`, 'Unknown aria-* is ignored by browsers; axe aria-valid-attr.', near ? `Did you mean aria-${near}?` : 'See ARIA 1.3 states and properties.'); }
            if (a.name === 'role' && !DYN.test(a.value) && !a.value.split(/\s+/).every(r => ROLES.has(r))) push('E049', el, `role="${a.value}" is not a valid ARIA role.`, 'axe aria-roles.', `Did you mean role="${nearest(a.value, [...ROLES]) || '…'}"?`);
        }
    }
    for (const el of root.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea'))
        if (!el.closest('label') && !el.id && !['aria-label','aria-labelledby','title'].some(a => el.hasAttribute(a))) push('E048', el, `<${el.localName}> has no label and no id — nothing can label it.`, 'Screen readers announce only the type; axe label, WCAG 1.3.1/4.1.2.', 'Wrap it in <label>, or give it an id + <label for>, or aria-label.');
    return out;
}
// Стоимость: 3 querySelectorAll на уникальный шаблон (~30–80 µs), 0 в проде (_dev() false → ветка не выполняется).
```

**API:**

```js
// без нового публичного API: предупреждения E045–E049 идут через существующие onWarn()/AegisWarning/strict-режим
onWarn(w => w.code.startsWith('E04') && codes.push(w.code));
Aegis.dev.explain('E046');
// aegis-devtools.js
export function lint(templateContent: DocumentFragment): Array<{ code: 'E045'|'E046'|'E047'|'E048'|'E049'; token: string; what: string; why: string; fix: string }>;
// aegis.d.ts (WarningInfo.code расширить), ERRORS.md: строки E045–E049
```

**Критерий:** test.html, section('a11y-линтер E045–E049'): после прогрева (await html`<i></i>`; await wait(0)) при onWarn: html`<img src="a.png">` → E045; html`<img src="a" alt=${sig}>` и alt="" → без предупреждений; html`<button @click=${f}><svg></svg></button>` → E046; html`<button>${label}</button>` и <button aria-label="x"> → нет; html`<div @click=${f}>x</div>` → E047, а html`<ul @click=${f}><li><button>a</button></li></ul>` и html`<div role="button" tabindex="0" @click=${f}>` → нет; html`<input type="text">` → E048, html`<label>Name <input></label>` и <input id="q"> → нет; html`<div aria-lable="x">` → E049 с fix, содержащим 'aria-label'; повтор того же шаблона → дедуп (0 новых). В strict: второй вызов html`<img>` бросает AegisWarning синхронно. Измерение: lint() на шаблоне demo/admin.html из 40 элементов ≤ 0.2 мс; demo даёт ровно один E046 (строка 221) до правки и ноль после.

**Источники:** Svelte compiler a11y warnings (a11y-missing-attribute, a11y-click-events-have-key-events, a11y-no-static-element-interactions, a11y-label-has-associated-control, a11y-no-noninteractive-tabindex, a11y-unknown-aria-attribute, a11y-unknown-role); eslint-plugin-jsx-a11y / eslint-plugin-lit-a11y; axe-core rules image-alt, button-name, link-name, label, tabindex, aria-valid-attr, aria-roles; WAI-ARIA 1.3 §6.6 States and Properties; ARIA in HTML (W3C) §3 allowed roles; WCAG 2.2 SC 1.1.1, 1.3.1, 2.1.1, 4.1.2.

### 💎 #54 — aegis-a11y.js: accessible name/role, audit() и testing-library-стиль render().byRole()/a11y() в aegis-test.js

**Impact:** 5 · **Effort:** L · **Size:** 0 KB в aegis.js; новый модуль aegis-a11y.js ≈3.5 KB gzip (export './a11y'), импортируется aegis-test.js и aegis-devtools.js; +0.4 KB в aegis-test.js

**Сейчас:** aegis-test.js (154 строки) даёт find(selector)/findAll/text() (строки 47–50) — тесты пишутся по CSS-селекторам и классам, что никак не проверяет доступность: t.find('.btn-save') проходит и для кнопки без имени. Нет вычисления accessible name, роли, нет аудита. В test.html a11y-тесты (4474–4540) проверяют атрибуты (role=dialog, tabindex=0), а не то, что услышит пользователь. Единственная альтернатива — axe в Playwright (500 KB, вне unit-тестов). Chrome Accessibility tree недоступен из JS (computedName/computedRole так и не вышли из флага).

**Предложение:** Новый модуль aegis-a11y.js без зависимостей: name(el) — упрощённый accname 1.2 (шаги 2A hidden, 2B aria-labelledby, 2C aria-label, 2D нативные label/alt/legend/caption/svg>title, 2E embedded control внутри label, 2F name-from-content для ролей, допускающих это, + ::before/::after content, 2I title); role(el) — явная role или implicit по ARIA-in-HTML (таблица ~45 записей: a[href]→link, input[type]→…, select→combobox/listbox, header/footer с учётом article/section, img[alt=""]→presentation, ul→list, li→listitem, h1–h6→heading и т.д.); audit(root, opts) — ~20 правил в формате axe ({ rule, impact, el, message, help }): button-name, link-name, image-alt, label, aria-valid-attr, aria-valid-attr-value (булевы значения и разрешимость idref у labelledby/describedby/controls/activedescendant), aria-roles, aria-required-attr (checkbox/switch без aria-checked на не-нативном, slider без valuenow, combobox без expanded, role=heading без level), duplicate-id-aria, aria-hidden-focus, tabindex, nested-interactive, list/listitem/definition-list, dialog-name, scrollable-region-focusable (актуально для virtualScroll()), color-contrast (opt-in, требует layout), а при root===document — landmark-one-main, page-has-heading-one, html-has-lang, document-title. В aegis-test.js: t.byRole(role, { name, hidden }), t.byLabel(text), t.byText(text), t.name(el), t.a11y(opts) → { violations, pass }, t.expectA11y() бросает с форматированным списком; при ошибке byRole печатает все доступные роли+имена контейнера (как Testing Library). Опция { engine: globalThis.axe } делегирует axe, если он подключён.

**Алгоритм:**

```js
// aegis-a11y.js
const FROM_CONTENT = new Set(['button','link','menuitem','menuitemcheckbox','menuitemradio','tab','option','checkbox','radio','switch','heading','cell','columnheader','rowheader','gridcell','row','treeitem','tooltip','listitem','link','sectionhead']);
const IMPLICIT = { a: e => e.hasAttribute('href') ? 'link' : null, area: e => e.hasAttribute('href') ? 'link' : null, button: 'button', summary: 'button', input: e => e.hasAttribute('list') ? 'combobox' : ({ button: 'button', submit: 'button', reset: 'button', image: 'button', checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', search: 'searchbox', hidden: null }[e.type] ?? 'textbox'), select: e => e.multiple || e.size > 1 ? 'listbox' : 'combobox', textarea: 'textbox', option: 'option', optgroup: 'group', datalist: 'listbox', img: e => e.getAttribute('alt') === '' ? 'presentation' : 'img', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', ul: 'list', ol: 'list', menu: 'list', li: 'listitem', dl: 'list', nav: 'navigation', main: 'main', aside: 'complementary', header: e => e.closest('article,aside,main,nav,section') ? null : 'banner', footer: e => e.closest('article,aside,main,nav,section') ? null : 'contentinfo', form: e => name(e) ? 'form' : null, section: e => name(e) ? 'region' : null, article: 'article', table: 'table', tr: 'row', td: 'cell', th: e => e.scope === 'row' ? 'rowheader' : 'columnheader', thead: 'rowgroup', tbody: 'rowgroup', tfoot: 'rowgroup', dialog: 'dialog', details: 'group', fieldset: 'group', progress: 'progressbar', meter: 'meter', output: 'status', hr: 'separator', p: 'paragraph', search: 'search' };
export function role(el) { const r = el.getAttribute('role'); if (r) return r.trim().split(/\s+/)[0]; const f = IMPLICIT[el.localName]; return typeof f === 'function' ? f(el) : f || null; }
const hidden = (el) => el.hidden || el.getAttribute('aria-hidden') === 'true' || (el.isConnected && (getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden'));
const pseudo = (el, p) => { if (!el.isConnected) return ''; const c = getComputedStyle(el, p).content; return /^"(.*)"$/.test(c) ? RegExp.$1 : ''; };
function acc(node, seen, trav) {   // trav: 0 корень, 1 обход content, 2 обход labelledby (hidden допустим)
    if (!node || seen.has(node)) return ''; seen.add(node);
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1) return '';
    const el = node;
    if (trav !== 2 && hidden(el)) return '';                                                     // 2A
    if (trav !== 2 && el.hasAttribute('aria-labelledby')) {                                     // 2B
        const s = el.getAttribute('aria-labelledby').split(/\s+/).map(id => { const t = (el.getRootNode().getElementById ? el.getRootNode() : document).getElementById(id); return t ? acc(t, new Set(seen), 2) : ''; }).join(' ');
        if (s.trim()) return s;
    }
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al;                    // 2C
    if (el.labels && el.labels.length && trav !== 1) { const s = [...el.labels].map(l => acc(l, seen, 1)).join(' '); if (s.trim()) return s; }   // 2D
    if (el.matches('img,area,input[type=image]') && el.hasAttribute('alt')) return el.getAttribute('alt');
    if (el.localName === 'fieldset' && el.firstElementChild?.localName === 'legend') return acc(el.firstElementChild, seen, 1);
    if (el.localName === 'table' && el.caption) return acc(el.caption, seen, 1);
    if (el.localName === 'svg') { const t = el.querySelector(':scope>title'); if (t) return t.textContent; }
    const r = role(el);
    if (trav && el.matches('input,select,textarea')) {                                           // 2E embedded control
        if (r === 'combobox' || r === 'listbox') return [...(el.selectedOptions || [])].map(o => o.text).join(' ');
        if (r === 'slider' || r === 'spinbutton') return el.getAttribute('aria-valuetext') || el.getAttribute('aria-valuenow') || el.value;
        return el.value || '';
    }
    if (trav || FROM_CONTENT.has(r) || !r) {                                                    // 2F
        let s = pseudo(el, '::before');
        for (const c of el.childNodes) s += acc(c, seen, trav || 1);
        s += pseudo(el, '::after');
        if (s.trim()) return s;
    }
    return el.getAttribute('title') || '';                                                        // 2I
}
export const name = (el) => acc(el, new Set(), 0).replace(/\s+/g, ' ').trim();

export function audit(root = document, { rules, contrast = false } = {}) {
    const v = [], add = (rule, el, message, help) => v.push({ rule, el, message, help, impact: rule === 'color-contrast' ? 'serious' : 'critical' });
    const q = (s) => [...root.querySelectorAll(s)].filter(e => !e.closest('[data-aegis-ignore]'));
    for (const el of q('*')) { const r = role(el); if ((r === 'button' || r === 'link') && !hidden(el) && !name(el)) add(r + '-name', el, `${r} has no accessible name`, 'aria-label / text / svg>title'); }
    for (const el of q('img:not([alt])')) add('image-alt', el, 'img has no alt', 'alt="…" or alt=""');
    for (const el of q('input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]),select,textarea')) if (!hidden(el) && !name(el)) add('label', el, 'form control has no label', '<label for>, wrapping <label>, aria-label');
    for (const el of q('[aria-labelledby],[aria-describedby],[aria-controls],[aria-activedescendant],[aria-errormessage]')) for (const a of el.attributes) if (/^aria-(labelledby|describedby|controls|activedescendant|errormessage)$/.test(a.name)) for (const id of a.value.split(/\s+/)) if (id && !(el.getRootNode().getElementById || document.getElementById.bind(document))(id)) add('aria-valid-attr-value', el, `${a.name} references missing id "${id}"`, 'fix the id');
    for (const el of q('[aria-hidden="true"]')) for (const f of el.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) if (!f.disabled) add('aria-hidden-focus', f, 'focusable element inside aria-hidden="true"', 'tabindex="-1" or inert');
    for (const el of q('[tabindex]')) if (+el.getAttribute('tabindex') > 0) add('tabindex', el, 'positive tabindex', 'tabindex="0"');
    for (const el of q('a[href],button,[role=button],[role=link]')) if (el.querySelector('a[href],button,input,select,textarea,[role=button],[role=link]')) add('nested-interactive', el, 'interactive inside interactive', 'flatten');
    for (const el of q('li')) if (!el.parentElement?.matches('ul,ol,menu,[role=list]')) add('listitem', el, '<li> outside a list', 'wrap rows in <ul>/<ol>');
    for (const el of q('ul,ol')) for (const c of el.children) if (!c.matches('li,script,template,[role=listitem]')) add('list', c, `<${c.localName}> directly inside <${el.localName}>`, 'only <li> children');
    for (const el of q('dialog,[role=dialog],[role=alertdialog]')) if (!name(el)) add('dialog-name', el, 'dialog has no accessible name', 'aria-labelledby=heading id');
    for (const el of q('*')) { if (!el.isConnected) break; const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && el.scrollHeight > el.clientHeight + 1 && !el.matches('[tabindex]') && !el.querySelector('a[href],button,input,select,textarea,[tabindex]')) add('scrollable-region-focusable', el, 'scrollable region is not keyboard reachable', 'tabindex="0"'); }
    if (contrast) for (const t of textNodes(root)) { const c = contrastOf(t.parentElement); if (c && c.ratio < c.min) add('color-contrast', t.parentElement, `contrast ${c.ratio.toFixed(2)} < ${c.min}`, 'darken text / lighten background'); }
    if (root === document) { if (!document.documentElement.lang) add('html-has-lang', document.documentElement, 'html has no lang', 'lang="ru"'); if (!document.title) add('document-title', document.head, 'no <title>', 'add title'); if (q('main,[role=main]').length !== 1) add('landmark-one-main', document.body, 'page needs exactly one main landmark', '<main>'); }
    return { violations: rules ? v.filter(x => rules.includes(x.rule)) : v, pass: v.length === 0 };
}

// aegis-test.js
import { name as accName, role as accRole, audit } from './aegis-a11y.js';
const match = (pat, s) => pat == null ? true : pat instanceof RegExp ? pat.test(s) : typeof pat === 'function' ? pat(s) : s === pat;
const listing = (c) => [...c.querySelectorAll('*')].map(e => [accRole(e), accName(e)]).filter(([r]) => r).map(([r, n]) => `  ${r}${n ? ` "${n}"` : ''}`).join('\n');
handle.byRole = (role, { name, hidden = false } = {}) => { const all = [...container.querySelectorAll('*')].filter(e => accRole(e) === role && (hidden || e.getClientRects().length) && match(name, accName(e))); if (all.length !== 1) throw new Error(`byRole("${role}"${name ? `, name ${name}` : ''}): ${all.length} matches. Available:\n${listing(container)}`); return all[0]; };
handle.byLabel = (text) => { const all = [...container.querySelectorAll('input,select,textarea,[role=textbox],[role=combobox],[role=checkbox],[role=switch],[role=slider]')].filter(e => match(text, accName(e))); if (all.length !== 1) throw new Error(`byLabel(${text}): ${all.length} matches\n${listing(container)}`); return all[0]; };
handle.name = (el) => accName(el);
handle.a11y = (opts) => opts && opts.engine ? opts.engine.run(container).then(r => ({ violations: r.violations, pass: !r.violations.length })) : audit(container, opts);
handle.expectA11y = (opts) => { const r = audit(container, opts); if (!r.pass) throw new Error('a11y violations:\n' + r.violations.map(v => `  [${v.rule}] <${v.el.localName}${v.el.id ? '#' + v.el.id : ''}> ${v.message} — ${v.help}`).join('\n')); };
// cleanup(): ничего нового — audit не держит состояния
```

**API:**

```js
// aegis-a11y.js (package.json exports './a11y', d.ts)
export function name(el: Element): string;
export function role(el: Element): string | null;
export interface Violation { rule: string; impact: 'critical'|'serious'|'moderate'; el: Element; message: string; help: string }
export function audit(root?: Element | Document, opts?: { rules?: string[]; contrast?: boolean }): { violations: Violation[]; pass: boolean };
// aegis-test.d.ts RenderHandle
byRole(role: string, opts?: { name?: string | RegExp | ((n: string) => boolean); hidden?: boolean }): HTMLElement;
byLabel(text: string | RegExp): HTMLElement;
byText(text: string | RegExp): HTMLElement;
name(el: Element): string;
a11y(opts?: { rules?: string[]; contrast?: boolean; engine?: { run(el: Element): Promise<{ violations: any[] }> } }): { violations: Violation[]; pass: boolean } | Promise<…>;
expectA11y(opts?): void;   // throws with a formatted list
// aegis.js: Aegis.dev.a11y(root?) → audit + console.table (через _devtoolsModule)
```

**Критерий:** test.html, section('aegis/test — byRole, name(), a11y()'): 1) name(): <label>Email <input value="x"></label> → input 'Email'; <button><img alt="Close"></button> → 'Close'; <button aria-labelledby="a b"> с <span id=a>Save</span><span id=b hidden>draft</span> → 'Save draft' (hidden допустим по ссылке); <label>Sort <select><option selected>Name</option></select></label> → select 'Sort', а label → 'Sort Name' (2E); <a href title="t"></a> → 't'. 2) role(): a без href → null, input[type=range] → slider, header внутри article → null, section без имени → null. 3) render(icon-кнопка без aria-label).a11y().violations.map(v=>v.rule) → ['button-name']; после добавления aria-label → pass===true; t.byRole('button', { name: /save/i }) находит одну кнопку, при двух — ошибка с перечислением ролей; t.byLabel('Email') === input. 4) 20 фикстур из accname-1.2 examples и axe rule tests (button-name, label, aria-hidden-focus, nested-interactive, list) — совпадение с ожидаемым результатом 20/20. Измерение: audit(demo/admin.html body, ~300 узлов) ≤ 5 мс без contrast; вся вкладка demo проходит audit без нарушений после правки строки 221.

**Источники:** W3C Accessible Name and Description Computation 1.2 (§4.3 шаги 2A–2I); ARIA in HTML (implicit roles); WAI-ARIA 1.3 §5.4 name from content; axe-core rules (button-name, link-name, label, image-alt, aria-hidden-focus, nested-interactive, list, listitem, tabindex, scrollable-region-focusable, landmark-one-main); dom-accessibility-api (accname JS-реализация, используется Testing Library); @testing-library/dom getByRole / logRoles; @testing-library/jest-dom toHaveAccessibleName/toHaveRole; Storybook addon-a11y; Playwright getByRole.

### 💎 #55 — Клавиатурные автотесты: fire.tab(), fire.press(), fire.keyboard('{Tab}{ArrowRight}{Enter}'), tabOrder()

**Impact:** 4 · **Effort:** M · **Size:** 0 KB в aegis.js; +0.8 KB gzip в aegis-test.js (tabOrder — в aegis-a11y.js, ≈0.4 KB, общая с devtools)

**Сейчас:** fire.key (aegis-test.js:78) шлёт keydown/keypress/keyup на заданный элемент и не двигает фокус; Tab ничего не делает — браузерная sequential focus navigation недоступна из синтетических событий. Поэтому trap() тестируется через «фокус внутри или вкладка в фоне» (test.html:4489–4490), а roving() — только по атрибутам tabindex (4521–4523); проверить, что Shift+Tab с первого элемента модалки уходит на последний, невозможно. Enter/Space на кнопке при синтетическом keydown не вызывают click — тесты command() (:8578–8589) и любых @keydown.enter обходят это руками.

**Предложение:** tabOrder(root) в aegis-a11y.js по алгоритму HTML §6.6.3 (sequential focus navigation order): кандидаты a[href], button, input, select, textarea, summary, iframe, audio/video[controls], [contenteditable], [tabindex]; исключить disabled, tabindex=-1, [inert]-предки, hidden/aria-hidden, display:none/visibility:hidden (getClientRects), содержимое закрытого <details> кроме summary, radio той же группы, где есть checked; порядок — tabindex>0 по возрастанию (стабильно), затем 0/авто в DOM-порядке. fire.tab({ shift }) — сначала keydown Tab на activeElement (trap()/roving() слушают keydown и могут preventDefault — тогда фокус не двигаем: это и есть контракт trap), иначе focus() следующего по tabOrder(document) (по кругу — эмуляция, у браузера фокус ушёл бы в chrome). fire.press(key, init) — на activeElement, с эмуляцией activation behavior: Enter на button/a[href]/[role=button] и Space (keyup) на button/checkbox → click, если keydown не отменён. fire.keyboard(seq) — user-event-синтаксис '{Tab}{Shift>}{Tab}{/Shift}{ArrowRight}{Enter}abc' (текст печатается посимвольно с input-событием). Тесты trap/roving/command в test.html переписать на реальную навигацию.

**Алгоритм:**

```js
// aegis-a11y.js
const CAND = 'a[href],area[href],button,input,select,textarea,summary,iframe,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]';
const visible = (el) => el.isConnected && (el.getClientRects().length > 0 || el.localName === 'summary');
export function tabOrder(root = document) {
    const ok = (el) => !el.disabled && el.getAttribute('tabindex') !== '-1' && el.type !== 'hidden' && !el.closest('[inert],[hidden],[aria-hidden="true"]') && visible(el)
        && !(el.closest('details:not([open])') && !(el.localName === 'summary' && el.parentElement.localName === 'details' && !el.parentElement.closest('details:not([open]) > :not(summary)')))
        && !(el.type === 'radio' && !el.checked && el.name && el.form && el.form.querySelector(`input[type=radio][name="${CSS.escape(el.name)}"]:checked`));
    const list = [...root.querySelectorAll(CAND)].filter(ok);
    const ti = (el) => Math.max(0, parseInt(el.getAttribute('tabindex')) || 0);
    return [...list.filter(e => ti(e) > 0).sort((a, b) => ti(a) - ti(b)), ...list.filter(e => ti(e) === 0)];
}

// aegis-test.js
import { tabOrder } from './aegis-a11y.js';
const active = () => (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
/** Tab / Shift+Tab как пользователь: keydown на активном (trap может отменить), затем фокус на следующий по порядку табуляции */
fire.tab = ({ shift = false } = {}) => {
    const from = active();
    const down = _event(from || document.body, 'keydown', { key: 'Tab', shiftKey: shift });
    if (!down.defaultPrevented) {
        const order = tabOrder(document);
        let i = from ? order.indexOf(from) : -1;
        if (i < 0 && from) {   // активный не в порядке (tabindex=-1 контейнер): ближайший следующий в DOM
            const j = order.findIndex(el => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
            i = j < 0 ? order.length : j - (shift ? 0 : 1);
        }
        const next = order.length ? order[shift ? (i <= 0 ? order.length - 1 : i - 1) : (i + 1) % order.length] : null;
        if (next) { next.focus(); _event(next, 'focusin', { bubbles: true }); }
    }
    _event(active() || document.body, 'keyup', { key: 'Tab', shiftKey: shift });
    return active();
};
const ACT = 'button,a[href],[role=button],[role=link],summary,input[type=button],input[type=submit],input[type=reset],input[type=checkbox],input[type=radio],[role=checkbox],[role=switch],[role=menuitem],[role=option],[role=tab]';
/** Клавиша на активном элементе + нативное activation behavior: Enter → click на keydown, Space → click на keyup */
fire.press = (key, init = {}) => {
    const el = active() || document.body;
    const down = fire.key(el, key, init);
    if (!down.defaultPrevented && el.matches && el.matches(ACT)) {
        if (key === 'Enter' && !el.matches('input[type=checkbox],input[type=radio],[role=checkbox]')) el.click();
        else if (key === ' ' && !el.matches('a[href],[role=link]')) el.click();
    }
    return down;
};
/** user-event: '{Tab}{Shift>}{Tab}{/Shift}{ArrowRight}{Enter}hello' */
fire.keyboard = (seq) => {
    const mods = {};
    for (const m of seq.matchAll(/\{(\/?)(\w+)(>?)\}|(.)/gs)) {
        if (m[4] !== undefined) { const el = active(); fire.press(m[4], mods); if (el && 'value' in el && !el.readOnly) { el.value += m[4]; _event(el, 'input'); } continue; }
        const k = m[2];
        if (m[3] === '>') { mods[k.toLowerCase() + 'Key'] = true; continue; }
        if (m[1] === '/') { delete mods[k.toLowerCase() + 'Key']; continue; }
        if (k === 'Tab') fire.tab({ shift: !!mods.shiftKey }); else fire.press(k === 'Space' ? ' ' : k, mods);
    }
    return active();
};
handle.tabOrder = () => tabOrder(container);
```

**API:**

```js
// aegis-a11y.js
export function tabOrder(root?: Element | Document): HTMLElement[];
// aegis-test.d.ts Fire
tab(opts?: { shift?: boolean }): HTMLElement | null;      // returns the new activeElement
press(key: string, init?: KeyboardEventInit): KeyboardEvent; // on document.activeElement, with activation behaviour
keyboard(sequence: string): HTMLElement | null;             // '{Tab}{Shift>}{Tab}{/Shift}{ArrowRight}{Enter}text'
// RenderHandle
tabOrder(): HTMLElement[];
```

**Критерий:** test.html: 1) tabOrder(): контейнер <input tabindex=2><button disabled><a href><span tabindex=0><input tabindex=1><details><button>hidden</button></details><div hidden><button></div> → [input#t1, input#t2, a, span] (tabindex 1→2, затем DOM; disabled/закрытый details/hidden исключены). 2) trap 2.0: модалка с тремя focusable + кнопки снаружи; fire.focus(last); fire.tab() → activeElement === first; fire.tab({ shift: true }) → last; снаружи модалки фокус не оказывается ни при 10 fire.tab(). Сейчас такой тест написать нельзя. 3) roving(): fire.focus(tabs[0]); fire.press('ArrowRight') → activeElement === tabs[1] && tabs[1].tabIndex === 0 && tabs[0].tabIndex === -1; fire.press('End') → tabs[2]; fire.keyboard('{Home}') → tabs[0]. 4) command(): фокус на <div data-command="x" tabindex="0">, fire.press('Enter') → обработчик вызван 1 раз; на <button data-command> — тоже ровно 1 (без дубля через нативный click, ветка :8597). 5) wireForm: fire.keyboard('{Tab}john{Tab}') → fields.name.value === 'john' и фокус на следующем поле. Все проверки детерминированы в headless Chrome/Firefox (activeElement меняется через focus() без фокуса окна).

**Источники:** HTML Living Standard §6.6.3 «sequential focus navigation order» и §6.6.2 focusable area; §4.10.5.5 button activation behaviour (Enter/Space); @testing-library/user-event userEvent.tab() и keyboard('{Shift>}{Tab}{/Shift}'); Playwright keyboard.press / locator.press; WAI-ARIA APG «Developing a Keyboard Interface» (roving tabindex, Home/End); axe-core «focus-order-semantics»; Firefox Accessibility Inspector «Show Tabbing Order».

### 💎 #56 — Дозорный фокуса E050 и структурные проверки E051/E052 в list()/show()/trap()/roving()

**Impact:** 4 · **Effort:** S · **Size:** +0.4 KB gzip в aegis.js (все ветки под _dev(), в проде — одно сравнение)

**Сейчас:** _removeNodes (aegis_full.js:2296) вызывается из show(), реактивной «дырки» (:2359) и list() (_dropEntry :2853, bulk-clear через range.deleteContents :2885) и не смотрит на document.activeElement: если внутри удаляемого поддерева находится фокус, он молча падает на <body> — скринридер замолкает, следующий Tab начинается с шапки страницы (WCAG 2.4.3). Особый случай — footgun list(): при иммутабельном обновлении (замена объекта под тем же ключом) строка перерисовывается (:2916–2918): пользователь печатает в <input> внутри строки, resource обновил массив — строка пересоздана, фокус и каретка потеряны; лечится опцией item: 'signal', о которой разработчик не узнает. swap()/morph() при этом фокус берегут (:9197–9210, :9307) — непоследовательно. Структура: list() вставляет <li> в <div>, <tr> в <div>, <option> вне <select> — HTML-парсер <template> это пропускает, AT не видит список; roving() (:7493) вешают на <div> без composite-роли, trap() (:7396) ставит role=dialog, но не требует имени диалога (APG: dialog должен иметь aria-labelledby/aria-label).

**Предложение:** Три dev-детектора. E050 «focus lost»: перед удалением узлов (в _removeNodes и в bulk-clear list()) проверить, содержит ли поддерево document.activeElement; в предупреждении назвать элемент и источник (list row / show / child), в fix — конкретный рецепт: для list() с заменой объекта — { item: 'signal' } (строка патчится на месте) или фокус на соседнюю строку/контейнер; для show() — { keep: true } или вернуть фокус на триггер; el: активный элемент (клик по тосту подсветит). E051 «list structure»: при первой сверке list() сравнить тег/role первой строки с родителем anchor по таблице li→ul|ol|menu, tr→table|thead|tbody|tfoot, td|th→tr, option→select|datalist|optgroup, dt|dd→dl|div, [role=option]→[role=listbox], [role=tab]→[role=tablist], [role=menuitem]→[role=menu|menubar|group], [role=row]→[role=grid|table|treegrid|rowgroup], [role=treeitem]→[role=tree|group]; и обратное — родитель ul/ol, а строка не li. E052 «composite/dialog semantics»: trap()/modal() без aria-label/aria-labelledby на контейнере; roving() на контейнере без role из {tablist, menu, menubar, toolbar, listbox, radiogroup, tree, grid, treegrid} или элементы без соответствующей роли (tab/menuitem/option/radio/treeitem).

**Алгоритм:**

```js
// dev: фокус внутри удаляемого поддерева — после удаления activeElement станет <body> (E050)
function _focusCheck(nodes, who, hint) {
    if (!_dev()) return;
    const a = document.activeElement;
    if (!a || a === document.body) return;
    for (const n of nodes) {
        if (n !== a && !(n.nodeType === 1 && n.contains(a))) continue;
        _warn('E050', {
            what: `${who}: the focused <${a.localName}${a.id ? '#' + a.id : ''}> is being removed — focus falls to <body>.`,
            why: 'Keyboard and screen-reader users lose their place: the reader goes silent and the next Tab restarts from the top of the page (WCAG 2.4.3).',
            fix: hint,
            el: a,
        }, who + ':' + a.localName);
        return;
    }
}
const _HINT_ROW = 'The row was re-rendered because its item object was replaced — pass { item: \'signal\' } to patch the row in place, or move focus to a sibling row / the list container (tabindex="-1") before removing.';
const _HINT_SHOW = 'Return focus to the trigger before hiding, or keep the branch mounted: show(cond, tpl, { keep: true }).';
// _removeNodes(nodes) → _removeNodes(nodes, who, hint): вызовы
//   show()/_insertDynamic.clear: _removeNodes(nodes, 'show()', _HINT_SHOW)
//   list()._dropEntry:            _removeNodes(entry.nodes, 'list()', replaced ? _HINT_ROW : 'Move focus to a neighbouring row or the list container before deleting the item.')
//   list() bulk-clear (:2885):     if (_dev() && parent.contains(document.activeElement)) _focusCheck([parent], 'list()', '…');
function _removeNodes(nodes, who, hint) {
    if (who) _focusCheck(nodes, who, hint);
    … // как сейчас
}

// dev: строки list() под несемантическим родителем (E051) — один раз, при первой сверке с непустым массивом
const _STRUCT = [['li', 'ul,ol,menu,[role=list]'], ['tr', 'table,thead,tbody,tfoot,[role=rowgroup],[role=grid],[role=table]'], ['td,th', 'tr'], ['option', 'select,datalist,optgroup'], ['dt,dd', 'dl,div'], ['[role=option]', '[role=listbox]'], ['[role=tab]', '[role=tablist]'], ['[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio]', '[role=menu],[role=menubar],[role=group]'], ['[role=row]', '[role=grid],[role=table],[role=treegrid],[role=rowgroup]'], ['[role=treeitem]', '[role=tree],[role=group]'], ['[role=listitem]', '[role=list],ul,ol']];
function _structCheck(parent, row) {
    if (!row || row.nodeType !== 1) return;
    for (const [child, parents] of _STRUCT) if (row.matches(child) && !parent.matches(parents)) return _warn('E051', {
        what: `list(): <${row.localName}${row.getAttribute('role') ? ` role="${row.getAttribute('role')}"` : ''}> rows are inserted into <${parent.localName}> — not a ${parents.split(',')[0]}.`,
        why: 'Assistive technology announces lists, tables and menus only when the container has the matching semantics; the HTML parser accepts the markup inside <template>, so nothing fails visibly.',
        fix: `Put the list() anchor inside <${parents.split(',')[0].replace(/\[role=(\w+)\]/, 'div role="$1"')}>, or change the row element.`,
        el: parent,
    }, 'struct');
    if (parent.matches('ul,ol,menu,[role=list]') && !row.matches('li,[role=listitem]')) _warn('E051', { what: `list(): <${row.localName}> rows inside <${parent.localName}> — only <li> is allowed.`, why: 'Screen readers report the wrong item count and skip the rows.', fix: 'Render rows as <li> (a <div> or <a> can live inside the <li>).', el: parent }, 'struct');
}
// в _reconcile после первой вставки: if (_dev() && !_checked && newKeys.length) { _checked = true; _structCheck(parent, _first(_nodes.get(newKeys[0]))); }

// trap()/modal(): E052 диалог без имени; roving(): контейнер/элементы без composite-роли
const _COMPOSITE = 'tablist,menu,menubar,toolbar,listbox,radiogroup,tree,treegrid,grid'.split(',');
function _nameCheck(container, who) {
    if (!_dev() || container.hasAttribute('aria-label') || container.hasAttribute('aria-labelledby')) return;
    _warn('E052', { what: `${who}: the dialog <${_tag(container)}> has no accessible name.`, why: 'A screen reader announces just "dialog" — the user does not know what opened (APG dialog pattern, WCAG 4.1.2).', fix: 'aria-labelledby="<id of the heading>" or aria-label="…" on the container.', el: container }, 'name');
}
// trap(): после :7420  _nameCheck(container, 'trap()');   modal(): _nameCheck(dialog, 'modal()');
// roving(): после init()
if (_dev()) { const r = container.getAttribute('role'); const items = getItems(); if (!_COMPOSITE.includes(r)) _warn('E052', { what: `roving(): <${_tag(container)}> has role "${r || 'none'}" — arrow-key navigation is unexpected there.`, why: 'Screen readers announce arrow-key composites only for tablist/menu/toolbar/listbox/radiogroup/tree/grid; without the role users get no hint and may skip items.', fix: `Add role="toolbar" (or tablist/menu/listbox/…) to the container and matching roles to the items.`, el: container }, 'role');
    else if (items.length && !items[0].matches('[role],button,a[href],input')) _warn('E052', { what: `roving(): items inside role="${r}" have no role.`, why: 'A tablist needs role="tab" items, a menu role="menuitem", a listbox role="option".', fix: 'Set the item role.', el: items[0] }, 'items'); }
```

**API:**

```js
// нового API нет; три кода в ERRORS.md / DOCS:
// E050 focused element removed by list()/show()/child binding — focus fell to <body>
// E051 list() rows under a non-semantic container (li outside ul, tr outside table, option outside select, role=option outside listbox)
// E052 trap()/modal() dialog without accessible name; roving() without composite role
// внутренняя сигнатура: _removeNodes(nodes, who?, hint?)
// Возможное продолжение (не dev-tooling): list(items, render, { focus: 'restore' }) — перенос фокуса по name/id в перерисованную строку, как _focusRestore в swap()
```

**Критерий:** test.html, section('E050–E052 — фокус и семантика'): 1) list() на items=[{id:1,v:'a'}]; строка html`<li><input value=${item.v}></li>`; фокус в input; items.value = [{id:1,v:'b'}] (новый объект) → onWarn получает E050 с fix, содержащим "item: 'signal'", и w.el === старый input; с { item: 'signal' } — E050 нет и document.activeElement остаётся тем же input (регресс-тест самого footgun). 2) show(open, () => html`<button>`) с фокусом на кнопке; open=false → E050; с { keep: true } — нет. 3) list() в <div> со строками <li> → E051; в <ul> — нет; <a> строки внутри <ul> → E051. 4) trap(div без имени) → E052; trap(div aria-labelledby) → нет; roving(div без role) → E052; roving(div role=tablist с role=tab) → нет. 5) Стоимость: 1000 удалений строк без фокуса внутри — разница времени с dev-режимом ≤ 2 % (одно сравнение activeElement + contains на строку). 6) demo/admin.html: удаление пользователя кнопкой Delete в фокусе даёт E050 — подтверждает реальность бага; после правки (фокус на следующую кнопку Delete или на таблицу) — тишина.

**Источники:** WCAG 2.2 SC 2.4.3 Focus Order, 4.1.2 Name/Role/Value; WAI-ARIA APG Dialog (Modal) pattern — «the dialog has aria-labelledby or aria-label»; APG composite widgets (tablist, menu, toolbar, listbox, grid, tree) и Keyboard Navigation Inside Components; axe-core rules list, listitem, definition-list, aria-required-children/aria-required-parent, dialog-name (best practice); React Aria / Radix «focus management on removal» (focus scope restores focus to trigger); htmx `hx-preserve`/restoreFocus; Svelte a11y-no-noninteractive-element-to-interactive-role.

### 💎 #57 — Вкладка a11y в aegis-devtools.js: порядок табуляции на странице, журнал фокуса и невидимого outline, монитор live-регионов, контраст, audit

**Impact:** 4 · **Effort:** L · **Size:** 0 KB в aegis.js; +3 KB gzip в aegis-devtools.js (dev-only, лениво); использует aegis-a11y.js из #2/#3

**Сейчас:** aegis-devtools.js — панель с двумя вкладками components/cache (строки 89–92), stats, warnings (63). Ничего про доступность: невозможно увидеть, что читает скринридер при announce() (единственный _announcer :7563–7583 — визуально скрытый div, содержимое которого никто не видит), куда ушёл фокус после swap/list, в каком порядке Tab обходит страницу, есть ли на активном элементе outline:none (WCAG 2.4.7 — самый частый дефект CSS-ресетов), проходит ли контраст текста. Astro Dev Toolbar (Audit) показывает a11y-проблемы прямо на странице; Chrome/Firefox DevTools дают дерево и контраст, но не «живой» лог фокуса и объявлений. Dev-overlay Aegis уже умеет подсветку элементов (highlight, строка 34–40) и тосты.

**Предложение:** Третья вкладка «a11y» с пятью блоками, каждый включается кнопкой (ничего не работает фоном, пока не открыто): (1) Tab stops — оверлей с номерами 1…N над элементами tabOrder(document) (как Firefox «Show Tabbing Order»/Accessibility Insights), пересчёт по MutationObserver+resize, красным — tabindex>0 и элементы вне видимой области; (2) Focus log — document.addEventListener('focusin'/'focusout', capture): строка «10:42:01 button “Save” ← input “Email”», рядом флаг «no visible focus» если у активного элемента outline-style:none/outline-width:0 и box-shadow:none и нет :focus-visible-стилей (проверка через getComputedStyle после focus), и «focus → body» когда focusout не сопровождён focusin в той же задаче (коррелирует с E050); (3) Live regions — список [aria-live], [role=status|alert|log], output, включая _announcer; MutationObserver(childList/characterData/subtree) пишет «polite “3 results found” 10:42:03», подсвечивает регион; предупреждает о регионе, вставленном в DOM уже с текстом (не объявится), об одинаковом тексте без очистки (не повторится) и о >2 assertive за 2 с; (4) Contrast — скан текстовых узлов внутри компонентов (dev.inspect().el): fg=color, bg=первый непрозрачный background-color по предкам (градиент/картинка → «?»), коэффициент WCAG 2.x с порогом 4.5/3 (крупный текст ≥ 24px или ≥ 18.66px bold) и колонка APCA Lc для ориентира; список провалов с hover-подсветкой и кнопкой «console.log(el)»; (5) Audit — audit(document, { contrast: true }) из aegis-a11y.js в таблицу rule/element/message с hover-подсветкой; кнопка «snapshot» копирует ariaSnapshot(). Плюс Aegis.dev.a11y(root) в ядре — console.table(audit(root).violations) через _devtoolsModule (одна строка в dev-объекте :31–57).

**Алгоритм:**

```js
// aegis-devtools.js — фрагменты
import { audit, tabOrder, name as accName, role as accRole, ariaSnapshot } from './aegis-a11y.js';

// (1) tab stops overlay
function tabStops(on) {
    if (!on) { layer.replaceChildren(); return; }
    layer.replaceChildren(...tabOrder(document).map((el, i) => { const r = el.getBoundingClientRect(); const b = document.createElement('i'); b.textContent = i + 1; b.title = `${accRole(el)} "${accName(el)}"`; const bad = +el.getAttribute('tabindex') > 0 || r.bottom < 0 || r.top > innerHeight; b.style.cssText = `position:fixed;left:${r.left}px;top:${r.top - 10}px;background:${bad ? '#f85149' : '#58a6ff'};color:#fff;font:10px/14px monospace;padding:0 4px;border-radius:7px;pointer-events:none`; return b; }));
}
const mo = new MutationObserver(() => stopsOn.value && tabStops(true)); mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex', 'disabled', 'hidden', 'inert'] });

// (2) focus log + невидимый фокус
const focusLog = signal([]);
let lastOut = null;
const noRing = (el) => { const cs = getComputedStyle(el); return (cs.outlineStyle === 'none' || cs.outlineWidth === '0px') && cs.boxShadow === 'none' && !el.matches(':focus-visible') ? false : (cs.outlineStyle === 'none' || cs.outlineWidth === '0px') && cs.boxShadow === 'none'; };
document.addEventListener('focusin', (e) => { const el = e.target; lastOut = null; focusLog.value = [...focusLog.value.slice(-99), { t: Date.now(), role: accRole(el), name: accName(el), el, noRing: el.matches(':focus-visible') && noRing(el) }]; }, true);
document.addEventListener('focusout', (e) => { lastOut = e.target; queueMicrotask(() => { if (lastOut && document.activeElement === document.body) focusLog.value = [...focusLog.value.slice(-99), { t: Date.now(), lost: true, from: lastOut, role: accRole(lastOut), name: accName(lastOut) }]; }); }, true);

// (3) live regions monitor
const LIVE = '[aria-live],[role=status],[role=alert],[role=log],output';
const liveLog = signal([]);
const liveMo = new MutationObserver((recs) => {
    const now = Date.now();
    for (const r of recs) { const region = (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest(LIVE); if (!region) continue; const text = region.textContent.trim(); if (!text) continue;
        const level = region.getAttribute('aria-live') || (region.matches('[role=alert]') ? 'assertive' : 'polite');
        const prev = liveLog.value.at(-1);
        const flags = []; if (prev && prev.region === region && prev.text === text && now - prev.t < 2000) flags.push('same text — not re-announced'); if (level === 'assertive' && liveLog.value.filter(x => x.level === 'assertive' && now - x.t < 2000).length >= 2) flags.push('assertive spam');
        liveLog.value = [...liveLog.value.slice(-99), { t: now, level, text, region, flags }]; }
});
liveMo.observe(document.body, { childList: true, characterData: true, subtree: true });
// регион, появившийся уже с текстом: в childList-записи addedNodes содержит сам регион → flag 'inserted with content — will not announce'

// (4) contrast (WCAG 2.x) + APCA ориентир
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const rgb = (s) => { const m = s.match(/[\d.]+/g); return m && m.length >= 3 ? { c: m.slice(0, 3).map(Number), a: m[3] == null ? 1 : +m[3] } : null; };
function bgOf(el) { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a >= 1) return c.c; } return [255, 255, 255]; }
export function contrast(el) {
    const cs = getComputedStyle(el), fg = rgb(cs.color), bg = bgOf(el); if (!fg || !bg) return null;
    const l1 = lum(fg.c), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (px >= 18.66 && bold);
    return { ratio, min: large ? 3 : 4.5, pass: ratio >= (large ? 3 : 4.5), apca: apcaLc(fg.c, bg) };
}
function scanContrast(roots) { const out = []; for (const root of roots) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (!t.data.trim()) continue; const el = t.parentElement; if (!el || el.closest('[data-aegis-ignore],script,style')) continue; const c = contrast(el); if (c && !c.pass) out.push({ el, ...c, text: t.data.trim().slice(0, 40) }); } } return out; }

// вкладка
<button class=${{ on: () => tab.value === 'a11y' }} @click=${() => { tab.value = 'a11y'; }}>a11y ${() => auditRes.value ? auditRes.value.violations.length : ''}</button>
${show(() => tab.value === 'a11y', () => html`<div class="detail">
    <div class="tabs"><button class=${{ on: stopsOn }} @click=${() => { stopsOn.value = !stopsOn.value; tabStops(stopsOn.value); }}>tab stops</button><button @click=${() => { auditRes.value = audit(document, { contrast: true }); }}>audit</button><button @click=${() => navigator.clipboard.writeText(ariaSnapshot(document.body))}>aria snapshot</button></div>
    <h4>focus</h4>${list(() => focusLog.value.slice().reverse(), (f) => html`<div class=${{ row: true, err: f.lost, warn: f.noRing }} @mouseenter=${() => highlight(f.el || f.from)} @mouseleave=${() => highlight(null)}><span class="n">${fmtT(f.t)}</span><span class="v">${f.lost ? `focus lost → body (was ${f.role} "${f.name}")` : `${f.role} "${f.name}"${f.noRing ? ' — no visible focus ring' : ''}`}</span></div>`, { key: 't' })}
    <h4>live regions</h4>${list(() => liveLog.value.slice().reverse(), (l) => html`<div class=${{ row: true, warn: l.flags.length }}><span class="n">${l.level}</span><span class="v">${l.text}${l.flags.length ? ' · ' + l.flags.join(', ') : ''}</span></div>`, { key: 't' })}
    <h4>audit</h4>${list(() => auditRes.value ? auditRes.value.violations : [], (v) => html`<div class="row warn" @mouseenter=${() => highlight(v.el)} @mouseleave=${() => highlight(null)} @click=${() => console.log(v.el)}><span class="n">${v.rule}</span><span class="v">${v.message}${v.ratio ? ` (${v.ratio.toFixed(2)}:1)` : ''}</span></div>`, { key: (v, i) => v.rule + i })}
</div>`)}

// aegis_full.js, объект dev (:31–57): одна строка
a11y(root) { return _devtoolsModule().then(m => { const r = m && m.audit ? m.audit(root || document, { contrast: true }) : { violations: [] }; console.table(r.violations.map(v => ({ rule: v.rule, element: _tag(v.el), message: v.message }))); return r; }); },
```

**API:**

```js
// aegis-devtools.js
export function contrast(el: Element): { ratio: number; min: number; pass: boolean; apca: number } | null;
export function open(): { host, shadow, close, highlight, tab(name: 'components'|'cache'|'a11y'): void };
// aegis.js
Aegis.dev.a11y(root?: Element): Promise<{ violations: Violation[]; pass: boolean }>   // console.table + возврат
// URL: ?aegis-devtools=a11y открывает панель сразу на вкладке
```

**Критерий:** test.html, section('dev.panel() — вкладка a11y') рядом с существующим тестом панели (2583): открыть панель, переключить вкладку — в shadowRoot появляется h4 'focus'; фокус на кнопку с outline:none → в журнале строка с 'no visible focus ring'; удалить сфокусированный элемент → строка 'focus lost → body'; announce('Готово') → через 50 мс в live regions строка polite 'Готово'; announce('Готово') повторно в течение 2 с — флаг 'same text'; contrast(): текст #777 на #fff → ratio ≈ 4.48, pass=false; #595959 на #fff → 7.0, pass=true; 24px #777 → pass=true (large); audit кнопка на странице с <img> без alt показывает строку image-alt. Измерение: tabStops() на demo/admin.html ≤ 3 мс; scanContrast по 300 текстовым узлам ≤ 15 мс; при закрытой вкладке ни один observer не подписан (проверка: liveMo/focus listeners регистрируются в effect вкладки и снимаются при уходе с неё).

**Источники:** Astro Dev Toolbar «Audit» app (a11y-подсветка на странице); Firefox Accessibility Inspector (Show Tabbing Order, contrast checks); Chrome DevTools Accessibility pane / Rendering → Emulate vision deficiencies; Microsoft Accessibility Insights FastPass «Tab stops»; WCAG 2.2 SC 1.4.3 Contrast (Minimum), 1.4.11, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured; WCAG 2.x relative luminance formula; APCA (WCAG 3 draft) Lc; WAI-ARIA 1.3 §6.7 live region properties (aria-live, aria-atomic, aria-relevant); MDN «ARIA live regions» (регион должен существовать до появления текста); Storybook addon-a11y highlight.

### 💎 #58 — ARIA-снимки в формате Playwright: ariaSnapshot() / t.matchAria() — регресс-тест «что услышит скринридер»

**Impact:** 4 · **Effort:** S · **Size:** 0 KB в aegis.js; +0.7 KB gzip в aegis-a11y.js, +0.2 KB в aegis-test.js (поверх #2)

**Сейчас:** Тесты фиксируют DOM (t.html(), test.html повсюду через innerHTML/textContent) — регресс имени кнопки, потеря роли (замена <button> на <div @click>), исчезновение заголовка или aria-expanded не ловятся ни одним assert. Playwright 1.49+ ввёл toMatchAriaSnapshot (YAML-дерево role/name/states), ставший стандартом фиксации a11y-структуры в 2025–26; в unit-слое Aegis (aegis-test.js) аналога нет, а devtools не умеют показать «дерево скринридера» вообще.

**Предложение:** ariaSnapshot(root, opts) в aegis-a11y.js: обход DOM, для каждого элемента с ролью (role() из #2) строка `- role "name" [state=value]`, вложенность отступами (2 пробела), generic-элементы (div/span без роли) не печатаются, но обходятся; hidden/aria-hidden/display:none пропускаются; состояния: checked, expanded, pressed, selected, disabled, level (heading), current; текст без роли — как `- text: …` (опция text: false для стабильности). Формат совместим с Playwright aria snapshots, чтобы одну фикстуру можно было использовать в e2e и unit. t.ariaSnapshot() возвращает строку; t.matchAria(template) — сравнение с допуском: строки шаблона могут быть регексами (/…/), любой уровень может опустить детей (частичное совпадение, как в Playwright), при расхождении — diff по строкам. В devtools (#5) — кнопка «aria snapshot» копирует дерево страницы в буфер.

**Алгоритм:**

```js
// aegis-a11y.js
const STATES = ['checked', 'expanded', 'pressed', 'selected', 'disabled', 'current', 'level', 'invalid', 'busy'];
const native = (el, s) => s === 'checked' ? (el.type === 'checkbox' || el.type === 'radio' ? el.checked : undefined) : s === 'disabled' ? (el.disabled || undefined) : s === 'expanded' ? (el.localName === 'details' ? el.open : undefined) : s === 'level' ? (/^h[1-6]$/.test(el.localName) ? +el.localName[1] : undefined) : s === 'selected' ? (el.localName === 'option' ? el.selected : undefined) : undefined;
function states(el) {
    const out = [];
    for (const s of STATES) { let v = el.getAttribute('aria-' + s); if (v == null) v = native(el, s); if (v == null || v === false || v === 'false') continue; out.push(v === true || v === 'true' ? s : `${s}=${v}`); }
    return out.length ? ` [${out.join(', ')}]` : '';
}
export function ariaSnapshot(root = document.body, { text = true } = {}) {
    const lines = [];
    const walk = (el, depth) => {
        for (const n of el.childNodes) {
            if (n.nodeType === 3) { if (text && n.data.trim()) lines.push(`${'  '.repeat(depth)}- text: ${n.data.trim().replace(/\s+/g, ' ')}`); continue; }
            if (n.nodeType !== 1 || n.matches('script,style,template,[data-aegis-ignore]') || hidden(n)) continue;
            const r = role(n);
            if (!r || r === 'presentation' || r === 'none' || r === 'generic') { walk(n, depth); continue; }
            const nm = name(n);
            lines.push(`${'  '.repeat(depth)}- ${r}${nm ? ` "${nm.replace(/"/g, '\\"')}"` : ''}${states(n)}${n.childNodes.length && !['img', 'textbox', 'combobox', 'checkbox', 'radio', 'slider', 'separator'].includes(r) ? ':' : ''}`);
            if (!['img', 'textbox', 'combobox', 'checkbox', 'radio', 'slider', 'separator', 'button', 'link', 'heading', 'option', 'tab', 'menuitem'].includes(r)) walk(n, depth + 1);   // для name-from-content ролей дети уже в имени
        }
    };
    walk(root, 0);
    return lines.join('\n');
}
/** Частичное совпадение в духе Playwright: каждая строка шаблона должна встретиться в снимке по порядку на своём уровне; /re/ — регекс */
export function matchAria(snapshot, template) {
    const norm = (s) => s.split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean);
    const want = norm(template), have = norm(snapshot);
    const test = (w, h) => { const m = /^(\s*- \w+)\s+\/(.+)\/(\w*)(.*)$/.exec(w); if (!m) return w === h; const [, head, re, flags, tail] = m; return h.startsWith(head) && new RegExp(re, flags).test(h.slice(head.length).replace(/^\s+"|"?(\s\[.*)?:?$/g, '')) && h.endsWith(tail.trim()); };
    let j = 0; const missing = [];
    for (const w of want) { let k = j; while (k < have.length && !test(w, have[k])) k++; if (k === have.length) missing.push(w); else j = k + 1; }
    return { pass: !missing.length, missing, diff: missing.map(m => `- ${m}`).join('\n') };
}
// aegis-test.js
import { ariaSnapshot, matchAria } from './aegis-a11y.js';
handle.ariaSnapshot = (opts) => ariaSnapshot(container, opts);
handle.matchAria = (template) => { const snap = ariaSnapshot(container); const r = matchAria(snap, template); if (!r.pass) throw new Error(`aria snapshot mismatch, missing:\n${r.diff}\n\nactual:\n${snap}`); return true; };
```

**API:**

```js
// aegis-a11y.js
export function ariaSnapshot(root?: Element, opts?: { text?: boolean }): string;
export function matchAria(snapshot: string, template: string): { pass: boolean; missing: string[]; diff: string };
// aegis-test.d.ts RenderHandle
ariaSnapshot(opts?: { text?: boolean }): string;
matchAria(template: string): true;   // throws with diff + actual
// пример
t.matchAria(`
- heading "Users" [level=1]
- button "New user"
- table:
  - row /Alice/:
    - button "Delete"
`);
```

**Критерий:** test.html, section('aegis/test — ariaSnapshot'): render(html`<h1>Users</h1><button aria-label="New user">+</button><ul><li><a href="/u/1">Alice</a></li></ul><label>Active <input type="checkbox" checked></label><details open><summary>More</summary>x</details>`) → t.ariaSnapshot({ text: false }) строго равен строкам: `- heading "Users" [level=1]`, `- button "New user"`, `- list:`, `  - listitem:`, `    - link "Alice"`, `- checkbox "Active" [checked]`, `- group [expanded]:`, `  - button "More"`; t.matchAria('- button /new/i\n- list:\n  - listitem:\n    - link "Alice"') проходит; замена <button> на <div @click> → matchAria падает с diff, содержащим `- button /new/i`. Кросс-проверка: тот же фрагмент в Playwright `expect(page.locator('#x')).toMatchAriaSnapshot(t.ariaSnapshot({text:false}))` проходит (совместимость формата) — разовый скрипт в test-browsers.mjs. Стоимость: ariaSnapshot(demo/admin.html body) ≤ 5 мс.

**Источники:** Playwright 1.49+ aria snapshots (toMatchAriaSnapshot, формат YAML role "name" [states], частичное совпадение и регексы); Chrome DevTools «Accessibility tree» full-page view; @guidepup/virtual-screen-reader (spokenPhraseLog как ориентир, отвергнут как движок); WAI-ARIA 1.3 §5.2 roles taxonomy, §6.6 states; Accessible Name and Description Computation 1.2; Storybook a11y «accessibility tree» panel.


---

# 🏝️ Гидрация и server-first

## 🔭 hydration-correctness

**Линза:** Корректность гидрации островов (секция 8: hydrate/register/island/slot, data-aegis-*, seedFrom, data-cloak; секция 34 swap/morph/adopt/tpl): расхождение серверной и клиентской разметки (детект и предупреждение E0xx с diff), переигрывание событий, случившихся до гидрации (interaction replay есть — проверь полноту), стриминг HTML и острова, появившиеся позже (MutationObserver/watch), порядок гидрации вложенных островов, props из атрибутов/JSON-скриптов и их типизация, гидрация внутри <template>/shadow DOM/Declarative Shadow DOM, гидрация после swap/morph и переносах DOM. Сравни с Astro islands, Qwik, Marko 6, Fresh, Enhance, is-land, Lit SSR.

**Вывод:** Aegis уже впереди большинства zero-build движков по «оркестровке» гидрации: стратегии с аргументами (visible(300px)/idle(ms)/interaction(events)/media) на одном IntersectionObserver, прогрев кода и данных за 400px, ожидание prerenderingchange, time-slicing eager-островов, watch:true для htmx/Turbo, morph-aware острова (перемонтирование только при смене data-*), zero-fetch через seedFrom и dev-скаффолд E011 — этого нет ни у Astro, ни у is-land, ни у Enhance. Но сама «гидрация» в Aegis — это замена: component() делает el.replaceChildren(r) (aegis_full.js:3107), серверный DOM выбрасывается, фокус/выделение/введённый текст теряются, а расхождение сервер↔клиент никак не детектируется — тогда как Qwik, Solid, Lit SSR, Vue переиспользуют DOM и сообщают о mismatch. adopt() (9563) это умеет, но он ручной, требует «sole»-текста и не включается сам. Отставание также в корректности до гидрации: replay есть только у interaction и повторно запускает activation behavior (чекбокс/сабмит дважды), события до загрузки ленивого eager-острова теряются, а правило [data-aegis-state="pending"]{visibility:hidden} (5530) прячет серверный контент interaction-островов. Стриминг: watch:true монтирует остров по addedNodes до того, как парсер дописал его детей (3511). Shadow DOM/DSD не обходится (3477), element() дублирует серверный DSD-контент (7849). Props: только coerce по types, без required/default/schema — Angular signal inputs и Standard Schema-экосистема ушли дальше.

**Отвергнуто:** 1) Resumability как в Qwik (сериализация замыканий и графа сигналов в HTML) — требует компилятора и серверного рантайма, противоречит zero-build и server-agnostic (Django/Rails). 2) Комментарии-маркеры в серверном HTML (<!--$--> как у Solid/Marko/Vue) — нужен серверный рендерер Aegis; вместо этого — сопоставление каркаса элементов и splitText (бриллиант №1). 3) Переигрывание разбудившего события для interaction — уже есть (3447–3451), проблема в полноте и двойной активации (№3). 4) Ожидание prerenderingchange, bfcache/pageshow — уже сделано (3466); острова переживают bfcache без действий. 5) MutationObserver для поздних островов — уже watch:true (3504); остаётся только пробел «незакрытый тег» (№2). 6) suppressHydrationWarning/data-allow-mismatch как отдельная фича — растворено в №1 как data-aegis-trust/{ trust }. 7) Гидрация внутри <template>.content — узлы инертны и не в документе по спецификации; tpl() (9530) закрывает сценарий, hydrate внутри template был бы ошибкой. 8) Time-slicing по scheduler.postTask с приоритетами — уже есть budget+scheduler.yield (3495), выигрыш не измерим. 9) Серверный манифест островов/aegis-ssr пакет — вне zero-build. 10) Мелкий баг, не бриллиант (чинить отдельно, 2 строки): swap(target, html) в режиме 'inner' вызывает destroyAll(target) (9329), которая через root.contains(el) уничтожает и сам target-остров, а hydrate идёт только по вставленным детям (9334) — остров-контейнер остаётся мёртвым без data-aegis-live; аналогично для outer. 11) Замена _nearestName на Левенштейн (_lev уже есть в файле) — косметика.

### 💎 #59 — Гидрация вместо замены: hydrating html`` острова адоптирует серверный DOM (каркас + splitText), E045 mismatch с диффом

**Impact:** 5 · **Effort:** M · **Size:** +0.5 KB gzip в hydrate/adopt (skeleton-проверка ~0.15, splitText ~0.2, hydrating ctx.html ~0.1); текст диффа E045 — dev-only, при желании выносится в aegis-devtools.js (0 в ядре)

**Сейчас:** component() (aegis_full.js:3053) снимает kids (3059) и, если setup вернул Node, делает el.replaceChildren(r) (3107): серверная разметка выбрасывается целиком. Следствия: фокус и каретка в серверном <input> теряются, введённый до гидрации текст пропадает, CSS-переходы срываются, при расхождении сервер↔клиент происходит молчаливый flash/CLS без единого предупреждения (React/Vue печатают mismatch, Lit SSR гидрирует на месте). adopt() (9563) даёт 0 мутаций, но вызывается вручную, а текстовые значения обязаны быть единственным ребёнком (part.sole, 9583) — канонический пример README `<li>${count} likes</li>` адоптировать нельзя. Рецепт recipes/island.html прямо пишет: «replaced by the island's template after hydration».

**Предложение:** В finish() (3389) hydrate() передаёт острову гидрирующий ctx.html: первый вызов, чей каркас элементов (теги по уровням, текст/пробелы игнорируются) совпал с el.children, выполняет adopt(el)(strings, …values) и возвращает el; остальные вызовы — обычный html``. place() при r === el ничего не заменяет. adopt() учится привязывать не-sole текст: в _compileParts для part.kind===2 запоминаются статики соседних текстовых узлов (before/after) и порядковый номер текстового «прогона» в родителе; в серверном DOM берётся тот же прогон, проверяется startsWith(before)/endsWith(after) и делается splitText — динамический Text-узел рождается без пересоздания элементов. При несовпадении каркаса — dev-предупреждение E045 с путём (ul/0/1), ожидаемым и фактическим фрагментом outerHTML (по 120 символов) и fallback на прежнее поведение (replaceChildren) — ничего не ломается. data-aegis-trust на острове = { trust: true } (не перезаписывать серверный текст до первого изменения). Тот же путь используется element() для Declarative Shadow DOM (см. №4).

**Алгоритм:**

```js
// hydrate → finish():
let adopted = false;
const hhtml = (strings, ...values) => {
    if (!adopted && el.firstElementChild) {
        const t = _tplOf(strings);                        // _templateCache.get || _parseTemplate
        if (_skeletonMatch(t.tpl.content, el, [], name)) { adopted = true; return adopt(el, { trust: el.hasAttribute('data-aegis-trust') })(strings, ...values); }
    }
    return html(strings, ...values);
};
const api = component(el, (ctx) => fn(el, data, { ...ctx, html: hhtml }));

// component → place():
if (r === el) return { el, destroy: () => destroy(el) };   // adopt: разметка уже привязана

/** Каркас совпал: те же теги в том же порядке на каждом уровне */
function _skeletonMatch(a, b, path, name) {
    const ac = a.children, bc = b.children;
    if (ac.length !== bc.length) return _mismatch(name, path, `${ac.length} vs ${bc.length} elements`, a, b);
    for (let i = 0; i < ac.length; i++) {
        if (ac[i].localName !== bc[i].localName) return _mismatch(name, [...path, i], `<${ac[i].localName}> vs <${bc[i].localName}>`, ac[i], bc[i]);
        if (!_skeletonMatch(ac[i], bc[i], [...path, i], name)) return false;
    }
    return true;
}
function _mismatch(name, path, what, tpl, real) {
    _warn('E045', {
        what: `island "${name}": server HTML differs from the template at ${path.join('/') || 'root'} — ${what}.`,
        why: 'The island falls back to re-rendering: focus, typed text and CSS transitions in the server markup are lost, and the page may shift.',
        fix: `Template: ${tpl.outerHTML?.slice(0, 120) ?? '…'}\n  Server:   ${real.outerHTML?.slice(0, 120) ?? '…'}\n  Keep the partial and the template in sync, or data-aegis-trust to keep server text.`,
        el: real,
    }, name + ':' + path.join('/'));
    return false;
}

// adopt(): не-sole текст → splitText по статикам соседей (part.before/part.after, part.run — номер текстового прогона в родителе)
if (!part.sole) {
    const parent = resolveEl(part.elPath, part.tag); if (!parent) continue;
    let run = -1, tn = null;
    for (let c = parent.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && (!c.previousSibling || c.previousSibling.nodeType !== 3)) run++; if (run === part.run && c.nodeType === 3) { tn = c; break; } }
    const b = part.before, a = part.after;
    if (!tn || !tn.data.startsWith(b) || !tn.data.endsWith(a)) { _warn('E045', …); continue; }
    if (a) tn.splitText(tn.data.length - a.length);
    const dyn = b ? tn.splitText(b.length) : tn;
    bindText(dyn);   // effect(() => dyn.data = String(val)) — как для sole
}
```

**API:**

```js
hydrate(root, opts) — без изменений сигнатуры; ctx.html внутри island()/register() становится гидрирующим (совместимо: возвращает Node или el). Атрибут <div data-aegis="x" data-aegis-trust> = adopt { trust: true }. hydrate(root, { adopt: false }) — выключить (старое поведение replace). HydrateHandle получает поле adopted: boolean. d.ts: interface HydrateOptions { adopt?: boolean } ; interface HydrateHandle { adopted: boolean }. Новый код ERRORS.md: E045 — «server HTML differs from the island template (path, expected/actual)».
```

**Критерий:** test.html: register('likes', …html`<li>${count} likes <button @click=…>♥</button></li>`); host.innerHTML = '<ul data-aegis="likes"><li>12 likes <button>♥</button></li></ul>'; const li = host.querySelector('li'), btn = host.querySelector('button'); btn.focus(); MutationObserver на host (childList, subtree). hydrate(host) → assert: host.querySelector('li') === li и button === btn (узлы те же); document.activeElement === btn; ни одной записи addedNodes/removedNodes с nodeType===1; count.value++ → li.textContent === '13 likes ♥'; handles[0].adopted === true. Mismatch: сервер '<ul data-aegis="likes"><li><span>12</span></li></ul>' → onWarn получает E045 с what, содержащим 'li' и '<span>', остров всё равно смонтирован (fallback), handles[0].adopted === false. Измерение: в demo/admin.html Layout Shift (PerformanceObserver 'layout-shift') при первой гидрации = 0 для адоптированных островов.

**Источники:** React hydrateRoot — hydration mismatch errors и onRecoverableError; Vue 3.4 __VUE_PROD_HYDRATION_MISMATCH_DETAILS__ и data-allow-mismatch; Solid.js hydrate() (маркеры <!--#-->, но идея переиспользования DOM); Lit SSR @lit-labs/ssr-client hydrate(); Qwik resumability (0 повторного рендера); Marko 6 hydration; WHATWG DOM Text.splitText; Chrome web.dev «Optimize CLS» (LayoutShift API).

### 💎 #60 — Стриминг-безопасная гидрация: остров не монтируется, пока парсер не закрыл его тег

**Impact:** 4 · **Effort:** S · **Size:** +0.15 KB gzip (одна функция _parsed и общий MutationObserver для незакрытых островов)

**Сейчас:** _watchIslands (aegis_full.js:3504) вызывает hydrate(n, { quiet: true }) на каждый addedNodes (3511). Во время document.readyState === 'loading' парсер вставляет элемент острова ДО его детей: kids (3059) пусты, slot() отдаёт ничего, :scope > script[type=json] с props (3204) ещё не существует, а visible/interaction слушатели вешаются на пустой узел. То же с ручным hydrate() из инлайнового <script> в середине body и с любым chunked-ответом сервера (Rails streaming, Django StreamingHttpResponse, Astro/Marko-подобный out-of-order стриминг через <template>+<script>). Результат — остров смонтирован с частичным DOM и без props, второй проход не произойдёт (идемпотентность по _components.has).

**Предложение:** Проверка завершённости парсинга элемента без серверных маркеров (трюк Marko <await>/is-land): при readyState === 'loading' элемент закрыт, если у него или у любого предка есть nextSibling — парсер уже пошёл дальше. Незакрытые острова попадают в Set _unparsed; один MutationObserver на documentElement и слушатель DOMContentLoaded перепроверяют их и вызывают mountIsland повторно. Переход state='pending' ставится сразу (для CSS и рекордера событий №3), поэтому клики до закрытия тега тоже не пропадут. hydrate(document) при auto-hydrate уже ждёт DOMContentLoaded (3240), меняется только ранний/watch-путь.

**Алгоритм:**

```js
/** Парсер закрыл тег? Во время загрузки — да, если у узла или предка есть nextSibling */
function _parsed(el) {
    if (document.readyState !== 'loading') return true;
    for (let n = el; n && n.nodeType !== 9; n = n.parentNode) if (n.nextSibling) return true;
    return false;
}
const _unparsed = new Set();
let _parseObs = null;
function _deferUntilParsed(el, retry) {
    _unparsed.add(el);
    el.dataset.aegisState = 'pending';
    if (!_parseObs) {
        const check = () => { for (const e of _unparsed) if (_parsed(e)) { _unparsed.delete(e); retry(e); } if (!_unparsed.size && document.readyState !== 'loading') { _parseObs.disconnect(); _parseObs = null; } };
        _parseObs = new MutationObserver(check);
        _parseObs.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', check, { once: true });
    }
    _cancelPending.set(el, () => _unparsed.delete(el));
}
// в mountIsland (3346), первой строкой после проверки ignore:
if (!_parsed(el)) { _deferUntilParsed(el, (e) => mountIsland(e)); return; }
```

**API:**

```js
Без нового публичного API. hydrate() и watch:true просто становятся корректными на стриминге. Документируется в README: «острова можно стримить — Aegis ждёт закрывающий тег». Опционально HydrateOptions.stream?: boolean (default true) для отключения проверки.
```

**Критерий:** test.html (по образцу теста prerendering, где document.prerendering подменяется через Object.defineProperty): Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true }); host с hydrate(host, { watch: true }); const isl = document.createElement('div'); isl.dataset.aegis = 'stream-island'; host.appendChild(isl) (без nextSibling) → await wait(0) → assert: isl.dataset.aegisState === 'pending' и mounts === 0. Затем isl.innerHTML = '<script type="application/json">{"n":5}</script><p>kid</p>'; host.appendChild(document.createElement('hr')) (появился nextSibling) → await wait(0) → assert mounts === 1, got.n === 5, slot() вернул <p>kid</p>. Снять defineProperty. Второй кейс: readyState не 'loading' — поведение и число монтирований как сейчас (регрессий в существующих тестах hydrate 2.0 нет).

**Источники:** Marko <await> / Marko 6 streaming runtime (проверка nextSibling для завершённости); @11ty/is-land (ready после парсинга); Astro Server Islands (out-of-order <template> + <script>); Qwik streaming SSR; WHATWG HTML §13.2 «tree construction» (узел вставляется до детей); Jake Archibald «Streaming HTML» (Chrome Developers); web.dev «Streams with HTML».}

### 💎 #61 — Replay 2.0: очередь событий до гидрации для всех стратегий, без двойной активации, с submit/input

**Impact:** 5 · **Effort:** M · **Size:** +0.45 KB gzip в ядре hydrate (рекордер 5 capture-слушателей + replay); −0.05 KB за счёт удаления текущего replay в interaction

**Сейчас:** Replay есть только у стратегии interaction и только для разбудившего события (aegis_full.js:3447–3451): eager-остров, чей код ещё грузится ({ load } / data-aegis-src, или ждёт своей доли time-slicing), молча теряет клик; visible/idle/media не переигрывают ничего; input/change, набранные в серверный <input> до гидрации, теряются (а replaceChildren ещё и стирает сам текст). Сам replay через new ev.constructor(ev.type, ev) повторяет activation behavior: чекбокс/radio переключается второй раз (нативный клик уже переключил), <button type=submit> отправляет форму второй раз, <a href> навигирует, <summary> закрывает <details>; для keydown Enter нативная отправка формы уже случилась до появления обработчика @submit.prevent. Плюс injectStyles (5522) правилом [data-aegis-state="pending"]{visibility:hidden} (5530) скрывает серверный контент interaction-острова — пользователь не может по нему кликнуть, остров не проснётся никогда.

**Предложение:** Один глобальный рекордер в capture-фазе document на click/keydown/input/change/submit: если target внутри [data-aegis-state="pending"] — событие кладётся в очередь острова (≤ 8, input коалесцируется по target, submit → preventDefault и запоминаем form+submitter). После done() (3393) очередь переигрывается по порядку: клон события диспатчится на живой target (или на корень острова, если target заменён), а одноразовый bubble-слушатель на document отменяет клон — по спецификации activation behavior не запускается для отменённого события (legacy-canceled-activation возвращает чекбокс в состояние после нативного клика), поэтому эффект остаётся ровно одним. submit переигрывается через form.requestSubmit(submitter) — @submit.prevent острова получает событие первым; если гидрация упала (state='error'), делаем form.submit() — прогрессивное улучшение без потери данных. interaction-стратегия перестаёт переигрывать сама — только mount(), дренаж общий. Правило visibility:hidden для pending удаляется (серверный контент должен быть виден и кликабелен; скрытие — только data-cloak).

**Алгоритм:**

```js
const _REPLAY = ['click', 'keydown', 'input', 'change', 'submit'];
const _queued = new WeakMap();   // остров → [{ type, target, init } | { type: 'submit', form, submitter }]
let _recording = false;
function _record(ev) {
    if (ev._aegisReplay) return;
    const isl = ev.target && ev.target.closest && ev.target.closest('[data-aegis-state="pending"]');
    if (!isl) return;
    const q = _queued.get(isl) || [];
    if (ev.type === 'submit') { ev.preventDefault(); q.push({ type: 'submit', form: ev.target, submitter: ev.submitter }); }
    else {
        if (ev.type === 'input' || ev.type === 'change') { const i = q.findIndex(x => x.type === ev.type && x.target === ev.target); if (i >= 0) q.splice(i, 1); }
        q.push({ type: ev.type, target: ev.target, init: ev });
    }
    if (q.length > 8) q.shift();
    _queued.set(isl, q);
}
function _startRecording() { if (_recording || typeof document === 'undefined') return; _recording = true; for (const t of _REPLAY) document.addEventListener(t, _record, true); }
/** Переиграть без второй активации: клон отменяется последним слушателем на document → activation behavior не срабатывает */
function _replay(isl, failed) {
    const q = _queued.get(isl); if (!q) return; _queued.delete(isl);
    for (const r of q) {
        if (r.type === 'submit') { if (!r.form.isConnected) continue; failed ? r.form.submit() : r.form.requestSubmit(r.submitter && r.submitter.isConnected ? r.submitter : undefined); continue; }
        if (failed) continue;
        const target = r.target.isConnected ? r.target : isl;
        let ev; try { ev = new r.init.constructor(r.type, r.init); } catch (e) { continue; }
        ev._aegisReplay = true;
        const cancel = (e) => { if (e === ev) e.preventDefault(); };
        document.addEventListener(r.type, cancel);
        try { target.dispatchEvent(ev); } finally { document.removeEventListener(r.type, cancel); }
    }
}
// mountIsland: после _pending.add(el) (3411) → _startRecording();
// done(): после el.dataset.aegisState = 'hydrated' → _replay(el);  в обеих ветках ошибки (state='error') → _replay(el, true)
// interaction (3441): handler = () => { off(); mount(); }  — replay убран, общий
// injectStyles: строка [data-aegis-state="pending"]{visibility:hidden} удаляется
```

**API:**

```js
Без новых обязательных параметров. HydrateOptions.replay?: false — выключить рекордер (для тестов/интеграций с чужими делегаторами). События-клоны помечены ev._aegisReplay === true (документируется как e.isReplay в d.ts через declare global? — нет: только поле на CustomEvent-подобном объекте, в d.ts: interface AegisReplayedEvent extends Event { _aegisReplay: true }). ERRORS.md: без нового кода. README: «клики, ввод и отправка формы до гидрации не теряются и не дублируются».
```

**Критерий:** test.html: (1) register('cb-island', (el,_,{on}) => { on(el.querySelector('input'), 'change', () => changes++); }); host.innerHTML = '<div data-aegis="cb-island" data-aegis-load="interaction"><label><input type="checkbox"> x</label></div>'; hydrate(host); cb.click() (нативно, до гидрации) → await wait(0) → assert cb.checked === true (сейчас false — двойное переключение) && changes === 1. (2) register('lazy-click', { load: () => new Promise(r => setTimeout(() => r((el,_,{on}) => on(el, 'click', () => clicks++)), 20)) }); hydrate(host); host.querySelector('button').click() во время загрузки → await hs.ready → assert clicks === 1 (сейчас 0). (3) register('f-island', (el,_,{on}) => on(el.querySelector('form'), 'submit', e => { e.preventDefault(); submits++; })); форма с action="#nope" data-aegis-load="idle(30)"; form.requestSubmit() до гидрации → страница не ушла (location.hash !== '#nope'), после wait(60) submits === 1. (4) injectStyles(); остров pending → getComputedStyle(el).visibility === 'visible'.

**Источники:** Qwik qwikloader (capture всех событий на document до загрузки + replay, preventdefault:submit); React 18 selective hydration и event replay (react-dom replayEvent/queueDiscreteEvent); Google «Rendering on the Web / progressive hydration» (Jason Miller, Addy Osmani); WHATWG HTML §6.5 «activation behavior», «legacy-pre-activation behavior» и «legacy-canceled-activation behavior» для checkbox/radio; HTMLFormElement.requestSubmit (HTML LS); Marko 6 «no lost interactions».

### 💎 #62 — Declarative Shadow DOM: hydrate() обходит shadow root, element() не дублирует серверный DSD-контент

**Impact:** 4 · **Effort:** M · **Size:** +0.3 KB gzip (обход хостов ~0.1, _closestAcross ~0.05, DSD-ветка в defineElement ~0.15); опция shadow:false отключает обход

**Сейчас:** hydrate() ищет острова только через root.querySelectorAll('[data-aegis]') (aegis_full.js:3477) — острова внутри shadowRoot (Enhance, Lit SSR, WebC, любой <template shadowrootmode>) невидимы; hydrate(shadowRoot) не поддержан (root.nodeType 11 не обрабатывается на 3476). _watchIslands наблюдает только documentElement (3504). el.closest('[data-aegis-ignore]') (3348) и обход DOM-предков в inject() (902) не пересекают границу shadow. data-aegis-props="#id" ищется в document (3204). defineElement с shadow:true делает this.attachShadow (7816): для хоста с Declarative Shadow Root браузер возвращает уже существующий корень, а connectedCallback затем делает root.appendChild(content) (7849) — серверная разметка остаётся и клиентская добавляется следом, контент задваивается. Lit SSR и Enhance для DSD — базовый сценарий.

**Предложение:** _forEachIsland(root, shadow, cb): querySelectorAll('[data-aegis]') + для каждого элемента с .shadowRoot — рекурсия в него (один проход querySelectorAll('*') с проверкой свойства: ~1 мс на 10k элементов, только при первом hydrate(document); shadow может быть селектором хостов, например ':not(:defined), [data-aegis-shadow]'). hydrate() принимает ShadowRoot как root. _watchIslands ставит наблюдатель и на найденные shadow root. _closestAcross(el, sel) — подъём через getRootNode().host для data-aegis-ignore и inject(). _islandProps ищет data-aegis-props в el.getRootNode(). element()/defineElement: если у хоста уже есть shadowRoot (DSD) — не attachShadow, помечаем _aegisDSD, в connectedCallback передаём Component гидрирующий ctx.html из №1, нацеленный на shadowRoot (адопт серверного DSD), при mismatch — replaceChildren вместо appendChild; после монтирования hydrate(this.shadowRoot, { quiet: true }) для вложенных островов.

**Алгоритм:**

```js
function _forEachIsland(root, shadow, cb) {
    if (root.nodeType === 1 && root.matches('[data-aegis]')) cb(root);
    root.querySelectorAll('[data-aegis]').forEach(cb);
    if (shadow === false) return;
    for (const h of root.querySelectorAll(typeof shadow === 'string' ? shadow : '*')) if (h.shadowRoot) _forEachIsland(h.shadowRoot, shadow, cb);
}
/** closest через границы shadow DOM */
function _closestAcross(el, sel) {
    for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null) if (n.nodeType === 1 && n.matches(sel)) return n;
    return null;
}
// hydrate(): const { shadow = true } = opts; … if (_closestAcross(el, '[data-aegis-ignore]')) return; … _forEachIsland(root, shadow, mountIsland);
// _islandProps: const scope = el.getRootNode(); const scriptEl = ref ? (scope.querySelector ? scope.querySelector(ref) : null) || document.querySelector(ref) : el.querySelector(':scope > script[type="application/json"]');
// inject() (902): for (let e = ownerEl.parentElement || ownerEl.getRootNode().host; e; e = e.parentElement || e.getRootNode().host)
// _watchIslands: for (const n of r.addedNodes) if (n.nodeType === 1) { hydrate(n, { quiet: true }); if (n.shadowRoot) _watchIslands(n.shadowRoot); }

// defineElement, constructor:
if (shadow) {
    if (this.shadowRoot) this._aegisDSD = true;              // Declarative Shadow Root уже разобран парсером
    else this.attachShadow({ mode: 'open' });
    if (styles) this.shadowRoot.adoptedStyleSheets = [sheet];
}
// connectedCallback:
const root = this.shadowRoot || this;
let adopted = false;
const hhtml = (strings, ...values) => {
    if (this._aegisDSD && !adopted && root.firstElementChild && _skeletonMatch(_tplOf(strings).tpl.content, root, [], tagName)) { adopted = true; return adopt(root)(strings, ...values); }
    return html(strings, ...values);
};
const content = … setup(this, this._aegisProps, { internals, shadow: this.shadowRoot, html: hhtml });
if (content instanceof Node && content !== root) { this._aegisDSD && !this._aegisSetupRan ? root.replaceChildren(content) : root.appendChild(content); }
hydrate(root, { quiet: true });   // вложенные острова внутри shadow
```

**API:**

```js
hydrate(root: Document | Element | ShadowRoot, opts) — root расширен; HydrateOptions.shadow?: boolean | string (default true; строка — селектор хостов, например '[data-aegis-shadow]'). element(tag, Component, { shadow: true }) — DSD подхватывается автоматически, Component получает ctx.html гидрирующим; ctx.shadow — как и раньше. d.ts: обновить сигнатуру hydrate и HydrateOptions; README: раздел «Declarative Shadow DOM».
```

**Критерий:** test.html: (1) const host = document.createElement('div'); host.attachShadow({ mode: 'open' }).innerHTML = '<div data-aegis="h2-island" data-n="3"></div>'; sandbox.appendChild(host); hydrate(sandbox) → assert host.shadowRoot.querySelector('b').textContent === '3'; hydrate(host.shadowRoot) идемпотентен (mounts не растёт); hydrate(sandbox, { shadow: false }) на новом хосте — не монтирует. (2) DSD-дубли: const el = document.createElement('x-dsd'); el.attachShadow({ mode: 'open' }).innerHTML = '<p>server</p>' (эмуляция разобранного DSD до upgrade — customElements.define после создания); element('x-dsd', ({ html }) => html`<p>${'client'}</p>`, { shadow: true }); sandbox.appendChild(el) → assert el.shadowRoot.children.length === 1 && el.shadowRoot.querySelector('p').textContent === 'client' (адопт: тот же <p>, что был серверным). (3) data-aegis-ignore на хосте снаружи shadow → остров внутри shadow не монтируется. Firefox headless: setHTMLUnsafe/DSD доступны с Firefox 123, тест не зависит от парсера.

**Источники:** WHATWG HTML — Declarative Shadow DOM (template shadowrootmode, Element.attachShadow возвращает declarative root), Element.setHTMLUnsafe; Lit SSR (@lit-labs/ssr, @lit-labs/ssr-client hydrate, DSD polyfill); Enhance.dev SSR (custom elements + DSD); WebC (11ty); Astro «Web Components with DSD»; web.dev «Declarative Shadow DOM» (Mason Freed); DOM Standard: Node.getRootNode, ShadowRoot.host.

### 💎 #63 — Props островов по Standard Schema: island(name, C, { props: schema }) — валидация, defaults, required, вывод типов

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip внутри island()/_coerceProp (проверка '~standard', форматирование issues); сами схемы (valibot/zod/arktype) — пользовательские, в сборку не входят

**Сейчас:** Типизация props ограничена картой types (aegis_full.js:3169 _coerceProp: Number/Boolean/String/JSON/функция): нет required, default, enum, вложенных объектов; Number('abc') молча даёт NaN; JSON из <script type=json> и data-aegis-props (3204–3208) вливается Object.assign без какой-либо проверки; отсутствующий обязательный атрибут — undefined до первого падения в setup. При этом element() уже принимает { type, default, reflect } (7761), т.е. в одном движке два разных формата описания props для «одного контракта компонента» (комментарий 3286). Astro (zod в content collections), Angular input.required(), TanStack Router/Form (Standard Schema) дают проверенные и выведенные типы на входе.

**Предложение:** island()/register() принимают в iopts.props любой объект Standard Schema v1 (наличие '~standard'): перед вызовом Component данные (после coerce по types, если заданы) прогоняются через schema['~standard'].validate(data) синхронно; при issues — dev-предупреждение E046 с путями полей и сообщениями (count: Expected number), остров монтируется с сырыми данными (или при { strict: true } — не монтируется, state='error'); при успехе Component получает r.value (defaults/трансформации применены) — единый вывод типа через StandardSchemaV1.InferOutput. Параллельно types расширяется до формата element(): { count: { type: Number, default: 0, required: true } } — required отсутствует → E046, NaN при Number → E046. Асинхронная схема (Promise) → E046 «hydrate() is synchronous».

**Алгоритм:**

```js
const _isStd = (s) => s && typeof s === 'object' && s['~standard'] && typeof s['~standard'].validate === 'function';
function _validateProps(name, el, data, schema, strict) {
    const r = schema['~standard'].validate(data);
    if (r && typeof r.then === 'function') { _warn('E046', { what: `island("${name}"): props schema is async.`, why: 'hydrate() applies props synchronously.', fix: 'Use a synchronous schema (no async refinements).' }, name + ':async'); return data; }
    if (r.issues) {
        const list = r.issues.map(i => ((i.path || []).map(p => (p && typeof p === 'object' && 'key' in p) ? p.key : p).join('.') || '(root)') + ': ' + i.message).join('; ');
        _warn('E046', { what: `island "${name}": invalid props — ${list}.`, why: 'The server rendered attributes/JSON that do not match the schema.', fix: `Fix the server template or the schema; strict: true refuses to mount.`, el }, name + ':' + list.slice(0, 60));
        return strict ? null : data;
    }
    return r.value;
}
// _coerceProp: объектный дескриптор { type, default, required }
function _coerceProp(raw, type, key, name, el) {
    const d = type && typeof type === 'object' && 'type' in type ? type : { type };
    if (raw === undefined) { if (d.required) _warn('E046', { what: `island "${name}": required prop "${key}" is missing.`, why: 'No data-' + key + ' attribute and no JSON props field.', fix: `Render data-${key}="…" or drop required.`, el }, name + ':' + key); return d.default ?? (d.type === Boolean ? false : undefined); }
    const v = _coerceOne(raw, d.type);   // текущая логика
    if (d.type === Number && Number.isNaN(v)) _warn('E046', { what: `island "${name}": data-${key}="${raw}" is not a number.`, why: 'Number("' + raw + '") is NaN.', fix: 'Render a numeric value or declare type: String.', el }, name + ':' + key + ':nan');
    return v;
}
// island():
export function island(name, Component, iopts = {}) {
    const schema = _isStd(iopts.props) ? iopts.props : null;
    register(name, (el, data, ctx) => {
        if (schema) { data = _validateProps(name, el, data, schema, iopts.strict); if (data === null) { el.dataset.aegisState = 'error'; return; } }
        return Component({ ...ctx, props: reactive({ ...data }, { shallow: true }) });
    }, iopts.types ? { types: iopts.types } : undefined);
}
```

**API:**

```js
island<S extends StandardSchemaV1>(name: string, component: Component<{ props: StandardSchemaV1.InferOutput<S> } & SetupContext>, opts: { props: S; types?: PropTypes; strict?: boolean }): void — перегрузка к существующей island<T extends Record<string, PropType>>. PropType расширяется: Number | Boolean | String | typeof JSON | ((raw: string) => any) | { type: PropType; default?: any; required?: boolean }. В d.ts добавляется минимальный интерфейс StandardSchemaV1 (как в спецификации: '~standard': { version: 1; vendor: string; validate(v: unknown): Result | Promise<Result>; types?: { input; output } }). ERRORS.md: E046 — «island props failed validation / required prop missing / async schema».
```

**Критерий:** test.html: рукописная схема без зависимостей: const S = { '~standard': { version: 1, vendor: 'test', validate: (v) => (typeof v.count === 'number' && v.count >= 0) ? { value: { ...v, label: v.label ?? 'n/a' } } : { issues: [{ message: 'must be >= 0', path: ['count'] }] } } }; island('schema-island', ({ props }) => { got = props; }, { props: S, types: { count: Number } }); (1) '<div data-aegis="schema-island" data-count="5">' → got.count === 5 && got.label === 'n/a' (default из схемы применён). (2) data-count="-1" → onWarn получает E046 с what, содержащим 'count: must be >= 0', остров смонтирован (got.count === -1). (3) { strict: true } и data-count="-1" → el.dataset.aegisState === 'error', Component не вызван. (4) types: { id: { type: String, required: true } } без data-id → E046 'required prop "id"'. (5) data-count="abc" с types Number → E046 '…is not a number'. Проверка типов в тесте типов d.ts: props.count выводится как number из InferOutput.

**Источники:** Standard Schema v1 (standardschema.dev — интерфейс '~standard', реализации valibot ≥ 1.0, zod ≥ 3.24, arktype ≥ 2.0); Angular signal inputs input.required<T>() / transform; Astro content collections (zod-схемы props); Svelte 5 $props() с типами; TanStack Router validateSearch и TanStack Form (Standard Schema адаптеры); Lit @property({ type, converter }) как аналог дескриптора; ERRORS.md формат what/why/fix.

### 💎 #64 — Порядок гидрации вложенных островов: parent-first, дети ждут родителя, выброшенные шаблоном дети уничтожаются (E047)

**Impact:** 3 · **Effort:** S · **Size:** +0.2 KB gzip (проверка pending-предка в mountIsland, обход [data-aegis-live] в place(), hydrate поддерева в done)

**Сейчас:** hydrate() кладёт все острова в eager/idle по document order (aegis_full.js:3477) без учёта вложенности. Если внешний остров вернул html`` без slot(), place() (3107) делает el.replaceChildren(r) и внутренние острова, уже смонтированные (или помеченные pending с IO/слушателями), отсоединяются от DOM без destroy: их scope, эффекты и подписки живут до destroyAll/watch (зомби, которых ловит только E028 по случайному обновлению). Если внешний — visible/idle, а внутренний — eager, внутренний монтируется раньше родителя: inject() по DOM-предкам (902) ничего не находит (E022 даже советует «Lazy parent island? Use eager» — то есть чинить вручную), а после монтирования родителя внутренний может быть выброшен. Для async setup внешнего острова окно гонки ещё шире (place выполняется после await).

**Предложение:** Инвариант «родитель раньше ребёнка, ребёнок живёт только в DOM родителя»: mountIsland пропускает острова, у которых есть предок в состоянии pending — их смонтирует done() родителя, вызвав hydrate(el, { quiet, load }) на своём поддереве (после slot()/replaceChildren, т.е. по фактическому DOM). В place() перед replaceChildren все [data-aegis-live]/[data-aegis-state="pending"] внутри el, не попавшие в r, уничтожаются через destroy() с dev-предупреждением E047 «дочерний остров выброшен шаблоном родителя — используйте slot('[data-aegis]')». В результате inject() из ребёнка всегда видит provide() родителя, зомби невозможны, порядок детерминирован и совпадает с Astro (вложенные острова гидрируются внутри родителя).

**Алгоритм:**

```js
// mountIsland (3346), после проверки ignore:
const outer = el.parentElement && el.parentElement.closest('[data-aegis-state="pending"]');
if (outer && !force) return;                      // родитель ещё не смонтирован: его done() вызовет hydrate(el) по поддереву

// done() (3393), после aegis:hydrated:
hydrate(el, { quiet: true, load, budget, idleTimeout });   // дети по фактическому DOM (slot() или новый шаблон)

// component → place():
const place = (r) => {
    if (r === el) return { el, destroy: () => destroy(el) };
    if (r instanceof Node) {
        for (const c of el.querySelectorAll('[data-aegis-live],[data-aegis-state="pending"]')) {
            if (r.contains(c)) continue;
            _warn('E047', {
                what: `island "${c.dataset.aegis}" inside "${el.dataset.aegis || _tag(el)}" is dropped by the parent's template.`,
                why: 'The parent returned html`` without slot(): old children, including this island, are removed.',
                fix: "Place server children with slot('[data-aegis]') inside the template, or render the child island yourself.",
                el: c,
            }, 'drop:' + c.dataset.aegis);
            destroy(c);
        }
        el.replaceChildren(r);
        return { el, destroy: () => destroy(el) };
    }
    return r;
};
```

**API:**

```js
Без нового публичного API; поведение: вложенный остров монтируется после родителя (документировать в README/llms.txt: «вложенные острова гидрируются родителем; чтобы ребёнок жил независимо от стратегии родителя — вынесите его наружу или data-aegis-ignore на родителе»). ERRORS.md: E047 — «child island dropped by the parent template (use slot())». HydrateHandle родителя получает children: HydrateHandle[] (результат внутреннего hydrate) — удобно для await всех ready.
```

**Критерий:** test.html: (1) register('outer-p', (el, d, { html, slot }) => { provide('theme', 'dark'); return html`<section>${slot('[data-aegis]')}</section>`; }); register('inner-c', () => { seen = inject('theme'); }); host.innerHTML = '<div data-aegis="outer-p" data-aegis-load="idle(20)"><div data-aegis="inner-c"></div></div>'; hydrate(host) → сразу: inner state не 'hydrated' (ждёт родителя); await wait(60) → seen === 'dark' и inner внутри <section>. (2) register('outer-drop', (el,d,{html}) => html`<p>new</p>`); inner с onDispose(() => disposed++); host.innerHTML = '<div data-aegis="outer-drop"><div data-aegis="inner-c"></div></div>'; hydrate(host) → onWarn получил E047, disposed === 0 но inner так и не монтировался (mountsInner === 0), в _components нет отсоединённых узлов (dev.inspect(host).length === 1). (3) Регрессия: существующие тесты hydrate 2.0 (test.html:1118–1183) и swap morph (1782–1794) проходят без изменений.

**Источники:** Astro islands — вложенные компоненты в client:* родителе рендерятся как slot и гидрируются с родителем; Qwik (порядок не важен — контраст); Solid/Svelte context: провайдер обязан быть смонтирован раньше потребителя; React: родительские компоненты гидрируются раньше детей (top-down), selective hydration по Suspense-границам; WAI/HTML — нет; внутреннее E022 (aegis_full.js:918) как свидетельство проблемы.

## 🔭 island-strategies-perf

**Линза:** Стратегии и производительность островов: eager/visible/idle/interaction/media (секция 8), приоритеты и планирование монтирования (scheduler.postTask, yield, long tasks), предзагрузка модулей острова (modulepreload, import maps), стоимость первой гидрации (TBT/INP), совместная работа с lazy()/virtualScroll, гидрация «по требованию» через Speculation Rules и prerender (фаза 7 кэша уже добавила базу — не повторяй), метрики (performance.mark на остров, отчёт в dev-панель), бюджеты (не более N островов за кадр). Сравни с Astro client:* директивами, Qwik resumability, Marko streaming, Chrome Scheduling APIs, web.dev INP guidance.

**Вывод:** Aegis уже впереди Astro client:* и 11ty is-land по выразительности стратегий: аргументы у стратегий (visible(300px), idle(1500), interaction(click,keydown)), один общий IntersectionObserver на rootMargin (aegis_full.js:3257), горизонт прогрева по скорости скролла (:6568), переигрывание разбудившего события (:3443–3452), нарезка eager-части через scheduler.yield() (:3273, :3490–3497) и корректная пауза в prerendered-документе (:3466–3469). Отстаёт по планированию и наблюдаемости: монтирование идёт в DOM-порядке без приоритетов и без учёта viewport, бюджет проверяется только ПОСЛЕ работы (одна тяжёлая setup-функция пробивает 8 мс), нет isInputPending/postTask; eager-острова с { load } импортируются водопадом (await r на :3494 сериализует import()); IO-колбэки (:3262–3266), idle-дренаж (:3480–3487), watch (:3511) и swap (:9334) монтируют вне нарезки — пачка из 30 вставленных островов = одна длинная задача; hover полностью монтирует interaction-остров (:3442), а события во время загрузки кода теряются (переигрывается только первое). Нет ни одной метрики на остров (stats() :988 знает только flushes/effects), нет modulepreload, а hydrate.auto ждёт DOMContentLoaded (:3247–3252) — на потоковых страницах (Marko 6, Astro server islands) острова над сгибом ждут хвост документа. Шесть предложений ниже закрывают именно эти разрывы, не трогая уже сделанное в кэш-фазе 7 (speculate/prerender, сетевой бюджет, warm-горизонт).

**Отвергнуто:** 1) Speculation Rules / prerender-aware hydrate — сделано в кэш-фазе 7 (DIAMONDS-CACHE #28, aegis_full.js:3466–3469, :9493). 2) Адаптивный горизонт прогрева visible-островов и lazy() по скорости скролла — сделано (#26, :6568). 3) Центральный сетевой бюджет для прогрева островов — сделано (#25, :6507). 4) Qwik-style resumability (сериализация сигналов в HTML, нулевая гидрация) — требует серверного сериализатора и сборки, противоречит zero-build; частично покрыто adopt() и seedFrom() (другая линза). 5) Смена дефолта eager → visible/auto — ломающее изменение; предлагается opt-in через hydrate.defaultLoad. 6) Острова в Web Worker (Partytown) — тяжёлый рантайм, не tree-shakeable, чужие скрипты вне области. 7) Service-worker prefetch бандлов как в Qwik — нет графа бандлов без сборки; modulepreload по data-aegis-src даёт 80 % эффекта за 0.2 KB. 8) lazy() на общий _sharedIO вместо своего observe() — микрооптимизация (одна IO на элемент), нет измеримого эффекта. 9) Полифилл requestIdleCallback для Safari — уже есть setTimeout-fallback (:3486). 10) «Разгидрация» островов, ушедших далеко за viewport (destroy + re-pending) — теряет состояние, редкий кейс длинных лент; вместо этого достаточно visible-стратегии и content-visibility у пользователя. 11) data-aegis-load="none"/client:only — эквивалент eager без серверных детей, ничего не добавляет.

### 💎 #65 — Единый планировщик монтирования: postTask-приоритеты, cost-aware нарезка, isInputPending

**Impact:** 5 · **Effort:** M · **Size:** +0.55 KB gzip в секции 8 (не в ядре 6.1 KB); заменяет три отдельных механизма (eager-цикл, idle-дренаж, IO-колбэк) — чистый прирост ≈ +0.4 KB

**Сейчас:** Нарезка есть только у eager-части: цикл на aegis_full.js:3490–3497 проверяет бюджет ПОСЛЕ job() — одна setup-функция на 60 мс пробивает 8-мс бюджет; нет учёта ожидающего ввода (navigator.scheduling.isInputPending), нет приоритетов (scheduler.postTask), _yield (:3273) — только scheduler.yield()/setTimeout. Остальные источники монтирования вообще не нарезаны: колбэк _sharedIO монтирует все пересёкшиеся острова синхронно в одном IO-колбэке (:3262–3266 — сетка из 12 карточек, влетевшая во viewport, = одна длинная задача); idle-дренаж (:3480–3487) смотрит только dl.timeRemaining() > 1 и запускает 40-мс остров в 2-мс окно; _watchIslands вызывает отдельный hydrate() на каждый вставленный узел (:3511), swap() — тоже (:9334): htmx-ответ с 30 островами = 30 синхронных первых кусков подряд. Нет hydrate.settled() — тесты и метрики ждут через wait().

**Предложение:** Одна очередь _mq с тремя полосами (user-blocking / user-visible / background), в которую кладут задания все источники: eager-цикл (после синхронного первого куска), IO-колбэк visible, idle, watch, swap, стриминг (#6). Дренаж под scheduler.postTask({ priority }) с фолбэком rIC/setTimeout; перед каждым заданием — прогноз стоимости по EWMA времени монтирования этого имени острова (_islandCost) и проверка isInputPending(): если spent + est > budget или ввод ждёт — уступить (scheduler.yield наследует приоритет задачи). interaction-острова монтируются inline (нужна синхронность для переигрывания события). Публично: hydrate.settled() → Promise пустой очереди; hydrate.budget (глобальный дефолт 8); data-aegis-priority="high|low" / island(name, C, { priority }) сдвигает полосу. Совместимо: budget: Infinity по-прежнему монтирует всё синхронно (обход очереди).

**Алгоритм:**

```js
// секция 8 — единая очередь монтирования островов
const _mq = { ub: [], uv: [], bg: [] };            // user-blocking / user-visible / background
let _mqScheduled = false, _mqSettle = null, _mqResolve = null;
const _islandCost = new Map();                     // name → EWMA мс монтирования
const _PRIO = { ub: 'user-blocking', uv: 'user-visible', bg: 'background' };
const _inputPending = () => !!(navigator.scheduling && navigator.scheduling.isInputPending && navigator.scheduling.isInputPending());
function _mqPush(job) {                            // job = { name, prio, run }
    _mq[job.prio].push(job);
    if (!_mqSettle) _mqSettle = new Promise(r => { _mqResolve = r; });
    if (!_mqScheduled) { _mqScheduled = true; _mqSchedule(job.prio); }
}
function _mqSchedule(prio) {
    const run = () => { _mqScheduled = false; _mqDrain(); };
    if (globalThis.scheduler && typeof scheduler.postTask === 'function') scheduler.postTask(run, { priority: _PRIO[prio] });
    else if (prio === 'bg' && typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 0);
}
const _mqNext = () => _mq.ub.shift() || _mq.uv.shift() || _mq.bg.shift();
function _mqDrain() {
    const budget = hydrate.budget ?? 8, t0 = performance.now();
    let job;
    while ((job = _mqNext())) {
        const est = _islandCost.get(job.name) ?? 2, spent = performance.now() - t0;
        if (spent > 0 && (spent + est > budget || _inputPending())) { _mq[job.prio].unshift(job); _mqScheduled = true; return _mqSchedule(job.prio); }
        const s = performance.now();
        try { job.run(); } catch (e) { console.error('[Aegis] island job failed:', e); }
        const ms = performance.now() - s, prev = _islandCost.get(job.name);
        _islandCost.set(job.name, prev == null ? ms : prev * 0.7 + ms * 0.3);
    }
    if (_mqResolve) { _mqResolve(); _mqSettle = _mqResolve = null; }
}
hydrate.settled = () => _mqSettle || Promise.resolve();

// в hydrate(): вместо eager.push(mount) / idle.push(mount) / obs.watch(el, () => mount())
const prio = el.dataset.aegisPriority === 'high' ? 'ub' : el.dataset.aegisPriority === 'low' ? 'bg' : 'uv';
case 'visible': obs.watch(el, () => _mqPush({ name, prio, run: mount })); …
case 'idle':    _mqPush({ name, prio: 'bg', run: mount }); (таймаут idle(ms) → переставить в 'uv') …
default:        eager.push({ name, prio, run: mount });
// eager: первый кусок синхронно до budget (как сейчас), остаток — в очередь
let t0 = performance.now(), i = 0;
for (; i < eager.length && (budget === Infinity || performance.now() - t0 <= budget); i++) eager[i].run();
for (; i < eager.length; i++) _mqPush(eager[i]);
handles.ready = Promise.all(handles.map(h => h.ready)).then(() => {});
// _watchIslands / swap: собрать вставленные узлы и вызвать hydrate один раз на пачку
const added = []; for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) added.push(n);
if (added.length) hydrate(added, { quiet: true });   // hydrate принимает Element | Element[] | Document
```

**API:**

```js
export function hydrate(root?: Document | Element | Element[], opts?: HydrateOptions): HydrateHandle[] & { ready: Promise<void> };
export namespace hydrate {
    let auto: boolean;
    /** глобальный бюджет мс на задачу планировщика (default 8) */
    let budget: number;
    /** Promise: очередь монтирования пуста (visible/idle/watch/swap-острова тоже) */
    function settled(): Promise<void>;
}
interface HydrateOptions { …; /** полоса планировщика для всех островов root; data-aegis-priority="high|low" — на элементе */ priority?: 'high' | 'normal' | 'low' }
export function island<T>(name, component, opts?: { types?: T; priority?: 'high' | 'normal' | 'low' }): void;
```

**Критерий:** test.html, секция «планировщик островов»: (1) register('sched', тяжёлый setup: busy-loop 6 мс); root с 12 visible-островами, у которых IO срабатывает сразу (rootMargin 100000px через data-aegis-load="visible(100000px)") → после первого IO-колбэка (await wait(0)) смонтировано ≥1 и <12; await hydrate.settled() → 12. (2) hydrate(w, { watch: true }); w.innerHTML = 30 островов одной пачкой → в одном тике смонтировано <30, после settled() — 30, а счётчик вызовов внутреннего дренажа (stats().islands.drains) ≥ 2. (3) Подменить navigator.scheduling = { isInputPending: () => true } → с budget 8 после первого острова остальные уходят в следующую задачу (в одном тике ровно 1). (4) Cost-EWMA: два острова по 6 мс с budget 8 → второй не запускается в том же тике (сейчас — запускается, т.к. проверка после job). Измерение в demo/admin.html через LoAF: 0 кадров > 50 мс при монтировании 40 островов (сейчас 1–2).

**Источники:** WICG Prioritized Task Scheduling (scheduler.postTask, scheduler.yield — Chrome 129+, приоритет наследуется yield-ом); navigator.scheduling.isInputPending (Chrome 87, статья Facebook «Faster input events with Facebook's first browser API contribution»); web.dev «Optimize long tasks» и «Optimize INP» (yield often, break up work); Philip Walton «Idle Until Urgent»; Astro client:idle реализация через requestIdleCallback без нарезки — для сравнения; React 19 Scheduler (lanes/priorities) как аналог полос.

### 💎 #66 — Стратегия auto и порядок eager по положению во viewport

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip в секции 8

**Сейчас:** Eager-острова монтируются в DOM-порядке querySelectorAll (aegis_full.js:3477): шапка с меню, затем 30 карточек ленты, и только потом — сайдбар-фильтр, который пользователь видит первым; при budget 8 остров над сгибом может оказаться в третьем куске. Дефолт 'eager' (:3415) заставляет автора расставлять data-aegis-load руками, тогда как решение «над сгибом → сразу, ниже → по видимости» почти всегда одно и то же. Astro тоже не имеет авто-стратегии (client:load — всегда); Qwik решает это resumability, недоступной без сборки.

**Предложение:** Пре-проход без записей в DOM: один getBoundingClientRect() на остров (одна форсированная раскладка на весь hydrate, до того как записан data-aegis-state — иначе CSS [data-aegis-state="pending"]{visibility:hidden} из injectStyles инвалидирует стили между чтениями) даёт «расстояние в экранах» dist: 0 — во viewport или без layout (display:none/тесты), k>0 — k экранов ниже, -1 — выше. Стратегия 'auto' (data-aegis-load="auto", hydrate(root, { load: 'auto' }), hydrate.defaultLoad = 'auto'): dist 0 → eager в полосе user-visible, dist 1 → eager в полосе background (после первого кадра), dist ≥2 или -1 → visible. Явные eager-острова сортируются стабильно по dist, чтобы первый синхронный кусок тратился на видимое. Отключается opts.order: false (документ с 5000 островов, где раскладка дорога).

**Алгоритм:**

```js
/** 0 — во viewport (или элемент без раскладки), k>0 — k экранов ниже, -1 — выше сгиба */
function _screenDist(el, vh) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return 0;                       // display:none / скрытый sandbox → как видимый
    if (r.bottom < 0) return -1;
    return r.top <= vh ? 0 : Math.ceil((r.top - vh) / vh);
}
// в hydrate(): собрать элементы ДО любых записей
const els = [];
if (root.nodeType === 1 && root.matches('[data-aegis]')) els.push(root);
for (const r of Array.isArray(root) ? root : [root]) r.querySelectorAll('[data-aegis]').forEach(e => els.push(e));
const needDist = order !== false && (els.length > 1 || (load ?? hydrate.defaultLoad) === 'auto');
const vh = typeof innerHeight === 'number' ? innerHeight : 800;
const dist = needDist ? els.map(e => _screenDist(e, vh)) : null;   // одна раскладка на все чтения
els.forEach((el, i) => mountIsland(el, dist ? dist[i] : 0));
// в mountIsland(el, d):
let rawStrategy = load ?? el.dataset.aegisLoad ?? hydrate.defaultLoad ?? 'eager';
if (rawStrategy === 'auto') rawStrategy = d === 0 ? 'eager' : d === 1 ? 'eager(bg)' : 'visible';
… default: eager.push({ name, prio: sargs.includes('bg') ? 'bg' : prio, d, run: mount });
// перед синхронным куском
eager.sort((a, b) => a.d - b.d);                                // стабильная сортировка: viewport → ниже → выше сгиба
```

**API:**

```js
type LoadStrategy = 'eager' | 'auto' | 'visible' | 'idle' | 'interaction' | string;
export namespace hydrate {
    /** стратегия для островов без data-aegis-load (default 'eager'; 'auto' — по положению во viewport) */
    let defaultLoad: LoadStrategy;
}
interface HydrateOptions { load?: LoadStrategy; /** сортировать eager по положению во viewport (default true) */ order?: boolean }
<div data-aegis="chart" data-aegis-load="auto">   // над сгибом — eager, ниже — visible
```

**Критерий:** test.html (хост в document.body, как в тесте virtualScroll :2251 — sandbox скрыт): host position:relative; height:4000px; три острова 'auto-isl' с position:absolute top 0 / 900px (при innerHeight ≈ 700 → dist 1) / 3500px (dist ≥2). hydrate(host, { load: 'auto', budget: Infinity }) → первый: dataset.aegisState === 'hydrated' синхронно; второй: pending, после hydrate.settled() — hydrated без скролла; третий: pending, после host.scrollIntoView/скролла до 3500 и await wait(50) — hydrated. Порядок eager: 5 eager-островов, DOM-порядок [низ, низ, верх, низ, верх], budget: -1 → первый синхронно смонтированный — верхний (mounts-лог[0] имеет data-n верхнего). Проверка одной раскладки: обёртка getBoundingClientRect через Proxy на Element.prototype в тесте — число вызовов === числу островов, и между ними нет записей атрибутов (порядок «все reads → все writes»).

**Источники:** Astro client:visible / client:load семантика (нет auto — мотивация); 11ty is-land on:visible; web.dev «Avoid large, complex layouts and layout thrashing» (batch reads before writes); Chrome «Layout Instability» и forced synchronous layout в Performance panel; Marko 6 «hydrate above-the-fold first» (out-of-order streaming); Qwik «resumable by default» — как ориентир для дефолта «ничего не исполнять, пока не нужно».

### 💎 #67 — Параллельная загрузка кода островов + modulepreload по data-aegis-src

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip в секции 8

**Сейчас:** Eager-цикл на aegis_full.js:3490–3497: `const r = job(); if (r && typeof r.then === 'function') await r;` — для островов с register(name, { load }) или data-aegis-src каждый import() ждёт предыдущий: три разных ленивых острова над сгибом = три последовательных сетевых круга (≈3×RTT) вместо одного. Код ожидающих островов (visible за 400px, interaction, idle) начинает грузиться только в warm()/mount() (:3384, :3404–3410) — при клике пользователь ждёт import() целиком; URL модуля при этом известен заранее (data-aegis-src, :3349–3353), но <link rel="modulepreload"> не ставится, и fetchpriority не используется. Astro вставляет modulepreload для client:load на сборке; Aegis без сборки может делать это в рантайме.

**Предложение:** (1) Стартовать loadSetup() для всех eager-ленивых островов до цикла, до любого монтирования — все import() летят параллельно; finish уходит в очередь планировщика (#1) по мере прихода модулей, а не await-ом подряд. (2) _modulepreload(href, fetchPriority): eager-острова с data-aegis-src — сразу, priority high; pending (visible/idle/interaction) — в _idle() под _netBudget().speculate, priority low; дедуп по href. (3) register(name, { load, src }) — явный URL для modulepreload там, где load — стрелка с import(); подсказка в d.ts: src: import.meta.resolve('./chart.js'). (4) Ошибка загрузки одного модуля не блокирует остальные (сейчас цикл продолжается, но задерживается).

**Алгоритм:**

```js
const _preloaded = new Set();
function _modulepreload(href, prio) {
    if (!href || _preloaded.has(href) || typeof document === 'undefined') return;
    _preloaded.add(href);
    const l = document.createElement('link');
    l.rel = 'modulepreload'; l.href = href; if (prio) l.fetchPriority = prio;
    document.head.appendChild(l);
}
// в mountIsland(): после вычисления setup
const src = el.dataset.aegisSrc || (setup && typeof setup === 'object' && setup.src);
const lazyMod = typeof setup !== 'function';
…
default: {                                   // eager
    if (lazyMod) { _modulepreload(src, 'high'); const p = loadSetup(); p.then(fn => _mqPush({ name, prio, run: () => finish(fn) }), (e) => { console.error(`[Aegis] island "${name}" failed to load:`, e); el.dataset.aegisState = 'error'; resolve(undefined); }); }
    else eager.push({ name, prio, d, run: mount });
}
// pending-ветки (visible/idle/interaction/media) — прогрев кода без сети сверх бюджета
if (lazyMod && src && el.dataset.aegisWarm !== 'off' && _netBudget().speculate) _idle(() => _modulepreload(src, 'low'));
// register: явный src
export function register(name, setup, ropts) { … if (setup && typeof setup === 'object' && ropts && ropts.src) setup.src = ropts.src; … }
```

**API:**

```js
export function register<D>(name: string, setup: IslandSetup<D> | { load: () => Promise<…>; /** URL модуля для <link rel=modulepreload> (import.meta.resolve('./x.js')) */ src?: string }, opts?: { types?; src?: string }): void;
<div data-aegis="chart" data-aegis-src="/js/islands/chart.js" data-aegis-load="interaction" data-aegis-warm="off">  // warm=off отключает modulepreload (уже есть для visible)
stats().islands.preloaded: number
```

**Критерий:** test.html: register('par-a', { load: () => wait(25).then(() => (el, d, { html }) => html`<b>a</b>`) }), register('par-b', { load: () => wait(25).then(…) }); root с обоими eager → t0; await hs.ready; assert(performance.now() - t0 < 45) (сейчас ≥ 50). modulepreload: register('mp', { load: () => import('./fixtures/mp.js'), src: new URL('./fixtures/mp.js', location.href).href }); остров data-aegis-load="interaction" → после await wait(50) (rIC) document.head.querySelector('link[rel="modulepreload"][href$="mp.js"]') !== null и fetchPriority === 'low'; второй такой же остров не добавляет второй link. Save-Data (Object.defineProperty(navigator, 'connection', { value: { saveData: true } })) → link не ставится. Измерение в Chrome Network panel на recipes/island.html с двумя data-aegis-src: старт запросов модулей отличается < 5 мс (сейчас — второй стартует после завершения первого).

**Источники:** HTML Living Standard «fetch a modulepreload module script graph» (Chrome грузит граф зависимостей, Firefox/Safari — только сам модуль); Priority Hints — атрибут fetchpriority на <link> (WHATWG HTML, Chrome 101+, Safari 17.2+); import.meta.resolve() (ES2023, Chrome 105+, Firefox 106+, Safari 16.4+); Astro «Hydration: modulepreload for client:load islands»; Qwik prefetching bundles (service worker / modulepreload) как ориентир; web.dev «Preload critical assets» и «Module preload».

### 💎 #68 — interaction 2.0: hover греет, клик монтирует, очередь событий во время загрузки, aria-busy

**Impact:** 4 · **Effort:** M · **Size:** +0.35 KB gzip в секции 8

**Сейчас:** Список пробуждающих событий по умолчанию (aegis_full.js:3442) включает pointerenter и focusin: наведение курсора на тяжёлый interaction-остров (редактор, карта) монтирует его целиком — пролёт мышью через ленту из 20 таких островов монтирует все 20, стратегия вырождается в eager-по-наведению. Во время загрузки кода (import() между первым событием и finish, :3443–3446) слушатели уже сняты (off() на :3444) — переигрывается ТОЛЬКО первое событие: пользователь набрал «abc» в поле поиска ожидающего острова — остров получит один keydown, остальные потеряны; submit формы внутри pending-острова уходит на сервер нативно. Нет индикации состояния «грузится» — курсор и a11y молчат. Qwik-loader и is-land ставят события в очередь до загрузки обработчика.

**Предложение:** Разделить намерения: pointerenter/focusin → warm() (import модуля + data-aegis-prefetch, уже есть на :3384), а монтирует только настоящее взаимодействие (click, keydown, input, touchstart, submit). После первого пробуждающего события — capture-слушатель на el собирает все последующие события в очередь q, для submit и click по a[href]/кнопке submit — preventDefault (иначе уйдёт нативно до монтирования); на время import() el получает aria-busy="true" и data-aegis-state="loading" (CSS автора: [data-aegis-state="loading"]{cursor:progress}). После finish — очередь переигрывается по порядку на исходные цели (или el, если цель заменена рендером); для submit, если синтетическое событие не отменено обработчиком острова — form.requestSubmit(). hydrate.warm(el) — публичный прогрев для своих детекторов намерения.

**Алгоритм:**

```js
case 'interaction': {
    const wake = sargs.length ? sargs : ['click', 'keydown', 'input', 'touchstart', 'submit'];
    const q = [];
    let loading = false;
    const capture = (ev) => {
        q.push(ev);
        if (ev.type === 'submit' || (ev.type === 'click' && ev.target.closest && ev.target.closest('a[href],button[type=submit],button:not([type])'))) ev.preventDefault();
    };
    const replay = () => {
        for (const ev of q) {
            if (ev.type === 'pointerenter' || ev.type === 'touchstart') continue;
            const t = ev.target && ev.target.isConnected ? ev.target : el;
            try { const re = new ev.constructor(ev.type, ev); t.dispatchEvent(re); if (ev.type === 'submit' && !re.defaultPrevented && t.requestSubmit) t.requestSubmit(); } catch (e) { /* не воспроизводимое событие */ }
        }
        q.length = 0;
    };
    const handler = async (ev) => {
        if (loading) return;
        loading = true; off();
        for (const t of wake) el.addEventListener(t, capture, true);   // всё, что придёт пока грузится код
        capture(ev);
        el.setAttribute('aria-busy', 'true'); el.dataset.aegisState = 'loading';
        const r = mount(); if (r && typeof r.then === 'function') await r;
        for (const t of wake) el.removeEventListener(t, capture, true);
        el.removeAttribute('aria-busy');
        replay();
    };
    const off = () => { for (const t of wake) el.removeEventListener(t, handler); for (const t of _WARM) el.removeEventListener(t, warm); };
    for (const t of wake) el.addEventListener(t, handler, { passive: t === 'touchstart' });
    for (const t of _WARM /* ['pointerenter','focusin'] */) el.addEventListener(t, warm, { once: true, passive: true });
    _cancelPending.set(el, off);
    break;
}
hydrate.warm = (el) => { const w = _warmers.get(el); if (w) w(); };   // _warmers: WeakMap el → warm
```

**API:**

```js
data-aegis-load="interaction"                    // default: click,keydown,input,touchstart,submit; hover/focus — только прогрев
data-aegis-load="interaction(click,pointerenter)"  // явно: pointerenter снова монтирует
data-aegis-state="pending" | "loading" | "hydrated" | "error"   // новое промежуточное состояние
export namespace hydrate { /** прогреть код и data-aegis-prefetch ожидающего острова без монтирования */ function warm(el: Element): void; }
CSS автора: [data-aegis-state="loading"] { cursor: progress }
```

**Критерий:** test.html: register('int2', { load: () => wait(20).then(() => (el, d, { on }) => { on(el, 'keydown', () => keys++); on(el.querySelector('form'), 'submit', (e) => { e.preventDefault(); submits++; }); }) }); остров interaction с <input> и <form>. (1) dispatch pointerenter → await wait(0): loads === 1, mounts === 0 (сейчас mounts === 1). (2) dispatch keydown ×3 подряд (bubbles) → сразу el.getAttribute('aria-busy') === 'true' и dataset.aegisState === 'loading'; await hs[0].ready; await wait(0) → keys === 3 в исходном порядке (сейчас 1), aria-busy снят. (3) form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })) во время загрузки → defaultPrevented === true; после ready submits === 1, страница не перезагружена. (4) interaction(click,pointerenter) — явный pointerenter монтирует (обратная совместимость). Существующий тест «interaction: событие переиграно после монтирования» (:2246) остаётся зелёным.

**Источники:** Qwik qwikloader (глобальный capture-слушатель, очередь событий до загрузки символа, replay); 11ty is-land on:interaction; WAI-ARIA 1.2 §aria-busy (регион обновляется — AT не читает промежуточное); HTML Living Standard requestSubmit() и SubmitEvent; web.dev «Optimize INP: избегать тяжёлой работы в обработчике первого ввода» (прогрев на hover снимает import() с критического пути клика); Astro client:idle/visible — отсутствие interaction-стратегии как контраст.

### 💎 #69 — Метрики островов: трек в Performance, stats().islands, LoAF-атрибуция и E045

**Impact:** 4 · **Effort:** M · **Size:** +0.25 KB gzip в секции 8 (счётчики) + ~0.35 KB только под _dev()/dev.profile (LoAF-наблюдатель, текст E045); вкладка islands — в aegis-devtools.js, вне сборки

**Сейчас:** stats() (aegis_full.js:988–998) знает flushes/effectRuns/slow-effects, но об островах — только components: _components.size; _installProfileMark (:1002–1008) размечает в Performance-панели flush-и, а монтирование острова (import + component() + replaceChildren на :3107) — самая дорогая операция на server-first странице — невидимо ни в панели, ни в dev.panel() (вкладки components/cache, aegis-devtools.js:89–91). Нет ответа на вопросы «какой остров сделал длинный кадр», «сколько островов ждут и по какой стратегии», «сколько стоит первая гидрация» — а именно это web.dev советует измерять для TBT/INP. Astro Dev Toolbar показывает список островов и их директивы; Aegis — нет.

**Предложение:** _measureIsland(name, strategy, t0, t1) вокруг finish(): накапливает _isl { mounted, ms, byStrategy, pending, slow[20], drains }, а при включённом профилировании ставит performance.measure в трек «Aegis islands» с цветом error при >50 мс (или console.timeStamp с треком — как у flush). В dev-режиме PerformanceObserver('long-animation-frame') сопоставляет длинные кадры с недавними монтированиями: остров, целиком попавший в LoAF-кадр и стоивший >50 мс, получает E045 (один раз на имя) с fix: «data-aegis-load="visible"/"idle" или разбейте setup; стоимость N мс, стратегия eager, dist K экранов ниже сгиба». stats().islands публично; dev.panel() получает вкладку islands (имя, стратегия, состояние, мс, кнопки mount now / destroy). hydrate.settled() из #1 делает измерения детерминированными в тестах.

**Алгоритм:**

```js
const _isl = { mounted: 0, ms: 0, drains: 0, preloaded: 0, byStrategy: {}, slow: [], recent: [] };
function _measureIsland(name, strategy, d, t0, t1) {
    const ms = t1 - t0;
    _isl.mounted++; _isl.ms += ms; _isl.byStrategy[strategy] = (_isl.byStrategy[strategy] || 0) + 1;
    if (ms > 8) { _isl.slow.push({ name, strategy, ms: +ms.toFixed(1) }); if (_isl.slow.length > 20) _isl.slow.shift(); }
    if (_dev()) { _isl.recent.push({ name, strategy, d, t0, t1, ms }); if (_isl.recent.length > 50) _isl.recent.shift(); _loafWatch(); }
    if (_profileMark) {
        const label = `aegis:island · ${name} · ${strategy} · ${ms.toFixed(1)} ms`;
        if (typeof console.timeStamp === 'function' && console.timeStamp.length >= 5) console.timeStamp(label, t0, t1, 'Aegis islands', 'Aegis', ms > 50 ? 'error' : 'primary');
        else try { performance.measure(label, { start: t0, end: t1, detail: { devtools: { dataType: 'track-entry', track: 'Aegis islands', color: ms > 50 ? 'error' : 'primary', properties: [['strategy', strategy], ['ms', ms.toFixed(1)]] } } }); } catch (e) { /* старый measure */ }
    }
}
let _loaf = null;
function _loafWatch() {
    if (_loaf || typeof PerformanceObserver === 'undefined') return;
    try {
        _loaf = new PerformanceObserver((list) => {
            for (const f of list.getEntries()) for (const m of _isl.recent) {
                if (m.ms > 50 && m.t0 >= f.startTime && m.t1 <= f.startTime + f.duration) _warn('E045', {
                    what: `Island "${m.name}" took ${m.ms.toFixed(0)} ms inside a ${f.duration.toFixed(0)} ms long frame (${m.strategy}${m.d > 0 ? `, ${m.d} screen(s) below the fold` : ''}).`,
                    why: 'Eager mounting of heavy islands blocks input and hurts INP/TBT.',
                    fix: m.d > 0 ? `data-aegis-load="visible" — nobody sees it yet.` : `data-aegis-load="interaction" or split setup(): render first, load data in resource().`,
                }, 'island:' + m.name);
            }
        });
        _loaf.observe({ type: 'long-animation-frame', buffered: true });
    } catch (e) { _loaf = false; }
}
// в finish(): const t0 = performance.now(); … done(api) → _measureIsland(name, strategy, d, t0, performance.now());
// stats(): islands: { live: _components.size, pending: _pendingCount, ..._isl, recent: undefined }
```

**API:**

```js
stats().islands: { live: number; pending: number; mounted: number; ms: number; drains: number; preloaded: number; byStrategy: Record<string, number>; slow: { name: string; strategy: string; ms: number }[] }
dev.profile(true)   // + трек «Aegis islands» в Performance-панели (console.timeStamp / performance.measure с devtools.dataType 'track-entry')
E045 — «Island X took N ms in a long frame» (ERRORS.md, aegis-devtools DOCS)
dev.panel(): вкладка islands — name · strategy · state · ms · [mount now] [destroy]
HydrateHandle { …; /** стратегия, к которой привёл разбор data-aegis-load/auto */ strategy: string }
```

**Критерий:** test.html: (1) dev.profile(true); hydrate одного острова → performance.getEntriesByType('measure').some(e => e.name.startsWith('aegis:island · ')) (в Chrome с console.timeStamp-треком — проверять через stats().islands.mounted === 1 и slow.length === 0). (2) register('heavy', setup с busy-loop 60 мс) под _dev(): hydrate → await wait(300) (LoAF-запись приходит после кадра; в headless Chrome — с --enable-features) → onWarn собрал ровно один E045 с 'heavy' в what; второй hydrate того же имени не дублирует (ключ island:heavy). (3) stats().islands.byStrategy после host с eager+visible+idle: { eager: 1 } сразу, pending === 2; после settled и IO — pending 0. (4) Ручная проверка: Performance-панель на demo/admin.html показывает трек «Aegis islands» с полосами островов. Firefox/Safari без LoAF: _loaf === false, без ошибок (test-browsers.mjs).

**Источники:** Long Animation Frames API (Chrome 123, web.dev «Long Animation Frames API» — script attribution, blockingDuration); web.dev «Optimize INP», «Total Blocking Time»; Chrome DevTools «Performance panel extensibility API» (performance.measure detail.devtools track-entry, console.timeStamp с треком — Chrome 134+); Astro Dev Toolbar «Islands» app; Vue DevTools/Solid DevTools как ориентир вкладки; Event Timing API (INP-атрибуция) для будущего расширения.

### 💎 #70 — Потоковая гидрация: острова оживают по мере прихода HTML, до DOMContentLoaded

**Impact:** 4 · **Effort:** M · **Size:** +0.3 KB gzip в секции 8; tree-shakeable вместе с hydrate.auto (не вызывается, если register() не используется)

**Сейчас:** _scheduleAutoHydrate (aegis_full.js:3247–3252) при document.readyState === 'loading' ждёт DOMContentLoaded и только тогда делает hydrate(document). На потоковых страницах (Django StreamingHttpResponse, Rails Turbo streams, Astro server islands, любой медленный хвост — рекомендации, футер с аналитикой, deferred-чанки) шапка с поиском и первые карточки уже отрисованы браузером, но мёртвы до прихода последнего байта: TTI над сгибом равен времени всего документа. Marko 6 и Astro server islands гидрируют по мере поступления (out-of-order streaming); Aegis, позиционируясь как движок для server-first HTML, здесь отстаёт. Подключение hydrate({ watch: true }) до DCL не помогает: MutationObserver увидит остров, у которого парсер ещё не закрыл детей — slot() и querySelector внутри setup получат неполное поддерево.

**Предложение:** Пока документ грузится, наблюдать documentElement одним MutationObserver (коалесценция пачки узлов парсера в один проход через setTimeout 0) и гидрировать только ЗАВЕРШЁННЫЕ острова. Критерий завершённости без серверных маркеров: парсер всегда дописывает в конец — элемент открыт тогда и только тогда, когда лежит на правой ветви дерева (путь <html> → lastChild → lastChild …); остров не на этой ветви полностью распарсен (foster-parenting таблиц — единственное исключение, тогда остров дождётся DCL как сейчас). Готовые острова уходят в планировщик (#1) с приоритетом user-visible; на DCL — финальный hydrate(document) для остатка, наблюдатель снимается. Опционально серверный маркер <template data-aegis-end> не нужен. Выключается hydrate.streaming = false. Не запускать в prerendering-документе (там уже ждём prerenderingchange).

**Алгоритм:**

```js
/** Правая ветвь дерева — элементы, которые парсер ещё не закрыл */
function _openChain(doc) { const s = new Set(); for (let n = doc.documentElement; n; n = n.lastChild) s.add(n); return s; }
/** Остров распарсен полностью: не лежит на открытой ветви */
function _isParsed(el, open) { return !open.has(el); }
function _streamHydrate() {
    if (typeof document === 'undefined' || document.readyState !== 'loading' || typeof MutationObserver === 'undefined' || hydrate.streaming === false) return;
    const seen = new WeakSet();
    let t = 0;
    const tick = () => {
        t = 0;
        const open = _openChain(document);
        const ready = [];
        for (const el of document.querySelectorAll('[data-aegis]:not([data-aegis-state])')) {
            if (seen.has(el) || !_isParsed(el, open) || !_registry.has(el.dataset.aegis) && !el.dataset.aegisSrc) continue;
            seen.add(el); ready.push(el);
        }
        if (ready.length) hydrate(ready, { quiet: true });      // hydrate принимает Element[] (#1)
    };
    const mo = new MutationObserver(() => { if (!t) t = setTimeout(tick, 0); });   // пачка узлов парсера → один проход
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { mo.disconnect(); if (t) clearTimeout(t); }, { once: true });   // остаток доберёт run() из _scheduleAutoHydrate
}
function _scheduleAutoHydrate() {
    if (_autoScheduled || typeof document === 'undefined') return;
    _autoScheduled = true;
    const run = () => { _autoScheduled = false; if (hydrate.auto !== false) hydrate(document, { quiet: true }); };
    if (document.readyState === 'loading') { if (!document.prerendering) _streamHydrate(); document.addEventListener('DOMContentLoaded', run, { once: true }); }
    else queueMicrotask(run);
}
// hydrate(root) с root — Document: тот же _openChain-фильтр применяется, если root.readyState === 'loading' (ручной вызов до DCL безопасен)
```

**API:**

```js
export namespace hydrate {
    /** гидрировать полностью распарсенные острова по мере прихода HTML, до DOMContentLoaded (default true при hydrate.auto) */
    let streaming: boolean;
}
export function hydrate(root?: Document | Element | Element[], opts?: HydrateOptions & { /** пропускать острова, которые парсер ещё не закрыл (default: root.readyState === 'loading') */ parsedOnly?: boolean }): …;
<script type="module" src="/js/app.js"></script>  // в <head>: register() до тела — острова оживают по мере стрима, без изменений разметки
```

**Критерий:** test.html: (1) юнит: const d = document.implementation.createHTMLDocument(); d.open(); d.write('<body><div data-aegis="st" data-n="1"><p>a</p></div><section><div data-aegis="st" data-n="2"><p>'); const open = _openChain(d) (через dev-экспорт или hydrate(d, { parsedOnly: true })) → первый остров смонтирован (querySelector('b') === '1'), второй — без data-aegis-state (не тронут); d.write('</p></div></section></body>'); d.close(); hydrate(d) → второй смонтирован, slot()/querySelector('p') внутри setup видел полное поддерево (setup записывает el.children.length при вызове — должно быть 1 у обоих). (2) Интеграционный (test-browsers.mjs, headless Chrome): страница отдаётся чанками с паузой 1500 мс перед </body>; performance.mark в aegis:hydrated первого острова < 300 мс от navigationStart (сейчас ≥ 1500). (3) Таблица с foster-parenting: остров внутри <table> без <tbody> на открытой ветви — не гидрируется до DCL (нет ошибок в консоли). (4) hydrate.streaming = false → поведение как сейчас (тест idempotent auto-hydrate остаётся зелёным).

**Источники:** Marko 6 «Streaming and out-of-order hydration»; Astro «Server islands» (потоковые фрагменты + гидрация по приходу); HTML Living Standard §13.2.6 tree construction — insertion point всегда в конце (правая ветвь = открытые элементы), foster parenting как исключение; Chrome «Streaming HTML» (Jake Archibald, «Fun hacks for faster content»); Custom Elements «parser-created elements: children not yet available in constructor» — тот же класс проблемы; React 19 progressive hydration/Suspense streaming как ориентир UX; Enhance/11ty is-land — гидрация по наблюдателю без учёта завершённости (контраст).

## 🔭 server-contract-html-wire

**Линза:** Контракт с сервером (server-first): HTML-over-the-wire (секция 34 boost/swap/morph, секция 25 wireForm), частичные обновления (фрагменты по id, hx-target-подобие, Datastar-подобные SSE-патчи), <template>-шаблоны сервера (tpl/adopt), seeds данных из HTML (data-aegis-cache — уже есть), View Transitions в MPA, заголовки ответа как канал управления (Aegis-Invalidate есть; что ещё: redirect, focus, announce, patch), формат ошибок сервера, совместимость с Django/Rails/Laravel/Go шаблонами, идемпотентность и CSRF (секция 4). Сравни с HTMX 2, Datastar, Turbo 8 (morph, refresh), Unpoly, Alpine AJAX, Phoenix LiveView, Hotwire Native.

**Вывод:** Aegis уже сильнее HTMX/Turbo в трёх точках контракта с сервером: swap() (aegis_full.js:9283) вызывается кодом, а не атрибутом, и при этом сам гасит острова, гидрирует новые, снимает data-cloak и восстанавливает фокус с кареткой; _morph (:9217) знает про живые острова (data-aegis-live, :9227) и перемонтирует их только при смене data-*; seedFrom/data-aegis-cache и Aegis-Invalidate (:1380) дают серверу канал в кэш, которого у Turbo нет вовсе. Отставание — в самом «проводе»: (1) ответ сервера может обновить ровно один target — нет out-of-band фрагментов (hx-swap-oob, Turbo Streams, Datastar patch-elements) и HTML по SSE (sse() понимает только aegis-signals, :4060); (2) заголовки как канал управления ограничены одним Aegis-Invalidate — нет redirect/retarget/reswap/trigger/announce/push-url, а в запросе сервер не получает ни цели (Aegis-Target), ни признака boost, т.е. Django/Rails не могут отдать частичный шаблон; (3) boost() на Navigation API теряет позицию прокрутки при «назад» (visit без replace → scrollTo(0,0), :9385/:9420, e.scroll() не вызывается), выбрасывает response.url после PRG-редиректа (:9363) и не отслеживает дрейф ассетов после деплоя (head: только title/новые стили, :9378); (4) wireForm.serverSubmit (:7261) выбрасывает HTML-ответ 422/200 с перерисованной формой — а это основной контракт Django/Rails без JSON — и показывает «HTTP 422» (:7289); (5) morph матчит детей без id по позиции (:9251–9256), теряя узлы с id внутри (idiomorph решает id-set'ами), и не имеет data-*-permanent для видео/карт/виджетов. Шесть предложений ниже закрывают это ~+2.4 KB gzip суммарно, всё в секциях 4/25/34 и tree-shakeable.

**Отвергнуто:** 1) Декларативный язык атрибутов hx-get/hx-target/hx-swap (HTMX, Alpine AJAX) — противоречит принципу Aegis «поведение в коде, HTML — данные»; swap(el, request(url,{raw:true})) уже одна строка, а register()/острова покрывают «оживление» разметки. 2) Кастомный элемент-конверт <turbo-stream action=…> (Turbo Streams) — вместо него обычный HTML с id и <template data-aegis-oob> (см. №2): не ломает валидацию шаблонов Django/Rails и не требует customElements. 3) Заголовки/механизмы кэша — Aegis-Invalidate, Cache-Tag/Aegis-Tags, SSE-инвалидация, ETag/304, Idempotency-Key в офлайн-очереди — уже сделаны или расписаны в DIAMONDS-CACHE (#3, #5, #14, #30, #87, #97); не повторяю. 4) Streaming HTML/out-of-order streaming (Astro server islands, Marko) — браузер сам стримит первую страницу, а для boost выигрыш мал при сложности разбора потока DOMParser'ом; Declarative Shadow DOM просто работает через парсер. 5) SSR html``-шаблонов на Node — движок zero-build server-first, сервер любой (Django/Rails/Go); tpl()/adopt() уже дают «одна разметка на сервере и клиенте». 6) Hotwire Native bridge (нативные оболочки) — ниша, нет запроса. 7) WebSocket-транспорт для HTML — SSE + patch() достаточно (Datastar доказал), WS даёт только двунаправленность, которую закрывает request(). 8) View Transitions для MPA через @view-transition { navigation: auto } — это CSS сервера; boost уже использует startViewTransition, добавляю только types (в №3). 9) Автосохранение open у <details>/<dialog> при morph — сервер вправе закрыть; ни Turbo, ни idiomorph этого не делают, покрывается data-aegis-permanent. 10) Клиентская проверка Sec-Fetch-Site/Origin для CSRF — обязанность сервера (Go 1.25 CrossOriginProtection, Django), клиент уже шлёт всё нужное. 11) Полная поддержка RFC 9457 problem+json — _applyServerErrors (:5285) уже читает detail/errors/JSON:API pointer; недостаёт лишь title как fallback — микроправка, не бриллиант. 12) Микрофикс приоритета операторов в _morph (:9246: `a && b || c`) — включён в №6, сам по себе не бриллиант.

### 💎 #71 — Заголовки как канал управления: Aegis-* в обе стороны (Target/Boosted → сервер; Redirect/Location/Retarget/Reswap/Trigger/Announce/Focus/Push-Url ← сервер)

**Impact:** 5 · **Effort:** M · **Size:** +0.6 KB gzip (таблица директив в §34 — tree-shakeable вместе со swap/boost; в request() только ~40 B на чтение)

**Сейчас:** Единственный заголовок ответа, который движок понимает, — Aegis-Invalidate в request() (aegis_full.js:1380–1384). В запросе сервер видит лишь X-Requested-With (:1223) и Accept: text/html из boost.fetchPage (:9363) / serverSubmit (:7270): нет ни цели вставки, ни признака boost, ни текущего URL — Django/Rails/Laravel не могут решить «отдать фрагмент или всю страницу», как это делают django-htmx (request.htmx.target) или turbo-rails (Turbo-Frame). Ответ не может попросить клиента: перенаправить (после JSON-мутации), заменить URL, перенацелить вставку, объявить событие, зачитать сообщение для screen reader, поставить фокус. HTMX 2 делает это девятью HX-* заголовками, Unpoly — X-Up-*, Turbo — Turbo-Location.

**Предложение:** Один диспетчер `_directives(response, ctx)` в §34 с префиксом `configure({ directiveHeader: 'Aegis-' | false })`. Фаза «до вставки»: Aegis-Retarget (CSS-селектор нового target), Aegis-Reswap (mode), Aegis-Title. Фаза «после»: Aegis-Redirect (полная навигация), Aegis-Location (мягкий переход через boost.visit, если boost активен), Aegis-Push-Url / Aegis-Replace-Url, Aegis-Refresh, Aegis-Trigger (имя события или JSON {name: detail} → CustomEvent на document), Aegis-Announce (announce(), politeness через `Aegis-Announce: assertive:Текст`), Aegis-Focus (селектор). Вызывается из swap() при Response, из boost.visit и wireForm.serverSubmit (там ещё и для JSON-ответов — Aegis-Redirect заменяет PRG для API). Запрос: boost.fetchPage и serverSubmit шлют `Aegis-Request: true`, `Aegis-Target` (селектор root/формы), `Aegis-Boosted: true` (boost), `Aegis-Current-URL`. Dev-проверка E045: если запрос ушёл с Aegis-Target, а ответ кэшируемый (Cache-Control без no-store) и без `Vary: Aegis-Target` — предупредить (фрагмент попадёт в HTTP-кэш вместо страницы).

**Алгоритм:**

```js
// §34, рядом с swap()
const _DIRECTIVES = {
    retarget:      (v, c) => { const el = document.querySelector(v); if (el) c.target = el; },          // до вставки
    reswap:        (v, c) => { c.mode = v; },
    title:         (v) => { document.title = v; },
    redirect:      (v) => location.assign(v),
    location:      (v, c) => (c.visit ? c.visit(v) : location.assign(v)),
    'push-url':    (v) => history.pushState(null, '', v),
    'replace-url': (v) => history.replaceState(null, '', v),
    refresh:       () => location.reload(),
    trigger:       (v) => { let o = null; try { o = JSON.parse(v); } catch (e) { /* список имён */ }
                            if (o && typeof o === 'object') for (const [n, d] of Object.entries(o)) document.dispatchEvent(new CustomEvent(n, { detail: d }));
                            else for (const n of v.split(',')) if (n.trim()) document.dispatchEvent(new CustomEvent(n.trim())); },
    announce:      (v) => { const m = /^(polite|assertive):/.exec(v); announce(m ? v.slice(m[0].length) : v, m ? m[1] : 'polite'); },
    focus:         (v) => { const el = document.querySelector(v); if (el) el.focus({ preventScroll: false }); },
};
const _PRE = new Set(['retarget', 'reswap', 'title']);
/** Заголовки ответа → директивы; возвращает ctx (target/mode могли смениться) и ctx.after() для пост-фазы */
function _directives(response, ctx = {}) {
    const pre = _config.directiveHeader ?? 'Aegis-';
    ctx.after = () => {};
    if (!pre || !response || !response.headers || !_sameOrigin(response.url || location.href)) return ctx;
    const later = [];
    for (const [name, fn] of Object.entries(_DIRECTIVES)) {
        const v = response.headers.get(pre + name);
        if (v == null) continue;
        if (_PRE.has(name)) fn(v, ctx); else later.push(() => fn(v, ctx));
    }
    ctx.after = () => { for (const f of later) f(); };
    if (_dev() && ctx.sentTarget) {
        const vary = response.headers.get('Vary') || '', cc = response.headers.get('Cache-Control') || '';
        if (!/no-store|private/.test(cc) && !new RegExp(pre + 'Target', 'i').test(vary) && !/^\*$/.test(vary.trim()))
            _warn('E045', { what: `Fragment response for ${response.url} has no "Vary: ${pre}Target".`, why: 'A shared HTTP cache may serve this fragment to a full-page request.', fix: `Add Vary: ${pre}Target on the server (django-htmx / patch_vary_headers).` }, 'vary:' + response.url);
    }
    return ctx;
}
// swap(): в начале
//   let ctx = { target, mode }; if (html instanceof Response) { ctx = _directives(html, ctx); target = ctx.target; mode = ctx.mode; }
//   ... после apply()/animate: ctx.after();
// boost.fetchPage(url, init): headers: { Accept: 'text/html', 'Aegis-Request': 'true', 'Aegis-Boosted': 'true', 'Aegis-Target': typeof root === 'string' ? root : _selectorFor(el), 'Aegis-Current-URL': location.href }
//   возвращает { html, response } → visit: const d = _directives(response, { visit, sentTarget: true }); … после swap: d.after();
// serverSubmit: headers += { 'Aegis-Request': 'true', 'Aegis-Target': _selectorFor(formEl) }; после _parseBody: _directives(response, { sentTarget: true }).after();
// Сервер (Django, 4 строки): if request.headers.get('Aegis-Target'): template = 'orders/_table.html'; patch_vary_headers(resp, ['Aegis-Target']); resp['Aegis-Announce'] = 'Заказ сохранён'
```

**API:**

```js
configure({ directiveHeader?: string | false })   // default 'Aegis-'
// Заголовки ЗАПРОСА (шлёт boost/serverSubmit): Aegis-Request: true · Aegis-Target: <selector> · Aegis-Boosted: true · Aegis-Current-URL: <href>
// Заголовки ОТВЕТА: Aegis-Retarget · Aegis-Reswap · Aegis-Title · Aegis-Redirect · Aegis-Location · Aegis-Push-Url · Aegis-Replace-Url · Aegis-Refresh · Aegis-Trigger · Aegis-Announce · Aegis-Focus (+ существующий Aegis-Invalidate)
// d.ts: interface AegisResponseDirectives { 'Aegis-Retarget'?: string; 'Aegis-Reswap'?: SwapMode; 'Aegis-Redirect'?: string; 'Aegis-Location'?: string; 'Aegis-Push-Url'?: string; 'Aegis-Replace-Url'?: string; 'Aegis-Refresh'?: 'true'; 'Aegis-Trigger'?: string; 'Aegis-Announce'?: string; 'Aegis-Focus'?: string; 'Aegis-Title'?: string; 'Aegis-Invalidate'?: string }
// swap() и boost.visit() применяют директивы сами; wireForm.submit() — тоже (в т.ч. для JSON-ответов).
```

**Критерий:** test.html: (1) `swap(cart, new Response('<ul id="other">x</ul>', { headers: { 'Aegis-Retarget': '#other-host', 'Aegis-Reswap': 'outer', 'Aegis-Trigger': '{"cart:changed":{"n":3}}', 'Aegis-Announce': 'assertive:Готово' } }))` → вставлено в #other-host, не в cart; на document пришло событие cart:changed с detail.n === 3; live-region содержит «Готово». (2) mockFetch с заголовком `Aegis-Redirect: /login` на POST из wireForm → вызван location.assign (подменить через _config.onRedirect-хук в тесте / spy). (3) boost.visit: мок _config.fetch фиксирует заголовки запроса — есть Aegis-Target === 'main' и Aegis-Boosted === 'true'. (4) dev: ответ с Cache-Control: max-age=60 без Vary на запрос с Aegis-Target → onWarn получает E045; с `Vary: Aegis-Target` — нет.

**Источники:** HTMX 2 — Response Headers (HX-Redirect, HX-Location, HX-Push-Url, HX-Retarget, HX-Reswap, HX-Trigger, HX-Refresh) и Request Headers (HX-Request, HX-Target, HX-Boosted, HX-Current-URL), раздел «Caching» про Vary; django-htmx (request.htmx.target, HttpResponseClientRedirect); Unpoly — X-Up-Target / X-Up-Location / X-Up-Title / X-Up-Events; Turbo — Turbo-Frame запрос и Turbo-Location; RFC 9110 §12.5.5 Vary; WAI-ARIA 1.3 live regions (aria-live politeness).

### 💎 #72 — patch(): многофрагментный HTML по id (out-of-band) + HTML-патчи по SSE

**Impact:** 5 · **Effort:** M · **Size:** +0.5 KB gzip (patch ~350 B в §34; sse({ html }) ~60 B; mode 'delete' ~40 B)

**Сейчас:** swap() (aegis_full.js:9283–9343) принимает ровно один target: `select` вырезает из ответа один узел (:9294–9298), остальное ответа выбрасывается. Сервер не может за один round-trip обновить таблицу, счётчик в шапке и flash-сообщение — то, что HTMX делает hx-swap-oob, Turbo — несколькими <turbo-stream>, Datastar — событием datastar-patch-elements с id-матчингом, Unpoly — up-hungry. sse() (:4053–4069) умеет только JSON-патч сигналов через событие aegis-signals (:4060) и произвольные события; HTML-фрагменты по SSE (главный режим Datastar и LiveView) прикладной код должен парсить сам через innerHTML — против правила README «серверный HTML только через swap/adopt».

**Предложение:** Новая функция `patch(html | Response | Node[], { root, transition })`: верхнеуровневые элементы ответа с id находят `root.querySelector('#id')` и морфятся туда; `<template data-aegis-oob data-aegis-target="#x" data-aegis-swap="append|prepend|before|after|inner|outer|morph|delete">` задаёт явную цель и режим (шаблоны Django/Rails остаются валидным HTML, никаких кастомных элементов). Новый режим swap 'delete' (Turbo remove / Datastar remove): destroyAll + удаление. swap() получает `oob: true` (по умолчанию включён, если ответ содержит `[data-aegis-oob]`): главный фрагмент — как сейчас, остальные — через patch(). sse(url, { html: true }) слушает событие `aegis-html` (data — HTML) и применяет patch(); данные с `data-aegis-swap` на самом фрагменте задают режим. Один код для трёх транспортов: тело ответа, SSE, boost (в будущем — WebSocket).

**Алгоритм:**

```js
/** Многофрагментный ответ: каждый верхнеуровневый элемент с id (или <template data-aegis-oob>) морфится в свой узел документа */
export async function patch(src, { root = document, transition = false } = {}) {
    if (typeof Response !== 'undefined' && src instanceof Response) src = await src.text();
    let nodes = src;
    if (typeof src === 'string') { const t = document.createElement('template'); t.innerHTML = src; nodes = [...t.content.children]; }
    const jobs = [];
    for (const n of nodes) {
        const oob = n.localName === 'template' && n.hasAttribute('data-aegis-oob') ? n : null;
        const sel = oob ? oob.dataset.aegisTarget : (n.id ? '#' + CSS.escape(n.id) : null);
        const mode = (oob ? oob.dataset.aegisSwap : n.dataset.aegisSwap) || 'morph';
        const target = sel && root.querySelector(sel);
        if (!target) { _warn('E046', { what: `patch(): no target for ${sel || '<' + n.localName + '>'}.`, why: 'An out-of-band fragment needs an existing element.', fix: 'Give the fragment an id that exists on the page, or data-aegis-target="#id".' }, 'patch:' + sel); continue; }
        const source = oob ? [...oob.content.childNodes] : n;
        jobs.push(mode === 'delete' ? Promise.resolve(_remove(target, transition)) : swap(target, source, { mode, transition }));
    }
    const res = await Promise.all(jobs);
    return { patched: res.length };
}
const _remove = (el, transition) => { const del = () => { destroyAll(el); el.remove(); }; return transition ? animate(el, del, typeof transition === 'object' ? transition : {}) : del(); };
// swap(): после выбора source из строки —
//   if (oob !== false && doc /* или t.content */) { const extra = [...(doc ? doc.body : t.content).querySelectorAll(':scope > template[data-aegis-oob]')]; for (const x of extra) x.remove(); if (extra.length) queueMicrotask(() => patch(extra)); }
//   case 'delete': destroyAll(target); target.remove(); inserted = []; break;
// sse(): if (opts.html) es.addEventListener('aegis-html', (e) => patch(e.data));
// Сервер (Django view): return HttpResponse(render_to_string('orders/_row.html', …) + render_to_string('layout/_cart_badge.html', …))  # два фрагмента с id, оба обновятся
// SSE (любой сервер): event: aegis-html\ndata: <li id="order-7" data-aegis-swap="outer">…</li>
```

**API:**

```js
export function patch(src: string | Response | Node[], opts?: { root?: Document | Element; transition?: boolean | { name?: string; cls?: string } }): Promise<{ patched: number }>;
export type SwapMode = 'inner' | 'outer' | 'append' | 'prepend' | 'before' | 'after' | 'morph' | 'delete';
swap(target, html, { …, oob?: boolean })   // default: true, если в ответе есть [data-aegis-oob]
sse(url, { html?: boolean, … })            // событие aegis-html → patch()
// HTML-контракт: <template data-aegis-oob data-aegis-target="#sel" data-aegis-swap="mode">…</template> либо элемент с id и опциональным data-aegis-swap
```

**Критерий:** test.html: (1) страница с #rows, #badge, #flash; `patch('<tbody id="rows"><tr id="r1">A</tr></tbody><span id="badge">3</span><template data-aegis-oob data-aegis-target="#flash" data-aegis-swap="append"><p class="ok">Saved</p></template>')` → #rows содержит r1 (тот же узел tbody), #badge.textContent === '3', #flash имеет .ok; результат patched === 3. (2) `swap(main, '<div id="main">…</div><template data-aegis-oob data-aegis-target="#badge" data-aegis-swap="outer"><span id="badge">9</span></template>')` → main заменён, badge === '9'. (3) `<template data-aegis-oob data-aegis-target="#r1" data-aegis-swap="delete">` → строка удалена, остров внутри неё получил aegis:destroy. (4) sse с моком EventSource (подмена globalThis.EventSource): dispatch MessageEvent('aegis-html', { data: '<span id="badge">12</span>' }) → badge === '12' без вызова innerHTML прикладным кодом. (5) фрагмент без цели → E046 через onWarn, остальные применены.

**Источники:** HTMX 2 — hx-swap-oob и hx-select-oob; Turbo Streams — actions append/prepend/replace/update/remove/before/after (turbo-stream target по id); Datastar — SSE-событие datastar-patch-elements (mode morph/inner/outer/prepend/append/before/after/remove, матчинг по id); Unpoly — [up-hungry]; Phoenix LiveView — phx-update и DOM-патчи по id; WHATWG HTML — <template> content model (валидная разметка внутри любого шаблонизатора); Server-Sent Events (HTML Living Standard §9.2).

### 💎 #73 — boost(): честный контракт Navigation API — e.scroll() при «назад», редирект коммитит response.url, types для View Transitions

**Impact:** 4 · **Effort:** S · **Size:** +0.25 KB gzip (внутри boost, tree-shakeable)

**Сейчас:** boost.visit (aegis_full.js:9368–9400) вызывается из onNavigate (:9420) без флага replace, поэтому для traverse-навигации (кнопка «назад») выполняется `window.scrollTo(0, 0)` (:9385) — позиция прокрутки теряется, а `e.scroll()` Navigation API (единственный способ восстановить её при `scroll: 'manual'`) не вызывается никогда. fetchPage (:9360–9366) делает `.then(r => r.text())` и выбрасывает Response: после POST-формы с 303 (PRG) или GET-редиректа (/orders → /login) в адресной строке остаётся исходный URL, history-запись указывает на URL POST, pageCache (:9362) кэширует ответ под старым ключом. Ответ не text/html (JSON-ссылка) даёт `next === null` → location.assign (:9377) — приемлемо, но статус ≥ 400 рендерится молча, без события. View Transitions запускаются без types (:9389) — CSS не может отличить «назад» от «вперёд». Turbo 8 и Unpoly решают все четыре пункта (Turbo-Location/response.url, восстановление scroll per history entry).

**Предложение:** (1) fetchPage возвращает { html, url: r.url, redirected: r.redirected, status, ct }; visit при `redirected` и same-origin не рендерит, а вызывает `navigation.navigate(res.url, { history: 'replace', info: { aegisHtml: html } })` — новый navigate-событие рендерит из info без второго fetch (идиома Navigation API: info передаёт данные между навигациями); в fallback-пути — `history.replaceState(null, '', res.url)`. (2) onNavigate передаёт в visit сам NavigateEvent: после swap `scroll: 'restore'` → `nav.scroll()` (браузер сам восстановит позицию для traverse и прокрутит к верху/якорю для push) вместо scrollTo(0,0); в fallback-пути — сохранять [scrollX, scrollY] в history.state перед pushState и восстанавливать после popstate-swap. (3) `document.startViewTransition({ update: run, types: [nav.navigationType === 'traverse' ? 'back' : 'forward'] })` с фолбэком на старую сигнатуру — CSS `:active-view-transition-type(back)`. (4) status ≥ 400: рендерить как есть (страница ошибки сервера), но `aegis:load` получает detail.status; не кэшировать в pageCache. (5) `focusReset: 'after-transition'` явно в intercept (дефолт спеки, но фиксируем контракт).

**Алгоритм:**

```js
const fetchPage = async (url, init = {}) => {
    const key = init.method ? null : url;
    if (key && pageCache.has(key)) return pageCache.get(key);
    const p = request(url, { ...init, raw: true, headers: { Accept: 'text/html', ...(init.headers || {}) } })
        .then(async r => ({ html: await r.text(), url: r.url, redirected: r.redirected, status: r.status, ct: r.headers.get('content-type') || '', response: r }));
    if (key) { pageCache.set(key, p); p.then(res => { if (res.status >= 400 || res.redirected) pageCache.delete(key); }); setTimeout(() => pageCache.delete(key), 5000); }
    return p;
};
const visit = async (url, { init, signal, replace = false, nav = null, html: pre = null } = {}) => {
    const el = rootEl(); if (!el) return false;
    pending.value = true;
    document.dispatchEvent(new CustomEvent('aegis:visit', { detail: { url } }));
    try {
        const res = pre ? { html: pre, url, status: 200, ct: 'text/html' } : await fetchPage(url, init);
        if (signal && signal.aborted) return false;
        if (!/text\/html/.test(res.ct)) { location.assign(url); return false; }
        // Редирект сервера: сначала честный URL, потом DOM — без второго запроса
        if (res.redirected && _sameOrigin(res.url) && new URL(res.url).href !== new URL(url, location.href).href) {
            if (hasNav) { navigation.navigate(res.url, { history: 'replace', info: { aegisHtml: res.html } }); return true; }
            history.replaceState(history.state, '', res.url);
        }
        const doc = new DOMParser().parseFromString(res.html, 'text/html');
        const next = doc.querySelector(typeof root === 'string' ? root : _selectorFor(el));
        if (!next) { location.assign(url); return false; }
        const run = async () => {
            /* head-merge — см. №4 */
            await swap(el, next, { mode, hydrate: true });
            if (scroll !== 'preserve') { if (nav) nav.scroll(); else if (!replace) window.scrollTo(0, 0); else if (history.state && history.state.aegisScroll) window.scrollTo(...history.state.aegisScroll); }
            document.dispatchEvent(new CustomEvent('aegis:load', { detail: { url: res.url || url, status: res.status } }));
        };
        if (transition && !_motionOff() && document.startViewTransition && document.visibilityState !== 'hidden') {
            const back = nav ? nav.navigationType === 'traverse' : replace;
            let vt; try { vt = document.startViewTransition({ update: run, types: [back ? 'back' : 'forward'] }); } catch (e) { vt = document.startViewTransition(run); }
            vt.ready.catch(() => {}); vt.updateCallbackDone.catch(() => {}); await vt.finished.catch(() => {});
        } else await run();
        return true;
    } catch (e) { console.error('[Aegis] boost:', e); location.assign(url); return false; }
    finally { pending.value = false; }
};
// onNavigate:
//   if (e.info && e.info.aegisHtml) { e.intercept({ scroll: 'manual', focusReset: 'after-transition', handler: () => visit(url.pathname + url.search, { nav: e, html: e.info.aegisHtml }) }); return; }
//   e.intercept({ scroll: 'manual', focusReset: 'after-transition', handler: () => visit(url.pathname + url.search, { init, signal: e.signal, nav: e }) });
// fallback onClick: history.replaceState({ ...history.state, aegisScroll: [scrollX, scrollY] }, ''); history.pushState(null, '', url.href); visit(...)
// fallback onPop: visit(location.pathname + location.search, { replace: true })  // scrollTo из history.state.aegisScroll
```

**API:**

```js
boost(opts) — сигнатура прежняя; внутренний visit(url, { init?, signal?, replace?, nav?: NavigateEvent, html?: string }).
Событие aegis:load: detail { url: string /* финальный URL после редиректа */, status: number }.
CSS-контракт: html:active-view-transition-type(back) ::view-transition-old(root) { … }  /* направление перехода */
В d.ts: boost.visit(url: string): Promise<boolean> без изменений.
```

**Критерий:** test.html (fallback-путь, Navigation API мокается объектом с navigate/addEventListener): (1) мок _config.fetch отдаёт Response с Object.defineProperty(resp, 'redirected', { value: true }) и url '/thanks' для POST /cart → после visit location.pathname (через spy на history.replaceState) === '/thanks', pageCache не содержит '/cart', aegis:load.detail.url === '/thanks'. (2) мок navigation: `navigate` записывает { url, options } → visit при redirected вызывает navigation.navigate('/thanks', { history: 'replace', info: { aegisHtml } }); повторный onNavigate с e.info.aegisHtml НЕ вызывает fetch (счётчик запросов не растёт). (3) nav-мок с navigationType 'traverse' и scroll: spy → после swap вызван nav.scroll() ровно 1 раз и window.scrollTo не вызывался. (4) при поддержке startViewTransition-объекта (feature-detect) types содержит 'back' для traverse. (5) ответ с Content-Type application/json → location.assign (spy), DOM не тронут.

**Источники:** WHATWG HTML — Navigation API: NavigateEvent.intercept({ handler, scroll: 'manual', focusReset }), NavigateEvent.scroll(), navigationType ('push'|'replace'|'reload'|'traverse'), navigation.navigate(url, { history, info }) и передача info; CSS View Transitions Module Level 2 — startViewTransition({ update, types }), :active-view-transition-type(); Turbo 8 — Turbo-Location, восстановление scroll per history entry, рендер 4xx/5xx страниц; Unpoly — up.history и X-Up-Location; Fetch Standard — Response.redirected / Response.url; Chrome Developers «Modern client-side routing: the Navigation API».

### 💎 #74 — head-merge и дрейф ассетов: data-aegis-track="reload" → полная перезагрузка после деплоя, upsert <meta>, seedFrom(doc) для новой страницы

**Impact:** 4 · **Effort:** S · **Size:** +0.3 KB gzip (внутри boost.visit; head: 'merge' — tree-shakeable вместе с boost)

**Сейчас:** boost.visit обрабатывает <head> минимально (aegis_full.js:9378–9381): title всегда, стили только добавляются при head: 'title+styles'. Не сравниваются <script src>/<link href> с версиями бандлов — после деплоя долгоживущая MPA-сессия продолжает работать на старом aegis.js и старых островах, пока пользователь не перезагрузит вкладку (Turbo решает data-turbo-track="reload", Inertia — X-Inertia-Version → 409 + reload, Unpoly — [up-asset] и up:assets:changed). <meta name="description"/theme-color/og:*> и <link rel="canonical"> не обновляются — theme-color влияет на UI браузера, canonical/og — на share-кнопки. Сиды кэша `<script data-aegis-cache>` следующей страницы (:6476) и `<script data-aegis-predict>` подхватываются только если лежат внутри root: swap → hydrate(n) → seedFrom(n) (:3342) видит лишь вставленное поддерево; сиды в <head> или вне <main> теряются, и острова новой страницы делают запрос, который сервер уже отдал в HTML.

**Предложение:** В visit до swap — `_mergeHead(doc, url)`: (1) подпись отслеживаемых ассетов `[data-aegis-track="reload"]` (src/href) у текущего и нового документа; при расхождении — `location.assign(url)` (честная перезагрузка на новую версию; событие aegis:assets-changed cancelable для кастомной логики — например, показать баннер «Доступна новая версия» и перезагрузить при следующем переходе). (2) upsert <meta name|property> и <link rel=canonical|alternate> по ключу; title как сейчас. (3) новые <link rel=stylesheet> добавляются до swap с ожиданием load (≤ 300 мс) — без FOUC; старые не удаляются (как Turbo). (4) `seedFrom(doc)` для всего нового документа до swap — сиды и predict-prior следующей страницы попадают в кэш, острова новой страницы стартуют без запроса. Опция head: 'title' | 'title+styles' | 'merge' (новое, дефолт для новых проектов рекомендовать 'merge').

**Алгоритм:**

```js
const _assetSig = (d) => [...d.querySelectorAll('script[src][data-aegis-track="reload"],link[href][data-aegis-track="reload"]')].map(n => n.getAttribute('src') || n.getAttribute('href')).sort().join('\n');
async function _mergeHead(doc, url, level) {
    if (level === 'merge' && _assetSig(doc) !== _assetSig(document)) {
        if (document.dispatchEvent(new CustomEvent('aegis:assets-changed', { cancelable: true, detail: { url } }))) { location.assign(url); return false; }
    }
    seedFrom(doc);                                                           // сиды и predict-prior новой страницы — до её островов
    document.title = doc.title;
    if (level === 'title') return true;
    const waits = [];
    for (const l of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
        const href = l.getAttribute('href');
        if (document.head.querySelector(`link[rel="stylesheet"][href="${CSS.escape(href)}"]`)) continue;
        const c = l.cloneNode(true); document.head.appendChild(c);
        waits.push(new Promise(r => { c.onload = c.onerror = r; setTimeout(r, 300); }));
    }
    if (level === 'merge') {
        for (const m of doc.head.querySelectorAll('meta[name],meta[property]')) {
            const k = m.hasAttribute('name') ? `meta[name="${CSS.escape(m.getAttribute('name'))}"]` : `meta[property="${CSS.escape(m.getAttribute('property'))}"]`;
            const cur = document.head.querySelector(k);
            if (cur) { if (cur.getAttribute('content') !== m.getAttribute('content')) cur.setAttribute('content', m.getAttribute('content')); }
            else document.head.appendChild(m.cloneNode(true));
        }
        for (const rel of ['canonical', 'alternate']) {
            const nl = doc.head.querySelector(`link[rel="${rel}"]`), cl = document.head.querySelector(`link[rel="${rel}"]`);
            if (nl && cl) cl.setAttribute('href', nl.getAttribute('href')); else if (nl) document.head.appendChild(nl.cloneNode(true)); else if (cl) cl.remove();
        }
    }
    if (waits.length) await Promise.all(waits);
    return true;
}
// visit.run(): if (!(await _mergeHead(doc, url, head))) return;  // вместо блока :9378–9381
// Сервер: <script type="module" src="/static/app.3f9c1.js" data-aegis-track="reload"></script>  (Django ManifestStaticFilesStorage / Rails asset digest / Vite manifest дают хэш в имени)
```

**API:**

```js
boost({ head?: 'title' | 'title+styles' | 'merge' | false })   // 'merge' — новое
// HTML-контракт: <script src data-aegis-track="reload">, <link rel=stylesheet data-aegis-track="reload">
// Событие: document 'aegis:assets-changed' (cancelable; detail { url }) — preventDefault отменяет автоперезагрузку
// seedFrom(root: Document | Element) — сигнатура прежняя; теперь вызывается для всего нового документа при boost
```

**Критерий:** test.html: (1) в sandbox-документе head содержит <script data-aegis-track="reload" src="/app.v1.js">; мок страницы отдаёт тот же скрипт с /app.v2.js → visit вызывает location.assign (spy) и не трогает DOM; при preventDefault на aegis:assets-changed — swap выполняется, assign не вызывается. (2) мок отдаёт <meta name="theme-color" content="#000"> и <link rel=canonical href="/b"> → после visit document.head.querySelector('meta[name=theme-color]').content === '#000' (обновлён, не задублирован), canonical.href оканчивается на /b. (3) мок отдаёт в <head> `<script type="application/json" data-aegis-cache="/api/x">{"v":1}</script>`, а в <main> остров с resource('/api/x') → после visit cache.get('/api/x').data.v === 1 и счётчик fetch к /api/x === 0.

**Источники:** Turbo 8 — data-turbo-track="reload" и слияние <head> (turbo:before-render, merge of stylesheets/meta); Inertia.js — X-Inertia-Version и 409 Conflict → full reload; Unpoly — [up-asset], up:assets:changed; Django ManifestStaticFilesStorage / Rails Sprockets & Propshaft digests / Vite manifest.json (хэш в имени файла как версия); HTML Living Standard — <meta name/property>, <link rel=canonical>; Open Graph protocol (og:* обновляются при клиентской навигации).

### 💎 #75 — wireForm: HTML-ответ 422/200 с перерисованной формой — morph формы на место и сбор ошибок из DOM (контракт Django/Rails без JSON)

**Impact:** 5 · **Effort:** M · **Size:** +0.4 KB gzip (внутри wireForm §25, tree-shakeable вместе с ней)

**Сейчас:** serverSubmit (aegis_full.js:7261–7295) шлёт Accept: application/json, text/html;q=0.9 (:7270), но HTML умеет обрабатывать только как редирект (:7274–7279). Ответ 422 с text/html (Rails: render :new, status: :unprocessable_entity — обязательное поведение для Turbo; Laravel без JSON) проходит _parseBody → строка → ветка `!response.ok` даёт errors.$form = 'HTTP 422' (:7289): серверная разметка с ошибками по полям выбрасывается. Django по умолчанию отвечает 200 с формой и <ul class="errorlist"> — считается успехом (:7291–7292), onSuccess вызывается с HTML-строкой. Т.е. базовый серверный сценарий трёх крупнейших фреймворков без JSON-API в wireForm сейчас не работает, хотя morph (:9217) и поиск errorEl по `#{name}-error` / .error / [data-error] (:7166–7167) уже есть.

**Предложение:** В serverSubmit: если ответ text/html и не редирект — распарсить, найти форму (по id формы, иначе по action, иначе первая <form>), `swap(formEl, next, { mode: 'morph', hydrate: false })` — те же <input> (по id/позиции), значение активного поля и фокус пользователя сохранены, серверные ошибки уже в DOM; затем `harvestErrors()` читает ошибки из DOM в errors[key]/$form: `#{key}-error`, `[data-error-for=key]`, `.aegis-field-error`, а также Django `.errorlist` / Bootstrap `.invalid-feedback` / Rails `.field_with_errors + …` в ближайшем контейнере поля; ошибки формы — `.errorlist.nonfield`, `[data-error-for="$form"]`, `[role=alert]`. Результат { ok: !hasErrors, status, html: true }. Поиск errorEl для каждого поля становится ленивым (функция `_errorElFor(key)`), чтобы после morph не держать ссылку на удалённый узел и заново создавать span, если сервер его не отрисовал. 200 без редиректа и без ошибок → ok (форма-фильтр). Заголовки запроса Aegis-Request/Aegis-Target (см. №1) позволяют серверу отдать только <form> вместо всей страницы.

**Алгоритм:**

```js
// внутри wireForm: ленивый errorEl (заменяет const errorEl :7166–7176)
const _errorEls = {};
const _errorElFor = (key) => {
    let el = _errorEls[key];
    if (el && el.isConnected) return el;
    const input = _inputs[key];
    el = formEl.querySelector(`#${CSS.escape(key + '-error')}, [data-error-for="${CSS.escape(key)}"]`) || input.parentElement?.querySelector('.error, .field-error, [data-error], .errorlist, .invalid-feedback');
    if (!el) { el = document.createElement('span'); el.id = `${key.replace(/[^\w-]/g, '_')}-error`; el.className = 'aegis-field-error'; el.setAttribute('role', 'status'); input.parentNode?.insertBefore(el, input.nextSibling); }
    input.setAttribute('aria-describedby', el.id);
    return (_errorEls[key] = el);
};
// эффект a11y (:7178): const errorEl = _errorElFor(key); … как раньше

/** Ошибки из серверной разметки → сигналы (после morph формы) */
const harvestErrors = () => {
    let any = false;
    batch(() => {
        for (const key of Object.keys(fields)) {
            const el = _errorElFor(key);
            const msg = (el.textContent || '').trim() || (_inputs[key].getAttribute('aria-invalid') === 'true' ? _inputs[key].validationMessage : '');
            errors[key].value = msg || null;
            if (msg) { touched[key].value = true; any = true; }
        }
        const f = formEl.querySelector('.errorlist.nonfield, [data-error-for="$form"], [role="alert"]');
        errors.$form.value = f && f.textContent.trim() ? f.textContent.trim() : null;
        if (errors.$form.peek()) any = true;
    });
    return any;
};
// serverSubmit, после проверки redirected (:7274–7279):
if (ct.includes('text/html')) {
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const sel = formEl.id ? '#' + CSS.escape(formEl.id) : formEl.getAttribute('action') ? `form[action="${CSS.escape(formEl.getAttribute('action'))}"]` : 'form';
    const next = doc.querySelector(sel) || doc.querySelector('form');
    if (!next) { errors.$form.value = `HTTP ${response.status}`; return { ok: false, status: response.status, data: null }; }
    await swap(formEl, next, { mode: 'morph', hydrate: false });          // формы — тот же узел; значения, фокус и каретка пользователя целы
    const bad = harvestErrors() || !response.ok;
    if (bad) { announce(errors.$form.peek() || _msg('formInvalid'), 'assertive'); const k = Object.keys(fields).find(k => errors[k].peek()); if (k) _inputs[k].focus(); }
    else if (sopts.onSuccess) sopts.onSuccess(null, response);
    return { ok: !bad, status: response.status, data: null, html: true };
}
// Rails: render :new, status: :unprocessable_entity  · Django: стандартный form_invalid (200) с {{ form.errors }} · Laravel: back()->withErrors() → 302 на форму: redirected && HTML → тот же путь через swap (не location.assign), если response.url совпадает с текущим путём
```

**API:**

```js
wireForm(formEl, opts).submit() / submit({ as, headers, onSuccess, onRedirect, html?: 'morph' | 'ignore' })   // html: 'morph' — дефолт: HTML-ответ морфится в форму
// Возвращаемое: { ok: boolean; status: number; data: unknown; redirected?: boolean; html?: true }
// HTML-контракт ошибок (любой из): id="{name}-error" · data-error-for="{name}" · .errorlist / .invalid-feedback / .error рядом с полем · для формы: .errorlist.nonfield / data-error-for="$form" / [role=alert]
// d.ts: SubmitOptions { html?: 'morph' | 'ignore' } ; SubmitResult { html?: true }
```

**Критерий:** test.html: (1) форма #signup с email/password; mockFetch на POST отвечает 422 text/html: `<form id="signup" …><input name="email" id="id_email" value="a@b"><ul class="errorlist"><li>Already taken</li></ul>…</form>` → после await submit(): f.errors.email.value === 'Already taken', input[name=email] — тот же узел, что до submit (identity), aria-invalid === 'true', aria-describedby указывает на элемент с текстом ошибки; result.ok === false, result.html === true. (2) пользователь во время запроса печатает в password (activeElement) → значение поля после morph не затёрто серверным. (3) ответ 200 text/html с формой без ошибок → ok === true, onSuccess вызван. (4) ответ 200 text/html с `.errorlist.nonfield` → errors.$form заполнен, announce получил текст (spy на live-region). (5) регресс: JSON 422 { errors: {...} } — поведение прежнее (тесты «формы 2.0» проходят).

**Источники:** Turbo (Hotwire) — контракт форм: 422 Unprocessable Entity → рендер ответа на месте, 3xx → переход; Rails Guides — form_with, field_with_errors, render status: :unprocessable_entity; Django — Form.errors, <ul class="errorlist">, non_field_errors (класс nonfield), FormView.form_invalid (200); Laravel — @error/.is-invalid + .invalid-feedback (Bootstrap), back()->withErrors(); idiomorph/Turbo 8 morph — сохранение полей ввода при морфе; WAI-ARIA APG — aria-invalid + aria-describedby и role=alert для ошибок форм; HTML Living Standard — Constraint Validation API (validationMessage).

### 💎 #76 — morph 2.0: id-set матчинг детей (idiomorph) + data-aegis-permanent для видео/карт/виджетов + фикс приоритета для checkbox

**Impact:** 4 · **Effort:** M · **Size:** +0.4 KB gzip (внутри _morph §34, tree-shakeable вместе со swap)

**Сейчас:** _morph (aegis_full.js:9217–9268) сопоставляет детей так: по id (:9251), иначе «ближайший по позиции узел того же тега без id» (:9254–9256). Элемент без собственного id, но содержащий узлы с id (типичное `<li><input id="qty-7">` или `<tr><td><input id=…>`), матчится по позиции: вставка новой строки в начало списка приводит к морфу старого li[0] в новый li[0], input #qty-7 внутри теряет узел (пересоздаётся), фокус и набранный текст пропадают, CSS-переходы срываются. idiomorph (ядро Turbo 8 morph и htmx-ext-idiomorph) решает это «id sets»: для каждого элемента множество id потомков, кандидат выбирается по пересечению. Нет и аналога data-turbo-permanent / hx-preserve / phx-update="ignore": <video>, <iframe>, карта, виджет платежа, сторонний скрипт — пересоздаются или их атрибуты/дети перетираются; для островов Aegis это решено (data-aegis-live :9227–9241), для не-островов — нет. Побочно: строка :9246 `if ('checked' in from && 'checked' in to && from.type === 'checkbox' || from.type === 'radio')` из-за приоритета && над || для radio выполняется даже без проверки `'checked' in to`.

**Предложение:** (1) Перед морфом корня один раз посчитать `idSets` для старого и нового поддеревьев (Map<Element, Set<id>>, только у элементов, имеющих потомков с id — обычно малая доля), передавать вниз по рекурсии; при выборе кандидата без id предпочитать узел того же тега с непустым пересечением idSet (жадно первый с пересечением, как в idiomorph), иначе — как сейчас, узел без id-потомков. (2) `data-aegis-permanent` (требует id, как в Turbo): при морфе `from` с этим атрибутом и совпадающим id — вернуть from без изменений; в режимах inner/outer swap перед destroyAll перенести permanent-узлы старого поддерева в новое по id (`slot.replaceWith(old)`), чтобы <video> продолжил играть, а Stripe/Maps iframe не перезагрузился. (3) Исправить приоритет на :9246: `if (('checked' in from) && ('checked' in to) && (from.type === 'checkbox' || from.type === 'radio') && from !== document.activeElement)`.

**Алгоритм:**

```js
/** Множества id потомков для элементов поддерева (только те, у кого есть id-потомки) */
function _idSets(root) {
    const m = new Map();
    for (const el of root.querySelectorAll('[id]')) for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) { let s = m.get(p); if (!s) m.set(p, s = new Set()); s.add(el.id); }
    return m;
}
const _shareIds = (a, b, sa, sb) => { const x = sa.get(a), y = sb.get(b); if (!x || !y) return false; for (const id of y) if (x.has(id)) return true; return false; };
function _morph(from, to, ids = null) {
    ids = ids || { from: _idSets(from), to: _idSets(to) };
    if (from.nodeType === 1 && from.hasAttribute('data-aegis-permanent') && from.id && from.id === to.id) return from;   // виджет живёт своей жизнью
    /* … как сейчас до детей … */
    const oldById = new Map();
    for (const c of from.childNodes) if (c.nodeType === 1 && c.id) oldById.set(c.id, c);
    let cursor = from.firstChild;
    for (const nk of [...to.childNodes]) {
        let match = null;
        if (nk.nodeType === 1 && nk.id) match = oldById.get(nk.id) || null;
        else {
            let fallback = null;
            for (let c = cursor; c; c = c.nextSibling) {
                if (c.nodeType !== nk.nodeType || (c.nodeType === 1 && (c.tagName !== nk.tagName || c.id))) continue;
                if (c.nodeType !== 1) { match = c; break; }
                if (_shareIds(c, nk, ids.from, ids.to)) { match = c; break; }          // общий id-потомок — это «тот же» элемент
                if (!fallback && !ids.from.has(c) && !ids.to.has(nk)) fallback = c;      // оба без id-потомков — позиционный кандидат
            }
            match = match || fallback;
        }
        if (match) { if (match !== cursor) from.insertBefore(match, cursor); _morph(match, nk, ids); cursor = match.nextSibling; }
        else from.insertBefore(nk, cursor);
    }
    while (cursor) { const next = cursor.nextSibling; if (cursor.nodeType === 1) destroyAll(cursor); cursor.remove(); cursor = next; }
    return from;
}
// swap(), режимы inner/outer — до destroyAll(target):
//   for (const p of target.querySelectorAll('[data-aegis-permanent][id]')) { const slot = nodes.map(n => n.nodeType === 1 ? (n.id === p.id ? n : n.querySelector('#' + CSS.escape(p.id))) : null).find(Boolean); if (slot) slot.replaceWith(p); }
// :9246 → if (('checked' in from) && ('checked' in to) && (from.type === 'checkbox' || from.type === 'radio') && from !== document.activeElement) from.checked = to.checked;
```

**API:**

```js
// HTML-контракт: <div id="player" data-aegis-permanent>…</div> — узел с id переживает swap/morph/boost без изменений (дети, атрибуты, состояние медиа)
// swap(target, html, { mode: 'morph' }) — сигнатура прежняя; матчинг детей стал id-set-aware автоматически
// d.ts (комментарий к SwapMode 'morph'): «дети сопоставляются по id, затем по общим id-потомкам (id sets), затем по позиции; [data-aegis-permanent][id] не трогается»
```

**Критерий:** test.html: (1) `<ul id="l"><li><input id="a"></li><li><input id="b"></li></ul>`, фокус в #a с набранным 'typed'; morph в `<ul id="l"><li>new</li><li><input id="a"></li><li><input id="b"></li></ul>` → document.getElementById('a') — тот же узел (identity), document.activeElement === a, a.value === 'typed', li.length === 3 (сейчас падает: #a пересоздаётся). (2) `<div id="map" data-aegis-permanent data-x="1"><span>state</span></div>` внутри #main; swap(main, '<div id="main"><div id="map" data-x="2"></div><p>after</p></div>', { mode: 'morph' }) и отдельно { mode: 'inner' } → в обоих случаях #map — прежний узел, содержит <span>state</span>, data-x === '1'; <p>after</p> появился. (3) radio-группа: morph, где `to` — тот же тег без изменения checked, при активном radio (activeElement) checked не сбрасывается. (4) бенч в demo/admin: morph таблицы 1000 строк с вставкой одной строки в начало — 0 пересозданных <input> (MutationObserver считает addedNodes типа INPUT === 1), время ≤ 1.3× текущего.

**Источники:** idiomorph (bigskysoftware) — README «id sets» и алгоритм matching (isIdSetMatch / findIdSetMatch); Turbo 8 — page refresh with morphing, data-turbo-permanent (требует id); htmx — hx-preserve и extension idiomorph; Phoenix LiveView — phx-update="ignore"; morphdom — getNodeKey/onBeforeElUpdated; DOM Standard — сохранение состояния HTMLMediaElement/iframe только при неизменной идентичности узла.

## 🔭 resumability-serialization

**Линза:** Резюмируемость и сериализация состояния: можно ли не выполнять setup при гидрации (Qwik-подобный resume) для части островов, сериализация сигналов/reactive()-состояния в HTML и восстановление с сохранением идентичности, передача состояния между страницами при boost/swap (persisted(), история), snapshot/restore для BFCache и Navigation API (pageswap/pagereveal), дедупликация состояния между островами (provide/inject через DOM), стриминг данных (streamResource + data-aegis-cache), «замороженные» острова. Оцени реалистичность для zero-build движка без компилятора. Сравни с Qwik, Marko 6 tags API, Astro server islands, Angular hydration/transfer state, Nuxt payload, Solid Start seroval.

**Вывод:** Aegis уже закрывает «исход» Qwik-резюмируемости без компилятора лучше большинства island-движков: стратегии с аргументами (visible/idle/interaction/media, aegis_full.js:3413-3474) с переигрыванием разбудившего события (3436-3452), zero-JS регистрация data-aegis-src (3350-3355), seedFrom() как нулевой запрос (6480), adopt() без мутаций (9563), morph-осведомлённые острова (9227-9236), inject() по DOM-предкам (894-918) и time-slicing eager-части (3490-3497) — у Astro client:*-директив и Marko 6 этого набора нет. Отстаёт в четырёх местах: (1) гидрация — это перерисовка: component().place() делает el.replaceChildren(r) (3106-3107), серверный DOM выбрасывается, а injectStyles даже скрывает pending-острова (5530), тогда как Solid/Svelte/Vue/Preact «захватывают» готовые узлы; (2) нет непрерывности состояния: morph при смене data-* уничтожает остров (9235), swap/boost/назад-вперёд стартуют с нуля — нет аналога Astro transition:persist, Turbo data-turbo-permanent, Nuxt payload/useState, Navigation API entry.key не используется; (3) контекст требует смонтированного родителя (901-907, подсказка E022 «сделайте родителя eager», 913) — нет TransferState/payload из HTML; (4) нет протокола стриминга/out-of-order (Astro server islands, Marko <await>, React $RC) и нет ни одного обработчика pagehide/pageshow/freeze/pagereveal (BFCache-совместимость и кросс-документные View Transitions). Настоящая Qwik-резюмируемость (не выполнять setup, сериализовать замыкания) без компилятора нереалистична — но «замороженный остров» = interaction + claim-гидрация + контекст из HTML даёт ~80% результата при нуле инструментов сборки.

**Отвергнуто:** 1) Qwik-style QRL без компилятора (`data-aegis-on="click:./cart.js#add"`, глобальный делегат, import по событию): замыкания нельзя извлечь без компилятора, ручные экспорты ≈ уже существующий `data-aegis-load="interaction"` + `data-aegis-src` (3350-3355, 3436-3452); выигрыш — только отсутствие обёртки-острова, не стоит новой семантики. 2) Полная сериализация графа сигналов в HTML (`<script type="aegis/json">` как qwik/json) с восстановлением по порядку создания: без компилятора нет стабильных id сигналов, условное создание ломает порядок; per-key стэш через `ctx.state()`/`reactive().$snapshot()` (4735) покрывает практические случаи. 3) SSR html``-шаблонов в Node (lit-ssr/Enhance-подход) — нарушает zero-build и языко-нейтральность сервера. 4) `persisted()` как механизм непрерывности между страницами — localStorage глобален, JSON-копия без идентичности, течёт между вкладками/сессиями, не привязан к записи истории (4280-4316). 5) Обработка prerendering — уже есть (3466-3469). 6) Стратегии visible/idle/interaction/media, replay, props types, data-aegis-props, hydrate({watch}), speculate() — сделано. 7) Кросс-вкладочная синхронизация состояния островов (BroadcastChannel/Web Locks) — покрыто кэш-фазой 6, persisted() уже слушает storage. 8) Приоритизация гидрации по checkVisibility — фаза 7 кэша и стратегия visible. 9) Declarative Shadow DOM для островов — линза стилей, не гидрации; element() есть. 10) Держать SSE/стримы открытыми ради «мгновенного возврата» вместо suspend — делает страницу неэлигибельной для BFCache, ровно обратный эффект.

### 💎 #77 — Claim-гидрация: html`` захватывает серверный DOM без перерисовки

**Impact:** 5 · **Effort:** M · **Size:** +0.5 KB gzip (расширение adopt() и 15 строк в component()); tree-shakeable вместе с adopt

**Сейчас:** component().place() при возврате шаблона делает el.replaceChildren(r) (aegis_full.js:3106-3107): серверная разметка, которую пользователь уже видит (фокус, выделение, CSS-анимации, позиция скролла), выбрасывается и создаётся заново из html`` — O(узлов) DOM-аллокаций и риск сдвига/мигания; чтобы скрыть это, injectStyles прячет pending-острова целиком (`[data-aegis-state="pending"]{visibility:hidden}`, 5530) — т.е. сервер отрендерил HTML, а движок его не показывает. adopt() (9563-9612) умеет привязать шаблон к готовому DOM с 0 мутаций, но это отдельный ручной API (adopt(el)`…` вместо return html``), текст обязан быть единственным ребёнком (9583-9586), реактивные «дырки» (${() => …}, show/list) не поддержаны, несовпадение — E024 и молчаливый пропуск части. Solid/Svelte 5/Vue/Preact при гидрации «захватывают» существующие узлы; Qwik не рендерит вовсе; Marko 6 резюмирует. Aegis — единственный, кто перерисовывает.

**Предложение:** Режим claim: `island(name, C, { claim: true })` или серверный атрибут `data-aegis-claim` (сервер решает — он знает, что разметка совпадает с шаблоном). В component() ctx.html становится обёрткой: первый синхронный вызов html`` в setup при наличии серверных детей идёт через `_claim(el, strings, values)` — расширенный adopt: (а) текст с соседями — через серверный comment-маркер `<!--$-->` (как Vue/Solid) или обёртку; (б) функциональные/show/list-дырки — локальная замена только этой дырки (`_insertDynamic` на новом Text-маркере между серверными маркерами, серверные узлы дырки удаляются) — весь остальной DOM сохраняется; (в) несовпадение структуры → `_claim` возвращает null, обёртка падает в обычный html`` (сегодняшний replaceChildren) и один раз пишет E045 «hydration mismatch: expected <span> at 0/1, found <b>» с путём; (г) place(): `r === el` → ничего не делать. Правило скрытия в injectStyles сужается до `[data-aegis-state="pending"]:not([data-aegis-claim])` — серверный HTML claim-островов виден до гидрации. Первый проход пишет значения через _setText (9552) только при отличии — как сегодня в adopt без trust.

**Алгоритм:**

```js
// component(el, setup, copts) — ctx.html для claim-островов
let claimed = false;
const claim = copts && copts.claim || el.hasAttribute('data-aegis-claim');
const chtml = !claim ? html : (strings, ...values) => {
    if (claimed || !el.firstElementChild) return html(strings, ...values);
    claimed = true;
    const r = _claim(el, strings, values);        // null → структура не совпала
    return r || html(strings, ...values);         // fallback = сегодняшнее поведение
};
// place(): if (r === el) return { el, destroy: () => destroy(el) };

// _claim — adopt() 9563 с тремя расширениями
function _claim(rootEl, strings, values) {
    let template = _templateCache.get(strings);
    if (!template) { template = _parseTemplate(strings); _templateCache.set(strings, template); }
    // 1. сухая проверка структуры: все elPath разрешаются в элементы нужного тега
    for (const part of template.parts) {
        if (part.elPath && !_resolvePath(rootEl, part.elPath, part.tag)) {
            _warn('E045', { what: `hydrate("${rootEl.dataset.aegis}"): server HTML does not match the template at ${part.elPath.join('/')} (expected <${part.tag}>).`,
                why: 'The island falls back to a full client render — server DOM is replaced.', fix: 'Keep the server partial and the template in sync, or drop data-aegis-claim.', el: rootEl }, 'claim:' + rootEl.dataset.aegis);
            return null;
        }
    }
    // 2. привязки на живых узлах
    for (const part of template.parts) {
        const real = part.elPath ? _resolvePath(rootEl, part.elPath, part.tag) : rootEl;
        if (part.kind === 0) { _applyAttrBinding(real, part, values); continue; }      // атрибуты/события/props
        if (part.kind === 1) { _applyRef(real, values[part.index], part.index); continue; }
        const v = values[part.index];
        if (part.sole && !(typeof v === 'function' && !isSignal(v))) { _bindClaimText(real, v); continue; }   // сигнал/строка — единственный ребёнок
        // 3. дырка с соседями или реактивный узел: якорь по серверному маркеру <!--$-->…<!--/-->, иначе локальная перерисовка дырки
        const hole = _serverHole(real, part);                     // { start, end } comment-узлы или null
        const marker = document.createTextNode('');
        if (hole) { hole.start.after(marker); _removeBetween(hole.start, hole.end); hole.start.remove(); hole.end.remove(); }
        else real.appendChild(marker);                            // сервер не разметил дырку — рендерим её на клиенте
        _insertDynamic(marker, v);
    }
    return rootEl;
}
function _bindClaimText(el, v) {
    if (isSignal(v) || typeof v === 'function') effect(() => _setText(el, _str(isSignal(v) ? v.value : v())), 'claim:text');
    else _setText(el, _str(v));
}
```

**API:**

```js
island(name, Component, { types?, claim?: boolean })
register(name, setup, { types?, claim?: boolean })
// HTML: <div data-aegis="likes" data-aegis-claim>…серверная разметка, совпадающая с шаблоном…</div>
// Маркер дырки с соседями (опционально, как Vue/Solid): <!--$-->12<!--/-->
// d.ts: interface IslandOptions<T> { types?: T; claim?: boolean }
// Новый код: E045 hydration mismatch (ERRORS.md), hydrate handle получает h.claimed: boolean
```

**Критерий:** test.html: (1) server = '<div data-aegis="cl" data-aegis-claim><span class="v">SSR</span><button>+</button></div>', island('cl', ({html, signal}) => { const n = signal(3); return html`<span class="v">${n}</span><button @click=${() => n.value++}>+</button>`; }); MutationObserver(childList, subtree) на хосте → после hydate() `records.length === 0`, `host.querySelector('span') === spanBefore`, `span.textContent === '3'`; фокус на button до гидрации остаётся `document.activeElement === btn`; click → '4'. (2) Несовпадение: сервер даёт `<b>` вместо `<span>` → ровно одно E045 (onWarn), но остров отрендерен fallback-ом: `span.v` существует с текстом '3'. (3) Дырка с соседями `<li>${n} likes</li>` без серверных маркеров → только `<li>` получает мутации, `<button>` тот же узел. Измерение в demo/admin.html: Performance-трек — время гидрации 40 островов-таблиц вдвое меньше, LCP-элемент не пересоздаётся (нет второй LCP-записи).

**Источники:** Solid hydration (getNextElement/claim), Svelte 5 hydrate() с `<!--[-->` маркерами, Vue 3 runtime-core hydrate + «Hydration node mismatch», Preact hydrate(), React 18 «Hydration failed» и recoverable errors, Qwik resumability paper (Miško Hevery), Marko 6 tags API resume; WHATWG comment nodes как якоря; существующий adopt() 9563-9612 и _compileParts.elPath/sole 1856-1906

### 💎 #78 — Непрерывность острова: props-patch вместо remount, data-aegis-permanent и стэш состояния по записи истории

**Impact:** 5 · **Effort:** M · **Size:** +0.7 KB gzip (стэш ~30 строк, morph-ветка ~10, permanent ~12, pagehide/pagereveal ~10); стэш и permanent tree-shakeable вместе с swap/boost

**Сейчас:** _morph для живого острова при любом изменении data-* делает destroy → replaceChildren(to.childNodes) → hydrate (aegis_full.js:9235): внутреннее состояние (раскрытый аккордеон, черновик, позиция virtualScroll, летящие resource) гибнет ради обновления одного числа — хотя island() уже создаёт реактивный props (`reactive({...data},{shallow:true})`, 3297), специально для обновлений, но никуда его не сохраняет. boost().visit (9368-9385) морфит <main>: острова внутри с изменившимися props теряют состояние, ушедшие со страницы — всё; при «назад» (server-first MPA) остров стартует с серверного HTML. `data-aegis-ignore` (3348) останавливает только hydrate — morph всё равно переписывает поддерево (видео, карта, сторонний виджет). Роутер хранит state в navigation.currentEntry (8131, 8348-8352), но острова к нему не подключены; persisted() (4280) — глобальный localStorage, не привязан к записи истории. Аналоги: Astro transition:persist / transition:persist-props, Turbo data-turbo-permanent, Nuxt useState/payload, Angular RouteReuseStrategy, Navigation API entry.key (стабилен при reload, traverse, BFCache).

**Предложение:** Три уровня одного контракта: (1) в _morph, если у острова есть реактивный props (WeakMap `_propsOf`, заполняется в island()), новые data-* применяются `$patch`-ом в batch — ноль remount; для register() с позиционным data — старое поведение. (2) `data-aegis-permanent` (нужен id): в _morph узел с таким id сохраняется как есть (без обхода детей), в остальных режимах swap старые permanent-узлы подменяют одноимённые новые (алгоритм Turbo). (3) `ctx.state(key, initial)` — сигнал, зарегистрированный в стэше острова; ключ острова = `data-aegis-key` || `name#id`; при уничтожении острова из swap/morph/destroyAll значения складываются в модульный `_stash` (Map, LRU 100) и при следующем монтировании того же ключа `ctx.state()` стартует из стэша (для reactive() — `$snapshot()/$patch()`). На `pagehide` стэш (только острова с data-aegis-key) сериализуется в sessionStorage под `navigation.currentEntry.key` (fallback: history.state.__aegisKey), на `pagereveal`/`pageshow` читается по `navigation.activation.entry.key` — «назад» в MPA восстанавливает фильтры, раскрытые строки, скролл-офсеты.

**Алгоритм:**

```js
// island(): const props = reactive({ ...data }, { shallow: true }); _propsOf.set(el, props);
// _morph 9227: живой остров
if (from.hasAttribute('data-aegis-live') && to.getAttribute('data-aegis') === from.getAttribute('data-aegis')) {
    if (to.hasAttribute('data-aegis-permanent')) return from;              // сервер не трогает permanent-узлы
    …синхронизация атрибутов как сейчас…
    if (changed) {
        const rp = _propsOf.get(from);
        if (rp) {
            const next = _islandProps(to, to.getAttribute('data-aegis'));
            batch(() => { for (const k of Object.keys(rp.$raw)) if (!(k in next)) delete rp[k]; rp.$patch(next); });   // без remount
        } else { destroy(from); from.replaceChildren(...to.childNodes); hydrate(from, { quiet: true }); }
    }
    return from;
}
// swap(), режимы inner/outer: permanent-узлы переживают замену
const perm = new Map(); for (const p of target.querySelectorAll('[data-aegis-permanent][id]')) perm.set(p.id, p);
…вставка…
for (const n of inserted) for (const p of (n.nodeType === 1 ? n.querySelectorAll('[data-aegis-permanent][id]') : [])) { const old = perm.get(p.id); if (old) p.replaceWith(old); }

// Стэш состояния
const _stash = new Map();                                   // islandKey → { k: value }
const _islandKey = (el) => el.dataset.aegisKey || (el.id ? el.dataset.aegis + '#' + el.id : null);
// в hydrate.finish(): ctx.state
const ikey = _islandKey(el), saved = ikey && _stash.get(ikey), live = {};
ctx.state = (k, initial) => {
    const sig = signal(saved && k in saved ? saved[k] : initial, 'state:' + k);
    live[k] = sig; return sig;
};
scope.onDispose(() => { if (!ikey || !Object.keys(live).length) return; const snap = {}; for (const k in live) snap[k] = live[k].peek(); _stash.set(ikey, snap); if (_stash.size > 100) _stash.delete(_stash.keys().next().value); });
// pagehide / pagereveal (один listener на модуль)
const _entryKey = () => (typeof navigation !== 'undefined' && navigation.currentEntry && navigation.currentEntry.key) || null;
on(window, 'pagehide', () => { for (const [el] of _components) { const k = _islandKey(el); if (k && el.dataset.aegisKey) _flushLive(el); }   // снять живые
    const k = _entryKey(); if (k) try { sessionStorage.setItem('aegis:stash:' + k, JSON.stringify([..._stash])); } catch (e) {} });
const _restore = () => { const k = (typeof navigation !== 'undefined' && navigation.activation && navigation.activation.entry.key) || _entryKey(); if (!k) return;
    try { for (const [ik, v] of JSON.parse(sessionStorage.getItem('aegis:stash:' + k) || '[]')) _stash.set(ik, v); } catch (e) {} };
_restore();   // до первого hydrate(document)
```

**API:**

```js
ctx.state<T>(key: string, initial: T): Signal<T>     // в SetupContext островов; восстанавливается из стэша по data-aegis-key
// HTML: <div data-aegis="orders" data-aegis-key="orders:42">, <video id="player" data-aegis-permanent>
hydrate.stash(): Record<string, object>              // снимок для тестов/DevTools
hydrate.restore(stash: Record<string, object>): void
swap(target, html, { mode, permanent?: boolean /* default true */ })
// island(): props теперь патчатся при morph — без remount (документировать в README «morph patches props in place»)
```

**Критерий:** test.html: (1) island('cnt', ({props, signal, html}) => { const open = signal(true); return html`<b>${() => props.count}</b>`; }, { types: { count: Number } }); host с data-count="5" → swap(host, '<div data-aegis="cnt" data-count="6"></div>', {mode:'morph'}) → `b.textContent === '6'`, `mounts === 1`, `b === bBefore`. (2) `<div id="player" data-aegis-permanent>` внутри target → после swap(target, newHtml, {mode:'inner'}) `document.getElementById('player') === before`, и после {mode:'morph'} тоже. (3) register('acc', (el, d, { state }) => { const open = state('open', false); open.value = true; }); остров с data-aegis-key="a" → swap(host, тот же HTML, {mode:'inner'}) → второе монтирование: `state('open', false).peek() === true`; `hydrate.stash()['a'].open === true`; после `dispatchEvent(new Event('pagehide'))` sessionStorage содержит ключ `aegis:stash:` + (navigation.currentEntry.key || 'legacy'); `hydrate.restore(JSON.parse(...))` + новый hydrate → восстановлено. Измерение в demo: назад-вперёд между списком заказов и деталью — раскрытые строки и фильтр сохраняются (0 повторных fetch благодаря кэшу + стэшу).

**Источники:** Navigation API (WICG, navigation.currentEntry.key / activation.entry.key, updateCurrentEntry), pagereveal/pageswap (HTML LS, Chrome 126+), Astro View Transitions transition:persist / persist-props, Hotwire Turbo data-turbo-permanent и turbo:before-cache, Angular RouteReuseStrategy и TransferState, Nuxt useState()/payload, Remix/React Router location.state и scroll restoration, Marko 6 <let> с key; существующие reactive().$snapshot/$patch (4735-4737)

### 💎 #79 — Контекст из HTML: data-aegis-provide и <script data-aegis-state> → inject() без смонтированного родителя (TransferState)

**Impact:** 4 · **Effort:** S · **Size:** +0.35 KB gzip (ветка в inject ~8 строк, seedFrom +10 строк, createContext name); в ядре (inject) ~120 B

**Сейчас:** inject() (aegis_full.js:894-918) ищет значение по scope-цепочке, затем по DOM-предкам, но только через _components (901-907) — родитель обязан быть смонтированным островом. Для ленивого родителя (visible/idle) E022 предлагает «сделайте родителя eager» (913): чтобы передать строку темы, движок просит загрузить больше JS. Глобальный контекст (_globalCtx, 873) наполняется только provide() из JS. Сервер знает user/locale/theme/tenant/флаги, но передать их островам с нулём JS можно лишь через data-*/data-aegis-props каждого острова (3195-3210): N копий JSON, у каждого острова свой распарсенный объект, идентичность (один сигнал корзины на шапку и страницу) невозможна. Angular TransferState/provideClientHydration, Nuxt payload + useState('key'), Qwik сериализует useContextProvider, Astro передаёт Astro.locals в props, Marko <context> — везде состояние приходит из HTML один раз.

**Предложение:** (1) inject() при обходе DOM-предков читает и `data-aegis-provide` любого элемента (не только островов): JSON-литерал или ссылка `#id` на <script type="application/json"> (через jsonScript, кэш в WeakMap — парсинг один раз на элемент). (2) seedFrom() (6480) подбирает `<script type="application/json" data-aegis-state="user">` → _globalCtx.set('user', v), если ключ ещё не provide()-нут из JS (клиент сильнее сервера); вариант `data-aegis-signal` — кладётся один signal(v) → все острова получают тот же экземпляр (идентичность, дедупликация состояния между островами, запись из одного видна в другом). (3) createContext(default, name) получает строковое имя → inject(UserCtx) находит data-aegis-state="user" и data-aegis-provide.user. (4) E022 fix дополняется: «или положите значение в HTML: <body data-aegis-provide='{…}'> / <script data-aegis-state>».

**Алгоритм:**

```js
// createContext(defaultValue, name)
export function createContext(defaultValue, name) { return { id: Symbol('aegis.context'), default: defaultValue, name }; }
const _provideCache = new WeakMap();   // el → parsed object
function _domProvide(el) {
    let v = _provideCache.get(el);
    if (v === undefined) {
        const raw = el.dataset.aegisProvide;
        v = raw[0] === '#' ? (jsonScript(raw) || null) : (() => { try { return JSON.parse(raw); } catch (e) { _warn('E007', { what: `data-aegis-provide on <${el.localName}> is not valid JSON.`, why: String(e.message), fix: 'Use a JSON literal or "#id" of a <script type="application/json">.' }); return null; } })();
        _provideCache.set(el, v);
    }
    return v;
}
// inject(): обход DOM-предков (901-907)
const sk = key && key.name ? key.name : (typeof k === 'string' ? k : null);
for (let e = ownerEl.parentElement; e; e = e.parentElement) {
    const c = _components.get(e); const ctx = c && c.scope._ctx;
    if (ctx && ctx.has(k)) return ctx.get(k);
    if (sk && e.dataset.aegisProvide) { const p = _domProvide(e); if (p && _hasOwn(p, sk)) return p[sk]; }
}
if (_globalCtx.has(k)) return _globalCtx.get(k);
if (sk && _globalCtx.has(sk)) return _globalCtx.get(sk);       // Symbol-ключ с именем → серверный state
// seedFrom(): серверный state (TransferState)
for (const sc of root.querySelectorAll('script[type="application/json"][data-aegis-state]:not([data-aegis-seeded])')) {
    sc.dataset.aegisSeeded = '1';
    const k = sc.dataset.aegisState;
    if (_globalCtx.has(k)) continue;                             // provide() из JS сильнее
    try { const v = JSON.parse(sc.textContent); _globalCtx.set(k, sc.hasAttribute('data-aegis-signal') ? signal(v, 'state:' + k) : v); n++; }
    catch (e) { _warn('E007', { what: `seedFrom: invalid JSON in data-aegis-state="${k}".`, why: String(e.message), fix: 'Serialize with JSON and escape "</script" as "<\\/script".' }); }
}
```

**API:**

```js
createContext<T>(defaultValue?: T, name?: string): Context<T>   // name связывает с HTML-ключом
inject<T>(key: string | Context<T>, fallback?: T): T                 // теперь ищет и data-aegis-provide / data-aegis-state
// HTML:
<body data-aegis-provide='{"locale":"kk","theme":"dark"}'>
<section data-aegis-provide="#tenant">…</section>  <script type="application/json" id="tenant">{…}</script>
<script type="application/json" data-aegis-state="user">{"id":42,"name":"Ann"}</script>
<script type="application/json" data-aegis-state="cart" data-aegis-signal>{"count":3}</script>   // один сигнал на все острова
// seedFrom() возвращает n с учётом state-скриптов
```

**Критерий:** test.html: (1) host = '<div data-aegis-provide=\'{"theme":"dark"}\'><div data-aegis="lazy-p" data-aegis-load="visible"><div data-aegis="child"></div></div></div>'; child eager, родитель pending → внутри child `inject('theme') === 'dark'`, onWarn не получил E022. (2) `<script type="application/json" data-aegis-state="cart" data-aegis-signal>{"count":3}</script>` + два острова, каждый `inject('cart')` → `a === b`, `isSignal(a)`, `a.value.count === 3`; `provide('cart', x)` вне scope до hydrate → inject даёт x (клиент сильнее). (3) `const User = createContext(null, 'user')` + `data-aegis-state="user"` → `inject(User).name === 'Ann'`. (4) `data-aegis-provide="#tenant"` → значение из jsonScript, парсинг один раз (второй inject не вызывает JSON.parse — spy). Размер: тест 'ядро ≤ 6.3 KB gzip' остаётся зелёным.

**Источники:** Angular TransferState / provideClientHydration и HttpTransferCache, Nuxt payload и useState(key), Astro Astro.locals → island props, Qwik useContextProvider сериализация в qwik/json, Marko <context>, Django json_script / Rails content_tag(:script, type: 'application/json'), Solid Start seroval (сериализация ссылок с сохранением идентичности), существующий jsonScript() 9180 и seedFrom() 6480

### 💎 #80 — Стриминг и out-of-order острова: ранняя гидрация во время загрузки, data-aegis-defer + <template data-aegis-for>, поздние seed-скрипты

**Impact:** 4 · **Effort:** M · **Size:** +0.6 KB gzip (observer во время loading ~15 строк, defer-протокол ~25, seedFrom self-match 2 строки); tree-shakeable с hydrate

**Сейчас:** Автогидрация ждёт DOMContentLoaded (aegis_full.js:3247-3252): при стриминговом HTML (оболочка сразу, медленный хвост — длинная таблица, server island) шапка/корзина/навигация мертвы до последнего байта. seedFrom (6480-6508) ищет `root.querySelectorAll(...)` — сам root не матчится, поэтому `<script data-aegis-cache>`, добавленный парсером позже и пойманный _watchIslands (3511 → hydrate(n) → seedFrom(n)), теряется; остров с cachedResource внутри уже стартовал GET → двойная загрузка данных, которые сервер и так стримит. Нет протокола «плейсхолдер → контент»: Astro server islands ставят фолбэк и подменяют его прилетевшим `<template data-island-id>`, React Suspense — $RC(placeholder, template), Marko — <await client-reorder>, Solid Start — seroval-чанки; в Aegis для этого нужен свой JS на странице. streamResource (3960) всегда начинает с `initial` — не подхватывает уже стримленные сервером строки.

**Предложение:** (1) Прогрессивная гидрация: register() во время `document.readyState === 'loading'` сразу вызывает hydrate(document, { quiet: true, watch: true }) и ставит один MutationObserver на documentElement до DOMContentLoaded; остров, чьё поддерево ещё «открыто» (содержит текущую точку вставки парсера — глубочайший lastChild документа), откладывается до следующей пачки записей. (2) Протокол defer: `<div id="cart-1" data-aegis="cart" data-aegis-defer>фолбэк</div>` — остров pending (стратегия 'defer'), пока не прилетит `<template data-aegis-for="cart-1">…</template>` (или `<script data-aegis-cache data-aegis-for="cart-1">`): observer делает swap(placeholder, template.content, { mode: data-aegis-mode || 'inner' }), снимает data-aegis-defer, template удаляется, остров монтируется — ноль запросов, данные и разметка уже в HTML. (3) seedFrom матчит и сам root (`sc.matches(sel)`), поздние `data-aegis-cache` засеваются; если resource уже в полёте по этому ключу — seed выигрывает по эпохе (кэш-фаза 5 хранит версии). (4) streamResource(url, { seed: true }): `<script type="application/json" data-aegis-stream="/api/export.ndjson" data-aegis-cursor="250">[…первые строки…]</script>` → initial из скрипта, продолжение с `?after=250` — стрим резюмируется с места, где сервер остановил инлайн.

**Алгоритм:**

```js
// _scheduleAutoHydrate(): ранний старт + наблюдение до DOMContentLoaded
if (document.readyState === 'loading' && !_streamObs) {
    _streamObs = new MutationObserver((recs) => {
        for (const r of recs) for (const n of r.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.matches('template[data-aegis-for],script[data-aegis-for]')) _deliver(n);
            else if (n.matches('script[data-aegis-cache],script[data-aegis-state]')) seedFrom(n);
            else if (!_isOpen(n)) hydrate(n, { quiet: true });
            else _reopen.add(n);                       // поддерево ещё стримится
        }
        for (const n of _reopen) if (!_isOpen(n)) { _reopen.delete(n); hydrate(n, { quiet: true }); }
    });
    _streamObs.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { _streamObs.disconnect(); _streamObs = null; for (const n of _reopen) hydrate(n, { quiet: true }); _reopen.clear(); }, { once: true });
    hydrate(document, { quiet: true });
}
/** Элемент открыт, если содержит точку вставки парсера — глубочайший lastChild документа */
function _isOpen(el) {
    if (document.readyState !== 'loading') return false;
    let n = document.documentElement; while (n.lastChild) n = n.lastChild;
    return el === n || el.contains(n);
}
// Доставка контента defer-острову
function _deliver(node) {
    const id = node.dataset.aegisFor, ph = document.getElementById(id);
    if (node.tagName === 'SCRIPT') { seedFrom(node); }
    else if (ph) { swap(ph, node.content, { mode: ph.dataset.aegisMode || 'inner', hydrate: false }); node.remove(); }
    if (ph && (node.tagName === 'TEMPLATE' || !ph.dataset.aegisNeeds || --ph._needs <= 0)) { ph.removeAttribute('data-aegis-defer'); const m = _deferred.get(ph); if (m) { _deferred.delete(ph); m(); } }
}
// hydrate.mountIsland: стратегия defer
if (el.hasAttribute('data-aegis-defer')) { _deferred.set(el, mount); _cancelPending.set(el, () => _deferred.delete(el)); break; }
// seedFrom(): const list = root.nodeType === 1 && root.matches(sel) ? [root] : root.querySelectorAll(sel);
```

**API:**

```js
// HTML-протокол (сервер, любой язык):
<div id="cart-1" data-aegis="cart" data-aegis-defer>Загрузка…</div>
… стрим …
<template data-aegis-for="cart-1"><ul>…</ul></template>
<script type="application/json" data-aegis-cache="/api/cart" data-aegis-for="cart-1">{…}</script>
<script type="application/json" data-aegis-stream="/api/export.ndjson" data-aegis-cursor="250">[…]</script>
// JS:
hydrate.auto = true  // теперь стартует в readyState 'loading' и наблюдает до DOMContentLoaded
streamResource(url, { seed?: boolean, cursorParam?: string /* 'after' */ })
// События: aegis:deliver (detail: { id, kind: 'template'|'seed' }) на плейсхолдере
// data-aegis-load="defer" — эквивалент data-aegis-defer
```

**Критерий:** test.html (эмуляция стрима через appendChild с wait): root пуст → hydrate(root, { watch: true }); append '<div data-aegis="hdr"></div>' → через микрозадачу hdr hydrated; append '<div id="c1" data-aegis="cart" data-aegis-defer>…</div>' → `state === 'pending'`, mounts(cart) === 0, fetch-мок не вызывался; append '<script type="application/json" data-aegis-cache="/api/cart">{"n":2}</script>' и '<template data-aegis-for="c1"><b>2</b></template>' → остров смонтирован, `cache.get('/api/cart').n === 2`, `net.calls.length === 0`, template удалён, `c1.querySelector('b')`. Тест _isOpen: `document.readyState` подменить нельзя — юнит через параметр root с искусственным «последним узлом». streamResource seed: скрипт с 3 строками и cursor=3 → `data.value.length === 3` синхронно, mockFetch получил `?after=3`. Измерение: demo с искусственной задержкой хвоста 3 с (страница-обёртка со стримингом через ReadableStream в SW или сервер-заглушка) — шапка интерактивна через ~100 мс вместо ~3 с; DevTools Performance: первый aegis:hydrated до DOMContentLoaded.

**Источники:** Astro server islands (server:defer, <template data-island-id> + скрипт подмены), React 18 Suspense SSR ($RC/$RS, «selective hydration»), Marko <await client-reorder> и Marko 6 стриминг, Solid Start seroval streaming, Qwik streaming, HTML LS: парсер и MutationObserver во время загрузки (записи addedNodes по мере вставки), Declarative Shadow DOM как прецедент «HTML-протокола без JS», Chrome «Streaming HTML» (Jake Archibald), существующие _watchIslands 3504 и seedFrom 6480

### 💎 #81 — Page Lifecycle: BFCache-совместимость (suspend/resume SSE, стримов, poll) и кросс-документные View Transitions через pageswap/pagereveal

**Impact:** 4 · **Effort:** M · **Size:** +0.5 KB gzip (lifecycle-хаб ~25 строк + по 3-5 строк в sse/streamResource/poll/boost); хаб tree-shakeable, подключается только модулями, которые его импортируют

**Сейчас:** В aegis_full.js нет ни одного обработчика pagehide/pageshow/freeze/resume/pagereveal/pageswap (grep — только visibilitychange: 1601, 6395, 8640). sse() (4050-4070) держит EventSource открытым до dispose scope, streamResource читает body-стрим (3996-4009), poll/interval тикают — открытые соединения и незавершённые потоковые fetch — типичные причины в notRestoredReasons, из-за которых Chrome/Safari не кладут страницу в BFCache: «назад» в server-first MPA превращается в полную перезагрузку, и весь смысл быстрых MPA-переходов теряется. Если страница всё же восстановлена из BFCache (pageshow.persisted), ничто не ревалидирует cachedResource, не переоткрывает SSE, не возобновляет poll — пользователь видит данные возрастом в часы. boost() использует только same-document startViewTransition (9388-9391); для обычных MPA-переходов (без boost, `@view-transition { navigation: auto }`) движок не выставляет data-vt-type/direction, хотя router() уже делает это для SPA (8309-8323) — CSS `:active-view-transition-type(back)` не работает в MPA-режиме.

**Предложение:** Внутренний хаб `_lifecycle`: один набор слушателей pagehide(persisted)/pageshow(persisted)/freeze/resume с сигналом состояния (Page Lifecycle: active|passive|hidden|frozen) и реестром {suspend, resume}. sse() регистрирует close/reopen (с Last-Event-ID — EventSource делает это сам при reconnect, но после close нужен явный reopen), streamResource — abort с флагом interrupted и refresh() на resume, poll — pause/resume, кэш — `_sched` с причиной 'bfcache' (ревалидация только stale-записей через существующий планировщик фазы 3). Публично: `lifecycle.state` (сигнал), `lifecycle.onSuspend(fn)`, `lifecycle.onResume(fn)` — для своих WebSocket/RTC. Кросс-документные VT: слушатель pageswap выставляет `html.dataset.vtType = 'page back|forward'` по `e.activation` (navigationType 'traverse' и индексы), pagereveal — то же на новой странице и триггер восстановления стэша (бриллиант №2) по `navigation.activation.entry.key`; boost({ crossDocument: true }) — не перехватывать навигацию там, где `@view-transition` уже задан в CSS (проверка `getComputedStyle(document.documentElement).viewTransitionName`? нет — `CSS.supports('view-transition-name: a')` + опция), чтобы браузерный кросс-документный переход с prerender (speculate) шёл нативно.

**Алгоритм:**

```js
// ---- lifecycle hub (секция 8 или новая 8a) ----
const _lc = { state: signal(typeof document === 'undefined' || !document.hidden ? 'active' : 'hidden', 'lifecycle:state'), subs: new Set(), armed: false };
function _armLifecycle() {
    if (_lc.armed || typeof window === 'undefined') return; _lc.armed = true;
    const suspend = (why) => { _lc.state.value = why; for (const s of _lc.subs) { try { s.suspend && s.suspend(why); } catch (e) {} } };
    const resume = (why) => { _lc.state.value = 'active'; for (const s of _lc.subs) { try { s.resume && s.resume(why); } catch (e) {} } _revalidateAll && _revalidateAll('bfcache'); };
    window.addEventListener('pagehide', (e) => { if (e.persisted) suspend('frozen'); }, { capture: true });
    window.addEventListener('pageshow', (e) => { if (e.persisted) resume('bfcache'); });
    document.addEventListener('freeze', () => suspend('frozen'));
    document.addEventListener('resume', () => resume('resume'));
    // кросс-документные View Transitions: направление для CSS :active-view-transition-type(back)
    const dir = (act) => act && act.navigationType === 'traverse' && act.from && act.entry && act.from.index > act.entry.index ? 'back' : 'forward';
    window.addEventListener('pageswap', (e) => { if (e.viewTransition) document.documentElement.dataset.vtType = 'page ' + dir(e.activation); });
    window.addEventListener('pagereveal', (e) => {
        if (e.viewTransition) { document.documentElement.dataset.vtType = 'page ' + dir(typeof navigation !== 'undefined' ? navigation.activation : null); e.viewTransition.finished.finally(() => delete document.documentElement.dataset.vtType); }
        if (typeof _restoreStash === 'function') _restoreStash();       // бриллиант «стэш состояния»
    });
}
export const lifecycle = {
    get state() { return _lc.state; },
    onSuspend(fn) { _armLifecycle(); const s = { suspend: fn }; _lc.subs.add(s); return _scoped(() => _lc.subs.delete(s)); },
    onResume(fn) { _armLifecycle(); const s = { resume: fn }; _lc.subs.add(s); return _scoped(() => _lc.subs.delete(s)); },
};
function _lifecycleHook(suspend, resume) { _armLifecycle(); const s = { suspend, resume }; _lc.subs.add(s); return () => _lc.subs.delete(s); }
// sse(): let es = open(); const un = _lifecycleHook(() => { es.close(); status.value = 'closed'; }, () => { if (!closedByUser) es = open(); });
// streamResource._run: const un = _lifecycleHook(() => { if (controller === c) { interrupted = true; abort(); } }, () => { if (interrupted) { interrupted = false; refresh(); } });
// poll(): _lifecycleHook(() => stop(), () => start());
// boost(): if (opts.crossDocument && document.startViewTransition && CSS.supports('view-transition-name: x')) return { pending, visit, prefetch, dispose } без перехвата navigate — навигацию ведёт браузер + @view-transition
```

**API:**

```js
export const lifecycle: {
    readonly state: Signal<'active' | 'passive' | 'hidden' | 'frozen'>;
    onSuspend(fn: (why: 'frozen') => void): () => void;      // auto-cleanup в текущем scope
    onResume(fn: (why: 'bfcache' | 'resume') => void): () => void;
};
sse(url, { …, lifecycle?: boolean /* default true: close on pagehide(persisted)/freeze, reopen on pageshow/resume */ })
streamResource(url, { …, lifecycle?: boolean })
poll(fn, ms, { …, lifecycle?: boolean })
boost({ …, crossDocument?: boolean })   // отдать переход браузеру, если задан @view-transition { navigation: auto }
// CSS-контракт (как у router): html[data-vt-type~="back"]::view-transition-old(root) { … }
```

**Критерий:** test.html: (1) мок EventSource (класс с close-спаем) → sse('/ev') → `window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))` → `es.close` вызван, `status.value === 'closed'`; `pageshow` persisted → создан новый EventSource с тем же URL, `status.value === 'connecting'`; sse с `lifecycle:false` не трогается. (2) cachedResource с fakeClock: fresh-запись → pageshow persisted → 0 fetch; протухшая → ровно 1 fetch (через планировщик, причина 'bfcache' видна в cache.explain(key).history). (3) streamResource в полёте (mock ReadableStream) → pagehide persisted → reader отменён (`inflight.value === false`), pageshow → новый request тем же URL. (4) `pagereveal` с подменённым `navigation.activation` ({navigationType:'traverse', from:{index:2}, entry:{index:1}}) → `document.documentElement.dataset.vtType === 'page back'`. Измерение: Chrome DevTools → Application → Back/forward cache → «Test back/forward cache» на demo/admin.html с открытым sse — «Restored from back/forward cache» (сейчас ожидаемо блокируется); после реального «назад» `performance.getEntriesByType('navigation')[0].notRestoredReasons === null`.

**Источники:** web.dev «Back/forward cache» и «Page Lifecycle API» (freeze/resume, pagehide.persisted), notRestoredReasons API (Performance Timeline, Chrome 123+), HTML LS: pageswap/pagereveal события и PageSwapEvent.activation / NavigationActivation (Chrome 126+), CSS View Transitions Module Level 2 (@view-transition navigation: auto, :active-view-transition-type), Server-Sent Events spec (Last-Event-ID), Astro <ClientRouter> astro:before-swap и «Fallback to MPA view transitions», Hotwire Turbo turbo:before-cache, существующая _withTransition роутера 8309-8323 и visibilitychange-ревалидация 6395

