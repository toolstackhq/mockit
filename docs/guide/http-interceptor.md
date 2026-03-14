# HttpInterceptor

## What It Is

`HttpInterceptor` does not start a server. It patches `fetch` inside the current Node process.

Simple idea:

- your code calls `fetch(...)`
- MockIt stands in front of that call
- if the request matches a mock, MockIt returns fake data
- the real network call does not happen

When MockIt says it "intercepts fetch", it means this function:

```ts
globalThis.fetch
```

That is the same function your code uses here:

```ts
await fetch('https://api.example.com/users');
```

After `interceptor.enable()`, MockIt temporarily replaces that `fetch` with its own wrapper.

Best for:

- Vitest or Jest service tests
- Node-side integration tests
- component tests that run in Node

## Features

- uses the same `expect(...).returns(...)` API as `MockServer`
- supports defaults and OpenAPI loading
- supports `passthrough`, `fail`, and `proxy` modes for unmatched requests
- records matched and unmatched requests in the same journal APIs
- matches by request path, not by base URL or hostname

## Configure

TypeScript defaults:

```ts
await interceptor.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await interceptor.loadSwagger('./openapi.yaml');
```

## Usage

```ts
import { HttpInterceptor } from '@toolstackhq/mockit';

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

## How Matching Works

`HttpInterceptor` currently matches by path and method.

That means this expectation:

```ts
interceptor.expect('/users').method('GET');
```

can match all of these:

```ts
await fetch('http://localhost/users');
await fetch('https://api.example.com/users');
await fetch('https://google.com/users');
```

because the request path is still `/users`.

So:

- base URL does not matter
- path does matter
- extra matchers like headers, query, cookies, and body still apply if you add them

## Available Expectations

The expectation and response APIs are the same as `MockServer`.

Common methods:

- `method(...)`
- `count(n)`
- `matchHeader(...)`
- `matchCookie(...)`
- `matchBearerToken(...)`
- `matchQuery(...)`
- `matchBody(...)`
- `matchBodyEquals(...)`
- `returns(...)`
- `withBody(...)`
- `withHeaders(...)`
- `withDelay(...)`
- `withRandomDelay(...)`
- `withBodyTemplate(...)`
- `withFault(...)`
- `thenReply(...)`
- `replySequence(...)`

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

## Notes

- `HttpInterceptor` works only inside the current Node process
- it intercepts `fetch`, not arbitrary browser traffic
- it intercepts `fetch`, not Axios in Node
- use `onUnhandled: 'fail'` for strict tests
- use `MockServer` instead if a browser or another process must hit the mock
- it is not a standalone process runtime

## Fetch Vs Axios

Use `HttpInterceptor` for code that calls:

```ts
await fetch(...)
```

It does not automatically intercept Axios in Node, because Axios usually uses its own HTTP adapter instead of `fetch`.

So:

- `fetch` in the same Node process: yes
- Axios in Node: no, not directly
- browser traffic from Playwright or Cypress pages: no

If you need to mock Axios or browser traffic, use `MockServer` instead.

## Sample

```ts
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.enable();

interceptor.expect('/api/profile')
  .method('GET')
  .returns(500)
  .withBody({ retry: true })
  .thenReply(200)
  .withBody({ id: 1, name: 'Jane' });

// app code calls fetch('/api/profile')

interceptor.disable();
```
