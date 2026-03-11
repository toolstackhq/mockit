# Usage

MockIt is a REST API mocking library for JS/TS applications.

For focused walkthroughs of the new lifecycle, journal, proxy, and E2E patterns, also see:

- `/guide/mvp-features`
- `/guide/e2e-playwright`

It supports three main ways to supply mock responses:

1. Programmatic mocks (`expect(...).returns(...)`)
2. Config-driven defaults (`loadDefaults(...)`)
3. OpenAPI-generated mocks (`loadSwagger(...)`)

The primary runtime is `MockServer`, which your app/test environment can call via HTTP.

## Who This Is For

- Developers running local feature work without depending on real upstream services.
- QA and automation engineers running deterministic UI/system tests.
- Teams that need default mock baselines plus per-test overrides.

## Start a Mock Server (Primary Flow)

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });
await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

### Programmatic mocks

```ts
import { MockServer, equals, startsWith, greaterThan } from 'mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/transfers')
  .method('POST')
  .matchHeader('Authorization', startsWith('Bearer'))
  .matchQuery('tenant', equals('bank-a'))
  .matchBody('$.amount', greaterThan(1000))
  .returns(200)
  .withBody({ ok: true });
```

Expanded matcher support:

- `matchCookie(name, matcher)`
- `matchBearerToken(matcher)` (matches `Authorization: Bearer <token>`)
- `matchBodyEquals(expectedJson)`

```ts
server.expect('/api/profile')
  .method('GET')
  .matchCookie('session_id', equals('abc123'))
  .matchBearerToken(startsWith('token-'))
  .returns(200)
  .withBody({ ok: true });

server.expect('/api/payment')
  .method('POST')
  .matchBodyEquals({ amount: 100, currency: 'USD' })
  .returns(200)
  .withBody({ approved: true });
```

### Config-driven default mocks

```ts
await server.loadDefaults('./mock-config.ts');
```

`mock-config.ts`:

```ts
import { defineDefaults } from 'mockit';

export default defineDefaults([
  {
    path: '/getUser',
    method: 'GET',
    response: {
      status: 200,
      body: { name: 'Default User' },
    },
  },
]);
```

### OpenAPI-generated mocks

```ts
await server.loadSwagger('./openapi.yaml');
```

## Override-First Testing (Most Important Pattern)

Use defaults/swagger as baseline, then override only what a test needs.

Resolution order:

1. `override`
2. `default`
3. `swagger`

So test overrides always win over generated/default mocks.

```ts
await server.loadDefaults('./mock-config.ts');
await server.loadSwagger('./openapi.yaml');

server.expect('/getUser')
  .method('GET')
  .returns(200)
  .withBody({ name: 'Test User' }); // wins for matching request
```

## UI Test Example (Test-Scoped Override)

Scenario:

1. App UI calls `http://localhost:3001/getUser`.
2. Baseline response is `Default User`.
3. One test overrides to `Test User`.
4. After test, override is cleared.

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });

beforeAll(async () => {
  await server.loadDefaults('./mock-config.ts');
  await server.start();
});

afterEach(() => {
  server.resetOverrides(); // clears only test overrides
});

afterAll(async () => {
  await server.stop();
});

it('uses override only for this test', async () => {
  const getUserOverride = server.expect('/getUser')
    .method('GET')
    .returns(200)
    .withBody({ name: 'Test User' });

  // run UI flow (Playwright/Cypress/Webdriver/etc.)
  // UI -> localhost:3001/getUser -> Test User

  expect(getUserOverride.isInvoked()).toBe(true); // confirms override path was hit
});
```

Verification helpers:

- `verify(path, options?)`
- `verifyCount(path, expectedCount, options?)`
- `verifyNotCalled(path, options?)`
- `explainVerification(path, options?)`

```ts
expect(server.verify('/getUser')).toBe(true);
expect(server.verifyCount('/getUser', 1)).toBe(true);
expect(server.verifyNotCalled('/not-called')).toBe(true);

const details = server.explainVerification('/getUser');
console.log(details.totalCallCount);
```

## Lifecycle Controls for E2E Tests

Use finite mocks when a test expects a dependency to be called a specific number of times.

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/checkout')
  .method('POST')
  .count(1)
  .returns(201)
  .withBody({ orderId: 'ORD-1' });

// First checkout request is mocked.
// Second checkout request returns 501 because the mock is exhausted.
```

