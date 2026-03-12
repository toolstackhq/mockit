# MockServer Playwright

Use `RemoteMockServer` when the app stack already starts MockIt and the Playwright test only needs to override behavior.

The repo also includes a full working sample:

- `tests/e2e/mock-server-override.spec.ts`
- `tests/e2e/mock-server-api.spec.ts`
- `tests/e2e/fixtures/demo-app.html`
- `tests/e2e/fixtures/demo-mock-config.ts`

## Example

```ts
import { test, expect } from '@playwright/test';
import { RemoteMockServer } from '@toolstackhq/mockit';

const mockit = new RemoteMockServer('http://127.0.0.1:3001');

test.beforeEach(async () => {
  await mockit.resetOverrides();
  await mockit.clearJournal();
});

test('shows unauthorized when login API returns 403', async ({ page }) => {
  await mockit.expect('/api/login')
    .method('POST')
    .count(1)
    .returns(403)
    .withBody({ message: 'unauthorized' })
    .apply();

  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.locator('h3')).toHaveText('unauthorized');
  await expect(await mockit.verify('/api/login')).toBe(true);
});
```

## Header And Body Matching

```ts
import { test } from '@playwright/test';
import {
  RemoteMockServer,
  equals,
  startsWith,
  greaterThan,
} from '@toolstackhq/mockit';

const mockit = new RemoteMockServer('http://127.0.0.1:3001');

test('blocks payment for high amount', async ({ page }) => {
  await mockit.expect('/api/payment')
    .method('POST')
    .count(1)
    .matchHeader('x-tenant', equals('bank-a'))
    .matchBearerToken(startsWith('token-'))
    .matchBody('$.amount', greaterThan(1000))
    .returns(403)
    .withBody({ message: 'blocked' })
    .apply();

  await page.goto('http://127.0.0.1:5173/payments');
});
```

## Retry Flow

```ts
await mockit.expect('/api/orders/123')
  .method('GET')
  .count(2)
  .returns(500)
  .withBody({ retry: true })
  .thenReply(200)
  .withBody({ id: 123, status: 'complete' })
  .apply();
```

## Common Test Helpers

```ts
await mockit.resetOverrides();
await mockit.clearJournal();

const overrides = await mockit.listOverrides();
const requests = await mockit.listRequests();
const unmatched = await mockit.listUnmatchedRequests();
const pending = await mockit.pendingMocks();
const done = await mockit.isDone();
```
