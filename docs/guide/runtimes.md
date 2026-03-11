# Runtimes

MockIt has two runtimes:

- `MockServer`
- `HttpInterceptor`

They are related, but they do not work the same way. This page explains the difference, when to use each one, and why host behavior is different between them.

## Short Version

`MockServer`:

- starts a real HTTP server
- your app or browser must call that server
- best for UI tests, E2E tests, and cross-process integration tests

`HttpInterceptor`:

- does not start a server
- patches `fetch` inside the current Node process
- best for Node-side tests, service tests, and component tests

Simple mental model:

- `MockServer` = run a fake API
- `HttpInterceptor` = trap `fetch` calls in-process

## Why This Matters

If you confuse these two runtimes, a lot of behavior looks surprising:

- why does `MockServer` need `localhost:3001`?
- why can `HttpInterceptor` intercept `http://api.internal/...`?
- why can one runtime use admin HTTP endpoints and the other cannot?
- why does fallback behavior look different?

The answer is that one runtime receives network traffic and the other one intercepts calls before they leave the process.

## Runtime Comparison

| Topic | `MockServer` | `HttpInterceptor` |
|---|---|---|
| Starts a real server | Yes | No |
| Needs host/port wiring | Yes | No separate host |
| Works with browser E2E | Yes | Usually no |
| Works across processes | Yes | No |
| Intercepts Node `fetch` in-place | No | Yes |
| Has HTTP admin API | Yes | No |
| Best for | UI, E2E, microservice integration | Node-side app/service tests |

## `MockServer` Explained

`MockServer` creates a real HTTP server.

```ts
import { MockServer } from 'mockit';

const server = new MockServer({ port: 3001 });
await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

When you use `MockServer`, your app must call that address.

Example:

```ts
const res = await fetch('http://127.0.0.1:3001/api/users');
```

If your app instead calls:

```ts
await fetch('https://real-api.company.internal/api/users');
```

then `MockServer` never sees that request.

### Host behavior in `MockServer`

For `MockServer`, host is naturally part of the routing story because you are running a real server.

That means:

- your app must point to the mock server host/port
- `localhost` or `127.0.0.1` is the normal testing setup
- if the app points elsewhere, the request will not be mocked by `MockServer`

### Best use cases for `MockServer`

Use it for:

- Playwright tests
- Cypress tests
- browser-driven QA flows
- microservice integration tests where another process makes HTTP calls
- local frontend development against a fake backend

## `HttpInterceptor` Explained

`HttpInterceptor` does not start a server. It replaces `globalThis.fetch` inside the current Node process.

```ts
import { HttpInterceptor } from 'mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });
interceptor.enable();
```

Once enabled, `fetch(...)` is intercepted before the request goes out.

Example:

```ts
interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Jane' }]);

const res = await fetch('http://api.internal/api/users');
```

This works because the interceptor matches the request inside the same process. It is not waiting for a network call to hit a server.

### Host behavior in `HttpInterceptor`

For `HttpInterceptor`, host is not required for routing because there is no separate mock server.

What matters by default is:

- method
- path
- headers
- query
- body

So these can all match the same mock if the path is the same:

```ts
await fetch('http://localhost/api/users');
await fetch('http://api.internal/api/users');
await fetch('https://example.test/api/users');
```

Why would anyone do that?

- production code may already call an absolute upstream URL
- tests may want to preserve that shape instead of rewriting URLs
- it proves the interceptor can trap calls without changing app code

For docs and beginner examples, `localhost` is usually clearer. For real application tests, keeping the real host can still be useful.

## Fallback Behavior

Fallback behavior is also runtime-specific.

### `MockServer`

`MockServer` only handles requests that actually hit the mock server.

If a request reaches the server and no mock matches:

- `fail` mode returns `501`
- `proxy` mode forwards to `proxyBaseUrl`

### `HttpInterceptor`

If `fetch` is intercepted and no mock matches:

- `passthrough` calls the original `fetch`
- `fail` throws immediately
- `proxy` forwards to `proxyBaseUrl`

For strict test environments, the safest setup is:

- `MockServer`: point the app base URL at the mock server
- `HttpInterceptor`: use `onUnhandled: 'fail'`

## Which One Should You Choose?

Choose `MockServer` if:

- a browser needs to call the mock
- another process needs to call the mock
- you want a real HTTP endpoint
- you want to inspect state over `/_mockit/api/*`

Choose `HttpInterceptor` if:

- the code under test runs in the same Node process
- the code uses `fetch`
- you want a lighter and faster test setup
- you do not want to manage ports or base URLs

## Common Examples

### Example 1: Playwright UI test

Use `MockServer`.

```ts
const server = new MockServer({ port: 3001 });
await server.start();

// App under test must call http://127.0.0.1:3001
```

### Example 2: Service-layer test in Vitest

Use `HttpInterceptor`.

```ts
const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });
interceptor.enable();

// app code calls fetch(...)
// interceptor handles it in-process
```

### Example 3: Local frontend development

Usually use `MockServer`.

Reason:

- the browser needs a real backend URL to call

### Example 4: Testing a retry helper around `fetch`

Usually use `HttpInterceptor`.

Reason:

- the helper already runs in Node
- you can intercept the exact calls without starting a server

## Recommended Defaults

For browser/UI/E2E work:

- use `MockServer`
- point the app base URL at the mock server
- use `count(1)` or sequential replies for scenario-specific behavior

For Node/API/component tests:

- use `HttpInterceptor`
- prefer `onUnhandled: 'fail'`
- use `listRequests()` and `listUnmatchedRequests()` for assertions

## Final Rule of Thumb

Do not think in terms of “always localhost”.

Think in terms of:

- which runtime am I using?
- where does the request actually flow?
- do I want unmatched traffic to fail, pass through, or proxy?

If the answer is “I want a browser or another process to hit a fake API”, use `MockServer`.

If the answer is “I want to trap `fetch` inside my current Node process”, use `HttpInterceptor`.
