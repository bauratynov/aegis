## Testing

`aegis/test` is a dependency-free helper set for any browser runner (the repo's `test.html`, Vitest browser mode, Playwright, Web Test Runner):

```js
import { render, fire, waitFor, mockFetch, cleanup } from 'aegis/test';

const net = mockFetch({ 'GET /api/users': () => [{ id: 1, name: 'Ada' }], 'DELETE /api/users/:id': () => ({ status: 204 }) });
const t = render(Users);                       // the same Component contract as island() / mount()
await waitFor(() => t.findAll('tr').length === 1);
fire.click(t.find('button.delete'));           // real DOM events: click, input, submit, key, focus…
await waitFor(() => t.text().includes('0 rows'));
expect(net.last().method).toBe('DELETE');
cleanup();                                     // unmount, restore fetch, reset engine singletons
```

`waitFor` drains effects, pending resources and mutations between checks, so tests never need `sleep()`. `npm run test:browsers` runs the engine's own suite in headless Chrome and Firefox, `npm run test:webkit` in Playwright WebKit; CI runs all three on every push.
