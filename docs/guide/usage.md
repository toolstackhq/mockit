# Usage

MockIt is a REST API mocking library for JS/TS applications.

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
