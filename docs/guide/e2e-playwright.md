# E2E Recipes

This page shows how to use MockIt in end-to-end and test-runner flows.

## Playwright + MockServer

For browser E2E tests, `MockServer` is the primary runtime because the browser talks to a real HTTP server.

### 1. Create a reusable fixture

```ts
// tests/fixtures/mock-server.ts
import { test as base } from '@playwright/test';
import { MockServer } from 'mockit';

export const test = base.extend<{ mockServer: MockServer }>({
  mockServer: async ({}, use) => {
    const server = new MockServer({ port: 3001 });
    await server.loadDefaults('./tests/fixtures/mock-config.ts');
    await server.start();

    try {
      await use(server);
    } finally {
      await server.stop();
    }
  },
});
```

### 2. Reset test-only state after each test

```ts
import { test, expect } from './fixtures/mock-server';

test.afterEach(async ({ mockServer }) => {
  mockServer.resetOverrides();
  mockServer.clearJournal();
});
```

### 3. Override only the endpoint needed by the scenario

```ts
test('shows an error toast when checkout fails', async ({ page, mockServer }) => {
  mockServer.expect('/api/checkout')
    .method('POST')
    .returns(500)
    .withBody({ message: 'payment declined' })
    .once();

  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('payment declined')).toBeVisible();
  expect(mockServer.isDone()).toBe(true);
});
```

### 4. Model retry or polling flows

```ts
test('polling widget moves from processing to complete', async ({ page, mockServer }) => {
  mockServer.expect('/api/orders/123/status')
    .method('GET')
    .returns(202)
    .withBody({ status: 'processing' })
    .thenReply(200)
    .withBody({ status: 'complete' });

  await page.goto('http://localhost:5173/orders/123');

  await expect(page.getByText('processing')).toBeVisible();
  await expect(page.getByText('complete')).toBeVisible();
});
```

### 5. Inspect what the UI actually called

```ts
test('journal shows unmatched traffic', async ({ page, mockServer }) => {
  await page.goto('http://localhost:5173');

  const unmatched = mockServer.listUnmatchedRequests();
  console.log(unmatched);
});
```

You can also call the admin API directly from the test runner:

```ts
const res = await fetch('http://127.0.0.1:3001/_mockit/api/requests');
const requests = await res.json();
```

## Playwright + Proxy/Record

This is useful when a UI test should mostly use recorded traffic from a real environment.

```ts
const server = new MockServer({
  port: 3001,
  onUnhandled: 'proxy',
  proxyBaseUrl: 'https://dev-upstream.internal',
  recordProxiedResponses: true,
});
```

Recommended workflow:

1. Run a scenario against the real upstream once.
2. Let MockIt proxy and record the traffic.
3. Re-run locally against the recorded defaults.
4. Add only the overrides needed for edge cases.

## Node API or Component Tests + HttpInterceptor

For Node-side tests where the code under test uses `fetch`, `HttpInterceptor` is lighter than a standalone server.

```ts
import { beforeEach, afterEach, expect, it } from 'vitest';
import { HttpInterceptor } from 'mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

beforeEach(() => {
  interceptor.enable();
});

afterEach(() => {
  interceptor.disable();
  interceptor.resetAll();
  interceptor.clearJournal();
});

it('retries once before succeeding', async () => {
  interceptor.expect('/api/profile')
    .method('GET')
    .returns(500)
    .withBody({ retry: true })
    .thenReply(200)
    .withBody({ id: 1, name: 'Jane' });

  // call application code that performs the fetch

  expect(interceptor.listRequests()).toHaveLength(2);
});
```

## Practical Defaults

For UI E2E suites:

- use `MockServer`
- keep defaults in shared config files
- use `.once()` and `.thenReply()` for scenario-specific behavior
- clear overrides and journal after each test

For Node/API suites:

- use `HttpInterceptor`
- prefer `onUnhandled: 'fail'`
- assert on `listRequests()` and `listUnmatchedRequests()` after the test