`count(0)` keeps the mock unlimited:

```ts
server.expect('/api/reference/countries')
  .method('GET')
  .count(0)
  .returns(200)
  .withBody([{ code: 'US' }]);
```

For retry flows, use sequential replies:

```ts
server.expect('/api/payment/status')
  .method('GET')
  .returns(500)
  .withBody({ retry: true })
  .thenReply(200)
  .withBody({ status: 'approved' });

// Example E2E flow:
// 1. UI polls payment status.
// 2. First call gets 500.
// 3. UI retries.
// 4. Second call gets 200.
```

For shared baseline mocks that should never exhaust:

```ts
server.expect('/api/reference/countries')
  .method('GET')
  .returns(200)
  .withBody([{ code: 'US' }])
  .persist();
```

Track pending expectations in assertions:

```ts
expect(server.pendingMocks()).toHaveLength(1);
expect(server.isDone()).toBe(false);
```

Optional mocks do not block `isDone()`:

```ts
server.expect('/api/analytics')
  .method('POST')
  .returns(202)
  .withBody({ queued: true })
  .once()
  .optionally();
```

## Alternative Runtime: In-Process Interceptor

Use `HttpInterceptor` when you want to patch `fetch` inside the test process.

```ts
import { HttpInterceptor } from 'mockit';

const interceptor = new HttpInterceptor();

interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Intercepted User' }]);

interceptor.enable();
// fetch(...) calls are intercepted
interceptor.disable();
```

This is useful for component tests or Node-based API tests where the app and mock live in the same process.

```ts
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

it('shows retry UI after an upstream failure', async () => {
  interceptor.expect('/api/orders/123')
    .method('GET')
    .returns(500)
    .withBody({ error: 'temporary' })
    .thenReply(200)
    .withBody({ id: 123, status: 'ready' });

  // app code calls fetch('/api/orders/123') twice
});
```

## Request Journal and Admin API

Every matched, unmatched, or proxied request is stored in the journal.

In code:

```ts
const requests = server.listRequests();
const unmatched = server.listUnmatchedRequests();

expect(requests[0].matched).toBe(true);
expect(unmatched[0].nearMisses[0].reasons).toContain(
  'method mismatch: expected POST, got GET'
);

server.clearJournal();
```

In server mode, the same data is available over HTTP:

- `GET /_mockit/api/mocks`
- `GET /_mockit/api/requests`
- `GET /_mockit/api/unmatched`
- `GET /_mockit/api/pending`
- `DELETE /_mockit/api/journal`

This is useful in Playwright/Cypress suites where the test runner wants to inspect mock traffic after a scenario.

## Proxy and Record Mode

Use proxy mode when you want to hit a real upstream once, then keep the response as a reusable default mock.

```ts
const server = new MockServer({
  port: 3001,
  onUnhandled: 'proxy',
  proxyBaseUrl: 'https://dev-upstream.internal',
  recordProxiedResponses: true,
});

await server.start();
```

Now the flow is:

1. A request hits `mockit`.
2. If a mock matches, `mockit` serves it.
3. If nothing matches, `mockit` proxies to `proxyBaseUrl`.
4. The proxied response is recorded as a default mock for later reuse.

The interceptor supports the same pattern:

```ts
const interceptor = new HttpInterceptor({
  onUnhandled: 'proxy',
  proxyBaseUrl: 'https://dev-upstream.internal',
  recordProxiedResponses: true,
});
```

## Dynamic Responses and Fault Simulation

Use templating and runtime faults directly on response builders.

```ts
server.expect('/api/template')
  .method('GET')
  .returns(200)
  .withBodyTemplate({
    message: 'Hello {{request.query.name}}',
    route: '{{request.path}}',
  });

server.expect('/api/delay')
  .returns(200)
  .withRandomDelay(50, 120)
  .withBody({ ok: true });

server.expect('/api/reset')
  .returns(500)
  .withFault('connection-reset');
```

## Notes

- `expect(...)` creates an override mock.
- `resetOverrides()` clears only override mocks.
- `resetAll()` clears everything.
- In server mode, unmatched calls return `501`.
- In interceptor mode, unmatched calls pass through to original `fetch`.
