## TypeScript

Aegis ships with hand-authored `.d.ts` declarations, checked against the runtime on every `npm test` (`tsc` over `test-types.ts` + an export-set diff). No build step needed:

```js
// @ts-check
import { signal, computed, resource, form, minLen } from './aegis.js';

const count = signal(0);                          // Signal<number>
const doubled = computed(() => count.value * 2);  // Computed<number>
const users = resource('/api/users', { initial: [] as User[] });   // data: Signal<User[]> — no null
users.error.value instanceof HttpError && users.error.value.status; // narrowing works
form({ age: { value: 0, rules: [minLen(3)] } });  // error: minLen is a ValidationRule<string>
```

Route params are inferred from the pattern (`'/users/:id'` → `{ id: string }`), `element('x-counter', Counter, { props: { count: { type: Number, default: 0 } } })` types `ctx.props.count` as `number`, `i18n(dict)` types `t(key)` by the dictionary keys. Full IntelliSense in VS Code out of the box.
