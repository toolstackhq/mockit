# Usage

MockIt has two runtimes:

- `MockServer`: a real HTTP mock server
- `HttpInterceptor`: an in-process `fetch` interceptor for Node tests

Mocks can come from:

- programmatic expectations
- TypeScript defaults via `loadDefaults(...)`
- OpenAPI mocks via `loadSwagger(...)`

## MockServer

### What It Is

`MockServer` starts a real HTTP server. Use it when your app, browser, or another process must call a real mock endpoint.

Best for:

- Playwright or Cypress tests
- frontend development against a fake backend
- cross-process integration tests

### Configure

TypeScript defaults:

```ts
import { defineDefaults } from 'mockit';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [{ id: 1, name: 'Default User' }],
    },
  },
]);
```

```ts
await server.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await server.loadSwagger('./openapi.yaml');
```

### Start

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });
await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

Your app must call the mock server address.

```ts
const res = await fetch('http://127.0.0.1:3001/api/users');
```

### Add Expectations

```ts
import { MockServer, equals, startsWith, greaterThan } from 'mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/transfers')
  .method('POST')
  .count(1)
  .matchHeader('Authorization', startsWith('Bearer'))
  .matchQuery('tenant', equals('bank-a'))
  .matchBody('$.amount', greaterThan(1000))
  .returns(200)
  .withBody({ ok: true });
```

### Available Expectation Methods

Request matching:

- `method('GET' | 'POST' | ...)`
- `count(n)` where `count(0)` means unlimited
- `matchHeader(name, matcher)`
- `matchCookie(name, matcher)`
- `matchBearerToken(matcher)`
- `matchQuery(name, matcher)`
- `matchBody(jsonPath, matcher)`
- `matchBodyEquals(value)`

Response building:

- `returns(status)`
- `withBody(value)`
- `withHeaders(headers)`
- `withDelay(ms)`
- `withRandomDelay(min, max)`
- `withBodyTemplate(template)`
- `withFault('connection-reset' | 'empty-response')`
- `thenReply(status)`
- `replySequence(...statuses)`
- `withStatus(status)`
- `withBodyFromFile(path)`

Lifecycle helpers:

- `once()`
- `times(n)`
- `persist()`
- `optionally()`

### Verification and Inspection

Verification:

- `verify(path, options?)`
- `verifyCount(path, expectedCount, options?)`
- `verifyNotCalled(path, options?)`
- `explainVerification(path, options?)`

Journal:

- `listRequests()`
- `listUnmatchedRequests()`
- `clearJournal()`
- `pendingMocks()`
- `isDone()`

Server admin endpoints:

- `GET /_mockit/api/mocks`
- `GET /_mockit/api/requests`
- `GET /_mockit/api/unmatched`
- `GET /_mockit/api/pending`
- `DELETE /_mockit/api/journal`

### Example

```ts
const server = new MockServer({ port: 3001 });

await server.loadDefaults('./mock-config.ts');
await server.start();

server.expect('/api/checkout')
  .method('POST')
  .count(1)
  .returns(500)
  .withBody({ message: 'payment declined' });

// app calls http://127.0.0.1:3001/api/checkout

expect(server.verify('/api/checkout')).toBe(true);
```

## HttpInterceptor

### What It Is

`HttpInterceptor` does not start a server. It patches `fetch` inside the current Node process.

Best for:

- Vitest or Jest service tests
- Node-side integration tests
- component tests that run in Node

### Features

- uses the same `expect(...).returns(...)` API as `MockServer`
- supports defaults and OpenAPI loading
- supports `passthrough`, `fail`, and `proxy` modes for unmatched requests
- records matched and unmatched requests in the same journal APIs

### Usage

```ts
import { HttpInterceptor } from 'mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Intercepted User' }]);

interceptor.enable();

const res = await fetch('http://localhost/api/users');
console.log(await res.json());

interceptor.disable();
```

### Notes

- `HttpInterceptor` works only inside the current Node process
- it intercepts `fetch`, not arbitrary browser traffic
- use `onUnhandled: 'fail'` for strict tests
- use `MockServer` instead if a browser or another process must hit the mock

## Which One Should I Use?

Use `MockServer` when:

- you need a real HTTP endpoint
- the browser must call the mock
- another process must call the mock

Use `HttpInterceptor` when:

- the code under test already runs in Node
- the code uses `fetch`
- you want a lighter setup without a server port
