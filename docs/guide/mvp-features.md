# MVP Features

This page focuses on the new features added in the current MVP pass and the testing problem each one solves.

## 1. Finite-Use Mocks

Use `.count(n)` when your test expects a dependency to be called a specific number of times.

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/checkout')
  .method('POST')
  .count(1)
  .returns(201)
  .withBody({ orderId: 'ORD-42' });
```

Why it matters:

- catches accidental duplicate submissions
- makes retry counts explicit
- gives you `pendingMocks()` and `isDone()` assertions

`count(0)` means unlimited matches:

```ts
server.expect('/api/reference/countries')
  .method('GET')
  .count(0)
  .returns(200)
  .withBody([{ code: 'US' }]);
```

## 2. Optional Expectations

Some calls are nice to observe but should not fail the test if they never happen.

```ts
server.expect('/api/analytics')
  .method('POST')
  .returns(202)
  .withBody({ queued: true })
  .once()
  .optionally();
```

Use this for:

- analytics beacons
- audit events
- background refresh calls

## 3. Persistent Baseline Mocks

Use `.persist()` for baseline data that should never exhaust.

```ts
server.expect('/api/reference/countries')
  .method('GET')
  .returns(200)
  .withBody([{ code: 'US', name: 'United States' }])
  .persist();
```

This is useful for:

- lookup data
- feature flags
- session/bootstrap endpoints that the UI calls often

## 4. Sequential Replies

Use `.thenReply()` or `.replySequence()` when the same endpoint should evolve over time.

```ts
server.expect('/api/orders/123/status')
  .method('GET')
  .returns(202)
  .withBody({ status: 'processing' })
  .thenReply(202)
  .withBody({ status: 'processing' })
  .thenReply(200)
  .withBody({ status: 'complete' });
```

Good fits:

- polling UIs
- retry behavior
- progressive state changes

## 5. Request Journal

Every request is recorded as matched, unmatched, or proxied.

```ts
const requests = server.listRequests();
const unmatched = server.listUnmatchedRequests();

expect(requests[0].matched).toBe(true);
expect(unmatched[0].nearMisses[0].reasons).toContain(
  'method mismatch: expected POST, got GET'
);
```

The journal is useful when:

- a UI test fails and you want to see what the app actually called
- you need to prove a dependency was never touched
- you want to debug a matcher that almost matched

## 6. Admin API

In server mode, you can inspect the current mock state and journal over HTTP.

- `GET /_mockit/api/mocks`
- `GET /_mockit/api/requests`
- `GET /_mockit/api/unmatched`
- `GET /_mockit/api/pending`
- `DELETE /_mockit/api/journal`

This works well with browser E2E tools because the test runner can query MockIt after the scenario finishes.

## 7. Proxy and Record Mode

Proxy mode lets unmatched requests hit a real upstream. Record mode stores the proxied response as a reusable default mock.

```ts
const server = new MockServer({
  port: 3001,
  onUnhandled: 'proxy',
  proxyBaseUrl: 'https://dev-upstream.internal',
  recordProxiedResponses: true,
});
```

This is useful when:

- a team is still exploring an upstream API
- you want to capture realistic payloads quickly
- you want to convert real responses into stable local mocks

## 8. Interceptor Policies

`HttpInterceptor` now supports explicit unhandled behavior:

```ts
const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });
```

Modes:

- `passthrough`: unmatched requests use the original `fetch`
- `fail`: unmatched requests throw immediately
- `proxy`: unmatched requests are forwarded to `proxyBaseUrl`

For Node-based API tests, `fail` is usually the safest default.
