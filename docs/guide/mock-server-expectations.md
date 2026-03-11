# MockServer Expectations

## Add Expectations

```ts
import { MockServer, equals, startsWith, greaterThan } from '@toolstackhq/mockit';

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

Remote override with the same matcher set:

```ts
import { RemoteMockServer, equals, startsWith, greaterThan } from '@toolstackhq/mockit';

const remote = new RemoteMockServer('http://127.0.0.1:3001');

await remote.expect('/api/transfers')
  .method('POST')
  .count(1)
  .matchHeader('Authorization', startsWith('Bearer'))
  .matchQuery('tenant', equals('bank-a'))
  .matchBody('$.amount', greaterThan(1000))
  .returns(200)
  .withBody({ ok: true })
  .apply();
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

Built-in matchers:

- `equals(...)`
- `startsWith(...)`
- `endsWith(...)`
- `contains(...)`
- `regex(...)`
- `greaterThan(...)`
- `lessThan(...)`
- `between(...)`
- `any()`

`MockServer`, `HttpInterceptor`, TypeScript defaults, and remote overrides all use this same matcher set.

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
