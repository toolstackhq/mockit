# MockServer

## What It Is

`MockServer` starts a real HTTP server. Use it when your app, browser, or another process must call a real mock endpoint.

Best for:

- Playwright or Cypress tests
- frontend development against a fake backend
- cross-process integration tests

## Start

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

## Configure

TypeScript defaults:

```ts
await server.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await server.loadSwagger('./openapi.yaml');
```

## Add Expectations

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

## Available Expectations

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

## Verification and Inspection

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

Admin endpoints:

- `GET /_mockit/api/mocks`
- `GET /_mockit/api/requests`
- `GET /_mockit/api/unmatched`
- `GET /_mockit/api/pending`
- `DELETE /_mockit/api/journal`

## Sample

```ts
const server = new MockServer({ port: 3001 });

await server.loadDefaults('./mock-config.ts');
await server.start();

server.expect('/api/checkout')
  .method('POST')
  .count(1)
  .returns(500)
  .withBody({ message: 'payment declined' });

expect(server.verify('/api/checkout')).toBe(true);
```
